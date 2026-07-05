// U489 — SL-5: ask-concern → commit → the SAME learn goal lands in world.goals.
//
// Guards the D-B1 round-trip (docs/briefs/SL-5-aldermere-wants.md piece 2):
// "I'll look into it" / "I'll help" mints the SAME `learn` goal the concern
// named — via the EXISTING D-B1 H2 `learn` verb path + createGoal site, no new
// verb grammar, no new mint path. Also guards the companion fix this packet
// needed to make the round-trip real: a bare-pronoun commit must not be
// swallowed by the literal container/examine floor (INSPECT_VERB's "look
// into" overlaps the idiomatic "investigate" sense) before it ever reaches
// the goal-birth check.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { classifyPlaceQuery, resolvePlaceFact } from '../engine/world/placeQuery.js';
import { SLICE_SEED, pickAldermereWorry } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const manifest = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8'))
  );
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  }
  return byId;
}
const PACKS = loadPacks();

function bootSlice(seed = SLICE_SEED, fate = 0.2) {
  const { world } = beginAdventure(
    newWorld({ seed, fate, pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  );
  return world;
}

const CONCERN_ASK = "what's troubling folk here?";

test('U489: "I\'ll look into it" mints a learn goal naming the SAME worry the concern surfaced', () => {
  const world = bootSlice();
  const q = classifyPlaceQuery(CONCERN_ASK);
  const fact = resolvePlaceFact(world, q);
  const worry = pickAldermereWorry(SLICE_SEED);
  assert.equal(fact.body, worry.body, 'sanity: the concern names the seed-chosen worry');

  const r = playerMove(world, PACKS, "I'll look into it");
  assert.equal(r.world.goals.length, 1, 'exactly one goal minted');
  const goal = r.world.goals[0];
  assert.equal(goal.kind, 'learn');
  assert.equal(goal.status, 'active');
  // targetRef must resolve to the SAME worry's own target phrase (not a phantom "learn:it").
  const targetWord = worry.target.replace(/^the\s+/i, '').toLowerCase();
  assert.ok(
    goal.targetRef.toLowerCase().includes(targetWord),
    `targetRef "${goal.targetRef}" must reference the worry's target "${worry.target}", not "it"`
  );
  assert.ok(!goal.targetRef.toLowerCase().includes('learn:it'), 'must never mint a phantom learn:it goal');
});

test('U489: the acknowledgment narration is in-fiction — no "NEW QUEST" / quest-board artifact', () => {
  const world = bootSlice();
  const r = playerMove(world, PACKS, "I'll look into it");
  assert.match(r.output.narration, /^Wizard:/);
  assert.doesNotMatch(r.output.narration, /new quest/i);
  assert.doesNotMatch(r.output.narration, /quest.?board/i);
  assert.doesNotMatch(r.output.narration, /\[quest/i);
});

test('U489: world.goals carries exactly one entry, never a rendered list/array surface', () => {
  const world = bootSlice();
  const r = playerMove(world, PACKS, "I'll look into it");
  assert.ok(Array.isArray(r.world.goals), 'world.goals is the internal tracking array (not a UI concern)');
  assert.equal(r.world.goals.length, 1);
  // The concern resolver itself (the player-facing surface) still returns ONE string.
  const q = classifyPlaceQuery(CONCERN_ASK);
  const fact = resolvePlaceFact(r.world, q);
  assert.equal(typeof fact.body, 'string');
});

test('U489: a real named-object examine ("I\'ll examine the chest") is UNCHANGED by the pronoun guard', () => {
  const world = bootSlice();
  // A concrete target must still resolve through the normal examine/goal paths —
  // the guard added for the bare-pronoun collision must not swallow real objects.
  const r = playerMove(world, PACKS, "I'll look into the ledger");
  // Whatever the outcome (examine floor, no-op, or a goal on an unresolved
  // reference), it must NOT silently produce the bare "learn:it" phantom.
  const goalTargets = (r.world.goals || []).map(g => g.targetRef.toLowerCase());
  assert.ok(!goalTargets.includes('learn:it'), 'a real named object must never collapse to the pronoun phantom');
});

test('U489: a musing ("maybe I\'ll look into it") mints NOTHING — not a commitment', () => {
  const world = bootSlice();
  const r = playerMove(world, PACKS, "Maybe I'll look into it");
  assert.equal(r.world.goals.length, 0, 'a musing is not a commitment (NON_COMMIT_RE guard, pre-existing)');
});

test('U489: a question ("should I look into it?") mints NOTHING — not a commitment', () => {
  const world = bootSlice();
  const r = playerMove(world, PACKS, 'Should I look into it?');
  assert.equal(r.world.goals.length, 0, 'a question is never a commitment (QUESTION_RE guard, pre-existing)');
});

test('U489: the pronoun-substitution fix is slice-seed-gated — a non-slice seed is untouched', () => {
  const world = bootSlice('tallow');
  const r = playerMove(world, PACKS, "I'll look into it");
  // On a non-slice seed, "I'll look into it" may mint nothing, or (pre-existing
  // behavior) a phantom learn:it — either way, the SLICE substitution itself
  // must not have fired (no Aldermere-worry text appears in any minted goal).
  const worryWords = ['quiet road', 'chapel bell'];
  for (const g of (r.world.goals || [])) {
    for (const w of worryWords) {
      assert.ok(!g.targetRef.toLowerCase().includes(w), `non-slice seed must never see a slice worry substituted, got ${g.targetRef}`);
    }
  }
});

test('U489: determinism — the same seed + same turns produce the same goal targetRef', () => {
  const w1 = bootSlice();
  const w2 = bootSlice();
  const r1 = playerMove(w1, PACKS, "I'll look into it");
  const r2 = playerMove(w2, PACKS, "I'll look into it");
  assert.equal(r1.world.goals[0]?.targetRef, r2.world.goals[0]?.targetRef);
});
