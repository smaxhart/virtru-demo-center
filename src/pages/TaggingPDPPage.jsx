import { useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from '../components/Icon.jsx'
import { TAGGING_SAMPLES } from '../data/sectors.js'

const STEP_BUSINESS_MEANING = [
  "Apache Tika reads the raw file — PDF, Word, or scanned image — and extracts the text so the pipeline can analyze it.",
  "The classification banner is the most important line in the document. Getting this wrong means mis-tagged data leaving the right controls.",
  "The raw term is normalized to a canonical attribute value. This eliminates human variation — 'TS/SCI', 'TOP SECRET//SCI', and 'TOP SECRET SCI' all map to the same attribute.",
  "REL TO countries become nationality attributes. One attribute per authorized nation — each resolved against your coalition membership definitions.",
  "Need-to-know compartments become ALL_OF attributes. The user must hold every single compartment listed — missing even one blocks access.",
  "All extracted attributes are combined into the final TDF policy. The document is now protected — this policy travels with the file, enforced on every single decrypt.",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classificationColor(banner) {
  const b = banner.toUpperCase()
  if (b.startsWith('TOP SECRET') || b.startsWith('TS-SCI')) return '#b91c1c'
  if (b.startsWith('SECRET')) return '#b91c1c'
  if (b.startsWith('CONFIDENTIAL')) return 'var(--c-text-3)'
  return '#15803d'
}

function borderColor(banner) {
  return classificationColor(banner)
}

function ruleBadgeColor(rule) {
  return 'var(--c-text-4)'
}

function truncateFqn(fqn, max = 48) {
  if (!fqn) return ''
  if (fqn.length <= max) return fqn
  return '…' + fqn.slice(fqn.length - (max - 1))
}

// Highlight a substring within text, return array of {text, highlight, color}
function highlightTerms(text, terms) {
  if (!terms || terms.length === 0) return [{ text, highlight: false }]
  const escaped = terms.map(t => t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(regex)
  return parts.map(part => {
    const match = terms.find(t => t.term.toLowerCase() === part.toLowerCase())
    return match ? { text: part, highlight: true, color: match.color } : { text: part, highlight: false }
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RuleBadge({ rule }) {
  const color = ruleBadgeColor(rule)
  return (
    <span
      className="text-xs font-mono px-1.5 py-0.5 rounded"
      style={{ background: color + '22', color, border: `1px solid ${color}44` }}
    >
      {rule}
    </span>
  )
}

function AttrChip({ attr }) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: attr.color + '15', border: `1px solid ${attr.color}40` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold" style={{ color: attr.color }}>
          {attr.label}
        </span>
        <RuleBadge rule={attr.rule} />
      </div>
      <div className="text-xs font-mono" style={{ color: 'var(--c-text-5)' }}>
        {truncateFqn(attr.fqn)}
      </div>
    </div>
  )
}

function HighlightedText({ text, terms }) {
  const parts = highlightTerms(text, terms)
  return (
    <>
      {parts.map((p, i) =>
        p.highlight
          ? <mark key={i} style={{ background: p.color + '44', color: p.color, borderRadius: 3, padding: '0 2px' }}>{p.text}</mark>
          : <span key={i}>{p.text}</span>
      )}
    </>
  )
}

function DocBody({ text, terms }) {
  return (
    <pre
      className="text-xs leading-relaxed rounded-lg p-4 whitespace-pre-wrap break-words overflow-auto"
      style={{
        fontFamily: 'monospace',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-border)',
        color: 'var(--c-text-3)',
        maxHeight: 240,
      }}
    >
      <HighlightedText text={text} terms={terms || []} />
    </pre>
  )
}

function StepBadge({ label, color }) {
  return (
    <span
      className="inline-block text-xs font-bold px-2 py-0.5 rounded"
      style={{ background: color + '22', color, border: `1px solid ${color}55` }}
    >
      {label}
    </span>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--c-text-5)' }}>
      {children}
    </div>
  )
}

function InfoBox({ color, children }) {
  return (
    <div
      className="rounded-lg p-3 text-sm"
      style={{ background: color + '10', border: `1px solid ${color}33`, color: 'var(--c-text-3)' }}
    >
      {children}
    </div>
  )
}

function DictLookupRow({ input, dict, output, outputColor }) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-mono"
      style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
    >
      <span style={{ color: 'var(--c-text-3)' }}>{input}</span>
      <span style={{ color: 'var(--c-text-5)' }}>→</span>
      <span style={{ color: 'var(--c-text-5)', fontSize: '0.7rem' }}>[{dict}]</span>
      <span style={{ color: 'var(--c-text-5)' }}>→</span>
      <span style={{ color: outputColor || '#15803d', fontWeight: 600 }}>{output}</span>
    </div>
  )
}

