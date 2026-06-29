// U303 — Pre-rolled heroes: a ready-made roster you can one-click into the game.
//
// Each entry builds a REAL, deterministic, playable character through the genesis
// path (createCharacter), carries its themed stat spread, and can start the slice
// without crashing.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { PRE_ROLLED, buildPreRolledCharacter, preRolledById } from '../engine/chargen/preRolled.js';
import { STAT_KEYS } from '../engine/chargen/stats.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

test('U303: the roster is non-empty with unique ids', () => {
  assert.ok(PRE_ROLLED.length >= 3, 'a real choice of heroes');
  const ids = PRE_ROLLED.map(e => e.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
});

test('U303: each hero builds into a valid PC carrying its themed stats', () => {
  for (const e of PRE_ROLLED) {
    const pc = buildPreRolledCharacter(e);
    assert.ok(pc && pc.id, `${e.id}: has an id`);
    assert.equal(pc.name, e.name);
    assert.equal(pc.archetype, e.archetype);
    for (const k of STAT_KEYS) {
      assert.equal(pc.stats[k], e.stats[k], `${e.id}: ${k} matches the themed spread`);
      assert.equal(typeof pc.mods[k], 'number', `${e.id}: ${k} has a derived mod`);
    }
    assert.ok(pc.inventory, `${e.id}: has a loadout`);
  }
});

test('U303: building a hero is deterministic (same entry → identical PC)', () => {
  for (const e of PRE_ROLLED) {
    assert.equal(JSON.stringify(buildPreRolledCharacter(e)), JSON.stringify(buildPreRolledCharacter(e)), `${e.id} deterministic`);
  }
});

test('U303: preRolledById resolves a known hero and rejects an unknown one', () => {
  assert.ok(preRolledById(PRE_ROLLED[0].id));
  assert.equal(preRolledById('no-such-hero'), null);
});

test('U303: every hero can start the slice and take a turn without crashing', () => {
  for (const e of PRE_ROLLED) {
    const pc = buildPreRolledCharacter(e);
    const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: 'u303', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
    const { world } = beginAdventure(ensureWorld({ ...w0, party: [pc] }), PACKS);
    assert.equal(world.party[0].name, e.name, `${e.id}: is the party lead`);
    assert.ok(Number(world.meta.escapeMaxHp) > 0, `${e.id}: has escape HP`);
    const r = playerMove(world, PACKS, 'I step outside and look around');
    assert.ok(r.output, `${e.id}: a turn resolves`);
  }
});
