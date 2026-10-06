import { useNavigate } from 'react-router-dom'
import { useDemo } from '../context/DemoContext.jsx'
import UiIcon from '../components/UiIcon.jsx'

const CAPABILITIES = [
  { to: '/cop',         icon: 'pin',    label: 'Common Operating Picture', desc: 'Each partner sees only what their attributes release' },
  { to: '/gcap',        icon: 'plane',  label: 'GCAP',                     desc: 'Three nations share a supply chain and keep sovereignty', isNew: true },
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

// ── The briefing ─────────────────────────────────────────────────────────────
// Illustrative only: it evaluates the active persona's attributes in the browser. The live demos
// are where a denial is a real KAS decision, and the caption under the sheet says so.

const RANK = { unclassified: 0, cui: 1, secret: 2, 'ts-sci': 3 }

const BRIEF = [
  { mark: '(U)',        req: {},                                  text: 'Storm track, port closures and public shelter locations are published by the response office.' },
  { mark: '(S)',        req: { clearance: 'secret' },             text: 'Norfolk EOC stages fourteen rotary-wing assets for medical evacuation across the Carolinas.' },
  { mark: '(S//REL FVEY)', req: { clearance: 'secret', relto: 'fvey' }, text: 'Five Eyes partners share maritime surveillance of the approaches to Wilmington.' },
  { mark: '(S//REL NATO)', req: { clearance: 'secret', relto: 'nato' }, text: 'Allied liaison cells receive the coalition logistics plan and the contractor statement of work.' },
  { mark: '(TS//SCI)',  req: { clearance: 'ts-sci', mission: 'intel' }, text: 'Airborne collection over the Groton command centre supports the intelligence summary.' },
]

const BANNERS = [
  { rank: 3, text: 'TOP SECRET//SCI', bg: '#f5a800', fg: '#0a1a33' },
  { rank: 2, text: 'SECRET',          bg: '#c8102e', fg: '#ffffff' },
  { rank: 0, text: 'UNCLASSIFIED',    bg: '#007a33', fg: '#ffffff' },
]

const clearanceRank = (attrs) =>
  Math.max(0, ...attrs.filter(a => a.startsWith('clearance:')).map(a => RANK[a.split(':')[1]] ?? 0))

function canOpen(req, attrs, rank) {
  if (req.clearance && rank < RANK[req.clearance]) return false
  if (req.relto && !attrs.includes(`relto:${req.relto}`)) return false
  if (req.mission && !attrs.includes(`mission:${req.mission}`)) return false
  return true
}

// Redacted passages carry same-length filler, not the real sentence, so the text is never in the DOM.
const filler = (s) => s.replace(/[^\s]/g, 'x')

function Briefing({ persona }) {
  const attrs = persona.attributes
  const rank = clearanceRank(attrs)
  const open = BRIEF.map(l => canOpen(l.req, attrs, rank))
  const banner = BANNERS.find(b => b.rank <= rank) ?? BANNERS[BANNERS.length - 1]
  const openCount = open.filter(Boolean).length

  return (
    <div>
      <div className="brief-sheet">
        <div className="brief-banner" style={{ background: banner.bg, color: banner.fg }}>{banner.text}</div>
        <div style={{ padding: '22px 28px 26px' }}>
          <div style={{ fontSize: 12.5, color: '#5b6b82', marginBottom: 4 }}>Coalition response brief</div>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', color: '#0a1a33', marginBottom: 18 }}>
            Operation COASTAL SURGE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {BRIEF.map((l, i) => (
              <p key={i} className="brief-line">
                <span className="brief-mark">{l.mark}</span>
                {open[i]
                  ? <span key="open" className="brief-open">{l.text}</span>
                  : <span key="shut" className="brief-shut" role="img" aria-label="Redacted passage">{filler(l.text)}</span>}
              </p>
            ))}
          </div>
        </div>
        <div className="brief-banner" style={{ background: banner.bg, color: banner.fg }}>{banner.text}</div>
      </div>

      <p style={{ margin: '14px 0 0', fontSize: 13, color: 'rgba(214,226,244,0.85)' }}>
        {openCount} of {BRIEF.length} passages are open to {persona.id === 'generic' ? 'a generic user' : persona.name}.
      </p>
      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'rgba(146,192,233,0.6)' }}>
        This is an illustration. In the live demos, every denial is a real key-server refusal.
      </p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { platformReady, platformError, activePersona } = useDemo()
  const hood = platformReady === true
    ? [...UNDER_THE_HOOD, { to: '/platform', icon: 'server', label: 'Platform' }]
    : UNDER_THE_HOOD

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>

      <section style={{ background: 'var(--c-ink)', color: '#fff' }}>
        <div className="home-hero">
          <div>
            <h2 style={{ margin: 0, fontSize: 34, fontWeight: 720, lineHeight: 1.1, letterSpacing: '-0.03em', color: '#fff' }}>
              Data that enforces its own rules
            </h2>

            <p style={{ margin: '14px 0 0', fontSize: 15.5, lineHeight: 1.6, color: 'rgba(214,226,244,0.8)', maxWidth: '52ch' }}>
              The Data Security Platform binds policy to the data and has a key server enforce it wherever the data goes.
              Each demo below is a capability that unlocks for a customer. Pick someone in the top bar to see the idea on the sheet.
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

          <Briefing persona={activePersona} />
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
