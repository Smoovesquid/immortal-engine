/**
 * Pass 5 — Combat resolver.
 *
 * resolveCombatTurn(world, move) -> { world, result }
 *
 * Combat is not a parallel resolution system. It REUSES resolve.js (Pass 3)
 * for the player's approach roll, then translates the base outcome into
 * combat-specific effects: enemy HP damage, parley, focus advantage, defend.
 * After the player's turn, living enemies counter-attack deterministically.
 *
 * Pure: no LLM, no Math.random, no Date.now. All randomness comes from
 * resolveMove's seeded RNG.
 *
 * Approach signatures inside combat:
 *   force success    → enemy HP damage (base 3 + ⌊margin/2⌋, clamp 1..8)
 *   finesse success  → enemy HP damage (base 2 + ⌊margin/2⌋, clamp 1..8)
 *   endure success   → heal -1 stress; sets playerGuard (next counter -1)
 *   heart success    → parley → ends combat IF target enemy.canParley;
 *                      otherwise trivial 1 damage
 *   focus success    → no damage; arms studied-the-miss DC hook;
 *                      reveals enemy maxHp in mechanicsLine
 *   any failure/mixed → no enemy damage, the resolveMove deltas still apply
 *
 * Victory: when all enemies hp === 0, combat ends. One resolution event
 * per defeated enemy is pushed with data.targetDefeated = sourceNpcId || id.
 *
 * Defeat: when party[0].wounds === 6 after counters, combat ends and the
 * ending is locked with reason 'defeated-in-combat' (no new ending type).
 */

import { ensureWorld } from '../state.js';
import { resolveMove } from '../resolve.js';
import { applyDeltas } from '../effectsCore.js';
import { checkGoals } from '../goals/goalContract.js';
import { computeAttack } from '../gear/gearProps.js';

const FORCE_BASE = 3;
const FINESSE_BASE = 2;
const HEART_FALLBACK_DAMAGE = 1;

/**
 * resolveCombatTurn(world, move, opts?)
 *
 * opts.afterPlayerTurn — optional hook invoked AFTER player-turn combat
 *   effects have been applied but BEFORE the post-player victory check
 *   and the enemy counter phase. Signature: (world) => { world, summaryParts }
 *   where summaryParts is an optional array of strings appended to the
 *   combatSummary. Used by the playloop to interleave companion turns
 *   into the round: player → companions → counters.
 *
 *   If the hook ends combat (e.g. companion parley) the resolver short
 *   circuits before the counter phase, mirroring the player parley path.
 */
