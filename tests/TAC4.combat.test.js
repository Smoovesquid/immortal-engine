import test from 'node:test';
import assert from 'node:assert/strict';
import { makeGrid } from '../engine/tactical/visibility.js';
import { coverAt, hitChance, resolveAttack } from '../engine/tactical/combat.js';

test('TAC4: cover is directional — a wall protects only the side it faces', () => {
  const g = makeGrid(9, 9);
  g.set(4, 3, 1); // wall just north of target (4,4)
  // attacker to the north -> target has full cover
  assert.equal(coverAt(g, 4, 4, 4, 0), 'full');
  // attacker to the south (flank) -> the wall doesn't help
  assert.equal(coverAt(g, 4, 4, 4, 8), 'none');
});

test('TAC4: half cover from a low-cover set', () => {
  const g = makeGrid(9, 9);
  const low = new Set(['4,3']); // a fence north of the target
  assert.equal(coverAt(g, 4, 4, 4, 0, low), 'half');
  assert.equal(coverAt(g, 4, 4, 4, 8, low), 'none');
});

test('TAC4: hit chance drops with cover and range', () => {
  assert.equal(hitChance({ baseAim: 75, cover: 'none', range: 4 }), 75);
  assert.ok(hitChance({ baseAim: 75, cover: 'half' }) < 75);
  assert.ok(hitChance({ baseAim: 75, cover: 'full' }) < hitChance({ baseAim: 75, cover: 'half' }));
  assert.ok(hitChance({ baseAim: 75, range: 20 }) < 75, 'long range penalised');
  assert.ok(hitChance({ baseAim: 100 }) <= 95 && hitChance({ baseAim: 0 }) >= 5, 'clamped');
});

test('TAC4: resolveAttack is deterministic and respects chance', () => {
  const a = resolveAttack({ seed: 's', nonce: 3, attacker: 'pc', target: 'wolf', baseAim: 70, cover: 'none', range: 4, damage: '1d8' });
  const b = resolveAttack({ seed: 's', nonce: 3, attacker: 'pc', target: 'wolf', baseAim: 70, cover: 'none', range: 4, damage: '1d8' });
  assert.deepEqual(a, b);
  assert.equal(a.hit, a.roll <= a.chance);
  if (a.hit) assert.ok(a.damage > 0); else assert.equal(a.damage, 0);
});

test('TAC4: full cover makes a target much harder to hit than in the open', () => {
  let openHits = 0, coverHits = 0;
  for (let n = 0; n < 200; n++) {
    if (resolveAttack({ seed: 's', nonce: n, attacker: 'pc', target: 't', baseAim: 75, cover: 'none' }).hit) openHits++;
    if (resolveAttack({ seed: 's', nonce: n, attacker: 'pc', target: 't', baseAim: 75, cover: 'full' }).hit) coverHits++;
  }
  assert.ok(openHits > coverHits, `open ${openHits} should beat full-cover ${coverHits}`);
});
