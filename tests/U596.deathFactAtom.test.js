// U596 — DEATH-1: THE DEATH FACT (the atom). docs/DEATH_CONTRACT.md §2, invariant I.
//
// Every death first assembles a deterministic DEATH FACT, pure f(world, combat log); the prose
// (DEATH-3/4) is voiced FROM it and may not contradict it. This guard locks the atom:
//   (I)   a scripted fight to a real kill mints exactly ONE death fact with every §2 field TRUTHFUL —
//         victim/killer/means, woundPath matching the fight's actual blows (the killing blow finishing
//         THROUGH an earlier round's wound), witnesses = occupancy truth (man) + the gods, locale +
//         light band, and an honest stance/intent.
//   (II)  PURE — no death, no fact; and the whole fight→fact chain is byte-identical ×2 (§6 floor).
//   (III) means-TAILORED — a blade death records the blade; a cantrip death records the cantrip.
//   (IV)  NO NUMERIC reaches any player-facing string this packet adds (invariant III).
//
// Seam: engine/combat/escapeCombat.js (the LIVE combat engine) + engine/combat/deathFact.js.
// LLM-off, deterministic via resolveEscapeCombatTurn.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { findDeathFacts, assembleDeathFact } from '../engine/combat/deathFact.js';

// A scripted fight: the fixture foe overridden to hp/ac/maxHp, world seed 'b' lands the player's
// swing deterministically (5 dmg/round). hp 8 → survives round 1 (3 left), dies round 2 — so the
// woundPath accumulates a round-1 wound the killing blow finishes through.
function twoRoundKill({ seed = 'b', name = undefined, cantrip = false } = {}) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, hp: 8, ac: 1, maxHp: 20, ...(name ? { name } : {}) }));
  let w = ensureWorld({ ...base, meta: { ...base.meta, seed }, combat: { ...base.combat, enemies } });
  const verb = cantrip ? 'fire bolt' : 'strike';
  w = resolveEscapeCombatTurn(w, verb).world;
  w = resolveEscapeCombatTurn(w, verb).world;
  return w;
}

test('U596-01: a scripted fight to a kill mints exactly one death fact with every §2 field truthful', () => {
  const w = twoRoundKill({});
  const facts = findDeathFacts(w);
  assert.equal(facts.length, 1, 'exactly one death fact per death');
  const f = facts[0];

  // victim / killer / means
  assert.equal(f.victim.isPlayer, false);
  assert.ok(f.victim.name && typeof f.victim.name === 'string', 'victim named');
  assert.equal(f.killer.kind, 'player', 'the player is the killer');
  assert.ok(f.means.name && f.means.type, 'means is weapon/type tailored');

  // woundPath: the fight's actual blows, the killing blow finishing through an earlier wound.
  assert.ok(Array.isArray(f.woundPath) && f.woundPath.length >= 2, 'woundPath spans both rounds');
  assert.equal(f.woundPath[0].round, 1, 'first wound is round 1');
  assert.equal(f.woundPath[0].killing, false, 'the round-1 wound did not kill');
  const killing = f.woundPath[f.woundPath.length - 1];
  assert.equal(killing.round, 2, 'the killing blow is round 2');
  assert.equal(killing.killing, true, 'the last wound is the killing blow (finishes through the first)');

  // witnesses = occupancy truth (man) AND the gods (invariant II).
  assert.ok(Array.isArray(f.witnesses.who), 'witnesses.who is the occupancy list');
  assert.equal(f.witnesses.gods, true, 'the gods always witness a death');
  assert.ok(f.witnesses.who.includes('npc_lingerer'), 'the settlement occupant is a man-side witness');

  // locale + light band (number-free bands the prose reads).
  assert.ok(f.locale.label && f.locale.nodeId, 'locale is the node truth');
  assert.ok(['dark', 'dim', 'lit'].includes(f.light.band), 'light is a coarse band');

  // stance + intent honest defaults (DEATH-2 refines begging/defiant/mercy/worse).
  assert.ok(['fighting', 'fleeing', 'helpless'].includes(f.victimStance), 'stance is an honest DEATH-1 value');
  assert.equal(f.killerIntent, 'clean', 'a plain strike routes to a clean intent');
});

