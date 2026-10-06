import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PERSONAS, PERSONA_BY_ID, DOCUMENTS, FOLDERS, CUSTODIANS, COMPROMISED_ID, UNITS } from './data.js'
import { markingOf, nationalEquivalent } from './marking.js'
import {
  encryptVault, listFor, probe, auditMatrix,
  inspectCopy, openWithoutIdentity, openWithCredential, revoke, restore,
} from './vault.js'

const DEFAULT_PERSONA = 'gcap-marco'
const COMPROMISED = PERSONA_BY_ID[COMPROMISED_ID]

// Who sits where in the story. Presentation only: the personas and their attributes are in data.js.
const CAST = [
  { label: 'Programme',           ids: ['gcap-harriet', 'gcap-marco', 'gcap-sanjay'] },
  { label: 'Partners',            ids: ['gcap-priya', 'gcap-oliver', 'gcap-giulia', 'gcap-kenji'] },
  { label: 'Supply chain',        ids: ['gcap-wren', 'gcap-owen'] },
  { label: 'Outside the programme', ids: ['gcap-ryan'] },
]
const SHORT_EMPLOYER = { 'Mitsubishi Heavy Industries': 'MHI' }

const nowStamp = () => new Date().toLocaleTimeString([], { hour12: false })

// The page carries its own night palette by overriding the shared tokens, so Card, Button and Verdict
// pick it up without the rest of the app changing. No web fonts: the demo must work offline.
const THEME = {
  '--c-surface': '#1F2F3D', '--c-surface-2': '#16222D', '--c-border': '#36495A', '--c-border-2': '#4A6072',
  '--c-text-1': '#E6EDF2', '--c-text-2': '#D3DEE6', '--c-text-3': '#B5C4CF', '--c-text-4': '#9DB0BF',
  '--c-text-5': '#8DA0B0', '--c-text-6': '#5E7384',
  '--c-info-bg': '#2A3E4F', '--c-purple-bg': '#3A3358',
  '--c-grant': '#7FD4A6', '--c-grant-bg': 'rgba(127,212,166,0.10)', '--c-grant-br': 'rgba(127,212,166,0.35)',
  '--c-deny': '#FF8A7E', '--c-deny-bg': 'rgba(255,107,94,0.10)', '--c-deny-br': 'rgba(255,107,94,0.4)',
  '--c-shadow-sm': 'none', '--c-shadow-lg': '0 12px 40px rgba(0,0,0,0.5)',
}
const SKY = '#7FC2E8'
const RED = '#FF6B5E'
const PAPER = '#F2F4F4'
const INK = '#1B2731'
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"

function Shell({ children }) {
  return (
    <div style={{ ...THEME, position: 'absolute', inset: 0, overflowY: 'auto', background: '#16222D', color: 'var(--c-text-2)' }}>
      {children}
    </div>
  )
}

const initialsOf = (persona) => persona.name.split(' ').map(w => w[0]).join('')

// ── Small pieces ─────────────────────────────────────────────────────────────

function Avatar({ persona, size = 30, dim }) {
  const initials = initialsOf(persona)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: persona.color, color: '#fff', fontSize: size * 0.38, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.4 : 1,
    }}>{initials}</div>
  )
}

function Card({ title, right, children, style, accent }) {
  return (
    <section style={{
      background: 'var(--c-surface)', border: `1px solid ${accent ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
      borderLeft: accent ? `3px solid ${RED}` : undefined,
      borderRadius: 'var(--c-radius-card)', boxShadow: 'var(--c-shadow-sm)', ...style,
    }}>
      {title && (
        <header style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '13px 14px 2px',
          fontSize: 14, fontWeight: 650, color: 'var(--c-text-1)', flexShrink: 0,
        }}>
          <span>{title}</span>{right}
        </header>
      )}
      {children}
    </section>
  )
}

function Button({ children, onClick, disabled, tone = 'neutral', style }) {
  const tones = {
    neutral: { bg: 'var(--c-surface)', fg: 'var(--c-text-2)', br: 'var(--c-border)' },
    danger:  { bg: 'var(--c-deny-bg)', fg: 'var(--c-deny)', br: 'var(--c-deny-br)' },
    go:      { bg: 'var(--c-grant-bg)', fg: 'var(--c-grant)', br: 'var(--c-grant-br)' },
    primary: { bg: SKY, fg: INK, br: SKY },
  }[tone]
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 12px', borderRadius: 'var(--c-radius-btn)', fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.br}`, ...style,
    }}>{children}</button>
  )
}

