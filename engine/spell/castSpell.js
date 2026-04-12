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
import { lookupSpell } from '../ruleset/core/spells/index.js';
import { statMod } from '../ruleset/core/stats.js';
import { profBonusFor } from '../ruleset/core/levelTable.js';

/**
 * Cast a spell. Returns { world, result }.
 *
 * result.ok === false when the cast is blocked (unknown spell, no slots, etc.).
 * result.ok === true after successful resolution. result.effects[] contains
 * each applied effect descriptor for downstream consumption (combat resolver,
 * composer, etc.).
 */
export function castSpell(world, { spellRef, targetId, slotLevel } = {}) {
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
      // Upcast scaling for leveled spells.
      if (!isCantrip && def.scalingByLevel?.extraDice && effectiveSlotLevel > def.level) {
        const extraLevels = effectiveSlotLevel - def.level;
        const extraDice = String(def.scalingByLevel.extraDice);
        // e.g. fireball at 4th = 8d6 + 1d6 extra = 9d6
        const extraTotal = rollDice(rng, extraDice) * extraLevels;
        // We'll add the extra below after rolling the base.
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
        // Enemy saving throw — simplified: roll d20 vs spell DC.
        const saveRoll = rng.int(1, 20);
        saved = saveRoll >= spellDC;
        if (saved && def.savingThrow.halfOnSave) {
          totalDamage = Math.max(1, Math.floor(totalDamage / 2));
        } else if (saved) {
          totalDamage = 0;
        }
      }

      // Apply damage. If we have a targetId and combat is active, apply via
      // combatState enemyHpDelta. Otherwise apply as a wound to the target entity.
      const deltas = [];
      if (targetId && w.combat?.active) {
        const enemies = Array.isArray(w.combat.enemies) ? w.combat.enemies : [];
        const targetEnemy = enemies.find(e => String(e.id) === String(targetId) && e.hp > 0);
        if (targetEnemy) {
          deltas.push({ op: 'combatState', enemyHpDelta: [{ id: targetEnemy.id, by: -totalDamage }] });
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
        damageType: effect.damageType || 'untyped',
        totalDamage,
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
  }

  return {
    world: w,
    result: {
      ok: true,
      spellRef: ref,
      spellName: def.name,
      effects: appliedEffects,
      slotConsumed,
      slotLevel: effectiveSlotLevel
    }
  };
}

// ── Dice roller (seeded) ──────────────────────────────────────────────────

/**
 * Roll a dice string like '3d6' using the seeded RNG.
 * Returns the total as an integer.
 */
export function rollDice(rng, diceStr) {
  const m = String(diceStr).match(/^(\d+)d(\d+)$/);
  if (!m) return 0;
  const count = Math.max(1, Math.min(20, parseInt(m[1], 10) || 1));
  const sides = Math.max(1, Math.min(100, parseInt(m[2], 10) || 6));
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rng.int(1, sides);
  }
  return total;
}

// ── helpers ───────────────────────────────────────────────────────────────

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : 0;
}
