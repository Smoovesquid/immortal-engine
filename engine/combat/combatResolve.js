/**
 * Pass 5 + CM7 — Combat resolver.
 *
 * resolveCombatTurn(world, move) -> { world, result }
 *
 * CM7 refactor: walk initiativeOrder top to bottom. Each slot resolves
 * based on type:
 *   - 'party' (id === player): resolve the player's move
 *   - 'party' (companion): resolve companion action via afterPlayerTurn hook
 *   - 'enemy': resolve enemy counter-attack
 * After each entity's turn, check for legendary actions from eligible enemies.
 *
 * Pure: no LLM, no Math.random, no Date.now. All randomness comes from
 * resolveMove's seeded RNG.
 */

import { ensureWorld } from '../state.js';
import { resolveMove } from '../resolve.js';
import { applyDeltas } from '../effectsCore.js';
import { checkGoals } from '../goals/goalContract.js';
import { makeRng, seedFromString } from '../rng.js';
import { statMod, maxWounds } from '../ruleset/core/stats.js';
import { computeAttack, computeAC } from '../gear/gearProps.js';
import { applyResistance } from './damageTypes.js';
import { tickConditions, hasCondition, applyCondition } from './conditions.js';
import { getConditionModifiers } from './conditionEffects.js';
import { resolveAction, resolveRecharge } from './actionResolver.js';
import { rollLootForCR } from '../ruleset/core/loot/lootRoll.js';
import { rollDice } from './diceRoller.js';
import { rollSave } from './savingThrows.js';
import { applySenseOverrides } from './senses.js';
import { applyTurnStartTraits, applyDamageTakenTraits, applyACTraits, applyDeathTraits } from './traitHooks.js';
import { resolveBossActionPayload, resolveLairActionPayload, applyBossPhase, detectPhaseCrossings } from './bossActions.js';
import { sealLoot } from '../ruleset/core/items/magic.js';
import { getItemDef } from '../ruleset/core/items/index.js';

const FORCE_BASE = 3;
const FINESSE_BASE = 2;
const HEART_FALLBACK_DAMAGE = 1;

/**
 * resolveCombatTurn(world, move, opts?)
 *
 * opts.afterPlayerTurn — optional hook for companion resolution.
 *   Signature: (world, companionId?) => { world, summaryParts }
 *   CM7: may be called per-companion at their initiative slot.
 *   Falls back to old behavior (all companions at once) if companionId
 *   is not supported by the hook.
 */
