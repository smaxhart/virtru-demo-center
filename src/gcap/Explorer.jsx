import { useState } from 'react'
import { byteSize } from './cipher.js'
import { fileNameOf } from './TdfInspector.jsx'
import { TODAY_UK } from './desk.js'
import { Ico, ICONS, TdfGlyph, ErrorDialog } from './winui.jsx'

const SEEDED = [
  { id: 'x1', name: 'Workshop-agenda.docx', type: 'Microsoft Word Document', size: '38 KB', when: '05/10/2026 14:08', kind: 'doc' },
  { id: 'x2', name: 'Travel-claim-October.xlsx', type: 'Microsoft Excel Worksheet', size: '21 KB', when: '02/10/2026 09:30', kind: 'xls' },
]

const PLACES = ['Home', 'Desktop', 'Downloads', 'Documents', 'Pictures']

const Glyph = ({ kind }) => (
  <svg width="18" height="22" viewBox="0 0 22 26" aria-hidden="true"><path d="M2 1h12l6 6v18H2z" fill="#fff" stroke="#8a8886" /><path d="M14 1v6h6" fill="none" stroke="#8a8886" /><rect x="0" y="12" width="14" height="8" rx="1.500" fill={kind === 'xls' ? '#1d6f42' : '#2b579a'} /><text x="7" y="18.300" textAnchor="middle" fontSize="6" fontWeight="700" fill="#fff" fontFamily="Segoe UI, sans-serif">{kind === 'xls' ? 'X' : 'W'}</text></svg>
)

/** File Explorer on the Downloads folder: the place a saved attachment lands, and where a double-click goes wrong for an outsider. */
export default function Explorer({ ctx, pid }) {
  const { S } = ctx
  const [sel, setSel] = useState(null)
  const mine = S.files.filter(f => f.pid === pid)
  const rows = [
    ...mine.map(f => ({ id: f.id, f, name: f.name, type: 'TDF File', size: byteSize(ctx.sizeOf(f.docId)), when: `${TODAY_UK} ${f.at}` })),
    ...SEEDED,
  ]
  const dialogFile = mine.find(f => f.res)
  const open = (r) => {
    if (!r.f) return
    if (pid === 'gmail') ctx.openFile(r.f)
    else ctx.viewDoc(pid, r.f.docId, r.f.from)
  }

  return (
    <section className="ex" aria-label="File Explorer, Downloads">
      <div className="ex-top">
        <span className="ex-tab"><Ico d={ICONS.folder} size={14} />Downloads<Ico d={ICONS.x} size={10} /></span>
        <span className="ex-new"><Ico d={ICONS.plus} size={13} /></span>
        <i className="dk-gap" />
      </div>
      <div className="ex-bar">
        <span className="ex-nav"><Ico d={ICONS.back} size={15} /><Ico d={ICONS.fwdNav} size={15} /><Ico d={ICONS.refresh} size={14} /></span>
        <span className="ex-path"><Ico d={ICONS.folder} size={14} />This PC<Ico d={ICONS.chevR} size={10} />Downloads</span>
        <span className="ex-find"><Ico d={ICONS.srch} size={13} />Search Downloads</span>
      </div>
      <div className="ex-cmd"><span><Ico d={ICONS.plus} size={13} />New</span><i /><span>Cut</span><span>Copy</span><span>Rename</span><span>Share</span><span>Delete</span></div>
      <div className="ex-grid">
        <nav className="ex-nav2" aria-label="Places">
          {PLACES.map(p => <span key={p} className={p === 'Downloads' ? 'on' : ''}><Ico d={p === 'Home' ? ICONS.home : ICONS.folder} size={14} />{p}</span>)}
          <h6>This PC</h6>
          <span><Ico d={ICONS.folder} size={14} />Local Disk (C:)</span>
        </nav>
        <div className="ex-list" role="grid" aria-label="Files">
          <div className="ex-hd"><span>Name</span><span>Date modified</span><span>Type</span><span>Size</span></div>
          <h6>Today</h6>
          {rows.map(r => (
            <button key={r.id} className={sel === r.id ? 'on' : ''} onClick={() => setSel(r.id)} onDoubleClick={() => open(r)} onKeyDown={e => e.key === 'Enter' && open(r)}>
              <span>{r.f ? <TdfGlyph w={16} h={19} /> : <Glyph kind={r.kind} />}{r.name}</span><span>{r.when}</span><span>{r.type}</span><span>{r.size}</span>
            </button>
          ))}
        </div>
      </div>
      <footer className="ex-ft">{rows.length} items{sel ? ' · 1 item selected' : ''}</footer>
      {dialogFile && <ErrorDialog res={dialogFile.res} name={fileNameOf(ctx.unitsOf(dialogFile.docId)[0])} onClose={() => ctx.set(dialogFile, { res: null })} />}
    </section>
  )
}
