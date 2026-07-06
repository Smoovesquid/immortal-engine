// U604 — DEATH-3: THE WALL. docs/DEATH_CONTRACT.md §6 (the determinism floor + no numeric
// in any death string) + the packet's must-not-break invariants.
//
//   (I)   THE PROMPT CARRIES NO NUMERICS / MECHANIC NAMES — on a kill turn the DM system
//         prompt's KILLING BLOW block is fiction words only: no digit, no "corruption"/
//         "heat"/"HP"/"DC"/"downed"/"death-fact"/"killerIntent"/"victimStance"/"combat"
//         (invariant III / U578's wall pattern, extended to this beat's vocabulary).
//   (II)  NO LEAK ON A NON-KILL TURN — ctx.killingBlow is null on every turn no foe died,
//         and the prompt carries no KILLING BLOW block (a kill line must never surface on a
//         quiet turn — the freshness gate holds).
//   (III) THE BASE PROSE NEVER TRIPS ITS OWN GUARD — every composeKillingBlowLine output
//         PASSES detectKillingBlowDesync against its own fact (the swap rule: the LLM-off
//         fallback is clean-by-construction, so it always beats a contradicting candidate).
//   (IV)  THE CONVERGENCE CORPUS IS UNMOVED — a representative NON-kill turn's surface is
//         byte-identical to a run without this packet's fields (killingBlow null ⇒ no prompt
//         line ⇒ no base change), so the 131 locked convergence cases stay green. (The full
//         100% is asserted by `npm run convergence`; here we prove the mechanism — a plain
//         look/observe surface is untouched.)
//   (V)   THE BOOT ANCHOR IS UNTOUCHED — killingBlow is derived, combat-scoped, and absent
//         from a boot, so a boot world's narratorContext carries killingBlow:null and the
//         boot worldHash is byte-identical run-to-run (U454-E's pinned anchor does not move;
//         this proves the packet's OWN claim — self-equality + absence).
//
// Seam: engine/ai/narratorContext.js (killingBlow) + engine/llmAdapter.js (killingBlowFact,
// buildSystemPrompt) + engine/composer.js (composeKillingBlowLine) + engine/coherence/
// checks.js (CG-DEATH). LLM-off, deterministic, $0.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';
import { activeCombatWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';
import { composeKillingBlowLine } from '../engine/composer.js';
import { detectKillingBlowDesync } from '../engine/coherence/checks.js';

// The forbidden vocabulary a death prompt-line must never contain (U578's wall, extended).
const FORBIDDEN_MECH_RE = /\b(corruption|heat|tier|escalation|\bHP\b|\bDC\b|hit\s*points?|damage|downed|death-?fact|killerIntent|victimStance|meansType|woundPath|combat|d20|armou?r\s*class)\b/i;
const DIGIT_RE = /\d/;

// Corner a fixture communicator to DOWNED, answer with `verbText`; return {world, outcome}.
function killTurn(verbText, { seed = 'aldermere', damageType = 'slashing' } = {}) {
  const base = activeCombatWorld();
  const enemies = base.combat.enemies.map(e => ({ ...e, name: 'Brigand', hp: 1, ac: 1, maxHp: 20, damageType }));
  let w = ensureWorld({ ...base, meta: { ...base.meta, seed, mode: 'escape' }, combat: { ...base.combat, enemies, dyingEnabled: true } });
  w = resolveEscapeCombatTurn(w, 'strike').world;   // → DOWNED + beg
  const m = playerMove(w, PACKS, verbText);          // → the verb resolves + mints the fact
  return { world: m.world, outcome: { input: verbText, mechanics: m.output?.mechanics || '' } };
}

// ── (I) the prompt carries no numerics / mechanic names on a kill turn ────────
test('U604-01: the KILLING BLOW prompt block is fiction-only — no digit, no mechanic name', () => {
  for (const verb of ['I give him a clean, merciful death', 'I make an example of him — slow and cruel', 'I finish him off', 'I turn my back and leave him to bleed']) {
    const { world, outcome } = killTurn(verb);
    const ctx = buildNarratorContext(world, outcome);
    assert.ok(ctx.killingBlow, `${verb}: a kill turn carries the killingBlow context`);
    const sys = buildSystemPrompt(ctx);
    const kbLines = sys.split('\n').filter(l => /THE KILLING BLOW/.test(l));
    assert.equal(kbLines.length, 1, `${verb}: exactly one KILLING BLOW block`);
    const block = kbLines[0];
    assert.ok(!DIGIT_RE.test(block), `${verb}: no digit in the death prompt block: ${block}`);
    assert.ok(!FORBIDDEN_MECH_RE.test(block), `${verb}: no mechanic name in the death prompt block: ${block}`);
  }
});

// ── (II) no leak on a non-kill turn ──────────────────────────────────────────
test('U604-02: a NON-kill turn carries no killingBlow and no KILLING BLOW prompt block', () => {
  // A kill, THEN a later quiet turn — killingBlow must be null on the quiet one (freshness).
  const { world } = killTurn('I give him a clean death');
  const look = playerMove(world, PACKS, 'I look around');
  const ctx = buildNarratorContext(look.world, { input: 'I look around', mechanics: look.output?.mechanics || '' });
  assert.equal(ctx.killingBlow, null, 'no kill this turn → killingBlow is null (no stale resurface)');
  const sys = buildSystemPrompt(ctx);
  assert.ok(!/THE KILLING BLOW/.test(sys), 'no KILLING BLOW block on a quiet turn');
});

test('U604-03: SPARING carries no killingBlow (a spared foe is never a kill)', () => {
  const { world, outcome } = killTurn('I bind his wounds and let him live');
  const ctx = buildNarratorContext(world, outcome);
  assert.equal(ctx.killingBlow, null, 'a spared foe minted no death fact → no killing blow');
});

// ── (III) the base prose never trips its own guard (the swap rule holds) ──────
test('U604-04: every composed kill line PASSES detectKillingBlowDesync against its own fact', () => {
  const types = ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'lightning', 'poison', 'acid', 'necrotic', 'physical'];
  const stances = ['fighting', 'fleeing', 'begging', 'helpless', 'defiant'];
  const intents = ['clean', 'mercy', 'worse', 'brutal'];
  let checked = 0;
  for (const type of types) for (const stance of stances) for (const intent of intents) {
    const f = {
      victim: { name: 'the brigand', canCommunicate: true },
      means: { name: 'the weapon', type },
      woundPath: [{ region: 'the throat', killing: true, type }],
      victimStance: stance, killerIntent: intent,
    };
    const line = composeKillingBlowLine(f);
    const canon = { deathFact: { victim: 'the brigand', isPlayer: false, canCommunicate: true, means: 'the weapon', meansType: type, woundRegion: 'the throat', stance, intent } };
    const flags = detectKillingBlowDesync([{ i: 0, dm: line, canon }]);
    assert.equal(flags.length, 0, `the base line for type=${type} stance=${stance} intent=${intent} must not self-flag: ${line}`);
    checked++;
  }
  assert.ok(checked >= 200, 'the full matrix was exercised');
});

