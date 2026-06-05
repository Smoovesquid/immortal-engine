/**
 * Pass T3 — Spell casting module.
 *
 * castSpell(world, { spellRef, targetId, slotLevel }) -> { world, result }
 *
 * Pure: all randomness from rng.js (seeded), all mutations via applyDeltas.
 * Handles slot consumption, concentration tracking, and effect resolution.
 */

import { ensureWorld } from '../state.js';
import { makeRng, seedFromString } from '../rng.js';
import { applyDeltas } from '../effectsCore.js';
import { applyWillToCast } from '../magic/will.js';
import { castMoralCost, applyCastCost } from '../magic/willCost.js';
import { lookupSpell } from '../ruleset/core/spells/index.js';
import { statMod } from '../ruleset/core/stats.js';
import { profBonusFor } from '../ruleset/core/levelTable.js';
import { rollSave } from '../combat/savingThrows.js';
import { maxWounds } from '../ruleset/core/stats.js';
import { applyResistance } from '../combat/damageTypes.js';
import { applyDamageTakenTraits } from '../combat/traitHooks.js';

/**
 * Cast a spell. Returns { world, result }.
 *
 * result.ok === false when the cast is blocked (unknown spell, no slots, etc.).
 * result.ok === true after successful resolution. result.effects[] contains
 * each applied effect descriptor for downstream consumption (combat resolver,
 * composer, etc.).
 */
