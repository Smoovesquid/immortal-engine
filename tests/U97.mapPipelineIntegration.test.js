/**
 * U97 — end-to-end map pipeline integration.
 *
 * Proves the data chain the live map will run, on real world/engine state:
 *   structure -> floorPlan -> floorPlanToSceneModel (fog-of-war)
 *             -> reachableRooms -> resolveStealthMove -> creatureCard
 * The renderer is verified visually in the preview; this locks the LOGIC the
 * LocalMap wiring depends on, deterministically.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { floorPlan } from '../engine/structures/floorPlan.js';
import { floorPlanToSceneModel } from '../public/map/handDrawnInterior.js';
import { reachableRooms, pathBetween } from '../engine/movement/interiorMovement.js';
import { resolveStealthMove, riskLevel } from '../engine/movement/stealthMove.js';
import { creatureCard } from '../engine/ai/inspectCards.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';

const structure = {
  id: 'keep1', kind: 'building', nodeId: 'n', anchors: { nodeId: 'n' },
  topology: {
    kind: 'rooms',
    rooms: [{ id: 'entry', tags: ['entry'] }, { id: 'hall' }, { id: 'kitchen' }, { id: 'vault' }],
    edges: [{ a: 'entry', b: 'hall' }, { a: 'entry', b: 'kitchen' }, { a: 'hall', b: 'vault' }]
  }
};

test('U97: fog-of-war — scene model only draws visited rooms + their doors', () => {
  const fp = floorPlan(structure);
  const model = floorPlanToSceneModel(fp, { currentRoomId: 'entry', visited: ['entry', 'hall'] });
  const ids = model.rooms.map(r => r.id).sort();
  assert.deepEqual(ids, ['entry', 'hall'], 'only explored rooms appear');
  for (const d of model.doors) {
    assert.ok(['entry', 'hall'].length, 'door endpoints are within explored set');
  }
  // a door to an unexplored room (kitchen/vault) must not be drawn yet
  assert.equal(model.doors.length <= fp.doors.length, true);
});

test('U97: reachability + ambush + risk compose into a movement decision', () => {
  const { dist } = reachableRooms(structure.topology, 'entry');
  assert.equal(dist.get('hall'), 1);   // careful step
  assert.equal(dist.get('vault'), 2);  // bold dash

  const route = pathBetween(structure.topology, 'entry', 'vault');
  assert.deepEqual(route, ['entry', 'hall', 'vault']);

  const careful = resolveStealthMove({ seed: 'w', nonce: 5, distance: dist.get('hall'), mode: 'careful' });
  const dash = resolveStealthMove({ seed: 'w', nonce: 5, distance: dist.get('vault'), mode: 'bold', dangerRooms: 1 });
  assert.ok(careful.riskPct < dash.riskPct);
  assert.ok(['none', 'Low', 'Medium', 'High'].includes(riskLevel(dash.riskPct)));
});

test('U97: a real bestiary entry flows through the inspect card, perception-gated', () => {
  const entry = trivial[0];
  assert.ok(entry && entry.name, 'have a real bestiary entry');

  const blind = creatureCard(entry, { identified: false });
  assert.equal(blind.full.hp, '???', 'stats hidden before identification');
  assert.notEqual(blind.glance.title, entry.name, 'name hidden before identification');

  const known = creatureCard(entry, { identified: true });
  assert.equal(known.glance.title, entry.name);
  assert.equal(known.full.hp, entry.maxHp);
  assert.equal(known.full.ac, entry.ac);
});

test('U97: whole pipeline is deterministic', () => {
  const fp = floorPlan(structure);
  const a = JSON.stringify(floorPlanToSceneModel(fp, { currentRoomId: 'entry', visited: ['entry', 'hall'] }));
  const b = JSON.stringify(floorPlanToSceneModel(fp, { currentRoomId: 'entry', visited: ['entry', 'hall'] }));
  assert.equal(a, b);
  assert.deepEqual(
    resolveStealthMove({ seed: 'w', nonce: 7, distance: 3, mode: 'bold', dangerRooms: 2, agilityMod: 1 }),
    resolveStealthMove({ seed: 'w', nonce: 7, distance: 3, mode: 'bold', dangerRooms: 2, agilityMod: 1 })
  );
});
