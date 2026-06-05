import test from 'node:test';
import assert from 'node:assert/strict';
import { dressStructure } from '../engine/tactical/dresser.js';
import { getPlan } from '../public/map/plans/index.js';
import { getLair } from '../public/map/plans/lairs.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const REFS = new Set([...trivial, ...minor, ...standard, ...elite].map(c => c.ref));

test('TAC10: tier scales spawns, loot, and secrets', () => {
  const plan = getPlan('keep');
  const t1 = dressStructure({ seed: 's', plan, tier: 1 });
  const t4 = dressStructure({ seed: 's', plan, tier: 4 });
  assert.ok(t4.spawns.length > t1.spawns.length, 'more enemies at higher tier');
  assert.ok(t4.secrets.length > t1.secrets.length, 'more secrets at higher tier');
  assert.ok(t4.loot.length >= t1.loot.length);
});

test('TAC10: spawns reference real bestiary creatures and live in real rooms', () => {
  const plan = getPlan('chapel');
  const roomIds = new Set(plan.rooms.map(r => String(r.id)));
  const d = dressStructure({ seed: 's', plan, tier: 3 });
  for (const sp of d.spawns) { assert.ok(REFS.has(sp.ref), `unknown creature ${sp.ref}`); assert.ok(roomIds.has(sp.roomId)); }
});

test('TAC10: a lair places its own creature first', () => {
  const lair = getLair('web_nest');
  const d = dressStructure({ seed: 's', plan: lair, tier: 2, ownerRef: 'giant_spider' });
  assert.equal(d.spawns[0].ref, 'giant_spider', 'the resident is spawned first');
});

test('TAC10: deterministic', () => {
  const plan = getPlan('tavern');
  assert.deepEqual(dressStructure({ seed: 'x', plan, tier: 2 }), dressStructure({ seed: 'x', plan, tier: 2 }));
});

test('TAC10: secrets reference real rooms with valid types', () => {
  const plan = getPlan('mausoleum');
  const roomIds = new Set(plan.rooms.map(r => String(r.id)));
  const d = dressStructure({ seed: 's', plan, tier: 4 });
  for (const s of d.secrets) { assert.ok(roomIds.has(s.roomId)); assert.ok(['hidden_cache', 'false_wall', 'trapped_chest'].includes(s.type)); }
});
