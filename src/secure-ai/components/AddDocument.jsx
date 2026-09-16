/**
 * Adding your own document to a scenario's corpus.
 *
 * Four routes in, decided by what the file actually is rather than by what the user says it is:
 *
 *   a TDF this app made      → joins the corpus as ciphertext, policy read from its own manifest
 *   a TDF from another KAS   → stored inspect-only; its key is not ours and never will be
 *   text                     → attributes are picked (markings pre-fill them), then encrypted
 *   anything else            → refused, with the reason
 *
 * The refusals matter as much as the successes. A PDF, or a TDF1 file from Virtru's commercial
 * stack, would each fail somewhere deeper and less legibly — the SDK's actual error for TDF1 is
 * "unsupported format; prefix not recognized 60,63,120", which is not something to discover in
 * front of an audience. So both are detected here and explained in words.
 */

import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { shortFqn, fmtBytes } from '../ai/corpus.js'
import { sniffFormat, inspectZtdf, namespacesOf } from '../api/tdfInspect.js'
import { detectMarkings, suggestKeywords } from '../ai/markings.js'
import { field, Label, Notice, AttributePicker } from './ui.jsx'

// Mirrors the ceiling in ui.jsx's picker — see the note in electron/identities.js for why 20.
const MAX_POLICY_VALUES = 20

// ── The flow ──────────────────────────────────────────────────────────────────

/**
 * @param {() => void} onClose
 */
