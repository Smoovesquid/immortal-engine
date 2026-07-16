// U705 — CORPSE-TRUTH-1a: a dead monster leaves a locatable corpse.
//
// THE LIE THIS CLOSES (DEATH-TRUTH-1 front 2, evidence 2026-07-16): kill a pure
// monster (sourceNpcId '' — encounterSpawn's whole population) and NOTHING at the
// node remembers it. endCombat persists hp/down ONLY for sourceNpcId foes; the
// combat.enemies row is a stale scratchpad the next mint overwrites; presence
// reads flatly deny the body ("Is there a body here?" → "No — no body here.").
// The corpse the 3D board drew evaporates with the combat scene.
//
// THE REPRESENTATION (the packet's ruling): remains are a DERIVED PROJECTION over
// death-fact canon — the timeline 'death-fact' events deathFact.js already calls
// "the honest lazy-additive storage path". Two additive mint fields make the
// projection possible: fact.nodeId (WHERE it died) and fact.victim.archetype
// (WHAT kind of creature — the identity the corpse-mini seam keys on). No new
// ensureWorld field, no WORLD_VERSION bump, no ensureCombat-whitelist traffic
// (nothing new persists on enemies — the fact is minted at the kill).
//
// remainsAtNode(world, nodeId) is the ONE canonical "what bodies lie here" read
// (the heldObjectOf pattern): fact-derived monster remains ∪ fact-derived NPC
// remains ∪ roster-defeated NPCs (the pre-existing corpse truth), deduped by
// victim identity. Pre-feature facts lack nodeId and stay honestly unlocatable.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { PACKS, activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { spawnEncounter, selectCreatures } from '../engine/combat/encounterSpawn.js';
import { findDeathFacts, remainsAtNode } from '../engine/combat/deathFact.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { worldHash } from '../engine/worldHash.js';

