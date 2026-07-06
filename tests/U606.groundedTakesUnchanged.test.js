// U606 — PW-2 must be a NO-OP for grounded takes. The honest-floor gate declines only nouns canon
// does not hold; every legitimate source keeps today's exact behavior (docs/briefs/
// PROSE_TO_WORLD_CONTRACT.md — PW-2 row: "Grounded takes stay byte-identical").
//
// The four sources, and how each is verified here:
//   1. a REVEALED remaining container item  → PW-1's mint ([take:revealed-item]) still fires,
//   2. a PRESENT furniture piece            → the physics path ([physics:…]) still fires,
//   3. an INVENTORY item already carried     → the already-held acknowledgment still fires,
//   4. a COMBAT-loot / collective grab       → "loot the bodies" is a collective, not a named noun,
//      so the gate yields (BULK_TAKE_RE) and the post-combat loot handler is untouched.
// The check is a byte-for-byte snapshot: capture the narration+mechanics with the gate live and
// assert the take:nothing-here decline NEVER appears for a grounded noun. Hermetic — no network/API.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const DECLINE_MECH = /\[take:nothing-here/;

test('U606 source 1 — a revealed container item still MINTS (PW-1 untouched, byte-identical)', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const { output } = playerMove(opened, PACKS, 'I pocket the letter');
  assert.doesNotMatch(output.mechanics, DECLINE_MECH, `a revealed item must not be declined: ${output.mechanics}`);
  assert.equal(output.mechanics, '[take:revealed-item | grounded object, no roll]', `PW-1 mint mechanics unchanged: ${output.mechanics}`);
  assert.match(output.narration, /folded letter.*iron-bound chest.*into your pack/i, `PW-1 mint prose unchanged: ${output.narration}`);
});

test('U606 source 2 — a present furniture piece still routes to physics (not declined)', () => {
  // A heavy present piece: physics answers "too heavy to carry", NOT the honest-floor decline.
  const { output } = playerMove(boot(), PACKS, 'I grab the basin');
  assert.doesNotMatch(output.mechanics, DECLINE_MECH, `present furniture must not be declined: ${output.mechanics} / ${output.narration}`);
  assert.match(output.mechanics, /\[physics:/, `present furniture routes to physics: ${output.mechanics}`);
  assert.equal(output.narration, "You try to take stone basin, but it's too heavy to carry.", `physics prose unchanged: ${output.narration}`);
});

test('U606 source 2b — a lighter present piece is not declined either', () => {
  const { output } = playerMove(boot(), PACKS, 'I take the chest');
  assert.doesNotMatch(output.mechanics, DECLINE_MECH, `present chest must not be declined: ${output.mechanics}`);
  assert.match(output.mechanics, /\[physics:/, `present chest routes to physics: ${output.mechanics}`);
});

test('U606 source 3 — an inventory item already carried is acknowledged, not declined', () => {
  const { output } = playerMove(boot(), PACKS, 'I take the mirror shard');
  assert.doesNotMatch(output.mechanics, DECLINE_MECH, `a carried item must not be declined: ${output.mechanics}`);
  assert.match(output.mechanics, /\[take:already-held/, `carried item acknowledged: ${output.mechanics}`);
  assert.match(output.narration, /already in your pack/i, `already-held prose unchanged: ${output.narration}`);
});

test('U606 source 4 — a collective loot grab is not declined by this gate (keeps its own handler)', () => {
  // "loot the bodies" has no single takeable noun; BULK_TAKE_RE yields so its handler answers.
  const { output } = playerMove(boot(), PACKS, 'I loot the bodies');
  assert.doesNotMatch(output.mechanics, DECLINE_MECH, `a collective grab must not hit the named-noun decline: ${output.mechanics} / ${output.narration}`);
});

test('U606 — "take everything" (collective) is not intercepted by the honest-floor gate', () => {
  const { output } = playerMove(boot(), PACKS, 'I take everything');
  assert.doesNotMatch(output.mechanics, DECLINE_MECH, `"everything" is collective, not a named noun: ${output.mechanics} / ${output.narration}`);
});
