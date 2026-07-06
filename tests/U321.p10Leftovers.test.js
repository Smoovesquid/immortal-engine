// U321 — the three P10-gate leftovers (docs/playtests/opus-gate-2026-07-02-P10-AG3.md),
// each a small, bounded fix. Hermetic — no network, no API key.
//
//  #1 (RL-1) inventory-compound: "what's my character carrying — inventory and HP?"
//     answered stats+HP but DROPPED the item list (the gear-ask fold missed the
//     "my character carrying" / "see my inventory" phrasings).
//  #2 (Chaos-5) window plunge: a COMMITTED plunge ("…into the flames") got the
//     which-window prompt and resolved nothing; it should exit.
//  #3 (Lore-8) judge oracle: adjacent map nodes are real canon; buildCanonGroundTruth
//     now surfaces them so the judge stops false-flagging real neighbors.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { roomWindowFacings } from '../engine/structures/roomWindows.js';
import { buildCanonGroundTruth } from '../engine/ref/rubric.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const bootEscape = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const bootPlain = () => beginAdventure(newWorld('tallow'), PACKS).world;
const LOADOUT_RE = /armed with|you'?re wearing|in your pack|bear no weapon|nothing but your own clothes/i;

// ── #1 — inventory-compound folds the loadout ───────────────────────────────
test('U321-1: "what is my character carrying — inventory and HP?" folds the loadout', () => {
  const w = bootPlain();
  const r = playerMove(w, PACKS, 'what is my character carrying — can I see my inventory and current HP?');
  assert.match(r.output.narration, LOADOUT_RE, `the item list must be present, not dropped: ${r.output.narration}`);
  // and the compound's other half still lands (measures/identity present).
  assert.match(r.output.narration, /measures:|you'?re\b/i, 'the identity/stats half still answers');
});

test('U321-1b: "see my inventory" folds gear in a compound, and diverge: a bare action does not', () => {
  const w = bootPlain();
  const r = playerMove(w, PACKS, 'what class am I and can I see my inventory?');
  assert.match(r.output.narration, LOADOUT_RE, 'gear folds into the class+inventory compound');
});

// ── #2 — every window egress resolves; the DM never bounces a which-prompt ───
// WIN-EGRESS-1 (2026-07-06) superseded the P10 "tentative climb still asks" carve-out: THE_DM_TEST.md
// forbids the cardinal menu outright, so BOTH a committed plunge AND a bare climb-out now resolve —
// the DM picks a window deterministically and narrates it. (Full coverage: U588/U589.)
test('U321-2: both a committed plunge AND a bare climb-out resolve out a window — no which-prompt', () => {
  const w = bootEscape();
  const facings = roomWindowFacings(w, w.scene.interior);
  if (facings.length < 2) return; // single-window room — nothing to disambiguate
  // committed: names a beyond-window destination → resolve, do not stall
  const plunge = playerMove(w, PACKS, 'climb out the window into the yard');
  assert.doesNotMatch(plunge.output.mechanics || '', /\[window:exit\|which\]/, `a committed plunge must not stall: ${plunge.output.mechanics}`);
  assert.match(plunge.output.mechanics || '', /\[window:exit\|(north|east|south|west)\]/, `it resolves with a facing: ${plunge.output.mechanics}`);
  assert.equal(plunge.world.scene?.interior, null, 'the committed plunge exits the building');
  // bare climb-out: no plunge, no destination → the DM still picks and resolves, never a menu
  const tentative = playerMove(w, PACKS, 'climb out the window');
  assert.doesNotMatch(tentative.output.mechanics || '', /\[window:exit\|which\]/, 'a bare climb-out no longer asks which window');
  assert.match(tentative.output.mechanics || '', /\[window:exit\|(north|east|south|west)\]/, `it resolves with a facing: ${tentative.output.mechanics}`);
  assert.equal(tentative.world.scene?.interior, null, 'the bare climb-out also exits the building');
});

// ── #3 — adjacent places are in the judge/Ref canon oracle ──────────────────
test('U321-3: buildCanonGroundTruth surfaces adjacent map nodes (real canon, not fabrication)', () => {
  const w = newWorld('tallow');
  const b = buildCanonGroundTruth(w);
  assert.ok(Array.isArray(b.nearbyPlaces), 'nearbyPlaces is present');
  assert.ok(b.nearbyPlaces.length >= 1, 'the current node has at least one connected place');
  for (const nm of b.nearbyPlaces) assert.equal(typeof nm, 'string', 'each nearby place is a name string');
  // every nearby name is a REAL node in the map (never invented)
  const realNames = new Set((w.map?.nodes || []).map(n => n?.name).filter(Boolean));
  for (const nm of b.nearbyPlaces) assert.ok(realNames.has(nm), `${nm} is a real map node`);
});
