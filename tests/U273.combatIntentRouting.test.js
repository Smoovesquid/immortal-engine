// U273 — combat intent-routing residuals (W2·1 correctness floor, harness LLM-off
// probe on seed 'tallow', 2026-06-24). Two seams where an attack aimed at the live
// foe was swallowed instead of resolving a roll:
//
//   (A) PLAYLOOP bounce — "I grab him and slam him into the wall" with TWO live
//       foes present hit the combat scene-object gate ([combat:table-talk],
//       "make a mess of the room … name the foe") and wasted the turn. A pronoun
//       target with >1 foe never set `explicitAction`, so the environment-as-weapon
//       attack read as idle room business. (The resolver already handles it when a
//       foe is NAMED — only the pronoun+multifoe path mis-bounced.)
//   (B) RESOLVER mis-tag — "I throw my dagger into his throat" / "throw sand in his
//       eyes then stab him" were classified as a martial grapple THROW (a throw of
//       the FOE, which needs a grip first) → [grapple:throw-no-grip], no roll, no
//       damage. parseGrappleVerb over-matched a bare "throw <object>". A grapple
//       throw is throwing the FOE ("throw her to the ground", "suplex"); throwing an
//       OBJECT at the foe is a strike.
//
// Both are the H-92 / U248 class ("an attack aimed at the foe must RESOLVE a roll").
// Deterministic, LLM-off.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { parseGrappleVerb } from '../engine/combat/grapple.js';
import { playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// activeCombatWorld (one Lingerer) with the foe's hp/ac overridden + a chosen seed.
function combat({ seed, hp = 20, ac = 1, maxHp = 20 }) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, hp, ac, maxHp }));
  return ensureWorld({ ...base, meta: { ...base.meta, seed }, combat: { ...base.combat, enemies } });
}
function foe(world) { return world.combat?.enemies?.[0]; }

// A two-foe combat world: the Lingerer + a second hostile ("Ashblade"), so a bare
// pronoun ("him") is ambiguous — the exact shape that broke seam (A).
function twoFoeCombat({ seed = 'b', ac = 1 } = {}) {
  const base = combat({ seed, hp: 20, ac });
  const e0 = base.combat.enemies[0];
  const e1 = { ...e0, id: `${e0.id}_2`, name: 'Ashblade', hp: 20, maxHp: 20, ac, defeated: false };
  return ensureWorld({ ...base, combat: { ...base.combat, enemies: [e0, e1] } });
}

// ── Seam A — playloop scene-object bounce ─────────────────────────────────────
test('U273-A: "grab him and slam him into the wall" (two foes) resolves a strike, not table-talk', () => {
  const w = twoFoeCombat();
  const { output } = playerMove(w, PACKS, 'I grab him and slam him into the wall.');
  const mech = String(output?.mechanics || '');
  assert.doesNotMatch(mech, /combat:table-talk/, `must not bounce to table-talk: ${mech}`);
  assert.match(mech, /strike:/, `environment-as-weapon attack must resolve a strike: ${mech}`);
});

test('U273-A: a NAMED foe slam still resolves (regression — the path that already worked)', () => {
  const w = twoFoeCombat();
  const { output } = playerMove(w, PACKS, 'I slam Ashblade headfirst into the stone wall.');
  assert.match(String(output?.mechanics || ''), /strike:/);
});

test('U273-A: pure scene-object business mid-fight still bounces (no over-match)', () => {
  // "kick the door" with no foe object is room business, not an attack — must stay
  // table-talk so the resolver does not fabricate a swing.
  const w = twoFoeCombat();
  const { output } = playerMove(w, PACKS, 'I kick the door.');
  assert.match(String(output?.mechanics || ''), /combat:table-talk/, `room business must still bounce: ${output?.mechanics}`);
});

// ── Seam B — grapple-throw over-match on a thrown OBJECT ───────────────────────
test('U273-B: parseGrappleVerb does NOT read a thrown object as a grapple throw', () => {
  assert.equal(parseGrappleVerb('I throw my dagger into his throat'), null);
  assert.equal(parseGrappleVerb('I throw sand in his eyes'), null);
  assert.equal(parseGrappleVerb('I throw the rock at the bandit'), null);
  assert.equal(parseGrappleVerb('I hurl the lantern at it'), null);
});

test('U273-B: parseGrappleVerb still reads a thrown FOE as a grapple throw', () => {
  assert.equal(parseGrappleVerb('I throw her to the ground'), 'throw');   // U151 contract
  assert.equal(parseGrappleVerb('I throw him down'), 'throw');
  assert.equal(parseGrappleVerb('I suplex the brute'), 'throw');
  assert.equal(parseGrappleVerb('I take him down'), 'throw');
});

test('U273-B: "throw my dagger into his throat" resolves a strike, not throw-no-grip', () => {
  const before = 20;
  const r = resolveEscapeCombatTurn(combat({ seed: 'b', hp: before }), 'I throw my dagger into the Lingerer\'s throat.');
  assert.doesNotMatch(r.result.mechanicsLine, /grapple:throw-no-grip/, `object-throw must not read as a grapple: ${r.result.mechanicsLine}`);
  assert.match(r.result.mechanicsLine, /strike:/, `thrown weapon at the foe must resolve a strike: ${r.result.mechanicsLine}`);
  assert.ok(foe(r.world).hp < before, `damage must land: ${before} -> ${foe(r.world).hp}`);
});

test('U273-B: "throw sand in his eyes then stab him" resolves a strike', () => {
  const before = 20;
  const r = resolveEscapeCombatTurn(combat({ seed: 'b', hp: before }), 'I throw sand in his eyes then stab him.');
  assert.doesNotMatch(r.result.mechanicsLine, /grapple:throw-no-grip/, `blinding feint + stab must not read as a grapple: ${r.result.mechanicsLine}`);
  assert.match(r.result.mechanicsLine, /strike:/, `the stab must resolve a strike: ${r.result.mechanicsLine}`);
  assert.ok(foe(r.world).hp < before, `damage must land: ${before} -> ${foe(r.world).hp}`);
});

// A real grapple throw — including a foe named by role-noun ("the bandit") — is
// still routed to 'throw' (the resolver then requires a grip). Only OBJECT throws
// were stripped out.
test('U273-B: a foe-throw by role-noun is still a grapple intent (no regression)', () => {
  assert.equal(parseGrappleVerb('I throw the bandit to the ground'), 'throw');
});
