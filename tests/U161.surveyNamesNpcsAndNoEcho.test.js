import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16): (1) the interior survey said "No one else is under this
// roof" while canon listed many NPCs present (a hallucinated emptiness); (2) the
// examine pivot echoed a long verbose input verbatim ("You look for a building
// myself — what does the sign over the door say…").

function world(seed = 'ashfen-reach') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U161: the survey names present NPCs inside, not "no one under this roof"', () => {
  const { w } = world();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const someNpc = (node.settlement.npcs || []).find(n => n && !n.hostile);
  const ans = handleMetaQuestion('what do I see around me?', w);
  if (someNpc) {
    assert.match(ans, new RegExp(String(someNpc.name).split(' ')[0]), 'names a present NPC');
    assert.doesNotMatch(ans, /No one else is under this roof\.(?!\s*$)/);
  }
});

test('U161: examine does NOT echo a long/complex captured target verbatim', () => {
  const { w, byId } = world();
  const { output } = playerMove(w, byId, 'I look at the building — what does the sign over the door say, and what is inside?');
  const narr = String(output.narration || '');
  assert.doesNotMatch(narr, /what does the sign over the door say/i, 'no verbatim echo of the input');
});