function ManifestSnippet({ doc }) {
  const attrs = doc.extractedAttrs
  const policyObj = {
    body: {
      dataAttributes: attrs.map(a => ({ attribute: a.fqn })),
    },
    dissem: [],
  }
  const manifest = {
    schemaVersion: '2.0',
    encryptionInformation: {
      type: 'split',
      policy: btoa(JSON.stringify(policyObj)),
      keyAccess: [{
        type: 'wrapped',
        url: 'https://kas.example.gov/kas',
        protocol: 'kas',
        wrappedKey: 'ZW5jcnlwdGVkS2V5SGVyZQ==',
        policyBinding: {
          alg: 'HS256',
          hash: 'abc123…',
        },
      }],
    },
  }
  return (
    <pre
      className="text-xs rounded-lg p-3 overflow-auto"
      style={{
        fontFamily: 'monospace',
        background: 'var(--c-bg)',
        border: '1px solid var(--c-border-2)',
        color: '#15803d',
        maxHeight: 220,
        lineHeight: 1.6,
      }}
    >
      {JSON.stringify(manifest, null, 2)}
    </pre>
  )
}

// ─── Step renderers ───────────────────────────────────────────────────────────

function Step0({ doc }) {
  return (
    <div className="flex flex-col gap-4">
      <InfoBox color="#0369a1">
        <span style={{ color: 'var(--c-text-2)', fontWeight: 600 }}>Apache Tika OCR</span> extracting text content from document…
      </InfoBox>
      <div>
        <SectionLabel>Extracted Text</SectionLabel>
        <DocBody text={doc.body} terms={[]} />
      </div>
      <div>
        <SectionLabel>Classification Regex Pattern</SectionLabel>
        <div
          className="text-sm font-mono rounded-lg px-3 py-2"
          style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)' }}
        >
          /(SECRET|TOP SECRET|CONFIDENTIAL|UNCLASSIFIED|TS-SCI)/
        </div>
      </div>
    </div>
  )
}

function Step1({ doc }) {
  const bannerColor = classificationColor(doc.banner)
  const bannerTerms = [{ term: doc.banner, color: bannerColor }]
  return (
    <div className="flex flex-col gap-4">
      <InfoBox color={bannerColor}>
        Classification banner detected on the first meaningful line of the document.
      </InfoBox>
      <div>
        <SectionLabel>Document with Banner Highlighted</SectionLabel>
        <DocBody text={doc.body} terms={bannerTerms} />
      </div>
      <div>
        <SectionLabel>Detected Banner</SectionLabel>
        <div
          className="text-sm font-mono font-bold rounded-lg px-3 py-2"
          style={{ background: bannerColor + '22', border: `2px solid ${bannerColor}`, color: bannerColor }}
        >
          {doc.banner}
        </div>
      </div>
    </div>
  )
}

