import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { parseEscapeAction } from '../engine/combat/escapeCombat.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';

// H-3/4/5/6 class-a gate 2026-06-18 — unarmed/natural strikes must NOT resolve
// as the equipped weapon. parseEscapeAction routes headbutt/bite/stomp/kick-as-attack
// to 'unarmed'; the mech tag must say [strike:Stomp|Bite|etc.], not [strike:Worn Blade].

// ── parseEscapeAction routing ────────────────────────────────────────────────

test('U175-01: headbutt → unarmed verb', () => {
  assert.equal(parseEscapeAction('I headbutt Brokefang square in the snout').verb, 'unarmed');
});

test('U175-02: stomp → unarmed verb', () => {
  assert.equal(parseEscapeAction('I stomp my heel down on his skull').verb, 'unarmed');
});

test('U175-03: bite → unarmed verb', () => {
  assert.equal(parseEscapeAction('I bite his ear off').verb, 'unarmed');
});

test('U175-04: bite at → unarmed verb', () => {
  assert.equal(parseEscapeAction('I spit out his ear and lunge at the Lingerer, going for a bite').verb, 'unarmed');
});

test('U175-05: knee → unarmed verb', () => {
  assert.equal(parseEscapeAction('I knee him in the gut').verb, 'unarmed');
});

test('U175-06: elbow → unarmed verb', () => {
  assert.equal(parseEscapeAction('I elbow him in the face').verb, 'unarmed');
});

test('U175-07: punch → unarmed verb', () => {
  assert.equal(parseEscapeAction('I punch the Lingerer').verb, 'unarmed');
});

test('U175-08: kick (creature target) → unarmed verb', () => {
  assert.equal(parseEscapeAction('I kick him in the ribs').verb, 'unarmed');
});

// ── Regressions: unrelated verbs must not flip to unarmed ───────────────────

test('U175-20: "strike" still routes to strike', () => {
  assert.equal(parseEscapeAction('I strike').verb, 'strike');
});

test('U175-21: "fire bolt" still routes to firebolt', () => {
  assert.equal(parseEscapeAction('fire bolt').verb, 'firebolt');
});

test('U175-22: "take cover" still routes to cover', () => {
  assert.equal(parseEscapeAction('I take cover behind the pillar').verb, 'cover');
});

test('U175-23: "ward" still routes to ward', () => {
  assert.equal(parseEscapeAction('I ward').verb, 'ward');
});

// ── Mech tag uses natural-strike label, not weapon name ─────────────────────

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function combatWorld(seed = 'unarmed-test') {
  let w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
  const enemy = { id: 'brokefang', name: 'Brokefang', hp: 20, maxHp: 20, ac: 14, cr: 0.5, damage: 4, defeated: false, conditions: [] };
  w = { ...w, meta: { ...w.meta, escapeHp: 10, escapeMaxHp: 14 } };
  w = applyDeltas(w, [{ op: 'combatState', set: { active: true, round: 1, beganAt: 0, enemies: [enemy], turnIndex: 0 } }]);
  return w;
}

test('U175-30: stomp resolves with "Stomp" label in mech, not "Worn Blade"', () => {
  const w = combatWorld();
  const { result } = resolveEscapeCombatTurn(w, 'I stomp my heel down on his skull');
  // mech tag must NOT mention the weapon name on an unarmed action
  assert.doesNotMatch(result.mechanicsLine, /Worn Blade/i, 'stomp mech must not say "Worn Blade"');
  // mech tag must identify the strike type
  assert.match(result.mechanicsLine, /strike:Stomp|Stomp/i, 'stomp mech must identify Stomp');
});

test('U175-31: headbutt resolves with "Headbutt" label in mech', () => {
  const w = combatWorld();
  const { result } = resolveEscapeCombatTurn(w, 'I headbutt Brokefang square in the snout');
  assert.doesNotMatch(result.mechanicsLine, /Worn Blade/i);
  assert.match(result.mechanicsLine, /strike:Headbutt|Headbutt/i);
});

test('U175-32: bite resolves with "Bite" label in mech', () => {
  const w = combatWorld();
  const { result } = resolveEscapeCombatTurn(w, 'I bite his ear off');
  assert.doesNotMatch(result.mechanicsLine, /Worn Blade/i);
  assert.match(result.mechanicsLine, /strike:Bite|Bite/i);
});
