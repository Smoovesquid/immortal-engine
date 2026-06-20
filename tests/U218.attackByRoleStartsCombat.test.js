// U218 — H-55: declared lethal attacks on role/descriptor NPCs start real
// combat, and unknown role targets decline in-fiction instead of becoming
// unmechanized wound narration.

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
    seed: 'h55',
    fate: 0.3,
    campaignId: 'h55',
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'h55_settlement',
    name: 'Glass-Harbor Test Village',
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

function enemyNames(world) {
  return (world.combat?.enemies || []).map(e => String(e?.name || ''));
}

test('U218-01: exact lethal role attack starts combat against the baker', () => {
  const w = worldWith([
    {
      id: 'npc_baker',
      name: 'Mira Hearth',
      role: 'artisan',
      occupation: 'baker',
      descriptor: 'flour-dusted baker',
      hostile: false
    }
  ]);

  const r = playerMove(w, PACKS, 'I let go of his ankles, draw my dagger, and stab the baker in the gut.');

  assert.equal(r.world.combat?.active, true, 'combat must start');
  assert.ok(enemyNames(r.world).includes('Mira Hearth'), 'the baker becomes the combat enemy');
  assert.match(String(r.output?.mechanics || ''), /strike|combat|attack/i, 'the turn resolves through combat mechanics');
  assert.notEqual(String(r.output?.mechanics || ''), '', 'must not be a no-mechanics narration beat');
});

test('U218-02: named NPC attack still starts combat', () => {
  const w = worldWith([
    { id: 'npc_baker', name: 'Mira Hearth', role: 'baker', hostile: false }
  ]);

  const r = playerMove(w, PACKS, 'I draw my dagger and stab Mira in the gut');

  assert.equal(r.world.combat?.active, true, 'name path still starts combat');
  assert.ok(enemyNames(r.world).includes('Mira Hearth'), 'named NPC is the combat enemy');
});

test('U218-03: unknown role target declines instead of rolling a wound', () => {
  const w = worldWith([
    { id: 'npc_baker', name: 'Mira Hearth', role: 'baker', hostile: false }
  ]);

  const r = playerMove(w, PACKS, 'I stab the dragon-priest in the gut');
  const mechanics = String(r.output?.mechanics || '');
  const surface = `${r.output?.narration || ''} ${mechanics}`;

  assert.equal(r.world.combat?.active, false, 'no combat starts for an absent target');
  assert.equal(enemyNames(r.world).length, 0, 'no enemy entity is minted');
  assert.match(mechanics, /no-target|clarify/i, 'decline must be a grounding/no-target beat');
  assert.doesNotMatch(surface, /\bwounds?\b|gut|cleanly|hit|strike:/i, 'must not assert an unmechanized wound');
});
