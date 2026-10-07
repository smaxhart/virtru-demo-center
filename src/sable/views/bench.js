import { state, set, pep, act, esc } from '../state.js'
import { FILES } from '../data.js'
import { PRESETS, SLOTS, SLOT_ORDER, buildScript } from '../engine/scenarios.js'
import { describe, deriveLayers } from '../policy.js'
import { executeRun, STAGES } from '../run.js'
import { cur, polChips, pill, shortName, receiptVisible, dec } from '../ui.js'
import { resultHtml, layerAction } from './result.js'

export function initBench() {
  const p = PRESETS.find((x) => x.id === state.presetId)
  state.choice = { ...p.choice }
  state.scnName = p.name
  state.scnDesc = p.description
  state.script = buildScript({ name: p.name, description: p.description, choice: state.choice })
}

export function loadPreset(id) {
  const p = PRESETS.find((x) => x.id === id)
  state.presetId = id
  state.choice = { ...p.choice }
  state.scnName = p.name; state.scnDesc = p.description
  state.script = buildScript({ name: p.name, description: p.description, choice: state.choice })
  set({})
}

const includesOf = (script) => [...script.matchAll(/^include(?:_once)?\s+(\S+)/gm)].map((m) => m[1])

function builderHtml() {
  const persona = cur()
  const incs = includesOf(state.script)
  const inputs = incs.map((p) => FILES[p]).filter((f) => f && f.read)
  const d = deriveLayers(inputs, [])
  const rows = incs.map((p) => {
    const f = FILES[p]
    if (!f) return `<div class="inc"><span class="p">${esc(p)}</span>${pill('no', 'UNKNOWN')}</div>`
    const ex = f.exec ? dec(persona, f.exec).ok : false
    const rd = dec(persona, f.read).ok
    const st = !ex ? pill('no', 'NO EXECUTE') : rd ? pill('ok', 'READ + RUN') : pill('ex', 'RUN ONLY')
    return `<div class="inc" title="read: ${esc(describe(f.read))}  |  execute: ${esc(f.exec ? describe(f.exec) : 'not executable')}"><span class="p">${esc(p)}</span>${st}</div>`
  }).join('')
  return `<div class="card">
    <h3>1 &middot; Scenario <span class="dim">(scenarios repo)</span></h3>
    <div class="chips" style="margin-bottom:8px">${PRESETS.map((p) => `<button class="btn sm ${state.presetId === p.id ? 'pri' : ''}" data-act="preset" data-id="${p.id}">${p.id.replace('scn_', 'scn ')} &middot; ${esc(p.name)}</button>`).join('')}</div>
    ${SLOT_ORDER.map((s) => `<div class="slot"><label>${SLOTS[s].label}</label><select data-act="slot" data-slot="${s}">${Object.entries(SLOTS[s].options).map(([k, o]) => `<option value="${k}" ${state.choice[s] === k ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select><span class="dim" style="font-size:10.5px">${esc(SLOTS[s].options[state.choice[s]]?.owner || '')}</span></div>`).join('')}
  </div>
  <div class="card">
    <h3>2 &middot; What your identity can do with each include <span class="dim">(key-server decisions)</span></h3>
    ${rows}
    <div class="derive"><div class="big">DERIVED OUTPUT POLICY</div>
      <div class="dim" style="margin:3px 0 6px;font-size:11.5px">What this run's results will be sealed under &mdash; computed from the inputs, before anyone presses Run.</div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;font-size:11.5px">
        <b class="mono">L2</b><span>${polChips(d.layers.L2)}</span><b class="mono">L3</b><span>${polChips(d.layers.L3)}</span><b class="mono">L4</b><span>${polChips(d.layers.L4)}</span>
      </div>
      <div class="note" style="margin-bottom:0">Need-to-know of every producer model ANDs together; threat data adds its own class and a compartment when sealed.</div>
    </div>
  </div>
  <div class="card">
    <h3>3 &middot; AFSIM script <span class="dim">(editable &mdash; the runner parses it)</span></h3>
    <textarea id="script" rows="17" spellcheck="false">${esc(state.script)}</textarea>
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center">
      <button class="btn pri" data-act="submit" ${state.running ? 'disabled' : ''}>Submit to pipeline as ${esc(persona.name.split(' ').slice(-1)[0])}</button>
      <button class="btn" data-act="reset-script">Reset from slots</button>
    </div>
  </div>`
}

function stageBar() {
  const run = state.running
  if (!run) return ''
  const at = STAGES.indexOf(run.stage)
  const fin = run.status !== 'running'
  const bad = fin && run.status !== 'sealed'
  const cls = (i) => (fin ? (bad ? (i < at ? 'done' : i === at ? 'bad' : '') : 'done') : i < at ? 'done' : i === at ? 'cur' : '')
  const lines = run.log.filter((l) => l.min === 'L0')
  return `<div class="card"><h3>Pipeline &mdash; ${esc(run.id)}</h3><div class="stages">${STAGES.map((n, i) => `<div class="stg ${cls(i)}">${n.toUpperCase()}</div>`).join('')}</div>
    <div class="term">${lines.map((l) => `<div class="${/DENY|ERROR|aborted/.test(l.text) ? 'l-deny' : /PERMIT/.test(l.text) ? 'l-ok' : 'l-sys'}">${esc(l.text)}</div>`).join('')}</div></div>`
}

function runList() {
  const persona = cur()
  const vis = state.runs.filter((r) => receiptVisible(r, persona))
  return `<div class="card"><h3>Runs visible to ${esc(persona.name)} <span class="dim">(ledger shows only receipts you may see)</span></h3>
    <table><tr><th>Run</th><th>Scenario</th><th>By</th><th>Status</th></tr>${vis.map((r) => `<tr style="cursor:pointer;${state.selectedRun === r.id ? 'background:#0f1e28' : ''}" data-act="select-run" data-run="${r.id}"><td class="m">${r.id}</td><td>${esc(r.label)}</td><td>${esc(shortName(r.submitter))}</td><td>${r.status === 'sealed' ? pill('sl', 'SEALED') : pill('no', r.status.toUpperCase())}</td></tr>`).join('') || '<tr><td colspan="4" class="dim">none</td></tr>'}</table></div>`
}

export function benchHtml() {
  const run = state.runs.find((r) => r.id === state.selectedRun)
  return `<h2>AFSIM Workbench</h2>
  <p class="sub">Pick models, submit, and see how much of your own result you are allowed to read. The runner executes as a service identity, so a run can succeed against models you cannot open &mdash; and its output is sealed by what went in.</p>
  <div class="bench"><div>${builderHtml()}</div><div>${stageBar()}${resultHtml(state.running ? null : run)}${runList()}</div></div>`
}

export function benchAction(a, el) {
  const persona = cur()
  if (a === 'preset') loadPreset(el.dataset.id)
  else if (a === 'slot') {
    state.choice[el.dataset.slot] = el.value
    state.script = buildScript({ name: state.scnName, description: state.scnDesc, choice: state.choice })
    state.presetId = PRESETS.find((p) => SLOT_ORDER.every((s) => p.choice[s] === state.choice[s]))?.id || 'custom'
    set({})
  } else if (a === 'reset-script') {
    state.script = buildScript({ name: state.scnName, description: state.scnDesc, choice: state.choice })
    set({})
  } else if (a === 'select-run') set({ selectedRun: el.dataset.run, showReplay: null })
  else if (a === 'layer') layerAction(state.runs.find((r) => r.id === el.dataset.run), el.dataset.l)
  else if (a === 'open-replay') {
    const run = state.runs.find((r) => r.id === el.dataset.run)
    state.replay = { t: 0, tf: 0, playing: false, speed: 4, rep: run.repIndex }
    set({ showReplay: state.showReplay === run.id ? null : run.id })
  } else if (a === 'submit') submit(persona)
}

export async function submit(persona, script = state.script, label = null) {
  if (state.running) return null
  const name = label || (state.presetId === 'custom' ? 'custom scenario' : state.scnName)
  try {
    const run = await executeRun(persona, script, {
      label: name, ablationReps: 50, pace: 140,
      onUpdate: (r) => { state.running = r; set({}) },
    })
    act(persona.id, 'runs')
    if (run.status === 'rejected') act(persona.id, 'rejected')
    state.runs.unshift(run)
    set({ running: null, selectedRun: run.id, showReplay: null })
    return run
  } catch (e) {
    pep(persona.name, 'RUN', name, 'DENY', `runner error: ${e.message}`)
    set({ running: null })
    return null
  }
}
