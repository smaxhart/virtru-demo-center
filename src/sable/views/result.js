import { state, set, pep, act, esc, fmtTime } from '../state.js'
import { FILES } from '../data.js'
import { LAYER_INFO, describe } from '../policy.js'
import { look, openJson, tryOpen, decide, boundShort } from '../vault.js'
import { cur, polChips, pill, shortName, layerAccess, receiptVisible } from '../ui.js'
import { replayHtml, visibleEvents } from '../replay.js'

const pct = (x) => (x * 100).toFixed(0) + '%'

/** A layer's payload as this persona: a real decrypt of the sealed object, null while it is in flight. */
export function layerData(run, persona, L) {
  return look(`ld|${persona.kas}|${run.id}|${L}`, async () => {
    if (L === 'L1') {
      const out = {}
      await Promise.all(run.parts.map(async (p) => {
        const pol = run.derived.layers.L1[p.slot]
        if ((await decide(persona.kas, pol)).ok) out[p.slot] = await openJson(run.sealed.L1[p.slot], persona.kas)
      }))
      return out
    }
    return openJson(run.sealed[L], persona.kas)
  }, null)
}

function layerContent(run, persona, L) {
  const ld = layerData(run, persona, L)
  if (!ld) return '<div class="dim">opening…</div>'
  if (L === 'L1') {
    const a = layerAccess(run, persona, 'L1')
    return `<table><tr><th>Part</th><th>Owner</th><th>Model</th><th>Contribution vs GFI baseline</th><th>Allocation</th></tr>${a.per.map((x) => {
      const r = ld[x.part.slot]
      if (x.ok && r?.ok) {
        const d = r.data
        return `<tr><td>${esc(d.slot)}</td><td>${esc(d.owner)}</td><td class="m">${esc(d.option)}</td><td><b>${esc(d.band)}</b></td><td>${d.meets ? pill('ok', 'MEETS') : pill('no', 'BELOW')} <span class="dim">target +${d.allocation}</span></td></tr>`
      }
      return `<tr><td>${esc(x.part.slot)}</td><td>${esc(x.part.owner)}</td><td colspan="3" class="sealed">SEALED &mdash; another company's part (needs wp:${x.part.wp})</td></tr>`
    }).join('')}</table>
      <div class="note">Band, not a number: the ablation swaps only your part to its generic model. The exact delta would let a reader back out the partner's contribution. Each row is its own TDF, bound to that part's work package.</div>`
  }
  if (!ld.ok) return `<div class="derive" style="border-color:#5a1f21;background:#170c0c"><span class="pill no">KAS REFUSED</span> <span class="mono">${esc(ld.reason || '')}</span></div>`
  const d = ld.data
  if (L === 'L2') {
    return `<div><span class="kpi"><span class="v" style="color:${d.survivability >= 0.6 ? 'var(--green)' : d.survivability >= 0.4 ? 'var(--amber)' : 'var(--red)'}">${pct(d.survivability)}</span><br><span class="l">Mission survivability</span></span>
      <span class="kpi"><span class="v">${pct(d.ci[0])}&ndash;${pct(d.ci[1])}</span><br><span class="l">95% CI (Wilson)</span></span>
      <span class="kpi"><span class="v">${pct(d.detectedPct)}</span><br><span class="l">Detected</span></span>
      <span class="kpi"><span class="v">${pct(d.engagedPct)}</span><br><span class="l">Engaged</span></span>
      <span class="kpi"><span class="v">${d.meanExposure.toFixed(0)} s</span><br><span class="l">Mean exposure</span></span></div>
      <div class="note">${d.reps} replications &middot; seed ${d.seed}. Composite of every part in the scenario &mdash; which is why reading it requires every producer's need-to-know.</div>`
  }
  if (L === 'L3') {
    return `<table><tr><th>Site</th><th>Guidance</th><th>Engaged</th><th>Mean weapons</th><th>Kill rate</th></tr>${d.sites.map((s) => `<tr><td class="m">${esc(s.site)}</td><td>${esc(s.guidance)}</td><td>${pct(s.engagedPct)}</td><td>${s.meanLaunches.toFixed(1)}</td><td>${pct(s.killPct)}</td></tr>`).join('')}</table>`
  }
  return `<table><tr><th>Site</th><th>Median acquisition range</th><th>Median fire-control range</th></tr>${d.sites.map((s) => `<tr><td class="m">${esc(s.site)}</td><td>${s.medianAcqRange == null ? '&mdash;' : s.medianAcqRange.toFixed(1) + ' km'}</td><td>${s.medianFcRange == null ? '&mdash;' : s.medianFcRange.toFixed(1) + ' km'}</td></tr>`).join('')}</table>
    <div class="note">These ranges are a function of the airframe's signature AND the threat's parameters. Either one alone reveals nothing; together they are the most sensitive number in the run.</div>`
}

