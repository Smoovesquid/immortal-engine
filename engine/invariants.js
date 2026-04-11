import { WORLD_VERSION } from './state.js';

export function assertWorldInvariants(world) {
  if (!world || typeof world !== 'object') {
    throw new Error('Invariant: world must be object');
  }

  if (world.meta?.version !== WORLD_VERSION) {
    throw new Error('Invariant: world version mismatch');
  }

  // Pass C1 — party + companion shape (cap 3, marker structure).
  const party = world.party;
  if (!Array.isArray(party)) {
    throw new Error('Invariant: party must be an array');
  }
  if (party.length > 3) {
    throw new Error(`Invariant: party.length ${party.length} exceeds cap 3`);
  }
  const seenCompanionSources = new Set();
  for (let i = 0; i < party.length; i++) {
    const member = party[i];
    if (!member || typeof member !== 'object') {
      throw new Error(`Invariant: party[${i}] must be object`);
    }
    const c = member.companion;
    if (i === 0) {
      if (c != null) {
        throw new Error('Invariant: party[0].companion must be null (player is not a companion)');
      }
      continue;
    }
    if (c == null) continue;
    if (typeof c !== 'object') {
      throw new Error(`Invariant: party[${i}].companion must be object or null`);
    }
    if (typeof c.sourceNpcId !== 'string' || !c.sourceNpcId) {
      throw new Error(`Invariant: party[${i}].companion.sourceNpcId must be non-empty string`);
    }
    if (!Number.isInteger(c.recruitedAtTurn) || c.recruitedAtTurn < 0) {
      throw new Error(`Invariant: party[${i}].companion.recruitedAtTurn must be non-negative integer`);
    }
    if (!Number.isInteger(c.trustLevel) || c.trustLevel < 0 || c.trustLevel > 10) {
      throw new Error(`Invariant: party[${i}].companion.trustLevel must be integer 0..10`);
    }
    if (typeof c.role !== 'string') {
      throw new Error(`Invariant: party[${i}].companion.role must be string`);
    }
    if (seenCompanionSources.has(c.sourceNpcId)) {
      throw new Error(`Invariant: duplicate companion sourceNpcId ${c.sourceNpcId}`);
    }
    seenCompanionSources.add(c.sourceNpcId);
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

  // Combat (Pass 5)
  const combat = world.combat;
  if (!combat || typeof combat !== 'object') {
    throw new Error('Invariant: combat must be object');
  }
  if (typeof combat.active !== 'boolean') {
    throw new Error('Invariant: combat.active must be boolean');
  }
  if (!Number.isInteger(combat.round) || combat.round < 0 || combat.round > 99) {
    throw new Error('Invariant: combat.round must be 0..99');
  }
  if (!Number.isInteger(combat.turnIndex) || combat.turnIndex < 0 || combat.turnIndex > 6) {
    throw new Error('Invariant: combat.turnIndex must be 0..6');
  }
  if (!Number.isInteger(combat.beganAt) || combat.beganAt < 0) {
    throw new Error('Invariant: combat.beganAt must be non-negative integer');
  }
  if (typeof combat.reason !== 'string') {
    throw new Error('Invariant: combat.reason must be string');
  }
  if (typeof combat.playerGuard !== 'boolean') {
    throw new Error('Invariant: combat.playerGuard must be boolean');
  }
  if (!Array.isArray(combat.enemies)) {
    throw new Error('Invariant: combat.enemies must be array');
  }
  if (combat.enemies.length > 6) {
    throw new Error(`Invariant: combat.enemies.length ${combat.enemies.length} exceeds cap 6`);
  }
  if (combat.active && combat.enemies.length === 0) {
    throw new Error('Invariant: active combat must have at least one enemy');
  }
  const seenEnemyIds = new Set();
  for (const e of combat.enemies) {
    if (!e || typeof e !== 'object') {
      throw new Error('Invariant: combat enemy must be object');
    }
    if (!e.id || typeof e.id !== 'string') {
      throw new Error('Invariant: combat enemy.id must be non-empty string');
    }
    if (seenEnemyIds.has(e.id)) {
      throw new Error(`Invariant: duplicate combat enemy id ${e.id}`);
    }
    seenEnemyIds.add(e.id);
    if (typeof e.name !== 'string' || !e.name) {
      throw new Error(`Invariant: combat enemy ${e.id} missing name`);
    }
    if (!Number.isInteger(e.maxHp) || e.maxHp < 1 || e.maxHp > 20) {
      throw new Error(`Invariant: combat enemy ${e.id} maxHp out of range 1..20`);
    }
    if (!Number.isInteger(e.hp) || e.hp < 0 || e.hp > e.maxHp) {
      throw new Error(`Invariant: combat enemy ${e.id} hp out of range 0..maxHp`);
    }
    if (!Number.isInteger(e.damage) || e.damage < 1 || e.damage > 6) {
      throw new Error(`Invariant: combat enemy ${e.id} damage out of range 1..6`);
    }
    if (typeof e.canParley !== 'boolean') {
      throw new Error(`Invariant: combat enemy ${e.id} canParley must be boolean`);
    }
    if (typeof e.defeated !== 'boolean') {
      throw new Error(`Invariant: combat enemy ${e.id} defeated must be boolean`);
    }
    if (typeof e.sourceNpcId !== 'string') {
      throw new Error(`Invariant: combat enemy ${e.id} sourceNpcId must be string`);
    }
  }
  if (combat.active && world.scene?.dialogue) {
    throw new Error('Invariant: combat.active and scene.dialogue are mutually exclusive');
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
