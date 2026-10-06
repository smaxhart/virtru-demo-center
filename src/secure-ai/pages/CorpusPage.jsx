import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon from '../components/PersonaIcon.jsx'
import UiIcon from '../../components/UiIcon.jsx'
import { shortFqn, fmtBytes } from '../ai/corpus.js'
import { explainPolicy, missingAttributes } from '../ai/policyEngine.js'
import { unitsForDocument } from '../ai/corpusVault.js'
import { decryptToText, describeDenial } from '../api/tdf.js'
import { saveTdf } from '../api/download.js'
import AddDocument from '../components/AddDocument.jsx'
import DerivedBanner from '../components/DerivedBanner.jsx'

/** Policy requirements measured against one subject's attributes. */
function PolicyChips({ policy, fqns }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {policy.length === 0 && (
        <span className="chip chip-mono chip-grant">
          <UiIcon name="check" size={11} strokeWidth={2.4} />no attributes, public
        </span>
      )}
      {explainPolicy(policy, fqns).map(r => (
        <span key={r.attribute} className={`chip chip-mono${r.satisfied ? ' chip-grant' : ''}`}
          style={r.satisfied ? undefined : { color: 'var(--c-text-4)' }}>
          <UiIcon name={r.satisfied ? 'check' : 'x'} size={11} strokeWidth={2.4} />
          {r.attribute}: {r.required.length > 3 ? `any of ${r.required.length}` : r.required.join(' | ')}
        </span>
      ))}
    </div>
  )
}

