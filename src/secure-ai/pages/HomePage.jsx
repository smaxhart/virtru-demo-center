import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { corpusUnits } from '../ai/corpus.js'
import PersonaIcon from '../components/PersonaIcon.jsx'
import BootGate from '../components/BootGate.jsx'
import UiIcon from '../../components/UiIcon.jsx'
import { aiPath } from '../routes.js'

/**
 * The mode launcher.
 *
 * Five scenarios over one platform. Every mode carries its own personas and its own corpus;
 * none of them carry their own enforcement — the same KAS, the same namespace, the same
 * subject mappings decide all five. That is the point worth making on the way in, so the
 * footer says it explicitly.
 */

function ModeRow({ mode, onLaunch, onEdit }) {
  const units = corpusUnits(mode.documents).length
  const tiered = mode.documents.filter(d => d.tiers).length

  return (
    <li>
      {/* The accent is the only place a mode's colour appears before you enter it */}
      <button onClick={() => onLaunch(mode.id)} className="sai-mode" style={{ '--accent': mode.accent }}>
        <div>
          <div className="sai-mode-head">
            <span className="sai-mode-icon"><PersonaIcon icon={mode.icon} size={21} /></span>
            <div style={{ minWidth: 0 }}>
              <div className="sai-mode-name">
                {mode.name}
                {mode.isUserBuilt && <span className="sai-mode-yours">Yours</span>}
              </div>
              <div className="sai-mode-tag">{mode.tagline}</div>
              <div className="sai-mode-counts">
                <span>{mode.personas.length} personas</span>
                <span>{mode.agents.length} agents</span>
                <span>{mode.documents.length} docs</span>
                {tiered > 0 && <span>{units} TDFs</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="sai-mode-body">
          <p className="sai-mode-premise">{mode.premise}</p>
          <ul className="sai-mode-teaches">
            {mode.teaches.map(t => <li key={t.title}>{t.title}</li>)}
          </ul>
        </div>

        <div className="sai-mode-meta">
          {/* A span rather than a button, because the whole row already is one */}
          {mode.isUserBuilt && (
            <span role="button" tabIndex={0} className="sai-mode-edit"
              onClick={(e) => { e.stopPropagation(); onEdit(mode.id) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onEdit(mode.id) } }}>
              Edit
            </span>
          )}
          <span className="sai-mode-go">Launch <UiIcon name="arrowRight" size={14} strokeWidth={2.2} /></span>
        </div>
      </button>
    </li>
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
      <section className="sai-hero">
        <div className="sai-hero-in">
          <div>
            <h1>Virtru Secure AI</h1>
            <p>
              An AI assistant that cannot read what you cannot read. Every document below is
              encrypted into a real TDF with its policy bound inside it, and every answer requires
              a live key release from a local KAS. Pick a scenario to see what that changes.
            </p>
          </div>
          {version && <span className="sai-ver">v{version}</span>}
        </div>
      </section>

      <div className="sai-launch">
        <ol className="sai-modes">
          {modes.map(mode => (
            <ModeRow
              key={mode.id} mode={mode}
              onLaunch={(id) => navigate(aiPath(id, 'chat'))}
              onEdit={(id) => navigate(aiPath('build', id))}
            />
          ))}
        </ol>

        {/* Not a mode, so it deliberately does not look like one */}
        <button onClick={() => navigate(aiPath('build'))} className="sai-build">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-4)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" style={{ marginTop: 2, flexShrink: 0 }}>
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span>
            <span className="sai-build-title">Build your own scenario</span>
            <span className="sai-build-body" style={{ display: 'block' }}>
              Invent the attributes a customer actually uses, decide who holds them, and put
              documents under policy in their vocabulary rather than a stand-in. Saving seeds the
              definitions into this platform and encrypts the corpus, so it enforces for real.
              Export the result and someone else can import it.
            </span>
          </span>
        </button>

        <div className="sai-foot">
          <strong>One platform, four vocabularies.</strong>{' '}
          The scenarios differ only in their attributes and their documents. They share a single
          namespace, a single set of subject mappings, and a single KAS, so a policy written for
          clearances and a policy written for CUI categories are enforced by exactly the same
          code path. Launching a mode encrypts its corpus on the spot; the first launch of each
          takes a few seconds, and returning to one is instant.
        </div>
      </div>
    </div>
  )
}
