// U217 — H-54 compound/meta-query answer-binding (post-H-52/H-53 Opus gate,
// dominant cluster: the meta-query answer-binding family under four new
// shapes the Rules-Lawyer + Chaos personas hit).
//
//   R1 — a compound "name, class, and current HP?" ask must include the HP
//        half — META_HEALTH doesn't match bare "current HP" inside a list.
//   R2 — "what damage does each deal?" must route to the weapon-damage
//        answer and name BOTH named weapons.
//   R3 — a rules-confirmation question ("do I add my MIGHT to melee damage?")
//        must be answered straight from the sheet, NEVER rolled as an action.
//   R4 — a declared check ("I sheathe the blade and roll WITS to read his
//        face — what's the DC?") must not be swallowed by the bare-DC
//        deflection; it must fall through to real action resolution.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

function makeWorld(overrides = {}) {
  return {
    party: [{
      name: 'Garrick',
      archetype: 'Hedge-caster',
      level: 1,
      stats: { MIGHT: 12, AGILITY: 9, WITS: 13, GRIT: 9, CHARM: 11 },
      foci: [],
      inventory: {
        weapons: [
          { name: 'Worn Blade', damage: '1d6' },
          { name: 'Kitchen cleaver', damage: '1d6' }
        ],
        armor: []
      }
    }],
    meta: { mode: 'escape', escapeHp: 13, escapeMaxHp: 13 },
    map: { currentNodeId: 'glass-harbor', nodes: [{ id: 'glass-harbor', name: 'Glass Harbor', nodeType: 'settlement', settlement: { npcs: [] } }] },
    conversation: {},
    ...overrides
  };
}

// ── R1 — compound name+class+HP fold ────────────────────────────────────────

test('U217-R1: name/class/HP compound answer includes the real current HP', () => {
  const w = makeWorld();
  const ans = handleMetaQuestion("Real quick — what's my character's name, class, and current HP?", w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /\b13\b/, 'must contain the real current HP (13)');
  assert.match(ans, /Garrick/, 'still answers the name');
  assert.match(ans, /hedge-caster/i, 'still answers the class');
});

test('U217-R1: a standalone "am I hurt?" still works (META_HEALTH untouched)', () => {
  const w = makeWorld();
  const ans = handleMetaQuestion('Am I hurt?', w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /hit points/i);
});

// ── R2 — weapon-damage compound "what damage does each deal?" ──────────────

test('U217-R2: "what damage does each deal" is a recognized meta-question', () => {
  const q = "What's the AC or defense value on my Worn Blade vs the Kitchen cleaver — and what damage does each deal?";
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question');
});

test('U217-R2: weapon-damage compound answer names both weapons', () => {
  const w = makeWorld();
  const q = "What's the AC or defense value on my Worn Blade vs the Kitchen cleaver — and what damage does each deal?";
  const ans = handleMetaQuestion(q, w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /Worn Blade/, 'must name the Worn Blade');
  assert.match(ans, /Kitchen cleaver/, 'must name the Kitchen cleaver');
  assert.doesNotMatch(ans, /Your Armor is \d/, 'must never invent a weapon AC from the player AC line');
});

// ── R3 — rules-confirmation, never rolled ───────────────────────────────────

test('U217-R3: "confirm that\'s the right mod" rules-confirmation is a meta-question', () => {
  const q = "With MIGHT 12 my modifier is +1 — so a hit with either blade is 1d6+1? Confirm that's the right mod.";
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question, never rolled');
});

test('U217-R3: "yes or no: do I add my MIGHT to melee damage" is a meta-question', () => {
  const q = 'Yes or no: do I add my MIGHT +1 to melee damage with these blades?';
  assert.ok(isMetaQuestion(q), 'must be recognized as a meta-question, never rolled');
});

test('U217-R3: rules-confirmation answer states the real damage rule and modifier', () => {
  const w = makeWorld();
  const ans = handleMetaQuestion('Yes or no: do I add my MIGHT +1 to melee damage with these blades?', w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /add/i, 'states the rule plainly');
  assert.match(ans, /\+1/, 'gives the real computed MIGHT modifier');
});

test('U217-R3: a real in-fiction action is NOT captured by the rules-confirmation detector', () => {
  assert.equal(isMetaQuestion('I swing at the door'), false, 'a real action must not be swept into META_DAMAGE_RULE');
});

// ── R4 — a declared check is not swallowed by the bare-DC deflection ───────

test('U217-R4: "roll WITS to read his face — what\'s the DC" is not answered by the bare-DC deflection', () => {
  const w = makeWorld();
  const ans = handleMetaQuestion("I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?", w);
  assert.equal(ans, null, 'must defer (return null) so the turn falls through to real action resolution');
});

test('U217-R4: a true bare "give me the DC" with no declared check still gets the deflection', () => {
  const w = makeWorld();
  const ans = handleMetaQuestion('Give me the DC.', w);
  assert.ok(ans, 'must return an answer');
  assert.match(ans, /no standing DC/i, 'regression guard: bare DC ask still deflects');
});
