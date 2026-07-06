#!/usr/bin/env node

/**
 * VIS-ORACLE — the truth assertions (docs/briefs/VIS-ORACLE.md).
 *
 * Five byte-deterministic assertion classes, mirroring scripts/positionProbe.mjs's
 * finding format ({ class, detail, context }, no throw, no mutation). Each is a
 * PURE function of (drawnModel, engineTruth[, combatScene]) — same (world) in →
 * same findings out, so two runs emit byte-identical output.
 *
 * The classes (docs/MAP_REAL.md promises 2 & 3, in RENDERED space):
 *   PROJECTION_EQUALITY — every rendered token/mini sits at the exact transform of
 *                         its engine-truth position (player marker inside its own
 *                         structure's ENGINE-plan rect; combat cells == engine
 *                         cells; the placeUnit player token inside its own drawn
 *                         building).
 *   PHANTOM             — nothing rendered without an engine-truth source (every
 *                         people token maps to an outdoor occupant; every board
 *                         enemy to a world.combat enemy; every drawn structure to a
 *                         real structure at the node).
 *   MISSING             — engine-truth entities within the frame must be rendered
 *                         (every real structure drawn; every live board enemy drawn).
 *   LAYER_ORIGIN        — all layer groups share one origin transform: the player
 *                         marker's structure rect and the drawn-structure rect for
 *                         the SAME key must coincide (generalizes REND-TRUTH-1's
 *                         one-origin guard — a dragged people/marker anchor shows
 *                         as two rects for one building).
 *   INK_EXCLUSION       — no figure inside foreign plan ink (TT-OCC re-checked in
 *                         rendered space): no people token inside a structure or
 *                         decorative rect (+ margin) that isn't its own.
 *
 * Thresholds are documented inline. EPS is a tight numeric tie for "same transform"
 * (both sides are deterministic doubles from the same pinned cell math; anything
 * beyond floating-noise is a real divergence). NPC_MARGIN_LU mirrors placeFromNode's
 * TT-OCC margin so INK_EXCLUSION reads at the SAME setback the placement enforces.
 *
 * Combat reads come pre-projected on `model.combat` (the board read contract, from
 * scenes.mjs); the raw `world.combat` truth is on `model.__world` for the identity
 * comparison. No projection module is imported here — everything is a pure read of
 * the already-built drawn model and truth.
 */

// A "same transform" tolerance. Both sides come from the same deterministic
// double-precision cell math; a mismatch above this is a genuine projection
// divergence, not rounding. (place-units are ~4 m each, wu ~1 m, so 1e-6 units is
// sub-millimetre — far below any real drift.)
export const EPS = 1e-6;

// TT-OCC margin (place-units), pinned to placeFromNode.js's NPC_MARGIN_LU so the
// rendered-space exclusion reads at the SAME setback the scatter placement uses
// (wall stroke + token footprint). See public/map/placeFromNode.js's derivation.
export const NPC_MARGIN_LU = 1.2;
// The wu equivalent of that margin (PLACE_WU = 4 wu / place-unit).
export const NPC_MARGIN_WU = NPC_MARGIN_LU * 4;

function inRect(x, y, r, m = 0) {
  return r && x >= r.minX - m && x <= r.maxX + m && y >= r.minY - m && y <= r.maxY + m;
}
function f(n) { return (typeof n === 'number' && Number.isFinite(n)) ? Number(n.toFixed(3)) : n; }

// ─────────────────────────────────────────────────────────────────────────────
//  PROJECTION_EQUALITY
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The player marker/token must sit at the transform of the player's engine
 * position, INSIDE the very structure the engine says they're standing in:
 *   • wu marker (playerFocusWu) ∈ the structure's ENGINE-plan rect (playerRect);
 *   • placeUnit player token ∈ the same structure's place-unit rect
 *     (playerPlaceUnitRect).
 * Combat: every drawn board cell must equal the engine cell (the read contract is
 * identity, so any post-clamp divergence is a projection break).
 */
