import test from 'node:test';
import assert from 'node:assert/strict';
import { biomeForNode, biomeFlavor, BIOMES } from '../engine/world/biome.js';

test('LW1: biomeForNode is deterministic for the same seed + node', () => {
  const node = { id: 'n1', x: 10, y: 20 };
  assert.equal(biomeForNode('s', node), biomeForNode('s', node));
});

test('LW1: biomeForNode always returns a known biome', () => {
  for (let i = 0; i < 50; i++) {
    const b = biomeForNode('seed', { id: 'n' + i, x: i * 3, y: i * 7 });
    assert.ok(BIOMES.includes(b), `unknown biome: ${b}`);
  }
});

test('LW1: nearby nodes share a biome (spatial coherence)', () => {
  // Same coarse cell (CELL=14) → same biome.
  const a = biomeForNode('mira', { id: 'a', x: 2, y: 3 });
  const b = biomeForNode('mira', { id: 'b', x: 5, y: 6 });
  assert.equal(a, b, 'nodes in the same cell should share a biome');
});

test('LW1: distant cells can differ; the world is not monobiome', () => {
  const seen = new Set();
  for (let cx = 0; cx < 8; cx++) for (let cy = 0; cy < 8; cy++) {
    seen.add(biomeForNode('varied', { id: `${cx}_${cy}`, x: cx * 14, y: cy * 14 }));
  }
  assert.ok(seen.size >= 4, `expected variety across the map, got ${seen.size}`);
});

test('LW1: biomeFlavor returns a non-empty descriptor, deterministically', () => {
  const node = { id: 'n', x: 1, y: 1 };
  const f = biomeFlavor('s', node);
  assert.ok(typeof f === 'string' && f.length > 0);
  assert.equal(f, biomeFlavor('s', node));
  assert.ok(!/[.!?]$/.test(f), 'flavor should have no terminal punctuation (woven mid-sentence)');
});

test('LW1: no-position node falls back to id hash (still valid + deterministic)', () => {
  const b1 = biomeForNode('s', { id: 'lonely' });
  const b2 = biomeForNode('s', { id: 'lonely' });
  assert.equal(b1, b2);
  assert.ok(BIOMES.includes(b1));
});
