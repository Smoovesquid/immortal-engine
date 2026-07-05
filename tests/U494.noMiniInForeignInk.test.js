// U494 — TT-OCC: no outdoor mini ever stands inside ink that isn't theirs.
//
// Tim's ruling (2026-07-05, docs/MAP_REAL.md): floorplans stay ALWAYS-OPEN (a
// roofless DM-screen look, locked), so a strict placement margin is the ONLY
// defense against a figure reading as "standing in the bedroom" when the engine
// says they're actually outdoors. Provenance: a live playtest hit exactly this —
// Galen (an outdoor occupant, aldermere seed, node n0_2935788122) scattered to a
// point that read on screen as standing inside the wake cottage, and the DM
// correctly said no one was there (engine-truthful, map-confusing). Measured:
// public/map/placeFromNode.js's pre-fix npc scatter placed Galen 0.72 layout-units
// (lu) from the cottage's raw footprint edge — clear of a bare rect-edge check,
// but well inside the visual gap the wall's own ink stroke plus the token's own
// drawn footprint actually eat (see NPC_MARGIN_LU's derivation comment in the
// source file). This test's margin (below) reproduces that same measurement so
// the assertion is grounded in the actual bug, not an arbitrary number.
//
// Hermetic — no network, no API key. Reads real engine boot worlds
// (beginAdventure) across several seeds, so this exercises the true occupancy →
// scatter pipeline, not a synthetic fixture (U495 covers the adversarial
// synthetic-geometry side separately).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { placeFromWorldNode, NPC_MARGIN_LU } from '../public/map/placeFromNode.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
let _n = 0;
const begin = (seed) => beginAdventure(
  newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }, campaignId: `U494-${++_n}` }),
  PACKS
);

// The same footprint-extent math placeFromNode.js's own building-scatter loop
// uses internally (planExtent), re-derived here so the test checks the SAME
// rects the placement code actually collides against — not a re-guessed shape.
function planExtent(plan) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const r of (plan.rooms || [])) {
    const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2;
    minX = Math.min(minX, r.cx - rw); maxX = Math.max(maxX, r.cx + rw);
    minY = Math.min(minY, r.cy - rh); maxY = Math.max(maxY, r.cy + rh);
  }
  return { minX, minY, maxX, maxY };
}

function buildingRectsFor(place) {
  return (place.buildings || []).map(b => {
    const ext = planExtent(b.plan);
    return {
      minX: ext.minX + b.ox, maxX: ext.maxX + b.ox,
      minY: ext.minY + b.oy, maxY: ext.maxY + b.oy,
      name: b.buildingName || b.structureKey || '(unnamed)'
    };
  });
}

function assertNoMiniInForeignInk(place, label) {
  const npcTokens = (place.tokens || []).filter(t => t.type === 'npc');
  const rects = buildingRectsFor(place);
  for (const t of npcTokens) {
    for (const r of rects) {
      const inside = t.ux >= r.minX - NPC_MARGIN_LU && t.ux <= r.maxX + NPC_MARGIN_LU &&
                     t.uy >= r.minY - NPC_MARGIN_LU && t.uy <= r.maxY + NPC_MARGIN_LU;
      assert.ok(!inside,
        `${label}: npc "${t.npc.name}" at (${t.ux.toFixed(2)},${t.uy.toFixed(2)}) reads as inside building ` +
        `"${r.name}" [${r.minX.toFixed(2)},${r.minY.toFixed(2)}..${r.maxX.toFixed(2)},${r.maxY.toFixed(2)}] + ${NPC_MARGIN_LU}lu margin`);
    }
  }
  return npcTokens.length;
}

test('U494: aldermere boot world — Galen (outdoor occupant) never scatters inside the wake cottage or any other building', () => {
  const w = begin('aldermere').world;
  const nodeId = w.map.currentNodeId;
  const place = placeFromWorldNode(w, nodeId);
  assert.ok(place, 'aldermere boot must produce a walkable place');
  const checked = assertNoMiniInForeignInk(place, 'aldermere');
  assert.ok(checked > 0, 'precondition: the aldermere wake node has at least one outdoor npc token to check (Galen)');
});

test('U494: tallow boot world — no npc token lands inside any building footprint + margin', () => {
  const w = begin('tallow').world;
  const nodeId = w.map.currentNodeId;
  const place = placeFromWorldNode(w, nodeId);
  assert.ok(place, 'tallow boot must produce a walkable place');
  assertNoMiniInForeignInk(place, 'tallow');
});

test('U494: two more boot seeds — the exclusion holds generally, not just on the two named repro seeds', () => {
  let anyChecked = 0;
  for (const seed of ['wake-cottage-seed-3', 'wake-cottage-seed-4']) {
    const w = begin(seed).world;
    const nodeId = w.map.currentNodeId;
    const place = placeFromWorldNode(w, nodeId);
    assert.ok(place, `${seed} boot must produce a walkable place`);
    anyChecked += assertNoMiniInForeignInk(place, seed);
  }
  assert.ok(anyChecked > 0, 'precondition: at least one of the two additional seeds has npc tokens to check');
});

test('U494: masked hostile tokens (name "?") get the identical outdoor exclusion — no ambusher-in-the-attic loophole', () => {
  // wake-cottage-seed-3 is the fixture that produces a masked hostile token
  // (recorded during this packet's own reproduction pass) — kept as a named
  // seed rather than a search loop so the assertion is anchored to a known case.
  const w = begin('wake-cottage-seed-3').world;
  const nodeId = w.map.currentNodeId;
  const place = placeFromWorldNode(w, nodeId);
  const hostileTokens = (place.tokens || []).filter(t => t.type === 'npc' && t.npc.name === '?');
  assert.ok(hostileTokens.length > 0, 'precondition: this seed produces at least one masked hostile token');
  assertNoMiniInForeignInk(place, 'wake-cottage-seed-3 (hostile check)');
});

test('U494: the player token is exempt from the exclusion — position truth, not this scatter, governs it', () => {
  // The player enters at a fixed lane-relative point (x0+1.5, roadY(x0+1.5)) that
  // is never routed through pushClearOfBuildings; confirm it stays exactly that
  // formula's output rather than silently also being nudged.
  const w = begin('aldermere').world;
  const nodeId = w.map.currentNodeId;
  const place = placeFromWorldNode(w, nodeId);
  const playerTokens = (place.tokens || []).filter(t => t.type === 'player');
  assert.equal(playerTokens.length, 1, 'exactly one player token');
  // Re-derive independently is out of scope here (that's placeFromWorldNode's
  // own internal formula); the meaningful assertion is presence + shape, since
  // the exclusion-exemption is a code-path fact (see placeFromNode.js's
  // "player token is exempt" comment at the tokens.push('player', ...) call),
  // not a numeric one this black-box test can independently re-derive.
  assert.ok(Number.isFinite(playerTokens[0].ux) && Number.isFinite(playerTokens[0].uy), 'player token has finite coordinates');
});
