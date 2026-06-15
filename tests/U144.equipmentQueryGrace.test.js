import test from 'node:test';
import assert from 'node:assert/strict';

import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

// Opus gate (2026-06-15): "name my weapon" / "what's on my sheet" fell through
// to a fabricated social d20 roll (and the polish invented "a short sword").
// Equipment/sheet queries are information requests — answered in-voice from
// canon, no roll, no turn, no invention.

const world = {
  party: [{
    inventory: { weapons: [], armor: [], items: [] },
    signature: { itemName: 'Thing' },
    wounds: 0, stress: 0,
  }],
};

test('U144: equipment queries are meta-questions (no roll/turn)', () => {
  for (const q of ['what is my weapon?', 'name my weapon', 'what am I wielding?',
    "what's on my character sheet?", 'what armor do I have?']) {
    assert.ok(isMetaQuestion(q), `should be meta: ${q}`);
  }
});

test('U144: empty loadout is reported honestly, not invented', () => {
  const ans = handleMetaQuestion('what is my weapon?', world);
  assert.match(ans, /no weapon/i);
  assert.doesNotMatch(ans, /short sword|dagger|axe|mace/i, 'must not invent a weapon');
});

test('U144: an equipped weapon is named from canon', () => {
  const w2 = { party: [{ inventory: { weapons: [{ name: 'notched cutlass' }], armor: [{ name: 'boiled leather' }] }, signature: {} }] };
  const ans = handleMetaQuestion('name my weapon', w2);
  assert.match(ans, /notched cutlass/);
  assert.match(ans, /boiled leather/);
});

test('U144: a real action ("I cut my weapon on the stone") is not a meta-question', () => {
  assert.equal(isMetaQuestion('I cut my weapon on the stone'), false);
});
