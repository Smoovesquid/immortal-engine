// U247 — D-B1 quest-birth WIRING. A player's declared intent in the LIVE turn-loop mints a
// tracked goal + an in-character acknowledgment (no quest-board artifact); talk-now and
// non-declarations are untouched. The detector is locked by G06; this locks the playloop wiring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerMove } from '../engine/playloop.js';
import { villageBakerWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { ensureWorld } from '../engine/state.js';
import { activeGoals } from '../engine/goals/goalContract.js';

function world() {
  let w = villageBakerWorld();
  w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.push(
    { id: 'npc_bandit', name: 'Brokefang', role: 'bandit', hostile: true }
  );
  return ensureWorld(w);
}
const NO_ARTIFACT = /NEW QUEST|objective added|quest added|\[quest\]|\bquest log\b/i;

test('U247 — a defeat declaration mints a goal + a sociable-witness acknowledgment, no artifact', () => {
  const r = playerMove(world(), PACKS, "I'll deal with Brokefang.");
  assert.match(r.output.mechanics, /\[goal:born \| defeat\]/);
  assert.equal(activeGoals(r.world)[0]?.targetRef, 'npc_bandit');
  assert.match(r.output.narration, /you'll deal with Brokefang/i);
  assert.match(r.output.narration, /Mira Hearth marks your word/);   // a sociable witness…
  assert.doesNotMatch(r.output.narration, /Brokefang marks your word/);  // …NEVER the foe
  assert.doesNotMatch(r.output.narration, NO_ARTIFACT);
});

test('U247 — learn / H1-help declarations mint goals in fiction', () => {
  const learn = playerMove(world(), PACKS, "I'll find out who owes the debt.");
  assert.match(learn.output.mechanics, /\[goal:born \| learn\]/);
  assert.doesNotMatch(learn.output.narration, NO_ARTIFACT);
  const help = playerMove(world(), PACKS, "I'll help you however I can.");
  assert.match(help.output.mechanics, /\[goal:born \| learn\]/);
  assert.match(help.output.narration, /help Mira Hearth/i);          // adopts the NPC's own want (H1)
});

test('U247 — talk-now still ENTERS dialogue (no over-claim, no goal)', () => {
  const r = playerMove(world(), PACKS, "I'll go talk to Mira.");
  assert.match(r.output.mechanics, /dialogue enter/i);
  assert.equal(activeGoals(r.world).length, 0);
});

test('U247 — non-declarations untouched (a skill action rolls; a musing mints nothing)', () => {
  const search = playerMove(world(), PACKS, "I'll search the room for clues.");
  assert.match(search.output.mechanics, /\[roll:/);
  assert.equal(activeGoals(search.world).length, 0);
  const musing = playerMove(world(), PACKS, "Maybe I'll deal with the bandits later.");
  assert.equal(activeGoals(musing.world).length, 0);
});

test('U247 — deterministic: a declaration mints the same goal across builds', () => {
  const a = playerMove(world(), PACKS, "I'll travel to Saltmarket Town.");
  const b = playerMove(world(), PACKS, "I'll travel to Saltmarket Town.");
  assert.equal(a.output.narration, b.output.narration);
  assert.deepEqual(activeGoals(a.world), activeGoals(b.world));
});
