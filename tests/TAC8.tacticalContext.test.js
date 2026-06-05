import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTacticalContext, renderTacticalBlock } from '../engine/ai/tacticalContext.js';

const player = { id: 'pc', x: 10, y: 10 };
const actors = [
  { id: 'wolf', name: 'Gray Wolf', faction: 'enemy', x: 12, y: 10 },   // close
  { id: 'bandit', name: 'Bandit', faction: 'enemy', x: 13, y: 6 },     // close, hidden
  { id: 'dragon', name: 'Ancient Wyrm', faction: 'enemy', x: 40, y: 40 } // far, hidden
];

test('TAC8: only visible actors are named', () => {
  const visible = new Set(['12,10']); // we can see the wolf only
  const ctx = buildTacticalContext({ player, actors, visible, awareness: 12 });
  assert.deepEqual(ctx.seen.map(s => s.name), ['Gray Wolf']);
  assert.ok(!ctx.seen.some(s => s.name === 'Bandit'));
});

test('TAC8: hidden-but-near actors become unnamed directional hints', () => {
  const visible = new Set(['12,10']);
  const ctx = buildTacticalContext({ player, actors, visible, awareness: 12 });
  // bandit is near but unseen -> a sensed hint, never named
  assert.ok(ctx.sensed.length >= 1);
  for (const s of ctx.sensed) { assert.ok(s.dir && s.hint); assert.ok(!/bandit/i.test(s.hint)); }
});

test('TAC8: far unseen actors are omitted entirely', () => {
  const visible = new Set(['12,10']);
  const ctx = buildTacticalContext({ player, actors, visible, awareness: 12 });
  const block = renderTacticalBlock(ctx);
  assert.ok(!/wyrm/i.test(block), 'the far dragon leaks nowhere');
});

test('TAC8: render block names seen, teases sensed, never identifies hidden', () => {
  const visible = new Set(['12,10']);
  const block = renderTacticalBlock(buildTacticalContext({ player, actors, visible, lastAction: 'you loosed an arrow' }));
  assert.match(block, /SEEN: Gray Wolf/);
  assert.match(block, /SENSED to the/);
  assert.match(block, /LAST: you loosed an arrow/);
  assert.ok(!/Bandit/.test(block));
});

test('TAC8: deterministic', () => {
  const visible = new Set(['12,10']);
  assert.deepEqual(buildTacticalContext({ player, actors, visible }), buildTacticalContext({ player, actors, visible }));
});
