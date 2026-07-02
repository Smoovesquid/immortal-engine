// U314 — CMB-SINK-1: a forceful advance mid-fight RESOLVES; it never bounces as
// free table-talk. Lineage: opus-gate-2026-07-02-regate-postDTD.md (the Chaos-griefer
// finding). In active escape combat the player declared "I barrel through the doorway,
// knocking anything in my way flat, and sprint into the outpost." — a declared forceful
// action with stakes — and the engine returned [combat:table-talk] with ZERO mechanical
// consequence (no roll, no enemy reaction, the round did not advance). That is a
// DM_TEST_DEADEND.
//
// The rule restored (THE_TABLE_TEST): a forceful advance / shove-through is a combat
// ACTION — an engagement that costs the round and provokes the foes. It is NOT flight
// (escape combat still can't be fled) and NOT idle scene-business. It resolves through
// the escape resolver as move:toward: the round advances, the foes react, and the escape
// law holds (you do not leave the fight — combat stays active).
//
// Deterministic, LLM-off.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
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

// A fresh active escape-combat world (one Lingerer) with a chosen seed.
function combat(seed = 'cmb-sink-1') {
  const base = activeCombatWorld();
  return ensureWorld({ ...base, meta: { ...base.meta, seed } });
}

const REPRO = 'I barrel through the doorway, knocking anything in my way flat, and sprint into the outpost.';

// ── The repro: the forceful advance RESOLVES (round advances + foes react) ─────
test('U314: the forceful-advance repro resolves — round advances, not table-talk', () => {
  const before = combat();
  const { world: after, output } = playerMove(before, PACKS, REPRO);
  const mech = String(output?.mechanics || '');

  assert.doesNotMatch(mech, /combat:table-talk/, `a forceful advance must not bounce to table-talk: ${mech}`);
  assert.equal(after.combat?.round, before.combat.round + 1, `the round must advance (a turn was taken): ${before.combat.round} -> ${after.combat?.round}`);
  assert.match(mech, /\[move:/, `the advance must resolve as a taken move: ${mech}`);
});

test('U314: the advance is an ENGAGEMENT — the escape law holds (combat stays active)', () => {
  // "barrel through … sprint into the outpost" reads as an interior enter, but a
  // forceful advance does NOT leave the fight — combat is still active afterward.
  const { world: after } = playerMove(combat(), PACKS, REPRO);
  assert.equal(after.combat?.active, true, 'the player does not escape the fight — combat stays active');
});

test('U314: the foes react — the advance draws a hit (a mechanical consequence lands)', () => {
  // Seed pinned so the enemy turn's roll is stable: on this seed the Lingerer connects,
  // so the advance costs HP — a consequence the player PAID for, not a free no-op.
  const before = combat('cmb-sink-hit');
  const hp0 = Number(before.meta.escapeHp) || 0;
  const { world: after, output } = playerMove(before, PACKS, REPRO);
  const hp1 = Number(after.meta.escapeHp) || 0;
  assert.ok(hp1 < hp0, `the foe's reaction must land damage (${hp0} -> ${hp1}); mech: ${output?.mechanics}`);
  assert.match(String(output?.mechanics || ''), /\[enemy:/, `the enemy's reacting strike must show in the mechanics: ${output?.mechanics}`);
});

test('U314: the resolved advance is deterministic — same seed, same outcome', () => {
  const a = playerMove(combat('det-seed'), PACKS, REPRO);
  const b = playerMove(combat('det-seed'), PACKS, REPRO);
  assert.equal(String(a.output?.mechanics || ''), String(b.output?.mechanics || ''), 'mechanics must be seed-stable');
  assert.equal(Number(a.world.meta.escapeHp), Number(b.world.meta.escapeHp), 'player HP must be seed-stable');
  assert.equal(a.world.combat?.round, b.world.combat?.round, 'round must be seed-stable');
});

// The whole forceful-advance family resolves (not table-talk).
test('U314: the forceful-advance family all resolve, none bounce to table-talk', () => {
  const family = [
    'I bull my way through them.',
    'I shove past them and push in.',
    'I charge in.',
    'I rush them.',
    'I force my way through.',
    'I knock the nearest one flat and push in.',
  ];
  for (const text of family) {
    const before = combat();
    const { world: after, output } = playerMove(before, PACKS, text);
    const mech = String(output?.mechanics || '');
    assert.doesNotMatch(mech, /combat:table-talk/, `"${text}" must resolve, not bounce: ${mech}`);
    assert.equal(after.combat?.round, before.combat.round + 1, `"${text}" must advance the round: ${mech}`);
  }
});

// ── Diverge guards — the genuine rulings must STAY intact ──────────────────────
test('U314 diverge: genuine flight keeps the no-flee ruling (table-talk, no round advance)', () => {
  for (const text of ['I run for the door and flee.', 'I flee.', 'I run away.', 'I retreat.']) {
    const before = combat();
    const { world: after, output } = playerMove(before, PACKS, text);
    const mech = String(output?.mechanics || '');
    assert.match(mech, /combat:table-talk/, `genuine flight "${text}" must stay the no-flee ruling: ${mech}`);
    assert.equal(after.combat?.round, before.combat.round, `flight must NOT advance the round: ${text}`);
    assert.match(String(output?.narration || ''), /no running from this one/i, `flight gets the no-flee voice: ${output?.narration}`);
  }
});

test('U314 diverge: a real question mid-fight is still answered as table-talk', () => {
  const before = combat();
  const { world: after, output } = playerMove(before, PACKS, 'what are my options?');
  assert.match(String(output?.mechanics || ''), /combat:table-talk/, 'a question is answered for free, no roll');
  assert.equal(after.combat?.round, before.combat.round, 'a question does not advance the round');
});

test('U314 diverge: idle scene-business (no advance) is still table-talk', () => {
  const before = combat();
  const { world: after, output } = playerMove(before, PACKS, 'I pace the room.');
  assert.match(String(output?.mechanics || ''), /combat:table-talk/, 'idle pacing is not an advance');
  assert.equal(after.combat?.round, before.combat.round, 'idle pacing does not advance the round');
});
