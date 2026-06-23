import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// H-94 — combat-initiation parity (2026-06-23). When combat is NOT yet active, a
// clear unarmed/improvised strike on a present NPC must START combat and resolve
// through the combat path — the same verb set the ACTIVE-combat resolver already
// honours (H-92/H-93). Two gaps closed:
//
//   (1) "I stamp my boot down on <NPC>'s hand" fell through to a generic WITS
//       skill roll because ANY_VIOLENCE / DIRECT_ATTACK_VERB knew "stomp" but not
//       "stamp" (playloop.js detectAttackAnyIntent). Adding "stamp" lets the
//       "down on <NPC>" prep-capture resolve the target and engage combat.
//
//   (2) "I tell <NPC> I could stomp him" WRONGLY started combat — DIRECT_ATTACK_VERB
//       matched "stomp him" → "him" → the present NPC, ignoring the reported-speech
//       frame. isSpokenOrHypotheticalViolence() now bails when a sentence is framed
//       as speech ("I tell/say/warn X …") AND carries a reported first-person modal
//       ("I could/would/'ll …"). It is deliberately narrow: a real action that
//       merely follows speech ("I tell X off and punch him") and a bare direct
//       threat ("X, I'll kill you") still start combat.
//
// Sibling to U171 (throw/grab assault starts combat), U145, U149, U175, U193, U198,
// U211. Pure routing assertion on combat.active — deterministic, no LLM.
// See docs/PACKETS.md H-94.

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function world(seed = 'stonewatch-hollow') {
  const w = beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const npc = (node?.settlement?.npcs || [])[0];
  const first = String(npc?.name || '').split(' ')[0];
  return { w, first };
}

const startsCombat = (text, seed = 'stonewatch-hollow') => {
  const { w } = world(seed);
  return playerMove(w, packs, text).world.combat?.active === true;
};

// ── Positives — unarmed/improvised strike on a present NPC starts combat ──────

test('U224-01: "I stamp my boot down on <NPC>\'s hand" starts combat (H-94 primary repro)', () => {
  const { first } = world();
  assert.equal(startsCombat(`I stamp my boot down on ${first}'s hand.`), true,
    '"stamp ... down on <NPC>\'s hand" must engage combat, not a generic skill roll');
});

test('U224-02: "I stomp on <NPC>\'s hand" starts combat', () => {
  const { first } = world();
  assert.equal(startsCombat(`I stomp on ${first}'s hand.`), true);
});

test('U224-03: "I kick <NPC>" starts combat', () => {
  const { first } = world();
  assert.equal(startsCombat(`I kick ${first}.`), true);
});

test('U224-04: "I knee <NPC> in the gut" starts combat', () => {
  const { first } = world();
  assert.equal(startsCombat(`I knee ${first} in the gut.`), true);
});

test('U224-05: "I headbutt <NPC>" starts combat', () => {
  const { first } = world();
  assert.equal(startsCombat(`I headbutt ${first}.`), true);
});

test('U224-06: "I punch <NPC>" still starts combat (regression guard)', () => {
  const { first } = world();
  assert.equal(startsCombat(`I punch ${first}.`), true);
});

// ── Negatives — must NOT start combat ────────────────────────────────────────

test('U224-10: "I tell <NPC> I could stomp him" does NOT start combat (reported speech)', () => {
  const { first } = world();
  assert.equal(startsCombat(`I tell ${first} I could stomp him.`), false,
    'a violent verb voiced as reported speech is talk, not an executed strike');
});

test('U224-11: "I stomp my foot in frustration" does NOT start combat (no NPC target)', () => {
  assert.equal(startsCombat('I stomp my foot in frustration.'), false);
});

test('U224-12: "I kick the door" does NOT start combat (object, not NPC)', () => {
  assert.equal(startsCombat('I kick the door.'), false);
});

test('U224-13: "I flex and intimidate <NPC>" does NOT start combat (social)', () => {
  const { first } = world();
  assert.equal(startsCombat(`I flex and intimidate ${first}.`), false);
});

// ── Guard precision — reported-speech bail must NOT swallow real actions ──────

test('U224-20: "I tell <NPC> off and punch him" STILL starts combat (action follows speech)', () => {
  const { first } = world();
  assert.equal(startsCombat(`I tell ${first} off and punch him.`), true,
    'the speech-frame guard must require a reported modal — a real strike after speech still fights');
});

test("U224-21: \"<NPC>, I'll kill you\" STILL starts combat (bare direct threat)", () => {
  const { first } = world();
  assert.equal(startsCombat(`${first}, I'll kill you.`), true,
    'a direct threat with no "I tell/say" frame is not reported speech');
});
