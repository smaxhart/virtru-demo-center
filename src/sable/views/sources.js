import { state, set, pep, act, esc } from '../state.js'
import { SOURCES, QUERIES, runQuery, joinPolicy } from '../db.js'
import { cur, polChips, pill, dec } from '../ui.js'
import { describe } from '../policy.js'
import { resolved } from '../vault.js'

const hl = (sql) => esc(sql).replace(/\b(SELECT|FROM|WHERE|JOIN|ON|AS)\b/g, '<span class="kw">$1</span>').replace(/(NULL AS \w+|pep_row_ok\([^)]*\))/g, '<span class="hl">$1</span>').replace(/(\/\*.*?\*\/)/g, '<span class="hl">$1</span>')

function srcCard(persona, s) {
  return `<div class="card"><div class="dbh"><span class="eng">${esc(s.engine)}</span><b>${esc(s.db)}</b><span class="dim mono">.${esc(s.table)}</span></div>
    <div class="dim" style="font-size:11.5px;margin-bottom:6px">${esc(s.desc)}</div>
    <table><tr><th>column</th><th>policy</th><th>you</th></tr>${s.cols.map((c) => `<tr><td class="m">${esc(c.n)}</td><td>${polChips(c.pol)}</td><td>${dec(persona, c.pol).ok ? pill('ok', 'SELECT') : pill('sl', 'NULL')}</td></tr>`).join('')}</table></div>`
}

export function sourcesHtml() {
  const persona = cur()
  const q = QUERIES.find((x) => x.id === state.query)
  const res = runQuery(persona, q)
  const need = q.federated ? joinPolicy(q) : null
  return `<h2>Data Sources</h2>
  <p class="sub">Three different engines, one PEP in front of all of them. Every row and column is a key-server decision: columns the caller cannot read come back NULL, rows they cannot read never come back, and the values that do come back are decrypted as the caller. A join across sources is a new object with a derived policy.</p>
  <div class="grid3">${Object.values(SOURCES).map((s) => srcCard(persona, s)).join('')}</div>
  <div class="card" style="margin-top:12px"><h3>Query console</h3>
    <div class="chips" style="margin-bottom:8px">${QUERIES.map((x) => `<button class="btn sm ${x.id === q.id ? 'pri' : ''}" data-act="query" data-id="${x.id}">${esc(x.title)}</button>`).join('')}</div>
    <div class="note" style="margin-top:0">${esc(q.note)}</div>
    <div class="grid2">${res.per.map((p) => `<div><div class="dim mono" style="font-size:10.5px;margin:4px 0">as submitted &rarr; ${esc(p.src.db)}</div><div class="sql">${hl(p.sql.orig)}</div></div>
      <div><div class="dim mono" style="font-size:10.5px;margin:4px 0">after PEP rewrite for ${esc(persona.id)}</div><div class="sql">${hl(p.sql.pepd)}</div></div>`).join('')}</div>
    ${q.federated ? `<div class="derive"><div class="big">FEDERATED JOIN &mdash; DERIVED POLICY</div><div style="margin-top:6px">${polChips(need)}</div><div class="dim" style="margin-top:6px;font-size:11.5px">Airframe RCS &times; threat fire-control range = the range at which each emitter can engage each article. None of the selected columns is TS; the <em>output</em> is, because the advanced-IADS rows feed it, and it picks up the KESTREL compartment because the threat side is sealed. The joined result is itself a TDF sealed under this policy.</div></div>` : ''}
    ${res.refused ? `<div class="derive" style="border-color:#5a1f21;background:#170c0c"><div class="big" style="color:var(--red)">REFUSED</div><div class="mono" style="margin-top:4px">${esc(res.refused)}</div><div class="note">Each half is still available on its own where the caller is entitled &mdash; it is the <em>combination</em> that is withheld. This is the mosaic problem the column policies alone cannot catch.</div></div>`
      : `<div style="overflow-x:auto;margin-top:10px"><table><tr>${(res.cols || []).map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${(res.rows || []).map((r) => `<tr>${res.cols.map((c) => `<td class="m">${r[c] === '███' ? '<span class="redact">███</span>' : r[c] === '⊘' ? '<span class="redact">⊘</span>' : esc(r[c] == null ? '—' : r[c])}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${(res.cols || ['x']).length}" class="sealed">0 rows &mdash; every row filtered by the PEP</td></tr>`}</table></div>
      <div class="dim" style="margin-top:6px;font-size:11px">${res.per.map((p) => `${p.visible.length} of ${p.src.rows.length} rows from ${p.src.table} released`).join(' &middot; ')}</div>`}
  </div>`
}

export async function sourcesAction(a, el) {
  if (a !== 'query') return
  const persona = cur()
  const q = QUERIES.find((x) => x.id === el.dataset.id)
  const r = await resolved(() => runQuery(persona, q))
  pep(persona.name, 'SELECT', q.src.map((s) => SOURCES[s].db).join(' + '), r.refused ? 'DENY' : 'PERMIT', r.refused ? r.refused : q.federated ? `join policy ${describe(r.derived)}` : `${r.rows.length} rows`)
  act(persona.id, r.refused ? 'denied' : 'opened')
  set({ query: q.id })
}