export function resolveCombatTurn(world, move, opts = {}) {
  let w = ensureWorld(world);

  if (!w.combat?.active || !Array.isArray(w.combat.enemies) || w.combat.enemies.length === 0) {
    // No-op result for the caller — should not be reached if playloop guards correctly.
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

  const m = normalizeCombatMove(move, w.combat);
  const targetId = m.targetId;
  const targetEnemy = findLivingEnemy(w.combat, targetId) || firstLivingEnemy(w.combat);

  // Pass B: surface the targeted enemy's identity on the result so the
  // composer (and any other downstream consumer) can mention them by name
  // without parsing free-form combatSummary text. Empty strings when no
  // single enemy is the focus (victory branch overrides below).
  const targetEnemyName = String(targetEnemy?.name ?? '');
  const targetEnemyId = String(targetEnemy?.id ?? '');

  // Player turn: delegate to the canonical resolver. This reuses Pass 3's
  // approach signatures, DC hooks, and seeded RNG. Do NOT reimplement.
  const { result } = resolveMove(w, m);
  w = applyDeltas(w, result.deltas);

  // Translate the base resolve into combat effects.
  const combatDeltas = [];
  const summaryParts = [];
  let parleyEnded = false;

  if (targetEnemy && result.outcome === 'success') {
    if (m.approachTag === 'force' || m.approachTag === 'finesse') {
      const base = m.approachTag === 'force' ? FORCE_BASE : FINESSE_BASE;
      const attack = computeAttack(w.party?.[0]);
      const weaponBonus = attack.damageBonus;
      const dmg = clampInt(base + Math.floor(result.margin / 2) + weaponBonus, 1, 20);
      combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: targetEnemy.id, by: -dmg }] });
      summaryParts.push(`${m.approachTag} hit on ${targetEnemy.name} for ${dmg}`);
    } else if (m.approachTag === 'endure') {
      // playerGuard one-shot: reduces next enemy counter by 1.
      combatDeltas.push({ op: 'combatState', set: { playerGuard: true } });
      summaryParts.push('brace — next enemy strike softened');
    } else if (m.approachTag === 'heart') {
      if (targetEnemy.canParley) {
        // Parley: combat ends, enemies are NOT marked defeated.
        // Defeat goals do NOT fire on parley.
        combatDeltas.push({ op: 'combatState', set: { active: false, round: 0, turnIndex: 0, reason: 'parley', playerGuard: false, companionGuard: false } });
        parleyEnded = true;
        summaryParts.push(`parley with ${targetEnemy.name} succeeds — combat ends`);
      } else {
        combatDeltas.push({ op: 'combatState', enemyHpDelta: [{ id: targetEnemy.id, by: -HEART_FALLBACK_DAMAGE }] });
        summaryParts.push(`heart-appeal lands but ${targetEnemy.name} is unmoved (${HEART_FALLBACK_DAMAGE})`);
      }
    } else if (m.approachTag === 'focus') {
      // Focus success arms the DC hook via Pass 3's existing addApproachSignature
      // (you:read-the-pattern). It also reveals enemy maxHp via summary.
      summaryParts.push(`study ${targetEnemy.name} — maxHp ${targetEnemy.maxHp}`);
    }
  } else if (targetEnemy && result.outcome === 'mixed') {
    summaryParts.push(`${m.approachTag} grazes ${targetEnemy.name}`);
  } else if (targetEnemy) {
    summaryParts.push(`${m.approachTag} fails against ${targetEnemy.name}`);
  }

  // Apply combat-translation deltas.
  if (combatDeltas.length) {
    w = applyDeltas(w, combatDeltas);
  }

  // Pass C2 — interleave hook: after the player's turn applies but before
  // the victory/counter phase, let the caller (playloop) run companion turns.
  // The hook may damage enemies, set companionGuard, or end combat via
  // companion parley. If combat ends inside the hook we short circuit
  // through the parley-style return below.
  let companionSummary = [];
  let companionEndedCombat = false;
  if (typeof opts.afterPlayerTurn === 'function' && !parleyEnded && w.combat?.active) {
    const hookRes = opts.afterPlayerTurn(w) || {};
    if (hookRes.world && typeof hookRes.world === 'object') {
      w = hookRes.world;
    }
    if (Array.isArray(hookRes.summaryParts)) {
      companionSummary = hookRes.summaryParts.map(String);
    }
    // If the companion hook ended combat (e.g. companion parley), surface
    // the end reason via a resolution event and short circuit past the
    // victory/counter phases.
    if (!w.combat?.active) {
      companionEndedCombat = true;
      const endReason = String(w.combat?.reason || 'companion-parley');
      w = pushTimeline(w, { kind: 'resolution', data: { outcome: endReason, targetDefeated: '' } });
      w = pushTimeline(w, { kind: 'combat-end', data: { reason: endReason } });
    }
  }

  if (companionSummary.length) {
    for (const s of companionSummary) summaryParts.push(s);
  }

  if (companionEndedCombat) {
    return {
      world: w,
      result: {
        ...result,
        combatSummary: summaryParts.join('; ') || 'companion ends combat',
        mechanicsLine: `${result.mechanicsLine} | combat:companion-end`,
        targetEnemyName,
        targetEnemyId
      }
    };
  }

  // After the player's turn, emit a parley resolution event if applicable.
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

  // Check victory: all enemies hp === 0?
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

  // Enemy counter-attacks: each living enemy in id-order deals enemy.damage
  // to a round-robin-selected living party member (player + companions).
  // playerGuard + companionGuard are both one-shots that each reduce one
  // counter by 1 — playerGuard consumes first, then companionGuard. Down
  // party members (wounds >= 6) are skipped as targets. If everyone is
  // down, the loop breaks and no counters land.
  const livingParty = (w.party || []).filter(p => p && (p.wounds ?? 0) < 6);
  const playerGuardActive = Boolean(w.combat?.playerGuard);
  const companionGuardActive = Boolean(w.combat?.companionGuard);
  let partyIdx = 0;
  let playerGuardConsumed = false;
  let companionGuardConsumed = false;
  const counterDeltas = [];
  for (const e of (w.combat?.enemies || [])) {
    if (!(e.hp > 0)) continue;
    if (livingParty.length === 0) break;
    const targetMember = livingParty[partyIdx % livingParty.length];
    partyIdx++;
    let dmg = clampInt(e.damage, 1, 6);
    if (playerGuardActive && !playerGuardConsumed) {
      dmg = Math.max(0, dmg - 1);
      playerGuardConsumed = true;
    } else if (companionGuardActive && !companionGuardConsumed) {
      dmg = Math.max(0, dmg - 1);
      companionGuardConsumed = true;
    }
    if (dmg > 0) {
      counterDeltas.push({ op: 'wound', entityId: String(targetMember.id), by: dmg });
      summaryParts.push(`${e.name} hits ${targetMember.name} for ${dmg}`);
    }
  }
  if (playerGuardConsumed || companionGuardConsumed) {
    counterDeltas.push({
      op: 'combatState',
      set: {
        playerGuard: playerGuardConsumed ? false : Boolean(w.combat?.playerGuard),
        companionGuard: companionGuardConsumed ? false : Boolean(w.combat?.companionGuard)
      }
    });
  }
  if (counterDeltas.length) {
    w = applyDeltas(w, counterDeltas);
  }

  // Check for player defeat.
  const partyWounds = clampInt(w.party?.[0]?.wounds ?? 0, 0, 6);
  if (partyWounds >= 6) {
    w = applyPlayerDefeat(w);
    return {
      world: w,
      result: {
        ...result,
        combatSummary: summaryParts.join('; ') + ' — you fall',
        mechanicsLine: `${result.mechanicsLine} | combat:defeat`,
        targetEnemyName,
        targetEnemyId
      }
    };
  }

  // Advance round counter.
  w = applyDeltas(w, [{ op: 'combatState', set: { round: clampInt((w.combat?.round ?? 1) + 1, 0, 99), turnIndex: 0 } }]);

  return {
    world: w,
    result: {
      ...result,
      combatSummary: summaryParts.join('; '),
      mechanicsLine: `${result.mechanicsLine} | combat:r${w.combat.round - 1}`,
      targetEnemyName,
      targetEnemyId
    }
  };
}

