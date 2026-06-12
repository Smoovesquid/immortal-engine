// The Adversary — P-74a, villain genesis + agenda state.
//
// One deterministic villain per world seed: a named intelligence drawn from
// the elite bestiary, seated at the far edge of the map, working a staged
// agenda. P-74b advances the agenda in worldTick and reacts to the player;
// P-74c binds the confrontation arc. This module is GENESIS + SHAPE only.
//
// Law: the narrator never names the villain before canon discovery
// (`discovered` flips only via real play). Rumor-first, like the gods.
// Pure + deterministic: rng seeded from world seed; no Math.random.

import { makeRng, seedFromString } from '../rng.js';
import { elite } from '../ruleset/core/bestiary/catalog/elite.js';

const VILLAIN_FIRST = [
  'Vess', 'Maren', 'Oszric', 'Calwen', 'Drostan', 'Ysolde', 'Hadric', 'Neva',
  'Corvas', 'Lirael', 'Mordwen', 'Sablest', 'Erron', 'Vashti', 'Grimmault', 'Tace'
];
const VILLAIN_EPITHET = [
  'the Hollow-Crowned', 'of the Last Door', 'the Quiet Famine', 'Thrice-Buried',
  'the Patient', 'of the Unlit Hall', 'the Debt-Keeper', 'Wormfriend',
  'the Smiling Winter', 'of the Ninth Bell', 'the Unforgiven', 'Cradle-Robber'
];

// Agenda stage templates. `label` is internal bookkeeping; `sign` is the
// county-visible symptom — the line rumors will garble (P-74b). {C} = the
// creature's kind, {SEAT} = the seat's name, {NAME} = the villain's name
// (rumors must NOT use {NAME} until discovery — they lean on signs).
const AGENDA_TEMPLATES = [
  { id: 'gather', label: 'Gather the instruments', sign: 'travelers near {SEAT} go missing a day at a time — and come back wrong by one small habit' },
  { id: 'fester', label: 'Let the ground sicken', sign: 'the land around {SEAT} has stopped keeping its seasons' },
  { id: 'recruit', label: 'Buy the weak, break the strong', sign: 'someone is paying desperate folk in old coin for errands no one will describe' },
  { id: 'silence', label: 'Close the mouths that know', sign: 'the people who asked questions about {SEAT} have stopped asking questions about anything' },
  { id: 'strike', label: 'Take the first town', sign: 'a settlement on the {SEAT} road is arming itself against something it will not name' },
  { id: 'crown', label: 'Make the county kneel', sign: 'they say the whole county will owe rent to a new landlord before the year turns' }
];

/** Normalize a villain block: null (not yet minted) or the full shape. */
export function ensureVillain(x) {
  if (!x || typeof x !== 'object') return null;
  const ref = String(x.ref ?? '');
  if (!ref) return null;
  const stagesIn = Array.isArray(x.agenda?.stages) ? x.agenda.stages : [];
  const stages = [];
  for (const s of stagesIn) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.id ?? '');
    if (!id) continue;
    stages.push({ id, label: String(s.label ?? id), sign: String(s.sign ?? '') });
  }
  if (!stages.length) return null;
  const stage = clampInt(x.agenda?.stage ?? 0, 0, stages.length - 1);
  const clock = clampInt(x.agenda?.clock ?? 0, 0, 999999);
  return {
    ref,
    name: String(x.name ?? 'the adversary'),
    epithet: String(x.epithet ?? ''),
    creature: String(x.creature ?? ''),
    cr: clampInt(x.cr ?? 8, 1, 30),
    seatNodeId: String(x.seatNodeId ?? ''),
    discovered: x.discovered === true,
    defeated: x.defeated === true,
    agenda: { stage, clock, stages }
  };
}

/**
 * villainGenesis(world) -> villain | null.
 * Deterministic from world seed + map. Needs a map with nodes; returns null
 * until the world has geography to be a villain IN.
 */
export function villainGenesis(world) {
  const w = world && typeof world === 'object' ? world : {};
  const seed = String(w.meta?.seed ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  if (!seed || !nodes.length) return null;

  const rng = makeRng(seedFromString(`${seed}|villain|genesis`));

  // The creature: an elite intelligence. Sorted copy so catalog order changes
  // don't silently re-cast existing-format worlds' villains.
  const pool = [...elite].sort((a, b) => String(a.ref).localeCompare(String(b.ref)));
  const def = pool[rng.int(0, pool.length - 1)];

  // The name it wears in stories (never spoken by the narrator pre-discovery).
  const name = VILLAIN_FIRST[rng.int(0, VILLAIN_FIRST.length - 1)];
  const epithet = VILLAIN_EPITHET[rng.int(0, VILLAIN_EPITHET.length - 1)];

  // The seat: the farthest dungeon from home — else the farthest node.
  const homeId = String(w.meta?.homeNodeId || w.map?.currentNodeId || nodes[0].id);
  const home = nodes.find(n => n.id === homeId) || nodes[0];
  const dist = (n) => Math.abs((n.x || 0) - (home.x || 0)) + Math.abs((n.y || 0) - (home.y || 0));
  const dungeons = nodes.filter(n => /dungeon/i.test(String(n.nodeType || '')));
  const seatPool = (dungeons.length ? dungeons : nodes.filter(n => n.id !== homeId));
  const seat = [...seatPool].sort((a, b) => dist(b) - dist(a) || String(a.id).localeCompare(String(b.id)))[0] || home;
  const seatName = String(seat.name || 'the far place');

  // The agenda: five of the six templates (one dropped per seed, for variety),
  // escalation order preserved, signs flavored to the seat.
  const dropIdx = rng.int(0, AGENDA_TEMPLATES.length - 1);
  const stages = AGENDA_TEMPLATES
    .filter((_, i) => i !== dropIdx)
    .slice(0, 5)
    .map(t => ({ id: t.id, label: t.label, sign: t.sign.replace(/\{SEAT\}/g, seatName).replace(/\{C\}/g, String(def.name)) }));

  return ensureVillain({
    ref: `villain:${def.ref}`,
    name,
    epithet,
    creature: String(def.name),
    cr: def.cr,
    seatNodeId: String(seat.id),
    discovered: false,
    defeated: false,
    agenda: { stage: 0, clock: 0, stages }
  });
}

/** mintVillain(world) -> world with a villain, if it has none and a map exists. */
export function mintVillain(world) {
  const w = world && typeof world === 'object' ? world : {};
  if (w.villain) return w;
  const v = villainGenesis(w);
  return v ? { ...w, villain: v } : w;
}

function clampInt(n, lo, hi) {
  const v = Number.isFinite(+n) ? Math.trunc(+n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
