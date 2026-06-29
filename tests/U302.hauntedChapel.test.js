// U302 — SL-3: the haunted chapel dungeon.
//
// The Hollowed Chapel is a dungeon_entrance the engine already generates a real
// multi-level interior for (generateDungeon). SL-3 makes it HAUNTED: a 'haunted'
// node themes its encounters to 'undead' — the diegetic face of DEMO_REGION §3
// ("the recently dead don't always stay dead"), never explained (§0). Theming is a
// PREFERENCE in selectCreatures, so every unthemed spawn stays byte-identical.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, creatureThemeForNode } from '../engine/playloop.js';
import { selectCreatures } from '../engine/combat/encounterSpawn.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { generateDungeon } from '../engine/dungeon/generate.js';
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

test('U302: a haunted node themes to undead; an ordinary node has no theme', () => {
  assert.equal(creatureThemeForNode({ tags: ['haunted'] }), 'undead');
  assert.equal(creatureThemeForNode({ tags: ['village'] }), null);
  assert.equal(creatureThemeForNode({}), null);
});

test('U302: the slice chapel carries the haunted theme', () => {
  const w = bootSlice();
  assert.equal(creatureThemeForNode(node(w, 'The Hollowed Chapel')), 'undead');
  assert.equal(creatureThemeForNode(node(w, 'Aldermere')), null);
});

test('U302: the undead theme draws only undead creatures, across CR budgets', () => {
  for (const cr of [0.5, 1, 2, 3]) {
    const rng = makeRng(seedFromString(`u302|undead|${cr}`));
    const picked = selectCreatures(cr, 3, null, rng, 'forest', 0, 'undead');
    assert.ok(picked.length >= 1);
    for (const c of picked) {
      assert.ok(Array.isArray(c.tags) && c.tags.includes('undead'), `cr${cr}: ${c.name} is undead`);
      assert.ok(c.cr <= cr, `cr${cr}: ${c.name} within budget`);
    }
  }
});

test('U302: theme=null is byte-identical to the un-themed call (determinism)', () => {
  const a = selectCreatures(1, 2, null, makeRng(seedFromString('u302|reg')), 'forest', 0);
  const b = selectCreatures(1, 2, null, makeRng(seedFromString('u302|reg')), 'forest', 0, null);
  assert.deepEqual(a.map(c => c.ref || c.name), b.map(c => c.ref || c.name));
});

test('U302: the chapel generates a real, explorable multi-room dungeon', () => {
  const w = bootSlice();
  const chapel = node(w, 'The Hollowed Chapel');
  const d = generateDungeon(SLICE_SEED, chapel.id, { biome: 'forest', substrateEvents: [] });
  const levels = d.levels || [];
  assert.ok(levels.length >= 1, 'has at least one level');
  const encounterRooms = levels.flatMap(lv => Object.values(lv.rooms || {}))
    .filter(r => (r.contents || []).some(c => c.kind === 'encounter'));
  assert.ok(encounterRooms.length >= 1, 'the dungeon holds encounters to theme');
});

test('U302: the chapel dungeon is deterministic by seed', () => {
  const w = bootSlice();
  const chapel = node(w, 'The Hollowed Chapel');
  const a = generateDungeon(SLICE_SEED, chapel.id, { biome: 'forest', substrateEvents: [] });
  const b = generateDungeon(SLICE_SEED, chapel.id, { biome: 'forest', substrateEvents: [] });
  assert.equal(JSON.stringify(a.levels), JSON.stringify(b.levels));
});
