// U113 — slot spells castable in escape combat: Magic Missile, Witch Bolt,
// Bless, Shield, Armor of Agathys. Each consumes a real 1st-level slot.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit,
  parseEscapeAction, escapeKitView
} from '../engine/combat/escapeCombat.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';

function pc5e(speciesId, classId, seed = 'u113') {
  return createCharacter5e({ seed: `${seed}|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard' });
}

function mkCombatWorld(pc, { enemyHp = 100, enemyCount = 1 } = {}) {
  const w0 = newWorld({ seed: 'u113', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
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

test('U113-01: slot spell verbs parse (witch bolt outranks the generic bolt)', () => {
  assert.equal(parseEscapeAction('magic missile').verb, 'missile');
  assert.equal(parseEscapeAction('cast magic missile at the bandit').verb, 'missile');
  assert.equal(parseEscapeAction('witch bolt the cultist').verb, 'witchbolt');
  assert.equal(parseEscapeAction('bolt').verb, 'firebolt', 'bare bolt stays a fire bolt');
  assert.equal(parseEscapeAction('bless me').verb, 'bless');
  assert.equal(parseEscapeAction('shield').verb, 'shield');
  assert.equal(parseEscapeAction('armor of agathys').verb, 'agathys');
  assert.equal(parseEscapeAction('guard').verb, 'ward');
});

test('U113-02: magic missile auto-hits and consumes a slot', () => {
  const wiz = pc5e('human', 'wizard');
  const w = mkCombatWorld(wiz);
  assert.equal(w.party[0].spells.slots[1], 2);
  const r = resolveEscapeCombatTurn(w, 'magic missile');
  assert.equal(r.world.party[0].spells.slots[1], 1, 'slot spent');
  const beat = r.result.beats.find(b => /darts of force/.test(b));
  assert.ok(beat, 'missile beat present');
  const dmg = Number(beat.match(/(\d+) force/)?.[1]);
  assert.ok(dmg >= 6 && dmg <= 15, `3x(1d4+1) in 6..15, got ${dmg}`);
  assert.ok(r.world.combat.enemies[0].hp < 100, 'damage landed without an attack roll');
});

test('U113-03: out of slots, the spell refuses', () => {
  const wiz = pc5e('human', 'wizard');
  let w = mkCombatWorld(wiz);
  w = resolveEscapeCombatTurn(w, 'missile').world;
  w = resolveEscapeCombatTurn(w, 'missile').world;
  assert.equal(w.party[0].spells.slots[1], 0);
  const r = resolveEscapeCombatTurn(w, 'missile');
  assert.ok(r.result.beats.some(b => /slots are spent/.test(b)));
  assert.equal(r.world.party[0].spells.slots[1], 0, 'no underflow');
});

test('U113-04: a fighter cannot cast magic missile', () => {
  const f = pc5e('human', 'fighter');
  const w = mkCombatWorld(f);
  const r = resolveEscapeCombatTurn(w, 'magic missile');
  assert.ok(r.result.beats.some(b => /not yours/.test(b)));
});

test('U113-05: witch bolt is an attack roll with the sheet spell bonus', () => {
  const wl = pc5e('tiefling', 'warlock');
  const w = mkCombatWorld(wl);
  const r = resolveEscapeCombatTurn(w, 'witch bolt');
  assert.equal(r.world.party[0].spells.slots[1], 0, 'warlock pact slot spent (1 at level 1)');
  assert.ok(r.result.beats.some(b => /lightning|grounds out/.test(b)), 'hit or miss, the bolt fired');
});

test('U113-06: bless sticks for the fight and refuses a double-cast', () => {
  const cleric = pc5e('human', 'cleric');
  let w = mkCombatWorld(cleric);
  const r1 = resolveEscapeCombatTurn(w, 'bless');
  assert.equal(r1.world.meta.escapeFeats.blessActive, true);
  assert.equal(r1.world.party[0].spells.slots[1], 1);
  const r2 = resolveEscapeCombatTurn(r1.world, 'bless');
  assert.ok(r2.result.beats.some(b => /already blessed/.test(b)));
  assert.equal(r2.world.party[0].spells.slots[1], 1, 'no second slot burned');
});

test('U113-07: shield the spell beats ward when known; guard stays guard', () => {
  const wiz = pc5e('human', 'wizard');
  const w = mkCombatWorld(wiz);
  const r = resolveEscapeCombatTurn(w, 'shield');
  assert.ok(r.result.beats.some(b => /plane of force.*\+5 AC/.test(b)), 'shield spell fired');
  assert.equal(r.world.party[0].spells.slots[1], 1, 'slot consumed');

  // A fighter saying "shield" just guards — no slot, +4.
  const f = pc5e('human', 'fighter');
  const wf = mkCombatWorld(f);
  const rf = resolveEscapeCombatTurn(wf, 'shield');
  assert.ok(rf.result.beats.some(b => /raise your guard/.test(b)));
});

test('U113-08: armor of agathys soaks damage and bites back', () => {
  const wl = pc5e('tiefling', 'warlock');
  let w = mkCombatWorld(wl, { enemyHp: 100 });
  const r1 = resolveEscapeCombatTurn(w, 'agathys');
  // The bandit swings in the same round, so the ice may already have soaked a
  // hit (and bitten back). The cast itself must announce 5 temp HP; whatever
  // remains is 0..5 and the flags must be coherent with each other.
  assert.ok(r1.result.beats.some(b => /Armor of Agathys \(5 temp HP/.test(b)), 'cast beat present');
  assert.equal(r1.world.party[0].spells.slots[1], 0, 'pact slot spent');
  const f1 = r1.world.meta.escapeFeats;
  assert.ok(f1.tempHp >= 0 && f1.tempHp <= 5);
  assert.equal(f1.agathysActive, f1.tempHp > 0, 'ice active iff temp HP remains');

  // Run turns until an enemy lands a hit on the ice (deterministic seeds).
  let cur = r1.world;
  let bitBack = false;
  for (let i = 0; i < 8 && cur.combat?.active; i++) {
    const r = resolveEscapeCombatTurn(cur, 'guard');
    cur = r.world;
    if (r.result.beats.some(b => /black ice/.test(b) && /bites back for 5 cold/.test(b))) { bitBack = true; break; }
  }
  if (bitBack) {
    assert.ok(cur.meta.escapeFeats.tempHp < 5, 'ice absorbed the hit');
  }
  // Whether or not the bandit connected in 8 rounds, state stays coherent.
  assertWorldInvariants(ensureWorld(JSON.parse(JSON.stringify(cur))));
});

test('U113-09: kit panel lists the slot spells with verbs', () => {
  const wiz = escapeKitView(pc5e('elf', 'wizard'));
  assert.ok(wiz.spells.some(s => s.name === 'Magic Missile'));
  assert.ok(wiz.spells.some(s => s.name === 'Shield'));
  const wl = escapeKitView(pc5e('tiefling', 'warlock'));
  assert.ok(wl.spells.some(s => s.name === 'Witch Bolt'));
  assert.ok(wl.spells.some(s => s.name === 'Armor of Agathys'));
  const cleric = escapeKitView(pc5e('dwarf', 'cleric'));
  assert.ok(cleric.spells.some(s => s.name === 'Bless'));
});

test('U113-10: determinism — identical casts, identical worlds', () => {
  const wiz = pc5e('human', 'wizard');
  const w = mkCombatWorld(wiz);
  const a = resolveEscapeCombatTurn(w, 'magic missile');
  const b = resolveEscapeCombatTurn(w, 'magic missile');
  assert.deepEqual(a.world, b.world);
  assert.deepEqual(a.result.beats, b.result.beats);
});
