// U280 — a vague "what do I know about this area?" is the player asking the game to be
// their memory. We keep NO auto-recall (write-it-down, the tabletop way), so a real DM
// points you back at your own notes. Distinct from "what do YOU know about X" (asking an
// NPC for lore) and from "what do I do?" (options/action). Hermetic — pure functions.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const world = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U280: a vague "what do I know" → check your notes (no auto-recall)', () => {
  const w = world();
  for (const q of [
    'What do I know about this area?',
    'what do I know about this place?',
    'What do I remember about this town?',
    'what do I recall here?',
    'what do I know?'
  ]) {
    assert.equal(isMetaQuestion(q), true, `should be a meta-question: ${q}`);
    assert.match(handleMetaQuestion(q, w), /notes/i, `should point at your notes: ${q}`);
  }
});

test('U280: "what do YOU know about X" is NOT the notes deflection (that asks an NPC for lore)', () => {
  // Second person ("do you") is info-seeking, routed elsewhere — must not be hijacked.
  const ans = handleMetaQuestion('what do you know about the old war?', world());
  assert.doesNotMatch(String(ans || ''), /your notes|check your notes/i, `info-seeking must not become a notes deflection: ${ans}`);
});

test('U280: "what do I do?" (options/action) is not a notes deflection', () => {
  const ans = handleMetaQuestion('what do I do now?', world());
  assert.doesNotMatch(String(ans || ''), /your notes|check your notes/i, `an options question is not a memory question: ${ans}`);
});
