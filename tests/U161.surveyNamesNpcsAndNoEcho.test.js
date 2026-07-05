import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { coLocatePlayerWithNpc } from './support/presence.js';

// Opus gate (2026-06-16): (1) the interior survey said "No one else is under this
// roof" while canon listed many NPCs present (a hallucinated emptiness); (2) the
// examine pivot echoed a long verbose input verbatim ("You look for a building
// myself — what does the sign over the door say…").
//
// FIRST_ROOM #4 (2026-06-24): "what do I see around me?" inside your room describes
// the ROOM (its furniture) and the way out — never the hallucinated-empty denial
// ("No one under this roof"), never the EXTERIOR survey shape (compass exits).
// convo-honesty FIX 1 (2026-06-25) refines #4: the room survey ALSO registers who
// is visibly present (the #4 fix had over-corrected to hide everyone, so a person
// standing right there went unmentioned). The boot starts you at HOME, so present
// townsfolk are named; away from home they read by role (earned knowledge, U282).

function world(seed = 'ashfen-reach') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U161: interior survey describes the room and registers present people, no exterior leak', () => {
  // OCC-STORY-1: the wake cottage is empty of strangers by design, so to test that the survey
  // REGISTERS a present person we co-locate the player with a real settlement NPC first. The two
  // properties under test are unchanged: (a) the survey is room-scoped (no exterior compass leak, no
  // hallucinated-empty denial), and (b) a person standing right there is registered.
  const { w: w0 } = world();
  assert.ok(w0.scene?.interior, 'precondition: the start is inside an interior');
  // (a) room-scoped shape — checked on the plain wake survey.
  const wakeAns = handleMetaQuestion('what do I see around me?', w0);
  assert.match(wakeAns, /room|way out/i, wakeAns);
  assert.doesNotMatch(wakeAns, /No one else is under this roof/, wakeAns);
  assert.doesNotMatch(wakeAns, /to the (?:north|south|east|west) lies/i, wakeAns);
  // (b) a present, non-hostile person IS registered once someone is actually in the room.
  const co = coLocatePlayerWithNpc(w0);
  if (co) {
    const ans = handleMetaQuestion('what do I see around me?', co.w);
    assert.match(ans, /\bis here\b|\bare here\b|\bright here\b/i, `present people should be registered: ${ans}`);
  }
});

test('U161: examine does NOT echo a long/complex captured target verbatim', () => {
  const { w, byId } = world();
  const { output } = playerMove(w, byId, 'I look at the building — what does the sign over the door say, and what is inside?');
  const narr = String(output.narration || '');
  assert.doesNotMatch(narr, /what does the sign over the door say/i, 'no verbatim echo of the input');
});
