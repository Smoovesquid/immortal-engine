// U104 — Stage E: deterministic prose variation (a DM never repeats verbatim).
//
// Repeating the same action across turns produces VARIED grounded prose with no
// consecutive verbatim echo, while staying fully deterministic: same world-state +
// input → identical output (replay/U21 safe). Every variant is grounded (no abstract
// floor, names the place/thing, outcome-correct).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u104-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const FLOOR = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;
const bare = (o) => String(o.narration || '').replace(/^Wizard:\s*/, '');

function sequence(seed, cmd, n) {
  let w = begin(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = playerMove(w, packs, cmd);
    out.push(bare(r.output));
    w = r.world;
  }
  return out;
}

describe('U104-A: repeated actions vary (no verbatim echo)', () => {
  for (const cmd of ['I wait quietly', 'I do the thing', 'I improvise']) {
    it(`"${cmd}" varies across turns with no consecutive repeat`, () => {
      const s = sequence('vary', cmd, 5);
      const distinct = new Set(s).size;
      assert.ok(distinct >= 2, `should produce >1 distinct line: ${JSON.stringify(s.slice(0, 2))}`);
      let consecutive = 0;
      for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) consecutive++;
      assert.equal(consecutive, 0, `no two consecutive turns should read verbatim: ${JSON.stringify(s)}`);
    });
  }
});

describe('U104-B: deterministic (replay-safe)', () => {
  it('same seed + same timeline position + same input → identical prose', () => {
    // Same fresh state, twice → identical (the property U21/U10x rely on).
    const a = playerMove(begin('det'), packs, 'I wait quietly').output;
    const b = playerMove(begin('det'), packs, 'I wait quietly').output;
    assert.equal(a.narration, b.narration);
    assert.equal(a.mechanics, b.mechanics);
  });
  it('an identical run of N turns reproduces the exact same sequence', () => {
    const a = sequence('rep', 'I do the thing', 6);
    const b = sequence('rep', 'I do the thing', 6);
    assert.deepEqual(a, b);
  });
});

describe('U104-C: every variant stays grounded', () => {
  it('no variant falls to the abstract floor across many turns', () => {
    for (const cmd of ['I wait quietly', 'I do the thing', 'I listen carefully', 'I sniff the air']) {
      for (const line of sequence('grnd', cmd, 6)) {
        assert.doesNotMatch(line, FLOOR, `floor leak: "${line}"`);
        assert.ok(line.length > 0 && /[.!?")…]$/.test(line), `should be well-formed prose: "${line}"`);
      }
    }
  });
});

describe('U104-D: outcomes still distinguishable under variation', () => {
  it('across seeds, a generic action shows both success- and failure-flavored variants', () => {
    const lines = new Set();
    for (let i = 0; i < 24; i++) lines.add(playerMove(begin(`o${i}`), packs, 'I do the thing').output.narration);
    const arr = [...lines];
    const success = arr.some(l => /goes your way|cleanly|opens a little|turns toward you/i.test(l));
    const failure = arr.some(l => /slips past|falls short|doesn't give it|where you started/i.test(l));
    assert.ok(success && failure, `should vary by outcome: ${arr.slice(0, 3).join(' | ')}`);
  });
});
