import { useState, useEffect } from 'react'
import { useDemo } from '../../context/DemoContext.jsx'
import { COMMERCIAL_SCENARIOS, FEDERAL_SCENARIOS } from '../../data/sectors.js'
import Icon from '../../components/Icon.jsx'

function StepRow({ step, status }) {
  // status: 'pending' | 'active' | 'done'
  const isDenied = step.result === 'denied'
  return (
    <div className="flex items-start gap-3 py-2 transition-all"
      style={{ opacity: status === 'pending' ? 0.3 : 1 }}>
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
          style={{
            background: status === 'done' && isDenied ? '#7f1d1d'
              : status === 'done' ? 'var(--c-success-bg)'
              : status === 'active' ? '#1e3a5f'
              : 'var(--c-surface-2)',
            border: `1.5px solid ${status === 'done' && isDenied ? '#ef4444'
              : status === 'done' ? '#22c55e'
              : status === 'active' ? '#3b82f6'
              : 'var(--c-border)'}`,
          }}>
          {status === 'active' ? '●'
            : status === 'done' && isDenied ? '✗'
            : status === 'done' ? '✓'
            : '·'}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold"
            style={{ color: status === 'done' && isDenied ? '#f87171' : status === 'done' ? '#4ade80' : status === 'active' ? '#93c5fd' : 'var(--c-text-3)' }}>
            {step.actor}
          </span>
          <span className="text-xs" style={{ color: 'var(--c-text-6)' }}>{step.ts}</span>
        </div>
        <div className="text-sm mt-0.5"
          style={{ color: status === 'done' && isDenied ? '#fca5a5' : status === 'done' ? '#86efac' : status === 'active' ? 'var(--c-text-2)' : 'var(--c-text-4)' }}>
          {step.action}
        </div>
        {status === 'active' && step.detail && (
          <div className="mt-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: '#0d2238', color: '#93c5fd', border: '1px solid #1e4a7a' }}>
            {step.detail}
          </div>
        )}
        {status === 'done' && isDenied && (
          <div className="mt-1 inline-block px-2 py-0.5 rounded text-xs font-bold"
            style={{ background: '#7f1d1d', color: '#f87171', border: '1px solid #ef4444' }}>
            <Icon name="blocked" size={12} /> ACCESS DENIED
          </div>
        )}
      </div>
    </div>
  )
}

// Maps scenario id → the persona id it's most relevant to
const SCENARIO_PERSONA = {
  'terminated':          'alice',
  'contractor':          'bob',
  'manda':               'carol',
  'it-boundary':         'dave',
  'clearance-revoked':   'sarah',
  'coalition-overshare': 'james',
  'mission-compartment': 'marcus',
  'legal-hold':          'patricia',
}

