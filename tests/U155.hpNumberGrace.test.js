import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Opus gate (2026-06-16): in escape mode the PC's live HP is a real number
// (meta.escapeHp), but the DM dodged "what are my HP / max HP" and self-harm
// left escapeHp untouched. Both fixed: HP is reported on request, and a self-cut
// comes off escapeHp.

function escWorld(seed = 'glass-harbor') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U155: explicit HP / max-HP queries report the real number, not a dodge', () => {
  const { w } = escWorld();
  for (const q of ['what are my hit points?', 'what are my max HP?', 'give me a number: max HP', "what's my hp?"]) {
    assert.ok(isMetaQuestion(q), `meta: ${q}`);
    assert.match(handleMetaQuestion(q, w), /\d+\s+of\s+\d+|hit points/i, `reports HP: ${q}`);
  }
});

test('U155: a combined "HP and stats" query returns BOTH (no omitted HP)', () => {
  const { w } = escWorld();
  const ans = handleMetaQuestion('what are my HP and stats?', w);
  assert.match(ans, /MIGHT \d+/, 'has stats');
  assert.match(ans, /[Hh]it points: \d+ of \d+/, 'has HP');
});

test('U155: self-harm decrements escapeHp in escape mode', () => {
  const { w, byId } = escWorld();
  const before = w.meta.escapeHp;
  const { world } = playerMove(w, byId, 'I draw the blade across my own forearm, a shallow cut');
  assert.equal(world.meta.escapeHp, before - 1, 'escapeHp dropped by 1');
});

test('U155: casual "am I hurt?" still answers (in-voice), not a dodge', () => {
  const { w } = escWorld();
  assert.match(handleMetaQuestion('am I hurt?', w), /hit points|untouched|health/i);
});
