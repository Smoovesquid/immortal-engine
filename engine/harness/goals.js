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

export const GOALS = Object.freeze({
  [GOAL_FIRST_CONCERN.id]: GOAL_FIRST_CONCERN,
  [GOAL_PROBE_ROOM.id]: GOAL_PROBE_ROOM,
});

export function getGoal(id) {
  return GOALS[id] || GOAL_FIRST_CONCERN;
}
