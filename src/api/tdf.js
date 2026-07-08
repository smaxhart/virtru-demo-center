import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import { getUserToken } from './auth.js'

const KAS_URL      = 'http://localhost:7777/kas'
const PLATFORM_URL = 'http://localhost:7777'

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

export async function encryptText(plaintext, attributeFqns, encryptAsPersona = 'sarah') {
  const { access_token } = await getUserToken(encryptAsPersona)
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

export async function encryptBytes(fileBytes, mimeType, attributeFqns, encryptAsPersona = 'sarah') {
  const { access_token } = await getUserToken(encryptAsPersona)
  const client = makeClient(access_token)
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

export async function decryptTdfToBytes(tdfBytes, personaId) {
  const { access_token } = await getUserToken(personaId)
  const client = makeClient(access_token)
  const blob = new Blob([tdfBytes])
  const decryptedStream = await client.read({
    source: { type: 'stream', location: blob.stream() },
    allowedKASEndpoints: [KAS_URL],
  })
  return streamToBytes(decryptedStream)
}
