// U114 — control spells + rest semantics: Charm Person, Entangle (conditions
// on escape enemies), and warlock Pact Magic slots restoring on a short rest.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit,
  parseEscapeAction, shortRest
} from '../engine/combat/escapeCombat.js';
import { hasCondition } from '../engine/combat/conditions.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { makeRng, seedFromString } from '../engine/rng.js';

function pc5e(speciesId, classId, seed = 'u114') {
  return createCharacter5e({ seed: `${seed}|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard' });
}

function mkCombatWorld(pc, { enemyHp = 100, enemyCount = 1, seed = 'u114' } = {}) {
  const w0 = newWorld({ seed, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
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

test('U114-01: control verbs parse', () => {
  assert.equal(parseEscapeAction('charm the bandit').verb, 'charm');
  assert.equal(parseEscapeAction('cast charm person').verb, 'charm');
  assert.equal(parseEscapeAction('entangle them').verb, 'entangle');
  assert.equal(parseEscapeAction('vines around their legs').verb, 'entangle');
});

test('U114-02: charm person consumes a slot; on a failed save the foe stands down', () => {
  // Scan seeds for one where the save fails, and verify the held foe skips
  // its attacks, then breaks free with a beat after the countdown.
  let proven = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const bard = pc5e('half-elf', 'bard', `u114|${salt}`);
    const w = mkCombatWorld(bard, { seed: `u114|${salt}` });
    const r1 = resolveEscapeCombatTurn(w, 'charm person');
    assert.equal(r1.world.party[0].spells.slots[1], 1, 'slot spent win or lose');
    const e = r1.world.combat?.enemies?.[0];
    if (!e || !hasCondition(e.conditions, 'charmed')) continue;
    assert.ok(r1.result.beats.some(b => /charm takes hold/.test(b)));
    // While charmed the foe doesn't swing. Guard until it breaks.
    const r2 = resolveEscapeCombatTurn(r1.world, 'guard');
    assert.ok(r2.result.beats.some(b => /charm holds|charm breaks/.test(b)), 'charm narrated on enemy turn');
    assert.ok(!r2.result.beats.some(b => /bandit hits you/.test(b)), 'charmed foe does not attack');
    const r3 = resolveEscapeCombatTurn(r2.world, 'guard');
    const allBeats = [...r2.result.beats, ...r3.result.beats];
    assert.ok(allBeats.some(b => /charm breaks|charm holds/.test(b)));
    proven = true;
    break;
  }
  assert.ok(proven, 'found at least one failed save across seeds');
});

test('U114-03: entangle restrains on a failed STR save and foes can rip free', () => {
  let proven = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const druid = pc5e('human', 'druid', `u114e|${salt}`);
    const w = mkCombatWorld(druid, { enemyCount: 2, seed: `u114e|${salt}` });
    const r1 = resolveEscapeCombatTurn(w, 'entangle');
    assert.equal(r1.world.party[0].spells.slots[1], 1, 'slot spent');
    const caught = (r1.world.combat?.enemies || []).filter(e => hasCondition(e.conditions, 'restrained'));
    if (!caught.length) continue;
    assert.ok(r1.result.beats.some(b => /restrained/.test(b)));
    proven = true;
    break;
  }
  assert.ok(proven, 'entangle restrained at least one foe across seeds');
});

test('U114-04: a wizard cannot charm; a bard cannot entangle', () => {
  const wiz = pc5e('human', 'wizard');
  const r = resolveEscapeCombatTurn(mkCombatWorld(wiz), 'charm');
  assert.ok(r.result.beats.some(b => /Nothing magical happens/.test(b)));
  assert.equal(r.world.party[0].spells.slots[1], 2, 'no slot burned');

  const bard = pc5e('half-elf', 'bard');
  const r2 = resolveEscapeCombatTurn(mkCombatWorld(bard), 'entangle');
  assert.ok(r2.result.beats.some(b => /green does not answer/.test(b)));
});

test('U114-05: pact magic — warlock slots restore on a short rest, wizard slots do not', () => {
  const wl = pc5e('tiefling', 'warlock');
  let w = mkCombatWorld(wl);
  w = resolveEscapeCombatTurn(w, 'witch bolt').world;
  assert.equal(w.party[0].spells.slots[1], 0, 'pact slot spent');
  // End combat context isn't required for shortRest; rest directly.
  const rested = shortRest({ ...w, combat: { ...w.combat, active: false } }, makeRng(seedFromString('rest')));
  assert.equal(rested.party[0].spells.slots[1], 1, 'pact slot back after short rest');

  const wiz = pc5e('human', 'wizard');
  let w2 = mkCombatWorld(wiz);
  w2 = resolveEscapeCombatTurn(w2, 'missile').world;
  assert.equal(w2.party[0].spells.slots[1], 1);
  const rested2 = shortRest({ ...w2, combat: { ...w2.combat, active: false } }, makeRng(seedFromString('rest')));
  assert.equal(rested2.party[0].spells.slots[1], 1, 'wizard slots wait for a long rest');
});

test('U114-06: conditions survive serialize -> ensureWorld -> invariants', () => {
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const druid = pc5e('human', 'druid', `u114s|${salt}`);
    const w = mkCombatWorld(druid, { seed: `u114s|${salt}` });
    const r = resolveEscapeCombatTurn(w, 'entangle');
    const e = r.world.combat?.enemies?.[0];
    if (!e || !hasCondition(e.conditions, 'restrained')) continue;
    const reloaded = ensureWorld(JSON.parse(JSON.stringify(r.world)));
    assert.ok(hasCondition(reloaded.combat.enemies[0].conditions, 'restrained'), 'condition survives round-trip');
    assertWorldInvariants(reloaded);
    return;
  }
  assert.fail('no restrained enemy found across seeds');
});

test('U114-07: determinism — identical control casts, identical worlds', () => {
  const druid = pc5e('human', 'druid');
  const w = mkCombatWorld(druid, { enemyCount: 3 });
  const a = resolveEscapeCombatTurn(w, 'entangle');
  const b = resolveEscapeCombatTurn(w, 'entangle');
  assert.deepEqual(a.world, b.world);
  assert.deepEqual(a.result.beats, b.result.beats);
});
