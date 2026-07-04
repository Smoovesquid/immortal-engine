// U458 — INT-4-HELD: actions WITH a held/present object resolve as ACTIONS, never
// as a possession check. Possession is a PRECONDITION, not a resolution.
//
// Three strikes from the Opus gate (2026-07-04-2 / -3, seed 'tallow', escape mode,
// the Wayfarers' Outpost wake-room):
//   1. "I hurl the lantern against the wall" → "the lantern is already tucked in
//      your pack" — the throw silently never happened.
//   2. "I grab the lantern off the wall and set the straw pallet on fire." →
//      mech [take:already-held | no roll]; the arson never resolved.
//
// Two seams ate the verb, both fixed here:
//   • detectPhysicalAssault's forced-into-harm branch stamped "hurl THE LANTERN
//     against the wall" as a no-target ASSAULT ("no one here to lay hands on")
//     because a single-token noun after "the" read as name-shaped. A present
//     OBJECT is not a person → refIsPresentObject falls it through to the physics/
//     roll path.
//   • tryTakeRevealedContainerItem's acquire-idempotence sink ("already in your
//     pack") fired for a compound whose real head intent was an ACTION. A trailing
//     action verb (throw/set-fire/…) now makes the take gate YIELD (TAKE_THEN_ACTION_RE).
//   • The natural arson phrasing "set X ON FIRE" (split) now reaches the material-
//     aware fire ruling (broadened FIRE_RE / PHYSICS_VERB_RE), not TAKE_RE.
//
// Deterministic, LLM-off: ×2 identical boots resolve identically.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const run = (text) => playerMove(boot(), PACKS, text).output;

// A possession-dodge = the response denies the action by asserting the object is
// already held / in the pack, with no action resolution.
const POSSESSION_DODGE_RE = /already\s+(?:in your pack|tucked|held|yours|carried)|in your pack\b/i;
const TAKE_IDEMPOTENCE_MECH = /take:already-held/i;

test('U458: precondition — the tallow wake-room holds the pallet + lantern furniture and the player carries a Lantern', () => {
  const w = boot();
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
  const furn = (node?.furniture || []).map(f => String(f.name).toLowerCase());
  assert.ok(furn.some(n => n.includes('pallet')), 'straw pallet present');
  assert.ok(furn.some(n => n.includes('lantern')), 'oil lantern present as furniture');
  const inv = w.party?.[0]?.inventory || {};
  const held = Object.values(inv).flat().map(it => String(it?.name || '').toLowerCase());
  assert.ok(held.some(n => n.includes('lantern')), 'a Lantern is already held (the idempotence trap)');
});

test('U458-01: "I hurl the lantern against the wall" resolves as an ACTION, not a no-target/possession dodge', () => {
  const out = run('I hurl the lantern against the wall');
  assert.doesNotMatch(String(out.narration), POSSESSION_DODGE_RE, 'no "already in your pack" dodge');
  assert.doesNotMatch(String(out.mechanics), /\[no-target\]/i, 'not stamped a no-target assault');
  assert.doesNotMatch(String(out.narration), /no one here to lay hands on/i, 'not "no one here to lay hands on"');
  // A resolution: either a d20 roll or a grounded physics outcome.
  assert.match(String(out.mechanics), /roll:\d+\s+vs\s+DC:\d+|physics:/i, 'mechanics show a real resolution');
});

test('U458-02: the compound "grab the lantern ... and set the straw pallet on fire" RESOLVES the arson', () => {
  const out = run('I grab the lantern off the wall and set the straw pallet on fire.');
  assert.doesNotMatch(String(out.mechanics), TAKE_IDEMPOTENCE_MECH, 'the take-idempotence sink did NOT eat the turn');
  assert.doesNotMatch(String(out.narration), POSSESSION_DODGE_RE, 'no possession dodge');
  // The arson resolves through the material-aware fire ruling: the physics path
  // fires and the flame takes to the pallet.
  assert.match(String(out.mechanics), /physics:/i, 'routed to the physics/fire resolution');
  assert.match(String(out.narration), /flame|fire|smoke|burn|catch|alight|ablaze/i, 'the fiction resolves an attempted/started fire');
  assert.match(String(out.narration).toLowerCase(), /pallet/i, 'the fire is aimed at the pallet the player named');
});

test('U458-03: standalone natural arson "set the straw pallet on fire" reaches the fire ruling (not a generic take)', () => {
  const out = run('I set the straw pallet on fire.');
  assert.doesNotMatch(String(out.narration), /you take the/i, 'not resolved as a TAKE of the pallet');
  assert.match(String(out.narration), /flame|fire|smoke|burn|catch|alight|ablaze/i, 'resolves an attempted/started fire');
});

test('U458-04: another object-throw "I hurl the chest against the wall" resolves as an action, not no-target', () => {
  const out = run('I hurl the chest against the wall');
  assert.doesNotMatch(String(out.mechanics), /\[no-target\]/i, 'a chest is an object, not a person');
  assert.doesNotMatch(String(out.narration), /no one here to lay hands on/i);
  assert.match(String(out.mechanics), /roll:\d+\s+vs\s+DC:\d+|physics:|salvage/i, 'a real resolution');
});

test('U458-05: deterministic ×2 — both gate lines resolve byte-identically on repeat boots (LLM-off)', () => {
  for (const line of ['I hurl the lantern against the wall', 'I grab the lantern off the wall and set the straw pallet on fire.']) {
    const a = run(line);
    const b = run(line);
    assert.equal(a.narration, b.narration, `narration stable for: ${line}`);
    assert.equal(a.mechanics, b.mechanics, `mechanics stable for: ${line}`);
  }
});
