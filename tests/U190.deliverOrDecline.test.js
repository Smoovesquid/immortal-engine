// U190 — H-29 deliver-or-decline contract for info-seeking outcomes.
//
// Two layers, mirroring H-28's proven shape (see U184.narrationGroundTruth.test.js):
//   1) the deterministic base (engine/playloop.js: infoExtractionOutcome) — fixes
//      the real defect: an info-seeking success/mixed action must state a grounded
//      fact or decline in-fiction, never the bare gen:s/gen:m atmosphere bank, and
//      never invent a name/date/duration.
//   2) the validator backstop (engine/llmAdapter.js: validateNarrationCandidate
//      Rule 5 / findInventedFactClaim) — catches LLM polish that drifts back to
//      atmosphere-only or invents a bare year/duration the base never stated.
//
// Each rule's catch case is paired with a false-positive guard — the discipline
// this repo holds itself to for every grounding rule.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, infoExtractionOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { validateNarrationCandidate, findInventedFactClaim } from '../engine/llmAdapter.js';
import { isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';

const ATMOSPHERE_BANK_RE = /you see it through|it comes off cleanly|you manage it, and the way ahead|it half-works|it lands, after a fashion|put the question to those nearby/i;

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'pilgrims-rest') {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    packs()
  ).world;
}

// ── isInfoSeekingText classifier ──────────────────────────────────────────────

test('U190-01: isInfoSeekingText catches the 2026-06-19 gate-cluster phrasings', () => {
  const hits = [
    'So you settled in 1335 — who held the deed to this inn before you, by name?',
    "That's not an answer. Give me a name — who held this inn's deed before you?",
    'is Corvin Ashe dead, alive, or kin to you?',
    'What year is it right now, by your reckoning — give me the actual number?',
    'who sold you this inn in 1335?'
  ];
  for (const t of hits) assert.equal(isInfoSeekingText(t), true, `must classify as info-seeking: "${t}"`);
});

test('U190-02: isInfoSeekingText is false for ordinary non-fact-seeking actions', () => {
  const misses = [
    'I steady my breathing',
    'I strike with my sword',
    'I move north toward the gate',
    'I study the room carefully'
  ];
  for (const t of misses) assert.equal(isInfoSeekingText(t), false, `must NOT classify as info-seeking: "${t}"`);
});

// ── Deterministic base: deliver-or-decline, never atmosphere, never invention ──

test('U190-10: an ungrounded deed/ownership ask declines in-fiction, never the atmosphere bank', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'So you settled in 1335 — who held the deed to this inn before you, by name?', 'success');
  assert.ok(narr, 'must produce non-null narration');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'must never fall to the bare atmosphere bank');
});

test('U190-11: an ungrounded year ask declines, never invents a specific year', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'What year is it right now, by your reckoning — give me the actual number?', 'success');
  assert.ok(narr, 'must produce non-null narration');
  assert.doesNotMatch(narr, /\b1[0-9]{3}\b/, 'must not invent a bare year with no canon backing');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'must never fall to the bare atmosphere bank');
});

test('U190-12: an ungrounded kinship/life-status ask declines, never invents kin or a name', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, 'is Corvin Ashe dead, alive, or kin to you?', 'success');
  assert.ok(narr, 'must produce non-null narration');
  assert.doesNotMatch(narr, /\bCorvin Ashe\b/, 'must not invent confirmation about an ungrounded named entity');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'must never fall to the bare atmosphere bank');
});

test('U190-13: escalation — repeated ungrounded pressure on the same NPC sharpens the decline', () => {
  const w = world();
  const text = 'who sold you this inn in 1335?';
  // Simulate three prior turns of the same ungrounded ask via the timeline.
  const npc = null; // no settlement NPC resolvable in a bare freshly-begun world — world-level decline path
  void npc;
  const w1 = { ...w, timeline: [
    ...(w.timeline || []),
    { kind: 'resolution', data: { text, intent: text, outcome: 'success' } },
    { kind: 'resolution', data: { text, intent: text, outcome: 'success' } }
  ] };
  const tier0 = infoExtractionOutcome(w, text, 'success');
  const tier2 = infoExtractionOutcome(w1, text, 'success');
  assert.ok(tier0 && tier2, 'both tiers must produce narration');
  assert.notEqual(tier0, tier2, 'repeated pressure must escalate the decline phrasing');
});

test('U190-14: a non-info action still uses normal atmosphere (false-positive guard)', () => {
  const w = world();
  assert.equal(infoExtractionOutcome(w, 'I steady my breathing', 'success'), null,
    'a non-info-seeking action must not be intercepted by the deliver-or-decline guard');
});

test('U190-15: a LEGIT grounded answer (the real innkeeper name) is delivered, not declined', () => {
  const byId = packs();
  const w = world();
  const { world: w2 } = playerMove(w, byId, 'I walk toward the village');
  void w2;
  // Build a minimal world with a present, named NPC to exercise the grounded path directly.
  const npcWorld = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n => n.id === w.map.currentNodeId
        ? { ...n, settlement: { ...(n.settlement || {}), npcs: [{ id: 'npc1', name: 'Corwin Boneknit', role: 'innkeeper', knowledgeGraph: [] }] } }
        : n)
    }
  };
  const narr = infoExtractionOutcome(npcWorld, "What's your name?", 'success');
  assert.ok(narr, 'must produce non-null narration');
  assert.match(narr, /Corwin Boneknit/, 'the NPC\'s real, grounded name must be delivered, not declined or invented');
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, 'a grounded deliver must never read as the atmosphere bank');
});

