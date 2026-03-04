import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../../engine/state.js';
import { worldHash } from '../../engine/worldHash.js';
import { beginAdventure, newScene, playerMove } from '../../engine/playloop.js';
import { handleAiRequest } from '../../server/ai.js';

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

function makeStubClient() {
  let i = 0;
  return {
    responses: {
      create: async () => {
        i++;
        // Intentionally vary responseText while keeping it contract-valid.
        const out = i % 2 === 0
          ? { suggestedIntent: 'wait', askForRoll: null }
          : { suggestedIntent: 'look around', askForRoll: { skill: 'Steel', dc: 8, stakes: 'time' } };

        return {
          output_text: JSON.stringify(out),
          system_fingerprint: i % 2 === 0 ? 'fp-a' : 'fp-b'
        };
      }
    }
  };
}

function runTranscriptWithApiNoise(seed, transcript) {
  const client = makeStubClient();

  let w = newWorld({
    seed,
    fate: 0.2,
    campaignId: 'u40-gateb',
    pack: { primaryId: 'fantasy', mixerId: null }
  });

  w = beginAdventure(w, packsById).world;
  w = newScene(w, packsById).world;

  for (const line of transcript) {
    w = playerMove(w, packsById, line).world;

    // "API enabled" side-call: must not affect canonical state.
    // (trace may be written; determinism concerns are worldHash + canon)
    void handleAiRequest({
      client,
      body: {
        mode: 'ADVISE',
        seed: 999,
        composerLine: 'You wait.',
        worldSnapshot: { nouns: ['hall'], tags: ['cold'], motifs: ['iron'] },
        styleProfile: { voice: 'plain', verbosity: 0, fate: 0.2 }
      }
    });
  }

  return w;
}

test('U40: Gate B — deterministic replay with API enabled (stubbed) => identical worldHash + canon', () => {
  const seed = 'u40-seed-0';
  const transcript = [
    'look around',
    'search for the key',
    'ask the guide for help',
    'press onward',
    'inspect the door'
  ];

  const N = 10;
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(runTranscriptWithApiNoise(seed, transcript));

  const h0 = worldHash(runs[0]);
  const canon0 = runs[0].canonLog?.events ?? [];
  const tl0 = canonicalTimeline(runs[0]);

  for (let i = 1; i < runs.length; i++) {
    assert.equal(worldHash(runs[i]), h0, `worldHash mismatch at run ${i}`);
    assert.deepEqual(runs[i].canonLog?.events ?? [], canon0, `canonLog.events mismatch at run ${i}`);
    assert.deepEqual(canonicalTimeline(runs[i]), tl0, `canonical timeline mismatch at run ${i}`);
  }
});
