import { useState, useCallback } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import { AI_PERSONAS, FEDERAL_PERSONAS } from '../data/sectors.js'

// ── Document corpus (same files as CollaboratePage, simplified) ───────────────

const DOCS = [
  { id: 'briefing', name: 'Q3_Threat_Briefing.pdf',        cls: 'TOP SECRET // SCI',     clsShort: 'TS/SCI',  required: ['clearance:ts-sci'],                         color: '#ef4444' },
  { id: 'sigint',   name: 'SIGINT_Collection_Summary.pdf',  cls: 'TOP SECRET // SCI',     clsShort: 'TS/SCI',  required: ['clearance:ts-sci', 'mission:intel'],         color: '#ef4444' },
  { id: 'fvey',     name: 'FVEY_Intel_Exchange.pdf',        cls: 'SECRET // REL TO FVEY', clsShort: 'S//FVEY', required: ['clearance:secret', 'relto:fvey'],             color: '#8b5cf6' },
  { id: 'nato',     name: 'NATO_Joint_Ops_Plan.docx',       cls: 'SECRET // REL TO NATO', clsShort: 'S//NATO', required: ['clearance:secret', 'relto:nato'],             color: '#10b981' },
  { id: 'ucmj',     name: 'UCMJ_Art32_Investigation.docx',  cls: 'SECRET',                clsShort: 'SECRET',  required: ['clearance:secret', 'mission:legal'],          color: '#f59e0b' },
  { id: 'cyber',    name: 'Infra_Security_Audit.xlsx',       cls: 'SECRET',                clsShort: 'SECRET',  required: ['clearance:secret', 'mission:cyber'],          color: '#f59e0b' },
  { id: 'pws',      name: 'Atlas_Contractor_SOW.pdf',        cls: 'UNCLASSIFIED',          clsShort: 'UNCLAS',  required: [],                                            color: '#6b7280' },
  { id: 'readme',   name: 'Project_README.txt',              cls: 'UNCLASSIFIED',          clsShort: 'UNCLAS',  required: [],                                            color: '#6b7280' },
]

const QUERIES = [
  { id: 'briefing',  label: 'Summarize threat briefing',  docs: ['briefing', 'sigint', 'pws', 'readme'] },
  { id: 'fvey',      label: 'Show me FVEY intel',         docs: ['fvey', 'sigint', 'briefing', 'readme'] },
  { id: 'nato',      label: 'NATO joint ops status',      docs: ['nato', 'fvey', 'pws', 'readme'] },
  { id: 'allfiles',  label: 'List all available docs',    docs: ['briefing', 'sigint', 'fvey', 'nato', 'ucmj', 'cyber', 'pws', 'readme'] },
]

const STEPS = [
  { id: 'parse',   label: 'Parsing query' },
  { id: 'search',  label: 'Searching document corpus' },
  { id: 'policy',  label: 'Applying Virtru policy filter' },
  { id: 'respond', label: 'Generating response' },
]

const STEP_DELAYS = [400, 700, 900, 500]

// Human personas shown in the Act 2 left column — only the federal ones (not generic)
const HUMAN_PERSONAS = FEDERAL_PERSONAS.filter(p => p.id !== 'generic')

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Access logic (mirrors CollaboratePage) ────────────────────────────────────

function expandClearance(attrs) {
  const s = new Set(attrs)
  if (s.has('clearance:ts-sci')) { s.add('clearance:secret'); s.add('clearance:unclassified') }
  if (s.has('clearance:secret'))   s.add('clearance:unclassified')
  return s
}

function canOpen(doc, attrs) {
  const expanded = expandClearance(new Set(attrs))
  return doc.required.every(r => expanded.has(r))
}

function missing(doc, attrs) {
  const expanded = expandClearance(new Set(attrs))
  return doc.required.filter(r => !expanded.has(r))
}

