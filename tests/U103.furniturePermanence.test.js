// U103 — Stage D: consequence & permanence (open/close persists).
//
// "open the crate" mutates the furniture's state to `open` (close → `closed`) via a
// modifyFurniture delta, so a later examine, a re-attempt, and a RETURN visit all
// remember it. Re-doing it acknowledges the prior state. Destructive verbs
// (break/smash) still persist via the physics branch (no regression). Deterministic.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { furnitureRoomAssignments } from '../engine/structures/roomObjects.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u103-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const furnHere = (w) => {
  const n = w.map.nodes.find(x => x.id === w.map.currentNodeId);
  return Array.isArray(n?.furniture) ? n.furniture : [];
};
const stateOf = (w, name) => String(furnHere(w).find(f => f.name === name)?.state ?? '');
const firstFurnName = (w) => String(furnHere(w)[0]?.name || '');
const bare = (o) => String(o.narration || '').replace(/^Wizard:\s*/, '');
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
const beginAt = (seed) => {
  const w0 = begin(seed);
  const name = firstFurnName(w0);
  return { w: standInPieceRoom(w0, name), name };
};

describe('U103-A: open persists and is acknowledged', () => {
  it('opening a real piece sets state=open and names it', () => {
    const { w, name } = beginAt('open');
    const r = playerMove(w, packs, `open the ${name}`);
    assert.equal(stateOf(r.world, name), 'open', `should be open: ${r.output.mechanics}`);
    assert.match(bare(r.output).toLowerCase(), new RegExp(name.toLowerCase()));
  });
  it('examine after opening reflects that it stands open', () => {
    const { w, name } = beginAt('open');
    const r = playerMove(w, packs, `open the ${name}`);
    const e = playerMove(r.world, packs, `examine the ${name}`);
    assert.match(bare(e.output), /stands open/i, bare(e.output));
  });
  it('opening again acknowledges the prior state (no re-mutation, no crash)', () => {
    const { w, name } = beginAt('open');
    const r = playerMove(w, packs, `open the ${name}`);
    const again = playerMove(r.world, packs, `open the ${name}`);
    assert.match(bare(again.output), /already (stands )?open/i, bare(again.output));
    assert.equal(stateOf(again.world, name), 'open');
  });
});

describe('U103-B: close reverses it', () => {
  it('closing an open piece sets state=closed; closing again is acknowledged', () => {
    const { w, name } = beginAt('close');
    const opened = playerMove(w, packs, `open the ${name}`).world;
    const closed = playerMove(opened, packs, `close the ${name}`);
    assert.equal(stateOf(closed.world, name), 'closed', bare(closed.output));
    const again = playerMove(closed.world, packs, `close the ${name}`);
    assert.match(bare(again.output), /already shut/i, bare(again.output));
  });
});

describe('U103-C: permanence across moves (the world remembers)', () => {
  it('open a piece, leave, return → it is STILL open', () => {
    const { w, name } = beginAt('perm');
    const opened = playerMove(w, packs, `open the ${name}`).world;
    const away = playerMove(opened, packs, 'go outside').world;
    const back = playerMove(away, packs, 'go inside').world;
    assert.equal(stateOf(back, name), 'open', 'crate should still be open after leaving and returning');
  });
});

describe('U103-D: graceful + no regression', () => {
  it('opening something not present falls through gracefully (no crash, no furniture change)', () => {
    const w = begin('absent');
    const before = furnHere(w).map(f => f.state).join(',');
    const r = playerMove(w, packs, 'open the obsidian portcullis');
    assert.ok(bare(r.output).length > 0);
    assert.equal(furnHere(r.world).map(f => f.state).join(','), before, 'no furniture should change');
  });
  it('break still persists (physics path unaffected)', () => {
    const { w, name } = beginAt('break');
    const r = playerMove(w, packs, `break the ${name}`);
    // physics marks it damaged/broken/etc — anything but intact
    assert.notEqual(stateOf(r.world, name), 'intact', `break should persist: ${r.output.mechanics}`);
  });
});

describe('U103-E: deterministic', () => {
  it('same seed + inputs → identical prose, mechanics, and state', () => {
    const run = () => {
      const { w, name } = beginAt('det');
      const a = playerMove(w, packs, `open the ${name}`);
      const b = playerMove(a.world, packs, `examine the ${name}`);
      return { open: a.output, exam: b.output, state: stateOf(a.world, name) };
    };
    const x = run(), y = run();
    assert.equal(x.open.narration, y.open.narration);
    assert.equal(x.open.mechanics, y.open.mechanics);
    assert.equal(x.exam.narration, y.exam.narration);
    assert.equal(x.state, y.state);
  });
});
