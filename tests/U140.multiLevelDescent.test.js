// U140 — multi-level descent (the Phase-D lynchpin, docs/WORLD_AND_DUNGEONS.md Part B).
// A dungeon_entrance now defaults to a `site`: descend the stair at each vault to reach
// the next floor — deeper, wronger, richer — until the deepest vault, which has no stair
// down. Each level is its own structure (the interior key encodes depth). Deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { generateDungeon, dungeonStructureId } from '../engine/dungeon/generate.js';
import { biomeForNode } from '../engine/world/biome.js';
import { worldHash } from '../engine/worldHash.js';

const PACKS = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };

function atEntrance(seed) {
  let w = beginAdventure(newWorld({ seed, fate: 0.3, campaignId: `d-${seed}`, pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const ent = (w.map.nodes || []).find(n => n.nodeType === 'dungeon_entrance');
  w = ensureWorld({ ...w, map: { ...w.map, currentNodeId: ent.id }, scene: { ...w.scene, interior: null }, party: (w.party || []).map(p => ({ ...p, position: { ...(p.position || {}), nodeId: ent.id, interior: undefined } })) });
  return { w, ent, biome: biomeForNode(w.meta.seed, ent) };
}

// Descend from the surface, then stand on each level's down-stair (its vault) and go
// deeper, until depth `target`. (Placing the player on the stair room sidesteps the
// vault guardian — combat is U139's job; this exercises the DESCENT.)
function descendTo(w0, dn, target) {
  let w = playerMove(w0, PACKS, 'descend').world;
  for (let d = 0; d < target; d++) {
    w = ensureWorld({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: dn.levels[d].downStairsRoomId } } });
    w = playerMove(w, PACKS, 'descend').world;
  }
  return w;
}

test('U140-01: a dungeon_entrance is a multi-level site with stairs linking the floors', () => {
  const { w: w0, ent, biome } = atEntrance('blackvale');
  const dn = generateDungeon(w0.meta.seed, ent.id, { biome });
  assert.equal(dn.scale, 'site');
  assert.ok(dn.levels.length >= 2, `more than one level, got ${dn.levels.length}`);
  for (let d = 0; d < dn.levels.length; d++) {
    if (d < dn.levels.length - 1) assert.ok(dn.levels[d].downStairsRoomId, `level ${d} has a stair down`);
    else assert.equal(dn.levels[d].downStairsRoomId, null, 'the deepest level has no stair down');
    if (d > 0) assert.ok(dn.levels[d].upStairsRoomId, `level ${d} has a stair up`);
  }
});

test('U140-02: descending at the vault drops you to the next floor', () => {
  const { w: w0, ent, biome } = atEntrance('blackvale');
  const dn = generateDungeon(w0.meta.seed, ent.id, { biome });
  let w = playerMove(w0, PACKS, 'descend').world;
  assert.equal(w.scene.interior.structureKey, dungeonStructureId(ent.id, 0), 'first descent lands on level 0');
  w = ensureWorld({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: dn.levels[0].downStairsRoomId } } });
  const r = playerMove(w, PACKS, 'descend');
  assert.equal(r.world.scene.interior.structureKey, dungeonStructureId(ent.id, 1), 'now on level 1');
  assert.match(r.output.mechanics, /descend → depth 1/);
  assert.equal(r.world.scene.interior.roomId, dn.levels[1].entryRoomId, 'arrived at the foot of the up-stair');
});

test('U140-03: a descend with no stair underfoot guides you, and the bottom admits it', () => {
  const { w: w0, ent, biome } = atEntrance('blackvale');
  const dn = generateDungeon(w0.meta.seed, ent.id, { biome });
  // On level 0 but NOT on the vault → a hint, not a plunge.
  let w = playerMove(w0, PACKS, 'descend').world;
  const notVault = Object.keys(dn.levels[0].rooms).find(id => id !== dn.levels[0].downStairsRoomId);
  w = ensureWorld({ ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId: notVault } } });
  assert.match(playerMove(w, PACKS, 'go deeper').output.narration, /vault|heart|no stair/i);
  // At the deepest floor, there is no way down.
  const bottom = dn.levels.length - 1;
  const wb = descendTo(w0, dn, bottom);
  assert.equal(wb.scene.interior.structureKey, dungeonStructureId(ent.id, bottom), `reached the bottom (depth ${bottom})`);
  assert.match(playerMove(wb, PACKS, 'descend').output.narration, /deepest dark|no stair/i);
});

test('U140-04: the descent is deterministic — same seed replays to an identical world', () => {
  const run = () => {
    const { w: w0, ent, biome } = atEntrance('blackvale');
    const dn = generateDungeon(w0.meta.seed, ent.id, { biome });
    return worldHash(descendTo(w0, dn, Math.min(2, dn.levels.length - 1)));
  };
  assert.equal(run(), run());
});
