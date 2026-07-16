// U711 — DEATH-TRUTH-1c: the death fact records the square the victim DIED ON.
//
// THE LIE THIS CLOSES (reproduced 2026-07-16, production ambush route, 120 seeds):
// b167's `beginCombat` anchored an ambush foe at `playerPos + anchorRng.int(-3,3)`
// — a seeded guess with no relationship to the board the player was looking at. It
// agreed with that board in 0 of 120 seeds; it put the foe on the WRONG SIDE of the
// player in 80 of 120 (67%); the median divergence was 6 cells (30 m of ground);
// and on seed `scan48` it recorded the killer's OWN square — the exact substitution
// b167's own comment forbade ("NEVER the player's position").
//
// THE FIX: the board now carries a real world origin (grid.js boardOriginFrom),
// pinned at beginCombat so the player's board cell projects back to the player's
// canonical pos. Every cell then has a true world address by construction, and the
// fact records the 1:1 projection of the victim's own cell — no rng, no salt.
//
// WHY THESE ASSERTIONS LOOK PARANOID: U710-A2 asserted the death position was
// SHAPED right (integer gx/gy, frame 'region') and never that it was the VICTIM'S.
// The killer's coordinates sailed through a green suite for a whole release. A
// shape assertion is not a truth assertion. Every test below asserts the VALUE, and
// each one first proves its candidate values are genuinely DISTINCT so it cannot
// pass vacuously.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { victimWorldPos } from '../engine/combat/deathFact.js';
import { boardOriginFrom, boardCellToWorldPos } from '../engine/combat/grid.js';

const boot = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;
const wolf = () => ({ name: 'Dire Wolf', hp: 10, maxHp: 10, damage: '1d6', ac: 12, cr: 1 });

// An ambush world: player outside with a canonical pos, one bestiary foe, no npc.pos.
function ambush(seed) {
  let w = boot(seed);
  w = say(w, 'I go outside.');
  const playerPos = w.party?.[0]?.pos;
  assert.ok(playerPos && Number.isInteger(playerPos.gx), `setup(${seed}): the player must own a canonical pos`);
  const b = beginCombat(w, { enemies: [wolf()], reason: 'ambush' });
  assert.equal(b.combat?.active, true, `setup(${seed}): the ambush must actually begin combat`);
  const foe = b.combat.enemies[0];
  assert.ok(foe && Number.isInteger(foe.cx), `setup(${seed}): the foe must stand on a real board cell`);
  return { w: b, playerPos, foe, playerCell: b.combat.playerCell };
}

// ── A. THE PIN: the player's own cell projects to the player's own pos ────────
test('U711-A the board origin is pinned so the player cell projects EXACTLY to the player pos', () => {
  const { w, playerPos, playerCell } = ambush('loaderDemo');
  const origin = w.combat.origin;
  assert.ok(origin, 'the fight carries a board origin');

  const back = boardCellToWorldPos(origin, playerCell);
  assert.deepEqual(back, { frame: playerPos.frame, gx: playerPos.gx, gy: playerPos.gy },
    'projecting the player cell returns the player pos byte-for-byte — this is the pin the board hangs on');

  // Anti-vacuity: the origin must NOT itself be the player's pos (that would make
  // the round-trip trivially true for a board whose player sits at cell 0,0).
  assert.ok(playerCell.cx !== 0 || playerCell.cy !== 0,
    'setup: the player must NOT be at cell (0,0), or this round-trip proves nothing');
  assert.notDeepEqual({ gx: origin.gx, gy: origin.gy }, { gx: playerPos.gx, gy: playerPos.gy },
    'the origin is cell (0,0)\'s address, genuinely offset from the player');
});

// ── B. THE VICTIM'S SQUARE, NOT THE KILLER'S ─────────────────────────────────
test('U711-B the recorded position is the VICTIM\'s square and is never the killer\'s', () => {
  const { w, playerPos, foe } = ambush('loaderDemo');
  const rec = victimWorldPos(w, foe);
  assert.ok(rec, 'the ambush foe has a recorded position (the board gives it one)');

  // The VALUE assertion U710 never made: it is the projection of the foe's cell.
  assert.deepEqual(rec, boardCellToWorldPos(w.combat.origin, { cx: foe.cx, cy: foe.cy }),
    'the recorded pos IS the projection of the square the foe stands on');

  // Anti-vacuity: the foe's square and the killer's square must be genuinely
  // different, or "not the killer's" is a claim about nothing.
  assert.ok(foe.cx !== w.combat.playerCell.cx || foe.cy !== w.combat.playerCell.cy,
    'setup: the foe and the player must stand on DIFFERENT board cells');
  assert.notDeepEqual({ gx: rec.gx, gy: rec.gy }, { gx: playerPos.gx, gy: playerPos.gy },
    'the fact does not record the killer\'s position (the b167 defect)');
});