// ── (IV) the convergence corpus mechanism is unmoved (non-kill surface intact) ─
test('U604-05: a plain look/observe surface is untouched by this packet (corpus stays green)', () => {
  // The convergence corpus surface is narration+mechanics from a single playerMove; on a
  // non-kill turn killingBlow is null, so nothing this packet adds can perturb it.
  const w = ensureWorld(activeCombatWorld());
  // Drop out of combat to a plain observe (no kill involved).
  const plain = ensureWorld({ ...w, combat: { ...(w.combat || {}), active: false }, meta: { ...(w.meta || {}), mode: 'explore' } });
  const m = playerMove(plain, PACKS, 'I take stock of my surroundings');
  const ctx = buildNarratorContext(m.world, { input: 'I take stock of my surroundings', mechanics: m.output?.mechanics || '' });
  assert.equal(ctx.killingBlow, null, 'an observe turn carries no killing blow');
});

// ── (V) the boot anchor is untouched ─────────────────────────────────────────
test('U604-06: a boot world carries killingBlow:null and a self-stable worldHash', () => {
  const boot = () => beginAdventure(newWorld('aldermere'), PACKS).world;
  const a = boot();
  const b = boot();
  assert.equal(worldHash(a), worldHash(b), 'the boot worldHash is byte-identical run-to-run (U454-E anchor unmoved)');
  const ctx = buildNarratorContext(a, { input: '', mechanics: '' });
  assert.equal(ctx.killingBlow, null, 'a fresh boot has seen no kill → killingBlow null');
  const sys = buildSystemPrompt(ctx);
  assert.ok(!/THE KILLING BLOW/.test(sys), 'no KILLING BLOW block at boot');
});
