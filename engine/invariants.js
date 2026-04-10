import { WORLD_VERSION } from './state.js';

export function assertWorldInvariants(world) {
  if (!world || typeof world !== 'object') {
    throw new Error('Invariant: world must be object');
  }

  if (world.meta?.version !== WORLD_VERSION) {
    throw new Error('Invariant: world version mismatch');
  }

  const clocks = world.clocks || {};
  for (const k of ['dread', 'pressure', 'revelation']) {
    const v = clocks[k];
    if (!Number.isInteger(v) || v < 0 || v > 12) {
      throw new Error(`Invariant: invalid clock ${k}`);
    }
  }

  // Goals
  const goals = world.goals;
  if (!Array.isArray(goals)) {
    throw new Error('Invariant: goals must be an array');
  }
  if (goals.length > 12) {
    throw new Error(`Invariant: goals.length ${goals.length} exceeds cap 12`);
  }
  const seenGoalIds = new Set();
  for (const g of goals) {
    if (!g || typeof g !== 'object') {
      throw new Error('Invariant: goal must be object');
    }
    if (!g.id || typeof g.id !== 'string') {
      throw new Error('Invariant: goal.id must be non-empty string');
    }
    if (seenGoalIds.has(g.id)) {
      throw new Error(`Invariant: duplicate goal id ${g.id}`);
    }
    seenGoalIds.add(g.id);
    if (!GOAL_KINDS.has(g.kind)) {
      throw new Error(`Invariant: invalid goal kind ${g.kind}`);
    }
    if (!GOAL_STATUSES.has(g.status)) {
      throw new Error(`Invariant: invalid goal status ${g.status}`);
    }
    if (typeof g.targetRef !== 'string' || !g.targetRef) {
      throw new Error(`Invariant: goal ${g.id} missing targetRef`);
    }
    if (!Number.isInteger(g.createdAt) || g.createdAt < 0) {
      throw new Error(`Invariant: goal ${g.id} invalid createdAt`);
    }
    if (g.completedAt != null && (!Number.isInteger(g.completedAt) || g.completedAt < 0)) {
      throw new Error(`Invariant: goal ${g.id} invalid completedAt`);
    }
    if (g.status === 'completed' && g.completedAt == null) {
      throw new Error(`Invariant: completed goal ${g.id} must have completedAt`);
    }
  }

  // Recent beats (narrative memory cache, FIFO cap 6)
  const beats = world.recentBeats;
  if (!Array.isArray(beats)) {
    throw new Error('Invariant: recentBeats must be an array');
  }
  if (beats.length > 6) {
    throw new Error(`Invariant: recentBeats.length ${beats.length} exceeds cap 6`);
  }
  for (const b of beats) {
    if (!b || typeof b !== 'object') {
      throw new Error('Invariant: beat must be object');
    }
    if (!Number.isInteger(b.t) || b.t < 0) {
      throw new Error('Invariant: beat.t must be non-negative integer');
    }
    if (typeof b.input !== 'string') {
      throw new Error('Invariant: beat.input must be string');
    }
    if (b.input.length > 140) {
      throw new Error(`Invariant: beat.input length ${b.input.length} exceeds cap 140`);
    }
    if (typeof b.approach !== 'string') {
      throw new Error('Invariant: beat.approach must be string');
    }
    if (typeof b.stake !== 'string') {
      throw new Error('Invariant: beat.stake must be string');
    }
    if (!BEAT_OUTCOMES.has(b.outcome)) {
      throw new Error(`Invariant: invalid beat outcome ${b.outcome}`);
    }
    if (typeof b.location !== 'string') {
      throw new Error('Invariant: beat.location must be string');
    }
    if (typeof b.mechanics !== 'string') {
      throw new Error('Invariant: beat.mechanics must be string');
    }
    if (b.mechanics.length > 200) {
      throw new Error(`Invariant: beat.mechanics length ${b.mechanics.length} exceeds cap 200`);
    }
  }

  // Dialogue mode (optional)
  const dialogue = world.scene?.dialogue;
  if (dialogue != null) {
    if (typeof dialogue !== 'object') {
      throw new Error('Invariant: scene.dialogue must be object or null');
    }
    if (!dialogue.npcId || typeof dialogue.npcId !== 'string') {
      throw new Error('Invariant: scene.dialogue.npcId must be non-empty string');
    }
    if (!Number.isInteger(dialogue.turnsInDialogue) || dialogue.turnsInDialogue < 0) {
      throw new Error('Invariant: scene.dialogue.turnsInDialogue must be non-negative integer');
    }
    if (!Array.isArray(dialogue.topicsOffered)) {
      throw new Error('Invariant: scene.dialogue.topicsOffered must be array');
    }
    if (dialogue.topicsOffered.length > 20) {
      throw new Error(`Invariant: scene.dialogue.topicsOffered length ${dialogue.topicsOffered.length} exceeds cap 20`);
    }
    const seenTopics = new Set();
    for (const t of dialogue.topicsOffered) {
      if (seenTopics.has(t)) {
        throw new Error(`Invariant: scene.dialogue.topicsOffered has duplicate ${t}`);
      }
      seenTopics.add(t);
    }
    const nodeId = String(world.map?.currentNodeId ?? '');
    const node = (world.map?.nodes || []).find(n => n && n.id === nodeId) || null;
    const npcs = node?.settlement?.npcs || [];
    const foundNpc = npcs.some(n => String(n?.id) === dialogue.npcId);
    if (!foundNpc) {
      throw new Error(`Invariant: scene.dialogue.npcId ${dialogue.npcId} not at current node`);
    }
  }
}

const GOAL_KINDS = new Set(['reach', 'obtain', 'talkTo', 'learn', 'defeat']);
const GOAL_STATUSES = new Set(['active', 'completed', 'failed']);
const BEAT_OUTCOMES = new Set(['success', 'mixed', 'failure']);
