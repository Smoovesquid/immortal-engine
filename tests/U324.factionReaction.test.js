// U324 — SP-1: deed→faction reputation (the social-physics producer).
//
// The M2 remainder "faction disposition": a deed witnessed by faction-affiliated NPCs
// moves w.reputation.factions[fid] — direction from the deed kind, MAGNITUDE from the
// deterministic reaction table (engine/social/reactionTable.js), never the LLM
// (Biblioteca Vol 11). Routed through effectsCore's factionRepDelta op. No witnesses →
// institutions never learn. Deterministic: same seed + same script → same hash.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { deedFactionDeltas, FACTION_REP } from '../engine/social/reactionTable.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u322-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

const npcsAt = (w) => { const n = w.map.nodes.find(x => x.id === w.map.currentNodeId); return n?.settlement?.npcs || []; };
const repOf = (w) => ({ ...(w.reputation?.factions || {}) });
// The distinct faction ids among the NPCs standing at the player's node (the witnesses).
const witnessFactions = (w) => {
  const ids = new Set();
  for (const n of npcsAt(w)) { const f = String(n?.factionId || '').trim(); if (f) ids.add(f); }
  return ids;
};

// ── A. The pure table ────────────────────────────────────────────────────────

describe('U324-A: deedFactionDeltas is a pure, witness-gated table', () => {
  const world = {
    factions: [{ id: 'civic' }, { id: 'shadow' }],
    map: {
      nodes: [{
        id: 'n1',
        settlement: {
          npcs: [
            { id: 'w1', factionId: 'civic' },
            { id: 'w2', factionId: 'civic' },   // same faction — informed once
            { id: 'w3', factionId: 'shadow' },
            { id: 'w4', factionId: '' },        // unaffiliated — no institution
            { id: 'w5', factionId: 'ghost' },   // faction doesn't exist — skipped
          ]
        }
      }]
    }
  };

  it('grave cruelty seen by two factions → one delta each, table magnitude, sorted', () => {
    const deed = { kind: 'cruelty', severity: 20, witnesses: ['w1', 'w2', 'w3'], nodeId: 'n1' };
    assert.deepEqual(deedFactionDeltas(world, deed), [
      { op: 'factionRepDelta', factionId: 'civic', by: FACTION_REP.dark.grave },
      { op: 'factionRepDelta', factionId: 'shadow', by: FACTION_REP.dark.grave },
    ]);
  });

  it('moderate aid → bright table value', () => {
    const deed = { kind: 'aid', severity: 12, witnesses: ['w1'], nodeId: 'n1' };
    assert.deepEqual(deedFactionDeltas(world, deed), [
      { op: 'factionRepDelta', factionId: 'civic', by: FACTION_REP.bright.moderate },
    ]);
  });

  it('no witnesses → no institutional shift', () => {
    assert.deepEqual(deedFactionDeltas(world, { kind: 'cruelty', severity: 20, witnesses: [], nodeId: 'n1' }), []);
  });

  it('unaffiliated or unknown-faction witnesses → no shift', () => {
    assert.deepEqual(deedFactionDeltas(world, { kind: 'cruelty', severity: 20, witnesses: ['w4', 'w5'], nodeId: 'n1' }), []);
  });

  it('non-deed kind → nothing', () => {
    assert.deepEqual(deedFactionDeltas(world, { kind: 'stroll', severity: 20, witnesses: ['w1'], nodeId: 'n1' }), []);
  });
});

// ── B. The op ────────────────────────────────────────────────────────────────

describe('U324-B: factionRepDelta is a dumb clamped write', () => {
  it('moves an existing faction and clamps at the floor', () => {
    const w0 = begin('u322b');
    const fid = w0.factions[0].id;
    const w1 = applyDeltas(w0, [{ op: 'factionRepDelta', factionId: fid, by: -10 }]);
    assert.equal(w1.reputation.factions[fid], -10);
    const w2 = applyDeltas(w1, [{ op: 'factionRepDelta', factionId: fid, by: -1000 }]);
    assert.equal(w2.reputation.factions[fid], -100, 'clamped at -100');
  });

  it('unknown faction is a no-op (never mints a stray key)', () => {
    const w0 = begin('u322b');
    const w1 = applyDeltas(w0, [{ op: 'factionRepDelta', factionId: 'no_such_faction', by: -10 }]);
    assert.deepEqual(repOf(w1), repOf(w0));
    assert.ok(!('no_such_faction' in (w1.reputation?.factions || {})));
  });
});

// ── C. The live wire (playerMove chokepoint) ─────────────────────────────────

describe('U324-C: witnessed deeds move faction standing in play', () => {
  it('witnessed grave cruelty drops the witnesses\' factions by the table value', () => {
    const w0 = begin('a');
    const affected = witnessFactions(w0);
    assert.ok(affected.size > 0, 'seed must place at least one faction-affiliated witness');
    const before = repOf(w0);
    const after = repOf(playerMove(w0, packs, 'I torture the prisoner here in front of everyone').world);
    for (const fid of Object.keys(before)) {
      const expected = affected.has(fid) ? before[fid] + FACTION_REP.dark.grave : before[fid];
      assert.equal(after[fid], expected, `faction ${fid}: ${before[fid]} → ${after[fid]} (expected ${expected})`);
    }
  });

  it('witnessed aid raises the witnesses\' factions by the table value', () => {
    const w0 = begin('a');
    const affected = witnessFactions(w0);
    const before = repOf(w0);
    const after = repOf(playerMove(w0, packs, 'I give the starving man my last bread').world);
    for (const fid of Object.keys(before)) {
      const expected = affected.has(fid) ? before[fid] + FACTION_REP.bright.moderate : before[fid];
      assert.equal(after[fid], expected, `faction ${fid}: ${before[fid]} → ${after[fid]} (expected ${expected})`);
    }
  });

  it('an ordinary (non-deed) action moves no faction standing', () => {
    const w0 = begin('a');
    const before = repOf(w0);
    const after = repOf(playerMove(w0, packs, 'examine the door').world);
    assert.deepEqual(after, before);
  });

  it('the reaction is deterministic: same seed + same script → same worldHash', () => {
    const h1 = worldHash(playerMove(begin('a'), packs, 'I torture the prisoner here in front of everyone').world);
    const h2 = worldHash(playerMove(begin('a'), packs, 'I torture the prisoner here in front of everyone').world);
    assert.equal(h1, h2);
  });

  it('repeat atrocities accumulate toward the F1 thresholds', () => {
    let w = begin('a');
    const affected = witnessFactions(w);
    assert.ok(affected.size > 0);
    const fid = [...affected].sort()[0];
    const start = repOf(w)[fid];
    for (let i = 0; i < 3; i++) {
      w = playerMove(w, packs, 'I torture the prisoner here in front of everyone').world;
    }
    // Witnesses may scatter or trust-floor, but the institutional ledger only needs the
    // FIRST-seen faction to keep hearing: expect at least one grave hit, at most three.
    const now = repOf(w)[fid];
    assert.ok(now <= start + FACTION_REP.dark.grave, `standing should keep falling: ${start} → ${now}`);
    assert.ok(now >= start + 3 * FACTION_REP.dark.grave, `bounded by the table: ${now}`);
  });
});
