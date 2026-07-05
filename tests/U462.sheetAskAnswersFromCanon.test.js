// U462 — ANS-2 (case 3, META-SHEET): a character-STATE ask (HP / gear / class /
// stats) answers from canon via the meta floor — even when a look-around opener
// ("I sit up and look around — what gear do I have, and my HP and class?") would
// otherwise let META_LOCATION shadow the whole compound with a room survey. A
// direct "what's my HP?" states HP plainly (THE LAW hides the DM's dice, not the
// player's own sheet). RL-1's "confirm the shape, never the table" is preserved.
//
// Opus gate 2026-07-04-3, Rules-Lawyer: "I sit up and look around the cottage —
// what gear do I have on me, and what does my character sheet say for HP and
// class?" → answered with room décor only (HP 13/13, class, gear all dropped).
//
// Fix: handleMetaQuestion folds the sheet answer into the look-around branch when
// a real sheet field is named; the playloop meta-intercept lifts its bare-look-
// around exclusion for the sheet-compound case (isSheetStateAsk).
//
// Deterministic, LLM-off: ×2 identical boots resolve identically.

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
const run = (text) => playerMove(boot(), PACKS, text).output;

test('U462: precondition — Sera the Gravedigger, HP 13/13, carries a Worn Blade + Wooden staff', () => {
  const w = boot();
  assert.equal(String(w.party?.[0]?.archetype || '').toLowerCase(), 'gravedigger');
  assert.equal(Number(w.meta?.escapeHp), 13);
  assert.equal(Number(w.meta?.escapeMaxHp), 13);
  const weapons = (w.party?.[0]?.inventory?.weapons || []).map(x => String(x?.name || x).toLowerCase());
  assert.ok(weapons.some(n => n.includes('worn blade')), 'carries a Worn Blade');
});

test('U462-01: the gate compound (look-around + gear + HP + class) answers the SHEET, not room décor only', () => {
  const out = run('I sit up and look around the cottage — what gear do I have on me, and what does my character sheet say for HP and class?');
  const narr = String(out.narration);
  assert.match(narr, /13 of 13|13\/13/i, 'reports HP 13/13 from canon');
  assert.match(narr, /gravedigger/i, 'reports the class/archetype from canon');
  assert.match(narr, /worn blade/i, 'names the gear from canon');
});

test('U462-02: a direct "what\'s my HP?" states HP plainly (the player\'s own sheet — not hidden)', () => {
  const out = run("what's my HP?");
  assert.match(String(out.narration), /13 of 13|13\/13/i, 'HP stated plainly');
});

test('U462-03: a plain sheet ask (no look-around) still answers HP + class', () => {
  const out = run('what does my character sheet say for HP and class?');
  const narr = String(out.narration);
  assert.match(narr, /13 of 13|13\/13/i, 'HP');
  assert.match(narr, /gravedigger/i, 'class');
});

test('U462-04: a BARE "look around" (no sheet field) still SURVEYS — the sheet fold does not over-trigger', () => {
  const out = run('I look around the cottage.');
  const narr = String(out.narration).toLowerCase();
  // A survey names the room/exits, NOT the HP/class/stat block.
  assert.doesNotMatch(narr, /13 of 13|13\/13|gravedigger/i, 'a bare look-around never dumps the sheet');
  assert.match(String(out.mechanics), /observe only|no roll/i, 'resolves as an observe/survey');
});

test('U462-05: RL-1 preserved — "confirm the shape, never the table"; a sheet ask never recites the breakpoint table', () => {
  const out = run('what gear do I have on me, and what does my character sheet say for HP and class?');
  assert.doesNotMatch(String(out.narration), /breakpoint/i, 'no raw breakpoint table recited');
});

test('U462-06: deterministic ×2 — the sheet compound answer is byte-identical on repeat boots (LLM-off)', () => {
  const line = 'I sit up and look around the cottage — what gear do I have on me, and what does my character sheet say for HP and class?';
  const a = run(line);
  const b = run(line);
  assert.equal(String(a.narration), String(b.narration), 'identical narration on replay');
});
