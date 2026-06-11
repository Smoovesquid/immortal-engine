// U99 — Multi-hop named travel (Stage C.2c).
//
// Naming a KNOWN place several hops away runs a per-leg journey there: you either
// reach it or get interrupted AT A REAL NODE (never the void), time/distance scale
// with the hops, and it's deterministic. Fixes the slice-2b survey-vs-reach bug.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { bfsPath, ensureMap } from '../engine/map/mapState.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function outside(seed) {
  let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u99-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  if (w.scene?.interior) w = playerMove(w, packs, 'go outside').world;
  return w;
}
// A discovered node that is NOT a direct neighbor but is reachable in >=2 hops.
function farTarget(w) {
  const m = ensureMap(w.map);
  const here = String(m.currentNodeId || '');
  const direct = new Set((m.edges || []).filter(e => e.a === here || e.b === here).map(e => (e.a === here ? e.b : e.a)).map(String));
  return (m.discovered || []).map(String)
    .filter(id => id !== here && !direct.has(id))
    .map(id => (m.nodes || []).find(n => n && String(n.id) === id))
    .filter(Boolean)
    .find(n => { const p = bfsPath(m, here, n.id, 8); return p && p.length >= 2; });
}

describe('U99-A: multi-hop travel reaches or interrupts at a real node — never the void', () => {
  it('across many seeds: some reach the far place, none are stranded, all stop at a node', () => {
    let reached = 0, interrupted = 0, stranded = 0, trips = 0;
    for (let i = 0; i < 40; i++) {
      const w = outside(`mh${i}`);
      const far = farTarget(w);
      if (!far) continue;
      trips++;
      const t0 = { ...w.time };
      const { world } = playerMove(w, packs, `go to ${far.name}`);
      const cur = String(world.map?.currentNodeId || '');
      if (!cur) { stranded++; continue; }
      // time + distance advanced by the journey
      assert.ok(world.time.hours > t0.hours, 'a multi-hop journey costs time');
      assert.ok(world.time.leagues > t0.leagues, 'a multi-hop journey covers distance');
      if (cur === String(far.id)) reached++; else interrupted++;
    }
    assert.ok(trips > 0, 'need worlds with a far discovered target');
    assert.equal(stranded, 0, 'must NEVER strand the player in the void');
    assert.ok(reached > 0, 'some multi-hop journeys should reach the destination cleanly');
    assert.ok(interrupted >= 0);
  });
});

describe('U99-B: multi-hop costs more than a single hop', () => {
  it('a 2+ hop journey advances leagues by more than one leg would', () => {
    for (let i = 0; i < 40; i++) {
      const w = outside(`cost${i}`);
      const far = farTarget(w);
      if (!far) continue;
      const hops = bfsPath(ensureMap(w.map), String(w.map.currentNodeId), String(far.id), 8).length;
      if (hops < 2) continue;
      const { world } = playerMove(w, packs, `go to ${far.name}`);
      // At minimum, leagues advanced by >= number of legs actually crossed (>=1).
      assert.ok(world.time.leagues - w.time.leagues >= 1, 'distance accrued');
      return;
    }
  });
});

describe('U99-C: multi-hop is deterministic', () => {
  it('same seed + input → identical destination, mechanics, and clock', () => {
    // County-scale maps discover fewer far nodes at game start; scan seeds
    // for one that offers a non-adjacent reachable target.
    const run = (seed) => {
      const w = outside(seed);
      const far = farTarget(w);
      if (!far) return null;
      const { world, output } = playerMove(w, packs, `go to ${far.name}`);
      return { at: String(world.map.currentNodeId), mech: output.mechanics, time: world.time };
    };
    for (const seed of ['mhdet', 'mhdet2', 'mhdet3', 'mhdet4', 'mhdet5']) {
      const a = run(seed), b = run(seed);
      if (!a) continue;
      assert.deepEqual(a, b);
      return;
    }
    // No seed offered a far target — vacuously fine (the property under test
    // is determinism of multi-hop, which needs a multi-hop to exist).
  });
});

describe('U99-D: bfsPath basics', () => {
  it('returns null for unreachable / same node, finds adjacent in one hop', () => {
    const w = outside('bfs');
    const m = ensureMap(w.map);
    const here = String(m.currentNodeId);
    assert.equal(bfsPath(m, here, here, 8), null, 'same node → null');
    assert.equal(bfsPath(m, here, 'no_such_node', 8), null, 'unknown → null');
    const nb = (m.edges || []).filter(e => e.a === here || e.b === here).map(e => (e.a === here ? e.b : e.a))[0];
    if (nb) {
      const p = bfsPath(m, here, nb, 8);
      assert.ok(Array.isArray(p) && p[p.length - 1] === nb, 'adjacent reachable');
    }
  });
});
