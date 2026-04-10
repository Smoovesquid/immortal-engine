import { makeRng, seedFromString } from './rng.js';
import { fateBand } from './rulesets.js';
import { ensureInstrumentLayer } from './instrument.js';

// Narrative Instrument — Scene Director (V2)
// generateSceneFrame(world) -> { location, objective, emotionalTone, beatType, callbackMotif?, callbackThread?, callbackConsequence? }
// Deterministic; seed-based; no DOM.

export function generateSceneFrame(world, pack = {}) {
  const w = world;
  const inst = ensureInstrumentLayer(w.instrument);
  const band = fateBand(w.meta.fate);

  const sceneIndex = countScenes(w);
  const seed = seedFromString(`${w.meta.seed}|sceneFrame|${w.scene.promptSeed}|${sceneIndex}|${inst.inevitability}`);
  const rng = makeRng(seed);

  const { location, objective } = nextLocationObjective(w, pack, sceneIndex);

  const beatType = chooseBeatType({ w, inst, band, sceneIndex, rng });
  const emotionalTone = chooseEmotionalTone({ w, band, beatType, rng });

  const cb = chooseCallback({ w, inst, pack, beatType, rng });

  const lt = chooseLivingThread(w);
  const scarTag = chooseScarTag(w);

  return {
    location,
    objective: lt?.objective || objective,
    emotionalTone,
    beatType,
    ...cb,
    living: {
      threadId: lt?.id || '',
      factionId: lt?.factionId || '',
      scarTag
    }
  };
}

// Back-compat: playloop uses planNextScene.
export function planNextScene(world, pack, { lastResolutionKind = 'turn' } = {}) {
  const w = world;
  const inst = ensureInstrumentLayer(w.instrument);
  const frame = generateSceneFrame(w, pack);

  const seed = seedFromString(`${w.meta.seed}|scenePlan|${w.scene.promptSeed}|${w.timeline.length}|${lastResolutionKind}`);
  const rng = makeRng(seed);

  const carry = chooseCarryForward(w, rng, frame);
  const lt = chooseLivingThread(w);
  const tagsBase = deriveTags(w, carry, fateBand(w.meta.fate), frame);
  const nodeScarTags = currentNodeScarTags(w);
  const tags = dedupe([
    ...tagsBase,
    ...(lt ? ['living-thread'] : []),
    ...(frame?.living?.scarTag ? [`scar:${frame.living.scarTag}`] : []),
    ...nodeScarTags,
    ...(w.ecology?.corruption > 70 ? ['blight'] : []),
    ...(maxHostility(w) > 80 ? ['war'] : []),
    ...(w.ecology?.scarcity > 75 ? ['famine'] : [])
  ]).slice(0, 8);
  const thread = lt ? lt.objective : deriveThreadLabel(w, carry, pack, fateBand(w.meta.fate), rng, frame, inst);

  // Escalation probability increases with inevitability.
  const advanceClock = shouldAdvanceClock(fateBand(w.meta.fate), inst.inevitability, lastResolutionKind, rng, frame);

  const omen = pickIndexed(pack, 'omens', countScenes(w), rng);
  const price = pickIndexed(pack, 'prices', countScenes(w), rng);

  return {
    location: frame.location,
    objective: frame.objective,
    emotionalTone: frame.emotionalTone,
    beatType: frame.beatType,
    callbackMotif: frame.callbackMotif,
    callbackThread: frame.callbackThread,
    callbackConsequence: frame.callbackConsequence,
    carry,
    tags,
    thread,
    advanceClock,
    omen,
    price
  };
}

function currentNodeScarTags(world) {
  const map = world.map && typeof world.map === 'object' ? world.map : null;
  const here = map?.nodes?.find?.(n => n.id === map.currentNodeId);
  const scars = Array.isArray(here?.scars) ? here.scars.map(String).filter(Boolean) : [];
  // Keep tags small and consistent.
  return scars.slice(0, 2).map(s => `place-scar:${s}`);
}

