import { clampInt } from './util.js';
import { ensureWorld } from './state.js';
import { ensureInstrumentLayer } from './instrument.js';
import { seedFromString, makeRng } from './rng.js';
import { fateBand } from './rulesets.js';

// Narrative Instrument — Ending System (V2)

export function shouldTriggerEnding(world) {
  const w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);

  const inev = inst.inevitability ?? 0;
  const threshold = fateBand(w.meta.fate) === 'blood' ? 8 : fateBand(w.meta.fate) === 'grim' ? 9 : 10;

  const clocksMaxed = (w.clocks.pressure >= 12) || (w.clocks.dread >= 12) || (w.clocks.revelation >= 12);
  const majorResolved = inst.threads.some(t => t.status === 'resolved');

  return Boolean(inev >= threshold || majorResolved || clocksMaxed);
}

export function generateEnding(world) {
  const w = ensureWorld(world);
  const inst = ensureInstrumentLayer(w.instrument);
  const band = fateBand(w.meta.fate);

  const actor = (Array.isArray(w.party) && w.party.length) ? w.party[0] : {};
  const wounds = clampInt(actor.wounds ?? 0, 0, 6);
  const stress = clampInt(actor.stress ?? 0, 0, 6);

  const sceneIndex = w.time?.scene ?? 0;
  const seed = seedFromString(`${w.meta.seed}|endingV2|${w.scene.promptSeed}|i${inst.inevitability}|w${wounds}|s${stress}|sc${sceneIndex}|p${w.clocks.pressure}|d${w.clocks.dread}|r${w.clocks.revelation}`);
  const rng = makeRng(seed);

  const endingType = chooseEndingType({ band, inevitability: inst.inevitability, wounds, stress, rng });

  const finalMotif = pickFinalMotif(inst, rng);

  const resolvedThreads = inst.threads.filter(t => t.status === 'resolved').map(t => t.label).filter(Boolean).slice(0, 3);
  const unresolvedThreads = inst.threads.filter(t => t.status !== 'resolved').sort((a, b) => (b.tension - a.tension) || a.label.localeCompare(b.label)).map(t => t.label).filter(Boolean).slice(0, 3);

  const threadRef = (unresolvedThreads[0] || resolvedThreads[0] || 'an unanswered thread');
  const consequence = lastConsequence(w) || fallbackConsequence(w);

  const summaryLine = buildSummaryLine({ endingType, finalMotif, threadRef, consequence, band, wounds, stress, inevitability: inst.inevitability, rng });

  return {
    endingType,
    finalMotif,
    resolvedThreads,
    unresolvedThreads,
    summaryLine
  };
}

function chooseEndingType({ band, inevitability, wounds, stress, rng }) {
  const inev = clampInt(inevitability ?? 0, 0, 12);
  const harm = wounds + stress;

  const weights = [];
  // tragic grows with harm+inev
  weights.push({ t: 'tragic', w: (band === 'blood' ? 4 : 2) + Math.floor(inev / 3) + Math.floor(harm / 3) });
  // bitter in grim/blood
  weights.push({ t: 'bitter', w: (band === 'cooperative' ? 1 : 3) + Math.floor(inev / 4) });
  // triumphant only when low harm and lower inevitability
  weights.push({ t: 'triumphant', w: (band === 'cooperative' ? 4 : 1) + (harm <= 1 ? 2 : 0) + (inev <= 5 ? 1 : 0) });
  // hollow when high inevitability but not max harm
  weights.push({ t: 'hollow', w: 2 + Math.floor(inev / 3) + (harm >= 3 ? 1 : 0) });
  // cyclical when unresolved threads remain
  weights.push({ t: 'cyclical', w: 2 + (inev >= 8 ? 2 : 0) });

  return weightedPick(rng, weights) || 'hollow';
}

function pickFinalMotif(inst, rng) {
  const active = Array.isArray(inst.motifsCore?.active) ? inst.motifsCore.active : [];
  const reinforced = inst.motifsCore?.reinforced || {};

  const sorted = active.slice().sort((a, b) => (toInt(reinforced[b]) - toInt(reinforced[a])) || a.localeCompare(b));
  if (sorted.length) return sorted[0];

  // fallback to legacy motif/omen
  return String(inst.motif || inst.omen || 'a low hum threads through the walls');
}

function buildSummaryLine({ endingType, finalMotif, threadRef, consequence, band, wounds, stress, inevitability, rng }) {
  const inev = clampInt(inevitability ?? 0, 0, 12);
  const pain = wounds + stress;

  const flavor = endingType === 'triumphant'
    ? ['earned and clean', 'bright, but not free', 'hard-won and real']
    : endingType === 'tragic'
    ? ['inevitable and cruel', 'pitilessly consistent', 'a consequence you can name']
    : endingType === 'bitter'
    ? ['sharp with trade-offs', 'true, and unpleasant', 'paid-for']
    : endingType === 'cyclical'
    ? ['like a loop closing', 'as if it was always coming back', 'with a door left ajar']
    : ['quietly damning', 'hollow in the chest', 'uncomfortably coherent'];

  const f = rng.pick(flavor) || flavor[0];
  const bandWord = band === 'cooperative' ? 'mercy' : band === 'grim' ? 'pressure' : 'blood';

  // Must reference motif + thread + consequence.
  return `Wizard: Ending (${endingType})—${f}; motif: ${finalMotif}; thread: ${threadRef}; consequence: ${consequence}; inevitability:${inev}/12, wounds:${pain}, and ${bandWord} sets the tone.`;
}

function lastConsequence(w) {
  const tl = Array.isArray(w.timeline) ? w.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const e = tl[i];
    const txt = e?.data?.text;
    if (typeof txt === 'string' && txt.trim()) return txt.trim();
  }
  return '';
}

function fallbackConsequence(w) {
  if (w.clocks.dread >= 12) return 'dread swallowed the margins';
  if (w.clocks.pressure >= 12) return 'time ran out';
  if (w.clocks.revelation >= 12) return 'the truth arrived too late';
  return 'the cost landed';
}

function weightedPick(rng, items) {
  const list = (items || []).filter(x => x && x.w > 0);
  const total = list.reduce((s, x) => s + x.w, 0);
  const r = rng.nextFloat() * total;
  let acc = 0;
  for (const it of list) {
    acc += it.w;
    if (r <= acc) return it.t;
  }
  return list[list.length - 1]?.t;
}

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : 0;
}
