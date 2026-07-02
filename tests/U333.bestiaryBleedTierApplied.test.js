// U333 — a bestiary monster's bleeding attack applies the RIGHT tier.
//
// engine/ruleset/core/bestiary/catalog/standard.js: 30 attacks across 26
// creatures were converted from the inert `conditions: ['bleeding']` string
// to `conditions: [makeBleed('<tier>')]`. This test proves (a) no bare
// string 'bleeding' survives in standard.js, (b) every remaining bleed
// reference is a well-formed makeBleed() object with a real tier, and
// (c) driving a real attack (Troll's Claw) through resolveCombatTurn lands
// the condition on the target with the correct bleedTier + severity —
// end to end, not just data-shape.
//
// LLM-off.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { resolveCombatTurn } from '../engine/combat/combatResolve.js';
import { isBleedTier, BLEED_TIERS } from '../engine/combat/bleed.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('U333: no bare-string \'bleeding\' condition remains in standard.js', () => {
  const src = fs.readFileSync(path.join(__dirname, '../engine/ruleset/core/bestiary/catalog/standard.js'), 'utf8');
  assert.doesNotMatch(src, /conditions:\s*\[\s*'bleeding'/, 'a bare-string bleeding ref should have been converted to makeBleed(tier)');
});

test('U333: every bleeding condition in standard.js is a well-formed makeBleed() object with a real tier', () => {
  let found = 0;
  for (const creature of standard) {
    for (const action of (creature.actions || [])) {
      for (const cond of (action.conditions || [])) {
        if (cond && typeof cond === 'object' && cond.name === 'bleeding') {
          found++;
          assert.ok(isBleedTier(cond.bleedTier), `${creature.name} / ${action.name}: bleedTier '${cond.bleedTier}' is not a real tier`);
          assert.equal(cond.severity, BLEED_TIERS[cond.bleedTier].severity, `${creature.name} / ${action.name}: severity should match its tier`);
          assert.equal(cond.onTick, BLEED_TIERS[cond.bleedTier].onTick, `${creature.name} / ${action.name}: onTick should match its tier`);
          assert.equal(cond.stackBehavior, 'highest', `${creature.name} / ${action.name}: bleed should keep makeBleed's 'highest' stacking`);
        }
      }
    }
  }
  assert.ok(found >= 26, `expected at least 26 bleed condition instances across standard.js creatures, found ${found}`);
});

function mkPlayerWorld(seedKey) {
  let w = newWorld({ seed: `u333-${seedKey}`, fate: 0.0, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    party: [{
      id: 'party', name: 'Adventurer', vibe: 'steady', archetype: 'wanderer',
      wounds: 0, stress: 0, resources: { Supply: 5 }, level: 5,
      stats: { MIGHT: 20, AGILITY: 14, WITS: 12, GRIT: 6, CHARM: 10 },
      inventory: { items: [] },
    }],
    scene: { location: 'test', objective: 'slay', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  return w;
}

const STANDARD_INIT = [
  { id: 'party', type: 'party', roll: 16, modifier: 2, total: 18 },
  { id: 'enemy_0', type: 'enemy', roll: 12, modifier: 3, total: 15 }
];

test('U333: a real bestiary attack (Troll — Claw, deep) lands its exact bleedTier on the target when it hits', () => {
  const troll = standard.find(c => c.ref === 'troll');
  assert.ok(troll, 'troll should exist in standard.js');
  const claw = troll.actions.find(a => a.name === 'Claw');
  assert.ok(claw, 'troll should have a Claw action');
  assert.equal(claw.conditions[0].bleedTier, 'deep', 'troll Claw should be tier deep per the dispatch tier assignment');

  // Build an enemy with only the Claw action and a guaranteed-hit toHit,
  // targeting the player (AC low enough it always connects).
  const enemy = {
    id: 'enemy_0', name: troll.name, hp: 60, maxHp: 60, damage: 5, ac: 1, cr: troll.cr,
    stats: troll.stats, damageType: 'slashing', resistances: {}, conditionImmunities: [], conditions: [],
    actions: [{ ...claw, toHit: 20 }], // force-hit
    multiattack: null, saveProficiencies: [], canParley: false, defeated: false,
    sourceNpcId: 'npc_troll', lootTableRef: null, initMod: 0
  };
  let w = mkPlayerWorld('troll-claw');
  w = applyDeltas(w, [{
    op: 'combatState',
    set: { active: true, round: 1, turnIndex: 0, enemies: [enemy], beganAt: 0, reason: 'test', playerGuard: false, companionGuard: false, initiativeOrder: STANDARD_INIT }
  }]);
  const res = resolveCombatTurn(w, { approachTag: 'endure' });
  w = res.world;
  const playerBleed = (w.party[0].conditions || []).find(c => c.name === 'bleeding');
  assert.ok(playerBleed, `player should carry a bleeding condition after the troll's Claw hits — summary: ${res.result.combatSummary}`);
  assert.equal(playerBleed.bleedTier, 'deep', 'the applied condition should preserve the deep tier through normalizeCondition');
  assert.equal(playerBleed.severity, BLEED_TIERS.deep.severity, 'severity should match the deep tier');
});
