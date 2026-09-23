import { useState, useMemo } from 'react'
import { useDemo } from '../../context/DemoContext.jsx'
import { FEDERAL_PERSONAS, COALITION_GROUPS } from '../../data/sectors.js'
import Icon from '../../components/Icon.jsx'

// ─── Constants ────────────────────────────────────────────────────────────────

const COALITION_DOCS = [
  {
    id: 'fvey-only',
    banner: 'SECRET // REL TO FVEY',
    title: 'FVEY Eyes Only Brief',
    required: [
      { attr: 'clearance', min: 'secret' },
      { attr: 'relto', value: 'fvey' },
    ],
  },
  {
    id: 'nato-share',
    banner: 'SECRET // REL TO NATO',
    title: 'NATO Alliance Threat Digest',
    required: [
      { attr: 'clearance', min: 'secret' },
      { attr: 'relto', value: 'nato' },
    ],
  },
  {
    id: 'pink-doc',
    banner: 'CONFIDENTIAL // REL TO PINK',
    title: 'PINK Partnership Report',
    required: [
      { attr: 'clearance', min: 'secret' },
      { attr: 'relto', value: 'pink' },
    ],
  },
  {
    id: 'ts-noforn',
    banner: 'TS // NOFORN // NTK INTEL',
    title: 'NOFORN Eyes Only Assessment',
    required: [
      { attr: 'clearance', min: 'ts-sci' },
      { attr: 'needtoknow', value: 'intel' },
    ],
  },
  {
    id: 'open',
    banner: 'UNCLASSIFIED // REL TO ALL',
    title: 'Exercise Coordination Brief',
    required: [],
  },
]

const CLEARANCE_ORDER = ['unclassified', 'confidential', 'secret', 'ts-sci']

// ─── Access Logic ─────────────────────────────────────────────────────────────

