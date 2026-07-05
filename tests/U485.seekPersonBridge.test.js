import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';

// SEEK-PERSON (GATE 2026-07-05, one high-sev fail). From the wake interior a
// Lore-hound voiced: "I get up and go find someone in the settlement who can tell
// me who founded this outpost." The DM answered a SOCIAL intent with a NAVIGATION
// refusal — "That way is blocked from here." (mech empty). Root cause: the seek
// names no place, so the INT-4-TRAVEL place-bridge missed it, and "go FIND …" was
// mis-read as a room move to a room named "find" → the interior blocked bank fired.
// A real DM (THE_DM_TEST) walks you out and finds you a face. This gate line asserts
// the bridge: interior exited, a REAL canon person delivered (by name from the boot
// roster), node/interior invariants intact (no NODE-DESYNC).

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

test('U485: seek-a-person voiced indoors bridges out and delivers a real canon person', () => {
  const { w, byId } = boot();
  assert.ok(w.scene?.interior, 'tallow boot starts indoors');
  const nodeBefore = w.map?.currentNodeId;
  const names = rosterNames(w);
  assert.ok(names.length > 0, 'the boot node has a sociable roster to find');

  const r = playerMove(w, byId, 'I get up and go find someone in the settlement who can tell me who founded this outpost.');
  const narr = String(r.output?.narration || '');
  const mech = String(r.output?.mechanics || '');

  // NEVER the navigation refusal for a social intent, NEVER "no record".
  assert.doesNotMatch(narr, /blocked from here|wall holds|no way .* from here/i, 'no navigation refusal');
  assert.doesNotMatch(narr, /no record|nothing anyone'?s ever shown you|not written anywhere/i, 'no "no record" dodge');
  assert.doesNotMatch(mech, /info-check → no-record/i, 'not the info-decline mechanics');

  // The interior was exited (the DM walked the player out to the lane).
  assert.equal(r.world?.scene?.interior, null, 'interior exited');

  // A REAL canon person was delivered — assert by name from the boot roster.
  assert.match(narr, /step out into the open air/i, 'stepped outside');
  const delivered = names.some(n => narr.includes(n));
  assert.ok(delivered, `delivers a named roster person (expected one of ${JSON.stringify(names)}); got: ${narr}`);
  assert.match(mech, /dialogue enter/i, 'entered conversation with the delivered person');

  // NODE-DESYNC guard: the node is unchanged, and currentNodeId stays consistent
  // with the (now-cleared) interior — the seek did not silently travel a node.
  assert.equal(r.world?.map?.currentNodeId, nodeBefore, 'node unchanged (no silent node travel)');
});
