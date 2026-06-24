// U265 — authored-figure overlay (Packet D-C2a).
// The locked demo region ('tallow') hand-places named figures on KNOWN ground.
// This packet places exactly ONE: the steward-king Theodore Augustus at the kingdom
// seat — the one settlement generateMap tags 'city'/'seat'. He carries an authored
// voiceCorpusId ('marcus-aurelius') so the D-C1 voice layer routes his spoken line
// to his primary-source corpus. Deterministic, LLM-off (the engine path needs no API;
// the Opus voice call lives at the server route).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { worldHash } from '../engine/worldHash.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';
import { PACKS } from '../scripts/convergence/fixtures.mjs';

// The seat is the one settlement generateMap tags 'city'/'seat' (M7-S3).
function findSeat(world) {
  return world.map.nodes.find(
    n => Array.isArray(n.tags) && (n.tags.includes('seat') || n.tags.includes('city'))
  );
}

function buildWorld(seed) {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  ).world;
}

test('U265 — the steward-king Theodore Augustus stands at the tallow kingdom seat', () => {
  const w = buildWorld(DEMO_SEED);
  const seat = findSeat(w);
  assert.ok(seat, 'tallow must have a seat node (city tier)');
  assert.equal(seat.nodeType, 'settlement', 'the seat is a settlement');

  // Decompress the seat (beginAdventure only decompresses the start node, which is
  // not necessarily the seat) — the figure is injected through the NPC pipeline.
  const w2 = decompressAndCanonizeSync(w, seat.id, PACKS);
  const seat2 = w2.map.nodes.find(n => n.id === seat.id);
  const npcs = seat2.settlement?.npcs || [];

  const king = npcs.find(n => n.name === 'Theodore Augustus');
  assert.ok(king, `Theodore Augustus must be present at the seat; got [${npcs.map(n => n.name).join(', ')}]`);
  assert.equal(king.voiceCorpusId, 'marcus-aurelius', 'the king carries his authored Marcus Aurelius voice');
  assert.equal(king.role, 'steward-king', 'the king has the steward-king role');
  assert.equal(king.id, 'figure_steward-king', 'stable authored-figure id');
  assert.equal(king.hostile, false, 'the king is not hostile');
  // He must have a usable conversation state (a person without one can't accrue trust).
  assert.ok(king.conversationState && typeof king.conversationState === 'object',
    'the king has a conversation state');
  assert.equal(king.conversationState.metPlayer, false, 'fresh conversation state');
});

// The Tier-2 follow-on: the four SETTLEMENT figures, placed by on-the-nose name
// selector (frontier / trade / faith / outlier). The Goat is wilderness-deferred.
const SETTLEMENT_FIGURES = [
  { sub: 'outpost (2)',          id: 'figure_cassandra',        name: 'Cassandra',        voice: 'joan-of-arc' },
  { sub: 'saltmarket',           id: 'figure_scholar',          name: 'The Kant-Knight',  voice: 'kant-knight' },
  { sub: 'pilgrim',              id: 'figure_clown-leader',     name: 'Goldblum-Socrates',voice: 'goldblum-socrates' },
  { sub: 'crossway village (2)', id: 'figure_cannibal-prophet', name: 'The Host',         voice: 'jesus' },
];

function findSettlementByName(world, sub) {
  return world.map.nodes.find(
    n => n.nodeType === 'settlement' && String(n.name || '').toLowerCase().includes(sub)
  );
}

test('U265 — the four settlement figures stand at their named tallow towns', () => {
  const w = buildWorld(DEMO_SEED);
  for (const f of SETTLEMENT_FIGURES) {
    const node = findSettlementByName(w, f.sub);
    assert.ok(node, `tallow must have a settlement matching "${f.sub}"`);
    const w2 = decompressAndCanonizeSync(w, node.id, PACKS);
    const node2 = w2.map.nodes.find(n => n.id === node.id);
    const npcs = node2.settlement?.npcs || [];
    const fig = npcs.find(n => n.id === f.id);
    assert.ok(fig, `${f.name} must stand at "${node.name}"; got [${npcs.map(n => n.name).join(', ')}]`);
    assert.equal(fig.name, f.name, 'authored figure name');
    assert.equal(fig.voiceCorpusId, f.voice, `${f.name} carries the authored voice ${f.voice}`);
    assert.equal(fig.hostile, false, 'a figure is not hostile');
  }
});

test('U265 — each settlement figure is unique to ONE town; the Goat is not in any town', () => {
  const w = buildWorld(DEMO_SEED);
  const placements = new Map(); // figureId -> [town names]
  for (const node of w.map.nodes.filter(n => n.nodeType === 'settlement')) {
    const w2 = decompressAndCanonizeSync(w, node.id, PACKS);
    const node2 = w2.map.nodes.find(n => n.id === node.id);
    for (const npc of (node2.settlement?.npcs || [])) {
      if (String(npc.id || '').startsWith('figure_')) {
        placements.set(npc.id, [...(placements.get(npc.id) || []), node.name]);
      }
    }
  }
  for (const f of SETTLEMENT_FIGURES) {
    const at = placements.get(f.id) || [];
    assert.equal(at.length, 1, `${f.name} must appear at exactly ONE town; got [${at.join(', ')}]`);
  }
  assert.ok(!placements.has('figure_the-goat'),
    'the Goat is wilderness-deferred — it must not appear at any settlement');
});

test('U265 — the overlay is tallow-gated: another seed gets NO authored figure', () => {
  const w = buildWorld('u265-not-tallow');
  const seat = findSeat(w);
  assert.ok(seat, 'control world must also have a seat node');

  const w2 = decompressAndCanonizeSync(w, seat.id, PACKS);
  const seat2 = w2.map.nodes.find(n => n.id === seat.id);
  const npcs = seat2.settlement?.npcs || [];

  const hasFigure = npcs.some(
    n => n.name === 'Theodore Augustus' || String(n.id || '').startsWith('figure_')
  );
  assert.equal(hasFigure, false,
    `no authored figure may appear off the demo seed; got [${npcs.map(n => n.name).join(', ')}]`);
});

test('U265 — replay-stable: building tallow + seat twice yields identical worldHash', () => {
  const build = () => {
    const w = buildWorld(DEMO_SEED);
    const seat = findSeat(w);
    return decompressAndCanonizeSync(w, seat.id, PACKS);
  };
  const a = build();
  const b = build();
  assert.equal(worldHash(a), worldHash(b),
    'the tallow world (with the steward-king placed) must be replay-stable');
});
