// U109 — Morality M2 (slice 1): the world reads your soul.
//
// Two wires built on M1's soul: (A) a deed witnessed by NPCs shifts THEIR trust (cruelty
// down, aid up; no witnesses → no shift); (B) the player's corruption/virtue precede their
// words — the social DC rises for charm/persuade/deceive when corrupt (and falls for
// intimidate), and falls for charm/persuade when virtuous. Bounded, deterministic.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u109-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const npcsAt = (w) => { const n = w.map.nodes.find(x => x.id === w.map.currentNodeId); return n?.settlement?.npcs || []; };
const trustList = (w) => npcsAt(w).map(n => Number(n.conversationState?.trustLevel ?? 5));
const dcOf = (w, cmd) => { const m = String(playerMove(w, packs, cmd).output.mechanics || '').match(/DC:(\d+)/); return m ? +m[1] : null; };
const withAxis = (seed, axis, by) => (by ? applyDeltas(begin(seed), [{ op: 'axisDelta', axis, by }]) : begin(seed));

describe('U109-A: witnesses remember the deed', () => {
  it('witnessed cruelty drops the present NPCs\' trust', () => {
    const before = trustList(begin('a'));
    const after = trustList(playerMove(begin('a'), packs, 'I torture the prisoner here in front of everyone').world);
    assert.equal(before.length, after.length, 'node not emptied');
    assert.ok(after.length > 0);
    // every non-floored witness lost trust
    for (let i = 0; i < before.length; i++) {
      if (before[i] > 0) assert.ok(after[i] < before[i], `witness ${i} trust ${before[i]}→${after[i]} should drop`);
    }
  });
  it('witnessed aid raises trust', () => {
    const before = trustList(begin('a'));
    const after = trustList(playerMove(begin('a'), packs, 'I give the starving man my last bread').world);
    let rose = false;
    for (let i = 0; i < before.length; i++) if (after[i] > before[i]) rose = true;
    assert.ok(rose, 'at least one witness should trust you more');
  });
  it('an ordinary (non-deed) action shifts no trust', () => {
    const before = trustList(begin('a'));
    const after = trustList(playerMove(begin('a'), packs, 'examine the door').world);
    assert.deepEqual(after, before);
  });
});

describe('U109-B: your soul precedes your words (social DC)', () => {
  it('a corrupt player finds charm / persuade / deceive HARDER', () => {
    for (const cmd of ['charm the trader', 'persuade the trader', 'deceive the trader']) {
      const clean = dcOf(begin('b'), cmd);
      const corrupt = dcOf(withAxis('b', 'wrath', 80), cmd);
      assert.ok(clean != null && corrupt != null, `${cmd}: got ${clean}/${corrupt}`);
      assert.ok(corrupt > clean, `${cmd}: corrupt DC ${corrupt} should exceed clean ${clean}`);
    }
  });
  it('a corrupt player finds intimidate EASIER (they are feared)', () => {
    const clean = dcOf(begin('b'), 'intimidate the trader');
    const corrupt = dcOf(withAxis('b', 'wrath', 80), 'intimidate the trader');
    assert.ok(corrupt < clean, `intimidate: corrupt ${corrupt} should be < clean ${clean}`);
  });
  it('a virtuous player is more easily trusted (charm EASIER)', () => {
    const clean = dcOf(begin('b'), 'charm the trader');
    const virtuous = dcOf(withAxis('b', 'charity', 80), 'charm the trader');
    assert.ok(virtuous < clean, `charm: virtuous ${virtuous} should be < clean ${clean}`);
  });
  it('the shift stays bounded and playable (DC never absurd)', () => {
    const corrupt = dcOf(withAxis('b', 'wrath', 100), 'charm the trader');
    assert.ok(corrupt >= 5 && corrupt <= 25, `DC should stay sane: ${corrupt}`);
  });
});

describe('U109-C: deterministic / replay-safe', () => {
  it('same seed + corruption + input → identical DC and hash', () => {
    const a = withAxis('det', 'wrath', 50), b = withAxis('det', 'wrath', 50);
    assert.equal(dcOf(a, 'charm the trader'), dcOf(b, 'charm the trader'));
    assert.equal(worldHash(playerMove(a, packs, 'charm the trader').world), worldHash(playerMove(b, packs, 'charm the trader').world));
  });
});
