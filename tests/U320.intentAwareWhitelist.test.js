// U320 — AG-3b: the egress door's whitelist becomes INTENT-AWARE
// (docs/briefs/AG-3b-intent-aware-whitelist.md). AG-3 whitelisted any `[…]`
// provenance as answer-bearing; but a provenance answers only the intents it
// SERVES. The read/observe/object-action family ([read:…], [newspaper:…],
// [container:…], [vision:…], "observe only") answers read/OBJECT asks — NOT an
// addressed-PERSON question. The residual (Newbie-7, P10 gate 2026-07-02): "the
// letter says someone got married — do you know who?" keyed the letter-READ path
// (playloop.js:~6220, [read:revealed-item]) and RE-READ the letter at a person who
// was asked a direct question. The egress now types that cross (npc-addressed ×
// read/object provenance) as a mismatch and repairs it to an honest in-voice
// decline — while a GENUINE read question ("what does the letter say?" → place,
// "read the letter" → command) is still served by the read path, untouched.
//
// Repair is NARRATION-only: no world mutation, no rng (worldHash unchanged).
// LLM-off (deterministic path only).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginAdventure, playerMove, applyEgressRepair } from '../engine/playloop.js';
import { newWorld, ensureWorld } from '../engine/state.js';
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

// A plain settlement (NPC present, no interior/combat/dialogue) — for synthetic
// applyEgressRepair calls (the classifier + answerers need a real world).
function settlementWorld(seed = 'ashfen-reach') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  return { ...w, scene: { ...(w.scene || {}), interior: null, dialogue: null }, combat: { ...(w.combat || {}), active: false } };
}

