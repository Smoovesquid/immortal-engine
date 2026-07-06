// U602 — DEATH-3: the LLM-OFF killing-blow BASE LINE (docs/DEATH_CONTRACT.md §3 final
// bullet + §6 falsifiers). The silent-fallback law (CLAUDE.md — "the LLM layer never
// throws; the game continues with base narration") means a foe's death must read as a
// death WITHOUT the API: a real killing-blow line composed FROM the death fact's fields,
// byte-stable, means-tailored (axe≠arrow≠fire), stance-aware (beggar≠duelist), and NEVER
// a plea the fact does not hold (§6). Two layers proven:
//   1. composeKillingBlowLine(fact) directly — the fact→prose function across the matrix.
//   2. augmentNarration(enabled:false) through the LIVE playerMove kill path — the fact-
//      true line is what actually reaches the player offline.
// LLM-off, deterministic, $0.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { playerMove } from '../engine/playloop.js';
import { composeKillingBlowLine } from '../engine/composer.js';
import { augmentNarration } from '../engine/llmAdapter.js';

const NUM_RE = /\d/;
// A plea the FACT must hold to appear — begging/pleading/mercy-asked/yielding words.
const PLEA_RE = /\b(begs?|begg\w*|pleads?|plead\w*|implor\w*|yields?|yielded|please|spared?\s+(?:me|it|him|her|them)|for\s+(?:mercy|its?\s+life|his\s+life|her\s+life))\b/i;

function fact({ means = { name: 'the axe', type: 'slashing' }, stance = 'fighting', intent = 'clean', name = 'the brigand', region = 'the throat', canCommunicate = true } = {}) {
  return {
    victim: { name, canCommunicate },
    means,
    woundPath: [{ means: means.name, type: means.type, region, round: 2, killing: true }],
    victimStance: stance,
    killerIntent: intent,
    light: { band: 'dim' },
  };
}

// ── 1. composeKillingBlowLine directly — the matrix ──────────────────────────

test('U602-01: every composed kill line is number-free and byte-stable ×2', () => {
  const matrix = [
    fact({ means: { name: 'the axe', type: 'slashing' } }),
    fact({ means: { name: 'the arrow', type: 'piercing' }, name: 'the archer' }),
    fact({ means: { name: 'the flame', type: 'fire' } }),
    fact({ means: { name: 'the mace', type: 'bludgeoning' }, stance: 'helpless' }),
    fact({ stance: 'begging', intent: 'mercy' }),
    fact({ intent: 'mercy' }),
    fact({ stance: 'begging', intent: 'worse' }),
    fact({ intent: 'worse' }),
    fact({ stance: 'defiant' }),
    fact({ stance: 'fleeing' }),
    fact({ means: { name: 'the dying clock', type: 'physical' }, stance: 'helpless' }),
    {}, // malformed — must still produce an honest line
  ];
  for (const f of matrix) {
    const line = composeKillingBlowLine(f);
    assert.ok(line && line.length > 0, 'a kill always composes some line');
    assert.ok(!NUM_RE.test(line), `no numerics in a death string (invariant III): ${line}`);
    assert.equal(composeKillingBlowLine(f), line, 'byte-stable across two calls (determinism floor)');
  }
});

test('U602-02: MEANS-TAILORED — an axe (slashing), an arrow (piercing), a flame (fire) read differently', () => {
  const axe = composeKillingBlowLine(fact({ means: { name: 'the axe', type: 'slashing' } }));
  const arrow = composeKillingBlowLine(fact({ means: { name: 'the arrow', type: 'piercing' } }));
  const flame = composeKillingBlowLine(fact({ means: { name: 'the flame', type: 'fire' } }));
  assert.notEqual(axe, arrow, 'axe ≠ arrow');
  assert.notEqual(arrow, flame, 'arrow ≠ fire');
  // Each carries its own family's wound image.
  assert.match(axe, /deep wound|blood comes fast/i, 'slashing → a bleeding cut');
  assert.match(arrow, /punches through|something vital/i, 'piercing → a thrust that finds the vital');
  assert.match(flame, /sear|black|burning|smell of it/i, 'fire → burning');
});

test('U602-03: STANCE-AWARE — a beggar, a duelist, and the defiant read differently', () => {
  const beggar = composeKillingBlowLine(fact({ stance: 'begging', intent: 'mercy' }));
  const duelist = composeKillingBlowLine(fact({ stance: 'fighting' }));
  const defiant = composeKillingBlowLine(fact({ stance: 'defiant' }));
  assert.notEqual(beggar, duelist);
  assert.notEqual(duelist, defiant);
  assert.match(defiant, /defian|die on their feet|would not|does not look away/i, 'the defiant answer reads proud');
});

