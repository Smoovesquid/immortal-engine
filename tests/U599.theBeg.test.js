// U599 — DEATH-2: THE BEG. docs/DEATH_CONTRACT.md §3 (the beg) + §6 falsifiers.
//
// The beg algebra — the engine CHOOSES the plea (invariant III: the engine owns the
// magnitude; the LLM only voices it):
//   (I)   CAPABILITY GATE — a creature that cannot communicate NEVER begs (§6 falsifier,
//         verbatim). chooseBeg returns null for the speechless; only a communicator gets a plea.
//   (II)  TWO PLEA TYPES + DEFIANCE, SEEDED-DETERMINISTIC — for life / for a quick death,
//         and the proud stay defiant (a refusal is an answer). Personality-driven
//         (self-preservation the load-bearing axis) and SEEDED: same (world, foe) ⇒ same plea.
//   (III) THE PROUD NEVER BEG (for life) — a low-self-preservation foe answers with defiance
//         or, when it breaks, a quick death; it never begs for its life.
//   (IV)  THE DYING CLOCK runs and finishes on walk-away (the foe left to the clock dies —
//         DEATH-1's clock is what makes abandonment a real death, resolved by DEATH-2's walk verb).
//
// Seam: engine/combat/downedResolve.js (chooseBeg, begPleaLine) + the escapeCombat beg wiring.
// LLM-off, deterministic (the beg VOICE here is the template fallback — no model in the loop).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { playerMove } from '../engine/playloop.js';
import { chooseBeg, begPleaLine, PLEA_TYPES } from '../engine/combat/downedResolve.js';
import { canCommunicate } from '../engine/combat/deathFact.js';
import { findDeathFacts } from '../engine/combat/deathFact.js';

// A world with one node the foe can be witnessed at, and a chosen seed.
function world(seed = 'aldermere') {
  return {
    meta: { seed, mode: 'escape' },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { name: 'Crowfoot Camp', npcs: [{ id: 'w1' }] } }] },
    party: [{ id: 'party', name: 'Korrin' }],
    timeline: []
  };
}
const enemy = (over = {}) => ({ id: 'enemy_0', name: 'Brigand', sourceNpcId: '', damageType: 'slashing', woundLog: [], ...over });

// Drive a lethal blow to DOWNED against a fixture foe with the dying gate ON.
function fightToDowned({ seed = 'aldermere', name = 'Brigand' } = {}) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, name, hp: 1, ac: 1, maxHp: 20 }));
  const w = ensureWorld({ ...base, meta: { ...base.meta, seed, mode: 'escape' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
  return resolveEscapeCombatTurn(w, 'strike');
}

test('U599-01: the speechless NEVER beg — chooseBeg returns null for a non-communicator (§6 falsifier)', () => {
  const w = world();
  // A beast cannot plead. canCommunicate is false → chooseBeg is null, for every seed.
  const wolf = enemy({ name: 'Wolf' });
  assert.equal(canCommunicate(wolf), false, 'a Wolf cannot communicate');
  assert.equal(chooseBeg(w, wolf), null, 'the speechless never beg (the falsifier, verbatim)');
  // Across several seeds it stays null (no seed ever coaxes a beg from a beast).
  for (const s of ['a', 'b', 'c', 'aldermere', 'zzz']) {
    assert.equal(chooseBeg(world(s), enemy({ name: 'Owlbear' })), null, `no beg from a beast under seed ${s}`);
  }
  // And a communicator always gets a real plea (never null).
  const plea = chooseBeg(w, enemy());
  assert.ok(PLEA_TYPES.includes(plea), `a communicator gets one of the plea types, got: ${plea}`);
});

test('U599-02: two plea types + defiance, all seeded-deterministic (same world+foe ⇒ same plea)', () => {
  // The identical (world, foe) yields the identical plea, twice — the determinism floor for the beg.
  const w = world('aldermere');
  const a = chooseBeg(w, enemy({ id: 'enemy_0' }));
  const b = chooseBeg(world('aldermere'), enemy({ id: 'enemy_0' }));
  assert.equal(a, b, 'the beg is deterministic under the same seed');

  // Across a spread of seeds we see BOTH real plea types AND defiance appear (the choice is
  // genuinely varied, not a constant). Sweep seeds and collect the pleas a mixed set of foes give.
  const seen = new Set();
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'seed1', 'seed2', 'kestrel', 'aldermere']) {
    for (const nm of ['Brigand', 'Bandit Captain', 'Cultist', 'Zealot', 'Conscript', 'Deserter']) {
      const p = chooseBeg(world(s), enemy({ name: nm }));
      if (p) seen.add(p);
    }
  }
  assert.ok(seen.has('life'), 'some foes beg for LIFE');
  assert.ok(seen.has('quick'), 'some foes beg for a QUICK death');
  assert.ok(seen.has('defiant'), 'some proud foes are DEFIANT (a refusal is an answer)');
});

