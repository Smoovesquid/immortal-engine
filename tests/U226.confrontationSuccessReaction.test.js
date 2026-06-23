import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, genericGroundedOutcome } from '../engine/playloop.js';
import { isConfrontationChallenge } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// THE_REF-1 — Empty-Success Materialization (gate-13 turn-5, 2026-06-23).
//
// The lore-hound challenged Kael ("are you telling me he lied?") on a succeeded
// roll (`[roll:20 vs DC:12 → success]`) and got the content-free filler
// "You see it through, and it goes your way." — a DM_TEST_DEADEND: a pointed
// social challenge resolved to nothing in the fiction.
//
// ROOT CAUSE (deterministic, not an LLM/validator problem): two gaps in the
// out-of-dialogue grace path —
//   (1) isConfrontationChallenge did NOT recognize the accusation-BY-QUESTION
//       shape ("are you telling me he lied?") — only present-tense "you're lying"
//       — so the challenge never reached the confrontation handler; and
//   (2) genericGroundedOutcome's confrontation handler was scoped to outcome
//       'failure' only, so a SUCCEEDED challenge fell through to the gen:s
//       atmosphere bank ("it goes your way").
// Fix: CONFRONTATION_TELLING_LIED_RE + an outcome-aware confrontationReaction
// (success = a landed read/tell, mixed = a half-caught flicker, failure =
// stonewall), wired for ALL outcomes. The contested FACT is never conceded or
// invented — a landed confrontation resolves the SOCIAL beat, not the lore
// (the Law of Earned Knowledge / EK-1 holds). In-dialogue confrontations are
// unchanged (they route to askNpc, which already reacts in character).
//
// Pure assertion on the exported genericGroundedOutcome + the classifier — no
// LLM, deterministic. Sibling to U202 (deliver-or-decline last-resort), U130
// (confrontation arc). See docs/CAPABILITY_LEDGER.md THE_REF-1.

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}
const packs = loadPacks();

function withCorwin(seed = 'theref1') {
  const w = beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}), decompressed: true,
      npcs: [{
        id: 'npc_corwin', name: 'Corwin', role: 'healer', hostile: false,
        personality: {}, conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [], secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

// The generic atmosphere bank the empty success used to fall to (from U202).
const ATMOSPHERE_BANK_RE = /it goes your way|it comes off cleanly|way ahead opens a little|it half-works|though not what you hoped|after a fashion|doesn't come off the way you meant|falls short here in|doesn't give it to you|put the question to those nearby|something real to go on|\bask around\b/i;
// An explicit VERDICT on the contested lie — must never appear (EK-1: a landed
// read is a tell, not a fabricated/conceded fact).
const LIE_VERDICT_RE = /\b(?:he|she|they|corwin|mira)\s+lied\b|\bdid\s+lie\b|\bdidn'?t\s+lie\b|\bwas\s+lying\b|\btold\s+(?:you\s+)?the\s+truth\b|\bbeen\s+honest\s+with\s+you\b/i;

const CONFRONT = 'Corwin, are you telling me you lied to me about that?';

// ── (1) the classifier now recognizes the accusation-by-question shape ───────

test('U226-01: isConfrontationChallenge recognizes "are you telling me … lied?" and bare "are you lying?"', () => {
  for (const t of [
    'are you telling me he lied about that?',
    'so are you telling me he lied?',
    'Corwin, are you telling me Mira lied to me?',
    'are you lying to me?',
  ]) assert.equal(isConfrontationChallenge(t), true, `should be a confrontation: ${t}`);
});

test('U226-02: benign "are you telling me …" questions are NOT confrontations (no false positive)', () => {
  for (const t of [
    'are you telling me the truth?',
    'are you saying the festival is over?',
    'are you telling me where Kael is?',
  ]) assert.equal(isConfrontationChallenge(t), false, `should NOT be a confrontation: ${t}`);
});

// ── (2) a SUCCEEDED confrontation yields a reaction, never the empty filler ──

test('U226-03: confrontation SUCCESS produces an NPC reaction, not the gen:s "goes your way" filler', () => {
  const out = genericGroundedOutcome(withCorwin(), CONFRONT, 'success');
  assert.doesNotMatch(out, ATMOSPHERE_BANK_RE, `succeeded challenge must not be empty filler: ${out}`);
  assert.match(out, /Corwin/, 'the reaction must name the confronted NPC');
  assert.match(out, /"/, 'a confrontation reaction includes the NPC speaking');
});

test('U226-04: confrontation MIXED also yields a reaction, not filler', () => {
  const out = genericGroundedOutcome(withCorwin(), CONFRONT, 'mixed');
  assert.doesNotMatch(out, ATMOSPHERE_BANK_RE, `mixed challenge must not be empty filler: ${out}`);
  assert.match(out, /Corwin/);
});

test('U226-05: confrontation FAILURE still stonewalls in-character (H-42 behavior preserved)', () => {
  const out = genericGroundedOutcome(withCorwin(), CONFRONT, 'failure');
  assert.doesNotMatch(out, ATMOSPHERE_BANK_RE, `failed challenge must not be empty filler: ${out}`);
  assert.match(out, /Corwin/);
});

// ── EK-1: a landed confrontation resolves the social beat, never the lore ────

test('U226-06: a succeeded confrontation does NOT assert/concede the contested fact (no invention)', () => {
  for (const oc of ['success', 'mixed', 'failure']) {
    const out = genericGroundedOutcome(withCorwin(), CONFRONT, oc);
    assert.doesNotMatch(out, LIE_VERDICT_RE, `[${oc}] must not invent or concede the lie verdict: ${out}`);
  }
});

// ── regression: the generic + honest-decline paths are untouched ─────────────

test('U226-07: a NON-confrontation action still uses the generic outcome (branch is not over-firing)', () => {
  const out = genericGroundedOutcome(withCorwin(), 'I rummage through the crates by the door', 'success');
  assert.doesNotMatch(out, /Corwin/, 'a plain action must not get hijacked into a confrontation reaction');
});

test('U226-08: an ungrounded info-seeking question still honestly declines (decline path preserved)', () => {
  const out = genericGroundedOutcome(withCorwin(), 'tell me about the war', 'success');
  assert.doesNotMatch(out, ATMOSPHERE_BANK_RE, 'an info-seek must decline, not fall to the atmosphere bank');
  // An honest decline may have the NPC voice it ("Corwin spreads their hands…"); what
  // matters is that it declines the unknown, never inventing it or conceding a fact.
  assert.match(out, /lost to me|wouldn'?t know|no record|can'?t say|can'?t rightly say|couldn'?t tell|don'?t have it|nothing.*to tell/i,
    `an unknown fact must be an honest decline: ${out}`);
});