const boot = () => beginAdventure(newWorld({ seed: 'loaderDemo', fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeOf = (w) => (w.map.nodes || []).find(n => n && n.id === w.map.currentNodeId);

// Kill one real bestiary monster through the production route: spawnEncounter
// (ambush) → strikes → the finish verb if it entered DOWNED-dying. HP pinned to 1
// (U604's fixture technique) so the script is short and deterministic.
function killOneMonster() {
  let w = boot();
  const rng = makeRng(seedFromString('death-truth-evidence'));
  const defs = selectCreatures(1, 1, null, rng) || [];
  assert.ok(defs.length === 1, 'setup: one creature def picked');
  w = spawnEncounter(w, defs, { ambush: true, reason: 'u705-ambush' }, rng);
  assert.equal(w.combat?.active, true, 'setup: ambush combat began');
  assert.equal(String(w.combat.enemies[0].sourceNpcId || ''), '', 'setup: a PURE monster (no source NPC)');
  const monsterName = String(w.combat.enemies[0].name || '');
  w = { ...w, combat: { ...w.combat, enemies: w.combat.enemies.map(e => ({ ...e, hp: 1, ac: 1 })) } };
  for (let i = 0; i < 8 && w.combat?.active; i++) w = playerMove(w, PACKS, 'I strike at it with everything I have.').world;
  if ((w.combat?.enemies || []).some(e => e && !e.defeated && (Number(e.hp) || 0) <= 0)) {
    w = playerMove(w, PACKS, 'I finish it off.').world;
  }
  assert.equal(w.combat?.active, false, 'setup: combat over');
  assert.ok((w.combat?.enemies || []).some(e => e && e.defeated), 'setup: the monster is DEFEATED, not merely downed');
  return { w, monsterName };
}

// ── U705-A the death fact now records WHERE and WHAT KIND ──
test('U705-A the minted fact carries nodeId (death location) and victim archetype', () => {
  const { w, monsterName } = killOneMonster();
  const facts = findDeathFacts(w);
  assert.ok(facts.length >= 1, 'a death fact minted');
  const fact = facts[facts.length - 1];
  assert.equal(String(fact.victim?.name || ''), monsterName, 'the fact names the victim');
  assert.equal(String(fact.nodeId || ''), String(w.map.currentNodeId), 'the fact records the node it died at');
  assert.ok('archetype' in (fact.victim || {}), 'the victim carries an archetype field (creature identity)');
});

// ── U705-B remainsAtNode: the corpse is locatable, as THAT creature ──
test('U705-B remainsAtNode lists the monster corpse at the death node, kind monster, name intact', () => {
  const { w, monsterName } = killOneMonster();
  const rem = remainsAtNode(w, String(w.map.currentNodeId));
  assert.equal(rem.length, 1, 'exactly one body here');
  assert.equal(rem[0].kind, 'monster', 'and it is a monster corpse, not an anonymous marker');
  assert.equal(rem[0].name, monsterName, 'whose body it is survives — the creature kind is preserved');
  const elsewhere = remainsAtNode(w, 'nowhere_node');
  assert.equal(elsewhere.length, 0, 'no body anywhere else — remains are located, not global');
});

// ── U705-C the presence read stops denying the corpse ──
test('U705-C "Is there a body here?" answers the corpse instead of denying it', () => {
  const { w, monsterName } = killOneMonster();
  const m = playerMove(w, PACKS, 'Is there a body here?');
  const out = String(m.output?.narration || '');
  assert.ok(!/No — no body here/i.test(out), `the flat denial is gone (${out.slice(0, 120)})`);
  assert.ok(out.toLowerCase().includes(monsterName.toLowerCase()), `the answer names the dead creature (${out.slice(0, 160)})`);
  assert.match(String(m.output?.mechanics || ''), /observe only|no roll/i, 'a presence question stays a read — no roll, no mutation');
});

// ── U705-D a SUCCESSFUL death-sense may no longer claim the node is empty ──
// The sense is a magic gesture behind a will-roll BY DESIGN (a failed roll narrates
// the failure — honest, not a lie; this seed rolls a fail, and pinning a success
// would be seed-fishing). The lie this closes is narrower and deterministic to
// assert: whatever the roll does, the FALSE-EMPTY line ("nothing dead within
// reach — a rare quiet") must never surface while a corpse lies at this node —
// the branch now consults remainsAtNode before it can claim quiet.
test('U705-D death-sense never claims "nothing dead" over a fresh corpse', () => {
  const { w } = killOneMonster();
  for (const phrasing of ['I use my death-sense.', 'I reach out and try to sense the dead here.']) {
    const out = String(playerMove(w, PACKS, phrasing).output?.narration || '');
    assert.ok(!/nothing dead within reach|a rare quiet/i.test(out),
      `the false-empty line is unreachable while remains exist (${phrasing} → ${out.slice(0, 140)})`);
  }
});

// ── U705-E NPC kills dedupe: fact + roster truth = ONE body ──
test('U705-E an NPC corpse lists once (fact-derived and roster-derived are the same body)', () => {
  let wc = activeCombatWorld();
  wc = ensureWorld({ ...wc, meta: { ...wc.meta, seed: 'aldermere', mode: 'escape' }, combat: { ...wc.combat, enemies: wc.combat.enemies.map(e => ({ ...e, hp: 1, ac: 1 })) } });
  for (let i = 0; i < 8 && wc.combat?.active; i++) wc = playerMove(wc, PACKS, 'I strike him down.').world;
  if ((wc.combat?.enemies || []).some(e => e && !e.defeated && (Number(e.hp) || 0) <= 0)) {
    wc = playerMove(wc, PACKS, 'I finish him off.').world;
  }
  const rem = remainsAtNode(wc, String(wc.map.currentNodeId));
  const lingerers = rem.filter(r => /lingerer/i.test(String(r.name || '')));
  assert.equal(lingerers.length, 1, `the Lingerer's body lists exactly once (${JSON.stringify(rem)})`);
  assert.equal(lingerers[0].kind, 'npc', 'an NPC corpse stays an NPC in the fiction, distinct from a monster');
});

// ── U705-F remains survive save/load; the projection reads pure state ──
test('U705-F the corpse survives a save/load round-trip', () => {
  const { w, monsterName } = killOneMonster();
  const rt = ensureWorld(JSON.parse(JSON.stringify(w)));
  const rem = remainsAtNode(rt, String(rt.map.currentNodeId));
  assert.equal(rem.length, 1, 'still one body after round-trip');
  assert.equal(rem[0].name, monsterName, 'still the same creature');
});

// ── U705-G determinism: the whole kill script replays to the same hash ──
test('U705-G worldHash equality across two fresh kill runs', () => {
  const h1 = worldHash(killOneMonster().w);
  const h2 = worldHash(killOneMonster().w);
  assert.equal(h1, h2, 'same seed, same script, same hash');
});
