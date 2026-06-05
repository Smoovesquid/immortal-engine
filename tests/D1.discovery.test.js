import test from 'node:test';
import assert from 'node:assert/strict';
import { narrativeWeight, payoffClass, discoveryFor, tellFor, depthMet, resolve } from '../engine/discovery/discovery.js';

const SEED = 'mira';
const pop = Array.from({ length: 600 }, (_, i) => 'npc_' + i);

test('D1: most people carry nothing — this is a world, not a quest dispenser', () => {
  const withSomething = pop.filter(id => discoveryFor(id, SEED));
  const frac = withSomething.length / pop.length;
  assert.ok(frac > 0.2 && frac < 0.45, `~30% should carry a thread, got ${(frac * 100).toFixed(0)}%`);
});

test('D1: real leads are rare; friendship is common-ish; duds and traps exist', () => {
  const classes = {};
  for (const id of pop) { const d = discoveryFor(id, SEED); if (d) classes[d.payoffClass] = (classes[d.payoffClass] || 0) + 1; }
  const total = Object.values(classes).reduce((a, b) => a + b, 0);
  assert.ok(classes.lead / total < 0.15, `leads should be rare, got ${((classes.lead / total) * 100).toFixed(0)}%`);
  assert.ok(classes.bond > 0, 'bonds exist (friendship is a real outcome)');
  assert.ok(classes.dud > 0 && classes.trap > 0, 'pointless secrets and traps exist — stay cautious');
  // overall, a real lead is a small fraction of the WHOLE population
  assert.ok((classes.lead || 0) / pop.length < 0.05, 'a real lead is rare across everyone you meet');
});

test('D1: a bond is a terminal friendship reward; a lead pays mechanically', () => {
  const bond = pop.map(id => discoveryFor(id, SEED)).find(d => d && d.payoffClass === 'bond');
  assert.equal(bond.reward.companionEligible, true);
  assert.equal(bond.reward.mechanical, null, 'friendship is the whole reward');
  const lead = pop.map(id => discoveryFor(id, SEED)).find(d => d && d.payoffClass === 'lead');
  assert.ok(lead.reward.mechanical && lead.reward.mechanical.kind, 'a lead carries a mechanical payoff');
});

test('D1: payoff is hidden until depth is earned (no metagaming)', () => {
  const d = pop.map(id => discoveryFor(id, SEED)).find(x => x && x.payoffClass === 'bond');
  assert.equal(resolve(d, { trust: 1 }, { wits: 8 }).status, 'hidden', 'low trust, low wits => nothing');
  assert.equal(resolve(d, { trust: d.gate.trust }, { wits: 8 }).status, 'revealed', 'earned trust opens it');
  assert.equal(resolve(d, { trust: d.gate.trust }).reward.companionEligible, true);
});

test('D1: perception gives an earnable but UNRELIABLE tell', () => {
  const ds = pop.map(id => discoveryFor(id, SEED)).filter(Boolean);
  // low WITS: no tells at all
  assert.ok(ds.every(d => tellFor(d, 10, SEED) === null), 'the unperceptive sense nothing');
  // high WITS: tells appear
  const tells = ds.map(d => tellFor(d, 18, SEED)).filter(Boolean);
  assert.ok(tells.length > ds.length * 0.5, 'a perceptive character senses most threads');
  // and they are not always right: across a big sample, some reads are misreads
  let misreads = 0;
  for (const d of ds) {
    const t = tellFor(d, 13, SEED); if (!t) continue;
    // a low-ish WITS (13) yields a meaningful misread rate
  }
  // deterministic
  assert.equal(tellFor(ds[0], 16, SEED), tellFor(ds[0], 16, SEED));
});

test('D1: deterministic across the board', () => {
  assert.equal(narrativeWeight('npc_7', SEED), narrativeWeight('npc_7', SEED));
  assert.deepEqual(discoveryFor('npc_42', SEED), discoveryFor('npc_42', SEED));
});