export default function AddDocument({ onClose }) {
  const { addDocument, mode } = useApp()

  const [vocab, setVocab]     = useState(null)
  const [picked, setPicked]   = useState(null)   // { filename, bytes, format, info? }
  const [reject, setReject]   = useState(null)   // a string explaining why the file cannot be used
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState(null)

  // The editable form
  const [label, setLabel]   = useState('')
  const [cls, setCls]       = useState('UNCLASSIFIED')
  const [policy, setPolicy] = useState([])
  const [note, setNote]     = useState('')
  const [keywords, setKw]   = useState('')
  const [detected, setDetected] = useState(null) // detectMarkings() result, plaintext only

  // Passing the mode id adds the vocabulary a user-built scenario invented, so a document added
  // to one can be tagged with its own attributes rather than only the shipped ones.
  useEffect(() => {
    window.electronAPI?.getAttributeDefs?.(mode?.id).then(setVocab).catch(() => setVocab(null))
  }, [mode?.id])

  const choose = useCallback(async () => {
    setReject(null); setError(null); setDetected(null)

    const file = await window.electronAPI?.openFile?.()
    if (!file) return

    const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes)
    const format = sniffFormat(bytes)
    const stem = file.filename.replace(/\.(tdf|txt|md|json|csv)$/i, '').replace(/[_-]+/g, ' ')

    if (format === 'tdf1') {
      setReject(`${file.filename} is a TDF1 file — the XML format Virtru's commercial products `
        + `write (Secure Share, the Desktop client). This app's platform speaks TDF3/ZTDF, and `
        + `the OpenTDF SDK cannot read TDF1 at all. Nothing here can open or even inspect it.`)
      return
    }

    if (format === 'binary') {
      setReject(`${file.filename} is not text. TDF will happily encrypt any bytes, but this `
        + `corpus is read by a language model, so a document it cannot read would be encrypted, `
        + `policy-enforced, and useless. Export it to text first.`)
      return
    }

    if (format === 'ztdf') {
      const info = await inspectZtdf(bytes)
      if (!info.ok) {
        setReject(`${file.filename} looks like a TDF archive but its manifest could not be read: `
          + `${info.error}`)
        return
      }
      setPicked({ filename: file.filename, bytes, format, info })
      setLabel(stem)
      setPolicy(info.attributes)
      setCls(info.ours ? 'FROM MANIFEST' : 'FOREIGN')
      // No text to read, so the filename is all there is to go on. Said out loud in the form.
      setKw(suggestKeywords('', file.filename).join(', '))
      setNote(info.ours
        ? 'Encrypted by this app on this machine. Its policy is whatever is bound in its manifest.'
        : `Encrypted by another platform. Its key is wrapped to ${info.kasUrls.join(', ') || 'an unnamed KAS'}.`)
      return
    }

    // Text
    const text = new TextDecoder().decode(bytes)
    const det = vocab ? detectMarkings(text, vocab) : null
    setPicked({ filename: file.filename, bytes, format, text })
    setDetected(det)
    setLabel(stem)
    setPolicy(det?.fqns ?? [])
    setCls(det?.banner ?? 'UNCLASSIFIED')
    setKw(suggestKeywords(text, file.filename).join(', '))
    setNote(det?.fqns.length
      ? 'Policy proposed from the document\'s own markings, then confirmed here.'
      : 'Policy chosen by hand when the document was added.')
  }, [vocab])

  const kind = !picked ? null
    : picked.format === 'text' ? 'plaintext'
    : picked.info.ours ? 'ztdf-local' : 'ztdf-foreign'

  const canSave = picked && label.trim() && policy.length <= MAX_POLICY_VALUES && !busy

  const save = useCallback(async () => {
    setBusy(true); setError(null)
    try {
      const record = {
        kind,
        label: label.trim(),
        classification: cls.trim() || 'UNCLASSIFIED',
        // A foreign TDF's policy is a fact about the file, not a choice; a local TDF's comes
        // from its manifest. Only the plaintext route takes the picker's word for it.
        policy: kind === 'plaintext' ? policy : picked.info.attributes,
        policyNote: note.trim(),
        keywords: keywords.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
        filename: picked.filename,
        ...(kind === 'ztdf-foreign' ? {
          foreign: {
            kasUrls: picked.info.kasUrls,
            attributes: picked.info.attributes,
            namespaces: namespacesOf(picked.info.attributes),
            mimeType: picked.info.mimeType,
            specVersion: picked.info.specVersion,
          },
        } : {}),
      }
      await addDocument(record, kind === 'plaintext' ? picked.text : picked.bytes)
      onClose()
    } catch (err) {
      setError(err?.message ?? String(err))
      setBusy(false)
    }
  }, [kind, label, cls, policy, note, keywords, picked, addDocument, onClose])

  return (
    <div className="card" style={{ padding: '15px 17px', borderColor: mode.accent + '55' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', flex: 1 }}>
          Add a document to the {mode.short} corpus
        </div>
        <button onClick={onClose} style={{
          fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-text-5)',
        }}>Cancel</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text-5)', lineHeight: 1.6, marginBottom: 13 }}>
        Text gets encrypted into a TDF here, with the policy you choose. A .tdf this app made
        joins the corpus as-is. A .tdf from another platform can be inspected but never opened —
        its key is wrapped to that platform's KAS, not this one.
      </div>

      {!picked && !window.electronAPI && (
        <Notice tone="warn">
          Adding documents needs the desktop app — the file dialog and the store both live in the
          main process. In browser mode the built-in corpus still works.
        </Notice>
      )}

      {!picked && window.electronAPI && (
        <>
          {/* Held back until the seeded vocabulary is in hand: opening the picker first would
              mean detecting markings against nothing and appearing to have found none. */}
          <button onClick={choose} disabled={!vocab} style={{
            fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7,
            cursor: vocab ? 'pointer' : 'wait',
            background: vocab ? '#1e40af' : 'var(--c-surface-2)',
            border: '1px solid var(--c-border)',
            color: vocab ? '#fff' : 'var(--c-text-6)',
          }}>{vocab ? 'Choose a file…' : 'Reading the attribute list…'}</button>
          {reject && <div style={{ marginTop: 11 }}><Notice tone="deny">{reject}</Notice></div>}
        </>
      )}

      {picked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
          {/* What the file turned out to be — stated before anything is editable */}
          <div className="mono" style={{ fontSize: 10, color: 'var(--c-text-5)' }}>
            {picked.filename} · {fmtBytes(picked.bytes.length)} · {picked.format}
            {picked.info && ` · spec ${picked.info.specVersion ?? 'unversioned'}`}
          </div>

          {kind === 'ztdf-local' && (
            <Notice tone="grant">
              This TDF was made by this app, so its key is held by the KAS running here. It will
              join the corpus as ciphertext — nothing re-encrypts it, and its plaintext stays
              unavailable until the KAS releases it to whoever you are acting as.
            </Notice>
          )}

          {kind === 'ztdf-foreign' && (
            <Notice tone="warn">
              This TDF's key is wrapped to {picked.info.kasUrls.join(', ') || 'a KAS that is not named in the manifest'},
              so it can never be decrypted here — no entitlement changes that, because the private
              half of that key lives on another platform. It will be stored inspect-only: you can
              show its policy and its manifest, and it stays out of the corpus so it is never
              mistaken for an access denial.
              {namespacesOf(picked.info.attributes).length > 0 && (
                <> Its attributes live in {namespacesOf(picked.info.attributes).join(', ')},
                  which this platform has never heard of.</>
              )}
            </Notice>
          )}

          {detected && (detected.fqns.length > 0 || detected.unmapped.length > 0) && (
            <div className="card" style={{ padding: '10px 12px', background: 'var(--c-surface-2)' }}>
              <Label>MARKINGS FOUND IN THE DOCUMENT</Label>
              {detected.fqns.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {detected.hits.map(h => (
                    <span key={h.fqn} className="mono" title={h.marking} style={{
                      fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
                      background: 'var(--c-grant-bg)', color: 'var(--c-grant)',
                      border: '1px solid var(--c-grant-br)',
                    }}>{shortFqn(h.fqn)}</span>
                  ))}
                </div>
              )}
              {detected.unmapped.map(u => (
                <div key={u.marking} style={{ fontSize: 10, color: 'var(--c-warn)', lineHeight: 1.6 }}>
                  <span className="mono">{u.marking}</span> — {u.why}
                </div>
              ))}
              {detected.dropped > 0 && (
                <div style={{ fontSize: 10, color: 'var(--c-deny)', lineHeight: 1.6 }}>
                  {detected.dropped} further value(s) left off — a policy tops out at 20.
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 6, lineHeight: 1.6 }}>
                Pre-filled below, not applied. Nothing is encrypted until you save.
              </div>
            </div>
          )}

          <div>
            <Label>LABEL</Label>
            <input style={field} value={label} onChange={e => setLabel(e.target.value)} />
          </div>

          <div>
            <Label hint="shown on the card and given to the model as a banner">CLASSIFICATION</Label>
            <input style={field} value={cls} onChange={e => setCls(e.target.value)} />
          </div>

          {kind === 'plaintext' ? (
            <div>
              <Label hint="written verbatim into the manifest">POLICY</Label>
              {vocab
                ? <AttributePicker vocab={vocab} selected={policy} onChange={setPolicy} />
                : <Notice tone="deny">
                    The seeded attribute list could not be read, so there is nothing safe to offer:
                    a policy naming a value the platform does not have denies everyone.
                  </Notice>}
            </div>
          ) : (
            <div>
              <Label hint="read back out of the manifest — not editable, because the file already says so">
                POLICY IN THE MANIFEST
              </Label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {picked.info.attributes.length === 0
                  ? <span className="mono" style={{ fontSize: 9.5, color: 'var(--c-text-5)' }}>
                      no attributes — releases to any authenticated caller
                    </span>
                  : picked.info.attributes.map(f => (
                      <span key={f} className="mono" title={f} style={{
                        fontSize: 9.5, padding: '2px 6px', borderRadius: 4,
                        background: 'var(--c-surface-2)', color: 'var(--c-text-4)',
                        border: '1px solid var(--c-border)',
                      }}>{shortFqn(f)}</span>
                    ))}
              </div>
            </div>
          )}

          {kind !== 'ztdf-foreign' && (
            <div>
              <Label hint={kind === 'ztdf-local'
                ? 'the only clue is the filename — there is no readable text to mine'
                : 'comma separated; a question has to hit one of these to retrieve the document'}>
                RETRIEVAL KEYWORDS
              </Label>
              <input style={field} value={keywords} onChange={e => setKw(e.target.value)} />
              {keywords.trim() === '' && (
                <div style={{ fontSize: 10, color: 'var(--c-warn)', marginTop: 4, lineHeight: 1.6 }}>
                  With no keywords this document is encrypted and enforced, but no question will
                  ever reach it.
                </div>
              )}
            </div>
          )}

          <div>
            <Label hint="the sentence under the policy chips">NOTE</Label>
            <input style={field} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {error && <Notice tone="deny">{error}</Notice>}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={save} disabled={!canSave} style={{
              fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 7,
              cursor: canSave ? 'pointer' : 'not-allowed',
              background: canSave ? '#1e40af' : 'var(--c-surface-2)',
              border: '1px solid var(--c-border)',
              color: canSave ? '#fff' : 'var(--c-text-6)',
            }}>
              {busy ? 'Encrypting…'
                : kind === 'plaintext' ? 'Encrypt and add'
                : kind === 'ztdf-local' ? 'Add to the corpus'
                : 'Store inspect-only'}
            </button>
            <button onClick={choose} style={{
              fontSize: 11, padding: '6px 11px', borderRadius: 7, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-text-5)',
            }}>Pick a different file</button>
            <span style={{ fontSize: 10, color: 'var(--c-text-6)' }}>
              Kept in this app's data directory — it survives restarts and updates.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
