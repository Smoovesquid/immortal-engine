/**
 * Goal Contract — verifiable objectives.
 *
 * Pure functions. No side effects, no API calls, no time/Math.random.
 *
 * Goal shape:
 *   { id, kind, targetRef, label, status, createdAt, completedAt }
 *
 * kind ∈ 'reach' | 'obtain' | 'talkTo' | 'learn' | 'defeat'
 * status ∈ 'active' | 'completed' | 'failed'
 *
 * Completion semantics:
 *   reach(nodeId)    — world.map.currentNodeId === targetRef
 *   obtain(itemId)   — itemId appears in party[0].inventory.*
 *   talkTo(npcId)    — settlement NPC with that id has metPlayer === true
 *   learn(factText)  — fact text appears in world.ledger.facts
 *   defeat(entityId) — timeline 'resolution' event with data.targetDefeated === entityId
 */

import { ensureWorld } from '../state.js';
import { hasFact } from '../ledgerUtils.js';

const VALID_KINDS = new Set(['reach', 'obtain', 'talkTo', 'learn', 'defeat']);

/**
 * createGoal(world, { kind, targetRef, label }) -> { world, goal }
 *
 * Returns the new world (with goal appended) and the created goal record.
 * If the goal cannot be created (invalid input or cap reached), returns
 * { world, goal: null }.
 */
export function createGoal(world, spec = {}) {
  const w = ensureWorld(world);
  const kind = String(spec.kind ?? '').trim();
  const targetRef = String(spec.targetRef ?? '').trim();
  const label = String(spec.label ?? '').trim();

  if (!VALID_KINDS.has(kind)) return { world: w, goal: null };
  if (!targetRef) return { world: w, goal: null };
  if (w.goals.length >= 12) return { world: w, goal: null };

  const id = nextGoalId(w.goals);
  const goal = {
    id,
    kind,
    targetRef,
    label,
    status: 'active',
    createdAt: Array.isArray(w.timeline) ? w.timeline.length : 0,
    completedAt: null
  };

  return {
    world: { ...w, goals: [...w.goals, goal] },
    goal
  };
}

/**
 * checkGoals(world) -> { world, completed }
 *
 * Walks active goals and promotes any whose completion predicate is true.
 * Idempotent: re-running on a world with no newly satisfied goals returns
 * the same world reference for `world` and an empty `completed` array.
 *
 * `completed` is an array of the goals that were just promoted (post-update),
 * for callers (playloop) that want to push timeline events.
 */
export function checkGoals(world) {
  const w = ensureWorld(world);
  const goals = Array.isArray(w.goals) ? w.goals : [];
  if (goals.length === 0) return { world: w, completed: [] };

  let changed = false;
  const completed = [];
  const t = Array.isArray(w.timeline) ? w.timeline.length : 0;

  const next = goals.map(g => {
    if (g.status !== 'active') return g;
    if (!isGoalSatisfied(w, g)) return g;
    const promoted = { ...g, status: 'completed', completedAt: t };
    changed = true;
    completed.push(promoted);
    return promoted;
  });

  if (!changed) return { world: w, completed: [] };
  return { world: { ...w, goals: next }, completed };
}

/**
 * activeGoals(world) -> Goal[]
 */
export function activeGoals(world) {
  const w = ensureWorld(world);
  return (w.goals || []).filter(g => g.status === 'active');
}

/**
 * completedGoals(world) -> Goal[]
 */
export function completedGoals(world) {
  const w = ensureWorld(world);
  return (w.goals || []).filter(g => g.status === 'completed');
}

// ── internals ──────────────────────────────────────────────────────────────

function nextGoalId(goals) {
  // Stable monotonic id: goal_0, goal_1, … based on the highest existing index.
  let max = -1;
  for (const g of goals) {
    const m = String(g?.id ?? '').match(/^goal_(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `goal_${max + 1}`;
}

function isGoalSatisfied(w, g) {
  switch (g.kind) {
    case 'reach':
      return String(w.map?.currentNodeId ?? '') === String(g.targetRef);
    case 'obtain':
      return partyHasItem(w, g.targetRef);
    case 'talkTo':
      return settlementNpcMet(w, g.targetRef);
    case 'learn':
      return hasFact(w, g.targetRef);
    case 'defeat':
      return timelineRecordsDefeat(w, g.targetRef);
    default:
      return false;
  }
}

function partyHasItem(w, itemId) {
  const party = Array.isArray(w.party) ? w.party : [];
  const pc = party[0];
  const inv = pc?.inventory;
  if (!inv || typeof inv !== 'object') return false;
  const ref = String(itemId);
  for (const list of Object.values(inv)) {
    if (!Array.isArray(list)) continue;
    for (const it of list) {
      const id = String(it?.id ?? it?.name ?? it ?? '');
      if (id && id === ref) return true;
    }
  }
  return false;
}

function settlementNpcMet(w, npcId) {
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const ref = String(npcId);
  for (const n of nodes) {
    const npcs = n?.settlement?.npcs;
    if (!Array.isArray(npcs)) continue;
    for (const npc of npcs) {
      const id = String(npc?.id ?? npc?.name ?? '');
      if (id !== ref) continue;
      if (npc?.conversationState?.metPlayer === true) return true;
    }
  }
  return false;
}

function timelineRecordsDefeat(w, entityId) {
  const tl = Array.isArray(w.timeline) ? w.timeline : [];
  const ref = String(entityId);
  for (let i = tl.length - 1; i >= 0; i--) {
    const e = tl[i];
    if (e?.kind === 'resolution' && String(e?.data?.targetDefeated ?? '') === ref) {
      return true;
    }
  }
  return false;
}
