// U713 — DEATH-TRUTH-1c: the board origin survives BOTH whitelists.
//
// THE TRAP, for the fourth time. A combat field that is not named in a literal
// EVAPORATES silently. It has eaten `traits` (DX-2d-i), `stats` (ENSURE-STATS-1),
// and `worldPos` (DEATH-TRUTH-1). There are TWO of these gates, not one, and the
// brief for this packet only warned about the first:
//
//   1. engine/state.js ensureCombat — rebuilds every enemy AND the combat object
//      from a field literal on EVERY ensureWorld() call;
//   2. engine/effectsCore.js combatState — rebuilds the combat object from its own
//      `merged` literal BEFORE ensureCombat ever sees it. (This one is easy to miss;
//      the first cut of this packet set the origin correctly in beginCombat and read
//      `undefined` one tick later. Only `dyingEnabled`'s comment documents it.)
//
// A field must clear BOTH or the board silently loses its world address and every
// ambush corpse degrades to node-level truth — with the suite still green, which is
// exactly how b167 shipped wrong.
//
// Also pinned here: the origin is ADDITIVE. It appears only when real, so the boot
// world (which has no combat) is byte-identical and the boot worldHash does not move
// — no WORLD_VERSION bump.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../engine/effectsCore.js';
import * as grid from '../engine/combat/grid.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const boot = (seed = 'loaderDemo') => beginAdventure(newWorld({ seed, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const say = (w, t) => playerMove(w, PACKS, t).world;
const wolf = () => ({ name: 'Dire Wolf', hp: 10, maxHp: 10, damage: '1d6', ac: 12, cr: 1 });

function ambushWorld() {
  let w = boot();
  w = say(w, 'I go outside.');
  const b = beginCombat(w, { enemies: [wolf()], reason: 'ambush' });
  assert.equal(b.combat?.active, true, 'setup: combat must be live');
  assert.ok(b.combat.origin, 'setup: the fight must carry a board origin to test the carry');
  return b;
}

// ── A. WHITELIST 1 — ensureCombat (state.js) ─────────────────────────────────
test('U713-A the origin survives ensureWorld() — the ensureCombat whitelist', () => {
  const w = ambushWorld();
  const before = { ...w.combat.origin };
  const after = ensureWorld(w);
  assert.deepEqual(after.combat.origin, before,
    'ensureWorld must not evaporate the origin (the traits/stats/worldPos trap)');

  // Idempotent under repeated normalization — the real failure mode is a field that
  // survives once and dies on the second pass.
  assert.deepEqual(ensureWorld(ensureWorld(after)).combat.origin, before,
    'the origin is stable across repeated ensureWorld calls');
});

// ── B. WHITELIST 2 — the combatState merge (effectsCore.js) ──────────────────
test('U713-B the origin survives a mid-fight combatState delta — the effectsCore merge', () => {
  const w = ambushWorld();
  const before = { ...w.combat.origin };

  // A routine mid-fight update that does NOT mention origin. Under the unfixed
  // merge this silently dropped it and the board lost its world address.
  const next = applyDeltas(w, [{ op: 'combatState', set: { round: 2, turnIndex: 1 } }]);
  assert.equal(next.combat.round, 2, 'setup: the delta must actually have applied');
  assert.deepEqual(next.combat.origin, before,
    'a combatState delta that never mentions the origin must PRESERVE it');
});

// ── C. THE FULL LIVE LOOP — the carry holds turn after turn ──────────────────
test('U713-C the origin holds across real turns of a live fight', () => {
  let w = ambushWorld();
  const before = { ...w.combat.origin };
  for (let i = 0; i < 3 && w.combat?.active; i++) w = say(w, 'I strike the wolf.');
  assert.ok(w.combat?.origin, 'the board still has its world address after real turns');
  assert.deepEqual(w.combat.origin, before, 'and it is the SAME address — the board never drifts mid-fight');
});

// ── D. SAVE / LOAD — the origin round-trips ──────────────────────────────────
test('U713-D the origin survives export → import (no save-format change needed)', () => {
  const w = ambushWorld();
  const back = importWorld(exportWorld(w));
  const rw = back.world || back;
  assert.deepEqual(rw.combat.origin, w.combat.origin,
    'a saved fight reloads with its board still anchored');
});

// ── E. ADDITIVE — the boot world never gains the key ─────────────────────────
test('U713-E the origin is additive: the boot world is untouched and its hash does not move', () => {
  const w = boot();
  assert.equal(w.combat?.active, false, 'setup: the boot world has no live combat');
  assert.ok(!('origin' in (w.combat || {})),
    'the boot combat object never gains an origin key — additive, so the boot worldHash cannot move');
  assert.equal(
    worldHash(w),
    '8e5992e4da1945ce4e3f7b3879a93ffeaeb9042a19882d6aa07ed8e87658fe9d',
    'the boot worldHash is byte-identical to 3be46b13 — no WORLD_VERSION bump, no save migration'
  );
});

// ── F. THE PIN IS ALWAYS AVAILABLE TO A LIVE FIGHT ───────────────────────────
// Written after this test's first draft asserted the opposite and failed honestly.
// The draft assumed a fight could begin with no canonical player pos and degrade to
// no origin. It cannot: ensureWorld BACKFILLS the party's pos (POSITION_AS_CANON —
// backfillTacticalPositions; invariants.js then asserts it), so stripping party[0].pos
// and re-normalizing simply mints a fresh canonical one. Verified 2026-07-16: pos
// (-806,-390) stripped → ensureWorld returns (-841,-374), never null.
//
// So the honest claim is the STRONGER one: every live fight can be pinned, therefore
// no live fight degrades and no ambush corpse falls back to node-level truth. The
// null/degrade branches are real defensive code and are unit-covered in U711-E; this
// pins the production guarantee.
test('U713-F every live fight gets a real origin — the pin is never unavailable in practice', () => {
  let w = boot();
  w = say(w, 'I go outside.');
  const stripped = ensureWorld({ ...w, party: w.party.map((p, i) => i === 0 ? { ...p, pos: null } : p) });
  assert.ok(stripped.party[0].pos, 'ensureWorld backfills a canonical pos — the pin is always there');

  const b = beginCombat(stripped, { enemies: [wolf()], reason: 'ambush' });
  assert.equal(b.combat?.active, true, 'setup: combat begins');
  assert.ok(b.combat.origin, 'the board is anchored, because the player always has a canonical pos to anchor to');

  // And the anchor is that backfilled pos, not a leftover of the stripped one.
  const { boardCellToWorldPos } = grid;
  assert.deepEqual(boardCellToWorldPos(b.combat.origin, b.combat.playerCell),
    { frame: stripped.party[0].pos.frame, gx: stripped.party[0].pos.gx, gy: stripped.party[0].pos.gy },
    'the pin tracks the CURRENT canonical pos');
});
