// U106 — Ridiculous statements get a sarcastic DM, not a d20.
//
// Extends the impossible-feat gate (U105) to grandiose BOASTS ("sword of infinite
// power", "strongest in all the world", "king of everything") and META / 4th-wall
// pokes ("I'm the DM now", "give me 1000 gold", "I win", "delete the world"). Each
// gets a dry crotchety-DM comeback resolved as a no-effect (no success/failure roll),
// stays grounded/well-formed, varies on repeat, and DOESN'T catch legitimate play.

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
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u106-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const FLOOR = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;
const bare = (o) => String(o.narration || '').replace(/^Wizard:\s*/, '');
const isRidiculous = (o) => /unmoved|nice try/.test(String(o.mechanics || ''));
const hasRoll = (o) => /roll:\s*\d+\s*vs\s*DC/i.test(String(o.mechanics || ''));

describe('U106-A: grandiose boasts get a sarcastic no-effect', () => {
  const cases = [
    'I draw my sword of infinite power',
    'I have unlimited gold',
    'I have ultimate power',
    'I am the strongest warrior in all the world',
    'I am the mightiest who ever lived',
    'I am the king of everything',
  ];
  for (const cmd of cases) {
    it(`"${cmd}" → sarcastic, no roll, grounded`, () => {
      const { output } = playerMove(begin('boast'), packs, cmd);
      assert.ok(isRidiculous(output), `should be ridiculous: ${output.mechanics}`);
      assert.ok(!hasRoll(output), `no d20: ${output.mechanics}`);
      assert.doesNotMatch(bare(output), FLOOR, bare(output));
      assert.ok(/[.!?")…]$/.test(bare(output)), `well-formed: ${bare(output)}`);
    });
  }
});

describe('U106-B: meta / 4th-wall pokes get a sarcastic no-effect', () => {
  const cases = [
    'I am the DM now',
    'Give me 1000 gold',
    'grant me a legendary sword',
    'I win the game',
    'I delete the world',
    'I rewrite the rules',
  ];
  for (const cmd of cases) {
    it(`"${cmd}" → sarcastic, no roll`, () => {
      const { output } = playerMove(begin('meta'), packs, cmd);
      assert.ok(isRidiculous(output), `should be ridiculous: ${output.mechanics}`);
      assert.ok(!hasRoll(output), `no d20: ${output.mechanics}`);
    });
  }
});

describe('U106-C: legitimate play is NOT caught (no false positives)', () => {
  const ordinary = [
    'I draw my sword', 'I examine the crate', 'I take the lantern',
    'I want to buy a sword', 'I am the strongest man in the village',
    'I give the beggar 10 gold', 'I am a powerful mage', 'I am the new sheriff',
    'I look at the king', 'I cast fire bolt at the wolf',
  ];
  for (const cmd of ordinary) {
    it(`"${cmd}" routes normally`, () => {
      const { output } = playerMove(begin('fp'), packs, cmd);
      assert.ok(!isRidiculous(output), `should NOT be ridiculous: ${output.mechanics}`);
    });
  }
});

describe('U106-D: sarcasm varies on repeat, stays deterministic', () => {
  it('repeating the same absurd claim does not echo verbatim', () => {
    let w = begin('vary');
    const out = [];
    for (let i = 0; i < 4; i++) { const r = playerMove(w, packs, 'I am the king of everything'); out.push(bare(r.output)); w = r.world; }
    let consecutive = 0;
    for (let i = 1; i < out.length; i++) if (out[i] === out[i - 1]) consecutive++;
    assert.equal(consecutive, 0, `no consecutive verbatim: ${JSON.stringify(out)}`);
  });
  it('same seed + input → identical', () => {
    const a = playerMove(begin('det'), packs, 'I have infinite power');
    const b = playerMove(begin('det'), packs, 'I have infinite power');
    assert.equal(a.output.narration, b.output.narration);
    assert.equal(a.output.mechanics, b.output.mechanics);
  });
});
