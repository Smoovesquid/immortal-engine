// U297: DX-2b — tactical intent by voice (live escapeCombat engine).
//
// "Take the high ground" / "flank it" are spoken commands that set the player's
// tactical position (DX-2a schema: combat.playerTactical / enemy.tactical) and
// grant ADVANTAGE on the player's attack roll (2d20, keep higher). This is the
// mechanic landing in the engine the v1 demo actually runs. Position holds
// within a fight and resets on the next one. THE LAW still holds — the engine
// owns the number; DX-1's read narrates it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld, newWorld } from '../engine/state.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { beginCombat } from '../engine/combat/combatLifecycle.js';
import { resolveEscapeCombatTurn, initEscapeHp, parseEscapeAction } from '../engine/combat/escapeCombat.js';
import { worldHash } from '../engine/worldHash.js';

function freshFight(seed = 'u297', enemyOver = {}) {
  let w = newWorld({ seed, fate: 0.3, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w = ensureWorld({
    ...w,
    meta: { ...w.meta, mode: 'escape' },
    party: [{ id: 'party', name: 'Sera', archetype: 'wanderer', wounds: 0, stress: 0,
      stats: { MIGHT: 13, AGILITY: 12, GRIT: 13, CHARM: 10, WITS: 11 } }],
    scene: { location: 'the millyard', objective: 'survive', time: 'dusk', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null }
  });
  w = initEscapeHp(w);
  w = beginCombat(w, { enemies: [{ name: 'Wolf', hp: 40, maxHp: 40, damage: 3, ac: 15, canParley: false, ...enemyOver }], reason: 'ambush' });
  return w;
}

const setHighGround = (w) => applyDeltas(w, [{ op: 'combatState', set: { playerTactical: { cover: 'none', flanked: false, highGround: true } } }]);
const atkOf = (result) => Number(/atk:(\d+)/.exec(result.mechanicsLine || '')?.[1] ?? NaN);

// ── 1: voice recognition ──────────────────────────────────────────────────────

test('U297-01: parseEscapeAction recognizes high-ground and flank intents', () => {
  for (const s of ['take the high ground', 'I climb to higher ground', 'get up above it']) {
    assert.equal(parseEscapeAction(s).verb, 'highground', s);
  }
  for (const s of ['flank it', 'circle behind the wolf', 'slip to its side', 'get around to their rear']) {
    assert.equal(parseEscapeAction(s).verb, 'flank', s);
  }
  // The broad cover match still wins for plain "behind"/"duck".
  assert.equal(parseEscapeAction('duck behind the cart').verb, 'cover');
  assert.equal(parseEscapeAction('take cover').verb, 'cover');
});

// ── 2: voice → tactical state ─────────────────────────────────────────────────

test('U297-02: "take the high ground" sets the player on high ground (held across rounds)', () => {
  let w = freshFight('hg');
  assert.equal(w.combat.playerTactical.highGround, false, 'fresh fight starts in the open');
  w = resolveEscapeCombatTurn(w, 'I take the high ground').world;
  assert.equal(w.combat.playerTactical.highGround, true);
  // A later non-positioning turn keeps it.
  w = resolveEscapeCombatTurn(w, 'I strike the wolf').world;
  assert.equal(w.combat.playerTactical.highGround, true, 'high ground holds within the fight');
});

test('U297-03: "flank it" marks the targeted foe as flanked', () => {
  let w = freshFight('fl');
  w = resolveEscapeCombatTurn(w, 'I circle behind the wolf to flank it').world;
  assert.equal(w.combat.enemies[0].tactical.flanked, true);
});

test('U297-04: a new fight resets tactical position (no leak across combats)', () => {
  let w = freshFight('reset');
  w = resolveEscapeCombatTurn(w, 'I take the high ground').world;
  assert.equal(w.combat.playerTactical.highGround, true);
  // End the fight and start a new one.
  w = applyDeltas(w, [{ op: 'combatState', set: { active: false } }]);
  w = beginCombat(w, { enemies: [{ name: 'Boar', hp: 20, maxHp: 20, damage: 3, ac: 12, canParley: false }], reason: 'ambush' });
  assert.equal(w.combat.playerTactical.highGround, false, 'the next fight starts in the open');
});

// ── 3: position grants advantage (the engine owns the number) ─────────────────

test('U297-05: high ground gives advantage — the attack roll is never lower, sometimes higher', () => {
  let strictlyHigher = 0;
  for (let i = 0; i < 40; i++) {
    const base = freshFight(`adv-${i}`);
    const plain = resolveEscapeCombatTurn(base, 'I strike the wolf').result;
    const adv = resolveEscapeCombatTurn(setHighGround(base), 'I strike the wolf').result;
    const a0 = atkOf(plain), a1 = atkOf(adv);
    if (Number.isFinite(a0) && Number.isFinite(a1)) {
      assert.ok(a1 >= a0, `seed ${i}: advantage roll ${a1} must be >= plain ${a0}`);
      if (a1 > a0) strictlyHigher++;
    }
  }
  assert.ok(strictlyHigher > 0, 'advantage must raise the roll on at least one seed');
});

test('U297-06: a flanked foe grants the same advantage to the attacker', () => {
  let strictlyHigher = 0;
  for (let i = 0; i < 40; i++) {
    const base = freshFight(`fladv-${i}`);
    const plain = resolveEscapeCombatTurn(base, 'I strike the wolf').result;
    const flankedWorld = applyDeltas(base, [{ op: 'combatState', set: {
      enemies: base.combat.enemies.map(e => ({ ...e, tactical: { ...e.tactical, flanked: true } }))
    } }]);
    const adv = resolveEscapeCombatTurn(flankedWorld, 'I strike the wolf').result;
    const a0 = atkOf(plain), a1 = atkOf(adv);
    if (Number.isFinite(a0) && Number.isFinite(a1)) {
      assert.ok(a1 >= a0, `seed ${i}: flanked-foe roll ${a1} must be >= plain ${a0}`);
      if (a1 > a0) strictlyHigher++;
    }
  }
  assert.ok(strictlyHigher > 0, 'flanking must raise the roll on at least one seed');
});

// ── 4: determinism ────────────────────────────────────────────────────────────

test('U297-07: same seed + same spoken sequence → identical worldHash', () => {
  const run = () => {
    let w = freshFight('det');
    w = resolveEscapeCombatTurn(w, 'I take the high ground').world;
    w = resolveEscapeCombatTurn(w, 'I circle behind the wolf to flank it').world;
    w = resolveEscapeCombatTurn(w, 'I strike the wolf').world;
    return worldHash(w);
  };
  assert.equal(run(), run());
});
