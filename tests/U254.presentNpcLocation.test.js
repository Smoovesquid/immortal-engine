// U254 — D-B4 gate residual (c): never deny a PRESENT NPC's location.
//
// In the 2026-06-24 Opus gate the Lore-hound asked Dalla "where can I find Elske
// Nightherd right now?" and Dalla "genuinely can't place Elske at this hour" —
// while Elske Nightherd is listed as PRESENT at the same node. A canon
// hallucination: the engine denied the location of someone standing right there.
//
// Fix: a person-LOCATION query ("where is X" / "where can I find X") resolves
// against the present-NPC roster (sibling of the P-2 identity slot). When X is a
// present NPC, both the narrator and the NPC voice name their presence; when X is
// NOT present, the resolver returns null so the existing honest deflection stands
// (a real NPC may not know where someone NOT here is — no over-claim). A place
// noun ("where is the inn?") must NOT resolve to a person (the innKEEPER) — role
// matching for location is exact, never substring. §0-safe: presence only.
//
// docs/playtests/opus-gate-2026-06-24.md (Lore-hound — CANON_HALLUCINATION).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginDialogue, askNpc } from '../engine/npc/dialogue.js';
import { classifyPersonQuery, resolvePersonFact } from '../engine/world/personQuery.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// Wayfarers' Outpost on tallow — present sociable NPCs: Elske Nightherd, Dalla,
// Asha (no mirror; Pell is NOT here).
function world() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

// ── (a) classifier — "where is X" is a location query, distinct from identity ─

test('U254-a: "where can I find X right now?" classifies as a location query', () => {
  const q = classifyPersonQuery('where can I find Elske Nightherd right now?');
  assert.equal(q?.type, 'location');
  assert.equal(q.ref.toLowerCase(), 'elske nightherd', 'trailing "right now" is stripped from the ref');
});

test('U254-a: "who is X?" still classifies as identity (no regression)', () => {
  assert.equal(classifyPersonQuery('who is Elske?')?.type, 'identity');
});

// ── (b) resolver — present resolves, absent and place-noun do not ───────────

test('U254-b: a present NPC resolves to a location fact', () => {
  const w = world();
  const fact = resolvePersonFact(w, classifyPersonQuery('where is Elske?'));
  assert.equal(fact?.type, 'location');
  assert.match(String(fact.name || ''), /Elske/);
});

test('U254-b: an ABSENT NPC returns null (the caller honest-declines, no over-claim)', () => {
  const w = world();
  assert.equal(resolvePersonFact(w, classifyPersonQuery('where is Pell?')), null);
});

test('U254-b: a PLACE noun does not resolve to a person (inn != innkeeper)', () => {
  const w = world();
  // "where is the inn?" classifies as location but must not point at the innkeeper.
  assert.equal(resolvePersonFact(w, classifyPersonQuery('where is the inn?')), null);
});

// ── (c) narrator path — names the present NPC, never denies ─────────────────

test('U254-c: narrator "where can I find Elske right now?" says she is right here', () => {
  const { output } = playerMove(world(), packs(), 'where can I find Elske Nightherd right now?');
  assert.match(output.narration, /Elske Nightherd is right here/i);
  assert.doesNotMatch(output.narration, /can'?t place|can'?t say|don'?t know/i, 'must never deny a present NPC');
});

test('U254-c: narrator "where is the inn?" does NOT answer with a person', () => {
  const { output } = playerMove(world(), packs(), 'Where is the inn?');
  assert.doesNotMatch(output.narration, /is right here — no need to look far/i, 'a place query must not get the person-location answer');
});

// ── (d) dialogue path — the gate scenario: Dalla locates present Elske ───────

test('U254-d: in dialogue, asking Dalla where Elske is points her out (not deflected)', () => {
  const w2 = beginDialogue(world(), 'Dalla').world;
  const r = askNpc(w2, 'where can I find Elske Nightherd right now?');
  assert.equal(r.outcome?.mode, 'identity', 'a present NPC must not be deflected');
  assert.match(String(r.outcome?.commonBody || ''), /right here/i, 'names her presence');
  assert.match(String(r.outcome?.commonBody || ''), /Elske/, 'names Elske');
});

test('U254-d: asking Dalla where an ABSENT NPC is still deflects (honest, no false presence)', () => {
  const w2 = beginDialogue(world(), 'Dalla').world;
  const r = askNpc(w2, 'where is Pell?');
  assert.doesNotMatch(String(r.outcome?.commonBody || ''), /right here/i, 'must not claim an absent NPC is present');
});

// ── (e) §0 — the location answer leaks nothing of the hidden why ────────────

test('U254-e: the present-NPC location answer surfaces presence only (no faction/motive)', () => {
  const { output } = playerMove(world(), packs(), 'where is Asha?');
  assert.doesNotMatch(output.narration, /faction|cult|allegiance|works for|serves|loyal|wants|plotting/i, '§0: presence only');
});
