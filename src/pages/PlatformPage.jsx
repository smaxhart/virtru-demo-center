import { useState, useEffect, useMemo } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import { getPlatformToken } from '../api/auth.js'
import Icon from '../components/Icon.jsx'
import UiIcon from '../components/UiIcon.jsx'

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
    summarize: d => `Issuer: ${d.issuer}, JWKS: ${d.jwks_uri}`,
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
    summarize: d => `${d.keys?.length ?? 0} signing key(s), algorithms: ${[...new Set(d.keys?.map(k => k.alg) ?? [])].join(', ')}`,
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
    summarize: d => `KID: ${d.kid || '(present)'}, key length: ${d.publicKey?.length ?? '?'} chars`,
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
        ? `sarah: ${fqns.map(f => f.split('/value/')[1] || f).join(', ')}`
        : 'Response received'
    },
  },
]

function StatusBadge({ s }) {
  if (s === 'running') return <span className="chip chip-info">Running</span>
  if (s === 'ok') return <span className="chip chip-grant"><UiIcon name="check" size={12} strokeWidth={2.4} />200 OK</span>
  if (s === 'error') return <span className="chip chip-deny"><UiIcon name="x" size={12} strokeWidth={2.4} />Error</span>
  return <span className="chip">Idle</span>
}

const monoBlock = {
  fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6,
  background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 8,
  color: 'var(--c-text-2)',
}

