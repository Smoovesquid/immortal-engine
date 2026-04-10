import { ensureWorld } from './state.js';
import { seedFromString, makeRng } from './rng.js';
import { fateBand } from './rulesets.js';

// Narrative Instrument — Thematic Core (V2)
// Deterministic story architecture above physics.

export function ensureInstrumentLayer(inst) {
  const i = inst && typeof inst === 'object' ? inst : {};

  // Preserve legacy instrument keys if present.
  const legacy = {
    theme: String(i.theme ?? ''),
    motif: String(i.motif ?? ''),
    taboo: String(i.taboo ?? ''),
    promise: String(i.promise ?? ''),
    cost: String(i.cost ?? ''),
    omen: String(i.omen ?? ''),
    question: String(i.question ?? '')
  };

  const themeCore = i.themeCore && typeof i.themeCore === 'object' ? i.themeCore : {};
  const motifsCore = i.motifsCore && typeof i.motifsCore === 'object' ? i.motifsCore : {};

  const active = Array.isArray(motifsCore.active) ? motifsCore.active.map(String).map(s => s.trim()).filter(Boolean) : [];
  const reinforced = motifsCore.reinforced && typeof motifsCore.reinforced === 'object' ? motifsCore.reinforced : {};

  const threads = Array.isArray(i.threads) ? i.threads.map(t => normalizeThread(t)).filter(Boolean) : [];

  const lastBeatsRaw = Array.isArray(i.lastBeats) ? i.lastBeats.map(String).map(s => s.trim()).filter(Boolean) : [];
  const lastBeats = lastBeatsRaw.slice(0, 5);
  const nextBeatOverride = i.nextBeatOverride ? String(i.nextBeatOverride) : '';

  return {
    ...legacy,
    themeCore: {
      primary: String(themeCore.primary ?? ''),
      counterforce: String(themeCore.counterforce ?? ''),
      question: String(themeCore.question ?? '')
    },
    motifsCore: {
      active: capDedup(active, 4),
      reinforced: normalizeReinforced(reinforced)
    },
    threads: capThreads(threads, 12),
    inevitability: clampInt(i.inevitability ?? 0, 0, 10),
    lastBeats,
    nextBeatOverride
  };
}

export function seedMotifs(world, pack) {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);

  // If already seeded, keep locked.
  if (inst.motifsCore.active.length) {
    return { ...w, instrument: inst };
  }

  const motifs = Array.isArray(pack?.sensoryMotifs) ? pack.sensoryMotifs.map(String) : [];
  const safe = motifs.length ? motifs : ['a low hum threads through the walls'];

  const band = fateBand(w.meta.fate);
  const count = (band === 'cooperative') ? 1 : 2;

  const seed = seedFromString(`${w.meta.seed}|instrument|motifs|${w.pack.primaryId}|${band}`);
  const rng = makeRng(seed);

  const active = [];
  while (active.length < count && active.length < safe.length) {
    const m = String(rng.pick(safe) || safe[0]).trim();
    if (!m) break;
    if (active.includes(m)) continue;
    active.push(m);
  }

  const reinforced = {};
  for (const m of active) reinforced[m] = 1;

  return {
    ...w,
    instrument: {
      ...inst,
      motifsCore: { active, reinforced }
    }
  };
}

export function introduceThread(world, label) {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);

  const lab = String(label ?? '').trim();
  if (!lab) return w;

  // Dedup by label if already open/escalating.
  const existing = inst.threads.find(t => t.label.toLowerCase() === lab.toLowerCase() && t.status !== 'resolved');
  if (existing) return w;

  const introducedAt = w.timeline.length;
  const id = `th-${seedFromString(`${w.meta.seed}|thread|${lab}|${introducedAt}`)}`;
  const thread = { id, label: lab, introducedAt, tension: 1, status: 'open' };

  const next = {
    ...inst,
    threads: [thread, ...inst.threads]
  };

  return { ...w, instrument: withInevitability(next, w.meta.fate) };
}

