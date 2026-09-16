/**
 * Token issuance. Delegates to the in-process JWT issuer in the Electron main
 * process over IPC — there is no Keycloak in this app.
 */

const ISSUER_URL = 'http://localhost:7879'

async function issueViaHttp(personaId) {
  const res = await fetch(`${ISSUER_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: personaId }),
  })
  if (!res.ok) throw new Error(`Token request failed for "${personaId}": ${res.status}`)
  return res.json()
}

export async function getUserToken(personaId) {
  if (window.electronAPI) return window.electronAPI.getUserToken(personaId)
  // Browser fallback for `npm run dev:web` — the issuer still has to be running
  return issueViaHttp(personaId)
}

export async function getPlatformToken() {
  if (window.electronAPI) return window.electronAPI.getPlatformToken()
  return issueViaHttp('admin')
}

/**
 * The attribute FQNs the KAS resolves this persona to. Read from the issuer rather
 * than restated in the UI, so what's displayed is what's actually evaluated.
 */
export async function getEntityAttributes(personaId) {
  if (window.electronAPI) return window.electronAPI.getEntityAttributes(personaId)
  const { access_token } = await issueViaHttp(personaId)
  const payload = JSON.parse(atob(access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  return (payload.tdf_claims?.entitlements?.[0]?.entity_attributes ?? []).map(a => a.attribute)
}
