// U305 — MX-4 TALK→TOKEN: spoken spatial movement in combat.
//
// A spoken command moves the player's mini to a deterministically-resolved cell
// (the Battle board reflects combat.playerCell) AND fires the tactical tag it
// implies (flank → flanked), narrated as a READ. The reactive loop, live in the
// escape engine.
//
// These assert: the resolver is pure + deterministic (intent→cell), the live
// escape path recognizes the intents and COMMITS the move through moveCombatant,
// the implied tag is set, out-of-reach is refused in fiction, the prose leaks no
// coordinate, and the whole thing is worldHash-stable under replay.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn, parseEscapeAction, initEscapeHp } from '../engine/combat/escapeCombat.js';
import { resolveSpatialMove, playerReachCells } from '../engine/combat/spatialMove.js';
import { combatGridDistance } from '../engine/combat/grid.js';
import { worldHash } from '../engine/worldHash.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function freshFightN(seed, enemies) {
  let w = newWorld({ seed, fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    meta: { ...w.meta, mode: 'escape' },
    party: [{ id: 'party', name: 'Sera', archetype: 'wanderer', wounds: 0, stress: 0,
      stats: { MIGHT: 13, AGILITY: 12, GRIT: 13, CHARM: 10, WITS: 11 } }],
    scene: { location: 'the millyard', objective: 'survive', time: 'dusk', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  w = initEscapeHp(w);
  w = beginCombat(w, { enemies, reason: 'ambush' });
  return w;
}

// Pin grid + the player and enemy cells so cell assertions are exact. The foes
// are low-damage so the player survives the enemy turn (the normal persist path).
function pinnedFight(seed, { grid = { w: 12, h: 10 }, playerCell, enemyCells, enemies } = {}) {
  const roster = enemies || enemyCells.map((c, i) => ({
    name: i === 0 ? 'Captain' : `Foe${i}`, hp: 200, maxHp: 200, damage: 1, ac: 12, canParley: false
  }));
  let w = freshFightN(seed, roster);
  const placed = w.combat.enemies.map((e, i) => ({ ...e, cx: enemyCells[i].cx, cy: enemyCells[i].cy }));
  w = applyDeltas(w, [{ op: 'combatState', set: { grid, playerCell, enemies: placed } }]);
  return w;
}

const moveBeat = (r) => (r.beats && r.beats[0]) || '';
const hasCoordLeak = (s) => /\(\s*\d+\s*,\s*\d+\s*\)/.test(s) || /\bc[xy]\b/.test(s);

// ── 1: voice recognition ────────────────────────────────────────────────────

test('U305-01: parseEscapeAction recognizes spatial-move intents', () => {
  for (const s of ['charge the captain', 'close on it', 'close the distance', 'advance on the wolf', 'rush at them', 'move toward the bandit', 'get closer']) {
    assert.deepEqual(parseEscapeAction(s), { verb: 'move', mode: 'toward' }, s);
  }
  for (const s of ['fall back', 'retreat', 'pull back', 'back away', 'give ground', 'disengage', 'create distance', 'move away']) {
    assert.deepEqual(parseEscapeAction(s), { verb: 'move', mode: 'away' }, s);
  }
  assert.deepEqual(parseEscapeAction('move north'), { verb: 'move', mode: 'compass-north' });
  assert.deepEqual(parseEscapeAction('move south'), { verb: 'move', mode: 'compass-south' });
  assert.deepEqual(parseEscapeAction('move east'), { verb: 'move', mode: 'compass-east' });
  assert.deepEqual(parseEscapeAction('step west'), { verb: 'move', mode: 'compass-west' });
  // The existing tactical verbs keep their own precedence.
  assert.equal(parseEscapeAction('circle to its flank').verb, 'flank');
  assert.equal(parseEscapeAction('take the high ground').verb, 'highground');
  assert.equal(parseEscapeAction('take cover').verb, 'cover');
});

// ── 2: the pure resolver — intent→cell, deterministic ─────────────────────────

const grid = { w: 12, h: 10 };
const cap = [{ id: 'e0', name: 'Captain', hp: 10, defeated: false, cx: 8, cy: 5 }];

test('U305-02: toward closes to a melee cell beside the foe; deterministic', () => {
  const a = resolveSpatialMove({ kind: 'toward', playerCell: { cx: 1, cy: 5 }, enemies: cap, grid });
  const b = resolveSpatialMove({ kind: 'toward', playerCell: { cx: 1, cy: 5 }, enemies: cap, grid });
  assert.deepEqual(a, b, 'pure: same input → same output');
  assert.equal(combatGridDistance(a.cell, { cx: 8, cy: 5 }), 1, 'lands adjacent to the foe');
  assert.equal(a.reached, true);
  assert.equal(a.tag, null);
});

test('U305-03: toward beyond reach makes partial progress (not a bounce)', () => {
  const far = [{ id: 'e0', name: 'Captain', hp: 10, defeated: false, cx: 11, cy: 9 }];
  const r = resolveSpatialMove({ kind: 'toward', playerCell: { cx: 0, cy: 0 }, enemies: far, grid });
  assert.equal(r.reason, 'moved');
  assert.equal(r.reached, false, 'still short of melee');
  assert.equal(combatGridDistance({ cx: 0, cy: 0 }, r.cell), playerReachCells(), 'used the full stride');
});

test('U305-04: toward when already adjacent does not move (already-there)', () => {
  const r = resolveSpatialMove({ kind: 'toward', playerCell: { cx: 7, cy: 5 }, enemies: cap, grid });
  assert.equal(r.cell, null);
  assert.equal(r.reason, 'already-there');
});

test('U305-05: away increases distance from the foe', () => {
  const r = resolveSpatialMove({ kind: 'away', playerCell: { cx: 4, cy: 5 }, enemies: cap, grid });
  assert.ok(combatGridDistance(r.cell, { cx: 8, cy: 5 }) > combatGridDistance({ cx: 4, cy: 5 }, { cx: 8, cy: 5 }));
  assert.equal(r.tag, null);
});

test('U305-06: compass strides the full reach and stops before a foe', () => {
  const r = resolveSpatialMove({ kind: 'compass-east', playerCell: { cx: 1, cy: 5 }, enemies: cap, grid });
  assert.deepEqual(r.cell, { cx: 7, cy: 5 }, 'stops one cell short of the foe at (8,5)');
  const n = resolveSpatialMove({ kind: 'compass-north', playerCell: { cx: 1, cy: 5 }, enemies: cap, grid });
  assert.deepEqual(n.cell, { cx: 1, cy: 0 }, 'strides north to the board edge');
});

test('U305-07: compass into the edge refuses (no-room)', () => {
  const r = resolveSpatialMove({ kind: 'compass-west', playerCell: { cx: 0, cy: 5 }, enemies: cap, grid });
  assert.equal(r.cell, null);
  assert.equal(r.reason, 'no-room');
});

test('U305-08: flank lands beside the foe and implies the flank tag', () => {
  const r = resolveSpatialMove({ kind: 'flank', playerCell: { cx: 6, cy: 5 }, enemies: cap, grid });
  assert.equal(combatGridDistance(r.cell, { cx: 8, cy: 5 }), 1, 'a neighbor of the foe');
  assert.equal(r.tag, 'flank');
});

test('U305-09: flank too far to reach yields too-far (tag still implied)', () => {
  const farCorner = [{ id: 'e0', name: 'Captain', hp: 10, defeated: false, cx: 11, cy: 9 }];
  const r = resolveSpatialMove({ kind: 'flank', playerCell: { cx: 0, cy: 0 }, enemies: farCorner, grid });
  assert.equal(r.cell, null);
  assert.equal(r.reason, 'too-far');
  assert.equal(r.tag, 'flank');
});

// ── 3: the live escape path COMMITS the move + sets the tag ────────────────────

test('U305-10: "charge the captain" moves the mini adjacent to the captain (board reflects it)', () => {
  const w = pinnedFight('u305-charge', { playerCell: { cx: 1, cy: 5 }, enemyCells: [{ cx: 8, cy: 5 }] });
  const out = resolveEscapeCombatTurn(w, 'charge the captain');
  assert.equal(combatGridDistance(out.world.combat.playerCell, { cx: 8, cy: 5 }), 1, 'now in melee range');
  assert.equal(hasCoordLeak(moveBeat(out.result)), false, 'no coords in the read');
  assert.equal(/\d/.test(moveBeat(out.result)), false, 'no numbers in the move read');
});

test('U305-11: "circle to its flank" moves the mini AND sets the flanked tag', () => {
  const w = pinnedFight('u305-flank', { playerCell: { cx: 6, cy: 5 }, enemyCells: [{ cx: 8, cy: 5 }] });
  const before = w.combat.playerCell;
  const out = resolveEscapeCombatTurn(w, 'circle to its flank');
  assert.equal(out.world.combat.enemies[0].tactical.flanked, true, 'flank tag set');
  assert.notDeepEqual(out.world.combat.playerCell, before, 'the mini moved');
  assert.equal(combatGridDistance(out.world.combat.playerCell, { cx: 8, cy: 5 }), 1, 'beside the foe');
  assert.equal(hasCoordLeak(moveBeat(out.result)), false);
});

test('U305-12: "fall back" moves the mini away from the foe', () => {
  const w = pinnedFight('u305-fallback', { playerCell: { cx: 5, cy: 5 }, enemyCells: [{ cx: 8, cy: 5 }] });
  const out = resolveEscapeCombatTurn(w, 'fall back');
  const d0 = combatGridDistance({ cx: 5, cy: 5 }, { cx: 8, cy: 5 });
  const d1 = combatGridDistance(out.world.combat.playerCell, { cx: 8, cy: 5 });
  assert.ok(d1 > d0, 'the mini opened distance');
  assert.equal(/\d/.test(moveBeat(out.result)), false);
});

test('U305-13: "move east" strides the mini east on the board', () => {
  const w = pinnedFight('u305-east', { playerCell: { cx: 1, cy: 2 }, enemyCells: [{ cx: 8, cy: 5 }] });
  const out = resolveEscapeCombatTurn(w, 'move east');
  assert.ok(out.world.combat.playerCell.cx > 1, 'moved east');
  assert.equal(out.world.combat.playerCell.cy, 2, 'held its lane');
  assert.equal(hasCoordLeak(moveBeat(out.result)), false);
});

test('U305-14: out-of-reach is refused in fiction (no move, no coords)', () => {
  // Boxed against the west edge — "move west" has nowhere to go.
  const w = pinnedFight('u305-refuse', { playerCell: { cx: 0, cy: 5 }, enemyCells: [{ cx: 8, cy: 5 }] });
  const out = resolveEscapeCombatTurn(w, 'move west');
  assert.deepEqual(out.world.combat.playerCell, { cx: 0, cy: 5 }, 'the mini did not move');
  assert.match(moveBeat(out.result), /no room/i, 'refused in fiction');
  assert.equal(/\d/.test(moveBeat(out.result)), false, 'no numbers');
});

test('U305-15: a spatial move never leaks a coordinate pair into the prose', () => {
  for (const cmd of ['charge the captain', 'fall back', 'move north', 'circle to its flank']) {
    const w = pinnedFight(`u305-leak-${cmd}`, { playerCell: { cx: 4, cy: 5 }, enemyCells: [{ cx: 8, cy: 5 }] });
    const out = resolveEscapeCombatTurn(w, cmd);
    assert.equal(hasCoordLeak(out.result.combatSummary), false, `${cmd}: no coord pair in prose`);
  }
});

// ── 4: determinism under replay ───────────────────────────────────────────────

test('U305-16: same seed + same spoken move sequence → identical worldHash', () => {
  const run = () => {
    let w = pinnedFight('u305-det', { playerCell: { cx: 1, cy: 5 }, enemyCells: [{ cx: 9, cy: 5 }] });
    w = resolveEscapeCombatTurn(w, 'charge the captain').world;
    w = resolveEscapeCombatTurn(w, 'move north').world;
    w = resolveEscapeCombatTurn(w, 'circle to its flank').world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});
