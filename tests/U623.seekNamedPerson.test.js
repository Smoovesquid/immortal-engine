import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';

// SEEK-3 (screen finding 2026-07-06, b120 tree). From the default wake interior a
// player voiced: "I go find Carl and greet him" → "That way is blocked from here." —
// a navigation refusal for a named-person seek. DM_TEST_DEADEND, the SEEK-PERSON class
// (U485-U487), but a DIFFERENT phrasing family: a proper NAME as the seek object with a
// compound greet verb. Root cause: extractFindPersonRef matched only generic + role
// referents (never a NAME), and the "find" verb was never on the approach path — so
// "find <NAME>" reached neither the seek-person delivery nor the approach path and the
// interior-move gate read "find Carl" as a room-move → the blocked bank.
//
// A real DM (THE_DM_TEST) resolves the intent in the fiction: a PRESENT named person is
// approached + greeted in the SAME turn (honouring "and greet him"); an ABSENT/unknown
// name gets the honest in-fiction miss (SEEK-PERSON's C9-safe precedent — the present
// names offered, never an invented person, never "no record", never a nav refusal).

function boot(seed = DEMO_SEED) {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

function rosterNames(w) {
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  return (node?.settlement?.npcs || []).filter(n => n && !n.hostile).map(n => String(n.name || '').trim()).filter(Boolean);
}

test('U623: "I go find Carl and greet him" (ABSENT name) gets the honest in-fiction miss, never the blocked bank', () => {
  const { w, byId } = boot();
  assert.ok(w.scene?.interior, 'tallow boot starts indoors');
  const names = rosterNames(w);
  assert.ok(!names.some(n => /carl/i.test(n)), 'Carl is NOT on the boot roster (this is the absent-name case)');

  const r = playerMove(w, byId, 'I go find Carl and greet him');
  const narr = String(r.output?.narration || '');

  // NEVER the navigation refusal for a social intent.
  assert.doesNotMatch(narr, /blocked from here|wall holds|no way .* from here/i, 'no navigation refusal for a person seek');
  // NEVER a "no record" dodge, and NEVER an invented Carl (C9): the DM does not conjure him.
  assert.doesNotMatch(narr, /no record|not written anywhere/i, 'no "no record" dodge');
  // The honest miss names the seeker's target and offers who IS here (SEEK-PERSON precedent).
  assert.match(narr, /\bcarl\b/i, 'the miss acknowledges the name the player asked for');
  const offersPresent = names.some(n => narr.includes(n));
  assert.ok(offersPresent, `the miss offers a present roster person (one of ${JSON.stringify(names)}); got: ${narr}`);
});

test('U623: "I go find Asha and greet her" (PRESENT name) approaches + greets in the same turn', () => {
  const { w, byId } = boot();
  const names = rosterNames(w);
  assert.ok(names.some(n => /asha/i.test(n)), 'Asha IS on the boot roster (the present-name case)');
  const nodeBefore = w.map?.currentNodeId;

  const r = playerMove(w, byId, 'I go find Asha and greet her');
  const narr = String(r.output?.narration || '');
  const mech = String(r.output?.mechanics || '');

  assert.doesNotMatch(narr, /blocked from here|wall holds|no way .* from here/i, 'no nav refusal');
  // Delivered a greeting with Asha (dialogue), not a which-menu, not a spurious roll.
  assert.match(mech, /dialogue enter/i, 'entered conversation with the named person');
  assert.match(narr, /\basha\b/i, 'greeted Asha by name');
  assert.doesNotMatch(mech, /\[clarify:who\]/i, 'not a which-menu (the name was given)');
  assert.doesNotMatch(mech, /roll:\d+\s+vs\s+DC/i, 'not a spurious action roll');

  // NODE-DESYNC guard: the seek did not silently travel a node.
  assert.equal(r.world?.map?.currentNodeId, nodeBefore, 'node unchanged (no silent node travel)');
});

test('U623: bare "I go find Carl" (no greet clause) still resolves as a person seek, not the blocked bank', () => {
  const { w, byId } = boot();
  const r = playerMove(w, byId, 'I go find Carl');
  const narr = String(r.output?.narration || '');
  assert.doesNotMatch(narr, /blocked from here|wall holds|no way .* from here/i, 'no nav refusal on the bare seek');
  assert.match(narr, /\bcarl\b/i, 'honest miss acknowledges the name');
});
