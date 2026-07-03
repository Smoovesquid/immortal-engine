// U374 — the look-around materialization leak (presence survey · stopword name match).
//
// Surfaced by playing the live v0.26.0 build (seed aldermere, ready-made hero): a bare
// "look carefully around the room — who is in here with me?" in the EMPTY wake room
// answered "You're not alone — Senna the Fox, Galen, Brogan, and the Lingerer are here
// with you" — the whole settlement roster narrated as physically present in an empty room.
//
// Root: buildLocationSurvey's `namedInQuery` took each NPC's FIRST name token, and for
// "the Lingerer" that token is "the" (length 3, passed the >=3 guard). "the" appears in
// almost every query ("look around THE room"), so it falsely marked the Lingerer as the
// person asked-for, flipping the survey to the whole-roster branch. Fix: name an NPC by a
// MEANINGFUL token, never a leading article. A bare presence ask stays line-of-sight
// (room occupancy); a real directed locate ("where is Senna?") still reaches the roster.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { occupantsOfRoom } from '../engine/structures/roomOccupancy.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// Mirrors public/v1.js beginFromPreRolled — the ready-made hero boots the slice seed in
// escape mode with a party already injected (so beginAdventure skips character creation).
function bootHero() {
  const w0 = newWorld({ seed: 'aldermere', fate: 0.2, campaignId: 'campaign-aldermere', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [{ id: 'pc', name: 'Bryn Holt', stats: { MIGHT: 14, AGILITY: 11, WITS: 8, GRIT: 13, CHARM: 9 } }] });
  return beginAdventure(w1, PACKS).world;
}
const roomOccupants = (w) => {
  const i = w.scene?.interior;
  return i ? occupantsOfRoom(w, String(i.structureKey || ''), String(i.roomId || '')).map(n => String(n.name)) : [];
};

test('U374-A: a bare look-around in an empty room never narrates off-room roster NPCs as present', () => {
  const w = bootHero();
  assert.ok(w.scene?.interior, 'hero starts inside the wake room');
  const inRoom = roomOccupants(w);
  assert.equal(inRoom.length, 0, 'precondition: the wake room is empty (occupancy knows it)');

  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const roster = (node?.settlement?.npcs || []).map(n => String(n.name));
  assert.ok(roster.some(nm => /^(the|a|an)\s/i.test(nm)), 'precondition: roster has a leading-article name (e.g. "the Lingerer") — the trigger');

  // The exact live-build query. Contains the stopword "the" ("around the room").
  const { output } = playerMove(w, PACKS, 'I look carefully around the room. Who is in here with me?');
  const narr = String(output?.narration || '');

  assert.doesNotMatch(narr, /here with you/i, `an empty room must not claim anyone is "here with you": ${narr}`);
  for (const nm of roster) {
    assert.ok(!narr.includes(nm), `off-room NPC "${nm}" must not be narrated as present in the empty room: ${narr}`);
  }
});

test('U374-B: a real directed locate still reaches the named person (the fix does not over-tighten)', () => {
  const w = bootHero();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  // Pick a roster NPC whose meaningful token is NOT an article, and name them directly.
  const target = (node?.settlement?.npcs || []).map(n => String(n.name)).find(nm => !/^(the|a|an)\s/i.test(nm));
  assert.ok(target, 'roster has a plainly-named NPC to locate');
  const firstTok = target.split(/\s+/)[0];

  const { output } = playerMove(w, PACKS, `Where is ${firstTok}?`);
  const narr = String(output?.narration || '');
  assert.ok(narr.includes(firstTok), `a directed "where is ${firstTok}?" must still resolve that named person: ${narr}`);
});
