// U101 — Grounded floor for resolved physical actions (Stage B).
//
// "force the door", "break the crate", "climb the wall", "pick the lock" produce
// outcome-aware prose that NAMES the object and says what happened — never the
// abstract literary floor ("a low hum threads through the walls"). Skill checks
// still roll (UX2 intact). Deterministic.

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
const FLOOR = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u101-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const rolled = (out) => /roll:\s*\d+\s*vs/i.test(out.mechanics || '');

describe('U101-A: physical actions are grounded, not abstract floor', () => {
  const cases = [
    { cmd: 'force the door', word: 'door' },
    { cmd: 'break the crate', word: 'crate' },
    { cmd: 'smash the table', word: 'table' },
    { cmd: 'climb the wall', word: 'wall' },
    { cmd: 'pick the lock', word: 'lock' },
    { cmd: 'push the table', word: 'table' },
  ];
  for (const { cmd, word } of cases) {
    it(`"${cmd}" → names the target, no abstract floor`, () => {
      // Present furniture resolves via the physics branch ([physics:…]); other
      // targets via resolveMove (rolls) → Stage B grounding. BOTH must be grounded
      // (name the thing, no literary floor). (Skill-verb rolling is covered by UX2.)
      for (const s of ['a', 'b', 'c']) {
        const { output } = playerMove(begin(s), packs, cmd);
        assert.doesNotMatch(output.narration, FLOOR, `floor leak: ${output.narration}`);
        assert.match(output.narration.toLowerCase(), new RegExp(`\\b${word}\\b`), `should name "${word}": ${output.narration}`);
      }
    });
  }
});

describe('U101-B: absent target still grounded (no floor)', () => {
  it('"force the obsidian gate" (no such object) → grounded, names the gate', () => {
    const { output } = playerMove(begin('z'), packs, 'force the obsidian gate');
    assert.doesNotMatch(output.narration, FLOOR, output.narration);
    assert.match(output.narration.toLowerCase(), /obsidian gate/, output.narration);
  });
});

describe('U101-BB: non-object mechanical skills are grounded (search/sneak/track/forage)', () => {
  const cases = ['I search for hidden traps', 'sneak past the guard', 'hide in the shadows', 'track the creature', 'forage for food'];
  for (const cmd of cases) {
    it(`"${cmd}" → grounded, no abstract floor, still rolls`, () => {
      for (const s of ['a', 'b', 'c']) {
        const { output } = playerMove(begin(s), packs, cmd);
        assert.doesNotMatch(output.narration, FLOOR, `floor leak: ${output.narration}`);
        assert.ok(rolled(output), `should still roll: ${output.mechanics}`);
      }
    });
  }
  it('SOCIAL verbs (persuade) are intentionally NOT grounded here (deferred to dialogue)', () => {
    // Just assert it still rolls / doesn't crash — prose left to a later social slice.
    const { output } = playerMove(begin('soc'), packs, 'I try to persuade the guard');
    assert.ok(rolled(output));
  });
});

describe('U101-C: deterministic', () => {
  it('same seed + input → identical prose + mechanics', () => {
    const a = playerMove(begin('det'), packs, 'break the crate');
    const b = playerMove(begin('det'), packs, 'break the crate');
    assert.equal(a.output.narration, b.output.narration);
    assert.equal(a.output.mechanics, b.output.mechanics);
  });
});

describe('U101-D: outcome-awareness (success vs failure read differently)', () => {
  it('across seeds, both a success-flavored and a failure-flavored line appear', () => {
    const lines = new Set();
    for (let i = 0; i < 20; i++) lines.add(playerMove(begin(`o${i}`), packs, 'force the door').output.narration);
    // at least two distinct outcome lines (success "gives/yields" vs failure "holds fast")
    const hasSuccess = [...lines].some(l => /gives|yields|swings/i.test(l));
    const hasFail = [...lines].some(l => /holds fast|won't|doesn't budge|slide back|resists/i.test(l));
    assert.ok(hasSuccess && hasFail, `should vary by outcome: ${[...lines].slice(0, 3).join(' | ')}`);
  });
});
