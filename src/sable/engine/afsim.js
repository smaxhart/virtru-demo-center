// Mock AFSIM-style engine: script parser -> compiled scenario -> time-stepped Monte Carlo.
// Physics is deliberately simple (radar range ~ RCS^0.25, horizon limit, ECM factors, IR lock ~ sqrt(I)).
// ALL PARAMETERS ARE SYNTHETIC. This is not AFSIM and does not reproduce its models.

const BLOCKS = new Set(['radar_signature', 'infrared_signature', 'performance', 'ew_suite', 'site', 'platform', 'route', 'scenario']);
const SOUND = 295; // m/s, flat-earth simplification

export function parse(text) {
  const root = { kind: 'root', name: '', props: [], children: [] };
  const stack = [root];
  const includes = [];
  const errors = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();
    if (!line) return;
    const tok = line.split(/\s+/);
    const kw = tok[0];
    if (kw === 'include_once' || kw === 'include') { includes.push(tok[1]); return; }
    if (kw.startsWith('end_') && BLOCKS.has(kw.slice(4))) {
      const top = stack[stack.length - 1];
      if (stack.length > 1 && kw === 'end_' + top.kind) stack.pop();
      else errors.push(`line ${i + 1}: unexpected ${kw}`);
      return;
    }
    if (BLOCKS.has(kw)) {
      const node = { kind: kw, name: tok[1] || '', props: [], children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      return;
    }
    stack[stack.length - 1].props.push(tok);
  });
  if (stack.length > 1) errors.push(`unterminated block ${stack[stack.length - 1].kind}`);
  return { root, includes, errors };
}

export function parseDMS(s) {
  const m = /^(\d+):(\d+):(\d+(?:\.\d+)?)([nsew])$/i.exec(s);
  if (!m) return NaN;
  const v = +m[1] + +m[2] / 60 + +m[3] / 3600;
  return /[sw]/i.test(m[4]) ? -v : v;
}

const num = (node, key, dflt) => {
  const p = node.props.find((t) => t[0] === key);
  return p ? parseFloat(p[1]) : dflt;
};
const str = (node, key, dflt) => {
  const p = node.props.find((t) => t[0] === key);
  return p ? p[1] : dflt;
};

function table(node) {
  return node.props
    .filter((t) => t[0] === 'aspect')
    .map((t) => [parseFloat(t[1]), parseFloat(t[2])])
    .sort((a, b) => a[0] - b[0]);
}

function interp(tbl, a) {
  a = Math.min(180, Math.max(0, a));
  for (let i = 1; i < tbl.length; i++) {
    if (a <= tbl[i][0]) {
      const [x0, y0] = tbl[i - 1];
      const [x1, y1] = tbl[i];
      return y0 + ((y1 - y0) * (a - x0)) / (x1 - x0 || 1);
    }
  }
  return tbl[tbl.length - 1][1];
}

