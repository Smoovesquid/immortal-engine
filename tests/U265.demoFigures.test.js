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
