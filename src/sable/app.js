import { state, set, subscribe, esc, fmtTime } from './state.js'
import { PERSONAS, personaCard, cur } from './ui.js'
import { benchHtml, benchAction, initBench } from './views/bench.js'
import { reposHtml, reposAction } from './views/repos.js'
import { sourcesHtml, sourcesAction } from './views/sources.js'
import { auditorHtml, auditorAction } from './views/auditor.js'
import { bindReplay, replayAction, stopReplay } from './replay.js'
import { personaById } from './data.js'
import { PRESETS, presetScript } from './engine/scenarios.js'
import { executeRun } from './run.js'
import { resolved, sealFiles, inFlight } from './vault.js'
import { sealDb } from './db.js'

const TABS = [['bench', 'AFSIM Workbench'], ['repos', 'Repositories'], ['data', 'Data Sources'], ['audit', 'Auditor']]
const VIEWS = { bench: benchHtml, repos: reposHtml, data: sourcesHtml, audit: auditorHtml }

const SEED_RUNS = [['dana', 'scn_01'], ['dana', 'scn_02'], ['raj', 'scn_02'], ['okafor', 'scn_02'], ['tyler', 'scn_02'], ['hale', 'scn_03']]

// ── Boot: seal everything once per app session ───────────────────────────────

let bootP = null
let bootCb = null

export function bootSable(onProgress) {
  bootCb = onProgress
  bootP ??= (async () => {
    const report = (lo, hi, phase) => (p) => bootCb?.({ phase, label: p.label, frac: lo + (hi - lo) * (p.done / Math.max(1, p.total)) })
    await sealFiles(report(0, 0.4, 'Sealing repositories'))
    await sealDb(report(0.4, 0.7, 'Sealing database rows'))
    const now = Date.now()
    for (let i = 0; i < SEED_RUNS.length; i++) {
      const [pid, sid] = SEED_RUNS[i]
      const p = PRESETS.find((x) => x.id === sid)
      bootCb?.({ phase: 'Running seed pipelines', label: `${personaById[pid].name} - ${p.name}`, frac: 0.7 + 0.3 * (i / SEED_RUNS.length) })
      const run = await executeRun(personaById[pid], presetScript(p), {
        label: p.name, ablationReps: 30, pace: 0,
        submittedAt: new Date(now - (SEED_RUNS.length - i) * 7 * 60000),
      })
      state.runs.unshift(run)
    }
    initBench()
    state.pep.length = 0
    state.activity = {}
    state.selectedRun = state.runs.find((r) => r.submitter === 'dana' && r.status === 'sealed')?.id || null
    bootCb?.({ phase: 'Ready', label: '', frac: 1 })
  })().catch((e) => { bootP = null; throw e })
  return bootP
}

// ── Mount ────────────────────────────────────────────────────────────────────

function chrome() {
  const p = cur()
  const log = state.pep
  return {
    tabs: TABS.map(([k, t]) => `<button class="${state.tab === k ? 'on' : ''}" data-act="tab" data-id="${k}">${t}</button>`).join(''),
    who: `<span class="kasbusy">key server&hellip;</span><label class="dim" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-act="trim" ${state.trim ? 'checked' : ''}> trim names</label><span class="dim">signed in as</span><b>${esc(p.name)}</b>`,
    rail: `<h4>Government</h4>${PERSONAS.filter((x) => x.kind === 'gov').map((x) => personaCard(x, x.id === state.persona)).join('')}<h4>Contractors</h4>${PERSONAS.filter((x) => x.kind === 'contractor').map((x) => personaCard(x, x.id === state.persona)).join('')}`,
    pep: `<div class="hd" data-act="pep-toggle"><b>PEP DECISION LOG</b><span>${log.length} decisions</span><span style="margin-left:auto">${state.pepOpen ? 'hide' : 'show'}</span></div>${state.pepOpen ? `<div class="body">${log.slice(0, 40).map((e) => `<div class="row"><span class="faint">${fmtTime(e.ts)}</span>  ${esc(e.who.padEnd(16))} ${esc(e.verb.padEnd(8))} ${esc(e.target)}  <span class="${e.decision === 'PERMIT' ? 'permit' : e.decision === 'DENY' ? 'deny' : 'seal'}">${e.decision}</span> <span class="faint">${esc(e.why)}</span></div>`).join('') || '<div class="faint">no decisions yet</div>'}</div>` : ''}`,
  }
}

