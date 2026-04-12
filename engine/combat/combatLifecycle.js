/**
 * Pass 5 — Combat lifecycle helpers.
 *
 * Pure functions. No randomness, no LLM, no Math.random.
 *
 * beginCombat(world, { enemies, reason }) -> world
 * endCombat(world, { reason })            -> world
 * mintEnemyFromNpc(npc)                   -> Enemy
 *
 * All world mutations route through applyDeltas via the single combatState op.
 * Combat-begin and combat-end emit timeline events through pushCombatEvent.
 */

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { endDialogue } from '../npc/dialogue.js';
import { getMonsterDef } from '../ruleset/core/bestiary/index.js';
import { makeRng, seedFromString } from '../rng.js';
import { buildCombatants, rollInitiative } from './initiative.js';

const ENEMY_CAP = 6;

const DEFAULT_ENEMY = {
  maxHp: 8,
  damage: 3,
  canParley: true
};

/**
 * mintEnemyFromNpc(npc) -> Enemy
 *
 * Pure: maps an NPC into an Enemy record. Reads optional npc.combatProfile
 * for { maxHp, damage, canParley } overrides. Defaults are intentionally
 * boring — Pass 5 has no bestiary.
 *
 * R15: canParley derivation honors npc.hostile. Explicit hostile NPCs mint
 * with canParley:false so a heart-success can't trivially end combat against
 * them (the heart-fallback trivial-damage branch fires instead). Non-hostile
 * NPCs attacked by mistake remain parley-eligible — the "friendly fire"
 * safety valve. An explicit npc.combatProfile.canParley always wins (lets
 * tests and future bestiary content override the derivation).
 */
export function mintEnemyFromNpc(npc) {
  const n = npc && typeof npc === 'object' ? npc : {};
  const profile = n.combatProfile && typeof n.combatProfile === 'object' ? n.combatProfile : {};

  // B1: if the NPC has a bestiaryRef, pull stats from the bestiary catalog.
  const bestiary = n.bestiaryRef ? getMonsterDef(n.bestiaryRef) : null;
  const base = bestiary || DEFAULT_ENEMY;

  const maxHp = clampInt(profile.maxHp ?? base.maxHp, 1, 999);
  const damage = clampInt(profile.damage ?? base.damage, 1, 999);
  const ac = bestiary ? (bestiary.ac ?? 10) : 10;
  const cr = bestiary ? (bestiary.cr ?? 0) : 0;
  // CM1: damage type from bestiary's first action, or profile override, or default.
  const damageType = profile.damageType
    ?? (bestiary?.actions?.[0]?.type)
    ?? 'bludgeoning';
  const resistances = bestiary?.resistances ?? profile.resistances ?? {};
  const conditionImmunities = bestiary?.conditionImmunities ?? profile.conditionImmunities ?? [];
  // CM3: pass through actions, multiattack, saveProficiencies from bestiary.
  const actions = bestiary?.actions ?? profile.actions ?? [];
  const multiattack = bestiary?.multiattack ?? profile.multiattack ?? null;
  const saveProficiencies = bestiary?.saveProficiencies ?? profile.saveProficiencies ?? [];
  const canParley = profile.canParley != null
    ? Boolean(profile.canParley)
    : bestiary
      ? Boolean(base.canParley)
      : !Boolean(n.hostile);
  // CM5: lootTableRef from bestiary or combatProfile.
  const lootTableRef = profile.lootTableRef ?? bestiary?.lootTableRef ?? null;
  // CM6: initiative modifier from bestiary or combatProfile.
  const initMod = typeof (profile.initMod ?? bestiary?.initMod) === 'number'
    ? (profile.initMod ?? bestiary?.initMod) : 0;
  // CM7: legendaryActions and reactions from bestiary or combatProfile.
  const legendaryActions = profile.legendaryActions ?? bestiary?.legendaryActions ?? null;
  const reactions = profile.reactions ?? bestiary?.reactions ?? null;
  // CM9: lairActions and senses from bestiary or combatProfile.
  const lairActions = profile.lairActions ?? bestiary?.lairActions ?? null;
  const senses = profile.senses ?? bestiary?.senses ?? { darkvision: null, blindsight: null, tremorsense: null, truesight: null };
  const sourceNpcId = String(n.id ?? '');
  return {
    id: '', // assigned at begin
    name: String(n.name ?? (bestiary && bestiary.name) ?? sourceNpcId ?? 'foe'),
    hp: maxHp,
    maxHp,
    damage,
    ac,
    cr,
    damageType,
    resistances,
    conditionImmunities,
    actions,
    multiattack,
    saveProficiencies,
    canParley,
    defeated: false,
    sourceNpcId,
    lootTableRef,
    initMod,
    legendaryActions,
    reactions,
    lairActions,
    senses
  };
}

