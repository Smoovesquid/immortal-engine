// U584 — MP-5b: THE CASSANDRA SURFACES (docs/MORAL_PHYSICS.md §5, docs/briefs/
// MP-5b-the-cassandra.md).
//
// The latch algebra (U583) proves WHEN the beat fires. This file proves what the player
// (and the DM prompt) actually SEE when it does:
//   (a) a REAL PRESENT NPC speaks — never a voice from nowhere;
//   (b) the choice is DETERMINISTIC (same standing → same speaker, run to run);
//   (c) the register is QUIET — no thunder, no sermon, no mechanical demand riding on it;
//   (d) it surfaces for the delivering turn only — U578's own "wall" pattern (zero digits,
//       zero forbidden mechanism words), extended with the mechanic's OWN name ("cassandra")
//       so the beat's identity never leaks into player-facing text either;
//   (e) the LLM-OFF fallback renders a plain one-line version of the SAME beat (the silent-
//       fallback law: the Cassandra exists without the API too).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldTick } from '../engine/worldTick.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt, augmentNarration } from '../engine/llmAdapter.js';
import { cassandraBandFloor } from '../engine/morality/escalation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path.replace(/^\//, '')), 'utf8')));
  return byId;
}
const packs = loadPacks();

function bootOutside(seed) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u584-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  w = playerMove(w, packs, 'go outside').world;
  return w;
}

// A forbidden vocabulary the Cassandra's surfaced line must never contain — U578's own wall
// PLUS the mechanic's own name (the beat's identity must never leak either).
const FORBIDDEN_WORDS = ['corruption', 'heat', 'tier', 'escalation', 'severity', 'cassandra', 'latch', 'armed', '%', 'percent'];

function scriptedCassandraWorld(seed) {
  let w = bootOutside(seed);
  const floor = cassandraBandFloor();
  w = applyDeltas(w, [{ op: 'adjustHeat', by: floor }]);
  w = worldTick(w, `${seed}|cassandra-fire`);
  return w;
}

test('U584-01: A REAL PRESENT NPC SPEAKS — ctx.cassandraOmen names someone actually at the node', () => {
  let w = scriptedCassandraWorld('u584-real');
  assert.ok(w.party[0].morality.cassandraT > 0, 'precondition: the beat was delivered');

  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.cassandraOmen, 'the delivering turn must surface a cassandraOmen');
  assert.equal(typeof ctx.cassandraOmen.role, 'string', 'the omen carries at least a role');

  // The speaker must be someone genuinely present at the node right now (never invented).
  const nodeId = String(w.map.currentNodeId);
  const node = w.map.nodes.find(n => String(n.id) === nodeId);
  const roster = node?.settlement?.npcs || [];
  const rosterHasSomeone = roster.length > 0;
  assert.ok(rosterHasSomeone, 'sanity: the default boot has a real settlement roster here');
  // If a name was surfaced, it must match a real roster NPC's name.
  if (ctx.cassandraOmen.name) {
    assert.ok(roster.some(n => String(n.name) === ctx.cassandraOmen.name),
      `the surfaced name "${ctx.cassandraOmen.name}" must belong to a real NPC at this node`);
  }
  assertWorldInvariants(w);
});

test('U584-02: DETERMINISTIC SPEAKER — the same delivering standing picks the SAME speaker every time', () => {
  const w1 = scriptedCassandraWorld('u584-det');
  const w2 = scriptedCassandraWorld('u584-det');
  const ctx1 = buildNarratorContext(w1, {});
  const ctx2 = buildNarratorContext(w2, {});
  assert.ok(ctx1.cassandraOmen && ctx2.cassandraOmen, 'both runs deliver the beat');
  assert.deepEqual(ctx1.cassandraOmen, ctx2.cassandraOmen, 'identical standing/seed → identical speaker (never Math.random)');
});

test('U584-03: THE QUIET REGISTER — the prompt line never demands anything, never threatens, never sermonizes', () => {
  const w = scriptedCassandraWorld('u584-quiet');
  const ctx = buildNarratorContext(w, {});
  const prompt = buildSystemPrompt(ctx);
  const momentLine = prompt.split('\n').find(l => l.includes('A MOMENT ('));
  assert.ok(momentLine, 'the prompt must carry the Cassandra moment line when the omen is present');

  // The register is QUIET (per docs/MORAL_PHYSICS.md §5 "the Creator's quiet register") —
  // never a shouted threat, never a mechanical demand.
  const lower = momentLine.toLowerCase();
  assert.ok(lower.includes('quiet'), 'the line names its own quiet register explicitly');
  assert.ok(lower.includes('once'), 'the line states this happens once');
  assert.ok(!/\bmust\b|\brequire[sd]?\b|\bfail(?:s|ed)? to\b/.test(lower),
    'the line issues no mechanical demand on the player');
  assertWorldInvariants(w);
});

