import { state, pep, esc } from './state.js'
import { look } from './vault.js'
import { openJson } from './vault.js'
import { ensureReplay } from './run.js'
import { layerAccess } from './ui.js'

let raf = null
let last = 0

/**
 * One replication as the viewing persona sees it. Each layer's slice is its own sealed blob, opened
 * here with that persona's key; a slice the KAS refuses is simply absent, so the canvas has nothing to
 * draw for it and no flag on the page is what hides it.
 */
export function repData(run, persona, rep) {
  const blobs = look(`repb|${run.id}|${rep}`, () => ensureReplay(run, rep), null)
  if (!blobs) return null
  const a2 = layerAccess(run, persona, 'L2').ok
  const a3 = layerAccess(run, persona, 'L3').ok
  const a4 = layerAccess(run, persona, 'L4').ok
  const open = (k, sealed, want) => (want ? look(`rp|${persona.kas}|${run.id}|${rep}|${k}`, () => openJson(sealed, persona.kas), null) : null)
  const o2 = open('r2', blobs.R2, a2), o3 = open('r3', blobs.R3, a3), o4 = open('r4', blobs.R4, a4)
  if ((a2 && !o2) || (a3 && !o3) || (a4 && !o4)) return null
  const d2 = o2?.ok ? o2.data : null, d3 = o3?.ok ? o3.data : null, d4 = o4?.ok ? o4.data : null
  const n = (d2 || d3 || d4)?.steps.length || 0
  const steps = Array.from({ length: n }, (_, i) => ({
    t: (d2 || d3 || d4).steps[i].t,
    x: d2?.steps[i].x, y: d2?.steps[i].y, alt: d2?.steps[i].alt,
    fc: d3?.steps[i].fc || [],
    sig: d4?.steps[i].sig, rfc: d4?.steps[i].rfc || [], racq: d4?.steps[i].racq || [], jam: d4?.steps[i].jam || [],
  }))
  const sites = d3 ? d3.sites.map((s, i) => ({ ...s, ...(d4 ? d4.sites[i] : {}) })) : []
  const missiles = (d3 ? d3.missiles : d2 ? d2.missiles : []).map((m, k) => ({ ...(d3 ? d3.missiles[k] : {}), ...(d2 ? d2.missiles[k] : {}) }))
  let events = []
  if (d4) events = d4.events
  else events = [...(d2 ? d2.events : []), ...(d3 ? d3.events : [])].sort((a, b) => a.t - b.t)
  return { a2: !!d2, a3: !!d3, a4: !!d4, wps: d2?.wps || [], sites, steps, missiles, alive: d2?.alive, tKill: d2?.tKill, events, n }
}

export const visibleEvents = (run, persona) => {
  const rp = repData(run, persona, run.repIndex)
  return rp ? rp.events : []
}

export function replayHtml(run, persona) {
  const rp = repData(run, persona, state.replay.rep)
  const a = { a2: layerAccess(run, persona, 'L2').ok, a3: layerAccess(run, persona, 'L3').ok, a4: layerAccess(run, persona, 'L4').ok }
  const none = !a.a2 && !a.a3 && !a.a4
  const n = rp ? rp.n : 0
  const sq = (c, on, t) => `<span class="pill ${on ? 'ok' : 'nt'}" style="${on ? '' : 'opacity:.55'}"><span class="sq" style="background:${c}"></span>${t}${on ? '' : ' (sealed)'}</span>`
  return `<div class="card">
    <h3>Replay &mdash; ${esc(run.id)} <span class="dim">replication ${state.replay.rep + 1} of ${run.reps}${state.replay.rep === run.repIndex ? ' (representative)' : ''}</span></h3>
    <div class="ovl">
      ${sq('#5ad1f4', a.a2, 'L2 route + outcome')}${sq('#f0524f', a.a3, 'L3 threat laydown + engagements')}${sq('#f2a93b', a.a4, 'L4 detection ranges + signature')}
    </div>
    <div class="replay">
      <canvas id="map" class="map"></canvas>
      ${none ? `<div class="scrim"><div><div class="big">SEALED</div><div class="dim" style="margin-top:8px">No layer of this run is readable by ${esc(persona.name)}.<br>The run executed; the result is not yours.</div></div></div>` : ''}
    </div>
    <div class="ctl">
      <button class="btn sm" data-act="rp-play">${state.replay.playing ? 'Pause' : 'Play'}</button>
      <input id="rp-scrub" type="range" min="0" max="${Math.max(0, n - 1)}" value="${Math.min(state.replay.t, Math.max(0, n - 1))}">
      <span class="mono dim" id="rp-time"></span>
      <button class="btn sm" data-act="rp-speed">${state.replay.speed}x</button>
      <button class="btn sm" data-act="rp-rep" data-d="-1">&lsaquo; rep</button>
      <button class="btn sm" data-act="rp-rep" data-d="1">rep &rsaquo;</button>
    </div>
    <div class="note">Each replication is sealed as three separate objects, one per layer. What is drawn is exactly what the key server released to ${esc(persona.name)}: a threat analyst gets the laydown and the shots but no aircraft; an airframe engineer the reverse. Stepping to another replication has the enclave seal that one on demand.</div>
  </div>`
}

