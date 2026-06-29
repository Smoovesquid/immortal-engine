// Boot the shippable slice through the REAL engine path and dump its overworld
// scene description (the bridge contract). Pure read — boots, reads world.map,
// writes JSON. No engine writes, no LLM (silent fallback if no key). Re-runnable.
//
//   node scripts/dump-slice-scene.mjs            # print + write the scene JSON
//
// Output: public/map-proto/slice-scene.json  (what slice.html consumes).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { sceneFromWorld } from '../public/map/sliceScene.js';
import { PACKS } from './convergence/fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../public/map-proto/slice-scene.json');

// Real boot path: newWorld → beginAdventure (escape mode, fantasy pack), same as
// _tallow_layout.mjs / the live demo. The slice routes on SLICE_SEED='aldermere'.
const world = beginAdventure(
  newWorld({ seed: SLICE_SEED, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS,
).world;

const scene = sceneFromWorld(world);

writeFileSync(OUT, JSON.stringify(scene, null, 2) + '\n');

console.log(JSON.stringify(scene, null, 2));
console.error(`\n✓ wrote ${OUT}`);
console.error(`  nodes=${scene.nodes.length}  edges=${scene.edges.length}  player@${scene.player.nodeId} (${scene.player.x},${scene.player.y})`);