// ── C. THE BOARD AND THE CANON AGREE — over the seed range that convicted b167 ─
test('U711-C canon matches the board the player is looking at, on EVERY seed (b167: 0 of 120)', () => {
  let checked = 0, agreed = 0, onKillersSquare = 0, wrongSide = 0;
  for (let i = 0; i < 120; i++) {
    const seed = `scan${i}`;
    let a;
    try { a = boot(seed); a = say(a, 'I go outside.'); } catch { continue; }
    const ap = a.party?.[0]?.pos;
    if (!ap) continue;
    const b = beginCombat(a, { enemies: [wolf()], reason: 'ambush' });
    const foe = b.combat?.enemies?.[0];
    const pc = b.combat?.playerCell;
    if (!foe || !pc) continue;
    const rec = victimWorldPos(b, foe);
    assert.ok(rec, `seed ${seed}: an ambush foe on a real board must have a position`);
    checked++;
    const boardDx = foe.cx - pc.cx, boardDy = foe.cy - pc.cy;
    const canonDx = rec.gx - ap.gx, canonDy = rec.gy - ap.gy;
    // THE 1:1 CLAIM: one board cell == one region cell (UNIT-CLASH-1 — the "5-ft
    // square" is rules-flavour, so the square index carries across unconverted).
    if (boardDx === canonDx && boardDy === canonDy) agreed++;
    if (canonDx === 0 && canonDy === 0) onKillersSquare++;
    if (Math.sign(boardDx) !== Math.sign(canonDx)) wrongSide++;
  }
  // The setup must be real, or the loop proves nothing (U710-A2's early-return sin).
  assert.ok(checked >= 100, `setup: expected ~120 live ambushes to measure, got ${checked}`);
  assert.equal(agreed, checked, `canon must equal the board on every seed (b167 managed 0/120); got ${agreed}/${checked}`);
  assert.equal(onKillersSquare, 0, `no seed may record the killer's square (b167: seed scan48 did); got ${onKillersSquare}`);
  assert.equal(wrongSide, 0, `no seed may put the corpse on the wrong side of the player (b167: 80/120); got ${wrongSide}`);
});

// ── D. AN NPC KEEPS ITS OWN CANONICAL POS — the board never overrides canon ───
test('U711-D an NPC-sourced foe records its OWN roster pos, not a board projection', () => {
  let w = boot('loaderDemo');
  w = say(w, 'I go outside.');
  w = say(w, 'I attack Jorin with my blade.');
  assert.equal(w.combat?.active, true, 'setup: the assault must begin combat');
  const foe = w.combat.enemies.find(e => /jorin/i.test(String(e.name || '')));
  assert.ok(foe, 'setup: Jorin must be the foe');

  const node = w.map.nodes.find(n => String(n.id) === String(w.map.currentNodeId));
  const jorin = (node?.settlement?.npcs || []).find(n => String(n.id) === String(foe.sourceNpcId));
  assert.ok(jorin?.pos, 'setup: Jorin must own a canonical roster pos');

  const rec = victimWorldPos(w, foe);
  assert.deepEqual(rec, { frame: jorin.pos.frame, gx: jorin.pos.gx, gy: jorin.pos.gy },
    'an NPC dies at its OWN canonical position (POSITION_AS_CANON); the abstract board never overrides the roster');

  // Anti-vacuity: the roster pos and the board projection must genuinely differ,
  // or "the board did not override it" is unfalsifiable. (They do differ sharply —
  // the board seats Jorin 5 cells from the player while canon has him 37 cells
  // away. That contradiction is real and is flagged for Tim in the report; this
  // test only pins WHICH of the two the fact records.)
  const projected = boardCellToWorldPos(w.combat.origin, { cx: foe.cx, cy: foe.cy });
  assert.ok(projected, 'setup: the board must have an origin to project');
  assert.notDeepEqual({ gx: projected.gx, gy: projected.gy }, { gx: jorin.pos.gx, gy: jorin.pos.gy },
    'setup: the board projection and the roster pos must genuinely differ, or this test asserts nothing');
});

// ── E. HONEST ABSENCE — no pin, no guess ─────────────────────────────────────
test('U711-E a board with no canonical player pos yields NO origin and NO invented position', () => {
  assert.equal(boardOriginFrom(null, { cx: 3, cy: 4 }), null, 'no player pos -> no origin');
  assert.equal(boardOriginFrom({ frame: 'region', gx: 1, gy: 2 }, null), null, 'no player cell -> no origin');
  assert.equal(boardCellToWorldPos(null, { cx: 1, cy: 1 }), null, 'no origin -> no projection (never a guess)');

  // A fractional/garbage pos must not be laundered into an integer truth.
  assert.equal(boardOriginFrom({ frame: 'region', gx: 1.5, gy: 2 }, { cx: 0, cy: 0 }), null,
    'a non-integer pos is not a canonical pos');
});