// ── Validator backstop (Rule 5 / findInventedFactClaim) ───────────────────────

function makeCtx(overrides = {}) {
  return {
    placeName: 'Pilgrim\'s Rest Village',
    nodeType: 'settlement',
    location: 'Pilgrim\'s Rest Village',
    rollOutcome: 'success',
    infoSeeking: true,
    dialogueTurn: null,
    combat: null,
    ...overrides
  };
}

function makeWorld(overrides = {}) {
  return {
    meta: { fate: 0.5 },
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', name: "Pilgrim's Rest Village", nodeType: 'settlement' }],
      edges: []
    },
    scene: { objective: '', interior: null, location: "Pilgrim's Rest Village" },
    combat: null,
    party: [],
    ledger: { facts: [], threats: [], questions: [] },
    structures: { byId: {} },
    factions: [],
    instrument: { threads: [], motifs: [] },
    time: { turn: 1 },
    pack: { primaryId: 'fantasy' },
    ...overrides
  };
}

function run(world, cand, opts = {}) {
  return validateNarrationCandidate(world, cand, {
    baseNarration: opts.base ?? cand,
    ctx: opts.ctx ?? makeCtx(),
    ...opts.extra
  });
}

test('U190-20: REJECT — info-seeking success polished into bare atmosphere with no decline and no base content', () => {
  const world = makeWorld();
  const base = `There's no record of that — not one anyone's ever shown you, here at Pilgrim's Rest Village.`;
  const cand = `It comes off cleanly; the moment turns toward you at Pilgrim's Rest Village.`;
  assert.equal(run(world, cand, { base }), false, 'atmosphere-only polish on an info-success must be rejected');
});

test('U190-21: PASS — info-seeking success polish that keeps the grounded base content', () => {
  const world = makeWorld();
  const base = `Corwin Boneknit. I'm the innkeeper here, such as it is, at Pilgrim's Rest Village.`;
  const cand = `Without missing a beat, Corwin Boneknit owns to running the place at Pilgrim's Rest Village.`;
  assert.equal(run(world, cand, { base }), true, 'polish that preserves the grounded name must pass');
});

test('U190-22: PASS — info-seeking success polish that keeps an explicit decline', () => {
  const world = makeWorld();
  const base = `There's no record of that — not one anyone's ever shown you, here at Pilgrim's Rest Village.`;
  const cand = `He shakes his head — there's no record of that, not one he's ever shown you, here at Pilgrim's Rest Village.`;
  assert.equal(run(world, cand, { base }), true, 'polish that keeps the in-fiction decline must pass');
});

test('U190-23: PASS — non-info-seeking turn is unaffected by Rule 5', () => {
  const world = makeWorld();
  const ctx = makeCtx({ infoSeeking: false });
  const base = `You see it through, and it goes your way at Pilgrim's Rest Village.`;
  const cand = `You see it through, and it goes your way at Pilgrim's Rest Village.`;
  assert.equal(run(world, cand, { base, ctx }), true, 'Rule 5 must not fire for non-info-seeking turns');
});

test('U190-24: REJECT — invented bare year not present in the grounded base', () => {
  const world = makeWorld();
  const base = `There's no record of that — not one anyone's ever shown you, here at Pilgrim's Rest Village.`;
  const cand = `By Pilgrim's Rest Village's common reckoning, the year is 1347.`;
  assert.equal(run(world, cand, { base }), false, 'a bare invented year with no canon backing must be rejected');
});

test('U190-25: REJECT — invented duration claim not present in the grounded base', () => {
  const world = makeWorld();
  const base = `Corwin Boneknit. I'm the innkeeper here, such as it is, at Pilgrim's Rest Village.`;
  const cand = `Corwin Boneknit grins — twelve years running this place, at Pilgrim's Rest Village.`;
  assert.equal(run(world, cand, { base }), false, 'an invented tenure duration must be rejected');
});

test('U190-26: PASS — a year/duration that IS present in the grounded base', () => {
  const world = makeWorld();
  const base = `Corwin Boneknit says he's kept the place running for twelve years, at Pilgrim's Rest Village.`;
  const cand = `Corwin Boneknit says he's kept the place running for twelve years, at Pilgrim's Rest Village.`;
  assert.equal(run(world, cand, { base }), true, 'a grounded duration that matches the base must pass');
});

// ── findInventedFactClaim helper ──────────────────────────────────────────────

test('U190-30: findInventedFactClaim flags an ungrounded year', () => {
  const claim = findInventedFactClaim('the year is 1347, by all accounts', 'no calendar fact is on record');
  assert.equal(claim, '1347');
});

test('U190-31: findInventedFactClaim ignores a year that IS in the base', () => {
  const claim = findInventedFactClaim('settled here in 1335', 'the deed was signed in 1335');
  assert.equal(claim, null);
});

test('U190-32: findInventedFactClaim never throws on bad input', () => {
  assert.doesNotThrow(() => findInventedFactClaim(null, undefined));
  assert.equal(findInventedFactClaim(null, undefined), null);
});
