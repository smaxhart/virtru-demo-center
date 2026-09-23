import { useState, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon from '../components/PersonaIcon.jsx'
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {policy.length === 0 && (
        <span className="mono" style={{
          fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
          background: 'var(--c-grant-bg)', color: 'var(--c-grant)',
          border: '1px solid var(--c-grant-br)',
        }}>✓ no attributes — public</span>
      )}
      {explainPolicy(policy, fqns).map(r => (
        <span key={r.attribute} className="mono" style={{
          fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
          background: r.satisfied ? 'var(--c-grant-bg)' : 'var(--c-surface-2)',
          color: r.satisfied ? 'var(--c-grant)' : 'var(--c-text-5)',
          border: `1px solid ${r.satisfied ? 'var(--c-grant-br)' : 'var(--c-border)'}`,
        }}>
          {r.satisfied ? '✓ ' : '✗ '}
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
    <div className="card" style={{
      padding: '13px 15px',
      borderColor: result ? (result.granted ? 'var(--c-grant-br)' : 'var(--c-deny-br)') : 'var(--c-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>
            {unit.label}
            {unit.upload && (
              <span className="mono" style={{
                marginLeft: 7, fontSize: 9, padding: '1px 5px', borderRadius: 4,
                fontWeight: 500, verticalAlign: 'middle',
                background: 'var(--c-surface-2)', color: 'var(--c-text-5)',
                border: '1px solid var(--c-border)',
              }}>{unit.upload.kind === 'plaintext' ? 'yours · encrypted here' : 'yours · already a TDF'}</span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--c-text-5)', marginTop: 3 }}>
            {unit.classification}
            {/* Flagged inline as well as itemised below, because the interesting claim is about
                this specific string: it is a reading of the policy, not a label on the file. */}
            {unit.derivedMarking && (
              <span style={{ color: 'var(--c-text-6)' }}> · derived from policy</span>
            )}
            {' · '}{fmtBytes(bytes)} TDF
            {unit.upload && ` · ${unit.upload.filename}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {unit.upload && (
            <button onClick={() => removeDocument(unit.upload.id)}
              title="Remove from the corpus and delete it from this app's data directory"
              style={{
                fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                color: 'var(--c-text-5)',
              }}>Remove</button>
          )}
          <button onClick={save} title="Export the ciphertext — the policy is inside the file" style={{
            fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
            background: 'var(--c-surface-2)',
            border: `1px solid ${saved === 'error' ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
            color: saved === 'ok' ? 'var(--c-grant)' : saved === 'error' ? 'var(--c-deny)' : 'var(--c-text-4)',
          }}>{saved === 'ok' ? '✓ Saved .tdf' : saved === 'error' ? 'Save failed' : 'Save .tdf'}</button>
          <button onClick={attempt} disabled={busy} style={{
            fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 7,
            cursor: busy ? 'wait' : 'pointer',
            background: busy ? 'var(--c-surface-2)' : '#1e40af',
            border: '1px solid var(--c-border)',
            color: busy ? 'var(--c-text-5)' : '#fff',
          }}>{busy ? 'Asking KAS…' : 'Try decrypt'}</button>
        </div>
      </div>

      <div style={{ marginTop: 11, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 210 }}>
          <div className="section-label" style={{ marginBottom: 5 }}>
            POLICY VS YOUR ATTRIBUTES
          </div>
          <PolicyChips policy={unit.policy} fqns={entityFqns} />
          <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 7, lineHeight: 1.6, maxWidth: 340 }}>
            {unit.policyNote}
          </div>
        </div>

        {agent && (
          <div style={{ minWidth: 210 }}>
            <div className="section-label" style={{ marginBottom: 5 }}>
              POLICY VS {agent.name.toUpperCase()}
            </div>
            <PolicyChips policy={unit.policy} fqns={agentFqns} />
            <div style={{ fontSize: 10, marginTop: 7, lineHeight: 1.6, maxWidth: 340,
              color: agentSatisfied ? 'var(--c-text-6)' : 'var(--c-warn)' }}>
              {agentSatisfied
                ? 'The assistant can retrieve this for you in chat.'
                : 'The assistant cannot retrieve this in chat, even for someone entitled to it. "Try decrypt" below is you, directly — not through the agent.'}
            </div>
          </div>
        )}

        <div style={{ minWidth: 190 }}>
          <div className="section-label" style={{ marginBottom: 5 }}>
            BOUND ATTRIBUTES ({boundAttributes.length})
          </div>
          <div style={{ fontSize: 10, color: 'var(--c-text-6)', lineHeight: 1.6, maxWidth: 300 }}>
            Read back out of the TDF manifest after encryption — this is the literal list
            the KAS evaluates, not a UI copy of the intent.
          </div>
        </div>
      </div>

      {/* Reads `boundAttributes` rather than `unit.policy` on purpose: the banner is then derived
          from what the manifest actually carries, which is the same list the KAS is handed. */}
      <DerivedBanner policy={boundAttributes} style={{ marginTop: 11 }} />

      {result && (
        <div style={{
          marginTop: 11, padding: '9px 11px', borderRadius: 7,
          background: result.granted ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
          border: `1px solid ${result.granted ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: result.granted ? 'var(--c-grant)' : 'var(--c-deny)',
          }}>
            {result.granted ? '✓ Key released' : '✗ Rewrap refused'}
            {result.granted && (
              <button onClick={() => setOpen(o => !o)} style={{
                marginLeft: 10, fontSize: 10, fontWeight: 500, padding: '2px 8px',
                borderRadius: 5, cursor: 'pointer', background: 'transparent',
                border: '1px solid var(--c-grant-br)', color: 'var(--c-grant)',
              }}>{open ? 'hide plaintext' : 'show plaintext'}</button>
            )}
          </div>
          {!result.granted && (
            <div style={{ fontSize: 10.5, color: 'var(--c-text-4)', marginTop: 4, lineHeight: 1.55 }}>
              {result.reason}
            </div>
          )}
          {result.granted && open && (
            <pre className="mono" style={{
              margin: '9px 0 0', fontSize: 10.5, lineHeight: 1.6, color: 'var(--c-text-3)',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflowY: 'auto',
            }}>{result.text}</pre>
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
    <div className="card" style={{ padding: '13px 15px', borderColor: 'var(--c-warn-br)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{record.label}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--c-text-5)', marginTop: 3 }}>
            {record.filename} · {fmtBytes(record.bytes)} · spec {f.specVersion ?? 'unversioned'}
            {f.mimeType && ` · ${f.mimeType}`}
          </div>
        </div>
        <button onClick={() => removeDocument(record.id)} style={{
          fontSize: 11, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
          color: 'var(--c-text-5)', flexShrink: 0,
        }}>Remove</button>
      </div>

      <div style={{ marginTop: 11, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 210 }}>
          <div className="section-label" style={{ marginBottom: 5 }}>
            POLICY IN THE MANIFEST ({(f.attributes ?? []).length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(f.attributes ?? []).length === 0
              ? <span className="mono" style={{ fontSize: 9.5, color: 'var(--c-text-5)' }}>
                  no attributes
                </span>
              : f.attributes.map(a => (
                  <span key={a} className="mono" title={a} style={{
                    fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
                    background: 'var(--c-surface-2)', color: 'var(--c-text-4)',
                    border: '1px solid var(--c-border)',
                  }}>{shortFqn(a)}</span>
                ))}
          </div>
          {(f.namespaces ?? []).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 7, lineHeight: 1.6 }}>
              Namespace {f.namespaces.join(', ')} — not one this platform knows, so even the
              policy could not be evaluated here.
            </div>
          )}
        </div>

        <div style={{ minWidth: 210, maxWidth: 340 }}>
          <div className="section-label" style={{ marginBottom: 5 }}>WHY IT CANNOT BE OPENED</div>
          <div style={{ fontSize: 10, color: 'var(--c-text-6)', lineHeight: 1.6 }}>
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
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)' }}>{name}</span>
      <span style={{ fontSize: 11, color: 'var(--c-text-5)' }}>{title}</span>
      <span style={{ flex: 1 }} />
      {fqns.length === 0
        ? <span style={{ fontSize: 11, color: 'var(--c-text-6)', fontStyle: 'italic' }}>no entitlements</span>
        : fqns.map(f => (
            <span key={f} className="mono" style={{
              fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
              background: color + '15', color,
              border: `1px solid ${color}30`,
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
    <div style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-1)' }}>
              Corpus <span style={{ color: mode.accent }}>· {mode.short}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 4, lineHeight: 1.65, maxWidth: 660 }}>
              {mode.name} — {vault.size} TDFs, {fmtBytes(totalBytes)} total, encrypted on this
              machine when you launched the mode. The plaintext is not held anywhere the app can
              read it; each card below asks the local KAS to unwrap for whoever you are acting as
              right now — as you, directly, not through the assistant.
              {agent && ' The agent\'s own verdict is shown beside yours, because in chat both have to clear.'}
              {yours > 0 && ` ${yours} of them you added yourself.`}
            </div>
          </div>
          {!adding && (
            <button onClick={() => setAdding(true)} style={{
              fontSize: 12, fontWeight: 600, padding: '7px 13px', borderRadius: 7,
              cursor: 'pointer', flexShrink: 0, marginTop: 2,
              background: 'var(--c-surface)', border: `1px solid ${mode.accent}66`,
              color: mode.accent,
            }}>+ Add a document</button>
          )}
        </div>

        {adding && (
          <div style={{ margin: '14px 0 4px' }}>
            <AddDocument onClose={() => setAdding(false)} />
          </div>
        )}

        {uploadWarnings.length > 0 && (
          <div className="card" style={{
            padding: '10px 13px', marginTop: 14,
            background: 'var(--c-deny-bg)', borderColor: 'var(--c-deny-br)',
          }}>
            <div className="section-label" style={{ marginBottom: 4, color: 'var(--c-deny)' }}>
              {uploadWarnings.length} OF YOUR DOCUMENTS COULD NOT BE LOADED
            </div>
            {uploadWarnings.map(w => (
              <div key={w.record.id} style={{ fontSize: 10.5, color: 'var(--c-text-4)', lineHeight: 1.6 }}>
                <strong>{w.record.label}</strong> — {w.error}
              </div>
            ))}
          </div>
        )}

        {/* Both subjects, one above the other — the agent's row is not decoration here, it is
            what decides whether the assistant can fetch any of these cards for you. */}
        <div className="card" style={{ padding: '11px 14px', margin: '14px 0 16px' }}>
          <SubjectBar
            icon={persona.icon}
            badge={persona.badge}
            color={persona.color}
            name={persona.name}
            title={persona.title}
            fqns={entityFqns}
          />
          {agent && (
            <div style={{ marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--c-border)' }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11, paddingBottom: 24 }}>
          {documents.map(doc => {
            const entries = unitsForDocument(vault, doc)
            if (entries.length === 1 && !doc.tiers) {
              return <UnitCard key={doc.id} entry={entries[0]} />
            }
            return (
              <div key={doc.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--c-text-5)', paddingLeft: 2 }}>
                  <strong style={{ color: 'var(--c-text-3)' }}>{doc.label}</strong>
                  {' '}— {entries.length} independently encrypted tiers over the same record
                </div>
                {entries.map(e => <UnitCard key={e.unit.key} entry={e} />)}
              </div>
            )
          })}
        </div>

        {foreignUploads.length > 0 && (
          <div style={{ paddingBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-2)' }}>
              From another platform — inspect only
            </div>
            <div style={{ fontSize: 11, color: 'var(--c-text-5)', margin: '4px 0 11px', lineHeight: 1.65, maxWidth: 660 }}>
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