function checkAccess(persona, doc) {
  if (doc.required.length === 0) {
    return { granted: true, reason: 'No restrictions — open access', checks: [] }
  }

  const checks = []
  let granted = true

  for (const req of doc.required) {
    if (req.attr === 'clearance') {
      const personaClearance = persona.attributes.find(a => a.startsWith('clearance:'))?.split(':')[1]
      const personaLevel = CLEARANCE_ORDER.indexOf(personaClearance)
      const requiredLevel = CLEARANCE_ORDER.indexOf(req.min)
      const pass = personaLevel >= requiredLevel
      checks.push({
        label: `clearance >= ${req.min}`,
        personaValue: personaClearance || 'none',
        pass,
        rule: 'HIERARCHY',
      })
      if (!pass) granted = false
    } else if (req.attr === 'relto') {
      const pass = persona.attributes.includes(`relto:${req.value}`)
      checks.push({
        label: `relto:${req.value}`,
        personaValue: persona.attributes.filter(a => a.startsWith('relto:')).join(', ') || 'none',
        pass,
        rule: 'ANY_OF',
      })
      if (!pass) granted = false
    } else if (req.attr === 'needtoknow') {
      const pass = persona.attributes.includes(`needtoknow:${req.value}`)
      checks.push({
        label: `needtoknow:${req.value}`,
        personaValue: persona.attributes.find(a => a.startsWith('needtoknow:')) || 'none',
        pass,
        rule: 'ALL_OF',
      })
      if (!pass) granted = false
    }
  }

  return {
    granted,
    checks,
    reason: granted
      ? 'All attributes satisfied — KAS returns DEK'
      : `Missing: ${checks.filter(c => !c.pass).map(c => c.label).join(', ')}`,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationColor(banner) {
  const b = banner.toUpperCase()
  if (b.startsWith('TS')) return '#ef4444'
  if (b.startsWith('SECRET')) return '#f97316'
  if (b.startsWith('CONFIDENTIAL')) return '#eab308'
  return '#22c55e'
}

function classificationLabel(banner) {
  const b = banner.toUpperCase()
  if (b.startsWith('TS')) return 'TS'
  if (b.startsWith('SECRET')) return 'S'
  if (b.startsWith('CONFIDENTIAL')) return 'C'
  return 'U'
}

const PERSONAS = FEDERAL_PERSONAS.filter(p => p.id !== 'generic')

// ─── Sub-components ───────────────────────────────────────────────────────────

function PersonaCard({ persona, selected, onClick }) {
  const clearance = persona.attributes.find(a => a.startsWith('clearance:'))?.split(':')[1]
  const clearanceDisplay = clearance ? clearance.toUpperCase() : 'NONE'
  const clearanceColor =
    clearance === 'ts-sci' ? '#ef4444' :
    clearance === 'secret' ? '#f97316' :
    clearance === 'confidential' ? '#eab308' : '#6b7280'

  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? `${persona.color}18` : 'var(--c-surface)',
        border: `1.5px solid ${selected ? persona.color : 'var(--c-border)'}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ fontSize: 20, lineHeight: 1 }}>{persona.avatar}</span>
        <div className="flex-1 min-w-0">
          <div
            style={{
              color: 'var(--c-text-1)',
              fontWeight: 600,
              fontSize: 12,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {persona.name}
          </div>
          <div style={{ color: 'var(--c-text-4)', fontSize: 10, lineHeight: 1.3 }}>
            {persona.title}
          </div>
        </div>
      </div>

      {/* Clearance chip */}
      <div className="flex flex-wrap gap-1 mt-2">
        <span
          style={{
            background: `${clearanceColor}22`,
            color: clearanceColor,
            border: `1px solid ${clearanceColor}55`,
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 9,
            fontFamily: 'monospace',
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          {clearanceDisplay}
        </span>

        {/* Coalition badges */}
        {(persona.coalition || []).map(g => {
          const group = COALITION_GROUPS[g]
          if (!group) return null
          return (
            <span
              key={g}
              style={{
                background: `${group.color}22`,
                color: group.color,
                border: `1px solid ${group.color}55`,
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
              }}
            >
              {group.name}
            </span>
          )
        })}

        {/* Nationality */}
        {persona.nationality && (
          <span
            style={{
              background: 'var(--c-border)',
              color: 'var(--c-text-3)',
              borderRadius: 4,
              padding: '1px 6px',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {persona.nationality}
          </span>
        )}
      </div>
    </button>
  )
}

function DocCard({ doc, selected, onClick }) {
  const color = classificationColor(doc.banner)
  const label = classificationLabel(doc.banner)

  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? `${color}15` : 'var(--c-surface)',
        border: `1.5px solid ${selected ? color : 'var(--c-border)'}`,
        borderRadius: 8,
        padding: '10px 10px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
      }}
    >
      <div className="flex items-start gap-2 mb-2">
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: `${color}22`,
            border: `1px solid ${color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="tdf-doc" size={14} />
        </div>
        <div
          style={{
            background: color,
            color: '#fff',
            borderRadius: 3,
            padding: '1px 6px',
            fontSize: 9,
            fontWeight: 800,
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
            alignSelf: 'flex-start',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          color: color,
          fontFamily: 'monospace',
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: '0.04em',
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {doc.banner}
      </div>
      <div style={{ color: 'var(--c-text-1)', fontSize: 11, fontWeight: 600, lineHeight: 1.4 }}>
        {doc.title}
      </div>
    </button>
  )
}

function AccessDecisionPanel({ persona, doc }) {
  const result = useMemo(() => checkAccess(persona, doc), [persona, doc])
  const isOpen = doc.required.length === 0
  const glowColor = result.granted ? '#22c55e' : '#ef4444'

  return (
    <div
      style={{
        border: `1.5px solid ${glowColor}55`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: `0 0 18px ${glowColor}20`,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-border)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon name="key" size={14} />
        <span style={{ color: 'var(--c-text-3)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          KAS Attribute Evaluation
        </span>
        <span style={{ marginLeft: 'auto', color: 'var(--c-text-5)', fontSize: 10 }}>
          {persona.name} → {doc.title}
        </span>
      </div>

      <div style={{ background: 'var(--c-bg)', padding: '14px 16px' }} className="flex flex-col gap-3">

        {/* Step 1 — Attribute Evaluation */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-2">
            <div
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#3b82f611', border: '1px solid #3b82f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#3b82f6', flexShrink: 0,
              }}
            >
              1
            </div>
            <span style={{ color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Attribute Evaluation
            </span>
          </div>
          {persona.fqns.length > 0 ? (
            <div className="flex flex-col gap-1">
              {persona.fqns.map((fqn, i) => (
                <div key={i} style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: 10, background: '#3b82f60d', border: '1px solid #3b82f622', borderRadius: 4, padding: '2px 8px' }}>
                  {fqn}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--c-text-5)', fontFamily: 'monospace', fontSize: 10 }}>No attributes — anonymous identity</div>
          )}
        </div>

        {/* Step 2 — Policy Matching */}
        <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '10px 14px' }}>
          <div className="flex items-center gap-2 mb-2">
            <div
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: '#a855f611', border: '1px solid #a855f6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: '#a855f6', flexShrink: 0,
              }}
            >
              2
            </div>
            <span style={{ color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Policy Matching
            </span>
          </div>
          {isOpen ? (
            <div style={{ color: '#22c55e', fontFamily: 'monospace', fontSize: 10 }}>No policy restrictions — open document</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {result.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      background: check.pass ? '#22c55e22' : '#ef444422',
                      border: `1px solid ${check.pass ? '#22c55e' : '#ef4444'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Icon name={check.pass ? 'checkmark' : 'blocked'} size={9} />
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: check.pass ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {check.label}
                  </span>
                  <span style={{ color: 'var(--c-text-5)', fontSize: 9, marginLeft: 'auto' }}>
                    {check.rule}
                  </span>
                  <span style={{ color: 'var(--c-text-4)', fontFamily: 'monospace', fontSize: 9 }}>
                    persona: {check.personaValue}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step 3 — Decision */}
        <div
          style={{
            background: `${glowColor}10`,
            border: `1.5px solid ${glowColor}55`,
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: `0 0 10px ${glowColor}18`,
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: `${glowColor}22`, border: `1px solid ${glowColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700, color: glowColor, flexShrink: 0,
              }}
            >
              3
            </div>
            <span style={{ color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Decision
            </span>
            <div
              style={{
                marginLeft: 'auto',
                background: glowColor,
                color: '#fff',
                borderRadius: 5,
                padding: '2px 10px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.06em',
              }}
            >
              {result.granted ? 'GRANTED' : 'DENIED'}
            </div>
          </div>
          <div style={{ color: result.granted ? '#22c55e' : '#ef4444', fontFamily: 'monospace', fontSize: 10, marginTop: 4 }}>
            {result.reason}
          </div>
        </div>
      </div>
    </div>
  )
}

function CoalitionDiagram({ activeCoalition }) {
  const groups = [
    { key: 'fvey', ...COALITION_GROUPS.fvey },
    { key: 'nato', ...COALITION_GROUPS.nato },
    { key: 'pink', ...COALITION_GROUPS.pink },
  ]

  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '14px 16px' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon name="globe" size={14} />
        <span style={{ color: 'var(--c-text-3)', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Coalition Groups
        </span>
      </div>
      <div className="flex gap-3">
        {groups.map(group => {
          const isActive = activeCoalition.includes(group.key)
          return (
            <div
              key={group.key}
              style={{
                flex: 1,
                background: isActive ? `${group.color}18` : 'var(--c-bg)',
                border: `${isActive ? '2px' : '1px'} solid ${isActive ? group.color : 'var(--c-border)'}`,
                borderRadius: 8,
                padding: '10px 12px',
                transition: 'all 0.2s',
                boxShadow: isActive ? `0 0 12px ${group.color}25` : 'none',
              }}
            >
              <div
                style={{
                  color: group.color,
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: '0.06em',
                  marginBottom: 2,
                }}
              >
                {group.name}
              </div>
              <div style={{ color: 'var(--c-text-4)', fontSize: 10, marginBottom: 6 }}>{group.label}</div>
              <div
                style={{
                  background: `${group.color}22`,
                  color: group.color,
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'inline-block',
                  marginBottom: 6,
                }}
              >
                {group.nations.length} nations
              </div>
              <div style={{ color: 'var(--c-text-5)', fontSize: 9, lineHeight: 1.5 }}>
                {group.description}
              </div>
              {isActive && (
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    color: group.color,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                  }}
                >
                  <Icon name="checkmark" size={9} />
                  MEMBER
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Nation pills for FVEY (fixed small list) */}
      <div className="mt-3 flex flex-wrap gap-1">
        {COALITION_GROUPS.fvey.nations.map(n => (
          <span
            key={n}
            style={{
              background: activeCoalition.includes('fvey') && activeCoalition.length > 0 ? `${COALITION_GROUPS.fvey.color}18` : 'var(--c-border)',
              color: activeCoalition.includes('fvey') ? COALITION_GROUPS.fvey.color : 'var(--c-text-5)',
              border: `1px solid ${activeCoalition.includes('fvey') ? `${COALITION_GROUPS.fvey.color}44` : 'transparent'}`,
              borderRadius: 4,
              padding: '1px 7px',
              fontSize: 9,
              fontWeight: 600,
            }}
          >
            {n}
          </span>
        ))}
        <span style={{ color: 'var(--c-text-5)', fontSize: 9, alignSelf: 'center', marginLeft: 2 }}>
          ← FVEY nations
        </span>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CoalitionPage() {
  const { sector } = useDemo()
  const [selectedPersonaId, setSelectedPersonaId] = useState(null)
  const [selectedDocId, setSelectedDocId] = useState(null)

  const selectedPersona = PERSONAS.find(p => p.id === selectedPersonaId) || null
  const selectedDoc = COALITION_DOCS.find(d => d.id === selectedDocId) || null
  const showDecision = selectedPersona && selectedDoc

  if (sector === 'commercial') {
    return (
      <div
        className="flex flex-col items-center justify-center"
        style={{ minHeight: '60vh', gap: 16 }}
      >
        <div
          style={{
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 12,
            padding: '32px 40px',
            textAlign: 'center',
            maxWidth: 420,
          }}
        >
          <Icon name="globe" size={32} />
          <div style={{ color: 'var(--c-text-1)', fontWeight: 700, fontSize: 16, marginTop: 12, marginBottom: 8 }}>
            Coalition Sharing
          </div>
          <div style={{ color: 'var(--c-text-4)', fontSize: 13, lineHeight: 1.6 }}>
            Switch to the <strong style={{ color: 'var(--c-text-2)' }}>DoD / Federal</strong> sector
            to explore coalition data sharing with FVEY, NATO, and PINK alliance groups.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0" style={{ minHeight: '100%' }}>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: 'var(--c-text-1)', fontWeight: 700, fontSize: 18, margin: 0, marginBottom: 4 }}>
          Coalition Data Sharing
        </h1>
        <p style={{ color: 'var(--c-text-4)', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          Select a personnel and a document to see how DSP enforces releasability controls across coalition partners.
        </p>
      </div>

      <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>
        {/* ── Left: Persona Grid ──────────────────────────────────────────── */}
        <div style={{ width: '35%', flexShrink: 0 }}>
          <div
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'var(--c-bg)',
                borderBottom: '1px solid var(--c-border)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="users" size={13} />
              <span
                style={{
                  color: 'var(--c-text-3)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Personnel
              </span>
              {selectedPersona && (
                <span
                  style={{
                    marginLeft: 'auto',
                    background: `${selectedPersona.color}22`,
                    color: selectedPersona.color,
                    border: `1px solid ${selectedPersona.color}55`,
                    borderRadius: 4,
                    padding: '1px 7px',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {selectedPersona.name.split(' ').slice(-1)[0]}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5" style={{ padding: '10px 10px' }}>
              {PERSONAS.map(persona => (
                <PersonaCard
                  key={persona.id}
                  persona={persona}
                  selected={selectedPersonaId === persona.id}
                  onClick={() => setSelectedPersonaId(prev => prev === persona.id ? null : persona.id)}
                />
              ))}
            </div>
          </div>

          {/* Selected persona attributes */}
          {selectedPersona && (
            <div
              style={{
                marginTop: 12,
                background: 'var(--c-surface)',
                border: `1.5px solid ${selectedPersona.color}44`,
                borderRadius: 10,
                padding: '10px 14px',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span style={{ fontSize: 18 }}>{selectedPersona.avatar}</span>
                <span style={{ color: selectedPersona.color, fontWeight: 700, fontSize: 12 }}>
                  {selectedPersona.name}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {selectedPersona.attributes.map((attr, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: 'var(--c-text-3)',
                      background: 'var(--c-bg)',
                      border: '1px solid var(--c-border)',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    {attr}
                  </div>
                ))}
                {selectedPersona.attributes.length === 0 && (
                  <div style={{ color: 'var(--c-text-5)', fontSize: 10 }}>No attributes</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Main Panel ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-4" style={{ flex: 1, minWidth: 0 }}>

          {/* Document Grid */}
          <div
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                background: 'var(--c-bg)',
                borderBottom: '1px solid var(--c-border)',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="tdf-doc" size={13} />
              <span
                style={{
                  color: 'var(--c-text-3)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Documents
              </span>
              <span style={{ color: 'var(--c-text-5)', fontSize: 10, marginLeft: 4 }}>
                — select to evaluate access
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 10,
                padding: '12px 12px',
              }}
            >
              {COALITION_DOCS.map(doc => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  selected={selectedDocId === doc.id}
                  onClick={() => setSelectedDocId(prev => prev === doc.id ? null : doc.id)}
                />
              ))}
            </div>
          </div>

          {/* Access Decision Panel */}
          {showDecision ? (
            <AccessDecisionPanel persona={selectedPersona} doc={selectedDoc} />
          ) : (
            <div
              style={{
                background: 'var(--c-surface)',
                border: '1px dashed var(--c-border-2)',
                borderRadius: 10,
                padding: '24px 20px',
                textAlign: 'center',
              }}
            >
              <Icon name="shield" size={24} />
              <div style={{ color: 'var(--c-text-4)', fontSize: 12, marginTop: 8 }}>
                {!selectedPersona && !selectedDoc
                  ? 'Select a person and a document to evaluate access'
                  : !selectedPersona
                  ? 'Select a person from the left panel'
                  : 'Select a document above'}
              </div>
            </div>
          )}

          {/* Coalition Diagram */}
          <CoalitionDiagram
            activeCoalition={selectedPersona ? (selectedPersona.coalition || []) : []}
          />
        </div>
      </div>
    </div>
  )
}