function Verdict({ granted, children }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.45,
      background: granted ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
      border: `1px solid ${granted ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
      color: granted ? 'var(--c-grant)' : 'var(--c-deny)',
    }}>{children}</div>
  )
}

function Banner({ marking, position }) {
  return (
    <div style={{
      background: marking.tone, color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 11.5,
      fontWeight: 700, letterSpacing: '0.12em', fontFamily: MONO,
      borderRadius: position === 'top' ? '6px 6px 0 0' : '0 0 6px 6px',
    }}>{marking.banner}</div>
  )
}

// Where the key came from: one line per decision, from the person to the custodian that answered.
// Rows are real decisions (the open just made, the last refusal); nothing is drawn for a request that was not made.
const ROUTE_ORDER = ['gigo', 'gbr', 'ita', 'jpn', 'nato', 'ace']
const ROUTE_LABEL = { gigo: 'GIGO joint', gbr: 'UK', ita: 'Italy', jpn: 'Japan', nato: 'NATO', ace: 'ACE ops' }

const ROUTE_CSS = `
  @keyframes gcap-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
  @keyframes gcap-pop  { from { opacity: 0; transform: scale(.6) } to { opacity: 1; transform: none } }
  .gcap-draw { stroke-dasharray: 1; animation: gcap-draw .55s ease-out both; }
  .gcap-fade { animation: gcap-pop .3s ease-out .2s both; transform-box: fill-box; transform-origin: center; }
  .gcap-pop  { animation: gcap-pop .25s ease-out .45s both; transform-box: fill-box; transform-origin: center; }
  @media (prefers-reduced-motion: reduce) { .gcap-draw, .gcap-fade, .gcap-pop { animation: none; } }
`

function RoutePanel({ rows }) {
  const W = 600, X0 = 118, STEP = 86, TOP = 54, ROW = 96
  const H = TOP + Math.max(rows.length, 1) * ROW - 24
  const xOf = (c) => X0 + ROUTE_ORDER.indexOf(c) * STEP
  return (
    <Card title="Where the key came from">
      <style>{ROUTE_CSS}</style>
      <div style={{ padding: '4px 16px 12px' }}>
        <div style={{ fontSize: 13, color: 'var(--c-text-4)' }}>
          Each open is a request to the custodian that holds the key. This is the live answer, not a label.
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: '18px 0 10px', fontSize: 13, color: 'var(--c-text-5)' }}>Open an item and the custodian that answered appears here.</div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} role="img" style={{ width: '100%', height: 'auto', display: 'block', marginTop: 8 }}
            aria-label={rows.map(r => `${r.actor.initials}: ${r.granted ? 'released' : 'refused'} by ${CUSTODIANS[r.custodian].label} for ${r.title}`).join('. ')}>
            {ROUTE_ORDER.map(c => (
              <g key={c}>
                <text x={xOf(c)} y="16" fontSize="13" fill="#9DB0BF" textAnchor="middle">{ROUTE_LABEL[c]}</text>
                <line x1={xOf(c)} y1="28" x2={xOf(c)} y2={H} stroke="#36495A" strokeWidth="1.5" strokeDasharray="2 5" />
              </g>
            ))}
            {rows.map((r, i) => {
              const y = TOP + i * ROW
              const tx = xOf(r.custodian)
              const tone = r.granted ? SKY : RED
              return (
                <g key={`${i}-${r.custodian}-${r.title}-${r.granted}`}>
                  {r.granted
                    ? <line className="gcap-draw" pathLength="1" x1="52" y1={y} x2={tx - 18} y2={y} stroke={tone} strokeWidth="4" strokeLinecap="round" />
                    : <>
                        <line className="gcap-fade" x1="52" y1={y} x2={tx - 34} y2={y} stroke={tone} strokeWidth="4" strokeDasharray="8 6" />
                        <line className="gcap-pop" x1={tx - 27} y1={y - 12} x2={tx - 27} y2={y + 12} stroke={tone} strokeWidth="5" strokeLinecap="round" />
                      </>}
                  <circle cx="34" cy={y} r="17" fill={r.actor.color} />
                  <text x="34" y={y + 4.5} fontSize="13" fontWeight="700" fill="#fff" textAnchor="middle">{r.actor.initials}</text>
                  {ROUTE_ORDER.filter(c => xOf(c) < tx && (r.granted || xOf(c) < tx - 34)).map(c => <circle key={c} cx={xOf(c)} cy={y} r="6" fill="#1F2F3D" stroke="#4A6072" strokeWidth="2" />)}
                  {r.granted
                    ? <g className="gcap-pop">
                        <circle cx={tx} cy={y} r="18" fill={tone} />
                        <path d={`M${tx - 8} ${y}l6 6 11-12`} stroke="#16222D" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </g>
                    : <g className="gcap-pop">
                        <circle cx={tx} cy={y} r="18" fill="#16222D" stroke={tone} strokeWidth="3" />
                        <path d={`M${tx - 6} ${y - 6}l12 12M${tx + 6} ${y - 6}l-12 12`} stroke={tone} strokeWidth="3" strokeLinecap="round" />
                      </g>}
                  <text x="16" y={y + 46} fontSize="17" fontWeight="700" fill={tone}>
                    {r.granted ? 'Released' : 'Refused'}
                  </text>
                  <text x="16" y={y + 66} fontSize="13.5" fill="#B5C4CF">
                    {CUSTODIANS[r.custodian].label} · {r.title}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </Card>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GcapPage() {
  const [aiReady, setAiReady] = useState(!window.electronAPI?.getAiStatus)
  const [aiError, setAiError] = useState(null)
  const [vault, setVault] = useState(null)
  const [progress, setProgress] = useState(null)

  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA)
  const [listing, setListing] = useState(null)   // results for the active persona, null while resolving
  const [selectedId, setSelectedId] = useState(null)
  const [epoch, setEpoch] = useState(0)          // bumped by revoke / restore / reset to invalidate listings
  const [revoked, setRevoked] = useState(false)

  const [log, setLog] = useState([])
  const [probeText, setProbeText] = useState('')
  const [probeResult, setProbeResult] = useState(null)
  const [refusal, setRefusal] = useState(null)    // the last refused request, drawn on the key route

  const [stolen, setStolen] = useState([])
  const [stolenIdx, setStolenIdx] = useState(0)
  const [stolenInfo, setStolenInfo] = useState(null)
  const [deviceResult, setDeviceResult] = useState(null)

  const [auditOpen, setAuditOpen] = useState(false)
  const [matrix, setMatrix] = useState(null)
  const [matrixBusy, setMatrixBusy] = useState(false)

  const cache = useRef(new Map())
  const persona = PERSONA_BY_ID[personaId]

  const addLog = useCallback((entry) => {
    setLog(l => [{ t: nowStamp(), ...entry }, ...l].slice(0, 60))
  }, [])

  // Wait for the AI seeder: GCAP identities are written by it, and a listing taken earlier would
  // show every persona an empty tree and read as a bug in the KAS.
  useEffect(() => {
    const api = window.electronAPI
    if (!api?.getAiStatus) return
    const handle = (s) => {
      if (s === 'ready') setAiReady(true)
      else if (s && s.state === 'error') setAiError(s.message)
    }
    const off = api.onAiStatus?.(handle)
    api.getAiStatus().then(handle).catch(() => {})
    return off
  }, [])

  // Encrypt the vault once per app session.
  useEffect(() => {
    if (!aiReady || vault) return
    let live = true
    encryptVault(p => live && setProgress(p))
      .then(v => { if (live) setVault(v) })
      .catch(e => live && setAiError(e.message))
    return () => { live = false }
  }, [aiReady, vault])

  // Resolve the active persona's workspace: one rewrap per document.
  useEffect(() => {
    if (!vault) return
    let live = true
    const key = `${personaId}:${epoch}`
    const hit = cache.current.get(key)
    if (hit) { setListing(hit); return }
    setListing(null)
    listFor(vault, personaId).then(results => {
      if (!live) return
      cache.current.set(key, results)
      setListing(results)
      const n = results.filter(r => r.granted).length
      addLog({ persona: PERSONA_BY_ID[personaId].name, action: 'Workspace resolved', detail: `${n} object${n === 1 ? '' : 's'} released`, ok: true })
    })
    return () => { live = false }
  }, [vault, personaId, epoch, addLog])

  // Keep the selection valid for whoever is looking.
  useEffect(() => {
    if (!listing) return
    const visible = listing.filter(r => r.granted)
    if (!visible.some(r => r.doc.id === selectedId)) setSelectedId(visible[0]?.doc.id ?? null)
  }, [listing, selectedId])

  // Presenter-only auditor view: a shortcut, not a control, so no persona's screen offers it.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setAuditOpen(o => !o)
      }
      if (e.key === 'Escape') setAuditOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!auditOpen || !vault) return
    let live = true
    setMatrixBusy(true)
    setMatrix({})
    auditMatrix(vault, (id, row) => live && setMatrix(m => ({ ...m, [id]: row })))
      .finally(() => live && setMatrixBusy(false))
    return () => { live = false }
  }, [auditOpen, vault, epoch])

  const visible = useMemo(() => (listing ?? []).filter(r => r.granted), [listing])
  const selected = visible.find(r => r.doc.id === selectedId) ?? null
  const marking = useMemo(() => (selected ? markingOf(selected.entry.unit.policy) : null), [selected])

  const byFolder = useMemo(() => FOLDERS
    .map(f => ({ folder: f, items: visible.filter(r => r.doc.folder === f) }))
    .filter(g => g.items.length), [visible])

  // ── Actions ────────────────────────────────────────────────────────────────

  const choosePersona = (id) => {
    setPersonaId(id)
    setProbeResult(null)
    setRefusal(null)
  }

  const onOpen = (r) => {
    setSelectedId(r.doc.id)
    addLog({
      persona: persona.name, action: 'Open', ok: true,
      detail: `${r.doc.title}${r.tier ? ` (${r.tier.label})` : ''} · key released by ${CUSTODIANS[r.doc.custodian].label}`,
    })
  }

  const runProbe = async () => {
    if (!vault || !probeText.trim()) return
    const res = await probe(vault, probeText, personaId)
    setProbeResult(res)
    if (res.found && !res.granted) setRefusal({ actor: { initials: initialsOf(persona), color: persona.color }, custodian: res.doc.custodian, granted: false, title: res.doc.title })
    if (!res.found) addLog({ persona: persona.name, action: 'Probe', ok: false, detail: `${probeText.trim()} · nothing at this address` })
    else addLog({
      persona: persona.name, action: 'Probe', ok: res.granted,
      detail: res.granted
        ? `${res.doc.title} · key released by ${CUSTODIANS[res.doc.custodian].label}`
        : `${probeText.trim()} · refused by ${CUSTODIANS[res.doc.custodian].label}`,
    })
  }

  const exfiltrate = async () => {
    const results = await listFor(vault, COMPROMISED_ID)
    const taken = results.filter(r => r.granted && r.doc.id !== 'overview')
    const files = taken.length ? taken : results.filter(r => r.granted)
    setStolen(files)
    setStolenIdx(0)
    setDeviceResult(null)
    setStolenInfo(files[0] ? await inspectCopy(files[0].entry) : null)
    addLog({
      persona: COMPROMISED.name, action: 'Copied to unmanaged device', ok: true,
      detail: `${files.length} file${files.length === 1 ? ' leaves' : 's leave'} the environment as ciphertext`,
    })
  }

  const pickStolen = async (i) => {
    setStolenIdx(i)
    setDeviceResult(null)
    setStolenInfo(await inspectCopy(stolen[i].entry))
  }

  const runDevice = async (mode) => {
    const file = stolen[stolenIdx]
    if (!file) return
    const r = mode === 'anonymous'
      ? await openWithoutIdentity(file.entry)
      : await openWithCredential(file.entry, COMPROMISED_ID)
    setDeviceResult({ mode, ...r })
    if (!r.granted) {
      setRefusal({
        actor: mode === 'anonymous' ? { initials: '?', color: '#64748b' } : { initials: initialsOf(COMPROMISED), color: COMPROMISED.color },
        custodian: file.doc.custodian, granted: false, title: file.doc.title,
      })
    }
    addLog({
      persona: mode === 'anonymous' ? 'Unmanaged device' : `${COMPROMISED.name} (credential in use)`,
      action: mode === 'anonymous' ? 'Open without identity' : 'Open with stolen credential',
      ok: r.granted, detail: `${file.doc.title} · ${r.granted ? 'KAS released the key' : 'KAS refused'}`,
    })
  }

  const doRevoke = async () => {
    await revoke(COMPROMISED_ID)
    setRevoked(true)
    setEpoch(e => e + 1)
    setDeviceResult(null)
    addLog({ persona: 'Programme security', action: 'Revoke', ok: false, detail: `${COMPROMISED.name}'s account withdrawn at the IdP` })
  }

  const doRestore = async () => {
    await restore(COMPROMISED_ID)
    setRevoked(false)
    setEpoch(e => e + 1)
    setDeviceResult(null)
  }

  const reset = async () => {
    await restore('*')
    cache.current.clear()
    setRevoked(false)
    setEpoch(e => e + 1)
    setPersonaId(DEFAULT_PERSONA)
    setSelectedId(null)
    setStolen([]); setStolenInfo(null); setDeviceResult(null)
    setProbeText(''); setProbeResult(null); setRefusal(null)
    setLog([])
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (aiError) {
    return <Shell><div style={{ padding: 32 }}><Verdict granted={false}>GCAP could not start: {aiError}</Verdict></div></Shell>
  }

  if (!vault) {
    return (
      <Shell><div style={{ padding: 48, maxWidth: 520, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--c-text-1)' }}>Advanced Collaborative Environment</div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--c-text-4)' }}>
          {!aiReady ? 'Waiting for the platform to finish seeding programme identities…'
            : progress ? `Encrypting ${progress.label} (${progress.done + 1} of ${progress.total})…` : 'Preparing the vault…'}
        </div>
        {progress && (
          <div style={{ marginTop: 14, height: 6, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: '100%', background: SKY, transition: 'width .2s' }} />
          </div>
        )}
      </div></Shell>
    )
  }

  const custodian = selected ? CUSTODIANS[selected.doc.custodian] : null
  const yourTerm = marking?.level && marking.programme ? nationalEquivalent(marking.level, persona.nation.toLowerCase()) : null

  const routeRows = [
    ...(selected ? [{
      actor: { initials: initialsOf(persona), color: persona.color }, custodian: selected.doc.custodian, granted: true,
      title: `${selected.doc.title}${selected.tier ? ` (${selected.tier.label})` : ''}`,
    }] : []),
    ...(refusal ? [refusal] : []),
  ]
  const titleBlock = selected && marking ? [
    ['Key released by', custodian.label],
    yourTerm && ['In your system', yourTerm],
    marking.equivalents && ['Equivalents', Object.entries(marking.equivalents).map(([n, t]) => `${n.toUpperCase()} ${t}`).join(' · ')],
    marking.caveats.length > 0 && ['Caveats', marking.caveats.join(' · ')],
  ].filter(Boolean) : []

  return (
    <Shell>
    <div style={{ padding: '20px 24px 40px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--c-text-1)' }}>One workspace, three nations</h1>
          <div style={{ fontSize: 14, color: 'var(--c-text-4)', marginTop: 4, maxWidth: '70ch' }}>
            The UK, Italy and Japan work in one environment with the programme office, the Edgewing design authority and three industry partners. Everyone sees only what their attributes release.
          </div>
        </div>
        <Button onClick={reset}>Reset demo</Button>
      </div>

      {/* Who is looking */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', padding: '14px 18px', marginBottom: 20,
        background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderLeft: `4px solid ${persona.color}`,
        borderRadius: 'var(--c-radius-card)',
      }}>
        <Avatar persona={persona} size={46} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text-1)' }}>{persona.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--c-text-5)' }}>{persona.title} · {persona.employer} · {persona.nation}</div>
        </div>
        <div style={{ flex: '1 1 320px', paddingLeft: 18, borderLeft: '1px solid var(--c-border)', fontSize: 15, lineHeight: 1.5, color: 'var(--c-text-2)' }}>
          {persona.note}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 220px) minmax(250px, 300px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* Cast */}
        <div role="group" aria-label="Viewing as" style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {CAST.map(g => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div style={{ padding: '0 10px 4px', fontSize: 12, fontWeight: 600, color: 'var(--c-text-5)' }}>{g.label}</div>
              {g.ids.map(id => {
                const p = PERSONA_BY_ID[id]
                const active = p.id === personaId
                const gone = revoked && p.id === COMPROMISED_ID
                const flag = p.id === COMPROMISED_ID ? (gone ? 'revoked' : 'account at risk') : p.id === 'gcap-ryan' ? 'outsider' : null
                return (
                  <button key={p.id} aria-current={active} onClick={() => choosePersona(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
                    background: active ? 'var(--c-info-bg)' : 'transparent', border: 'none', textAlign: 'left', width: '100%',
                  }}>
                    <Avatar persona={p} size={34} dim={gone} />
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: active ? 'var(--c-text-1)' : 'var(--c-text-3)', textDecoration: gone ? 'line-through' : 'none' }}>{p.name}</span>
                      <span title={`${p.employer} · ${p.nation}`} style={{ fontSize: 11.5, color: 'var(--c-text-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {SHORT_EMPLOYER[p.employer] ?? p.employer} · {p.nation}
                      </span>
                      {flag && (
                        <span style={{
                          alignSelf: 'flex-start', marginTop: 3, fontSize: 10.5, fontWeight: 600, padding: '0 6px', borderRadius: 4,
                          color: p.id === COMPROMISED_ID ? 'var(--c-deny)' : 'var(--c-text-4)',
                          background: p.id === COMPROMISED_ID ? 'var(--c-deny-bg)' : 'var(--c-surface)',
                          border: `1px solid ${p.id === COMPROMISED_ID ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
                        }}>{flag}</span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Tree */}
        <Card
          title="Workspace"
          style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 110px)', display: 'flex', flexDirection: 'column' }}
          right={<span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--c-text-4)' }}>
            {listing ? `${visible.length} item${visible.length === 1 ? '' : 's'} you can see` : 'resolving…'}
          </span>}
        >
          <div style={{ padding: 8, minHeight: 120, overflowY: 'auto', flex: 1 }}>
            {!listing && <div style={{ padding: 12, fontSize: 12.5, color: 'var(--c-text-5)' }}>Asking the key server what you may open…</div>}
            {listing && visible.length === 0 && (
              <div style={{ padding: 12, fontSize: 12.5, color: 'var(--c-text-5)' }}>Nothing has been released to this account.</div>
            )}
            {byFolder.map(g => (
              <div key={g.folder} style={{ marginBottom: 8 }}>
                <div style={{ padding: '4px 8px', fontSize: 12, fontWeight: 600, color: 'var(--c-text-5)' }}>{g.folder}</div>
                {g.items.map(r => {
                  const on = r.doc.id === selectedId
                  const m = markingOf(r.entry.unit.policy)
                  return (
                    <button key={r.doc.id} onClick={() => onOpen(r)} aria-current={on} style={{
                      display: 'flex', alignItems: 'stretch', gap: 9, width: '100%', textAlign: 'left', padding: '3px 8px 3px 4px', borderRadius: 7, cursor: 'pointer',
                      background: on ? 'var(--c-info-bg)' : 'transparent', border: 'none', fontSize: 13, color: 'var(--c-text-2)',
                    }}>
                      <span aria-hidden style={{ width: 5, borderRadius: 3, background: m.tone, flexShrink: 0 }} />
                      <span style={{ flex: 1, padding: '4px 0', lineHeight: 1.3 }}>
                        {r.doc.title}
                        {r.tier && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'var(--c-purple-bg)', color: '#CDB8FF' }}>{r.tier.label}</span>
                        )}
                      </span>
                      <span style={{ alignSelf: 'center', fontSize: 10, fontWeight: 700, color: 'var(--c-text-5)', whiteSpace: 'nowrap' }}>
                        {m.banner.split(' // ')[0].replace('GCAP ', '')}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </Card>

        {/* Route + viewer + probe + log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <RoutePanel rows={routeRows} />

          <div style={{ background: PAPER, color: INK, borderRadius: 8, overflow: 'hidden', boxShadow: 'var(--c-shadow-lg)' }}>
            {selected && marking ? (
              <>
                <Banner marking={marking} position="top" />
                <div style={{ padding: '20px 26px 22px' }}>
                  <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.005em' }}>
                    {selected.doc.title}{selected.tier ? ` — ${selected.tier.label}` : ''}
                  </div>
                  <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1px', background: '#C9D1D6', border: '1px solid #C9D1D6' }}>
                    {titleBlock.map(([k, v]) => (
                      <div key={k} style={{ background: PAPER, padding: '7px 10px' }}>
                        <dt style={{ fontSize: 12, color: '#475663' }}>{k}</dt>
                        <dd style={{ margin: '1px 0 0', fontSize: 14, fontWeight: 600 }}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div style={{ marginTop: 16, fontFamily: SERIF, fontSize: 15.5, lineHeight: 1.65, maxWidth: '68ch' }}>
                    {selected.text.split(/\n{2,}/).map((para, i) => <p key={i} style={{ margin: i ? '12px 0 0' : 0, whiteSpace: 'pre-wrap' }}>{para}</p>)}
                  </div>
                </div>
                <Banner marking={marking} position="bottom" />
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#52636F' }}>
                {listing ? 'Select an item to open it.' : 'Resolving workspace…'}
              </div>
            )}
          </div>

          <Card title="Open by address">
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--c-text-4)', marginBottom: 8 }}>
                Paste the address from a forwarded link. The request goes to the key server as {persona.name}, not through this list.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={probeText} onChange={e => setProbeText(e.target.value)} onKeyDown={e => e.key === 'Enter' && runProbe()}
                  placeholder="ace://obj/…"
                  style={{ flex: 1, padding: '7px 10px', fontSize: 12.5, fontFamily: 'monospace', borderRadius: 8, border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-1)' }}
                />
                <Button tone="primary" onClick={runProbe}>Open</Button>
              </div>
              {probeResult && (
                <div style={{ marginTop: 10 }}>
                  {!probeResult.found
                    ? <Verdict granted={false}>Nothing at this address.</Verdict>
                    : probeResult.granted
                      ? <Verdict granted>Released. {CUSTODIANS[probeResult.doc.custodian].label} released the key for “{probeResult.doc.title}”; it is also in your workspace.</Verdict>
                      : <Verdict granted={false}>Refused by {CUSTODIANS[probeResult.doc.custodian].label}. {probeResult.reason}</Verdict>}
                </div>
              )}
            </div>
          </Card>

          <Card title="If it is taken" accent>
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: 'var(--c-text-4)' }}>
                <b style={{ color: 'var(--c-text-2)' }}>{COMPROMISED.name}</b> ({COMPROMISED.employer}) has an ordinary account, and someone else now holds its credential.
                {' '}They copy what it can see to a machine the programme does not manage.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button onClick={exfiltrate} disabled={revoked}>Copy files to an unmanaged device</Button>
                {!revoked
                  ? <Button tone="danger" onClick={doRevoke}>Programme security: revoke {COMPROMISED.name.split(' ')[0]}</Button>
                  : <Button tone="go" onClick={doRestore}>Restore {COMPROMISED.name.split(' ')[0]}</Button>}
              </div>

              {stolen.length > 0 && (
                <div style={{ border: '1px dashed var(--c-border-2)', borderRadius: 10, padding: 12, background: 'var(--c-surface-2)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--c-text-3)', marginBottom: 8 }}>Unmanaged device</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {stolen.map((f, i) => (
                      <button key={f.doc.id} onClick={() => pickStolen(i)} style={{
                        padding: '4px 8px', fontSize: 11.5, borderRadius: 6, cursor: 'pointer',
                        border: `1px solid ${i === stolenIdx ? SKY : 'var(--c-border)'}`,
                        background: i === stolenIdx ? 'var(--c-info-bg)' : 'var(--c-surface)', color: 'var(--c-text-2)',
                      }}>{f.doc.title}</button>
                    ))}
                  </div>
                  {stolenInfo && (
                    <div style={{ fontSize: 11.5, color: 'var(--c-text-4)', marginBottom: 8, fontFamily: 'monospace', wordBreak: 'break-word' }}>
                      {stolenInfo.ok
                        ? <>readable without an identity: policy {stolenInfo.attributes.map(a => a.split('/attr/')[1]?.replace('/value/', ':') ?? a).join(', ') || '(none)'} — payload is ciphertext</>
                        : `could not parse: ${stolenInfo.error}`}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button onClick={() => runDevice('anonymous')}>Open without identity</Button>
                    <Button onClick={() => runDevice('credential')}>Open with stolen credential</Button>
                  </div>
                  {deviceResult && (
                    <div style={{ marginTop: 10 }}>
                      {deviceResult.granted
                        ? <Verdict granted>The key server released the key — the credential is still live. First lines: “{deviceResult.text.split('\n')[0]}”</Verdict>
                        : <Verdict granted={false}>
                            Refused. {deviceResult.reason}
                            {deviceResult.mode === 'credential' && ' The key was never on this device; it lives behind the key server, and the key server now says no.'}
                          </Verdict>}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card title="ACE audit log">
            <div style={{ maxHeight: 220, overflowY: 'auto', fontSize: 12 }}>
              {log.length === 0 && <div style={{ padding: 14, color: 'var(--c-text-5)' }}>No activity yet.</div>}
              {log.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 14px', borderTop: i ? '1px solid var(--c-border)' : 'none' }}>
                  <span style={{ fontFamily: MONO, color: 'var(--c-text-5)' }}>{e.t}</span>
                  <span style={{ width: 8, height: 8, marginTop: 5, borderRadius: '50%', flexShrink: 0, background: e.ok ? 'var(--c-grant)' : 'var(--c-deny)' }} />
                  <span><b style={{ color: 'var(--c-text-1)' }}>{e.persona}</b> · {e.action} · <span style={{ color: 'var(--c-text-4)' }}>{e.detail}</span></span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {auditOpen && <AuditorOverlay matrix={matrix} busy={matrixBusy} onClose={() => setAuditOpen(false)} />}
    </div>
    </Shell>
  )
}

// ── Presenter-only auditor view ──────────────────────────────────────────────

function AuditorOverlay({ matrix, busy, onClose }) {
  const totals = (id) => matrix?.[id] ? Object.values(matrix[id]).filter(r => r.granted).length : null
  const ink = { color: INK }
  const line = { height: 2, background: '#B9C3C9', borderRadius: 1 }
  // Redaction reads at a distance: a black bar is a refusal, a half bar is the extract only, faint lines open.
  const cellMark = (cell) => {
    if (!cell) return <span style={{ color: '#8B99A2' }}>…</span>
    if (!cell.granted) return <div title="Refused" style={{ height: 14, background: '#111A22', borderRadius: 1 }} />
    const ext = cell.tier && cell.tier.id !== 'full'
    return (
      <div title={ext ? 'Opens the extract' : 'Opens'} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '1px 0' }}>
        {ext && <div style={{ height: 14, width: '50%', background: '#111A22', borderRadius: 1, marginBottom: -1 }} />}
        <div style={line} /><div style={{ ...line, width: ext ? '50%' : '85%' }} />
      </div>
    )
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(8,14,20,0.72)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...ink, background: PAPER, borderRadius: 8, padding: 20, maxWidth: '96vw', maxHeight: '92vh', overflow: 'auto', boxShadow: 'var(--c-shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 20 }}>
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600 }}>Auditor view: who can open what</div>
            <div style={{ fontSize: 12, color: '#52636F', marginTop: 2 }}>Presenter only. Every cell is a live key-server decision; nothing here is a stored table. {busy ? 'Resolving…' : ''}</div>
          </div>
          <Button onClick={onClose} style={{ background: '#fff', color: INK, borderColor: '#C9D1D6' }}>Close</Button>
        </div>
        <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: '#52636F', marginBottom: 10 }}>
          <span><span style={{ display: 'inline-block', width: 22, height: 10, background: '#111A22', verticalAlign: 'middle', marginRight: 6 }} />refused</span>
          <span><span style={{ display: 'inline-block', width: 11, height: 10, background: '#111A22', verticalAlign: 'middle', marginRight: 6 }} />extract only</span>
          <span><span style={{ display: 'inline-block', width: 22, height: 2, background: '#B9C3C9', verticalAlign: 'middle', marginRight: 6 }} />opens</span>
        </div>
        <table style={{ borderCollapse: 'collapse', fontSize: 11.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 4 }}>Document</th>
              {PERSONAS.map(p => (
                <th key={p.id} style={{ padding: 4, fontWeight: 600, minWidth: 64 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <Avatar persona={p} size={22} />
                    <span>{p.name.split(' ')[0]}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOCUMENTS.map(d => (
              <tr key={d.id} style={{ borderTop: '1px solid #D5DCE0' }}>
                <td style={{ padding: '6px 10px 6px 4px', whiteSpace: 'nowrap' }}>{d.title}</td>
                {PERSONAS.map(p => (
                  <td key={p.id} style={{ padding: '6px 8px', verticalAlign: 'middle' }}>{cellMark(matrix?.[p.id]?.[d.id])}</td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #52636F', fontWeight: 700 }}>
              <td style={{ padding: 4 }}>Visible to them</td>
              {PERSONAS.map(p => <td key={p.id} style={{ textAlign: 'center', padding: 4 }}>{totals(p.id) ?? '…'}</td>)}
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 11, color: '#52636F' }}>{UNITS.length} encrypted objects · {DOCUMENTS.length} documents · Ctrl/Cmd+Shift+A or Esc to close</div>
      </div>
    </div>
  )
}