function logHtml(run, persona) {
  const lines = (run.log || []).map((l) => {
    if (l.min === 'L0') return `<div class="${/DENY|ERROR|aborted/.test(l.text) ? 'l-deny' : /PERMIT|complete/.test(l.text) ? 'l-ok' : 'l-sys'}">${esc(l.text)}</div>`
    const ld = layerAccess(run, persona, l.min).ok ? layerData(run, persona, l.min) : null
    if (ld?.ok) return `<div class="l-ok">${esc(ld.data.log[l.idx])}</div>`
    return `<div class="l-red">[${l.min} output redacted for ${esc(persona.id)}]</div>`
  })
  const ev = run.status === 'sealed' ? visibleEvents(run, persona) : []
  const evHtml = ev.length ? `<div class="l-sys" style="margin-top:6px">-- event trace (representative replication) --</div>${ev.map((e) => `<div class="${e.kind === 'JET_KILLED' ? 'l-deny' : e.kind === 'MISSION_COMPLETE' ? 'l-ok' : 'l-sys'}">T+${String(Math.round(e.t)).padStart(4)}s  ${esc(e.kind.padEnd(22))} ${esc(e.text)}</div>`).join('')}` : ''
  return `<div class="term">${lines.join('')}${evHtml}</div>`
}

export function resultHtml(run) {
  const persona = cur()
  if (!run) return `<div class="card dim">Select a run, or submit one.</div>`
  if (!receiptVisible(run, persona)) return `<div class="card"><span class="sealed">RUN NOT VISIBLE</span><div class="dim" style="margin-top:6px">The ledger does not release this run's receipt to ${esc(persona.name)}.</div></div>`
  const st = run.status === 'sealed' ? pill('sl', 'SEALED') : run.status === 'rejected' ? pill('no', 'REJECTED') : pill('no', 'FAILED')
  const sub = shortName(run.submitter)
  const head = `<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <div><h3 style="margin:0">${esc(run.id)} <span class="dim">&middot; ${esc(run.label)}</span></h3><div class="dim">submitted by ${esc(sub)} &middot; ${fmtTime(run.submittedAt)}</div></div>${st}</div>`

  if (run.status !== 'sealed') {
    const body = `<div class="derive" style="border-color:#5a1f21;background:#170c0c"><div class="big" style="color:var(--red)">PIPELINE ${run.status.toUpperCase()}</div><ul style="margin:6px 0 0 16px;padding:0">${run.reasons.map((x) => `<li class="mono">${esc(x)}</li>`).join('')}</ul>
      <div class="note">Nothing executed. The scenario file was readable &mdash; the gate is on the <em>models it names</em>, checked at resolve time with the submitter's identity.</div></div>`
    return `<div class="card">${head}${body}<h3 style="margin-top:12px">Pipeline log</h3>${logHtml(run, persona)}</div>`
  }

  const open2 = layerAccess(run, persona, 'L2').ok, open3 = layerAccess(run, persona, 'L3').ok, open4 = layerAccess(run, persona, 'L4').ok
  const any = open2 || open3 || open4
  const blind = !any && run.submitter === persona.id
  const banner = blind ? `<div class="derive"><div class="big">THE RUN COMPLETED. THE RESULT IS NOT YOURS.</div><div class="dim" style="margin-top:4px">You were entitled to <em>execute</em> every model in this scenario, but the output inherits the policy of everything that went in. Nothing in L2&ndash;L4 is readable by ${esc(persona.name)}.</div></div>` : ''

  const layers = ['L0', 'L1', 'L2', 'L3', 'L4'].map((L) => {
    const a = layerAccess(run, persona, L)
    const pol = L === 'L0' || L === 'L1' ? null : run.derived.layers[L]
    const key = run.id + L
    const isOpen = state.layerOpen[key] === true && a.ok
    const denied = state.layerOpen[key] === 'denied'
    const tdf = L === 'L0' ? '' : L === 'L1' ? `TDF × ${run.parts.length}` : `TDF · ${run.sealed[L].size.toLocaleString()} B · bound ${boundShort(run.sealed[L]).join(' ')}`
    const polTxt = L === 'L0' ? `<span class="dim">submitter + JPO (app-level rule)</span>` : L === 'L1' ? `<span class="dim">per part &rarr; that part's wp</span>` : polChips(pol)
    const btn = a.ok ? `<button class="btn sm ${isOpen ? '' : 'pri'}" data-act="layer" data-run="${run.id}" data-l="${L}">${isOpen ? 'Hide' : 'Open'}</button>` : `<button class="btn sm" data-act="layer" data-run="${run.id}" data-l="${L}">Request</button>`
    let detail = ''
    if (denied && !a.ok) detail = `<div class="derive" style="border-color:#5a1f21;background:#170c0c;margin:6px 0"><span class="pill no">DENY</span> <span class="mono"> missing ${esc((a.missing || []).join(', '))}</span></div>`
    if (isOpen) {
      detail = L === 'L0'
        ? `<table><tr><td>Result hash</td><td class="mono">${run.receipt.hash.slice(0, 32)}…</td></tr><tr><td>Sealed bytes</td><td class="mono">${run.receipt.bytes.toLocaleString()} (SHA-256 of L1–L4 TDFs)</td></tr><tr><td>Replications</td><td class="mono">${run.receipt.reps}</td></tr><tr><td>Seed</td><td class="mono">${run.receipt.seed}</td></tr><tr><td>Models</td><td class="mono">${run.receipt.models.map((m) => `${esc(m.path)} <span class="faint">r${m.rev}</span>`).join('<br>')}</td></tr><tr><td>Result</td><td>${pill('sl', 'sealed under derived policy')}</td></tr></table>`
        : `<div style="padding:4px 0 8px">${layerContent(run, persona, L)}</div>`
    }
    return `<div class="layer ${a.ok ? 'open' : 'locked'}"><span class="id">${L}</span><div><div class="nm">${LAYER_INFO[L].name} ${a.ok ? pill('ok', 'READABLE') : pill('sl', 'SEALED')}</div><div class="pl">${LAYER_INFO[L].blurb}</div><div style="margin-top:3px">${polTxt}</div>${tdf ? `<div class="pl" style="margin-top:2px">${esc(tdf)}</div>` : ''}</div>${btn}</div>${detail ? `<div style="grid-column:1/-1;padding-left:44px">${detail}</div>` : ''}`
  }).join('')

  const rp = any ? `<div style="margin:10px 0"><button class="btn pri" data-act="open-replay" data-run="${run.id}">${state.showReplay === run.id ? 'Close replay' : 'Open replay'}</button></div>` : ''
  return `<div class="card">${head}${banner}<h3 style="margin-top:12px">Result layers</h3>${layers}${rp}</div>
    ${state.showReplay === run.id && any ? replayHtml(run, persona) : ''}
    <div class="card"><h3>Pipeline log <span class="dim">(redacted per layer)</span></h3>${logHtml(run, persona)}</div>`
}

