import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext.jsx'
import UiIcon from '../components/UiIcon.jsx'

const CAPABILITIES = [
  { to: '/cop',         icon: 'pin',    label: 'Common Operating Picture', desc: 'Each partner sees only what their attributes release' },
  { to: '/gcap',        icon: 'plane',  label: 'GCAP',                     desc: 'Three nations share a supply chain and keep sovereignty', isNew: true },
  { to: '/sable',       icon: 'target', label: 'SABLE',                    desc: 'Three suppliers run a joint simulation, and the result is sealed by what went in', isNew: true },
  { to: '/collaborate', icon: 'people', label: 'Collaborate',              desc: 'Files stay protected after they leave the building' },
  { to: '/ai-agent',    icon: 'shield', label: 'AI Protection',            desc: 'AI on sensitive data, within each person’s clearance', isNew: true },
]

const UNDER_THE_HOOD = [
  { to: '/tdf-explorer', icon: 'fileScan', label: 'TDF Explorer' },
  { to: '/audit',        icon: 'list',     label: 'Audit Log' },
  { to: '/architecture', icon: 'layers',   label: 'Architecture' },
]

const FLOW = [
  { title: 'Encrypt', body: 'The file is encrypted with AES-256-GCM. The key is wrapped with the KAS public key and stored in the TDF manifest.' },
  { title: 'Bind policy', body: 'Attribute requirements, such as clearance:secret and relto:fvey, are written into the TDF policy. They never change after encryption.' },
  { title: 'KAS decides', body: 'On every open, KAS checks the person’s live token against the policy. No cached decisions and no grace period.' },
  { title: 'Grant or deny', body: 'If the attributes match, KAS unwraps the key and the file opens. If they do not, or access was revoked, it stays ciphertext.' },
]

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { platformReady, platformError } = useDemo()
  const hood = platformReady === true
    ? [...UNDER_THE_HOOD, { to: '/platform', icon: 'server', label: 'Platform' }]
    : UNDER_THE_HOOD

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>

      <section style={{ background: 'var(--c-ink)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        {/* The logomark, overblown, as it was before the October redesign. Behind everything, never in the way. */}
        <img
          src="./virtru-logomark.svg"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', top: -70, right: -90, width: 580, height: 580, opacity: 0.12, pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}
        />
        <div className="home-hero">
          <div>
            <img src="./virtru-logomark.svg" alt="Virtru" width={52} height={52} style={{ display: 'block', marginBottom: 22 }} />
            <h2 style={{ margin: 0, fontSize: 34, fontWeight: 720, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#fff' }}>
              Data that enforces its own rules
            </h2>

            <p style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.6, color: 'rgba(214,226,244,0.8)', maxWidth: '52ch' }}>
              The Data Security Platform binds policy to the data and has a key server enforce it wherever the data goes.
              Each demo below is a capability that unlocks for a customer.
            </p>

            {platformReady === false && platformError && (
              <div style={{
                marginTop: 20, padding: '12px 14px', borderRadius: 8, maxWidth: 520,
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)',
              }}>
                <div style={{ fontSize: 13, fontWeight: 650, color: '#fca5a5', marginBottom: 4 }}>The platform failed to start</div>
                <pre style={{ fontSize: 11.5, color: 'rgba(252,165,165,0.85)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
                  {platformError}
                </pre>
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(146,192,233,0.65)' }}>
                  Logs: ~/Library/Logs/virtru-demo-center/main.log
                </div>
              </div>
            )}

            <nav className="hero-list" aria-label="Capabilities">
              {CAPABILITIES.map(d => (
                <button key={d.to} className="hero-row" onClick={() => navigate(d.to)}>
                  <span className="hero-row-icon"><UiIcon name={d.icon} size={18} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14.5, fontWeight: 650 }}>
                      {d.label}
                      {d.isNew && <span className="chip" style={{ height: 18, fontSize: 10.5, background: 'rgba(146,192,233,0.16)', borderColor: 'rgba(146,192,233,0.35)', color: '#bcd9f3' }}>New</span>}
                    </span>
                    <span style={{ display: 'block', marginTop: 1, fontSize: 12.5, color: 'rgba(214,226,244,0.68)' }}>{d.desc}</span>
                  </span>
                  <UiIcon name="arrowRight" size={15} className="hero-row-arrow" />
                </button>
              ))}
            </nav>

            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: 'rgba(214,226,244,0.9)', marginBottom: 8 }}>Under the hood</div>
              <div className="hero-chips">
                {hood.map(d => (
                  <button key={d.to} className="hero-chip" onClick={() => navigate(d.to)}>
                    <UiIcon name={d.icon} size={15} />
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      <div className="home-body">
        <section>
          <h3 className="section-title">How the platform decides each request</h3>
          <ol className="steps">
            {FLOW.map((s, i) => (
              <li key={s.title}>
                <span className="flow-n">{i + 1}</span>
                <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--c-text-1)', marginBottom: 3 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--c-text-4)', lineHeight: 1.55 }}>{s.body}</div>
              </li>
            ))}
          </ol>
        </section>

        <section style={{ borderTop: '1px solid var(--c-border)', paddingTop: 22, maxWidth: '72ch' }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--c-text-3)' }}>
            Policy is bound to the data in an open format (TDF) and enforced by the key server on every open, whatever the capability.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 14, lineHeight: 1.6, color: 'var(--c-text-3)' }}>
            You bring your own policy, identity and keys. The platform never holds yours.
          </p>
        </section>
      </div>
    </div>
  )
}
