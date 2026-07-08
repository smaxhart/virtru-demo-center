import { getPlatformToken } from './auth.js'

const PLATFORM_BASE = 'http://localhost:7777'

let apiLogger = null
export function setApiLogger(fn) { apiLogger = fn }

function log(entry) { if (apiLogger) apiLogger(entry) }

async function rpc(service, method, body = {}) {
  const { access_token } = await getPlatformToken()
  const url = `${PLATFORM_BASE}/${service}/${method}`
  const start = Date.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${access_token}`,
    },
    body: JSON.stringify(body),
  })
  const latency = Date.now() - start
  const ok = res.ok
  log({ id: crypto.randomUUID(), method: 'POST', url: `/${service}/${method}`, status: res.status, latency, ok })
  if (!ok) {
    const text = await res.text()
    throw new Error(`${method} ${res.status}: ${text}`)
  }
  return res.json()
}

export async function listAttributes() {
  const data = await rpc('policy.attributes.AttributesService', 'ListAttributes', {})
  return data.attributes ?? []
}

export async function listNamespaces() {
  const data = await rpc('policy.namespaces.NamespaceService', 'ListNamespaces', {})
  return data.namespaces ?? []
}

export async function listSubjectMappings() {
  const data = await rpc('policy.subjectmapping.SubjectMappingService', 'ListSubjectMappings', {})
  return data.subjectMappings ?? []
}

export async function listSubjectConditionSets() {
  const data = await rpc('policy.subjectmapping.SubjectMappingService', 'ListSubjectConditionSets', {})
  return data.subjectConditionSets ?? []
}

export async function getEntitlements(username, fqns) {
  const data = await rpc('authorization.AuthorizationService', 'GetEntitlements', {
    entities: [{ id: username, idp_entity_id: username, entity_type: 'USER' }],
    resource_attributes: fqns.map(fqn => ({ attribute_fqns: [fqn] })),
  })
  return data.entitlements ?? []
}

export async function getKasPublicKey() {
  const url = `${PLATFORM_BASE}/kas/v2/kas_public_key`
  const start = Date.now()
  const res = await fetch(url)
  log({ id: crypto.randomUUID(), method: 'GET', url: '/kas/v2/kas_public_key', status: res.status, latency: Date.now() - start, ok: res.ok })
  if (!res.ok) throw new Error('KAS public key unavailable')
  return res.json()
}
