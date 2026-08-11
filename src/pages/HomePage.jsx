import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext.jsx'

const CAPABILITY_GROUPS = [
  {
    label: 'The Foundation',
    cards: [
      {
        icon: '🛡',
        title: 'Attribute-Based Access Control',
        body: 'Policy is bound to the data and enforced cryptographically — not just configured at the application layer.',
        tagline: 'Your policy travels with your data.',
        color: 'var(--c-text-2)',
      },
      {
        icon: '🔒',
        title: 'Trusted Data Format (TDF)',
        body: 'Encrypt once, control forever. End-to-end protection across any system or boundary — built on an open standard.',
        tagline: 'No vendor lock-in. Ever.',
        color: 'var(--c-text-2)',
      },
      {
        icon: '📋',
        title: 'Audit & Key Management',
        body: 'Tamper-evident audit trail for every access event. Keys are never stored — only evaluated at the moment of access.',
        tagline: 'Compliance-ready on day one.',
        color: '#15803d',
      },
    ],
  },
  {
    label: 'What Makes It Unique',
    cards: [
      {
        icon: '📐',
        title: 'Bring Your Own Policy',
        body: 'Your rules are enforced by you, not delegated to a third party. Define attributes, set requirements, own the outcome.',
        tagline: 'Your policy. Your control.',
        color: 'var(--c-text-2)',
      },
      {
        icon: '👤',
        title: 'Bring Your Own Identity',
        body: 'Your existing users, roles, and credentials work natively. Okta, Active Directory, Ping — no migration required.',
        tagline: 'Trust and identity travel with your people.',
        color: 'var(--c-text-2)',
      },
      {
        icon: '🔑',
        title: 'Bring Your Own Key',
        body: 'You hold your own encryption keys. The platform never does. Sovereignty isn\'t a promise — it\'s a cryptographic fact.',
        tagline: 'Zero knowledge is architectural, not aspirational.',
        color: 'var(--c-text-2)',
      },
    ],
  },
]

const DEMO_CARDS = [
  {
    to: '/tdf-explorer',
    icon: '🗂',
    label: 'TDF Explorer',
    desc: 'Encrypt a real file, inspect the manifest, try decrypting as each persona',
    accent: '#6aaae4',
    badge: null,
  },
  {
    to: '/audit',
    icon: '📋',
    label: 'Audit Log',
    desc: 'See every access event, persona, and decision — exportable for compliance',
    accent: '#15803d',
    badge: null,
  },
  {
    to: '/collaborate',
    icon: '🤝',
    label: 'Collaborate',
    desc: 'Share protected files across SharePoint, S3, and Virtru Connect',
    accent: '#7c3aed',
    badge: null,
  },
  {
    to: '/cop',
    icon: '🗺',
    label: 'Common Operating Picture',
    desc: 'Live COP map with attribute-controlled asset visibility per persona',
    accent: '#0ea5e9',
    badge: null,
  },
  {
    to: '/ai-agent',
    icon: '🛡',
    label: 'AI Protection',
    desc: 'Policy-enforced AI chat — attribute checks run before the model sees any data',
    accent: '#1e40af',
    badge: 'New',
  },
  {
    to: '/architecture',
    icon: '🏗',
    label: 'Architecture',
    desc: 'Walk through the key wrapping flow and zero-knowledge KAS model',
    accent: '#64748b',
    badge: null,
  },
]