test('U599-03: the proud never beg for their life — high self-preservation begs for life, low goes defiant/quick', () => {
  // Inject a source NPC with an explicit personality so self-preservation is the arbiter (not the
  // name heuristic). A high-self-preservation foe begs for LIFE; a low one is defiant or asks for a
  // quick death — but NEVER begs for life. Swept across seeds to prove the axis governs, not luck.
  function withPersona(selfPreservation) {
    return {
      meta: { seed: 'x', mode: 'escape' },
      map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [{ id: 'src', personality: { selfPreservation, honesty: 0.5 } }] } }] },
      party: [{ id: 'party' }], timeline: []
    };
  }
  const timid = enemy({ sourceNpcId: 'src', name: 'Nameless' });
  // High self-preservation (0.9): begs for life across seeds (almost always; never defiant).
  let lifeCount = 0, total = 0;
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
    const w = { ...withPersona(0.9), meta: { seed: s, mode: 'escape' } };
    const p = chooseBeg(w, timid);
    assert.notEqual(p, 'defiant', `a self-preserving foe is never defiant (seed ${s})`);
    if (p === 'life') lifeCount++;
    total++;
  }
  assert.ok(lifeCount >= total * 0.7, `the self-preserving mostly beg for life (${lifeCount}/${total})`);

  // Low self-preservation (0.1 — the proud): NEVER begs for life; defiant or quick only.
  const proud = enemy({ sourceNpcId: 'srcProud', name: 'Nameless' });
  function withProud(sp) {
    return { meta: { seed: 'x', mode: 'escape' }, map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [{ id: 'srcProud', personality: { selfPreservation: sp, honesty: 0.5 } }] } }] }, party: [{ id: 'party' }], timeline: [] };
  }
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
    const w = { ...withProud(0.1), meta: { seed: s, mode: 'escape' } };
    const p = chooseBeg(w, proud);
    assert.notEqual(p, 'life', `the proud NEVER beg for their life (seed ${s}, got ${p})`);
    assert.ok(p === 'defiant' || p === 'quick', `the proud answer with defiance or a quick death (seed ${s})`);
  }
});

test('U599-04: the beg fires at the DOWNED moment and its plea is voiced (LLM-off template), number-free', () => {
  const r = fightToDowned();
  const foe = r.world.combat.enemies[0];
  assert.equal(foe.downed, true, 'the communicator is DOWNED (dying), not defeated');
  assert.ok(PLEA_TYPES.includes(foe.begged), `the engine stamped a plea on the foe: ${foe.begged}`);
  // A beat voices the plea (the template fallback — no model in this test).
  const begBeat = r.result.beats.find(b => /yield|please|make it quick|not beg/i.test(b));
  assert.ok(begBeat, 'the beg is voiced in a beat');
  assert.doesNotMatch(begBeat, /\d/, `the beg carries no number (invariant III): "${begBeat}"`);
  // The template line matches the chosen plea type.
  const line = begPleaLine(foe.begged, foe.name);
  assert.ok(line.length > 0 && !/\d/.test(line), 'the plea line is number-free');
});

test('U599-05: the dying clock runs, and walking away lets it finish (the foe dies)', () => {
  // Corner a foe to DOWNED (the clock is running — DEATH-1 set dyingClock > 0), then WALK AWAY.
  // The abandonment verb leaves it to the clock; the foe dies (a death fact mints), and it is
  // marked defeated (the clock finished it). This is the clock "finishing on walk-away" (§3/§6).
  const r = fightToDowned();
  assert.ok(r.world.combat.enemies[0].dyingClock > 0, 'the dying clock is running on the DOWNED foe');
  const after = playerMove(r.world, PACKS, 'I turn my back and walk away');
  assert.equal(after.world.combat.enemies[0].defeated, true, 'the clock finished the abandoned foe — it is dead');
  assert.equal(findDeathFacts(after.world).length, 1, 'the death (by the clock) mints its fact');
  // The abandonment is a real, recorded deed of its own kind.
  assert.ok((after.world.deeds || []).some(d => d.kind === 'abandonment'), 'walking away records an abandonment deed');
});
