// U600 — DEATH-2: THE FOUR VERBS AS DEEDS. docs/DEATH_CONTRACT.md §3 (the four verbs) +
// §6 falsifiers. Every verb mints its HONEST deed kind through the LANDED moral organs
// (recordDeed / the death-fact atom / the rumor sink) — this packet WIRES, it invents nothing.
//
//   (I)   MERCY — a quick clean kill on the plea. Deed: KILLING, mercy-flagged (NOT cruelty —
//         the F6 extension: a mercy-kill of a begging foe tags mercy, never cruelty; U556's law
//         grows a case, it does not break). Accrues ZERO heat. Death fact intent = 'mercy'.
//   (II)  WORSE — the example-making. HEAVY cruelty feeding heat (→ the hunt) and pact-relevant.
//         Death fact intent = 'worse'.
//   (III) SPARE — the LIVING WITNESS + the first strong POSITIVE claim. A HEAVY mercy deed that
//         TRAVELS via rumorsReaching (the SOLE sink — no parallel path) to a neighbor node.
//         Betrayal disposition is engine-owned + seeded. No kill (the foe lives).
//   (IV)  WALK AWAY — abandonment, its OWN deed kind (≠ mercy ≠ cruelty). Zero heat.
//   (V)   PLAYER RECORD HONEST throughout — the deeds carry the truth of what was done.
//
// Seam: engine/combat/downedResolve.js + playloop's downedFoeVerbGate + the moral organs.
// LLM-off, deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { playerMove } from '../engine/playloop.js';
import { findDeathFacts } from '../engine/combat/deathFact.js';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';
import { chooseBetrayal } from '../engine/combat/downedResolve.js';

// Corner a fixture foe to DOWNED (dying, begging) with the gate on. Returns the world
// with a DOWNED foe awaiting the player's verb.
function downedWorld({ seed = 'aldermere', name = 'Brigand', hp = 1 } = {}) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, name, hp, ac: 1, maxHp: 20 }));
  const w = ensureWorld({ ...base, meta: { ...base.meta, seed, mode: 'escape' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
  return resolveEscapeCombatTurn(w, 'strike').world;
}
const foe = (w) => w.combat?.enemies?.[0];
const deeds = (w) => Array.isArray(w.deeds) ? w.deeds : [];

test('U600-01: MERCY mints a mercy-flagged KILLING deed (NOT cruelty) — the F6 extension', () => {
  const m = playerMove(downedWorld(), PACKS, 'I give him a clean, merciful death');
  // Exactly ONE deed, kind mercy (never cruelty — the fair/mercy kill never stains, U556 + its new case).
  const d = deeds(m.world);
  assert.equal(d.length, 1, `mercy records exactly one deed (no double-count): ${JSON.stringify(d.map(x => x.kind))}`);
  assert.equal(d[0].kind, 'mercy', 'a mercy-kill tags MERCY, not cruelty (the F6 extension)');
  assert.ok(!d.some(x => x.kind === 'cruelty'), 'a merciful kill of a begging foe NEVER tags cruelty');
  // Zero heat (mercy is not a heat kind) — the hunt is not roused by mercy.
  assert.equal(Number(m.world.party[0]?.morality?.heat ?? 0), 0, 'mercy accrues no heat');
  // The death fact records the mercy intent + the begging stance (honest player record).
  const f = findDeathFacts(m.world)[0];
  assert.ok(f, 'the kill minted its death fact');
  assert.equal(f.killerIntent, 'mercy', 'the death fact records killerIntent = mercy');
  assert.equal(f.victimStance, 'begging', 'the victim died begging');
  // Kill credit is earned (you overcame the foe).
  assert.ok(Number(m.world.party[0]?.xp ?? 0) > 0, 'the mercy-kill credits the foe as overcome (XP)');
  // The foe is dead (defeated), not lingering.
  assert.equal(foe(m.world).defeated, true, 'the foe is finished');
});

test('U600-02: WORSE mints HEAVY cruelty feeding heat (the example-making) — death fact intent worse', () => {
  const m = playerMove(downedWorld(), PACKS, 'I make an example of him — slow and cruel');
  const d = deeds(m.world);
  assert.equal(d.length, 1, `worse records exactly one deed (no double-count): ${JSON.stringify(d.map(x => x.kind))}`);
  assert.equal(d[0].kind, 'cruelty', 'the example-making tags CRUELTY');
  assert.ok(d[0].severity >= 20, `the cruelty is HEAVY (>=20): ${d[0].severity}`);
  // Heat accrued (feeds MP-3's hunt) — a cruelty deed rouses the gods.
  assert.ok(Number(m.world.party[0]?.morality?.heat ?? 0) > 0, 'the atrocity accrues heat (feeds the hunt)');
  const f = findDeathFacts(m.world)[0];
  assert.equal(f.killerIntent, 'worse', 'the death fact records killerIntent = worse');
});

test('U600-03: SPARE mints the LIVING WITNESS + the first strong POSITIVE claim, travelling via rumorsReaching', () => {
  const m = playerMove(downedWorld(), PACKS, 'I bind his wounds and let him live');
  // The foe LIVES — spared, not defeated, not downed.
  assert.equal(foe(m.world).spared, true, 'the spared foe lives (a living witness)');
  assert.equal(foe(m.world).defeated, false, 'a spared foe is not a corpse');
  assert.equal(foe(m.world).downed, false, 'a spared foe was pulled back from dying');
  // No kill credit (you did not overcome — you let live) + no death fact.
  assert.equal(findDeathFacts(m.world).length, 0, 'sparing mints NO death (the foe lives)');
  assert.equal(Number(m.world.party[0]?.xp ?? 0), 0, 'sparing credits no kill XP');
  // A HEAVY mercy deed is recorded — the first strong POSITIVE claim.
  const d = deeds(m.world);
  assert.equal(d.length, 1, `sparing records exactly one deed: ${JSON.stringify(d.map(x => x.kind))}`);
  assert.equal(d[0].kind, 'mercy', 'sparing tags MERCY (a positive act)');
  assert.ok(d[0].severity >= 20, `the mercy is HEAVY (>=20) so it TRAVELS: ${d[0].severity}`);
  // THE CLAIM TRAVELS — via rumorsReaching (the SOLE sink). It reads at the local node AND a neighbor.
  const localClaims = rumorsReaching(m.world, m.world.map.currentNodeId, { subjectPrefix: 'deed:' });
  assert.ok(localClaims.some(r => /spared/i.test(r.body)), 'the mercy claim is present at the node where it happened');
  // Seed a second node into the map and confirm the deed synthesizes a travelling rumor there too
  // (severity >= DEED_GOSSIP_MIN is what makes it travel — the positive claim uses the SAME path).
  const withNeighbor = {
    ...m.world,
    map: { ...m.world.map, nodes: [...m.world.map.nodes, { id: 'neighbor', settlement: { name: 'Aldermere', npcs: [{ id: 'nb1' }] } }] }
  };
  const farClaims = rumorsReaching(withNeighbor, 'neighbor', { subjectPrefix: 'deed:' });
  // The claim TRAVELS (it reaches the neighbor at all — the sole sink, no parallel path). Its body
  // is legitimately GARBLED by distance (tier 2 — the rumor system working as designed), so we
  // assert the claim's PRESENCE + honest attribution, not the literal word survive the telling.
  const mercyClaim = farClaims.find(r => r.deedRef && r.deedRef.includes(':mercy:'));
  assert.ok(mercyClaim, 'the POSITIVE mercy claim travels to a neighbor node (the sole sink, no parallel path)');
  assert.equal(mercyClaim.actorId, 'party', 'the travelling claim is attributed to the player honestly');
  assert.ok(mercyClaim.body.length > 0, 'the travelling claim carries a (garbled-by-distance) body');
});

test('U600-04: betrayal odds are engine-owned + seeded (the peril made real)', () => {
  // The betrayal disposition is deterministic per (world, foe): same seed ⇒ same outcome.
  const w = { meta: { seed: 'aldermere', mode: 'escape' }, map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] }, party: [{ id: 'party' }], timeline: [] };
  const e = { id: 'enemy_0', name: 'Brigand', sourceNpcId: '' };
  const a = chooseBetrayal(w, e);
  const b = chooseBetrayal({ ...w }, { ...e });
  assert.equal(a, b, 'the betrayal roll is deterministic under the same seed');
  assert.equal(typeof a, 'boolean', 'betrayal is a boolean disposition');
  // Across seeds, BOTH outcomes appear (it is a real roll, not a constant) — the peril is real but not certain.
  const outcomes = new Set();
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']) {
    outcomes.add(chooseBetrayal({ ...w, meta: { seed: s, mode: 'escape' } }, e));
  }
  assert.equal(outcomes.size, 2, 'both betrayal outcomes (owes / turns) occur across seeds — a genuine roll');
  // The spared foe carries the disposition on its record.
  const m = playerMove(downedWorld(), PACKS, 'I spare him and bind his wounds');
  assert.equal(typeof foe(m.world).betrayed, 'boolean', 'the spared foe carries its betrayal disposition');
});

