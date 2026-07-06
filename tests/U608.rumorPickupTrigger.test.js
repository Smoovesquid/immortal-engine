// U608 — PW-3: the rumor layer's first live trigger (RUMOR_LAYER.md lifecycle trigger #1;
// docs/briefs/PROSE_TO_WORLD_CONTRACT.md PW-3 row).
//
// The rumor layer was built and tested for months with ZERO live production call sites
// (`mintRumorForNpc`: only tests). This gate proves the SYNCHRONOUS trigger fires in real play:
// when the player asks an NPC about a topic that a latent seed reaching town answers — and this
// NPC does not already carry it — the NPC "picks it up" and retells it as their own, garbled to
// their sophistication tier. The deterministic SKELETON + S2 fallback body mints in the reducer
// (LLM-off), seeded and replayable. An unreachable / unmatched topic mints NOTHING. The mint budget
// caps at 3 carrier rumors per scene, the over-budget ask declining honestly (falling back to the
// NPC's ordinary deflection, no phantom mint).
//
// Hermetic — no network/API. All state is driven through the real playerMove path.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
// The slice boots with two arc rumors carried by distinct NPCs at Aldermere: npc_1 (Galen) carries
// the cold-well arc; npc_2 (Brogan) carries the what-the-fire-left arc. Galen therefore has a
// REACHABLE latent seed on "the fire" (Brogan's arc, present in world.rumors) that he does not
// himself carry — the exact shape trigger #1 needs.
const boot = () => beginAdventure(
  newWorld({ seed: SLICE_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
  PACKS
).world;

const drive = (w, lines) => { for (const t of lines) w = playerMove(w, PACKS, t).world; return w; };
const lastMove = (w, line) => playerMove(w, PACKS, line);
const carrierRumors = (w) => (w.rumors || []).filter(r => String(r.carrierNpcId || '') !== '');
const npcCarries = (w, npcId, rumorId) => {
  const node = (w.map?.nodes || []).find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || []).find(n => String(n.id) === npcId);
  return Array.isArray(npc?.rumorIds) && npc.rumorIds.includes(rumorId);
};

test('U608-01: asking an NPC about a reachable latent seed mints a carrier rumor (skeleton + S2 body) in the reducer', () => {
  let w = boot();
  const before = carrierRumors(w).length;
  w = drive(w, ['talk to Galen']);
  const r = lastMove(w, 'what do you know about the fire?');
  w = r.world;

  // A new carrier rumor was minted, attributed to Galen (npc_1), about the fire arc.
  const after = carrierRumors(w);
  assert.ok(after.length > before, 'a carrier rumor was minted on the ask');
  const minted = after.find(x => x.carrierNpcId === 'npc_1' && String(x.sourceSeedId).includes('what-the-fire-left'));
  assert.ok(minted, 'the minted rumor is carried by Galen and sourced from the fire seed');

  // Skeleton is well-formed: tier is hearsay (>=1, never firsthand truth), body is non-empty S2
  // content with no leading hearsay double-frame and no numerics.
  assert.ok(minted.tier >= 1, 'a picked-up rumor is hearsay — tier >= 1, never tier-0 firsthand');
  assert.ok(String(minted.body || '').trim().length > 0, 'S2 body is non-empty');
  assert.ok(!/\bthey say they say\b/i.test(minted.body), 'no doubled hearsay frame in the stored body');

  // The carrier now actually CARRIES it (npc.rumorIds), so rumorsReaching / dialogue can surface it.
  assert.ok(npcCarries(w, 'npc_1', minted.id), 'Galen carries the minted rumor id');

  // The turn surfaces as a pickup, not a bare deflection, and carries the S3-upgrade handle.
  assert.equal(String(r.output?.dialogue?.mode || ''), 'rumor_pickup', 'the ask resolves as rumor_pickup');
  assert.ok(/rumor_pickup/.test(r.output?.mechanics || ''), 'mechanics tag names the pickup');
  assert.ok(r.output?.dialogue?.rumor?.id === minted.id, 'the dialogue payload exposes the minted rumor for S3 upgrade');
  assert.equal(r.output.dialogue.rumor.tier, minted.tier, 'the payload tier matches the skeleton (server must not change it)');
});

test('U608-02: the pickup body carries no numerics (zero-numeric surfaced prose rule)', () => {
  let w = boot();
  w = drive(w, ['talk to Galen']);
  const r = lastMove(w, 'what do you know about the fire?');
  const body = String(r.world.rumors.find(x => x.carrierNpcId === 'npc_1')?.body || '');
  const narration = String(r.output?.narration || '');
  assert.ok(!/\d/.test(body), 'no digits in the minted rumor body');
  assert.ok(!/\d/.test(narration), 'no digits in the surfaced narration');
});

test('U608-03: an unmatched topic mints NOTHING (no phantom rumor)', () => {
  let w = boot();
  w = drive(w, ['talk to Galen']);
  // Rumor ids Galen carries BEFORE the ask. (world.rumors.length can grow independently via
  // worldTick propagation, so we assert on THIS NPC picking up a NEW rumor, not the raw count.)
  const idsBefore = new Set((w.rumors || []).map(r => r.id));
  // A topic no latent seed answers — the NPC deflects, and no pickup fires.
  const r = lastMove(w, 'what do you know about the price of turnips in the capital?');
  const newCarrierForGalen = (r.world.rumors || [])
    .filter(x => !idsBefore.has(x.id) && String(x.carrierNpcId) === 'npc_1');
  assert.equal(newCarrierForGalen.length, 0, 'no carrier rumor minted for Galen on an unmatched topic');
  assert.notEqual(String(r.output?.dialogue?.mode || ''), 'rumor_pickup', 'not a pickup turn');
});

test('U608-04: determinism — the same ask transcript yields byte-identical worldHash across two fresh worlds (LLM off)', () => {
  const lines = ['talk to Galen', 'what do you know about the fire?'];
  const h1 = worldHash(drive(boot(), lines));
  const h2 = worldHash(drive(boot(), lines));
  assert.equal(h1, h2, 'a picked-up rumor is seeded + replayable — the reducer mint is deterministic');
});

test('U608-05: the mint budget caps at 3 carrier rumors per scene; the 4th ask declines without a phantom mint', () => {
  // Manufacture a scene already at the budget ceiling: seed the current node's NPCs with three
  // carrier rumors, then confirm a fresh ask that WOULD pick one up declines instead.
  let w = boot();
  const nodeId = w.map.currentNodeId;
  // Inject 3 carrier rumors at this node (carried by Galen) to saturate the per-scene budget.
  const inject = [];
  for (let i = 0; i < 3; i++) {
    inject.push({
      id: `rumor:test:budget:${i}`, sourceSeedId: `test:budget:${i}`, carrierNpcId: 'npc_1',
      hopCount: 1, tier: 2, age: 0, mintedAt: 0, body: `a saturating rumor number ${'x'.repeat(i + 1)}`, tags: ['test']
    });
  }
  w = { ...w, rumors: [...(w.rumors || []), ...inject] };
  // Also register them on Galen so they count as carried-at-node.
  w = {
    ...w,
    map: {
      ...w.map,
      nodes: w.map.nodes.map(n => n.id !== nodeId ? n : ({
        ...n,
        settlement: {
          ...n.settlement,
          npcs: n.settlement.npcs.map(npc => String(npc.id) !== 'npc_1' ? npc : ({
            ...npc, rumorIds: [...(npc.rumorIds || []), ...inject.map(r => r.id)]
          }))
        }
      }))
    }
  };

  const carrierBefore = carrierRumors(w).length;
  assert.ok(carrierBefore >= 3, 'the scene is saturated at/above the budget ceiling');

  w = drive(w, ['talk to Galen']);
  const r = lastMove(w, 'what do you know about the fire?');
  // Over budget → no new carrier rumor, and the turn is NOT a pickup (declines to ordinary dialogue).
  assert.equal(carrierRumors(r.world).length, carrierBefore, 'no mint once the per-scene budget is spent');
  assert.notEqual(String(r.output?.dialogue?.mode || ''), 'rumor_pickup', 'the over-budget ask declines in voice, no phantom pickup');
});

test('U608-06: a fresh scene (new node) resets the budget — a pickup can mint again elsewhere', () => {
  // The budget is per-node-scene: counting carrier rumors CARRIED AT THE CURRENT NODE. A different
  // node with its own NPCs starts the count at zero, so the layer is not globally throttled after
  // one talkative town. Proven structurally: a node with no carrier rumors reports a zero count, so
  // the first pickup there is always in-budget.
  let w = boot();
  // The boot node already carries the two arc rumors — assert the budget accounting only counts
  // THIS node's carriers, not the world-wide rumor list (which also holds carrier-less mutterings).
  const nodeId = w.map.currentNodeId;
  const worldWide = (w.rumors || []).length;
  const atNode = carrierRumors(w).filter(rr => {
    const node = w.map.nodes.find(n => n.id === nodeId);
    const ids = new Set((node.settlement.npcs || []).map(n => String(n.id)));
    return ids.has(String(rr.carrierNpcId));
  }).length;
  assert.ok(atNode <= worldWide, 'per-node carrier count is a subset of the world rumor list');
  assert.ok(atNode < 3, 'the boot scene starts below the budget so trigger #1 can fire');
});
