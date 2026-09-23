import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { corpusUnits } from '../ai/corpus.js'
import PersonaIcon from '../components/PersonaIcon.jsx'
import BootGate from '../components/BootGate.jsx'
import { aiPath } from '../routes.js'

/**
 * The mode launcher.
 *
 * Five scenarios over one platform. Every mode carries its own personas and its own corpus;
 * none of them carry their own enforcement — the same KAS, the same namespace, the same
 * subject mappings decide all five. That is the point worth making on the way in, so the
 * footer says it explicitly.
 */

function ModeCard({ mode, onLaunch, onEdit }) {
  const [hover, setHover] = useState(false)
  const units = corpusUnits(mode.documents).length
  const tiered = mode.documents.filter(d => d.tiers).length

  return (
    <button
      onClick={() => onLaunch(mode.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="card"
      style={{
        textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        borderColor: hover ? mode.accent : 'var(--c-border)',
        boxShadow: hover ? 'var(--c-shadow-md)' : 'var(--c-shadow-sm)',
        transform: hover ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
      }}
    >
      {/* Accent stripe — the only place a mode's color appears before you enter it */}
      <div style={{ height: 3, background: mode.accent, flexShrink: 0 }} />

      <div style={{ padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
          <span style={{ color: mode.accent, display: 'flex' }}>
            <PersonaIcon icon={mode.icon} size={21} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text-1)' }}>{mode.name}</span>
          {mode.isUserBuilt && (
            <span className="mono" style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: '0.05em', padding: '2px 5px',
              borderRadius: 3, color: mode.accent,
              background: mode.accent + '14', border: `1px solid ${mode.accent}30`,
            }}>YOURS</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: mode.accent, fontWeight: 600, marginBottom: 10 }}>
          {mode.tagline}
        </div>

        <div style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--c-text-4)', marginBottom: 14 }}>
          {mode.premise}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {mode.teaches.map(t => (
            <div key={t.title} style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
              <span style={{ color: mode.accent, fontSize: 10, flexShrink: 0 }}>◆</span>
              <span style={{ fontSize: 11.5, color: 'var(--c-text-3)', fontWeight: 500 }}>{t.title}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12,
          borderTop: '1px solid var(--c-border)',
        }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--c-text-6)' }}>
            {mode.personas.length} personas · {mode.agents.length} agents
            {' · '}{mode.documents.length} docs
            {tiered > 0 && ` · ${units} TDFs`}
          </span>
          <div style={{ flex: 1 }} />
          {/* A span rather than a button, because the whole card already is one */}
          {mode.isUserBuilt && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); onEdit(mode.id) }}
              style={{
                fontSize: 11, fontWeight: 600, color: 'var(--c-text-5)', cursor: 'pointer',
                padding: '2px 8px', borderRadius: 5, border: '1px solid var(--c-border)',
              }}
            >
              Edit
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600, color: hover ? mode.accent : 'var(--c-text-5)',
            transition: 'color 0.15s',
          }}>
            Launch →
          </span>
        </div>
      </div>
    </button>
  )
}

export default function HomePage() {
  const { modes, platformPhase, version, exitMode, modeId } = useApp()
  const navigate = useNavigate()

  // Landing here means leaving whatever mode was open, so the persona resets. The encrypted
  // vault stays cached, so relaunching the same mode does not re-encrypt.
  useEffect(() => { if (modeId) exitMode() }, [modeId, exitMode])

  if (platformPhase !== 'ready') {
    return (
      <div style={{ height: '100%', background: 'var(--c-bg)' }}>
        <BootGate />
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--c-bg)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '10px 32px 48px' }}>

        <div style={{ marginBottom: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
              Virtru Secure AI
            </h1>
            {version && <span className="mono" style={{ fontSize: 10, color: 'var(--c-text-6)' }}>v{version}</span>}
          </div>
          <p style={{
            fontSize: 13, lineHeight: 1.7, color: 'var(--c-text-4)',
            margin: '10px 0 0', maxWidth: 720,
          }}>
            An AI assistant that cannot read what you cannot read. Every document below is
            encrypted into a real TDF with its policy bound inside it, and every answer requires
            a live key release from a local KAS. Pick a scenario to see what that changes.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16,
        }}>
          {modes.map(mode => (
            <ModeCard
              key={mode.id} mode={mode}
              onLaunch={(id) => navigate(aiPath(id, 'chat'))}
              onEdit={(id) => navigate(aiPath('build', id))}
            />
          ))}

          {/* Not a mode, so it deliberately does not look like one */}
          <button
            onClick={() => navigate(aiPath('build'))}
            className="card"
            style={{
              textAlign: 'left', padding: '18px 20px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 8,
              borderStyle: 'dashed', background: 'transparent',
              minHeight: 150, justifyContent: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ color: 'var(--c-text-5)', fontSize: 18, lineHeight: 1 }}>＋</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--c-text-2)' }}>
                Build your own scenario
              </span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.65, color: 'var(--c-text-5)' }}>
              Invent the attributes a customer actually uses, decide who holds them, and put
              documents under policy in their vocabulary rather than a stand-in. Saving seeds the
              definitions into this platform and encrypts the corpus, so it enforces for real.
              Export the result and someone else can import it.
            </div>
          </button>
        </div>

        <div className="card" style={{
          marginTop: 20, padding: '14px 18px', background: 'var(--c-surface-2)',
          fontSize: 11.5, lineHeight: 1.75, color: 'var(--c-text-5)',
        }}>
          <strong style={{ color: 'var(--c-text-3)' }}>One platform, four vocabularies.</strong>{' '}
          The scenarios differ only in their attributes and their documents. They share a single
          namespace, a single set of subject mappings, and a single KAS — so a policy written for
          clearances and a policy written for CUI categories are enforced by exactly the same
          code path. Launching a mode encrypts its corpus on the spot; the first launch of each
          takes a few seconds, and returning to one is instant.
        </div>
      </div>
    </div>
  )
}
