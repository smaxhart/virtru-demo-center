import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon from '../components/PersonaIcon.jsx'
import { shortFqn, fmtBytes } from '../ai/corpus.js'
import { classifyQuery, buildSystemPrompt, explainPolicy, missingAttributes } from '../ai/policyEngine.js'
import { retrieve, probeAccess } from '../ai/corpusVault.js'
import { streamChat } from '../ai/gatewayClient.js'
import { saveTdf } from '../api/download.js'

/** Tier units are labelled "Document — Tier"; show just the tier half. */
const tierName = (unit) => unit.label.split(' — ')[1] ?? unit.label

/** The opening message, named after the mode so the scenario is obvious from the first line. */
const welcomeFor = (mode) => ({
  role: 'assistant',
  welcome: true,
  content: `I'm your assistant inside the Virtru Data Security Platform, working the ${mode.name} corpus.

Every document I can draw on is encrypted as a TDF. When you ask me something, the platform is asked to unwrap the relevant document's key twice — once for *you*, and once for *me*. I'm a policy subject in my own right, with attributes of my own, so a document reaches me only when both of us are entitled to it. If either is refused, I never receive the text at all, and I can't be talked into revealing it because it was never in front of me.

Ask me anything.`,
})

// ── Left rail: identity ─────��─────────────────────────────────────────────────

/** Attribute chips, tinted to whoever holds them. */
function AttrChips({ fqns, color, emptyNote }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {fqns.length === 0 && (
        <span style={{ fontSize: 10, color: 'var(--c-text-5)', fontStyle: 'italic' }}>
          {emptyNote}
        </span>
      )}
      {fqns.map(fqn => (
        <span key={fqn} className="mono" style={{
          fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
          background: color + '15', color,
          border: `1px solid ${color}30`,
        }}>{shortFqn(fqn)}</span>
      ))}
    </div>
  )
}

/**
 * The agent as a subject you can change.
 *
 * Deliberately sits under the human in the same rail rather than in a settings panel: the two
 * are peers in the decision, and burying one of them would misrepresent how access is computed.
 */
function AgentPanel() {
  const { agents, agent, agentId, setAgentId, agentFqns } = useApp()

  if (agents.length === 0) return null

  return (
    <>
      <div className="section-label" style={{ padding: '8px 2px 2px' }}>
        ACTING AGENT
      </div>
      <div style={{ fontSize: 10, color: 'var(--c-text-6)', lineHeight: 1.55, padding: '0 3px 3px' }}>
        Entitled in its own right. A document is released only if the platform grants it to
        both of you.
      </div>

      {agents.map(a => {
        const active = a.id === agentId
        return (
          <button
            key={a.id}
            onClick={() => setAgentId(a.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px',
              borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
              background: active ? a.color + '18' : 'var(--c-surface)',
              border: `1.5px solid ${active ? a.color : 'var(--c-border)'}`,
            }}
          >
            <span style={{ color: active ? a.color : 'var(--c-text-5)', display: 'flex' }}>
              <PersonaIcon icon={a.icon} size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', color: active ? a.color : 'var(--c-text-2)',
              }}>{a.name}</div>
              <div className="mono" style={{
                fontSize: 9, color: 'var(--c-text-5)', marginTop: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{a.title}</div>
            </div>
          </button>
        )
      })}

      {agent && (
        <div className="card" style={{ padding: '10px 12px', marginTop: 4 }}>
          <div className="section-label" style={{ marginBottom: 7 }}>AGENT ATTRIBUTES</div>
          <AttrChips
            fqns={agentFqns}
            color={agent.color}
            emptyNote="None — the agent holds no entitlements"
          />
          <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 8, lineHeight: 1.6 }}>
            From the agent's own signed token. The KAS cannot tell it apart from a person.
          </div>
        </div>
      )}

      {agent?.note && (
        <div style={{ fontSize: 10.5, color: 'var(--c-text-5)', lineHeight: 1.65, padding: '0 3px' }}>
          {agent.note}
        </div>
      )}
    </>
  )
}

