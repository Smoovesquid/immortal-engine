import test from 'node:test';
import assert from 'node:assert/strict';
import { ecologySnapshot, ecologyTravelLine } from '../engine/ecology/snapshot.js';

test('LW3: snapshot is deterministic for the same seed/biome/day', () => {
  assert.deepEqual(ecologySnapshot('s', 'forest', 12), ecologySnapshot('s', 'forest', 12));
});

test('LW3: levels are in range and shift over time (the land is not static)', () => {
  const days = [];
  for (let d = 0; d < 80; d += 4) days.push(ecologySnapshot('mira', 'plains', d).prey);
  for (const v of days) assert.ok(v >= 0 && v <= 1, `prey out of range: ${v}`);
  const spread = Math.max(...days) - Math.min(...days);
  assert.ok(spread > 0.2, `prey should swing seasonally, spread=${spread.toFixed(2)}`);
});

test('LW3: travel line is sparse (most arrivals quiet) but appears sometimes', () => {
  let hits = 0, total = 0;
  for (let n = 0; n < 200; n++) {
    total++;
    if (ecologyTravelLine('seed', 'forest', n % 50, 'node' + n)) hits++;
  }
  assert.ok(hits > 0, 'ecology lines should appear');
  assert.ok(hits < total * 0.5, `should be sparse, got ${hits}/${total}`);
});

test('LW3: travel line is deterministic per node+day', () => {
  assert.equal(
    ecologyTravelLine('s', 'marsh', 5, 'n1'),
    ecologyTravelLine('s', 'marsh', 5, 'n1')
  );
});

test('LW3: travel lines read as prose (no placeholder/undefined leaks)', () => {
  for (let n = 0; n < 300; n++) {
    const line = ecologyTravelLine('s', ['forest', 'marsh', 'plains', 'desert', 'mountains'][n % 5], n % 60, 'k' + n);
    if (!line) continue;
    assert.ok(!/undefined|null|\[object|NaN/.test(line), `leak in: ${line}`);
    assert.ok(/[.!]$/.test(line), `should end as a sentence: ${line}`);
  }
});
