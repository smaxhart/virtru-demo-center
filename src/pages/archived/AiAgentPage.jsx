import { useState, useRef, useEffect, useCallback } from 'react'
import { useDemo } from '../../context/DemoContext.jsx'
import { FEDERAL_PERSONAS } from '../../data/sectors.js'
import { classifyQuery, checkAccess, buildSystemPrompt, TOPICS } from '../../ai/policyEngine.js'
import { streamChat } from '../../ai/gatewayClient.js'

const CHAT_PERSONAS = FEDERAL_PERSONAS.filter(p => p.id !== 'generic')

// Uniform suggestions shown to all personas — policy engine determines outcome per user
const CANNED_PROMPTS = [
  { label: 'SIGINT intercepts',         text: 'What intercepts are flagged in the SIGINT collection summary?' },
  { label: 'Q3 threat vectors',         text: 'Give me the Q3 threat briefing highlights.' },
  { label: 'FVEY maritime assessment',  text: 'What did the FVEY partners contribute to the joint maritime assessment?' },
  { label: 'NATO COASTAL SHIELD',       text: 'What is the NATO joint ops plan for Operation COASTAL SHIELD?' },
  { label: 'Article 32 investigation',  text: 'What are the details of the UCMJ Article 32 investigation?' },
  { label: 'Cyber audit findings',      text: 'What does the infrastructure security audit show?' },
  { label: 'Patient Jane Doe',          text: 'What is the status of patient Jane Doe from MCI case 47?' },
  { label: 'How does KAS work?',        text: 'How does the KAS enforce policy on every decrypt?' },
]

const WELCOME = {
  role: 'assistant',
  content: `Hello. I'm your secure AI assistant, operating within the Virtru Data Security Platform.

Every query I receive is evaluated against your current entitlements before I retrieve any information. If your credentials don't satisfy the policy on a document, I won't have access to it — and I'll tell you why.

Ask me anything.`,
}

