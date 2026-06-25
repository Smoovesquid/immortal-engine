// U283 — Conversation honesty: the DM tells you only what you can PERCEIVE or have
// EARNED. Three sibling fixes, all the same law of earned knowledge:
//   FIX 1 — "look around" inside a room REGISTERS a person standing there (named if
//           home/met, else by role); none present → no people line.
//   FIX 2 — "is anyone in the room with me?" answers FREE (no WITS roll) — a DM just
//           tells you who's visibly here.
//   FIX 3 — greeting an NPC gives the approach + observable manner, but NOT their
//           inner WANT/goal (unearned mind-reading); the want is still derivable.
// Hermetic: buildLocationSurvey / handleMetaQuestion / playerMove are deterministic
// (LLM-OFF). No network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ensureWorld, newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { buildLocationSurvey, handleMetaQuestion, isMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// A two-node world; you stand INSIDE a private interior at 'town'. homeNodeId picks
// whether 'town' is home (you know neighbors by name) or foreign (you read roles).
function interiorWorld({ home = 'town', npcs = [], furniture = null } = {}) {
  return ensureWorld({
    meta: { version: 21, seed: 'u282', fate: 0.2, homeNodeId: home },
    party: [{ id: 'p', name: 'Sera', level: 1, wounds: 0, stress: 0,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      position: { ux: 50, uy: 50, elevation: 0, nodeId: 'town' } }],
    map: { currentNodeId: 'town', nodes: [
      { id: 'town', name: 'Buttnoid Village', nodeType: 'settlement', x: 5, y: 5,
        settlement: { npcs },
        furniture: furniture ?? [{ name: 'wooden table' }, { name: 'oil lantern' }, { name: 'wooden chair' }] },
      { id: 'farhome', name: 'Faraway', nodeType: 'settlement', x: 9, y: 9, settlement: { npcs: [] } }
    ], edges: [] },
    timeline: [],
    scene: { location: 'Buttnoid Village', interior: { structureKey: 'inn:r3', roomId: 'r3', visited: ['r3'] } }
  });
}

const miriel = () => ({ id: 'miriel', name: 'Miriel Ashborn', role: 'caravanner' });
const gus = () => ({ id: 'gus', name: 'Gus', role: 'smith' });
const lurker = () => ({ id: 'brokefang', name: 'Brokefang', role: 'bandit', hostile: true });

// ── FIX 1 ────────────────────────────────────────────────────────────────────
test('U283-1a: look-around inside registers a present person — named at HOME', () => {
  const survey = buildLocationSurvey(interiorWorld({ home: 'town', npcs: [miriel()] }));
  assert.match(survey, /Miriel Ashborn/, survey);
  assert.match(survey, /\bis here\b/, survey);
  // Furniture still listed.
  assert.match(survey, /wooden table/, survey);
});

test('U283-1b: look-around inside reads an UNMET person by ROLE away from home', () => {
  const survey = buildLocationSurvey(interiorWorld({ home: 'farhome', npcs: [miriel()] }));
  assert.doesNotMatch(survey, /Miriel|Ashborn/, survey);   // unearned name redacted
  assert.match(survey, /a caravanner is here/i, survey);
});

test('U283-1c: none present → no people line, but the room is still described', () => {
  const survey = buildLocationSurvey(interiorWorld({ home: 'town', npcs: [] }));
  assert.doesNotMatch(survey, /\bis here\b|\bare here\b/, survey);
  assert.match(survey, /wooden table/, survey);
});

test('U283-1d: a hostile lurker reads as a wary stranger, never a named neighbor', () => {
  const survey = buildLocationSurvey(interiorWorld({ home: 'town', npcs: [miriel(), lurker()] }));
  assert.match(survey, /Miriel Ashborn the caravanner is here/, survey);
  assert.doesNotMatch(survey, /Brokefang/, survey);
  assert.match(survey, /keeping to the edges, watching/, survey);
});

// ── FIX 2 ────────────────────────────────────────────────────────────────────
const ROLL_RE = /\[roll:/i;

test('U283-2a: "Is anyone in the room with me?" is a meta-question (no roll path)', () => {
  assert.equal(isMetaQuestion('Is anyone in the room with me?'), true);
  assert.equal(isMetaQuestion("who's in the room with me?"), true);
  assert.equal(isMetaQuestion('is anybody nearby?'), true);
  assert.equal(isMetaQuestion('is someone else here?'), true);
});

test('U283-2b: presence question answers FREE, listing present people, no [roll:]', () => {
  const w = interiorWorld({ home: 'town', npcs: [miriel(), gus()] });
  const ans = handleMetaQuestion('Is anyone in the room with me?', w);
  assert.ok(ans, 'a presence question is answered, not bounced');
  assert.doesNotMatch(ans, ROLL_RE, ans);
  assert.match(ans, /Miriel Ashborn/, ans);
  assert.match(ans, /Gus/, ans);
});

test('U283-2c: presence question with no one present gives an honest "alone"', () => {
  const ans = handleMetaQuestion('is anyone here?', interiorWorld({ home: 'town', npcs: [] }));
  assert.doesNotMatch(ans, ROLL_RE, ans);
  assert.match(ans, /alone|no one/i, ans);
});

test('U283-2d: end-to-end — the presence question never rolls a WITS check', () => {
  // Drive the real grace layer the way playloop does: a meta-question short-circuits
  // before intent extraction, so no perception roll is ever generated.
  const w = interiorWorld({ home: 'farhome', npcs: [miriel()] });
  const ans = handleMetaQuestion('who is in the room?', w);
  assert.doesNotMatch(ans, ROLL_RE, ans);
  assert.doesNotMatch(ans, /WITS/i, ans);
  assert.match(ans, /a caravanner/i, ans);   // unmet, away → role
});

// ── FIX 3 ────────────────────────────────────────────────────────────────────
function bootWorld(seed = 'ashfen-reach') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U283-3a: greeting an NPC gives approach + observable manner, NOT their inner want', () => {
  const { w, byId } = bootWorld();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const target = (node.settlement?.npcs || []).find(n => n && !n.hostile);
  assert.ok(target, 'precondition: a non-hostile NPC is present');
  const r = playerMove(w, byId, `talk to ${target.name}`);
  const narr = String(r.output?.narration || '');
  // The approach lands and reads observable body language...
  assert.match(narr, /You approach/i, narr);
  // ...but never hands you their inner WANT/goal on hello (unearned mind-reading).
  assert.doesNotMatch(narr, /want in them/i, narr);
  assert.doesNotMatch(narr, /There's a want/i, narr);
});