export function resolveCombatTurn(world, move, opts = {}) {
  let w = ensureWorld(world);

  if (!w.combat?.active || !Array.isArray(w.combat.enemies) || w.combat.enemies.length === 0) {
    return {
      world: w,
      result: {
        outcome: 'mixed',
        roll: 0,
        dc: 0,
        margin: 0,
        gains: [],
        costs: [],
        deltas: [],
        mechanicsLine: '[combat inactive — no-op]',
        combatSummary: 'combat is not active',
        targetEnemyName: '',
        targetEnemyId: ''
      }
    };
  }

  // P-75: snapshot enemy hp at turn start for phase-crossing detection.
  const bossHpAtStart = new Map((w.combat?.enemies || []).map(e => [e.id, e.hp]));

  const m = normalizeCombatMove(move, w.combat);
  const targetId = m.targetId;
  const targetEnemy = findLivingEnemy(w.combat, targetId) || firstLivingEnemy(w.combat);
  const targetEnemyName = String(targetEnemy?.name ?? '');
  const targetEnemyId = String(targetEnemy?.id ?? '');

  // CM2: Tick enemy conditions at start of round.
  const conditionTickSeed = seedFromString(`${w.meta?.seed || ''}|condtick|${w.time?.turn ?? 0}|${w.combat?.round ?? 0}`);
  const condTickRng = makeRng(conditionTickSeed);
  const condTickDeltas = [];
  const condTickSummary = [];
  for (const enemy of (w.combat?.enemies || [])) {
    if (!(enemy.hp > 0) || !Array.isArray(enemy.conditions) || enemy.conditions.length === 0) continue;
    const { conditions: newConds, tickResults } = tickConditions(enemy.conditions, enemy, w.combat?.round ?? 0, condTickRng);
    if (newConds !== enemy.conditions) {
      condTickDeltas.push({ op: 'combatState', enemyConditions: [{ id: enemy.id, conditions: newConds }] });
    }
    for (const tr of tickResults) {
      if (tr.damage > 0 && tr.damageType) {
        condTickDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: enemy.id, by: -tr.damage }] });
        condTickSummary.push(`${enemy.name} takes ${tr.damage} ${tr.damageType} (${tr.name})`);
      }
      if (tr.saved) {
        condTickSummary.push(`${enemy.name} saves against ${tr.name}`);
      }
    }
  }
  if (condTickDeltas.length) {
    w = applyDeltas(w, condTickDeltas);
  }

  // CM7: Reset legendary action remaining and reaction usesRemaining at round start.
  w = resetLegendaryAndReactions(w);

  // CM9: Process lair actions at round start (before entity turns).
  const lairSummary = [];
  w = processLairActions(w, lairSummary);

  const summaryParts = [...condTickSummary, ...lairSummary];
  const playerId = String(w.party?.[0]?.id ?? 'party');
  const playerWoundsAtStart = Number.isFinite(w.party?.[0]?.wounds) ? w.party[0].wounds : 0;

  // CM7: Pure initiative ordering. Walk initiativeOrder top-to-bottom.
  const initOrder = Array.isArray(w.combat?.initiativeOrder) ? w.combat.initiativeOrder : [];
  const counterSeed = seedFromString(`${w.meta?.seed || ''}|counter|${w.time?.turn ?? 0}|${w.combat?.round ?? 0}`);
  const counterRng = makeRng(counterSeed);

  let playerResolved = false;
  let result = null;
  let parleyEnded = false;
  let companionEndedCombat = false;
  const companionsResolved = new Set();
  let legTriggerIndex = 0;

  // Track guard state locally for the round.
  let playerGuardActive = Boolean(w.combat?.playerGuard);
  let companionGuardActive = Boolean(w.combat?.companionGuard);
  let playerGuardConsumed = false;
  let companionGuardConsumed = false;
  let partyIdx = 0;

  for (let slotIdx = 0; slotIdx < initOrder.length; slotIdx++) {
    const slot = initOrder[slotIdx];
    if (!w.combat?.active) break;

    if (slot.type === 'party' && slot.id === playerId && !playerResolved) {
      // ── Player's turn ──
      playerResolved = true;
      const moveResult = resolveMove(w, m);
      result = moveResult.result;
      w = applyDeltas(w, result.deltas);

      // Translate into combat effects.
      const combatDeltas = [];
      const currentTargetEnemy = findLivingEnemy(w.combat, targetId) || firstLivingEnemy(w.combat);

      if (currentTargetEnemy && result.outcome === 'success') {
        if (m.approachTag === 'force' || m.approachTag === 'finesse') {
          const attack = computeAttack(w.party?.[0]);
          const base = m.approachTag === 'force' ? FORCE_BASE : FINESSE_BASE;
          const weaponBonus = attack.damageBonus;
          let rawDmg = clampInt(base + Math.floor(result.margin / 2) + weaponBonus, 1, 20);
          const dmgType = attack.damageType;

          // CM7: Check reactions before applying damage.
          const reactionResult = checkEnemyReaction(
            w, currentTargetEnemy, m.approachTag, rawDmg, dmgType, counterRng, summaryParts
          );
          w = reactionResult.world;
          rawDmg = reactionResult.damage;

          if (rawDmg > 0) {
            const res = applyResistance(rawDmg, dmgType, currentTargetEnemy.resistances);
            // Apply trait-based damage reduction (Evasion, Uncanny Dodge, etc.)
            const traitFinal = res.heals ? res.final : applyDamageTakenTraits(currentTargetEnemy, res.final, dmgType);
            if (res.heals) {
              combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: currentTargetEnemy.id, by: traitFinal }] });
              summaryParts.push(`${m.approachTag} hit on ${currentTargetEnemy.name} — absorbed ${traitFinal} hp`);
            } else if (traitFinal === 0) {
              summaryParts.push(`${m.approachTag} hit on ${currentTargetEnemy.name} — immune to ${dmgType}`);
            } else {
              combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: currentTargetEnemy.id, by: -traitFinal }] });
              const suffix = res.level !== 'normal' ? ` (${res.level})` : '';
              summaryParts.push(`${m.approachTag} hit on ${currentTargetEnemy.name} for ${traitFinal}${suffix}`);
            }
          } else {
            summaryParts.push(`${m.approachTag} attack on ${currentTargetEnemy.name} — parried`);
          }
        } else if (m.approachTag === 'endure') {
          combatDeltas.push({ op: 'combatState', set: { playerGuard: true } });
          playerGuardActive = true;
          summaryParts.push('brace — next enemy strike softened');
        } else if (m.approachTag === 'heart') {
          if (currentTargetEnemy.canParley) {
            combatDeltas.push({ op: 'combatState', set: { active: false, round: 0, turnIndex: 0, reason: 'parley', playerGuard: false, companionGuard: false } });
            parleyEnded = true;
            summaryParts.push(`parley with ${currentTargetEnemy.name} succeeds — combat ends`);
          } else {
            combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: currentTargetEnemy.id, by: -HEART_FALLBACK_DAMAGE }] });
            summaryParts.push(`heart-appeal lands but ${currentTargetEnemy.name} is unmoved (${HEART_FALLBACK_DAMAGE})`);
          }
        } else if (m.approachTag === 'focus') {
          summaryParts.push(`study ${currentTargetEnemy.name} — maxHp ${currentTargetEnemy.maxHp}`);
        }
      } else if (currentTargetEnemy && result.outcome === 'mixed') {
        summaryParts.push(`${m.approachTag} grazes ${currentTargetEnemy.name}`);
      } else if (currentTargetEnemy) {
        summaryParts.push(`${m.approachTag} fails against ${currentTargetEnemy.name}`);
      }

      if (combatDeltas.length) {
        w = applyDeltas(w, combatDeltas);
      }

      if (parleyEnded) {
        w = pushTimeline(w, { kind: 'resolution', data: { outcome: 'parley', targetDefeated: '' } });
        w = pushTimeline(w, { kind: 'combat-end', data: { reason: 'parley' } });
        break;
      }

      // Check death traits before victory check.
      w = processDeathTraits(w, summaryParts);
      // Check victory after player turn.
      const aliveAfterPlayer = (w.combat?.enemies || []).filter(e => e.hp > 0);
      if (aliveAfterPlayer.length === 0 && w.combat?.active) {
        w = applyVictory(w);
        return {
          world: w,
          result: {
            ...result,
            combatSummary: summaryParts.join('; ') + ' — last enemy falls',
            mechanicsLine: `${result.mechanicsLine} | combat:victory`,
            targetEnemyName,
            targetEnemyId
          }
        };
      }

    } else if (slot.type === 'party' && slot.id !== playerId && !companionsResolved.has(slot.id)) {
      // ── Companion's turn ──
      companionsResolved.add(slot.id);
      if (typeof opts.afterPlayerTurn === 'function' && w.combat?.active) {
        // If the player hasn't resolved yet, defer companion processing.
        // Companions that go before the player still act in initiative order,
        // but the hook is called at their slot.
        const hookRes = opts.afterPlayerTurn(w, slot.id) || {};
        if (hookRes.world && typeof hookRes.world === 'object') {
          w = hookRes.world;
        }
        if (Array.isArray(hookRes.summaryParts)) {
          for (const s of hookRes.summaryParts) summaryParts.push(String(s));
        }
        if (!w.combat?.active) {
          companionEndedCombat = true;
          const endReason = String(w.combat?.reason || 'companion-parley');
          w = pushTimeline(w, { kind: 'resolution', data: { outcome: endReason, targetDefeated: '' } });
          w = pushTimeline(w, { kind: 'combat-end', data: { reason: endReason } });
          break;
        }
        // Check death traits before companion victory check.
        w = processDeathTraits(w, summaryParts);
        // Check victory after companion.
        const aliveAfterCompanion = (w.combat?.enemies || []).filter(e => e.hp > 0);
        if (aliveAfterCompanion.length === 0 && w.combat?.active) {
          // Ensure player result exists for return.
          if (!result) {
            const moveResult = resolveMove(w, m);
            result = moveResult.result;
            w = applyDeltas(w, result.deltas);
            playerResolved = true;
          }
          w = applyVictory(w);
          return {
            world: w,
            result: {
              ...result,
              combatSummary: summaryParts.join('; ') + ' — last enemy falls',
              mechanicsLine: `${result.mechanicsLine} | combat:victory`,
              targetEnemyName,
              targetEnemyId
            }
          };
        }
      }

    } else if (slot.type === 'enemy') {
      // ── Enemy's turn ──
      const e = (w.combat?.enemies || []).find(en => en.id === slot.id);
      if (!e || !(e.hp > 0)) { legTriggerIndex++; continue; }

      const eMods = getConditionModifiers(e.conditions || []);
      if (eMods.skipTurn) {
        summaryParts.push(`${e.name} is incapacitated — skips turn`);
        legTriggerIndex++;
        // Still check legendary after skipped turn.
        w = processLegendaryActions(w, e.id, counterRng, summaryParts, legTriggerIndex, partyIdx);
        continue;
      }

      // Trait hooks: onTurnStart (Regeneration, etc.)
      const turnStartResult = applyTurnStartTraits(e, w);
      if (turnStartResult.hpDelta !== 0) {
        w = applyDeltas(w, [{ op: 'combatState', enemyHpDelta: [{ id: e.id, by: turnStartResult.hpDelta }] }]);
      }
      for (const sp of turnStartResult.summaryParts) summaryParts.push(sp);

      const livingParty = (w.party || []).filter(p => p && (p.wounds ?? 0) < maxWounds(p.level ?? 1, statMod(p.stats?.GRIT ?? 10)));
      if (livingParty.length === 0) { legTriggerIndex++; continue; }
      const rawTarget = livingParty[partyIdx % livingParty.length];
      const baseAc = computeAC(rawTarget);
      // CM9: Apply sense overrides — enemy senses can adjust effective AC of target.
      const senseResult = applySenseOverrides(e, rawTarget);
      const targetMember = { ...rawTarget, ac: Math.max(0, baseAc - senseResult.toHitMod) };
      // The player reads as "you" in summaries, never by name — otherwise an enemy
      // sharing the PC's name produces "Sera hits Sera for 3".
      const tLabel = String(targetMember.id) === playerId ? 'you' : String(targetMember.name);
      partyIdx++;

      // P-75: phase-2 bosses fight differently (derived from hp, not stored).
      const ePhased = applyBossPhase(e);
      const enemyActions = Array.isArray(ePhased.actions) ? ePhased.actions : [];
      const counterDeltas = [];

      if (enemyActions.length > 0) {
        const actionsToResolve = pickActions(ePhased, enemyActions);
        let totalDmg = 0;
        const actionSummaries = [];

        for (const act of actionsToResolve) {
          const res = resolveAction(act, ePhased, targetMember, counterRng, w);

          if (res.hit) {
            totalDmg += res.damage;
            const critTag = res.critical ? ' (CRITICAL)' : '';
            const resTag = res.resistanceResult.level !== 'normal' ? ` [${res.resistanceResult.level}]` : '';
            actionSummaries.push(`${res.actionName} ${res.damage} ${res.damageType}${critTag}${resTag}`);

            if (res.conditionsApplied.length > 0) {
              const tgtConds = Array.isArray(targetMember.conditions) ? targetMember.conditions : [];
              const tgtImmunities = Array.isArray(targetMember.conditionImmunities) ? targetMember.conditionImmunities : [];
              for (const cond of res.conditionsApplied) {
                const applied = applyCondition(tgtConds, cond, tgtImmunities);
                if (applied !== tgtConds) {
                  counterDeltas.push({ op: 'condition', entityId: String(targetMember.id), cond });
                  actionSummaries.push(`applies ${cond.name}`);
                }
              }
            }
          } else if (res.saveResult) {
            if (res.damage > 0) {
              totalDmg += res.damage;
              actionSummaries.push(`${res.actionName} (saved, half) ${res.damage} ${res.damageType}`);
            } else {
              actionSummaries.push(`${res.actionName} — ${targetMember.name} saves`);
            }
          } else {
            actionSummaries.push(`${res.actionName} misses`);
          }
        }

        let dmg = totalDmg;
        if (playerGuardActive && !playerGuardConsumed) {
          dmg = Math.max(0, dmg - 1);
          playerGuardConsumed = true;
        } else if (companionGuardActive && !companionGuardConsumed) {
          dmg = Math.max(0, dmg - 1);
          companionGuardConsumed = true;
        }

        if (dmg > 0) {
          counterDeltas.push({ op: 'wound', entityId: String(targetMember.id), by: dmg });
        }
        summaryParts.push(`${e.name} → ${tLabel}: ${actionSummaries.join(', ')}`);
      } else {
        // Legacy flat damage fallback.
        let rawDmg = clampInt(e.damage, 1, 9999);
        const eDmgType = e.damageType || 'bludgeoning';
        const targetRes = targetMember.resistances || {};
        const eRes = applyResistance(rawDmg, eDmgType, targetRes);
        let dmg = eRes.heals ? 0 : eRes.final;
        if (playerGuardActive && !playerGuardConsumed) {
          dmg = Math.max(0, dmg - 1);
          playerGuardConsumed = true;
        } else if (companionGuardActive && !companionGuardConsumed) {
          dmg = Math.max(0, dmg - 1);
          companionGuardConsumed = true;
        }
        if (eRes.heals) {
          summaryParts.push(`${e.name} attacks ${tLabel} — ${eDmgType} absorbed`);
        } else if (eRes.final === 0) {
          summaryParts.push(`${e.name} attacks ${tLabel} — immune to ${eDmgType}`);
        } else if (dmg > 0) {
          counterDeltas.push({ op: 'wound', entityId: String(targetMember.id), by: dmg });
          const suffix = eRes.level !== 'normal' ? ` (${eRes.level})` : '';
          summaryParts.push(`${e.name} hits ${tLabel} for ${dmg}${suffix}`);
        }
      }

      if (counterDeltas.length) {
        w = applyDeltas(w, counterDeltas);
      }

      legTriggerIndex++;
    }

    // CM7: After each entity's turn, process legendary actions from eligible enemies.
    if (w.combat?.active && slot.type !== undefined) {
      w = processLegendaryActions(w, slot.id, counterRng, summaryParts, legTriggerIndex, partyIdx);
    }
  }

  // If player's move was not resolved via initiative (empty initiativeOrder or
  // player not in the list), resolve it now — backwards compat.
  if (!playerResolved && !parleyEnded && !companionEndedCombat) {
    const moveResult = resolveMove(w, m);
    result = moveResult.result;
    w = applyDeltas(w, result.deltas);
    playerResolved = true;

    // Translate combat effects (same as initiative-ordered player turn).
    const combatDeltas = [];
    const currentTargetEnemy = findLivingEnemy(w.combat, targetId) || firstLivingEnemy(w.combat);
    if (currentTargetEnemy && result.outcome === 'success') {
      if (m.approachTag === 'force' || m.approachTag === 'finesse') {
        const attack = computeAttack(w.party?.[0]);
        const base = m.approachTag === 'force' ? FORCE_BASE : FINESSE_BASE;
        const weaponBonus = attack.damageBonus;
        const rawDmg = clampInt(base + Math.floor(result.margin / 2) + weaponBonus, 1, 20);
        const res = applyResistance(rawDmg, attack.damageType, currentTargetEnemy.resistances);
        if (res.heals) {
          combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: currentTargetEnemy.id, by: res.final }] });
          summaryParts.push(`${m.approachTag} hit on ${currentTargetEnemy.name} — absorbed ${res.final} hp`);
        } else if (res.final === 0) {
          summaryParts.push(`${m.approachTag} hit on ${currentTargetEnemy.name} — immune to ${attack.damageType}`);
        } else {
          combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: currentTargetEnemy.id, by: -res.final }] });
          const suffix = res.level !== 'normal' ? ` (${res.level})` : '';
          summaryParts.push(`${m.approachTag} hit on ${currentTargetEnemy.name} for ${res.final}${suffix}`);
        }
      } else if (m.approachTag === 'endure') {
        combatDeltas.push({ op: 'combatState', set: { playerGuard: true } });
        playerGuardActive = true;
        summaryParts.push('brace — next enemy strike softened');
      } else if (m.approachTag === 'heart') {
        if (currentTargetEnemy.canParley) {
          combatDeltas.push({ op: 'combatState', set: { active: false, round: 0, turnIndex: 0, reason: 'parley', playerGuard: false, companionGuard: false } });
          parleyEnded = true;
          summaryParts.push(`parley with ${currentTargetEnemy.name} succeeds — combat ends`);
        } else {
          combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: currentTargetEnemy.id, by: -HEART_FALLBACK_DAMAGE }] });
          summaryParts.push(`heart-appeal lands but ${currentTargetEnemy.name} is unmoved (${HEART_FALLBACK_DAMAGE})`);
        }
      } else if (m.approachTag === 'focus') {
        summaryParts.push(`study ${currentTargetEnemy.name} — maxHp ${currentTargetEnemy.maxHp}`);
      }
    } else if (currentTargetEnemy && result.outcome === 'mixed') {
      summaryParts.push(`${m.approachTag} grazes ${currentTargetEnemy.name}`);
    } else if (currentTargetEnemy) {
      summaryParts.push(`${m.approachTag} fails against ${currentTargetEnemy.name}`);
    }
    if (combatDeltas.length) w = applyDeltas(w, combatDeltas);

    if (parleyEnded) {
      w = pushTimeline(w, { kind: 'resolution', data: { outcome: 'parley', targetDefeated: '' } });
      w = pushTimeline(w, { kind: 'combat-end', data: { reason: 'parley' } });
      return {
        world: w,
        result: {
          ...result,
          combatSummary: summaryParts.join('; ') || 'parley',
          mechanicsLine: `${result.mechanicsLine} | combat:parley`,
          targetEnemyName,
          targetEnemyId
        }
      };
    }

    // Check death traits before fallback victory check.
    w = processDeathTraits(w, summaryParts);
    // Check victory.
    const aliveAfterFallback = (w.combat?.enemies || []).filter(e => e.hp > 0);
    if (aliveAfterFallback.length === 0 && w.combat?.active) {
      w = applyVictory(w);
      return {
        world: w,
        result: {
          ...result,
          combatSummary: summaryParts.join('; ') + ' — last enemy falls',
          mechanicsLine: `${result.mechanicsLine} | combat:victory`,
          targetEnemyName,
          targetEnemyId
        }
      };
    }

    // Fallback: call companion hook if available (pre-CM7 compat).
    if (typeof opts.afterPlayerTurn === 'function' && w.combat?.active) {
      const hookRes = opts.afterPlayerTurn(w) || {};
      if (hookRes.world && typeof hookRes.world === 'object') {
        w = hookRes.world;
      }
      if (Array.isArray(hookRes.summaryParts)) {
        for (const s of hookRes.summaryParts) summaryParts.push(String(s));
      }
      if (!w.combat?.active) {
        companionEndedCombat = true;
        const endReason = String(w.combat?.reason || 'companion-parley');
        w = pushTimeline(w, { kind: 'resolution', data: { outcome: endReason, targetDefeated: '' } });
        w = pushTimeline(w, { kind: 'combat-end', data: { reason: endReason } });
        // Fall through to the return at the end.
      }
    }

    // Check death traits before companion victory check.
    w = processDeathTraits(w, summaryParts);
    // Check victory after companion.
    if (!companionEndedCombat && w.combat?.active) {
      const aliveAfterComp = (w.combat?.enemies || []).filter(e => e.hp > 0);
      if (aliveAfterComp.length === 0) {
        w = applyVictory(w);
        return {
          world: w,
          result: {
            ...result,
            combatSummary: summaryParts.join('; ') + ' — last enemy falls',
            mechanicsLine: `${result.mechanicsLine} | combat:victory`,
            targetEnemyName,
            targetEnemyId
          }
        };
      }
    }

    // Fallback: run remaining enemies that weren't in initiative order.
    if (!companionEndedCombat && w.combat?.active) {
      const initEnemyIds = new Set(initOrder.filter(s => s.type === 'enemy').map(s => s.id));
      const remainingEnemies = (w.combat?.enemies || []).filter(e => e.hp > 0 && !initEnemyIds.has(e.id));
      const fallbackDeltas = [];
      for (const e of remainingEnemies) {
        const eMods = getConditionModifiers(e.conditions || []);
        if (eMods.skipTurn) {
          summaryParts.push(`${e.name} is incapacitated — skips counter`);
          continue;
        }
        const livingParty = (w.party || []).filter(p => p && (p.wounds ?? 0) < maxWounds(p.level ?? 1, statMod(p.stats?.GRIT ?? 10)));
        if (livingParty.length === 0) break;
        const rawTarget = livingParty[partyIdx % livingParty.length];
        const targetMember = { ...rawTarget, ac: computeAC(rawTarget) };
        partyIdx++;
        const ePhased = applyBossPhase(e);
        const enemyActions = Array.isArray(ePhased.actions) ? ePhased.actions : [];
        if (enemyActions.length > 0) {
          const actionsToResolve = pickActions(ePhased, enemyActions);
          let totalDmg = 0;
          const actionSummaries = [];
          for (const act of actionsToResolve) {
            const res = resolveAction(act, ePhased, targetMember, counterRng, w);
            if (res.hit) {
              totalDmg += res.damage;
              actionSummaries.push(`${res.actionName} ${res.damage} ${res.damageType}`);
              if (res.conditionsApplied.length > 0) {
                const tgtConds = Array.isArray(targetMember.conditions) ? targetMember.conditions : [];
                const tgtImmunities = Array.isArray(targetMember.conditionImmunities) ? targetMember.conditionImmunities : [];
                for (const cond of res.conditionsApplied) {
                  const applied = applyCondition(tgtConds, cond, tgtImmunities);
                  if (applied !== tgtConds) {
                    fallbackDeltas.push({ op: 'condition', entityId: String(targetMember.id), cond });
                    actionSummaries.push(`applies ${cond.name}`);
                  }
                }
              }
            } else if (res.saveResult) {
              if (res.damage > 0) {
                totalDmg += res.damage;
                actionSummaries.push(`${res.actionName} (saved, half) ${res.damage} ${res.damageType}`);
              } else {
                actionSummaries.push(`${res.actionName} — ${targetMember.name} saves`);
              }
            } else {
              actionSummaries.push(`${res.actionName} misses`);
            }
          }
          let dmg = totalDmg;
          if (playerGuardActive && !playerGuardConsumed) {
            dmg = Math.max(0, dmg - 1);
            playerGuardConsumed = true;
          } else if (companionGuardActive && !companionGuardConsumed) {
            dmg = Math.max(0, dmg - 1);
            companionGuardConsumed = true;
          }
          if (dmg > 0) {
            fallbackDeltas.push({ op: 'wound', entityId: String(targetMember.id), by: dmg });
          }
          summaryParts.push(`${e.name} → ${targetMember.name}: ${actionSummaries.join(', ')}`);
        } else {
          let rawDmg = clampInt(e.damage, 1, 9999);
          const eDmgType = e.damageType || 'bludgeoning';
          const targetRes = targetMember.resistances || {};
          const eRes = applyResistance(rawDmg, eDmgType, targetRes);
          let dmg = eRes.heals ? 0 : eRes.final;
          if (playerGuardActive && !playerGuardConsumed) {
            dmg = Math.max(0, dmg - 1);
            playerGuardConsumed = true;
          } else if (companionGuardActive && !companionGuardConsumed) {
            dmg = Math.max(0, dmg - 1);
            companionGuardConsumed = true;
          }
          if (eRes.heals) {
            summaryParts.push(`${e.name} attacks ${targetMember.name} — ${eDmgType} absorbed`);
          } else if (eRes.final === 0) {
            summaryParts.push(`${e.name} attacks ${targetMember.name} — immune to ${eDmgType}`);
          } else if (dmg > 0) {
            fallbackDeltas.push({ op: 'wound', entityId: String(targetMember.id), by: dmg });
            const suffix = eRes.level !== 'normal' ? ` (${eRes.level})` : '';
            summaryParts.push(`${e.name} hits ${targetMember.name} for ${dmg}${suffix}`);
          }
        }
      }
      if (fallbackDeltas.length) w = applyDeltas(w, fallbackDeltas);
    }
  }

  // Consume guard flags if used.
  if (playerGuardConsumed || companionGuardConsumed) {
    w = applyDeltas(w, [{
      op: 'combatState',
      set: {
        playerGuard: playerGuardConsumed ? false : Boolean(w.combat?.playerGuard),
        companionGuard: companionGuardConsumed ? false : Boolean(w.combat?.companionGuard)
      }
    }]);
  }

  if (parleyEnded || companionEndedCombat) {
    const endReason = companionEndedCombat ? 'companion-end' : 'parley';
    return {
      world: w,
      result: {
        ...(result || { outcome: 'mixed', roll: 0, dc: 0, margin: 0, gains: [], costs: [], deltas: [], mechanicsLine: '' }),
        combatSummary: summaryParts.join('; ') || endReason,
        mechanicsLine: `${(result || {}).mechanicsLine || ''} | combat:${endReason}`,
        targetEnemyName,
        targetEnemyId
      }
    };
  }

  // Concentration break check.
  {
    const playerEntity = w.party?.[0];
    const playerWoundsNow = Number.isFinite(playerEntity?.wounds) ? playerEntity.wounds : 0;
    const playerDmgTaken = Math.max(0, playerWoundsNow - playerWoundsAtStart);
    const conc = playerEntity?.spells?.concentration;
    if (playerDmgTaken > 0 && conc && conc.spellRef) {
      const concDC = Math.max(10, Math.floor(playerDmgTaken * 2));
      const gritScore = playerEntity?.stats?.GRIT ?? 10;
      const gritMod = statMod(gritScore);
      const concSeed = seedFromString(`${w.meta?.seed || ''}|conc|${w.time?.turn ?? 0}|${w.combat?.round ?? 0}`);
      const concRng = makeRng(concSeed);
      const concRoll = concRng.int(1, 20) + gritMod;
      if (concRoll < concDC) {
        w = applyDeltas(w, [{ op: 'setConcentration', spellRef: '' }]);
        summaryParts.push(`concentration broken (rolled ${concRoll} vs DC ${concDC})`);
      }
    }
  }

  // Check for player defeat.
  const playerEntity0 = w.party?.[0];
  const playerWoundCap = maxWounds(playerEntity0?.level ?? 1, statMod(playerEntity0?.stats?.GRIT ?? 10));
  const partyWounds = clampInt(playerEntity0?.wounds ?? 0, 0, playerWoundCap);
  if (partyWounds >= playerWoundCap) {
    w = applyPlayerDefeat(w);
    return {
      world: w,
      result: {
        ...(result || { outcome: 'mixed', roll: 0, dc: 0, margin: 0, gains: [], costs: [], deltas: [], mechanicsLine: '' }),
        combatSummary: summaryParts.join('; ') + ' — you fall',
        mechanicsLine: `${(result || {}).mechanicsLine || ''} | combat:defeat`,
        targetEnemyName,
        targetEnemyId
      }
    };
  }

  // P-75: surface boss phase crossings as a narration beat, once per crossing.
  for (const crossing of detectPhaseCrossings(bossHpAtStart, w.combat?.enemies)) {
    summaryParts.push(crossing.narration);
  }

  // Advance round counter.
  w = applyDeltas(w, [{ op: 'combatState', set: { round: clampInt((w.combat?.round ?? 1) + 1, 0, 99), turnIndex: 0 } }]);

  return {
    world: w,
    result: {
      ...(result || { outcome: 'mixed', roll: 0, dc: 0, margin: 0, gains: [], costs: [], deltas: [], mechanicsLine: '' }),
      combatSummary: summaryParts.join('; '),
      mechanicsLine: `${(result || {}).mechanicsLine || ''} | combat:r${w.combat.round - 1}`,
      targetEnemyName,
      targetEnemyId
    }
  };
}

