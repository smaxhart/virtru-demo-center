/**
 * Auth — Electron version.
 * Delegates token issuance to the JWT issuer running in main process via IPC.
 * No Keycloak dependency.
 */

export async function getUserToken(personaId, _password) {
  if (window.electronAPI) {
    return window.electronAPI.getUserToken(personaId)
  }
  // Browser fallback (vite dev without Electron)
  const res = await fetch(`http://localhost:7779/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: personaId }),
  })
  if (!res.ok) throw new Error('Token request failed')
  return res.json()
}

export async function getPlatformToken() {
  if (window.electronAPI) {
    return window.electronAPI.getPlatformToken()
  }
  const res = await fetch(`http://localhost:7779/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: 'admin' }),
  })
  if (!res.ok) throw new Error('Platform token request failed')
  return res.json()
}

export async function getKeycloakAdminToken() {
  return getPlatformToken().then(t => t.access_token)
}
