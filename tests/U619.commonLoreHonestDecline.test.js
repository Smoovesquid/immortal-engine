// U619 — PW-5: the bank honours the Law of Earned Knowledge (docs/LAW_OF_EARNED_KNOWLEDGE.md).
//
// The bank may deliver ONLY grounded region-common knowledge. This gate proves the two guardrails:
//   F2 (honest decline): an ungrounded place ask — a settlement/lord/event canon never authored —
//       does NOT resolve as common_lore and does NOT fabricate a name/date. The resolver returns
//       null and the turn falls to its ordinary honest handling (deflection / rumour pickup). A
//       roll can never manufacture the fact (there is no roll on this path).
//   F3 (§0 / other-minds wall): a secret-control / cult / motive / allegiance ask about a
//       neighbouring place or its leader is NEVER classified as common lore — it stays deferred
//       (reveal-sink law, Biblioteca V12-13; Tier-3/4 of the Law). The bank answers WORLD facts
//       about a PLACE, never a hidden mind.
//
// Hermetic — no network/API. Driven through the real playerMove path + a direct resolver probe.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { classifyCommonLoreQuery, resolveCommonLore } from '../engine/world/commonKnowledge.js';

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
  return { w: playerMove(w, PACKS, `talk to ${npc.name}`).world, npc, here };
};

test('U619-01: F2 — an ungrounded place (never authored) does NOT resolve as common_lore, and invents no name/date', () => {
  const { w } = talkTo(boot());
  for (const line of ['tell me about Baldur\'s Gate', 'how was Waterdeep founded?', 'who is the lord of Neverwinter?']) {
    const r = playerMove(w, PACKS, line);
    assert.ok(!/common_lore/.test(r.output.mechanics), `"${line}" must not resolve as common_lore (ungrounded)`);
    // No fabricated place/date leaks into the answer.
    assert.ok(!/\d/.test(r.output.narration), `"${line}" answer carries no numerics (no invented date/count)`);
    assert.ok(!/\b(Baldur|Waterdeep|Neverwinter)\b/.test(r.output.narration), `"${line}" does not echo the ungrounded name as fact`);
  }
});

test('U619-02: F2 — the resolver returns null for an unmodelled place (the known/unknown boundary is the data)', () => {
  const w = boot();
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  assert.equal(resolveCommonLore(w, { text: 'tell me about the Sunless Citadel', hereId: here.id }), null, 'unmodelled place → null');
  assert.equal(classifyCommonLoreQuery(w, 'tell me about the Sunless Citadel', here.id), null, 'unmodelled place → not classified');
});

test('U619-03: F3 — secret-control / cult / motive asks about a neighbour are NEVER common lore (stay deferred)', () => {
  const { w } = talkTo(boot());
  const secretAsks = [
    'who really runs Crowfoot Camp?',
    'who secretly controls The Greenwood?',
    'what is the cult in The Hollowed Chapel?',
    'who does the leader of Crowfoot Camp secretly serve?',
    'who is behind everything in The Greenwood?',
  ];
  for (const line of secretAsks) {
    const r = playerMove(w, PACKS, line);
    assert.ok(!/common_lore/.test(r.output.mechanics), `"${line}" must stay deferred, never common_lore`);
  }
});

test('U619-04: F3 — the classifier drops secret/motive/agent-count asks up front (guarded before resolve)', () => {
  const w = boot();
  const here = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  // Secret / motive / hidden-power → null.
  for (const line of [
    'who secretly runs Crowfoot Camp?',
    'who does the elder of The Greenwood serve?',
    'what faction controls Crowfoot Camp?',
    'is the leader of The Greenwood plotting something?',
  ]) {
    assert.equal(classifyCommonLoreQuery(w, line, here.id), null, `"${line}" → not classified as common lore`);
  }
  // AGENT/COUNT asks (a name/number the founding label never holds) → null (non-invention).
  for (const line of ['who founded Crowfoot Camp?', 'what year was The Greenwood settled?', 'how many families founded Crowfoot Camp?']) {
    assert.equal(classifyCommonLoreQuery(w, line, here.id), null, `"${line}" → agent/count decline, never a place-fact`);
  }
});
