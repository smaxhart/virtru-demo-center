import { useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import { getKasPublicKey } from '../api/platform.js'
import { COMMERCIAL_PERSONA_DOCS, FEDERAL_PERSONA_DOCS } from '../data/sectors.js'
import Icon from '../components/Icon.jsx'

const STEPS = [
  {
    id: 'plaintext',
    headline: 'Your original data',
    title: 'Plaintext Data',
    icon: 'document',
    color: 'var(--c-text-4)',
    simple: 'Your data starts as readable plaintext — visible to anyone with access.',
    technical: 'Raw bytes of the document or message before any cryptographic operation.',
  },
  {
    id: 'dek',
    headline: 'A one-time key is born',
    title: 'Data Encryption Key (DEK)',
    icon: 'innovation',
    color: '#3b82f6',
    simple: 'A random, one-time key is generated just for this piece of data. It\'s never reused.',
    technical: 'A 256-bit AES key generated using crypto.getRandomValues(). Unique per object.',
  },
  {
    id: 'encrypt',
    headline: 'Data becomes unreadable bytes',
    title: 'Encrypt Payload',
    icon: 'lock',
    color: '#8b5cf6',
    simple: 'The DEK encrypts your data using military-grade AES encryption. The result is unreadable without the key.',
    technical: 'AES-256-GCM encryption with a 96-bit random IV. Produces ciphertext + authentication tag.',
  },
  {
    id: 'kas_key',
    headline: 'KAS provides a padlock',
    title: 'KAS Public Key',
    icon: 'key',
    color: '#f59e0b',
    simple: 'KAS has a public key — like a padlock anyone can lock, but only KAS can open.',
    technical: 'RSA-2048 or EC P-256 public key fetched from /kas/v2/kas_public_key. Used for asymmetric wrapping.',
  },
  {
    id: 'wrap',
    headline: 'Key is locked inside the padlock',
    title: 'Wrap the DEK',
    icon: 'safe',
    color: '#ec4899',
    simple: 'The DEK is locked inside the KAS padlock. Now only KAS can recover it — and only for authorized users.',
    technical: 'RSA-OAEP or ECDH key agreement used to encrypt (wrap) the DEK with the KAS public key. Result is the "wrapped key" stored in the TDF manifest.',
  },
  {
    id: 'tdf',
    headline: 'Everything ships as one bundle',
    title: 'Assemble TDF',
    icon: 'tdf',
    color: '#10b981',
    simple: 'Everything is bundled into a TDF: the ciphertext, the wrapped key, and the access policy. It\'s now portable and self-protecting.',
    technical: 'A ZIP container with manifest.json (policy + key access objects) and 0.payload (ciphertext). The manifest embeds a base64-encoded policy with attribute FQNs.',
  },
  {
    id: 'rewrap',
    headline: 'Decryption begins with identity',
    title: 'Key Request (Decrypt)',
    icon: 'globe',
    color: '#06b6d4',
    simple: 'When someone tries to open the file, their identity is sent to KAS. KAS checks their attributes against the policy.',
    technical: 'POST /kas/v2/rewrap with the wrapped key + a signed entity object (JWT). KAS performs entitlement check via the platform AuthorizationService.',
  },
  {
    id: 'unwrap',
    headline: 'Plaintext appears — only on your device',
    title: 'Unwrap & Decrypt',
    icon: 'unlock',
    color: '#4ade80',
    simple: 'If authorized, KAS returns the DEK. The client decrypts the data locally. The plaintext never touches the server.',
    technical: 'KAS decrypts (unwraps) the DEK using its private key, then re-encrypts it for the requesting entity. Client derives the DEK and runs AES-GCM decrypt locally.',
  },
]

const MODES = [
  {
    id: 'software',
    label: 'Software',
    icon: 'innovation',
    desc: 'Platform-managed keys in the database. Best for development and lower-security environments.',
    pros: ['Simple setup', 'Fast operations'],
    cons: ['Keys stored in DB'],
  },
  {
    id: 'envelope',
    label: 'Envelope',
    icon: 'safe',
    badge: true,
    desc: 'KAS keys wrapped by HSM/KMS, cached in memory (30 min default). Balances security and performance.',
    pros: ['HSM-protected keys', 'Caching reduces latency', 'Lower HSM costs'],
    cons: [],
  },
  {
    id: 'delegated',
    label: 'Delegated',
    icon: 'shield',
    desc: 'All crypto operations in HSM/KMS. Keys never leave the HSM. Thales Luna meets FIPS 140-2 Level 3.',
    pros: ['FIPS 140-2 Level 3', 'Full audit trail', 'Keys never leave HSM'],
    cons: ['Higher latency'],
  },
]

function HexBox({ label, value, color }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--c-bg)', border: `1px solid ${color}33` }}>
      <div className="text-xs mb-1" style={{ color, opacity: 0.7 }}>{label}</div>
      <div className="text-xs font-mono break-all" style={{ color, lineHeight: 1.5 }}>{value}</div>
    </div>
  )
}

