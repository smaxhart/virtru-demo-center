import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import { getUserToken } from './auth.js'

export const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL = `${PLATFORM_URL}/kas`

/**
 * One reused client per identity. **The keypairs are cached; the token is not.**
 *
 * `new OpenTDF()` is expensive in a way that is not obvious: it generates two RSA-2048 keypairs.
 * One in the SDK's own constructor for DPoP keys that `disableDPoP: true` then declines to forward,
 * and a second inside the TDF3Client underneath precisely because it was not forwarded. Chromium's
 * WebCrypto takes ~150ms per pair and concurrent generations contend for the same thread, so a
 * client per operation dominated everything else here: switching persona fires 14 rewraps, and the
 * 28 avoidable keygens behind them burned ~4s of local crypto before the first request left the
 * renderer. Reuse also lets the client's KAS public-key cache do its job, removing two HTTP round
 * trips per encrypt.
 *
 * A fresh token is minted on **every** operation, exactly as before this was cached. That matters
 * for correctness, not just freshness: the Scenario Builder can re-register an identity under the
 * same id with different grants, and a token cached across that edit would quietly hand the KAS
 * stale entitlements — a wrong access decision in the one demo whose entire point is the right one.
 * Minting costs ~2ms over IPC, so there is nothing to win by holding on to it.
 *
 * Sharing a client across concurrent operations is safe: `createTDF` and `read` keep their state
 * local, and the only thing they mutate on the client is that KAS key cache, which is an
 * append-and-lookup keyed by url, algorithm and kid.
 */
const clients = new Map()

async function clientFor(identityId) {
  const { access_token } = await getUserToken(identityId)

  let cell = clients.get(identityId)
  if (!cell) {
    // The interceptor reads the cell at request time rather than closing over one token, so the
    // client outlives any single token without being rebuilt.
    cell = { token: access_token }
    cell.client = new OpenTDF({
      interceptors: [authTokenInterceptor(() => cell.token)],
      platformUrl: PLATFORM_URL,
      disableDPoP: true,
    })
    clients.set(identityId, cell)
  } else {
    cell.token = access_token
  }
  return cell.client
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
  const client = await clientFor(asPersona)
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
  const client = await clientFor(personaId)
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