function IdentityPanel() {
  const { personas, persona, personaId, setPersonaId, entityFqns } = useApp()

  return (
    <div style={{ width: 224, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
      <div className="section-label" style={{ padding: '2px 2px' }}>IDENTITY</div>

      {personas.map(p => {
        const active = p.id === personaId
        return (
          <button
            key={p.id}
            onClick={() => setPersonaId(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
              borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
              background: active ? p.color + '18' : 'var(--c-surface)',
              border: `1.5px solid ${active ? p.color : 'var(--c-border)'}`,
            }}
          >
            <span style={{ color: active ? p.color : 'var(--c-text-5)', display: 'flex' }}>
              <PersonaIcon icon={p.icon} badge={p.badge} size={20} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis', color: active ? p.color : 'var(--c-text-2)',
              }}>{p.name}</div>
              <div style={{
                fontSize: 10, color: 'var(--c-text-5)', marginTop: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{p.title}</div>
            </div>
          </button>
        )
      })}

      <div className="card" style={{ padding: '10px 12px', marginTop: 4 }}>
        <div className="section-label" style={{ marginBottom: 7 }}>RESOLVED ATTRIBUTES</div>
        <AttrChips
          fqns={entityFqns}
          color={persona.color}
          emptyNote="None — holds no entitlements"
        />
        <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 8, lineHeight: 1.6 }}>
          Read from the signed token the KAS receives — not a UI-side copy.
        </div>
      </div>

      {persona.note && (
        <div style={{ fontSize: 10.5, color: 'var(--c-text-5)', lineHeight: 1.65, padding: '0 3px' }}>
          {persona.note}
        </div>
      )}

      <AgentPanel />
    </div>
  )
}

// ── Taking the ciphertext with you ────────────────────────────────────────────

/**
 * Offered wherever the platform actually released a key.
 *
 * This changes nothing about the answer above it or how that answer was produced — it adds
 * the file. And the file is the TDF, not the plaintext the model was handed: the policy is
 * inside it, so the copy that lands in someone's Downloads folder needs the same rewrap from
 * the same KAS as the copy in the vault. "You can take it with you and it is still protected"
 * is a better demo beat than "you can read it here".
 *
 * @param {object} entry a vault entry — {unit, tdfBytes, bytes}
 * @param {boolean} [compact] icon-only, for the narrow right rail
 */
