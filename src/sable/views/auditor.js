import { state, set, esc } from '../state.js'
import { FILES } from '../data.js'
import { PERSONAS, shortName, layerAccess, dec } from '../ui.js'

const cell = (s) => (s === 'read' ? '<span class="cell r" title="read">R</span>' : s === 'exec' ? '<span class="cell x" title="execute only">X</span>' : '<span class="cell n" title="none">·</span>')
const fs = (p, f) => (dec(p, f.read).ok ? 'read' : f.exec && dec(p, f.exec).ok ? 'exec' : 'none')

function submitterNote(run) {
  const sub = PERSONAS.find((p) => p.id === run.submitter)
  if (!sub) return ''
  const open = ['L0', 'L1', 'L2', 'L3', 'L4'].filter((L) => layerAccess(run, sub, L).ok)
  const sealed = ['L2', 'L3', 'L4'].filter((L) => !open.includes(L))
  if (!sealed.length) return `The submitter can read every layer of their own run (${open.join(', ')}) &mdash; the policy puts no one between them and the result.`
  if (open.length <= 2) return `The submitter can read only ${open.join(' and ')}. ${sealed.join(', ')} ran under their identity and are sealed from them &mdash; the person who ran it is not the person who can read it.`
  return `The submitter can read ${open.join(', ')} but not ${sealed.join(', ')} &mdash; part of their own run is sealed from them.`
}

export function auditorHtml() {
  const models = Object.values(FILES).filter((f) => f.slot)
  const run = state.runs.find((r) => r.id === state.auditRun) || state.runs.find((r) => r.status === 'sealed')
  const fileMx = `<table class="mx"><tr><th>Model</th>${PERSONAS.map((p) => `<th title="${esc(p.name)}">${esc(p.id)}</th>`).join('')}</tr>${models.map((f) => `<tr><td class="m">${esc(f.path.split('/').slice(-1)[0])}</td>${PERSONAS.map((p) => `<td>${cell(fs(p, f))}</td>`).join('')}</tr>`).join('')}</table>
    <div class="dim" style="margin-top:6px;font-size:11px"><span class="cell r">R</span> read &nbsp; <span class="cell x">X</span> execute-only &nbsp; <span class="cell n">·</span> none &mdash; three states, not two. Every cell is a live key-server decision. Execute-only is the state a plain ACL has no word for.</div>`
  const layerMx = run ? `<div class="chips" style="margin-bottom:8px">${state.runs.filter((r) => r.status === 'sealed').map((r) => `<button class="btn sm ${r.id === run.id ? 'pri' : ''}" data-act="audit-run" data-id="${r.id}">${r.id} &middot; ${esc(shortName(r.submitter))}</button>`).join('')}</div>
    <table class="mx"><tr><th>Layer</th>${PERSONAS.map((p) => `<th>${esc(p.id)}</th>`).join('')}</tr>${['L0', 'L1', 'L2', 'L3', 'L4'].map((L) => `<tr><td class="m">${L}</td>${PERSONAS.map((p) => `<td>${cell(layerAccess(run, p, L).ok ? 'read' : 'none')}</td>`).join('')}</tr>`).join('')}</table>
    <div class="note">${esc(run.id)} &middot; ${esc(run.label)}. Submitter: <b>${esc(shortName(run.submitter))}</b>. ${submitterNote(run)}</div>` : '<div class="dim">No sealed runs yet.</div>'
  const ledger = `<table><tr><th>Person</th><th>Org</th><th>Runs</th><th>Opened</th><th>Denied</th><th>Rejected</th></tr>${PERSONAS.map((p) => { const a = state.activity[p.id] || { runs: 0, opened: 0, denied: 0, rejected: 0 }; return `<tr><td>${esc(p.name)}</td><td class="dim">${esc(p.org)}</td><td class="m">${a.runs}</td><td class="m">${a.opened}</td><td class="m" style="${a.denied ? 'color:var(--red)' : ''}">${a.denied}</td><td class="m">${a.rejected}</td></tr>` }).join('')}</table>`
  return `<h2>Auditor</h2>
  <p class="sub">The same policy data, read sideways: who can do what to which model, who can read which layer of a given run, and what each person actually did this session.</p>
  <div class="grid2"><div class="card"><h3>Models &times; people</h3>${fileMx}</div><div class="card"><h3>Run layers &times; people</h3>${layerMx}</div></div>
  <div class="card" style="margin-top:12px"><h3>Activity ledger <span class="dim">(this session)</span></h3>${ledger}</div>`
}

export function auditorAction(a, el) { if (a === 'audit-run') set({ auditRun: el.dataset.id }) }
