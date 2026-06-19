import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginCombat, mintEnemyFromNpc } from '../engine/combat/combatLifecycle.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-24 (Opus gate 06-18, CRASH): "I spit Greyhand's blood in Brennan's eyes and
// tackle him through the window." threw `Invariant: duplicate combat enemy id
// enemy_1`. Root cause: the mid-combat reinforcement path (playloop.js) minted a
// new combatant's id as `enemy_${enemies.length}`. After a foe FLEES it is
// removed from the array (escapeCombat.js:1733), so `length` no longer tracks the
// highest live id — the reinforcement reuses a live id. The fix derives the next
// id from the max existing numeric suffix, so it is collision-free even after a
// prune.

function setup() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  let w = beginAdventure(newWorld({ seed: 'glass-harbor', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npcs = node.settlement.npcs || [];
  const names = npcs.map(n => String(n.name).split(' ')[0]);
  const enemyA = { ...mintEnemyFromNpc(npcs[0]), hp: 50, maxHp: 50, defeated: false };
  w = beginCombat(w, { enemies: [enemyA], reason: 'test' });
  assert.ok(w.combat?.active, 'combat active against first NPC');
  return { w, byId, a: names[0], b: names[1] };
}
const enemyIds = (w) => (w.combat?.enemies || []).map(e => e.id);

test('U188: reinforcement after a fled foe was pruned does not collide ids', () => {
  const { w, byId, b } = setup();
  // Simulate the post-flee array: enemy_0 fled and was removed, leaving a single
  // live foe whose id is enemy_1 (array length 1, max id index 1).
  const lone = { ...w.combat.enemies[0], id: 'enemy_1' };
  let w1 = applyDeltas(w, [{ op: 'combatState', set: { enemies: [lone] } }]);
  assert.deepEqual(enemyIds(w1), ['enemy_1'], 'array pruned to a single enemy_1');

  // Attacking a NEW present NPC must mint a unique id — not reuse enemy_1.
  let w2;
  assert.doesNotThrow(() => { w2 = playerMove(w1, byId, `I lunge at ${b}'s throat`).world; },
    'reinforcement after prune must not throw a duplicate-id invariant');
  const ids = enemyIds(w2);
  assert.equal(new Set(ids).size, ids.length, `enemy ids unique: ${ids.join(',')}`);
  assert.ok(ids.includes('enemy_1'), 'the surviving foe is still present');
});

test('U188: a normal mid-fight reinforcement still mints a fresh sequential id', () => {
  const { w, byId, b } = setup();
  const before = enemyIds(w);
  const w2 = playerMove(w, byId, `I lunge at ${b}'s throat`).world;
  const after = enemyIds(w2);
  assert.equal(after.length, before.length + 1, 'exactly one enemy added');
  assert.equal(new Set(after).size, after.length, 'ids remain unique');
});