// ─��� CM7: Legendary actions ──────────────────────────────────────────────

/**
 * After each entity's turn, check if any OTHER enemy has legendaryActions
 * with remaining > 0. If so, spend the highest-cost affordable option.
 * Cap: one option per trigger point.
 */
function processLegendaryActions(world, triggerEntityId, rng, summaryParts, triggerIndex, partyIdx) {
  let w = world;
  const enemies = w.combat?.enemies || [];
  for (const e of enemies) {
    if (!(e.hp > 0)) continue;
    if (e.id === triggerEntityId) continue; // Can't use legendary on own turn.
    const la = e.legendaryActions;
    if (!la || la.remaining <= 0 || !Array.isArray(la.options) || la.options.length === 0) continue;

    // Pick highest-cost affordable option.
    const affordable = la.options.filter(o => o.cost <= la.remaining);
    if (affordable.length === 0) continue;
    affordable.sort((a, b) => b.cost - a.cost);
    const chosen = affordable[0];

    // Resolve the legendary action against a party target.
    const livingParty = (w.party || []).filter(p => p && (p.wounds ?? 0) < maxWounds(p.level ?? 1, statMod(p.stats?.GRIT ?? 10)));
    if (livingParty.length === 0) continue;
    const rawTarget = livingParty[partyIdx % livingParty.length];
    const targetMember = { ...rawTarget, ac: computeAC(rawTarget) };

    const legSeed = seedFromString(`${w.meta?.seed || ''}|leg|${w.combat?.round ?? 0}|${e.id}|${triggerIndex}`);
    const legRng = makeRng(legSeed);
    // P-75: fill flavor-only catalog payloads so legendary actions resolve.
    const res = resolveAction(resolveBossActionPayload(e, chosen), e, targetMember, legRng, w);

    // Decrement remaining.
    const newRemaining = la.remaining - chosen.cost;
    w = applyDeltas(w, [{
      op: 'combatState',
      enemyConditions: [{
        id: e.id,
        conditions: e.conditions // preserve conditions, just update legendaryActions via set
      }]
    }]);
    // Direct update of legendaryActions remaining via combat state manipulation.
    const updatedEnemies = (w.combat?.enemies || []).map(en => {
      if (en.id !== e.id) return en;
      return { ...en, legendaryActions: { ...en.legendaryActions, remaining: newRemaining } };
    });
    w = applyDeltas(w, [{ op: 'combatState', set: { enemies: updatedEnemies } }]);

    if (res.hit && res.damage > 0) {
      w = applyDeltas(w, [{ op: 'wound', entityId: String(targetMember.id), by: res.damage }]);
      summaryParts.push(`${e.name} legendary: ${chosen.name} hits ${targetMember.name} for ${res.damage} ${res.damageType}`);
    } else if (res.saveResult && res.damage > 0) {
      w = applyDeltas(w, [{ op: 'wound', entityId: String(targetMember.id), by: res.damage }]);
      summaryParts.push(`${e.name} legendary: ${chosen.name} (saved, half) ${res.damage} ${res.damageType}`);
    } else {
      summaryParts.push(`${e.name} legendary: ${chosen.name} misses`);
    }

    break; // One legendary action per trigger point.
  }
  return w;
}

