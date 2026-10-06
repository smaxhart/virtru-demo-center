import { state, set, pep, act, esc, fmtTime } from '../state.js'
import { REPOS, FILES, filesInRepo } from '../data.js'
import { describe } from '../policy.js'
import { cur, polChips, pill, shortName, layerAccess, receiptVisible, dec, why } from '../ui.js'
import { openFile, openFileLook, fileSealed, hexPreview, boundShort } from '../vault.js'

const fileState = (persona, f) => {
  if (dec(persona, f.read).ok) return 'read'
  if (f.exec && dec(persona, f.exec).ok) return 'exec'
  return 'none'
}

const mask = (name) => '█'.repeat(Math.min(14, name.length))

function tree(persona) {
  const files = filesInRepo(state.repo)
  const dirs = {}
  files.forEach((f) => { const parts = f.path.split('/').slice(1); const d = parts.length > 1 ? parts.slice(0, -1).join('/') : ''; (dirs[d] ||= []).push(f) })
  return Object.keys(dirs).sort().map((d) => `${d ? `<div class="dir">${esc(d)}/</div>` : ''}${dirs[d].map((f) => {
    const s = fileState(persona, f)
    const base = f.path.split('/').pop()
    const hide = state.trim && s === 'none'
    const ic = s === 'read' ? '◼' : s === 'exec' ? '▶' : '⊘'
    return `<button class="${state.file === f.path ? 'on' : ''}" data-act="file" data-path="${esc(f.path)}"><span class="f"><span class="ic">${ic}</span><span class="${hide ? 'redact' : ''}" style="${s === 'none' && !hide ? 'color:var(--faint)' : ''}">${esc(hide ? mask(base) : base)}</span></span></button>`
  }).join('')}`).join('')
}

