// U597 — DEATH-1: the DOWNED/dying state + THE ensureCombat WHITELIST TRAP.
// docs/DEATH_CONTRACT.md §3 (the DYING state), bit DX-2d-i (the whitelist).
//
//   (I)   a COMMUNICATOR felled at 0 HP enters DOWNED (dying) — not defeated — deterministically,
//         with the engine-owned dying clock set; it is NOT dead, so no death fact mints yet
//         (the finishing verb is DEATH-2). `defeated` stays FALSE (orthogonal to DOWNED — the
//         combat_one_defeated golden ties the corpse mini to `defeated`, so a DOWNED foe is a live
//         mini).
//   (II)  the SPEECHLESS (a beast) die OUTRIGHT even with the dying gate on — capability-gated:
//         a creature that cannot communicate never enters DOWNED (the §6 falsifier's state side).
//   (III) THE WHITELIST TRAP: the new enemy fields (downed / dyingClock / woundLog / canCommunicate)
//         SURVIVE an ensureCombat round-trip. This is the exact class of bug that silently stripped
//         mintEnemyFromNpc's stats/level — a field not in the ensureCombat literal is dropped.
//   (IV)  DEATH-1 default (gate OFF): a felled communicator dies outright exactly as before — the
//         shippable loop and the corpse-swap are byte-identical to pre-DEATH-1.
//
// Seam: engine/combat/escapeCombat.js + engine/state.js (ensureCombat). LLM-off, deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { findDeathFacts, canCommunicate } from '../engine/combat/deathFact.js';

// The dying gate is combat-scoped (default off). A fixture opts in via combat.dyingEnabled.
function fight({ seed = 'b', name = undefined, hp = 4, dyingEnabled = false } = {}) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, hp, ac: 1, maxHp: 20, ...(name ? { name } : {}) }));
  return ensureWorld({ ...base, meta: { ...base.meta, seed }, combat: { ...base.combat, enemies, ...(dyingEnabled ? { dyingEnabled: true } : {}) } });
}
const foe = (w) => w.combat?.enemies?.[0];

test('U597-01: a communicator at 0 HP enters DOWNED (dying), not dead — deterministically', () => {
  const w0 = fight({ dyingEnabled: true });
  assert.equal(canCommunicate(foe(w0)), true, 'the fixture foe is a communicator (it can plead)');
  const r = resolveEscapeCombatTurn(w0, 'strike');
  const e = foe(r.world);
  assert.equal(e.hp, 0, 'the blow took it to 0 HP');
  assert.equal(e.downed, true, 'a communicator at 0 HP is DOWNED (dying)');
  assert.equal(e.defeated, false, 'DOWNED is orthogonal to defeated — it is NOT a corpse');
  assert.ok(e.dyingClock > 0, 'the engine-owned dying clock is running');
  assert.equal(findDeathFacts(r.world).length, 0, 'DOWNED is not death — no death fact yet (DEATH-2 finishes it)');

  // Deterministic: the identical fight yields the identical DOWNED state.
  const r2 = resolveEscapeCombatTurn(fight({ dyingEnabled: true }), 'strike');
  assert.equal(foe(r2.world).downed, true);
  assert.equal(foe(r2.world).dyingClock, e.dyingClock, 'the dying clock is deterministic');
});

test('U597-02: the speechless die outright even with the dying gate ON (capability gate)', () => {
  const r = resolveEscapeCombatTurn(fight({ name: 'Wolf', dyingEnabled: true }), 'strike');
  const e = foe(r.world);
  assert.equal(canCommunicate({ name: 'Wolf' }), false, 'a Wolf cannot communicate');
  assert.equal(e.defeated, true, 'a beast dies outright — it cannot plead, so no DOWNED');
  assert.equal(e.downed, false, 'the speechless never enter DOWNED (the §6 falsifier state side)');
  assert.equal(findDeathFacts(r.world).length, 1, 'a real death mints its fact immediately');
});