// The revealed-letter rig: an OPEN coffer that has revealed the marriage letter
// (LETTER_BODIES[7], "They are married at last…", which names no one). Seed/node/
// name are chosen so the deterministic containerContents/containerItemText derive
// that body. The booted interior is cleared on BOTH scene.interior AND the party
// position (ensureWorld re-derives scene.interior from position — state.js:132-137)
// so objectsHere returns the coffer and the read path can key on it.
function revealedLetterWorld() {
  const seed = 'ag3b';
  const base = beginAdventure(newWorld({ seed, fate: 0.3, campaignId: seed, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const node = {
    id: `${seed}_settlement`, name: 'Pilgrim\'s Rest Test Village', nodeType: 'settlement', discovered: true,
    settlement: { decompressed: true, npcs: [{ id: 'npc_baker', name: 'Mira Hearth', role: 'baker', occupation: 'baker', descriptor: 'flour-dusted baker', hostile: false, conversationState: { trustLevel: 5 } }] },
    furniture: [{ name: 'coffer', parts: ['lid', 'body'], state: 'open', bulk: 2, weight: 8, tags: ['wood', 'container'], notes: 'lid thrown back', material: 'wood', category: 'container', hardness: 2 }],
  };
  const party = (base.party || []).map((p, i) => i === 0 ? { ...p, position: { ...(p.position || {}), interior: null } } : p);
  return ensureWorld({
    ...base, party,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: null },
  });
}

const surface = (r) => `${r.output?.narration || ''} ${r.output?.mechanics || ''}`.trim();
const DECLINE = /don.t know|can.t say|no record|lost to me|wouldn.t know|no one here would know|couldn.t say/i;
const LETTER_BODY = /married at last/i;
const READ_TAG = /\[read:revealed-item/;

// ── the mismatch repairs (end-to-end through the real read path) ──────────────

test('U320-mismatch: a person-question that keys the letter-read path is repaired to a decline, not a re-read', () => {
  const r = playerMove(revealedLetterWorld(), PACKS, 'the letter says someone got married — do you know who?');
  assert.equal(r.output.mechanics, '[egress:repair]', surface(r));
  assert.match(r.output.narration, DECLINE, surface(r));
  assert.doesNotMatch(r.output.narration, LETTER_BODY, `the letter must NOT be re-read at the person: ${surface(r)}`);
  assert.doesNotMatch(surface(r), READ_TAG, surface(r));
});

test('U320-mismatch: the verbatim residual (Newbie-7) is repaired', () => {
  const r = playerMove(revealedLetterWorld(), PACKS, 'Sorry, I mean the letter — it says someone got married. Do you know who?');
  assert.equal(r.output.mechanics, '[egress:repair]', surface(r));
  assert.match(r.output.narration, DECLINE, surface(r));
  assert.doesNotMatch(r.output.narration, LETTER_BODY, surface(r));
});

// ── family coverage: every read/observe/object-action provenance, on an
//    addressed-person question, is a mismatch → repaired (synthetic, isolates
//    the whitelist so a body-content quirk can't mask a tag gap) ──────────────

test('U320-family: each read/observe/object-action tag on an npc-addressed question is repaired', () => {
  const w = settlementWorld();
  const tags = [
    '[read:revealed-item | grounded object, legible text, no roll]',
    '[newspaper:read | no roll]',
    '[container:reveal] observe only — no roll',
    '[vision:raw]',
    'observe only — no roll, state unchanged',
  ];
  for (const mech of tags) {
    const before = { world: w, output: { narration: 'Wizard: You turn the thing over in your hands.', mechanics: mech } };
    const after = applyEgressRepair(w, 'do you know who?', before);
    assert.equal(after.output.mechanics, '[egress:repair]', `tag not caught as a person-question mismatch: ${mech} :: ${surface(after)}`);
    assert.match(after.output.narration, DECLINE, `${mech} :: ${surface(after)}`);
  }
});

// ── the over-match guard: a GENUINE read/object question or command is served by
//    the read path, untouched (this is why the mismatch is scoped to npc-addressed) ─

test('U320-diverge: "what does the letter say?" (place) still delivers the letter — NOT repaired', () => {
  const r = playerMove(revealedLetterWorld(), PACKS, 'what does the letter say?');
  assert.notEqual(r.output.mechanics, '[egress:repair]', surface(r));
  assert.match(surface(r), READ_TAG, surface(r));
  assert.match(r.output.narration, LETTER_BODY, surface(r));
});

test('U320-diverge: "read the letter" (a command, not a question) is served by the read path', () => {
  const r = playerMove(revealedLetterWorld(), PACKS, 'read the letter');
  assert.notEqual(r.output.mechanics, '[egress:repair]', surface(r));
  assert.match(surface(r), READ_TAG, surface(r));
});

test('U320-diverge: "is there a name on it?" (referent-followup) is not the person-question repair', () => {
  const r = playerMove(revealedLetterWorld(), PACKS, 'is there a name on it?');
  assert.notEqual(r.output.mechanics, '[egress:repair]', surface(r));
  assert.doesNotMatch(r.output.narration, LETTER_BODY, surface(r));
});

test('U320-diverge (synthetic): a place-question on a read tag passes through byte-identical', () => {
  const w = settlementWorld();
  const body = 'Wizard: You unfold it and read.\n\nThey are married at last.';
  const before = { world: w, output: { narration: body, mechanics: '[read:revealed-item | grounded object, legible text, no roll]' } };
  const after = applyEgressRepair(w, 'what does the letter say?', before);
  assert.equal(after.output.narration, before.output.narration, `a genuine read question must pass through: ${surface(after)}`);
  assert.equal(after.output.mechanics, before.output.mechanics, surface(after));
});

// ── a REAL npc answer to an npc-addressed question is not a read/object tag →
//    the mismatch never catches it (whitelist still holds for served intents) ──

test('U320-passthrough: a grounded npc answer to an npc-addressed question is untouched', () => {
  const w = settlementWorld();
  const answer = { world: w, output: { narration: 'Wizard: "Born here, aye — never left." Mira Hearth says.', mechanics: '[dialogue ask | grounded | trust:5]' } };
  const after = applyEgressRepair(w, 'were you born here?', answer);
  assert.equal(after.output.narration, answer.output.narration, 'a real npc answer must not be repaired');
  assert.equal(after.output.mechanics, answer.output.mechanics, surface(after));
});

// ── determinism (the hard gate) ──────────────────────────────────────────────

test('U320-det: the repair mutates NO world state (worldHash unchanged)', () => {
  const w = revealedLetterWorld();
  const h0 = worldHash(w);
  const before = { world: w, output: { narration: 'Wizard: You unfold it and read.\n\nThey are married at last.', mechanics: '[read:revealed-item | grounded object, legible text, no roll]' } };
  const after = applyEgressRepair(w, 'do you know who married?', before);
  assert.equal(after.output.mechanics, '[egress:repair]', 'precondition: the person-question was repaired');
  assert.equal(worldHash(after.world), h0, 'the repair introduced a world mutation');
});

test('U320-det: a repaired mismatch turn replays identical worldHash + surface', () => {
  const q = 'the letter reads that a wedding was held — were you told who?';
  const r1 = playerMove(revealedLetterWorld(), PACKS, q);
  const r2 = playerMove(revealedLetterWorld(), PACKS, q);
  assert.equal(r1.output.mechanics, '[egress:repair]', 'precondition: the turn was repaired');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'repaired turn is non-deterministic');
  assert.equal(surface(r1), surface(r2), 'repaired surface diverged across identical runs');
});