function viewer(persona) {
  const f = FILES[state.file]
  if (!f) return `<div class="card dim">Select a file. Every blob in this GitLab is a TDF; the key server decides what the client receives.</div>`
  const rdDec = dec(persona, f.read)
  const s = fileState(persona, f)
  const open = openFileLook(persona.kas, f.path)
  const head = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="mono">${esc(f.path)} ${f.slot ? `<span class="faint">r${f.rev}</span>` : ''}</span><span>${polChips(f.read)}</span></div>`
  if (open.ok) return `<div class="card">${head}<pre class="code">${esc(open.text)}</pre>${f.exec ? `<div class="note">Execute policy: ${polChips(f.exec)}</div>` : ''}<div class="note">Decrypted just now by the key server for ${esc(persona.kas)} &middot; TDF bound to <span class="mono">${esc(boundShort(fileSealed(f.path)).join(' '))}</span></div></div>`
  const missing = why(persona, f.read, rdDec)
  const banner = s === 'exec'
    ? `<div class="derive" style="border-color:#3a3366;background:#110f22"><div class="big" style="color:var(--violet)">EXECUTE-ONLY</div><div class="dim" style="margin-top:4px">${esc(persona.name)} may reference this model in a scenario and have the runner use it. The key server will not release its contents. Missing to read: <span class="mono">${esc(missing.join(', '))}</span>.</div></div>`
    : `<div class="derive" style="border-color:#5a1f21;background:#170c0c"><div class="big" style="color:var(--red)">NO ACCESS</div><div class="dim" style="margin-top:4px">Neither read nor execute. Missing: <span class="mono">${esc(missing.join(', '))}</span>.</div></div>`
  const sealed = fileSealed(f.path)
  return `<div class="card">${head}${banner}<pre class="code cipher" style="margin-top:8px">${sealed ? esc(hexPreview(sealed, 7)) : ''}\n… ${sealed ? sealed.tdfBytes.length : 0} bytes, TDF payload &mdash; what the server actually holds</pre></div>`
}

function pipelines(persona) {
  const runs = state.runs
  return `<div class="card"><h3>Pipelines <span class="dim">&mdash; scenarios/.gitlab-ci.yml &middot; validate &rarr; resolve &rarr; run &rarr; seal</span></h3>
  <div class="note" style="margin:0 0 8px">Pipelines belong to the shared <span class="mono">scenarios</span> project. A scenario file names the models it includes; the <em>resolve</em> job asks the key server whether the submitter may execute each model in the owning company's repo. The company repos hold models only and run no CI of their own.</div>
  <table><tr><th>Pipeline</th><th>Scenario</th><th>Triggered by</th><th>Jobs</th><th>Artifacts</th></tr>${runs.map((r) => {
    const vis = receiptVisible(r, persona)
    const jobs = ['validate', 'resolve', 'run', 'seal'].map((j) => {
      const ok = r.status === 'sealed' || (r.status === 'rejected' && j === 'validate')
      const bad = (r.status === 'rejected' && j === 'resolve') || (r.status === 'failed' && j === 'run')
      return `<span class="pill ${ok ? 'ok' : bad ? 'no' : 'nt'}" style="margin-right:3px">${j}${!ok && !bad ? ' –' : ''}</span>`
    }).join('')
    const arts = r.status === 'sealed' ? ['L0 receipt', 'L1 contribution', 'L2 composite', 'L3 threat', 'L4 replay'].map((n, i) => { const ok = layerAccess(r, persona, 'L' + i).ok; return `<span class="pill ${ok ? 'ok' : 'sl'}" title="${ok ? 'downloadable' : 'sealed'}">${ok ? '' : 'sealed · '}${n}</span>` }).join(' ') : '<span class="dim">none</span>'
    return vis ? `<tr><td class="m">#${r.id.slice(4)}</td><td>${esc(r.label)}</td><td>${esc(shortName(r.submitter))}<div class="faint" style="font-size:10.5px">${fmtTime(r.submittedAt)}</div></td><td>${jobs}</td><td>${arts}</td></tr>`
      : `<tr><td class="m">#${r.id.slice(4)}</td><td colspan="4" class="sealed">pipeline exists &middot; details not released to ${esc(persona.id)}</td></tr>`
  }).join('') || '<tr><td colspan="5" class="dim">No pipelines yet.</td></tr>'}</table>
  <div class="note">CI logs and artifacts are the classic side channel: a job log can print an intermediate value. Here each log line and each artifact is sealed under the layer policy of the data that produced it. The runner itself holds a service identity that can decrypt all its inputs &mdash; the enclave is the trust boundary, named explicitly rather than hidden.</div></div>`
}

const MRS = [
  { n: '!41', t: 'scn_05: add sea-level ingress variant', by: 'dana', repo: 'scenarios', paths: ['scenarios/scn_02_ingress_integrated.txt'], note: 'Adds a scenario that references models by path. Reviewable by anyone on the team; it grants no access to the models.' },
  { n: '!17', t: 'SABLE rev 3.3: aperture treatment update', by: 'dana', repo: 'airframe-models', paths: ['airframe-models/models/sable_rcs_signature.txt', 'airframe-models/docs/coating_notes.md'], note: 'Changes to a signature table. The diff is the model: it carries the same policy as the file.' },
  { n: '!9', t: 'FX-9 lapse table refresh', by: 'raj', repo: 'propulsion-models', paths: ['propulsion-models/data/thrust_lapse.csv'], note: 'Owner review by Corvane; JPO approves merges to the pipeline branch.' },
  { n: '!6', t: 'Jammer effectiveness update, X-band', by: 'elena', repo: 'mission-systems', paths: ['mission-systems/data/jammer_effectiveness.csv'], note: 'Technique table change. Only people with the mission-systems need-to-know can review the diff.' },
  { n: '!3', t: 'Refresh regional emitter parameters', by: 'vasquez', repo: 'threat-library', paths: ['threat-library/data/emitter_parameters.csv'], note: 'Government-owned threat data. Contractors can see that the MR exists and can run against the result, not read the change.' },
]

function mrs(persona) {
  const list = MRS.filter((m) => m.repo === state.repo)
  return `<div class="card"><h3>Merge requests <span class="dim">&mdash; ${esc(state.repo)}</span></h3>${list.map((m) => {
    const canSee = m.paths.every((p) => fileState(persona, FILES[p]) === 'read')
    return `<div class="layer" style="grid-template-columns:50px 1fr auto"><span class="id">${m.n}</span><div><div class="nm">${esc(m.t)}</div><div class="pl">${esc(m.repo)} &middot; opened by ${esc(shortName(m.by))} &middot; ${m.paths.length} file(s)</div><div class="note" style="margin:4px 0 0">${esc(m.note)}</div></div>${canSee ? pill('ok', 'DIFF VISIBLE') : pill('sl', 'DIFF SEALED')}</div>`
  }).join('') || '<div class="dim" style="padding:8px 0">No open merge requests in this project.</div>'}</div>`
}

function repoChips() {
  return `<div class="chips" style="margin-bottom:8px">${REPOS.map((r) => `<button class="btn sm ${state.repo === r.id ? 'pri' : ''}" data-act="repo" data-id="${r.id}">${esc(r.id)} <span class="faint">${MRS.filter((m) => m.repo === r.id).length}</span></button>`).join('')}</div>`
}

export function reposHtml() {
  const persona = cur()
  const repo = REPOS.find((r) => r.id === state.repo)
  const sub = { files: `<div class="repo-shell"><div class="card list" style="padding:6px 0">${REPOS.map((r) => `<button class="${state.repo === r.id ? 'on' : ''}" data-act="repo" data-id="${r.id}">${esc(r.id)}<span class="k">${esc(r.owner)}</span></button>`).join('')}</div>
    <div class="card list tree" style="padding:6px 0">${tree(persona)}</div><div>${viewer(persona)}</div></div>`,
  pipelines: pipelines(persona), mrs: repoChips() + mrs(persona) }[state.repoTab]
  return `<h2>Repositories <span class="dim" style="font-weight:400">&mdash; mock GitLab in front of real TDFs</span></h2>
  <p class="sub">Every repo file is a TDF sealed under its read policy; opening one is a real key-server request. A lock means the file exists and you can see that it does; a play icon means you can run it but not read it.</p>
  <div class="subtabs">${[['files', 'Files'], ['pipelines', 'Pipelines'], ['mrs', 'Merge requests']].map(([k, t]) => `<button class="${state.repoTab === k ? 'on' : ''}" data-act="repotab" data-id="${k}">${t}</button>`).join('')}
    <span style="margin-left:auto" class="dim mono">${esc(repo.id)} &middot; ${esc(repo.desc)}</span></div>${sub}`
}

export async function reposAction(a, el) {
  const persona = cur()
  if (a === 'repo') set({ repo: el.dataset.id, file: null })
  else if (a === 'repotab') set(el.dataset.id === 'pipelines' ? { repoTab: 'pipelines', repo: 'scenarios', file: null } : { repoTab: el.dataset.id })
  else if (a === 'file') {
    const f = FILES[el.dataset.path]
    const r = await openFile(persona.kas, f.path)
    const execOk = f.exec ? dec(persona, f.exec).ok : false
    const why_ = r.ok ? '' : execOk ? 'execute-only' : `KAS: ${r.reason || 'refused'}`
    pep(persona.name, 'READ', f.path, r.ok ? 'PERMIT' : 'DENY', why_)
    act(persona.id, r.ok ? 'opened' : 'denied')
    set({ file: f.path })
  }
}
