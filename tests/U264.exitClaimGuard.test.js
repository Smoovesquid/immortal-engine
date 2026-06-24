// U264 — the narration validator rejects an EXIT canon didn't commit (J-Q1).
//
// The journey playtest surfaced a live state-desync: on an info-ask INSIDE a building
// ("ask the shopkeeper which way out"), the DM polish narrated "you leave the building"
// while the engine kept the player indoors (scene.interior still set). The RESPECT-AGENCY
// prompt rule already forbids this, but the LLM ignored it — so validateNarrationCandidate
// now REJECTS such polish (→ falls back to the always-grounded base narration), the live
// analog of the harness's `said-outside-still-inside` oracle.
//
// Fires ONLY while the player is still inside (a real exit clears scene.interior first),
// and is scoped to "player exits a BUILDING" so idioms ("step out of the way/line") and
// mere mentions of the outdoors survive. Hermetic: the validator is pure. No network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { validateNarrationCandidate } from '../engine/llmAdapter.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Candidates must reference the place name (the validator's location-lock) so we isolate
// the exit-claim rule; append it like the live prompt requires.
const accepts = (world, sentence) => {
  const ctx = buildNarratorContext(world, {});
  const cand = `${sentence} here at ${ctx.placeName}.`;
  return validateNarrationCandidate(world, cand, { baseNarration: 'You do so.', ctx }) !== false;
};

test('U264: precondition — tallow wakes INSIDE; stepping out clears scene.interior', () => {
  assert.equal(Boolean(boot().scene?.interior), true, 'inside at boot');
  assert.equal(Boolean(playerMove(boot(), PACKS, 'I step outside.').world.scene?.interior), false, 'outside after exit');
});

test('U264: INSIDE — polish that claims the player exited is REJECTED', () => {
  const w = boot();
  for (const s of [
    'You leave the building without the answer you sought',
    'You step outside and scan the road',
    'You step out into the open air',
    'You head outside as the wind picks up',
    'You emerge onto the road and look around',
    'You step out of the inn',
  ]) {
    assert.equal(accepts(w, s), false, `must reject (canon says still inside): "${s}"`);
  }
});

test('U264: INSIDE — non-exit polish is NOT rejected by this rule (idioms / mentions / NPCs)', () => {
  const w = boot();
  for (const s of [
    'You glance out the window at the street',          // mere mention of outside
    'You step out of the way of the falling shelf',     // idiom, not a building exit
    'You step out of line and she frowns',              // idiom
    'Dalla shrugs and turns back to her work',          // NPC narration
    'You take stock of the warm common room',           // staying put
  ]) {
    assert.equal(accepts(w, s), true, `must NOT reject (no building exit claimed): "${s}"`);
  }
});

test('U264: OUTSIDE — a real exit narration is accepted (scene.interior already cleared)', () => {
  const out = playerMove(boot(), PACKS, 'I step outside.').world;
  for (const s of [
    'You step back outside into the cold air',
    'You emerge onto the open road',
  ]) {
    assert.equal(accepts(out, s), true, `a real exit must be allowed once outside: "${s}"`);
  }
});
