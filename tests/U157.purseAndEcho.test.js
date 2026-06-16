import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16): "how many coins in my pouch?" was dodged (no purse
// grace), and a complex command ("Open the door yourself, Corwin, and stand
// inside it…") got echoed back verbatim by the trivial-action narration (a
// system-artifact leak).

function world(seed = 'glass-harbor') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U157: coin/purse queries are answered (the DM owns the number)', () => {
  const { w } = world();
  for (const q of ['how many coins are in my pouch?', 'how much money do I have?', "what's in my purse?"]) {
    assert.ok(isMetaQuestion(q), `meta: ${q}`);
    assert.match(handleMetaQuestion(q, w), /purse|coin/i, `answered: ${q}`);
  }
});

test('U157: a purse with coins lists them', () => {
  const { w } = world();
  w.party[0].purse = { copper: 7, silver: 2, gold: 0, platinum: 0 };
  const ans = handleMetaQuestion('how many coins do I have?', w);
  assert.match(ans, /7 copper/);
  assert.match(ans, /2 silver/);
});

test('U157: a complex command is NOT echoed back verbatim', () => {
  const { w, byId } = world();
  const input = 'Open the door yourself, Corwin, and stand inside it — prove it is yours';
  const { output } = playerMove(w, byId, input);
  const narr = String(output.narration || '');
  assert.doesNotMatch(narr, /Corwin, and stand inside/i, 'no verbatim echo of the input');
});
