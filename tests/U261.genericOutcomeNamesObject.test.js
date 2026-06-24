// U261 — a generic resolved outcome NAMES the object it acted on (IT-5).
//
// The fallback prose for an action that matched no specific verb-branch blamed the
// PLACE on a failure ("Whatever you meant to do, the outpost doesn't give it to you").
// The table-test judge flags that as not resolving the intent and not specific. When
// the action named a concrete object, the outcome now names THAT ("you can't make the
// floorboards give") — grounded, no place-blame, no 'filtering' distance, and number-
// agnostic (object-as-direct-object, so "the floorboards" never disagrees with a verb).
//
// Pure over genericGroundedOutcome (exported). No LLM, no network — the base narration
// the live DM polishes; the base must already be specific so it passes API-off.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, genericGroundedOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const W = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

const PLACE_BLAME = /doesn'?t give it to you|falls short here in|slips past you in/i;
const FILTERING = /\byou (?:see|notice|feel|sense|realize|perceive) that\b/i;

test('U261: a generic FAILURE names the object, not the place', () => {
  for (const [text, obj] of [
    ['I pry the floorboards up with my dagger', 'floorboards'],
    ['I force the rusty lock', 'rusty lock'],
    ['I shove the heavy crate aside', 'heavy crate'],
    ['I bend the iron bars apart', 'iron bars'],
  ]) {
    const out = genericGroundedOutcome(W, text, 'failure');
    assert.match(out, new RegExp(obj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), `[${text}] names "${obj}": ${out}`);
    assert.doesNotMatch(out, PLACE_BLAME, `[${text}] no place-blame: ${out}`);
    assert.doesNotMatch(out, FILTERING, `[${text}] no filtering distance: ${out}`);
  }
});

test('U261: mixed + success also name the object', () => {
  assert.match(genericGroundedOutcome(W, 'I force the rusty lock', 'mixed'), /rusty lock/i);
  assert.match(genericGroundedOutcome(W, 'I force the rusty lock', 'success'), /rusty lock/i);
});

test('U261: an action with NO concrete object falls back to the place-generic (unchanged)', () => {
  // Abstract / object-less actions keep the old behavior — don't invent an object.
  for (const text of ['I concentrate hard', 'I take a moment to think', 'I look around']) {
    const out = genericGroundedOutcome(W, text, 'failure');
    // It is allowed to be the place-generic here (no concrete object to name).
    assert.equal(typeof out, 'string');
    assert.ok(out.length > 0);
  }
  // The classic place-generic is still reachable (e.g. "concentrate" — no object).
  assert.match(genericGroundedOutcome(W, 'I concentrate hard', 'failure'), /Wizard:/);
});

test('U261: number-agnostic — a plural object never disagrees with the verb', () => {
  // "the floorboards" must not produce "the floorboards doesn't…". The phrasings are
  // object-as-direct-object ("make the floorboards give"), so no subject-verb clash.
  const out = genericGroundedOutcome(W, 'I pry the floorboards up', 'failure');
  assert.doesNotMatch(out, /floorboards\s+(?:doesn'?t|holds\b(?!\s+against)|gives\b|resists\b)/i, `no singular verb on a plural: ${out}`);
});

test('U261: deterministic — same (world, text, outcome) yields the same prose', () => {
  const a = genericGroundedOutcome(W, 'I force the rusty lock', 'failure');
  const b = genericGroundedOutcome(W, 'I force the rusty lock', 'failure');
  assert.equal(a, b);
});