const PROOF_POINTS = [
  { value: 'Zero Trust', label: 'data standard (TDF)' },
  { value: 'Open Source', label: 'OpenTDF foundation' },
  { value: 'ABAC', label: 'attribute-based control' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { platformReady, platformError } = useDemo()

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(160deg, #0d2347 0%, #0a1628 60%)',
        borderBottom: '1px solid rgba(106,170,228,0.12)',
        padding: '56px 48px 48px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 480, height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(106,170,228,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Overblown watermark logomark */}
        <img
          src="./virtru-logomark.svg"
          alt=""
          style={{
            position: 'absolute', top: '-10%', right: '-40px',
            width: 520, height: 520,
            opacity: 0.12,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />

        <div style={{ maxWidth: 800, position: 'relative' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px', borderRadius: 99,
            background: platformReady === false ? 'rgba(185,28,28,0.1)' : 'rgba(106,170,228,0.1)',
            border: `1px solid ${platformReady === false ? 'rgba(185,28,28,0.3)' : 'rgba(106,170,228,0.2)'}`,
            marginBottom: 20,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: platformReady === true ? '#4ade80' : platformReady === false ? '#ef4444' : '#f59e0b',
            }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(147,197,253,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {platformReady === true
                ? 'Platform online — live demo ready'
                : platformReady === false
                  ? 'Platform error — check logs'
                  : 'Platform starting…'}
            </span>
          </div>

          {platformReady === false && platformError && (
            <div style={{
              marginBottom: 20, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(185,28,28,0.08)', border: '1px solid rgba(185,28,28,0.25)',
              maxWidth: 620,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>PLATFORM FAILED TO START</div>
              <pre style={{ fontSize: 11, color: 'rgba(252,165,165,0.8)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', lineHeight: 1.5 }}>
                {platformError}
              </pre>
              <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(147,197,253,0.5)' }}>
                Logs: ~/Library/Logs/virtru-demo-center/main.log
              </div>
            </div>
          )}

          <h1 style={{
            fontSize: 42, fontWeight: 800, lineHeight: 1.1,
            color: '#e8f0fe', marginBottom: 16, letterSpacing: '-0.5px',
          }}>
            Virtru Data Security<br />
            <span style={{ color: '#6aaae4' }}>Platform</span>
          </h1>

          <p style={{
            fontSize: 17, lineHeight: 1.65, color: 'rgba(232,240,254,0.65)',
            maxWidth: 600, marginBottom: 32,
          }}>
            Share data and drive value without sacrificing security, privacy, or control.
            Persistent protection that travels with your data — beyond the perimeter,
            across organizations, at every classification tier. Policy-bound. Auditable. Always on.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/tdf-explorer')}
              style={{
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', background: '#1a4a8a', color: '#e8f0fe',
                border: '1px solid rgba(106,170,228,0.4)',
                boxShadow: '0 0 20px rgba(106,170,228,0.15)',
                transition: 'all 0.15s',
              }}
            >
              Start Demo →
            </button>
            <button
              onClick={() => navigate('/architecture')}
              style={{
                padding: '12px 24px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', background: 'transparent', color: 'rgba(232,240,254,0.7)',
                border: '1px solid rgba(106,170,228,0.2)',
                transition: 'all 0.15s',
              }}
            >
              View Architecture
            </button>
          </div>
        </div>

        {/* Proof points */}
        <div style={{
          display: 'flex', gap: 32, marginTop: 48,
          paddingTop: 32, borderTop: '1px solid rgba(106,170,228,0.1)',
          flexWrap: 'wrap',
        }}>
          {PROOF_POINTS.map(p => (
            <div key={p.label}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#6aaae4', lineHeight: 1 }}>{p.value}</div>
              <div style={{ fontSize: 11, color: '#6aaae4', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '40px 48px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 48 }}>

        {/* ── Platform Capabilities ─────────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6aaae4', marginBottom: 28 }}>
            Platform Capabilities
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {CAPABILITY_GROUPS.map(group => (
              <div key={group.label}>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em',
                  color: '#6aaae4', marginBottom: 14,
                  paddingBottom: 8, borderBottom: '1px solid rgba(106,170,228,0.12)',
                }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {group.cards.map(card => (
                    <div key={card.title} style={{
                      padding: '20px 22px', borderRadius: 12,
                      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                      display: 'flex', flexDirection: 'column', gap: 12,
                    }}>
                      {/* Icon + title row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: card.color + '18', border: `1px solid ${card.color}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                        }}>
                          {card.icon}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', lineHeight: 1.3 }}>
                          {card.title}
                        </div>
                      </div>
                      {/* Body */}
                      <div style={{ fontSize: 12, color: 'var(--c-text-5)', lineHeight: 1.65 }}>
                        {card.body}
                      </div>
                      {/* Tagline */}
                      <div style={{
                        fontSize: 11, fontStyle: 'italic', fontWeight: 600,
                        color: card.color, opacity: 0.85, lineHeight: 1.4,
                        paddingTop: 4, borderTop: `1px solid ${card.color}18`,
                      }}>
                        {card.tagline}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Demo cards ────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6aaae4', marginBottom: 20 }}>
            Interactive Demos
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {DEMO_CARDS.map(card => (
              <button
                key={card.to}
                onClick={() => navigate(card.to)}
                style={{
                  textAlign: 'left', padding: '20px 20px', borderRadius: 12,
                  background: 'var(--c-surface)', border: `1px solid var(--c-border)`,
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', gap: 10,
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = card.accent + '60'
                  e.currentTarget.style.background = card.accent + '08'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--c-border)'
                  e.currentTarget.style.background = 'var(--c-surface)'
                }}
              >
                {/* accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: card.accent, opacity: 0.5 }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: card.accent + '18', border: `1px solid ${card.accent}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {card.icon}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 4 }}>{card.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-5)', lineHeight: 1.5 }}>{card.desc}</div>
                </div>

                <div style={{ fontSize: 12, color: card.accent, fontWeight: 600, marginTop: 'auto' }}>
                  Open →
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── How it works strip ────────────────────────────────── */}
        <div style={{
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          borderRadius: 14, padding: '28px 32px',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6aaae4', marginBottom: 20 }}>
            How It Works
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {[
              { n: '1', title: 'Encrypt', body: 'File is encrypted with AES-256-GCM. The key is wrapped with the KAS public key and stored in the TDF manifest.' },
              { n: '2', title: 'Policy Bound', body: 'Attribute requirements are encoded into the TDF policy — e.g. clearance:secret + relto:fvey. These never change after encrypt.' },
              { n: '3', title: 'KAS Decides', body: 'On every open, KAS checks the user\'s live token against the policy. No cached decisions. No grace period.' },
              { n: '4', title: 'Access Granted or Denied', body: 'If attributes match, KAS unwraps the key and the file opens. If not — or if revoked — it stays ciphertext.' },
            ].map((step, i, arr) => (
              <div key={step.n} style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                <div style={{ flex: 1, paddingRight: 16 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'rgba(106,170,228,0.12)', border: '1px solid rgba(106,170,228,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 800, color: '#6aaae4',
                    marginBottom: 10,
                  }}>{step.n}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 5 }}>{step.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-5)', lineHeight: 1.6 }}>{step.body}</div>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ paddingTop: 10, color: 'rgba(106,170,228,0.25)', fontSize: 18, flexShrink: 0, paddingRight: 16 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>


      </div>
    </div>
  )
}