// ── internals ──────────────────────────────────────────────────────────────

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

function applyVictory(world) {
  let w = world;
  // Mark every enemy defeated and end combat in one delta op (avoids
  // intermediate active+empty invariant violations).
  const allIds = (w.combat?.enemies || []).map(e => e.id);
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: false, round: 0, turnIndex: 0, reason: 'combat-victory', playerGuard: false, companionGuard: false },
    enemyDefeated: allIds
  }]);

  // Emit one resolution event per defeated enemy (so the defeat goal kind
  // can satisfy via timelineRecordsDefeat). Use sourceNpcId when present
  // (defeat goals are typically authored against an NPC id, not a transient
  // enemy id), falling back to enemy id otherwise.
  for (const e of (w.combat?.enemies || [])) {
    const ref = e.sourceNpcId || e.id;
    w = pushTimeline(w, {
      kind: 'resolution',
      data: { outcome: 'combat-victory', targetDefeated: ref, enemyId: e.id, enemyName: e.name }
    });
  }
  // combat-end timeline marker for completeness
  w = pushTimeline(w, { kind: 'combat-end', data: { reason: 'combat-victory' } });

  // Promote any newly satisfied defeat goals.
  const checked = checkGoals(w);
  return checked.world;
}

function applyPlayerDefeat(world) {
  let w = world;
  // End combat (preserves enemies array with their final hp).
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: false, round: 0, turnIndex: 0, reason: 'defeated-in-combat', playerGuard: false, companionGuard: false }
  }]);
  w = pushTimeline(w, { kind: 'combat-end', data: { reason: 'defeated-in-combat' } });

  // Lock the ending. Reuses an existing ending type ('The Cost Paid') —
  // does NOT invent a new ending kind. The reason is recorded on the
  // ending object so the cause is recoverable.
  const ending = {
    triggered: true,
    type: 'The Cost Paid',
    epilogueLine: 'Wizard: You fall in the fight. The world tilts grey, and the dungeon collects what was always its due.',
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