/**
 * Reset legendaryActions.remaining and reaction usesRemaining at round start.
 */
function resetLegendaryAndReactions(world) {
  let w = world;
  const enemies = w.combat?.enemies || [];
  let needsUpdate = false;
  const updatedEnemies = enemies.map(e => {
    let changed = false;
    let newEnemy = e;

    if (e.legendaryActions && e.legendaryActions.remaining !== e.legendaryActions.perRound) {
      newEnemy = {
        ...newEnemy,
        legendaryActions: { ...newEnemy.legendaryActions, remaining: newEnemy.legendaryActions.perRound }
      };
      changed = true;
    }

    if (Array.isArray(e.reactions)) {
      const newReactions = e.reactions.map(r => {
        if (r.usesRemaining !== r.uses) return { ...r, usesRemaining: r.uses };
        return r;
      });
      if (newReactions.some((r, i) => r !== e.reactions[i])) {
        newEnemy = { ...newEnemy, reactions: newReactions };
        changed = true;
      }
    }

    if (changed) { needsUpdate = true; return newEnemy; }
    return e;
  });

  if (needsUpdate) {
    w = applyDeltas(w, [{ op: 'combatState', set: { enemies: updatedEnemies } }]);
  }
  return w;
}

// ── CM7: Reactions ──────────────────────────────────────────────────────

