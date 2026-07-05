// U473 — FACT-1: admitted pack `factions` (PACK-1 let them through the whitelist,
// but they stayed INERT) now actually reach world state at adventure begin.
//
// The bug: engine/state.js's ensureWorld() pre-fills two generic default
// factions (civic/shadow) on EVERY world, so by the time beginAdventure's seed
// guard ran (`!Array.isArray(w.factions)`), the array already existed and the
// authored pack factions were never seeded. The four fantasy sub-regions
// (westmarch/ashenmoor/crownlands/hallowed_reaches) each author real, named
// factions that beginAdventure merges into the primary pack — but the world
// booted with only the two defaults ("civic"/"shadow"). FACT-1 replaces the dead
// guard with a shape-compare against the untouched ensureWorld defaults (the
// fresh-boot signal) and MERGES the authored set onto the defaults, extending
// reputation to key the new factions. MERGE (not replace) keeps civic/shadow live
// because every settlement NPC is affiliated with the "civic" founding faction
// and the deed->faction wire (U324) only moves KNOWN world factions.
//
// This test proves, through the REAL normalizePack idiom (public/v1.js +
// scripts/playtest.js), that:
//   1. a factions-carrying pack boot MERGES the authored factions into world
//      state alongside civic/shadow (was ONLY civic/shadow before FACT-1),
//   2. the seeding is deterministic (same seed => identical factions ×2),
//   3. a pack that authors NO factions boots with EXACTLY today's civic/shadow
//      defaults (untouched — nothing is added when no set is supplied),
//   4. a 20-turn worldTick run on a factions-carrying boot stays invariant-clean
//      (the reputation-key invariant + faction shape are the pressure points).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldTick } from '../engine/worldTick.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');

// The production idiom: every real caller routes packs through normalizePack.
function loadNormalizedPacks() {
  const m = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packs', 'manifest.json'), 'utf8'))
  );
  const byId = {};
  for (const p of m.packs) {
    byId[p.id] = normalizePack(
      JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path.replace(/^\//, '')), 'utf8'))
    );
  }
  return byId;
}

function boot(seed, fate, primaryId = 'fantasy') {
  const PACKS = loadNormalizedPacks();
  const w = newWorld({ seed, fate, mode: 'escape', pack: { primaryId, mixerId: null } });
  return beginAdventure(w, PACKS).world;
}

const factionIds = (w) => (Array.isArray(w.factions) ? w.factions : []).map(f => f.id);

test('U473-A: factions-carrying (fantasy) boot MERGES the authored factions alongside civic/shadow', () => {
  const w = boot('tallow', 0.3);
  const ids = factionIds(w);
  // The four merged sub-regions author 10 factions; merged with the 2 defaults.
  assert.ok(ids.length >= 7, `factions-carrying boot must merge in the authored set, got ${ids.length}: ${ids}`);
  // The defaults stay (load-bearing: settlement NPCs are affiliated with "civic",
  // and the deed->faction wire only moves KNOWN world factions).
  assert.ok(ids.includes('civic'), 'civic default must stay live (settlement NPC affiliation + deed wire)');
  assert.ok(ids.includes('shadow'), 'shadow default must stay live');
  // Real authored ids present (from crownlands + hallowed_reaches + westmarch).
  assert.ok(ids.includes('the-regency'), 'crownlands "the-regency" faction must be live in world state');
  assert.ok(ids.includes('order-long-watch'), 'hallowed_reaches "order-long-watch" faction must be live');
});

test('U473-B: authored richness carries through (agenda -> world-faction goal, pressure/hostility preserved)', () => {
  const w = boot('tallow', 0.3);
  const regency = (w.factions || []).find(f => f.id === 'the-regency');
  assert.ok(regency, 'the-regency must be present to check its shape');
  // Pack faction {id,name,description,pressure,hostility,agenda} maps onto the
  // world-faction shape {id,goal,pressure,assets,hostility,lastMove}. `agenda`
  // is the authored goal statement; pressure/hostility carry as-authored.
  assert.ok(regency.goal.length > 0, 'authored agenda must populate the world-faction goal');
  assert.equal(regency.pressure, 65, 'authored pressure must carry through');
  assert.equal(regency.hostility, 30, 'authored hostility must carry through');
  // World-faction shape is complete (ensureFactions normalized it).
  assert.ok(Array.isArray(regency.assets), 'faction.assets must be an array');
  assert.equal(typeof regency.lastMove, 'string', 'faction.lastMove must be a string');
});

