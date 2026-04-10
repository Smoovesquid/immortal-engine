// U56: Approach differentiation — each of the five canonical approaches
// (force/finesse/endure/heart/focus) emits a mechanically distinct delta
// signature in every (approach, outcome) cell, and the composer echoes
// the approach into narration. Pass 3 of the sim-to-game arc.
import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { resolveMove } from '../engine/resolve.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { compose } from '../engine/composer.js';
import { addFact } from '../engine/ledger.js';
import { worldHash } from '../engine/worldHash.js';
import { decompressAndCanonizeSync } from '../engine/decompression/decompress.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const APPROACHES = ['force', 'finesse', 'endure', 'heart', 'focus'];

function mkWorld(seedKey, fate = 0.3) {
  const w = newWorld({ seed: `u56-${seedKey}`, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'tower', objective: 'find the key', time: 'start', promptSeed: '123', tags: [], thread: '', interior: null, dialogue: null };
  // Seed a party entry so stat-based and healing deltas are observable.
  w.party = [{ id: 'party', name: 'Party', vibe: 'steady', archetype: 'wanderer', wounds: 0, stress: 0, resources: { Supply: 5 }, stats: { MIGHT: 12, AGILITY: 12, GRIT: 12, CHARM: 12, WITS: 12 } }];
  return ensureWorld(w);
}

function mkMove(approach, overrides = {}) {
  return {
    actorId: 'party',
    intentText: `I use ${approach}.`,
    approachTag: approach,
    risk: 0.5,
    stakeTag: 'time',
    targetId: null,
    toolTag: null,
    ...overrides
  };
}

function deltaKey(d) {
  // Stable, order-insensitive signature for a single delta.
  return JSON.stringify(d, Object.keys(d).sort());
}

function deltaSetsEqual(a, b) {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(deltaKey));
  const sb = new Set(b.map(deltaKey));
  if (sa.size !== sb.size) return false;
  for (const k of sa) if (!sb.has(k)) return false;
  return true;
}

test('U56: success signatures are pairwise distinct across approaches', () => {
  const w = mkWorld('sig-success', 0.0); // coop band is permissive → easier to hit success
  const byApproach = {};
  for (const a of APPROACHES) {
    // Search over a small deterministic fan of intent texts until this
    // approach lands a success. Each search uses the same world.
    let found = null;
    for (let i = 0; i < 60 && !found; i++) {
      const res = resolveMove(w, mkMove(a, { intentText: `I use ${a} (${i}).` }));
      if (res.result.outcome === 'success') found = res.result.deltas;
    }
    assert.ok(found, `expected a success for approach=${a}`);
    byApproach[a] = found;
  }
  for (let i = 0; i < APPROACHES.length; i++) {
    for (let j = i + 1; j < APPROACHES.length; j++) {
      const ai = APPROACHES[i]; const aj = APPROACHES[j];
      assert.equal(
        deltaSetsEqual(byApproach[ai], byApproach[aj]),
        false,
        `success deltas must differ: ${ai} vs ${aj}`
      );
    }
  }
});

test('U56: failure signatures are pairwise distinct across approaches', () => {
  const w = mkWorld('sig-fail', 1.0); // blood band is harshest → easier to hit failure
  // High risk + high-DC environment.
  w.clocks = { ...w.clocks, pressure: 8, dread: 6, revelation: 3 };
  const byApproach = {};
  for (const a of APPROACHES) {
    let found = null;
    for (let i = 0; i < 60 && !found; i++) {
      const res = resolveMove(w, mkMove(a, { risk: 0.95, intentText: `I use ${a} (${i}).` }));
      if (res.result.outcome === 'failure') found = res.result.deltas;
    }
    assert.ok(found, `expected a failure for approach=${a}`);
    byApproach[a] = found;
  }
  for (let i = 0; i < APPROACHES.length; i++) {
    for (let j = i + 1; j < APPROACHES.length; j++) {
      const ai = APPROACHES[i]; const aj = APPROACHES[j];
      assert.equal(
        deltaSetsEqual(byApproach[ai], byApproach[aj]),
        false,
        `failure deltas must differ: ${ai} vs ${aj}`
      );
    }
  }
});

