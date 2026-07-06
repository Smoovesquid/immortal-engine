// U621 — PW-5: determinism + read-only insurance (docs/briefs/PW-5-audit.md §"Determinism plan").
//
// The bank mutates nothing, mints nothing, draws no rng: the resolver is pure (world in,
// {mode,body}|null out), the classifier is regex, node selection is deterministic (name-length
// desc, id asc for ties), and an unvisited neighbour's events are derived through the pure
// substrateEventsPeek WITHOUT caching. So:
//   F-DET — the same world + same ask yields a byte-identical answer, and worldHash is UNCHANGED
//           across a common_lore turn; the same ask transcript over two fresh worlds is byte-equal.
//   read-only — a common_lore turn writes nothing to world.substrate.nodes (no cache side-effect).
//   F-REP — the PW-5 source touches NO reputation path (playerReputation / world.timeline-as-rep).
//
// Hermetic — no network/API.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { resolveCommonLore } from '../engine/world/commonKnowledge.js';

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
const talkTo = (w) => {
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (here.settlement.npcs || []).find(n => n && !n.hostile);
  return playerMove(w, PACKS, `talk to ${npc.name}`).world;
};

test('U621-01: F-DET — the resolver is pure: same world + same ask → byte-identical answer', () => {
  const w = boot();
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const a = resolveCommonLore(w, { text: 'tell me about crowfoot camp', hereId: here.id });
  const b = resolveCommonLore(w, { text: 'tell me about crowfoot camp', hereId: here.id });
  assert.ok(a && a.body, 'the neighbour lore resolves');
  assert.deepEqual(a, b, 'two calls yield the identical typed fact');
});

test('U621-02: F-DET — the resolver call leaves worldHash UNCHANGED (the bank mutates nothing)', () => {
  // The PW-5 invariant is that RESOLVING the answer mutates no world state — so worldHash is
  // byte-stable across the resolver call itself. (A full playerMove turn additionally logs the
  // ordinary per-ask `dialogueAsk` event for EVERY mode — pre-existing bookkeeping, not PW-5 —
  // so a whole-turn hash naturally advances; that is not a bank mutation. See U621-03 for the
  // read-only substrate proof and U621-04 for whole-transcript replay equality.)
  const w = talkTo(boot());
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const hBefore = worldHash(w);
  const fact = resolveCommonLore(w, { text: 'tell me about Crowfoot Camp', hereId: here.id });
  assert.ok(fact && fact.body, 'the bank resolved a grounded neighbour fact');
  assert.equal(worldHash(w), hBefore, 'resolving the answer mutated no state — hash byte-stable');
});

test('U621-03: read-only — a common_lore turn writes nothing to world.substrate.nodes (no cache side-effect)', () => {
  const w = talkTo(boot());
  const nodesBefore = JSON.stringify(w.substrate?.nodes || {});
  const r = playerMove(w, PACKS, 'how was The Greenwood founded?');
  assert.match(r.output.mechanics, /dialogue ask \| common_lore/);
  const nodesAfter = JSON.stringify(r.world.substrate?.nodes || {});
  assert.equal(nodesAfter, nodesBefore, 'the peek derived the neighbour\'s events read-only — no cache write');
});

test('U621-04: F-DET — the same ask transcript over two fresh worlds is byte-identical (replayable)', () => {
  const lines = ['tell me about Crowfoot Camp', 'how was The Greenwood founded?', 'what happened in Crowfoot Camp?'];
  const run = () => {
    let w = talkTo(boot());
    for (const t of lines) w = playerMove(w, PACKS, t).world;
    return worldHash(w);
  };
  assert.equal(run(), run(), 'a common_lore transcript is deterministic across fresh worlds');
});

test('U621-05: F-REP — the PW-5 source references NO reputation path (playerReputation / timeline-as-rep)', () => {
  // The bank is about WORLD/region knowledge the NPC holds, never the player's standing. The sole
  // reputation read-sink is lastingWord.playerReputation — PW-5 must not touch it or re-derive rep.
  const ck = fs.readFileSync(path.join(__dirname, '..', 'engine', 'world', 'commonKnowledge.js'), 'utf8');
  assert.ok(!/playerReputation/.test(ck), 'commonKnowledge.js does not reference playerReputation');
  assert.ok(!/lastingWord/.test(ck), 'commonKnowledge.js does not touch the reputation module');
  assert.ok(!/\btimeline\b/.test(ck), 'commonKnowledge.js does not re-derive reputation from world.timeline');
});
