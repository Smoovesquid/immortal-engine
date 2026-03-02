import { assertWorldInvariants } from './invariants.js';
import { ensureWorld } from './state.js';
import { ensureInstrumentLayer, reinforceMotif } from './instrument.js';
import { seedFromString, makeRng } from './rng.js';
import { fateBand } from './rulesets.js';
import { scoreInventorySignals } from './gear/gearProps.js';
import { scarifyNode, ensureMap } from './map/mapState.js';

// Living System Core — deterministic world evolution.

export function worldTick(world, seed = '') {
  let w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);

  const tickIndex = w.time?.turn ?? 0;
  const s = String(seed || `${w.meta.seed}|worldTick|${w.scene.promptSeed}|t${tickIndex}|tl${w.timeline.length}`);
  const rng = makeRng(seedFromString(s));

  const band = fateBand(w.meta.fate);
  const severity = band === 'blood' ? 1.35 : band === 'grim' ? 1.15 : 0.95;

  // 1) Advance faction agendas
  w = tickFactions(w, rng, severity);

  // 2) Increase tension in active living threads; escalate/mutate deterministically.
  w = tickLivingThreads(w, rng, severity);

  // 2.5) Map-anchored faction/thread pressure (offscreen actions target places)
  w = tickMapPressure(w, rng, severity);

  // 3) Escalate unresolved threats (ledger.threats)
  w = tickThreats(w, severity);

  // 3.5) Gear signals feed ambient pressure/dread (noise/light as offscreen consequences)
  w = tickGearSignals(w, severity);

  // 3.75) Environmental residue accumulates & converts into escalation; then decays.
  w = tickEnv(w, severity);

  // 4) Age questions (decay/transform)
  w = tickQuestions(w, rng);

  // 5) Spread environmental drift
  w = tickEcology(w, severity);

  // 5) Accumulate scars (irreversible)
  w = applyIrreversibleThresholds(w);

  // 6) Modify reputation + alignment state
  w = tickReputation(w, severity);

  // 7) Reinforce motifs over time
  w = tickMotifs(w, rng, severity);

  // 8) Apply fate weighting already expressed via severity.
  assertWorldInvariants(w);
  return w;
}

function tickFactions(w, rng, severity) {
  const factions = Array.isArray(w.factions) ? w.factions : [];
  if (!factions.length) return w;

  const next = factions.map(f => {
    const pressure = clampInt((f.pressure ?? 0) + Math.max(1, Math.round(1 * severity)), 0, 100);
    const hostility = clampInt((f.hostility ?? 0) + (w.ecology.corruption >= 70 ? 2 : 0) + (w.ecology.scarcity >= 75 ? 1 : 0), 0, 100);
    const move = pickFactionMove({ pressure, hostility, rng });
    return { ...f, pressure, hostility, lastMove: move };
  });

  // Offscreen action when hostility high.
  const hostile = next.filter(f => f.hostility >= 80);
  let w2 = { ...w, factions: next };
  if (hostile.length) {
    const f0 = hostile[0];
    w2 = pushTickLog(w2, `[TICK] faction ${f0.id} enters war posture (${f0.lastMove})`);
    // War posture raises pressure clock deterministically.
    w2 = { ...w2, clocks: { ...w2.clocks, pressure: clampInt(w2.clocks.pressure + 1, 0, 12) } };
  }
  return w2;
}

