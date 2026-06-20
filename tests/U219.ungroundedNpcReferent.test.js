// U219 - H-56: named NPC referents must be grounded before the turn resolves.
// A fabricated named NPC should clarify/decline in-fiction, not fall through to
// movement deadends or generic rolled filler.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'],
    starterObjectives: ['survive'],
    skills: ['force'],
    locations: ['village'],
    objectives: ['survive'],
    complications: ['danger'],
    npcArchetypes: ['baker'],
    sensoryMotifs: ['flour']
  }
};

function worldWith(npcs = []) {
  const base = beginAdventure(newWorld({
    seed: 'h56',
    fate: 0.3,
    campaignId: 'h56',
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'h56_settlement',
    name: 'Pilgrim\'s Rest Test Village',
    nodeType: 'settlement',
    discovered: true,
    settlement: {
      npcs: npcs.map(n => ({
        conversationState: { trustLevel: 5 },
        ...n
      }))
    }
  };
  return ensureWorld({
    ...base,
    map: {
      ...base.map,
      currentNodeId: node.id,
      nodes: [...(base.map?.nodes || []), node]
    },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

function bakerWorld() {
  return worldWith([
    {
      id: 'npc_baker',
      name: 'Mira Hearth',
      role: 'baker',
      occupation: 'baker',
      descriptor: 'flour-dusted baker',
      hostile: false
    }
  ]);
}

function surfaceOf(result) {
  return `${result.output?.narration || ''} ${result.output?.mechanics || ''}`;
}

test('U219-01: fabricated named demand clarifies without a roll or state change', () => {
  const w = bakerWorld();
  const before = structuredClone(w);
  const r = playerMove(w, PACKS, "Don't dodge me -- you mentioned Brae Copperforge nodding along just now. Where is this person standing?");
  const surface = surfaceOf(r);

  assert.match(String(r.output?.mechanics || ''), /\[clarify:(?:referent|who)\]/i);
  assert.match(surface, /no one named Brae|haven't introduced anyone named Brae/i);
  assert.doesNotMatch(surface, /\[roll:\d+\s+vs\s+DC:\d+.*success/i);
  assert.deepEqual(r.world, before, 'ungrounded referent clarification must not mutate world state');
});

test('U219-02: fabricated named talk intent clarifies instead of becoming movement', () => {
  const w = bakerWorld();
  const r = playerMove(w, PACKS, 'Okay, um, can I go talk to that guard, Brae, about the bandit?');
  const surface = surfaceOf(r);

  assert.match(String(r.output?.mechanics || ''), /\[clarify:(?:referent|who)\]/i);
  assert.match(surface, /no one named Brae|Mira Hearth/i);
  assert.doesNotMatch(surface, /that way is blocked|left where you started|falls short here/i);
  assert.equal(r.world.scene?.dialogue, null, 'must not begin dialogue for a fabricated NPC');
});

test('U219-03: grounded role talk still begins dialogue', () => {
  const w = bakerWorld();
  const r = playerMove(w, PACKS, 'talk to the baker');

  assert.ok(r.world.scene?.dialogue, 'dialogue should begin with the present baker');
  assert.match(String(r.output?.mechanics || ''), /\[dialogue enter/i);
  assert.match(surfaceOf(r), /Mira Hearth/i);
});

test('U219-04: grounded demand about a present role is not declined as ungrounded', () => {
  const w = bakerWorld();
  const r = playerMove(w, PACKS, 'where is the baker standing?');
  const surface = surfaceOf(r);

  assert.doesNotMatch(String(r.output?.mechanics || ''), /\[clarify:referent\]/i);
  assert.doesNotMatch(surface, /haven't introduced anyone named|no one named/i);
});

test('U219-05: generic actions are not caught by the NPC referent guard', () => {
  const search = playerMove(bakerWorld(), PACKS, 'I search the room');
  const north = playerMove(bakerWorld(), PACKS, 'I head north');

  assert.doesNotMatch(String(search.output?.mechanics || ''), /\[clarify:referent\]/i);
  assert.doesNotMatch(surfaceOf(search), /haven't introduced anyone named|no one named/i);
  assert.doesNotMatch(String(north.output?.mechanics || ''), /\[clarify:referent\]/i);
  assert.doesNotMatch(surfaceOf(north), /haven't introduced anyone named|no one named/i);
});

test('U219-06: vague talk-to-someone still uses the existing who-clarify', () => {
  const w = bakerWorld();
  const r = playerMove(w, PACKS, 'I talk to someone');

  assert.match(String(r.output?.mechanics || ''), /\[clarify:who\]/i);
  assert.match(surfaceOf(r), /A few folk are about/i);
  assert.doesNotMatch(surfaceOf(r), /haven't introduced anyone named|no one named/i);
});
