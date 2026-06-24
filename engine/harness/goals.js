// ─────────────────────────────────────────────────────────────────────────────
// engine/harness/goals.js — typed goals for the Human Playtest Harness (Phase 1).
//
// A goal is a TYPED object, not a vibe (HARNESS_USAGE_STRATEGY §"typed goal"):
//   { id, description, satisfied(world)->bool, progressMetric(world)->number }
//
// `progressMetric` is the soft-lock oracle's fuel: monotone-ish toward the goal,
// so "no progress in N turns" is a dead-progress signal. Higher = closer.
//
// HARD INVARIANT (narration ≠ canon): this module is READ-ONLY over the world. It
// inspects committed state; it never mutates, never rolls, never touches the RNG.
// ─────────────────────────────────────────────────────────────────────────────

import { npcWant } from '../npc/npcArc.js';

// ── Read-only world probes (shared by goals + the runner) ─────────────────────

// The player is inside a structure iff scene.interior is a live object (the engine
// clears it to null on exit — verified on the `tallow` start state).
export function isInsideInterior(world) {
  return Boolean(world?.scene?.interior && typeof world.scene.interior === 'object');
}

export function currentNode(world) {
  const id = world?.map?.currentNodeId;
  if (!id) return null;
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  return nodes.find(n => n && n.id === id) || null;
}

// Present, sociable NPCs who carry a forward-looking want (placeQuery's concern
// source: npcWant(...).surface). A hostile lurker is never a concern-bearer — the
// same sight-scoping placeQuery.resolveConcern uses.
export function presentConcernNpcs(world) {
  const node = currentNode(world);
  const seed = String(world?.meta?.seed || '');
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  return npcs.filter(n => n && !n.hostile && npcWant(n, seed)?.surface);
}

export function dialogueNpcId(world) {
  return world?.scene?.dialogue?.npcId || null;
}

// The furniture sockets at the player's current node — "what's in the room" per
// canon (the same source llmPhysics.detectPhysicalInteraction reads). Persisted on
// the node, so it's the present set whether the player is in the interior or out.
// Shared by the object-interaction oracle and the probe-room goal.
export function presentRoomObjects(world) {
  const map = world?.map || {};
  const node = (Array.isArray(map.nodes) ? map.nodes : []).find(n => n && n.id === map.currentNodeId) || null;
  const furn = Array.isArray(node?.furniture) ? node.furniture : [];
  return furn.filter(Boolean)
    .map(f => ({ name: String(f.name || ''), parts: (Array.isArray(f.parts) ? f.parts : []).map(String) }))
    .filter(o => o.name);
}

// The head noun of an object name ("iron-bound chest" → "chest") — the unit both
// the engine's detector and the player's natural phrasing key on.
export function headNoun(name) {
  return String(name || '').toLowerCase().trim().split(/\s+/).pop()?.replace(/[^a-z0-9-]/g, '') || '';
}

// Verbs that COUNT as probing an object (non-destructive examine is the canonical
// one, but any hands-on interaction exercises the path).
const PROBE_VERB_RE = /\b(?:examine|inspect|study|scrutiniz|appraise|look\s+(?:at|over|inside|into)|peer\s+at|read|search|check|rummage|rifle|take|takes|grab|pick\s+up|open|touch|feel|test|poke|prod|tap|lift)\b/i;

// Did the player aim a probe verb at THIS object somewhere in the action log?
function actionsProbed(actions, obj) {
  const head = headNoun(obj.name);
  const name = String(obj.name).toLowerCase();
  return actions.some(a => {
    const t = String(a || '').toLowerCase();
    if (!PROBE_VERB_RE.test(t)) return false;
    if (name && t.includes(name)) return true;
    if (head.length >= 3 && new RegExp(`\\b${head}\\b`).test(t)) return true;
    return obj.parts.some(p => { const pl = String(p).toLowerCase(); return pl.length >= 3 && t.includes(pl); });
  });
}

// Coverage of the room's objects given the action history. `universe` = the objects
// present now; `probed` = those the player has interacted with. Probing is meant to
// be EXAMINE (non-destructive), which keeps the denominator stable as it climbs —
// taking an object removes it from the room (the oracle certifies takes; the goal
// just drives the player onto every socket). Pure over (world, actionsLog).
export function probeCoverage(world, ctx) {
  const present = presentRoomObjects(world);
  const actions = Array.isArray(ctx?.actionsLog) ? ctx.actionsLog : [];
  const seen = new Set();
  const universe = [];
  for (const o of present) { const k = headNoun(o.name); if (!seen.has(k)) { seen.add(k); universe.push(o); } }
  const probed = universe.filter(o => actionsProbed(actions, o));
  return { universe, probed, fraction: universe.length ? probed.length / universe.length : 1 };
}

