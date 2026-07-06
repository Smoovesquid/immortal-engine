#!/usr/bin/env node

/**
 * VIS-ORACLE — the Screen-Truth Oracle (docs/briefs/VIS-ORACLE.md).
 *
 * The engine has a standing truth gate (invariants) and did not break twice last
 * night; the SCREEN had none and did (bed lump · four NPCs drawn indoors). Tim's
 * house law — "the browser screen is the only acceptance instrument" — becomes
 * machinery here: canonical scenes boot headless, the drawn model (the SAME pure
 * read-only public/map projection rails the live renderer consumes — see
 * screenTruth.scenes.mjs) is asserted against ENGINE TRUTH numerically, and a small
 * golden-image set (screenTruth.goldens.mjs) locks the look. MR-ORACLE for pixels:
 * same arc as scripts/positionProbe.mjs — RED against today's live bug, wired into
 * `npm run check` when green (that wiring is deliberately DEFERRED; not done here).
 *
 * The instrument INDEPENDENTLY rediscovers the live wake bug (a figure drawn off
 * its own building) as a PROJECTION_EQUALITY finding. That
 * one scene is EXPECTED-RED today; it is marked (`expectRed: true`) so the run is
 * still legibly GREEN-modulo-the-known-red, and PLAN-SPLIT-1's landing flips it
 * (the U497-todo pattern). No other scene may be red.
 *
 * Determinism: seeded engine, LLM off, zero Math.random, no world mutation outside
 * the engine's own turn path (see scenes.mjs). Two runs → byte-identical findings.
 *
 * Usage:
 *   node scripts/screenTruth.mjs                 # human report + golden status
 *   node scripts/screenTruth.mjs --json          # structured output (for piping)
 *   node scripts/screenTruth.mjs --accept-goldens # regenerate goldens deliberately
 *   npm run playtest:screen                       # the report, via the package script
 *   npm run screen-goldens:accept                 # the accept ritual
 */

import { buildScenes, drawnModel, engineTruth } from './screenTruth.scenes.mjs';
import { runAllAssertions, ASSERTION_CLASSES } from './screenTruth.assertions.mjs';
import {
  rasterizeScene, checkGolden, writeGolden, readGolden, goldenExists, diffRasters,
} from './screenTruth.goldens.mjs';

// ── The one KNOWN-RED scene (the U497-todo pattern for pixels) ────────────────
// The wake interior currently FAILS PROJECTION_EQUALITY: the player token in the
// walkable-place drawn model is seated from the engine floorPlan, but the building
// it stands in is DRAWN from getPlan's catalog plan, so the token renders OFF its
// own building — a figure drawn indoors-but-wrong. INTEGRATION CORRECTION (2026-07-06): REND-TRUTH-1
// landed (b100, sheet-transform fix) and this RED SURVIVED — it is a DISTINCT bug: the building is
// drawn from the catalog getPlan() while the figure seats from the engine's real floorPlan(structure).
// PLAN-SPLIT-1 (queued) unifies to the engine plan; ITS landing flips this to
// GREEN and its golden is captured. Until then it is an EXPECTED red, not a failure.
export const EXPECTED_RED = new Map([
  ['wake_interior', { class: 'PROJECTION_EQUALITY', reason: 'PLAN-SPLIT-1: building drawn from catalog getPlan() vs figure seated from engine floorPlan(structure) — one building, two geometries' }],
]);

/**
 * runScreenTruth() -> { scenes, findings, goldens, seed }.
 * Boots every canonical scene, asserts all five classes, and checks goldens.
 * Nothing throws; a failing assertion becomes a finding. Deterministic.
 */