/** Open, hide or request a layer. A request is a real rewrap, so a refusal is the key server's own. */
export async function layerAction(run, L) {
  const persona = cur()
  const key = run.id + L
  const a = layerAccess(run, persona, L)
  if (a.ok && state.layerOpen[key] === true) { set({ layerOpen: { ...state.layerOpen, [key]: false } }); return }
  if (L === 'L0') {
    pep(persona.name, 'READ', `${run.id}/L0`, a.ok ? 'PERMIT' : 'DENY', a.ok ? 'receipt' : 'not the submitter or JPO')
    act(persona.id, a.ok ? 'opened' : 'denied')
    set({ layerOpen: { ...state.layerOpen, [key]: a.ok ? true : 'denied' } })
    return
  }
  let ok = false, reason = ''
  if (L === 'L1') {
    for (const p of run.parts) {
      const r = await tryOpen(run.sealed.L1[p.slot], persona.kas)
      if (r.ok) ok = true; else reason = reason || r.reason
    }
  } else {
    const r = await tryOpen(run.sealed[L], persona.kas)
    ok = r.ok; reason = r.reason || ''
  }
  if (ok) {
    pep(persona.name, 'READ', `${run.id}/${L}`, 'PERMIT', L === 'L1' ? 'own part(s)' : describe(run.derived.layers[L]))
    act(persona.id, 'opened')
  } else {
    pep(persona.name, 'READ', `${run.id}/${L}`, 'DENY', `missing ${(a.missing || []).join(', ') || reason}`)
    act(persona.id, 'denied')
  }
  set({ layerOpen: { ...state.layerOpen, [key]: ok ? true : 'denied' } })
}