function tickLivingThreads(w, rng, severity) {
  const inst = ensureInstrumentLayer(w.instrument);
const threads = inst.threads;
  if (!threads.length) return w;

  const bump = Math.max(1, Math.round(1 * severity));
  const next = threads.map(t => {
    if (t.status === 'resolved') return t;
    const tension = clampInt((t.tension ?? 0) + bump, 0, 6);
    const age = clampInt((t.age ?? 0) + 1, 0, 999);

    // If unresolved for N ticks -> mutate objective deterministically.
    let objective = String(t.objective || '').trim();
    let trajectory = String(t.trajectory || 'static');
    if (age > 4 && (age % 3 === 0)) {
      trajectory = 'mutating';
      objective = mutateObjective(objective, rng);
    }

    return { ...t, tension, age, objective, trajectory };
  });

  let w2 = { ...w, instrument: { ...inst, threads: next } };

  // Escalate event when any thread crosses threshold.
  // Canonical threadShift surface: log a stable event when tension crosses the escalation threshold.
  const prevById = new Map((threads || []).map(t => [String(t.id), t]));
  const crossed = next
    .filter(t => t.status !== 'resolved')
    .map(t => {
      const prev = prevById.get(String(t.id)) || {};
      const from = Number(prev.tension ?? 0);
      const to = Number(t.tension ?? 0);
      return { t, from, to };
    })
    .filter(x => x.from < 4 && x.to >= 4)
    .sort((a, b) => (b.to - a.to) || String(a.t.id).localeCompare(String(b.t.id)));

  if (crossed.length) {
    const x = crossed[0];
    w2 = pushEvent(w2, { kind: 'threadShift', data: { threadId: String(x.t.id), from: x.from, to: x.to, reason: 'tensionThreshold' } });
  }

  const hot = next.filter(t => t.status !== 'resolved' && t.tension >= 4).sort((a, b) => (b.tension - a.tension) || a.id.localeCompare(b.id));
  if (hot.length) {
    const t0 = hot[0];
    w2 = pushTickLog(w2, `thread escalates: ${t0.label} (tension:${t0.tension}/6)`);
  }
  return w2;
}

function tickMapPressure(w, rng, severity) {
  const m = ensureMap(w.map);
  if (!m.nodes.length) return w;

  const factions = Array.isArray(w.factions) ? w.factions : [];
  if (!factions.length) return w;

  const hostile = factions.filter(f => (f.hostility ?? 0) >= 85).sort((a, b) => (b.hostility - a.hostility) || a.id.localeCompare(b.id));
  if (!hostile.length) return w;

  // Pick a target node deterministically, biased toward current node.
  const here = String(m.currentNodeId || m.nodes[0].id);
  const pool = [here, ...m.nodes.map(n => n.id)].filter(Boolean);
  const targetId = String(rng.pick(pool) || here);

  // Apply a place-scar that sceneDirector/composer can surface.
  const f0 = hostile[0];
  const scarId = `faction:${f0.id}:${f0.lastMove || 'pressure'}`;

  const w2 = scarifyNode(w, targetId, scarId);
  return pushTickLog(w2, `[TICK] offscreen action scars ${targetId} (${scarId})`);
}

function mutateObjective(obj, rng) {
  const o = String(obj || '').trim();
  const twists = [
    (x) => `Contain ${x}`,
    (x) => `Pay the price to ${x.toLowerCase()}`,
    (x) => `Expose who benefits from ${x.toLowerCase()}`,
    (x) => `Choose what to sacrifice to ${x.toLowerCase()}`
  ];
  const fn = rng.pick(twists) || twists[0];
  return fn(o || 'survive');
}

function tickThreats(w, severity) {
  const threats = Array.isArray(w.ledger?.threats) ? w.ledger.threats : [];
  if (!threats.length) return w;

  // Deterministic escalation: more threats => more pressure.
  const bump = clampInt(Math.round(threats.length * 0.25 * severity), 0, 3);
  if (bump <= 0) return w;

  const next = { ...w, clocks: { ...w.clocks, pressure: clampInt(w.clocks.pressure + bump, 0, 12) } };
  return pushTickLog(next, `[TICK] unresolved threats tighten (+${bump} pressure)`);
}

function tickGearSignals(w, severity) {
  const party = Array.isArray(w.party) ? w.party : [];
  if (!party.length) return w;

  let noise = 0;
  let light = 0;
  let weight = 0;
  let bulk = 0;

  for (const e of party) {
    const s = scoreInventorySignals(e);
    noise += s.noise;
    light += s.light;
    weight += s.weight;
    bulk += s.bulk;
  }

  // Thresholds tuned for small parties: 3–5 people should matter, but never dominate.
  // - noise: attracts attention => pressure up
  // - light: makes you visible; when dread is already high, light worsens paranoia => dread up
  const noiseThreshold = 12;
  const lightThreshold = 14;

  const noiseBump = noise >= noiseThreshold ? Math.max(1, Math.round(1 * severity)) : 0;
  const lightBump = (light >= lightThreshold && (w.clocks.dread ?? 0) >= 6) ? 1 : 0;

  // Carry weight/bulk into pressure slightly (fatigue/slow movement), but only at high loads.
  const load = weight + bulk;
  const loadBump = load >= 45 ? 1 : 0;

  const pBump = clampInt(noiseBump + loadBump, 0, 3);
  const dBump = clampInt(lightBump, 0, 2);

  if (!pBump && !dBump) return w;

  const next = {
    ...w,
    clocks: {
      ...w.clocks,
      pressure: clampInt(w.clocks.pressure + pBump, 0, 12),
      dread: clampInt(w.clocks.dread + dBump, 0, 12)
    }
  };

  return pushTickLog(next, `[TICK] gear signals echo (noise:${noise}, light:${light}${pBump ? ` → pressure+${pBump}` : ''}${dBump ? ` → dread+${dBump}` : ''})`);
}

