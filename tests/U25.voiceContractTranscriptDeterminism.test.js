import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';

const packsById = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['tower'],
    starterObjectives: ['find the key'],
    skills: ['Steel'],
    locations: ['tower'],
    objectives: ['find the key'],
    complications: ['a clock starts'],
    npcArchetypes: ['wary guide'],
    sensoryMotifs: ['air tastes of dust']
  }
};

const CANONICAL_KINDS = new Set([
  'begin',
  'scene',
  'travel',
  'blocked',
  'resolution',
  'threadShift',
  'scarFormed',
  'endingTriggered'
]);

function canonicalTimeline(world) {
  return (world.timeline || [])
    .filter(e => CANONICAL_KINDS.has(String(e?.kind || '')))
    .map(e => ({
      kind: String(e?.kind || ''),
      data: e?.data ?? null
    }));
}

function runTranscript(seed, transcript) {
  let w = newWorld({
    seed,
    fate: 0.2,
    campaignId: 'u25',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  w = beginAdventure(w, packsById).world;
  w = newScene(w, packsById).world;

  for (const line of transcript) {
    w = playerMove(w, packsById, line).world;
  }

  return w;
}

test('U25: Gate V Voice Contract — same seed + same transcript => same canon + same worldHash', () => {
  const seed = 'u25-seed-0';
  const transcript = [
    'look around',
    'search for the key',
    'ask the guide for help',
    'press onward',
    'inspect the door'
  ];

  const a = runTranscript(seed, transcript);
  const b = runTranscript(seed, transcript);

  assert.equal(worldHash(a), worldHash(b), 'worldHash mismatch for identical transcript');
  assert.deepEqual(a.canonLog?.events ?? [], b.canonLog?.events ?? [], 'canonLog.events mismatch');

  const ca = canonicalTimeline(a);
  const cb = canonicalTimeline(b);
  assert.deepEqual(ca, cb, 'canonical timeline mismatch');
});