function TdfDownload({ entry, compact = false }) {
  const [state, setState] = useState('idle') // idle | saving | saved | error

  const click = async () => {
    setState('saving')
    try {
      // null means the save dialog was dismissed — not a failure, so drop back to idle
      const where = await saveTdf(entry.unit, entry.tdfBytes)
      setState(where ? 'saved' : 'idle')
    } catch {
      setState('error')
    }
  }

  const tint = state === 'error' ? 'var(--c-deny)' : state === 'saved' ? 'var(--c-grant)' : null

  if (compact) {
    return (
      <button
        onClick={click}
        disabled={state === 'saving'}
        title={`Download ${entry.unit.label} as .tdf (${fmtBytes(entry.bytes)}) — still encrypted, still policy-bound`}
        style={{
          flexShrink: 0, fontSize: 10, lineHeight: 1.2, padding: '1px 5px', borderRadius: 4,
          cursor: state === 'saving' ? 'wait' : 'pointer', background: 'transparent',
          border: '1px solid var(--c-border)', color: tint ?? 'var(--c-text-5)',
        }}
      >{state === 'saved' ? '✓' : '↓'}</button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4, flexWrap: 'wrap' }}>
      <button
        onClick={click}
        disabled={state === 'saving'}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 10.5, fontWeight: 600, padding: '4px 9px', borderRadius: 6,
          cursor: state === 'saving' ? 'wait' : 'pointer', background: 'var(--c-surface)',
          border: `1px solid ${state === 'error' ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
          color: tint ?? 'var(--c-text-4)',
        }}
      >
        <span style={{ fontSize: 11 }}>{state === 'saved' ? '✓' : '↓'}</span>
        {state === 'saving' ? 'Choose a location…'
          : state === 'saved' ? 'Saved as .tdf'
          : state === 'error' ? 'Save failed'
          : 'Download source as .tdf'}
      </button>
      <span className="mono" style={{ fontSize: 9.5, color: 'var(--c-text-6)' }}>
        {entry.unit.label} · {fmtBytes(entry.bytes)} · policy travels inside the file
      </span>
    </div>
  )
}

// ── Right rail: the decision ──────────────────────────────────────────────────

/**
 * One subject's half of an attempt: their verdict, and the policy measured against what they
 * hold. Rendered once per subject so the two are visibly peers — reading only the human's rows
 * would hide the case this whole panel exists to explain.
 */
function SubjectRows({ label, name, color, verdict, policy }) {
  const rows = explainPolicy(policy, verdict.fqns)

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{
          fontWeight: 700, fontSize: 10, flexShrink: 0,
          color: verdict.granted ? 'var(--c-grant)' : 'var(--c-deny)',
        }}>{verdict.granted ? '✓' : '✗'}</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.4, color: 'var(--c-text-5)', flexShrink: 0 }}>
          {label}
        </span>
        <span style={{
          fontSize: 9.5, color, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</span>
      </div>

      <div style={{ paddingLeft: 15, marginTop: 2 }}>
        {/* An empty policy has no rows to show, and its absence is the interesting fact */}
        {rows.length === 0 && (
          <div style={{ fontSize: 9.5, color: 'var(--c-text-5)', lineHeight: 1.5, fontStyle: 'italic' }}>
            No attributes in the policy — released to any authenticated caller.
          </div>
        )}
        {rows.map(r => (
          <div key={r.attribute} style={{ display: 'flex', gap: 5, marginBottom: 2, alignItems: 'baseline' }}>
            <span style={{
              fontSize: 10, flexShrink: 0, fontWeight: 700,
              color: r.satisfied ? 'var(--c-grant)' : 'var(--c-deny)',
            }}>{r.satisfied ? '✓' : '✗'}</span>
            <span className="mono" style={{
              fontSize: 9.5, lineHeight: 1.5,
              color: r.satisfied ? 'var(--c-text-4)' : 'var(--c-deny)',
            }}>
              {r.attribute}:{r.required.length > 3 ? ` any of ${r.required.length}` : ' ' + r.required.join(' | ')}
            </span>
          </div>
        ))}
        {!verdict.granted && verdict.reason && (
          <div style={{ fontSize: 9.5, color: 'var(--c-text-6)', marginTop: 3, lineHeight: 1.5 }}>
            {verdict.reason}
          </div>
        )}
      </div>
    </div>
  )
}

function RewrapAttempt({ attempt }) {
  const { persona, entityFqns, agent, agentFqns } = useApp()
  const { entry, granted, user, agent: agentVerdict, blockedBy } = attempt
  const policy = entry.unit.policy

  return (
    <div style={{
      padding: '8px 10px', borderRadius: 7, marginBottom: 5,
      background: granted ? 'var(--c-grant-bg)' : 'transparent',
      border: `1px solid ${granted ? 'var(--c-grant-br)' : 'var(--c-border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontWeight: 700, fontSize: 11, flexShrink: 0,
          color: granted ? 'var(--c-grant)' : 'var(--c-deny)',
        }}>{granted ? '✓' : '✗'}</span>
        <span style={{
          fontSize: 10.5, fontWeight: 600, flex: 1, minWidth: 0,
          color: granted ? 'var(--c-grant)' : 'var(--c-text-4)',
        }}>
          {entry.unit.tierId ? tierName(entry.unit) : 'Rewrap'}
        </span>
        {/* Attribution up here, where the eye lands before it reads the two blocks below */}
        {blockedBy === 'agent' && (
          <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, color: 'var(--c-warn)' }}>
            AGENT BLOCKED
          </span>
        )}
      </div>

      <SubjectRows
        label="YOU"
        name={persona.name}
        color={persona.color}
        verdict={{ ...user, fqns: entityFqns }}
        policy={policy}
      />

      {/* `absent` means no agent was in play, so there is no second verdict to report */}
      {!agentVerdict.absent && agent && (
        <SubjectRows
          label="AGENT"
          name={agent.name}
          color={agent.color}
          verdict={{ ...agentVerdict, fqns: agentFqns }}
          policy={policy}
        />
      )}
    </div>
  )
}