export default function ScenarioPage() {
  const { sector, activePersona } = useDemo()
  const SCENARIOS = sector === 'federal' ? FEDERAL_SCENARIOS : COMMERCIAL_SCENARIOS
  const [stepIdx, setStepIdx] = useState({})   // scenario.id → current step index (-1 = not started)
  const [active, setActive] = useState({})     // scenario.id → true = in progress
  const [done, setDone] = useState({})         // scenario.id → true = completed

  useEffect(() => {
    setStepIdx({})
    setActive({})
    setDone({})
  }, [sector])

  function startScenario(scenario) {
    setActive(prev => ({ ...prev, [scenario.id]: true }))
    setDone(prev => ({ ...prev, [scenario.id]: false }))
    setStepIdx(prev => ({ ...prev, [scenario.id]: 0 }))
  }

  function stepForward(scenario) {
    const idx = stepIdx[scenario.id] ?? 0
    if (idx < scenario.steps.length - 1) {
      setStepIdx(prev => ({ ...prev, [scenario.id]: idx + 1 }))
    } else {
      // Reached last step — mark done
      setActive(prev => ({ ...prev, [scenario.id]: false }))
      setDone(prev => ({ ...prev, [scenario.id]: true }))
    }
  }

  function stepBack(scenario) {
    const idx = stepIdx[scenario.id] ?? 0
    if (idx > 0) {
      setStepIdx(prev => ({ ...prev, [scenario.id]: idx - 1 }))
    }
  }

  function resetScenario(id) {
    setActive(prev => ({ ...prev, [id]: false }))
    setDone(prev => ({ ...prev, [id]: false }))
    setStepIdx(prev => ({ ...prev, [id]: -1 }))
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--c-text-1)' }}>Guided Scenarios</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--c-text-4)' }}>
          Walk through real-world use cases step by step and see how DSP responds at each stage.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {SCENARIOS.map(scenario => {
          const idx = stepIdx[scenario.id] ?? -1
          const isActive = active[scenario.id]
          const isDone = done[scenario.id]
          const notStarted = !isActive && !isDone
          const isRelevant = activePersona.id !== 'generic' && SCENARIO_PERSONA[scenario.id] === activePersona.id

          return (
            <div key={scenario.id} className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--c-surface)',
                border: `1px solid ${isRelevant ? activePersona.color + '66' : 'var(--c-border)'}`,
                boxShadow: isRelevant ? `0 0 0 1px ${activePersona.color}33` : 'none',
              }}>
              {/* Header */}
              <div className="px-6 py-4 flex items-start justify-between"
                style={{ borderBottom: '1px solid var(--c-border)' }}>
                <div className="flex items-center gap-4">
                  <Icon name={scenario.icon} size={44} fallback={<span className="text-4xl">{scenario.icon}</span>} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-lg" style={{ color: 'var(--c-text-1)' }}>{scenario.title}</div>
                      {isRelevant && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: activePersona.color + '22', color: activePersona.color, border: `1px solid ${activePersona.color}44` }}>
                          {activePersona.avatar} Relevant to {activePersona.name.split(' ')[0]}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-0.5" style={{ color: 'var(--c-text-4)' }}>{scenario.tagline}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {notStarted && (
                    <button
                      onClick={() => startScenario(scenario)}
                      className="px-4 py-2 rounded-lg font-semibold text-sm transition-all cursor-pointer"
                      style={{ background: 'linear-gradient(135deg, #1e3a5f, #2d4a7a)', color: '#60a5fa', border: '1px solid #3b82f6' }}>
                      ▶ Run Scenario
                    </button>
                  )}
                  {isActive && (
                    <>
                      <span className="text-xs" style={{ color: 'var(--c-text-5)' }}>
                        Step {idx + 1} of {scenario.steps.length}
                      </span>
                      <button
                        onClick={() => stepBack(scenario)}
                        disabled={idx === 0}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer"
                        style={{
                          background: idx === 0 ? 'var(--c-border)' : '#1e3a5f',
                          color: idx === 0 ? 'var(--c-text-6)' : '#60a5fa',
                          border: `1px solid ${idx === 0 ? 'var(--c-border-2)' : '#3b82f6'}`,
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        }}>
                        ◀
                      </button>
                      <button
                        onClick={() => stepForward(scenario)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all cursor-pointer"
                        style={{ background: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f6' }}>
                        ▶
                      </button>
                      <button
                        onClick={() => resetScenario(scenario.id)}
                        className="px-3 py-2 rounded-lg text-xs cursor-pointer transition-all"
                        style={{ background: 'var(--c-border)', color: 'var(--c-text-4)', border: '1px solid var(--c-border-2)' }}>
                        ✕ Stop
                      </button>
                    </>
                  )}
                  {isDone && (
                    <button
                      onClick={() => resetScenario(scenario.id)}
                      className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-all"
                      style={{ background: 'var(--c-border)', color: 'var(--c-text-4)', border: '1px solid var(--c-border-2)' }}>
                      ↺ Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Steps */}
              {(isActive || isDone) && (
                <div className="px-6 py-4">
                  <div className="flex flex-col divide-y"
                    style={{ borderTop: '1px solid var(--c-border)', '--tw-divide-opacity': 1 }}>
                    {scenario.steps.map((step, i) => {
                      const status = isDone || i < idx ? 'done'
                        : i === idx ? 'active'
                        : 'pending'
                      return <StepRow key={i} step={step} status={status} />
                    })}
                  </div>

                  {/* Outcome banner */}
                  {isDone && (
                    <div className="mt-4 rounded-xl px-5 py-4 step-in"
                      style={{ background: '#0d1f1a', border: '2px solid #22c55e' }}>
                      <div className="flex items-center gap-3">
                        <Icon name="lock" size={28} />
                        <div>
                          <div className="font-bold" style={{ color: '#4ade80' }}>Outcome</div>
                          <div className="text-sm mt-0.5" style={{ color: '#86efac' }}>{scenario.outcome}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Not yet run */}
              {notStarted && (
                <div className="px-6 py-3 text-xs" style={{ color: 'var(--c-text-5)' }}>
                  {scenario.steps.length} steps — click Run to walk through
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