function tickEnv(w, severity) {
  const env = w.env && typeof w.env === 'object' ? w.env : { noise: 0, heat: 0, scent: 0, light: 0 };
  const noise = clampInt(env.noise ?? 0, 0, 6);
  const heat = clampInt(env.heat ?? 0, 0, 6);
  const scent = clampInt(env.scent ?? 0, 0, 6);
  const light = clampInt(env.light ?? 0, 0, 6);

  let pBump = 0;
  let dBump = 0;

  // Convert residue into escalation.
  if (noise >= 4) pBump += Math.max(1, Math.round(1 * severity));
  if (heat >= 5) pBump += 1;
  if (scent >= 5) pBump += 1;

  // Low light + high dread = paranoia spiral.
  if (light <= 1 && (w.clocks.dread ?? 0) >= 6) dBump += 1;

  pBump = clampInt(pBump, 0, 3);
  dBump = clampInt(dBump, 0, 2);

  // Decay every tick (the world doesn't remember everything forever).
  const decay = severity >= 1.2 ? 1 : 2; // harsher fate retains residue longer
  const nextEnv = {
    noise: clampInt(noise - decay, 0, 6),
    heat: clampInt(heat - decay, 0, 6),
    scent: clampInt(scent - decay, 0, 6),
    light: clampInt(light - 1, 0, 6)
  };

  const changed = (nextEnv.noise !== noise) || (nextEnv.heat !== heat) || (nextEnv.scent !== scent) || (nextEnv.light !== light);
  const bumps = pBump || dBump;
  if (!changed && !bumps) return w;

  const next = {
    ...w,
    env: nextEnv,
    clocks: {
      ...w.clocks,
      pressure: clampInt((w.clocks.pressure ?? 0) + pBump, 0, 12),
      dread: clampInt((w.clocks.dread ?? 0) + dBump, 0, 12)
    }
  };

  const note = `[TICK] env consumes/decays (noise:${noise} heat:${heat} scent:${scent} light:${light}${pBump ? ` → pressure+${pBump}` : ''}${dBump ? ` → dread+${dBump}` : ''})`;
  return pushTickLog(next, note);
}

function tickQuestions(w, rng) {
  const questions = Array.isArray(w.ledger?.questions) ? w.ledger.questions : [];
  if (!questions.length) return w;

  // Age by transforming exactly one question occasionally.
  if (rng.nextFloat() >= 0.35) return w;

  const i = rng.int(0, questions.length - 1);
  const q = String(questions[i] || '').trim();
  if (!q) return w;

  const transformed = q.endsWith('?') ? q.replace(/\?+$/, '?') : `${q}?`;
  const nextQs = questions.slice();
  nextQs[i] = transformed;
  const w2 = { ...w, ledger: { ...w.ledger, questions: nextQs } };
  return pushTickLog(w2, `[TICK] a question sharpens: "${truncate(transformed, 48)}"`);
}

function tickEcology(w, severity) {
  const inst = ensureInstrumentLayer(w.instrument);
  const e = w.ecology || { corruption: 0, instability: 0, scarcity: 0 };
  const open = inst.threads.filter(t => t.status !== 'resolved');
  const tensionSum = open.reduce((s, t) => s + (t.tension ?? 0), 0);

  const corruptionBump = Math.round((tensionSum > 0 ? 1 + tensionSum * 0.15 : 0) * severity);
  const scarcityBump = Math.round((w.clocks.pressure >= 8 ? 1 : 0) * severity);
  const instabilityBump = Math.round(((w.clocks.revelation >= 8 ? 1 : 0) + (w.clocks.dread >= 8 ? 1 : 0)) * severity);

  const next = {
    corruption: clampInt(e.corruption + corruptionBump, 0, 100),
    scarcity: clampInt(e.scarcity + scarcityBump, 0, 100),
    instability: clampInt(e.instability + instabilityBump, 0, 100)
  };

  let w2 = { ...w, ecology: next };
  if (corruptionBump + scarcityBump + instabilityBump > 0) {
    w2 = pushTickLog(w2, `[TICK] ecology drifts (corruption+${corruptionBump}, scarcity+${scarcityBump}, instability+${instabilityBump})`);
  }
  return w2;
}

