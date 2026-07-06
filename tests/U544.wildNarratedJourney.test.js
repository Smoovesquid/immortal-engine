// U544 — MR-3c: the journey interruption lands in a REAL place, and the DM prompt +
// the detector bank agree with the wild the derivation places there.
//
// Three things this proves:
//
//   1. JOURNEY INTERRUPT READS REAL FEATURES. JR-1's fast-travel can be interrupted en
//      route and drops the traveller at a REAL intermediate node (U422). MR-3c's promise:
//      the look at that interruption cell reads the derivation's features for THAT cell —
//      the fast-forward's event stop lands in a materialized bubble, not a vibe. We drive
//      a real interrupted journey (playerMove, LLM off) and assert the outdoor look there
//      names the wild wildFeaturesAround derives for the drop node's bubble.
//
//   2. THE DM PROMPT CARRIES THE TERRAIN LINE. The same derivation reaches the DM as a
//      hide-the-math TERRAIN canon line (llmAdapter.buildSystemPrompt over ctx.terrain):
//      texture words ("a stand of trees to the north"), never mechanics (no cells, no
//      "blocking=true"). Rendered LLM-off (we build the prompt bundle directly).
//
//   3. THE DETECTOR BANK IS SILENT. The full single-turn coherence detector bank
//      (engine/coherence/checks.js — CONSUMED read-only; the outdoor CG class is an
//      explicit v1 non-goal) flags NOTHING on the composed outdoor output: the narrated
//      wild introduces no place/exit/architecture/forbidden-token desync.
//
// Hermetic: no network, no API key, LLM off. (docs/briefs/MR-3-FOG-PROCGEN.md §MR-3c.)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { initEscapeHp } from '../engine/combat/escapeCombat.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { biomeForNode } from '../engine/world/biome.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { wildFeaturesAround } from '../engine/world/wildFeatures.js';
import { outdoorTerrainFacts } from '../engine/world/wildFacts.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';
import { nodeGridToRegionCell } from '../engine/map/spatial/tacticalPos.js';
import { runDetectors, SINGLE_TURN_DETECTORS } from '../engine/coherence/checks.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// Slice pack for the slice-boot half (the DM-prompt + detector assertions).
const SLICE_PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'], starterObjectives: ['find the key'],
    skills: ['Steel'], locations: ['tower'], objectives: ['find the key'],
    complications: ['a clock starts'], npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust'],
  },
};

// Beast-country biomes: a wild node in one draws a BEAST ambush (immediate combat →
// interrupt), so we can find an interrupted journey deterministically (mirrors U420/U422).
const BEAST = new Set(['forest', 'marsh', 'mountains', 'desert', 'arctic', 'wilderness']);
const isBeastCountry = (seed) => BEAST.has(biomeForNode(seed, { x: 1, y: 0, id: 'wild' }));

// The U422 3-node chain: home(0,0) -> wild(1,0, beast) -> far(2,0). A journey to far
// passes through wild; a beast ambush at wild interrupts and drops the traveller AT wild.
function buildChainWorld(seed) {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = ensureWorld({ ...w0, party: [pc] });
  const home = { id: 'home', name: 'Home Hollow', x: 0, y: 0, nodeType: 'settlement', tags: ['village'], discovered: true, settlement: { decompressed: true, region: null, npcs: [] } };
  const wild = { id: 'wild', name: 'Ashen Wood', x: 1, y: 0, nodeType: 'wilderness', tags: ['forest'], discovered: true };
  const far = { id: 'far', name: 'Farhold', x: 2, y: 0, nodeType: 'settlement', tags: ['village'], discovered: true, settlement: { decompressed: true, region: null, npcs: [] } };
  const nodes = [home, wild, far];
  const edges = [{ a: 'home', b: 'wild' }, { a: 'wild', b: 'far' }];
  const discovered = ['home', 'wild', 'far'];
  w = { ...w, map: { ...ensureWorld(w).map, nodes, edges, currentNodeId: 'home', pos: { x: 0, y: 0 }, discovered } };
  w = initEscapeHp(w);
  return ensureWorld(w);
}

const KIND_SUBSTR = { tree: 'trees', boulder: 'boulder', deadfall: 'deadfall', stump: 'stump', brush: 'brush' };

