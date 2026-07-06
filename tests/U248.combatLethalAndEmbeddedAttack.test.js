// U248 — combat-truth (Opus gate 2026-06-23, Chaos-griefer / seed 'tallow'):
//   (a) a strike whose damage >= the foe's remaining HP marks it DEFEATED and
//       ends the combat thread — a lethal blow may not leave the foe "upright".
//   (b) an attack aimed at the foe must RESOLVE A ROLL and apply damage even when
//       phrased as an exit ("throw the knife into its chest and dive out the
//       window") or a wrestle ("press its face into the flames and hold it
//       there"). Pre-fix these were swallowed by the egress / self-hazard / and
//       spell-less 'hold' branches — no roll, no damage, lethal hits no-op'd.
// Seam: engine/combat/escapeCombat.js (the LIVE combat engine). LLM-off,
// deterministic via resolveEscapeCombatTurn.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';

// activeCombatWorld with the foe's hp/ac/maxHp overridden and a chosen world seed
// (the attack roll is seeded from the world seed). ac=1 + a hitting seed makes the
// player's swing land deterministically so we can assert damage/defeat, not luck.
function combat({ seed, hp, ac = 1, maxHp = 20 }) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, hp, ac, maxHp }));
  return ensureWorld({ ...base, meta: { ...base.meta, seed }, combat: { ...base.combat, enemies } });
}
function foe(world) { return world.combat?.enemies?.[0]; }

test('U248: a lethal strike (dmg >= remaining HP) marks the foe defeated and ends combat', () => {
  // seed 'b' lands a hit for 5 dmg; foe at 4 HP -> dead.
  const r = resolveEscapeCombatTurn(combat({ seed: 'b', hp: 4 }), 'I drive my blade into its chest.');
  assert.match(r.result.mechanicsLine, /\bhit\b/, `strike should land: ${r.result.mechanicsLine}`);
  assert.match(r.result.mechanicsLine, /combat:victory/, `lethal blow should end the thread: ${r.result.mechanicsLine}`);
  assert.equal(r.world.combat?.active, false, 'combat thread must be ended');
  // DEATH-2: the fixture (activeCombatWorld) now flips dyingEnabled ON (the live default),
  // so a felled COMMUNICATOR enters DOWNED (dying, begging) instead of dying outright — the
  // thread still ENDS (victory), but the foe is downed-or-defeated (the beg + the four verbs
  // finish it). The lethality intent (out of the fight, victory) is unchanged.
  const e = foe(r.world);
  if (e) assert.ok(e.downed || e.defeated, `lethal foe must be dropped (downed or defeated): ${JSON.stringify({downed:e.downed, defeated:e.defeated})}`);
});

test('U248: a non-lethal strike leaves the foe upright (no over-claim)', () => {
  // 5 dmg vs 20 HP -> still standing, combat continues.
  const r = resolveEscapeCombatTurn(combat({ seed: 'b', hp: 20 }), 'I drive my blade into its chest.');
  assert.match(r.result.mechanicsLine, /\bhit\b/);
  assert.doesNotMatch(r.result.mechanicsLine, /combat:victory/);
  assert.equal(r.world.combat?.active, true);
  assert.equal(foe(r.world).defeated, false);
  assert.ok(foe(r.world).hp < 20 && foe(r.world).hp > 0, 'damage applied but not lethal');
});

test('U248: an attack thrown at the foe during an egress resolves a roll and applies damage', () => {
  const before = 8;
  const r = resolveEscapeCombatTurn(
    combat({ seed: 'b', hp: before }),
    "I throw the knife straight into the Lingerer's chest and dive out the window."
  );
  // It must resolve as a strike (a roll), NOT a pure scene-exit and NOT a bare
  // round marker.
  assert.match(r.result.mechanicsLine, /strike:/, `embedded throw must resolve a strike: ${r.result.mechanicsLine}`);
  assert.doesNotMatch(r.result.mechanicsLine, /combat:egress/, `must not be swallowed by egress: ${r.result.mechanicsLine}`);
  assert.doesNotMatch(r.result.mechanicsLine, /^\[combat:r\d+\]$/, `must not fizzle to a bare round marker: ${r.result.mechanicsLine}`);
  assert.ok(foe(r.world).hp < before, `damage must land on the live foe: ${before} -> ${foe(r.world).hp}`);
});

test('U248: a "press its face into the flames and hold it there" pin resolves a roll, not a fizzle', () => {
  const before = 20;
  const r = resolveEscapeCombatTurn(
    combat({ seed: 'b', hp: before }),
    'I press its face down toward the flames and hold it there.'
  );
  assert.match(r.result.mechanicsLine, /strike:/, `physical pin must resolve a roll: ${r.result.mechanicsLine}`);
  assert.doesNotMatch(r.result.mechanicsLine, /^\[combat:r\d+\]$/, `must not fizzle to a bare round marker: ${r.result.mechanicsLine}`);
  assert.ok(!r.result.beats.some(b => /Nothing holds/i.test(b)), 'the spell-less "Nothing holds" fizzle must be gone');
  assert.ok(foe(r.world).hp < before, `damage must land on the foe: ${before} -> ${foe(r.world).hp}`);
});

test('U248: a lethal pin (dmg >= remaining HP) also marks the foe defeated', () => {
  const r = resolveEscapeCombatTurn(combat({ seed: 'b', hp: 4 }), 'I press its face down toward the flames and hold it there.');
  assert.match(r.result.mechanicsLine, /combat:victory/, `lethal pin should end the thread: ${r.result.mechanicsLine}`);
  assert.equal(r.world.combat?.active, false);
});

test('U248: a pure scene-exit with no foe-directed attack stays egress (no foe damage)', () => {
  const before = 8;
  const r = resolveEscapeCombatTurn(
    combat({ seed: 'b', hp: before }),
    'I kick the door open and shout for everyone to clear the street.'
  );
  assert.match(r.result.mechanicsLine, /combat:egress/, `pure exit must remain egress: ${r.result.mechanicsLine}`);
  assert.doesNotMatch(r.result.mechanicsLine, /strike:/, 'pure exit must not fabricate a strike');
  assert.equal(foe(r.world).hp, before, 'pure egress must not damage the foe');
});