export function escalateThread(world, id) {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const tid = String(id ?? '').trim();
  if (!tid) return w;

  const threads = inst.threads.map(t => {
    if (t.id !== tid) return t;
    if (t.status === 'resolved') return t;
    const tension = clampInt(t.tension + 1, 0, 5);
    const status = tension >= 3 ? 'escalating' : t.status;
    return { ...t, tension, status };
  });

  return { ...w, instrument: withInevitability({ ...inst, threads }, w.meta.fate, { escalation: true }) };
}

export function resolveThread(world, id) {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const tid = String(id ?? '').trim();
  if (!tid) return w;

  const threads = inst.threads.map(t => {
    if (t.id !== tid) return t;
    return { ...t, status: 'resolved', tension: 0 };
  });

  const next = withInevitability({ ...inst, threads }, w.meta.fate, { resolution: true });
  return { ...w, instrument: next };
}

export function tickThreads(world, { sceneAdvanced = false } = {}) {
  // Threads auto-increase tension when ignored.
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  if (!sceneAdvanced) return { ...w, instrument: inst };

  const threads = inst.threads.map(t => {
    if (t.status === 'resolved') return t;
    // Slow tick: every scene +1 tension capped at 5.
    const tension = clampInt(t.tension + 1, 0, 5);
    const status = tension >= 3 ? 'escalating' : t.status;
    return { ...t, tension, status };
  });

  return { ...w, instrument: withInevitability({ ...inst, threads }, w.meta.fate) };
}

export function reinforceMotif(world, motif, by = 1) {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const m = String(motif ?? '').trim();
  if (!m) return w;
  const cur = inst.motifsCore.reinforced[m] ?? 0;
  const next = clampInt(cur + clampInt(by, 0, 99), 0, 999);
  const reinforced = { ...inst.motifsCore.reinforced, [m]: next };
  const active = inst.motifsCore.active.includes(m) ? inst.motifsCore.active : [m, ...inst.motifsCore.active].slice(0, 4);
  return { ...w, instrument: { ...inst, motifsCore: { active, reinforced } } };
}

export function consequenceWeight(world) {
  // A scalar used by physics to bias severity. 1.0 baseline.
  const w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const band = fateBand(w.meta.fate);
  const inev = inst.inevitability;
  const base = band === 'blood' ? 1.15 : band === 'grim' ? 1.05 : 0.95;
  const inevBump = 1 + (inev / 20); // up to +0.5
  return Number((base * inevBump).toFixed(4));
}

function withInevitability(inst, fate, { escalation = false, resolution = false } = {}) {
  const band = fateBand(fate);
  const open = inst.threads.filter(t => t.status !== 'resolved');
  const tensionSum = open.reduce((s, t) => s + clampInt(t.tension, 0, 5), 0);
  let inev = clampInt(tensionSum, 0, 10);

  // Escalation boosts inevitability, blood grows faster.
  if (escalation) inev += (band === 'blood' ? 2 : 1);
  if (resolution) inev -= 2;

  // Fate biases growth.
  if (band === 'blood') inev += 1;

  return { ...inst, inevitability: clampInt(inev, 0, 10) };
}

function normalizeThread(t) {
  if (!t || typeof t !== 'object') return null;
  const status = String(t.status ?? 'open');
  const s = (status === 'open' || status === 'escalating' || status === 'resolved') ? status : 'open';
  return {
    id: String(t.id ?? ''),
    label: String(t.label ?? ''),
    introducedAt: clampInt(t.introducedAt ?? 0, 0, 999999),
    tension: clampInt(t.tension ?? 0, 0, 5),
    status: s
  };
}

function normalizeReinforced(obj) {
  const x = obj && typeof obj === 'object' ? obj : {};
  const out = {};
  for (const [k, v] of Object.entries(x)) {
    const key = String(k).trim();
    if (!key) continue;
    out[key] = clampInt(v, 0, 999);
  }
  return out;
}

function capDedup(arr, cap) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const s = String(x).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function capThreads(arr, cap) {
  return arr.slice(0, cap);
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
