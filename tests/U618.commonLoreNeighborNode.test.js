// U618 — PW-5: the region-common-knowledge bank, first live case (docs/briefs/PW-5-audit.md §Q4).
//
// The residual dialogue dead-end PW-3 left open: a local asked about a NEIGHBOURING settlement's
// grounded lore (its founding, what happened there) used to SHRUG — the fact lives on another
// node, isn't in this NPC's head, isn't a rumour, isn't a current-node place-fact. A co-located
// local plausibly knows the next town's founding story, so answering it is what a real DM does
// (THE_TABLE_TEST). This gate proves the bank answers that (F1) — and that it does NOT intercept
// the CURRENT node's own place-facts, which still resolve through the existing placeQuery path (F4).
//
// The bank is READ-ONLY: it reuses placeQuery's resolvers against the NAMED node via
// resolvePlaceFactForNode (one fact, two voices), deriving an unvisited node's grounded events
// through substrateEventsPeek WITHOUT caching them. Determinism is proven in U621.
//
// Hermetic — no network/API. All state is driven through the real playerMove path on the slice.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(
  newWorld({ seed: SLICE_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS
).world;
// The slice wakes in Aldermere (the town). The Greenwood, Crowfoot Camp, and The Hollowed
// Chapel are its NEIGHBOURS — real nodes with grounded substrate a local would know of.
const talkTo = (w) => {
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (here.settlement.npcs || []).find(n => n && !n.hostile);
  return { w: playerMove(w, PACKS, `talk to ${npc.name}`).world, npc, here };
};

test('U618-01: F1 — "tell me about <neighbouring place>" answers its grounded founding, not a bare bearing', () => {
  const { w } = talkTo(boot());
  const r = playerMove(w, PACKS, 'tell me about Crowfoot Camp');
  assert.match(r.output.mechanics, /dialogue ask \| common_lore/, 'resolves as common_lore, not directions/deflection');
  assert.ok(r.output.narration.includes('Crowfoot Camp'), 'names the place it recounts');
  // The answer carries GROUNDED lore prose (a founding line), not a compass bearing.
  assert.ok(!/\b(north|south|east|west)\s+of here\b/i.test(r.output.narration), 'not a directions bearing');
  assert.ok(r.output.narration.length > 30, 'a real recounting, not a shrug');
});

test('U618-02: F1 — "how was <neighbour> founded?" and "what happened in <neighbour>?" both answer from that node', () => {
  const { w } = talkTo(boot());
  const founding = playerMove(w, PACKS, 'how was The Greenwood founded?');
  assert.match(founding.output.mechanics, /dialogue ask \| common_lore/, 'neighbour founding resolves');
  assert.ok(founding.output.narration.includes('The Greenwood'), 'names the neighbour');

  const events = playerMove(w, PACKS, 'what happened in Crowfoot Camp?');
  assert.match(events.output.mechanics, /dialogue ask \| common_lore/, 'neighbour events resolve');
  assert.ok(events.output.narration.includes('Crowfoot Camp'), 'names the neighbour');
});

test('U618-03: F4 — the CURRENT node\'s own founding still resolves through the existing place path, NOT the bank', () => {
  const { w, here } = talkTo(boot());
  const r = playerMove(w, PACKS, 'how was this town founded?');
  // The bank must NOT intercept node-local: "this town" is the current node → the
  // existing placeQuery `place`/founding path owns it (mode 'place'), unchanged.
  assert.match(r.output.mechanics, /dialogue ask \| place/, 'current-node founding stays on the place path');
  assert.ok(!/common_lore/.test(r.output.mechanics), 'the bank does not intercept node-local facts');
  assert.ok(here && here.name, 'sanity: we stand somewhere named');
});

test('U618-04: F4 — "tell me about this place" (current node) stays the place blurb/overview, not the bank', () => {
  const { w } = talkTo(boot());
  const r = playerMove(w, PACKS, 'tell me about this place');
  assert.ok(!/common_lore/.test(r.output.mechanics), 'a here-anchored ask never routes to the neighbour bank');
});

test('U618-05: the common_lore turn mints NO rumour and NO substrate cache (read-only)', () => {
  const { w } = talkTo(boot());
  // The bank mints no rumour and caches no neighbour substrate. (The turn DOES log the
  // ordinary per-ask `dialogueAsk` timeline event — that is pre-existing playerMove
  // bookkeeping for EVERY dialogue mode, not a PW-5 mutation; see U621 for hash purity.)
  const rumorsBefore = JSON.stringify(w.rumors || []);
  const nodesBefore = JSON.stringify(w.substrate?.nodes || {});
  const r = playerMove(w, PACKS, 'tell me about Crowfoot Camp');
  assert.equal(JSON.stringify(r.world.rumors || []), rumorsBefore, 'no rumour minted — the bank is a pure read');
  assert.equal(JSON.stringify(r.world.substrate?.nodes || {}), nodesBefore, 'no neighbour substrate cached — the peek is read-only');
});