test('U544: an interrupted journey drops the player where the derivation has real wild, and the look reads it', () => {
  // Find a seed where the journey to Farhold is interrupted at the wild node (U422 pattern).
  let hit = null;
  for (let i = 0; i < 800 && !hit; i++) {
    const seed = `u544-${i}`;
    if (!isBeastCountry(seed)) continue;
    const r = playerMove(buildChainWorld(seed), PACKS, 'go to Farhold');
    const stopped = String(r.world.map.currentNodeId);
    const interrupted = stopped === 'wild' && (r.world.combat?.active || r.world.travel?.pending);
    if (interrupted) hit = { seed, world: r.world };
  }
  assert.ok(hit, 'found a seed where the journey to Farhold is interrupted at the wild node');

  const w = hit.world;
  // The drop is at a real node, outdoors (no interior) — a materialized bubble.
  assert.equal(String(w.map.currentNodeId), 'wild', 'the interrupt landed at the real intermediate node');
  assert.ok(!w.scene?.interior || !w.scene.interior.structureKey, 'the interrupt drop is outdoors, not inside a structure');

  // The derivation's features for the DROP NODE's bubble (the exact cell the outdoor
  // read centres on — party region pos if set, else the node centre).
  const wildNode = w.map.nodes.find(n => n.id === 'wild');
  const centre = nodeGridToRegionCell(wildNode.x, wildNode.y);
  const pos = w.party?.[0]?.pos;
  const cell = (pos && pos.frame === 'region') ? { gx: pos.gx, gy: pos.gy } : centre;
  const feats = wildFeaturesAround(w, cell, 8);
  const facts = outdoorTerrainFacts(w);

  // A forest-tagged wild node yields a wood — the drop is not the void.
  assert.ok(feats.length > 0, 'the derivation places wild at the interrupt drop cell (a real place, not a vibe)');
  assert.ok(facts && facts.features.length > 0, 'the outdoor read carries features at the interrupt drop');

  // The LOOK at the interruption cell reads the derivation's features for THAT cell.
  const survey = buildLocationSurvey(w, { queryText: 'look around' }).toLowerCase();
  const kindsPresent = new Set(feats.map(f => f.kind));
  assert.ok(
    [...kindsPresent].some(k => survey.includes(KIND_SUBSTR[k])),
    `the look at the interrupt drop must name the derived wild (one of ${[...kindsPresent].join(', ')}): "${survey}"`
  );
  // No contradiction: every feature the facts state is one the derivation placed.
  for (const f of facts.features) {
    assert.ok(kindsPresent.has(f.kind), `interrupt-drop look names a ${f.kind} the derivation did not place`);
  }
});

// Place the player outdoors at a Greenwood forest cell of the SLICE world (the DM-prompt
// + detector assertions run on the slice, which has the real forest terrain data).
function sliceOutdoors(cell) {
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const world = beginAdventure(ensureWorld(w0), SLICE_PACKS).world;
  const gw = world.map.nodes.find(n => n.name === 'The Greenwood');
  const w = { ...world, map: { ...world.map, currentNodeId: gw.id }, scene: { ...world.scene, interior: null } };
  return applyDeltas(w, [{ op: 'pos', id: 'party', to: { frame: 'region', gx: cell.gx, gy: cell.gy } }]);
}

test('U544: the DM prompt carries the TERRAIN line as hide-the-math texture (LLM off)', () => {
  const w = sliceOutdoors({ gx: 400, gy: 60 });
  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.terrain && ctx.terrain.features.length > 0, 'the narrator context carries the outdoor terrain facts');

  const prompt = buildSystemPrompt(ctx);
  const terrainLine = prompt.split('\n').find(l => l.includes('TERRAIN (canon'));
  assert.ok(terrainLine, `the DM prompt must carry a TERRAIN canon line; prompt was:\n${prompt}`);

  // Hide-the-math: the line is texture, NEVER mechanics. No coordinates, no cell tuples,
  // no blocking flag, no "gx"/"gy", no bracketed dice/DC.
  assert.doesNotMatch(terrainLine, /\bblocking\b/i, 'TERRAIN line leaked the blocking flag');
  assert.doesNotMatch(terrainLine, /\bg[xy]\b|@\s*\(|\(\d+\s*,\s*\d+\)/, 'TERRAIN line leaked a coordinate/cell');
  assert.doesNotMatch(terrainLine, /\bsizeClass\b|\bcluster\b|\bradius\b/i, 'TERRAIN line leaked a derivation internal');
  assert.doesNotMatch(terrainLine, /\[[^\]]*(?:roll|dc|d20)[^\]]*\]/i, 'TERRAIN line leaked a mechanics token');
  // It DOES read as fiction the player could hear: a compass-anchored feature.
  assert.match(terrainLine, /to the (north|east|south|west)/, 'TERRAIN line should read as compass-anchored fiction');
});

test('U544: the full single-turn detector bank is SILENT on the composed outdoor output', () => {
  // Compose an outdoor turn record from the SAME survey the game emits, with an OUTDOOR
  // canon (no interior). The detectors are CONSUMED read-only; the outdoor CG class is a
  // v1 non-goal, so the interior-only comparators are dormant and nothing should flag.
  const w = sliceOutdoors({ gx: 400, gy: 60 });
  const dm = buildLocationSurvey(w, { queryText: 'look around' });
  const gw = w.map.nodes.find(n => n.id === w.map.currentNodeId);

  // A minimal outdoor turn record (the shape the detectors read: {player, dm, mechanics,
  // canon}). Outdoors → canon has NO `interior` (place/exit/arch comparators stay dormant).
  const turnRec = {
    type: 'turn', seed: 'u544', persona: 'explorer', i: 0, route: 'observe',
    player: 'look around', dm, mechanics: '[observe]',
    canon: { placeName: String(gw?.name || ''), nodeType: 'wilderness' },
    judgeError: false, v1: null, v2: null,
  };

  const flags = runDetectors([turnRec], SINGLE_TURN_DETECTORS);
  assert.equal(flags.length, 0, `the detector bank flagged the composed outdoor wild read: ${JSON.stringify(flags)}`);
});
