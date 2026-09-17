import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import { getUserToken } from './auth.js'

const KAS_URL      = 'http://localhost:7777/kas'
const PLATFORM_URL = 'http://localhost:7777'

/**
 * One reused client per persona. **The keypairs are cached; the token is not.**
 *
 * `new OpenTDF()` generates two RSA-2048 keypairs — one for DPoP keys that `disableDPoP: true` then
 * never forwards, and a second inside the TDF3Client underneath because it was not forwarded. Each
 * pair costs ~150ms in Chromium's WebCrypto and concurrent generations contend, so building a client
 * per operation was the dominant cost on every page that encrypts or decrypts in bulk: the COP map
 * and Collaborate both fan out across many objects at once. Reuse also lets the client's KAS
 * public-key cache work, removing two HTTP round trips per encrypt.
 *
 * A fresh token is still minted on every operation, as before — it costs ~2ms over IPC, and holding
 * one would mean serving a persona's decisions from claims minted before the platform was reseeded.
 * Concurrent use of one client is safe; the only client state these calls mutate is that key cache.
 */
const clients = new Map()

async function clientFor(personaId) {
  const { access_token } = await getUserToken(personaId)

  let cell = clients.get(personaId)
  if (!cell) {
    // The interceptor reads the cell at request time rather than closing over one token, so the
    // client outlives any single token without being rebuilt.
    cell = { token: access_token }
    cell.client = new OpenTDF({
      interceptors: [authTokenInterceptor(() => cell.token)],
      platformUrl: PLATFORM_URL,
      disableDPoP: true,
    })
    clients.set(personaId, cell)
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

export async function encryptText(plaintext, attributeFqns, encryptAsPersona = 'sarah') {
  const client = await clientFor(encryptAsPersona)
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

export async function encryptBytes(fileBytes, mimeType, attributeFqns, encryptAsPersona = 'sarah') {
  const client = await clientFor(encryptAsPersona)
  const blob = new Blob([fileBytes], { type: mimeType })
  const cipherStream = await client.createTDF({
    source: { type: 'stream', location: blob.stream() },
    defaultKASEndpoint: KAS_URL,
    autoconfigure: false,
    attributes: attributeFqns.map(fqn => ({ attribute: fqn })),
    mimeType,
  })
  const tdfBytes = await streamToBytes(cipherStream)
  const manifest = await cipherStream.manifest
  return { tdfBytes, manifest }
}

export async function decryptTdf(tdfBytes, personaId) {
  const client = await clientFor(personaId)
  const blob = new Blob([tdfBytes])
  const decryptedStream = await client.read({
    source: { type: 'stream', location: blob.stream() },
    allowedKASEndpoints: [KAS_URL],
  })
  const bytes = await streamToBytes(decryptedStream)
  return new TextDecoder().decode(bytes)
}

export async function decryptTdfToBytes(tdfBytes, personaId) {
  const client = await clientFor(personaId)
  const blob = new Blob([tdfBytes])
  const decryptedStream = await client.read({
    source: { type: 'stream', location: blob.stream() },
    allowedKASEndpoints: [KAS_URL],
  })
  return streamToBytes(decryptedStream)
}