function Arrow({ color = 'var(--c-text-6)', label }) {
  return (
    <div className="flex flex-col items-center gap-1 my-1">
      <div className="w-0.5 h-5 rounded" style={{ background: color }} />
      <div style={{ filter: `drop-shadow(0 0 4px ${color})` }}>▼</div>
      {label && <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>{label}</div>}
    </div>
  )
}

export default function KeyWrapPage() {
  const { techMode, activePersona } = useDemo()
  const [activeStep, setActiveStep] = useState(0)
  const [kasKeyData, setKasKeyData] = useState(null)
  const [loadingKas, setLoadingKas] = useState(false)
  const [activeMode, setActiveMode] = useState('envelope')
  const [multiKasExpanded, setMultiKasExpanded] = useState(false)

  const step = STEPS[activeStep]

  async function fetchKasKey() {
    setLoadingKas(true)
    try {
      const data = await getKasPublicKey()
      setKasKeyData(data)
    } catch {
      setKasKeyData({ publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA…(simulated)', simulated: true })
    } finally {
      setLoadingKas(false)
    }
  }

  const DEK_HEX = 'a3f2c8e91b4d67054f2a38c0e5b7912d4a6f1c8e3b9d2047a5c6e1f8302d4b7e'
  const CIPHER  = '8f3a2c1b7e4d9065a2f8c3e1b7d4a96f…'
  const WRAPPED = 'UkFORE9NX1dSQVBQRURfS0VZX0JZVEVT_' + DEK_HEX.slice(0, 16) + '…'
  const policyAttrs = activePersona.fqns.length > 0
    ? activePersona.fqns.map(a => ({ attribute: a }))
    : [{ attribute: 'https://example.com/attr/clearance/value/top-secret' }]
  const POLICY = btoa(JSON.stringify({ dataAttributes: policyAttrs }))

  const isFederal = ['sarah', 'james', 'patricia', 'marcus'].includes(activePersona.id)
  const personaDoc = isFederal ? FEDERAL_PERSONA_DOCS[activePersona.id] : COMMERCIAL_PERSONA_DOCS[activePersona.id]
  const PLAINTEXT_PREVIEW = personaDoc
    ? personaDoc.plaintext.split('\n')[0]
    : 'Sensitive document contents — readable by anyone with file access...'
  const PLAINTEXT_TITLE = personaDoc?.title ?? 'Protected Document'

  const mode = MODES.find(m => m.id === activeMode)

  return (
    <div className="p-6 flex flex-col gap-5 max-w-6xl mx-auto">
      <div className="page-hero">
        <p className="page-subtitle">Step through the complete encryption cycle — from raw plaintext to TDF and back. The key is never stored anywhere: not in the database, not in memory at rest, not on disk.</p>
        <div className="page-actions" />
      </div>

      {/* Main 3-col stepper */}
      <div className="flex gap-5">

        {/* Left: step list */}
        <div className="flex flex-col gap-1 flex-shrink-0" style={{ width: 196 }}>
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActiveStep(i)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left cursor-pointer transition-all"
              style={{
                background: i === activeStep ? s.color + '22' : i < activeStep ? 'var(--c-surface)' : 'var(--c-bg)',
                border: `1px solid ${i === activeStep ? s.color : 'var(--c-border)'}`,
                opacity: i > activeStep ? 0.45 : 1,
              }}>
              <Icon name={s.icon} size={16} fallback={<span>{s.icon}</span>} />
              <span className="text-xs font-medium flex-1" style={{ color: i === activeStep ? s.color : i < activeStep ? 'var(--c-text-4)' : 'var(--c-text-6)' }}>
                {i + 1}. {s.title}
              </span>
              {i < activeStep && <span className="text-xs" style={{ color: 'var(--c-text-6)' }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Center: step card + nav */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div key={step.id} className="rounded-xl p-5 step-in"
            style={{ background: 'var(--c-surface)', border: `2px solid ${step.color}`, minHeight: 160 }}>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: step.color + '22', border: `1px solid ${step.color}44` }}>
                <Icon name={step.icon} size={28} fallback={<span className="text-xl">{step.icon}</span>} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xl font-bold mb-0.5" style={{ color: step.color }}>{step.headline}</div>
                <div className="text-xs mb-2" style={{ color: 'var(--c-text-5)' }}>{step.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--c-text-3)' }}>
                  {techMode ? step.technical : step.simple}
                </div>
              </div>
            </div>

            {step.id === 'plaintext' && (
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
                <div className="px-3 py-1.5 text-xs" style={{ background: 'var(--c-surface-2)', color: 'var(--c-text-5)', borderBottom: '1px solid var(--c-border)' }}>
                  {PLAINTEXT_TITLE}
                </div>
                <div className="p-3 text-sm" style={{ background: 'var(--c-bg)', color: 'var(--c-text-2)' }}>
                  {PLAINTEXT_PREVIEW}
                </div>
              </div>
            )}

            {step.id === 'dek' && (
              <HexBox label="256-bit AES key (random, never reused)" value={DEK_HEX} color={step.color} />
            )}

            {step.id === 'encrypt' && (
              <div className="flex flex-col gap-2">
                <HexBox label="Input: plaintext" value={PLAINTEXT_PREVIEW} color="var(--c-text-4)" />
                <Arrow color={step.color} label="AES-256-GCM" />
                <HexBox label="Output: ciphertext" value={CIPHER} color={step.color} />
              </div>
            )}

            {step.id === 'kas_key' && (
              !kasKeyData ? (
                <button
                  onClick={fetchKasKey}
                  disabled={loadingKas}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                  style={{ background: 'var(--c-border)', color: '#f59e0b', border: '1px solid #f59e0b' }}>
                  {loadingKas ? '⏳ Fetching from KAS…' : '⬇ Fetch Live KAS Public Key'}
                </button>
              ) : (
                <div>
                  <HexBox
                    label={kasKeyData.simulated ? 'KAS Public Key (simulated)' : 'KAS Public Key (live from kas.dsp.vm)'}
                    value={typeof kasKeyData.publicKey === 'string' ? kasKeyData.publicKey.slice(0, 120) + '…' : JSON.stringify(kasKeyData).slice(0, 120) + '…'}
                    color={step.color}
                  />
                  {!kasKeyData.simulated && (
                    <div className="mt-2 text-xs px-2 py-1 rounded inline-block" style={{ background: 'var(--c-success-bg)', color: '#4ade80' }}>
                      ✓ Live key from kas.dsp.vm
                    </div>
                  )}
                </div>
              )
            )}

            {step.id === 'wrap' && (
              <div className="flex flex-col gap-2">
                <HexBox label="Input: DEK (plaintext)" value={DEK_HEX} color="#3b82f6" />
                <Arrow color={step.color} label="RSA-OAEP encrypt with KAS public key" />
                <HexBox label="Output: wrapped key (only KAS can open)" value={WRAPPED} color={step.color} />
              </div>
            )}

            {step.id === 'tdf' && (
              <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${step.color}44` }}>
                <div className="px-3 py-2 text-xs font-bold" style={{ background: step.color + '22', color: step.color }}>
                  TDF Archive (manifest.json + 0.payload)
                </div>
                <div className="p-3 text-xs font-mono" style={{ background: 'var(--c-bg)', color: 'var(--c-text-3)', lineHeight: 1.8 }}>
                  <div><span style={{ color: step.color }}>payload:</span> 0.payload (ciphertext)</div>
                  <div><span style={{ color: step.color }}>keyAccess[0].wrappedKey:</span> {WRAPPED.slice(0, 20)}…</div>
                  <div><span style={{ color: step.color }}>keyAccess[0].url:</span> https://kas.dsp.vm</div>
                  <div><span style={{ color: step.color }}>policy:</span> {POLICY.slice(0, 40)}…</div>
                  <div><span style={{ color: step.color }}>method.algorithm:</span> AES-256-GCM</div>
                </div>
              </div>
            )}

            {step.id === 'rewrap' && (
              <div className="flex flex-col gap-2">
                <div className="p-3 rounded-lg text-xs font-mono" style={{ background: 'var(--c-bg)', color: '#06b6d4', border: '1px solid #06b6d433' }}>
                  POST https://kas.dsp.vm/kas/v2/rewrap<br />
                  <span style={{ color: 'var(--c-text-5)' }}>{'{'}</span><br />
                  &nbsp;&nbsp;<span style={{ color: '#8b5cf6' }}>"signedRequestToken"</span>: <span style={{ color: '#4ade80' }}>"eyJhb…"</span>,<br />
                  &nbsp;&nbsp;<span style={{ color: '#8b5cf6' }}>"entity"</span>: <span style={{ color: '#4ade80' }}>{`"${activePersona.username || 'user'}"`}</span><br />
                  <span style={{ color: 'var(--c-text-5)' }}>{'}'}</span>
                </div>
                <div className="text-xs p-2 rounded" style={{ background: 'var(--c-success-bg)', color: '#4ade80', border: '1px solid #166534' }}>
                  → GetEntitlements({activePersona.username || 'user'}) → {activePersona.attributes.length > 0 ? '✓ entitled' : '✗ no attributes'}
                </div>
              </div>
            )}

            {step.id === 'unwrap' && (
              <div className="flex flex-col gap-2">
                <HexBox label="KAS unwraps DEK using its private key" value={DEK_HEX} color={step.color} />
                <Arrow color={step.color} label="Client runs AES-256-GCM decrypt" />
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #166534' }}>
                  <div className="px-3 py-1.5 text-xs" style={{ background: '#0d2018', color: '#4ade80', borderBottom: '1px solid #166534' }}>
                    ✓ Decrypted — {PLAINTEXT_TITLE}
                  </div>
                  <div className="p-3 text-sm" style={{ background: 'var(--c-success-bg)', color: '#86efac' }}>
                    {PLAINTEXT_PREVIEW}
                  </div>
                </div>
                <div className="text-xs" style={{ color: '#4ade80' }}>
                  Plaintext never left the client. KAS only returned the DEK — it never saw the payload.
                </div>
              </div>
            )}
          </div>

          {/* Prev / Next */}
          <div className="flex gap-3">
            <button
              onClick={() => setActiveStep(0)}
              disabled={activeStep === 0}
              className="py-2 px-3 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-30"
              style={{ background: 'var(--c-border)', color: 'var(--c-text-5)', border: '1px solid var(--c-border-2)' }}>
              ↺
            </button>
            <button
              onClick={() => setActiveStep(i => Math.max(0, i - 1))}
              disabled={activeStep === 0}
              className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-30"
              style={{ background: 'var(--c-border)', color: 'var(--c-text-3)', border: '1px solid var(--c-border-2)' }}>
              ← Previous
            </button>
            <button
              onClick={() => setActiveStep(i => Math.min(STEPS.length - 1, i + 1))}
              disabled={activeStep === STEPS.length - 1}
              className="flex-1 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-30"
              style={{ background: step.color + '22', color: step.color, border: `1px solid ${step.color}` }}>
              Next →
            </button>
          </div>
        </div>

        {/* Right: side cards */}
        <div className="flex flex-col gap-4 flex-shrink-0" style={{ width: 220 }}>
          <div className="rounded-xl p-4" style={{ background: '#001E4A', border: '1px solid #004987' }}>
            <div className="text-xs font-bold mb-3" style={{ color: '#6AAAE4' }}>WHAT THIS PREVENTS</div>
            <div className="flex flex-col gap-3">
              {[
                { icon: '🚨', threat: 'Stolen file',     outcome: 'Ciphertext only — useless without KAS' },
                { icon: '🗄️', threat: 'DB breach',       outcome: 'Wrapped keys can\'t be decrypted without HSM' },
                { icon: '☁️', threat: 'Storage breach',  outcome: 'Encrypted payload only' },
                { icon: '👤', threat: 'Insider threat',  outcome: 'Revoke attribute → instant loss, no re-encryption needed' },
              ].map(t => (
                <div key={t.threat} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171' }}>{t.threat}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{t.outcome}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {techMode && (
            <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <div className="text-xs font-bold mb-3" style={{ color: 'var(--c-text-5)' }}>KEY PROPERTIES</div>
              <div className="flex flex-col gap-2 text-xs">
                {[
                  { label: 'DEK',     value: 'AES-256-GCM' },
                  { label: 'Wrap',    value: 'RSA-OAEP' },
                  { label: 'Key size', value: '256 bit' },
                  { label: 'IV',      value: '96 bit random' },
                  { label: 'Stored?', value: 'Never' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span style={{ color: 'var(--c-text-5)' }}>{label}</span>
                    <span className="font-medium" style={{ color: 'var(--c-text-3)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Key management modes — compact tabs */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
        <div className="flex" style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setActiveMode(m.id)}
              className="flex-1 px-4 py-2.5 text-sm font-medium cursor-pointer flex items-center justify-center gap-2"
              style={{
                background: activeMode === m.id ? (m.id === 'envelope' ? '#1e3a5f' : 'var(--c-surface-2)') : 'transparent',
                color: activeMode === m.id ? (m.id === 'envelope' ? '#60a5fa' : 'var(--c-text-2)') : 'var(--c-text-5)',
                borderBottom: activeMode === m.id ? `2px solid ${m.id === 'envelope' ? '#3b82f6' : 'var(--c-text-4)'}` : '2px solid transparent',
              }}>
              {m.label}
              {m.badge && <span className="px-1.5 py-0.5 rounded font-semibold" style={{ fontSize: 9, background: '#001E4A', color: '#60a5fa', border: '1px solid #3b82f6' }}>NEW</span>}
            </button>
          ))}
        </div>
        <div className="p-4 flex items-start gap-4" style={{ background: 'var(--c-bg)' }}>
          <Icon name={mode.icon} size={24} />
          <div className="flex-1">
            <p className="text-sm leading-relaxed mb-2" style={{ color: 'var(--c-text-3)' }}>{mode.desc}</p>
            <div className="flex gap-8 text-xs">
              <div className="flex flex-col gap-1">
                {mode.pros.map(p => <span key={p} style={{ color: '#4ade80' }}>✓ {p}</span>)}
              </div>
              {mode.cons.length > 0 && (
                <div className="flex flex-col gap-1">
                  {mode.cons.map(c => <span key={c} style={{ color: '#f87171' }}>− {c}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-KAS — techMode only */}
      {techMode && (
        <>
          <button
            onClick={() => setMultiKasExpanded(!multiKasExpanded)}
            className="w-full rounded-xl p-4 text-left cursor-pointer"
            style={{
              background: multiKasExpanded ? '#f59e0b22' : 'var(--c-surface)',
              border: `2px solid ${multiKasExpanded ? '#f59e0b' : 'var(--c-border)'}`,
            }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#f59e0b22', border: '1px solid #f59e0b44' }}>
                <Icon name="partners" size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold" style={{ color: '#f59e0b' }}>Multi-KAS Coalition Sharing</div>
                <div className="text-xs" style={{ color: 'var(--c-text-4)' }}>
                  Share data across organizations with distributed key management
                </div>
              </div>
              <div style={{ color: '#f59e0b', transition: 'transform 0.2s', transform: multiKasExpanded ? 'rotate(180deg)' : 'none' }}>▼</div>
            </div>
          </button>

          {multiKasExpanded && (
            <div className="rounded-xl p-5" style={{ background: 'var(--c-surface)', border: '2px solid #f59e0b' }}>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--c-text-3)' }}>
                For cross-organization data sharing (e.g., Five Eyes), a single TDF can be wrapped with multiple KAS instances.
                Each partner organization operates its own KAS and independently authorizes access for its users.
              </p>
              <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--c-info-bg)', border: '1px solid #1e3a5f' }}>
                <div className="text-xs font-bold mb-2" style={{ color: '#60a5fa' }}>USE CASE: FVEY INTELLIGENCE SHARING</div>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--c-text-4)' }}>
                  An FBI analyst encrypts a document with the FBI KAS. Instead of re-encrypting for each partner, the analyst performs a multi-KAS rewrap — generating 5 keyAccess objects, one per nation's KAS. Each KAS independently validates entitlements before releasing the DEK.
                </p>
              </div>
              <div className="mb-4">
                <div className="text-xs font-bold mb-3" style={{ color: 'var(--c-text-5)' }}>ONE DEK — FIVE WRAPPED COPIES</div>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { country: 'USA', flag: '🇺🇸', color: '#3b82f6' },
                    { country: 'UK',  flag: '🇬🇧', color: '#10b981' },
                    { country: 'CAN', flag: '🇨🇦', color: '#f59e0b' },
                    { country: 'AUS', flag: '🇦🇺', color: '#8b5cf6' },
                    { country: 'NZL', flag: '🇳🇿', color: '#ec4899' },
                  ].map(kas => (
                    <div key={kas.country} className="p-3 rounded-lg text-center" style={{ background: kas.color + '11', border: `1px solid ${kas.color}44` }}>
                      <div className="text-2xl mb-1">{kas.flag}</div>
                      <div className="text-xs font-semibold mb-1" style={{ color: kas.color }}>{kas.country} KAS</div>
                      <div className="text-xs font-mono p-1 rounded" style={{ background: 'var(--c-bg)', color: 'var(--c-text-5)', border: '1px solid var(--c-border)', fontSize: 9 }}>
                        wrapped_{kas.country.toLowerCase()}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-center text-xs" style={{ color: 'var(--c-text-5)' }}>
                  All 5 wrapped keys encrypt the <strong>same DEK</strong> — any coalition partner can decrypt if entitled.
                </div>
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #f59e0b44' }}>
                <div className="px-3 py-2 text-xs font-bold" style={{ background: '#f59e0b22', color: '#f59e0b' }}>TDF MANIFEST — MULTI-KAS</div>
                <div className="p-3 text-xs font-mono" style={{ background: 'var(--c-bg)', color: 'var(--c-text-3)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
{`{ "keyAccess": [
    { "url": "https://fbi-kas.gov/kas",      "wrappedKey": "UkFORE9N…ZCSQ==" },
    { "url": "https://gchq-kas.gov.uk/kas",  "wrappedKey": "UkFORE9N…Q0hR==" },
    { "url": "https://csis-kas.gc.ca/kas",   "wrappedKey": "UkFORE9N…NTSU0=" },
    { "url": "https://asio-kas.gov.au/kas",  "wrappedKey": "UkFORE9N…VTSU8=" },
    { "url": "https://gcsb-kas.govt.nz/kas", "wrappedKey": "UkFORE9N…U0NC==" }
  ]
}`}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