export function bindReplay(root, run, persona) {
  const canvas = root.querySelector('#map')
  if (!canvas) return
  const scrub = root.querySelector('#rp-scrub')
  const draw = () => drawMap(canvas, run, persona, root)
  scrub.oninput = () => { state.replay.t = +scrub.value; draw() }
  cancelAnimationFrame(raf)
  const tick = (now) => {
    if (state.replay.playing) {
      const rp = repData(run, persona, state.replay.rep)
      const n = rp ? rp.n : 0
      const dt = (now - last) / 1000
      state.replay.tf = (state.replay.tf ?? state.replay.t) + dt * 10 * state.replay.speed
      if (state.replay.tf >= n - 1) { state.replay.tf = n - 1; state.replay.playing = false; const b = root.querySelector('[data-act=rp-play]'); if (b) b.textContent = 'Play' }
      state.replay.t = Math.floor(state.replay.tf)
      scrub.value = state.replay.t
      draw()
    }
    last = now
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame((t) => { last = t; tick(t) })
  requestAnimationFrame(draw)
}

export function stopReplay() { cancelAnimationFrame(raf) }

function drawMap(canvas, run, persona, root) {
  const rp = repData(run, persona, state.replay.rep)
  if (!rp || !rp.n) return
  const { a2, a3, a4 } = rp
  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth, H = canvas.clientHeight
  if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr }
  const g = canvas.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, W, H)
  const steps = rp.steps
  const idx = Math.min(state.replay.t, steps.length - 1)
  const S = steps[idx]

  const pts = []
  rp.wps.forEach((w) => pts.push([w.x, w.y]))
  rp.sites.forEach((s) => pts.push([s.x, s.y]))
  if (!pts.length) return
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const pad = 60
  const minX = Math.min(...xs) - 30, maxX = Math.max(...xs) + 30, minY = Math.min(...ys) - 30, maxY = Math.max(...ys) + 30
  const k = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxY - minY))
  const ox = (W - (maxX - minX) * k) / 2, oy = (H - (maxY - minY) * k) / 2
  const X = (x) => ox + (x - minX) * k, Y = (y) => H - (oy + (y - minY) * k)

  g.strokeStyle = '#0f1a24'; g.lineWidth = 1
  for (let x = Math.ceil(minX / 50) * 50; x < maxX; x += 50) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), H); g.stroke() }
  for (let y = Math.ceil(minY / 50) * 50; y < maxY; y += 50) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(W, Y(y)); g.stroke() }
  g.fillStyle = '#34495d'; g.font = '10px ui-monospace, Menlo, monospace'
  g.fillText('50 km grid', 10, H - 10)

  if (a4) {
    rp.sites.forEach((s, i) => {
      if (s.guidance === 'ir') {
        g.setLineDash([]); g.strokeStyle = 'rgba(240,82,79,.5)'; g.lineWidth = 1.2; g.beginPath(); g.arc(X(s.x), Y(s.y), s.wRange * k, 0, 7); g.stroke()
        return
      }
      g.setLineDash([4, 4]); g.strokeStyle = 'rgba(242,169,59,.5)'; g.lineWidth = 1
      g.beginPath(); g.arc(X(s.x), Y(s.y), S.racq[i] * k, 0, 7); g.stroke()
      g.setLineDash([]); g.strokeStyle = S.jam[i] ? 'rgba(90,209,244,.9)' : 'rgba(240,82,79,.75)'; g.lineWidth = 1.4
      g.beginPath(); g.arc(X(s.x), Y(s.y), S.rfc[i] * k, 0, 7); g.stroke()
      if (S.jam[i]) { g.fillStyle = '#5ad1f4'; g.fillText('JAM', X(s.x) + 6, Y(s.y) - S.rfc[i] * k - 3) }
    })
    g.setLineDash([])
  }

  if (a2) {
    g.strokeStyle = '#1b3c4d'; g.lineWidth = 1.5; g.setLineDash([3, 5])
    g.beginPath(); rp.wps.forEach((w, i) => (i ? g.lineTo(X(w.x), Y(w.y)) : g.moveTo(X(w.x), Y(w.y)))); g.stroke(); g.setLineDash([])
    g.strokeStyle = '#5ad1f4'; g.lineWidth = 2
    g.beginPath(); for (let i = 0; i <= idx; i++) (i ? g.lineTo(X(steps[i].x), Y(steps[i].y)) : g.moveTo(X(steps[i].x), Y(steps[i].y))); g.stroke()
  }

  if (a3) {
    rp.sites.forEach((s, i) => {
      const fc = S.fc[i]
      g.fillStyle = fc ? '#f0524f' : '#8a3b3a'
      g.beginPath(); g.moveTo(X(s.x), Y(s.y) - 7); g.lineTo(X(s.x) + 6, Y(s.y) + 5); g.lineTo(X(s.x) - 6, Y(s.y) + 5); g.closePath(); g.fill()
      g.fillStyle = '#b8c4d0'; g.fillText(s.name, X(s.x) + 9, Y(s.y) + 4)
      if (a4 && a2 && fc) {
        g.strokeStyle = 'rgba(240,82,79,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(s.x), Y(s.y)); g.lineTo(X(S.x), Y(S.y)); g.stroke()
      }
    })
    rp.missiles.forEach((ms) => {
      const s = rp.sites[ms.i]
      const t = S.t
      if (t < ms.t0) return
      const span = Math.max(1, ms.t1 - ms.t0), f = Math.min(1, (t - ms.t0) / span)
      if (a2) {
        const mx = s.x + (ms.x1 - s.x) * f, my = s.y + (ms.y1 - s.y) * f
        if (f < 1) { g.strokeStyle = '#ff9d6b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(s.x + (ms.x1 - s.x) * Math.max(0, f - 0.06)), Y(s.y + (ms.y1 - s.y) * Math.max(0, f - 0.06))); g.lineTo(X(mx), Y(my)); g.stroke() }
        else if (t - ms.t1 < 12) { g.strokeStyle = ms.hit ? '#f0524f' : '#7a8898'; g.lineWidth = 2; g.beginPath(); g.arc(X(ms.x1), Y(ms.y1), 6 + (t - ms.t1), 0, 7); g.stroke() }
      } else if (f < 1) {
        g.strokeStyle = 'rgba(255,157,107,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(X(s.x), Y(s.y), 10 + f * 40, 0, 7); g.stroke()
      }
    })
  }

  if (a2) {
    const killed = !rp.alive && idx >= steps.length - 1
    g.fillStyle = killed ? '#f0524f' : '#5ad1f4'
    g.beginPath(); g.arc(X(S.x), Y(S.y), 5, 0, 7); g.fill()
    g.fillStyle = '#d5dfe9'; g.fillText('SABLE_1', X(S.x) + 9, Y(S.y) - 7)
    if (killed) { g.strokeStyle = '#f0524f'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(S.x) - 9, Y(S.y) - 9); g.lineTo(X(S.x) + 9, Y(S.y) + 9); g.moveTo(X(S.x) + 9, Y(S.y) - 9); g.lineTo(X(S.x) - 9, Y(S.y) + 9); g.stroke() }
  }

  g.fillStyle = '#9fb1c2'; g.font = '11px ui-monospace, Menlo, monospace'
  let y = 18
  g.fillText(`T+${String(Math.floor(S.t / 60)).padStart(2, '0')}:${String(Math.round(S.t % 60)).padStart(2, '0')}`, 12, y)
  if (a2) { y += 15; g.fillText(`alt ${Math.round(S.alt)} m`, 12, y) }
  if (a4) { y += 15; g.fillStyle = '#f2a93b'; g.fillText(`rcs vs ${rp.sites[0].name} ${S.sig.toFixed(1)} dBsm`, 12, y) }
  if (a2 && idx >= steps.length - 1) { g.font = '700 13px ui-monospace, Menlo, monospace'; g.fillStyle = rp.alive ? '#35d399' : '#f0524f'; g.fillText(rp.alive ? 'SURVIVED' : `DESTROYED  T+${Math.round(rp.tKill)}s`, W - 150, 20) }
  const tl = root.querySelector('#rp-time')
  if (tl) tl.textContent = `${idx + 1}/${steps.length}`
}

export function replayAction(act_, el, run, persona, rerender) {
  if (act_ === 'rp-play') {
    const rp = repData(run, persona, state.replay.rep)
    const n = rp ? rp.n : 0
    if (!state.replay.playing && state.replay.t >= n - 1) { state.replay.t = 0; state.replay.tf = 0 }
    state.replay.tf = state.replay.t
    state.replay.playing = !state.replay.playing
    el.textContent = state.replay.playing ? 'Pause' : 'Play'
  } else if (act_ === 'rp-speed') {
    state.replay.speed = state.replay.speed === 1 ? 4 : state.replay.speed === 4 ? 12 : 1
    el.textContent = state.replay.speed + 'x'
  } else if (act_ === 'rp-rep') {
    const R = run.reps
    state.replay.rep = (state.replay.rep + Number(el.dataset.d) + R) % R
    state.replay.t = 0; state.replay.tf = 0; state.replay.playing = false
    pep(persona.name, 'REPLAY', `${run.id} rep ${state.replay.rep + 1}`, 'PERMIT', 'each slice opened under its own layer policy')
    rerender()
  }
}