function nextLocationObjective(world, pack, sceneIndex) {
  const curLoc = world.scene.location;

  // Living Terrain Engine v1: prefer map current node name.
  const map = world.map && typeof world.map === 'object' ? world.map : null;
  const here = map?.nodes?.find?.(n => n.id === map.currentNodeId);
  const locationFromMap = here?.name ? String(here.name) : '';

  const locations = Array.isArray(pack?.locations) && pack.locations.length ? pack.locations : (pack?.starterLocations || []);
  let location = locationFromMap || (locations.length ? locations[(sceneIndex + 1) % locations.length] : (curLoc || 'somewhere'));

  const objectives = Array.isArray(pack?.objectives) && pack.objectives.length ? pack.objectives : (pack?.starterObjectives || []);
  const objective = objectives.length ? objectives[(sceneIndex + 1) % objectives.length] : (world.scene.objective || 'press on');

  return { location, objective };
}

function chooseBeatType({ w, inst, band, sceneIndex, rng }) {
  // Conductor override (applies once, cleared by playloop on scene advance).
  const override = String(inst.nextBeatOverride || '').trim();
  if (override) {
    const allowed = ['reveal', 'confrontation', 'quiet', 'escalation'];
    if (allowed.includes(override)) {
      // Still respect "no 3 in a row".
      const last = Array.isArray(inst.lastBeats) ? inst.lastBeats : [];
      const a = last[0];
      const b = last[1];
      if (!(a && b && a === b && a === override)) return override;
    }
  }

  // Rhythm encouragement.
  const rhythm = ['quiet', 'escalation', 'reveal', 'confrontation'];

  // Force confrontation when any thread tension >= 4.
  const highThread = inst.threads.find(t => t.status !== 'resolved' && t.tension >= 4);
  let candidate = highThread ? 'confrontation' : rhythm[sceneIndex % rhythm.length];

  if (!highThread) {
    // Escalation probability increases with inevitability.
    const inev = inst.inevitability;
    const base = 0.12 + (inev / 24); // 0.12..0.62
    const fateBoost = band === 'blood' ? 0.12 : band === 'grim' ? 0.06 : 0.0;
    const pEsc = clamp01(base + fateBoost);

    if (rng.nextFloat() < pEsc) {
      candidate = (candidate === 'quiet') ? 'escalation' : candidate;
      if (inev >= 10 && candidate !== 'confrontation') candidate = 'escalation';
    }
  }

  // Beat memory: prevent repeating same beat 3x in a row.
  const last = Array.isArray(inst.lastBeats) ? inst.lastBeats : [];
  const a = last[0];
  const b = last[1];
  if (a && b && a === b && a === candidate) {
    // Deterministic next in rhythm.
    const idx = rhythm.indexOf(candidate);
    candidate = rhythm[(idx + 1) % rhythm.length];
  }

  return candidate;
}

function chooseEmotionalTone({ w, band, beatType, rng }) {
  const clocks = w.clocks || { pressure: 0, dread: 0, revelation: 0 };
  const darkness = clocks.dread + clocks.pressure + clocks.revelation;

  const base = band === 'cooperative'
    ? ['steadier', 'hopeful', 'curious']
    : band === 'grim'
    ? ['tense', 'careful', 'cold']
    : ['pitiless', 'brutal', 'black'];

  // Living world tone influence.
  const eco = w.ecology || { corruption: 0, instability: 0, scarcity: 0 };
  const ecoShade = eco.corruption > 70
    ? ['blighted', 'soured', 'ashen']
    : eco.scarcity > 75
    ? ['hungry', 'thin', 'brittle']
    : eco.instability > 70
    ? ['skittish', 'volatile', 'frayed']
    : [];

  const warShade = maxHostility(w) > 80 ? ['militarized', 'paranoid', 'hard'] : [];

  const beat = beatType === 'quiet'
    ? ['hushed', 'listening']
    : beatType === 'reveal'
    ? ['sharp', 'clarifying']
    : beatType === 'confrontation'
    ? ['violent', 'urgent']
    : ['rising', 'unstable'];

  const shade = darkness >= 10
    ? ['claustrophobic', 'hostile']
    : darkness >= 4
    ? ['shadowed', 'pressing']
    : [];

  if (ecoShade.length) return rng.pick(ecoShade) || ecoShade[0];
  if (warShade.length) return rng.pick(warShade) || warShade[0];

  const pool = [...base, ...beat, ...shade].filter(Boolean);
  return rng.pick(pool) || pool[0] || 'tense';
}

