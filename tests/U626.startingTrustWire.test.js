// U626 — SP-3 starting trust reads standing, LIVE through NPC genesis + decompression.
//
// The done-when (Social Physics Contract, row SP-3): in a −60 civic world, freshly
// minted civic NPCs start at trust 3; a +50 hero meets trust 7; the shadow faction and
// unaffiliated strangers track their OWN standing, not civic's. Two layers are proven:
//   (a) generateSettlementNPCs applies the standing table per NPC (direct, deterministic —
//       the same civic+shadow demo world the contract's SP-1 proof used); and
//   (b) decompressAndCanonizeSync — the LIVE decompression path playloop.js calls — carries
//       w.reputation.factions AND traveling notoriety into the mint (the wire, on the real
//       aldermere slice seed).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { generateSettlementNPCs } from '../engine/npc/npcGenesis.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// The contract's canonical two-faction demo world (civic dominant by pressure, shadow).
const DEMO_FACTIONS = [
  { id: 'civic', goal: 'Maintain order', pressure: 30, assets: [], hostility: 10, lastMove: '' },
  { id: 'shadow', goal: 'Exploit instability', pressure: 20, assets: [], hostility: 50, lastMove: '' },
];
const DEMO_ECO = { corruption: 15, instability: 10, scarcity: 20 };
const DEMO_BUILDINGS = ['tavern', 'smithy'];

function mintCivicWorldNpcs({ reputation = {}, notorietyScore = 0 } = {}) {
  return generateSettlementNPCs('civnode', 'seedCiv', {}, DEMO_FACTIONS, DEMO_ECO, {
    buildings: DEMO_BUILDINGS, reputation, notorietyScore,
  });
}
const trustByFaction = (npcs, fid) =>
  npcs.filter(n => (n.factionId ?? null) === fid).map(n => n.conversationState.trustLevel);

test('U626-01: −60 civic world — every freshly minted civic NPC starts at trust 3', () => {
  const npcs = mintCivicWorldNpcs({ reputation: { civic: -60, shadow: 0 } });
  const civic = trustByFaction(npcs, 'civic');
  assert.ok(civic.length >= 1, 'the demo world has at least one civic NPC');
  for (const t of civic) assert.equal(t, 3, 'a civic NPC in a −60 town opens at the floor');
});

test('U626-02: +50 civic world — a hero meets civic NPCs at trust 7', () => {
  const npcs = mintCivicWorldNpcs({ reputation: { civic: 50, shadow: 0 } });
  const civic = trustByFaction(npcs, 'civic');
  for (const t of civic) assert.equal(t, 7, 'a civic NPC greets the +50 hero at the ceiling');
});

test('U626-03: neutral standing mints trust 5 — byte-identical to pre-SP-3', () => {
  // No reputation supplied at all → the pre-SP-3 world exactly.
  const bare = mintCivicWorldNpcs();
  for (const n of bare) assert.equal(n.conversationState.trustLevel, 5, `${n.name} opens neutral`);
  // Explicit all-zero reputation → same.
  const zero = mintCivicWorldNpcs({ reputation: { civic: 0, shadow: 0 } });
  for (const n of zero) assert.equal(n.conversationState.trustLevel, 5, `${n.name} opens neutral (explicit 0)`);
});

test('U626-04: standing is per-faction — shadow & unaffiliated ignore civic', () => {
  // civic torched, shadow untouched: only the civic people go cold.
  const npcs = mintCivicWorldNpcs({ reputation: { civic: -60, shadow: 0 }, notorietyScore: 0 });
  for (const t of trustByFaction(npcs, 'shadow')) assert.equal(t, 5, 'shadow tracks shadow rep, not civic');
  for (const t of trustByFaction(npcs, null)) assert.equal(t, 5, 'the unaffiliated stranger is unmoved by faction rep');
  // Now warm the shadow faction independently: shadow people rise, civic unmoved.
  const npcs2 = mintCivicWorldNpcs({ reputation: { civic: 0, shadow: 50 } });
  for (const t of trustByFaction(npcs2, 'shadow')) assert.equal(t, 7, 'shadow tracks its own +50');
  for (const t of trustByFaction(npcs2, 'civic')) assert.equal(t, 5, 'civic unmoved by shadow rep');
});

test('U626-05: unaffiliated NPCs read traveling notoriety (negative-valence)', () => {
  // An unaffiliated stranger (no factionId) hears of the player's crimes via notoriety.
  const loud = mintCivicWorldNpcs({ reputation: { civic: 0, shadow: 0 }, notorietyScore: 1 });
  for (const t of trustByFaction(loud, null)) assert.equal(t, 3, 'a widely-heard reputation chills the stranger to the floor');
  // Notoriety never lifts an unaffiliated NPC above neutral.
  const clean = mintCivicWorldNpcs({ notorietyScore: 0 });
  for (const t of trustByFaction(clean, null)) assert.equal(t, 5, 'a clean player is just a stranger (5)');
});

test('U626-06: LIVE WIRE — decompressAndCanonizeSync carries standing into the mint', () => {
  // Prove the caller wire on the real slice seed: faction rep in → minted trust out.
  // Trust is stamped against each NPC's FINAL factionId (computeNpcDepth may reassign the
  // faction from settlement history after genesis, and F1/dialogue read that final id),
  // so we discover the faction to sour from a NEUTRAL decompression of the node first.
  const base = beginAdventure(newWorld({
    seed: 'aldermere', fate: 0.2, campaignId: 'u626-wire',
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  }), packs).world;
  const target = base.map.nodes.find(n => n.nodeType === 'settlement' && !n.settlement?.decompressed);
  assert.ok(target, 'the slice has an undecompressed settlement to mint');

  // Neutral decompress → read a settlement NPC's FINAL (post-depth) factionId.
  const neutral = decompressAndCanonizeSync(base, target.id, packs);
  const neutralNode = neutral.map.nodes.find(n => n.id === target.id);
  const affiliated = (neutralNode.settlement?.npcs || [])
    .find(n => n.factionId && !n.hostile && !n.authoredFigure);
  assert.ok(affiliated, 'the decompressed node has a faction-affiliated settlement NPC');
  assert.equal(affiliated.conversationState.trustLevel, 5,
    'on a clean slate that NPC opens neutral (5)');
  const fid = String(affiliated.factionId);

  // Build a valid reputation image (keys ⊆ world.factions, satisfied by ensureReputation)
  // with THAT faction at −60, then decompress the SAME node through the live sync path.
  const repFactions = {};
  for (const f of base.factions) repFactions[String(f.id)] = 0;
  repFactions[fid] = -60;
  const soured = { ...base, reputation: { ...base.reputation, factions: repFactions } };

  const after = decompressAndCanonizeSync(soured, target.id, packs);
  const node = after.map.nodes.find(n => n.id === target.id);
  const minted = (node.settlement?.npcs || []).filter(n => String(n.factionId) === fid && !n.hostile && !n.authoredFigure);
  assert.ok(minted.length >= 1, 'the decompressed node has a minted NPC of the soured faction');
  for (const n of minted) {
    assert.equal(n.conversationState.trustLevel, 3,
      `${n.name} (${fid}) opens at trust 3 — reputation reached the mint through decompress`);
  }
  // And an NPC NOT of the soured faction is unmoved.
  const others = (node.settlement?.npcs || []).filter(n => String(n.factionId || '') !== fid && !n.hostile && !n.authoredFigure);
  for (const n of others) {
    assert.equal(n.conversationState.trustLevel, 5,
      `${n.name} (faction ${n.factionId || 'none'}) is unmoved by the ${fid} souring`);
  }
});
