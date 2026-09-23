import { useState, useEffect } from 'react'
import { useDemo } from '../../context/DemoContext.jsx'
import { getEntitlements, getKasPublicKey } from '../../api/platform.js'
import { FEDERAL_PERSONA_DOCS } from '../../data/sectors.js'
import { evaluatePolicy, groupLabel } from '../../data/policyMatch.js'
import Icon from '../../components/Icon.jsx'
import ClassificationBanner from '../../components/ClassificationBanner.jsx'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const DECRYPT_STEPS = [
  { id: 'auth',    label: 'Authenticating identity',      icon: 'key' },
  { id: 'entitle', label: 'Checking entitlements at KAS', icon: 'globe' },
  { id: 'policy',  label: 'Evaluating policy binding',    icon: 'compliance' },
]

async function webCryptoEncrypt(plaintext) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const rawKey = await crypto.subtle.exportKey('raw', key)
  const toHex = arr => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  return {
    cipherHex: toHex(new Uint8Array(cipher)).slice(0, 80) + '...',
    iv: toHex(iv),
    wrappedKey: btoa(toHex(new Uint8Array(rawKey)).slice(0, 16) + '_WRAPPED_'),
  }
}

export default function RevocationPage() {
  const { activePersona, setActivePersona, personas, techMode, platformReady, logEvent } = useDemo()

  const personaDocs = FEDERAL_PERSONA_DOCS
  const doc = personaDocs[activePersona.id] ?? personaDocs[Object.keys(personaDocs)[0]]

  const [activeAttrs, setActiveAttrs]     = useState(() => new Set(activePersona.fqns))
  const [encryptedDoc, setEncryptedDoc]   = useState(null)
  const [encryptStatus, setEncryptStatus] = useState('encrypting')
  const [kasKey, setKasKey]               = useState(null)
  const [checkStatus, setCheckStatus]     = useState('idle')
  const [currentStep, setCurrentStep]     = useState(-1)
  const [attemptLog, setAttemptLog]       = useState([])
  const [lastReason, setLastReason]       = useState('')

  useEffect(() => {
    setActiveAttrs(new Set(activePersona.fqns))
    setCheckStatus('idle')
    setCurrentStep(-1)
    setLastReason('')
    const currentDoc = personaDocs[activePersona.id] ?? personaDocs[Object.keys(personaDocs)[0]]
    async function reEncrypt() {
      setEncryptStatus('encrypting')
      setEncryptedDoc(null)
      try {
        const result = await webCryptoEncrypt(currentDoc.plaintext)
        setEncryptedDoc({ ...result, policy: { uuid: crypto.randomUUID(), dataAttributes: currentDoc.policyFqns } })
      } catch {
        setEncryptedDoc({
          cipherHex: 'a3f9e1b2c4d5ee87ff920134ab56cd78ef901234567890abcdef1234567890ab...',
          iv: '0a1b2c3d4e5f6789', wrappedKey: 'SIMULATED',
          policy: { uuid: 'demo-uuid', dataAttributes: currentDoc.policyFqns },
        })
      }
      setEncryptStatus('ready')
    }
    reEncrypt()
  }, [activePersona.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getKasPublicKey()
      .then(kasData => {
        const key = kasData.publicKey || kasData.key || kasData
        setKasKey(typeof key === 'string' ? key.slice(0, 60) + '…' : '(live KAS key)')
      })
      .catch(() => setKasKey('(simulated — KAS offline)'))
  }, [])

  function toggleAttr(fqn) {
    setActiveAttrs(prev => {
      const next = new Set(prev)
      next.has(fqn) ? next.delete(fqn) : next.add(fqn)
      return next
    })
    if (checkStatus === 'granted' || checkStatus === 'denied') {
      setCheckStatus('idle')
      setCurrentStep(-1)
    }
  }

  async function runDecryptCheck() {
    if (checkStatus === 'checking') return
    setCheckStatus('checking')
    setCurrentStep(0)
    setLastReason('')
    await sleep(400)
    setCurrentStep(1)
    if (platformReady) {
      try { await getEntitlements(activePersona.username, doc.policyFqns) } catch { /* ignore */ }
    }
    // Per definition, not per FQN. A REL TO FVEY policy names five nations and holding one of them
    // satisfies it — `every()` here reported Emma denied a document the KAS grants her.
    const { satisfied: entitled, missing } = evaluatePolicy([...activeAttrs], doc.policyFqns)
    await sleep(800)
    setCurrentStep(2)
    await sleep(600)
    const reason = entitled
      ? 'All required attributes present'
      : `Missing: ${missing.map(groupLabel).join('; ')}`
    setLastReason(reason)
    setCheckStatus(entitled ? 'granted' : 'denied')
    setCurrentStep(3)
    logEvent({
      type: 'access',
      persona: { id: activePersona.id, name: activePersona.name, avatar: activePersona.avatar, color: activePersona.color, fqns: [...activeAttrs] },
      document: doc.title, result: entitled ? 'granted' : 'denied', reason,
    })
    setAttemptLog(prev => [{
      ts: new Date().toLocaleTimeString(),
      persona: { name: activePersona.name, avatar: activePersona.avatar, color: activePersona.color },
      docTitle: doc.title, result: entitled ? 'GRANTED' : 'DENIED', reason,
    }, ...prev].slice(0, 10))
  }

  // The live verdict the panels below render. `groups` is one entry per attribute definition, so a
  // thirteen-nation NATO roster is one requirement rather than thirteen.
  const verdict = evaluatePolicy([...activeAttrs], doc.policyFqns)
  const isGeneric = activePersona.id === 'generic'

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>

      {/* Page hero */}
      <div className="page-hero">
        <p className="page-subtitle">
          Toggle a user's attributes on or off to simulate clearance revocation — the encrypted file never moves.
          KAS re-evaluates entitlements live on every single decrypt attempt.
        </p>
        <div className="page-actions">
        </div>
      </div>

      {/* 2-column layout */}
      <div style={{ display: 'flex', gap: 20 }}>

        {/* ── Left column (60%) ── */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Scenario narrative card */}
          <div style={{ background: '#001E4A', border: '1px solid #004987', borderRadius: 12, padding: '16px 20px' }}>
            {isGeneric ? (
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 1.6 }}>
                <div style={{ color: '#6AAAE4', fontWeight: 700, marginBottom: 6, fontSize: 14 }}>How to demo this page</div>
                Select a persona in the right panel, then toggle their required attributes on or off.
                Click <strong style={{ color: '#ffffff' }}>Try Decrypt</strong> to watch KAS enforce the policy in real time.
                {techMode && (
                  <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 11, color: '#4a7aaa', borderTop: '1px solid #004987', paddingTop: 10 }}>
                    The wrapped DEK lives at KAS. On every decrypt, KAS calls the authorization service to verify live entitlements.
                    Removing an attribute takes effect instantly — no file rotation needed.
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{activePersona.avatar}</span>
                  <div>
                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 14 }}>{activePersona.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{activePersona.title}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {Array.from(activeAttrs).slice(0, 4).map(fqn => (
                      <span key={fqn} style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                        background: activePersona.color + '22', color: activePersona.color,
                        border: `1px solid ${activePersona.color}44`,
                      }}>{fqn.split('/value/')[1]}</span>
                    ))}
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6 }}>
                  The document below requires{' '}
                  <strong style={{ color: '#ffffff' }}>{verdict.groups.map(groupLabel).join(' + ')}</strong>.
                  Toggle any of those attributes off on the right to simulate a revocation, then click Try Decrypt.
                </div>
                {techMode && (
                  <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 11, color: '#4a7aaa', borderTop: '1px solid #004987', paddingTop: 10 }}>
                    KAS evaluates: entity JWT → AuthZ service → Subject Mappings → entitlement check → rewrap or 403.
                    No cached state — revocation is instant.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Encrypted document card */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="lock" size={16} style={{ color: 'var(--c-text-4)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-3)' }}>{doc.title}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClassificationBanner level={doc.classification} />
                {encryptStatus === 'encrypting'
                  ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dbeafe', color: '#2563eb', border: '1px solid #93c5fd' }}>◌ encrypting…</span>
                  : <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>✓ AES-256-GCM</span>
                }
              </div>
            </div>

            {/* Ciphertext block */}
            {encryptedDoc && (
              <div style={{
                background: '#0f172a', borderRadius: 8, padding: '12px 14px',
                fontFamily: 'monospace', fontSize: 11, minHeight: 80,
                color: '#94a3b8', wordBreak: 'break-all', marginBottom: 12,
                border: '1px solid #1e293b',
              }}>
                <div style={{ color: '#64748b', marginBottom: 4, fontSize: 10 }}>CIPHERTEXT — AES-256-GCM ENCRYPTED</div>
                <div style={{ color: '#7dd3fc' }}>{encryptedDoc.cipherHex}</div>
                {techMode && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div>IV: <span style={{ color: '#0ea5e9' }}>{encryptedDoc.iv}</span></div>
                    <div>Wrapped Key: <span style={{ color: '#a78bfa' }}>{encryptedDoc.wrappedKey}</span></div>
                    <div>KAS: <span style={{ color: '#60a5fa' }}>{kasKey}</span></div>
                  </div>
                )}
              </div>
            )}

            {/* Policy requirements */}
            <div style={{ background: 'var(--c-bg)', borderRadius: 8, padding: '10px 12px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 8 }}>
                Required to decrypt:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {verdict.groups.map(g => {
                  // One chip per requirement. A satisfied roster names the value that carried it —
                  // "nationality:gbr (1 of 5)" — which is the sentence the revocation demo needs:
                  // switch that one value off and the same document shuts.
                  const roster = g.values.length > 1
                  const label = g.satisfied
                    ? `${g.name}:${g.matched.split('/value/')[1]}${roster ? ` (1 of ${g.values.length})` : ''}`
                    : roster ? `${g.name}: none of ${g.values.length}` : groupLabel(g)
                  return (
                    <span key={g.definition} title={`${groupLabel(g)}${g.held.length ? `  ·  holds ${g.held.join(', ')}` : ''}`}
                      style={{
                        padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
                        background: g.satisfied ? '#dcfce7' : '#fee2e2',
                        color: g.satisfied ? '#16a34a' : '#dc2626',
                        border: `1px solid ${g.satisfied ? '#86efac' : '#fca5a5'}`,
                      }}>
                      {techMode ? groupLabel(g) : label}
                      {!g.satisfied && ' ✗'}
                    </span>
                  )
                })}
              </div>
              {verdict.missing.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: '#dc2626' }}>
                  ⚠ {verdict.missing.map(groupLabel).join('; ')} — decrypt will be denied
                </div>
              )}
            </div>

            {/* Try decrypt button */}
            <button
              onClick={runDecryptCheck}
              disabled={checkStatus === 'checking' || encryptStatus === 'encrypting'}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
                background: checkStatus === 'checking' ? '#1e3a5f' : 'linear-gradient(135deg, #1d4ed8, #1e40af)',
                color: '#ffffff', border: '1px solid #3b82f6',
                opacity: checkStatus === 'checking' || encryptStatus === 'encrypting' ? 0.5 : 1,
                transition: 'all 0.15s',
              }}>
              {checkStatus === 'checking'
                ? '◌  Checking with KAS...'
                : `Try Decrypt as ${isGeneric ? 'User' : activePersona.name.split(' ').slice(-1)[0]}`}
            </button>
          </div>

          {/* KAS decision steps */}
          {checkStatus !== 'idle' && (
            <div className="step-in" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 10 }}>KAS Decision Process</div>
              <div style={{ display: 'flex', gap: 0 }}>
                {DECRYPT_STEPS.map((s, i) => {
                  const done   = checkStatus !== 'checking' || currentStep > i
                  const active = i === currentStep && checkStatus === 'checking'
                  return (
                    <div key={s.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative' }}>
                      {i > 0 && (
                        <div style={{
                          position: 'absolute', left: 0, top: 12, width: '50%', height: 2,
                          background: done || currentStep >= i ? '#22c55e' : 'var(--c-border)',
                          transition: 'background 0.3s',
                        }} />
                      )}
                      {i < DECRYPT_STEPS.length - 1 && (
                        <div style={{
                          position: 'absolute', right: 0, top: 12, width: '50%', height: 2,
                          background: (checkStatus !== 'checking' && currentStep > i) || currentStep > i ? '#22c55e' : 'var(--c-border)',
                          transition: 'background 0.3s',
                        }} />
                      )}
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', zIndex: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
                        background: done ? '#dcfce7' : active ? '#dbeafe' : 'var(--c-bg)',
                        border: `2px solid ${done ? '#22c55e' : active ? '#3b82f6' : 'var(--c-border)'}`,
                        transition: 'all 0.3s',
                      }}>
                        {done ? '✓' : active ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span> : i + 1}
                      </div>
                      <div style={{ fontSize: 10, textAlign: 'center', color: done ? '#15803d' : active ? '#1d4ed8' : 'var(--c-text-5)', lineHeight: 1.3 }}>
                        {s.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* VERDICT — dramatically large */}
          {checkStatus === 'granted' && (
            <div className="step-in" style={{
              borderRadius: 12, overflow: 'hidden',
              border: '2px solid #22c55e',
              boxShadow: '0 0 32px rgba(34,197,94,0.2)',
            }}>
              <div style={{ background: '#166534', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>✅</span>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>ACCESS GRANTED</div>
                  <div style={{ fontSize: 13, color: '#86efac', marginTop: 4 }}>KAS unwrapped the DEK — document decrypted on device</div>
                </div>
              </div>
              <div style={{ background: '#0f2d1a', padding: '14px 24px' }}>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 6 }}>PLAINTEXT PREVIEW:</div>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#86efac', lineHeight: 1.6 }}>
                  {doc.plaintext?.split('\n').slice(0, 4).join('\n') || doc.plaintext?.slice(0, 200)}
                </div>
              </div>
            </div>
          )}

          {checkStatus === 'denied' && (
            <div className="step-in" style={{
              borderRadius: 12, overflow: 'hidden',
              border: '2px solid #ef4444',
              boxShadow: '0 0 32px rgba(239,68,68,0.2)',
            }}>
              <div style={{ background: '#7f1d1d', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#f87171', lineHeight: 1 }}>ACCESS DENIED</div>
                  <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 4 }}>KAS refused to unwrap the DEK — ciphertext unchanged</div>
                  {lastReason && <div style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>Reason: {lastReason}</div>}
                </div>
              </div>
              <div style={{ background: '#1c0505', padding: '14px 24px' }}>
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 6 }}>FILE CONTENT — STILL ENCRYPTED:</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#7f1d1d', lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {encryptedDoc?.cipherHex || 'a3f9e1b2c4d5ee87ff920134ab56cd78ef90...'}
                </div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 8, fontStyle: 'italic' }}>
                  The file is identical to what was encrypted. Without the DEK, it's meaningless bytes.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column (40%) ── */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Persona selector grid */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 10 }}>
              Select a user to test
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
              {personas.map(p => (
                <button key={p.id} onClick={() => setActivePersona(p)} title={`${p.name} — ${p.title}`} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                  background: activePersona.id === p.id ? p.color + '22' : 'var(--c-bg)',
                  border: `2px solid ${activePersona.id === p.id ? p.color : 'var(--c-border)'}`,
                }}>
                  <span style={{ fontSize: 18 }}>{p.avatar}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: activePersona.id === p.id ? p.color : 'var(--c-text-5)', textAlign: 'center', lineHeight: 1.2 }}>
                    {p.name.split(' ').slice(-1)[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Active persona info */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, marginBottom: 14,
              background: activePersona.color + '11', border: `1px solid ${activePersona.color}33`,
            }}>
              <span style={{ fontSize: 22 }}>{activePersona.avatar}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: activePersona.color }}>{activePersona.name}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text-5)' }}>{activePersona.title}</div>
              </div>
            </div>

            {/* Attribute toggles */}
            {activePersona.fqns.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 8 }}>
                  Active Attributes — toggle to revoke
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {activePersona.fqns.map(fqn => {
                    const short = fqn.split('/value/')[1]
                    const ns = fqn.split('/attr/')[1]?.split('/value/')[0] || ''
                    const isOn = activeAttrs.has(fqn)
                    const isRequired = doc.policyFqns.includes(fqn)
                    return (
                      <button key={fqn} onClick={() => toggleAttr(fqn)} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: isOn ? (isRequired ? '#dcfce7' : activePersona.color + '18') : '#fee2e2',
                        color: isOn ? (isRequired ? '#15803d' : activePersona.color) : '#dc2626',
                        border: `1px solid ${isOn ? (isRequired ? '#86efac' : activePersona.color + '55') : '#fca5a5'}`,
                      }}>
                        <span style={{ fontFamily: 'monospace', textDecoration: isOn ? 'none' : 'line-through' }}>
                          {techMode ? `${ns}:${short}` : short}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{isOn ? '✓ active' : '✗ revoked'}</span>
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setActiveAttrs(new Set())} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                  }}>⛔ Revoke All</button>
                  <button onClick={() => setActiveAttrs(new Set(activePersona.fqns))} style={{
                    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac',
                  }}>✓ Restore All</button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--c-text-5)', fontStyle: 'italic', padding: '8px 0' }}>
                Generic user has no attributes — all unprotected files accessible, protected files denied.
              </div>
            )}
          </div>

          {/* Attempt log */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 20px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 10 }}>
              Live Attempt Log
            </div>
            {attemptLog.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--c-text-5)', fontStyle: 'italic', padding: '12px 0' }}>
                No attempts yet — click "Try Decrypt" to start logging.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attemptLog.map((entry, i) => {
                  const granted = entry.result === 'GRANTED'
                  return (
                    <div key={i} className="step-in" style={{
                      borderRadius: 8, overflow: 'hidden',
                      border: `1px solid ${granted ? '#86efac' : '#fca5a5'}`,
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: granted ? '#dcfce7' : '#fee2e2',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14 }}>{entry.persona.avatar}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: entry.persona.color }}>{entry.persona.name.split(' ').slice(-1)[0]}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: granted ? '#16a34a' : '#dc2626' }}>
                            {granted ? '✓ GRANTED' : '✗ DENIED'}
                          </span>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--c-text-5)' }}>{entry.ts}</span>
                      </div>
                      <div style={{ padding: '6px 10px', background: 'var(--c-bg)' }}>
                        <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginBottom: 2 }}>{entry.docTitle}</div>
                        <div style={{ fontSize: 10, color: 'var(--c-text-5)' }}>{entry.reason}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
