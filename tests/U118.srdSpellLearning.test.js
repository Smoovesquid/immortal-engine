// U118 — spell learning at level-up + the higher-tier castables: Scorching
// Ray, Hold Person (paralysis with melee auto-crits), and Fireball.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import { levelUpSheet } from '../engine/chargen/srd/levelUp.js';
import {
  resolveEscapeCombatTurn, initEscapeHp, initEscapeKit, parseEscapeAction, escapeKitView
} from '../engine/combat/escapeCombat.js';
import { hasCondition } from '../engine/combat/conditions.js';
import { SPELL_REGISTRY } from '../engine/ruleset/core/spells/index.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';

function pc5e(speciesId, classId, seed = 'u118') {
  return createCharacter5e({ seed: `${seed}|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard' });
}

function levelTo(pc, target) {
  let cur = pc;
  while (cur.dnd.level < target) {
    cur = levelUpSheet(cur);
    delete cur.gainedFeatures;
  }
  return cur;
}

function mkCombatWorld(pc, { enemyHp = 100, enemyCount = 1, seed = 'u118' } = {}) {
  const w0 = newWorld({ seed, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = ensureWorld({ ...w0, party: [pc] });
  w = initEscapeKit(initEscapeHp(w));
  const enemies = [];
  for (let i = 0; i < enemyCount; i++) {
    enemies.push({ id: `e${i}`, name: 'bandit', hp: enemyHp, maxHp: 100, ac: 10, damage: 6, defeated: false, cr: 0.5 });
  }
  return ensureWorld({
    ...w,
    combat: { active: true, round: 1, turnIndex: 0, beganAt: w.timeline.length, enemies }
  });
}

test('U118-01: casters learn spells as they level; every learned ref is real', () => {
  const wiz5 = levelTo(pc5e('human', 'wizard'), 5);
  for (const ref of ['burning_hands', 'mage_armor', 'scorching_ray', 'misty_step', 'hold_person', 'blink', 'fireball', 'counterspell']) {
    assert.ok(wiz5.spells.known.includes(ref), `wizard 5 knows ${ref}`);
    assert.ok(SPELL_REGISTRY[ref], `${ref} exists in the catalog`);
  }
  // The level-up narration names them.
  const wiz1 = pc5e('human', 'wizard');
  const wiz2 = levelUpSheet(wiz1);
  assert.ok(wiz2.gainedFeatures.some(g => /Learned: Burning Hands, Mage Armor/.test(g)));
});

test('U118-02: martials learn nothing arcane; half-casters learn on their curve', () => {
  const f5 = levelTo(pc5e('human', 'fighter'), 5);
  assert.equal(f5.spells.known.length, 0);
  const r5 = levelTo(pc5e('elf', 'ranger'), 5);
  assert.ok(r5.spells.known.includes('entangle'), 'ranger 3 learns entangle');
  assert.ok(r5.spells.known.includes('spike_growth'), 'ranger 5 learns spike growth');
});

test('U118-03: new verbs parse and outrank the cantrip bucket', () => {
  assert.equal(parseEscapeAction('fireball them all').verb, 'fireball');
  assert.equal(parseEscapeAction('scorching ray').verb, 'scorch');
  assert.equal(parseEscapeAction('hold person').verb, 'hold');
  assert.equal(parseEscapeAction('hold them still').verb, 'hold');
  assert.equal(parseEscapeAction('fire bolt').verb, 'firebolt', 'cantrip untouched');
});

test('U118-04: fireball needs a 3rd-level slot — refused at 3, devastating at 5', () => {
  const wiz3 = levelTo(pc5e('human', 'wizard'), 3);
  // Knows fireball? Not until 5. A level-3 wizard does not know it at all.
  assert.ok(!wiz3.spells.known.includes('fireball'));
  const r0 = resolveEscapeCombatTurn(mkCombatWorld(wiz3), 'fireball');
  assert.ok(r0.result.beats.some(b => /not yours/.test(b)));

  const wiz5 = levelTo(pc5e('human', 'wizard'), 5);
  const w = mkCombatWorld(wiz5, { enemyCount: 3, enemyHp: 100 });
  const r = resolveEscapeCombatTurn(w, 'fireball');
  assert.ok(r.result.beats.some(b => /FIREBALL \(8d6\)/.test(b)), 'fireball announced');
  const hitBeats = r.result.beats.filter(b => /fire\./.test(b) || /fire\b.*drops/.test(b));
  assert.ok(hitBeats.length >= 3, 'all three foes took a beat');
  assert.equal(r.world.party[0].spells.slots[3], 1, '3rd-level slot consumed');
  for (const e of r.world.combat?.enemies || []) {
    assert.ok(e.hp < 100, 'everyone burned');
  }

  // Drain the 3rd-level slots: fireball refuses even with 1st/2nd available.
  let drained = { ...wiz5, spells: { ...wiz5.spells, slots: { ...wiz5.spells.slots, 3: 0 } } };
  const r2 = resolveEscapeCombatTurn(mkCombatWorld(drained), 'fireball');
  assert.ok(r2.result.beats.some(b => /needs a 3rd-level slot/.test(b)));
});

test('U118-05: scorching ray walks across the line of foes', () => {
  const wiz3 = levelTo(pc5e('human', 'wizard'), 3);
  const w = mkCombatWorld(wiz3, { enemyCount: 2, enemyHp: 6 });
  const r = resolveEscapeCombatTurn(w, 'scorch them');
  const rayBeats = r.result.beats.filter(b => /ray of fire/i.test(b));
  assert.equal(rayBeats.length, 3, 'three rays narrated');
  assert.equal(r.world.party[0].spells.slots[2], 1, '2nd-level slot consumed');
});

test('U118-06: hold person paralyzes — the foe loses turns and melee hits crit', () => {
  let proven = false;
  for (const salt of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const wiz4 = levelTo(pc5e('human', 'wizard', `u118h|${salt}`), 4);
    const w = mkCombatWorld(wiz4, { seed: `u118h|${salt}`, enemyHp: 200 });
    const r1 = resolveEscapeCombatTurn(w, 'hold person');
    const e = r1.world.combat?.enemies?.[0];
    if (!e || !hasCondition(e.conditions, 'paralyzed')) continue;
    assert.ok(r1.result.beats.some(b => /held fast/.test(b)));
    assert.ok(!r1.result.beats.some(b => /bandit hits you/.test(b)), 'held foe cannot attack');
    // A melee hit while held is an automatic critical.
    const r2 = resolveEscapeCombatTurn(r1.world, 'strike');
    const hit = r2.result.beats.find(b => /hits the bandit/.test(b));
    if (hit) assert.match(hit, /critical!/, 'melee hit on a paralyzed foe crits');
    proven = true;
    break;
  }
  assert.ok(proven, 'hold landed across seeds');
});

test('U118-07: kit panel lists the learned spells with tier notes', () => {
  const wiz5 = levelTo(pc5e('human', 'wizard'), 5);
  const view = escapeKitView(wiz5);
  assert.ok(view.spells.some(s => s.name === 'Fireball' && /3rd-level/.test(s.note)));
  assert.ok(view.spells.some(s => s.name === 'Scorching Ray'));
  assert.ok(view.spells.some(s => s.name === 'Hold Person'));
});

test('U118-08: determinism + invariants with learned spells in play', () => {
  const wiz5 = levelTo(pc5e('human', 'wizard'), 5);
  const w = mkCombatWorld(wiz5, { enemyCount: 3 });
  const a = resolveEscapeCombatTurn(w, 'fireball');
  const b = resolveEscapeCombatTurn(w, 'fireball');
  assert.deepEqual(a.world, b.world);
  assertWorldInvariants(ensureWorld(JSON.parse(JSON.stringify(a.world))));
});
