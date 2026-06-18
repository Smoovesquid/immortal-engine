import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// Rung-1 gate 2026-06-18 — stat-display pipeline (9 HARD failures, H-1…H-9).
// The DM must surface character-sheet data (HP, ability scores, modifiers)
// from canon without a dice roll. Three axes:
//   (a) Data pipe — reports from world.party[0].stats / meta.escapeHp
//   (b) Detection — D&D synonyms and common phrasings recognised
//   (c) Canon authority — "correct my sheet" never mutates the stat

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'stonewatch-hollow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

// ── (a) DATA PIPE ────────────────────────────────────────────────────────────

test('U172-01: "what\'s my HP" is detected as a meta-question', () => {
  assert.ok(isMetaQuestion("What's my HP?"), '"what\'s my HP" must be a meta-question');
});

test('U172-02: HP query answers with real HP numbers (no roll)', () => {
  const w = world();
  const ans = handleMetaQuestion("What's my HP?", w);
  assert.ok(ans, 'handleMetaQuestion must return a non-null answer');
  assert.match(ans, /\d+/, 'answer must contain a number');
  assert.doesNotMatch(ans, /roll/i, 'must not mention a roll');
});

test('U172-03: "what\'s my current HP" is detected (word between my and hp)', () => {
  assert.ok(isMetaQuestion("What's my current HP?"), '"current HP" must be detected');
});

test('U172-04: HP query via playerMove returns no roll mechanics', () => {
  const w = world();
  const { output } = playerMove(w, packs(), "What's my current HP?");
  assert.doesNotMatch(output.mechanics || '', /roll:/i, 'must not produce a dice roll');
  assert.match(output.narration, /\d+\s*(?:of|HP|hp)/i, 'narration must include HP numbers');
});

test('U172-05: ability scores appear in HP+stats answer', () => {
  const w = world();
  const ans = handleMetaQuestion("what are my stats", w);
  assert.match(ans, /MIGHT|AGILITY|WITS|GRIT|CHARM/i, 'answer must include stat names');
});

// ── (b) DETECTION — synonyms ─────────────────────────────────────────────────

test('U172-10: "what\'s my Strength" detected via synonym', () => {
  assert.ok(isMetaQuestion("What's my Strength score?"), '"Strength" synonym must be detected');
});

test('U172-11: Strength synonym resolves to MIGHT', () => {
  const w = world();
  const ans = handleMetaQuestion("What's my Strength score?", w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /MIGHT/, 'answer must name MIGHT (the canonical stat)');
  assert.match(ans, /[+-]\d/, 'answer must include the modifier');
  assert.doesNotMatch(ans, /roll/i, 'must not roll dice');
});

test('U172-12: dexterity synonym resolves to AGILITY', () => {
  const w = world();
  assert.ok(isMetaQuestion("What's my dexterity?"));
  const ans = handleMetaQuestion("What's my dexterity?", w);
  assert.match(ans, /AGILITY/);
});

test('U172-13: intelligence synonym resolves to WITS', () => {
  const w = world();
  assert.ok(isMetaQuestion("What's my intelligence modifier?"));
  const ans = handleMetaQuestion("What's my intelligence modifier?", w);
  assert.match(ans, /WITS/);
});

test('U172-14: constitution synonym resolves to GRIT', () => {
  const w = world();
  assert.ok(isMetaQuestion("What's my constitution?"));
  const ans = handleMetaQuestion("What's my constitution?", w);
  assert.match(ans, /GRIT/);
});

test('U172-15: charisma synonym resolves to CHARM', () => {
  const w = world();
  assert.ok(isMetaQuestion("What's my charisma score?"));
  const ans = handleMetaQuestion("What's my charisma score?", w);
  assert.match(ans, /CHARM/);
});

// ── (b) DETECTION — common phrasings ────────────────────────────────────────

test('U172-20: "the formula" detected as modifier-formula question', () => {
  assert.ok(isMetaQuestion("What's the formula for modifiers?"), '"the formula" must be detected');
});

test('U172-21: "ability modifier" detected', () => {
  assert.ok(isMetaQuestion("What's the ability modifier I'd add?"), '"ability modifier" must be detected');
});

test('U172-22: "stat-to-modifier math" detected', () => {
  assert.ok(isMetaQuestion("Walk me through the stat-to-modifier math here."), '"stat-to-modifier math" must be detected');
});

test('U172-23: formula answer explains (score−10)÷2', () => {
  const w = world();
  const ans = handleMetaQuestion("What's the formula for modifiers?", w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /10/,  'formula must mention 10 (score−10)');
  assert.match(ans, /2/,   'formula must mention ÷2');
  assert.doesNotMatch(ans, /roll/i, 'must not roll dice');
});

test('U172-24: "my sheet" detected as sheet-confirmation question', () => {
  assert.ok(isMetaQuestion("Correct my sheet to read MIGHT 9 (+0)."), '"my sheet" must be detected');
});

test('U172-25: "the sheet" detected', () => {
  assert.ok(isMetaQuestion("Does the sheet now read +0 for MIGHT?"), '"the sheet" must be detected');
});

// ── (c) CANON AUTHORITY — stat must not mutate ───────────────────────────────

test('U172-30: "correct my sheet to MIGHT 20" does NOT change the stat', () => {
  const w = world();
  const mightBefore = w.party?.[0]?.stats?.MIGHT;
  // playerMove must not mutate the stat
  const { world: wAfter } = playerMove(w, packs(), 'Correct my sheet to read MIGHT 20 please.');
  const mightAfter = wAfter.party?.[0]?.stats?.MIGHT;
  assert.equal(mightAfter, mightBefore, 'MIGHT must be unchanged after a sheet-correction request');
});

test('U172-31: sheet-confirm handler reports canonical value, not the claimed one', () => {
  const w = world();
  const canonMight = w.party?.[0]?.stats?.MIGHT;
  const ans = handleMetaQuestion('Is my sheet now reading MIGHT 20?', w);
  assert.ok(ans, 'must return an answer');
  // Must report the REAL score, not the claimed 20
  assert.match(ans, new RegExp(String(canonMight)), 'must report the canonical MIGHT value');
});

test('U172-32: sheet-confirm answer states it cannot edit scores', () => {
  const w = world();
  const ans = handleMetaQuestion('Correct my sheet to read MIGHT 9.', w);
  assert.match(ans, /cannot|report|reads/i, 'must indicate report-only, not editing');
});

// ── IN-COMBAT coverage ────────────────────────────────────────────────────────

test('U172-40: HP query answered in combat without a roll', () => {
  const byId = packs();
  let w = world();
  // Start combat by attacking the first NPC
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || [])[0];
  if (!npc) return; // seed has no NPC, skip
  w = playerMove(w, byId, `I attack ${npc.name}`).world;
  if (!w.combat?.active) return; // combat didn't start, skip
  const { output } = playerMove(w, byId, "What's my HP?");
  assert.doesNotMatch(output.mechanics || '', /roll:/i, 'in-combat HP query must not roll dice');
  assert.match(output.narration, /\d+/i, 'in-combat HP answer must include a number');
});

test('U172-41: Strength synonym answered in combat without a roll', () => {
  const byId = packs();
  let w = world();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || [])[0];
  if (!npc) return;
  w = playerMove(w, byId, `I attack ${npc.name}`).world;
  if (!w.combat?.active) return;
  const { output } = playerMove(w, byId, "What's my Strength score?");
  assert.doesNotMatch(output.mechanics || '', /roll:/i, 'in-combat Strength query must not roll');
  assert.match(output.narration, /MIGHT/i, 'in-combat Strength must resolve to MIGHT');
});