/**
 * Check if a targeted enemy has a reaction that matches the player's attack.
 * Returns { world, damage } where damage may be reduced to 0 if parried.
 */
function checkEnemyReaction(world, enemy, approachTag, damage, damageType, rng, summaryParts) {
  let w = world;
  if (!Array.isArray(enemy.reactions)) return { world: w, damage };

  const trigger = (approachTag === 'force') ? 'hit_by_melee' : (approachTag === 'finesse') ? 'hit_by_ranged' : null;
  if (!trigger) return { world: w, damage };

  for (const reaction of enemy.reactions) {
    if (reaction.trigger !== trigger) continue;
    if (reaction.usesRemaining <= 0) continue;

    const effect = reaction.effect && typeof reaction.effect === 'object' ? reaction.effect : {};

    // Decrement usesRemaining.
    const updatedEnemies = (w.combat?.enemies || []).map(en => {
      if (en.id !== enemy.id) return en;
      return {
        ...en,
        reactions: en.reactions.map(r => r.name === reaction.name ? { ...r, usesRemaining: r.usesRemaining - 1 } : r)
      };
    });
    w = applyDeltas(w, [{ op: 'combatState', set: { enemies: updatedEnemies } }]);

    // acBonus effect: enemy's effective AC was already beaten by the player, but
    // if adding acBonus would make it exceed the player's roll, the attack misses.
    if (typeof effect.acBonus === 'number' && effect.acBonus > 0) {
      summaryParts.push(`${enemy.name} reacts: ${reaction.name} (+${effect.acBonus} AC)`);
      // The player already "hit" — this is a retroactive parry. We reduce damage to 0.
      // This is a simplification: the reaction adds AC, making marginal hits miss.
      return { world: w, damage: 0 };
    }

    // damage effect: retaliatory damage.
    if (effect.damage) {
      const reactSeed = seedFromString(`${w.meta?.seed || ''}|react|${w.combat?.round ?? 0}|${enemy.id}`);
      const reactRng = makeRng(reactSeed);
      const dmgRolled = rollDice(effect.damage, reactRng);
      const reactDmg = Math.max(0, dmgRolled.total);
      if (reactDmg > 0) {
        const reactType = effect.damageType || 'bludgeoning';
        w = applyDeltas(w, [{ op: 'wound', entityId: String(w.party?.[0]?.id ?? 'party'), by: reactDmg }]);
        summaryParts.push(`${enemy.name} reacts: ${reaction.name} deals ${reactDmg} ${reactType}`);
      }
    }

    return { world: w, damage };
  }

  return { world: w, damage };
}

