// U59: Composer combat lexicon — Pass B.
//
// When a turn is routed through the combat resolver, the playloop builds the
// composer resolution with updateKind:'combat' (and the new enemyName/parleyed
// plumbing). The composer must:
//   * detect combat via updateKind === 'combat'
//   * draw approach phrasing from COMBAT_LEXICON, not APPROACH_LEXICON
//   * route heart-success-parley vs heart-success-trivial to distinct banks
//   * mention the targeted enemy by name when present
//   * stay deterministic under the composer's seeded RNG
//   * leave mainline (non-combat) turns untouched

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { compose, buildCombatPhrase } from '../engine/composer.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { buildDMSystemPrompt } from '../engine/llmAdapter.js';

const APPROACHES = ['force', 'finesse', 'endure', 'heart', 'focus'];
const OUTCOMES = ['success', 'mixed', 'failure'];

function mkWorld(seedKey, fate = 0.3) {
  const w = newWorld({ seed: `u59-${seedKey}`, fate, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  w.scene = { location: 'arena', objective: 'survive', time: 'start', promptSeed: '0', tags: [], thread: '', interior: null, dialogue: null };
  w.party = [{ id: 'party', name: 'Party', vibe: 'steady', archetype: 'wanderer', wounds: 0, stress: 0, resources: { Supply: 5 }, stats: { MIGHT: 12, AGILITY: 12, GRIT: 12, CHARM: 12, WITS: 12 } }];
  return ensureWorld(w);
}

function mkRng(seedKey) {
  return makeRng(seedFromString(`u59-${seedKey}`));
}

// ── 1: buildCombatPhrase returns from the right bank ──────────────────────

test('U59-01: buildCombatPhrase force/success draws from the force-success combat bank', () => {
  const phrase = buildCombatPhrase({ approach: 'force', outcome: 'success', rng: mkRng('p1') });
  assert.equal(typeof phrase, 'string');
  assert.ok(phrase.length > 0);
  // Phrase must NOT match any clause from the mainline force-success bank.
  const mainline = ['bone and leverage win the argument', 'the world yields with a crack', 'brute momentum carries you', 'iron first, question later'];
  assert.ok(!mainline.includes(phrase), `combat phrase "${phrase}" leaked from mainline lexicon`);
});

// ── 2: All five approaches × three outcomes return non-empty strings ──────

test('U59-02: every (approach × outcome) cell yields a non-empty combat phrase', () => {
  for (const a of APPROACHES) {
    for (const o of OUTCOMES) {
      // Heart-success has two banks; pass parleyed:false here so it picks one.
      const phrase = buildCombatPhrase({ approach: a, outcome: o, parleyed: false, rng: mkRng(`${a}-${o}`) });
      assert.equal(typeof phrase, 'string', `${a}/${o} returned non-string`);
      assert.ok(phrase.length > 0, `${a}/${o} returned empty`);
    }
  }
});

// ── 3: Determinism under same rng seed ────────────────────────────────────

test('U59-03: buildCombatPhrase is deterministic for the same rng seed', () => {
  const p1 = buildCombatPhrase({ approach: 'finesse', outcome: 'success', rng: mkRng('det') });
  const p2 = buildCombatPhrase({ approach: 'finesse', outcome: 'success', rng: mkRng('det') });
  assert.equal(p1, p2);
});

// ── 4: compose() routes combat turns through COMBAT_LEXICON ───────────────

test('U59-04: compose() with updateKind=combat draws from COMBAT_LEXICON, not APPROACH_LEXICON', () => {
  const w = mkWorld('route');
  // Mainline force-success phrasing (sample of clauses we should NOT see).
  const mainlineForce = ['bone and leverage win the argument', 'the world yields with a crack', 'brute momentum carries you', 'iron first, question later'];

  const composedCombat = compose(w, 'I strike', {
    kind: 'turn',
    t: 0,
    roll: 18,
    dc: 12,
    success: true,
    updateKind: 'combat',
    outcome: 'success',
    approach: 'force',
    enemyName: '',
    parleyed: false
  }, { pack: {} });

  for (const m of mainlineForce) {
    assert.ok(!composedCombat.narrationLine.includes(m), `combat narration leaked mainline clause "${m}"`);
  }
});

// ── 5: Mainline (non-combat) turns still draw from APPROACH_LEXICON ───────

test('U59-05: compose() with no updateKind:combat still uses mainline approach lexicon', () => {
  const w = mkWorld('mainline');
  const composed = compose(w, 'I act', {
    kind: 'turn',
    t: 0,
    roll: 18,
    dc: 12,
    success: true,
    updateKind: 'ledger',
    outcome: 'success',
    approach: 'force'
  }, { pack: {} });
  // Combat clause we should NOT see in a mainline turn.
  assert.ok(!composed.narrationLine.includes('the blow lands hard'), 'mainline narration leaked combat clause');
  assert.ok(!composed.narrationLine.includes('bone and armor give way'), 'mainline narration leaked combat clause');
});

// ── 6: Heart-success parleyed vs trivial pick from distinct banks ─────────

test('U59-06: heart-success parleyed:true uses parley bank; parleyed:false uses trivial bank', () => {
  const parleyBank = ['the fight drains out of them', 'the weapon lowers', 'they hear you, and stop', 'the rage cracks and recedes'];
  const trivialBank = ['your words bounce off steel', 'they hear nothing but blood', 'the appeal dies in the air between you', 'no part of them is listening'];

  // Cover all rng outputs by trying enough seeds; assert each picked phrase
  // belongs to the correct bank for its parleyed flag.
  for (let i = 0; i < 20; i++) {
    const parleyed = buildCombatPhrase({ approach: 'heart', outcome: 'success', parleyed: true, rng: mkRng(`p-${i}`) });
    const trivial = buildCombatPhrase({ approach: 'heart', outcome: 'success', parleyed: false, rng: mkRng(`t-${i}`) });
    assert.ok(parleyBank.includes(parleyed), `parleyed picked "${parleyed}" not in parley bank`);
    assert.ok(trivialBank.includes(trivial), `trivial picked "${trivial}" not in trivial bank`);
  }
});

// ── 7: Enemy name appears in narration when provided ──────────────────────

test('U59-07: enemy name appears in combat narration when present in resolution', () => {
  const w = mkWorld('enemy-name');
  const composed = compose(w, 'I strike', {
    kind: 'turn',
    t: 0,
    roll: 18,
    dc: 12,
    success: true,
    updateKind: 'combat',
    outcome: 'success',
    approach: 'force',
    enemyName: 'Kael',
    parleyed: false
  }, { pack: {} });
  assert.ok(composed.narrationLine.includes('Kael'), `enemy name missing from narration: ${composed.narrationLine}`);
});

test('U59-08: missing enemy name does not break combat narration', () => {
  const w = mkWorld('no-name');
  const composed = compose(w, 'I strike', {
    kind: 'turn',
    t: 0,
    roll: 18,
    dc: 12,
    success: true,
    updateKind: 'combat',
    outcome: 'success',
    approach: 'force',
    enemyName: '',
    parleyed: false
  }, { pack: {} });
  assert.equal(typeof composed.narrationLine, 'string');
  assert.ok(composed.narrationLine.length > 0);
});

// ── 9: backwards-compat — composer with no approach key still produces output ─

test('U59-09: compose() with no approach + no updateKind still returns narration', () => {
  const w = mkWorld('compat');
  const composed = compose(w, 'I act', {
    kind: 'turn',
    t: 0,
    roll: 12,
    dc: 12,
    success: true,
    outcome: 'success'
  }, { pack: {} });
  assert.equal(typeof composed.narrationLine, 'string');
  assert.ok(composed.narrationLine.length > 0);
});

// ── 10–11: DM system prompt COMBAT block ──────────────────────────────────

test('U59-10: buildDMSystemPrompt includes COMBAT block when dmCtx.combat is active', () => {
  const dmCtx = {
    scene: { location: { name: 'arena', type: 'wilderness', exits: [] }, timeOfDay: 'dusk', interior: null },
    npcsPresent: [],
    worldPressure: { factionSummary: 'none', ecologySummary: 'stable', activeScars: [], activeThreads: [] },
    player: { name: 'Tester', stats: { MIGHT: 12 }, weapons: [], wounds: 0, stress: 0 },
    rules: { setting: 'fantasy', packId: 'fantasy', whatCannotExist: [] },
    worldWhisper: null,
    goals: { active: [], completedThisSession: 0 },
    recentBeats: [],
    combat: {
      round: 2,
      playerGuard: true,
      enemies: [
        { id: 'enemy_0', name: 'Kael', hp: 3, maxHp: 8, canParley: false, defeated: false },
        { id: 'enemy_1', name: 'Orla', hp: 0, maxHp: 6, canParley: true, defeated: true }
      ]
    },
    dialogueTurn: null
  };
  const prompt = buildDMSystemPrompt(dmCtx);
  assert.ok(prompt.includes('COMBAT (active'), 'COMBAT block missing');
  assert.ok(prompt.includes('round 2'), 'round number missing');
  assert.ok(prompt.includes('Kael: HP 3/8 [parley-refused]'), 'hostile enemy line missing');
  assert.ok(prompt.includes('(defeated) Orla: HP 0/6 [parley]'), 'defeated friendly enemy line missing');
  assert.ok(prompt.includes('Player guard: yes'), 'playerGuard line missing');
});

test('U59-11: buildDMSystemPrompt omits COMBAT block when dmCtx.combat is null', () => {
  const dmCtx = {
    scene: { location: { name: 'arena', type: 'wilderness', exits: [] }, timeOfDay: 'dusk', interior: null },
    npcsPresent: [],
    worldPressure: { factionSummary: 'none', ecologySummary: 'stable', activeScars: [], activeThreads: [] },
    player: { name: 'Tester', stats: { MIGHT: 12 }, weapons: [], wounds: 0, stress: 0 },
    rules: { setting: 'fantasy', packId: 'fantasy', whatCannotExist: [] },
    worldWhisper: null,
    goals: { active: [], completedThisSession: 0 },
    recentBeats: [],
    combat: null,
    dialogueTurn: null
  };
  const prompt = buildDMSystemPrompt(dmCtx);
  assert.ok(!prompt.includes('COMBAT (active'), 'COMBAT block leaked when inactive');
  assert.ok(!prompt.includes('Player guard:'), 'playerGuard line leaked when inactive');
});
