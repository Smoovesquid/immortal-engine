// U702 — DENIED-list laws 23–27 (docs/IMMORTAL_INVARIANTS.md) reach the DM's mouth.
//
// The player never sees a law — they see a ruling. buildDMSystemPrompt must carry the
// HARD LIMITS block so the live DM declines denied intents IN FICTION (a world reason,
// never "the game forbids it"): no spreading fire/flood, no invented mechanics, one
// body, no flight, time compresses. Same pattern as N7's INTERIOR GEOMETRY pin: if a
// future prompt edit drops the block, this fails before a playtest has to find it.
//
// Hermetic: buildDMSystemPrompt is pure given its context. No network, no key, no cost.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildDMContext } from '../engine/ai/narratorContext.js';
import { buildDMSystemPrompt } from '../engine/llmAdapter.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U702: the DM prompt carries the HARD LIMITS denial rulings', () => {
  const dm = buildDMSystemPrompt(buildDMContext(boot(), {}, {}));
  assert.match(dm, /HARD LIMITS/, 'the block exists');
  assert.match(dm, /deny IN FICTION/i, 'denials are rulings, not rules messages');
  assert.match(dm, /NOTHING SPREADS/, 'law 23: no propagation');
  assert.match(dm, /NO NEW MECHANICS/, 'law 22/24: no invented devices or effects');
  assert.match(dm, /ONE BODY/, 'law 26: one character');
  assert.match(dm, /FEET ON THE GROUND/, 'law 27: no flight/burrowing');
  assert.match(dm, /TIME COMPRESSES/, 'law 25: no minute-by-minute vigil');
});

test('U702: the limits speak in the fiction, never in game-rule voice', () => {
  const dm = buildDMSystemPrompt(buildDMContext(boot(), {}, {}));
  assert.match(dm, /never say the game forbids it/i, 'the DM is told to keep the mask on');
});