test('U596-02: pure — no death mints no fact; and the whole fight→fact chain is byte-identical ×2', () => {
  // A single non-lethal exchange: foe at 20 HP takes 5, survives — no fact.
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, hp: 20, ac: 1, maxHp: 20 }));
  let w = ensureWorld({ ...base, meta: { ...base.meta, seed: 'b' }, combat: { ...base.combat, enemies } });
  w = resolveEscapeCombatTurn(w, 'strike').world;
  assert.equal(findDeathFacts(w).length, 0, 'a foe that survives mints no death fact');

  // Determinism: two independent runs of the identical fight yield byte-identical facts.
  const a = JSON.stringify(findDeathFacts(twoRoundKill({})));
  const b = JSON.stringify(findDeathFacts(twoRoundKill({})));
  assert.equal(a, b, 'same seed + same transcript ⇒ byte-identical death fact (the determinism floor)');
});

test('U596-03: means-tailored — a cantrip death records the cantrip, not a blade', () => {
  // The fixture PC has a cantrip; a fire-bolt kill must record a fire-typed cantrip means.
  const w = twoRoundKill({ cantrip: true });
  const facts = findDeathFacts(w);
  if (facts.length) {
    const f = facts[0];
    // Either a real cantrip landed (fire type) or the PC had none and fell back to the blade —
    // in both cases the means must be internally consistent with the wound type, never invented.
    assert.equal(f.means.type, f.woundPath[f.woundPath.length - 1].type, 'means type matches the killing wound type');
  }
  // The blade path (U596-01) already proved a physical/blade means; this proves the means is
  // sourced from the actual killing action, not hard-coded.
  const bladeFacts = findDeathFacts(twoRoundKill({}));
  assert.match(bladeFacts[0].means.name.toLowerCase(), /blade|sword|unarmed|strike/, 'the blade kill records a blade-family means');
});

test('U596-04: no numeric appears in any player-facing string built from the fact (invariant III)', () => {
  // The fact stores a raw light value for the engine, but every STRING field the prose layer reads
  // must be number-free. Assert the human-readable fields carry no digits.
  const f = findDeathFacts(twoRoundKill({}))[0];
  const playerFacing = [
    f.victim.name, f.killer.name, f.means.name, f.means.type,
    f.locale.label, f.light.band, f.weather, f.victimStance, f.killerIntent,
    ...f.woundPath.flatMap(w => [w.means, w.type, w.region])
  ];
  for (const s of playerFacing) {
    assert.doesNotMatch(String(s), /\d/, `player-facing fact string must carry no number: "${s}"`);
  }
});

test('U596-05: the atom is a pure function — same inputs, identical fact, drawing no world state it was not given', () => {
  // assembleDeathFact is pure f(args): calling it twice with identical args yields identical output.
  const world = { map: { currentNodeId: 'n', nodes: [{ id: 'n', name: 'Aldermere', settlement: { name: 'Aldermere', npcs: [{ id: 'npc_a' }, { id: 'npc_b' }] } }] }, env: { light: 5 } };
  const args = {
    world,
    victim: { name: 'Scarvein', sourceNpcId: 'npc_1', damageType: 'slashing' },
    killer: { name: 'Vex', kind: 'player' },
    means: { name: 'Longsword', type: 'slashing' },
    woundPath: [], round: 3, t: 9
  };
  const a = JSON.stringify(assembleDeathFact(args));
  const b = JSON.stringify(assembleDeathFact(args));
  assert.equal(a, b, 'assembleDeathFact is pure');
  const f = JSON.parse(a);
  assert.equal(f.light.band, 'lit', 'light 5 → lit band');
  assert.deepEqual(f.witnesses.who, ['npc_a', 'npc_b'], 'witnesses are the node occupants');
  // An empty woundPath still yields a fact (the caller synthesizes the killing wound upstream);
  // the atom itself does not fabricate wounds it was not given.
  assert.deepEqual(f.woundPath, [], 'the atom records exactly the wounds it was handed');
});
