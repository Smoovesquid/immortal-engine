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
//
// FIRST_ROOM #4 (2026-06-24) SUPERSEDES (1) inside a private interior: "what do I
// see around me?" inside your room describes the ROOM (its furniture), not the
// settlement NPC roster — you can't see the village through the walls. The old
// "name the NPCs inside" behavior was itself the meta-roster leak. The roster is
// still named OUTDOORS and for explicit who's-here PRESENCE questions (see U235).

function world(seed = 'ashfen-reach') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U161: interior survey describes the room, never dumps the settlement NPC roster', () => {
  const { w } = world();
  assert.ok(w.scene?.interior, 'precondition: the start is inside an interior');
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const ans = handleMetaQuestion('what do I see around me?', w);
  // Room-scoped: describes the room / the way out, never the hallucinated-empty
  // denial ("No one under this roof") nor the settlement roster.
  assert.match(ans, /room|way out/i, ans);
  assert.doesNotMatch(ans, /No one else is under this roof/, ans);
  for (const npc of (node.settlement?.npcs || [])) {
    // Distinctive name tokens only (≥4 chars, skips "the"/"a" epithet glue that
    // legitimately appears in prose like "the room" / "the way out").
    for (const tok of String(npc?.name || '').split(/\s+/)) {
      if (tok.length >= 4) assert.doesNotMatch(ans, new RegExp(`\\b${tok}\\b`, 'i'), `roster leaked: ${ans}`);
    }
  }
});

test('U161: examine does NOT echo a long/complex captured target verbatim', () => {
  const { w, byId } = world();
  const { output } = playerMove(w, byId, 'I look at the building — what does the sign over the door say, and what is inside?');
  const narr = String(output.narration || '');
  assert.doesNotMatch(narr, /what does the sign over the door say/i, 'no verbatim echo of the input');
});