/**
 * One subject's verdict in the access matrix, as a single fixed-width glyph.
 *
 * `emphasizeMiss` is what makes the matrix worth reading: an ordinary miss is a quiet dot,
 * but a subject refused something the *other* subject was granted draws a coloured ✗. That
 * one row — you cleared, the agent did not — is the finding, so it should not look like the
 * dozen rows where nobody was entitled to anything.
 */
function SubjectGlyph({ ok, emphasizeMiss = false, title }) {
  return (
    <span
      title={`${title}: ${ok ? 'granted' : 'refused'}`}
      style={{
        fontSize: 10.5, flexShrink: 0, width: 11, textAlign: 'center',
        fontWeight: emphasizeMiss && !ok ? 700 : 400,
        color: ok ? 'var(--c-grant)' : emphasizeMiss ? 'var(--c-warn)' : 'var(--c-text-6)',
      }}
    >{ok ? '✓' : emphasizeMiss ? '✗' : '·'}</span>
  )
}

/** How the summary card names the outcome. Attribution is the whole point of a refusal. */
function verdictLabel(trace) {
  if (trace.granted) return '✓ KEY RELEASED'
  if (trace.blockedBy === 'agent') return '✗ REFUSED TO THE AGENT'
  if (trace.blockedBy === 'both') return '✗ REFUSED TO BOTH'
  return '✗ REWRAP REFUSED'
}

function blockerNote(trace, persona, agent) {
  if (trace.granted || !trace.blockedBy) return null
  if (trace.blockedBy === 'agent') {
    return `${persona.name} was granted. ${agent?.name ?? 'The agent'} was not — and both are required.`
  }
  if (trace.blockedBy === 'both') {
    return 'Neither subject satisfied the policy.'
  }
  return `${persona.name} did not satisfy the policy.`
}