function PersonaPanel({ persona, onSelect }) {
  return (
    <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', paddingRight: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-5)', padding: '4px 2px' }}>IDENTITY</div>
      {CHAT_PERSONAS.map(p => {
        const active = p.id === persona.id
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
              background: active ? persona.color + '18' : 'var(--c-surface)',
              border: `1.5px solid ${active ? persona.color : 'var(--c-border)'}`,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }}>{p.avatar}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: active ? persona.color : 'var(--c-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
              <div style={{ fontSize: 10, color: 'var(--c-text-5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{p.title}</div>
            </div>
          </button>
        )
      })}

      {/* Entitlements */}
      <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-5)', marginBottom: 8 }}>ENTITLEMENTS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {persona.attributes.filter(a => !a.startsWith('relto:')).length === 0 && (
            <span style={{ fontSize: 10, color: 'var(--c-text-5)', fontStyle: 'italic' }}>None</span>
          )}
          {persona.attributes.filter(a => !a.startsWith('relto:')).map(a => (
            <span key={a} style={{
              fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
              background: persona.color + '18',
              color: persona.color,
              border: `1px solid ${persona.color}30`,
            }}>{a}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

function PolicyPanel({ trace }) {
  if (!trace) return (
    <div style={{ width: 220, flexShrink: 0, padding: '12px 14px', borderRadius: 8, background: 'var(--c-surface)', border: '1px solid var(--c-border)', height: 'fit-content' }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-5)', marginBottom: 6 }}>POLICY DETAILS</div>
      <div style={{ fontSize: 11, color: 'var(--c-text-6)', fontStyle: 'italic' }}>Updated after each query</div>
    </div>
  )

  const { topic, allowed, missing, missingCoi, tier, persona } = trace

  const personaAttrs = persona?.attributes ?? []
  const personaNation = personaAttrs.find(a => a.startsWith('nationality:'))?.replace('nationality:', '') ?? null

  return (
    <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, height: 'fit-content' }}>
      {/* verdict */}
      <div style={{
        padding: '10px 12px', borderRadius: 8,
        background: allowed ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)',
        border: `1px solid ${allowed ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: allowed ? '#15803d' : '#b91c1c', marginBottom: 2 }}>
          {allowed ? '✓ ACCESS GRANTED' : '✗ ACCESS DENIED'}
        </div>
        {topic ? (
          <div style={{ fontSize: 10, color: 'var(--c-text-5)', lineHeight: 1.5 }}>
            <div>{topic.label}</div>
            {tier && <div style={{ marginTop: 1, color: '#d97706', fontWeight: 600 }}>{tier.label}</div>}
            <div style={{ marginTop: 2, color: allowed ? '#15803d' : '#dc2626', fontWeight: 500 }}>{tier ? tier.classification : topic.classification}</div>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--c-text-5)' }}>General query — no classification</div>
        )}
      </div>

      {/* tiered access ladder */}
      {topic?.tiers && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-5)', marginBottom: 6 }}>ACCESS TIERS</div>
          {topic.tiers.map(t => {
            const granted = tier?.id === t.id
            const denied = !granted
            return (
              <div key={t.id} style={{
                padding: '6px 8px', borderRadius: 6, marginBottom: 4,
                background: granted ? 'rgba(74,222,128,0.08)' : 'rgba(0,0,0,0.0)',
                border: `1px solid ${granted ? 'rgba(74,222,128,0.3)' : 'var(--c-border)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ color: granted ? '#15803d' : 'var(--c-text-6)', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{granted ? '✓' : '·'}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: granted ? '#15803d' : 'var(--c-text-4)' }}>{t.label}</span>
                </div>
                <div style={{ fontSize: 9, color: 'var(--c-text-6)', marginTop: 2, paddingLeft: 14 }}>{t.classification}</div>
              </div>
            )
          })}
          {!tier && (
            <div style={{ fontSize: 10, color: '#b91c1c', marginTop: 2 }}>No tier matched — access denied</div>
          )}
        </div>
      )}

      {/* required attributes (non-tiered topics) */}
      {topic && !topic.tiers && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-5)', marginBottom: 6 }}>REQUIRED ATTRIBUTES</div>
          {topic.requiredFqns.map(fqn => {
            const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
            const short = m ? `${m[1]}:${m[2]}` : fqn
            const held = (() => {
              const expanded = new Set(personaAttrs)
              if (expanded.has('clearance:ts-sci')) { expanded.add('clearance:secret'); expanded.add('clearance:cui'); expanded.add('clearance:unclassified') }
              if (expanded.has('clearance:secret')) { expanded.add('clearance:cui'); expanded.add('clearance:unclassified') }
              if (expanded.has('clearance:cui')) expanded.add('clearance:unclassified')
              return expanded.has(short)
            })()
            return (
              <div key={fqn} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: held ? '#15803d' : '#b91c1c', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{held ? '✓' : '✗'}</span>
                <span style={{ fontSize: 11, color: held ? 'var(--c-text-3)' : '#b91c1c' }}>{short}</span>
              </div>
            )
          })}
          {topic.coiNationalities && (() => {
            const coiName = topic.id === 'fvey' ? 'FVEY' : 'NATO'
            const inCoi = personaNation && topic.coiNationalities.includes(personaNation)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: inCoi ? '#15803d' : '#b91c1c', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{inCoi ? '✓' : '✗'}</span>
                <span style={{ fontSize: 11, color: inCoi ? 'var(--c-text-3)' : '#b91c1c' }}>
                  {coiName} member{personaNation ? ` (${personaNation})` : ''}
                </span>
              </div>
            )
          })()}
        </div>
      )}

      {/* corpus access map */}
      <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--c-text-5)', marginBottom: 6 }}>CORPUS ACCESS</div>
        {TOPICS.map(t => {
          const { allowed: a } = checkAccess(t, persona)
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
              <span style={{ color: a ? '#15803d' : 'var(--c-text-6)', fontSize: 11, flexShrink: 0 }}>{a ? '✓' : '·'}</span>
              <span style={{ fontSize: 10, color: a ? 'var(--c-text-4)' : 'var(--c-text-6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Message({ msg, persona }) {
  const isUser = msg.role === 'user'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 4,
    }}>
      <div style={{ fontSize: 10, color: 'var(--c-text-5)', paddingLeft: isUser ? 0 : 4, paddingRight: isUser ? 4 : 0 }}>
        {isUser ? persona.name : 'Virtru Secure AI'}
      </div>
      <div style={{
        maxWidth: '72%',
        padding: '11px 14px',
        borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
        background: isUser ? '#1e3a5f' : 'var(--c-surface)',
        border: isUser ? 'none' : '1px solid var(--c-border)',
        color: isUser ? '#e2e8f0' : 'var(--c-text-2)',
        fontSize: 13,
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
        {msg.streaming && <span style={{ opacity: 0.4 }}>▋</span>}
      </div>
    </div>
  )
}

export default function AiAgentPage() {
  const { activePersona, logEvent } = useDemo()

  const [persona, setPersona] = useState(
    () => CHAT_PERSONAS.find(p => p.id === activePersona?.id) ?? CHAT_PERSONAS[0]
  )
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput]       = useState('')
  const [trace, setTrace]       = useState(null)
  const [busy, setBusy]         = useState(false)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [input])

  const handlePersonaChange = (p) => {
    setPersona(p)
    setMessages([WELCOME])
    setTrace(null)
  }

  const submitQuery = useCallback(async (query) => {
    if (!query || busy) return
    setBusy(true)

    setMessages(prev => [...prev, { role: 'user', content: query }])

    const topic = classifyQuery(query)
    const { allowed, missing, missingCoi, tier } = checkAccess(topic, persona)

    setTrace({ topic, allowed, missing, missingCoi, tier, persona })

    logEvent({
      type:     allowed ? 'decrypt' : 'decrypt-denied',
      persona,
      document: topic ? `${topic.label}${tier ? ` (${tier.label})` : ''}` : 'General query',
      result:   allowed ? 'granted' : 'denied',
      reason:   allowed
        ? tier ? `Tier granted: ${tier.label}` : 'Entitlements satisfied'
        : `No tier matched — insufficient entitlements`,
    })

    if (!allowed) {
      await new Promise(r => setTimeout(r, 500))
      const blockMsg = topic?.tiers
        ? `I'm unable to retrieve that information.\n\nThe query matches **${topic.label}**. This record has tiered access:\n- Full record (PII + treatment): requires mission:legal\n- Status only: requires mission:intel, mission:ops, needtoknow:intel, or needtoknow:ops\n\nYour current entitlements don't satisfy any access tier.`
        : `I'm unable to retrieve that information.\n\nThe query matches **${topic.label}** (${topic.classification}). Access requires: ${[...missing.map(fqn => { const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/); return m ? `${m[1]}:${m[2]}` : fqn }), missingCoi].filter(Boolean).join(', ')}. Your current entitlements don't satisfy that policy.`
      setMessages(prev => [...prev, { role: 'assistant', content: blockMsg }])
      setBusy(false)
      return
    }

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user', content: query })

    const systemPrompt = buildSystemPrompt(topic, persona, tier)

    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      await streamChat(systemPrompt, history, (chunk) => {
        setMessages(prev => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + chunk }
          return next
        })
      })
    } catch (err) {
      setMessages(prev => {
        const next = [...prev]
        if (next[next.length - 1]?.streaming) next.pop()
        return [...next, { role: 'assistant', content: `Gateway error: ${err.message}` }]
      })
    }

    setMessages(prev => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last?.streaming) next[next.length - 1] = { ...last, streaming: false }
      return next
    })

    setBusy(false)
  }, [busy, persona, messages, logEvent])

  const submit = useCallback(() => {
    const query = input.trim()
    if (!query) return
    setInput('')
    submitQuery(query)
  }, [input, submitQuery])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden', background: 'var(--c-bg)', gap: 16, padding: 16 }}>

      {/* LEFT — identity */}
      <PersonaPanel persona={persona} onSelect={handlePersonaChange} />

      {/* CENTER — chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 12 }}>
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} persona={persona} />
          ))}
          {/* Typing indicator when policy check is running before stream starts */}
          {busy && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-5)', paddingLeft: 4 }}>Virtru Secure AI</div>
              <div style={{ padding: '12px 16px', borderRadius: '4px 14px 14px 14px', background: 'var(--c-surface)', border: '1px solid var(--c-border)', display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-5)', display: 'inline-block', animation: 'bounce 1.2s ease-in-out infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-5)', display: 'inline-block', animation: 'bounce 1.2s ease-in-out 0.2s infinite' }} />
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-text-5)', display: 'inline-block', animation: 'bounce 1.2s ease-in-out 0.4s infinite' }} />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Canned prompt chips */}
        <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {CANNED_PROMPTS.map(p => (
            <button
              key={p.label}
              onClick={() => submitQuery(p.text)}
              disabled={busy}
              style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 20,
                background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                color: 'var(--c-text-3)', cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1, transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.borderColor = persona.color; if (!busy) e.currentTarget.style.color = persona.color }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-text-3)' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input box */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'flex-end', gap: 10,
          padding: '10px 12px',
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          borderRadius: 12,
          marginTop: 8,
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            placeholder="Message Virtru Secure AI..."
            rows={1}
            style={{
              flex: 1, resize: 'none', border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--c-text-1)',
              fontSize: 14, lineHeight: 1.5, fontFamily: 'inherit',
              maxHeight: 160, overflow: 'auto',
            }}
          />
          <button
            onClick={submit}
            disabled={busy || !input.trim()}
            style={{
              flexShrink: 0, width: 34, height: 34, borderRadius: 8,
              background: busy || !input.trim() ? 'var(--c-surface-2)' : '#1e40af',
              border: '1px solid var(--c-border)',
              color: busy || !input.trim() ? 'var(--c-text-5)' : '#fff',
              cursor: busy || !input.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, transition: 'all 0.15s',
            }}
          >
            ↑
          </button>
        </div>

        <div style={{ marginTop: 5, textAlign: 'center', fontSize: 10, color: 'var(--c-text-6)' }}>
          Policy enforced at retrieval layer · Powered by Virtru AI Gateway
        </div>
      </div>

      {/* RIGHT — policy details */}
      <PolicyPanel trace={trace} />

    </div>
  )
}
