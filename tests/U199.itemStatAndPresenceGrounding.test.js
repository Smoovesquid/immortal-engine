// U199 — H-37 bundled pass off the post-H-36 Opus gate (9/48 fails).
//
//   R1 (gracefulAdjudication.js) — item/gear-stat answer-binding: a compound
//     gear+coin or weapon+armor ask must answer ALL named slots, and a
//     standalone armor-piece-defense ask must resolve to the real AC.
//   R2 (llmAdapter.js)           — mixed-roll-margin: traced to TWO distinct
//     root causes — (a) isInfoSeekingText missed "family"-anchored asks
//     entirely (a detection gap, so deliver-or-decline never ran), and
//     (b) Rule 3's FRICTION list had a false-positive 'pay' substring that
//     let a clean full payment-reversal slip past the mixed-roll guard.
//   R3 (playloop.js)             — corpse/object-handling against an
//     already-defeated NPC is a non-combat staging action, not a renewed
//     attack; must narrate, not dead-end through [combat:no-live-target].
//   R4 (llmAdapter.js)           — NPC presence/quote canon-grounding: reject
//     a fabricated quoted/attributed past NPC statement absent from the
//     grounded base (4e), and reject a denial of an NPC's presence when the
//     real roster lists them as present (4f).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { handleMetaQuestion, isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';
import { validateNarrationCandidate } from '../engine/llmAdapter.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function world(seed = 'u199-fixture') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs).world;
}

// ── R1 — item/gear-stat answer-binding ──────────────────────────────────────

test('U199-R1a: CATCH — compound gear+coin ask answers both halves', () => {
  const w = world();
  const ans = handleMetaQuestion('What gear and weapons am I carrying, and do I have any coin?', w);
  assert.match(ans, /worn blade|leather jerkin|lockpick/i, 'gear half answered');
  assert.match(ans, /coin|copper|silver|gold|purse|nothing/i, 'coin half answered');
});

test('U199-R1b: CATCH — standalone armor-piece-defense ask resolves to real AC', () => {
  const w = world();
  const ans = handleMetaQuestion("And the Leather jerkin — what's its AC or defense bonus?", w);
  assert.match(ans, /\bAC\b|\bArmor\b/i, 'answers with the real armor number, not a dodge');
  assert.doesNotMatch(ans, /not sure|can't say|don't know/i, 'must not dodge a single-slot item ask');
});

test('U199-R1c: GUARD — a single bare gear ask still works (no compound-fold regression)', () => {
  const w = world();
  const ans = handleMetaQuestion('What am I carrying?', w);
  assert.match(ans, /worn blade|leather jerkin|lockpick/i, 'plain inventory ask unaffected by the broadened regex');
});

// ── R2 — mixed-roll-margin resolution ───────────────────────────────────────

test('U199-R2a: CATCH (detection gap) — a family-anchored ask is detected as info-seeking', () => {
  assert.equal(isInfoSeekingText("who in his family was the first Boneknit, and how'd they earn it?"), true,
    'the "family" anchor must route this through deliver-or-decline, not fall through undetected');
});

test('U199-R2b: GUARD — ordinary non-info text is not flagged info-seeking', () => {
  assert.equal(isInfoSeekingText('I walk to the well and draw water.'), false);
});

function mixedCtx(overrides = {}) {
  return { placeName: 'Wayfarers Outpost', nodeType: 'settlement', location: 'Wayfarers Outpost', rollOutcome: 'mixed', ...overrides };
}

function mixedWorld() {
  return {
    meta: { fate: 0.5 }, map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: 'Wayfarers Outpost', nodeType: 'settlement' }], edges: [] },
    scene: { objective: '', location: 'Wayfarers Outpost' }, combat: null, party: [],
    ledger: { facts: [], threats: [], questions: [] }, structures: { byId: {} }, factions: [], instrument: { threads: [], motifs: [] },
    time: { turn: 1 }, pack: { primaryId: 'fantasy' }
  };
}

test('U199-R2c: CATCH (false-friction signal) — a mixed roll narrated as a clean full payment is rejected', () => {
  const w = mixedWorld();
  const cand = 'You hand over the silver and it is paid in full, the reversal clean and complete at Wayfarers Outpost.';
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: mixedCtx() }), false,
    'a mixed outcome must not read as a clean full payment, even when it contains "paid"');
});

test('U199-R2d: GUARD — a mixed roll that keeps real friction language still passes', () => {
  const w = mixedWorld();
  const cand = 'You hand over the silver, though two coins short of the full sum, at Wayfarers Outpost.';
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: mixedCtx() }), true,
    'genuine friction/cost language must still satisfy Rule 3');
});

test('U199-R2e: GUARD — a clean win on a SUCCESS (not mixed) roll is unaffected', () => {
  const w = mixedWorld();
  const cand = 'You hand over the silver and it is paid in full at Wayfarers Outpost.';
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: mixedCtx({ rollOutcome: 'success' }) }), true,
    'Rule 3 only fires on outcome=mixed');
});