test('U473-C: reputation is extended to key every faction, defaults included (reputation-key invariant holds)', () => {
  const w = boot('tallow', 0.3);
  const repKeys = Object.keys(w.reputation?.factions || {});
  const ids = new Set(factionIds(w));
  // Every reputation key must be a known (seeded) faction — the invariant.
  for (const k of repKeys) {
    assert.ok(ids.has(k), `reputation key "${k}" must be a known faction (invariant)`);
  }
  // Every known faction must be reputation-keyed (so witnessed deeds can land on
  // any of them, including the load-bearing civic default).
  for (const id of ids) {
    assert.ok(repKeys.includes(id), `faction "${id}" must have a reputation key`);
  }
  assert.ok(repKeys.includes('civic'), 'civic must keep its reputation key (deed->faction wire)');
  assert.doesNotThrow(() => assertWorldInvariants(w), 'boot with merged factions must be invariant-clean');
});

test('U473-D: faction seeding is deterministic ×2 under a fixed seed', () => {
  assert.deepEqual(factionIds(boot('tallow', 0.3)), factionIds(boot('tallow', 0.3)),
    'faction ids must be identical ×2 under a fixed seed');
  assert.deepEqual(factionIds(boot('aldermere', 0.3)), factionIds(boot('aldermere', 0.3)),
    'aldermere-slice faction seeding must be identical ×2');
  // Full-shape determinism, not just ids.
  assert.deepEqual(boot('tallow', 0.3).factions, boot('tallow', 0.3).factions,
    'full faction objects must be identical ×2');
});

test('U473-E: a pack that authors NO factions boots with EXACTLY today\'s civic/shadow defaults', () => {
  // zombie/modern/haunted/space-rift author no factions; the placeholders must
  // stay untouched (the seeder only fires when a real set is supplied).
  for (const packId of ['zombie', 'modern', 'haunted', 'space-rift']) {
    const w = boot('tallow', 0.3, packId);
    assert.deepEqual(factionIds(w), ['civic', 'shadow'],
      `no-faction pack "${packId}" must keep the default civic/shadow factions`);
    // And the default reputation keys are exactly those two.
    assert.deepEqual(Object.keys(w.reputation?.factions || {}).sort(), ['civic', 'shadow'],
      `no-faction pack "${packId}" must keep the default civic/shadow reputation keys`);
  }
});

test('U473-F: a 20-turn worldTick run on a factions-carrying boot stays invariant-clean', () => {
  let w = boot('tallow', 0.8); // blood band => max pressure, hardest case
  assert.ok(factionIds(w).length >= 5, 'precondition: boot carries authored factions to tick against');

  for (let turn = 0; turn < 20; turn++) {
    w = worldTick(w, `${w.meta.seed}|u473|t${turn}`);
    assert.doesNotThrow(() => assertWorldInvariants(w), `invariants must hold after tick ${turn}`);
    // The reputation-key invariant is the specific pressure point: every
    // reputation faction key must remain a known faction across ticks.
    const ids = new Set(factionIds(w));
    for (const k of Object.keys(w.reputation?.factions || {})) {
      assert.ok(ids.has(k), `reputation key "${k}" stayed a known faction after tick ${turn}`);
    }
    assert.ok((w.ledger?.threats || []).length <= 8, `threats cap (<=8) after tick ${turn}`);
  }
});

test('U473-G: the factions-carrying tick run is itself deterministic (same seed => same faction end-state)', () => {
  const run = () => {
    let w = boot('tallow', 0.8);
    for (let turn = 0; turn < 20; turn++) w = worldTick(w, `${w.meta.seed}|u473det|t${turn}`);
    return w.factions;
  };
  assert.deepEqual(run(), run(), '20-turn factioned tick run must be deterministic under a fixed seed');
});
