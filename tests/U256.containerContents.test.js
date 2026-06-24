// U256 — container contents (first-room playtest #1, FIRST_ROOM_FINDINGS.md).
//
// On seed `tallow` a goal-directed player opened / peered / looked inside the
// iron-bound chest FIVE times and never got its contents — the engine had no path
// from "look inside a present container" → what it holds. Responses were a bare
// echo ("it stands open now"), a room-survey ("Ways lead off east and south"), and
// roll-driven filler. THE_TABLE_TEST: open a chest → the DM states what is inside,
// or that it is empty — never a survey, a roll, or a tease.
//
// Fix: container/storage furniture has deterministic, seeded contents (derived from
// canon, no hashed state); open / look inside / search / "what's inside" a present
// container surfaces them (or says it's empty plainly) before the examine/survey
// floors claim the turn.
//
// Source: docs/playtests/harness/FIRST_ROOM_FINDINGS.md (#1, the goal-blocker).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { containerContents } from '../engine/decompression/generateFurniture.js';
import { runObjectInteraction } from '../engine/harness/oracles.js';
import { getGoal } from '../engine/harness/goals.js';
import { runSession, makeScriptedPlayer, bootWorld } from '../scripts/playtest-harness.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const nodeOf = (w) => w.map.nodes.find(n => n.id === w.map.currentNodeId);
const furnOf = (w, name) => (nodeOf(w).furniture || []).find(f => f.name === name);
const bare = (o) => String(o.narration || '').replace(/^Wizard:\s*/, '');
const SURVEY_RE = /Ways lead off|take stock of your surroundings|take the measure of|read this corner|eyes move slow|Structures:/i;
const ROLL_RE = /\broll:\s*\d+\s*vs\s*DC/i;

// ── containerContents — deterministic, seeded, container-only ─────────────────
test('U256-A: containerContents is deterministic and scoped to containers/storage', () => {
  const a = containerContents('seed', 'n0', 'iron-bound chest', 'container');
  const b = containerContents('seed', 'n0', 'iron-bound chest', 'container');
  assert.deepEqual(a, b, 'same key → same contents');
  // A non-container never holds loot; a different key generally differs.
  assert.deepEqual(containerContents('seed', 'n0', 'straw pallet', 'furniture'), []);
  assert.deepEqual(containerContents('seed', 'n0', 'oil lantern', 'light-source'), []);
  // Across many keys we see empties AND multi-item containers (the empty branch
  // is real, not dead).
  let empty = 0, nonEmpty = 0;
  for (let i = 0; i < 200; i++) {
    const c = containerContents(`s${i}`, `n${i % 5}`, 'iron-bound chest', 'container');
    if (c.length === 0) empty++; else nonEmpty++;
    for (const it of c) assert.equal(typeof it, 'string');
  }
  assert.ok(empty > 0 && nonEmpty > 0, `both empty and non-empty must occur (empty=${empty}, nonEmpty=${nonEmpty})`);
});

// ── The starting room on tallow — the exact repro ─────────────────────────────
test('U256-B: opening the iron-bound chest on tallow surfaces its contents and opens it', () => {
  const w = begin('tallow');
  const chest = furnOf(w, 'iron-bound chest');
  assert.ok(chest && chest.category === 'container', 'tallow starts with an iron-bound chest container');

  const r = playerMove(w, PACKS, 'I open the iron-bound chest');
  const txt = bare(r.output);
  assert.match(txt, /Inside[:,]/i, `open should reveal contents, got: ${txt}`);
  assert.equal(furnOf(r.world, 'iron-bound chest').state, 'open', 'opening persists state=open');
  assert.doesNotMatch(txt, SURVEY_RE, 'never a room-survey');
  assert.doesNotMatch(String(r.output.mechanics || ''), ROLL_RE, 'never a roll');
});

