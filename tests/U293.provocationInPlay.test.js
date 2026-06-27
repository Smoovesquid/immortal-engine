// U293 — social provocation, wired into play: insulting a present NPC enough makes
// them attack, and "enough" is the person's temperament. Integration over the real
// playloop (deterministic, LLM-off). The pure table is U292; this proves the wire.
//
// tallow / Wayfarers' Outpost has a stable roster incl. a volatile guard (Asha) and
// even-tempered townsfolk — the spread Tim asked for ("some are psychos, some suffer
// anything"). The combat handoff reuses the existing engageNpcCombat seam.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { npcTemperament } from '../engine/npc/provocation.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const town = () => playerMove(
  beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world,
  PACKS, 'step outside'
).world;
const presentNpcs = (w) => {
  const n = (w.map?.nodes || []).find(x => x && x.id === w.map.currentNodeId);
  return (n?.settlement?.npcs || []).filter(p => p && p.name && !p.hostile);
};
const mostVolatile = (w) => presentNpcs(w).slice().sort((a, b) => npcTemperament('tallow', a.id) - npcTemperament('tallow', b.id))[0];
const mostPatient = (w) => presentNpcs(w).slice().sort((a, b) => npcTemperament('tallow', b.id) - npcTemperament('tallow', a.id))[0];

test('U293: a VOLATILE NPC sucker-punches you within a slight or two', () => {
  let w = town();
  const v = mostVolatile(w);
  assert.ok(npcTemperament('tallow', v.id) < 30, `tallow should hold a hair-trigger (min present: ${v?.name})`);
  let began = -1;
  for (let i = 0; i < 3 && began < 0; i++) { w = playerMove(w, PACKS, `you spineless coward, ${v.name}`).world; if (w.combat?.active) began = i; }
  assert.ok(began >= 0 && began <= 1, `the volatile one should attack within 2 insults (began=${began})`);
});

test('U293: a single light jab never tips a patient NPC into violence', () => {
  let w = town();
  const p = mostPatient(w);
  w = playerMove(w, PACKS, `I mock ${p.name} a little`).world;
  assert.equal(Boolean(w.combat?.active), false, 'one mild jab is not a death-warrant for an even/stoic person');
});

test('U293: sustained grievous abuse breaks even the patient (offense accumulates)', () => {
  let w = town();
  const p = mostPatient(w);
  let began = -1;
  for (let i = 0; i < 8 && began < 0; i++) { w = playerMove(w, PACKS, `you worthless bastard, ${p.name}, your dead mother was a whore`).world; if (w.combat?.active) began = i; }
  assert.ok(began >= 0, 'enough grievous insults eventually start a fight even with the calmest');
  assert.ok(began >= 1, 'but never on the very first — patience means a ladder, not a hair-trigger');
});

test('U293: courtesy and questions never provoke (no false positives)', () => {
  let w = town();
  const v = mostVolatile(w);
  w = playerMove(w, PACKS, `good day to you, ${v.name}, how fares the watch?`).world;
  assert.equal(Boolean(w.combat?.active), false, 'a greeting must never start a fight, even with the volatile');
});

test('U293: provocation is deterministic — same insults, same combat timeline', () => {
  const run = () => {
    let w = town(); const t = presentNpcs(w)[0]; const out = [];
    for (let i = 0; i < 4; i++) { w = playerMove(w, PACKS, `you craven thief, ${t.name}`).world; out.push(Boolean(w.combat?.active)); }
    return out;
  };
  assert.deepEqual(run(), run(), 'identical insults → identical outcome (replay-safe)');
});

test('U293: a patient NPC visibly escalates (a warning) before any blow — read the room', () => {
  let w = town();
  const p = mostPatient(w);
  const lines = []; let began = -1;
  for (let i = 0; i < 8 && began < 0; i++) {
    const r = playerMove(w, PACKS, `you craven thief, ${p.name}`); w = r.world;
    lines.push(String(r.output.narration || ''));
    if (w.combat?.active) began = i;
  }
  assert.ok(began >= 1, `a patient NPC should not snap on the first insult (began=${began})`);
  const first = p.name.split(' ')[0];
  for (const ln of lines.slice(0, began)) {
    assert.match(ln, new RegExp(first, 'i'), `each pre-combat turn is a real reaction that names them: "${ln}"`);
    assert.doesNotMatch(ln, /it comes off cleanly|it lands, after a fashion|falls short|you manage it|doesn't give it to you/i,
      `a directed insult must read as a social reaction, not a generic die roll: "${ln}"`);
  }
});
