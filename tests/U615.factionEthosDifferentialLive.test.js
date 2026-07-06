// U615 — SP-2: the differential ethos, LIVE through the playloop.
//
// The falsifiable prediction of the Social Physics Contract's SP-2 row: ONE witnessed
// atrocity, in ONE world, moves a civic (lawful) faction −10 AND a shadow (outlaw) faction
// +5 — "the thieves' den warms when the watch curses your name." U614 pins the pure
// arithmetic; this file proves it fires end-to-end when the player types the deed and the
// witnesses (a civic informant AND a shadow informant standing at the same node) carry it
// to their institutions through applyDeedCharges → deedFactionDeltas → factionRepDelta.
//
// The default start town seeds only a civic-affiliated witness, so we inject one
// shadow-affiliated NPC at the player's node (normalized through ensureWorld, so the world
// stays invariant-clean) and drive the real player verb. Deterministic ×2 under a fixed seed.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

const repOf = (w) => ({ ...(w.reputation?.factions || {}) });
const curNode = (w) => w.map.nodes.find(x => x.id === w.map.currentNodeId);
const witnessFactions = (w) => new Set((curNode(w)?.settlement?.npcs || [])
  .map(n => String(n?.factionId || '').trim()).filter(Boolean));

// Build the default slice, then plant a shadow (outlaw) informant beside the civic (lawful)
// one so a single deed is witnessed by BOTH institutions. Returns a normalized world.
function worldWithBothWitnesses(seed = 'a') {
  const w0 = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u615-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape',
  }), packs).world;

  // Sanity: the seed already places a lawful (civic) witness and BOTH factions exist.
  assert.equal(w0.factions.find(f => f.id === 'civic')?.ethos, 'lawful', 'civic derives lawful');
  assert.equal(w0.factions.find(f => f.id === 'shadow')?.ethos, 'outlaw', 'shadow derives outlaw');

  const clone = JSON.parse(JSON.stringify(w0));
  const node = clone.map.nodes.find(x => x.id === clone.map.currentNodeId);
  node.settlement = node.settlement || { npcs: [] };
  node.settlement.npcs = Array.isArray(node.settlement.npcs) ? node.settlement.npcs : [];
  // A bare informant is enough — the deed path reads only id + factionId to route the
  // institutional shift; ensureWorld stamps a deterministic tactical pos.
  node.settlement.npcs.push({ id: 'shadow_informant', name: 'a quiet watcher', factionId: 'shadow' });
  const w = ensureWorld(clone);
  assert.doesNotThrow(() => assertWorldInvariants(w), 'the injected world is invariant-clean');
  return w;
}

describe('U615: one witnessed atrocity moves civic −10 AND shadow +5 in the same world', () => {
  it('the two institutions react in OPPOSITE directions to the same deed', () => {
    const w0 = worldWithBothWitnesses('a');
    const wf = witnessFactions(w0);
    assert.ok(wf.has('civic') && wf.has('shadow'), 'both a lawful and an outlaw informant witness the deed');

    const before = repOf(w0);
    const after = repOf(playerMove(w0, packs, 'I torture the prisoner here in front of everyone').world);

    // Civic (lawful) curses the atrocity by the base grave value; shadow (outlaw) warms by
    // the flipped-half value. Exact numbers, not just signs (magnitude is table-owned).
    assert.equal(after.civic - (before.civic ?? 0), -10, 'lawful civic: −10 (base dark grave)');
    assert.equal(after.shadow - (before.shadow ?? 0), 5, 'outlaw shadow: +5 (sign flipped, half magnitude)');
    // The differential is real: the same event pushed the two factions apart by 15.
    assert.equal((after.shadow - (before.shadow ?? 0)) - (after.civic - (before.civic ?? 0)), 15,
      'the atrocity split the two institutions by 15 points');
  });

  it('the differential is deterministic: same seed + same script → identical worldHash ×2', () => {
    const run = () => worldHash(playerMove(worldWithBothWitnesses('a'), packs, 'I torture the prisoner here in front of everyone').world);
    assert.equal(run(), run(), 'the differential reaction replays byte-identically');
  });

  it('a public GOOD deed inverts too — civic warms, the den sours', () => {
    const w0 = worldWithBothWitnesses('a');
    const before = repOf(w0);
    const after = repOf(playerMove(w0, packs, 'I give the starving man my last bread').world);
    // Moderate aid: civic +3 (base bright moderate), shadow −2 (flipped half).
    assert.equal(after.civic - (before.civic ?? 0), 3, 'lawful civic warms +3 to a good deed');
    assert.equal(after.shadow - (before.shadow ?? 0), -2, 'outlaw shadow cools −2 on a do-gooder');
  });

  it('a lawful-only witness is unaffected by the flip (SP-1 behavior preserved where no outlaw sees)', () => {
    // The unmodified seed (civic witness only) must still move exactly as SP-1 pinned: civic −10, no shadow key.
    const w0 = beginAdventure(newWorld({ seed: 'a', fate: 0.2, campaignId: 'u615-solo', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
    assert.deepEqual([...witnessFactions(w0)], ['civic'], 'baseline seed: only civic witnesses');
    const before = repOf(w0);
    const after = repOf(playerMove(w0, packs, 'I torture the prisoner here in front of everyone').world);
    assert.equal(after.civic - (before.civic ?? 0), -10, 'lawful civic still −10 unchanged from SP-1');
    assert.equal(after.shadow ?? 0, before.shadow ?? 0, 'shadow (no witness present) does not move');
  });
});