test('U256-C: every inside-directed phrasing reveals contents, not a survey/roll/lid-examine', () => {
  for (const cmd of [
    'I look inside the chest',
    'I search the chest',
    "what's inside the chest?",
    'I peer into the chest',
    'I rummage through the iron-bound chest',
  ]) {
    const w = begin('tallow');
    const r = playerMove(w, PACKS, cmd);
    const txt = bare(r.output);
    assert.match(txt, /Inside[:,]/i, `"${cmd}" should reveal contents, got: ${txt}`);
    assert.doesNotMatch(txt, SURVEY_RE, `"${cmd}" must not bounce a survey: ${txt}`);
    // not the lid/parts examine ("You make out its lid, hinge, lock")
    assert.doesNotMatch(txt, /make out its/i, `"${cmd}" must not be a parts-examine: ${txt}`);
    assert.doesNotMatch(String(r.output.mechanics || ''), ROLL_RE, `"${cmd}" must not roll`);
  }
});

test('U256-D: an empty container says so plainly — not a tease', () => {
  // seed `thistle` starts with an empty wooden crate (deterministic).
  const w = begin('thistle');
  const crate = furnOf(w, 'wooden crate');
  assert.ok(crate && crate.category === 'container', 'thistle starts with a wooden crate');
  assert.deepEqual(containerContents(w.meta.seed, nodeOf(w).id, 'wooden crate', 'container'), [], 'fixture must be empty');

  const r = playerMove(w, PACKS, 'I look inside the wooden crate');
  const txt = bare(r.output);
  assert.match(txt, /empty/i, `empty container must say it plainly, got: ${txt}`);
  assert.doesNotMatch(txt, SURVEY_RE, 'empty is not a survey bounce');
});

test('U256-E: the reveal is deterministic across two boots of the same seed', () => {
  const open = (s) => bare(playerMove(begin(s), PACKS, 'I open the iron-bound chest').output);
  assert.equal(open('tallow'), open('tallow'));
});

// ── The harness oracle stays silent on the (now well-behaved) reveal ──────────
test('U256-F: a container reveal raises NO object-interaction finding (no phantom take / denied object / failed-search loot)', () => {
  const before = begin('tallow');
  const action = 'I look inside the chest';
  const r = playerMove(before, PACKS, action);
  const findings = runObjectInteraction({ before, after: r.world, action, output: r.output });
  assert.equal(findings.length, 0, `unexpected finding: ${JSON.stringify(findings)}`);
});

// ── End-to-end: a player who looks INSIDE every object covers the room and the
// goal completes — the looking-inside path no longer soft-locks the probe-room
// goal (the original symptom was the player stuck re-opening the chest). ────────
test('U256-G: a scripted player who looks inside the room reaches the probe-room goal, clean', async () => {
  const goal = getGoal('probe-room');
  const begun = bootWorld('tallow', PACKS);
  const objs = (nodeOf(begun.world).furniture || []).map(f => f.name);
  assert.ok(objs.length >= 2, `tallow's first room should hold objects (got ${JSON.stringify(objs)})`);

  // Look INSIDE containers, examine the rest — every object gets probed.
  const containerCats = new Set(['container', 'storage']);
  const acts = ['I get out of bed', ...objs.map(name => {
    const f = furnOf(begun.world, name);
    return containerCats.has(String(f.category)) ? `I look inside the ${name}` : `I examine the ${name}`;
  })];

  const r = await runSession({ world: begun.world, packs: PACKS, goal, player: makeScriptedPlayer(acts), turns: 12, openerNarration: begun.output?.narration || '' });

  assert.equal(r.goalCompleted, true, 'probing every object (looking inside containers) should satisfy the goal');
  assert.equal(r.findings.filter(f => f.oracleId === 'object-interaction').length, 0, `object-interaction findings: ${JSON.stringify(r.findings.filter(f => f.oracleId === 'object-interaction'))}`);
  assert.equal(r.findings.filter(f => f.oracleId === 'soft-lock').length, 0, 'no soft-lock: the player can make headway');
});
