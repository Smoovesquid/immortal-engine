// U255 — D-B4 gate residual (d): roll-vs-outcome consistency on a forced barrier.
//
// In the 2026-06-24 Opus gate the Chaos-griefer said "I back up and ram the door
// again, putting my whole weight into it." and the door "swings open" — while the
// roll on record was 8 vs DC 13, a FAILURE. Two deterministic root causes:
//   1. The "back up" leave-token claimed the turn as an EXIT ("step back
//      outside"), which the LLM then polished into a contradictory "swings open".
//   2. "ram" wasn't a recognized force verb, and the target-extractor let the
//      trailing "...into it" hijack the object ("force the it").
//
// Fix: a forceful verb + a barrier noun overrides the ambiguous leave-token; ram/
// barge/bash/etc. route to the OUTCOME-AWARE physical-object renderer; and the
// extractor names the barrier (drops the trailing manner clause). The narration
// now ALWAYS agrees with the mechanical outcome — a failed ram holds, a success
// yields.
//
// docs/playtests/opus-gate-2026-06-24.md (Chaos-griefer — CRUNCH_INCONSISTENCY).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

// A world with a closed door furniture at the current node (a real barrier to ram).
function worldWithDoor(seed) {
  const P = packs();
  const w = beginAdventure(newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), P).world;
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
  if (node) node.furniture = [{ name: 'oak door', state: 'closed', notes: 'banded and barred' }, ...(node.furniture || [])];
  return w;
}

const RAM = 'I back up and ram the door again, putting my whole weight into it.';
const OPENED_RE = /yields|swings open|gives (?:way|at last)|springs open|it gives|breaks open|bursts/i;
const HELD_RE = /holds fast|holds firm|takes the blow|doesn'?t give|won'?t budge|\bholds\b/i;

// ── (a) routing — a rammed door is NOT read as "leave" ──────────────────────

test('U255-a: "back up and ram the door" does not route to a leave/exit', () => {
  const { output } = playerMove(worldWithDoor('tallow'), packs(), RAM);
  assert.doesNotMatch(output.narration, /step back outside/i, 'a ram is a force action, not a leave');
});

// ── (b) the core invariant — narration ALWAYS agrees with the roll ──────────

test('U255-b: across seeds, a FAILED ram never opens the door and a SUCCESS never "holds"', () => {
  const P = packs();
  let sawFail = 0, sawSucceed = 0;
  for (const seed of ['ashfall', 'glass-harbor', 'tallow', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'k9']) {
    const { output } = playerMove(worldWithDoor(seed), P, RAM);
    const n = output.narration || '';
    const m = (output.mechanics || '').match(/→\s*(success|failure|mixed)/i);
    if (!m) continue;
    const outcome = m[1].toLowerCase();
    if (outcome === 'failure') {
      sawFail++;
      assert.ok(!OPENED_RE.test(n), `FAILURE must not open the door [${seed}]: ${n}`);
      assert.match(n, HELD_RE, `FAILURE must say it holds [${seed}]: ${n}`);
    } else if (outcome === 'success') {
      sawSucceed++;
      assert.ok(!HELD_RE.test(n), `SUCCESS must not say it holds [${seed}]: ${n}`);
    }
  }
  // The batch must actually exercise both branches (otherwise the test is vacuous).
  assert.ok(sawFail > 0, 'expected at least one failing roll in the batch');
  assert.ok(sawSucceed > 0, 'expected at least one succeeding roll in the batch');
});

// ── (c) naming — the barrier is named, never "the it" ───────────────────────

test('U255-c: the rammed barrier is named (the trailing "into it" clause never hijacks the target)', () => {
  const { output } = playerMove(worldWithDoor('ashfall'), packs(), RAM);
  assert.match(output.narration, /oak door/i, 'names the actual door');
  assert.doesNotMatch(output.narration, /the it\b/i, 'never "the it"');
});

// ── (d) guard — a plain leave still exits ───────────────────────────────────

test('U255-d: a plain "I back out of here" still reads as a leave', () => {
  const w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
  const { output } = playerMove(w, packs(), 'I back out of here');
  assert.match(output.narration, /step back outside/i, 'a bare leave with no force verb still exits');
});