function UnitCard({ entry }) {
  const { personaId, persona, entityFqns, agent, agentFqns, logEvent, removeDocument } = useApp()
  const { unit, boundAttributes, bytes, tdfBytes } = entry

  // Whether the assistant could fetch this on your behalf. Shown alongside your own verdict
  // rather than folded into it: "Try decrypt" on this page is you, directly, holding your own
  // token — which is a genuinely different question from what the agent can retrieve for you,
  // and the gap between the two answers is the thing worth seeing.
  const agentSatisfied = explainPolicy(unit.policy, agentFqns).every(r => r.satisfied)

  const [result, setResult] = useState(null) // { granted, text?, reason? }
  const [busy, setBusy]     = useState(false)
  const [open, setOpen]     = useState(false)

  const attempt = useCallback(async () => {
    setBusy(true)
    try {
      const text = await decryptToText(tdfBytes, personaId)
      setResult({ granted: true, text })
      setOpen(true)
      logEvent({
        persona: persona.name, personaId,
        // Explicitly null rather than omitted. The audit log's other writer records two subjects,
        // and an absent field there would read as "not captured" instead of "no agent was in
        // this decision" — which is the whole distinction this page exists to draw.
        agent: null, agentId: null, blockedBy: null,
        document: unit.label, tier: unit.tierId,
        classification: unit.classification,
        granted: true, attempts: 1, missing: [],
        reason: 'Manual decrypt from the Corpus page (direct, not via an agent) — key released',
      })
    } catch (err) {
      setResult({ granted: false, reason: describeDenial(err) })
      logEvent({
        persona: persona.name, personaId,
        agent: null, agentId: null, blockedBy: null,
        document: unit.label, tier: unit.tierId,
        classification: unit.classification,
        granted: false, attempts: 1,
        missing: missingAttributes(unit.policy, entityFqns),
        reason: `Manual decrypt from the Corpus page (direct, not via an agent) — ${describeDenial(err)}`,
      })
    }
    setBusy(false)
  }, [tdfBytes, personaId, persona, unit, entityFqns, logEvent])

  // Unlike a decrypt, exporting the ciphertext needs no entitlement and no KAS round trip —
  // the bytes are already here. The only thing that can go wrong is the write itself, so the
  // button reports that rather than leaving a rejected promise on the floor.
  const [saved, setSaved] = useState(null) // null | 'ok' | 'error'
  const save = useCallback(async () => {
    try {
      const where = await saveTdf(unit, tdfBytes)
      setSaved(where ? 'ok' : null) // null = the save dialog was dismissed
    } catch {
      setSaved('error')
    }
  }, [unit, tdfBytes])

  return (
    <div className={`sai-unit${result ? (result.granted ? ' is-grant' : ' is-deny') : ''}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sai-unit-title">
            {unit.label}
            {unit.upload && (
              <span className="chip" style={{ marginLeft: 8, height: 20, fontWeight: 550, verticalAlign: 'middle' }}>
                {unit.upload.kind === 'plaintext' ? 'Yours, encrypted here' : 'Yours, already a TDF'}
              </span>
            )}
          </div>
          <div className="sai-unit-meta">
            {unit.classification}
            {/* Flagged inline as well as itemised below, because the interesting claim is about
                this specific string: it is a reading of the policy, not a label on the file. */}
            {unit.derivedMarking && (
              <span style={{ color: 'var(--c-text-5)' }}>, derived from policy</span>
            )}
            {', '}{fmtBytes(bytes)} TDF
            {unit.upload && `, ${unit.upload.filename}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignSelf: 'flex-start' }}>
          {unit.upload && (
            <button className="btn btn-sm btn-ghost" onClick={() => removeDocument(unit.upload.id)}
              title="Remove from the corpus and delete it from this app's data directory">Remove</button>
          )}
          <button className="btn btn-sm" onClick={save} title="Export the ciphertext — the policy is inside the file"
            style={saved === 'error' ? { borderColor: 'var(--c-deny-br)', color: 'var(--c-deny)' }
              : saved === 'ok' ? { color: 'var(--c-grant)' } : undefined}>
            {saved === 'ok' && <UiIcon name="check" size={13} strokeWidth={2.4} />}
            {saved === 'ok' ? 'Saved .tdf' : saved === 'error' ? 'Save failed' : 'Save .tdf'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={attempt} disabled={busy}
            style={busy ? { cursor: 'wait' } : undefined}>{busy ? 'Asking KAS…' : 'Try decrypt'}</button>
        </div>
      </div>

      <div className="sai-unit-cols">
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Policy vs your attributes
          </div>
          <PolicyChips policy={unit.policy} fqns={entityFqns} />
          <div className="sai-unit-note">
            {unit.policyNote}
          </div>
        </div>

        {agent && (
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>
              Policy vs {agent.name}
            </div>
            <PolicyChips policy={unit.policy} fqns={agentFqns} />
            <div className="sai-unit-note" style={agentSatisfied ? undefined : { color: 'var(--c-warn)' }}>
              {agentSatisfied
                ? 'The assistant can retrieve this for you in chat.'
                : 'The assistant cannot retrieve this in chat, even for someone entitled to it. "Try decrypt" below is you, directly — not through the agent.'}
            </div>
          </div>
        )}

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Bound attributes ({boundAttributes.length})
          </div>
          <div className="sai-unit-note" style={{ marginTop: 0 }}>
            Read back out of the TDF manifest after encryption — this is the literal list
            the KAS evaluates, not a UI copy of the intent.
          </div>
        </div>
      </div>

      {/* Reads `boundAttributes` rather than `unit.policy` on purpose: the banner is then derived
          from what the manifest actually carries, which is the same list the KAS is handed. */}
      <DerivedBanner policy={boundAttributes} style={{ marginTop: 14 }} />

      {result && (
        <div className={`sai-result ${result.granted ? 'is-grant' : 'is-deny'}`}>
          <div className="sai-result-head">
            <UiIcon name={result.granted ? 'check' : 'x'} size={15} strokeWidth={2.4} />
            {result.granted ? 'Key released' : 'Rewrap refused'}
            {result.granted && (
              <button className="btn btn-sm" onClick={() => setOpen(o => !o)}>
                {open ? 'Hide plaintext' : 'Show plaintext'}
              </button>
            )}
          </div>
          {!result.granted && <div className="sai-result-body">{result.reason}</div>}
          {result.granted && open && (
            <div className="sai-result-body">
              <pre className="mono">{result.text}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A TDF from someone else's platform.
 *
 * Kept out of the corpus on purpose. Its manifest is real and worth showing — this is what a
 * document from a partner agency actually looks like on arrival — but its key is wrapped to a
 * KAS that is not this one, so no entitlement here will ever open it. Putting it in the corpus
 * would render it as a *denial*, which would claim a policy decision that never happened.
 */
function ForeignCard({ record }) {
  const { removeDocument } = useApp()
  const f = record.foreign ?? {}

  return (
    <div className="sai-unit" style={{ '--edge': 'var(--c-warn)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sai-unit-title">{record.label}</div>
          <div className="sai-unit-meta">
            {record.filename}, {fmtBytes(record.bytes)}, spec {f.specVersion ?? 'unversioned'}
            {f.mimeType && `, ${f.mimeType}`}
          </div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={() => removeDocument(record.id)}
          style={{ flexShrink: 0, alignSelf: 'flex-start' }}>Remove</button>
      </div>

      <div className="sai-unit-cols">
        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>
            Policy in the manifest ({(f.attributes ?? []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {(f.attributes ?? []).length === 0
              ? <span className="mono" style={{ fontSize: 11.5, color: 'var(--c-text-5)' }}>
                  no attributes
                </span>
              : f.attributes.map(a => (
                  <span key={a} className="chip chip-mono" title={a}>{shortFqn(a)}</span>
                ))}
          </div>
          {(f.namespaces ?? []).length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 8, lineHeight: 1.6 }}>
              Namespace {f.namespaces.join(', ')}: not one this platform knows, so even the
              policy could not be evaluated here.
            </div>
          )}
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 6 }}>Why it cannot be opened</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-5)', lineHeight: 1.6 }}>
            Its payload key is wrapped to{' '}
            <span className="mono">{(f.kasUrls ?? []).join(', ') || 'a KAS the manifest does not name'}</span>.
            The private half lives there, not here. Everything above was read straight out of the
            archive — no key, no token, no network.
          </div>
        </div>
      </div>
    </div>
  )
}

/** One entitled subject: who they are and what the platform resolved for them. */
function SubjectBar({ icon, badge, color, name, title, fqns }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
      <span style={{ color, display: 'flex' }}>
        <PersonaIcon icon={icon} badge={badge} size={19} title={name} />
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--c-text-1)' }}>{name}</span>
      <span style={{ fontSize: 12.5, color: 'var(--c-text-5)' }}>{title}</span>
      <span style={{ flex: 1 }} />
      {fqns.length === 0
        ? <span style={{ fontSize: 12.5, color: 'var(--c-text-5)', fontStyle: 'italic' }}>no entitlements</span>
        : fqns.map(f => (
            <span key={f} className="chip chip-mono" style={{
              background: color + '15', color, borderColor: color + '30',
            }}>{shortFqn(f)}</span>
          ))}
    </div>
  )
}

export default function CorpusPage() {
  const {
    vault, mode, documents, persona, entityFqns, agent, agentFqns,
    foreignUploads, uploadWarnings,
  } = useApp()
  const [adding, setAdding] = useState(false)

  const totalBytes = [...vault.values()].reduce((n, e) => n + e.bytes, 0)
  const yours = documents.filter(d => d.upload).length

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div className="page" style={{ maxWidth: 1040 }}>

        <div className="page-hero">
          <div style={{ minWidth: 0 }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              Corpus
              <span className="sai-page-mode" style={{ '--accent': mode.accent }}><i />{mode.short}</span>
            </h1>
            <p className="page-subtitle" style={{ maxWidth: '72ch' }}>
              {mode.name}: {vault.size} TDFs, {fmtBytes(totalBytes)} total, encrypted on this
              machine when you launched the mode. The plaintext is not held anywhere the app can
              read it; each card below asks the local KAS to unwrap for whoever you are acting as
              right now, as you directly and not through the assistant.
              {agent && ' The agent\'s own verdict is shown beside yours, because in chat both have to clear.'}
              {yours > 0 && ` ${yours} of them you added yourself.`}
            </p>
          </div>
          {!adding && (
            <div className="page-actions">
              <button className="btn" onClick={() => setAdding(true)}>Add a document</button>
            </div>
          )}
        </div>

        {adding && (
          <div style={{ margin: '14px 0 4px' }}>
            <AddDocument onClose={() => setAdding(false)} />
          </div>
        )}

        {uploadWarnings.length > 0 && (
          <div className="card" style={{
            padding: '12px 16px', marginTop: 14,
            background: 'var(--c-deny-bg)', borderColor: 'var(--c-deny-br)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 4, color: 'var(--c-deny)' }}>
              {uploadWarnings.length} of your documents could not be loaded
            </div>
            {uploadWarnings.map(w => (
              <div key={w.record.id} style={{ fontSize: 12.5, color: 'var(--c-text-3)', lineHeight: 1.6 }}>
                <strong>{w.record.label}</strong>: {w.error}
              </div>
            ))}
          </div>
        )}

        {/* Both subjects, one above the other — the agent's row is not decoration here, it is
            what decides whether the assistant can fetch any of these cards for you. */}
        <div className="sai-who-card">
          <SubjectBar
            icon={persona.icon}
            badge={persona.badge}
            color={persona.color}
            name={persona.name}
            title={persona.title}
            fqns={entityFqns}
          />
          {agent && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
              <SubjectBar
                icon={agent.icon}
                color={agent.color}
                name={agent.name}
                title={agent.title}
                fqns={agentFqns}
              />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 24 }}>
          {documents.map(doc => {
            const entries = unitsForDocument(vault, doc)
            if (entries.length === 1 && !doc.tiers) {
              return <UnitCard key={doc.id} entry={entries[0]} />
            }
            return (
              <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--c-text-5)', paddingLeft: 2 }}>
                  <strong style={{ color: 'var(--c-text-1)' }}>{doc.label}</strong>
                  {', '}{entries.length} independently encrypted tiers over the same record
                </div>
                {entries.map(e => <UnitCard key={e.unit.key} entry={e} />)}
              </div>
            )
          })}
        </div>

        {foreignUploads.length > 0 && (
          <div style={{ paddingBottom: 28, paddingTop: 12 }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              From another platform, inspect only
            </h2>
            <div style={{ fontSize: 13, color: 'var(--c-text-4)', margin: '4px 0 12px', lineHeight: 1.6, maxWidth: '72ch' }}>
              These are outside the corpus and outside the access matrix. A TDF binds its payload
              key to one KAS, so a file encrypted elsewhere is not something this platform can be
              entitled to open — which is the guarantee working, not a limitation of the demo.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {foreignUploads.map(r => <ForeignCard key={r.id} record={r} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