test('U597-03: THE WHITELIST TRAP — the new enemy fields survive an ensureCombat round-trip', () => {
  // Drive a foe into DOWNED, then re-normalize the whole world. The DOWNED enemy fields must
  // persist — if any were missing from the ensureCombat literal they would be silently stripped
  // here (the exact class of bug that dropped mintEnemyFromNpc's stats/level). The DOWNED foe is
  // preserved in the enemies array across endCombat, so this exercises the enemy-field whitelist.
  const r = resolveEscapeCombatTurn(fight({ dyingEnabled: true }), 'strike');
  const before = foe(r.world);
  assert.equal(before.downed, true);

  const w2 = ensureWorld(r.world);           // the exact re-normalization that strips non-whitelisted fields
  const after = foe(w2);
  assert.equal(after.downed, true, 'downed survives ensureCombat');
  assert.equal(after.dyingClock, before.dyingClock, 'dyingClock survives ensureCombat');
  assert.ok(Array.isArray(after.woundLog) && after.woundLog.length >= 1, 'woundLog survives ensureCombat');
  // And an explicit canCommunicate on the enemy survives when set.
  const withCap = ensureWorld({ ...r.world, combat: { ...r.world.combat, enemies: r.world.combat.enemies.map(e => ({ ...e, canCommunicate: true })) } });
  assert.equal(foe(withCap).canCommunicate, true, 'an explicit canCommunicate survives ensureCombat');

  // The combat-LEVEL dying gate survives ensureCombat while the fight is ACTIVE (it is spent when
  // the fight ends, like `surprised`). Assert it on a live combat object directly.
  const activeBase = activeCombatWorld();
  const active = ensureWorld({ ...activeBase, combat: { ...activeBase.combat, active: true, dyingEnabled: true } });
  assert.equal(Boolean(active.combat.dyingEnabled), true, 'the combat-level dyingEnabled flag survives ensureCombat during an active fight');
  // And it is OMITTED from an inactive combat object (so the boot worldHash cannot move — U598).
  const inactive = ensureWorld({ ...activeBase, combat: { ...activeBase.combat, active: false } });
  assert.equal(Object.prototype.hasOwnProperty.call(inactive.combat, 'dyingEnabled'), false, 'dyingEnabled is omitted when off — boot combat stays byte-identical');
});

test('U597-04: DEATH-1 default (gate OFF) — a felled communicator dies outright, byte-identical to before', () => {
  // With the gate off (the DEATH-1 live default), the communicator dies exactly as it always has:
  // defeated true, combat ends in victory, the corpse-swap boolean set. The DOWNED path is dark.
  const r = resolveEscapeCombatTurn(fight({ dyingEnabled: false }), 'I drive my blade into its chest.');
  const e = foe(r.world);
  if (e) {
    assert.equal(e.defeated, true, 'default: a lethal blow marks the foe defeated (corpse)');
    assert.equal(e.downed, false, 'default: no DOWNED — the live loop is unchanged');
  }
  assert.equal(r.world.combat?.active, false, 'default: the fight ends on the kill');
  assert.match(r.result.mechanicsLine, /combat:victory/, 'default: victory as before');
  // The DEATH FACT (invariant I) still mints on the kill — the fact is live regardless of the gate.
  assert.equal(findDeathFacts(r.world).length, 1, 'the death fact mints on a real kill even with DOWNED dark');
});

test('U597-05: a DOWNED foe is inert — it does not block victory and does not get a turn', () => {
  // A lone communicator driven to DOWNED ends the fight (won), but is NOT looted/credited as a kill
  // yet (that is DEATH-2's finishing verb). The DOWNED foe persists for DEATH-2 to pick up.
  const r = resolveEscapeCombatTurn(fight({ dyingEnabled: true }), 'strike');
  assert.equal(r.world.combat?.active, false, 'the fight is won when only a DOWNED foe remains');
  assert.equal(r.result.outcome, 'success', 'the player has won');
  const e = foe(r.world);
  assert.equal(e.downed, true, 'the DOWNED foe persists into the ended combat (for DEATH-2)');
  // No death fact = no premature kill credit; the beat reads the DOWNED moment, not "the way is clear".
  assert.equal(findDeathFacts(r.world).length, 0, 'no kill credited while the foe is merely dying');
  assert.ok(r.result.beats.some(b => /down but not dead|goes down|in your hands/i.test(b)), 'the beat names the DOWNED moment');
});
