import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext.jsx'
import { getEntitlements } from '../api/platform.js'
import { COMMERCIAL_FLAT_ATTRS, FEDERAL_FLAT_ATTRS } from '../data/sectors.js'
import Icon from '../components/Icon.jsx'
import ClassificationBanner from '../components/ClassificationBanner.jsx'

// Match clearance value → classification label
const CLEARANCE_TO_CLASSIFICATION = {
  'ts-sci':       'TOP SECRET',
  'top-secret':   'TOP SECRET',
  'secret':       'SECRET',
  'confidential': 'CONFIDENTIAL',
  'unclassified': 'UNCLASSIFIED',
  'cui':          'UNCLASSIFIED',
}

// Groups: clearance has hierarchy note, relto has ANY_OF note, needtoknow has ALL_OF note
const ATTR_GROUP_META = {
  clearance:    { color: '#ef4444', note: 'HIERARCHY — higher clearance satisfies lower requirements', priority: 1 },
  classification: { color: '#f87171', note: 'HIERARCHY — classification level of the data', priority: 2 },
  mission:      { color: '#f59e0b', note: 'ANY_OF — user needs at least one matching mission attribute', priority: 3 },
  relto:        { color: '#3b82f6', note: 'ANY_OF — any coalition membership satisfies', priority: 4 },
  needtoknow:   { color: '#8b5cf6', note: 'ALL_OF — user must hold every listed compartment', priority: 5 },
  caveats:      { color: '#06b6d4', note: null, priority: 6 },
  nationality:  { color: '#10b981', note: null, priority: 7 },
  role:         { color: '#60a5fa', note: null, priority: 8 },
  department:   { color: '#a78bfa', note: null, priority: 9 },
  project:      { color: '#f472b6', note: null, priority: 10 },
}

// Which groups are hidden behind "show more"
const SECONDARY_GROUPS = new Set(['caveats', 'nationality', 'role', 'department', 'project'])

