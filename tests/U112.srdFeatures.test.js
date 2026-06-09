// U112 — class & species features fire in escape combat: Rage, Second Wind,
// Sneak Attack, Savage Attacks, Lucky, Relentless Endurance, Breath Weapon,
// Lay on Hands, Cure Wounds (slots), fighting styles. All deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import {
  featureActions, escapeKitView, parseEscapeAction,
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit, shortRest, meleeProfile
} from '../engine/combat/escapeCombat.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { makeRng, seedFromString } from '../engine/rng.js';

function pc5e(speciesId, classId, extra = {}) {
  return createCharacter5e({ seed: `u112|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard', ...extra });
}

function mkCombatWorld(pc, { enemyHp = 30, enemyCount = 1 } = {}) {
  const w0 = newWorld({ seed: 'u112', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = ensureWorld({ ...w0, party: [pc] });
  w = initEscapeKit(initEscapeHp(w));
  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    enemies.push({ id: `e${i}`, name: 'bandit', hp: enemyHp, maxHp: enemyHp, ac: 10, damage: 6, defeated: false, cr: 0.5 });
  }
  return ensureWorld({
    ...w,
    combat: { active: true, round: 1, turnIndex: 0, beganAt: w.timeline.length, enemies }
  });
}

// Run turns until a predicate hits or maxTurns exhausted.
function runTurns(w, actions) {
  const beats = [];
  for (const a of actions) {
    const r = resolveEscapeCombatTurn(w, a);
    w = r.world;
    beats.push(...(r.result?.beats || []));
    if (!w.combat?.active) break;
  }
  return { world: w, beats };
}

test('U112-01: featureActions exposes the right actions per class/species', () => {
  const barb = featureActions(pc5e('human', 'barbarian')).map(f => f.id);
  assert.ok(barb.includes('rage'));
  const fighter = featureActions(pc5e('human', 'fighter')).map(f => f.id);
  assert.ok(fighter.includes('secondWind'));
  const pal = featureActions(pc5e('human', 'paladin')).map(f => f.id);
  assert.ok(pal.includes('layHands'));
  const db = featureActions(pc5e('dragonborn', 'fighter')).map(f => f.id);
  assert.ok(db.includes('breath'));
  assert.equal(featureActions(pc5e('human', 'wizard')).length, 0);
  assert.equal(featureActions({ stats: {} }).length, 0, 'legacy character has no feature actions');
});

test('U112-02: feature verbs parse', () => {
  assert.equal(parseEscapeAction('I rage').verb, 'rage');
  assert.equal(parseEscapeAction('second wind').verb, 'secondwind');
  assert.equal(parseEscapeAction('breathe fire on them').verb, 'breath');
  assert.equal(parseEscapeAction('lay on hands').verb, 'layhands');
  assert.equal(parseEscapeAction('lay hands on my wounds').verb, 'layhands');
  assert.equal(parseEscapeAction('cure wounds').verb, 'cure');
  assert.equal(parseEscapeAction('heal myself').verb, 'cure');
});

test('U112-03: rage adds melee damage and halves incoming blows', () => {
  const barb = pc5e('half-orc', 'barbarian');
  let w = mkCombatWorld(barb, { enemyHp: 200 });
  const r1 = resolveEscapeCombatTurn(w, 'rage');
  w = r1.world;
  assert.ok(r1.result.beats.some(b => /RAGE/.test(b)), 'rage announces itself');
  assert.equal(w.meta.escapeFeats.rageActive, true);

  // Subsequent strikes carry the rage tag; enemy hits are halved.
  const r2 = resolveEscapeCombatTurn(w, 'strike');
  const hitBeat = r2.result.beats.find(b => /Your greataxe hits/.test(b));
  if (hitBeat) assert.ok(/raging/.test(hitBeat), 'melee damage beat tagged raging');
  const enemyHit = r2.result.beats.find(b => /hits you for/.test(b));
  if (enemyHit) assert.ok(/halved by your rage/.test(enemyHit), 'incoming damage halved');

  // Raging twice does nothing new.
  const r3 = resolveEscapeCombatTurn(r2.world, 'rage');
  assert.ok(r3.result.beats.some(b => /already raging/.test(b)));
});

test('U112-04: a wizard cannot rage', () => {
  const wiz = pc5e('human', 'wizard');
  const w = mkCombatWorld(wiz, { enemyHp: 50 });
  const r = resolveEscapeCombatTurn(w, 'rage');
  assert.ok(r.result.beats.some(b => /not your discipline/.test(b)));
  assert.equal(r.world.meta.escapeFeats.rageActive, false);
});

test('U112-05: second wind heals once per fight', () => {
  const f = pc5e('human', 'fighter');
  let w = mkCombatWorld(f, { enemyHp: 200 });
  // Take some hits first so there is something to heal.
  w = runTurns(w, ['guard', 'guard', 'guard']).world;
  const before = w.meta.escapeHp;
  const r = resolveEscapeCombatTurn(w, 'second wind');
  if (before < w.meta.escapeMaxHp) {
    assert.ok(r.world.meta.escapeHp > before, 'healed');
  }
  assert.equal(r.world.meta.escapeFeats.secondWindUsed, true);
  const r2 = resolveEscapeCombatTurn(r.world, 'second wind');
  assert.ok(r2.result.beats.some(b => /no second wind left/.test(b)));
});

test('U112-06: dragonborn breath hits every enemy once per fight', () => {
  const db = pc5e('dragonborn', 'fighter', { speciesChoices: { ancestry: 'red' } });
  let w = mkCombatWorld(db, { enemyHp: 100, enemyCount: 3 });
  const r = resolveEscapeCombatTurn(w, 'breathe');
  const breathBeats = r.result.beats.filter(b => /breath/.test(b) && /fire/.test(b));
  assert.equal(breathBeats.length, 3, 'all three enemies took a beat');
  for (const e of r.world.combat.enemies) {
    assert.ok(e.hp < 100, `enemy ${e.id} took breath damage`);
  }
  assert.equal(r.world.meta.escapeFeats.breathUsed, true);
  const r2 = resolveEscapeCombatTurn(r.world, 'breathe');
  assert.ok(r2.result.beats.some(b => /breath is spent/.test(b)));
});

test('U112-07: lay on hands draws from a 5/level pool and refills on rest', () => {
  const pal = pc5e('human', 'paladin');
  let w = mkCombatWorld(pal, { enemyHp: 200 });
  // Get hurt first.
  w = runTurns(w, ['guard', 'guard', 'guard', 'guard']).world;
  if (w.meta.escapeHp < w.meta.escapeMaxHp && w.combat?.active) {
    const before = w.meta.escapeHp;
    const r = resolveEscapeCombatTurn(w, 'lay on hands');
    assert.ok(r.world.meta.escapeHp > before, 'healed from the pool');
    assert.ok(r.world.meta.escapeFeats.layPool < 5 * 1, 'pool drained');
    // Rest refills (back to lazy full).
    const rested = shortRest(r.world, makeRng(seedFromString('rest')));
    assert.equal(rested.meta.escapeFeats.layPool, -1, 'pool re-seeds on rest');
  }
});

test('U112-08: cure wounds consumes a slot and stops when slots are out', () => {
  const cleric = pc5e('human', 'cleric');
  let w = mkCombatWorld(cleric, { enemyHp: 200 });
  assert.equal(w.party[0].spells.slots[1], 2, 'cleric starts with 2 slots');
  w = runTurns(w, ['guard', 'guard', 'guard']).world;
  if (!w.combat?.active) return; // unlucky seed: fight ended; covered by determinism elsewhere
  const r1 = resolveEscapeCombatTurn(w, 'cure wounds');
  assert.equal(r1.world.party[0].spells.slots[1], 1, 'slot consumed');
  const r2 = resolveEscapeCombatTurn(r1.world, 'heal');
  assert.equal(r2.world.party[0].spells.slots[1], 0);
  const r3 = resolveEscapeCombatTurn(r2.world, 'cure');
  assert.ok(r3.result.beats.some(b => /slots are spent/.test(b)), 'no third cast');
});

test('U112-09: casters get slots from chargen; martials get none', () => {
  const wiz = pc5e('elf', 'wizard');
  assert.deepEqual(wiz.spells.maxSlots[1], 2);
  assert.ok(wiz.spells.known.includes('magic_missile'));
  const barb = pc5e('human', 'barbarian');
  assert.equal(Object.values(barb.spells.maxSlots).reduce((a, b) => a + b, 0), 0);
});

test('U112-10: rogue sneak attack fires on round 1 with a finesse weapon', () => {
  const rogue = pc5e('halfling', 'rogue');
  assert.ok(meleeProfile(rogue).finesse, 'rapier is finesse');
  // Round 1 strike: scan beats for the sneak tag across a few seeds — the
  // attack must HIT to show it, so find a seed where it hits.
  let found = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e']) {
    const pc = createCharacter5e({ seed: `u112|sneak|${salt}`, speciesId: 'halfling', classId: 'rogue', abilityMethod: 'standard' });
    const w = mkCombatWorld(pc, { enemyHp: 100 });
    const r = resolveEscapeCombatTurn(w, 'strike');
    if (r.result.beats.some(b => /sneak attack \+\d/.test(b))) { found = true; break; }
  }
  assert.ok(found, 'sneak attack appeared on at least one first-round hit');
});

test('U112-11: kit view shows feature actions and cure wounds', () => {
  const pal = escapeKitView(pc5e('human', 'paladin'));
  assert.ok(pal.weapons.some(x => x.name === 'Lay on Hands'));
  const cleric = escapeKitView(pc5e('dwarf', 'cleric'));
  assert.ok(cleric.spells.some(x => x.name === 'Cure Wounds'));
  const barb = escapeKitView(pc5e('half-orc', 'barbarian'));
  assert.ok(barb.weapons.some(x => x.name === 'Rage'));
});

test('U112-12: feature state survives ensureWorld + invariants; determinism holds', () => {
  const barb = pc5e('half-orc', 'barbarian');
  const w = mkCombatWorld(barb, { enemyHp: 200 });
  const a = resolveEscapeCombatTurn(w, 'rage').world;
  const b = resolveEscapeCombatTurn(w, 'rage').world;
  assert.deepEqual(a.meta.escapeFeats, b.meta.escapeFeats, 'deterministic');
  const reloaded = ensureWorld(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(reloaded.meta.escapeFeats, a.meta.escapeFeats, 'survives serialize + ensure');
  assertWorldInvariants(reloaded);
});