function applyIrreversibleThresholds(w) {
  let w2 = w;

  if (w2.ecology.corruption > 70) {
    w2 = ensureScar(w2, 'corruption_shift', 'Corruption breached 70: the world permanently darkens.', 'corruption>70');
  }
  const maxHostility = (Array.isArray(w2.factions) ? w2.factions.reduce((m, f) => Math.max(m, f.hostility ?? 0), 0) : 0);
  if (maxHostility > 80) {
    w2 = ensureScar(w2, 'war_state', 'Hostility breached 80: factions enter open conflict.', 'hostility>80');
  }
  if (w2.ecology.scarcity > 75) {
    w2 = ensureScar(w2, 'famine_arc', 'Scarcity breached 75: famine arc unlocked.', 'scarcity>75');
  }

  return w2;
}

function tickReputation(w, severity) {
  const rep = w.reputation || { factions: {} };
  const factions = Array.isArray(w.factions) ? w.factions : [];
  if (!factions.length) return w;

  // Reputation decays slightly under harsh fate; stabilizes under cooperative.
  const drift = severity > 1.2 ? -1 : severity < 1.0 ? 0 : -0;
  if (!drift) return w;

  const next = { ...rep, factions: { ...(rep.factions || {}) } };
  for (const f of factions) {
    const cur = clampInt(next.factions[f.id] ?? 0, -100, 100);
    next.factions[f.id] = clampInt(cur + drift, -100, 100);
  }
  return { ...w, reputation: next };
}

function tickMotifs(w, rng, severity) {
  const inst = ensureInstrumentLayer(w.instrument);
  const active = Array.isArray(inst.motifsCore?.active) ? inst.motifsCore.active : [];
  if (!active.length) return w;

  // Reinforce one motif occasionally, more often in blood mode.
  const p = severity >= 1.3 ? 0.55 : severity >= 1.1 ? 0.4 : 0.25;
  if (rng.nextFloat() >= p) return w;

  const m = active[rng.nextInt(active.length)];
  const w2 = reinforceMotif(w, m, 1);
  return pushTickLog(w2, `[TICK] motif lingers: ${m}`);
}

function pickFactionMove({ pressure, hostility, rng }) {
  if (hostility >= 80) return 'strike';
  if (pressure >= 70) return rng.pick(['seize', 'raid', 'blackmail']);
  if (pressure >= 40) return rng.pick(['recruit', 'scheme', 'negotiate']);
  return rng.pick(['observe', 'prepare', 'probe']);
}

function ensureScar(w, id, description, trigger = '') {
  const scars = Array.isArray(w.scars) ? w.scars : [];
  const sid = String(id || '').trim();
  if (!sid) return w;
  if (scars.some(s => s.id === sid)) return w;
  const desc = String(description || '');
  const scar = { id: sid, description: desc, permanent: true };
  let w2 = { ...w, scars: [...scars, scar] };
  // U17: Canonical scarFormed surface: stable event for replay/query/export durability.
  w2 = pushEvent(w2, { kind: 'scarFormed', data: { scarId: sid, description: desc, trigger: String(trigger || '') } });
  return pushTickLog(w2, `[TICK] scar formed: ${sid}`);
}
function pushTickLog(w, line) {
  const t = w.timeline.length;
  const e = { t, kind: 'worldTick', data: { text: String(line) } };
  return { ...w, timeline: [...w.timeline, e] };
}


function pushEvent(world, { kind, data }) {
  const t = world.timeline.length;
  const e = { t, kind: String(kind), data: data ?? {} };
  return { ...world, timeline: [...world.timeline, e] };
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function truncate(s, n) {
  const x = String(s);
  return x.length <= n ? x : x.slice(0, n - 1) + '…';
}
