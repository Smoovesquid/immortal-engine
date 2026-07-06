// U296: DX-2a — tactical position confers combat mechanics (D&D × XCOM).
//
// Cover raises effective defense (+2 half / +5 full AC); flanking the defender
// or attacking from high ground confers advantage. The engine owns the number
// (tacticalMods.js); the DM narrates the read, never the modifier (THE LAW).
//
// These assert: the pure mapping, the schema + invariants, the resolvers
// honoring cover (→ effective AC / DC) and advantage (→ roll twice / +2), the
// deterministic sources (auto-flank + take-cover), determinism under replay,
// and the facts surfaced to the DM context with no numeric leak.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, defaultCombat, ensureCombat, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveMove } from '../engine/resolve.js';
import { resolveAction } from '../engine/combat/actionResolver.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { worldHash } from '../engine/worldHash.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';
import {
  coverAcBonus, effectiveAc, attackHasAdvantage, normalizeCover, normalizeTactical, defaultTactical
} from '../engine/combat/tacticalMods.js';

// ── helpers ──────────────────────────────────────────────────────────────────

function mkEnemy(over = {}) {
  return {
    id: 'enemy_0', name: 'Brigand', hp: 12, maxHp: 12, damage: 3, ac: 10, cr: 1,
    damageType: 'bludgeoning', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [], multiattack: null, saveProficiencies: [], canParley: true, defeated: false,
    sourceNpcId: 'npc_test_0', ...over
  };
}

function mkPartyMember(id, over = {}) {
  return {
    id, name: id, vibe: 'steady', archetype: 'wanderer', wounds: 0, stress: 0,
    resources: { Supply: 5 }, stats: { MIGHT: 12, AGILITY: 12, GRIT: 12, CHARM: 12, WITS: 12 },
    ...over
  };
}