// All present, non-hostile NPCs at the node — the "townsfolk" you can meet (a
// superset of presentConcernNpcs: an innkeeper with no forward-looking want is
// still someone to talk to). A hostile lurker is not a townsperson to befriend.
export function presentTownsfolk(world) {
  const node = currentNode(world);
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  return npcs.filter(n => n && !n.hostile && (n.name || n.id));
}

// Stopwords that must NOT count as a name/role hit (so "the Lingerer" doesn't match
// every action containing "the").
const NAME_STOPWORDS = new Set(['the', 'and', 'who', 'has', 'for', 'too', 'one', 'now', 'asking', 'questions', 'stayed', 'long', 'wanderer', 'someone', 'people']);

// The address-tokens for an NPC: the ≥3-char words of their name plus the head noun
// of their role ("innkeeper", "guard"), minus stopwords. A talk action naming any of
// these counts as engaging that person — mirrors how probeCoverage keys on an object.
function npcAddressTokens(npc) {
  const toks = new Set();
  for (const w of String(npc?.name || '').toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 3 && !NAME_STOPWORDS.has(w)) toks.add(w);
  }
  const roleHead = headNoun(npc?.role || '');
  if (roleHead.length >= 3 && !NAME_STOPWORDS.has(roleHead)) toks.add(roleHead);
  return [...toks];
}

// Verbs that COUNT as engaging a person (talk/greet/ask are the canonical ones; an
// approach is the table-level "I walk up to them" that opens the exchange).
const TALK_VERB_RE = /\b(?:talk|speak|ask|asks|greet|hail|address|chat|converse|say|tell|question|approach|approaches|introduce|call out to|go up to|walk up to|meet)\b/i;

// Distinct townsfolk the player has engaged, inferred from the action log (history-
// aware, like probeCoverage) AND the live dialogue frame (whoever you're mid-exchange
// with right now). Pure over (world, ctx).
export function townsfolkEngaged(world, ctx) {
  const folk = presentTownsfolk(world);
  const actions = Array.isArray(ctx?.actionsLog) ? ctx.actionsLog : [];
  const liveId = dialogueNpcId(world);
  let count = 0;
  for (const npc of folk) {
    if (liveId && String(npc.id) === String(liveId)) { count++; continue; }
    const toks = npcAddressTokens(npc);
    const hit = actions.some(a => {
      const t = String(a || '').toLowerCase();
      if (!TALK_VERB_RE.test(t)) return false;
      return toks.some(tok => new RegExp(`\\b${tok}\\b`).test(t));
    });
    if (hit) count++;
  }
  return count;
}

// "Reached" a concern-bearer = you are in dialogue with one (scene.dialogue.npcId
// points at a present non-hostile NPC who has a want). Engaging them is the
// observable a human would call "I reached the person with a problem" — NOT
// successfully extracting the concern, which depends on a trust roll and would
// make the goal hostage to the dice.
function inDialogueWithConcernNpc(world) {
  const id = dialogueNpcId(world);
  if (!id) return false;
  return presentConcernNpcs(world).some(n => String(n.id) === String(id));
}

// ── Goal #1 — the funnel beat ─────────────────────────────────────────────────
// Every player traverses the first building; its walls block EVERYONE, so this is
// the max-blast-radius beat to certify first (HARNESS_USAGE_STRATEGY §"the dream").
export const GOAL_FIRST_CONCERN = {
  id: 'reach-first-concern',
  description: 'Leave the first building and reach the first NPC who has a concern.',
  satisfied(world) {
    return !isInsideInterior(world) && inDialogueWithConcernNpc(world);
  },
  // 0 = inside the building · 1 = outside, not yet engaged · 2 = in front of a
  // concern-bearer (goal). The soft-lock oracle watches the running max of this.
  progressMetric(world) {
    if (!isInsideInterior(world) && inDialogueWithConcernNpc(world)) return 2;
    if (!isInsideInterior(world)) return 1;
    return 0;
  },
};

// ── Goal #2 — probe every object in the room ──────────────────────────────────
// A COVERAGE goal: drive the player onto every furniture socket so the object-
// interaction oracle certifies the look/search/take/examine path on each. Its
// progress is the fraction of present objects probed (history-aware: the runner
// passes { actionsLog }), so the soft-lock oracle still trips if the player can't
// reach them. satisfied = every present object probed (an empty room is vacuously
// done). Backward-compatible: goals that ignore the 2nd arg are unaffected.
export const GOAL_PROBE_ROOM = {
  id: 'probe-room',
  description: 'Examine (or otherwise interact with) every object present in the room.',
  satisfied(world, ctx) {
    const { universe, probed } = probeCoverage(world, ctx);
    return universe.length === 0 || probed.length >= universe.length; // empty room = vacuously done
  },
  progressMetric(world, ctx) {
    return probeCoverage(world, ctx).fraction;
  },
};

