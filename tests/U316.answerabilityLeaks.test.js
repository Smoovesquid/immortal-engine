// U316 — AG-2: the residual answerability leaks from the post-family Opus gate
// (docs/playtests/opus-gate-2026-07-02-postfamily.md). One bug shape: a broad
// "look-around / unknown-referent" claim fires BEFORE the typed direct-question
// reroute, so the answer machinery never runs.
//
// Part A — rules/place/object questions must not die at the referent/atmosphere
// sinks (a "class"/"ability" question must not read the proper noun as an
// ungrounded NPC name; an object-referent-followup must not be swallowed by the
// "who's this X" direct-address pattern).
//
// Part B — a presence sub-question inside an explore claim ("what do I see in
// here — and who's standing in it?") must route to the roster, not the
// people-blind exits recap.
//
// All reproducible LLM-OFF at the routing layer. Uses playerMove (not the gate
// harness).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginAdventure, playerMove } from '../engine/playloop.js';
import { newWorld } from '../engine/state.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// A non-interior settlement world, several NPCs present. Used for Part A —
// none of these repros should ever read an unrelated present NPC as the
// referent, or open dialogue with one uninvited.
function settlementWorld(seed = 'ashfen-reach') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  return { ...w, scene: { ...(w.scene || {}), interior: null, dialogue: null }, combat: { ...(w.combat || {}), active: false } };
}

// The same seed's boot state IS a real interior (structureKey/roomId), with at
// least one present, non-hostile NPC in-room — used for Part B.
function interiorWorld(seed = 'ashfen-reach') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  return w;
}

function surface(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`.trim();
}

// ── Part A ────────────────────────────────────────────────────────────────

test('U316-A1: a class/ability question answers from the ruleset, never [clarify:referent]', () => {
  const w = settlementWorld();
  const { output } = playerMove(w, PACKS, "Gravedigger's an odd class — what can I actually do with it? special abilities?");
  assert.doesNotMatch(output.mechanics || '', /\[clarify:referent\]/, surface({ output }));
  assert.doesNotMatch(output.narration, /no one by that name here/i, surface({ output }));
  assert.match(output.narration, /background|class/i, surface({ output }));
});

test('U316-A2: "the last traveler who slept here" gets an honest no-record, not [clarify:referent]', () => {
  const w = settlementWorld();
  const { output } = playerMove(w, PACKS, 'tell me about the last traveler who slept on this pallet');
  assert.doesNotMatch(output.mechanics || '', /\[clarify:referent\]/, surface({ output }));
  assert.match(output.narration, /don.t know|can.t say|no record|lost to me/i, surface({ output }));
});

test('U316-A3: "who\'s this letter from?" answers or honestly declines, never opens dialogue with an unrelated NPC', () => {
  const w = settlementWorld();
  const { output } = playerMove(w, PACKS, "who's this letter from?");
  assert.doesNotMatch(output.mechanics || '', /\[dialogue enter/i, surface({ output }));
  assert.match(output.narration, /can.t say|don.t know|no record|no name/i, surface({ output }));
});

test('U316-A4 (LH-3): an npc-addressed motive/secret question declines in the NPC\'s own voice, never a Wizard place-dump', () => {
  const w = settlementWorld();
  const { output } = playerMove(w, PACKS, "I have to ask — what are you afraid I'll find?");
  assert.doesNotMatch(output.narration, /^Wizard: You stand still|^Wizard: You're (?:in|inside)\b/i, surface({ output }));
  assert.match(output.narration, /can.t say|don.t know|no record|lost to me/i, surface({ output }));
});

// ── Part B ────────────────────────────────────────────────────────────────

test('U316-B1: a presence sub-question inside a look-around names the present NPC, not "little of note"', () => {
  const w = interiorWorld();
  assert.ok(w.scene?.interior?.structureKey, 'precondition: a real interior with a structureKey');
  const { output } = playerMove(w, PACKS, "what do I see in here — and who's standing in it?");
  assert.doesNotMatch(output.narration, /little of note/i, surface({ output }));
  // The room roster ran — either it names someone present, or (if genuinely
  // solitary) it says so explicitly; either way it must NOT be the bare
  // exits-only recap that never mentions people at all.
  assert.doesNotMatch(output.narration, /^Wizard: You (?:stand still and read|take the measure of)/i, surface({ output }));
});

// ── Diverge guards (anti-regression) ────────────────────────────────────────

test('U316-D1: a BARE look-around (no presence question) stays room-scoped — no roster dump (FIRST_ROOM #4)', () => {
  const w = interiorWorld();
  const { output } = playerMove(w, PACKS, 'look around');
  assert.match(output.narration, /Ways lead off|way out|corner of/i, surface({ output }));
});

test('U316-D2: a real unknown-NPC demonstrative ("who is that?") still opens dialogue (locked C4)', () => {
  // OCC-STORY-1: "who is that?" opens dialogue with a person in LINE OF SIGHT. The wake cottage is now
  // empty of strangers by design, and the hand-synthesized outdoor state (interior:null) lacks the
  // player's real outdoor walk-position that presence resolution needs — so we use the REAL egress
  // ("step outside"), which puts the player among the townsfolk. More faithful to actual play, too.
  const w = playerMove(beginAdventure(newWorld({ seed: 'ashfen-reach', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world, PACKS, 'I step outside').world;
  const { output } = playerMove(w, PACKS, 'who is that?');
  assert.match(output.mechanics || '', /\[dialogue enter/i, surface({ output }));
});

test('U316-D3: a declared action ("I search the chest") still acts — never intercepted as a question', () => {
  const w = settlementWorld();
  const { output } = playerMove(w, PACKS, 'I search the chest');
  assert.match(output.mechanics || '', /\[roll:/, surface({ output }));
});

// ── Determinism ──────────────────────────────────────────────────────────

test('U316-DET: identical world + input produces identical output (no hidden randomness)', () => {
  const texts = [
    "Gravedigger's an odd class — what can I actually do with it? special abilities?",
    "who's this letter from?",
    "what do I see in here — and who's standing in it?",
  ];
  for (const t of texts) {
    const w1 = t.includes('standing in it') ? interiorWorld() : settlementWorld();
    const w2 = t.includes('standing in it') ? interiorWorld() : settlementWorld();
    const r1 = playerMove(w1, PACKS, t);
    const r2 = playerMove(w2, PACKS, t);
    assert.equal(surface(r1), surface(r2), `determinism broke for: ${t}`);
  }
});