// Effective attrs = intersection of two personas' attributes
function intersect(a1, a2) {
  const s = new Set(a2)
  return a1.filter(a => s.has(a))
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PersonaButton({ persona, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 10px', borderRadius: 8, cursor: 'pointer', width: '100%',
        background: selected ? persona.color + '20' : 'var(--c-surface-2)',
        border: `1.5px solid ${selected ? persona.color : 'var(--c-border)'}`,
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{ fontSize: 18 }}>{persona.avatar}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)' }}>{persona.name}</div>
        <div style={{ fontSize: 10, color: 'var(--c-text-5)' }}>{persona.title}</div>
      </div>
    </button>
  )
}

function DocResultCard({ doc, attrs, phase }) {
  if (phase < 2) return null
  const granted = canOpen(doc, attrs)
  const miss    = missing(doc, attrs)
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, marginBottom: 6,
      background: granted ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${granted ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.2)'}`,
      animation: 'step-in 0.2s ease',
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 3, background: doc.color + '22', color: doc.color, flexShrink: 0, marginTop: 1 }}>
          {doc.clsShort}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.name}
          </div>
          {phase >= 3 && (
            <div style={{ marginTop: 3 }}>
              {granted ? (
                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ ACCESSIBLE</span>
              ) : (
                <div>
                  <span style={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>✗ BLOCKED</span>
                  {miss.length > 0 && (
                    <span style={{ fontSize: 10, color: '#b91c1c', marginLeft: 6 }}>
                      missing: {miss.join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiAgentPage() {
  const { logEvent } = useDemo()

  const [act,          setAct]          = useState('act1')
  const [aiPersona,    setAiPersona]    = useState(AI_PERSONAS[0])
  const [humanPersona, setHumanPersona] = useState(HUMAN_PERSONAS[0])
  const [selectedQuery,setSelectedQuery]= useState(null)
  const [running,      setRunning]      = useState(false)
  const [currentStep,  setCurrentStep]  = useState(-1)
  const [queryDocs,    setQueryDocs]    = useState([])
  const [docPhase,     setDocPhase]     = useState(0) // 0=hidden, 1=searching, 2=found, 3=filtered
  const [done,         setDone]         = useState(false)

  // Effective attrs for the current act
  const effectiveAttrs = act === 'act1'
    ? aiPersona.attributes
    : intersect(aiPersona.attributes, humanPersona.attributes)

  const blockedCount  = queryDocs.filter(d => !canOpen(d, effectiveAttrs)).length
  const allowedCount  = queryDocs.filter(d =>  canOpen(d, effectiveAttrs)).length

  const runQuery = useCallback(async (query) => {
    if (running) return
    setRunning(true)
    setDone(false)
    setSelectedQuery(query)
    setCurrentStep(-1)
    setDocPhase(0)
    setQueryDocs([])

    const docs = query.docs.map(id => DOCS.find(d => d.id === id)).filter(Boolean)

    for (let i = 0; i < STEPS.length; i++) {
      setCurrentStep(i)
      await sleep(STEP_DELAYS[i])

      if (i === 1) {
        // Step 2: surface docs
        setQueryDocs(docs)
        setDocPhase(2)
      }
      if (i === 2) {
        // Step 3: policy filter verdict
        setDocPhase(3)
        docs.forEach(doc => {
          const granted = canOpen(doc, effectiveAttrs)
          const logPersona = act === 'act1'
            ? aiPersona
            : { ...aiPersona, name: `${aiPersona.name} → ${humanPersona.name}` }
          logEvent({
            type:     granted ? 'decrypt' : 'decrypt-denied',
            persona:  logPersona,
            document: doc.name,
            result:   granted ? 'granted' : 'denied',
            reason:   granted ? 'Entitlements satisfied' : `Missing: ${missing(doc, effectiveAttrs).join(', ')}`,
          })
        })
      }
    }

    setCurrentStep(STEPS.length)
    setDone(true)
    setRunning(false)
  }, [running, effectiveAttrs, act, aiPersona, humanPersona, logEvent])

  const reset = () => {
    setRunning(false)
    setDone(false)
    setCurrentStep(-1)
    setQueryDocs([])
    setDocPhase(0)
    setSelectedQuery(null)
  }

  // Reset on act/persona change
  const switchAct = (a) => { setAct(a); reset() }
  const switchAiPersona = (p) => { setAiPersona(p); reset() }
  const switchHumanPersona = (p) => { setHumanPersona(p); reset() }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--c-bg)' }}>

      {/* ── Act selector ───────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: '12px 20px 0',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {[
          { id: 'act1', label: 'Act 1 — Protect the AI', desc: 'AI agent clearance limits what data it can access' },
          { id: 'act2', label: 'Act 2 — Protect the Human', desc: "Your clearance limits what the AI can tell you" },
        ].map(a => (
          <button
            key={a.id}
            onClick={() => switchAct(a.id)}
            style={{
              padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
              background: act === a.id ? '#1e40af' : 'var(--c-surface)',
              border: `1.5px solid ${act === a.id ? '#3b82f6' : 'var(--c-border)'}`,
              color: act === a.id ? '#fff' : 'var(--c-text-4)',
              fontSize: 13, fontWeight: act === a.id ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            <div>{a.label}</div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{a.desc}</div>
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-5)' }}>
          Policy enforced at the data layer — not the application layer
        </div>
      </div>

      {/* ── Three-column body ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: 12, padding: 16, overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT — persona selectors ───────────────────────────────────── */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* AI persona */}
          <div style={{ background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', letterSpacing: '0.08em', marginBottom: 8 }}>
              🤖 AI AGENT
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {AI_PERSONAS.map(p => (
                <PersonaButton key={p.id} persona={p} selected={aiPersona.id === p.id} onClick={() => switchAiPersona(p)} />
              ))}
            </div>
          </div>

          {/* Human persona (Act 2 only) */}
          {act === 'act2' && (
            <div style={{ background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '12px', animation: 'step-in 0.2s ease' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', letterSpacing: '0.08em', marginBottom: 8 }}>
                👤 YOU ARE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {HUMAN_PERSONAS.map(p => (
                  <PersonaButton key={p.id} persona={p} selected={humanPersona.id === p.id} onClick={() => switchHumanPersona(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Effective attributes */}
          <div style={{ background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', letterSpacing: '0.08em', marginBottom: 6 }}>
              EFFECTIVE ATTRS
            </div>
            {act === 'act2' && (
              <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginBottom: 6 }}>
                Intersection: AI ∩ Human
              </div>
            )}
            {effectiveAttrs.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {effectiveAttrs.map(a => (
                  <span key={a} style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: '#dbeafe', color: '#1e40af',
                    border: '1px solid #93c5fd',
                  }}>{a}</span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#b91c1c' }}>No shared attributes</div>
            )}
          </div>
        </div>

        {/* ── CENTER — query + pipeline ──────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

          {/* Story context banner */}
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: act === 'act1' ? '#ede9fe' : '#dbeafe',
            border: `1px solid ${act === 'act1' ? '#c4b5fd' : '#93c5fd'}`,
            fontSize: 12, color: act === 'act1' ? '#5b21b6' : '#1e40af',
          }}>
            {act === 'act1'
              ? `The AI agent has ${aiPersona.id === 'ai-logistics' ? 'no clearance' : aiPersona.attributes.join(', ')}. It can only retrieve documents its own entitlements allow — regardless of what it's asked.`
              : `The AI has ${aiPersona.attributes.length > 0 ? aiPersona.attributes.join(', ') : 'no clearance'} and you have ${humanPersona.attributes.join(', ')}. The response is capped to the stricter of the two.`
            }
          </div>

          {/* Query chips */}
          <div style={{ background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '12px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', marginBottom: 8 }}>
              ASK THE AI
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUERIES.map(q => (
                <button
                  key={q.id}
                  onClick={() => !running && runQuery(q)}
                  style={{
                    padding: '7px 13px', borderRadius: 20, cursor: running ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    background: selectedQuery?.id === q.id ? '#1e40af' : 'var(--c-surface-2)',
                    border: `1.5px solid ${selectedQuery?.id === q.id ? '#3b82f6' : 'var(--c-border)'}`,
                    color: selectedQuery?.id === q.id ? '#fff' : 'var(--c-text-3)',
                    opacity: running && selectedQuery?.id !== q.id ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pipeline steps */}
          {selectedQuery && (
            <div style={{ background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '14px', animation: 'step-in 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', letterSpacing: '0.08em' }}>
                  QUERY PIPELINE
                </div>
                {done && (
                  <button onClick={reset} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, cursor: 'pointer', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-5)' }}>
                    Reset
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {STEPS.map((step, i) => {
                  const isDone   = currentStep > i
                  const isActive = currentStep === i
                  const isPolicyStep = step.id === 'policy'
                  return (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700,
                        background: isDone ? (isPolicyStep && blockedCount > 0 ? '#fee2e2' : '#dcfce7')
                          : isActive ? '#dbeafe' : 'var(--c-surface-2)',
                        border: `2px solid ${isDone ? (isPolicyStep && blockedCount > 0 ? '#f87171' : '#22c55e')
                          : isActive ? '#3b82f6' : 'var(--c-border)'}`,
                        transition: 'all 0.3s',
                      }}>
                        {isDone
                          ? (isPolicyStep && blockedCount > 0 ? '✗' : '✓')
                          : isActive
                          ? <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                          : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: 13, fontWeight: isActive ? 600 : 400,
                          color: isDone ? 'var(--c-text-2)' : isActive ? 'var(--c-accent)' : 'var(--c-text-5)',
                        }}>
                          {step.label}
                          {isDone && isPolicyStep && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: blockedCount > 0 ? '#b91c1c' : '#15803d' }}>
                              — {blockedCount > 0 ? `${blockedCount} doc${blockedCount > 1 ? 's' : ''} blocked` : 'All accessible'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Final verdict */}
              {done && (
                <div style={{
                  marginTop: 12, padding: '10px 12px', borderRadius: 8,
                  background: blockedCount === queryDocs.length
                    ? 'rgba(239,68,68,0.08)'
                    : blockedCount > 0
                    ? 'rgba(245,158,11,0.08)'
                    : 'rgba(74,222,128,0.08)',
                  border: `1px solid ${blockedCount === queryDocs.length ? 'rgba(239,68,68,0.3)' : blockedCount > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(74,222,128,0.3)'}`,
                  animation: 'step-in 0.2s ease',
                }}>
                  {blockedCount === queryDocs.length ? (
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#b91c1c' }}>
                      🔒 Response withheld — policy filter blocked all {queryDocs.length} documents
                    </div>
                  ) : blockedCount > 0 ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-3)' }}>
                      ⚠ Partial response — {blockedCount} of {queryDocs.length} documents redacted by policy
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                      ✓ Full response — {allowedCount} documents accessible
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!selectedQuery && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-6)', fontSize: 13 }}>
              Select a query above to run the demo
            </div>
          )}
        </div>

        {/* ── RIGHT — document results ───────────────────────────────────── */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

          <div style={{ background: 'var(--c-surface)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '12px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', letterSpacing: '0.08em', marginBottom: 8 }}>
              DOCUMENT RESULTS
            </div>

            {queryDocs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--c-text-6)', textAlign: 'center', marginTop: 20 }}>
                Run a query to see results
              </div>
            ) : (
              queryDocs.map(doc => (
                <DocResultCard key={doc.id} doc={doc} attrs={effectiveAttrs} phase={docPhase} />
              ))
            )}

            {/* Act 2 breakdown */}
            {act === 'act2' && done && queryDocs.length > 0 && (
              <div style={{ marginTop: 10, padding: '10px', borderRadius: 8, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', animation: 'step-in 0.2s ease' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', marginBottom: 6 }}>POLICY BREAKDOWN</div>
                {[
                  { label: `AI (${aiPersona.name.replace(' AI','')})`, attrs: aiPersona.attributes, color: aiPersona.color },
                  { label: `You (${humanPersona.name})`, attrs: humanPersona.attributes, color: humanPersona.color },
                  { label: 'Effective (intersection)', attrs: effectiveAttrs, color: 'var(--c-text-2)' },
                ].map(row => {
                  const accessible = queryDocs.filter(d => canOpen(d, row.attrs)).length
                  return (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-4)', flex: 1 }}>{row.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: row.color }}>
                        {accessible}/{queryDocs.length} docs
                      </span>
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
