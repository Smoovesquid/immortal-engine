// U298: DX-2c — tactics are two-sided and contested (D&D × XCOM, live engine).
//
// DX-2b gave the PLAYER tactics (take the high ground / flank → advantage). DX-2c
// makes it two-sided and breakable, all in the live escapeCombat engine:
//   - enemies start with cover (harder to hit) or the high ground (they strike
//     with advantage), sourced once at fight start (seeded);
//   - being outnumbered flanks the player → every foe strikes with advantage;
//   - positions are NOT permanent: the player flushes a foe out of cover, and a
//     pack overruns the player's high ground.
// THE LAW holds — the engine owns the number; the DM read narrates the position.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn, parseEscapeAction, initEscapeHp } from '../engine/combat/escapeCombat.js';
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

const setEnemyCover = (w, level) => applyDeltas(w, [{ op: 'combatState', set: {
  enemies: w.combat.enemies.map(e => ({ ...e, tactical: { ...e.tactical, cover: level } }))
} }]);
const setEnemyHighGround = (w) => applyDeltas(w, [{ op: 'combatState', set: {
  enemies: w.combat.enemies.map(e => ({ ...e, tactical: { ...e.tactical, highGround: true } }))
} }]);

const strikeSeg = (r) => /\[strike:[^\]]*\]/.exec(r.mechanicsLine || '')?.[0] || '';
const strikeAc = (r) => Number(/vs AC:(\d+)/.exec(strikeSeg(r))?.[1] ?? NaN);
const strikeHit = (r) => /→ hit/.test(strikeSeg(r));
// An enemy mech tag is pushed only on a landed enemy blow (a miss logs no tag).
const enemyHit = (r) => /\[enemy:[^\]]*→ hit/.test(r.mechanicsLine || '');

// ── 1: voice recognition ──────────────────────────────────────────────────────

test('U298-01: parseEscapeAction recognizes flush-cover intents (not as taking cover)', () => {
  for (const s of [
    'flush it out', 'flush them out', 'drive it from cover', 'force it out of cover',
    'break its cover', 'strip their cover', 'get around its cover', 'circle its cover',
    'get past their cover', 'out of cover with you'
  ]) {
    assert.equal(parseEscapeAction(s).verb, 'flushcover', s);
  }
  // Plain cover still reads as the PLAYER taking cover; DX-2b flank still flanks.
  assert.equal(parseEscapeAction('take cover').verb, 'cover');
  assert.equal(parseEscapeAction('duck behind the cart').verb, 'cover');
  assert.equal(parseEscapeAction('flank it').verb, 'flank');
  assert.equal(parseEscapeAction('circle behind the wolf').verb, 'flank');
});

// ── 2: a covered foe is harder to hit (enemy cover → +effective AC) ────────────

test('U298-02: enemy cover raises the effective AC the player must beat (+2 half / +5 full)', () => {
  const base = freshFight('cov-ac', { ac: 14, hp: 400 });
  const acNone = strikeAc(resolveEscapeCombatTurn(base, 'I strike the wolf').result);
  const acHalf = strikeAc(resolveEscapeCombatTurn(setEnemyCover(base, 'half'), 'I strike the wolf').result);
  const acFull = strikeAc(resolveEscapeCombatTurn(setEnemyCover(base, 'full'), 'I strike the wolf').result);
  assert.equal(acHalf, acNone + 2, 'half cover adds +2');
  assert.equal(acFull, acNone + 5, 'full cover adds +5');
});

test('U298-03: full cover turns some hits into misses, and never makes a foe easier to hit', () => {
  let flips = 0;
  for (let i = 0; i < 50; i++) {
    const base = freshFight(`cov-flip-${i}`, { ac: 13, hp: 600 });
    const plain = resolveEscapeCombatTurn(base, 'I strike the wolf').result;
    const covered = resolveEscapeCombatTurn(setEnemyCover(base, 'full'), 'I strike the wolf').result;
    const hitPlain = strikeHit(plain), hitCov = strikeHit(covered);
    assert.ok(!(hitCov && !hitPlain), `seed ${i}: cover must never turn a miss into a hit`);
    if (hitPlain && !hitCov) flips++;
  }
  assert.ok(flips > 0, 'full cover must turn at least one hit into a miss');
});

// ── 3: enemy high ground / player flanked → the enemy strikes with advantage ───

test('U298-04: enemy high ground gives the enemy advantage — never fewer hits, sometimes more', () => {
  let advExtra = 0;
  for (let i = 0; i < 60; i++) {
    const base = freshFight(`ehg-${i}`, { hp: 600, ac: 11, damage: 2 });
    const plain = resolveEscapeCombatTurn(base, 'I strike the wolf').result;
    const adv = resolveEscapeCombatTurn(setEnemyHighGround(base), 'I strike the wolf').result;
    const hp = enemyHit(plain), ha = enemyHit(adv);
    assert.ok(!(hp && !ha), `seed ${i}: advantage must not turn an enemy hit into a miss`);
    if (ha && !hp) advExtra++;
  }
  assert.ok(advExtra > 0, 'enemy advantage must land an otherwise-missed blow on some seed');
});

// ── 4: outnumbered = flanked (and it lifts when the pack is thinned) ───────────

