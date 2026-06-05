import test from 'node:test';
import assert from 'node:assert/strict';

import { schema } from '../engine/objects/schema.js';
import { query } from '../engine/objects/query.js';
import { outcomes } from '../engine/objects/outcomes.js';
import { ensureWorld } from '../engine/state.js';

// ── U85 — Object Schema, Query, Outcomes ────────────────────────────────────

test('U85-01: inferMaterial recognizes wood keywords', () => {
  assert.equal(schema.inferMaterial('wooden table', []), schema.MATERIALS.WOOD);
  assert.equal(schema.inferMaterial('oak chair', []), schema.MATERIALS.WOOD);
  assert.equal(schema.inferMaterial('plank', []), schema.MATERIALS.WOOD);
});

test('U85-02: inferMaterial recognizes stone keywords', () => {
  assert.equal(schema.inferMaterial('stone wall', []), schema.MATERIALS.STONE);
  assert.equal(schema.inferMaterial('brick floor', []), schema.MATERIALS.STONE);
  assert.equal(schema.inferMaterial('granite statue', []), schema.MATERIALS.STONE);
});

test('U85-03: inferMaterial recognizes metal keywords', () => {
  assert.equal(schema.inferMaterial('iron sword', []), schema.MATERIALS.METAL);
  assert.equal(schema.inferMaterial('bronze chain', []), schema.MATERIALS.METAL);
  assert.equal(schema.inferMaterial('steel plate', []), schema.MATERIALS.METAL);
});

test('U85-04: inferMaterial recognizes glass keywords', () => {
  assert.equal(schema.inferMaterial('glass bottle', []), schema.MATERIALS.GLASS);
  assert.equal(schema.inferMaterial('window pane', []), schema.MATERIALS.GLASS);
  assert.equal(schema.inferMaterial('mirror', []), schema.MATERIALS.GLASS);
});

test('U85-05: inferMaterial recognizes cloth keywords', () => {
  assert.equal(schema.inferMaterial('cloth banner', []), schema.MATERIALS.CLOTH);
  assert.equal(schema.inferMaterial('rope', []), schema.MATERIALS.CLOTH);
  assert.equal(schema.inferMaterial('canvas sail', []), schema.MATERIALS.CLOTH);
});

test('U85-06: inferCategory recognizes furniture keywords', () => {
  assert.equal(schema.inferCategory('wooden table', []), schema.CATEGORIES.FURNITURE);
  assert.equal(schema.inferCategory('oak chair', []), schema.CATEGORIES.FURNITURE);
  assert.equal(schema.inferCategory('bench', []), schema.CATEGORIES.FURNITURE);
});

test('U85-07: inferCategory recognizes tool keywords', () => {
  assert.equal(schema.inferCategory('hammer', []), schema.CATEGORIES.TOOL);
  assert.equal(schema.inferCategory('axe', []), schema.CATEGORIES.TOOL);
  assert.equal(schema.inferCategory('lever', []), schema.CATEGORIES.TOOL);
});

test('U85-08: inferCategory recognizes light keywords', () => {
  assert.equal(schema.inferCategory('lantern', []), schema.CATEGORIES.LIGHT);
  assert.equal(schema.inferCategory('torch', []), schema.CATEGORIES.LIGHT);
  assert.equal(schema.inferCategory('lamp', []), schema.CATEGORIES.LIGHT);
});

test('U85-09: computeProperties returns material defaults', () => {
  const woodProps = schema.computeProperties(schema.MATERIALS.WOOD);
  assert.equal(woodProps.weight, 2);
  assert.equal(woodProps.flammable, 3);
  assert.equal(woodProps.noise, 1);

  const metalProps = schema.computeProperties(schema.MATERIALS.METAL);
  assert.equal(metalProps.weight, 3);
  assert.equal(metalProps.flammable, 0);
  assert.equal(metalProps.conductive, true);
});

test('U85-10: getStateProgression returns valid states for material', () => {
  const woodStates = schema.getStateProgression(schema.MATERIALS.WOOD);
  assert.ok(woodStates.includes('intact'));
  assert.ok(woodStates.includes('damaged'));
  assert.ok(woodStates.includes('destroyed'));

  const stoneStates = schema.getStateProgression(schema.MATERIALS.STONE);
  assert.ok(stoneStates.includes('intact'));
  assert.ok(stoneStates.length > 1);
});

test('U85-11: getBreakOutcome returns pieces for material', () => {
  const woodBreak = schema.getBreakOutcome(schema.MATERIALS.WOOD);
  assert.ok(Array.isArray(woodBreak.pieces));
  assert.ok(woodBreak.pieces.length > 0);
  assert.equal(typeof woodBreak.noise, 'number');
  assert.ok(woodBreak.noise > 0);

  const glassBreak = schema.getBreakOutcome(schema.MATERIALS.GLASS);
  assert.ok(glassBreak.pieces.some(p => p.includes('shard')));
});

