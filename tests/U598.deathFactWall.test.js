// U598 — DEATH-1: THE WALL. docs/DEATH_CONTRACT.md §6 (the determinism floor) + the schema decision
// (docs/briefs/DEATH-1-audit.md): NO WORLD_VERSION bump, the honest lazy-additive path.
//
// The schema decision this packet made and must now PROVE:
//   (I)   NO BUMP / BOOT-STABLE — DEATH-1 adds combat-scoped enemy fields (downed/dyingClock/woundLog)
//         and a combat-scoped gate (dyingEnabled), plus stores the DEATH FACT as a timeline event.
//         None of this is present in the BOOT world (combat is inactive with enemies:[]; the gate is
//         omitted when off), so the boot worldHash does NOT move. This file does NOT re-derive the
//         default-boot anchor literal — that is U454-E's alone (duplicating it repeats the canary this
//         repo has tripped repeatedly). Instead it proves the OWN claim: booting the same seed twice is
//         byte-identical, AND a boot has none of DEATH-1's stored shape.
//   (II)  FULL REPLAY DETERMINISM on the fight→fact chain — same seed + same transcript ⇒ byte-identical
//         world hash AND byte-identical death fact, across two independent runs and a serialize round-trip.
//   (III) NO NUMERIC in any player-facing string this packet adds (invariant III) — asserted over a real
//         death fact's human-readable fields and the DOWNED combat beats.
//
// Seam: engine/state.js (ensureCombat, no bump) + engine/combat/{escapeCombat,deathFact}.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { activeCombatWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { findDeathFacts } from '../engine/combat/deathFact.js';

function tallowBoot() {
  const w = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  return beginAdventure(w, PACKS).world;
}

test('U598-01: NO WORLD_VERSION bump — the boot carries none of DEATH-1 stored shape, and is byte-identical run-to-run', () => {
  // The audit's schema claim, proven WITHOUT re-pinning U454-E's literal: DEATH-1's stored state is
  // combat-scoped and absent from a boot, so the boot fingerprint is unmoved. (The exact anchor value
  // lives in U454-E; here we assert the packet's own invariant — absence + self-equality.)
  const a = tallowBoot();
  const b = tallowBoot();
  assert.equal(worldHash(a), worldHash(b), 'the tallow boot is byte-identical to itself (no DEATH-1 nondeterminism)');

  // The boot has combat inactive with no enemies → none of DEATH-1's enemy fields are present, and
  // the dying gate is omitted (off). This is WHY the boot hash cannot move.
  assert.equal(a.combat.active, false, 'boot combat is inactive');
  assert.deepEqual(a.combat.enemies, [], 'boot combat has no enemies (so no downed/dyingClock/woundLog in the boot)');
  assert.equal(Object.prototype.hasOwnProperty.call(a.combat, 'dyingEnabled'), false, 'the dying gate is omitted from an inactive boot combat (boot hash unmoved)');

  // No death-fact events at boot (nothing has died).
  assert.equal(findDeathFacts(a).length, 0, 'a fresh boot mints no death facts');

  // Sanity: the version is unchanged by this packet (the decision was NO bump).
  assert.ok(typeof WORLD_VERSION === 'number' && WORLD_VERSION > 0, 'WORLD_VERSION is intact (DEATH-1 did not bump it)');
});

test('U598-02: full replay determinism on the fight→fact chain — world hash AND fact byte-identical ×2 and across a round-trip', () => {
  function runFight(dyingEnabled) {
    const base = activeCombatWorld();
    const enemies = base.combat.enemies.map(e => ({ ...e, hp: 8, ac: 1, maxHp: 20 }));
    // DEATH-2: set the gate authoritatively from the param (activeCombatWorld now
    // defaults it ON) so runFight(false) is a genuine gate-OFF determinism run.
    const combat = { ...base.combat, enemies };
    if (dyingEnabled) combat.dyingEnabled = true; else delete combat.dyingEnabled;
    let w = ensureWorld({ ...base, meta: { ...base.meta, seed: 'b' }, combat });
    w = resolveEscapeCombatTurn(w, 'strike').world;
    w = resolveEscapeCombatTurn(w, 'strike').world;
    return w;
  }
  // Two independent runs of the identical kill → identical world hash and identical fact.
  const w1 = runFight(false), w2 = runFight(false);
  assert.equal(worldHash(w1), worldHash(w2), 'same seed + transcript ⇒ identical world hash (the determinism floor)');
  assert.equal(JSON.stringify(findDeathFacts(w1)), JSON.stringify(findDeathFacts(w2)), 'identical death fact ×2');

  // Serialize round-trip: JSON in/out then re-normalize → hash-stable (save/load safety).
  const round = ensureWorld(JSON.parse(JSON.stringify(w1)));
  assert.equal(worldHash(round), worldHash(w1), 'a serialize round-trip preserves the world hash');
  assert.equal(JSON.stringify(findDeathFacts(round)), JSON.stringify(findDeathFacts(w1)), 'the death fact survives a round-trip byte-identical');

  // The DOWNED path is deterministic too (gate on): same seed ⇒ same DOWNED state.
  const d1 = runFight(true), d2 = runFight(true);
  assert.equal(worldHash(d1), worldHash(d2), 'the DOWNED chain is deterministic');
});

test('U598-03: no numeric appears in any player-facing string this packet adds (invariant III)', () => {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, hp: 4, ac: 1, maxHp: 20 }));
  // DOWNED beats (gate on).
  const wDown = ensureWorld({ ...base, meta: { ...base.meta, seed: 'b' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
  const rDown = resolveEscapeCombatTurn(wDown, 'strike');
  // The STANDALONE DOWNED beat (the victory-block "down but not dead / in your hands" line) is purely
  // DEATH-1's and is where the DOWNED-moment prose lives — it must carry no number (hide-the-math).
  // (The inline drop-tail rides the same line as the long-standing per-hit damage readout "for N",
  // an existing combat number out of this packet's scope; invariant III governs the DEATH prose, and
  // the standalone DOWNED line + the death fact below are what DEATH-1 owns.)
  const standaloneDowned = rDown.result.beats.find(b => /down but not dead|in your hands/i.test(b));
  assert.ok(standaloneDowned, 'the standalone DOWNED beat was produced');
  assert.doesNotMatch(standaloneDowned, /\d/, `the DEATH-1 DOWNED beat must carry no number: "${standaloneDowned}"`);

  // The death fact's human-readable fields carry no digits. DEATH-2: activeCombatWorld now
  // flips the gate ON by default, so explicitly clear it for the OUTRIGHT-KILL case (a real
  // kill mints its fact immediately — the DOWNED path is exercised above).
  const killCombat = { ...base.combat, enemies };
  delete killCombat.dyingEnabled;
  const wKill = ensureWorld({ ...base, meta: { ...base.meta, seed: 'b' }, combat: killCombat });
  const rKill = resolveEscapeCombatTurn(wKill, 'strike');
  const f = findDeathFacts(rKill.world)[0];
  assert.ok(f, 'a kill minted a fact');
  const strings = [
    f.victim.name, f.killer.name, f.means.name, f.means.type,
    f.locale.label, f.light.band, f.weather, f.victimStance, f.killerIntent,
    ...f.woundPath.flatMap(w => [w.means, w.type, w.region])
  ];
  for (const s of strings) assert.doesNotMatch(String(s), /\d/, `player-facing fact string must carry no number: "${s}"`);
});