export function runScreenTruth({ acceptGoldens = false } = {}) {
  const scenes = buildScenes();
  const out = [];
  const allFindings = [];
  const goldens = [];

  for (const sc of scenes) {
    const model = drawnModel(sc.world, sc.nodeId);
    model.__world = sc.world; // combat identity read + rasterizer
    const truth = engineTruth(sc.world, sc.nodeId);
    const findings = runAllAssertions(model, truth, sc.id);

    // Split findings into expected-red vs unexpected (real failures).
    const expect = EXPECTED_RED.get(sc.id) || null;
    const expected = [], unexpected = [];
    for (const fnd of findings) {
      if (expect && fnd.class === expect.class) expected.push(fnd);
      else unexpected.push(fnd);
    }
    for (const fnd of findings) allFindings.push({ ...fnd, step: sc.id, expected: !!(expect && fnd.class === expect.class) });

    // Golden: capture only when the scene's TRUTH assertions pass (no unexpected
    // findings and — for a scene that is NOT known-red — no findings at all). The
    // red scene's golden lands with the flip (goldenEligible false while red).
    const truthClean = unexpected.length === 0 && (expect ? true : findings.length === 0);
    const goldenEligible = truthClean && !expect; // never golden a still-red scene
    const raster = rasterizeScene(model);
    let golden;
    if (acceptGoldens) {
      if (goldenEligible) { writeGolden(sc.id, raster); golden = { id: sc.id, status: 'accepted' }; }
      else golden = { id: sc.id, status: expect ? 'skipped-red' : 'skipped-unclean' };
    } else {
      golden = goldenEligible ? checkGolden(sc.id, raster) : { id: sc.id, status: expect ? 'pending-red' : 'pending-unclean' };
    }
    goldens.push(golden);

    out.push({
      id: sc.id, nodeId: sc.nodeId, timeOfDay: sc.timeOfDay, note: sc.note,
      interior: truth.interior ? truth.interior.structureKey : null,
      counts: { structures: model.wu.structures.length, decoratives: model.wu.decoratives.length, people: model.wu.people.length, props: model.wu.props.length },
      findings, expected, unexpected,
      expectRed: !!expect,
    });
  }

  return { scenes: out, findings: allFindings, goldens, seed: 'aldermere' };
}

// ── The accept ritual (screen-goldens:accept) ────────────────────────────────
// Regenerate goldens deliberately and print exactly what changed. Prints a per-
// scene before/after fraction so a deliberate look-change is auditable.
export function acceptGoldens() {
  const before = new Map();
  const scenes = buildScenes();
  for (const sc of scenes) {
    if (!goldenExists(sc.id)) continue;
    try { before.set(sc.id, readGolden(sc.id).data); } catch { /* unreadable → treat as new */ }
  }
  const result = runScreenTruth({ acceptGoldens: true });
  const changes = [];
  for (const sc of scenes) {
    const model = drawnModel(sc.world, sc.nodeId); model.__world = sc.world;
    const after = rasterizeScene(model);
    const prev = before.get(sc.id);
    const g = result.goldens.find(x => x.id === sc.id);
    if (g && g.status === 'accepted') {
      if (!prev) changes.push({ id: sc.id, kind: 'new' });
      else { const d = diffRasters(prev, after); changes.push({ id: sc.id, kind: d.changed ? 'changed' : 'unchanged', fraction: d.fraction }); }
    }
  }
  return { changes, goldens: result.goldens };
}

// ─────────────────────────────────────────────────────────────────────────────
//  CLI
// ─────────────────────────────────────────────────────────────────────────────
function isMain() {
  try { return import.meta.url === `file://${process.argv[1]}`; }
  catch { return false; }
}

