import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';

// SEEK-PERSON edges: the person-goal bridge must fire across the phrasing family
// (incl. a leading trivial clause), a TRUE dead-end must still get the blocked bank,
// and "find someone" voiced ALREADY OUTDOORS must resolve WITHOUT a spurious exit.

function boot(seed = DEMO_SEED) {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U486: the seek-person bridge fires across the phrasing family', () => {
  const phrasings = [
    'I get up and go find someone in the settlement who can tell me who founded this outpost.', // leading trivial clause
    'go find someone who can tell me who founded this outpost',
    'find somebody who knows about this place',
    'I look for anyone who can help me',
    'let me go and find a local to ask about the road',
    'search for someone to talk to',
  ];
  for (const t of phrasings) {
    const { w, byId } = boot();
    const r = playerMove(w, byId, t);
    const narr = String(r.output?.narration || '');
    assert.doesNotMatch(narr, /blocked from here|wall holds|no way .* from here/i, `no refusal: ${t}`);
    assert.doesNotMatch(narr, /no record|not written anywhere/i, `no "no record": ${t}`);
    assert.equal(r.world?.scene?.interior, null, `interior exited: ${t}`);
    assert.match(narr, /step out into the open air/i, `bridged outside: ${t}`);
    // Delivered a person (dialogue) rather than a fall-through action roll.
    assert.match(String(r.output?.mechanics || ''), /dialogue enter/i, `delivered a person: ${t}`);
  }
});

test('U486: a TRUE dead-end still gets the blocked bank (no seek-bridge overreach)', () => {
  // A cardinal walk into a wall stays inside and is honestly refused — the seek
  // bridge must not have loosened the wall-holds behavior.
  const { w, byId } = boot();
  // Find a wall direction that the boot room actually refuses (deterministic).
  let refused = null;
  for (const dir of ['go north', 'go west', 'go east', 'go south']) {
    const r = playerMove(w, byId, dir);
    if (/wall holds|no way .* from here/i.test(String(r.output?.narration || ''))) { refused = { dir, r }; break; }
  }
  assert.ok(refused, 'at least one cardinal is a true wall from the boot room');
  assert.ok(refused.r.world?.scene?.interior, 'a true wall keeps the player inside');
});

test('U486: an OBJECT seek does not bridge to a person', () => {
  const { w, byId } = boot();
  const r = playerMove(w, byId, 'find my hatchet');
  // "find my hatchet" is an object seek, not a person seek — it must NOT step the
  // player out and hand them an NPC.
  assert.doesNotMatch(String(r.output?.mechanics || ''), /dialogue enter/i, 'object seek does not enter dialogue');
  assert.ok(r.world?.scene?.interior, 'object seek stays inside (no seek-person exit)');
});

test('U486: a CONTESTED-purpose seek ("find someone to rob") is not a friendly seek', () => {
  // The person-seek bridge must not free-pass a hostile-purpose seek into a friendly
  // greeting (U262): "find someone to rob/fight" is a contested action, so it must
  // NOT enter dialogue as a social search.
  for (const t of ['I look for someone to rob', 'find somebody to mug', 'go find someone to fight']) {
    const { w, byId } = boot();
    const r = playerMove(w, byId, t);
    assert.doesNotMatch(String(r.output?.mechanics || ''), /dialogue enter/i, `contested seek does not greet: ${t}`);
  }
});

test('U486: "go find someone" ALREADY OUTDOORS resolves without a spurious exit', () => {
  const { w, byId } = boot();
  const outside = playerMove(w, byId, 'I step outside.').world;
  assert.equal(outside.scene?.interior, null, 'now outdoors');
  const r = playerMove(outside, byId, 'go find someone who can tell me who founded this outpost');
  const narr = String(r.output?.narration || '');
  // No "step out into the open air" bridge prefix — the player was already out.
  assert.doesNotMatch(narr, /step out into the open air/i, 'no spurious exit bridge when already outdoors');
  assert.equal(r.world?.scene?.interior, null, 'stays outdoors');
  assert.match(String(r.output?.mechanics || ''), /dialogue enter/i, 'still delivers a person');
});