// ── R3 — corpse/object-handling vs already-defeated target ─────────────────

function withCorwin(seed, profile = {}) {
  let w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs).world;
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}),
      decompressed: true,
      npcs: [{
        id: 'npc_corwin', name: 'Corwin', role: 'healer', hostile: false,
        combatProfile: { maxHp: 20, damage: 1, ac: 1, canParley: false, ...profile },
        personality: {}, conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [], secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

function defeatedCorwinWorld(seed = 'u199-r3-defeated') {
  let w = withCorwin(seed);
  return ensureWorld({ ...w, meta: { ...w.meta, npcCombatHp: { npc_corwin: { hp: 0, down: true } } } });
}

test('U199-R3a: CATCH — dragging an already-defeated NPC\'s body narrates the staging action, not a combat dead-end', () => {
  const w = defeatedCorwinWorld();
  const result = playerMove(w, packs, 'I drag his body into the village square and prop it up for everyone to see.');
  const mech = String(result.output.mechanics || '');
  assert.doesNotMatch(mech, /combat:no-live-target/, `must not dead-end through the combat gate: ${mech}`);
  assert.match(String(result.output.narration || ''), /Corwin|body/i, 'narrates the staging action');
});

test('U199-R3b: GUARD — a fresh attack on a LIVING NPC still resolves as combat', () => {
  const w = withCorwin('u199-r3-live', { maxHp: 20, damage: 1, ac: 1 });
  const result = playerMove(w, packs, 'I kick Corwin in the ribs.');
  assert.match(String(result.output.mechanics || ''), /strike:/, 'a live target still fights');
});

test('U199-R3c: GUARD — a renewed grapple on an already-defeated NPC still no-ops via the combat gate', () => {
  const w = defeatedCorwinWorld('u199-r3-grapple');
  const result = playerMove(w, packs, 'I grab Corwin by the collar and demand answers.');
  assert.equal(String(result.output.mechanics || ''), '[combat:no-live-target]',
    'a genuine renewed-attack shape (grapple) on a corpse is unchanged — only body-MOVE verbs get the new branch');
});

// ── R4 — NPC presence/quote canon-grounding ─────────────────────────────────

const R4_PLACE = 'Wayfarers Outpost';

function r4World() {
  return {
    meta: { fate: 0.5 }, map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: R4_PLACE, nodeType: 'settlement' }], edges: [] },
    scene: { objective: '', location: R4_PLACE }, combat: null, party: [],
    ledger: { facts: [], threats: [], questions: [] }, structures: { byId: {} }, factions: [], instrument: { threads: [], motifs: [] },
    time: { turn: 1 }, pack: { primaryId: 'fantasy' }
  };
}

function r4Ctx() {
  return {
    placeName: R4_PLACE, nodeType: 'settlement', location: R4_PLACE, dialogueTurn: null, combat: null,
    settlement: { npcs: [{ id: 'npc_brokefang', name: 'Brokefang', role: 'enforcer' }] }
  };
}

test('U199-R4a: CATCH — a fabricated quoted past statement absent from canon is rejected', () => {
  const w = r4World();
  const cand = `Corwin recalls you asking, "smoke always follows Brokefang" here at ${R4_PLACE}.`;
  const base = `You stand quietly at ${R4_PLACE}.`;
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: base, ctx: r4Ctx() }), false,
    'a quoted "recalled" statement not grounded in the base must be rejected');
});

test('U199-R4a-guard: PASS — the same quoted statement IS grounded in the base', () => {
  const w = r4World();
  const cand = `Corwin recalls you asking, "smoke always follows Brokefang" here at ${R4_PLACE}.`;
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: r4Ctx() }), true,
    'a grounded quote must pass');
});

test('U199-R4a-guard2: PASS — a denial framing ("you never asked") is exempt, not a fabricated claim', () => {
  const w = r4World();
  const cand = `You never asked Corwin, "smoke always follows Brokefang" at ${R4_PLACE}.`;
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: r4Ctx() }), true,
    'denial/negation lead-in must not trip the fabricated-quote rule');
});

test('U199-R4b: CATCH — denying a roster-present NPC\'s presence is rejected', () => {
  const w = r4World();
  const cand = `Brokefang is not here in this room at ${R4_PLACE}.`;
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: r4Ctx() }), false,
    'denying presence of an NPC the real roster lists as present must be rejected');
});

test('U199-R4b-guard: PASS — confirming the roster-present NPC is here passes', () => {
  const w = r4World();
  const cand = `Brokefang is here, snarling at you in ${R4_PLACE}.`;
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: r4Ctx() }), true,
    'confirming a real present NPC must pass');
});

test('U199-R4b-guard2: PASS — a denial about an unrelated, non-roster noun is untouched', () => {
  const w = r4World();
  const cand = `The merchant is not here at ${R4_PLACE}, just an empty stall.`;
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: cand, ctx: r4Ctx() }), true,
    'a denial unrelated to the real roster NPC name must not false-positive');
});
