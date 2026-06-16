import test from 'node:test';
import assert from 'node:assert/strict';

import { parseGrappleVerb, resolveGrappleAction, enemyGrappleEscape, GRAPPLE_TUNABLES } from '../engine/combat/grapple.js';
import { hasCondition, getCondition } from '../engine/combat/conditions.js';

// Minimal grapple slice (design 2026-06-15): grapple→throw→choke→escape on the
// escape engine, state carried as CONDITIONS (grappled=clinch, +prone=down),
// choke = player-driven severity ratchet → unconscious, breath-gated by
// conditionImmunities. Pure module — forced RNG for deterministic outcomes.

const HIT = { int: () => 20 };   // always max roll → success
const MISS = { int: () => 1 };   // always nat 1 → failure
const pc = { stats: { MIGHT: 14 } }; // +2
const foe = () => ({ id: 'e0', name: 'Petra', hp: 8, maxHp: 8, cr: 0, conditions: [], conditionImmunities: [] });

test('U151: parseGrappleVerb maps the martial intents', () => {
  assert.equal(parseGrappleVerb('I grab Petra by the collar'), 'grapple');
  assert.equal(parseGrappleVerb('I throw her to the ground'), 'throw');
  assert.equal(parseGrappleVerb('I choke him out'), 'choke');
  assert.equal(parseGrappleVerb('I break free'), 'escape');
  assert.equal(parseGrappleVerb('I cast fireball'), null);
  assert.equal(parseGrappleVerb('I swing my sword'), null);
});

test('U151: a successful grapple applies the grappled condition (clinch)', () => {
  const enemies = [foe()];
  const r = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'grapple', rng: HIT });
  assert.equal(r.outcome, 'success');
  assert.ok(hasCondition(enemies[0].conditions, 'grappled'));
});

test('U151: a failed grapple applies nothing', () => {
  const enemies = [foe()];
  const r = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'grapple', rng: MISS });
  assert.equal(r.outcome, 'failure');
  assert.ok(!hasCondition(enemies[0].conditions, 'grappled'));
});

test('U151: throw requires a grip first', () => {
  const enemies = [foe()];
  const r = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'throw', rng: HIT });
  assert.equal(r.outcome, 'mixed');
  assert.match(r.mechanicsLine, /no-grip/);
});

test('U151: throw on a grappled foe → prone + damage (control advances to down)', () => {
  const enemies = [foe()];
  resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'grapple', rng: HIT });
  const before = enemies[0].hp;
  const r = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'throw', rng: HIT });
  assert.equal(r.outcome, 'success');
  assert.ok(hasCondition(enemies[0].conditions, 'prone'), 'now prone');
  assert.ok(hasCondition(enemies[0].conditions, 'grappled'), 'keeps top control');
  assert.ok(enemies[0].hp < before, 'took damage');
});

test('U151: choke ratchets severity and finishes at CHOKE_ROUNDS (unconscious)', () => {
  const enemies = [foe()];
  resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'grapple', rng: HIT });
  for (let i = 1; i < GRAPPLE_TUNABLES.CHOKE_ROUNDS; i++) {
    const r = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'choke', rng: HIT });
    assert.equal(r.outcome, 'success');
    assert.ok(!enemies[0].defeated, `not out yet at round ${i}`);
    assert.equal(getCondition(enemies[0].conditions, 'choked').severity, i);
  }
  const fin = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'choke', rng: HIT });
  assert.match(fin.mechanicsLine, /choke-out/);
  assert.ok(enemies[0].defeated, 'choked unconscious');
});

test('U151: a breathless foe cannot be choked', () => {
  const enemies = [{ ...foe(), name: 'Bone Golem', conditionImmunities: ['unconscious', 'exhaustion'] }];
  resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'grapple', rng: HIT });
  const r = resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'choke', rng: HIT });
  assert.match(r.mechanicsLine, /choke-immune/);
  assert.ok(!hasCondition(enemies[0].conditions, 'choked'));
});

test('U151: enemyGrappleEscape breaks the grip (and any choke) on a high save', () => {
  const enemies = [foe()];
  resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'grapple', rng: HIT });
  resolveGrappleAction({ pc, enemies, targetIdx: 0, verb: 'choke', rng: HIT });
  const res = enemyGrappleEscape(enemies[0], 20, { int: () => 20 });
  assert.ok(res.broke);
  assert.ok(!hasCondition(enemies[0].conditions, 'grappled'));
  assert.ok(!hasCondition(enemies[0].conditions, 'choked'), 'choke released with the grip');
});