// ── CM9: Lair Actions ──────────────────────────────────────────────────

/**
 * Process lair actions at round start (initiative count 20, before entities).
 * Cycles through lair action options by round number.
 * One lair action per round from the first enemy that has them.
 */
function processLairActions(world, summaryParts) {
  let w = world;
  const enemies = w.combat?.enemies || [];
  const round = w.combat?.round ?? 1;

  for (const e of enemies) {
    if (!(e.hp > 0)) continue;
    if (!Array.isArray(e.lairActions) || e.lairActions.length === 0) continue;

    // Cycle through lair actions by round.
    const idx = (round - 1) % e.lairActions.length;
    const la = e.lairActions[idx];
    if (!la) continue;

    // Resolve the lair action against ALL living party members.
    const livingParty = (w.party || []).filter(p => p && (p.wounds ?? 0) < maxWounds(p.level ?? 1, statMod(p.stats?.GRIT ?? 10)));
    if (livingParty.length === 0) break;

    const lairSeed = seedFromString(`${w.meta?.seed || ''}|lair|${round}|${e.id}`);
    const lairRng = makeRng(lairSeed);
    const perMemberSummaries = [];

    for (const rawTarget of livingParty) {
      const targetMember = { ...rawTarget, ac: computeAC(rawTarget) };
      const res = resolveAction(resolveLairActionPayload(e, la), e, targetMember, lairRng, w);

      if (res.hit && res.damage > 0) {
        w = applyDeltas(w, [{ op: 'wound', entityId: String(targetMember.id), by: res.damage }]);
        perMemberSummaries.push(`${targetMember.name} takes ${res.damage} ${res.damageType}`);
      } else if (res.saveResult && res.damage > 0) {
        w = applyDeltas(w, [{ op: 'wound', entityId: String(targetMember.id), by: res.damage }]);
        perMemberSummaries.push(`${targetMember.name} saves, takes ${res.damage} ${res.damageType}`);
      } else {
        perMemberSummaries.push(`${targetMember.name} saves`);
      }
    }
    summaryParts.push(`Lair: ${la.name}: ${perMemberSummaries.join('; ')}`);

    break; // Only one lair action per round.
  }
  return w;
}

