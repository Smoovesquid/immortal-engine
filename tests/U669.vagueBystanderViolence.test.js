// U669 — DM-GATE-1d B5: violent intent against a vague present person resolves to
// a REAL settlement NPC through the existing named-NPC violence lane — combat,
// deed, witness, heat — never generic object-damage prose (Opus gate 2026-07-07,
// chaos t5: "I cut down the first villager who runs up with a bucket" → the
// generic skill floor narrated a wounded PERSON as "half-broken", combat stayed
// off, and NO deed recorded — a moral-physics bypass; re-proven LLM-off b144).
//
// Tim's ruling: this is not a separate feature — the TALK path already resolves
// vague person-refs to the roster (playloop vagueTalkRef); mirror that discipline
// into violence. Parity is the law: the vague attack must produce the SAME shape
// the named attack produces (combat init, roster-sourced enemy, deed on the kill).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function bootOutside() {
  let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  w = playerMove(w, PACKS, 'I go outside.').world;
  return w;
}

function rosterNames(w) {
  const node = (w.map.nodes || []).find(n => String(n.id) === String(w.map.currentNodeId));
  return (node?.settlement?.npcs || []).filter(n => n && !n.hostile).map(n => String(n.name));
}

const VAGUE_ATTACK = 'I cut down the first villager who runs up with a bucket.';

test('U669: the vague cut-down starts REAL combat against a present settlement NPC', () => {
  const w0 = bootOutside();
  const roster = rosterNames(w0);
  assert.ok(roster.length >= 1, `settlement folk are present (${roster.join(', ')})`);

  const r = playerMove(w0, PACKS, VAGUE_ATTACK);

  assert.equal(!!r.world.combat?.active, true, 'violence against a present person IS combat');
  const enemy = (r.world.combat?.enemies || [])[0];
  assert.ok(enemy, 'an enemy exists');
  assert.ok(roster.includes(String(enemy.name)),
    `the enemy is a real roster NPC (got "${enemy?.name}", roster: ${roster.join(', ')})`);
  assert.ok(enemy.sourceNpcId, 'the enemy carries NPC provenance (the moral-physics thread)');
  assert.doesNotMatch(String(r.output?.narration || ''), /half-broken|it shifts/i,
    'no object-damage prose for a person');
});

test('U669: the DECLARATION records the deed — cruelty against a civilian, witnessed; vagueness cannot dodge the constitution', () => {
  // The moral chokepoint (applyDeedCharges → tryDarkDeed → recordDeed) reads the
  // declared INTENT: cutting down a bucket-carrying villager is a cut-down of a
  // non-combatant, and it charges as cruelty with the settlement roster as
  // witnesses — at declaration, regardless of whether the victim later dies or
  // breaks and flees (DEATH-arc morale lets a foe run at low HP; a survivor is
  // legitimate, an unrecorded ATTEMPT is not).
  let w = bootOutside();
  const deedsBefore = (w.deeds || []).length;
  const wrathBefore = Number(w.party?.[0]?.morality?.axes?.wrath) || 0;

  const r = playerMove(w, PACKS, VAGUE_ATTACK);
  w = r.world;
  assert.equal(!!w.combat?.active, true);

  const deeds = (w.deeds || []).slice(deedsBefore);
  assert.ok(deeds.length >= 1, `the declaration itself is a recorded deed (deeds: ${JSON.stringify(w.deeds).slice(0, 160)})`);
  const cruelty = deeds.find(d => String(d.kind || d.deedKind) === 'cruelty');
  assert.ok(cruelty, `the charge is CRUELTY — a non-combatant victim (got: ${JSON.stringify(deeds).slice(0, 160)})`);
  assert.ok(Array.isArray(cruelty.witnesses) && cruelty.witnesses.length >= 1,
    'the settlement saw it — witnesses ride the deed into the rumor mill');
  assert.match(String(cruelty.summary || ''), /cut down the first villager/i,
    'the deed carries the declaration verbatim');

  const wrathAfter = Number(w.party?.[0]?.morality?.axes?.wrath) || 0;
  assert.ok(wrathAfter > wrathBefore, 'the wrath axis moves — the constitution priced the act');

  // Parity: the same fair-fight rule holds as for named attacks — attacking an
  // armed named opponent records NO automatic cruelty (untagged fair kill).
  let w2 = bootOutside();
  const before2 = (w2.deeds || []).length;
  w2 = playerMove(w2, PACKS, 'I attack Elske Nightherd.').world;
  assert.equal((w2.deeds || []).length, before2, 'a plain attack on a named person stays a fair fight — no automatic cruelty charge');
});

test('U669: parity + controls — named attack unchanged, object cut-down stays object, talk stays talk', () => {
  // Named NPC attack: byte-parity with the existing lane.
  const w1 = bootOutside();
  const named = playerMove(w1, PACKS, 'I attack Elske Nightherd.');
  assert.equal(!!named.world.combat?.active, true, 'named attack still starts combat');

  // A vague-noun OBJECT target must not resolve to a person.
  const w2 = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const obj = playerMove(w2, PACKS, 'I cut down the shutters.');
  assert.equal(!!obj.world.combat?.active, false, 'object targets never mint people');

  // The talk path's vague resolution is untouched.
  const w3 = bootOutside();
  const talk = playerMove(w3, PACKS, 'I talk to someone.');
  assert.equal(!!talk.world.combat?.active, false);
  assert.match(String(talk.output?.mechanics || ''), /clarify:who|\[talk/i, 'talk lane unchanged');
});
