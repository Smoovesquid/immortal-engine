// U455–U457 — CBT-AGENCY: a declared attack is never overridden by a fabricated action.
//
// Opus gate 2026-07-04-3 (both HIGH severity): a level-1 gravedigger PC declared a
// blade attack on Asha ("that GUARD leather looks worn — I draw my Worn Blade and
// swing at her. Roll it."), and the engine silently substituted a defensive force
// WARD — no attack roll, Asha's 8 HP untouched. On the player's explicit correction
// ("a gravedigger doesn't cast force WARDS — roll MY attack"), it warded AGAIN.
//
// Root cause: parseEscapeAction's ward branch matched the bare NOUNS "guard" (in
// "guard leather") and "ward" (in "force wards"), returning verb:'ward' before the
// declared attack could reach the strike default. Fix: a declared-attack detector
// (isDeclaredAttackText) short-circuits to 'strike' ahead of the cover/ward branches,
// so the defensive nouns in an attack sentence can no longer hijack the turn — while
// genuine defense-on-request ("raise my guard", "brace", "ward myself") still wards.
//
// THE_DM_TEST + D&D×XCOM: the declared action resolves AS DECLARED (attack roll vs
// AC, damage on hit, honest miss), or fails honestly in fiction. The machine never
// swaps in a different action class.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit, parseEscapeAction
} from '../engine/combat/escapeCombat.js';

// The gate's two exact lines (the acceptance evidence).
const GATE_LINE =
  "Asha, that guard leather looks well-worn — I'll test my luck. I draw my Worn Blade and swing at her. Roll it.";
const CORRECTION =
  "Hold on — I said I attacked Asha with my Worn Blade, but you had me stepping away and casting a ward instead. I never took that action. A gravedigger doesn't cast force wards anyway. Roll MY attack: Worn Blade against Asha's AC, and tell me the die result.";

// A level-1 gravedigger (no ward ability) versus a named foe, Asha, with a low AC so
// the swing lands and the enemy HP visibly decrements. Mirrors the U63 fight idiom.
function mkFight(seedKey, { ashaHp = 8, ashaAc = 12 } = {}) {
  let w = newWorld({ seed: seedKey, fate: 0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{ id: 'party', name: 'Gravedigger', stats: { MIGHT: 14, AGILITY: 12, GRIT: 12, CHARM: 10, WITS: 10 } }]
  });
  w = initEscapeHp(w);
  w = initEscapeKit(w);
  w = { ...w, meta: { ...w.meta, escapeHp: 20, escapeMaxHp: 20 } };
  const enemy = {
    name: 'Asha', hp: ashaHp, maxHp: ashaHp, damage: 3, ac: ashaAc,
    cr: 0.125, lootTableRef: null, canParley: true, defeated: false
  };
  return beginCombat(w, { enemies: [enemy], reason: 'ambush' });
}

const foeHp = (w) => Number(w.combat.enemies[0].hp) || 0;

describe('U455 — the gate line resolves an attack roll vs the named foe', () => {
  it('the exact gate line rolls Worn Blade vs Asha\'s AC and decrements Asha on hit', () => {
    const w0 = mkFight('u455-gate');
    const hp0 = foeHp(w0);
    const r = resolveEscapeCombatTurn(w0, GATE_LINE);

    // The mechanics line carries an attack roll vs AC (never a ward).
    assert.match(r.result.mechanicsLine, /\batk:\d+\s+vs\s+AC:\d+/, 'must show an attack roll vs AC');
    assert.ok(!/\bward\b/i.test(r.result.mechanicsLine), 'no ward may fire on a declared attack');
    // Asha (AC 12) is hit and takes damage — her HP drops.
    assert.ok(foeHp(r.world) < hp0, `Asha's HP must drop on a landed hit (was ${hp0}, now ${foeHp(r.world)})`);
  });

  it('resolves deterministically (identical seed → identical result) ×2', () => {
    const a = resolveEscapeCombatTurn(mkFight('u455-det'), GATE_LINE);
    const b = resolveEscapeCombatTurn(mkFight('u455-det'), GATE_LINE);
    assert.equal(a.result.mechanicsLine, b.result.mechanicsLine, 'mechanics line must be identical');
    assert.equal(foeHp(a.world), foeHp(b.world), 'foe HP must be identical');
  });
});