// ── internals ──────────────────────────────────────────────────────────────

function sortEnemiesByInitiative(enemies, initOrder) {
  if (!initOrder.length) return enemies;
  const posMap = {};
  for (let i = 0; i < initOrder.length; i++) {
    if (initOrder[i].type === 'enemy') {
      posMap[initOrder[i].id] = i;
    }
  }
  return [...enemies].sort((a, b) => {
    const posA = posMap[a.id] ?? 999;
    const posB = posMap[b.id] ?? 999;
    return posA - posB;
  });
}

function pickActions(enemy, actions) {
  const multi = Array.isArray(enemy.multiattack) ? enemy.multiattack : null;
  if (multi && multi.length > 0) {
    const actionMap = {};
    for (const a of actions) {
      if (a && a.name) actionMap[a.name.toLowerCase()] = a;
    }
    const resolved = [];
    for (const name of multi) {
      const act = actionMap[String(name).toLowerCase()];
      if (act) resolved.push(act);
    }
    return resolved.length > 0 ? resolved : [actions[0]];
  }
  return [actions[0]];
}

function normalizeCombatMove(move, combat) {
  const m = move && typeof move === 'object' ? move : {};
  const enemies = Array.isArray(combat?.enemies) ? combat.enemies : [];
  const firstAlive = enemies.find(e => e.hp > 0);
  let targetId = String(m.targetId ?? '');
  if (!targetId && firstAlive) targetId = firstAlive.id;
  return {
    actorId: String(m.actorId ?? 'party'),
    intentText: String(m.intentText ?? ''),
    approachTag: String(m.approachTag ?? 'force'),
    risk: clamp01(m.risk ?? 0.5),
    stakeTag: String(m.stakeTag ?? 'harm'),
    targetId,
    toolTag: m.toolTag ?? null
  };
}