export default function PolicyPage() {
  const { activePersona, personas, attributes, techMode, sector } = useDemo()
  const navigate = useNavigate()
  const [testPersona, setTestPersona] = useState(null)
  const [policyAttrs, setPolicyAttrs] = useState([])
  const [flatAttrs, setFlatAttrs] = useState([])
  const [result, setResult] = useState(null)
  const [checking, setChecking] = useState(false)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => { setTestPersona(activePersona) }, [activePersona])

  useEffect(() => {
    const flat = []
    const DEMO_ATTRS = ['clearance', 'classification', 'department', 'role', 'project', 'mission', 'caveats', 'needtoknow', 'relto', 'nationality']
    attributes
      .filter(attr => DEMO_ATTRS.includes(attr.name))
      .forEach(attr => {
        const ns = attr.namespace?.name || 'demo.com'
        const name = attr.name
        ;(attr.values || []).forEach(v => {
          flat.push({
            fqn: `https://${ns}/attr/${name}/value/${v.value}`,
            ns, name, value: v.value,
            label: `${name}:${v.value}`,
          })
        })
      })
    if (flat.length === 0) {
      flat.push(...(sector === 'federal' ? FEDERAL_FLAT_ATTRS : COMMERCIAL_FLAT_ATTRS))
    }
    setFlatAttrs(flat)
    setPolicyAttrs([])
    setResult(null)
  }, [attributes, sector])

  function togglePolicy(fqn) {
    setPolicyAttrs(prev => prev.includes(fqn) ? prev.filter(a => a !== fqn) : [...prev, fqn])
    setResult(null)
  }

  async function checkAccess() {
    if (!testPersona || policyAttrs.length === 0) return
    setChecking(true)
    setResult(null)
    try {
      let userEntitlements = []
      try { userEntitlements = await getEntitlements(testPersona.username, policyAttrs) } catch { /* offline */ }
      const entitlementSet = new Set(
        userEntitlements.map(e => (typeof e === 'string' ? e : e?.attributeValueFqn || ''))
      )
      ;(testPersona.fqns || []).forEach(f => entitlementSet.add(f))

      const matched = [], missing = []
      for (const fqn of policyAttrs) {
        if (entitlementSet.has(fqn)) { matched.push(fqn) } else { missing.push(fqn) }
      }
      await new Promise(r => setTimeout(r, 600))
      setResult({ entitled: missing.length === 0, matched, missing, checked: policyAttrs })
    } finally { setChecking(false) }
  }

  // Group and sort attributes
  const groups = {}
  flatAttrs.forEach(a => {
    if (!groups[a.name]) groups[a.name] = []
    groups[a.name].push(a)
  })
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => {
    const pa = ATTR_GROUP_META[a]?.priority ?? 99
    const pb = ATTR_GROUP_META[b]?.priority ?? 99
    return pa - pb
  })
  const primaryGroups = sortedGroups.filter(([name]) => !SECONDARY_GROUPS.has(name))
  const secondaryGroups = sortedGroups.filter(([name]) => SECONDARY_GROUPS.has(name))

  // Live preview for selected persona
  const liveMissing = policyAttrs.filter(fqn => !(testPersona?.fqns || []).includes(fqn))
  const liveGranted = policyAttrs.length > 0 && liveMissing.length === 0

  // "This would protect" — match policy clearance to classification
  const clearanceVal = policyAttrs.map(f => f.split('/value/')[1]).find(v => CLEARANCE_TO_CLASSIFICATION[v])
  const matchedClassification = clearanceVal ? CLEARANCE_TO_CLASSIFICATION[clearanceVal] : null

  // Federal quick scenarios (inline since they don't depend on flatAttrs lookup that has issues with old IDs)
  const QUICK_SCENARIOS = [
    { label: 'TS/SCI SIGINT access', hint: '✓ Sarah (analyst) passes', attrValues: ['ts-sci'], personaId: 'sarah' },
    { label: 'SECRET mission access', hint: '✓ James (contractor) passes', attrValues: ['secret'], personaId: 'james' },
    { label: 'Confidential only',    hint: '✗ Marcus (CUI only) denied', attrValues: ['confidential'], personaId: 'marcus' },
    { label: 'No clearance required',hint: '✓ Anyone can access',       attrValues: [],       personaId: 'generic' },
  ]

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>

      {/* Page hero */}
      <div className="page-hero">
        <p className="page-subtitle">
          Build an attribute-based access policy, select a persona, and see live whether they'd be entitled to the data.
          This is exactly what KAS evaluates on every decrypt.
        </p>
        <div className="page-actions">
        </div>
      </div>

      {/* Rule type cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { rule: 'HIERARCHY', color: '#f59e0b', title: 'Clearance Hierarchy', desc: 'Higher clearance satisfies lower requirements. TS/SCI user can decrypt SECRET documents.', example: 'clearance:ts-sci satisfies clearance:secret' },
          { rule: 'ALL_OF',    color: '#8b5cf6', title: 'Need-to-Know (ALL)', desc: 'User must hold every listed compartment. Missing any single one blocks access.', example: 'needtoknow:intel AND needtoknow:ops → both required' },
          { rule: 'ANY_OF',    color: '#3b82f6', title: 'Coalition / REL TO', desc: 'Any coalition membership grants access. Used for FVEY and NATO sharing policies.', example: 'relto:fvey OR relto:nato → either qualifies' },
        ].map(rt => (
          <div key={rt.rule} style={{
            borderRadius: 12, padding: '14px 16px',
            background: 'var(--c-surface)', border: `1px solid ${rt.color}33`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: rt.color }}>{rt.rule}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-2)', marginBottom: 4 }}>{rt.title}</div>
            <p style={{ fontSize: 12, color: 'var(--c-text-4)', lineHeight: 1.5, marginBottom: 8 }}>{rt.desc}</p>
            <div style={{ fontSize: 11, fontFamily: 'monospace', padding: '4px 8px', borderRadius: 4, background: rt.color + '0d', color: rt.color + 'cc', border: `1px solid ${rt.color}22` }}>
              {rt.example}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 20 }}>

        {/* ── Left: Policy builder ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-3)' }}>Build Access Policy</div>
              {policyAttrs.length > 0 && (
                <button onClick={() => { setPolicyAttrs([]); setResult(null) }}
                  style={{ fontSize: 11, cursor: 'pointer', color: 'var(--c-text-5)', background: 'none', border: 'none' }}>
                  Clear all
                </button>
              )}
            </div>

            {/* Primary groups */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {primaryGroups.map(([name, values]) => {
                const meta = ATTR_GROUP_META[name] || { color: '#6b7280' }
                return (
                  <div key={name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: meta.color }}>{name}</span>
                      {meta.note && <span style={{ fontSize: 10, color: 'var(--c-text-6)', fontStyle: 'italic' }}>— {meta.note}</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {values.map(a => {
                        const sel = policyAttrs.includes(a.fqn)
                        return (
                          <button key={a.fqn} onClick={() => togglePolicy(a.fqn)}
                            title={techMode ? a.fqn : a.label}
                            style={{
                              padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                              cursor: 'pointer', transition: 'all 0.12s',
                              background: sel ? meta.color + '22' : 'var(--c-surface-2)',
                              color: sel ? meta.color : 'var(--c-text-5)',
                              border: `1px solid ${sel ? meta.color : 'var(--c-border)'}`,
                            }}>
                            {sel && '✓ '}{a.value}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Show more toggle */}
            {secondaryGroups.length > 0 && (
              <>
                <button onClick={() => setShowMore(x => !x)} style={{
                  marginTop: 12, fontSize: 12, color: 'var(--c-text-5)', cursor: 'pointer',
                  background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {showMore ? '▲ Hide' : '▼ Show more attributes'} ({secondaryGroups.reduce((n, [, v]) => n + v.length, 0)} additional)
                </button>
                {showMore && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                    {secondaryGroups.map(([name, values]) => {
                      const meta = ATTR_GROUP_META[name] || { color: '#6b7280' }
                      return (
                        <div key={name}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: meta.color, marginBottom: 6 }}>{name}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {values.map(a => {
                              const sel = policyAttrs.includes(a.fqn)
                              return (
                                <button key={a.fqn} onClick={() => togglePolicy(a.fqn)} style={{
                                  padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 500,
                                  cursor: 'pointer',
                                  background: sel ? meta.color + '22' : 'var(--c-surface-2)',
                                  color: sel ? meta.color : 'var(--c-text-5)',
                                  border: `1px solid ${sel ? meta.color : 'var(--c-border)'}`,
                                }}>
                                  {sel && '✓ '}{a.value}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Policy summary */}
            {policyAttrs.length > 0 && (
              <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 6 }}>Policy requires (ALL must match):</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {policyAttrs.map((fqn, i) => (
                    <span key={fqn} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: '#1e3a5f', color: '#60a5fa' }}>
                        {fqn.split('/value/')[1] || fqn}
                      </span>
                      {i < policyAttrs.length - 1 && <span style={{ fontSize: 10, color: 'var(--c-text-6)' }}>AND</span>}
                    </span>
                  ))}
                </div>
                {techMode && (
                  <pre style={{ marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--c-text-6)', margin: '8px 0 0 0' }}>
                    {JSON.stringify({ dataAttributes: policyAttrs.map(f => ({ attribute: f })) }, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {/* Live preview badge */}
            {policyAttrs.length > 0 && testPersona && (
              <div className="step-in" style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 8,
                background: liveGranted ? '#dcfce7' : '#fee2e2',
                border: `1px solid ${liveGranted ? '#86efac' : '#fca5a5'}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: liveGranted ? '#15803d' : '#dc2626' }}>
                  {testPersona.avatar} {testPersona.name} would be: {liveGranted ? '✓ GRANTED' : '✗ DENIED'}
                </div>
                {!liveGranted && liveMissing.length > 0 && (
                  <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
                    Missing: {liveMissing.map(f => f.split('/value/')[1]).join(', ')}
                  </div>
                )}
                {!liveGranted && (
                  <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, fontStyle: 'italic' }}>
                    KAS would return HTTP 403 — DEK not unwrapped
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            {policyAttrs.length > 0 && (
              <button
                onClick={() => navigate('/encrypt', { state: { fromPolicy: true, policy: { dataAttributes: policyAttrs.map(f => ({ attribute: f })) } } })}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', background: 'linear-gradient(135deg, #2d1a5f, #3a2575)',
                  color: '#a78bfa', border: '1px solid #7c3aed',
                }}>
                Encrypt with this Policy →
              </button>
            )}
            <button
              onClick={checkAccess}
              disabled={policyAttrs.length === 0 || !testPersona || checking}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: policyAttrs.length === 0 ? 'not-allowed' : 'pointer',
                background: policyAttrs.length === 0 ? 'var(--c-surface)' : 'linear-gradient(135deg, #1e3a5f, #2d4a7a)',
                color: policyAttrs.length === 0 ? 'var(--c-text-6)' : '#60a5fa',
                border: `1px solid ${policyAttrs.length === 0 ? 'var(--c-border)' : '#3b82f6'}`,
                opacity: checking ? 0.5 : 1,
              }}>
              {checking ? '◌ Checking entitlements…' : 'Check Access via Platform'}
            </button>
          </div>

          {/* Full result */}
          {result && (
            <div className="step-in" style={{
              borderRadius: 12, overflow: 'hidden',
              border: `2px solid ${result.entitled ? '#22c55e' : '#ef4444'}`,
              boxShadow: `0 0 24px ${result.entitled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
            }}>
              <div style={{
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                background: result.entitled ? '#166534' : '#7f1d1d',
              }}>
                <span style={{ fontSize: 36 }}>{result.entitled ? '✅' : '🔒'}</span>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: result.entitled ? '#4ade80' : '#f87171', lineHeight: 1 }}>
                    {result.entitled ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                  </div>
                  <div style={{ fontSize: 12, color: result.entitled ? '#86efac' : '#fca5a5', marginTop: 3 }}>
                    {testPersona.avatar} {testPersona.name} · {testPersona.title}
                  </div>
                </div>
              </div>
              <div style={{ padding: '14px 20px', background: result.entitled ? '#0f2d1a' : '#1c0505' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.matched.map(fqn => (
                    <div key={fqn} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#4ade80' }}>✓</span>
                      <span style={{ color: '#86efac', fontFamily: 'monospace', fontSize: 12 }}>{fqn.split('/value/')[1]}</span>
                      <span style={{ fontSize: 11, color: '#166534' }}>satisfied</span>
                    </div>
                  ))}
                  {result.missing.map(fqn => (
                    <div key={fqn} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: '#f87171' }}>✗</span>
                      <span style={{ color: '#fca5a5', fontFamily: 'monospace', fontSize: 12 }}>{fqn.split('/value/')[1]}</span>
                      <span style={{ fontSize: 11, color: '#7f1d1d' }}>missing</span>
                    </div>
                  ))}
                </div>
                {!result.entitled && (
                  <p style={{ marginTop: 10, fontSize: 12, color: '#7f1d1d', fontStyle: 'italic', margin: '10px 0 0 0' }}>
                    Without {result.missing.map(f => f.split('/value/')[1]).join(' + ')}, this user cannot open any TDF protected by this policy.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Persona + scenarios + "this would protect" ── */}
        <div style={{ width: 288, display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0 }}>

          {/* Persona picker */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 10 }}>Test as user</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {personas.map(p => {
                const isActive = testPersona?.id === p.id
                return (
                  <button key={p.id} onClick={() => { setTestPersona(p); setResult(null) }}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 6,
                      padding: '10px 12px', borderRadius: 10, textAlign: 'left', cursor: 'pointer', transition: 'all 0.12s',
                      background: isActive ? p.color + '18' : 'var(--c-surface-2)',
                      border: `1px solid ${isActive ? p.color : 'var(--c-border)'}`,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{p.avatar}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? p.color : 'var(--c-text-2)' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--c-text-5)' }}>{p.title}</div>
                      </div>
                      {isActive && <span style={{ fontSize: 10, color: p.color }}>●</span>}
                    </div>
                    {/* Show which policy attrs this persona satisfies */}
                    {policyAttrs.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 }}>
                        {policyAttrs.map(fqn => {
                          const has = (p.fqns || []).includes(fqn)
                          const val = fqn.split('/value/')[1]
                          return (
                            <span key={fqn} style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4,
                              fontFamily: 'monospace',
                              background: has ? p.color + '22' : '#fee2e2',
                              color: has ? p.color : '#dc2626',
                              border: `1px solid ${has ? p.color + '44' : '#fca5a5'}`,
                            }}>{has ? '✓ ' : '✗ '}{val}</span>
                          )
                        })}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quick scenarios */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 10 }}>Quick scenarios</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {QUICK_SCENARIOS.map(s => (
                <button key={s.label} onClick={() => {
                  const attrs = flatAttrs.filter(a => s.attrValues.includes(a.value)).map(a => a.fqn)
                  setPolicyAttrs(attrs)
                  setTestPersona(personas.find(p => p.id === s.personaId) || personas[0])
                  setResult(null)
                }} style={{
                  textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                  transition: 'all 0.12s',
                }}>
                  <div style={{ color: 'var(--c-text-3)', fontWeight: 500 }}>{s.label}</div>
                  <div style={{ fontSize: 11, marginTop: 2, color: s.hint.startsWith('✓') ? '#4ade80' : '#f87171' }}>{s.hint}</div>
                </button>
              ))}
            </div>
          </div>

          {/* "This would protect..." card */}
          {policyAttrs.length > 0 && matchedClassification && (
            <div className="step-in" style={{ background: '#001E4A', border: '1px solid #004987', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6AAAE4', marginBottom: 10 }}>
                This policy would protect:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <ClassificationBanner level={matchedClassification} />
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, margin: 0 }}>
                  Files marked <strong style={{ color: '#ffffff' }}>{matchedClassification}</strong> or higher would require this attribute.
                  Any user without it receives a 403 from KAS on every decrypt attempt.
                </p>
              </div>
            </div>
          )}

          {/* ABAC explainer */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 8 }}>How ABAC works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--c-text-4)', lineHeight: 1.5 }}>
              <div><span style={{ color: 'var(--c-text-3)', fontWeight: 600 }}>1.</span> Data owner assigns required attributes at encrypt time</div>
              <div><span style={{ color: 'var(--c-text-3)', fontWeight: 600 }}>2.</span> User's JWT attributes are checked live against the policy</div>
              <div><span style={{ color: 'var(--c-text-3)', fontWeight: 600 }}>3.</span> KAS unwraps the key only if all requirements are met</div>
              <div><span style={{ color: 'var(--c-text-3)', fontWeight: 600 }}>4.</span> Revoking an attribute revokes access instantly — no re-encryption needed</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