test('U298-05: one foe does not flank; two conscious foes flank the player', () => {
  const solo = resolveEscapeCombatTurn(freshFight('flk-solo', { hp: 300 }), 'I take cover').world;
  assert.equal(solo.combat.playerTactical.flanked, false, 'a lone foe does not flank');

  const pack = resolveEscapeCombatTurn(freshFightN('flk-pack', [
    { name: 'Wolf', hp: 300, maxHp: 300, damage: 1, ac: 12, canParley: false },
    { name: 'Boar', hp: 300, maxHp: 300, damage: 1, ac: 12, canParley: false }
  ]), 'I take cover').world;
  assert.equal(pack.combat.playerTactical.flanked, true, 'two foes flank you');
});

test('U298-06: thinning the pack down to one lifts the flank (surround is contestable)', () => {
  // A weak straggler the strike kills outright, beside a foe that survives.
  const w = freshFightN('thin', [
    { name: 'Wolf', hp: 300, maxHp: 300, damage: 1, ac: 12, canParley: false },
    { name: 'Cur', hp: 1, maxHp: 1, damage: 1, ac: 1, canParley: false }
  ]);
  const after = resolveEscapeCombatTurn(w, 'I strike the cur').world;
  assert.equal(after.combat.enemies.find(e => e.name === 'Cur').defeated, true, 'the straggler drops');
  assert.equal(after.combat.playerTactical.flanked, false, 'down to one foe — no longer flanked');
});

// ── 5: contest — positions break (one each way) ───────────────────────────────

test('U298-07: the player flushes a foe out of cover (enemy position broken)', () => {
  let w = setEnemyCover(freshFight('flush', { hp: 300 }), 'full');
  assert.equal(w.combat.enemies[0].tactical.cover, 'full');
  w = resolveEscapeCombatTurn(w, 'I drive it out of cover').world;
  assert.equal(w.combat.enemies[0].tactical.cover, 'none', 'flushing clears the foe cover');
});

test('U298-08: a lone foe never breaks the high ground; a flanking pack overruns it', () => {
  // 1v1: the rise holds within the fight (DX-2b invariant preserved).
  let solo = freshFight('hg-hold', { hp: 400, damage: 1 });
  solo = resolveEscapeCombatTurn(solo, 'I take the high ground').world;
  assert.equal(solo.combat.playerTactical.highGround, true);
  solo = resolveEscapeCombatTurn(solo, 'I strike the wolf').world;
  assert.equal(solo.combat.playerTactical.highGround, true, '1v1 high ground holds');

  // Pack: you hold the rise the turn you claim it (you keep this turn's payoff),
  // then a non-claim turn while flanked overruns it.
  let pack = freshFightN('hg-break', [
    { name: 'Wolf', hp: 400, maxHp: 400, damage: 1, ac: 12, canParley: false },
    { name: 'Boar', hp: 400, maxHp: 400, damage: 1, ac: 12, canParley: false }
  ]);
  pack = resolveEscapeCombatTurn(pack, 'I take the high ground').world;
  assert.equal(pack.combat.playerTactical.highGround, true, 'you hold the rise the turn you take it');
  assert.equal(pack.combat.playerTactical.flanked, true, 'two foes flank you');
  pack = resolveEscapeCombatTurn(pack, 'I strike the wolf').world;
  assert.equal(pack.combat.playerTactical.highGround, false, 'the pack overruns the high ground');
});

// ── 6: enemy tactical is SOURCED at fight start (seeded, deterministic) ────────

test('U298-09: a perched foe reliably seizes terrain at fight start, deterministically', () => {
  const sourced = (seed) => resolveEscapeCombatTurn(
    freshFight(seed, { name: 'Archer', hp: 80, maxHp: 80, damage: 2, ac: 14 }),
    'I take cover'
  ).world.combat.enemies[0].tactical;

  let withTerrain = 0;
  for (let i = 0; i < 30; i++) {
    const t = sourced(`src-${i}`);
    if (t.cover !== 'none' || t.highGround) withTerrain++;
  }
  assert.ok(withTerrain >= 20, `most perched foes take terrain (got ${withTerrain}/30)`);

  // Same seed → identical sourcing.
  assert.deepEqual(sourced('src-fixed'), sourced('src-fixed'));

  // A plain foe in the open mostly stays in the open (the bulk of fights are
  // non-tactical, so their rng streams are untouched).
  let plainTerrain = 0;
  for (let i = 0; i < 30; i++) {
    const t = resolveEscapeCombatTurn(freshFight(`plain-${i}`, { hp: 80 }), 'I take cover').world.combat.enemies[0].tactical;
    if (t.cover !== 'none' || t.highGround) plainTerrain++;
  }
  assert.ok(plainTerrain <= 12, `common foes rarely seize terrain (got ${plainTerrain}/30)`);
});

// ── 7: determinism under replay ───────────────────────────────────────────────

test('U298-10: same seed + same spoken sequence → identical worldHash (two-sided tactics)', () => {
  const run = () => {
    let w = freshFightN('det2c', [
      { name: 'Archer', hp: 80, maxHp: 80, damage: 2, ac: 14, canParley: false },
      { name: 'Wolf', hp: 80, maxHp: 80, damage: 2, ac: 13, canParley: false }
    ]);
    w = resolveEscapeCombatTurn(w, 'I take the high ground').world;
    w = resolveEscapeCombatTurn(w, 'I drive it out of cover').world;
    w = resolveEscapeCombatTurn(w, 'I strike the wolf').world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});
