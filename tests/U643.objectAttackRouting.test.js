// U643–U645 — DM-GATE-1a: object attack routing + damage-state resolution.
//
// A weapon swing at a present OBJECT (furniture) must (a) NOT be swallowed by the
// meta gate when a rules question rides along, (b) NOT start combat, (c) NOT leak
// raw dice math, (d) resolve as graded damage-STATE against the object's material.
// This packet adds NO persistent object HP/AC — that is DM-GATE-1b.
//
// Evidence (Opus gate 2026-07-07, rules-lawyer, seed tallow): "I attack the
// iron-bound chest with my Worn Blade. What's my attack roll…" routed to `meta`
// and answered "…your attack bonus is +0 — Roll d20 and add that."

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, carriesInteriorMovementIntent, detectObjectAttackIntent } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

// Mirrors the OUTER meta-gate router used by public/v1.js and scripts/dm-playtest.mjs.
function route(world, text) {
  const inCombat = Boolean(world.combat?.active);
  const inDialogue = Boolean(world.scene?.dialogue?.npcId);
  if (!inCombat && !inDialogue && isMetaQuestion(text)
      && !carriesInteriorMovementIntent(world, text) && !detectObjectAttackIntent(world, text)) {
    const answer = handleMetaQuestion(text, world);
    if (answer) return { kind: 'meta', dm: answer, mech: '', world };
  }
  const { world: w2, output } = playerMove(world, PACKS, text);
  return {
    kind: output?.dialogue ? 'dialogue' : 'action',
    dm: String(output?.narration || '').replace(/^\s*Wizard:\s*/, ''),
    mech: String(output?.mechanics || ''),
    world: w2
  };
}

function chest(w) {
  const n = (w.map?.nodes || []).find(nd => nd.id === w.map.currentNodeId);
  return (n?.furniture || []).find(f => /chest/i.test(f.name || '')) || null;
}

const LEAK_RE = /roll d20|add that|1d6|breakpoint|attack bonus is|d20\s*\+/i;
const ATTACK_Q = "I attack the iron-bound chest with my Worn Blade. What's my attack roll, and does the chest take damage?";
const ATTACK_PLAIN = 'I attack the iron-bound chest with my Worn Blade.';

// ── U643 — the swing is routed to the object path, never the meta gate ──────────
test('U643-01: playerMove does not meta-bounce an object attack that carries a rules question', () => {
  const { output } = playerMove(boot(), PACKS, ATTACK_Q);
  const dm = String(output?.narration || '');
  assert.doesNotMatch(dm, LEAK_RE, 'the crunch (attack bonus / roll d20 / 1d6) must not leak into narration');
  assert.match(dm, /chest/i, 'the swing resolves against the chest in fiction');
});

test('U643-02: detectObjectAttackIntent exists and has the right truth table', () => {
  const w = boot();
  assert.equal(typeof detectObjectAttackIntent, 'function', 'the detector must be exported');
  assert.equal(detectObjectAttackIntent(w, ATTACK_Q), true, 'object attack + question → true');
  assert.equal(detectObjectAttackIntent(w, ATTACK_PLAIN), true, 'plain object attack → true');
  assert.equal(detectObjectAttackIntent(w, 'I attack Elske Nightherd with my Worn Blade. What is my attack roll?'), false, 'NPC attack → false');
  assert.equal(detectObjectAttackIntent(w, "what's my attack modifier?"), false, 'bare rules question → false');
  assert.equal(detectObjectAttackIntent(w, 'I open the iron-bound chest.'), false, 'non-attack object verb → false');
});

test('U643-03: through the outer router the object attack routes to action, not meta, no combat, no leak', () => {
  const r = route(boot(), ATTACK_Q);
  assert.notEqual(r.kind, 'meta', 'must not be swallowed by the meta gate');
  assert.equal(r.world.combat?.active ?? false, false, 'an object attack must never start combat');
  assert.equal((r.world.combat?.enemies || []).length, 0, 'no enemy entity is minted');
  assert.doesNotMatch(r.dm, LEAK_RE, 'no raw dice math in the narration');
});

test('U643-04: an object attack with a PRONOUN rules-question ("does it take damage") resolves the swing, not a capability lecture', () => {
  // Regression: live v1.html, aldermere Bedchamber — "does it take damage?" was
  // classified as a bare rules question and answered with answerCapability ("…in a
  // fight you can: attack…"), never resolving the swing. (directQuestionIntent kind:'rules')
  const r = route(boot(), 'I attack the iron-bound chest with my Worn Blade. Does it take damage?');
  assert.equal(r.kind, 'action', 'must resolve as an action, not a meta/capability answer');
  assert.doesNotMatch(r.dm, /in a fight you can|is a background|Roll d20/i, 'no capability lecture / crunch leak');
  assert.doesNotMatch(r.mech, /observe only/i, 'must not resolve as an observe-only capability answer');
  assert.match(r.dm, /chest/i, 'resolves against the chest in fiction');
});

// ── U644 — damage-STATE resolution: player unharmed, deterministic ──────────────
test('U644-01: a plain object attack resolves as object damage-state, not a player-wounding skill check', () => {
  const r = route(boot(), ATTACK_PLAIN);
  assert.equal(r.kind, 'action');
  assert.equal(r.world.combat?.active ?? false, false, 'no combat');
  assert.doesNotMatch(r.mech, /stake:harm|wounds/i, 'the object attack must not roll to WOUND THE PLAYER (the generic-floor bug)');
  assert.match(r.mech, /approach:force|physics/i, 'resolves through the object/force path');
});

test('U644-02: object attack is deterministic under replay (worldHash stable)', () => {
  const a = route(boot(), ATTACK_PLAIN).world;
  const b = route(boot(), ATTACK_PLAIN).world;
  assert.equal(worldHash(a), worldHash(b), 'same seed + same input → identical world');
});

// ── U645 — a strong/repeated hit changes the furniture state or removes it ───────
test('U645-01: repeated hits change the chest state or remove it — still no combat (damage-STATE, not HP)', () => {
  let w = boot();
  const start = chest(w)?.state ?? null;
  assert.equal(start, 'intact', 'chest starts intact');
  let changed = false;
  for (let i = 0; i < 12 && !changed; i++) {
    w = playerMove(w, PACKS, ATTACK_PLAIN).world;
    assert.equal(w.combat?.active ?? false, false, 'never starts combat across repeated hits');
    const c = chest(w);
    if (c == null || c.state !== 'intact') changed = true;
  }
  assert.ok(changed, 'a repeated weapon attack eventually damages or removes the chest (observed via world state)');
});