function printHuman(result) {
  const line = (s = '') => process.stdout.write(s + '\n');
  line(`\n${'═'.repeat(72)}`);
  line('VIS-ORACLE — THE SCREEN-TRUTH ORACLE');
  line(`${'═'.repeat(72)}`);
  line(`seed: ${result.seed}   (LLM off — deterministic; drawn model = the live renderer's own read rails)`);
  line(`${'─'.repeat(72)}`);

  for (const s of result.scenes) {
    const red = s.unexpected.length > 0;
    const tag = red ? '✗ RED' : (s.expectRed ? '● EXPECTED-RED' : '✓ green');
    line(`\n▸ ${s.id}  [${tag}]   ${s.note}`);
    line(`   node ${s.nodeId} · ${s.timeOfDay}${s.interior ? ` · inside ${s.interior}` : ''}`);
    line(`   drawn: ${s.counts.structures} structures · ${s.counts.decoratives} decoratives · ${s.counts.people} people · ${s.counts.props} props`);
    if (s.expected.length) for (const fnd of s.expected) line(`   expected-red [${fnd.class}]: ${fnd.detail}`);
    if (s.unexpected.length) for (const fnd of s.unexpected) line(`   UNEXPECTED [${fnd.class}]: ${fnd.detail}`);
    const g = result.goldens.find(x => x.id === s.id);
    if (g) line(`   golden: ${g.status}${g.fraction != null ? ` (Δ ${(g.fraction * 100).toFixed(2)}%)` : ''}`);
  }

  // Summary.
  const unexpected = result.findings.filter(f => !f.expected);
  const expected = result.findings.filter(f => f.expected);
  const goldenDrift = result.goldens.filter(g => g.status === 'drift');
  const goldenMissing = result.goldens.filter(g => g.status === 'missing');
  line(`\n${'─'.repeat(72)}`);
  line('SUMMARY');
  line(`${'─'.repeat(72)}`);
  line(`   ${expected.length} expected-red finding(s) (the known wake bug — PLAN-SPLIT-1 flips these)`);
  line(`   ${unexpected.length} UNEXPECTED finding(s)${unexpected.length ? ' — THIS IS A REGRESSION' : ''}`);
  line(`   goldens: ${result.goldens.filter(g => g.status === 'ok' || g.status === 'accepted').length} ok · ${goldenDrift.length} drift · ${goldenMissing.length} missing · ${result.goldens.filter(g => String(g.status).startsWith('pending')).length} pending`);
  if (unexpected.length) {
    line('');
    const byClass = {};
    for (const fnd of unexpected) (byClass[fnd.class] = byClass[fnd.class] || []).push(fnd);
    for (const [cls, fs] of Object.entries(byClass)) {
      line(`   [${cls}] — ${ASSERTION_CLASSES[cls] || 'Unknown'}`);
      for (const fnd of fs) line(`     • (${fnd.step}) ${fnd.detail}`);
    }
  }
  line(`${'═'.repeat(72)}\n`);
}

if (isMain()) {
  const asJson = process.argv.includes('--json');
  const doAccept = process.argv.includes('--accept-goldens');

  if (doAccept) {
    const res = acceptGoldens();
    if (asJson) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
    else {
      const line = (s = '') => process.stdout.write(s + '\n');
      line('\nVIS-ORACLE — goldens accepted:');
      for (const c of res.changes) line(`   ${c.id}: ${c.kind}${c.fraction != null ? ` (Δ ${(c.fraction * 100).toFixed(2)}%)` : ''}`);
      const skipped = res.goldens.filter(g => String(g.status).startsWith('skipped'));
      for (const g of skipped) line(`   ${g.id}: ${g.status} (not golden-eligible yet)`);
      line('');
    }
    process.exit(0);
  }

  const result = runScreenTruth();
  if (asJson) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else printHuman(result);

  // Exit code: RED only on an UNEXPECTED finding or a golden drift/size failure.
  // The known wake red is expected → does not fail the run (until REND-TRUTH-1
  // lands and flips it). Missing/pending goldens do NOT fail (they land with the
  // flip / on first accept). This mode is NOT wired into `npm run check` yet.
  const unexpected = result.findings.filter(f => !f.expected).length;
  const goldenFail = result.goldens.filter(g => g.status === 'drift').length;
  process.exit((unexpected + goldenFail) > 0 ? 1 : 0);
}
