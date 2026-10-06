export const state = {
  persona: 'dana',
  tab: 'bench',
  trim: false,
  runs: [],
  pep: [],
  pepOpen: true,
  activity: {},
  selectedRun: null,
  auditRun: null,
  repo: 'scenarios',
  file: null,
  repoTab: 'files',
  script: '',
  presetId: 'scn_02',
  layerOpen: {},
  replay: { t: 0, tf: 0, playing: false, speed: 4, rep: 0 },
  showReplay: null,
  running: null,
  query: 'q1',
  choice: null,
  scnName: '',
  scnDesc: '',
}

let listener = null
export const subscribe = (fn) => { listener = fn }
export function set(patch) {
  Object.assign(state, patch)
  listener?.()
}

export function pep(who, verb, target, decision, why = '') {
  state.pep.unshift({ ts: new Date(), who, verb, target, decision, why })
  if (state.pep.length > 60) state.pep.pop()
}

export function act(personaId, key) {
  const a = (state.activity[personaId] ||= { runs: 0, opened: 0, denied: 0, rejected: 0 })
  a[key]++
}

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour12: false })
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