describe('U456 — a declared attack is NEVER substituted with a defensive action', () => {
  // Broad natural phrasings a player types to attack. Every one must classify as an
  // attack (strike) — none may fall into ward/cover.
  const ATTACK_PARAPHRASES = [
    GATE_LINE,
    CORRECTION,
    'I draw my Worn Blade and swing at her.',
    'I swing at Asha with my Worn Blade.',
    'I stab the bandit.',
    'I slash at it.',
    'I attack Asha.',
    'I hit her with my blade.',
    'I cut the guard down.',            // "guard" = the foe, an attack target
    'strike her down',
    'I lunge at the bandit',
    'hack at the wolf',
    'roll my attack against Asha\'s AC'
  ];

  it('every attack paraphrase classifies as a strike, never ward/cover', () => {
    for (const line of ATTACK_PARAPHRASES) {
      const { verb } = parseEscapeAction(line);
      assert.equal(verb, 'strike', `"${line}" must classify as strike, got ${verb}`);
    }
  });

  it('each attack paraphrase resolves an attack roll and no ward fires', () => {
    // A sturdy foe (60 HP) so a single ~7-dmg hit can't push it under the ≤25%
    // morale threshold — that keeps the surfaced mechanics line the STRIKE's
    // "atk vs AC" (not the enemy-fled line a dying foe would produce). The
    // fix under test is the verb class, which the strike-classification
    // assertion above already pins across the same paraphrase set.
    for (const line of ATTACK_PARAPHRASES) {
      const w0 = mkFight('u456-' + line.length, { ashaHp: 60, ashaAc: 12 });
      const hp0 = foeHp(w0);
      const r = resolveEscapeCombatTurn(w0, line);
      assert.match(r.result.mechanicsLine, /\batk:\d+\s+vs\s+AC:\d+/, `"${line}" must roll an attack vs AC`);
      assert.ok(!/\bward\b/i.test(r.result.mechanicsLine), `"${line}" must not fire a ward`);
      // Against AC 12 the swing lands on every seed here → the foe never heals.
      assert.ok(foeHp(r.world) <= hp0, `"${line}" must never HEAL the foe`);
    }
  });

  it('the explicit-correction turn resolves the attack (not another ward)', () => {
    const w0 = mkFight('u456-correction', { ashaHp: 60, ashaAc: 12 });
    const hp0 = foeHp(w0);
    const r = resolveEscapeCombatTurn(w0, CORRECTION);
    assert.equal(parseEscapeAction(CORRECTION).verb, 'strike', 'correction must classify as strike');
    assert.match(r.result.mechanicsLine, /\batk:\d+\s+vs\s+AC:\d+/, 'correction must roll an attack vs AC');
    assert.ok(!/\bward\b/i.test(r.result.mechanicsLine), 'correction must not fire a ward');
    assert.ok(foeHp(r.world) < hp0, 'correction must land damage on the foe');
  });
});

describe('U457 — honest fallback + defense-on-request regression', () => {
  it('genuine defensive phrasing still resolves a ward (regression)', () => {
    // Defense-on-request must be preserved: no attack verb of the player's own.
    for (const line of ['I raise my guard', 'I brace for the blow', 'I ward myself', 'parry his strike', 'I block his blow']) {
      assert.equal(parseEscapeAction(line).verb, 'ward', `"${line}" must still ward`);
    }
    const r = resolveEscapeCombatTurn(mkFight('u457-ward'), 'I raise my guard');
    assert.match(r.result.mechanicsLine, /\bward\b/, 'a requested guard must produce a ward mechanics line');
  });

  it('cover-on-request still resolves cover (regression)', () => {
    assert.equal(parseEscapeAction('take cover behind the crate').verb, 'cover');
    assert.equal(parseEscapeAction('hide behind the pillar').verb, 'cover');
  });

  it('unparseable combat input never substitutes a defensive action; only the enemy round changes', () => {
    // A line with no recognizable attack, defense, spell, tactic, or movement. The
    // engine must NOT fabricate a ward/cover — it defaults to a strike attempt (the
    // round always advances) and the foe is untouched-or-hit honestly, never healed.
    const w0 = mkFight('u457-unparse', { ashaAc: 40 }); // AC so high the swing misses → no fabricated defense masks it
    const hp0 = foeHp(w0);
    const pcHp0 = Number(w0.meta.escapeHp) || 0;
    const r = resolveEscapeCombatTurn(w0, 'hmm, what now');
    // No defensive action was silently substituted.
    assert.ok(!/\bward\b/i.test(r.result.mechanicsLine), 'no ward may be fabricated for unparseable input');
    assert.ok(!/\bcover\b/i.test(r.result.mechanicsLine), 'no cover may be fabricated for unparseable input');
    // The foe is not healed; state change is confined to the enemy round hitting the PC.
    assert.ok(foeHp(r.world) <= hp0, 'foe HP must not increase');
    assert.ok((Number(r.world.meta.escapeHp) || 0) <= pcHp0, 'the enemy round may only lower PC HP, never raise it via a fabricated ward');
  });
});