// Resolve includes recursively-free (flat) and build a compiled scenario.
export function compile(text, lookup) {
  const main = parse(text);
  const errors = [...main.errors];
  const files = [];
  const nodes = [main.root];
  for (const path of main.includes) {
    const f = lookup(path);
    if (!f) { errors.push(`cannot resolve include ${path}`); continue; }
    files.push(path);
    const sub = parse(f);
    errors.push(...sub.errors.map((e) => `${path}: ${e}`));
    nodes.push(sub.root);
  }
  const all = nodes.flatMap((n) => n.children);
  const pick = (kind) => all.filter((n) => n.kind === kind).pop();
  const scn = main.root.children.find((n) => n.kind === 'scenario');
  const plat = main.root.children.find((n) => n.kind === 'platform') || (scn && scn.children.find((n) => n.kind === 'platform'));

  const rcs = pick('radar_signature');
  const ir = pick('infrared_signature');
  const perf = pick('performance');
  const ew = pick('ew_suite');
  if (!rcs) errors.push('no radar_signature in scenario');
  if (!ir) errors.push('no infrared_signature in scenario');
  if (!perf) errors.push('no performance block in scenario');
  if (!plat) errors.push('no platform block');

  const sites = all.filter((n) => n.kind === 'site').map((n) => {
    const pos = n.props.find((t) => t[0] === 'position');
    return {
      name: n.name,
      type: str(n, 'type', 'MR'),
      lat: pos ? parseDMS(pos[1]) : NaN,
      lon: pos ? parseDMS(pos[2]) : NaN,
      rcsOffsetDb: num(n, 'rcs_offset_db', 0),
      acqRef: num(n, 'acquisition_ref_range_km', 0),
      fcRef: num(n, 'fire_control_ref_range_km', 0),
      scan: num(n, 'scan_period_s', 4),
      wRange: num(n, 'weapon_range_km', 50),
      wMin: num(n, 'weapon_min_range_km', 5),
      wSpeed: num(n, 'weapon_speed_mps', 900),
      guidance: str(n, 'guidance', 'radar'),
      missiles: num(n, 'missiles', 4),
      pk: num(n, 'pk_base', 0.6),
      seekRef: num(n, 'seeker_ref_range_km', 15),
      seekK: num(n, 'seeker_k', 0.8),
    };
  });
  if (!sites.length) errors.push('no threat sites in scenario');

  const wps = plat
    ? (plat.children.find((c) => c.kind === 'route')?.props || [])
        .filter((t) => t[0] === 'waypoint')
        .map((t) => ({
          lat: parseDMS(t[1]),
          lon: parseDMS(t[2]),
          mach: parseFloat(t[t.indexOf('mach') + 1]),
          alt: parseFloat(t[t.indexOf('alt_m') + 1]),
        }))
    : [];
  if (wps.length < 2) errors.push('route needs at least two waypoints');
  if (wps.some((w) => isNaN(w.lat) || isNaN(w.lon))) errors.push('bad waypoint coordinate');

  const params = {
    name: scn ? scn.name : 'UNNAMED',
    description: scn ? (scn.props.find((t) => t[0] === 'description') || []).slice(1).join(' ').replace(/"/g, '') : '',
    seed: scn ? num(scn, 'seed', 1) : 1,
    reps: scn ? num(scn, 'replications', 100) : 100,
    endTime: scn ? num(scn, 'end_time', 1800) : 1800,
    dt: scn ? num(scn, 'step', 2) : 2,
  };

  if (errors.length) return { ok: false, errors, files, params };

  const lat0 = wps[0].lat, lon0 = wps[0].lon;
  const kmLat = 110.57, kmLon = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const proj = (lat, lon) => [(lon - lon0) * kmLon, (lat - lat0) * kmLat];
  wps.forEach((w) => { [w.x, w.y] = proj(w.lat, w.lon); });
  sites.forEach((s) => { [s.x, s.y] = proj(s.lat, s.lon); });

  const perfMach = num(perf, 'max_cruise_mach', 0.8);
  const maxG = num(perf, 'max_g', 7);
  const trail = buildTrail(wps, perfMach, params.dt, params.endTime);

  return {
    ok: true,
    errors: [],
    files,
    params,
    sites,
    wps,
    trail,
    maxG,
    perfMach,
    rcsTbl: table(rcs),
    irTbl: table(ir),
    ew: {
      name: ew ? ew.name : 'NONE',
      rwr: ew ? num(ew, 'rwr_detection_range_km', 0) : 0,
      resp: ew ? num(ew, 'jam_response_time_s', 99) : 99,
      fs: ew ? num(ew, 'ecm_range_factor_search', 1) : 1,
      ft: ew ? num(ew, 'ecm_range_factor_track', 1) : 1,
      fseek: ew ? num(ew, 'ecm_seeker_pk_factor', 1) : 1,
      decoys: ew ? num(ew, 'decoys', 0) : 0,
      decoyRed: ew ? num(ew, 'decoy_pk_reduction', 0) : 0,
      flares: ew ? num(ew, 'flares', 0) : 0,
      flareRed: ew ? num(ew, 'flare_pk_reduction', 0) : 0,
    },
  };
}

function buildTrail(wps, perfMach, dt, endTime) {
  const out = [];
  let leg = 0, x = wps[0].x, y = wps[0].y;
  for (let t = 0; t <= endTime; t += dt) {
    const a = wps[leg], b = wps[leg + 1];
    if (!b) break;
    const dx = b.x - x, dy = b.y - y, d = Math.hypot(dx, dy);
    const mach = Math.min(a.mach, perfMach);
    const v = (mach * SOUND * dt) / 1000; // km per step
    const frac = Math.min(1, 1 - d / (Math.hypot(b.x - a.x, b.y - a.y) || 1));
    out.push({ t, x, y, alt: a.alt + (b.alt - a.alt) * frac, hx: dx / (d || 1), hy: dy / (d || 1), mach });
    if (v >= d) { x = b.x; y = b.y; leg++; if (!wps[leg + 1]) { out.push({ t: t + dt, x, y, alt: b.alt, hx: dx / (d || 1), hy: dy / (d || 1), mach, end: true }); break; } }
    else { x += (dx / d) * v; y += (dy / d) * v; }
  }
  return out;
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dbToM2 = (db) => Math.pow(10, db / 10);

// One replication. record=true keeps the replay data.
export function simulate(m, seed, record = false) {
  const rand = rng(seed);
  const { sites, trail, ew } = m;
  const st = sites.map((s) => ({ hits: 0, acq: null, fc: false, fcFirst: null, acqFirst: null, next: rand() * s.scan, missiles: s.missiles, nextLaunch: 0, rwrAt: null, launches: 0, kills: 0 }));
  const shots = [];
  const events = [];
  const rec = record ? { steps: [], missiles: [] } : null;
  let decoys = ew.decoys, flares = ew.flares;
  let alive = true, tKill = null, killer = null, exposure = 0;
  const log = (t, min, kind, t3, t4) => { if (record) events.push({ t, min, kind, t3, t4: t4 || t3 }); };

  const jamActive = (i, t) => st[i].rwrAt !== null && t >= st[i].rwrAt + ew.resp;

  for (let k = 0; k < trail.length && alive; k++) {
    const J = trail[k];
    const t = J.t;
    // resolve inbound missiles first
    for (const sh of shots) {
      if (sh.done || sh.t1 > t) continue;
      sh.done = true;
      const s = sites[sh.i];
      const r = Math.hypot(J.x - s.x, J.y - s.y);
      const bearing = Math.atan2(s.y - J.y, s.x - J.x);
      const aspect = Math.acos(Math.max(-1, Math.min(1, J.hx * Math.cos(bearing) + J.hy * Math.sin(bearing)))) * 180 / Math.PI;
      let pk = s.pk;
      let detail = '';
      if (s.guidance === 'radar') {
        const sig = interp(m.rcsTbl, aspect) + s.rcsOffsetDb;
        const rSeek = s.seekRef * Math.pow(dbToM2(sig) / 5, 0.25);
        const plock = Math.pow(Math.min(1, rSeek / 12), 1.5);
        pk *= plock;
        if (jamActive(sh.i, t)) pk *= ew.fseek;
        if (decoys > 0) { decoys--; pk *= 1 - ew.decoyRed; }
        detail = `seeker ${rSeek.toFixed(1)} km lock ${(plock * 100).toFixed(0)}%`;
      } else {
        const I = interp(m.irTbl, aspect);
        const rLock = s.seekK * Math.sqrt(I);
        const plock = Math.pow(Math.min(1, rLock / 15), 1.5);
        pk *= plock;
        if (flares > 0) { flares -= 2; pk *= 1 - ew.flareRed; }
        detail = `IR lock ${rLock.toFixed(1)} km lock ${(plock * 100).toFixed(0)}%`;
      }
      pk *= Math.max(0.3, 1 - 0.04 * (m.maxG - 5));
      const hit = rand() < pk;
      if (rec) rec.missiles.push({ i: sh.i, t0: sh.t0, t1: t, hit, x1: J.x, y1: J.y });
      if (hit) {
        alive = false; tKill = t; killer = sh.i; st[sh.i].kills++;
        log(t, 'L2', 'JET_KILLED', `SABLE_1 destroyed`, `SABLE_1 destroyed by ${s.name}  pk ${(pk * 100).toFixed(0)}%  (${detail})`);
      } else {
        log(t, 'L3', 'WEAPON_MISS', `weapon from ${s.name} missed`, `weapon from ${s.name} missed  pk ${(pk * 100).toFixed(0)}%  (${detail})`);
      }
    }
    if (!alive) break;

    let anyFc = false;
    const stepRec = rec ? { t, x: J.x, y: J.y, alt: J.alt, sig: 0, rfc: [], racq: [], jam: [], fc: [] } : null;

    for (let i = 0; i < sites.length; i++) {
      const s = sites[i], q = st[i];
      const dx = s.x - J.x, dy = s.y - J.y;
      const r = Math.hypot(dx, dy);
      const bearing = Math.atan2(dy, dx);
      const aspect = Math.acos(Math.max(-1, Math.min(1, J.hx * Math.cos(bearing) + J.hy * Math.sin(bearing)))) * 180 / Math.PI;

      if (s.guidance === 'ir') {
        const I = interp(m.irTbl, aspect);
        const rDet = 2.5 * s.seekK * Math.sqrt(I);
        if (stepRec) { stepRec.rfc.push(Math.min(rDet, s.wRange)); stepRec.racq.push(rDet); stepRec.jam.push(false); stepRec.fc.push(q.fc); }
        if (r <= Math.min(rDet, s.wRange) && r >= s.wMin && q.missiles > 0) {
          if (!q.fc) {
            q.fc = true; q.fcFirst = r;
            log(t, 'L3', 'IR_ACQUIRE', `${s.name} acquired target`, `${s.name} acquired target  range ${r.toFixed(1)} km  I=${I.toFixed(0)} W/sr`);
          }
          if (t >= q.nextLaunch) {
            q.missiles--; q.launches++; q.nextLaunch = t + 4;
            shots.push({ i, t0: t, t1: t + (r * 1000) / s.wSpeed });
            log(t, 'L3', 'WEAPON_FIRED', `${s.name} fired 1 weapon`, `${s.name} fired 1 weapon  range ${r.toFixed(1)} km`);
          }
        } else q.fc = false;
        if (q.fc) anyFc = true;
        continue;
      }

      const sigDb = interp(m.rcsTbl, aspect) + s.rcsOffsetDb;
      const f = Math.pow(dbToM2(sigDb) / 5, 0.25);
      const horizon = 4.12 * (Math.sqrt(15) + Math.sqrt(Math.max(1, J.alt)));
      if (ew.rwr > 0 && q.rwrAt === null && r < ew.rwr && r < horizon + 60) {
        q.rwrAt = t;
        log(t, 'L4', 'RWR_DETECT', `(sealed)`, `SABLE_1 RWR detected ${s.name} emitter  range ${r.toFixed(1)} km`);
      }
      const jam = jamActive(i, t);
      if (jam && stepRec && !q.jamLogged) { q.jamLogged = true; }
      const rAcq = Math.min(s.acqRef * f * (jam ? ew.fs : 1), horizon);
      const rFc = Math.min(s.fcRef * f * (jam ? ew.ft : 1), horizon);
      if (stepRec) { stepRec.rfc.push(rFc); stepRec.racq.push(rAcq); stepRec.jam.push(jam); stepRec.fc.push(q.fc); if (i === 0) stepRec.sig = sigDb; }

      if (t >= q.next) {
        q.next = t + s.scan;
        if (r < rAcq) {
          const pd = 1 / (1 + Math.exp((r / rAcq - 0.9) / 0.05));
          if (rand() < pd) q.hits++; else q.hits = Math.max(0, q.hits - 1);
        } else q.hits = Math.max(0, q.hits - 1);
        if (q.hits >= 3 && q.acqFirst === null) {
          q.acqFirst = r;
          log(t, 'L3', 'SENSOR_TRACK_INITIATED', `${s.name} initiated track on SABLE_1`, `${s.name} initiated track on SABLE_1  range ${r.toFixed(1)} km  rcs ${sigDb.toFixed(1)} dBsm`);
        }
        if (q.hits >= 3 && r < rFc) {
          if (!q.fc) {
            q.fc = true;
            if (q.fcFirst === null) q.fcFirst = r;
            log(t, 'L3', 'FIRE_CONTROL_TRACK', `${s.name} established fire-control track`, `${s.name} established fire-control track  range ${r.toFixed(1)} km${jam ? '  (jamming active)' : ''}`);
          }
        } else if (q.fc && r > rFc * 1.05) {
          q.fc = false;
          log(t, 'L3', 'TRACK_DROPPED', `${s.name} lost fire-control track`, `${s.name} lost fire-control track  range ${r.toFixed(1)} km`);
        }
      }
      if (jam && !q.jamAnnounced) { q.jamAnnounced = true; log(t, 'L4', 'JAMMER_ON', `(sealed)`, `${ew.name} jamming ${s.name}`); }
      if (q.fc) anyFc = true;
      if (q.fc && r >= s.wMin && r <= s.wRange && q.missiles > 0 && t >= q.nextLaunch) {
        const n = Math.min(2, q.missiles);
        q.missiles -= n; q.launches += n; q.nextLaunch = t + 20;
        for (let j = 0; j < n; j++) shots.push({ i, t0: t, t1: t + (r * 1000) / s.wSpeed + j * 3 });
        log(t, 'L3', 'WEAPON_FIRED', `${s.name} fired ${n} weapons`, `${s.name} fired ${n} weapons  range ${r.toFixed(1)} km  flight ${(r * 1000 / s.wSpeed).toFixed(0)} s`);
      }
    }
    if (anyFc) exposure += m.params.dt;
    if (stepRec) rec.steps.push(stepRec);
  }
  if (alive) log(trail[trail.length - 1].t, 'L2', 'MISSION_COMPLETE', `SABLE_1 reached egress alive`);

  return {
    alive,
    tKill,
    killer,
    exposure,
    launches: st.reduce((a, q) => a + q.launches, 0),
    perSite: st.map((q) => ({ launches: q.launches, kills: q.kills, fcFirst: q.fcFirst, acqFirst: q.acqFirst })),
    events: events.sort((a, b) => a.t - b.t),
    rec,
  };
}

const wilson = (k, n) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n), h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
};