export function castSpell(world, { spellRef, targetId, slotLevel, will = false, againstUnwilling = false } = {}) {
  let w = ensureWorld(world);

  const ref = String(spellRef ?? '').trim();
  const def = lookupSpell(ref);
  if (!def) {
    return { world: w, result: { ok: false, reason: 'unknown-spell', spellRef: ref, effects: [], slotConsumed: false } };
  }

  const party0 = w.party?.[0];
  if (!party0) {
    return { world: w, result: { ok: false, reason: 'no-caster', spellRef: ref, effects: [], slotConsumed: false } };
  }

  const spells = party0.spells || { known: [], slots: {}, maxSlots: {}, concentration: null };

  // Check if spell is known (cantrips and known spells).
  if (!spells.known.includes(ref)) {
    return { world: w, result: { ok: false, reason: 'not-known', spellRef: ref, effects: [], slotConsumed: false } };
  }

  const isCantrip = def.level === 0;
  let effectiveSlotLevel = isCantrip ? 0 : Math.max(def.level, toInt(slotLevel ?? def.level));

  // Slot consumption for leveled spells.
  let slotConsumed = false;
  if (!isCantrip) {
    if (effectiveSlotLevel < 1 || effectiveSlotLevel > 5) {
      return { world: w, result: { ok: false, reason: 'invalid-slot-level', spellRef: ref, effects: [], slotConsumed: false } };
    }
    const available = toInt(spells.slots?.[effectiveSlotLevel] ?? 0);
    if (available <= 0) {
      return { world: w, result: { ok: false, reason: 'no-slots', spellRef: ref, effects: [], slotConsumed: false } };
    }
    w = applyDeltas(w, [{ op: 'consumeSpellSlot', level: effectiveSlotLevel }]);
    slotConsumed = true;
  }

  // ── Hidden Will (opt-in, default OFF) ────────────────────────────────────
  // The caster's deed-shaped Will quietly shapes the cast: aligned magic lands,
  // dissonant magic may fizzle or backfire, and coercive/forbidden casting stains
  // the world (corruption + scars). When `will` is unset, the base resolver below
  // runs exactly as before.
  let willInfo = null;
  if (will && def.school) {
    const willTurn = toInt(w.time?.turn ?? 0);
    const wc = applyWillToCast({ world: w, school: def.school, baseSuccess: 0.85, nonce: willTurn });
    const cost = castMoralCost({ world: w, school: def.school, againstUnwilling });
    if (cost.corruption || cost.instability || cost.scar) w = applyCastCost(w, cost);
    willInfo = { school: def.school, feel: wc.feelText, affinity: wc.affinity, dissonance: wc.dissonance, backfired: wc.backfired, cost };
    if (!wc.cast) {
      return { world: w, result: { ok: true, miscast: true, reason: wc.backfired ? 'will-backfire' : 'will-fizzle', spellRef: ref, spellName: def.name, effects: [], slotConsumed, will: willInfo } };
    }
  }

  // Concentration handling.
  if (def.concentration) {
    // If already concentrating on something else, break it first.
    if (spells.concentration && spells.concentration.spellRef) {
      w = applyDeltas(w, [{ op: 'setConcentration', spellRef: '' }]);
    }
    // Set new concentration.
    w = applyDeltas(w, [{ op: 'setConcentration', spellRef: ref, startedAt: w.time?.turn ?? 0 }]);
  }

  // Resolve effects.
  const appliedEffects = [];
  const turn = toInt(w.time?.turn ?? 0);
  const seed = seedFromString(`${w.meta.seed}|spell|${ref}|${turn}`);
  const rng = makeRng(seed);

  const casterLevel = toInt(party0.level ?? 1);
  const witsMod = statMod(party0.stats?.WITS ?? 10);
  const profBonus = profBonusFor(casterLevel);
  const spellDC = 8 + profBonus + witsMod;

  for (const effect of def.effects) {
    if (!effect || typeof effect !== 'object') continue;

    if (effect.kind === 'damage') {
      // Determine dice string (cantrip scaling).
      let diceStr = String(effect.dice || '1d6');
      if (isCantrip && def.scalingByLevel) {
        // Find the highest scaling threshold the caster meets.
        const thresholds = Object.keys(def.scalingByLevel)
          .map(Number)
          .filter(n => Number.isFinite(n) && n <= casterLevel)
          .sort((a, b) => b - a);
        if (thresholds.length > 0) {
          const scaled = def.scalingByLevel[thresholds[0]];
          if (typeof scaled === 'string') diceStr = scaled;
        }
      }
      const baseDamage = rollDice(rng, diceStr);

      // Upcast extra damage for leveled spells.
      let extraDamage = 0;
      if (!isCantrip && def.scalingByLevel?.extraDice && effectiveSlotLevel > def.level) {
        const extraLevels = effectiveSlotLevel - def.level;
        for (let i = 0; i < extraLevels; i++) {
          extraDamage += rollDice(rng, String(def.scalingByLevel.extraDice));
        }
      }

      let totalDamage = baseDamage + extraDamage;

      // Saving throw (e.g. fireball DEX save for half).
      let saved = false;
      if (def.savingThrow && targetId) {
        const saveStat = String(def.savingThrow.stat || 'GRIT');
        const enemies = Array.isArray(w.combat?.enemies) ? w.combat.enemies : [];
        const targetEntity = enemies.find(e => String(e.id) === String(targetId)) || {};
        saved = rollSave(targetEntity, saveStat, spellDC, rng).success;
        if (saved && def.savingThrow.halfOnSave) {
          totalDamage = Math.max(1, Math.floor(totalDamage / 2));
        } else if (saved) {
          totalDamage = 0;
        }
      }

      // Apply damage. If we have a targetId and combat is active, apply via
      // combatState enemyHpDelta. Otherwise apply as a wound to the target entity.
      const deltas = [];
      const dmgType = effect.damageType || 'untyped';
      let appliedDamage = totalDamage;
      if (targetId && w.combat?.active) {
        const enemies = Array.isArray(w.combat.enemies) ? w.combat.enemies : [];
        const targetEnemy = enemies.find(e => String(e.id) === String(targetId) && e.hp > 0);
        if (targetEnemy) {
          const res = applyResistance(totalDamage, dmgType, targetEnemy.resistances);
          const afterTraits = res.heals ? res.final : applyDamageTakenTraits(targetEnemy, res.final, dmgType);
          appliedDamage = res.heals ? -afterTraits : afterTraits;
          deltas.push({ op: 'combatState', enemyHpDelta: [{ id: targetEnemy.id, by: res.heals ? afterTraits : -afterTraits }] });
        }
      } else if (targetId) {
        deltas.push({ op: 'wound', entityId: String(targetId), by: totalDamage });
      }
      if (deltas.length) {
        w = applyDeltas(w, deltas);
      }

      appliedEffects.push({
        kind: 'damage',
        dice: diceStr,
        damageType: dmgType,
        totalDamage: appliedDamage,
        saved,
        targetId: targetId || null
      });
    }

    if (effect.kind === 'acBoost') {
      const entityId = targetId || String(party0.id);
      w = applyDeltas(w, [{
        op: 'condition',
        entityId,
        add: `spell:${ref}:ac+${effect.value}`,
        until: def.duration === 'instant' ? null : def.duration
      }]);
      appliedEffects.push({
        kind: 'acBoost',
        value: effect.value,
        entityId
      });
    }

    if (effect.kind === 'teleport') {
      const entityId = String(party0.id);
      // Teleport moves the caster's zone to 'far' (30ft movement).
      w = applyDeltas(w, [{
        op: 'position',
        entityId,
        set: { zone: 'far' }
      }]);
      appliedEffects.push({
        kind: 'teleport',
        distance: effect.distance || 30,
        entityId
      });
    }

    if (effect.kind === 'counter') {
      appliedEffects.push({
        kind: 'counter',
        autoSuccess: Boolean(effect.autoSuccess)
      });
    }

    // CM8: heal — restore wounds or stress.
    if (effect.kind === 'heal') {
      let healAmount = 0;
      if (effect.dice === 'half_damage') {
        // Vampiric touch: heal for half the damage already dealt this cast.
        const dmgEffect = appliedEffects.find(e => e.kind === 'damage');
        healAmount = dmgEffect ? Math.floor(dmgEffect.totalDamage / 2) : 0;
      } else {
        healAmount = rollDice(rng, String(effect.dice || '1d8'));
        // Upcast healing.
        if (!isCantrip && def.scalingByLevel?.extraDice && effectiveSlotLevel > def.level) {
          const extraLevels = effectiveSlotLevel - def.level;
          for (let i = 0; i < extraLevels; i++) {
            healAmount += rollDice(rng, String(def.scalingByLevel.extraDice));
          }
        }
      }
      if (healAmount > 0) {
        const healTarget = effect.target === 'self' ? String(party0.id) : (targetId || String(party0.id));
        if (effect.target === 'party') {
          // Mass heal: reduce wounds on all living party members.
          const healDeltas = (w.party || [])
            .filter(p => {
              if (!p) return false;
              const cap = maxWounds(p.level ?? 1, statMod(p.stats?.GRIT ?? 10));
              const w0 = p.wounds ?? 0;
              return w0 > 0 && w0 < cap;
            })
            .map(p => ({ op: 'wound', entityId: String(p.id), by: -healAmount }));
          if (healDeltas.length) w = applyDeltas(w, healDeltas);
        } else {
          w = applyDeltas(w, [{ op: 'wound', entityId: healTarget, by: -healAmount }]);
        }
      }
      appliedEffects.push({ kind: 'heal', healAmount, target: effect.target || 'single', targetId: targetId || null });
    }

    // CM8: conditions — apply or remove conditions on target.
    if (effect.kind === 'conditions') {
      if (effect.removeCondition) {
        // Restoration spells: remove named conditions from target.
        const condTarget = targetId || String(party0.id);
        const names = Array.isArray(effect.conditionNames) ? effect.conditionNames : [];
        const removeDeltas = names.map(name => ({ op: 'removeCondition', entityId: condTarget, name }));
        if (removeDeltas.length) w = applyDeltas(w, removeDeltas);
        appliedEffects.push({ kind: 'conditions', removed: names, targetId: condTarget });
      } else if (effect.condition) {
        // Apply condition to target (enemy or ally).
        const cond = effect.condition;
        const condDc = (cond.until?.dc === 0) ? spellDC : (cond.until?.dc ?? spellDC);
        const normalizedCond = {
          name: String(cond.name ?? ''),
          until: cond.until ? { ...cond.until, dc: condDc } : null,
          source: `spell:${ref}`,
          severity: cond.severity ?? 1,
          stackBehavior: cond.stackBehavior ?? 'replace'
        };
        if (targetId && w.combat?.active) {
          const enemies = Array.isArray(w.combat.enemies) ? w.combat.enemies : [];
          const targetEnemy = enemies.find(e => String(e.id) === String(targetId) && e.hp > 0);
          if (targetEnemy) {
            w = applyDeltas(w, [{ op: 'combatState', enemyConditions: [{ id: targetEnemy.id, addCondition: normalizedCond }] }]);
          }
        } else if (targetId) {
          w = applyDeltas(w, [{ op: 'condition', entityId: String(targetId), add: normalizedCond.name, until: normalizedCond.until }]);
        }
        appliedEffects.push({ kind: 'conditions', applied: normalizedCond, targetId: targetId || null });
      }
    }

    // CM8: area_damage — same as damage but flagged as area effect.
    if (effect.kind === 'area_damage') {
      let diceStr = String(effect.dice || '1d6');
      const baseDamage = rollDice(rng, diceStr);
      let totalDamage = baseDamage;

      let saved = false;
      if (def.savingThrow && targetId) {
        const saveStat = String(def.savingThrow.stat || 'GRIT');
        const enemies = Array.isArray(w.combat?.enemies) ? w.combat.enemies : [];
        const targetEntity = enemies.find(e => String(e.id) === String(targetId)) || {};
        saved = rollSave(targetEntity, saveStat, spellDC, rng).success;
        if (saved && def.savingThrow.halfOnSave) {
          totalDamage = Math.max(1, Math.floor(totalDamage / 2));
        } else if (saved) {
          totalDamage = 0;
        }
      }

      const areaDmgType = effect.damageType || 'untyped';
      let appliedAreaDamage = totalDamage;
      if (targetId && w.combat?.active) {
        const enemies = Array.isArray(w.combat.enemies) ? w.combat.enemies : [];
        const targetEnemy = enemies.find(e => String(e.id) === String(targetId) && e.hp > 0);
        if (targetEnemy) {
          const res = applyResistance(totalDamage, areaDmgType, targetEnemy.resistances);
          const afterTraits = res.heals ? res.final : applyDamageTakenTraits(targetEnemy, res.final, areaDmgType);
          appliedAreaDamage = res.heals ? -afterTraits : afterTraits;
          w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: targetEnemy.id, by: res.heals ? afterTraits : -afterTraits }] }]);
        }
      }

      appliedEffects.push({
        kind: 'area_damage',
        dice: diceStr,
        damageType: areaDmgType,
        totalDamage: appliedAreaDamage, saved, area: effect.area || null,
        targetId: targetId || null
      });
    }

    // CM8: buff — apply a beneficial modifier to target.
    if (effect.kind === 'buff') {
      appliedEffects.push({
        kind: 'buff',
        stat: effect.stat || 'unknown',
        value: effect.value,
        target: effect.target || 'single',
        targetId: targetId || String(party0.id)
      });
    }

    // CM8: barrier — wall/force-wall effect; record without applying world delta.
    if (effect.kind === 'barrier') {
      appliedEffects.push({
        kind: 'barrier',
        hp: effect.hp ?? 0,
        area: effect.area || null
      });
    }

    // CM8: debuff — apply a harmful modifier to target.
    if (effect.kind === 'debuff') {
      appliedEffects.push({
        kind: 'debuff',
        stat: effect.stat || 'unknown',
        penalty: effect.penalty || 0,
        target: effect.target || 'single',
        targetId: targetId || null
      });
    }
  }

  return {
    world: w,
    result: {
      ok: true,
      spellRef: ref,
      spellName: def.name,
      effects: appliedEffects,
      slotConsumed,
      slotLevel: effectiveSlotLevel,
      will: willInfo
    }
  };
}

// ── Dice roller (seeded) ──────────────────────────────────────────────────

/**
 * Roll a dice string like '3d6' using the seeded RNG.
 * Returns the total as an integer.
 */
export function rollDice(rng, diceStr) {
  const m = String(diceStr).match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
  if (!m) return 0;
  const count = Math.max(1, Math.min(20, parseInt(m[1], 10) || 1));
  const sides = Math.max(1, Math.min(100, parseInt(m[2], 10) || 6));
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rng.int(1, sides);
  }
  if (m[3] && m[4]) {
    const mod = parseInt(m[4], 10) || 0;
    total += m[3] === '+' ? mod : -mod;
  }
  return total;
}

// ── helpers ───────────────────────────────────────────────────────────────

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : 0;
}
