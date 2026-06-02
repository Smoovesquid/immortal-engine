import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { ensureMap, stepCell, nodeAtCell, seeNode, visitNode } from '../engine/map/mapState.js';
import { worldHash } from '../engine/worldHash.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

function twoNodeWorld(seed, extraMeta = {}) {
  return ensureWorld({
    meta: { seed, ...extraMeta },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [
        { id: 'n0', name: 'Start', tags: [] },
        { id: 'n1', name: 'North', tags: [] }
      ],
      edges: [{ a: 'n0', b: 'n1' }],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
}

function walkToNode(w, targetId) {
  for (let i = 0; i < 100; i++) {
    const m = ensureMap(w.map);
    const target = m.nodes.find(n => String(n.id) === String(targetId));
    const { x, y } = m.pos;
    if (x === target.x && y === target.y) break;
    const cmd = (target.x !== x)
      ? (target.x > x ? 'go east' : 'go west')
      : (target.y > y ? 'go south' : 'go north');
    w = playerMove(w, packsById, cmd).world;
  }
  return w;
}

// Step into a cell that is NOT a named node (open wilderness). Returns the world
// after one wild step, or null if every cardinal happened to land on n1.
function stepIntoWild(w) {
  const m = ensureMap(w.map);
  const n1 = m.nodes.find(n => n.id === 'n1');
  for (const d of ['go north', 'go south', 'go east', 'go west']) {
    const c = stepCell(m.pos, d.split(' ')[1]);
    if (!(c.x === n1.x && c.y === n1.y)) return playerMove(w, packsById, d).world;
  }
  return null;
}

// ── Sighted vs visited knowledge tiers ───────────────────────────────────────

test('U90a: visitNode marks discovered + visited; seeNode marks discovered only', () => {
  const base = twoNodeWorld('u90-mem');
  const seen = seeNode(base, 'n1');
  const mSeen = ensureMap(seen.map);
  assert.ok(mSeen.discovered.includes('n1'), 'seeNode discovers the node');
  assert.equal((mSeen.memory.visitedTurnByNodeId || {}).n1, undefined, 'seeNode does NOT mark visited');

  const vis = visitNode(base, 'n1');
  const mVis = ensureMap(vis.map);
  assert.ok(mVis.discovered.includes('n1'), 'visitNode discovers the node');
  assert.ok((mVis.memory.visitedTurnByNodeId || {}).n1 !== undefined, 'visitNode marks visited');
});

test('U90b: walking onto a node marks it visited (not just discovered)', () => {
  let w = twoNodeWorld('u90-arrive');
  const before = ensureMap(w.map).memory.visitedTurnByNodeId || {};
  assert.equal(before.n1, undefined, 'n1 not visited before arrival');
  w = walkToNode(w, 'n1');
  const after = ensureMap(w.map).memory.visitedTurnByNodeId || {};
  assert.ok(after.n1 !== undefined, 'arrival marked n1 visited');
});

// ── Wilderness wandering encounters (escape mode) ────────────────────────────

test('U90c: escape-mode wild walking is deterministic (same seed + steps => same hash)', () => {
  const run = () => {
    let w = twoNodeWorld('u90-det', { mode: 'escape', fate: 0.3 });
    // First step off-node, then keep pressing north through the wild. If an
    // ambush fires the free-move branch stops applying — identically in both runs.
    w = stepIntoWild(w) || w;
    for (let k = 0; k < 4; k++) w = playerMove(w, packsById, 'go north').world;
    return w;
  };
  assert.equal(worldHash(run()), worldHash(run()), 'escape wild walk replays identically');
});

test('U90d: non-escape free-roam never spawns a wilderness encounter', () => {
  let combatEver = false;
  for (let s = 0; s < 12; s++) {
    let w = twoNodeWorld(`u90-plain-${s}`);
    for (let k = 0; k < 8 && !combatEver; k++) {
      w = playerMove(w, packsById, 'go north').world;
      if (w.combat?.active) combatEver = true;
    }
  }
  assert.equal(combatEver, false, 'the open sandbox stays quiet — wild encounters are escape-only');
});

test('U90f: wild-step narration (sighting/atmosphere) is deterministic across runs', () => {
  const walkNarr = () => {
    let w = twoNodeWorld('u90-narr'); // non-escape: no combat to interrupt the walk
    const lines = [];
    for (const d of ['go north', 'go east', 'go east', 'go south', 'go west']) {
      const r = playerMove(w, packsById, d);
      w = r.world;
      lines.push(String(r.output?.narration || ''));
    }
    return lines;
  };
  assert.deepEqual(walkNarr(), walkNarr(), 'identical seed + steps => identical travel prose');
});

test('U90g: sighting a place names it in the travel narration (pull toward the dot)', () => {
  // Step off n0 into a wild cell that does not land on n1; from there n1 should
  // come into sight and be named in the line.
  let w = twoNodeWorld('u90-pull');
  const stepped = stepIntoWild(w);
  assert.ok(stepped, 'stepped into open country');
  // Re-derive the narration of that exact first wild step.
  const m0 = ensureMap(twoNodeWorld('u90-pull').map);
  const n1 = m0.nodes.find(n => n.id === 'n1');
  let firstWildDir = null;
  for (const d of ['go north', 'go south', 'go east', 'go west']) {
    const c = stepCell(m0.pos, d.split(' ')[1]);
    if (!(c.x === n1.x && c.y === n1.y)) { firstWildDir = d; break; }
  }
  const out = playerMove(twoNodeWorld('u90-pull'), packsById, firstWildDir).output.narration;
  // n1 ("North") is one cell from n0, so it's within sight from the wild cell.
  assert.match(out, /North/, 'the sighted place is named, giving the dot a pull');
});

test('U90e: escape-mode wandering can spawn an ambush (deterministic across seeds)', () => {
  let firedRuns = 0;
  let total = 0;
  for (let s = 0; s < 30; s++) {
    let w = twoNodeWorld(`u90-wild-${s}`, { mode: 'escape', fate: 0.3 });
    const stepped = stepIntoWild(w);
    if (!stepped) continue;
    w = stepped;
    total++;
    for (let k = 0; k < 5 && !w.combat?.active; k++) {
      const m = ensureMap(w.map);
      if (nodeAtCell(m, m.pos.x, m.pos.y)) break; // arrived at a node — stop wild walk
      w = playerMove(w, packsById, 'go north').world;
    }
    if (w.combat?.active) firedRuns++;
  }
  assert.ok(total > 0, 'at least some runs stepped into open country');
  assert.ok(firedRuns > 0, `wilderness ambush fired in at least one run (got ${firedRuns}/${total})`);
});
