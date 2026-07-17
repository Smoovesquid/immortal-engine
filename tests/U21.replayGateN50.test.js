import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { simulateTurns } from '../engine/simulate.js';
import { exportWorld, importWorld } from '../engine/save.js';
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

function replayFromTimeline(seedWorld, packs) {
  const seed = String(seedWorld.meta.seed);
  const fate = Number(seedWorld.meta.fate);
  const campaignId = String(seedWorld.meta.campaignId);
  const pack = { primaryId: seedWorld.pack.primaryId, mixerId: seedWorld.pack.mixerId ?? null };

  let w = newWorld({ seed, fate, campaignId, pack });

  for (const e of (seedWorld.timeline || [])) {
    const kind = String(e?.kind || '');
    if (kind === 'begin') {
      w = beginAdventure(w, packs).world;
    } else if (kind === 'scene') {
      w = newScene(w, packs).world;
    } else if (kind === 'travel') {
      // Prefer the original intent text (C2 widened the travel event data);
      // fall back to 'go to <name>' for legacy timelines.
      const intent = String(e?.data?.intent || '');
      if (intent) {
        w = playerMove(w, packs, intent).world;
      } else {
        const to = String(e?.data?.to || '');
        const node = (w.map?.nodes || []).find(n => String(n?.id || '') === to) || null;
        const name = String(node?.name || '').trim();
        const txt = name ? `go to ${name}` : 'exit';
        w = playerMove(w, packs, txt).world;
      }
    } else if (kind === 'resolution' || kind === 'blocked') {
      const txt = String(e?.data?.text ?? e?.data?.intent ?? '');
      // RULING-DC-1: recorded llm packets replay through the {llmPacket} seam.
      const ri = e?.data?.resolvedIntent;
      w = playerMove(w, packs, txt, ri && ri.source === 'llm' ? { llmPacket: ri } : undefined).world;
    }
  }

  return w;
}

test('U21: Gate II Deterministic Replay (N>=50, turns>=300)', () => {
  const N = 50;
  const TURNS = 300;

  for (let i = 0; i < N; i++) {
    const seed = `u21-seed-${i}`;
    const w0 = newWorld({
      seed,
      fate: 0.2,
      campaignId: 'u21',
      pack: { primaryId: 'fantasy', mixerId: null }
    });

    const { world: simulated } = simulateTurns(w0, packsById, TURNS);
    const hashA = worldHash(simulated);

    const exported = exportWorld(simulated);
    const imported = importWorld(exported);
    const hashExport = worldHash(imported);
    assert.equal(hashExport, hashA);

    const replayed = replayFromTimeline(simulated, packsById);
    const hashReplay = worldHash(replayed);
    assert.equal(hashReplay, hashA);
  }
});
