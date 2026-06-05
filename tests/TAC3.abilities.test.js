import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../engine/tactical/visibility.js';
import { resolveAbility, getAbility, ABILITIES } from '../engine/tactical/abilities.js';

const actors = [
  { id: 'wolf', x: 10, y: 3, faction: 'enemy' },
  { id: 'bandit', x: 11, y: 3, faction: 'enemy' },
  { id: 'ally', x: 10, y: 4, faction: 'ally' }
];

test('TAC3: fireball is blind-fire AoE — hits hidden enemies AND allies', () => {
  const r = resolveAbility({ seed: 's', nonce: 1, ability: 'fireball', origin: { x: 9, y: 9 }, target: { x: 10, y: 3 }, actors });
  assert.equal(r.legal, true);
  const ids = r.hits.map(h => h.id).sort();
  assert.deepEqual(ids, ['ally', 'bandit', 'wolf'], 'blast catches everyone in radius, friend included');
  assert.ok(r.total > 0);
});

test('TAC3: out of range is illegal', () => {
  const r = resolveAbility({ seed: 's', nonce: 1, ability: 'sword', origin: { x: 0, y: 0 }, target: { x: 10, y: 3 }, actors });
  assert.equal(r.legal, false);
  assert.equal(r.reason, 'out_of_range');
});

test('TAC3: LoS-required ability is blocked by a wall', () => {
  const g = makeGrid(20, 8); for (let y = 0; y < 8; y++) g.set(7, y, 1);
  const blocked = resolveAbility({ seed: 's', nonce: 1, ability: 'shortbow', origin: { x: 2, y: 3 }, target: { x: 10, y: 3 }, actors, opacity: g });
  assert.equal(blocked.legal, false);
  assert.equal(blocked.reason, 'no_line_of_sight');
  g.set(7, 3, 0); // open a gap on the row
  const clear = resolveAbility({ seed: 's', nonce: 1, ability: 'shortbow', origin: { x: 2, y: 3 }, target: { x: 10, y: 3 }, actors, opacity: g });
  assert.equal(clear.legal, true);
  assert.equal(clear.hits[0].id, 'wolf');
});

test('TAC3: damage rolls are deterministic', () => {
  const a = resolveAbility({ seed: 's', nonce: 5, ability: 'fireball', origin: { x: 9, y: 9 }, target: { x: 10, y: 3 }, actors });
  const b = resolveAbility({ seed: 's', nonce: 5, ability: 'fireball', origin: { x: 9, y: 9 }, target: { x: 10, y: 3 }, actors });
  assert.deepEqual(a, b);
});

test('TAC3: ability catalog is well-formed', () => {
  for (const [id, ab] of Object.entries(ABILITIES)) {
    assert.equal(ab.id, id);
    assert.ok(ab.range > 0 && ab.apCost >= 1);
    assert.ok(['single', 'aoe'].includes(ab.shape));
    assert.match(ab.damage, /^\d+d\d+$/);
  }
  assert.equal(getAbility('fireball').needsLoS, false);
  assert.equal(getAbility('shortbow').needsLoS, true);
});
