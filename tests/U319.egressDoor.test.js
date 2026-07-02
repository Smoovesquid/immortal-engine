// U319 — AG-3: the one-way egress door (docs/briefs/AG-3-egress-wrapper.md,
// second-order diagnosis §2.3). A direct player question can never silently
// dead-end: the single wrapper downstream of every sink (applyEgressRepair,
// inside playerMove) repairs an owed-answer turn whose output is a NON-ANSWER —
// by movement provenance (LH-2, caught structurally), by gen-bank narration, or
// by an unrecognized provenance — routing the classifier's typed verdict to the
// read-only answerers, and flipping the default to an honest voiced decline
// (never the gen/atmosphere/survey/clarify sink). The repair is NARRATION-only:
// no world mutation, no rng — worldHash is unchanged (determinism holds).
//
// The four P10 antecedent properties (all mech-line / string checkable, no judge):
//   (i)   wrapper live — a non-answer on an owed-answer input exits repaired,
//         proven by a before/after on the same synthetic output.
//   (ii)  whitelist enforced — an unknown-provenance non-answer is repaired; a
//         whitelisted answer passes through byte-identical.
//   (iii) default flip — all-dispatchers-null → declineInfoSeek voiced decline,
//         and the gen-bank strings are unreachable on question / imperative-info
//         turns.
//   (iv)  LH-2 closed — "who's in the next room?" no longer walks the player
//         through the door unanswered.
// Plus diverge/negative controls (actions keep the gen bank; combat & dialogue
// stay closed) and determinism (repaired turns replay identical worldHash).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginAdventure, playerMove, applyEgressRepair } from '../engine/playloop.js';
import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// A non-interior settlement world (several NPCs present, no combat, no dialogue).
function settlementWorld(seed = 'ashfen-reach') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  return { ...w, scene: { ...(w.scene || {}), interior: null, dialogue: null }, combat: { ...(w.combat || {}), active: false } };
}

// The same seed's boot state IS a real interior (structureKey/roomId) with a
// reachable next room — used for the LH-2 movement swallow.
function interiorWorld(seed = 'ashfen-reach') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const surface = (r) => `${r.output?.narration || ''} ${r.output?.mechanics || ''}`.trim();
const GEN_BANK = /goes your way|after a fashion|see it through|it half.?works|moment slips past|left where you started/i;
const DECLINE = /don.t know|can.t say|no record|lost to me|wouldn.t know|no one here would know|couldn.t say/i;

// ── (i) wrapper live ────────────────────────────────────────────────────────

test('U319-i: an owed-answer non-answer exits playerMove repaired (before/after on the same output)', () => {
  const w = settlementWorld();
  // "before" — what playerMoveCore hands the wrapper: a gen-bank non-answer that
  // rolled and floored on a direct question.
  const before = { world: w, output: { narration: 'Wizard: You see it through, and it goes your way.', mechanics: '[roll:15 vs DC:12 → success | stat:WITS]' } };
  const after = applyEgressRepair(w, 'who is the elder of this village?', before);
  assert.notEqual(after.output.narration, before.output.narration, 'the wrapper must transform the non-answer');
  assert.equal(after.output.mechanics, '[egress:repair]', surface(after));
  assert.doesNotMatch(after.output.narration, GEN_BANK, surface(after));
});

test('U319-i: a clarify non-answer on an owed-answer input is repaired, not shipped', () => {
  const w = settlementWorld();
  // an unrecognized (non-bracket) provenance stands in for a fresh dead-end path.
  const before = { world: w, output: { narration: 'Wizard: An unhelpful nothing.', mechanics: 'novel-sink-fog' } };
  const after = applyEgressRepair(w, 'who founded this settlement?', before);
  assert.equal(after.output.mechanics, '[egress:repair]', surface(after));
  assert.notEqual(after.output.narration, before.output.narration);
});

// ── (ii) whitelist enforced, untagged → repair ──────────────────────────────

test('U319-ii: an unknown-provenance non-answer on a question turn is repaired', () => {
  const w = settlementWorld();
  const before = { world: w, output: { narration: 'Wizard: A vague nothing happens.', mechanics: 'synthetic-fog-sink' } };
  const after = applyEgressRepair(w, 'who leads this place?', before);
  assert.equal(after.output.mechanics, '[egress:repair]', surface(after));
});

test('U319-ii: a whitelisted answer passes through byte-identical', () => {
  const w = settlementWorld();
  // a recognized answer-bearing bracket tag — the egress must not touch it.
  const answer = { world: w, output: { narration: 'Wizard: Bram Cask, a tavern-keeper — one of the folk here.', mechanics: '[person → grounded]' } };
  const after = applyEgressRepair(w, 'who is the tavern-keeper?', answer);
  assert.equal(after.output.narration, answer.output.narration, 'answer narration unchanged');
  assert.equal(after.output.mechanics, answer.output.mechanics, 'answer mechanics unchanged');
});

test('U319-ii: an empty-tag meta answer (character sheet) passes through un-repaired', () => {
  const w = settlementWorld();
  const { output } = playerMove(w, PACKS, 'name / class / current HP?');
  assert.notEqual(output.mechanics, '[egress:repair]', surface({ output }));
  assert.match(output.narration, /class|hit points|HP/i, surface({ output }));
});

// ── (iii) default flip ──────────────────────────────────────────────────────