test('U56: endure success heals stress; force success does not', () => {
  const w = mkWorld('endure-heal', 0.0);
  w.party = [{ ...w.party[0], stress: 3 }];
  const w2 = ensureWorld(w);

  // Find an endure success and a force success on the same world.
  let endureHit = null;
  for (let i = 0; i < 60 && !endureHit; i++) {
    const r = resolveMove(w2, mkMove('endure', { intentText: `endure try ${i}` }));
    if (r.result.outcome === 'success') endureHit = r.result;
  }
  let forceHit = null;
  for (let i = 0; i < 60 && !forceHit; i++) {
    const r = resolveMove(w2, mkMove('force', { intentText: `force try ${i}`, stakeTag: 'time' }));
    if (r.result.outcome === 'success') forceHit = r.result;
  }
  assert.ok(endureHit, 'expected endure success');
  assert.ok(forceHit, 'expected force success');

  const endureHeals = endureHit.deltas.some(d =>
    d?.op === 'stress' && d.entityId === 'party' && d.by === -1
  );
  const forceHeals = forceHit.deltas.some(d =>
    d?.op === 'stress' && d.entityId === 'party' && d.by === -1
  );
  assert.equal(endureHeals, true, 'endure success emits stress -1 delta');
  assert.equal(forceHeals, false, 'force success does NOT emit stress -1 delta');
});