function findLivingEnemy(combat, id) {
  const list = Array.isArray(combat?.enemies) ? combat.enemies : [];
  return list.find(e => e.hp > 0 && String(e.id) === String(id)) || null;
}

function firstLivingEnemy(combat) {
  const list = Array.isArray(combat?.enemies) ? combat.enemies : [];
  return list.find(e => e.hp > 0) || null;
}

/**
 * Check onDeath traits for enemies at 0 HP.
 * If a trait revives the enemy, heal it. Returns updated world + summary parts.
 * Tracks revived enemies via _traitRevived flag to prevent infinite revives.
 */
function processDeathTraits(world, summaryParts) {
  let w = world;
  const enemies = w.combat?.enemies || [];
  for (const e of enemies) {
    if (e.hp > 0 || e._traitRevived) continue;
    const deathResult = applyDeathTraits(e, w);
    for (const sp of deathResult.summaryParts) summaryParts.push(sp);
    if (deathResult.revive) {
      // Revive the enemy at the specified HP.
      const updatedEnemies = (w.combat?.enemies || []).map(en => {
        if (en.id !== e.id) return en;
        return { ...en, hp: deathResult.hpIfRevived, _traitRevived: true };
      });
      w = applyDeltas(w, [{ op: 'combatState', set: { enemies: updatedEnemies } }]);
    }
  }
  return w;
}

function applyVictory(world) {
  let w = world;
  const allIds = (w.combat?.enemies || []).map(e => e.id);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: false, round: 0, turnIndex: 0, reason: 'combat-victory', playerGuard: false, companionGuard: false },
    enemyDefeated: allIds
  }]);

  for (const e of (w.combat?.enemies || [])) {
    const ref = e.sourceNpcId || e.id;
    w = pushTimeline(w, {
      kind: 'resolution',
      data: { outcome: 'combat-victory', targetDefeated: ref, enemyId: e.id, enemyName: e.name }
    });
  }

  // CM5: loot rolling.
  const lootSeed = seedFromString(`${w.meta?.seed || ''}|loot|${w.time?.turn ?? 0}`);
  const lootRng = makeRng(lootSeed);
  const lootResults = [];
  const lootDeltas = [];
  let lootItemCounter = 0;
  for (const e of (w.combat?.enemies || [])) {
    const drops = rollLootForCR(e.cr ?? 0, lootRng, e.lootTableRef);
    for (const drop of drops) {
      if (!drop) continue;
      if (drop.kind === 'currency' && drop.currency && drop.amount) {
        const rolled = rollDice(drop.amount, lootRng);
        const amt = Math.max(0, rolled.total);
        if (amt > 0) {
          lootDeltas.push({ op: 'addCurrency', entityId: 'party', currency: drop.currency, amount: amt });
          lootResults.push({ kind: 'currency', currency: drop.currency, amount: amt, source: e.name });
        }
      } else if (drop.kind === 'item' && drop.defRef) {
        const itemId = `loot_${lootItemCounter}_${e.id}`;
        lootItemCounter++;
        // P-77 — magic gear lands sealed (parity with the live escape path).
        const sealed = sealLoot({ id: itemId, defRef: drop.defRef, equipped: null }, getItemDef(drop.defRef));
        lootDeltas.push({ op: 'addItem', entityId: 'party', item: sealed });
        lootResults.push({ kind: 'item', defRef: sealed.defRef, rarity: drop.rarity || 'common', source: e.name });
      }
    }
  }
  if (lootDeltas.length > 0) {
    w = applyDeltas(w, lootDeltas);
  }

  w = pushTimeline(w, { kind: 'combat-end', data: { reason: 'combat-victory', loot: lootResults } });
  const checked = checkGoals(w);
  return checked.world;
}

function applyPlayerDefeat(world) {
  let w = world;
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: false, round: 0, turnIndex: 0, reason: 'defeated-in-combat', playerGuard: false, companionGuard: false }
  }]);
  w = pushTimeline(w, { kind: 'combat-end', data: { reason: 'defeated-in-combat' } });

  const ending = {
    triggered: true,
    type: 'The Cost Paid',
    epilogueLine: 'Wizard: You fall in the fight. The world tilts grey, and the dark collects what was always its due.',
    locked: true,
    reason: 'defeated-in-combat'
  };
  w = { ...w, ending };
  return w;
}

function pushTimeline(world, { kind, data }) {
  const tl = Array.isArray(world.timeline) ? world.timeline : [];
  const t = tl.length;
  return { ...world, timeline: [...tl, { t, kind: String(kind), data: data ?? {} }] };
}

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