test('U319-iii: all-dispatchers-null on an owed-answer turn → an honest voiced decline (never gen bank)', () => {
  const w = settlementWorld();
  // A question with no grounded answer available: the machinery must decline in
  // voice, not fall back to the atmosphere bank.
  const before = { world: w, output: { narration: 'Wizard: It lands, after a fashion — partial, imperfect.', mechanics: '[roll:9 vs DC:12 → mixed]' } };
  const after = applyEgressRepair(w, 'what did the vanished cartographer bury under the third stone?', before);
  assert.equal(after.output.mechanics, '[egress:repair]', surface(after));
  assert.match(after.output.narration, DECLINE, surface(after));
  assert.doesNotMatch(after.output.narration, GEN_BANK, surface(after));
});

test('U319-iii: gen-bank strings are unreachable on question-shaped / imperative-info turns', () => {
  const inputs = [
    'who is the elder of this village?',
    'what happened to the old mill?',
    'tell me about the last traveler who slept here',
    'how many winters has the keeper served?',
    'who leads the people here?',
  ];
  for (const t of inputs) {
    const { output } = playerMove(settlementWorld(), PACKS, t);
    assert.doesNotMatch(output.narration, GEN_BANK, `gen bank reached on question turn: ${t} :: ${output.narration}`);
  }
});

// ── (iv) LH-2 closed ────────────────────────────────────────────────────────

test('U319-iv (LH-2): "who\'s in the next room?" does not walk the player through the door unanswered', () => {
  const w = interiorWorld();
  assert.ok(w.scene?.interior?.structureKey, 'precondition: a real interior');
  const before = `${w.map?.currentNodeId || ''}|${w.scene?.interior?.roomId || ''}`;
  const r = playerMove(w, PACKS, "who's in the next room?");
  // The player state may still have moved (the repair keeps whatever the reducer
  // produced) — but the NARRATION now answers the presence question instead of a
  // bare "you step through into the next room".
  assert.doesNotMatch(r.output.narration, /^Wizard: You step (?:through|into)\b/i, surface(r));
  assert.match(r.output.narration, /in the room with you|not alone|no one else|You're inside/i, surface(r));
  assert.equal(r.output.mechanics, '[egress:repair]', surface(r));
  // and it genuinely was the movement swallow (position changed) — caught with
  // NO movement-branch guard.
  const after = `${r.world.map?.currentNodeId || ''}|${r.world.scene?.interior?.roomId || ''}`;
  assert.notEqual(after, before, 'precondition: the turn was the movement swallow');
});

// ── diverge / negative controls ─────────────────────────────────────────────

test('U319-neg: a declared ACTION that floors still hits the gen/atmosphere bank (the door only repairs questions)', () => {
  const w = settlementWorld();
  const before = { world: w, output: { narration: 'Wizard: You see it through, and it goes your way.', mechanics: '[roll:15 → success]' } };
  const after = applyEgressRepair(w, 'I shove the cart down the hill', before);
  assert.equal(after.output.narration, before.output.narration, 'a declared action is not owed an answer — unchanged');
  assert.equal(after.output.mechanics, before.output.mechanics, surface(after));
});

test('U319-neg: combat stays closed — a mid-combat question is not egress-repaired', () => {
  const w = beginAdventure(newWorld({ seed: 'ashfen-reach', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const combat = { ...w, combat: { ...(w.combat || {}), active: true } };
  const before = { world: combat, output: { narration: 'Wizard: You see it through, and it goes your way.', mechanics: '[roll:15 → success]' } };
  const after = applyEgressRepair(combat, 'who am I fighting?', before);
  assert.notEqual(after.output.mechanics, '[egress:repair]', 'combat mode claim stays first');
});

test('U319-neg: dialogue stays closed — an in-dialogue question is not egress-repaired', () => {
  const w = beginAdventure(newWorld({ seed: 'ashfen-reach', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const inDialogue = { ...w, scene: { ...(w.scene || {}), dialogue: { npcId: 'x', topics: [] } } };
  const before = { world: inDialogue, output: { narration: 'Wizard: You see it through, and it goes your way.', mechanics: '[roll:15 → success]' } };
  const after = applyEgressRepair(inDialogue, 'who runs this place?', before);
  assert.notEqual(after.output.mechanics, '[egress:repair]', 'dialogue mode claim stays first');
});

// ── determinism (the hard gate) ─────────────────────────────────────────────

test('U319-det: the egress repair mutates NO world state (worldHash unchanged)', () => {
  const w = settlementWorld();
  const before = { world: w, output: { narration: 'Wizard: You see it through, and it goes your way.', mechanics: '[roll:15 → success]' } };
  const h0 = worldHash(before.world);
  const after = applyEgressRepair(w, 'who is the elder here?', before);
  assert.equal(worldHash(after.world), h0, 'repair introduced a world mutation');
});

test('U319-det: a repaired LH-2 turn replays identical worldHash + surface', () => {
  const r1 = playerMove(interiorWorld(), PACKS, "who's in the next room?");
  const r2 = playerMove(interiorWorld(), PACKS, "who's in the next room?");
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'repaired turn is non-deterministic');
  assert.equal(surface(r1), surface(r2), 'repaired surface diverged across identical runs');
  assert.equal(r1.output.mechanics, '[egress:repair]', 'precondition: the LH-2 turn was repaired');
});
