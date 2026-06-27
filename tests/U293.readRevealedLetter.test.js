// U293 — a revealed container item is GROUNDED, readable scene state (live-play bug, 2026-06-27).
//
// Live repro: the player opened the iron-bound chest, the DM revealed "a folded letter, its seal
// broken", then the player typed "read the letter" and the DM DENIED it — "no letter, only a straw
// pallet / oil lantern / chest". THE_DM_TEST: once the chest reveal names a letter, the next "read
// the letter" must not claim it doesn't exist.
//
// Root cause: container contents are deterministic (containerContents) and narrated on open, but
// only the furniture state ('open') was persisted — the letter was never grounded as a readable
// object, so "read the letter" routed through the ungrounded-object-read decline.
//
// Fix: a read/peek aimed at a text-object that an OPEN container here actually holds is acknowledged
// from that grounded item (re-derived deterministically from the persisted 'open' state). No
// authored body exists yet, so the DM honestly reports the letter as present-but-not-legible — it
// never denies the object and never invents lore (narration != canon). Hermetic — no network/API.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { containerContents, containerItemText } from '../engine/decompression/generateFurniture.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Precondition: the tallow iron-bound chest deterministically holds the folded letter.
function chestHasLetter(w) {
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const chest = (node.furniture || []).find(f => /chest/i.test(f.name || ''));
  if (!chest) return false;
  return containerContents(w.meta.seed, node.id, chest.name, chest.category).some(it => /letter/i.test(it));
}

// Every shape of "the letter isn't real" the engine can currently produce: the examine-pivot
// ("you look for a letter, but what's here is …"), the read-the-room floor bounce, the
// object-read decline, and the LLM's live "no letter / only a straw pallet" rendering.
const DENIAL_RE = /what'?s here is|look for a[n]? [a-z]+, but|holds no letter|no letter|there'?s nothing here that means|come up empty|stand still and read|ways lead off|what do you do\?|only a straw pallet/i;
// The grounded-acknowledgment signature — the letter is in hand / being read.
const ACK_RE = /unfold|in (?:your|my) hands?|drawn from|lift(?:ed)?|take up|faded|legible|seal/i;

test('U293: precondition — the iron-bound chest reveals a folded letter on open', () => {
  const w = boot();
  assert.ok(chestHasLetter(w), 'tallow chest must hold the folded letter (deterministic fixture)');
  const { output } = playerMove(w, PACKS, 'open the iron-bound chest');
  assert.match(output.narration, /folded letter|letter/i, `opening must reveal the letter: ${output.narration}`);
});

test('U293: after opening the chest, "read the letter" does NOT deny the letter', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const { output } = playerMove(opened, PACKS, 'read the letter');
  assert.doesNotMatch(output.narration, DENIAL_RE, `must not deny the just-revealed letter: ${output.narration}`);
  assert.match(output.narration, /letter/i, `must acknowledge the letter: ${output.narration}`);
});

test('U293: "what does the letter say?" acknowledges the grounded letter (legible or honestly not)', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const { output } = playerMove(opened, PACKS, 'what does the letter say?');
  assert.doesNotMatch(output.narration, DENIAL_RE, `must not deny the letter: ${output.narration}`);
  assert.match(output.narration, /letter/i, `must speak to the letter: ${output.narration}`);
});

test('U293: "read it" right after opening resolves to the revealed letter (unambiguous pronoun)', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const { output } = playerMove(opened, PACKS, 'read it');
  assert.doesNotMatch(output.narration, DENIAL_RE, `"read it" must not deny the letter: ${output.narration}`);
  assert.match(output.narration, /letter/i, `"read it" must resolve to the letter: ${output.narration}`);
});

test('U293: BEFORE opening, "read the letter" does NOT acknowledge a letter in hand (gate is the reveal)', () => {
  // The letter is grounded only once the chest is opened — reading it cold must not claim the
  // player is holding/reading a letter; it stays the honest not-found answer.
  const { output } = playerMove(boot(), PACKS, 'read the letter');
  assert.doesNotMatch(output.narration, /unfold|in (?:your|my) hands?|drawn from the/i, `cold read must not hold the letter: ${output.narration}`);
});

test('U293: the acknowledgment is deterministic', () => {
  const a = playerMove(playerMove(boot(), PACKS, 'open the iron-bound chest').world, PACKS, 'read the letter').output.narration;
  const b = playerMove(playerMove(boot(), PACKS, 'open the iron-bound chest').world, PACKS, 'read the letter').output.narration;
  assert.equal(a, b, 'same seed → identical read narration');
});

test('U293: reading the letter delivers authored body, not the not-legible fallback', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const { output } = playerMove(opened, PACKS, 'read the letter');
  const NOT_LEGIBLE_RE = /faded past reading|nothing on it you can make out|too far gone to read|lost to damp and age|nothing legible remains/i;
  assert.doesNotMatch(output.narration, NOT_LEGIBLE_RE, `must deliver authored body, not fallback: ${output.narration}`);
  assert.match(String(output.mechanics || ''), /legible text/, `mechanics tag must reflect legible text: ${output.mechanics}`);
});

test('U293: authored body contains no §0 cosmology vocabulary', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const { output } = playerMove(opened, PACKS, 'read the letter');
  const COSMOLOGY_RE = /\b(?:orb|cataclysm|waveform|pale root|mintFact|27[,\s]?000|mandela)\b/i;
  assert.doesNotMatch(output.narration, COSMOLOGY_RE, `narration must not contain §0 cosmology: ${output.narration}`);
});

test('U293: containerItemText — null for non-letter items; letter body is stable and clean', () => {
  assert.equal(containerItemText('tallow', 'n0', 'iron-bound chest', 'a scroll of notes'), null, 'non-letter returns null');
  assert.equal(containerItemText('tallow', 'n0', 'iron-bound chest', 'a parchment note'), null, 'non-parchment note returns null');
  const body = containerItemText('tallow', 'n0', 'iron-bound chest', 'a folded letter, its seal broken');
  assert.ok(typeof body === 'string' && body.length > 10, `letter must have an authored body: ${body}`);
  assert.equal(
    containerItemText('tallow', 'n0', 'iron-bound chest', 'a folded letter, its seal broken'),
    body,
    'same inputs → byte-identical body'
  );
  const COSMOLOGY_RE = /\b(?:orb|cataclysm|waveform|pale root|mintFact|27[,\s]?000|mandela)\b/i;
  assert.doesNotMatch(body, COSMOLOGY_RE, `body must not contain §0 cosmology: ${body}`);
});
