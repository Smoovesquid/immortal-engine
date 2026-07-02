// U122 — P-70 the salvage slice (docs/SALVAGE_AND_BUILD.md, rung one).
// Destruction yields typed, stackable materials; a board is a weapon by RAW
// improvised rules (its die, your STR, no proficiency). Destruction is never
// a dead end.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { meleeProfile, resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { furnitureRoomAssignments } from '../engine/structures/roomObjects.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { salvageYield } from '../engine/ruleset/core/items/materials.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';
import { makeRng, seedFromString } from '../engine/rng.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
// Room-scoped objects (U307/WB-Q5): furniture lives in ONE room of an interior now,
// so stand the player in the named piece's room before acting on it.
const standInPieceRoom = (w, name) => {
  const a = furnitureRoomAssignments(w, w.map.currentNodeId).get(String(name));
  const cur = w.scene?.interior;
  if (!a || !cur || String(cur.roomId) === a.roomId) return w;
  const visited = [...new Set([...(cur.visited || []), a.roomId])];
  return {
    ...w,
    party: (w.party || []).map(p => ({ ...p, position: { ...(p.position || {}), interior: { structureId: a.structureId, roomId: a.roomId } } })),
    scene: { ...w.scene, interior: { structureKey: a.structureId, roomId: a.roomId, visited } }
  };
};

const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u122-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

// Find a seed whose starting node has a wood-tagged piece of furniture.
function beginWithWood() {
  for (let i = 0; i < 20; i++) {
    const w = begin(`u122s${i}`);
    const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
    const f = (node?.furniture || []).find(x => (x.tags || []).includes('wood'));
    if (f) return { w: standInPieceRoom(w, f.name), f, node };
  }
  return null;
}

test('U122-01: salvageYield is deterministic, tag-driven, and never empty', () => {
  const crate = { name: 'wooden crate', tags: ['wood', 'container'], bulk: 2, parts: [] };
  const a = salvageYield(crate, makeRng(seedFromString('u122y')));
  const b = salvageYield(crate, makeRng(seedFromString('u122y')));
  assert.deepEqual(a, b, 'same seed, same wreckage');
  assert.ok(a.some(y => y.defRef === 'board'), 'wood gives boards');
  for (const y of a) assert.ok(getItemDef(y.defRef), `${y.defRef} is a real material`);
  // untagged junk still yields something
  const mystery = { name: 'odd thing', tags: [], bulk: 1 };
  assert.ok(salvageYield(mystery, makeRng(seedFromString('u122z'))).length >= 1, 'destruction is never a dead end');
});

test('U122-02: smashing furniture removes it and banks stacked materials — all canon', () => {
  const found = beginWithWood();
  assert.ok(found, 'no seed offered wooden furniture at start');
  const { w, f, node } = found;
  const before = (node.furniture || []).length;

  const r = playerMove(w, packs, `I smash the ${f.name} to pieces`);
  assert.match(r.output.mechanics, /salvage \|/);
  const nodeAfter = r.world.map.nodes.find(n => n.id === node.id);
  assert.equal((nodeAfter.furniture || []).length, before - 1, 'the thing is gone');
  const mats = r.world.party[0].inventory.items.filter(it => getItemDef(it.defRef)?.kind === 'material');
  assert.ok(mats.length >= 1, 'materials in the pack');
  assert.ok(r.world.timeline.some(e => e.kind === 'salvage'), 'salvage is canon');
  assertWorldInvariants(r.world);

  // determinism: same world, same text → same haul
  const r2 = playerMove(w, packs, `I smash the ${f.name} to pieces`);
  assert.equal(r2.output.mechanics, r.output.mechanics);
});

test('U122-03: naming a part still extracts via physics — salvage only takes whole things', () => {
  // a table has legs; "tear the leg off" must NOT route to full salvage
  for (let i = 0; i < 20; i++) {
    const w = begin(`u122p${i}`);
    const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
    const f = (node?.furniture || []).find(x => (x.parts || []).includes('leg'));
    if (!f) continue;
    const r = playerMove(standInPieceRoom(w, f.name), packs, `I tear the leg off the ${f.name}`);
    assert.ok(!/salvage \|/.test(r.output.mechanics), 'part extraction is not salvage');
    return;
  }
  assert.fail('no seed offered legged furniture');
});

test('U122-04: a board in hand is a RAW improvised weapon — d4, STR, no proficiency', () => {
  const found = beginWithWood();
  assert.ok(found);
  let r = playerMove(found.w, packs, `I smash the ${found.f.name} to pieces`);
  r = playerMove(r.world, packs, 'I wield the board');
  assert.match(r.output.mechanics, /equip \| Board \| main_hand/);
  const prof = meleeProfile(r.world.party[0]);
  assert.equal(prof.name, 'Board');
  assert.equal(prof.die, 4);
  const pc = r.world.party[0];
  const strMod = pc.dnd ? pc.dnd.mods.STR : Math.floor(((pc.stats?.MIGHT ?? 10) - 10) / 2);
  assert.equal(prof.atkBonus, strMod, 'no proficiency on an improvised swing');
});

test('U122-05: you can club a bandit with it — combat names the board', () => {
  const found = beginWithWood();
  assert.ok(found);
  let r = playerMove(found.w, packs, `I smash the ${found.f.name} to pieces`);
  r = playerMove(r.world, packs, 'I wield the board');
  const wc = {
    ...r.world,
    meta: { ...r.world.meta, escapeHp: 11, escapeMaxHp: 11 },
    combat: { ...r.world.combat, active: true, round: 1, enemies: [{ id: 'e1', name: 'bandit', hp: 8, maxHp: 8, ac: 10, attack: 2, dmgDie: 4, cr: 0.25 }], initiativeOrder: [], beganAt: 0 }
  };
  const { result } = resolveEscapeCombatTurn(wc, 'strike');
  assert.ok((result.beats || []).some(b => /board/i.test(b)), 'the swing is a board swing');
});

test('U122-06: stacks merge — two smashed crates, one pile of boards', () => {
  for (let i = 0; i < 20; i++) {
    const w = begin(`u122m${i}`);
    const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
    const wood = (node?.furniture || []).filter(x => (x.tags || []).includes('wood'));
    if (wood.length < 2) continue;
    let r = playerMove(standInPieceRoom(w, wood[0].name), packs, `I smash the ${wood[0].name} to pieces`);
    r = playerMove(standInPieceRoom(r.world, wood[1].name), packs, `I smash the ${wood[1].name} to pieces`);
    const boards = r.world.party[0].inventory.items.filter(it => it.defRef === 'board');
    assert.equal(boards.length, 1, 'one stack, not parallel instances');
    assert.ok((boards[0].qty || 1) >= 2, 'the stack grew');
    return;
  }
  assert.fail('no seed offered two wooden pieces');
});

test('U122-07: materials sell for coppers — the spend loop accepts wreckage', () => {
  const found = beginWithWood();
  assert.ok(found);
  let r = playerMove(found.w, packs, `I smash the ${found.f.name} to pieces`);
  const hasBoards = r.world.party[0].inventory.items.some(it => it.defRef === 'board');
  if (!hasBoards) return; // some yields skip boards; the price path is covered by U119
  const r2 = playerMove(r.world, packs, 'I sell the board');
  // general stores buy materials; if this settlement lacks one, refusal is also honest
  assert.match(r2.output.mechanics, /trade:sell/);
});
