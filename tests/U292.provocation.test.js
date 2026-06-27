// U292 — social provocation: insults carry risk, and the risk is personal.
//
// [[IG-11]] social physics, the verbal sibling of the gratuitous-magic consequence
// ladder. Pure + deterministic (engine/npc/provocation.js). The LLM never sets the
// number (Biblioteca Vol 11) — these tests pin the deterministic table.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  npcTemperament, temperamentLabel, insultSeverity, resolveProvocation, assessProvocation, carriedGrudge
} from '../engine/npc/provocation.js';

const RANK = { none: 0, shrug: 0, warn: 1, bristle: 2, attack: 3 };

test('U292: severity ranks grievous > sharp > mild > look > none', () => {
  assert.ok(insultSeverity('your dead mother was a whoreson').points > insultSeverity('you coward').points);
  assert.ok(insultSeverity('you coward').points > insultSeverity('I mock him openly').points);
  assert.ok(insultSeverity('I mock him openly').points > insultSeverity('I glare at him').points);
  assert.equal(insultSeverity('I ask about the weather').points, 0);
  assert.equal(insultSeverity('I ask about the weather').tier, 'none');
});

test('U292: a VOLATILE npc sucker-punches on the first slight; a STOIC one shrugs it off', () => {
  const volatile = resolveProvocation({ tolerance: 12, priorOffense: 0, severity: 25 }); // "you coward"
  assert.equal(volatile.verdict, 'attack', 'low fuse → the first sharp insult tips to violence');
  const stoic = resolveProvocation({ tolerance: 90, priorOffense: 0, severity: 25 });
  assert.notEqual(stoic.verdict, 'attack', 'high fuse → the same insult does NOT trigger an attack');
});

test('U292: even a stoic breaks under SUSTAINED grievous abuse (not literally infinite)', () => {
  let offense = 0, verdict = 'shrug';
  for (let i = 0; i < 5 && verdict !== 'attack'; i++) {
    const r = resolveProvocation({ tolerance: 90, priorOffense: offense, severity: 40 });
    offense = r.offense; verdict = r.verdict;
  }
  assert.equal(verdict, 'attack', 'repeated grievous insults eventually break even a patient person');
});

test('U292: the ladder never steps DOWN as offense accumulates, and ends in violence', () => {
  const seq = [10, 25, 40, 60].map(po => resolveProvocation({ tolerance: 50, priorOffense: po, severity: 5 }).verdict);
  for (let i = 1; i < seq.length; i++) assert.ok(RANK[seq[i]] >= RANK[seq[i - 1]], `ladder regressed: ${seq}`);
  assert.equal(seq.at(-1), 'attack');
});

test('U292: an npc who already dislikes you is closer to the edge (never calmer)', () => {
  const friendly = resolveProvocation({ tolerance: 50, severity: 20, disposition: 0 });
  const hostile  = resolveProvocation({ tolerance: 50, severity: 20, disposition: -80 });
  assert.ok(RANK[hostile.verdict] >= RANK[friendly.verdict]);
  assert.ok(hostile.offense > friendly.offense, 'pre-existing dislike adds offense pressure');
});

test('U292: temperament is deterministic per npc and genuinely varied across a town', () => {
  assert.equal(npcTemperament('tallow', 'npc_3_7'), npcTemperament('tallow', 'npc_3_7'), 'same npc → same fuse');
  const tols = Array.from({ length: 300 }, (_, i) => npcTemperament('tallow', 'npc_x_' + i));
  assert.ok(tols.some(t => t < 22), 'a town holds at least one volatile soul');
  assert.ok(tols.some(t => t > 76), 'and at least one who suffers anything');
  assert.ok(Math.max(...tols) - Math.min(...tols) > 50, 'a real spread, not all the same');
  assert.equal(temperamentLabel(10), 'volatile');
  assert.equal(temperamentLabel(90), 'stoic');
  assert.equal(temperamentLabel(50), 'even');
});

test('U292: a grudge is REMEMBERED but cools — carried offense is half the peak, never zero, never full', () => {
  assert.equal(carriedGrudge(100), 50, 'cools to half');
  assert.equal(carriedGrudge(0), 0, 'no grudge → nothing carried');
  assert.equal(carriedGrudge(25), 13, 'rounds');
  assert.ok(carriedGrudge(80) > 0 && carriedGrudge(80) < 80, 'remembered (>0) but cooler than the moment (<full)');
  // The remembered grudge + a fresh full insult is what a returning player faces:
  // an even NPC (fuse 50) who was pushed to 60 of offense is carried at 30, so one
  // fresh sharp jab (25) lands at 55 — over the edge. They remembered.
  const r = resolveProvocation({ tolerance: 50, priorOffense: carriedGrudge(60), severity: 25 });
  assert.equal(r.verdict, 'attack', 'a remembered grudge + a fresh slight can still tip them');
});

test('U292: assessProvocation is deterministic (replay-safe); non-insults never trigger', () => {
  const args = { seed: 'tallow', npcId: 'npc_1_2', text: 'you spineless coward', priorOffense: 0, disposition: 0 };
  assert.deepEqual(assessProvocation(args), assessProvocation(args), 'same inputs → same verdict');
  assert.equal(assessProvocation({ seed: 'tallow', npcId: 'npc_1_2', text: 'good morning, friend' }).verdict, 'none');
});