export function mountSable(root) {
  root.innerHTML = `<div class="banner">SYNTHETIC DATA -- DEMONSTRATION ONLY -- NO REAL SIGNATURES, THREATS OR MARKINGS. AFSIM-STYLE RUNNER AND GITLAB ARE MOCKS; ACCESS DECISIONS ARE MADE BY THE REAL KEY SERVER.</div>
  <header class="top"><div class="brand"><span class="mark">&#9670;</span> SABLE <span class="dim">Mission Engineering</span><span class="tag">demo</span></div><nav class="tabs"></nav><div class="who"></div></header>
  <div class="shell"><aside class="rail"></aside><main class="main"></main></div>
  <footer class="pep"></footer>`
  const q = (s) => root.querySelector(s)
  const main = q('main.main')
  let dead = false, pending = false, busy = false

  async function renderOnce() {
    root.classList.add('busy')
    let html
    try { html = await resolved(() => ({ c: chrome(), body: VIEWS[state.tab]() })) } catch (e) { html = { c: chrome(), body: `<div class="card"><h3>Render error</h3><pre class="code">${esc(e.stack || e.message)}</pre></div>` } }
    if (dead) return
    const keep = main.scrollTop
    stopReplay()
    q('nav.tabs').innerHTML = html.c.tabs
    q('.who').innerHTML = html.c.who
    q('aside.rail').innerHTML = html.c.rail
    q('footer.pep').innerHTML = html.c.pep
    main.innerHTML = html.body
    main.scrollTop = keep
    const ta = main.querySelector('#script')
    if (ta) ta.oninput = () => { state.script = ta.value }
    if (state.tab === 'bench' && state.showReplay) {
      const run = state.runs.find((r) => r.id === state.showReplay)
      if (run) bindReplay(main, run, cur())
    }
    if (!inFlight()) root.classList.remove('busy')
  }

  function render() {
    pending = true
    if (busy) return
    busy = true
    ;(async () => {
      while (pending && !dead) { pending = false; await renderOnce() }
      busy = false
    })()
  }

  function dispatch(a, el) {
    if (a === 'tab') set({ tab: el.dataset.id })
    else if (a === 'persona') set({ persona: el.dataset.id, layerOpen: {} })
    else if (a === 'trim') set({ trim: el.checked })
    else if (a === 'pep-toggle') set({ pepOpen: !state.pepOpen })
    else if (a.startsWith('rp-')) {
      const run = state.runs.find((r) => r.id === state.showReplay)
      if (run) replayAction(a, el, run, cur(), render)
    } else if (['preset', 'slot', 'reset-script', 'select-run', 'layer', 'open-replay', 'submit'].includes(a)) benchAction(a, el)
    else if (['repo', 'repotab', 'file'].includes(a)) reposAction(a, el)
    else if (a === 'query') sourcesAction(a, el)
    else if (a === 'audit-run') auditorAction(a, el)
  }

  const onClick = (e) => {
    const el = e.target.closest('[data-act]')
    if (!el || !root.contains(el) || el.tagName === 'SELECT' || el.type === 'checkbox') return
    dispatch(el.dataset.act, el)
  }
  const onChange = (e) => {
    const el = e.target.closest('[data-act]')
    if (!el) return
    if (el.tagName === 'SELECT' || el.type === 'checkbox') dispatch(el.dataset.act, el)
  }
  root.addEventListener('click', onClick)
  root.addEventListener('change', onChange)
  subscribe(render)
  render()

  return () => {
    dead = true
    stopReplay()
    subscribe(null)
    root.removeEventListener('click', onClick)
    root.removeEventListener('change', onChange)
  }
}