function chooseCallback({ w, inst, pack, beatType, rng }) {
  // Every new scene must reference either motif OR thread OR consequence.
  const openThreads = inst.threads.filter(t => t.status !== 'resolved');
  const reinforced = inst.motifsCore.reinforced || {};
  const activeMotifs = inst.motifsCore.active || [];

  // Thread tension >=4 forces confrontation beat already; also force callbackThread.
  const hot = openThreads.find(t => t.tension >= 4);
  if (hot) return { callbackThread: { id: hot.id, label: hot.label } };

  // Motif weighting: reinforced >=3 becomes more likely.
  const heavyMotifs = activeMotifs.filter(m => (reinforced[m] ?? 0) >= 3);

  // Consequence from timeline: last note text.
  const consequence = lastConsequence(w);

  // Selection weights.
  const picks = [];
  if (openThreads.length) {
    // Cannot ignore unresolved threads indefinitely.
    const t = (beatType === 'quiet') ? 0.4 : 0.55;
    picks.push({ kind: 'thread', weight: t });
  }
  if (activeMotifs.length) {
    const mW = heavyMotifs.length ? 0.55 : 0.35;
    picks.push({ kind: 'motif', weight: mW });
  }
  if (consequence) picks.push({ kind: 'consequence', weight: 0.25 });

  const kind = weightedPick(rng, picks) || (activeMotifs.length ? 'motif' : openThreads.length ? 'thread' : 'consequence');

  if (kind === 'thread' && openThreads.length) {
    // Prefer highest tension.
    const sorted = openThreads.slice().sort((a, b) => (b.tension - a.tension) || a.label.localeCompare(b.label));
    const t = sorted[0];
    return { callbackThread: { id: t.id, label: t.label } };
  }
  if (kind === 'motif' && activeMotifs.length) {
    const pool = heavyMotifs.length ? heavyMotifs : activeMotifs;
    const m = rng.pick(pool) || pool[0];
    return { callbackMotif: m };
  }
  if (consequence) return { callbackConsequence: consequence };

  // fallback
  if (activeMotifs.length) return { callbackMotif: activeMotifs[0] };
  if (openThreads.length) return { callbackThread: { id: openThreads[0].id, label: openThreads[0].label } };
  return { callbackConsequence: 'a consequence follows you' };
}

function chooseCarryForward(world, rng, frame) {
  const threats = Array.isArray(world.ledger?.threats) ? world.ledger.threats : [];
  const questions = Array.isArray(world.ledger?.questions) ? world.ledger.questions : [];

  const newestThreat = threats[0]?.text ? String(threats[0].text) : '';
  const newestQuestion = questions[0]?.text ? String(questions[0].text) : '';

  const options = [
    newestThreat ? { kind: 'threat', text: newestThreat } : null,
    newestQuestion ? { kind: 'question', text: newestQuestion } : null,
    frame?.callbackThread?.label ? { kind: 'question', text: `Thread: ${frame.callbackThread.label}` } : null,
    world.instrument?.question ? { kind: 'question', text: String(world.instrument.question) } : null
  ].filter(Boolean);

  return options.length ? (rng.pick(options) || options[0]) : { kind: 'question', text: 'What are you willing to risk next?' };
}