/**
 * beginCombat(world, { enemies, reason }) -> world
 *
 * Refuses if combat is already active or ending is locked. If a dialogue
 * is open, it is auto-ended first (combat and dialogue are mutually exclusive
 * — see invariants.js). Enemies are assigned monotonic ids enemy_0..enemy_N
 * and capped at 6.
 */
export function beginCombat(world, { enemies, reason } = {}) {
  let w = ensureWorld(world);
  if (w.combat?.active) return w;
  if (w.ending?.locked) return w;

  // Auto-end any open dialogue (mutually exclusive with combat).
  if (w.scene?.dialogue) {
    const ended = endDialogue(w);
    w = ended.world;
  }

  const list = Array.isArray(enemies) ? enemies : [];
  const shaped = [];
  for (let i = 0; i < list.length && shaped.length < ENEMY_CAP; i++) {
    const e = list[i];
    if (!e || typeof e !== 'object') continue;
    shaped.push({ ...e, id: `enemy_${shaped.length}` });
  }
  if (!shaped.length) return w;

  const reasonStr = String(reason ?? 'player-attack');
  const beganAt = Array.isArray(w.timeline) ? w.timeline.length : 0;

  // First, push the begin event so beganAt points at the begin marker.
  w = pushCombatEvent(w, 'combat-begin', { reason: reasonStr, enemies: shaped.map(e => ({ id: e.id, name: e.name, sourceNpcId: e.sourceNpcId })) });

  // CM6: roll initiative for all combatants.
  const initSeed = seedFromString(`${w.meta?.seed || ''}|initiative|${beganAt}`);
  const initRng = makeRng(initSeed);
  const combatants = buildCombatants(w.party, shaped);
  const initiativeOrder = rollInitiative(combatants, initRng);

  // Then apply the state mutation through the canonical delta op.
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: true,
      round: 1,
      turnIndex: 0,
      enemies: shaped,
      beganAt,
      reason: reasonStr,
      playerGuard: false,
      companionGuard: false,
      initiativeOrder
    }
  }]);

  return w;
}

/**
 * endCombat(world, { reason }) -> world
 *
 * Sets combat.active=false but preserves the enemies array (with their final
 * hp/defeated flags) so save/load shows the aftermath. Emits combat-end.
 */
export function endCombat(world, { reason } = {}) {
  let w = ensureWorld(world);
  const reasonStr = String(reason ?? '');
  w = pushCombatEvent(w, 'combat-end', { reason: reasonStr });
  w = applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: false,
      round: 0,
      turnIndex: 0,
      reason: reasonStr,
      playerGuard: false,
      companionGuard: false
    }
  }]);
  return w;
}

// ── internals ──────────────────────────────────────────────────────────────

function pushCombatEvent(world, kind, data) {
  const tl = Array.isArray(world.timeline) ? world.timeline : [];
  const t = tl.length;
  return { ...world, timeline: [...tl, { t, kind: String(kind), data: data ?? {} }] };
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