test('U600-05: WALK AWAY records abandonment — its OWN deed kind (≠ mercy ≠ cruelty), zero heat', () => {
  const m = playerMove(downedWorld(), PACKS, 'I turn my back on him and walk away');
  const d = deeds(m.world);
  assert.equal(d.length, 1, `walking away records exactly one deed: ${JSON.stringify(d.map(x => x.kind))}`);
  assert.equal(d[0].kind, 'abandonment', 'abandonment is its OWN deed kind');
  assert.ok(!d.some(x => x.kind === 'mercy' || x.kind === 'cruelty'), 'abandonment is neither mercy nor cruelty');
  // Zero heat — a cold act the gods note but do not hunt.
  assert.equal(Number(m.world.party[0]?.morality?.heat ?? 0), 0, 'abandonment accrues no heat');
  // The foe dies (the clock finishes) — a death fact records the clock, not a blow.
  const f = findDeathFacts(m.world)[0];
  assert.ok(f, 'the abandoned foe dies (the clock finishes it) — the fact records the death');
  assert.match(f.means.name, /clock/i, 'the death fact records the dying clock as the means, not a blow');
});

test('U600-06: a non-verb input while a foe lies dying re-surfaces the moment (no phantom action)', () => {
  // The DM does not bounce to a menu and does not swing a phantom blade — it restates the dying foe.
  const m = playerMove(downedWorld(), PACKS, 'what do I see around me?');
  assert.match(m.output.mechanics, /downed:pending/, 'a non-verb re-surfaces the DOWNED moment');
  // No deed recorded, no death, foe still DOWNED (nothing was resolved).
  assert.equal(deeds(m.world).length, 0, 'no deed from a non-verb');
  assert.equal(foe(m.world).downed, true, 'the foe still lies dying, awaiting the answer');
  assert.equal(findDeathFacts(m.world).length, 0, 'nothing died');
});