function deriveTags(world, carry, band, frame) {
  const base = [];
  if (band === 'cooperative') base.push('opportunity');
  if (band === 'grim') base.push('pressure');
  if (band === 'blood') base.push('consequence');

  base.push(String(frame.beatType));

  const c = String(carry?.text || '').toLowerCase();
  if (c.includes('blood') || c.includes('injury')) base.push('blood');
  if (c.includes('time') || c.includes('clock') || c.includes('pressure')) base.push('time');
  if (c.includes('truth') || c.includes('revelation')) base.push('truth');

  const prev = Array.isArray(world.scene?.tags) ? world.scene.tags : [];
  for (const t of prev.slice(0, 2)) base.push(String(t));

  return dedupe(base).slice(0, 6);
}

function deriveThreadLabel(world, carry, pack, band, rng, frame, inst) {
  const prior = String(world.scene?.thread || '').trim();
  if (prior) return prior;

  if (frame.callbackThread?.label) return frame.callbackThread.label;

  const prices = Array.isArray(pack?.prices) ? pack.prices : [];
  const price = prices.length ? (rng.pick(prices) || prices[0]) : (world.instrument?.cost || 'time, blood, trust');

  if (carry?.kind === 'threat') return `the threat demands ${price}`;
  if (band === 'blood') return `inevitability wants ${price}`;
  if (band === 'grim') return `progress costs ${price}`;
  // If inevitability is non-zero, name it.
  if ((inst.inevitability ?? 0) >= 6) return `the throughline tightens (${price})`;
  return `a chance opens, but it costs ${price}`;
}

function shouldAdvanceClock(band, inevitability, lastResolutionKind, rng, frame) {
  const roll = rng.int(1, 100);
  const inevBump = clampInt(Math.floor(inevitability / 3) * 5, 0, 20);
  const beatBump = frame.beatType === 'escalation' ? 10 : frame.beatType === 'confrontation' ? 15 : 0;
  const base = band === 'cooperative' ? 20 : band === 'grim' ? 35 : 55;
  return roll <= clampInt(base + inevBump + beatBump, 0, 90);
}

function lastConsequence(world) {
  const tl = Array.isArray(world.timeline) ? world.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const e = tl[i];
    const txt = e?.data?.text;
    if (typeof txt === 'string' && txt.trim()) return txt.trim();
  }
  return '';
}

function pickIndexed(pack, key, stepIndex, rng) {
  const arr = pack?.[key];
  if (!Array.isArray(arr) || !arr.length) return '';
  const idx = (Math.abs(stepIndex) % arr.length);
  return arr[idx] || rng.pick(arr);
}

function weightedPick(rng, items) {
  const list = Array.isArray(items) ? items.filter(x => x && x.weight > 0) : [];
  if (!list.length) return '';
  const total = list.reduce((s, x) => s + x.weight, 0);
  const r = rng.nextFloat() * total;
  let acc = 0;
  for (const it of list) {
    acc += it.weight;
    if (r <= acc) return it.kind;
  }
  return list[list.length - 1].kind;
}

function countScenes(world) {
  const tl = Array.isArray(world.timeline) ? world.timeline : [];
  return tl.reduce((n, e) => (e?.kind === 'begin' || e?.kind === 'scene') ? n + 1 : n, 0);
}

function dedupe(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr) {
    const s = String(x).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function chooseLivingThread(w) {
  const list = Array.isArray(w.threads) ? w.threads.filter(t => t.active) : [];
  if (!list.length) return null;
  return list.slice().sort((a, b) => (b.tension - a.tension) || a.objective.localeCompare(b.objective))[0];
}

function chooseScarTag(w) {
  const scars = Array.isArray(w.scars) ? w.scars : [];
  if (!scars.length) return '';
  // Prefer the newest.
  return scars[scars.length - 1].id;
}

function maxHostility(w) {
  const factions = Array.isArray(w.factions) ? w.factions : [];
  return factions.reduce((m, f) => Math.max(m, f.hostility ?? 0), 0);
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
