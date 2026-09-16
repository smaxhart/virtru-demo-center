import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import { getUserToken } from './auth.js'

export const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL = `${PLATFORM_URL}/kas`

function makeClient(accessToken) {
  return new OpenTDF({
    interceptors: [authTokenInterceptor(() => accessToken)],
    platformUrl: PLATFORM_URL,
    disableDPoP: true,
  })
}

async function streamToBytes(stream) {
  const chunks = []
  const reader = stream.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.length }
  return out
}

/**
 * Encrypts text into a real TDF bound to `attributeFqns`.
 *
 * Encryption never requires entitlement — anyone can write a policy they themselves
 * could not satisfy — so this runs as `admin` regardless of who will read it.
 *
 * autoconfigure is off: the attribute FQNs are written into the manifest verbatim
 * rather than resolved through key grants, which keeps the policy in the manifest
 * readable and exactly what was asked for.
 */
export async function encryptText(plaintext, attributeFqns, asPersona = 'admin') {
  const { access_token } = await getUserToken(asPersona)
  const client = makeClient(access_token)
  const blob = new Blob([new TextEncoder().encode(plaintext)], { type: 'text/plain' })
  const cipherStream = await client.createTDF({
    source: { type: 'stream', location: blob.stream() },
    defaultKASEndpoint: KAS_URL,
    autoconfigure: false,
    attributes: attributeFqns.map(fqn => ({ attribute: fqn })),
  })
  const tdfBytes = await streamToBytes(cipherStream)
  const manifest = await cipherStream.manifest
  return { tdfBytes, manifest }
}

/**
 * Attempts to decrypt as `personaId`. This is a live KAS rewrap: the platform
 * re-evaluates the manifest policy against the persona's resolved attributes and
 * either returns the key or refuses. A rejection throws — that throw IS the
 * access-denied decision, not a simulation of one.
 */
export async function decryptToText(tdfBytes, personaId) {
  const { access_token } = await getUserToken(personaId)
  const client = makeClient(access_token)
  const blob = new Blob([tdfBytes])
  const decryptedStream = await client.read({
    source: { type: 'stream', location: blob.stream() },
    allowedKASEndpoints: [KAS_URL],
  })
  const bytes = await streamToBytes(decryptedStream)
  return new TextDecoder().decode(bytes)
}

/** The attribute FQNs bound into a TDF manifest's policy. */
export function manifestAttributes(manifest) {
  try {
    const policyB64 = manifest?.encryptionInformation?.policy
    if (!policyB64) return []
    const policy = JSON.parse(atob(policyB64))
    return (policy?.body?.dataAttributes ?? []).map(a => a.attribute).filter(Boolean)
  } catch {
    return []
  }
}

/** KAS rewrap failures are verbose and nested; reduce one to a single line. */
export function describeDenial(err) {
  const raw = (err?.message ?? String(err)).replace(/\s+/g, ' ').trim()
  if (/403|forbidden|permission|denied|unauthorized/i.test(raw)) {
    return 'KAS refused the rewrap — attributes did not satisfy the policy'
  }
  if (/fetch|network|ECONNREFUSED/i.test(raw)) {
    return 'Could not reach the KAS — is the platform still running?'
  }
  return raw.length > 160 ? raw.slice(0, 160) + '…' : raw
}