// ── Goal #3 — tour the whole building ─────────────────────────────────────────
// A COVERAGE goal over a STRUCTURE'S ROOMS (vs. probe-room's objects): drive the
// player to set foot in every room of the building they wake in, so the harness
// exercises room-to-room movement and each room's look/contents — the "work through
// the entire building" beat. Progress = fraction of the structure's rooms visited
// (scene.interior.visited, maintained by moveWithinInterior). satisfied = every
// room visited. If the player wanders OUT before finishing, the current frame reads
// 0 (no interior to read visited from) but the runner's bestProgress latch preserves
// the max coverage reached, so the soft-lock oracle still trips on a half-toured
// building the player couldn't get back into. Read-only, like every goal here.

// The room ids of the structure the player is currently inside (null if outside).
function structureRoomIds(world) {
  const interior = world?.scene?.interior;
  if (!interior || typeof interior !== 'object') return null;
  const st = world?.structures?.byId?.[String(interior.structureKey || '')];
  const rooms = Array.isArray(st?.topology?.rooms) ? st.topology.rooms : [];
  return rooms.length ? rooms.map(r => String(r.id)) : null;
}

// { visited, total } rooms for the current structure — visited scoped to rooms that
// actually belong to this structure (a stale id can't inflate coverage past 100%).
export function buildingCoverage(world) {
  const rooms = structureRoomIds(world);
  if (!rooms) return { visited: 0, total: 0 };
  const inStruct = new Set(rooms);
  const visited = Array.isArray(world?.scene?.interior?.visited) ? world.scene.interior.visited.map(String) : [];
  const seen = new Set(visited.filter(id => inStruct.has(id)));
  return { visited: seen.size, total: rooms.length };
}

// "Work through the building" = both AXES: set foot in every room AND examine what's
// in them. Room-coverage alone completes too cheaply on a small house (the boot already
// counts the entry + the room you wake in, so one step finishes it) and never exercises
// the look/examine path per room — which is exactly where coherence bugs surface (e.g.
// the same chest described in every room). Fusing room-coverage with object-probing
// (the probe-room metric) keeps the player genuinely touring AND handling the contents.
export const GOAL_TOUR_BUILDING = {
  id: 'tour-building',
  description: 'Explore the whole building you woke in — go into every room and look at what is in each.',
  satisfied(world, ctx) {
    const { visited, total } = buildingCoverage(world);
    const roomsDone = total > 0 && visited >= total;
    const obj = probeCoverage(world, ctx);
    const objDone = obj.universe.length === 0 || obj.probed.length >= obj.universe.length;
    return roomsDone && objDone;
  },
  progressMetric(world, ctx) {
    const { visited, total } = buildingCoverage(world);
    const roomFrac = total > 0 ? visited / total : 1;
    const objFrac = probeCoverage(world, ctx).fraction;
    return 0.5 * roomFrac + 0.5 * objFrac;
  },
};

// ── Goal #4 — explore the surrounding town ────────────────────────────────────
// The building-scoped goals certify the room you wake in; this one pushes the player
// OUT into the settlement to exercise the town surface — finding the way outdoors,
// the other townsfolk, and the roads. It scores on MEETING THE TOWNSFOLK (engaging
// ≥2 distinct present non-hostile NPCs): the most reachable, latchable town signal,
// and the one that drives the dialogue / NPC-presence / movement paths where the
// settlement-layer coherence bugs live. The description is deliberately broad so the
// LLM player also wanders the streets and roads (surfacing the spatial breaks), but
// the metric stays on the achievable core so the soft-lock oracle reads true progress.
//
// satisfied = met ≥2 townsfolk (regardless of where you're standing now — meeting
// people is the achievement; you can only do it outdoors anyway). progress blends
// "got outside" with the fraction of the 2-person quota met, so it climbs as the
// player leaves the building and works the room.
export const GOAL_EXPLORE_TOWN = {
  id: 'explore-town',
  description: 'Leave the building and explore the surrounding town — get outside, meet the townsfolk, and see what the settlement holds.',
  satisfied(world, ctx) {
    return townsfolkEngaged(world, ctx) >= 2;
  },
  progressMetric(world, ctx) {
    const out = isInsideInterior(world) ? 0 : 1;
    const engaged = Math.min(townsfolkEngaged(world, ctx), 2) / 2;
    return 0.4 * out + 0.6 * engaged;
  },
};

export const GOALS = Object.freeze({
  [GOAL_FIRST_CONCERN.id]: GOAL_FIRST_CONCERN,
  [GOAL_PROBE_ROOM.id]: GOAL_PROBE_ROOM,
  [GOAL_TOUR_BUILDING.id]: GOAL_TOUR_BUILDING,
  [GOAL_EXPLORE_TOWN.id]: GOAL_EXPLORE_TOWN,
});

export function getGoal(id) {
  return GOALS[id] || GOAL_FIRST_CONCERN;
}
