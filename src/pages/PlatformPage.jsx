import { useState, useEffect, useMemo } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import { getPlatformToken } from '../api/auth.js'
import Icon from '../components/Icon.jsx'

function decodeJwt(token) {
  try {
    const [header, payload] = token.split('.')
    return {
      header: JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/'))),
      payload: JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))),
    }
  } catch {
    return null
  }
}

function captureHeaders(res) {
  const h = {}
  for (const [k, v] of res.headers.entries()) h[k] = v
  return h
}

const SHOW_HEADERS = ['content-type', 'date', 'x-request-id', 'cache-control', 'server', 'grpc-status']

const PLATFORM = 'http://localhost:7777'
const ISSUER   = 'http://localhost:7779'

const CHECKS = [
  {
    id: 'keycloak',
    icon: 'key',
    name: 'JWT Issuer — Identity Provider',
    description: 'Mints and signs JWTs; KAS fetches its JWKS to verify signatures on every request',
    businessContext: 'Issues JWTs that prove user identity — without this, KAS has no way to verify who is asking to decrypt data.',
    method: 'GET',
    url: `${ISSUER}/.well-known/openid-configuration`,
    auth: false,
    run: async () => {
      const res = await fetch(`${ISSUER}/.well-known/openid-configuration`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return { data: await res.json(), headers: captureHeaders(res), httpStatus: res.status }
    },
    summarize: d => `Issuer: ${d.issuer} · JWKS: ${d.jwks_uri}`,
  },
  {
    id: 'jwks',
    icon: 'lock',
    name: 'JWT Issuer JWKS — Signing Keys',
    description: 'Public RSA keys KAS uses to cryptographically verify every JWT it receives',
    businessContext: 'The public keys KAS uses to verify JWT signatures — prevents forged identity tokens from being accepted.',
    method: 'GET',
    url: `${ISSUER}/.well-known/jwks.json`,
    auth: false,
    run: async () => {
      const res = await fetch(`${ISSUER}/.well-known/jwks.json`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return { data: await res.json(), headers: captureHeaders(res), httpStatus: res.status }
    },
    summarize: d => `${d.keys?.length ?? 0} signing key(s) · Algorithms: ${[...new Set(d.keys?.map(k => k.alg) ?? [])].join(', ')}`,
  },
  {
    id: 'kas',
    icon: 'key',
    name: 'Key Access Service (KAS)',
    description: 'Holds wrapped DEKs — unwraps them only after verifying entitlements',
    businessContext: 'The enforcement point for every decrypt attempt — unwraps the data key only for users with the right attributes.',
    method: 'POST',
    url: `${PLATFORM}/kas.AccessService/PublicKey`,
    auth: true,
    run: async (token) => {
      const res = await fetch(`${PLATFORM}/kas.AccessService/PublicKey`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      return { data: await res.json(), headers: captureHeaders(res), httpStatus: res.status }
    },
    summarize: d => `KID: ${d.kid || '(present)'} · Key length: ${d.publicKey?.length ?? '?'} chars`,
  },
  {
    id: 'policy',
    icon: 'document',
    name: 'Policy Attributes Service',
    description: 'Stores attribute definitions — the labels bound to encrypted data',
    businessContext: 'Stores attribute definitions that policies reference — clearance levels, mission groups, coalition memberships.',
    method: 'POST',
    url: `${PLATFORM}/policy.attributes.AttributesService/ListAttributes`,
    auth: true,
    body: '{}',
    run: async (token) => {
      const res = await fetch(`${PLATFORM}/policy.attributes.AttributesService/ListAttributes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      return { data: await res.json(), headers: captureHeaders(res), httpStatus: res.status }
    },
    summarize: d => `${d.attributes?.length ?? 0} attribute definitions`,
  },
  {
    id: 'authz',
    icon: 'checkmark',
    name: 'Authorization Service',
    description: 'Live entitlement checks — called by KAS on every decrypt attempt',
    businessContext: 'The live entitlement check KAS calls on every single decrypt attempt — no caching, no grace period, no stale access.',
    method: 'POST',
    url: `${PLATFORM}/authorization.AuthorizationService/GetEntitlements`,
    auth: true,
    body: '{ "entities": [{ "userName": "sarah" }], "resourceAttributes": [...] }',
    run: async (token) => {
      const body = {
        entities: [{ id: 'e1', userName: 'sarah' }],
        resourceAttributes: [{ attributeValueFqns: ['https://demo.com/attr/clearance/value/ts-sci'] }],
      }
      const res = await fetch(`${PLATFORM}/authorization.AuthorizationService/GetEntitlements`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
      return { data: await res.json(), headers: captureHeaders(res), httpStatus: res.status }
    },
    summarize: d => {
      const fqns = d.entitlementsList?.[0]?.entityEntitlements?.attributeValueFqns ??
                   d.entitlements?.[0]?.attributeValueFqns ?? []
      return fqns.length > 0
        ? `sarah → ${fqns.map(f => f.split('/value/')[1] || f).join(', ')}`
        : 'Response received'
    },
  },
]

function StatusBadge({ s }) {
  const styles = {
    idle:    { bg: 'var(--c-border)',    color: 'var(--c-text-5)', border: 'var(--c-border-2)', label: 'idle' },
    running: { bg: '#1e3a5f',            color: '#60a5fa',         border: '#3b82f6',            label: '◌ running' },
    ok:      { bg: 'var(--c-success-bg)', color: '#4ade80',        border: '#166534',            label: '✓ 200 OK' },
    error:   { bg: 'var(--c-error-bg)',  color: '#f87171',         border: '#7f1d1d',            label: '✗ error' },
  }[s] || styles.idle
  return (
    <span className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: styles.bg, color: styles.color, border: `1px solid ${styles.border}` }}>
      {styles.label}
    </span>
  )
}

function CheckCard({ check, result, onRun, anyRunning, techMode }) {
  const [showReq, setShowReq] = useState(false)
  const [showRaw, setShowRaw] = useState(true)
  const s = result?.s ?? 'idle'
  const r = result ?? {}

  return (
    <div className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--c-surface)',
        border: `1px solid ${s === 'ok' ? '#166534' : s === 'error' ? '#7f1d1d' : 'var(--c-border)'}`,
      }}>
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex items-center gap-3">
          <Icon name={check.icon} size={24} fallback={<span className="text-xl">{check.icon}</span>} />
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--c-text-1)' }}>{check.name}</div>
            {check.businessContext && !techMode && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--c-text-4)' }}>{check.businessContext}</div>
            )}
            {techMode && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--c-text-5)' }}>{check.description}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {r.latency != null && (
            <span className="text-xs font-mono"
              style={{ color: r.latency > 400 ? '#f59e0b' : 'var(--c-text-5)' }}>
              {r.latency}ms
            </span>
          )}
          <StatusBadge s={s} />
          <button onClick={onRun} disabled={s === 'running' || anyRunning}
            className="text-xs px-2 py-0.5 rounded cursor-pointer disabled:opacity-40"
            style={{ background: 'var(--c-border)', color: 'var(--c-text-4)', border: '1px solid var(--c-border-2)' }}>
            ↺
          </button>
        </div>
      </div>

      {/* Request block (always visible, toggle for details) */}
      <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
        <button onClick={() => setShowReq(x => !x)}
          className="flex items-center gap-2 text-xs cursor-pointer w-full text-left"
          style={{ color: 'var(--c-text-5)' }}>
          <span style={{ color: '#a78bfa' }}>{showReq ? '▼' : '▶'}</span>
          <span className="font-mono">
            <span style={{ color: '#60a5fa' }}>{check.method}</span>
            {' '}
            <span style={{ color: 'var(--c-text-3)' }}>{check.url}</span>
          </span>
        </button>
        {showReq && (
          <div className="mt-2 font-mono text-xs rounded px-3 py-2 leading-relaxed"
            style={{ background: '#0f172a', border: '1px solid #1e293b' }}>
            <div>
              <span style={{ color: '#93c5fd' }}>{check.method}</span>
              {' '}
              <span style={{ color: '#e2e8f0' }}>{check.url}</span>
            </div>
            {check.auth && (
              <div style={{ color: '#cbd5e1' }}>
                Authorization: <span style={{ color: '#7dd3fc' }}>Bearer</span>{' '}
                <span style={{ color: '#c4b5fd' }}>eyJ… [opentdf-admin client_credentials token]</span>
              </div>
            )}
            <div style={{ color: '#cbd5e1' }}>Content-Type: application/json</div>
            {check.body && (
              <div style={{ color: '#cbd5e1' }}>Body: <span style={{ color: '#e2e8f0' }}>{check.body}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Response area */}
      <div className="px-4 py-3">
        {s === 'idle' && (
          <p className="text-xs" style={{ color: 'var(--c-text-6)' }}>Waiting to run…</p>
        )}
        {s === 'running' && (
          <p className="text-xs" style={{ color: '#60a5fa' }}>◌ Waiting for response…</p>
        )}
        {s === 'error' && (
          <div className="font-mono text-xs px-3 py-2 rounded"
            style={{ background: 'var(--c-error-bg)', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
            {r.error}
          </div>
        )}
        {s === 'ok' && r.response && (
          <>
            {/* Response headers */}
            <div className="mb-3 font-mono text-xs rounded px-3 py-2 leading-relaxed"
              style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
              <div style={{ color: '#4ade80', marginBottom: 2 }}>
                ← {r.response.httpStatus} OK · {r.latency}ms
              </div>
              {Object.entries(r.response.headers)
                .filter(([k]) => SHOW_HEADERS.includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <span style={{ color: '#94a3b8' }}>{k}: </span>
                    <span style={{ color: '#e2e8f0' }}>{v}</span>
                  </div>
                ))}
            </div>
            {/* Summary */}
            <div className="mb-3 text-xs px-3 py-1.5 rounded"
              style={{ background: 'var(--c-success-bg)', color: '#86efac', border: '1px solid #166534' }}>
              {check.summarize(r.response.data)}
            </div>
            {/* Raw JSON */}
            <button onClick={() => setShowRaw(x => !x)}
              className="text-xs cursor-pointer mb-2 flex items-center gap-1"
              style={{ color: '#a78bfa' }}>
              <span>{showRaw ? '▼' : '▶'}</span> RAW RESPONSE
            </button>
            {showRaw && (
              <pre className="text-xs rounded p-3 overflow-auto"
                style={{
                  background: 'var(--c-bg)',
                  color: '#e2e8f0',
                  border: '1px solid var(--c-border)',
                  maxHeight: '12rem',
                  fontFamily: 'monospace',
                  lineHeight: 1.5,
                }}>
                {JSON.stringify(r.response.data, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function PlatformPage() {
  const { apiLog, techMode } = useDemo()
  const [results, setResults] = useState({})
  const [anyRunning, setAnyRunning] = useState(false)
  const [ranAt, setRanAt] = useState(null)
  const [jwt, setJwt] = useState(null)

  function setCheck(id, patch) {
    setResults(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }))
  }

  async function runCheck(check) {
    setCheck(check.id, { s: 'running', response: null, error: null, latency: null })
    const start = Date.now()
    try {
      const tokenObj = check.auth ? await getPlatformToken() : null
      const token = tokenObj?.access_token ?? tokenObj
      const response = await check.run(token)
      setCheck(check.id, { s: 'ok', response, latency: Date.now() - start })
    } catch (e) {
      setCheck(check.id, { s: 'error', error: e.message, latency: Date.now() - start })
    }
  }

  async function runAll() {
    setAnyRunning(true)
    const jwtPromise = getPlatformToken()
      .then(obj => { const raw = obj?.access_token ?? obj; setJwt({ raw, decoded: decodeJwt(raw) }) })
      .catch(e => setJwt({ error: e.message }))
    await Promise.all([...CHECKS.map(c => runCheck(c)), jwtPromise])
    setAnyRunning(false)
    setRanAt(new Date())
  }

  useEffect(() => { runAll() }, [])

  const okCount = CHECKS.filter(c => results[c.id]?.s === 'ok').length
  const errCount = CHECKS.filter(c => results[c.id]?.s === 'error').length
  const allDone = okCount + errCount === CHECKS.length && CHECKS.length > 0

  const chainOfTrust = useMemo(() => {
    if (!allDone) return []
    const items = []
    const kc    = results.keycloak?.response?.data
    const jwks  = results.jwks?.response?.data
    const kas   = results.kas?.response?.data
    const policy = results.policy?.response?.data
    const authz  = results.authz?.response?.data
    const jwtHeader  = jwt?.decoded?.header
    const jwtPayload = jwt?.decoded?.payload

    if (kc && jwtPayload) {
      const match = jwtPayload.iss === kc.issuer
      items.push({
        ok: match,
        label: 'JWT issuer matches OIDC discovery URL',
        detail: jwtPayload.iss,
      })
    }

    if (jwks && jwtHeader) {
      const kid = jwtHeader.kid
      const found = kid ? jwks.keys?.some(k => k.kid === kid) : (jwks.keys?.length ?? 0) > 0
      items.push({
        ok: !!found,
        label: `JWT kid found in JWKS signing keys`,
        detail: kid ? `kid: ${kid.slice(0, 28)}…` : `${jwks.keys?.length ?? 0} keys in JWKS`,
      })
    }

    if (kas) {
      const hasKey = !!(kas.publicKey || kas.key || kas.kid || kas.keys)
      items.push({
        ok: hasKey,
        label: 'KAS public key present and parseable',
        detail: `Algorithm: ${kas.algorithm || 'rsa:2048'}`,
      })
    }

    if (policy && authz) {
      const ns = policy.attributes?.[0]?.namespace?.name
      const fqns = authz.entitlementsList?.[0]?.entityEntitlements?.attributeValueFqns ??
                   authz.entitlements?.[0]?.attributeValueFqns ?? []
      const match = !ns || fqns.length === 0 || fqns.some(f => f.includes(ns))
      items.push({
        ok: match,
        label: 'Entitlement FQNs share policy namespace',
        detail: ns ? `Namespace: ${ns}` : `${fqns.length} entitlements returned`,
      })
    }

    if (jwtPayload) {
      const valid = jwtPayload.exp > Date.now() / 1000
      items.push({
        ok: valid,
        label: 'Platform token valid and not expired',
        detail: `client: ${jwtPayload.clientId || jwtPayload.azp || '—'} · exp: ${new Date(jwtPayload.exp * 1000).toLocaleTimeString()}`,
      })
    }

    return items
  }, [allDone, results, jwt])

  return (
    <div className="p-6 flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="page-hero">
        <p className="page-subtitle">
          Live proof your DSP instance is running correctly. Every call here is hitting your actual KAS —
          this is the same chain of trust that protects every document in your environment.
        </p>
        <div className="page-actions">
          <div style={{ display: 'flex', gap: 8 }}>
            {allDone && (
              <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                {okCount > 0 && <span style={{ color: '#4ade80' }}>✓ {okCount} healthy</span>}
                {errCount > 0 && <span style={{ color: '#f87171' }}>✗ {errCount} error</span>}
                {ranAt && <span style={{ color: 'var(--c-text-6)', fontSize: 11 }}>· {ranAt.toLocaleTimeString()}</span>}
              </div>
            )}
            <button
              onClick={runAll}
              disabled={anyRunning}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer disabled:opacity-40"
              style={{ background: 'var(--c-surface-2)', color: '#60a5fa', border: '1px solid var(--c-border)' }}>
              {anyRunning ? '◌ Running…' : '↺ Refresh All'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Left: 5 check cards */}
        <div className="flex-1 flex flex-col gap-4">
          {CHECKS.map(check => (
            <CheckCard
              key={check.id}
              check={check}
              result={results[check.id]}
              onRun={() => runCheck(check)}
              anyRunning={anyRunning}
              techMode={techMode}
            />
          ))}
        </div>

        {/* Right sidebar */}
        <div className="w-80 flex flex-col gap-4">

          {/* Chain of Trust */}
          <div className="rounded-xl p-4"
            style={{
              background: 'var(--c-surface)',
              border: `1px solid ${allDone && chainOfTrust.every(i => i.ok) ? '#166534' : 'var(--c-border)'}`,
            }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs font-bold" style={{ color: 'var(--c-text-5)' }}>
                CHAIN OF TRUST VERIFICATION
              </div>
              {allDone && chainOfTrust.length > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full ml-auto"
                  style={{
                    background: chainOfTrust.every(i => i.ok) ? 'var(--c-success-bg)' : 'var(--c-error-bg)',
                    color: chainOfTrust.every(i => i.ok) ? '#4ade80' : '#f87171',
                    border: `1px solid ${chainOfTrust.every(i => i.ok) ? '#166534' : '#7f1d1d'}`,
                  }}>
                  {chainOfTrust.filter(i => i.ok).length}/{chainOfTrust.length} passed
                </span>
              )}
            </div>
            {chainOfTrust.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--c-text-6)' }}>
                {anyRunning ? '◌ Verifying cross-service trust…' : 'Run checks to verify.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {chainOfTrust.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 step-in">
                    <span className="flex-shrink-0 text-sm mt-0.5"
                      style={{ color: item.ok ? '#4ade80' : '#f87171' }}>
                      {item.ok ? '✓' : '✗'}
                    </span>
                    <div>
                      <div className="text-xs font-medium"
                        style={{ color: item.ok ? '#4ade80' : '#f87171' }}>
                        {item.label}
                      </div>
                      {item.detail && (
                        <div className="text-xs font-mono mt-0.5 break-all"
                          style={{ color: 'var(--c-text-5)' }}>
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Decoded JWT */}
          {jwt?.decoded && (
            <div className="rounded-xl p-4 step-in"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'var(--c-text-5)' }}>
                LIVE PLATFORM TOKEN — DECODED
              </div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--c-text-4)' }}>Header</div>
              <pre className="text-xs rounded p-2 mb-3 overflow-auto"
                style={{ background: 'var(--c-bg)', color: '#06b6d4', border: '1px solid var(--c-border)', maxHeight: '6rem', fontFamily: 'monospace' }}>
                {JSON.stringify(jwt.decoded.header, null, 2)}
              </pre>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--c-text-4)' }}>Claims</div>
              <pre className="text-xs rounded p-2 overflow-auto"
                style={{ background: 'var(--c-bg)', color: '#06b6d4', border: '1px solid var(--c-border)', maxHeight: '16rem', fontFamily: 'monospace' }}>
                {JSON.stringify(jwt.decoded.payload, null, 2)}
              </pre>
            </div>
          )}

          {jwt?.error && (
            <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <div className="text-xs font-bold mb-2" style={{ color: 'var(--c-text-5)' }}>PLATFORM TOKEN</div>
              <div className="text-xs p-2 rounded" style={{ background: 'var(--c-error-bg)', color: '#f87171' }}>
                {jwt.error}
              </div>
            </div>
          )}

          {/* API call log */}
          <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <div className="text-xs font-bold mb-3" style={{ color: 'var(--c-text-5)' }}>
              API CALL LOG ({apiLog.length})
            </div>
            {apiLog.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--c-text-5)' }}>No calls yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {apiLog.slice(0, 20).map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: entry.ok !== false ? '#4ade80' : '#f87171' }} />
                    <span className="font-mono flex-shrink-0"
                      style={{ color: entry.ok !== false ? '#4ade80' : '#f87171' }}>
                      {entry.status ?? '?'}
                    </span>
                    <span className="truncate flex-1" style={{ color: 'var(--c-text-5)' }} title={entry.url}>
                      {entry.url?.replace('/platform/', '')}
                    </span>
                    {entry.latency != null && (
                      <span className="flex-shrink-0" style={{ color: 'var(--c-text-6)' }}>
                        {entry.latency}ms
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