export function assertProjectionEquality(model, truth, ctx = '') {
  const findings = [];

  // Interior player marker (wu) must be inside the engine-plan rect.
  if (truth.interior && truth.playerRect) {
    const p = model.wu.player;
    if (!p) {
      findings.push({ class: 'PROJECTION_EQUALITY', detail: `player is inside ${truth.interior.structureKey} but the drawn marker (playerFocusWu) is null — the body has no rendered position`, context: ctx });
    } else if (!inRect(p.wx, p.wy, truth.playerRect)) {
      findings.push({ class: 'PROJECTION_EQUALITY', detail: `player marker wu(${f(p.wx)},${f(p.wy)}) is OUTSIDE its own structure ${truth.interior.structureKey} engine-plan rect [${f(truth.playerRect.minX)},${f(truth.playerRect.minY)}..${f(truth.playerRect.maxX)},${f(truth.playerRect.maxY)}] — the marker is drawn off the building the engine says the body is in`, context: ctx });
    }
  }

  // Interior player TOKEN (place-unit space) must be inside its own drawn building.
  if (truth.interior && truth.playerPlaceUnitRect && model.placeUnit) {
    const tok = (model.placeUnit.tokens || []).find(t => t.type === 'player');
    if (tok) {
      if (!inRect(tok.ux, tok.uy, truth.playerPlaceUnitRect)) {
        findings.push({ class: 'PROJECTION_EQUALITY', detail: `player token place-unit(${f(tok.ux)},${f(tok.uy)}) is OUTSIDE its own structure ${truth.interior.structureKey} floorPlan rect [${f(truth.playerPlaceUnitRect.minX)},${f(truth.playerPlaceUnitRect.minY)}..${f(truth.playerPlaceUnitRect.maxX)},${f(truth.playerPlaceUnitRect.maxY)}] — the drawn token sits off the building the engine says the body is in`, context: ctx });
      }
    }
  }

  // Combat board — drawn cells must equal engine cells (identity read contract).
  // model.combat is the board read contract (combatSceneFromWorld) render3d's
  // buildTacticalBoard draws each mini from; truth.combat.enemies is the raw
  // world.combat truth. Any post-clamp divergence is a projection break.
  if (truth.combat.active && model.combat) {
    const scene = model.combat;
    const eng = model.__world?.combat || {};
    const epc = eng.playerCell || {};
    if (Number.isInteger(epc.cx) && (scene.player.cx !== epc.cx || scene.player.cy !== epc.cy)) {
      findings.push({ class: 'PROJECTION_EQUALITY', detail: `combat: drawn player cell (${scene.player.cx},${scene.player.cy}) != engine player cell (${epc.cx},${epc.cy})`, context: ctx });
    }
    const engById = new Map((eng.enemies || []).map((e, i) => [String(e?.id ?? `enemy_${i}`), e]));
    for (const se of scene.enemies) {
      const ee = engById.get(se.id);
      if (ee && (se.cx !== ee.cx || se.cy !== ee.cy)) {
        findings.push({ class: 'PROJECTION_EQUALITY', detail: `combat: drawn enemy ${se.id} cell (${se.cx},${se.cy}) != engine cell (${ee.cx},${ee.cy})`, context: ctx });
      }
      if (ee && se.defeated !== !!ee.defeated) {
        findings.push({ class: 'PROJECTION_EQUALITY', detail: `combat: drawn enemy ${se.id} defeated=${se.defeated} != engine defeated=${!!ee.defeated} (corpse-swap out of step)`, context: ctx });
      }
    }
  }

  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  PHANTOM — nothing drawn without an engine source.
// ─────────────────────────────────────────────────────────────────────────────
export function assertPhantom(model, truth, ctx = '') {
  const findings = [];
  const outdoor = new Set(truth.outdoorNames.map(String));
  // Every drawn people token must trace to an outdoor occupant (masked hostiles
  // render as name '?' but ARE a real occupant — they are exempt from the name
  // match, since MAP-OCC-1 deliberately hides their identity, not their presence).
  for (const p of model.wu.people) {
    if (p.hostile) continue;
    if (p.name && !outdoor.has(p.name)) {
      findings.push({ class: 'PHANTOM', detail: `drawn person "${p.name}" at wu(${f(p.wx)},${f(p.wy)}) has no engine outdoor-occupant source (occupants: [${truth.outdoorNames.join(', ')}])`, context: ctx });
    }
  }
  // Every drawn structure must be a real structure at this node.
  const realKeys = new Set(truth.structureKeys.map(String));
  for (const s of model.wu.structures) {
    if (!realKeys.has(s.structureKey)) {
      findings.push({ class: 'PHANTOM', detail: `drawn structure ${s.structureKey} has no engine structure at node ${truth.nodeId}`, context: ctx });
    }
  }
  // Combat: every drawn enemy must trace to a world.combat enemy.
  if (truth.combat.active && model.combat) {
    const engIds = new Set(truth.combat.enemies.map(e => e.id));
    for (const se of model.combat.enemies) {
      if (!engIds.has(se.id)) {
        findings.push({ class: 'PHANTOM', detail: `combat: drawn enemy ${se.id} ("${se.name}") has no world.combat source`, context: ctx });
      }
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MISSING — engine entities in frame must be drawn.
// ─────────────────────────────────────────────────────────────────────────────
export function assertMissing(model, truth, ctx = '') {
  const findings = [];
  // Every real structure at the node must be drawn (drawnStructureModel omits only
  // structures with NO topology — those have nothing to draw; a real structure with
  // rooms that is absent is a MISSING). During combat the tactical board owns the
  // scene and the settlement structures are deliberately not drawn (render3d's
  // combat branch skips them), so the structure check applies to non-combat scenes.
  const drawnKeys = new Set(model.wu.structures.map(s => s.structureKey));
  if (!truth.combat.active) for (const key of truth.structureKeys) {
    if (!drawnKeys.has(key)) {
      // Only a MISSING if the structure actually has a drawable plan (rooms).
      const st = model.__world?.structures?.byId?.[key];
      const hasRooms = st && Array.isArray(st.rooms) ? st.rooms.length > 0 : true;
      if (hasRooms && !drawnKeys.has(key)) {
        findings.push({ class: 'MISSING', detail: `engine structure ${key} at node ${truth.nodeId} is not in the drawn structure set`, context: ctx });
      }
    }
  }
  // Combat: every live (non-defeated OR defeated-corpse) enemy the engine has must
  // be drawn on the board (a defeated foe becomes a corpse mini, still present).
  if (truth.combat.active && model.combat) {
    const drawnEnemyIds = new Set(model.combat.enemies.map(e => e.id));
    for (const e of truth.combat.enemies) {
      if (!drawnEnemyIds.has(e.id)) {
        findings.push({ class: 'MISSING', detail: `combat: engine enemy ${e.id} ("${e.name}") is not drawn on the board`, context: ctx });
      }
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  LAYER_ORIGIN — every layer group shares one origin transform.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * For an interior scene, the player-marker layer and the building-ink layer must
 * agree on WHERE the interior structure is: the marker's structure rect (the box
 * the marker is placed relative to, playerRect) must coincide with the SAME
 * structure's drawn rect (drawnStructureModel). A divergence means the two layers
 * were placed from different origins — exactly the class of bug where a figure
 * draws off its building. Coincidence is checked to EPS on all four edges.
 */
export function assertLayerOrigin(model, truth, ctx = '') {
  const findings = [];
  if (!truth.interior || !truth.playerRect) return findings;
  const drawn = model.wu.structures.find(s => s.structureKey === truth.interior.structureKey);
  if (!drawn) {
    findings.push({ class: 'LAYER_ORIGIN', detail: `interior structure ${truth.interior.structureKey} has a marker rect but is not in the drawn structure layer — the marker layer and the ink layer disagree on its existence`, context: ctx });
    return findings;
  }
  const a = truth.playerRect, b = drawn.rect;
  const off = ['minX', 'minY', 'maxX', 'maxY'].filter(k => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) > EPS);
  if (off.length) {
    findings.push({ class: 'LAYER_ORIGIN', detail: `interior structure ${truth.interior.structureKey}: marker-layer rect [${f(a.minX)},${f(a.minY)}..${f(a.maxX)},${f(a.maxY)}] != ink-layer rect [${f(b.minX)},${f(b.minY)}..${f(b.maxX)},${f(b.maxY)}] (differ on ${off.join(',')}) — layers do not share one origin`, context: ctx });
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  INK_EXCLUSION — no figure inside foreign plan ink (rendered space).
// ─────────────────────────────────────────────────────────────────────────────
/**
 * No people token may render inside a structure or decorative building rect that
 * is not its own (people are outdoors; the plan ink is not theirs). Checked in wu
 * with NPC_MARGIN_WU (the same setback placeFromNode's scatter enforces in
 * place-units, converted). A people token has no "own" building (they're outdoors),
 * so ANY containing rect is foreign — this is the TT-OCC law (U494) restated on the
 * rendered wu geometry rather than the place-unit scatter.
 */
export function assertInkExclusion(model, truth, ctx = '') {
  const findings = [];
  const rects = [
    ...model.wu.structures.map(s => ({ name: s.structureKey, ...s.rect })),
    ...model.wu.decoratives.map(d => ({ name: d.name || d.key, ...d.rect })),
  ].filter(r => r && Number.isFinite(r.minX));
  for (const p of model.wu.people) {
    for (const r of rects) {
      if (inRect(p.wx, p.wy, r, NPC_MARGIN_WU)) {
        findings.push({ class: 'INK_EXCLUSION', detail: `person ${p.name || '?'} at wu(${f(p.wx)},${f(p.wy)}) renders inside foreign ink "${r.name}" [${f(r.minX)},${f(r.minY)}..${f(r.maxX)},${f(r.maxY)}] + ${NPC_MARGIN_WU}wu margin — a figure standing in a room that isn't theirs`, context: ctx });
      }
    }
  }
  return findings;
}

// ─────────────────────────────────────────────────────────────────────────────
//  runAllAssertions — every class against one scene. `model` is drawnModel(world),
//  augmented with __world for the combat identity read (attached by the runner).
// ─────────────────────────────────────────────────────────────────────────────
export const ASSERTION_CLASSES = {
  PROJECTION_EQUALITY: 'A rendered token/mini is not at the transform of its engine position',
  PHANTOM: 'Something is rendered with no engine-truth source',
  MISSING: 'An engine entity in frame is not rendered',
  LAYER_ORIGIN: 'Render layer groups do not share one origin transform',
  INK_EXCLUSION: 'A figure renders inside plan ink that is not its own',
};

export function runAllAssertions(model, truth, ctx = '') {
  return [
    ...assertProjectionEquality(model, truth, ctx),
    ...assertPhantom(model, truth, ctx),
    ...assertMissing(model, truth, ctx),
    ...assertLayerOrigin(model, truth, ctx),
    ...assertInkExclusion(model, truth, ctx),
  ];
}
