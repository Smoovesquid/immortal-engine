// U627 — SP-3 determinism & invisibility.
//
// SP-3 mints trust from ALREADY-HASHED state (w.reputation.factions, w.deeds via
// notorietyReaching) with NO rng and NO new fields — so it must be (a) HASH-STABLE:
// same seed + same standing → equal worldHash across runs; and (b) INVISIBLE on a
// clean slate: a world where the player has no reputation decompresses byte-identically
// to a pre-SP-3 world (the neutral-5 default). Guards the determinism family
// (U19/21/22/27/30) against a regression that would make the mint seed-unstable.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { generateSettlementNPCs } from '../engine/npc/npcGenesis.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

const DEMO_FACTIONS = [
  { id: 'civic', goal: 'Maintain order', pressure: 30, assets: [], hostility: 10, lastMove: '' },
  { id: 'shadow', goal: 'Exploit instability', pressure: 20, assets: [], hostility: 50, lastMove: '' },
];
const DEMO_ECO = { corruption: 15, instability: 10, scarcity: 20 };

test('U627-01: genesis is deterministic under standing — same rep → identical NPCs', () => {
  const opts = { buildings: ['tavern'], reputation: { civic: -60, shadow: 0 }, notorietyScore: 0.5 };
  const a = generateSettlementNPCs('n', 'seedDet', {}, DEMO_FACTIONS, DEMO_ECO, opts);
  const b = generateSettlementNPCs('n', 'seedDet', {}, DEMO_FACTIONS, DEMO_ECO, { ...opts });
  assert.deepStrictEqual(a, b, 'same seed + same standing → byte-identical NPC records');
});

test('U627-02: different standing changes only trust, not identity (no rng consumed)', () => {
  const neutral = generateSettlementNPCs('n', 'seedDet', {}, DEMO_FACTIONS, DEMO_ECO, { buildings: ['tavern'] });
  const soured = generateSettlementNPCs('n', 'seedDet', {}, DEMO_FACTIONS, DEMO_ECO, {
    buildings: ['tavern'], reputation: { civic: -60, shadow: 0 },
  });
  assert.equal(neutral.length, soured.length, 'standing does not change the population size');
  for (let i = 0; i < neutral.length; i++) {
    // Names/roles/factions/knowledge are identical — SP-3 consumed no rng stream, so the
    // seeded sequence is untouched. ONLY trustLevel may differ.
    assert.equal(soured[i].name, neutral[i].name, `NPC ${i} name unchanged by standing`);
    assert.equal(soured[i].factionId ?? null, neutral[i].factionId ?? null, `NPC ${i} faction unchanged`);
    assert.deepStrictEqual(soured[i].knowledgeGraph, neutral[i].knowledgeGraph, `NPC ${i} knowledge unchanged`);
    const withoutTrust = (n) => ({ ...n, conversationState: { ...n.conversationState, trustLevel: 0 } });
    assert.deepStrictEqual(withoutTrust(soured[i]), withoutTrust(neutral[i]),
      `NPC ${i} differs ONLY in trustLevel`);
  }
});

// Decompress the first undecompressed settlement of a fresh aldermere world, twice,
// and hash the result — the live path playloop.js uses.
function decompressFirstSettlement(seedTag) {
  const base = beginAdventure(newWorld({
    seed: 'aldermere', fate: 0.2, campaignId: seedTag,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  }), packs).world;
  const target = base.map.nodes.find(n => n.nodeType === 'settlement' && !n.settlement?.decompressed);
  return decompressAndCanonizeSync(base, target.id, packs);
}

test('U627-03: hash-stable — same seed + clean standing → equal worldHash', () => {
  // NB campaignId must match, or the worlds legitimately differ; use one tag, run twice.
  const h1 = worldHash(decompressFirstSettlement('u627-hash'));
  const h2 = worldHash(decompressFirstSettlement('u627-hash'));
  assert.equal(h1, h2, 'SP-3 mint is replay-stable — equal worldHash across runs');
});

test('U627-04: invisible on a clean slate — SP-3 mints neutral-5 for the unheard-of player', () => {
  // A fresh world has no player deeds and all-zero reputation, so every minted NPC —
  // affiliated or not — must open at exactly 5. This is the byte-for-byte pre-SP-3 behavior:
  // SP-3 is dark until the player earns a reputation.
  const after = decompressFirstSettlement('u627-clean');
  const target = after.map.nodes.find(n => n.settlement?.decompressed);
  const minted = (target.settlement?.npcs || []).filter(n => !n.hostile && !n.authoredFigure);
  assert.ok(minted.length >= 1, 'the settlement minted at least one ordinary NPC');
  for (const n of minted) {
    assert.equal(n.conversationState.trustLevel, 5,
      `${n.name} opens neutral on a clean slate (SP-3 invisible until the player acts)`);
  }
});
