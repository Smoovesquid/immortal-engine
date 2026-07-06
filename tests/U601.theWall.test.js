// U601 — DEATH-2: THE WALL. docs/DEATH_CONTRACT.md §6 (the determinism floor) + the
// packet's riskiest bit (the dyingEnabled FLIP).
//
//   (I)   DETERMINISM ×2 PER VERB — a full beg→verb fight for EACH of the four verbs replays
//         byte-identical (world hash AND death facts AND deeds) across two independent runs and
//         a serialize round-trip. Same seed + same transcript ⇒ byte-identical (the floor).
//   (II)  THE dyingEnabled REGRESSION — the flip is the packet's riskiest bit. With the gate ON
//         (the live default now), the OLD kill paths STILL RESOLVE: a beast dies outright and the
//         fight ends in victory exactly as before; a communicator now goes DOWNED then is finished
//         by a verb, and STILL ends dead with a death fact + kill credit. The full pre-DEATH-2
//         combat suite stays green (asserted by the whole `node --test` run; here we prove the
//         behavioral contract directly).
//   (III) ZERO NUMERICS RUN-WIDE — no digit appears in ANY player-facing string this packet adds
//         (the beg, the four verb beats, the pending re-surface) across every verb (invariant III).
//   (IV)  THE BOOT ANCHOR IS UNTOUCHED — the beg/verb state is combat-scoped (absent from a boot),
//         so the boot worldHash is byte-identical run-to-run (U454-E's pinned anchor does not move;
//         this file proves the packet's OWN claim — self-equality + absence — not the literal).
//
// Seam: engine/combat/{downedResolve,escapeCombat}.js + engine/state.js + playloop's gate.
// LLM-off, deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { activeCombatWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { findDeathFacts } from '../engine/combat/deathFact.js';

