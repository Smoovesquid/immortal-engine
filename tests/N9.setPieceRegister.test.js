// N9 — the set-piece register. At a threshold beat (arrival | combat-start | death)
// the DM rises from one terse line to a short, vivid paragraph: the system prompt
// drops the one-sentence cap, adds the beat's craft, and the validator accepts a
// short paragraph (≤6 terminals). With NO beat the prompt and validator are the
// unchanged one-sentence path. Hermetic — buildSystemPrompt + validateNarrationCandidate
// + buildNarratorContext are pure. No network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildSystemPrompt, validateNarrationCandidate } from '../engine/llmAdapter.js';
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
const ctxFor = (beat) => buildNarratorContext(boot(), beat ? { beat } : {});

test('N9: default (no beat) keeps the one-sentence prompt unchanged', () => {
  const p = buildSystemPrompt(ctxFor(''));
  assert.match(p, /in ONE sentence/);
  assert.match(p, /Write exactly ONE sentence\./);
  assert.doesNotMatch(p, /SET-PIECE/);
});

test('N9: a set-piece beat lifts the one-sentence cap into a short paragraph', () => {
  for (const beat of ['arrival', 'combat-start', 'death']) {
    const p = buildSystemPrompt(ctxFor(beat));
    assert.match(p, /SET-PIECE MOMENT/, `${beat}: opener`);
    assert.match(p, /2 to 4 sentences/, `${beat}: length rule`);
    assert.doesNotMatch(p, /Write exactly ONE sentence\./, `${beat}: one-sentence cap removed`);
  }
});

test('N9: each beat injects its own craft line', () => {
  assert.match(buildSystemPrompt(ctxFor('arrival')), /ARRIVAL \(the establishing shot\)/);
  assert.match(buildSystemPrompt(ctxFor('combat-start')), /THE FIGHT IGNITES/);
  assert.match(buildSystemPrompt(ctxFor('death')), /SET-PIECE — DEATH/);
});

test('N9: every guardrail still holds in set-piece mode', () => {
  const p = buildSystemPrompt(ctxFor('arrival'));
  assert.match(p, /HIDE THE MATH/);
  assert.match(p, /RESPECT AGENCY/);
  assert.match(p, /Do NOT invent topology/);
  assert.match(p, /Reference the location name/);
});

test('N9: buildNarratorContext carries a valid beat to ctx.beat and drops junk', () => {
  const w = boot();
  assert.equal(buildNarratorContext(w, { beat: 'death' }).beat, 'death');
  assert.equal(buildNarratorContext(w, { beat: 'nope' }).beat, '');
  assert.equal(buildNarratorContext(w, {}).beat, '');
});

test('N9: validator accepts a short paragraph AT a beat, rejects it without one', () => {
  const w = boot();
  const ctxArrival = buildNarratorContext(w, { beat: 'arrival' });
  const place = ctxArrival.placeName;
  // Three sentences, grounded (names the place), no brackets, no forbidden tokens.
  const para = `The way into ${place} opens before you. Woodsmoke hangs low over the ground. Somewhere unseen, a dog will not stop its barking.`;
  assert.equal(validateNarrationCandidate(w, para, { ctx: ctxArrival }) !== false, true, 'set-piece: 3 sentences accepted');
  const ctxPlain = buildNarratorContext(w, {});
  assert.equal(validateNarrationCandidate(w, para, { ctx: ctxPlain }), false, 'default: >1 terminal rejected');
});
