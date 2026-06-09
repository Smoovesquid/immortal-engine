// U116 — the advancement loop: XP by CR, level-ups with recomputed sheets,
// and the level-2 features that fire (Action Surge, Reckless Attack, Divine
// Smite, Agonizing Blast, Song of Rest).

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import { xpForCR, xpForEnemies } from '../engine/ruleset/core/xp.js';
import { levelUpSheet, levelForXp, xpToNext } from '../engine/chargen/srd/levelUp.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit, parseEscapeAction
} from '../engine/combat/escapeCombat.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';

function pc5e(speciesId, classId, seed = 'u116', extra = {}) {
  return createCharacter5e({ seed: `${seed}|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard', ...extra });
}

function mkCombatWorld(pc, { enemyHp = 4, enemyCount = 1, cr = 0.5, seed = 'u116', xp = 0 } = {}) {
  const w0 = newWorld({ seed, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = ensureWorld({ ...w0, party: [{ ...pc, xp }] });
  w = initEscapeKit(initEscapeHp(w));
  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    enemies.push({ id: `e${i}`, name: 'bandit', hp: enemyHp, maxHp: Math.max(enemyHp, 1), ac: 8, damage: 2, defeated: false, cr });
  }
  return ensureWorld({
    ...w,
    combat: { active: true, round: 1, turnIndex: 0, beganAt: w.timeline.length, enemies }
  });
}

// Win a fight by swinging until combat ends (weak enemies make this fast).
function winFight(w, maxTurns = 20) {
  let beats = [];
  for (let i = 0; i < maxTurns && w.combat?.active; i++) {
    const r = resolveEscapeCombatTurn(w, 'strike');
    w = r.world;
    beats.push(...r.result.beats);
  }
  return { world: w, beats };
}

test('U116-01: XP table matches the SRD bands', () => {
  assert.equal(xpForCR(0), 10);
  assert.equal(xpForCR(0.125), 25);
  assert.equal(xpForCR(0.25), 50);
  assert.equal(xpForCR(0.5), 100);
  assert.equal(xpForCR(1), 200);
  assert.equal(xpForCR(5), 1800);
  assert.equal(xpForEnemies([{ cr: 0.5 }, { cr: 0.5 }, { cr: 1 }]), 400);
});

test('U116-02: levelForXp follows the level table', () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(99), 1);
  assert.equal(levelForXp(100), 2);
  assert.equal(levelForXp(250), 3);
  assert.equal(xpToNext(1), 100);
});

test('U116-03: combat victory awards XP', () => {
  const f = pc5e('human', 'fighter');
  const w = mkCombatWorld(f, { cr: 0.25 });
  const { world, beats } = winFight(w);
  assert.ok(!world.combat?.active, 'fight ended');
  assert.equal(world.party[0].xp, 50, 'CR 1/4 = 50 XP');
  assert.ok(beats.some(b => /\+50 XP/.test(b)), 'XP announced');
});

test('U116-04: parley victory awards the same XP — talking counts', () => {
  let proven = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const bard = pc5e('half-elf', 'bard', `u116p|${salt}`, { classChoices: { skills: ['Persuasion', 'Deception', 'Performance'] } });
    const w = mkCombatWorld(bard, { enemyHp: 30, cr: 0.5, seed: `u116p|${salt}` });
    const r = resolveEscapeCombatTurn(w, 'talk them down');
    if (!r.world.combat?.active && /parley/.test(r.result.mechanicsLine)) {
      assert.equal(r.world.party[0].xp, 100, 'full XP for the talked-down encounter');
      proven = true;
      break;
    }
  }
  assert.ok(proven);
});

test('U116-05: crossing the threshold levels up at the moment of victory', () => {
  const f = pc5e('human', 'fighter');
  // 60 XP banked; a CR 0.5 kill (+100) crosses 100 → level 2.
  const w = mkCombatWorld(f, { cr: 0.5, xp: 60 });
  const { world, beats } = winFight(w);
  assert.equal(world.party[0].xp, 160);
  assert.equal(world.party[0].dnd.level, 2, 'sheet level 2');
  assert.equal(world.party[0].level, 2, 'legacy level mirrors');
  assert.ok(beats.some(b => /LEVEL 2!/.test(b)), 'level-up announced');
  assert.ok(beats.some(b => /Action Surge/.test(b)), 'new feature named');
  // HP: fighter d10 avg 6 + CON mod; escapeMaxHp grew with the sheet.
  const d = world.party[0].dnd;
  assert.equal(d.maxHP, 10 + d.mods.CON + (6 + d.mods.CON), 'L1 + L2 HP math');
  assert.equal(world.meta.escapeMaxHp, d.maxHP, 'play surface tracks new max');
  assertWorldInvariants(world);
});

test('U116-06: levelUpSheet recomputes — wizard slots 2->3, half-casters awaken', () => {
  const wiz = pc5e('elf', 'wizard');
  const wiz2 = levelUpSheet({ ...wiz, xp: 100 });
  assert.equal(wiz2.dnd.level, 2);
  assert.equal(wiz2.dnd.spellcasting.slots[1], 3, 'full caster: 3 slots at L2');
  assert.equal(wiz2.spells.maxSlots[1], 3);
  assert.equal(wiz2.spells.slots[1], 3, 'the new slot arrives fresh');

  const pal = pc5e('human', 'paladin');
  assert.equal(pal.dnd.spellcasting, null, 'paladin has no magic at 1');
  const pal2 = levelUpSheet({ ...pal, xp: 100 });
  assert.ok(pal2.dnd.spellcasting, 'spellcasting awakens at 2');
  assert.equal(pal2.spells.maxSlots[1], 2);
  assert.ok(pal2.spells.known.includes('cure_wounds'), 'knows cure wounds');
  assert.ok(pal2.dnd.features.some(f => f.name === 'Divine Smite'));
});

test('U116-07: Action Surge — two attacks, once per fight', () => {
  const f = levelUpSheet({ ...pc5e('human', 'fighter'), xp: 100 });
  delete f.gainedFeatures;
  const w = mkCombatWorld(f, { enemyHp: 100, xp: 100 });
  const r = resolveEscapeCombatTurn(w, 'action surge');
  assert.ok(r.result.beats.some(b => /ACTION SURGE/.test(b)));
  const swings = r.result.beats.filter(b => /Your longsword/.test(b)).length;
  assert.equal(swings, 2, 'two attack beats');
  const r2 = resolveEscapeCombatTurn(r.world, 'surge');
  assert.ok(r2.result.beats.some(b => /surge is spent/.test(b)));
});

test('U116-08: Reckless Attack — bonus to hit, enemies hit back harder', () => {
  const b = levelUpSheet({ ...pc5e('half-orc', 'barbarian'), xp: 100 });
  delete b.gainedFeatures;
  const w = mkCombatWorld(b, { enemyHp: 100, xp: 100 });
  const r = resolveEscapeCombatTurn(w, 'attack recklessly');
  assert.ok(r.result.beats.some(bt => /guard wide/.test(bt)), 'reckless announced');
  // A level-1 fighter without the feature gets table-talk.
  const f1 = pc5e('human', 'fighter');
  const r2 = resolveEscapeCombatTurn(mkCombatWorld(f1, { enemyHp: 100 }), 'reckless attack');
  assert.ok(r2.result.beats.some(bt => /without the fury/.test(bt)));
});

test('U116-09: Divine Smite burns a slot for radiant on a hit', () => {
  const pal = levelUpSheet({ ...pc5e('human', 'paladin'), xp: 100 });
  delete pal.gainedFeatures;
  let found = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const w = mkCombatWorld(pal, { enemyHp: 100, seed: `u116s|${salt}`, xp: 100 });
    const r = resolveEscapeCombatTurn(w, 'smite the bandit');
    if (r.result.beats.some(bt => /divine smite \+\d+/.test(bt))) {
      assert.equal(r.world.party[0].spells.slots[1], 1, 'slot burned');
      found = true;
      break;
    }
  }
  assert.ok(found, 'smite landed on at least one seed');
});

test('U116-10: determinism + invariants across an advancement', () => {
  const f = pc5e('human', 'fighter');
  const w = mkCombatWorld(f, { cr: 0.5, xp: 60 });
  const a = winFight(w).world;
  const b = winFight(w).world;
  assert.deepEqual(a.party[0], b.party[0], 'identical advancement');
  const reloaded = ensureWorld(JSON.parse(JSON.stringify(a)));
  assert.equal(reloaded.party[0].dnd.level, 2, 'level survives reload');
  assertWorldInvariants(reloaded);
});