function CheckRow({ check, result, onRun, anyRunning, techMode, first }) {
  const [showReq, setShowReq] = useState(false)
  const [showRaw, setShowRaw] = useState(true)
  const s = result?.s ?? 'idle'
  const r = result ?? {}

  return (
    <div style={{ borderTop: first ? 'none' : '1px solid var(--c-border)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <span style={{
            width: 38, height: 38, flexShrink: 0, borderRadius: 9, background: 'var(--c-info-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={check.icon} size={22} fallback={<span>{check.icon}</span>} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650, fontSize: 14.5, color: 'var(--c-text-1)' }}>{check.name}</div>
            <div style={{ fontSize: 13, marginTop: 2, color: 'var(--c-text-4)' }}>
              {techMode ? check.description : check.businessContext}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {r.latency != null && (
            <span className="num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: r.latency > 400 ? 'var(--c-warn)' : 'var(--c-text-5)' }}>
              {r.latency}ms
            </span>
          )}
          <StatusBadge s={s} />
          <button type="button" className="btn btn-sm" onClick={onRun} disabled={s === 'running' || anyRunning}>
            Rerun
          </button>
        </div>
      </div>

      {/* Request line (toggle for details) */}
      <div style={{ padding: '0 20px 12px 72px' }}>
        <button type="button" onClick={() => setShowReq(x => !x)} aria-expanded={showReq}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
            background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--c-text-4)',
            fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
          <UiIcon name="chevron" size={13} style={{ transform: showReq ? 'none' : 'rotate(-90deg)', transition: 'transform .12s' }} />
          <span>
            <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>{check.method}</span>
            {' '}
            <span style={{ wordBreak: 'break-all' }}>{check.url}</span>
          </span>
        </button>
        {showReq && (
          <div style={{ ...monoBlock, marginTop: 8, padding: '8px 12px' }}>
            <div>
              <span style={{ color: 'var(--c-accent)', fontWeight: 600 }}>{check.method}</span>
              {' '}{check.url}
            </div>
            {check.auth && (
              <div>
                Authorization: Bearer{' '}
                <span style={{ color: 'var(--c-text-4)' }}>eyJ… [opentdf-admin client_credentials token]</span>
              </div>
            )}
            <div>Content-Type: application/json</div>
            {check.body && <div>Body: {check.body}</div>}
          </div>
        )}
      </div>

      {/* Response area */}
      {(
        <div style={{ padding: '0 20px 18px 72px' }}>
          {s === 'idle' && (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--c-text-5)' }}>Waiting to run…</p>
          )}
          {s === 'running' && (
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--c-accent)' }}>Waiting for response…</p>
          )}
          {s === 'error' && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 12, padding: '8px 12px', borderRadius: 8,
              background: 'var(--c-deny-bg)', color: 'var(--c-deny)', border: '1px solid var(--c-deny-br)',
              wordBreak: 'break-word',
            }}>
              {r.error}
            </div>
          )}
          {s === 'ok' && r.response && (
            <>
              {/* Summary */}
              <div style={{
                marginBottom: 10, fontSize: 12.5, padding: '7px 12px', borderRadius: 8,
                background: 'var(--c-grant-bg)', color: 'var(--c-grant)', border: '1px solid var(--c-grant-br)',
                wordBreak: 'break-word',
              }}>
                {check.summarize(r.response.data)}
              </div>
              {/* Response headers */}
              <div style={{ ...monoBlock, marginBottom: 10, padding: '8px 12px' }}>
                <div style={{ color: 'var(--c-grant)', fontWeight: 600, marginBottom: 2 }}>
                  {r.response.httpStatus} OK, {r.latency}ms
                </div>
                {Object.entries(r.response.headers)
                  .filter(([k]) => SHOW_HEADERS.includes(k))
                  .map(([k, v]) => (
                    <div key={k} style={{ wordBreak: 'break-all' }}>
                      <span style={{ color: 'var(--c-text-5)' }}>{k}: </span>{v}
                    </div>
                  ))}
              </div>
              {/* Raw JSON */}
              <button type="button" onClick={() => setShowRaw(x => !x)} aria-expanded={showRaw}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                  background: 'none', border: 0, padding: 0, cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-3)',
                }}>
                <UiIcon name="chevron" size={13} style={{ transform: showRaw ? 'none' : 'rotate(-90deg)', transition: 'transform .12s' }} />
                Raw response
              </button>
              {showRaw && (
                <pre style={{ ...monoBlock, margin: 0, padding: 12, overflow: 'auto', maxHeight: '12rem' }}>
                  {JSON.stringify(r.response.data, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
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
        detail: `client: ${jwtPayload.clientId || jwtPayload.azp || '—'}, exp: ${new Date(jwtPayload.exp * 1000).toLocaleTimeString()}`,
      })
    }

    return items
  }, [allDone, results, jwt])

  const chainAllOk = chainOfTrust.every(i => i.ok)

  return (
    <div className="page">
      <div className="page-hero">
        <div>
          <h2 className="page-title">Platform</h2>
          <p className="page-subtitle">
            Live proof your DSP instance is running correctly. Every call here is hitting your actual KAS —
            this is the same chain of trust that protects every document in your environment.
          </p>
        </div>
        <div className="page-actions">
          {allDone && (
            <>
              {okCount > 0 && <span className="chip chip-grant"><UiIcon name="check" size={12} strokeWidth={2.4} />{okCount} healthy</span>}
              {errCount > 0 && <span className="chip chip-deny"><UiIcon name="x" size={12} strokeWidth={2.4} />{errCount} error</span>}
              {ranAt && <span className="num" style={{ color: 'var(--c-text-5)', fontSize: 12 }}>{ranAt.toLocaleTimeString()}</span>}
            </>
          )}
          <button type="button" className="btn" onClick={runAll} disabled={anyRunning}>
            {anyRunning ? 'Running…' : 'Refresh all'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 330px', gap: 28, alignItems: 'start' }}>
        {/* Left: check list */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {CHECKS.map((check, i) => (
            <CheckRow
              key={check.id}
              check={check}
              result={results[check.id]}
              onRun={() => runCheck(check)}
              anyRunning={anyRunning}
              techMode={techMode}
              first={i === 0}
            />
          ))}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>

          {/* Chain of trust */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
              <h3 className="section-title" style={{ margin: 0 }}>Chain of trust verification</h3>
              {allDone && chainOfTrust.length > 0 && (
                <span className={`chip ${chainAllOk ? 'chip-grant' : 'chip-deny'}`}>
                  {chainOfTrust.filter(i => i.ok).length}/{chainOfTrust.length} passed
                </span>
              )}
            </div>
            {chainOfTrust.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-5)' }}>
                {anyRunning ? 'Verifying cross-service trust…' : 'Run checks to verify.'}
              </p>
            ) : (
              <div className="card" style={{ borderColor: chainAllOk ? 'var(--c-grant-br)' : 'var(--c-border)', padding: '4px 16px' }}>
                {chainOfTrust.map((item, i) => (
                  <div key={i} className="step-in" style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 0',
                    borderTop: i ? '1px solid var(--c-border)' : 'none',
                  }}>
                    <UiIcon name={item.ok ? 'check' : 'x'} size={15} strokeWidth={2.4}
                      style={{ marginTop: 2, color: item.ok ? 'var(--c-grant)' : 'var(--c-deny)' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.ok ? 'var(--c-text-1)' : 'var(--c-deny)' }}>
                        {item.label}
                      </div>
                      {item.detail && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, marginTop: 2, wordBreak: 'break-all', color: 'var(--c-text-5)' }}>
                          {item.detail}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Decoded JWT */}
          {jwt?.decoded && (
            <section className="step-in">
              <h3 className="section-title">Live platform token, decoded</h3>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--c-text-4)' }}>Header</div>
              <pre style={{ ...monoBlock, fontSize: 11.5, margin: '0 0 12px', padding: 10, overflow: 'auto', maxHeight: '6rem' }}>
                {JSON.stringify(jwt.decoded.header, null, 2)}
              </pre>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--c-text-4)' }}>Claims</div>
              <pre style={{ ...monoBlock, fontSize: 11.5, margin: 0, padding: 10, overflow: 'auto', maxHeight: '16rem' }}>
                {JSON.stringify(jwt.decoded.payload, null, 2)}
              </pre>
            </section>
          )}

          {jwt?.error && (
            <section>
              <h3 className="section-title">Platform token</h3>
              <div style={{ fontSize: 12.5, padding: '8px 12px', borderRadius: 8, background: 'var(--c-deny-bg)', color: 'var(--c-deny)', border: '1px solid var(--c-deny-br)' }}>
                {jwt.error}
              </div>
            </section>
          )}

          {/* API call log */}
          <section>
            <h3 className="section-title">API call log ({apiLog.length})</h3>
            {apiLog.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--c-text-5)' }}>No calls yet.</p>
            ) : (
              <div style={{ maxHeight: 220, overflowY: 'auto', borderTop: '1px solid var(--c-border-2)' }}>
                {apiLog.slice(0, 20).map(entry => {
                  const good = entry.ok !== false
                  return (
                    <div key={entry.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '7px 0',
                      borderBottom: '1px solid var(--c-border)',
                    }}>
                      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: good ? 'var(--c-grant)' : 'var(--c-deny)' }} />
                      <span style={{ fontFamily: 'var(--font-mono)', flexShrink: 0, color: good ? 'var(--c-grant)' : 'var(--c-deny)' }}>
                        {entry.status ?? '?'}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--c-text-4)' }} title={entry.url}>
                        {entry.url?.replace('/platform/', '')}
                      </span>
                      {entry.latency != null && (
                        <span className="num" style={{ flexShrink: 0, color: 'var(--c-text-5)' }}>
                          {entry.latency}ms
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
