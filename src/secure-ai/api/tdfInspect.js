/**
 * Reading what is inside a .tdf without decrypting it.
 *
 * The SDK separates these two things — `client.open()` returns a reader whose `manifest()` and
 * `attributes()` are pure local parsing, while `decrypt()` is the part that talks to a KAS. So a
 * document someone else's platform encrypted can be shown here in full detail: its policy, the
 * attributes bound into it, which KAS holds its key. It just cannot be opened, and saying so
 * precisely is more convincing than a generic failure.
 *
 * Verified against real files rather than assumed: no token and no network are needed for
 * inspection (`scripts/inspect-tdf.mjs` runs the same path from the command line with a
 * deliberately junk token).
 *
 * Two on-disk formats share the .tdf extension:
 *
 *   PK\x03\x04   a ZIP — TDF3/ZTDF, what OpenTDF and the DSP platform write. Readable.
 *   <?xml        TDF1, what Virtru's commercial stack writes. The OpenTDF SDK cannot read it
 *                and fails with "unsupported format; prefix not recognized 60,63,120", which
 *                is a terrible thing to have appear on a projector. Detected here first so the
 *                app can say what the file actually is.
 */

import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import { PLATFORM_URL } from './tdf.js'

const LOCAL_KAS = `${PLATFORM_URL}/kas`

/** @returns {'ztdf'|'tdf1'|'text'|'binary'} */
export function sniffFormat(bytes) {
  const b = bytes.subarray(0, 4)
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return 'ztdf'

  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 1024))
  if (head.trimStart().startsWith('<?xml')) return 'tdf1'

  // A NUL in the first kilobyte is the classic "this is not text" test, and it is good enough:
  // the alternative is decoding megabytes of a PDF to find out.
  if (bytes.subarray(0, 1024).includes(0)) return 'binary'
  return 'text'
}

/**
 * Inspection needs no entitlement, so it does not borrow a persona's identity — and because its
 * token is a constant, one client serves every inspection. Worth caching rather than rebuilding:
 * `new OpenTDF()` generates two RSA-2048 keypairs, ~300ms of WebCrypto, for a client that here only
 * ever parses a local zip.
 */
let inspector = null
function inspectionClient() {
  return (inspector ??= new OpenTDF({
    interceptors: [authTokenInterceptor(() => 'inspection-needs-no-token')],
    platformUrl: PLATFORM_URL,
    disableDPoP: true,
  }))
}

/**
 * Parse a ZTDF's manifest.
 *
 * @returns {Promise<{ok: boolean, error?: string, kasUrls: string[], ours: boolean,
 *   attributes: string[], mimeType: string|null, specVersion: string|null, assertions: number}>}
 */
export async function inspectZtdf(bytes) {
  const client = inspectionClient()
  const reader = client.open({ source: { type: 'buffer', location: bytes } })
  try {
    const manifest = await reader.manifest()
    const kaos = manifest?.encryptionInformation?.keyAccess ?? []
    const kasUrls = [...new Set(kaos.map(k => k.url).filter(Boolean))]

    return {
      ok: true,
      kasUrls,
      // Every key access object has to point at our KAS. A split across ours and someone
      // else's is still not openable here, so "some of them" is not good enough.
      ours: kasUrls.length > 0 && kasUrls.every(u => u.replace(/\/+$/, '') === LOCAL_KAS),
      attributes: await reader.attributes(),
      mimeType: manifest?.payload?.mimeType ?? null,
      // Writers disagree on where this lives, and plenty of real files carry neither.
      specVersion: manifest?.tdf_spec_version ?? manifest?.schemaVersion ?? null,
      assertions: (manifest?.assertions ?? []).length,
    }
  } catch (err) {
    return {
      ok: false,
      error: (err?.message ?? String(err)).split('\n')[0].slice(0, 160),
      kasUrls: [], ours: false, attributes: [], mimeType: null, specVersion: null, assertions: 0,
    }
  } finally {
    // The reader is per-call and is ours to close. The client is not any more — it is shared, and
    // closing it here would be a bug the moment `OpenTDF.close()` stops being a no-op.
    await reader.close().catch(() => {})
  }
}

/** The namespaces a set of FQNs belongs to — a foreign file's is why its policy is unevaluable. */
export function namespacesOf(fqns) {
  return [...new Set(fqns.map(f => f.match(/^(.*?)\/attr\//)?.[1]).filter(Boolean))]
}
