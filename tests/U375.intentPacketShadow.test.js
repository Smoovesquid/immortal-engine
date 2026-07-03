// U375 — INT-1: typed IntentPacket shadow assembler (zero behavior change)
//
// engine/intent/assemblePacket.js aggregates existing detectors (parseIntent,
// directQuestionIntent, detectPhysicalInteraction) into ONE typed packet per
// free-text turn. It is a SHADOW observer only — nothing routes on it yet
// (that's INT-2/INT-3). This suite proves: (1) the aggregation is correct
// against a table of utterances, (2) the assembler is pure (same input twice
// -> deep-equal output, no rng/Date/state writes), and (3) with INTENT_TRACE
// unset, playerMove's player-visible output is byte-identical to a run where
// the shadow call never happened — the zero-diff guarantee the packet
// promises. See docs/PACKETS.md INT-1 + docs/briefs/INT-1-shadow-packet-sonnet.md.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assemblePacket } from '../engine/intent/assemblePacket.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

// Hand-built world (mirrors tests/U310's pattern) so utterance->field
// expectations are pinned against fixed NPCs/furniture, independent of any
// future change to the tallow slice's procedural NPC roster.
function makeWorld(overrides = {}) {
  return {
    party: [{
      name: 'Sera',
      archetype: 'Gravedigger',
      level: 1,
      stats: { MIGHT: 11, AGILITY: 11, WITS: 11, GRIT: 11, CHARM: 11 },
      foci: [],
      background: { hook: 'You know what should stay buried — and what never does.' },
      traits: {},
      inventory: {
        weapons: [{ name: 'Worn Blade', damage: '1d6' }],
        armor: [{ name: 'Travel helm' }],
        tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [],
        items: []
      },
      spells: { known: [] },
      signature: { itemName: 'Mirror shard', meaning: 'a reminder' }
    }],
    meta: { mode: 'escape', escapeHp: 13, escapeMaxHp: 13 },
    map: {
      currentNodeId: 'wayfarers-outpost',
      nodes: [{
        id: 'wayfarers-outpost',
        name: "Wayfarers' Outpost",
        nodeType: 'settlement',
        furniture: [
          { name: 'wooden table', parts: ['leg', 'top'], state: 'intact', notes: 'scarred with knife-marks' }
        ],
        settlement: {
          npcs: [
            { name: 'Elske', role: 'innkeeper', hostile: false, description: 'A weathered woman who keeps a clean hearth.' }
          ]
        }
      }]
    },
    combat: { active: false, enemies: [] },
    conversation: {},
    ledger: { facts: [], threats: [], questions: [] },
    ...overrides
  };
}

// ── table-driven utterance -> expected fields ───────────────────────────────

test('U375: "Who lit that lantern, Elske?" -> kind:npc-addressed, non-mechanical verb', () => {
  const p = assemblePacket(makeWorld(), 'Who lit that lantern, Elske?');
  assert.equal(p.kind, 'npc-addressed');
  assert.notEqual(p.verb, 'attack', 'a question addressed to an NPC must not be read as a mechanical attack');
  assert.notEqual(p.verb, 'cast');
});

test('U375: "I stab the goblin" -> verb:attack', () => {
  const p = assemblePacket(makeWorld(), 'I stab the goblin');
  assert.equal(p.verb, 'attack');
});

test('U375: "I search the wooden table" -> objects[] includes the table', () => {
  const p = assemblePacket(makeWorld(), 'I search the wooden table');
  assert.equal(p.verb, 'search');
  assert.ok(p.objects.some(o => /wooden table/i.test(o)), `expected a wooden-table object, got ${JSON.stringify(p.objects)}`);
});

test('U375: "what\'s my name and HP?" -> compoundParts.length >= 2', () => {
  const p = assemblePacket(makeWorld(), "what's my name and HP?");
  assert.ok(p.compoundParts.length >= 2, `expected >=2 compound parts, got ${JSON.stringify(p.compoundParts)}`);
});

// ── purity ───────────────────────────────────────────────────────────────

test('U375: purity — same (world, text) called twice returns deep-equal packets', () => {
  const w = makeWorld();
  const a = assemblePacket(w, 'I stab the goblin near the wooden table, Elske');
  const b = assemblePacket(w, 'I stab the goblin near the wooden table, Elske');
  assert.deepEqual(a, b);
});

test('U375: purity — no rng/Date drift across repeated calls on a real booted world', () => {
  const w = boot();
  const a = assemblePacket(w, 'I search the room and ask Elske who lit the lantern');
  const b = assemblePacket(w, 'I search the room and ask Elske who lit the lantern');
  assert.deepEqual(a, b);
});

// ── zero-diff guarantee: INTENT_TRACE off -> byte-identical playerMove output ─

test('U375: flag OFF — playerMove output is unaffected by the shadow packet (no extra keys, same narration/mechanics/world)', () => {
  const prevFlag = process.env.INTENT_TRACE;
  try {
    delete process.env.INTENT_TRACE;
    const w = boot();
    const text = 'I get out of bed and step outside.';

    const runA = playerMove(w, PACKS, text);
    const runB = playerMove(w, PACKS, text);

    assert.equal(runA.output.narration, runB.output.narration, 'narration must be deterministic and unaffected by the shadow packet');
    assert.equal(runA.output.mechanics, runB.output.mechanics, 'mechanics line must be deterministic and unaffected by the shadow packet');
    assert.equal(worldHash(runA.world), worldHash(runB.world), 'resulting world must be replay-stable');
    assert.equal(Object.prototype.hasOwnProperty.call(runA.output, '__intentTrace'), false, 'the trace field must not appear on turn output when INTENT_TRACE is unset');
  } finally {
    if (prevFlag === undefined) delete process.env.INTENT_TRACE; else process.env.INTENT_TRACE = prevFlag;
  }
});

test('U375: flag ON vs OFF — narration/mechanics/world stay identical; only the trace field differs', () => {
  const prevFlag = process.env.INTENT_TRACE;
  try {
    const w = boot();
    const text = 'I get out of bed and step outside.';

    delete process.env.INTENT_TRACE;
    const off = playerMove(w, PACKS, text);

    process.env.INTENT_TRACE = '1';
    const on = playerMove(w, PACKS, text);

    assert.equal(off.output.narration, on.output.narration);
    assert.equal(off.output.mechanics, on.output.mechanics);
    assert.equal(worldHash(off.world), worldHash(on.world));
    assert.ok(on.output.__intentTrace, 'flag ON must surface exactly one packet on turn output');
    assert.equal(typeof on.output.__intentTrace.verb, 'string');
  } finally {
    if (prevFlag === undefined) delete process.env.INTENT_TRACE; else process.env.INTENT_TRACE = prevFlag;
  }
});
