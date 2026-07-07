// U635 — MAP-EGRESS-1 rider: a bare "go out" classifies as an EXIT.
//
// The smaller sibling of the egress bug: from inside, every egress verb resolved as a
// leave EXCEPT a bare "go out" — it fell PAST every exit rule to the atmosphere bank
// ("…the still air tastes of dust"), stranding the player indoors while a real DM would
// simply walk them out. inferInteriorAction now classifies a WHOLE-INTENT bare "go out"
// / "get out" as kind:'exit'. This test drives the REAL player gesture (playerMove, LLM
// off) and asserts:
//   • "go out" (and its siblings) leaves — pos flips to the region frame, interior clears;
//   • the idioms do NOT over-match ("go out of your way", "figure it out" stay inside);
//   • a presence question after the gesture ("go out, who's here?") still YIELDS to the
//     roster answer (the who-guard) — the U235 presence-floor contract is untouched.
//
// LLM OFF (deterministic parseIntent floor). Sibling: U235 (presence-question floor).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

function bootSlice() {
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const { world } = beginAdventure(ensureWorld(w0), PACKS);
  return world;
}

// Drive one turn from a fresh boot; return whether the body ended up OUTDOORS.
function exits(text) {
  const world = bootSlice();
  assert.ok(world.scene?.interior, 'the boot starts INSIDE (precondition for an exit)');
  const { world: after } = playerMove(world, PACKS, text);
  const pos = after.party[0].pos;
  return pos && pos.frame === 'region' && (after.scene?.interior ?? null) === null;
}

test('U635: a bare "go out" leaves the building (the rider fix)', () => {
  assert.ok(exits('go out'), '"go out" exits to the region frame');
});

test('U635: the "go out" family all leave', () => {
  for (const verb of ['go out', 'get out', 'go out.', 'i go out', "i'd like to go out"]) {
    assert.ok(exits(verb), `"${verb}" exits`);
  }
});

test('U635: idioms do NOT over-match — "go out" stays scoped', () => {
  // These must NOT be read as a building exit (they never were, and the rider keeps it so).
  for (const phrase of ['go out of your way', 'figure it out', 'sort it out']) {
    assert.ok(!exits(phrase), `"${phrase}" must NOT exit the building`);
  }
});

test('U635: a presence question after the gesture yields to the roster (who-guard intact)', () => {
  // "go out, who's here?" must NOT resolve as a bare exit — the presence question wins
  // (the U235 contract). The body stays inside so the DM can answer who is around.
  assert.ok(!exits('go out, who is here?'), '"go out, who is here?" is a presence question, not a bare exit');
  assert.ok(!exits("go out — who's here?"), 'the em-dash presence form likewise yields');
});