const median = (a) => {
  const v = a.filter((x) => x != null).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

export function monteCarlo(m, reps = m.params.reps) {
  const results = [];
  for (let i = 0; i < reps; i++) results.push(simulate(m, m.params.seed + i * 7919, false));
  const surv = results.filter((r) => r.alive).length;
  const [lo, hi] = wilson(surv, reps);
  const perSite = m.sites.map((s, i) => ({
    site: s.name,
    guidance: s.guidance,
    engagedPct: results.filter((r) => r.perSite[i].launches > 0).length / reps,
    meanLaunches: results.reduce((a, r) => a + r.perSite[i].launches, 0) / reps,
    killPct: results.filter((r) => r.killer === i).length / reps,
    medianFcRange: median(results.map((r) => r.perSite[i].fcFirst)),
    medianAcqRange: median(results.map((r) => r.perSite[i].acqFirst)),
  }));
  // representative replication for replay: first with >=2 launches, preferring one that survives
  let rep = results.findIndex((r) => r.launches >= 2 && r.alive);
  if (rep < 0) rep = results.findIndex((r) => r.launches >= 1);
  if (rep < 0) rep = 0;
  return {
    reps,
    survivability: surv / reps,
    ci: [lo, hi],
    detectedPct: results.filter((r) => r.perSite.some((s) => s.acqFirst != null)).length / reps,
    engagedPct: results.filter((r) => r.launches > 0).length / reps,
    meanLaunches: results.reduce((a, r) => a + r.launches, 0) / reps,
    meanExposure: results.reduce((a, r) => a + r.exposure, 0) / reps,
    perSite,
    repSeedIndex: rep,
  };
}

export function replay(m, repIndex) {
  return simulate(m, m.params.seed + repIndex * 7919, true);
}
