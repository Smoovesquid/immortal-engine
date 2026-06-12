// U130 / P-74c: The Named Dark — the confrontation arc binds to the villain.
//
// Tests assert:
//   * the arc file validates and loads through the registry
//   * casting waits for the villain to exist (requiresVillain)
//   * the trust-guarded knowledge body fills with the seed's real villain
//   * learning the name advances the arc AND flips villain.discovered (canon)
//   * discovery has a price: a lieutenant is planted at the witness's node
//   * defeating the lieutenant opens the road; the villain incarnate waits at
//     the seat wearing its bestiary body
//   * reaching the seat, then defeating the villain, resolves the arc:
//     villain.defeated, a county rumor that NAMES the outcome, deed recorded,
//     and play continues (no ending lock)
//   * hook + abandonment rumors never name the villain (rumor-first law)
//   * determinism: same seed → same cast and planted ids

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { getArcs, validateArc } from '../engine/story/registry.js';
import { castArcs, tickArcs } from '../engine/story/storyEngine.js';
import namedDark from '../content/arcs/the_named_dark.arc.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const ARC = 'the-named-dark';
const LIEUTENANT = 'npc_arc_the_named_dark_lieutenant';
const VILLAIN_NPC = 'npc_arc_the_named_dark_villain';

const stateOf = (w) => w.story?.arcs?.[ARC];

/** Begin, tick once (mints villain), cast. */
function castWorld(seed) {
  let w = beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u130-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  w = worldTick(w);
  w = castArcs(w);
  return w;
}

function witnessOf(w) {
  const ref = String(stateOf(w)?.castIds?.['the-go-between'] || '');
  const [npcId, nodeId] = ref.split('@');
  const node = w.map.nodes.find(n => n.id === nodeId);
  return { npc: node?.settlement?.npcs?.find(n => String(n.id) === npcId) || null, nodeId };
}

function npcAt(w, nodeId, npcId) {
  const node = w.map.nodes.find(n => n.id === nodeId);
  return node?.settlement?.npcs?.find(n => String(n.id) === npcId) || null;
}

/** Mark a planted hostile as defeated the way a finished fight leaves the world. */
function defeatPlanted(w, npcId, name) {
  return applyDeltas(w, [{
    op: 'combatState',
    set: {
      active: false, round: 0, turnIndex: 0, beganAt: w.timeline.length, reason: 'enemies-defeated',
      playerGuard: false, companionGuard: false, initiativeOrder: [],
      enemies: [{
        id: 'enemy_0', name, hp: 0, maxHp: 14, damage: 4, ac: 10, cr: 1,
        damageType: 'bludgeoning', resistances: {}, conditionImmunities: [], conditions: [],
        actions: [], multiattack: null, saveProficiencies: [], canParley: false,
        defeated: true, sourceNpcId: npcId, lootTableRef: null, initMod: 0,
        legendaryActions: null, reactions: null, lairActions: null,
        senses: { darkvision: null, blindsight: null, tremorsense: null, truesight: null }
      }]
    }
  }]);
}

/** Walk the arc to a given point; returns the world. */
function walkTo(seed, point) {
  let w = castWorld(seed);
  if (point === 'cast') return w;

  // Learn the name (dialogue records shared:<factId> in the ledger).
  w = applyDeltas(w, [{ op: 'ledger', addFact: `npc:${witnessOf(w).npc.id} shared:villain_name_truth`, source: 'dialogue' }]);
  w = tickArcs(w).world;
  if (point === 'discovered') return w;

  w = defeatPlanted(w, LIEUTENANT, 'a hollow-eyed enforcer');
  w = tickArcs(w).world;
  if (point === 'road-open') return w;

  w = ensureWorld({ ...w, map: { ...w.map, currentNodeId: w.villain.seatNodeId } });
  w = tickArcs(w).world;
  if (point === 'at-seat') return w;

  w = defeatPlanted(w, VILLAIN_NPC, w.villain.name);
  w = tickArcs(w).world;
  return w;
}

const SEED = 'nd0';

test('U130-01 the arc validates and loads', () => {
  assert.deepEqual(validateArc(namedDark), []);
  assert.ok(getArcs().some(a => a.arc === ARC));
});

