// U299: DX-2d-i — the trait-as-code pipeline runs in the LIVE escape engine.
//
// combatResolve already ran engine/combat/traitHooks.js; escapeCombat (the engine
// v1.html actually plays) did NOT — enemy traits were dark in the shippable demo.
// DX-2d-i wires the six enemy-side hooks into escapeCombat:
//   - AC traits (Natural Armor / Shell…) raise the to-hit DC the player must beat;
//   - damage-taken traits (Evasion / Uncanny Dodge / auras) reduce damage taken;
//   - Regeneration heals the foe at the start of its turn;
//   - Pack/Flock Tactics lift the foe's to-hit while an ally still stands;
//   - onDeath traits (Undead Fortitude…) let a foe refuse to fall ONCE.
// THE LAW holds — the engine owns the number; the trait reaches the DM as fiction.
// Determinism holds — the folds are arithmetic on already-rolled values (no rng
// draw), so a trait-less foe is byte-identical and trait fights replay stably.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn, initEscapeHp } from '../engine/combat/escapeCombat.js';
import { worldHash } from '../engine/worldHash.js';

// Build a fresh escape fight with an arbitrary enemy roster.
function freshFightN(seed, enemies) {
  let w = newWorld({ seed, fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    meta: { ...w.meta, mode: 'escape' },
    party: [{ id: 'party', name: 'Sera', archetype: 'wanderer', wounds: 0, stress: 0,
      stats: { MIGHT: 13, AGILITY: 12, GRIT: 13, CHARM: 10, WITS: 11 } }],
    scene: { location: 'the millyard', objective: 'survive', time: 'dusk', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  w = initEscapeHp(w);
  w = beginCombat(w, { enemies, reason: 'ambush' });
  return w;
}
const freshFight = (seed, over = {}) =>
  freshFightN(seed, [{ name: 'Wolf', hp: 40, maxHp: 40, damage: 3, ac: 15, canParley: false, ...over }]);

// Stamp a traits array onto the live enemies (mirrors how a bestiary foe arrives).
const setTraits = (w, traits) => applyDeltas(w, [{ op: 'combatState', set: {
  enemies: w.combat.enemies.map(e => ({ ...e, traits }))
} }]);

const strikeSeg = (r) => /\[strike:[^\]]*\]/.exec(r.mechanicsLine || '')?.[0] || '';
const strikeAc = (r) => Number(/vs AC:(\d+)/.exec(strikeSeg(r))?.[1] ?? NaN);
const enemyHp = (w, i = 0) => Number(w.combat?.enemies?.[i]?.hp ?? 0);
const countEnemyHits = (r) => (String(r.mechanicsLine || '').match(/\[enemy:[^\]]*→ hit/g) || []).length;

function fightStrikes(w, n) {
  for (let i = 0; i < n; i++) {
    if (!w.combat?.active) break;
    w = resolveEscapeCombatTurn(w, 'I strike the wolf').world;
  }
  return w;
}

// ── 1: AC traits raise the to-hit DC the player must beat ──────────────────────

test('U299-01: Natural Armor (+1) / Shell Armor (+2) raise the effective AC', () => {
  const base = freshFight('na-ac', { ac: 14, hp: 400 });
  const acNone = strikeAc(resolveEscapeCombatTurn(base, 'I strike the wolf').result);
  const acNA = strikeAc(resolveEscapeCombatTurn(setTraits(base, ['Natural Armor']), 'I strike the wolf').result);
  const acShell = strikeAc(resolveEscapeCombatTurn(setTraits(base, ['Shell Armor']), 'I strike the wolf').result);
  assert.equal(acNA, acNone + 1, 'Natural Armor adds +1 AC');
  assert.equal(acShell, acNone + 2, 'Shell Armor adds +2 AC');
});

// ── 2: damage-taken traits reduce damage — the foe survives longer ─────────────

test('U299-02: Evasion halves / Uncanny Dodge shaves incoming damage', () => {
  const mk = (traits) => enemyHp(fightStrikes(setTraits(freshFight('ev', { hp: 500, ac: 8, damage: 1 }), traits), 6));
  const none = mk([]);
  const evasion = mk(['Evasion']);
  const uncanny = mk(['Uncanny Dodge']);
  assert.ok(evasion > none, `Evasion foe retains more hp (${evasion} > ${none})`);
  assert.ok(uncanny > none, `Uncanny Dodge foe retains more hp (${uncanny} > ${none})`);
});

// ── 3: Regeneration heals the foe at the start of its turn (clamped) ───────────

test('U299-03: Regeneration heals the foe at turn start, narrated as fiction', () => {
  const w = setTraits(freshFight('regen', { hp: 200, maxHp: 500, ac: 12, damage: 1 }), ['Regeneration (15 HP/round)']);
  const turn = resolveEscapeCombatTurn(w, 'I take cover');
  assert.equal(enemyHp(turn.world), 215, 'a Regeneration (15) foe gains 15 hp at turn start');
  assert.ok(turn.result.beats.some(b => /wounds close/.test(b)), 'the regen is narrated');
  assert.ok(!turn.result.beats.some(b => /Regeneration|HP\/round|15 HP/.test(b)), 'no trait label / number leak (THE LAW)');
});

test('U299-03b: Regeneration never overheals past maxHp', () => {
  const w = setTraits(freshFight('regen-clamp', { hp: 499, maxHp: 500, ac: 12, damage: 1 }), ['Regeneration (15 HP/round)']);
  const after = resolveEscapeCombatTurn(w, 'I take cover').world;
  assert.equal(enemyHp(after), 500, 'regen clamps to maxHp');
});

// ── 4: Pack Tactics lifts a foe's to-hit while an ally still stands ─────────────

test('U299-04: Pack Tactics raises hit count in aggregate (and is inert alone)', () => {
  let packTotal = 0, noPackTotal = 0;
  for (let i = 0; i < 80; i++) {
    const roster = (traits) => freshFightN(`pack-${i}`, [
      { name: 'Wolf', hp: 300, maxHp: 300, damage: 1, ac: 12, canParley: false, traits },
      { name: 'Boar', hp: 300, maxHp: 300, damage: 1, ac: 12, canParley: false, traits }
    ]);
    noPackTotal += countEnemyHits(resolveEscapeCombatTurn(roster([]), 'I take cover').result);
    packTotal += countEnemyHits(resolveEscapeCombatTurn(roster(['Pack Tactics']), 'I take cover').result);
  }
  assert.ok(packTotal > noPackTotal, `Pack Tactics lifts the pack's hit count (${packTotal} > ${noPackTotal})`);

  // A LONE Pack Tactics foe gets no bonus — inert without an ally, so its fight is
  // identical to a trait-less foe's (single attacker → no downstream rng shift).
  const lone = (traits) => countEnemyHits(
    resolveEscapeCombatTurn(freshFight('lone-pack', { hp: 300, ac: 12, damage: 1, traits }), 'I take cover').result
  );
  assert.equal(lone(['Pack Tactics']), lone([]), 'Pack Tactics is inert with no living ally');
});

// ── 5: Undead Fortitude — refuses to fall once, then dies ──────────────────────

test('U299-05: Undead Fortitude revives the foe once at 1 hp, then it falls', () => {
  // ac 1 → the strike always lands; hp/maxHp 1 → lethal, and a revived (1/1 = 100%)
  // foe never breaks morale, so we observe it standing back up.
  let w = setTraits(freshFight('undead', { hp: 1, maxHp: 1, ac: 1, damage: 1 }), ['Undead Fortitude']);
  const t1 = resolveEscapeCombatTurn(w, 'I strike the wolf');
  w = t1.world;
  const foe = w.combat.enemies[0];
  assert.ok(!foe.defeated, 'the foe is not marked defeated — it clawed back');
  assert.equal(foe.hp, 1, 'Undead Fortitude revives at 1 hp');
  assert.equal(foe._traitRevived, true, 'the one-shot revive is flagged');
  assert.ok(t1.result.beats.some(b => /will not stay down/.test(b)), 'the comeback is narrated');
  assert.ok(!t1.result.beats.some(b => /Undead Fortitude/.test(b)), 'no trait label leak (THE LAW)');

  // Second lethal blow — no second revive; the fight ends in victory.
  const t2 = resolveEscapeCombatTurn(w, 'I strike the wolf');
  assert.equal(t2.world.combat?.active ?? false, false, 'the foe is truly dead the second time');
});

// ── 6: determinism — trait-less is byte-identical; trait fights replay stably ───

test('U299-06: a hookless trait leaves the fight byte-identical', () => {
  // "Keen Smell" has no registered hook — the trait layer must be a pure no-op:
  // identical prose, identical enemy hp, identical player hp.
  const fight = (traits) => {
    let w = setTraits(freshFight('hookless', { hp: 300, ac: 10, damage: 1 }), traits);
    const a = resolveEscapeCombatTurn(w, 'I strike the wolf');
    const b = resolveEscapeCombatTurn(a.world, 'I strike the wolf');
    return { beats: [...a.result.beats, ...b.result.beats], hp: enemyHp(b.world), pcHp: Number(b.world.meta.escapeHp) };
  };
  const plain = fight([]);
  const hookless = fight(['Keen Smell']);
  assert.deepEqual(hookless.beats, plain.beats, 'a hookless trait does not change the prose');
  assert.equal(hookless.hp, plain.hp, 'a hookless trait does not change enemy hp');
  assert.equal(hookless.pcHp, plain.pcHp, 'a hookless trait does not change player hp');
});

test('U299-07: a trait fight replays to an identical worldHash', () => {
  const run = () => {
    let w = setTraits(freshFight('det-trait', { hp: 300, maxHp: 600, ac: 12, damage: 1 }),
      ['Regeneration (10 HP/round)', 'Natural Armor', 'Evasion']);
    w = resolveEscapeCombatTurn(w, 'I strike the wolf').world;
    w = resolveEscapeCombatTurn(w, 'I take cover').world;
    w = resolveEscapeCombatTurn(w, 'I strike the wolf').world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});