// A full beg→verb fight: corner a fixture communicator to DOWNED, then answer with `verbText`.
// Returns the resolved world (post-verb). Deterministic given (seed, verbText).
function begVerbFight(seed, verbText) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, name: 'Brigand', hp: 1, ac: 1, maxHp: 20 }));
  let w = ensureWorld({ ...base, meta: { ...base.meta, seed, mode: 'escape' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
  w = resolveEscapeCombatTurn(w, 'strike').world;   // → DOWNED + beg
  return playerMove(w, PACKS, verbText).world;       // → the verb resolves
}

const VERBS = [
  ['mercy', 'I give him a clean, merciful death'],
  ['worse', 'I make an example of him — slow and cruel'],
  ['spare', 'I bind his wounds and let him live'],
  ['walk', 'I turn my back and walk away'],
];

test('U601-01: determinism ×2 per verb — byte-identical world hash + facts + deeds, plus a round-trip', () => {
  for (const [label, verbText] of VERBS) {
    const a = begVerbFight('aldermere', verbText);
    const b = begVerbFight('aldermere', verbText);
    assert.equal(worldHash(a), worldHash(b), `[${label}] same seed + transcript ⇒ identical world hash (the floor)`);
    assert.equal(JSON.stringify(findDeathFacts(a)), JSON.stringify(findDeathFacts(b)), `[${label}] identical death facts ×2`);
    assert.equal(JSON.stringify(a.deeds), JSON.stringify(b.deeds), `[${label}] identical deeds ×2`);

    // Serialize round-trip (save/load safety): JSON in/out then re-normalize → hash-stable.
    const round = ensureWorld(JSON.parse(JSON.stringify(a)));
    assert.equal(worldHash(round), worldHash(a), `[${label}] a serialize round-trip preserves the world hash`);
    assert.equal(JSON.stringify(findDeathFacts(round)), JSON.stringify(findDeathFacts(a)), `[${label}] death facts survive a round-trip byte-identical`);
    assert.equal(JSON.stringify(round.deeds), JSON.stringify(a.deeds), `[${label}] deeds survive a round-trip byte-identical`);
  }
});

test('U601-02: the dyingEnabled FLIP regression — old kill paths still resolve with the gate ON', () => {
  // A BEAST dies OUTRIGHT even with the gate on (the capability gate holds) — victory as before,
  // its death fact mints immediately, no DOWNED lingering. This is the pre-DEATH-2 clean-kill path.
  const base = activeCombatWorld();
  const beastFight = ensureWorld({
    ...base, meta: { ...base.meta, seed: 'b', mode: 'escape' },
    combat: { ...base.combat, enemies: base.combat.enemies.map(e => ({ ...e, name: 'Wolf', hp: 1, ac: 1, maxHp: 20 })), dyingEnabled: true }
  });
  const rBeast = resolveEscapeCombatTurn(beastFight, 'strike');
  assert.equal(rBeast.world.combat.enemies[0].defeated, true, 'a beast dies outright with the gate ON (no DOWNED)');
  assert.equal(rBeast.world.combat.enemies[0].downed, false, 'the speechless never enter DOWNED even with the gate ON');
  assert.match(rBeast.result.mechanicsLine, /combat:victory/, 'the fight ends in victory exactly as before');
  assert.equal(findDeathFacts(rBeast.world).length, 1, 'a real kill mints its death fact immediately');

  // A COMMUNICATOR now goes DOWNED, then a verb finishes it — and it STILL ends DEAD with kill
  // credit. The kill path resolves; it just runs through the beg + the verb now.
  const commFight = ensureWorld({
    ...base, meta: { ...base.meta, seed: 'b', mode: 'escape' },
    combat: { ...base.combat, enemies: base.combat.enemies.map(e => ({ ...e, name: 'Brigand', hp: 1, ac: 1, maxHp: 20 })), dyingEnabled: true }
  });
  const rDown = resolveEscapeCombatTurn(commFight, 'strike');
  assert.equal(rDown.world.combat.enemies[0].downed, true, 'a communicator goes DOWNED (the new path)');
  assert.match(rDown.result.mechanicsLine, /combat:victory/, 'the fight is still WON when only a DOWNED foe remains');
  const finished = playerMove(rDown.world, PACKS, 'I give him a clean death');
  assert.equal(finished.world.combat.enemies[0].defeated, true, 'the verb finishes the foe — it ends dead, as always');
  assert.equal(findDeathFacts(finished.world).length, 1, 'the finished foe mints its death fact');
  assert.ok(Number(finished.world.party[0]?.xp ?? 0) > 0, 'the kill is still credited (via the verb)');
});

test('U601-03: DEFAULT (gate OFF via fixture) — a lethal blow kills cleanly, byte-identical to pre-DEATH-2', () => {
  // A fixture that does NOT opt into dyingEnabled kills a communicator outright exactly as before —
  // the DOWNED path is dark, victory + defeated as always. This proves the flip is scoped to
  // beginCombat (the live path) and leaves the raw-fixture kill contract unchanged.
  const base = activeCombatWorld();
  // activeCombatWorld now defaults the gate ON (DEATH-2's live flip); clear it explicitly
  // to exercise the pre-DEATH-2 outright-kill contract on a raw fixture.
  const combat = { ...base.combat, enemies: base.combat.enemies.map(e => ({ ...e, name: 'Brigand', hp: 1, ac: 1, maxHp: 20 })) };
  delete combat.dyingEnabled;
  const w = ensureWorld({ ...base, meta: { ...base.meta, seed: 'b', mode: 'escape' }, combat });
  const r = resolveEscapeCombatTurn(w, 'I drive my blade into its chest.');
  const e = r.world.combat.enemies[0];
  if (e) {
    assert.equal(e.defeated, true, 'gate off: a lethal blow marks the foe defeated (corpse)');
    assert.equal(e.downed, false, 'gate off: no DOWNED — the live loop is unchanged');
  }
  assert.match(r.result.mechanicsLine, /combat:victory/, 'gate off: victory as before');
  assert.equal(findDeathFacts(r.world).length, 1, 'the death fact still mints on a real kill (DEATH-1)');
});

test('U601-04: zero numerics run-wide — no digit in any player-facing string this packet adds, every verb', () => {
  // The beg beat + each verb's beats + the death fact's human-readable fields carry NO number
  // (invariant III / hide-the-math). Swept across all four verbs.
  for (const [label, verbText] of VERBS) {
    const base = activeCombatWorld();
    const enemies = base.combat.enemies.map(e => ({ ...e, name: 'Brigand', hp: 1, ac: 1, maxHp: 20 }));
    let w = ensureWorld({ ...base, meta: { ...base.meta, seed: 'aldermere', mode: 'escape' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
    const rDown = resolveEscapeCombatTurn(w, 'strike');

    // The BEG beat (the plea line) — number-free.
    const begBeat = rDown.result.beats.find(b => /yield|please|make it quick|not beg/i.test(b));
    assert.ok(begBeat, `[${label}] a beg was voiced`);
    assert.doesNotMatch(begBeat, /\d/, `[${label}] the beg carries no number: "${begBeat}"`);

    // The VERB beats — number-free.
    const verbOut = playerMove(rDown.world, PACKS, verbText);
    for (const b of (verbOut.output.beats || [])) {
      assert.doesNotMatch(String(b), /\d/, `[${label}] a verb beat must carry no number: "${b}"`);
    }
    // The verb NARRATION (what the player reads) — number-free.
    assert.doesNotMatch(String(verbOut.output.narration || ''), /\d/, `[${label}] the verb narration must carry no number`);

    // The death fact's human-readable fields (for the lethal verbs) — number-free.
    const f = findDeathFacts(verbOut.world)[0];
    if (f) {
      const strings = [f.victim.name, f.killer.name, f.means.name, f.means.type, f.locale.label, f.light.band, f.weather, f.victimStance, f.killerIntent, String(f.begged ?? '')];
      for (const s of strings) assert.doesNotMatch(String(s), /\d/, `[${label}] a fact string must carry no number: "${s}"`);
    }
  }
});

test('U601-05: the boot anchor is untouched — the beg/verb state is combat-scoped, boot hash unmoved', () => {
  // DEATH-2 adds combat-scoped enemy fields (begged/spared/betrayed) — absent from a boot (combat
  // inactive with enemies:[]), so the boot worldHash cannot move. This proves the packet's OWN
  // claim (self-equality + absence), NOT U454-E's literal (which stays that test's alone).
  function boot() {
    const w = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
    return beginAdventure(w, PACKS).world;
  }
  const a = boot(), b = boot();
  assert.equal(worldHash(a), worldHash(b), 'the tallow boot is byte-identical to itself (no DEATH-2 nondeterminism)');
  assert.deepEqual(a.combat.enemies, [], 'boot combat has no enemies (so no begged/spared/betrayed in the boot)');
  assert.equal(Object.prototype.hasOwnProperty.call(a.combat, 'dyingEnabled'), false, 'the dying gate is omitted from an inactive boot combat (boot hash unmoved)');
  assert.equal(findDeathFacts(a).length, 0, 'a fresh boot mints no death facts');
});