test('U602-04: MERCY reads merciful; WORSE does not flinch', () => {
  const mercy = composeKillingBlowLine(fact({ stance: 'begging', intent: 'mercy' }));
  const worse = composeKillingBlowLine(fact({ stance: 'begging', intent: 'worse' }));
  assert.match(mercy, /clean|kind|no cruelty|quick/i, 'mercy reads as mercy');
  assert.match(worse, /do not make it quick|meant to be seen|message left/i, 'worse is the example-making');
});

test('U602-05: ABANDONMENT (walk) reads cold — left to the dying clock', () => {
  const walk = composeKillingBlowLine(fact({ means: { name: 'the dying clock', type: 'physical' }, stance: 'helpless', intent: 'clean' }));
  assert.match(walk, /turn from|behind you|thins, then stops|no one closes/i, 'abandonment reads as a cold turning-away');
});

test('U602-06: NO PLEA LANGUAGE when the fact holds no beg (§6 — the un-begged never plead)', () => {
  // A fighting/defiant/helpless/fleeing foe (stance !== begging) must not read as begging.
  for (const stance of ['fighting', 'defiant', 'helpless', 'fleeing']) {
    for (const intent of ['clean', 'mercy', 'worse']) {
      const line = composeKillingBlowLine(fact({ stance, intent }));
      assert.ok(!PLEA_RE.test(line), `stance=${stance} intent=${intent} must hold no plea language: ${line}`);
    }
  }
});

test('U602-07: a speechless foe is given no plea words either', () => {
  const line = composeKillingBlowLine(fact({ name: 'the dire wolf', canCommunicate: false, stance: 'fighting', means: { name: 'the spear', type: 'piercing' } }));
  assert.ok(!PLEA_RE.test(line), `a beast dies without a plea in the base line: ${line}`);
});

// ── 2. augmentNarration (LLM-off) through the LIVE kill path ──────────────────

// Corner a fixture foe to DOWNED (dying, begging) with the gate on — mirrors U600.
function downedWorld({ seed = 'aldermere', name = 'Brigand', hp = 1, damageType = 'slashing' } = {}) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, name, hp, ac: 1, maxHp: 20, damageType }));
  const w = ensureWorld({ ...base, meta: { ...base.meta, seed, mode: 'escape' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
  return resolveEscapeCombatTurn(w, 'strike').world;
}

async function llmOffNarration(verbText) {
  const w0 = downedWorld();
  const m = playerMove(w0, PACKS, verbText);
  const outcome = { input: verbText, mechanics: m.output?.mechanics || '', beats: m.output?.beats };
  const narr = await augmentNarration({
    world: m.world, outcome,
    baseNarration: 'Wizard: ' + (Array.isArray(outcome.beats) ? outcome.beats.join(' ') : ''),
    enabled: false, // the silent-fallback path
  });
  return { narr, mech: outcome.mechanics };
}

test('U602-08: LLM-OFF — a MERCY kill turn narrates the fact-true merciful line, number-free', async () => {
  const { narr, mech } = await llmOffNarration('I give him a clean, merciful death');
  assert.match(mech, /\[downed:mercy\]/, 'the mercy verb resolved');
  assert.ok(!NUM_RE.test(narr), `no numerics offline: ${narr}`);
  assert.match(narr, /clean|kind|no cruelty|what was asked/i, 'the mercy reads');
});

test('U602-09: LLM-OFF — a WORSE kill turn does not flinch, number-free', async () => {
  const { narr, mech } = await llmOffNarration('I make an example of him — slow and cruel');
  assert.match(mech, /\[downed:worse\]/);
  assert.ok(!NUM_RE.test(narr), `no numerics offline: ${narr}`);
  assert.match(narr, /do not make it quick|meant to be seen|message left/i, 'the example-making reads');
});

test('U602-10: LLM-OFF — byte-stable ×2 (the determinism floor, §6)', async () => {
  const a = await llmOffNarration('I give him a clean, merciful death');
  const b = await llmOffNarration('I give him a clean, merciful death');
  assert.equal(a.narr, b.narr, 'same seed + same transcript ⇒ byte-identical LLM-off kill prose');
});

test('U602-11: LLM-OFF — SPARING never reads as a kill (no death fact, no kill line)', async () => {
  const { narr, mech } = await llmOffNarration('I bind his wounds and let him live');
  assert.match(mech, /\[downed:spare/, 'the spare verb resolved');
  // The spared-foe base beats stand (a living witness) — the kill-line fallback must NOT fire.
  assert.match(narr, /bind|let (?:him|them) live|owe|life/i, 'the sparing reads as sparing, not a death');
});