function Step2({ doc }) {
  const classAttr = doc.extractedAttrs.find(a => a.type === 'classification')
  const syn = doc.synonym
  const highlightTerms2 = classAttr ? [{ term: classAttr.matched, color: '#b91c1c' }] : []
  return (
    <div className="flex flex-col gap-4">
      <InfoBox color="#b91c1c">
        Classification term matched in banner. Synonym dictionary normalizes the raw token to a canonical attribute value.
      </InfoBox>
      <div>
        <SectionLabel>Classification Term Highlighted</SectionLabel>
        <DocBody text={doc.body} terms={highlightTerms2} />
      </div>
      {syn && (
        <div>
          <SectionLabel>Synonym Dictionary Lookup</SectionLabel>
          <DictLookupRow
            input={syn.input}
            dict={syn.dict}
            output={classAttr ? classAttr.label : syn.output}
            outputColor={classAttr ? classAttr.color : '#15803d'}
          />
        </div>
      )}
      {classAttr && (
        <div>
          <SectionLabel>Generated Attribute FQN</SectionLabel>
          <div
            className="text-xs font-mono rounded-lg px-3 py-2 break-all"
            style={{ background: '#b91c1c15', border: '1px solid #b91c1c40', color: '#b91c1c' }}
          >
            {classAttr.fqn}
          </div>
        </div>
      )}
    </div>
  )
}

