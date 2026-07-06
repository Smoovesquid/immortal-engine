// U588 — WIN-EGRESS-1: a window egress on a MULTI-window interior RESOLVES in the fiction; the DM
// never bounces the intent back as a "which window — east or north?" cardinal menu (THE_DM_TEST.md:
// making the player operate the compass to do what they already said in words is the cardinal sin).
//
// The live-gate reproduction (gate-2026-07-06, Chaos-griefer persona, seed 'tallow', the boot
// Bedchamber has two windows facing east + north):
//   Player: "I climb out through the broken window and run torch-first at the nearest cottage's wall."
//   OLD DM: "There's more than one window — one to the east or one to the north. Which do you go out?"
//           mech [window:exit|which]  → DM_TEST_DEADEND, severity high.
//   NEW DM: picks ONE window deterministically and narrates it — no menu.
//
// The pick is the door pattern (applyEgressRepair's AG-arc sibling), extended to windows:
//   1. a NAMED window side wins,
//   2. else the side the player is HEADING wins if a window faces it (goal-directed),
//   3. else the FIRST facing by the plan's own deterministic order (nearest / most prominent).
// Same world + same utterance ⇒ same window, every time (seeded; no rng ticks on an egress).
// Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { roomWindowFacings } from '../engine/structures/roomWindows.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
// seed 'tallow' boots into a two-window interior (facings east + north) — the gate's own world.
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const GATE = "I climb out through the broken window and run torch-first at the nearest cottage's wall.";
const ROLL_RE = /\[roll:/i;

test('U588: precondition — the boot interior really has more than one window (this is the disambiguation case)', () => {
  const w = boot();
  const facings = roomWindowFacings(w, w.scene.interior);
  assert.ok(facings.length > 1, `expected a multi-window room; got ${JSON.stringify(facings)}`);
  assert.ok(facings.includes('east') && facings.includes('north'), `gate fixture faces east+north; got ${JSON.stringify(facings)}`);
});

test('U588: the gate utterance RESOLVES — one window chosen and narrated, no which-menu, position updated', () => {
  const w = boot();
  const r = playerMove(w, PACKS, GATE);

  // No cardinal menu. The cardinal sin is gone.
  assert.doesNotMatch(r.output.mechanics || '', /\[window:exit\|which\]/, 'must not bounce with a which-menu');
  assert.doesNotMatch(r.output.narration, /which do you go out/i, r.output.narration);
  assert.doesNotMatch(r.output.narration, /there's more than one window/i, r.output.narration);

  // Exactly ONE window chosen, and it is NAMED in the narration + mechanics.
  assert.match(r.output.mechanics || '', /\[window:exit\|(north|east|south|west)\]/, r.output.mechanics);
  assert.match(r.output.narration, /\b(north|east|south|west)-facing window\b/i, r.output.narration);

  // Position updated per the doorstep-egress law: the interior is cleared (you are outside now),
  // and canon records the facing so the map can place you on that side.
  assert.equal(r.world.scene?.interior, null, 'you exit the building — no longer inside');
  const ev = (r.world.timeline || []).filter(e => e?.data?.updateKind === 'interior-exit').slice(-1)[0];
  assert.ok(ev, 'an interior-exit event is recorded in canon');
  assert.match(String(ev.data.windowFacing || ''), /^(north|east|south|west)$/, 'the chosen facing is recorded for the map');

  // Climbing out an accessible window never rolls.
  assert.doesNotMatch(r.output.mechanics || '', ROLL_RE, 'window egress never rolls');
});

test('U588: goal-directed pick — the window facing the way the player is HEADING wins over the default', () => {
  const w = boot();
  const facings = roomWindowFacings(w, w.scene.interior);
  // The default (no heading) picks the FIRST facing by the plan's order …
  const dflt = playerMove(boot(), PACKS, 'climb out the window');
  assert.match(dflt.output.mechanics || '', new RegExp(`\\[window:exit\\|${facings[0]}\\]`), `default picks the first facing (${facings[0]})`);

  // … but stating a heading toward a DIFFERENT available side steers the pick to that side.
  const other = facings.find(f => f !== facings[0]); // e.g. 'north' when the default is 'east'
  const steered = playerMove(boot(), PACKS, `I bolt ${other} and dive out the window toward the treeline`);
  assert.match(steered.output.mechanics || '', new RegExp(`\\[window:exit\\|${other}\\]`), `heading ${other} steers the pick to the ${other} window`);
  assert.notEqual(other, facings[0], 'sanity: the steered pick differs from the default, proving goal-direction changed it');
  assert.equal(steered.world.scene?.interior, null, 'the steered egress also resolves (you are outside)');
});

test('U588: deterministic — the same world + the same utterance choose the same window every time', () => {
  const a = playerMove(boot(), PACKS, GATE);
  const b = playerMove(boot(), PACKS, GATE);
  assert.equal(a.output.mechanics, b.output.mechanics, 'mechanics (chosen window) are identical across runs');
  assert.equal(a.output.narration, b.output.narration, 'narration is identical across runs');
  const fa = (a.world.timeline || []).filter(e => e?.data?.updateKind === 'interior-exit').slice(-1)[0]?.data?.windowFacing;
  const fb = (b.world.timeline || []).filter(e => e?.data?.updateKind === 'interior-exit').slice(-1)[0]?.data?.windowFacing;
  assert.equal(fa, fb, 'the recorded facing is identical across runs');
});
