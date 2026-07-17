import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { beginAdventure, newScene, playerMove } from '../engine/playloop.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';

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

function replayFromTimeline(seedWorld, packs) {
  const seed = String(seedWorld.meta.seed);
  const fate = Number(seedWorld.meta.fate);
  const campaignId = String(seedWorld.meta.campaignId);
  const pack = { primaryId: seedWorld.pack.primaryId, mixerId: seedWorld.pack.mixerId ?? null };

  let w = newWorld({ seed, fate, campaignId, pack });

  // Drive replay from canonical timeline kinds using existing public surfaces.
  for (const e of (seedWorld.timeline || [])) {
    const kind = String(e?.kind || '');
    if (kind === 'begin') {
      w = beginAdventure(w, packs).world;
    } else if (kind === 'scene') {
      w = newScene(w, packs).world;
    } else if (kind === 'resolution') {
      const txt = String(e?.data?.text ?? e?.data?.intent ?? '');
      // RULING-DC-1: a recorded llm packet replays through the same seam it
      // arrived by live — zero model calls; text-only events replay as before.
      const ri = e?.data?.resolvedIntent;
      w = playerMove(w, packs, txt, ri && ri.source === 'llm' ? { llmPacket: ri } : undefined).world;
    } else if (kind === 'blocked') {
      const txt = String(e?.data?.text ?? '');
      const ri = e?.data?.resolvedIntent;
      w = playerMove(w, packs, txt, ri && ri.source === 'llm' ? { llmPacket: ri } : undefined).world;
    } else {
      // travel/threadShift/scarFormed/endingTriggered are effects of the driven surfaces
      // and should re-emerge deterministically; do not apply directly.
    }
  }

  return w;
}

test('U19: worldHash stable across export/import', () => {
  const w0 = newWorld({ seed: 'u19-seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  const begun = beginAdventure(w0, packsById).world;
  const s1 = newScene(begun, packsById).world;
  const w1 = playerMove(s1, packsById, 'I take the torch.').world;

  const h0 = worldHash(w1);

  const text = exportWorld(w1);
  const re = importWorld(text);
  const h1 = worldHash(re);

  assert.equal(h1, h0);
});

test('U19: same seed + same transcript (timeline-driven) => same worldHash', () => {
  const w0 = newWorld({ seed: 'u19-seed-2', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  let w = beginAdventure(w0, packsById).world;
  w = newScene(w, packsById).world;
  w = playerMove(w, packsById, 'I take the torch.').world;
  w = playerMove(w, packsById, 'I search the area carefully.').world;

  const hA = worldHash(w);

  const replayed = replayFromTimeline(w, packsById);
  const hB = worldHash(replayed);

  assert.equal(hB, hA);
});
