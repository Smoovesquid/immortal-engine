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

export const GOALS = Object.freeze({
  [GOAL_FIRST_CONCERN.id]: GOAL_FIRST_CONCERN,
});

export function getGoal(id) {
  return GOALS[id] || GOAL_FIRST_CONCERN;
}
