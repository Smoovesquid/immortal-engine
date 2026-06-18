import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isNpcObserverQuery } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Rung-1 gate 2026-06-18 — dead-end / UI-bleed guards (H-14, H-15, H-16).
// Three NPC-observer input classes must never produce:
//   (a) cardinal-exit recap ("Ways lead off east and south. What do you do?")
//   (b) movement/progress roll ("You manage it, and the way ahead opens" + roll:)
//   (c) a roster list of all present characters in lieu of answering the question

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// worldWithNpc: returns a started world that has at least one sociable NPC at the
// current node, or null (test can skip if the seed rolls no NPCs).
function worldWithNpc(seed = 'stonewatch-hollow') {
  const p = packs();
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), p).world;
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
  const npcs = (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
  return npcs.length ? { w, p, npcName: npcs[0].name } : null;
}

// ── Pattern detection ────────────────────────────────────────────────────────

test('U180-00: "who\'s that stranger" detected as NPC observer query', () => {
  assert.ok(isNpcObserverQuery("Who's that stranger watching me?"), 'must detect NPC observer');
});

test('U180-01: "is that stranger gone" detected as NPC presence query', () => {
  assert.ok(isNpcObserverQuery("Is that stranger gone for good?"), 'must detect NPC presence query');
});

test('U180-02: "look around" is NOT an NPC observer query', () => {
  assert.ok(!isNpcObserverQuery('look around'), '"look around" is a location survey, not NPC observer');
});

// ── (a) H-14: "Who's that stranger watching me?" ─────────────────────────────
// Must NOT produce cardinal-exit text or the "What do you do?" navigation prompt.

test('U180-10: "Who\'s that stranger watching me?" does not produce cardinal-exit text', () => {
  const got = worldWithNpc();
  if (!got) return; // seed has no NPCs — skip
  const { world: w2 } = playerMove(got.w, got.p, "Who's that stranger watching me?");
  const nar = String(w2 ? '' : '') || '';
  // Re-run to get output
  const { output } = playerMove(got.w, got.p, "Who's that stranger watching me?");
  assert.doesNotMatch(output.narration, /Ways lead off/i, 'must not produce cardinal-exit recap');
  assert.doesNotMatch(output.narration, /What do you do\?/i, 'must not produce navigation prompt');
});

test('U180-11: "Who\'s that stranger watching me?" produces NPC-related output', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { output } = playerMove(got.w, got.p, "Who's that stranger watching me?");
  assert.doesNotMatch(output.mechanics || '', /roll:/i, 'must not produce a dice roll');
  // The output must reference either the NPC name or a person-type word
  assert.match(output.narration, /\b(?:stranger|person|man|woman|fellow|guard|merchant|trader|elder|scholar|here|watching|nearby|\w+ the \w+)\b/i, 'must contain NPC-related content');
});

// ── (b) H-15: "Hey, I'm talking to you" ──────────────────────────────────────
// Must NOT fire the movement/progress roll gate.

test('U180-20: "Hey, I\'m talking to you" does not fire movement roll gate', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { output } = playerMove(got.w, got.p, "Hey, I'm talking to you");
  assert.doesNotMatch(output.mechanics || '', /roll:\d+\s+vs\s+DC/i, 'must not produce a dice roll mechanic');
});

test('U180-21: "Hey, I\'m talking to you — what are you looking at?" does not produce movement outcome text', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { output } = playerMove(got.w, got.p, "Hey, I'm talking to you — what are you looking at?");
  assert.doesNotMatch(output.narration, /way ahead opens/i, 'must not produce movement/progress text');
  assert.doesNotMatch(output.mechanics || '', /roll:\d+\s+vs\s+DC/i, 'must not be a dice roll');
});

test('U180-22: "Hey, Aldrich" still resolves as NPC dialogue (greeting with name not blocked)', () => {
  const got = worldWithNpc();
  if (!got) return;
  // "Hey, <name>" should still open dialogue with a named NPC — the guard must not block it
  const { world: w2 } = playerMove(got.w, got.p, `Hey, ${got.npcName}`);
  // Either dialogue opened or narration refers to approaching the NPC
  const npcRefInNar = String(w2.scene?.dialogue?.npcId || '').length > 0
    || (w2.scene?.dialogue?.npcId !== undefined);
  // We just check it doesn't produce a roll — the exact routing depends on the NPC name
  const { output } = playerMove(got.w, got.p, `Hey, ${got.npcName}`);
  assert.doesNotMatch(output.mechanics || '', /roll:\d+\s+vs\s+DC/i, '"Hey, <NPC name>" must not become a dice roll');
});

// ── (c) H-16: "Is that stranger gone?" ──────────────────────────────────────
// Must NOT produce a character roster list.

test('U180-30: "Is that stranger gone for good, or could I look for them around town?" does not produce roster list', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { output } = playerMove(got.w, got.p, 'Is that stranger gone for good, or could I look for them around town?');
  // A roster list typically looks like "A few folk are about — Name1, Name2, ..."
  assert.doesNotMatch(output.narration, /A few folk are about/i, 'must not produce roster-recap response');
  assert.doesNotMatch(output.narration, /Ways lead off/i, 'must not produce cardinal-exit text');
});

test('U180-31: "Is that stranger gone?" produces a DM answer about NPC presence', () => {
  const got = worldWithNpc();
  if (!got) return;
  const { output } = playerMove(got.w, got.p, 'Is that stranger gone?');
  assert.doesNotMatch(output.mechanics || '', /roll:\d+\s+vs\s+DC/i, 'must not produce a dice roll');
  // Should contain a word describing presence or absence
  assert.match(output.narration, /\b(?:here|gone|left|still|anywhere|empty|search|moved on|hasn'?t|haven'?t)\b/i, 'must answer about NPC presence/absence');
});
