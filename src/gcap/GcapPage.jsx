import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PERSONA_BY_ID, DOCUMENTS, FOLDERS, CUSTODIANS, COMPROMISED_ID, auditName } from './data.js'
import { markingOf, nationalEquivalent } from './marking.js'
import {
  encryptVault, listFor, probe,
  inspectCopy, openWithoutIdentity, openWithCredential,
} from './vault.js'
import { useWorld } from './world.js'
import {
  Shell, Avatar, Card, Button, Verdict, Banner, initialsOf,
  SKY, RED, PAPER, INK, MONO, SERIF,
} from './ui.jsx'
import ThreeWindows from './ThreeWindows.jsx'
import ProgrammeDay from './ProgrammeDay.jsx'
import { PersonEditor, PolicyEditor } from './Editors.jsx'

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

function Workspace({ vault, world, active, resetKey, onEditPerson }) {
  const { epoch, byId, people, revokedIds } = world
  const [personaId, setPersonaId] = useState(DEFAULT_PERSONA)
  const [selectedId, setSelectedId] = useState(null)

  const [log, setLog] = useState([])
  const [probeText, setProbeText] = useState('')
  const [probeResult, setProbeResult] = useState(null)
  const [refusal, setRefusal] = useState(null)    // the last refused request, drawn on the key route

  const [stolen, setStolen] = useState([])
  const [stolenIdx, setStolenIdx] = useState(0)
  const [stolenInfo, setStolenInfo] = useState(null)
  const [deviceResult, setDeviceResult] = useState(null)

  const [auditOpen, setAuditOpen] = useState(false)

  const persona = byId[personaId] ?? byId[DEFAULT_PERSONA] ?? people[0]
  const revoked = revokedIds.has(COMPROMISED_ID)

  const addLog = useCallback((entry) => {
    setLog(l => [{ t: nowStamp(), ...entry }, ...l].slice(0, 60))
  }, [])

  // The workspace is this person's row of the shared matrix: one rewrap per document, taken once.
  const listing = useMemo(() => {
    const row = world.cells[persona?.id]
    if (!row || !DOCUMENTS.every(d => row[d.id])) return null
    return DOCUMENTS.map(d => row[d.id])
  }, [world.cells, persona?.id])

  const loggedFor = useRef(null)
  useEffect(() => {
    if (!listing || loggedFor.current === persona.id) return
    loggedFor.current = persona.id
    const n = listing.filter(r => r.granted).length
    addLog({ persona: auditName(persona), action: 'Workspace resolved', detail: `${n} object${n === 1 ? '' : 's'} released`, ok: true })
  }, [listing, persona, addLog])

  useEffect(() => {
    if (!byId[personaId] && people.length) setPersonaId(DEFAULT_PERSONA)
  }, [byId, personaId, people.length])

  // Keep the selection valid for whoever is looking.
  useEffect(() => {
    if (!listing) return
    const visible = listing.filter(r => r.granted)
    if (!visible.some(r => r.doc.id === selectedId)) setSelectedId(visible[0]?.doc.id ?? null)
  }, [listing, selectedId])

  // Presenter-only auditor view: a shortcut, not a control, so no persona's screen offers it.
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setAuditOpen(o => !o)
      }
      if (e.key === 'Escape') setAuditOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const firstReset = useRef(resetKey)
  useEffect(() => {
    if (resetKey === firstReset.current) return
    loggedFor.current = null
    setPersonaId(DEFAULT_PERSONA)
    setSelectedId(null)
    setStolen([]); setStolenInfo(null); setDeviceResult(null)
    setProbeText(''); setProbeResult(null); setRefusal(null)
    setLog([])
  }, [resetKey])

  const visible = useMemo(() => (listing ?? []).filter(r => r.granted), [listing])
  const selected = visible.find(r => r.doc.id === selectedId) ?? null
  const marking = useMemo(() => (selected ? markingOf(selected.entry.unit.policy) : null), [selected])

  const byFolder = useMemo(() => FOLDERS
    .map(f => ({ folder: f, items: visible.filter(r => r.doc.folder === f) }))
    .filter(g => g.items.length), [visible])

  const cast = useMemo(() => {
    const groups = CAST.map(g => ({ label: g.label, people: g.ids.map(id => byId[id]).filter(Boolean) }))
    const added = people.filter(p => p.added)
    return added.length ? [...groups, { label: 'Added in free play', people: added }] : groups
  }, [byId, people])

  // ── Actions ────────────────────────────────────────────────────────────────

  const choosePersona = (id) => {
    setPersonaId(id)
    setProbeResult(null)
    setRefusal(null)
  }

  const onOpen = (r) => {
    setSelectedId(r.doc.id)
    addLog({
      persona: auditName(persona), action: 'Open', ok: true,
      detail: `${r.doc.title}${r.tier ? ` (${r.tier.label})` : ''} · key released by ${CUSTODIANS[r.doc.custodian].label}`,
    })
  }

  const runProbe = async () => {
    if (!vault || !probeText.trim()) return
    const res = await probe(vault, probeText, personaId)
    setProbeResult(res)
    if (res.found && !res.granted) setRefusal({ actor: { initials: initialsOf(persona), color: persona.color }, custodian: res.doc.custodian, granted: false, title: res.doc.title })
    if (!res.found) addLog({ persona: auditName(persona), action: 'Probe', ok: false, detail: `${probeText.trim()} · nothing at this address` })
    else addLog({
      persona: auditName(persona), action: 'Probe', ok: res.granted,
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
    await world.revokeAccount(COMPROMISED_ID)
    setDeviceResult(null)
    addLog({ persona: 'Programme security', action: 'Revoke', ok: false, detail: `${COMPROMISED.name}'s account withdrawn at the IdP` })
  }

  const doRestore = async () => {
    await world.restoreAccount(COMPROMISED_ID)
    setDeviceResult(null)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
    <div>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--c-text-1)' }}>One workspace, three nations</h1>
          <div style={{ fontSize: 14, color: 'var(--c-text-4)', marginTop: 4, maxWidth: '70ch' }}>
            The UK, Italy and Japan work in one environment with the programme office, the Edgewing design authority and three industry partners. Everyone sees only what their attributes release.
          </div>
        </div>
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
        {world.live && <Button onClick={() => onEditPerson(persona.id)}>Edit access</Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 220px) minmax(250px, 300px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* Cast */}
        <div role="group" aria-label="Viewing as" style={{ position: 'sticky', top: 16, maxHeight: 'calc(100vh - 110px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cast.map(g => (
            <div key={g.label} role="group" aria-label={g.label}>
              <div style={{ padding: '0 10px 4px', fontSize: 12, fontWeight: 600, color: 'var(--c-text-5)' }}>{g.label}</div>
              {g.people.map(p => {
                const on = p.id === persona.id
                const gone = revokedIds.has(p.id)
                const flag = gone ? 'revoked' : p.id === COMPROMISED_ID ? 'account at risk' : p.id === 'gcap-ryan' ? 'outsider' : p.added ? 'added' : null
                return (
                  <button key={p.id} aria-current={on} onClick={() => choosePersona(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 10, cursor: 'pointer',
                    background: on ? 'var(--c-info-bg)' : 'transparent', border: 'none', textAlign: 'left', width: '100%',
                  }}>
                    <Avatar persona={p} size={34} dim={gone} />
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: on ? 'var(--c-text-1)' : 'var(--c-text-3)', textDecoration: gone ? 'line-through' : 'none' }}>{p.name}</span>
                      <span title={`${p.employer} · ${p.nation}`} style={{ fontSize: 11.5, color: 'var(--c-text-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {SHORT_EMPLOYER[p.employer] ?? p.employer} · {p.nation}
                      </span>
                      {flag && (
                        <span style={{
                          alignSelf: 'flex-start', marginTop: 3, fontSize: 10.5, fontWeight: 600, padding: '0 6px', borderRadius: 4,
                          color: gone || p.id === COMPROMISED_ID ? 'var(--c-deny)' : 'var(--c-text-4)',
                          background: gone || p.id === COMPROMISED_ID ? 'var(--c-deny-bg)' : 'var(--c-surface)',
                          border: `1px solid ${gone || p.id === COMPROMISED_ID ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
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

      {auditOpen && <AuditorOverlay people={people} cells={world.cells} busy={world.syncing} onClose={() => setAuditOpen(false)} />}
    </div>
  )
}

// ── Presenter-only auditor view ──────────────────────────────────────────────

function AuditorOverlay({ people, cells: matrix, busy, onClose }) {
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
              {people.map(p => (
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
                {people.map(p => (
                  <td key={p.id} style={{ padding: '6px 8px', verticalAlign: 'middle' }}>{cellMark(matrix?.[p.id]?.[d.id])}</td>
                ))}
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid #52636F', fontWeight: 700 }}>
              <td style={{ padding: 4 }}>Visible to them</td>
              {people.map(p => <td key={p.id} style={{ textAlign: 'center', padding: 4 }}>{totals(p.id) ?? '…'}</td>)}
            </tr>
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 11, color: '#52636F' }}>{DOCUMENTS.reduce((n, d) => n + (d.tiers?.length ?? 1), 0)} encrypted objects · {DOCUMENTS.length} documents · Ctrl/Cmd+Shift+A or Esc to close</div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'windows', label: 'Three windows' },
  { id: 'day', label: 'A day on the programme' },
]

export default function GcapPage() {
  const [aiReady, setAiReady] = useState(!window.electronAPI?.getAiStatus)
  const [aiError, setAiError] = useState(null)
  const [vault, setVault] = useState(null)
  const [progress, setProgress] = useState(null)
  const [tab, setTab] = useState('workspace')
  const [resetKey, setResetKey] = useState(0)
  const [editor, setEditor] = useState(null)   // { person: id | null } | { doc: id } | null
  const [resetting, setResetting] = useState(false)

  const world = useWorld(vault)

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

  const resetDemo = async () => {
    setResetting(true)
    setEditor(null)
    try {
      await world.resetAll()
      setResetKey(k => k + 1)
    } finally {
      setResetting(false)
    }
  }

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

  const editPerson = (id) => setEditor({ person: id })
  const editorPerson = editor && 'person' in editor && editor.person ? world.byId[editor.person] : null

  return (
    <Shell>
      <div style={{ padding: '20px 24px 40px', maxWidth: 1400, margin: '0 auto' }}>
        <div role="tablist" aria-label="GCAP demo" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--c-border)' }}>
          {TABS.map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} style={{
              padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              color: tab === t.id ? 'var(--c-text-1)' : 'var(--c-text-5)',
              borderBottom: `2px solid ${tab === t.id ? SKY : 'transparent'}`, marginBottom: -1,
            }}>{t.label}</button>
          ))}
          <span style={{ flex: 1 }} />
          {world.syncing && <span style={{ fontSize: 12, color: 'var(--c-text-5)', marginRight: 10 }}>asking the key server…</span>}
          <Button onClick={resetDemo} disabled={resetting} title="Everyone back to their starting access, every document to its original policy">Reset demo</Button>
        </div>

        <div hidden={tab !== 'workspace'}>
          <Workspace vault={vault} world={world} active={tab === 'workspace'} resetKey={resetKey} onEditPerson={editPerson} />
        </div>
        <div hidden={tab !== 'windows'}>
          <ThreeWindows key={resetKey} vault={vault} world={world} active={tab === 'windows'} onEditPerson={editPerson} />
        </div>
        <div hidden={tab !== 'day'}>
          <ProgrammeDay
            key={resetKey} vault={vault} world={world} active={tab === 'day'}
            onEditPerson={editPerson} onAddPerson={() => setEditor({ person: null })} onEditDoc={(doc) => setEditor({ doc })}
          />
        </div>

        {editor && 'person' in editor && (editor.person === null || editorPerson) && (
          <PersonEditor key={editor.person ?? 'new'} world={world} person={editorPerson ?? undefined} onClose={() => setEditor(null)} onDone={() => setEditor(null)} />
        )}
        {editor && 'doc' in editor && (
          <PolicyEditor world={world} vault={vault} docId={editor.doc} onClose={() => setEditor(null)} />
        )}
      </div>
    </Shell>
  )
}
