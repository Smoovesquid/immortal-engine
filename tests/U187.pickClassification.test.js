// U187 (H-11): "pick" classification. The broad pick parser matched a SELECTION
// ("pick one of the gates") as lock-picking, and treated a bare "gate" as a lock
// target — narrating "pin by pin… it springs open" for a choose-an-option beat,
// which then fed the wrong scene context downstream. A selection/info "pick" must
// never render as lock-picking; a genuine "pick the lock" still must.
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
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u187-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const LOCKPICK_PROSE = /pin by pin|your pick bends|resists every twist and probe/i;

describe('U187: selection/info "pick" never renders as lock-picking', () => {
  for (const text of ['pick one of the gates', 'pick any door, your choice', 'you pick which gate we take', 'pick whichever gate']) {
    it(`"${text}" is not lock-picked`, () => {
      const out = playerMove(begin('pick'), packs, text).output;
      assert.doesNotMatch(out.narration, LOCKPICK_PROSE, `selection rendered as lock-pick: ${out.narration}`);
    });
  }
});

describe('U187: a bare "gate" no longer triggers the lock-pick path', () => {
  it('"pick the gate" (no lock mentioned) is not lock-picked', () => {
    const out = playerMove(begin('gate'), packs, 'pick the gate').output;
    assert.doesNotMatch(out.narration, LOCKPICK_PROSE, `bare gate lock-picked: ${out.narration}`);
  });
});

describe('U187: a genuine lock-pick still resolves as lock-picking (no regression)', () => {
  for (const text of ['I pick the lock on the gate', 'pick the lock', 'I pick the chest']) {
    it(`"${text}" still lock-picks`, () => {
      // Search a few seeds so we hit a non-floor outcome that exercises the branch.
      let sawLockpick = false;
      for (let i = 0; i < 6 && !sawLockpick; i++) {
        const out = playerMove(begin(`lk${i}`), packs, text).output;
        if (LOCKPICK_PROSE.test(out.narration)) sawLockpick = true;
      }
      assert.ok(sawLockpick, `genuine lock-pick lost its prose: "${text}"`);
    });
  }
});
