import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginDialogue } from '../engine/npc/dialogue.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// C8 (coherence-seams audit, 2026-07-02): isSelfHarmDeclared's papercut branch
// bare-matched "scratch/nick/graze" against any SELF_HARM_TARGET body part, so
// "I scratch my cheek" — a nervous tic mid-conversation — fired a full
// self-harm/bleed resolution and, inside dialogue, forced the conversation to
// end ("You break off from <NPC> — ..."). Fixed by splitting the ambiguous
// light-touch verbs (scratch/nick/graze — everyday non-injury meanings) out of
// the self-harm verb set; they now require an explicit blade/edge word
// (SELF_HARM_EDGE_CONTEXT) or the unambiguous "papercut"/"paper cut" phrase to
// resolve as self-harm. The unambiguous violence verbs (cut/slash/stab/gash/
// carve/sever/etc.) are UNCHANGED — they still fire standalone, same as
// before (U143/U335 lock this).

function freshWorld(seed = 'self-harm') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

// ── the repro: incidental scratch/nick/graze must NOT self-harm ─────────────

test('U344: "I scratch my cheek" is a nervous tic, not self-harm — no bleed, no wound', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, 'I scratch my cheek');
  assert.doesNotMatch(output.mechanics || '', /self-harm/, 'must not read as self-harm');
  assert.equal(world.party[0].wounds, before, 'no wound taken');
  assert.equal((world.party[0].conditions || []).find(c => c.name === 'bleeding'), undefined, 'no bleed condition');
});

test('U344: sibling incidental touches (nick a doorframe, graze a wall, scratch head/nose) do not self-harm', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const cases = [
    'I scratch my head',
    'I scratch my nose',
    'I scratch my chin thoughtfully',
    'I scratch my finger',
    'I nick my thumbnail on the doorframe',
    'I graze my elbow on the wall',
  ];
  for (const text of cases) {
    const { world, output } = playerMove(w, byId, text);
    assert.doesNotMatch(output.mechanics || '', /self-harm/, `must not self-harm: ${text}`);
    assert.equal(world.party[0].wounds, before, `no wound: ${text}`);
  }
});

test('U344: a papercut declared mid-dialogue does NOT end the conversation', () => {
  const { w, byId } = freshWorld('aldermere');
  const node = (w.map?.nodes || []).find(n => (n.settlement?.npcs || []).length > 0);
  assert.ok(node, 'found a node with an NPC to talk to');
  const npc = node.settlement.npcs[0];
  let w1 = { ...w, map: { ...w.map, currentNodeId: node.id }, party: [{ ...w.party[0], nodeId: node.id }] };
  w1 = beginDialogue(w1, npc.name || npc.id).world;
  assert.ok(w1.scene?.dialogue, 'dialogue is active');
  const { world, output } = playerMove(w1, byId, 'I scratch my cheek');
  assert.doesNotMatch(output.mechanics || '', /self-harm/, 'not read as self-harm mid-dialogue');
  assert.ok(world.scene?.dialogue, 'the conversation is still active — not forced to break off');
});

// ── the guard: an explicit blade/edge context still lets the ambiguous verbs fire ──

test('U344: "nick/scratch/graze" WITH an explicit blade/edge word still resolves as self-harm', () => {
  const cases = [
    'I nick my wrist with the blade',
    'I scratch my arm with the knife',
    'I graze my wrist with the razor',
    'I drag the edge across and give myself a scratch',
  ];
  for (const text of cases) {
    const { w, byId } = freshWorld();
    const before = w.party[0].wounds ?? 0;
    const { world, output } = playerMove(w, byId, text);
    assert.match(output.mechanics, /self-harm — papercut bleed/, `should self-harm (papercut tier): ${text}`);
    assert.equal(world.party[0].wounds, before, 'papercut costs 0 HP');
  }
});

test('U344: the explicit "papercut"/"paper cut" word still fires standalone (no blade needed)', () => {
  const { w, byId } = freshWorld();
  const { output } = playerMove(w, byId, 'just a papercut on my thumb');
  assert.match(output.mechanics, /self-harm — papercut bleed/);
});

// ── the non-regression: unambiguous violence verbs are UNCHANGED ────────────

test('U344: unambiguous self-harm verbs (cut/stab/slash/slit/gash/carve) are unaffected', () => {
  const cases = [
    { text: 'I cut my palm', tier: 'shallow' },
    { text: 'I slit my own throat', tier: 'arterial' },
    { text: 'I stab myself in the leg', tier: 'shallow' },
    { text: 'I drive the blade deep into my thigh', tier: 'deep' },
    { text: 'I carve a gash into my own arm', tier: 'severe' },
  ];
  for (const { text, tier } of cases) {
    const { w, byId } = freshWorld();
    const { output } = playerMove(w, byId, text);
    assert.match(output.mechanics, new RegExp(`self-harm — ${tier} bleed`), `unambiguous verb unaffected: ${text}`);
  }
});

test('U344: negated / external / hypothetical self-harm is unaffected', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  for (const text of ['I cut the rope', 'I threaten to cut myself', 'I almost cut my hand on the glass', "I won't cut myself"]) {
    const { world, output } = playerMove(w, byId, text);
    assert.doesNotMatch(output.mechanics || '', /self-harm/, `not self-harm: ${text}`);
    assert.equal(world.party[0].wounds, before, `no wound: ${text}`);
  }
});
