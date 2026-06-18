/**
 * U170 — Combat-state narration: authoritative snapshot while inCombat
 *
 * Validates three things:
 *   1. buildNarratorContext carries inCombat + enemies(hp) + lastBeat + pcHp
 *      while combat.active (BEFORE: field was absent entirely).
 *   2. buildSystemPrompt includes the COMBAT block when ctx.combat is set.
 *   3. validateNarrationCandidate rejects:
 *      - combat-denial narration (peace while inCombat)
 *      - miss→hit inversion
 *      - hit→miss inversion
 *      and accepts:
 *      - correct hit narration
 *      - correct miss narration
 *      - non-combat narration (no false positives)
 *
 * No LLM calls — fully deterministic.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt, buildDMSystemPrompt, validateNarrationCandidate } from '../engine/llmAdapter.js';

// ── Minimal world fixture with active combat ──────────────────────────────

function makeWorld({ combatActive = true, enemies = null, escapeHp = 12, escapeMaxHp = 15 } = {}) {
  return {
    meta: { fate: 0.5, escapeHp, escapeMaxHp },
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', name: 'Wayfarers\' Outpost', nodeType: 'settlement' }],
      edges: []
    },
    scene: { objective: '', interior: null },
    combat: combatActive ? {
      active: true,
      round: 2,
      playerGuard: false,
      companionGuard: false,
      enemies: enemies ?? [
        { id: 'e1', name: 'Elske', hp: 7, maxHp: 8, defeated: false, canParley: false }
      ]
    } : null,
    party: [{ name: 'Thorn', stats: {}, inventory: { weapons: [], armor: [] }, wounds: 1, stress: 0 }],
    structures: { byId: {} },
    ledger: { facts: [], threats: [], questions: [] },
    factions: [],
    instrument: { threads: [], motifs: [] },
    time: { turn: 3 },
    pack: { primaryId: 'fantasy' }
  };
}

function makeOutcome(mechanics = '') {
  return { input: 'I attack Elske', mechanics };
}

// ── 1. buildNarratorContext carries combat block while active ─────────────

test('U170-01: buildNarratorContext.combat is non-null while combat.active', () => {
  const world = makeWorld({ combatActive: true });
  const ctx = buildNarratorContext(world, makeOutcome('[strike:Worn Blade | atk:11 vs AC:10 → hit | 1 dmg]'));
  assert.ok(ctx.combat !== null && ctx.combat !== undefined,
    'ctx.combat should be non-null when combat.active');
});

test('U170-02: buildNarratorContext.combat is null while !combat.active', () => {
  const world = makeWorld({ combatActive: false });
  const ctx = buildNarratorContext(world, makeOutcome(''));
  assert.equal(ctx.combat, null,
    'ctx.combat should be null when combat is inactive');
});

test('U170-03: combat block carries inCombat=true', () => {
  const world = makeWorld();
  const ctx = buildNarratorContext(world, makeOutcome('[strike:Worn Blade | atk:11 vs AC:10 → hit | 1 dmg]'));
  assert.equal(ctx.combat.inCombat, true);
});

test('U170-04: combat block carries enemy name and HP', () => {
  const world = makeWorld();
  const ctx = buildNarratorContext(world, makeOutcome('[strike:Worn Blade | atk:11 vs AC:10 → hit | 1 dmg]'));
  assert.equal(ctx.combat.enemies.length, 1);
  assert.equal(ctx.combat.enemies[0].name, 'Elske');
  assert.equal(ctx.combat.enemies[0].hp, 7);
  assert.equal(ctx.combat.enemies[0].maxHp, 8);
  assert.equal(ctx.combat.enemies[0].defeated, false);
});

test('U170-05: combat block carries PC HP (meta.escapeHp)', () => {
  const world = makeWorld({ escapeHp: 12, escapeMaxHp: 15 });
  const ctx = buildNarratorContext(world, makeOutcome(''));
  assert.equal(ctx.combat.pcHp, 12);
  assert.equal(ctx.combat.pcMaxHp, 15);
});

test('U170-06: combat block parses lastBeat hit from mechanics', () => {
  const world = makeWorld();
  const ctx = buildNarratorContext(world, makeOutcome('[strike:Worn Blade | atk:11 vs AC:10 → hit | 1 dmg]'));
  assert.ok(ctx.combat.lastBeat !== null, 'lastBeat should be parsed');
  assert.equal(ctx.combat.lastBeat.result, 'hit');
  assert.equal(ctx.combat.lastBeat.damage, 1);
});

test('U170-07: combat block parses lastBeat miss from mechanics', () => {
  const world = makeWorld();
  const ctx = buildNarratorContext(world, makeOutcome('[strike:Worn Blade | atk:4 vs AC:10 → miss]'));
  assert.ok(ctx.combat.lastBeat !== null);
  assert.equal(ctx.combat.lastBeat.result, 'miss');
  assert.equal(ctx.combat.lastBeat.damage, 0);
});

test('U170-08: combat block lastBeat is null for table-talk mechanics', () => {
  const world = makeWorld();
  const ctx = buildNarratorContext(world, makeOutcome('[combat:table-talk]'));
  assert.equal(ctx.combat.lastBeat, null,
    'lastBeat should be null when mechanics have no hit/miss arrow');
});

test('U170-09: combat block carries round number', () => {
  const world = makeWorld();
  const ctx = buildNarratorContext(world, makeOutcome(''));
  assert.equal(ctx.combat.round, 2);
});

// ── 2. buildSystemPrompt includes COMBAT block when ctx.combat is set ─────

function makeCtxWithCombat({ lastBeat = null } = {}) {
  return {
    placeName: "Wayfarers' Outpost",
    nodeType: 'settlement',
    location: "Wayfarers' Outpost",
    objective: '',
    structuresHere: [],
    interior: null,
    tone: 'grim',
    actionText: 'I attack Elske',
    mechanicsText: '[strike:Worn Blade | atk:11 vs AC:10 → hit | 1 dmg]',
    fate: 0.5,
    settlement: null,
    speaker: null,
    dialogueTurn: null,
    placeChunks: [],
    combat: {
      inCombat: true,
      round: 2,
      enemies: [{ name: 'Elske', hp: 7, maxHp: 8, defeated: false }],
      pcHp: 12,
      pcMaxHp: 15,
      lastBeat
    }
  };
}

test('U170-10: buildSystemPrompt includes COMBAT block label when inCombat', () => {
  const prompt = buildSystemPrompt(makeCtxWithCombat());
  assert.ok(prompt.includes('COMBAT (active'), `Expected COMBAT block; got:\n${prompt.slice(0, 500)}`);
});

test('U170-11: buildSystemPrompt includes enemy name and HP in COMBAT block', () => {
  const prompt = buildSystemPrompt(makeCtxWithCombat());
  assert.ok(prompt.includes('Elske'), 'Enemy name must appear in COMBAT block');
  assert.ok(prompt.includes('7/8'), 'Enemy HP must appear in COMBAT block');
});

test('U170-12: buildSystemPrompt includes Player HP in COMBAT block', () => {
  const prompt = buildSystemPrompt(makeCtxWithCombat());
  assert.ok(prompt.includes('Player HP: 12/15'), 'Player HP must appear in COMBAT block');
});

test('U170-13: buildSystemPrompt includes last-beat result when available', () => {
  const prompt = buildSystemPrompt(makeCtxWithCombat({ lastBeat: { result: 'hit', damage: 1 } }));
  assert.ok(prompt.includes('hit') && prompt.includes('damage'), 'Last beat hit+damage must appear');
});

test('U170-14: buildSystemPrompt includes COMBAT RULE text', () => {
  const prompt = buildSystemPrompt(makeCtxWithCombat());
  assert.ok(prompt.includes('COMBAT RULE'), 'COMBAT RULE directive must be present');
  assert.ok(prompt.includes('no blade was drawn'), 'COMBAT RULE must forbid the "no blade" denial');
});

test('U170-15: buildSystemPrompt omits COMBAT block when ctx.combat is null', () => {
  const ctx = { ...makeCtxWithCombat(), combat: null };
  const prompt = buildSystemPrompt(ctx);
  assert.ok(!prompt.includes('COMBAT (active'), 'COMBAT block must be absent when not in combat');
});

// ── 3. validateNarrationCandidate — combat contradiction guard ────────────

function baseArgs(combat) {
  const world = {
    meta: { fate: 0.5, escapeHp: 12, escapeMaxHp: 15 },
    map: {
      currentNodeId: 'n1',
      nodes: [{ id: 'n1', name: "Wayfarers' Outpost", nodeType: 'settlement' }],
      edges: []
    },
    scene: { objective: '', interior: null },
    combat: null,
    party: [],
    ledger: { facts: [], threats: [], questions: [] },
    structures: { byId: {} },
    factions: [],
    instrument: { threads: [], motifs: [] },
    time: { turn: 1 },
    pack: { primaryId: 'fantasy' }
  };
  const ctx = {
    placeName: "Wayfarers' Outpost",
    nodeType: 'settlement',
    location: "Wayfarers' Outpost",
    dialogueTurn: null,
    combat
  };
  return { world, ctx };
}

const ACTIVE_COMBAT = {
  inCombat: true,
  round: 2,
  enemies: [{ name: 'Elske', hp: 7, maxHp: 8, defeated: false }],
  pcHp: 12,
  pcMaxHp: 15,
  lastBeat: { result: 'hit', damage: 1 }
};

const MISS_COMBAT = { ...ACTIVE_COMBAT, lastBeat: { result: 'miss', damage: 0 } };

// --- Axis 1: combat-presence denial ---

test('U170-20: REJECT — "no blade was drawn" while inCombat (combat-presence denial)', () => {
  const { world, ctx } = baseArgs(ACTIVE_COMBAT);
  const cand = "Standing in Wayfarers' Outpost, Elske regards you with scholarly patience — no blade has been drawn, no blow exchanged.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, false, 'Should reject: "no blade was drawn" while inCombat');
});

test('U170-21: REJECT — "no blow exchanged" while inCombat', () => {
  const { world, ctx } = baseArgs(ACTIVE_COMBAT);
  const cand = "In Wayfarers' Outpost, the dust settles — no blow exchanged in this quiet standoff.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, false, 'Should reject: "no blow exchanged" while inCombat');
});

test("U170-22: PASS — \"you're unharmed\" while inCombat (removed from PEACE_PHRASES; too broad)", () => {
  // "you're unharmed" was removed from PEACE_PHRASES because it also matches
  // legitimate phrases where the enemy's counterattack missed ("you step back,
  // you're unharmed by the wild swing"). The LLM system prompt already forbids
  // it directly; the validator is a last-resort backstop, not primary prevention.
  const { world, ctx } = baseArgs(ACTIVE_COMBAT);
  const cand = "Senna glances your way with a calm, steady look — you're unharmed, and the bustle of Wayfarers' Outpost continues.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, "\"you're unharmed\" must now PASS (removed from PEACE_PHRASES — too many false positives)");
});

// --- Axis 2: miss→hit inversion ---

test("U170-30: REJECT — \"glancing blow\" when mechanics say miss", () => {
  const { world, ctx } = baseArgs(MISS_COMBAT);
  const cand = "In Wayfarers' Outpost, Greyhand lands a glancing blow that stings as you step back.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, false, 'Should reject: narrates a hit when mechanics say miss');
});

test("U170-31: PASS — \"strikes you\" when mechanics say miss (legitimate enemy counter)", () => {
  // "strikes you" is an enemy→player phrase. On a miss turn the PLAYER missed,
  // but the enemy can still land a counterattack — "Elske strikes you" is
  // CORRECT prose in that case. Only PLAYER→enemy-LANDING phrases are wrong
  // on a miss (e.g. "your blade connects"). Removed from miss-axis HIT_PHRASES.
  const { world, ctx } = baseArgs(MISS_COMBAT);
  const cand = "At Wayfarers' Outpost, Elske strikes you with a quick thrust before you can recover.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, '"strikes you" must now PASS on a miss (enemy counter is legitimate prose)');
});

// --- Axis 3: hit→miss inversion ---

test("U170-40: REJECT — \"swing goes wide\" when mechanics say hit", () => {
  const { world, ctx } = baseArgs(ACTIVE_COMBAT);
  const cand = "In Wayfarers' Outpost, your swing goes wide as Elske sidesteps and you stumble.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, false, 'Should reject: narrates a miss when mechanics say hit');
});

// --- Correct narrations pass ---

test("U170-50: PASS — correct hit narration while inCombat", () => {
  const { world, ctx } = baseArgs(ACTIVE_COMBAT);
  const cand = "Inside Wayfarers' Outpost, your worn blade finds Elske's ribs and she staggers back from the blow.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, 'Should accept correct hit narration');
});

test("U170-51: PASS — correct miss narration while inCombat (miss combat)", () => {
  const { world, ctx } = baseArgs(MISS_COMBAT);
  const cand = "At Wayfarers' Outpost, your worn blade swings but Elske twists aside in time.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, 'Should accept correct miss narration');
});

test("U170-52: PASS — non-combat narration has no false positives", () => {
  const { world, ctx } = baseArgs(null);  // no combat
  const cand = "The air at Wayfarers' Outpost carries the smell of woodsmoke and damp earth.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, 'Should accept non-combat narration without triggering guard');
});

test("U170-53: PASS — combat narration with table-talk (no lastBeat) — no hit/miss check", () => {
  const combat = { ...ACTIVE_COMBAT, lastBeat: null };
  const { world, ctx } = baseArgs(combat);
  const cand = "In the thick air of Wayfarers' Outpost, Elske watches you with guarded eyes as the fight hangs suspended.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, 'Should accept table-talk narration (no lastBeat to invert)');
});

test("U170-54: PASS — \"the bandit's mace strikes you\" on a miss (enemy counter prose)", () => {
  // Player missed their attack but the enemy lands a counterattack in the same
  // round. "strikes you" is enemy→player — correct prose, must pass the guard.
  const { world, ctx } = baseArgs(MISS_COMBAT);
  const cand = "At Wayfarers' Outpost, your swing falls short and the bandit's mace strikes you across the shoulder.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, 'Enemy counter-hit prose must pass on a miss turn');
});

test("U170-55: PASS — \"no blade found its mark\" on a miss (legitimate miss description)", () => {
  // "no blade found its mark" describes the player's MISS correctly. The phrase
  // "no blade" was removed from PEACE_PHRASES because it matched too broadly —
  // "no blade was drawn" is caught by "no blow" (also in the phrase) while
  // "no blade found its mark" is correct miss prose.
  const { world, ctx } = baseArgs(MISS_COMBAT);
  const cand = "In the press of steel at Wayfarers' Outpost, no blade found its mark and both fighters circle for the next opening.";
  const ok = validateNarrationCandidate(world, cand, { baseNarration: cand, ctx });
  assert.equal(ok, true, '"no blade found its mark" must pass on a miss turn');
});