test('U584-04: THE WALL — zero digits, zero forbidden mechanism words, in the Cassandra prompt line', () => {
  let w = scriptedCassandraWorld('u584-wall');
  // Also push corruption hard, so a maximum-escalation turn (every rung at once) is the
  // scripted scenario — mirrors U578-01's "worst case" discipline.
  w = applyDeltas(w, [{ op: 'axisDelta', axis: 'wrath', by: 100 }]);
  const ctx = buildNarratorContext(w, {});
  assert.ok(ctx.cassandraOmen, 'precondition: the beat is present');

  const prompt = buildSystemPrompt(ctx);
  const momentLine = prompt.split('\n').find(l => l.includes('A MOMENT ('));
  assert.ok(momentLine, 'the prompt carries the moment line');

  assert.ok(!/[0-9]/.test(momentLine), `no digit may appear in the Cassandra line: "${momentLine}"`);
  const lower = momentLine.toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    assert.ok(!lower.includes(word), `the Cassandra line must never contain "${word}": "${momentLine}"`);
  }
});

test('U584-05: ONE TURN ONLY — the delivering turn surfaces the beat; the very next unrelated render does not', () => {
  let w = scriptedCassandraWorld('u584-oneturn');
  const ctxFresh = buildNarratorContext(w, {});
  assert.ok(ctxFresh.cassandraOmen, 'delivering turn: surfaces');

  // Advance the world with a real, unrelated tick (the freshness read keys off the most
  // recent worldTick log entry — any later tick activity supersedes the Cassandra's own
  // entry). Ecology/env residue ticks on almost every call once anything has accrued, so
  // a handful of further ticks reliably produces SOME later tick-log activity.
  let w2 = w;
  for (let i = 0; i < 8 && buildNarratorContext(w2, {}).cassandraOmen; i++) {
    w2 = worldTick(w2, `u584-oneturn|later|${i}`);
  }
  const ctxLater = buildNarratorContext(w2, {});
  assert.equal(ctxLater.cassandraOmen, null, 'a later, unrelated render must NOT re-surface the same delivered beat');

  // And the CANONICAL fact (it fired) is unaffected — the latch itself never un-fires.
  assert.ok(w2.party[0].morality.cassandraT > 0, 'the latch remains set underneath (it only fired once, physically)');
});

test('U584-06: SILENT AT TIER 0 — a fresh, clean boot never surfaces a Cassandra omen', () => {
  const w = bootOutside('u584-clean');
  const ctx = buildNarratorContext(w, {});
  assert.equal(ctx.cassandraOmen, null, 'a clean boot has nothing to warn about');
});

test('U584-07: LLM-OFF FALLBACK — augmentNarration renders a plain one-line version of the SAME beat with no API', async () => {
  const w = scriptedCassandraWorld('u584-fallback');
  const witness = buildNarratorContext(w, {}).cassandraOmen;
  assert.ok(witness, 'precondition: the beat is present on this turn');

  const base = 'Wizard: You take stock of the square.';
  const rendered = await augmentNarration({
    world: w,
    outcome: {},
    baseNarration: base,
    enabled: false, // no API key path — the silent-fallback law
    apiKey: ''
  });

  assert.ok(rendered.startsWith(base), 'the original base narration is preserved, not replaced');
  assert.ok(rendered.length > base.length, 'a plain fallback line was appended for the Cassandra beat');
  assert.ok(!/[0-9]/.test(rendered.slice(base.length)), 'the appended fallback line carries no digit');
  const appendedLower = rendered.slice(base.length).toLowerCase();
  for (const word of FORBIDDEN_WORDS) {
    assert.ok(!appendedLower.includes(word), `the LLM-off fallback line must never contain "${word}"`);
  }
});

test('U584-08: LLM-OFF SILENCE — augmentNarration adds nothing when there is no Cassandra to deliver', async () => {
  const w = bootOutside('u584-nofallback');
  const base = 'Wizard: You take stock of the square.';
  const rendered = await augmentNarration({
    world: w,
    outcome: {},
    baseNarration: base,
    enabled: false,
    apiKey: ''
  });
  assert.equal(rendered, base, 'no Cassandra present → the base narration passes through untouched');
});