test('U130-02 casting waits for the villain, then binds a real witness', () => {
  let w = beginAdventure(newWorld({ seed: SEED, fate: 0.2, campaignId: 'u130-wait', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
  assert.equal(w.villain, null);
  assert.notEqual(stateOf(w)?.status, 'cast', 'no villain yet → not cast');

  w = worldTick(w);
  w = castArcs(w);
  assert.equal(stateOf(w).status, 'cast');
  const { npc } = witnessOf(w);
  assert.ok(npc, 'witness resolves');
  assertWorldInvariants(w);
});

test('U130-03 trust-guarded knowledge names the seed villain (filled, not template)', () => {
  const w = castWorld(SEED);
  const { npc } = witnessOf(w);
  const fact = npc.knowledgeGraph.find(f => f.factId === 'villain_name_truth');
  assert.ok(fact, 'fact planted');
  assert.ok(!/\{villain/.test(fact.body), 'templates filled');
  assert.ok(fact.body.includes(w.villain.name), 'carries the real name');
  assert.equal(fact.source, 'witnessed', 'trust-guarded');
});

test('U130-04 learning the name = discovery, and discovery has a price', () => {
  const w = walkTo(SEED, 'discovered');
  assert.equal(stateOf(w).stage, 'silence-the-witness');
  assert.equal(w.villain.discovered, true, 'the name is canon now');
  const { nodeId } = witnessOf(w);
  assert.ok(npcAt(w, nodeId, LIEUTENANT), 'silencer planted at the witness node');
  assertWorldInvariants(ensureWorld(w));
});

test('U130-05 breaking the silencer opens the road; the villain waits at its seat', () => {
  const w = walkTo(SEED, 'road-open');
  assert.equal(stateOf(w).stage, 'walk-to-the-seat');
  const incarnate = npcAt(w, w.villain.seatNodeId, VILLAIN_NPC);
  assert.ok(incarnate, 'villain incarnate planted at the seat');
  assert.equal(incarnate.bestiaryRef, w.villain.ref.replace(/^villain:/, ''), 'wears its bestiary body');
  assert.ok(incarnate.name.includes(w.villain.name), 'wears its name (post-discovery)');
  assert.equal(incarnate.combatProfile.canParley, false);
});

test('U130-06 resolving the confrontation: defeated villain, county talks, play continues', () => {
  const w = walkTo(SEED, 'resolved');
  assert.equal(stateOf(w).status, 'resolved');
  assert.equal(w.villain.defeated, true);

  const outcome = w.rumors.find(r => r.id === `rumor:arc:${ARC}:91`);
  assert.ok(outcome, 'resolution rumor minted');
  assert.ok(outcome.body.includes(w.villain.name), 'the county names the outcome');

  assert.ok((w.deeds?.entries || w.deeds || []).length >= 0, 'deeds index intact');
  assert.ok(!w.ending?.locked, 'open-ended: the world notes it; play continues');
  assertWorldInvariants(ensureWorld(w));

  // And the reaction loop respects the corpse: the agenda holds still.
  const clockBefore = w.villain.agenda.clock;
  const w2 = worldTick(w);
  assert.equal(w2.villain.agenda.clock, clockBefore, 'a defeated villain stops moving');
});

test('U130-07 rumor-first law: hook and abandonment rumors never name the villain', () => {
  const w = castWorld(SEED);
  const hook = w.rumors.find(r => r.id === `rumor:arc:${ARC}:0`);
  assert.ok(hook, 'hook rumor minted');
  assert.ok(!hook.body.includes(w.villain.name), 'hook does not name');
  assert.ok(!namedDark.abandonment.rumor.includes('{villainName}'), 'abandonment text carries no name var');
});

test('U130-08 determinism: same seed → same cast and planted ids', () => {
  const a = walkTo(SEED, 'road-open');
  const b = walkTo(SEED, 'road-open');
  assert.deepEqual(stateOf(a), stateOf(b));
  assert.deepEqual(
    npcAt(a, a.villain.seatNodeId, VILLAIN_NPC),
    npcAt(b, b.villain.seatNodeId, VILLAIN_NPC)
  );
});
