// U312 — AG-1: the answerability gate (a question can never end as a non-answer)
//
// Three routing failures from the 2026-07-02 re-gate (seed: tallow, DM_TEST_DEADEND ×3):
//
//   R1 — "Huh, who's it from? Is there a name at the bottom?"
//        mech: [clarify:referent] — "Huh" extracted as ungrounded NPC name
//        Fix: "huh" stopword (stops false extraction) + AG-1 pre-roll gate
//
//   R2 — "Were you born here, Elske?"
//        mech: [roll:1 vs DC:12 → failure] — rolled a d20 on a personal-history question
//        Fix: AG-1 pre-roll gate (directQuestionIntent bypasses resolveMove for questions)
//
//   Diverge guards — "I search the room" / "I attack the guard" must NOT be intercepted
//        The classifier must not swallow declared actions or exploration intents.
//
// All reproducible LLM-OFF at the routing layer. Uses playerMove (not the gate harness).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginAdventure, playerMove } from '../engine/playloop.js';
import { newWorld } from '../engine/state.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { directQuestionIntent } from '../engine/grace/answerability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}

const PACKS = loadPacks();

// World matching the 2026-07-02 re-gate tallow state.
// Elske Nightherd is the innkeeper at Wayfarers' Outpost.
function makeWorld() {
  const w = beginAdventure(newWorld({
    seed: 'tallow',
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  // Ensure a non-combat, non-dialogue settlement state with Elske present.
  const nodeId = 'tallow_settlement';
  return {
    ...w,
    map: {
      ...w.map,
      currentNodeId: nodeId,
      nodes: [...(w.map?.nodes || []), {
        id: nodeId,
        name: "Wayfarers' Outpost",
        nodeType: 'settlement',
        discovered: true,
        settlement: {
          decompressed: true,
          npcs: [{
            id: 'elske',
            name: 'Elske Nightherd',
            role: 'innkeeper',
            occupation: 'innkeeper',
            hostile: false,
            conversationState: { trustLevel: 5 }
          }]
        }
      }]
    },
    combat: { ...(w.combat || {}), active: false },
    scene: { ...(w.scene || {}), interior: null, dialogue: null }
  };
}

function surface(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`.trim();
}

// ── R1: "huh" is no longer treated as an ungrounded NPC name ─────────────────

test('U312-R1a: "Huh" is a stopword — not extracted as an NPC proper name', () => {
  // Previously "Huh, who's it from?" → [clarify:referent] because "Huh" was
  // treated as a capitalized proper NPC name. Adding "huh" to the stopword set
  // (NPC_PROPER_REFERENT_STOPWORDS) kills the extraction at the root.
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, "Huh, who's it from? Is there a name at the bottom?"));
  assert.doesNotMatch(s, /\[clarify:referent\]/i,
    'must not emit [clarify:referent] — "Huh" is a discourse filler, not an NPC name');
});

test('U312-R1b: the exact gate repro does not clarify:referent', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, "Huh, who's it from? Is there a name at the bottom?"));
  assert.doesNotMatch(s, /\[clarify:referent\]/i, 'gate repro must not bounce to clarify loop');
});

test('U312-R1c: referent-followup questions do not emit [clarify:referent]', () => {
  const w = makeWorld();
  for (const q of [
    "who's it from?",
    'who sent this?',
    'is there a name on it?',
    'who wrote this for me?',
  ]) {
    const s = surface(playerMove(w, PACKS, q));
    assert.doesNotMatch(s, /\[clarify:referent\]/i, `"${q}" must not emit [clarify:referent]`);
  }
});

// ── R2: "were you born here?" does not roll a d20 ────────────────────────────

test('U312-R2a: "were you born here?" bypasses the d20 resolver', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'were you born here?'));
  assert.doesNotMatch(s, /\[roll:/i,
    '"were you born here?" must not roll a d20 — it is a personal-history question, not an action');
});

test('U312-R2b: the exact gate repro does not roll', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'You keep saying "isn\'t something you keep close" — but you called this place familiar. Were you born here or not, Elske?'));
  assert.doesNotMatch(s, /\[roll:/i, 'gate repro must not roll a d20');
});

test('U312-R2c: NPC personal-history questions produce a decline, not gen:s/m/f', () => {
  const w = makeWorld();
  for (const q of [
    'were you born here?',
    'do you live here, Elske?',
    'have you always lived here?',
  ]) {
    const s = surface(playerMove(w, PACKS, q));
    assert.doesNotMatch(s, /\[roll:/i, `"${q}" must not roll`);
    // Should produce a grounded fact or an honest decline — not gen-bank atmosphere.
    assert.doesNotMatch(s, /you see it through|it comes off cleanly|you manage it|it goes your way/i,
      `"${q}" must not produce gen:s atmosphere as its response`);
  }
});

// ── Classifier unit tests ─────────────────────────────────────────────────────

test('U312-CL1: directQuestionIntent returns non-null for direct questions', () => {
  const w = makeWorld();
  assert.ok(directQuestionIntent('were you born here?', w), '"were you born here?" must be classified as a direct question');
  assert.ok(directQuestionIntent("who's it from?", w), '"who\'s it from?" must be classified');
  assert.ok(directQuestionIntent('is there a name at the bottom?', w), '"is there a name?" must be classified');
  assert.ok(directQuestionIntent('have you always lived here?', w), '"have you always lived here?" must be classified');
  assert.ok(directQuestionIntent('do you live here, Elske?', w), '"do you live here?" must be classified');
});

test('U312-CL2: directQuestionIntent returns null for declared actions (over-match guard)', () => {
  const w = makeWorld();
  assert.equal(directQuestionIntent('I search the room', w), null,
    '"I search the room" is an action — must NOT be classified as a direct question');
  assert.equal(directQuestionIntent('I attack the guard', w), null,
    '"I attack the guard" is an action — must NOT be classified');
  assert.equal(directQuestionIntent('look around', w), null,
    '"look around" is exploration — must NOT be classified');
  assert.equal(directQuestionIntent('examine the chest', w), null,
    '"examine the chest" is exploration — must NOT be classified');
  assert.equal(directQuestionIntent('I try to pick the lock', w), null,
    '"pick the lock" has action verb — must NOT be classified');
});

test('U312-CL3: directQuestionIntent returns null for first-person permission questions', () => {
  const w = makeWorld();
  assert.equal(directQuestionIntent('can I climb the wall?', w), null,
    '"can I climb?" is a first-person permission/action question — must NOT be classified');
  assert.equal(directQuestionIntent('should I try to persuade him?', w), null,
    '"should I try?" has action verb — must NOT be classified');
  assert.equal(directQuestionIntent('do I need to roll?', w), null,
    '"do I need to roll?" is first-person permission — must NOT be classified');
});

// ── Diverge guards: actions still route to their resolvers ───────────────────

test('U312-DV1: "I search the room" still routes to the action resolver, not a decline', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'I search the room'));
  // A search action should either roll (action resolver) or produce explore-intent output.
  // It must NOT produce a declineInfoSeek "there's no record" response.
  assert.doesNotMatch(s, /there'?s no record|can'?t rightly say|that'?s lost|wouldn'?t know/i,
    '"I search the room" must not produce a declineInfoSeek response');
});

test('U312-DV2: "I attack the guard" still routes to the combat resolver', () => {
  const w = makeWorld();
  const s = surface(playerMove(w, PACKS, 'I attack the guard'));
  // Combat or combat-initiation output — must not be a question decline.
  assert.doesNotMatch(s, /there'?s no record|can'?t rightly say|that'?s lost/i,
    '"I attack the guard" must not produce a declineInfoSeek response');
});
