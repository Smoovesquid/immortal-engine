// U57: Narrative memory — world.recentBeats[]
// Pass 4 of the sim-to-game arc. Establishes the FIFO beat cache that
// surfaces continuity to the narrator. Beats are derived state, not canon.
import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld, appendRecentBeat, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld, loadSlot } from '../engine/save.js';
import { buildDMContext } from '../engine/ai/narratorContext.js';
import { playerMove } from '../engine/playloop.js';
import { enterStructureInterior } from '../engine/structures/interiors.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel']
  }
};

// Minimal world with a non-settlement node so playerMove won't try to
// decompress on entry; mainline-resolvable text yields a beat.
function mkMainlineWorld(seedKey, fate = 0.3) {
  let w = newWorld({ seed: `u57-${seedKey}`, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Party', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 },
      stats: { MIGHT: 12, AGILITY: 12, GRIT: 12, CHARM: 12, WITS: 12 }
    }],
    scene: { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

// ── Fresh world: shape & version ──────────────────────────────────────────

test('U57: newWorld produces empty recentBeats and version 24', () => {
  const w = newWorld({ seed: 'u57-fresh', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  assert.equal(w.meta.version, 27);
  assert.equal(WORLD_VERSION, 27);
  assert.deepEqual(w.recentBeats, []);
});

// ── Normalizer ────────────────────────────────────────────────────────────

test('U57: ensureWorld coerces non-array recentBeats to []', () => {
  const w = ensureWorld({ meta: { seed: 's', fate: 0.2 }, recentBeats: 'not-an-array' });
  assert.deepEqual(w.recentBeats, []);
});

test('U57: ensureWorld drops malformed beats and trims oversize input arrays', () => {
  const beats = [
    { garbage: true },                                               // bad shape, dropped
    { t: 0, input: 'a', approach: '', stake: '', outcome: 'glorbs', location: '', mechanics: '' }, // bad outcome, dropped
    { t: 0, input: 'good', approach: 'force', stake: 'time', outcome: 'success', location: 'tower', mechanics: '[ok]' }
  ];
  const w = ensureWorld({ meta: { seed: 's', fate: 0.2 }, recentBeats: beats });
  assert.equal(w.recentBeats.length, 1);
  assert.equal(w.recentBeats[0].input, 'good');
});

test('U57: ensureWorld trims oversize beat arrays to last 6', () => {
  const beats = [];
  for (let i = 0; i < 10; i++) {
    beats.push({ t: i, input: `m${i}`, approach: 'force', stake: 'time', outcome: 'success', location: 'tower', mechanics: `[ok ${i}]` });
  }
  const w = ensureWorld({ meta: { seed: 's', fate: 0.2 }, recentBeats: beats });
  assert.equal(w.recentBeats.length, 6);
  assert.equal(w.recentBeats[0].input, 'm4');
  assert.equal(w.recentBeats[5].input, 'm9');
});

// ── Invariants ────────────────────────────────────────────────────────────

test('U57: invariant rejects oversize recentBeats (bypassing normalizer)', () => {
  const w = ensureWorld({ meta: { seed: 's', fate: 0.2 } });
  // Bypass the normalizer by post-mutation: ensureWorld already returned, so
  // we can hand-mangle the world and assert assertWorldInvariants throws.
  w.recentBeats = [];
  for (let i = 0; i < 7; i++) {
    w.recentBeats.push({ t: i, input: 'x', approach: '', stake: '', outcome: 'success', location: '', mechanics: '' });
  }
  assert.throws(() => assertWorldInvariants(w), /recentBeats\.length 7 exceeds cap 6/);
});

test('U57: invariant rejects beat with bad outcome', () => {
  const w = ensureWorld({ meta: { seed: 's', fate: 0.2 } });
  w.recentBeats = [{ t: 0, input: 'x', approach: '', stake: '', outcome: 'glorbs', location: '', mechanics: '' }];
  assert.throws(() => assertWorldInvariants(w), /invalid beat outcome glorbs/);
});

test('U57: invariant rejects beat with negative t', () => {
  const w = ensureWorld({ meta: { seed: 's', fate: 0.2 } });
  w.recentBeats = [{ t: -1, input: 'x', approach: '', stake: '', outcome: 'success', location: '', mechanics: '' }];
  assert.throws(() => assertWorldInvariants(w), /beat\.t must be non-negative integer/);
});

// ── Playloop write site ───────────────────────────────────────────────────

test('U57: playerMove appends a beat per mainline resolution turn (chronological)', () => {
  let w = mkMainlineWorld('append');
  w = playerMove(w, packsById, 'I attack the lock').world;
  w = playerMove(w, packsById, 'I climb the wall').world;
  w = playerMove(w, packsById, 'I pry the door').world;
  assert.equal(w.recentBeats.length, 3);
  // Chronological: t values should be non-decreasing.
  for (let i = 1; i < w.recentBeats.length; i++) {
    assert.ok(w.recentBeats[i].t >= w.recentBeats[i - 1].t, 'beats must be in chronological order');
  }
  // First beat should reflect first input.
  assert.equal(w.recentBeats[0].input, 'I attack the lock');
  assert.equal(w.recentBeats[2].input, 'I pry the door');
  // Outcome is one of the three valid values.
  for (const b of w.recentBeats) {
    assert.ok(['success', 'mixed', 'failure'].includes(b.outcome));
  }
});

test('U57: FIFO trim — 8 mainline turns leaves last 6 beats', () => {
  let w = mkMainlineWorld('fifo');
  const inputs = [
    'I attack the lock',
    'I climb the wall',
    'I pry the door',
    'I shove the gate',
    'I lift the beam',
    'I kick the chair',  // physics verb 'kick' may divert; choose carefully
    'I throw the rope',
    'I haul the chest'
  ];
  // Replace 'kick' with a safe non-physics verb to keep mainline path
  inputs[5] = 'I shoulder the door';
  for (const t of inputs) w = playerMove(w, packsById, t).world;
  assert.equal(w.recentBeats.length, 6);
  // First two should be gone — most recent input should be the 8th.
  assert.equal(w.recentBeats[5].input, 'I haul the chest');
  // Earliest beat in window should be input #3 (index 2).
  assert.equal(w.recentBeats[0].input, 'I pry the door');
});

test('U57: dialogue and ending branches do not append beats', () => {
  // Ending-locked: nothing should change.
  let w = mkMainlineWorld('locked');
  w = ensureWorld({ ...w, ending: { ...(w.ending || {}), triggered: true, locked: true, type: 'test', epilogueLine: 'fin' } });
  const before = w.recentBeats.length;
  w = playerMove(w, packsById, 'I attack the lock').world;
  assert.equal(w.recentBeats.length, before);
});

test('U57: input cap — 300-char input is clamped to 140 in stored beat', () => {
  let w = mkMainlineWorld('cap-input');
  const long = 'I attack ' + 'x'.repeat(400);
  w = playerMove(w, packsById, long).world;
  assert.equal(w.recentBeats.length, 1);
  assert.equal(w.recentBeats[0].input.length, 140);
});

test('U57: mechanics cap — appendRecentBeat clamps mechanics to 200 chars', () => {
  let w = ensureWorld({ meta: { seed: 's', fate: 0.2 } });
  const long = 'm'.repeat(500);
  w = appendRecentBeat(w, {
    t: 0, input: 'x', approach: 'force', stake: 'time',
    outcome: 'success', location: 'tower', mechanics: long
  });
  assert.equal(w.recentBeats.length, 1);
  assert.equal(w.recentBeats[0].mechanics.length, 200);
});

// ── Determinism ───────────────────────────────────────────────────────────

test('U57: determinism — same seed and transcript produces identical recentBeats', () => {
  const transcript = [
    'I attack the lock',
    'I climb the wall',
    'I pry the door',
    'I shove the gate',
    'I lift the beam',
    'I haul the chest'
  ];
  function run() {
    let w = mkMainlineWorld('det');
    for (const t of transcript) w = playerMove(w, packsById, t).world;
    return w.recentBeats;
  }
  assert.deepEqual(run(), run());
});

test('U57: worldHash distinguishes worlds whose only difference is recentBeats', () => {
  const baseInit = { meta: { seed: 'hash-beats', fate: 0.2 } };
  const w1 = ensureWorld(baseInit);
  const w2Mut = ensureWorld(baseInit);
  const w2 = appendRecentBeat(w2Mut, {
    t: 0, input: 'I attack the lock', approach: 'force', stake: 'time',
    outcome: 'success', location: 'tower', mechanics: '[roll 12 vs DC 10]'
  });
  assert.notEqual(worldHash(w1), worldHash(w2),
    'worldHash projection must observe recentBeats — otherwise determinism replay is masked');
});

// ── Save / load ───────────────────────────────────────────────────────────

test('U57: export/import preserves recentBeats verbatim', () => {
  let w = ensureWorld({ meta: { seed: 'roundtrip', fate: 0.2 } });
  w = appendRecentBeat(w, {
    t: 0, input: 'I attack the lock', approach: 'force', stake: 'time',
    outcome: 'success', location: 'tower', mechanics: '[roll 12 vs DC 10]'
  });
  w = appendRecentBeat(w, {
    t: 1, input: 'I climb the wall', approach: 'finesse', stake: 'risk',
    outcome: 'mixed', location: 'tower', mechanics: '[roll 8 vs DC 10]'
  });
  const blob = exportWorld(w);
  const w2 = importWorld(blob);
  assert.deepEqual(w2.recentBeats, w.recentBeats);
});

// ── DM context exposure ──────────────────────────────────────────────────

test('U57: buildDMContext returns a sliced copy of recentBeats', () => {
  let w = ensureWorld({ meta: { seed: 'ctx', fate: 0.2 } });
  w = appendRecentBeat(w, {
    t: 0, input: 'a', approach: 'force', stake: 'time',
    outcome: 'success', location: 'tower', mechanics: '[ok]'
  });
  const ctx = buildDMContext(w, {}, {});
  assert.deepEqual(ctx.recentBeats, w.recentBeats);
  assert.notStrictEqual(ctx.recentBeats, w.recentBeats, 'must be a slice (distinct reference)');
});

// ── Interior location tag ────────────────────────────────────────────────

test('U57: location field uses interior:<key>:<roomId> when player is inside a structure', () => {
  let w = ensureWorld({
    meta: { seed: 'u57-interior' },
    pack: { primaryId: 'fantasy', mixerId: null },
    map: {
      nodes: [{ id: 'n0', name: 'Start', tags: ['structure:demo'] }],
      edges: [],
      discovered: ['n0'],
      currentNodeId: 'n0'
    }
  });
  // Materialize structures here, then enter the interior directly.
  w = playerMove(w, packsById, 'enter').world;
  // If entry succeeded, scene.interior should now be set.
  assert.ok(w.scene?.interior, 'enter must place player in an interior');
  // Now resolve a mainline action inside the interior.
  w = playerMove(w, packsById, 'I attack the lock').world;
  const lastBeat = w.recentBeats[w.recentBeats.length - 1];
  assert.ok(lastBeat, 'expected at least one beat after interior action');
  assert.match(lastBeat.location, /^interior:/, `location should be interior:* but was ${lastBeat.location}`);
});

// ── Save version warning (older → v21) ───────────────────────────────────

test('U57: loading a v12 save warns about version mismatch', () => {
  const storage = (() => {
    const data = {};
    return {
      getItem(k) { return data[k] ?? null; },
      setItem(k, v) { data[k] = String(v); },
      removeItem(k) { delete data[k]; }
    };
  })();
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify({ meta: { version: 12, seed: 'old', fate: 0.3 } }));
  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    const loaded = loadSlot(storage, 'slot1');
    assert.ok(loaded);
    assert.equal(loaded.meta.version, 27);
    assert.ok(warnings.length > 0, 'expected a warning');
    assert.ok(warnings[0].includes('v12'));
    assert.ok(warnings[0].includes('v27'));
  } finally {
    console.warn = origWarn;
  }
});
