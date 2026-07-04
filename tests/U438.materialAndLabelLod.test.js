// U438 — FP-2 material poché selection + label LOD
// (docs/briefs/FP-2-walls-with-mass.md #4, #5, #6, #8).
//
// (material) A building's shell picks its wall ink + hatch character: stone crisp
// diag, fortified cross-hatch, timber warm-brown diag, cave stipple — ported from
// the retired handDrawnInterior.js MATERIALS table onto FP-1's honest geometry. The
// selection is keyed by drawnStructureModel().shell, so a timber cottage inks timber
// walls and a stone chapel inks stone. (furniture) Furniture entries carry a type
// the material palette (WOOD/STONE/METAL/CLOTH) can key off. (LOD) Room-name labels
// are a plan-band-only tunable (labelPlanBandZ) — never drawn at street/settlement
// zoom where they collide. (tunables) Every FP-2 magic number lives in INK_PARAMS.
//
// Model + params level (no canvas). Pure, deterministic, read-only. worldHash
// untouched.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { floorPlan } from '../engine/structures/floorPlan.js';
import { drawnStructureModel, INK_PARAMS } from '../public/map/drawModel.js';
import { placeFromWorldNode } from '../public/map/placeFromNode.js';

// The renderer's furniture palette (oneMap.js): stone-family types ink stone, bars
// ink metal, a bed gets a cloth mattress, everything else inks wood. A furniture
// `type` is palette-classifiable iff it's a non-empty string this switch can key.
const STONE_FURN = new Set(['hearth', 'altar', 'statue', 'column', 'brazier']);
function paletteClass(type) {
  const t = String(type || '');
  if (!t) return null;
  if (t === 'bars') return 'metal';
  if (t === 'bed') return 'cloth';
  if (STONE_FURN.has(t)) return 'stone';
  return 'wood';
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// A synthetic structure of a chosen building type (same idiom as U429) — exercises
// EVERY shell's poché style, not just the timber cottage the tallow boot spawns.
function chainStruct(type, n) {
  const id = `stgen:v27:U438_${type}_${n}:0`;
  const rooms = [];
  for (let i = 1; i <= n; i++) rooms.push({ id: `room:${id}:${i}`, tags: i === 1 ? ['entry'] : [] });
  const edges = [];
  for (let i = 1; i < n; i++) edges.push({ a: `room:${id}:${i}`, b: `room:${id}:${i + 1}` });
  return { id, kind: 'building', nodeId: 'n', buildingType: type, topology: { kind: 'rooms', rooms, edges } };
}

test('U438-A: every shell that a building can have selects a poché wall style (ink + hatch character)', () => {
  // Enumerate the shells floorPlan can emit across all building types, and prove
  // each resolves a poché style with a material ink and a hatch character (never a
  // missing-key fall-through that would silently draw stone for everything).
  const HATCHES = new Set(['diag', 'cross', 'stipple']);
  const shells = new Set();
  for (const type of ['chapel', 'tavern', 'market', 'keep', 'cottage', 'longhouse', 'lair', 'tower', 'hive']) {
    shells.add(floorPlan(chainStruct(type, 3)).shell);
  }
  assert.ok(shells.size >= 2, `precondition: buildings span multiple shells (got ${[...shells].join(',')})`);
  for (const shell of shells) {
    const poche = INK_PARAMS.pocheByShell[shell];
    assert.ok(poche, `shell '${shell}' must have a poché style (no silent stone fall-through)`);
    assert.ok(typeof poche.fill === 'string' && /rgba?\(/.test(poche.fill), `shell '${shell}' poché has a fill ink`);
    assert.ok(typeof poche.ink === 'string' && /rgba?\(/.test(poche.ink), `shell '${shell}' poché has an outline ink`);
    assert.ok(HATCHES.has(poche.hatch), `shell '${shell}' poché has a hatch character (${poche.hatch})`);
    assert.ok(INK_PARAMS.wallInkWeight[shell] > 0, `shell '${shell}' has a wall-ink weight`);
  }
});

test('U438-B: the timber cottage vs a stone building select DIFFERENT wall inks — material reads', () => {
  const cottageShell = floorPlan(chainStruct('cottage', 3)).shell; // timber
  const chapelShell = floorPlan(chainStruct('chapel', 3)).shell;   // stone
  assert.notEqual(cottageShell, chapelShell, 'precondition: cottage and chapel differ in shell');
  const a = INK_PARAMS.pocheByShell[cottageShell], b = INK_PARAMS.pocheByShell[chapelShell];
  assert.notEqual(a.fill, b.fill, 'timber and stone poché fills differ (you can tell them apart)');
});

test('U438-C: furniture reads by MATERIAL — every rendered furniture type classifies into the wood/stone/metal/cloth palette', () => {
  // The map draws furniture from the settlement place-model (place.buildings[].plan.
  // furniture, the SAME source oneMap.js's furniture loop reads), keyed by `type`.
  // Prove the boot cottage's furniture all classifies into a real palette bucket
  // (so a bed/table/hearth reads as furniture, not a brown smudge).
  const w = boot();
  const place = placeFromWorldNode(w, String(w.map.currentNodeId));
  const cottage = place.buildings.find(b => b.structureKey === 'stgen:v27:n3_1515674724:0');
  assert.ok(cottage && cottage.plan && Array.isArray(cottage.plan.furniture), 'precondition: the cottage carries drawn furniture');
  const furn = cottage.plan.furniture;
  assert.ok(furn.length > 0, 'precondition: the cottage has furniture to draw');
  const buckets = new Set();
  for (const f of furn) {
    const cls = paletteClass(f.type);
    assert.ok(cls, `furniture "${f.type}" must classify into the material palette (wood/stone/metal/cloth)`);
    buckets.add(cls);
  }
  // The cottage furniture spans at least two material buckets (e.g. a stone hearth
  // + wood table) — the palette genuinely distinguishes materials, not one smudge.
  assert.ok(buckets.size >= 2, `furniture reads across ≥2 material buckets (got ${[...buckets].join(',')})`);
});

test('U438-D: room-name labels are a PLAN-BAND-only tunable — labelPlanBandZ sits in the deep zoom band, above the street band', () => {
  // The renderer gates room-name labels behind z >= INK_PARAMS.labelPlanBandZ (and a
  // lifted roof), so they never draw at street/settlement zoom where they collide.
  // Assert the tunable exists and is a plan-band value (well past BAND.street=4).
  assert.equal(typeof INK_PARAMS.labelPlanBandZ, 'number', 'labelPlanBandZ is a tunable');
  assert.ok(INK_PARAMS.labelPlanBandZ >= 5, `labels gate to the plan band (z ${INK_PARAMS.labelPlanBandZ} ≥ 5, above the street band)`);
});

test('U438-E: all FP-2 magic numbers live in INK_PARAMS (one tuning surface) and are finite', () => {
  for (const key of ['doorGapLu', 'doorSwingMul', 'windowLenLu', 'windowInsetLu', 'labelPlanBandZ']) {
    assert.ok(Number.isFinite(INK_PARAMS[key]), `INK_PARAMS.${key} is a finite tunable`);
  }
  assert.ok(INK_PARAMS.pocheByShell && typeof INK_PARAMS.pocheByShell === 'object', 'pocheByShell table present');
  assert.ok(INK_PARAMS.wallInkWeight && typeof INK_PARAMS.wallInkWeight === 'object', 'wallInkWeight table present');
});

test('U438-F: the drawn model exposes each structure\'s shell for the material selection (timber for the boot cottage)', () => {
  const w = boot();
  const st = drawnStructureModel(w, String(w.map.currentNodeId)).structures.find(s => s.structureKey === 'stgen:v27:n3_1515674724:0');
  assert.ok(st, 'precondition: the boot cottage is drawn');
  assert.equal(st.shell, 'timber', 'the boot cottage inks as timber');
  assert.ok(INK_PARAMS.pocheByShell[st.shell], 'the shell resolves a poché style');
});