test('U85-12: objectsAtNode retrieves furniture from node', () => {
  const w = ensureWorld({
    meta: { version: 21, seed: 'u85', fate: 0.2 },
    map: {
      nodes: [
        {
          id: 'n0',
          name: 'room',
          furniture: [
            { name: 'wooden table', parts: ['leg', 'top'], bulk: 4, weight: 3, tags: ['wood', 'furniture'] },
            { name: 'glass window', parts: [], bulk: 2, weight: 1, tags: ['glass', 'light'] }
          ]
        }
      ],
      currentNodeId: 'n0'
    }
  });

  const objects = query.objectsAtNode(w, 'n0');
  assert.equal(objects.length, 2);
  assert.equal(objects[0].name, 'wooden table');
  assert.equal(objects[0].material, schema.MATERIALS.WOOD);
  assert.equal(objects[1].material, schema.MATERIALS.GLASS);
});

test('U85-13: canBreak identifies breakable objects', () => {
  const woodTable = {
    name: 'wooden table',
    material: schema.MATERIALS.WOOD,
    state: 'intact',
    parts: ['leg', 'top']
  };
  assert.equal(query.canBreak(woodTable), true);

  const stoneWall = {
    name: 'stone wall',
    material: schema.MATERIALS.STONE,
    state: 'intact'
  };
  assert.equal(query.canBreak(stoneWall), true);
});

test('U85-14: canTake checks bulk limit', () => {
  const light = { name: 'lantern', bulk: 1 };
  assert.equal(query.canTake(light), true);

  const heavy = { name: 'anvil', bulk: 5 };
  assert.equal(query.canTake(heavy), false);

  const medium = { name: 'sword', bulk: 2 };
  assert.equal(query.canTake(medium), true);
});

test('U85-15: canBurn checks flammability', () => {
  const woodObj = { name: 'wooden chair', material: schema.MATERIALS.WOOD };
  assert.equal(query.canBurn(woodObj), true);

  const stoneObj = { name: 'stone wall', material: schema.MATERIALS.STONE };
  assert.equal(query.canBurn(stoneObj), false);

  const clothObj = { name: 'banner', material: schema.MATERIALS.CLOTH };
  assert.equal(query.canBurn(clothObj), true);
});

test('U85-16: breakOutcome returns pieces and noise for wood', () => {
  const woodTable = {
    name: 'wooden table',
    material: schema.MATERIALS.WOOD,
    state: 'intact',
    parts: ['leg', 'top']
  };

  const outcome = outcomes.breakOutcome(woodTable);
  assert.equal(outcome.possible, true);
  assert.ok(outcome.pieces.length > 0);
  assert.equal(typeof outcome.noise, 'number');
  assert.ok(outcome.noise > 0);
});

test('U85-17: takeOutcome respects bulk limit', () => {
  const light = { name: 'feather', bulk: 0 };
  const lightOutcome = outcomes.takeOutcome(light);
  assert.equal(lightOutcome.possible, true);

  const heavy = { name: 'anvil', bulk: 5 };
  const heavyOutcome = outcomes.takeOutcome(heavy);
  assert.equal(heavyOutcome.possible, false);
});

test('U85-18: burnOutcome marks flammable materials', () => {
  const wood = { name: 'plank', material: schema.MATERIALS.WOOD };
  const woodOutcome = outcomes.burnOutcome(wood);
  assert.equal(woodOutcome.possible, true);
  assert.ok(woodOutcome.damage > 0);

  const metal = { name: 'sword', material: schema.MATERIALS.METAL };
  const metalOutcome = outcomes.burnOutcome(metal);
  assert.equal(metalOutcome.possible, false);
});

test('U85-19: extractPartOutcome requires valid part', () => {
  const obj = { name: 'table', parts: ['leg', 'top'] };
  const validPart = outcomes.extractPartOutcome(obj, 'leg');
  assert.equal(validPart.possible, true);

  const invalidPart = outcomes.extractPartOutcome(obj, 'handle');
  assert.equal(invalidPart.possible, false);
});

test('U85-20: itemPropertiesFromObject scales properties down', () => {
  const heavyObj = { name: 'anvil', material: schema.MATERIALS.METAL };
  const props = outcomes.itemPropertiesFromObject(heavyObj);
  assert.ok(props.weight < 5);
  assert.ok(props.bulk > 0);
  assert.equal(typeof props.noise, 'number');
});