function Step3({ doc }) {
  const reltoAttrs = doc.extractedAttrs.filter(a => a.type === 'relto')
  const bannerTerms = reltoAttrs.map(a => ({ term: a.matched, color: 'var(--c-text-2)' }))
  const hasRelto = reltoAttrs.length > 0

  return (
    <div className="flex flex-col gap-4">
      <InfoBox color="#1d4ed8">
        {hasRelto
          ? 'REL TO field parsed — each country or coalition code maps to a nationality attribute.'
          : 'No REL TO found — access limited to originating nation only.'}
      </InfoBox>
      <div>
        <SectionLabel>Banner with REL TO Highlighted</SectionLabel>
        <DocBody text={doc.body} terms={bannerTerms} />
      </div>
      {hasRelto ? (
        <div>
          <SectionLabel>Country / Coalition → Attribute Mapping</SectionLabel>
          <div className="flex flex-col gap-2">
            {reltoAttrs.map(attr => (
              <div
                key={attr.fqn}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
              >
                <span style={{ color: 'var(--c-text-2)', fontWeight: 700 }}>{attr.matched}</span>
                <span style={{ color: 'var(--c-text-5)' }}>→</span>
                <span style={{ color: 'var(--c-text-2)' }}>{attr.label}</span>
                <span style={{ marginLeft: 'auto' }}><RuleBadge rule={attr.rule} /></span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="text-sm rounded-lg px-3 py-2"
          style={{ background: '#1d4ed815', border: '1px solid #1d4ed830', color: 'var(--c-text-4)' }}
        >
          No foreign release attributes generated for this document.
        </div>
      )}
    </div>
  )
}

function Step4({ doc }) {
  const ntkAttrs = doc.extractedAttrs.filter(a => a.type === 'needtoknow')
  const bannerTerms = ntkAttrs.map(a => ({ term: a.matched, color: 'var(--c-text-2)' }))
  const hasNtk = ntkAttrs.length > 0

  return (
    <div className="flex flex-col gap-4">
      <InfoBox color="#6d28d9">
        {hasNtk
          ? 'NTK compartments extracted — each token becomes a needtoknow attribute with ALL_OF enforcement.'
          : 'No NTK compartments found — standard clearance applies.'}
      </InfoBox>
      <div>
        <SectionLabel>Banner with NTK Highlighted</SectionLabel>
        <DocBody text={doc.body} terms={bannerTerms} />
      </div>
      {hasNtk ? (
        <div>
          <SectionLabel>NTK Token → Attribute Mapping</SectionLabel>
          <div className="flex flex-col gap-2">
            {ntkAttrs.map(attr => (
              <div
                key={attr.fqn}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-mono"
                style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
              >
                <span style={{ color: 'var(--c-text-2)', fontWeight: 700 }}>{attr.matched}</span>
                <span style={{ color: 'var(--c-text-5)' }}>→</span>
                <span style={{ color: 'var(--c-text-2)' }}>{attr.label}</span>
                <span style={{ marginLeft: 'auto' }}><RuleBadge rule={attr.rule} /></span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="text-sm rounded-lg px-3 py-2"
          style={{ background: '#6d28d915', border: '1px solid #6d28d930', color: 'var(--c-text-4)' }}
        >
          No NTK compartment attributes generated for this document.
        </div>
      )}
    </div>
  )
}

function Step5({ doc }) {
  return (
    <div className="flex flex-col gap-4">
      <InfoBox color="#047857">
        Policy assembly complete. All extracted attributes rolled up into the final TDF policy object.
      </InfoBox>
      <div>
        <SectionLabel>Rollup Summary</SectionLabel>
        <div
          className="text-sm rounded-lg px-3 py-3 leading-relaxed"
          style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)' }}
        >
          {doc.rollup}
        </div>
      </div>
      <div>
        <SectionLabel>Final Policy — All Attribute FQNs</SectionLabel>
        <div className="flex flex-col gap-2">
          {doc.extractedAttrs.map(attr => (
            <div
              key={attr.fqn}
              className="flex items-center gap-2 rounded-lg px-3 py-2"
              style={{ background: attr.color + '15', border: `1px solid ${attr.color}40` }}
            >
              <span className="text-sm font-semibold" style={{ color: attr.color }}>{attr.label}</span>
              <RuleBadge rule={attr.rule} />
              <span className="text-xs font-mono ml-auto" style={{ color: 'var(--c-text-5)' }}>
                {truncateFqn(attr.fqn)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>TDF Manifest Excerpt</SectionLabel>
        <ManifestSnippet doc={doc} />
      </div>
    </div>
  )
}

const STEP_META = [
  { title: 'Content Extraction',    icon: 'search',    color: 'var(--c-text-2)' },
  { title: 'Banner Detection',      icon: 'document',  color: 'var(--c-text-3)' },
  { title: 'Classification Match',  icon: 'shield',    color: '#b91c1c' },
  { title: 'REL TO Parsing',        icon: 'globe',     color: 'var(--c-text-2)' },
  { title: 'NTK Parsing',           icon: 'key',       color: 'var(--c-text-2)' },
  { title: 'Rollup & Final Policy', icon: 'tdf',       color: '#047857' },
]

// ─── Right panel: revealed attributes by step ─────────────────────────────────

function RevealedAttrs({ doc, step }) {
  const all = doc.extractedAttrs
  const classification = all.filter(a => a.type === 'classification' || a.type === 'caveat')
  const relto          = all.filter(a => a.type === 'relto')
  const ntk            = all.filter(a => a.type === 'needtoknow')

  const visible = [
    ...(step >= 2 ? classification : []),
    ...(step >= 3 ? relto : []),
    ...(step >= 4 ? ntk : []),
  ]

  const pending = step < 2
    ? all
    : [
        ...(step < 3 ? relto : []),
        ...(step < 4 ? ntk : []),
      ]

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 && (
        <div className="text-sm text-center py-6" style={{ color: 'var(--c-text-5)' }}>
          No attributes extracted yet.
          <br />
          <span style={{ color: 'var(--c-text-6)' }}>Advance through steps to see policy build.</span>
        </div>
      )}
      {visible.map(attr => <AttrChip key={attr.fqn} attr={attr} />)}
      {pending.length > 0 && step >= 1 && (
        <div
          className="rounded-lg px-3 py-2.5 text-xs"
          style={{ background: 'var(--c-bg)', border: '1px dashed var(--c-border-2)', color: 'var(--c-text-5)' }}
        >
          <span style={{ color: 'var(--c-text-6)' }}>{pending.length} more attribute{pending.length > 1 ? 's' : ''}</span> will be extracted in later steps…
        </div>
      )}
      {step >= 5 && (
        <div className="flex flex-col gap-2 mt-2">
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-5)' }}>
            Policy Encoding
          </div>
          <div
            className="text-xs font-mono rounded-lg px-3 py-2 break-all"
            style={{ background: 'var(--c-bg)', border: '1px solid #04785740', color: '#047857' }}
          >
            {btoa(JSON.stringify({ body: { dataAttributes: all.map(a => ({ attribute: a.fqn })) } }))}
          </div>
          <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>
            Base64-encoded policy object embedded in TDF manifest.
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TaggingPDPPage() {
  const { techMode } = useDemo()
  const [selectedId, setSelectedId] = useState(TAGGING_SAMPLES[0].id)
  const [step, setStep] = useState(0)

  const doc = TAGGING_SAMPLES.find(s => s.id === selectedId) || TAGGING_SAMPLES[0]
  const TOTAL_STEPS = 6

  function selectDoc(id) {
    setSelectedId(id)
    setStep(0)
  }

  function prevStep() { setStep(s => Math.max(0, s - 1)) }
  function nextStep() { setStep(s => Math.min(TOTAL_STEPS - 1, s + 1)) }

  const meta = STEP_META[step]

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--c-bg)', color: 'var(--c-text-1)', minHeight: 0 }}
    >
      {/* Header */}
      <div
        className="px-6 py-4"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <div className="page-hero" style={{ marginBottom: 0 }}>
          <p className="page-subtitle" style={{ fontSize: 13, maxWidth: 640 }}>
            The average analyst makes classification errors on 12–15% of manually tagged documents.
            At scale, that's thousands of mis-tagged files per day. The tagging pipeline reads the
            actual document content and applies the policy objectively — every time.
          </p>
          <div className="page-actions">
          </div>
        </div>
      </div>

      {/* External Processor Info — tech mode only */}
      {techMode && (
        <div className="px-6 py-3" style={{ background: 'var(--c-info-bg)', borderBottom: '1px solid #1e3a5f' }}>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="text-xs font-bold mb-1" style={{ color: 'var(--c-text-2)' }}>🔌 External Processor Integration</div>
              <p className="text-xs" style={{ color: 'var(--c-text-4)' }}>
                Tagging Service supports pluggable external processors (gRPC or HTTP). Hook into any stage: content extraction, tag extraction, processing, or rollup. Apache Tika handles document parsing by default.
              </p>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold mb-1" style={{ color: 'var(--c-text-2)' }}>🎯 Remote Tagging by Default</div>
              <p className="text-xs" style={{ color: 'var(--c-text-4)' }}>
                <code style={{ background: '#0f172a', padding: '1px 4px', borderRadius: 3, color: '#4ade80' }}>tructl tag</code> now hits the remote tagging service by default (use <code style={{ background: '#0f172a', padding: '1px 4px', borderRadius: 3 }}>--local</code> for offline mode). Tag rollup logic improved for proper hierarchy consolidation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3-column layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Doc selector ── */}
        <div
          className="flex flex-col gap-2 p-4 overflow-y-auto"
          style={{
            width: '20%',
            minWidth: 180,
            borderRight: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
          }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-5)' }}>
            Select Document
          </div>
          {TAGGING_SAMPLES.map(sample => {
            const bc = borderColor(sample.banner)
            const isActive = sample.id === selectedId
            return (
              <button
                key={sample.id}
                onClick={() => selectDoc(sample.id)}
                className="text-left rounded-lg p-3 transition-all"
                style={{
                  border: `2px solid ${bc}`,
                  background: isActive ? bc + '25' : bc + '08',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <div
                  className="text-xs font-mono leading-snug"
                  style={{ color: isActive ? bc : 'var(--c-text-4)', fontWeight: isActive ? 700 : 400 }}
                >
                  {sample.banner}
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Center: Step view ── */}
        <div
          className="flex flex-col flex-1 overflow-hidden"
          style={{ width: '50%' }}
        >
          {/* Step header */}
          <div
            className="px-6 py-3 flex items-center gap-3"
            style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: meta.color + '20' }}
            >
              <Icon name={meta.icon} size={16} style={{ color: meta.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <StepBadge label={`Step ${step + 1}`} color={meta.color} />
                <span className="text-sm font-semibold" style={{ color: 'var(--c-text-1)' }}>{meta.title}</span>
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--c-text-5)' }}>
                {doc.banner}
              </div>
            </div>
          </div>

          {/* Step progress bar */}
          <div className="flex gap-1 px-6 py-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
            {STEP_META.map((m, i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full"
                style={{ background: i <= step ? m.color : 'var(--c-border-2)' }}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {/* Business meaning — value-first framing above technical content */}
            <div className="mb-4 px-3 py-2.5 rounded-lg text-sm leading-relaxed"
              style={{ background: '#001E4A', border: '1px solid #004987', color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
              {STEP_BUSINESS_MEANING[step]}
            </div>
            {step === 0 && <Step0 doc={doc} />}
            {step === 1 && <Step1 doc={doc} />}
            {step === 2 && <Step2 doc={doc} />}
            {step === 3 && <Step3 doc={doc} />}
            {step === 4 && <Step4 doc={doc} />}
            {step === 5 && <Step5 doc={doc} />}
          </div>

          {/* Navigation */}
          <div
            className="flex items-center justify-between px-6 py-3"
            style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
          >
            <button
              onClick={prevStep}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: step === 0 ? 'var(--c-border)' : 'var(--c-surface)',
                color: step === 0 ? 'var(--c-text-6)' : 'var(--c-text-3)',
                border: '1px solid var(--c-border)',
                cursor: step === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              ◀ Prev
            </button>
            <div className="flex items-center gap-2">
              {STEP_META.map((m, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i === step ? m.color : i < step ? m.color + '66' : 'var(--c-border-2)',
                    transform: i === step ? 'scale(1.4)' : 'scale(1)',
                    cursor: 'pointer',
                    border: 'none',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--c-text-5)' }}>
                Step {step + 1} / {TOTAL_STEPS}
              </span>
              <button
                onClick={nextStep}
                disabled={step === TOTAL_STEPS - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: step === TOTAL_STEPS - 1 ? 'var(--c-border)' : meta.color + '20',
                  color: step === TOTAL_STEPS - 1 ? 'var(--c-text-6)' : meta.color,
                  border: `1px solid ${step === TOTAL_STEPS - 1 ? 'var(--c-border)' : meta.color + '55'}`,
                  cursor: step === TOTAL_STEPS - 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Policy attributes ── */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            width: '30%',
            minWidth: 220,
            borderLeft: '1px solid var(--c-border)',
            background: 'var(--c-surface)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center gap-2"
            style={{ borderBottom: '1px solid var(--c-border)' }}
          >
            <Icon name="shield" size={16} style={{ color: 'var(--c-text-2)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--c-text-1)' }}>Extracted Policy</span>
            {step >= 2 && (
              <span
                className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#6d28d922', color: 'var(--c-text-2)', border: '1px solid #6d28d944' }}
              >
                {[
                  ...doc.extractedAttrs.filter(a => a.type === 'classification' || a.type === 'caveat').slice(0, step >= 2 ? undefined : 0),
                  ...doc.extractedAttrs.filter(a => a.type === 'relto').slice(0, step >= 3 ? undefined : 0),
                  ...doc.extractedAttrs.filter(a => a.type === 'needtoknow').slice(0, step >= 4 ? undefined : 0),
                ].length} attr{[
                  ...doc.extractedAttrs.filter(a => a.type === 'classification' || a.type === 'caveat').slice(0, step >= 2 ? undefined : 0),
                  ...doc.extractedAttrs.filter(a => a.type === 'relto').slice(0, step >= 3 ? undefined : 0),
                  ...doc.extractedAttrs.filter(a => a.type === 'needtoknow').slice(0, step >= 4 ? undefined : 0),
                ].length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Legend */}
          <div
            className="px-4 py-2 flex gap-3 flex-wrap"
            style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)' }}
          >
            {[
              { label: 'HIERARCHY', color: 'var(--c-text-4)' },
              { label: 'ANY_OF', color: 'var(--c-text-4)' },
              { label: 'ALL_OF', color: 'var(--c-text-4)' },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                <span className="text-xs font-mono" style={{ color: 'var(--c-text-5)' }}>{r.label}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <RevealedAttrs doc={doc} step={step} />
          </div>

          {/* Total attribute count at bottom */}
          {step >= 5 && (
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg)' }}
            >
              <Icon name="checkmark" size={14} style={{ color: '#047857' }} />
              <span className="text-xs" style={{ color: '#047857' }}>
                Policy complete — {doc.extractedAttrs.length} attribute{doc.extractedAttrs.length !== 1 ? 's' : ''} bound to TDF
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
