// U128 / P-74a: The Adversary — villain genesis + agenda state.
//
// Tests assert:
//   * same seed → same villain + agenda (the packet's done_when)
//   * minted villain is well-formed: identity, seat on the map, staged agenda
//   * agenda signs never contain the villain's name (rumor-first law —
//     the county knows the symptoms before it knows the name)
//   * mintVillain is idempotent; worlds without a map mint nothing
//   * ensureVillain normalizes garbage to null and clamps the stage cursor
//   * villain survives ensureWorld and passes assertWorldInvariants
//   * invariants reject malformed villains (bad stage, seat off the map)

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { villainGenesis, mintVillain, ensureVillain } from '../engine/story/villain.js';

function mkWorld(seed) {
  return ensureWorld(newWorld({ seed, fate: 0.2, campaignId: 'u128', pack: { primaryId: 'fantasy', mixerId: null } }));
}

test('U128-01 same seed → same villain + agenda', () => {
  const a = villainGenesis(mkWorld('u128-det'));
  const b = villainGenesis(mkWorld('u128-det'));
  assert.ok(a, 'villain minted');
  assert.deepEqual(a, b);
});

test('U128-02 minted villain is well-formed', () => {
  const w = mkWorld('u128-shape');
  const v = villainGenesis(w);
  assert.ok(v.ref.startsWith('villain:'), 'ref carries the creature ref');
  assert.ok(v.name.length > 0 && v.epithet.length > 0, 'has a name and an epithet');
  assert.ok(v.creature.length > 0, 'wears a creature');
  assert.ok(v.cr >= 1, 'has a CR');
  assert.equal(v.discovered, false);
  assert.equal(v.defeated, false);
  assert.equal(v.agenda.stage, 0);
  assert.equal(v.agenda.clock, 0);
  assert.ok(v.agenda.stages.length >= 4 && v.agenda.stages.length <= 5, 'staged agenda');
  const nodeIds = new Set(w.map.nodes.map(n => n.id));
  assert.ok(nodeIds.has(v.seatNodeId), 'seat is a real map node');
});

test('U128-03 agenda signs never name the villain (rumor-first law)', () => {
  for (const seed of ['u128-a', 'u128-b', 'u128-c', 'u128-d']) {
    const v = villainGenesis(mkWorld(seed));
    for (const s of v.agenda.stages) {
      assert.ok(s.sign.length >= 10, `stage ${s.id} has a substantive sign`);
      assert.ok(!s.sign.includes(v.name), `sign for ${s.id} must not name ${v.name}`);
      assert.ok(!s.sign.includes(v.epithet), `sign for ${s.id} must not carry the epithet`);
    }
  }
});

test('U128-04 mintVillain is idempotent; no map → no villain', () => {
  const w = mkWorld('u128-mint');
  const w1 = mintVillain(w);
  assert.ok(w1.villain, 'minted');
  const w2 = mintVillain(w1);
  assert.equal(w2, w1, 'second mint is a no-op (same reference)');

  const bare = { meta: { seed: 'x' }, map: { nodes: [] } };
  assert.equal(mintVillain(bare).villain, undefined, 'no geography, no villain');
});

test('U128-05 ensureVillain normalizes garbage and clamps the cursor', () => {
  assert.equal(ensureVillain(null), null);
  assert.equal(ensureVillain('strahd'), null);
  assert.equal(ensureVillain({}), null, 'no ref → null');
  assert.equal(ensureVillain({ ref: 'villain:x', agenda: { stages: [] } }), null, 'no stages → null');

  const v = ensureVillain({
    ref: 'villain:x', name: 'Vess', epithet: 'the Patient', creature: 'Lich', cr: 99,
    seatNodeId: 'n9', discovered: 'yes', defeated: 0,
    agenda: { stage: 42, clock: -3, stages: [{ id: 'gather', label: 'g', sign: 's' }, { id: 'strike', label: 's', sign: 's' }] }
  });
  assert.equal(v.cr, 30, 'cr clamped');
  assert.equal(v.agenda.stage, 1, 'stage clamped into bounds');
  assert.equal(v.agenda.clock, 0, 'clock clamped to 0');
  assert.equal(v.discovered, false, 'non-boolean discovered → false');
});

test('U128-06 villain survives ensureWorld and passes invariants', () => {
  const w = mintVillain(mkWorld('u128-inv'));
  const w2 = ensureWorld(w);
  assert.deepEqual(w2.villain, w.villain, 'ensureWorld preserves the villain');
  assertWorldInvariants(w2);

  const fresh = mkWorld('u128-null');
  assert.equal(fresh.villain, null, 'unminted worlds carry villain: null');
  assertWorldInvariants(fresh);
});

test('U128-07 invariants reject malformed villains', () => {
  const w = mintVillain(mkWorld('u128-bad'));

  const badStage = { ...w, villain: { ...w.villain, agenda: { ...w.villain.agenda, stage: 99 } } };
  assert.throws(() => assertWorldInvariants(badStage), /stage/);

  const badSeat = { ...w, villain: { ...w.villain, seatNodeId: 'node_nowhere' } };
  assert.throws(() => assertWorldInvariants(badSeat), /seat/i);
});