function DecisionPanel({ trace, accessMap }) {
  const { mode, documents, persona, agent } = useApp()

  return (
    <div style={{ width: 236, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
      <div className="section-label" style={{ padding: '2px 2px' }}>KAS DECISION</div>

      {!trace ? (
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-6)', fontStyle: 'italic', lineHeight: 1.6 }}>
            Updates after each query. Every verdict here is a real rewrap response from
            the local KAS.
          </div>
        </div>
      ) : (
        <>
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: trace.granted ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
            border: `1px solid ${trace.granted ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, marginBottom: 3,
              color: trace.granted ? 'var(--c-grant)' : 'var(--c-deny)',
            }}>
              {verdictLabel(trace)}
            </div>
            {/* Which subject failed, before anything about the document. A refusal nobody can
                attribute is indistinguishable from a bug. */}
            {blockerNote(trace, persona, agent) && (
              <div style={{ fontSize: 10, color: 'var(--c-text-4)', lineHeight: 1.55, marginBottom: 5 }}>
                {blockerNote(trace, persona, agent)}
              </div>
            )}
            {trace.doc ? (
              <div style={{ fontSize: 10, color: 'var(--c-text-5)', lineHeight: 1.55 }}>
                <div>{trace.doc.label}</div>
                {trace.entry?.unit.tierId && (
                  <div style={{ marginTop: 1, color: 'var(--c-warn)', fontWeight: 600 }}>
                    {tierName(trace.entry.unit)}
                  </div>
                )}
                <div className="mono" style={{
                  marginTop: 3, fontSize: 9.5, fontWeight: 600,
                  color: trace.granted ? 'var(--c-grant)' : 'var(--c-deny)',
                }}>
                  {trace.entry?.unit.classification ?? trace.doc.classification}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--c-text-5)' }}>
                General question — no document retrieved
              </div>
            )}
          </div>

          {trace.attempts?.length > 0 && (
            <div className="card" style={{ padding: '10px 12px' }}>
              <div className="section-label" style={{ marginBottom: 7 }}>
                REWRAP {trace.attempts.length > 1 ? `ATTEMPTS (${trace.attempts.length})` : 'ATTEMPT'}
              </div>
              {trace.attempts.map((a, i) => (
                <RewrapAttempt key={i} attempt={a} />
              ))}
              {trace.attempts.length > 1 && (
                <div style={{ fontSize: 9.5, color: 'var(--c-text-6)', lineHeight: 1.55, marginTop: 2 }}>
                  Tiers are tried most-privileged first; the first tier <em>both</em> subjects can
                  open wins.
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="card" style={{ padding: '10px 12px' }}>
        <div className="section-label" style={{ marginBottom: 7 }}>CORPUS ACCESS</div>
        {/* A legend rather than aligned column headers — "AGENT" is wider than the glyph column
            it would label, and a header that does not line up reads as a mistake. */}
        {agent && (
          <div className="mono" style={{
            fontSize: 8.5, color: 'var(--c-text-6)', letterSpacing: 0.3, marginBottom: 5,
          }}>
            COLUMNS: YOU · AGENT
          </div>
        )}
        {!accessMap ? (
          <div style={{ fontSize: 10, color: 'var(--c-text-6)', fontStyle: 'italic' }}>Probing…</div>
        ) : documents.map(doc => {
          const r = accessMap.get(doc.id)
          const ok = r?.granted
          return (
            <div key={doc.id} style={{ display: 'flex', gap: 5, marginBottom: 4, alignItems: 'baseline' }}>
              {/* Two verdicts, never collapsed into one. A row where you cleared and the agent
                  did not is the case this whole feature exists to make visible, and a single
                  glyph would render it identical to a row you were never entitled to. */}
              <SubjectGlyph ok={r?.userGranted} title="Released to you" />
              {agent && (
                <SubjectGlyph
                  ok={r?.agentGranted}
                  emphasizeMiss={r?.userGranted}
                  title={`Released to ${agent.name}`}
                />
              )}
              <span style={{
                fontSize: 10, lineHeight: 1.45, flex: 1, minWidth: 0,
                color: ok ? 'var(--c-text-4)' : 'var(--c-text-6)',
              }}>
                {doc.label}
                {/* Marked so it is obvious which rows came from a file you added, and which
                    shipped with the scenario. The access decision is identical either way. */}
                {doc.upload && <span style={{ color: 'var(--c-text-6)' }}> · yours</span>}
                {ok && r.tierId && (
                  <span style={{ color: 'var(--c-warn)' }}> · {r.tierId}</span>
                )}
                {!ok && r?.blockedBy === 'agent' && (
                  <span style={{ color: 'var(--c-warn)' }}> · agent blocked</span>
                )}
              </span>
              {/* Reachable means exportable. Nothing is offered on a row the KAS refused. */}
              {ok && r.entry && <TdfDownload entry={r.entry} compact />}
            </div>
          )
        })}
        <div style={{ fontSize: 9.5, color: 'var(--c-text-6)', marginTop: 7, lineHeight: 1.55 }}>
          Measured by actually attempting each rewrap, not predicted.
          {agent && ' A document is reachable only where both columns clear.'}
          {' '}↓ saves the released TDF — it stays encrypted, and its policy is still enforced
          by this KAS.
        </div>
      </div>
    </div>
  )
}

// ── Messages ──────────────────────────────────────────────────────────────────

function Message({ msg, persona }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-5)', padding: isUser ? '0 4px 0 0' : '0 0 0 4px' }}>
        {isUser ? persona.name : 'Virtru Secure AI'}
      </div>
      <div style={{
        maxWidth: '76%', padding: '11px 14px', fontSize: 13, lineHeight: 1.65,
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        background: isUser ? '#1e3a5f' : msg.denied ? 'var(--c-deny-bg)' : 'var(--c-surface)',
        border: isUser ? 'none' : `1px solid ${msg.denied ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
        color: isUser ? '#e2e8f0' : 'var(--c-text-2)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
        {msg.streaming && <span style={{ opacity: 0.4 }}>▋</span>}
      </div>

      {/* Only once the answer has finished — a button appearing mid-stream pulls the eye
          away from the text it belongs to. */}
      {msg.source && !msg.streaming && <TdfDownload entry={msg.source} />}
    </div>
  )
}

function TypingIndicator({ note }) {
  return (
    <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-5)', paddingLeft: 4 }}>
        {note ?? 'Virtru Secure AI'}
      </div>
      <div style={{
        padding: '12px 16px', borderRadius: '4px 14px 14px 14px',
        background: 'var(--c-surface)', border: '1px solid var(--c-border)',
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 0.2, 0.4].map(d => (
          <span key={d} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-5)',
            display: 'inline-block', animation: `bounce 1.2s ease-in-out ${d}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const {
    vault, mode, documents, logEvent,
    persona, personaId, entityFqns,
    agent, agentId, agentFqns,
  } = useApp()

  const [messages, setMessages] = useState(() => [welcomeFor(mode)])
  const [input, setInput]       = useState('')
  const [trace, setTrace]       = useState(null)
  const [busy, setBusy]         = useState(false)
  const [stage, setStage]       = useState(null) // 'retrieving' | 'thinking'
  const [accessMap, setAccess]  = useState(null)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  // Probe what this persona can actually reach through this agent — real rewraps against the
  // local KAS, both subjects, every document.
  useEffect(() => {
    if (!vault) return
    let live = true
    setAccess(null)
    probeAccess(vault, personaId, documents, agentId)
      .then(m => { if (live) setAccess(m) })
      .catch(() => { if (live) setAccess(new Map()) })
    return () => { live = false }
    // `documents` rather than `mode`, so adding a document re-probes rather than leaving a row
    // missing from the matrix until the persona is switched. `agentId` because switching agents
    // changes the matrix just as much as switching people does.
  }, [vault, personaId, agentId, documents])

  const submitQuery = useCallback(async (query) => {
    if (!query || busy || !vault) return
    setBusy(true)
    setMessages(prev => [...prev, { role: 'user', content: query }])

    const doc = classifyQuery(query, documents)

    // Retrieval first. The model is not consulted until the platform has decided — twice.
    let result = { granted: true, entry: null, text: null, attempts: [], blockedBy: null }
    if (doc) {
      setStage('retrieving')
      try {
        result = await retrieve(vault, doc, personaId, agentId)
      } catch (err) {
        result = {
          granted: false, entry: null, text: null, attempts: [],
          blockedBy: null, error: err.message,
        }
      }
    }

    setTrace({ doc, ...result })

    logEvent({
      persona: persona.name,
      personaId,
      agent: agent?.name ?? null,
      agentId: agentId ?? null,
      document: doc ? doc.label : 'General query',
      tier: result.entry?.unit.tierId ?? null,
      classification: result.entry?.unit.classification ?? doc?.classification ?? null,
      granted: doc ? result.granted : true,
      attempts: result.attempts.length,
      // Recorded because "who was refused" is the part an audit reader cannot reconstruct from
      // the persona alone — the same person, through a different agent, gets a different answer.
      blockedBy: result.blockedBy ?? null,
      reason: !doc
        ? 'No document retrieved — general question'
        : result.granted
          ? `Key released to both subjects${result.entry?.unit.tierId ? ` for tier "${result.entry.unit.tierId}"` : ''}`
          : `Rewrap refused on ${result.attempts.length || 1} attempt(s)`
            + (result.blockedBy ? ` — blocked by ${result.blockedBy === 'both' ? 'both subjects' : `the ${result.blockedBy === 'agent' ? 'agent' : 'user'}`}` : ''),
    })

    if (doc && !result.granted) {
      // Each refused tier, with the shortfall charged to whichever subject actually failed and
      // measured against *that* subject's attributes. Blaming the human for the agent's missing
      // clearance is the one wrong answer this message could give.
      const lines = result.attempts.map(a => {
        const name = a.entry.unit.tierId ? tierName(a.entry.unit) : a.entry.unit.label
        const parts = []
        if (!a.user.granted) {
          const m = missingAttributes(a.entry.unit.policy, entityFqns)
          parts.push(`you need ${m.join(' and ') || 'attributes you do not hold'}`)
        }
        if (!a.agent.granted) {
          const m = missingAttributes(a.entry.unit.policy, agentFqns)
          parts.push(`I need ${m.join(' and ') || 'attributes I do not hold'}`)
        }
        return `• ${name} — ${parts.join('; ')}`
      })

      const opener = result.blockedBy === 'agent'
        ? `You're entitled to that. I'm not.\n\nI'm running as ${agent?.name ?? 'an agent'}, a policy subject with attributes of its own. The platform released ${doc.label} to you and refused it to me — and a document only reaches me when both of us are granted.`
        : result.blockedBy === 'both'
          ? `I don't have that document, and neither of us is entitled to it.\n\nYour query matches ${doc.label} (${doc.classification}), and the platform refused both subjects.`
          : `I don't have that document.\n\nYour query matches ${doc.label} (${doc.classification}), and the platform refused to release its key to you.`

      const detail = lines.length === 0
        ? ''
        : result.attempts.length > 1
          ? `\n\nIt exists at more than one level of detail, and every version was refused:\n\n${lines.join('\n')}`
          : `\n\n${lines.join('\n')}`

      const closer = result.blockedBy === 'agent'
        ? `\n\nAn agent's entitlements are a ceiling on what anyone can pull through it, so this isn't something you can talk me past — switching to an agent that holds the attribute is the only way through.`
        : `\n\nThis isn't me declining to answer — the decryption key was never released, so the text never reached me.`

      setMessages(prev => [...prev, {
        role: 'assistant',
        denied: true,
        content: opener + detail + closer,
      }])
      setBusy(false)
      setStage(null)
      return
    }

    // History excludes denial notices — they describe the session, not the document
    const history = messages
      .filter(m => (m.role === 'user' || m.role === 'assistant') && !m.denied && !m.welcome)
      .map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: query })

    const systemPrompt = buildSystemPrompt({
      persona,
      entityFqns,
      agent,
      agentFqns,
      unit: result.entry?.unit ?? null,
      documentText: result.text,
      mode,
    })

    setStage('thinking')
    // `source` is the vault entry the KAS actually released, so the answer can offer that
    // exact ciphertext for download. Null on a general question — nothing was retrieved.
    setMessages(prev => [...prev, {
      role: 'assistant', content: '', streaming: true, source: result.entry ?? null,
    }])

    try {
      await streamChat(systemPrompt, history, (chunk) => {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + chunk }
          return next
        })
      })
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.streaming) next[next.length - 1] = { ...last, streaming: false }
        return next
      })
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        // Drop the empty streaming placeholder before appending the error
        if (next[next.length - 1]?.streaming) next.pop()
        return [...next, { role: 'assistant', denied: true, content: err.message }]
      })
    }

    setBusy(false)
    setStage(null)
  }, [busy, vault, mode, documents, personaId, persona, entityFqns,
      agentId, agent, agentFqns, messages, logEvent])

  const submit = useCallback(() => {
    const query = input.trim()
    if (!query) return
    setInput('')
    submitQuery(query)
  }, [input, submitQuery])

  const lastIsUser = messages[messages.length - 1]?.role === 'user'

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', gap: 14, padding: 14 }}>
      <IdentityPanel />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 15, paddingBottom: 10 }}>
          {messages.map((msg, i) => <Message key={i} msg={msg} persona={persona} />)}
          {busy && lastIsUser && (
            <TypingIndicator note={stage === 'retrieving'
              ? (agent ? 'Asking the KAS to unwrap — for you and for me…' : 'Asking the KAS to unwrap…')
              : undefined} />
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
          {mode.prompts.map(p => (
            <button
              key={p.label}
              onClick={() => submitQuery(p.text)}
              disabled={busy}
              style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                color: 'var(--c-text-3)', cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
              }}
            >{p.label}</button>
          ))}
        </div>

        <div className="card" style={{
          flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 10,
          padding: '10px 12px', marginTop: 7,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
            }}
            disabled={busy}
            placeholder="Message Virtru Secure AI…"
            rows={1}
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--c-text-1)', fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
              maxHeight: 160, overflow: 'auto',
            }}
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 8, fontSize: 16,
              background: busy || !input.trim() ? 'var(--c-surface-2)' : '#1e40af',
              border: '1px solid var(--c-border)',
              color: busy || !input.trim() ? 'var(--c-text-5)' : '#fff',
              cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >↑</button>
        </div>

        <div style={{ marginTop: 5, textAlign: 'center', fontSize: 10, color: 'var(--c-text-6)' }}>
          Documents held as TDF · {agent ? 'every answer gated by two live KAS rewraps' : 'every answer gated by a live KAS rewrap'} · model via Virtru AI Gateway
        </div>
      </div>

      <DecisionPanel trace={trace} accessMap={accessMap} />
    </div>
  )
}