test('U56: heart success grants npcTrustDelta +1 to NPC at current node', () => {
  // Build a world with a decompressed settlement (guaranteed NPC presence).
  let w = newWorld({ seed: 'u56-heart', fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const settlements = w.map.nodes.filter(n => n.nodeType === 'settlement');
  assert.ok(settlements.length, 'expected a settlement node in the generated map');
  const nodeId = settlements[0].id;
  w = { ...w, map: { ...w.map, currentNodeId: nodeId } };
  w = decompressAndCanonizeSync(w, nodeId, { objectives: ['survive'], factionPool: [{ id: 'civic', type: 'civic' }] });
  // Seed party.
  w = ensureWorld({ ...w, party: [{ id: 'party', name: 'Party', vibe: 'warm', archetype: 'diplomat', wounds: 0, stress: 0, resources: { Supply: 5 }, stats: { CHARM: 14 } }] });

  const node = w.map.nodes.find(n => n.id === nodeId);
  assert.ok(Array.isArray(node?.settlement?.npcs) && node.settlement.npcs.length, 'settlement has NPCs');

  let heartHit = null;
  for (let i = 0; i < 60 && !heartHit; i++) {
    const r = resolveMove(w, mkMove('heart', { intentText: `heart try ${i}` }));
    if (r.result.outcome === 'success') heartHit = r.result;
  }
  assert.ok(heartHit, 'expected heart success');

  const trust = heartHit.deltas.find(d => d?.op === 'npcTrustDelta' && d.by === +1);
  assert.ok(trust, 'heart success emits npcTrustDelta +1');
  // npcId should match an NPC present at the current node.
  const npcIds = new Set(node.settlement.npcs.map(n => String(n.id)));
  assert.equal(npcIds.has(String(trust.npcId)), true, 'trust delta targets a real NPC at current node');
});

test('U56: focus DC hook — studied-the-miss lowers next focus DC by 1 (floor 8), consumed after use', () => {
  const wBase = mkWorld('focus-hook', 0.3);

  // Baseline focus attempt: no hook in ledger.
  const baseline = resolveMove(wBase, mkMove('focus')).result;

  // Inject the hook fact directly via ledger.addFact, then re-run.
  const wHooked = ensureWorld(addFact(wBase, 'you:studied-the-miss', 'test'));
  const withHook = resolveMove(wHooked, mkMove('focus')).result;

  if (baseline.dc > 8) {
    assert.equal(withHook.dc, baseline.dc - 1, 'focus hook should reduce DC by 1 when above floor');
  } else {
    assert.equal(withHook.dc, 8, 'focus hook should not go below floor 8');
  }

  // Control: a non-focus approach on the same hooked world sees no discount.
  const controlHook = resolveMove(wHooked, mkMove('force')).result;
  const controlBase = resolveMove(wBase, mkMove('force')).result;
  assert.equal(controlHook.dc, controlBase.dc, 'non-focus approaches do not benefit from the hook');

  // The focus attempt that benefited from the hook must emit applied-the-lesson,
  // which pushes studied-the-miss off the top of the facts list. (In the absence
  // of a removeFact delta op, "consumed" is defined as "no longer facts[0]".)
  const applied = withHook.deltas.find(d => d?.op === 'ledger' && d.addFact === 'you:applied-the-lesson');
  assert.ok(applied, 'focus attempt with live hook must emit applied-the-lesson');

  const wAfter = applyDeltas(wHooked, withHook.deltas);
  assert.notEqual(
    String(wAfter.ledger.facts[0]?.text || ''),
    'you:studied-the-miss',
    'studied-the-miss should no longer be the top fact after the hook is consumed'
  );
});

test('U56: focus failure arms the DC hook and reduces the next focus DC', () => {
  // Force a focus failure via direct resolveMove under a harsh band, then
  // confirm the hook is armed and the next focus DC computation sees it.
  let w = mkWorld('focus-arm', 1.0);
  w.clocks = { ...w.clocks, pressure: 10, dread: 8, revelation: 4 };
  w = ensureWorld(w);

  // Hammer focus failures until one lands; then apply its deltas.
  let failed = null;
  for (let i = 0; i < 80 && !failed; i++) {
    const r = resolveMove(w, mkMove('focus', { risk: 0.95, intentText: `probe ${i}` }));
    if (r.result.outcome === 'failure') failed = r.result;
  }
  assert.ok(failed, 'expected a focus failure in harsh band');

  const wAfter = applyDeltas(w, failed.deltas);
  assert.equal(
    String(wAfter.ledger?.facts?.[0]?.text || ''),
    'you:studied-the-miss',
    'focus failure must leave studied-the-miss as the top fact'
  );

  // The next focus attempt on the armed world must observe the hook in
  // computeDC — which we can prove by checking that buildDeltas emits the
  // applied-the-lesson consumption marker (emitted if and only if the hook
  // was live at the start of the move).
  const next = resolveMove(wAfter, mkMove('focus', { intentText: 'armed probe' })).result;
  const consumed = next.deltas.find(d => d?.op === 'ledger' && d.addFact === 'you:applied-the-lesson');
  assert.ok(consumed, 'next focus attempt must emit applied-the-lesson, proving the hook was active');
});

test('U56: determinism — fixed seed produces identical worldHash across two runs', () => {
  const packsById = {
    fantasy: {
      id: 'fantasy',
      toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
      starterLocations: ['tower'],
      starterObjectives: ['find the key'],
      skills: ['Steel'],
      locations: ['tower'],
      objectives: ['find the key'],
      complications: ['a clock starts'],
      npcArchetypes: ['wary guide'],
      sensoryMotifs: ['air tastes of dust']
    }
  };
  const transcript = [
    'I force the door.',
    'I slip past the alcove quietly.',
    'I study the inscription carefully.',
    'I speak softly to whoever is here.',
    'I brace myself and hold the line.',
    'I force my way forward.',
    'I watch the pattern of footsteps.',
    'I speak a gentle word.',
    'I push through with effort.',
    'I finesse the lock.'
  ];
  function runOnce() {
    let w = newWorld({ seed: 'u56-det', fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
    w = beginAdventure(w, packsById).world;
    for (const t of transcript) w = playerMove(w, packsById, t).world;
    return worldHash(w);
  }
  const h1 = runOnce();
  const h2 = runOnce();
  assert.equal(h1, h2);
});

test('U56: composer narration differs by approach key', () => {
  const w = mkWorld('compose', 0.3);
  const baseResolution = {
    kind: 'turn',
    t: w.timeline.length,
    roll: 15,
    dc: 12,
    success: true,
    updateKind: 'ledger',
    outcome: 'success'
  };
  const out = {};
  for (const a of APPROACHES) {
    const composed = compose(w, 'I act.', { ...baseResolution, approach: a }, { pack: {} });
    out[a] = composed.narrationLine;
  }
  // Every pair of approaches should produce a different narration string.
  for (let i = 0; i < APPROACHES.length; i++) {
    for (let j = i + 1; j < APPROACHES.length; j++) {
      assert.notEqual(out[APPROACHES[i]], out[APPROACHES[j]], `narration differs ${APPROACHES[i]} vs ${APPROACHES[j]}`);
    }
  }

  // Backwards compat: calling compose with no approach key must still produce output.
  const plain = compose(w, 'I act.', { ...baseResolution }, { pack: {} });
  assert.equal(typeof plain.narrationLine, 'string');
  assert.ok(plain.narrationLine.length > 0);
});
