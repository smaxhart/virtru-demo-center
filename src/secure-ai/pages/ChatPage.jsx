import { useState, useRef, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon from '../components/PersonaIcon.jsx'
import { shortFqn, fmtBytes } from '../ai/corpus.js'
import { classifyQuery, buildSystemPrompt, explainPolicy, missingAttributes } from '../ai/policyEngine.js'
import { retrieve, probeAccess } from '../ai/corpusVault.js'
import { streamChat } from '../ai/gatewayClient.js'
import { saveTdf } from '../api/download.js'
import DerivedBanner from '../components/DerivedBanner.jsx'
import UiIcon from '../../components/UiIcon.jsx'

/** Tier units are labelled "Document — Tier"; show just the tier half. */
const tierName = (unit) => unit.label.split(' — ')[1] ?? unit.label

/**
 * The unit a trace is *about*.
 *
 * On a grant it is the unit released. On a refusal nothing was released, so it is the first tier
 * tried — the most privileged, which is the version of the document the question asked for. Without
 * this the rail falls back to `doc.classification`, which a mode is under no obligation to set:
 * every DIB document derives its marking per unit and has no document-level string at all.
 */
const decidedUnit = (r) => r?.entry?.unit ?? r?.attempts?.[0]?.entry?.unit ?? null

/**
 * The attributes that withheld a document, charged to whichever subject actually fell short.
 *
 * Measured against the *last* attempt, which is the least-privileged tier tried: that is the
 * minimal shortfall — the cheapest thing that would have admitted any version of the document.
 * Blaming the human for the agent's gap is the one wrong answer this could give, so each subject
 * is measured against its own attributes and the two are unioned.
 */
function shortfall(result, entityFqns, agentFqns) {
  if (!result || result.granted) return []
  const last = result.attempts?.[result.attempts.length - 1]
  if (!last) return []
  return [...new Set([
    ...(last.user.granted  ? [] : missingAttributes(last.entry.unit.policy, entityFqns)),
    ...(last.agent.granted ? [] : missingAttributes(last.entry.unit.policy, agentFqns)),
  ])]
}

/**
 * What the retrieval layer would admit for this pair of subjects, and what withheld the rest.
 *
 * The honest scope of a RAG query, stated before anyone asks. Per-*chunk* filtering is the larger
 * version of this and is not what the app does — `classifyQuery` selects one whole document — so
 * the unit counted here is the document, and the withheld counts are attributes, not passages.
 */
function retrievalScope(accessMap, documents, entityFqns, agentFqns) {
  if (!accessMap || accessMap.size === 0) return null

  const counts = new Map() // `cui:sp-cti` → how many documents it withheld
  let admitted = 0

  for (const doc of documents) {
    const r = accessMap.get(doc.id)
    if (r?.granted) { admitted++; continue }
    for (const m of shortfall(r, entityFqns, agentFqns)) counts.set(m, (counts.get(m) ?? 0) + 1)
  }

  return {
    admitted,
    withheld: documents.length - admitted,
    total: documents.length,
    // Most-withholding attribute first: it is the one worth talking about.
    by: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  }
}

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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {fqns.length === 0 && (
        <span style={{ fontSize: 12, color: 'var(--c-text-5)', fontStyle: 'italic' }}>
          {emptyNote}
        </span>
      )}
      {fqns.map(fqn => (
        <span key={fqn} className="chip chip-mono" style={{
          background: color + '15', color, borderColor: color + '30',
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
    <div className="sai-group">
      <h3>Acting agent</h3>
      <p className="sai-rail-note">
        Entitled in its own right. A document is released only if the platform grants it to
        both of you.
      </p>

      <div className="sai-roster">
        {agents.map(a => (
          <button
            key={a.id}
            onClick={() => setAgentId(a.id)}
            aria-pressed={a.id === agentId}
            className="sai-subject"
            style={{ '--sub': a.color }}
          >
            <span className="sai-subject-ico"><PersonaIcon icon={a.icon} size={18} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="sai-subject-name">{a.name}</div>
              <div className="sai-subject-title mono">{a.title}</div>
            </div>
          </button>
        ))}
      </div>

      {agent && (
        <>
          <h3 style={{ marginTop: 4 }}>Agent attributes</h3>
          <AttrChips
            fqns={agentFqns}
            color={agent.color}
            emptyNote="None. The agent holds no entitlements"
          />
          <p className="sai-rail-note">
            From the agent's own signed token. The KAS cannot tell it apart from a person.
          </p>
        </>
      )}

      {agent?.note && <p className="sai-rail-note">{agent.note}</p>}
    </div>
  )
}

function IdentityPanel() {
  const { personas, persona, personaId, setPersonaId, entityFqns } = useApp()

  return (
    <aside className="sai-rail sai-rail-l" aria-label="Identity">
      <div className="sai-group">
        <h3 className="sai-roster-h">Identity</h3>

        <div className="sai-roster">
          {personas.map(p => (
            <button
              key={p.id}
              onClick={() => setPersonaId(p.id)}
              aria-pressed={p.id === personaId}
              className="sai-subject"
              style={{ '--sub': p.color }}
            >
              <span className="sai-subject-ico"><PersonaIcon icon={p.icon} badge={p.badge} size={20} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="sai-subject-name">{p.name}</div>
                <div className="sai-subject-title">{p.title}</div>
              </div>
            </button>
          ))}
        </div>

        <h3 style={{ marginTop: 4 }}>Resolved attributes</h3>
        <AttrChips
          fqns={entityFqns}
          color={persona.color}
          emptyNote="None. Holds no entitlements"
        />
        <p className="sai-rail-note">
          Read from the signed token the KAS receives, not a UI-side copy.
        </p>
        {persona.note && <p className="sai-rail-note">{persona.note}</p>}
      </div>

      <AgentPanel />
    </aside>
  )
}

function DownIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
    </svg>
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
        title={`Download ${entry.unit.label} as .tdf (${fmtBytes(entry.bytes)}), still encrypted, still policy-bound`}
        aria-label="Download source as .tdf"
        className="btn btn-sm btn-ghost"
        style={{
          flexShrink: 0, width: 24, height: 24, minHeight: 0, padding: 0, justifyContent: 'center',
          cursor: state === 'saving' ? 'wait' : 'pointer', color: tint ?? 'var(--c-text-5)',
        }}
      >{state === 'saved' ? <UiIcon name="check" size={12} strokeWidth={2.4} /> : <DownIcon size={12} />}</button>
    )
  }

  return (
    <div className="sai-source">
      <button
        onClick={click}
        disabled={state === 'saving'}
        className="btn btn-sm"
        style={{
          cursor: state === 'saving' ? 'wait' : 'pointer',
          borderColor: state === 'error' ? 'var(--c-deny-br)' : undefined,
          color: tint ?? undefined,
        }}
      >
        {state === 'saved' ? <UiIcon name="check" size={13} strokeWidth={2.4} /> : <DownIcon size={13} />}
        {state === 'saving' ? 'Choose a location…'
          : state === 'saved' ? 'Saved as .tdf'
          : state === 'error' ? 'Save failed'
          : 'Download source as .tdf'}
      </button>
      <span className="sai-source-text">
        {entry.unit.label}, {fmtBytes(entry.bytes)}, policy travels inside the file
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'flex', flexShrink: 0,
          color: verdict.granted ? 'var(--c-grant)' : 'var(--c-deny)',
        }}><UiIcon name={verdict.granted ? 'check' : 'x'} size={12} strokeWidth={2.6} /></span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-5)', flexShrink: 0 }}>
          {label}
        </span>
        <span style={{
          fontSize: 12, color, minWidth: 0,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{name}</span>
      </div>

      <div style={{ paddingLeft: 18, marginTop: 3 }}>
        {/* An empty policy has no rows to show, and its absence is the interesting fact */}
        {rows.length === 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--c-text-5)', lineHeight: 1.5, fontStyle: 'italic' }}>
            No attributes in the policy: released to any authenticated caller.
          </div>
        )}
        {rows.map(r => (
          <div key={r.attribute} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'flex-start' }}>
            <span style={{
              display: 'flex', flexShrink: 0, marginTop: 2,
              color: r.satisfied ? 'var(--c-grant)' : 'var(--c-deny)',
            }}><UiIcon name={r.satisfied ? 'check' : 'x'} size={11} strokeWidth={2.6} /></span>
            <span className="mono" style={{
              fontSize: 11.5, lineHeight: 1.5,
              color: r.satisfied ? 'var(--c-text-4)' : 'var(--c-deny)',
            }}>
              {r.attribute}:{r.required.length > 3 ? ` any of ${r.required.length}` : ' ' + r.required.join(' | ')}
            </span>
          </div>
        ))}
        {!verdict.granted && verdict.reason && (
          <div style={{ fontSize: 11.5, color: 'var(--c-text-5)', marginTop: 3, lineHeight: 1.5 }}>
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
    <div className={`sai-attempt${granted ? ' is-grant' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          display: 'flex', flexShrink: 0,
          color: granted ? 'var(--c-grant)' : 'var(--c-deny)',
        }}><UiIcon name={granted ? 'check' : 'x'} size={13} strokeWidth={2.6} /></span>
        <span style={{
          fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0,
          color: granted ? 'var(--c-grant)' : 'var(--c-text-4)',
        }}>
          {entry.unit.tierId ? tierName(entry.unit) : 'Rewrap'}
        </span>
        {/* Attribution up here, where the eye lands before it reads the two blocks below */}
        {blockedBy === 'agent' && (
          <span className="chip chip-warn" style={{ height: 20 }}>Agent blocked</span>
        )}
      </div>

      <SubjectRows
        label="You"
        name={persona.name}
        color={persona.color}
        verdict={{ ...user, fqns: entityFqns }}
        policy={policy}
      />

      {/* `absent` means no agent was in play, so there is no second verdict to report */}
      {!agentVerdict.absent && agent && (
        <SubjectRows
          label="Agent"
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, width: 14, height: 16,
        color: ok ? 'var(--c-grant)' : emphasizeMiss ? 'var(--c-warn)' : 'var(--c-text-6)',
      }}
    >
      {ok ? <UiIcon name="check" size={12} strokeWidth={2.6} />
        : emphasizeMiss ? <UiIcon name="x" size={12} strokeWidth={2.8} />
        : <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor' }} />}
    </span>
  )
}

/** How the summary card names the outcome. Attribution is the whole point of a refusal. */
function verdictLabel(trace) {
  if (trace.granted) return 'Key released'
  if (trace.blockedBy === 'agent') return 'Refused to the agent'
  if (trace.blockedBy === 'both') return 'Refused to both'
  return 'Rewrap refused'
}

function blockerNote(trace, persona, agent) {
  if (trace.granted || !trace.blockedBy) return null
  if (trace.blockedBy === 'agent') {
    return `${persona.name} was granted. ${agent?.name ?? 'The agent'} was not, and both are required.`
  }
  if (trace.blockedBy === 'both') {
    return 'Neither subject satisfied the policy.'
  }
  return `${persona.name} did not satisfy the policy.`
}

/**
 * A fresh key per trace, so the verdict's wipe replays on every query — including the same
 * question asked twice, which no field of the trace itself would distinguish.
 */
const traceIds = new WeakMap()
let traceSeq = 0
const traceKey = (t) => {
  if (!traceIds.has(t)) traceIds.set(t, ++traceSeq)
  return traceIds.get(t)
}

function DecisionPanel({ trace, accessMap }) {
  const { documents, persona, agent, entityFqns, agentFqns } = useApp()

  const unit  = decidedUnit(trace)
  const scope = retrievalScope(accessMap, documents, entityFqns, agentFqns)
  const tone  = !trace ? null : !trace.doc ? 'none' : trace.granted ? 'grant' : 'deny'

  return (
    <aside className="sai-rail sai-rail-r" aria-label="KAS decision">
      <div className="sai-group">
        <h3>KAS decision</h3>

        {!trace ? (
          <p className="sai-rail-note" style={{ fontStyle: 'italic' }}>
            Updates after each query. Every verdict here is a real rewrap response from
            the local KAS.
          </p>
        ) : (
          <>
            {/* The moment: the verdict is a strip of colour, and the document it was about is
                either unsealed (wiped into view) or left as an ink bar. */}
            <div key={traceKey(trace)} className={`sai-verdict is-${tone}`}>
              <div className="sai-verdict-head">
                <UiIcon name={tone === 'deny' ? 'x' : 'check'} size={14} strokeWidth={2.6} />
                {tone === 'none' ? 'No document needed' : verdictLabel(trace)}
              </div>
              <div className="sai-verdict-body">
                {/* Which subject failed, before anything about the document. A refusal nobody can
                    attribute is indistinguishable from a bug. */}
                {blockerNote(trace, persona, agent) && (
                  <p className="sai-verdict-why">{blockerNote(trace, persona, agent)}</p>
                )}
                {trace.doc ? (
                  <>
                    <div className="sai-verdict-doc">
                      {trace.granted
                        ? <span className="sai-unseal">{trace.doc.label}</span>
                        : <span className="sai-sealed">{trace.doc.label}</span>}
                    </div>
                    {trace.entry?.unit.tierId && (
                      <div className="sai-verdict-tier">{tierName(trace.entry.unit)}</div>
                    )}
                    <div className="sai-verdict-mark">
                      {unit?.classification ?? trace.doc.classification}
                    </div>
                  </>
                ) : (
                  <div className="sai-verdict-sub">General question, no document retrieved</div>
                )}
              </div>
            </div>

            {/* Directly under the verdict, because on a CUI document the banner in the card above is
                this derivation's output and the two belong together. */}
            {unit && <DerivedBanner policy={unit.policy} compact />}

            {trace.attempts?.length > 0 && (
              <div>
                <h3 style={{ marginBottom: 7 }}>
                  {trace.attempts.length > 1 ? `Rewrap attempts (${trace.attempts.length})` : 'Rewrap attempt'}
                </h3>
                {trace.attempts.map((a, i) => (
                  <RewrapAttempt key={i} attempt={a} />
                ))}
                {trace.attempts.length > 1 && (
                  <p className="sai-rail-note" style={{ marginTop: 2 }}>
                    Tiers are tried most-privileged first; the first tier <em>both</em> subjects can
                    open wins.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="sai-group">
        <h3>Corpus access</h3>

        {/* The retrieval filter, stated as a number rather than left to be inferred from the rows.
            This is the answer to "what did the assistant have to work with" — the question a
            compliance reviewer asks about a RAG system, and the one a chat transcript cannot
            answer, because a withheld document leaves no trace in the conversation. One segment
            per document; ink is what the KAS withheld. */}
        {scope && (
          <div>
            <div className="sai-meter" aria-hidden="true">
              {documents.map(doc => {
                const r = accessMap.get(doc.id)
                return <i key={doc.id} className={r?.granted ? '' : r?.blockedBy === 'agent' ? 'is-agent' : 'is-shut'} />
              })}
            </div>
            <div className="sai-scope">
              <strong>{scope.admitted} of {scope.total}</strong>
              {' '}admitted to retrieval
              {scope.withheld > 0 && <>, {scope.withheld} withheld</>}
            </div>
            {scope.by.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                {scope.by.map(([attr, n]) => (
                  <span key={attr} className="sai-shut-chip" title={`Withheld ${n} document(s)`}>{n}× {attr}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* A legend rather than aligned column headers — "AGENT" is wider than the glyph column
            it would label, and a header that does not line up reads as a mistake. */}
        {agent && <p className="sai-rail-note">Columns: you, then agent</p>}
        <div>
          {!accessMap ? (
            <p className="sai-rail-note" style={{ fontStyle: 'italic' }}>Probing…</p>
          ) : documents.map((doc, i) => {
            const r = accessMap.get(doc.id)
            const ok = r?.granted
            return (
              <div key={doc.id} className={`sai-doc ${ok ? 'is-open' : 'is-shut'}`}>
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
                <span className="sai-doc-label">
                  {ok
                    ? <span className="sai-unseal" style={{ '--i': i }}>{doc.label}</span>
                    : <span className="sai-sealed">{doc.label}</span>}
                  {/* Marked so it is obvious which rows came from a file you added, and which
                      shipped with the scenario. The access decision is identical either way. */}
                  {doc.upload && <span className="sai-doc-sfx is-quiet">, yours</span>}
                  {ok && r.tierId && <span className="sai-doc-sfx">, {r.tierId}</span>}
                  {!ok && r?.blockedBy === 'agent' && <span className="sai-doc-sfx">, agent blocked</span>}
                </span>
                {/* Reachable means exportable. Nothing is offered on a row the KAS refused. */}
                {ok && r.entry && <TdfDownload entry={r.entry} compact />}
              </div>
            )
          })}
        </div>
        <p className="sai-rail-note">
          Measured by actually attempting each rewrap, not predicted.
          {agent && ' A document is reachable only where both columns clear.'}
          {' '}The download button saves the released TDF; it stays encrypted, and its policy is
          still enforced by this KAS.
        </p>
      </div>
    </aside>
  )
}

// ── Messages ──────────────────────────────────────────────────────────────────

function Message({ msg, persona }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`sai-msg${isUser ? ' is-user' : ''}`}>
      <div className="sai-msg-who">{isUser ? persona.name : 'Virtru Secure AI'}</div>
      <div className={`sai-msg-body${msg.denied ? ' is-denied' : ''}${msg.welcome ? ' is-welcome' : ''}`}>
        {msg.content}
        {msg.streaming && <span aria-hidden="true" className="sai-cursor" />}
      </div>

      {/* Only once the answer has finished — a button appearing mid-stream pulls the eye
          away from the text it belongs to. */}
      {msg.source && !msg.streaming && <TdfDownload entry={msg.source} />}
    </div>
  )
}

/** Lines of text being resolved: the same ink bars the sealed documents use, before the wipe. */
function TypingIndicator({ note }) {
  return (
    <div className="sai-msg" role="status">
      <div className="sai-msg-who">Virtru Secure AI</div>
      {note && <div className="sai-resolving-note">{note}</div>}
      <div className="sai-resolving" aria-hidden="true"><span /><span /><span /></div>
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

    const unit = decidedUnit(result)

    logEvent({
      persona: persona.name,
      personaId,
      agent: agent?.name ?? null,
      agentId: agentId ?? null,
      document: doc ? doc.label : 'General query',
      tier: result.entry?.unit.tierId ?? null,
      classification: unit?.classification ?? doc?.classification ?? null,
      granted: doc ? result.granted : true,
      attempts: result.attempts.length,
      // The controlling attribute, which is the column an assessor reads. "Denied" on its own
      // records that a decision happened; naming the shortfall is what makes the entry evidence
      // that policy — and not an outage, a bug, or someone's discretion — did the refusing.
      missing: shortfall(result, entityFqns, agentFqns),
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

      // The unit's marking, not the document's: a mode is free to carry no document-level string
      // and mark each version instead, and `(undefined)` in a chat message is worse than no
      // marking at all.
      const marking = unit?.classification ?? doc.classification
      const named = `${doc.label}${marking ? ` (${marking})` : ''}`

      const opener = result.blockedBy === 'agent'
        ? `You're entitled to that. I'm not.\n\nI'm running as ${agent?.name ?? 'an agent'}, a policy subject with attributes of its own. The platform released ${doc.label} to you and refused it to me — and a document only reaches me when both of us are granted.`
        : result.blockedBy === 'both'
          ? `I don't have that document, and neither of us is entitled to it.\n\nYour query matches ${named}, and the platform refused both subjects.`
          : `I don't have that document.\n\nYour query matches ${named}, and the platform refused to release its key to you.`

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
    <div className="sai-chat-wrap">
      <div className="sai-chat">
        <IdentityPanel />

        <div className="sai-conv">
          <div className="sai-scroll">
            <div className="sai-thread">
              {messages.map((msg, i) => <Message key={i} msg={msg} persona={persona} />)}
              {busy && lastIsUser && (
                <TypingIndicator note={stage === 'retrieving'
                  ? (agent ? 'Asking the KAS to unwrap, for you and for me…' : 'Asking the KAS to unwrap…')
                  : undefined} />
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="sai-foot-bar">
            <div className="sai-foot-in">
              <div className="sai-prompts">
                {mode.prompts.map(p => (
                  <button
                    key={p.label}
                    onClick={() => submitQuery(p.text)}
                    disabled={busy}
                    className="sai-prompt"
                  >{p.label}</button>
                ))}
              </div>

              <div className="sai-composer">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
                  }}
                  disabled={busy}
                  placeholder="Message Virtru Secure AI…"
                  aria-label="Message"
                  rows={1}
                />
                <button
                  onClick={submit}
                  disabled={busy || !input.trim()}
                  className="btn btn-primary"
                  aria-label="Send"
                  style={{ flexShrink: 0, width: 34, height: 34, padding: 0, justifyContent: 'center' }}
                >
                  <span style={{ display: 'flex', transform: 'rotate(-90deg)' }}>
                    <UiIcon name="arrowRight" size={16} strokeWidth={2.2} />
                  </span>
                </button>
              </div>

              <div className="sai-note">
                Documents held as TDF, {agent ? 'every answer gated by two live KAS rewraps' : 'every answer gated by a live KAS rewrap'}, model via Virtru AI Gateway
              </div>
            </div>
          </div>
        </div>

        <DecisionPanel trace={trace} accessMap={accessMap} />
      </div>
    </div>
  )
}