// Build an active-combat world with the given party size.
function mkCombatWorld({ seed = 'u296', partySize = 1, enemies = [mkEnemy()] } = {}) {
  let w = newWorld({ seed, fate: 0.1, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const party = [];
  for (let i = 0; i < partySize; i++) party.push(mkPartyMember(i === 0 ? 'party' : `ally_${i}`, i === 0 ? {} : { companion: { role: 'guard' } }));
  w = ensureWorld({
    ...w,
    party,
    scene: { location: 'arena', objective: 'win', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  w = applyDeltas(w, [{ op: 'combatState', set: {
    active: true, round: 1, turnIndex: 0, enemies, beganAt: 0, reason: 'player-attack', playerGuard: false
  } }]);
  return w;
}

function mkMove(over = {}) {
  return { actorId: 'party', intentText: 'I attack.', approachTag: 'force', risk: 0.4, stakeTag: 'harm', targetId: 'enemy_0', toolTag: null, ...over };
}

// A stub rng yielding a fixed sequence, then repeating the last value.
function mkSeqRng(seq) {
  let i = 0;
  return { int: () => seq[Math.min(i++, seq.length - 1)] };
}

// ── 1: the engine-owned mapping ───────────────────────────────────────────────

test('U296-01: coverAcBonus is none 0 / half +2 / full +5', () => {
  assert.equal(coverAcBonus('none'), 0);
  assert.equal(coverAcBonus('half'), 2);
  assert.equal(coverAcBonus('full'), 5);
  assert.equal(coverAcBonus('garbage'), 0);
  assert.equal(effectiveAc(10, 'half'), 12);
  assert.equal(effectiveAc(10, 'full'), 15);
});

test('U296-02: advantage when flanked OR high ground', () => {
  assert.equal(attackHasAdvantage({ defenderFlanked: true }), true);
  assert.equal(attackHasAdvantage({ attackerHighGround: true }), true);
  assert.equal(attackHasAdvantage({ attackerHighGround: true, defenderFlanked: true }), true);
  assert.equal(attackHasAdvantage({}), false);
});

test('U296-03: normalizers coerce to valid defaults', () => {
  assert.equal(normalizeCover('weird'), 'none');
  assert.equal(normalizeCover('full'), 'full');
  assert.deepEqual(defaultTactical(), { cover: 'none', flanked: false, highGround: false });
  assert.deepEqual(normalizeTactical({ cover: 'half', flanked: 1, highGround: 0 }), { cover: 'half', flanked: true, highGround: false });
  assert.deepEqual(normalizeTactical(null), { cover: 'none', flanked: false, highGround: false });
});

// ── 2: schema + invariants ────────────────────────────────────────────────────

test('U296-04: fresh combat carries default tactical blocks; version bumped', () => {
  assert.equal(WORLD_VERSION, 32);
  const c = defaultCombat();
  assert.deepEqual(c.playerTactical, { cover: 'none', flanked: false, highGround: false });
  const w = mkCombatWorld();
  assert.deepEqual(w.combat.playerTactical, { cover: 'none', flanked: false, highGround: false });
  assert.deepEqual(w.combat.enemies[0].tactical, { cover: 'none', flanked: false, highGround: false });
  assert.doesNotThrow(() => assertWorldInvariants(w));
});

test('U296-05: tactical state round-trips through ensureCombat + combatState delta', () => {
  let w = mkCombatWorld();
  w = applyDeltas(w, [{ op: 'combatState', set: { playerTactical: { cover: 'full', flanked: false, highGround: true } } }]);
  assert.deepEqual(w.combat.playerTactical, { cover: 'full', flanked: false, highGround: true });
  // enemy tactical via enemies replacement
  const enemies = w.combat.enemies.map(e => ({ ...e, tactical: { ...e.tactical, flanked: true } }));
  w = applyDeltas(w, [{ op: 'combatState', set: { enemies } }]);
  assert.equal(w.combat.enemies[0].tactical.flanked, true);
  assert.doesNotThrow(() => assertWorldInvariants(w));
});

test('U296-06: a malformed tactical block fails invariants', () => {
  const w = mkCombatWorld();
  const bad = { ...w, combat: { ...w.combat, playerTactical: { cover: 'banana', flanked: false, highGround: false } } };
  assert.throws(() => assertWorldInvariants(bad), /playerTactical\.cover must be none\|half\|full/);
});

// ── 3: resolvers honor cover (effective AC / DC) ──────────────────────────────

test('U296-07: cover raises effective AC against an enemy attack (resolveAction)', () => {
  const act = { name: 'Strike', toHit: 0, damage: '1d4', type: 'bludgeoning' };
  // attackRoll fixed at 12; 12 + 0 = 12.
  const hit = resolveAction(act, {}, { ac: effectiveAc(12, 'none') }, mkSeqRng([12, 2]));
  assert.equal(hit.hit, true, 'no cover: 12 vs AC 12 hits');
  const half = resolveAction(act, {}, { ac: effectiveAc(12, 'half') }, mkSeqRng([12, 2]));
  assert.equal(half.hit, false, 'half cover (+2 → AC 14): 12 misses');
  const full = resolveAction(act, {}, { ac: effectiveAc(12, 'full') }, mkSeqRng([12, 2]));
  assert.equal(full.hit, false, 'full cover (+5 → AC 17): 12 misses');
});

test('U296-08: enemy cover raises the DC the player must beat (resolveMove)', () => {
  const w = mkCombatWorld();
  const base = resolveMove(w, mkMove()).result;
  const covered = resolveMove(w, mkMove({ tacticalDefenseBonus: coverAcBonus('half') })).result;
  // Same world/seed → same raw roll; only the DC moves, by exactly +2.
  assert.equal(covered.dc, base.dc + 2);
  assert.equal(covered.roll, base.roll);
  assert.equal(covered.margin, base.margin - 2);
});

// ── 4: resolvers honor advantage (flank / high ground) ────────────────────────

test('U296-09: advantage rolls the enemy attack twice and keeps the higher', () => {
  const act = { name: 'Strike', toHit: 0, damage: '1d4', type: 'bludgeoning' };
  // Two d20 draws 3 then 18; target AC 15.
  const noAdv = resolveAction(act, {}, { ac: 15 }, mkSeqRng([3, 18, 2]), null, { advantage: false });
  assert.equal(noAdv.hit, false, 'single roll 3 vs AC 15 misses');
  const adv = resolveAction(act, {}, { ac: 15 }, mkSeqRng([3, 18, 2]), null, { advantage: true });
  assert.equal(adv.hit, true, 'advantage keeps 18 → hits AC 15');
});

test('U296-10: tactical advantage adds +2 to the player roll (resolveMove)', () => {
  const w = mkCombatWorld();
  const base = resolveMove(w, mkMove()).result;
  const adv = resolveMove(w, mkMove({ tacticalAdvantage: true })).result;
  // Flat +2 (engine advantage model), not a token spend.
  assert.equal(adv.roll, Math.min(30, base.roll + 2));
  assert.equal(adv.dc, base.dc);
});

// ── 5: deterministic sources ──────────────────────────────────────────────────

test('U296-11: auto-flank — a party of >=2 conscious combatants flanks each enemy', () => {
  const solo = mkCombatWorld({ seed: 'flank-solo', partySize: 1 });
  const after1 = resolveCombatTurn(solo, mkMove({ approachTag: 'focus' })).world;
  assert.equal(after1.combat.enemies[0].tactical.flanked, false, 'solo party does not flank');

  const pair = mkCombatWorld({ seed: 'flank-pair', partySize: 2 });
  const after2 = resolveCombatTurn(pair, mkMove({ approachTag: 'focus' })).world;
  assert.equal(after2.combat.enemies[0].tactical.flanked, true, 'a party of two flanks the foe');
});

test('U296-12: take-cover source sets the player to half cover; melee breaks it', () => {
  let w = mkCombatWorld({ seed: 'cover-src' });
  w = resolveCombatTurn(w, mkMove({ approachTag: 'cover', intentText: 'I take cover.' })).world;
  assert.equal(w.combat.playerTactical.cover, 'half', 'taking cover sets half cover');
  w = resolveCombatTurn(w, mkMove({ approachTag: 'force', intentText: 'I strike.' })).world;
  assert.equal(w.combat.playerTactical.cover, 'none', 'a melee strike breaks cover');
});

// ── 6: determinism under replay ───────────────────────────────────────────────

test('U296-13: same seed + same move → identical worldHash (cover/flank active)', () => {
  const setup = () => {
    let w = mkCombatWorld({ seed: 'determinism', partySize: 2 });
    w = applyDeltas(w, [{ op: 'combatState', set: { playerTactical: { cover: 'half', flanked: false, highGround: true } } }]);
    return w;
  };
  const a = resolveCombatTurn(setup(), mkMove()).world;
  const b = resolveCombatTurn(setup(), mkMove()).world;
  assert.equal(worldHash(a), worldHash(b));
});

// ── 7: surfaced to the DM as state, never as a number ─────────────────────────

test('U296-14: ctx.combat carries the tactical facts; the prompt leaks no number', () => {
  let w = mkCombatWorld();
  const enemies = w.combat.enemies.map(e => ({ ...e, tactical: { cover: 'none', flanked: true, highGround: false } }));
  w = applyDeltas(w, [{ op: 'combatState', set: { enemies, playerTactical: { cover: 'half', flanked: false, highGround: false } } }]);
  // escapeHp present so the combat block renders a player line.
  w = { ...w, meta: { ...w.meta, escapeHp: 9, escapeMaxHp: 12 } };

  const ctx = buildNarratorContext(w, { mechanics: '[combat:r1]' });
  assert.equal(ctx.combat.inCombat, true);
  assert.equal(ctx.combat.enemies[0].tactical.flanked, true);
  assert.equal(ctx.combat.playerTactical.cover, 'half');

  const sys = buildSystemPrompt(ctx);
  // The facts are present as STATE...
  assert.match(sys, /position: [^\]]*flanked/, 'enemy flank surfaced');
  assert.match(sys, /position: [^\]]*cover=half/, 'player cover surfaced');
  // ...but the modifier numbers never are.
  assert.equal(/position: [^\]]*\+2/.test(sys), false, 'no +2 in the tactical tag');
  assert.equal(/position: [^\]]*\+5/.test(sys), false, 'no +5 in the tactical tag');
});
