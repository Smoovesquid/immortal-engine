// U115 — talking your way out (parley in escape combat) and the long rest.
// THE DM TEST: "I try to talk them down" and "I get a room and sleep" must
// work the way a real DM would rule them.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit,
  parseEscapeAction, longRest
} from '../engine/combat/escapeCombat.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';

function pc5e(speciesId, classId, seed = 'u115') {
  return createCharacter5e({ seed: `${seed}|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard' });
}

function mkCombatWorld(pc, { enemyHp = 30, enemyCount = 1, canParley = true, seed = 'u115' } = {}) {
  const w0 = newWorld({ seed, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = ensureWorld({ ...w0, party: [pc] });
  w = initEscapeKit(initEscapeHp(w));
  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    enemies.push({ id: `e${i}`, name: 'bandit', hp: enemyHp, maxHp: enemyHp, ac: 10, damage: 6, defeated: false, cr: 0.5, canParley });
  }
  return ensureWorld({
    ...w,
    combat: { active: true, round: 1, turnIndex: 0, beganAt: w.timeline.length, enemies }
  });
}

test('U115-01: parley verbs parse with the right lever', () => {
  assert.deepEqual(parseEscapeAction('I try to talk them down'), { verb: 'parley', mode: 'persuade' });
  assert.deepEqual(parseEscapeAction('parley'), { verb: 'parley', mode: 'persuade' });
  assert.deepEqual(parseEscapeAction('intimidate them into leaving'), { verb: 'parley', mode: 'intimidate' });
  assert.deepEqual(parseEscapeAction('let us pass and no one dies'), { verb: 'parley', mode: 'persuade' });
  // Attack verbs unaffected
  assert.equal(parseEscapeAction('strike').verb, 'strike');
});

test('U115-02: a high-CHA character can talk a fight closed; the roll is shown', () => {
  // Bard with Persuasion proficiency: find a seed where the check lands.
  let ended = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const bard = createCharacter5e({
      seed: `u115p|${salt}`, speciesId: 'half-elf', classId: 'bard',
      abilityMethod: 'standard', classChoices: { skills: ['Persuasion', 'Deception', 'Performance'] }
    });
    const w = mkCombatWorld(bard, { seed: `u115p|${salt}` });
    const r = resolveEscapeCombatTurn(w, 'I talk them down');
    assert.ok(r.result.beats.some(b => /Persuasion \d+ vs DC \d+/.test(b)), 'check is visible at the table');
    if (!r.world.combat?.active && r.result.mechanicsLine.includes('parley')) {
      assert.match(r.result.mechanicsLine, /\[combat:parley/);
      ended = true;
      break;
    }
  }
  assert.ok(ended, 'parley ended at least one fight across seeds');
});

test('U115-03: intimidation uses the Intimidation skill', () => {
  const orc = pc5e('half-orc', 'barbarian'); // Menacing: Intimidation proficiency
  const w = mkCombatWorld(orc);
  const r = resolveEscapeCombatTurn(w, 'I threaten them');
  assert.ok(r.result.beats.some(b => /Intimidation \d+ vs DC/.test(b)));
});

test('U115-04: beasts that cannot parley do not bargain', () => {
  const bard = pc5e('half-elf', 'bard');
  const w = mkCombatWorld(bard, { canParley: false });
  const r = resolveEscapeCombatTurn(w, 'parley');
  assert.ok(r.result.beats.some(b => /does not bargain/.test(b)));
  assert.ok(r.world.combat?.active, 'fight continues');
});

test('U115-05: failed parley wastes the turn — enemies still swing', () => {
  // Low-CHA fighter, scan for a seed where the check fails and an enemy acts.
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const f = pc5e('human', 'fighter', `u115f|${salt}`);
    const w = mkCombatWorld(f, { seed: `u115f|${salt}` });
    const r = resolveEscapeCombatTurn(w, 'parley');
    if (r.world.combat?.active) {
      assert.ok(r.result.beats.some(b => /Steel answers/.test(b)));
      assert.ok(r.result.beats.some(b => /bandit/.test(b)), 'enemy turn happened');
      return;
    }
  }
  assert.fail('no failed parley found across seeds');
});

test('U115-06: longRest restores HP, slots, and reserves', () => {
  const wiz = pc5e('elf', 'wizard');
  let w = mkCombatWorld(wiz);
  w = resolveEscapeCombatTurn(w, 'missile').world;
  w = resolveEscapeCombatTurn(w, 'missile').world;
  assert.equal(w.party[0].spells.slots[1], 0);
  // Hurt + end combat, then long rest.
  w = ensureWorld({ ...w, combat: { ...w.combat, active: false }, meta: { ...w.meta, escapeHp: 3 } });
  const rested = longRest(w);
  assert.equal(rested.meta.escapeHp, rested.meta.escapeMaxHp, 'full HP');
  assert.equal(rested.party[0].spells.slots[1], 2, 'wizard slots back after a LONG rest');
  assertWorldInvariants(rested);
});

test('U115-07: "sleep" at a settlement long-rests via playerMove; in the wild it refuses', () => {
  const pc = pc5e('human', 'cleric');
  const packsById = { fantasy: { id: 'fantasy' } };
  const w0 = newWorld({ seed: 'u115sleep', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let { world: w } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), packsById);
  // Spend a slot and take a wound so the rest has something to do.
  w = ensureWorld({ ...w, meta: { ...w.meta, escapeHp: Math.max(1, (w.meta.escapeMaxHp || 9) - 4) } });
  const hereId = w.map?.currentNodeId;
  const here = (w.map?.nodes || []).find(n => n && n.id === hereId);
  assert.equal(here?.nodeType, 'settlement', 'adventure starts at a settlement');

  const r = playerMove(w, packsById, 'I find a bed and sleep for the night');
  assert.match(r.output.mechanics, /\[rest:long\]/);
  assert.equal(r.world.meta.escapeHp, r.world.meta.escapeMaxHp, 'woke up whole');
  assert.ok(/wake whole/i.test(r.output.narration));

  // In the wild: move current node to a non-settlement and try again.
  const wild = (r.world.map?.nodes || []).find(n => n && n.nodeType !== 'settlement');
  if (wild) {
    const w2 = ensureWorld({ ...r.world, map: { ...r.world.map, currentNodeId: wild.id } });
    const r2 = playerMove(w2, packsById, 'make camp and sleep');
    assert.match(r2.output.mechanics, /\[rest:denied\]/);
    assert.ok(/no bed|teeth/i.test(r2.output.narration));
  }
});

test('U115-08: determinism — identical parley attempts, identical outcomes', () => {
  const bard = pc5e('half-elf', 'bard');
  const w = mkCombatWorld(bard);
  const a = resolveEscapeCombatTurn(w, 'parley');
  const b = resolveEscapeCombatTurn(w, 'parley');
  assert.deepEqual(a.world, b.world);
  assert.deepEqual(a.result.beats, b.result.beats);
});
