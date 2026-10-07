import { useEffect, useMemo, useState } from 'react'
import { markingOf } from './marking.js'
import { subscribeLedger, ledgerRows } from './vault.js'
import { hexRows, sha256, byteSize, wrappedKeyBytes, zipEntries } from './cipher.js'

export const fileNameOf = (entry) => `${entry.unit.doc.id}${entry.unit.tier && entry.unit.doc.tiers ? `-${entry.unit.tier.id}` : ''}.tdf`

const NAMESPACE = /^https?:\/\/[^/]+\/attr\//
const chip = (fqn) => fqn.replace(NAMESPACE, '').replace('/value/', ':')

function decodePolicy(manifest) {
  try { return JSON.parse(atob(manifest.encryptionInformation.policy)) } catch { return null }
}

/** The manifest, pretty-printed, with long base64 fields shortened and labelled by their true length. */
function Manifest({ text }) {
  return text.split('\n').map((line, i) => {
    const m = line.match(/^(\s*)"([^"]+)": (.*)$/)
    if (!m) return <span key={i}>{line}{'\n'}</span>
    const [, pad, key, rest] = m
    const s = rest.match(/^"(.*)"(,?)$/)
    let val
    if (s && s[1].length > 48) val = <><span className="s">&quot;{s[1].slice(0, 34)}…&quot;</span>{s[2]} <span className="n">// {s[1].length} chars</span></>
    else if (s) val = <span className="s">{rest}</span>
    else if (/^(true|false|\d)/.test(rest)) val = <span className="n">{rest}</span>
    else val = rest
    return <span key={i}>{pad}<span className="k">&quot;{key}&quot;:</span> {val}{'\n'}</span>
  })
}

function Answers({ unitKey, nameOf }) {
  const [, tick] = useState(0)
  useEffect(() => subscribeLedger(() => tick(n => n + 1)), [])
  const rows = ledgerRows().filter(r => r.unitKey === unitKey).slice(-5).reverse()
  if (!rows.length) return null
  return (
    <div className="sec">
      <h5>Key server, recent answers for this file</h5>
      <table className="zip">
        <tbody>
          {rows.map(r => (
            <tr key={`${r.at}-${r.personaId}`}>
              <td>{new Date(r.at).toLocaleTimeString([], { hour12: false })}.{String(r.at % 1000).padStart(3, '0')}</td>
              <td>{nameOf(r.personaId)}</td>
              <td style={{ color: r.granted ? 'var(--green)' : 'var(--red)' }}>{r.granted ? 'permitted' : 'refused'}</td>
              <td style={{ textAlign: 'right' }}>{r.ms} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TdfInspector({ entries, index, onIndex, cr, holder, nameOf, onClose, onToast }) {
  const entry = entries[Math.min(index, entries.length - 1)]
  const [sum, setSum] = useState(null)
  useEffect(() => {
    let alive = true
    setSum(null)
    sha256(entry.tdfBytes).then(h => alive && setSum(h))
    return () => { alive = false }
  }, [entry.tdfBytes])

  const info = useMemo(() => {
    const m = entry.manifest
    const zip = zipEntries(entry.tdfBytes)
    const policy = decodePolicy(m)
    return {
      zip,
      attrs: policy?.body?.dataAttributes?.map(a => chip(a.attribute)) ?? [],
      text: JSON.stringify(m, null, 2),
      cipher: m.encryptionInformation?.method?.algorithm ?? 'AES-256-GCM',
      kas: m.encryptionInformation?.keyAccess?.[0],
      wrapped: wrappedKeyBytes(m),
      hex: hexRows(entry.tdfBytes, 8, 16),
      banner: markingOf(entry.unit.policy).banner,
    }
  }, [entry])

  const doc = entry.unit.doc
  const file = fileNameOf(entry)
  const sizeOf = (name) => info.zip.find(z => z.name === name)?.size

  const download = () => {
    const url = URL.createObjectURL(new Blob([entry.tdfBytes], { type: 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url
    a.download = file
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    onToast(`Saved ${file}. Any OpenTDF tool can open it.`)
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(sum ?? ''); onToast('sha256 copied') } catch { onToast('Could not reach the clipboard') }
  }

  return (
    <div className="scrim on" onClick={onClose}>
      <div className="insp" role="dialog" aria-label="File properties" onClick={e => e.stopPropagation()}>
        <div className="ih">
          <div><b>File properties · {doc.title}</b><br /><small>Attached to {cr} · as held by {holder}</small></div>
          <button className="btn x" onClick={onClose}>Close</button>
        </div>
        {entries.length > 1 && (
          <div className="tabs">
            {entries.map((e, i) => <button key={e.unit.key} className={`tab ${i === index ? 'on' : ''}`} onClick={() => onIndex(i)}>{e.unit.tier.label} · {fileNameOf(e)}</button>)}
          </div>
        )}
        <div className="ib">
          <div className="sum">
            <div><small>Format</small><b>TDF3 · zip container</b></div>
            <div><small>Size on disk</small><b>{byteSize(entry.tdfBytes.length)}</b></div>
            <div><small>Content cipher</small><b>{info.cipher}</b></div>
            <div style={{ gridColumn: '1/-1' }}><small>File</small><b>{file}</b></div>
            <div style={{ gridColumn: '1/-1' }}><small>sha256 of the file</small><b>{sum ?? '…'}</b></div>
          </div>
          <div className="sec">
            <h5>Inside the container</h5>
            <table className="zip">
              <thead><tr><th>Entry</th><th>Size</th><th>What it is</th></tr></thead>
              <tbody>
                <tr><td>0.payload</td><td>{sizeOf('0.payload') != null ? byteSize(sizeOf('0.payload')) : '—'}</td><td>The document, encrypted. Unreadable without the key.</td></tr>
                <tr><td>0.manifest.json</td><td>{sizeOf('0.manifest.json') != null ? byteSize(sizeOf('0.manifest.json')) : '—'}</td><td>How to ask for the key, and the policy that governs it.</td></tr>
              </tbody>
            </table>
          </div>
          <div className="sec">
            <h5>Who may open it: written inside the file</h5>
            <p>Decoded from the manifest&apos;s <code>policy</code> field. The key server checks every one of these against the person asking. Marking: <b>{info.banner}</b></p>
            <div className="chips">{info.attrs.length ? info.attrs.map(a => <span key={a}>{a}</span>) : <span>none: any authenticated programme user</span>}</div>
          </div>
          {info.kas && (
            <div className="sec">
              <h5>Where the key lives</h5>
              <p>Held by the key server at <code>{info.kas.url}</code> (key {info.kas.kid ?? 'r1'}){info.wrapped ? `. The file carries it wrapped: ${info.wrapped} bytes.` : '.'}</p>
            </div>
          )}
          <div className="sec"><h5>Manifest</h5><pre className="code"><Manifest text={info.text} /></pre></div>
          <div className="sec"><h5>Ciphertext</h5><pre className="code">{info.hex.join('\n')}</pre></div>
          <Answers unitKey={entry.unit.key} nameOf={nameOf} />
          <div className="say">The policy is bound to the key with an HMAC. Change one attribute in the manifest and the key server rejects the file before it looks at the person.</div>
          <div className="acts">
            <button className="btn p" onClick={download}>Download .tdf</button>
            <button className="btn" onClick={copy}>Copy sha256</button>
          </div>
        </div>
      </div>
    </div>
  )
}
