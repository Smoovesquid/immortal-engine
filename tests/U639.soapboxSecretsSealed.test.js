// U639 — SOAPBOX-1: the soapbox opens the CAUSE, never the vault.
//
// A zealot preaches his cause to a stranger but still guards personal secrets.
// When evangelizing, the share-gate opens PUBLIC facts + rumors only — a personal
// (secret) fact is NEVER volunteered, even if its keyword rides the same breath as
// the cause. The secret still needs the ordinary high-trust reveal (>=8).

import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackRules } from '../engine/npc/npcBrain.js';

function ctx(overrides = {}) {
  return {
    npcId: 'zealot', trust: 0, secrets: new Set(),
    knownFacts: [], carriedRumors: [], memories: [],
    playerInput: '', turn: 0, factionStanding: null, soapbox: null,
    ...overrides
  };
}

const CAUSE_SOAPBOX = { cause: 'avian supremacy', eager: true, topics: ['chicken', 'chickens', 'skull'] };

test('U639: evangelizing at trust 0 shares PUBLIC facts + rumors, NEVER a secret', () => {
  const dec = fallbackRules(ctx({
    trust: 0,
    playerInput: 'tell me about chickens',
    secrets: new Set(['sec_shame']),
    knownFacts: [
      { id: 'pub_theory', text: 'the avian form is supreme' },
      { id: 'sec_shame', text: 'he was run out of the last town' },
    ],
    carriedRumors: [{ id: 'rum_road', text: 'a caravan is overdue' }],
    soapbox: CAUSE_SOAPBOX,
  }));
  assert.equal(dec.approach, 'evangelize', 'on his cause → evangelize');
  assert.ok(dec.share.includes('pub_theory'), 'the public tenet of the cause opens');
  assert.ok(dec.share.includes('rum_road'), 'rumors ride along');
  assert.ok(!dec.share.includes('sec_shame'), 'the personal secret stays SEALED while preaching');
});

test('U639: a secret whose keyword IS a soapbox word still never leaks on the cause', () => {
  // "skull" is both a soapbox keyword AND the id-topic of a personal secret here.
  const dec = fallbackRules(ctx({
    trust: 0,
    playerInput: 'tell me about the skull',
    secrets: new Set(['skull']),
    knownFacts: [{ id: 'skull', text: 'the reliquary skull he stole' }],
    soapbox: CAUSE_SOAPBOX,
  }));
  assert.equal(dec.approach, 'evangelize');
  assert.ok(!dec.share.includes('skull'), 'secret keyed to a cause-word is still withheld');
  assert.deepEqual(dec.share, [], 'nothing public to share → shares nothing, secret sealed');
});

test('U639: the vault still needs high trust — secrets open only at trust >= 8 (unchanged)', () => {
  const base = {
    playerInput: 'tell me your secret',
    secrets: new Set(['sec']),
    knownFacts: [{ id: 'sec', text: 'the personal thing' }],
    soapbox: CAUSE_SOAPBOX, // off-topic input, so the ladder governs
  };
  assert.ok(!fallbackRules(ctx({ ...base, trust: 0 })).share.includes('sec'), 'trust 0: sealed');
  assert.ok(!fallbackRules(ctx({ ...base, trust: 7 })).share.includes('sec'), 'trust 7: still sealed');
  assert.ok(fallbackRules(ctx({ ...base, trust: 8 })).share.includes('sec'), 'trust 8: the vault opens (baseline)');
});
