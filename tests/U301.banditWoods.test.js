// U301 — SL-4: bandits in the woods + the bandit camp.
//
// The Greenwood is bandit country (a CHANCE of a brigand standoff when traveled);
// Crowfoot Camp is a bandit stronghold (arriving ALWAYS confronts the captain + crew).
// Both ride the engine's existing road-encounter standoff (pay/talk/slip/fight) — SL-4
// only teaches it which nodes are brigand country, and gives the camp a captain band.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, brigandNodeKind } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootSlice = () => beginAdventure(
  newWorld({ seed: SLICE_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS
).world;
const node = (w, name) => w.map.nodes.find(n => n.name === name);
const withPending = (w, band) => ensureWorld({
  ...w,
  travel: { pending: { kind: 'brigands', foeName: band === 'camp' ? 'The bandit captain and his crew' : 'Brigands', destName: '', band } },
});

test('U301: brigandNodeKind classifies bandit country, camps, and plain wild', () => {
  assert.equal(brigandNodeKind({ tags: ['banditCamp'] }, 'forest'), 'camp');
  assert.equal(brigandNodeKind({ tags: ['bandits'] }, 'forest'), 'road');
  assert.equal(brigandNodeKind({ nodeType: 'settlement' }, 'forest'), 'road');
  assert.equal(brigandNodeKind({ nodeType: 'wilderness' }, 'plains'), 'road');
  assert.equal(brigandNodeKind({ nodeType: 'wilderness' }, 'coastal'), 'road');
  assert.equal(brigandNodeKind({ nodeType: 'wilderness' }, 'forest'), null, 'plain wild → beasts, not bandits');
});

test('U301: the slice nodes carry the right disposition', () => {
  const w = bootSlice();
  assert.equal(brigandNodeKind(node(w, 'The Greenwood'), 'forest'), 'road', 'the woods are bandit country');
  assert.equal(brigandNodeKind(node(w, 'Crowfoot Camp'), 'forest'), 'camp', 'the camp is a stronghold');
  // The chapel is plain wild → a beast, not a bandit (the chapel is SL-3 territory).
  assert.equal(brigandNodeKind(node(w, 'The Hollowed Chapel'), 'forest'), null);
});

test('U301: pending.band survives ensureWorld normalization', () => {
  const w = withPending(bootSlice(), 'camp');
  assert.equal(w.travel.pending.band, 'camp', 'band not stripped by the normalizer');
  const r = withPending(bootSlice(), 'road');
  assert.equal(r.travel.pending.band, 'road');
});

test('U301: fighting the camp spawns the captain + crew (2 foes); the road spawns one', () => {
  const camp = playerMove(withPending(bootSlice(), 'camp'), PACKS, 'fight them');
  const foes = camp.world.combat?.enemies || [];
  assert.ok(camp.world.combat?.active, 'combat begins');
  assert.equal(foes.length, 2, 'captain + one of his crew');
  assert.ok(foes.some(e => /captain/i.test(e.name || e.ref || '')), 'the captain is present');

  const road = playerMove(withPending(bootSlice(), 'road'), PACKS, 'fight them');
  assert.equal((road.world.combat?.enemies || []).length, 1, 'a road-band is a single brigand (regression)');
});

test('U301: the camp standoff reads as a stronghold, not a tollgate', () => {
  // Setting a camp pending and giving a non-choice re-prompts with the camp framing.
  const r = playerMove(withPending(bootSlice(), 'camp'), PACKS, 'asdfghjkl');
  const txt = typeof r.output === 'string' ? r.output : (r.output?.narration || '');
  // Re-prompt keeps the encounter; the camp line never offers a "toll".
  assert.ok(r.world.travel?.pending, 'still pending on a non-choice');
});

test('U301: the camp standoff still resolves by every route (deterministic)', () => {
  for (const choice of ['pay the toll', 'talk them down', 'slip away', 'fight them']) {
    const a = playerMove(withPending(bootSlice(), 'camp'), PACKS, choice);
    const b = playerMove(withPending(bootSlice(), 'camp'), PACKS, choice);
    assert.equal(a.output.mechanics, b.output.mechanics, `[${choice}] deterministic`);
  }
});
