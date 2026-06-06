// U105 — Crotchety-DM repair: clearly-impossible feats don't get a d20.
//
// A real DM doesn't roll to eat the sun or fly by flapping — he resolves it in the
// fiction as a no-effect. Without this, an absurd feat rolled a normal check and could
// report mechanical "success" while the narration (rightly) said nothing happened —
// dice and fiction contradicting. These attempts must resolve as a grounded no-effect
// (no success/failure roll tag) AND ordinary actions must NOT be caught (no false
// positives). Deterministic.

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
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u105-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const FLOOR = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;
const bare = (o) => String(o.narration || '').replace(/^Wizard:\s*/, '');
const isImpossible = (o) => /impossible/.test(String(o.mechanics || ''));
const hasRoll = (o) => /roll:\s*\d+\s*vs\s*DC/i.test(String(o.mechanics || ''));

describe('U105-A: impossible feats resolve as a grounded no-effect (no contradictory roll)', () => {
  const cases = [
    'I reach up, tear the sun out of the sky, and swallow it whole.',
    'I flap my arms and fly up to the ceiling.',
    'I become a god and smite them all.',
    'I reverse time to undo my mistake.',
    'I breathe fire at the guard.',
    'I swallow the moon.',
    'I pull the moon down from the sky.',
  ];
  for (const cmd of cases) {
    it(`"${cmd.slice(0, 40)}…" → impossible, no success/failure roll, grounded`, () => {
      const { output } = playerMove(begin('imp'), packs, cmd);
      assert.ok(isImpossible(output), `should be tagged impossible: ${output.mechanics}`);
      assert.ok(!hasRoll(output), `must NOT report a d20 success/failure: ${output.mechanics}`);
      assert.doesNotMatch(bare(output), FLOOR, bare(output));
      assert.ok(bare(output).length > 0 && /[.!?")…]$/.test(bare(output)), `well-formed prose: ${bare(output)}`);
    });
  }
});

describe('U105-B: ordinary actions are NOT caught (no false positives)', () => {
  const ordinary = [
    'I eat the bread', 'I look at the moon', 'I grab the star chart',
    'I reach for the moonstone amulet', 'I pull the lever', 'I take the lantern',
    'I drink the ale', 'I cast fire bolt at the wolf', 'I study the star map',
  ];
  for (const cmd of ordinary) {
    it(`"${cmd}" is NOT flagged impossible`, () => {
      const { output } = playerMove(begin('fp'), packs, cmd);
      assert.ok(!isImpossible(output), `should route normally: ${output.mechanics}`);
    });
  }
});

describe('U105-C: deterministic', () => {
  it('same seed + input → identical prose + mechanics', () => {
    const a = playerMove(begin('det'), packs, 'I swallow the sun whole.');
    const b = playerMove(begin('det'), packs, 'I swallow the sun whole.');
    assert.equal(a.output.narration, b.output.narration);
    assert.equal(a.output.mechanics, b.output.mechanics);
  });
});
