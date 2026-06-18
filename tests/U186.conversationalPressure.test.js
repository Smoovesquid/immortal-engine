// U186 (H-10): conversational pressure must not render as physical prose.
// "Push him until he admits it" trips the physical-force matcher (via "push"),
// and with a mixed/force outcome physicalObjectOutcome() narrated "the wood
// splinters" — physical prose for a verbal beat. A demand for a verbal
// concession ("admit it", "stop lying", "tell me the truth") must route through
// social adjudication, and must NEVER swallow a real physical command.
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
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u186-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const isSocial = (out) => /\[social:/.test(String(out.mechanics || ''));
const PHYSICAL_PROSE = /splinter|splintering crack|wood\b|haul yourself up|pin by pin/i;

describe('U186: verbal-concession pressure routes social, never physical prose', () => {
  const cases = [
    'I push him until he admits he doesnt know',
    'Stop lying and tell me the truth',
    'Just admit it already, you know more than you let on',
    'I demand he confess what he did',
  ];
  for (const text of cases) {
    it(`"${text.slice(0, 36)}…" → social, no physical prose`, () => {
      const out = playerMove(begin('press'), packs, text).output;
      assert.ok(isSocial(out), `should route through social: ${out.mechanics}`);
      assert.doesNotMatch(out.narration, PHYSICAL_PROSE, `verbal beat rendered as physical: ${out.narration}`);
    });
  }
});

describe('U186: real physical commands are NOT swallowed by the pressure path', () => {
  for (const text of ['I push the heavy door open', 'I force the iron gate', 'I climb the wall']) {
    it(`"${text}" stays physical (not social)`, () => {
      const out = playerMove(begin('phys'), packs, text).output;
      assert.ok(!isSocial(out), `physical command misrouted to social: ${out.mechanics}`);
    });
  }
});

describe('U186: a self-admission is not conversational pressure', () => {
  it('"I admit I was wrong" does not route to social pressure', () => {
    const out = playerMove(begin('self'), packs, 'I admit I was wrong about the road').output;
    // Not an intimidate social roll — it's the player conceding, not pressing.
    const m = String(out.mechanics || '');
    assert.ok(!/\[social:intimidate/.test(m), `self-admission misrouted to intimidate: ${m}`);
  });
});
