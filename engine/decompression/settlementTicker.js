// Settlement Ticker — runs worldTick as a history generator for node decompression.
// No authored content. Events emerge from simulation + threshold detection.

import { ensureWorld } from '../state.js';
import { worldTick } from '../worldTick.js';
import { seedFromString, makeRng } from '../rng.js';
import { detectEvents } from './detectEvents.js';

const TAG_TICK_MAP = {
  wilderness: [0, 1],
  village: [2, 4],
  town: [5, 7],
  city: [8, 10]
};

function tickCountFromTags(tags, rng) {
  for (const key of ['city', 'town', 'village', 'wilderness']) {
    if (tags.includes(key)) {
      const [lo, hi] = TAG_TICK_MAP[key];
      return rng.int(lo, hi);
    }
  }
  // Default: village-scale
  return rng.int(2, 4);
}

function buildFoundingState(node, world, pack, rng) {
  const factionPool = Array.isArray(pack.factionPool) ? pack.factionPool : [];
  const objectives = Array.isArray(pack.objectives) ? pack.objectives : [];

  // Pick 1 starting faction from pack's pool
  const startFaction = factionPool.length
    ? rng.pick(factionPool)
    : { id: 'civic', name: 'Civic Authority', type: 'civic' };

  // Seed 1-2 threads from pack objectives so ecology has tension to work with
  const threadCount = rng.int(1, 2);
  const threads = [];
  for (let i = 0; i < threadCount && i < objectives.length; i++) {
    const obj = objectives[rng.int(0, objectives.length - 1)];
    threads.push({
      id: `founding_thread_${i}`,
      objective: String(obj).replace(/\s*\(\d+\)\s*$/, ''),
      tension: rng.int(1, 3),
      trajectory: 'static',
      factionId: startFaction.id,
      active: true,
      age: 0
    });
  }

  return ensureWorld({
    meta: {
      seed: `${node.id}|${world.meta.seed}|settlement`,
      fate: world.meta.fate
    },
    pack: world.pack,
    factions: [{
      id: startFaction.id,
      goal: `Establish ${startFaction.type} presence`,
      pressure: 5,
      assets: [],
      hostility: 5,
      lastMove: ''
    }],
    threads,
    ecology: { corruption: 0, scarcity: 0, instability: 0 },
    clocks: { dread: 0, pressure: 0, revelation: 0 },
    party: [],
    scars: [],
    timeline: []
  });
}

function applyPerturbations(state, tick, pack, rng) {
  let w = state;
  const factionPool = Array.isArray(pack.factionPool) ? pack.factionPool : [];
  const objectives = Array.isArray(pack.objectives) ? pack.objectives : [];

  // 30% chance: add a new faction if < 3 present
  if (rng.nextFloat() < 0.30 && w.factions.length < 3 && factionPool.length > 1) {
    const existing = new Set(w.factions.map(f => f.id));
    const candidates = factionPool.filter(f => !existing.has(f.id));
    if (candidates.length) {
      const newFac = rng.pick(candidates);
      w = {
        ...w,
        factions: [...w.factions, {
          id: newFac.id,
          goal: `Establish ${newFac.type} presence`,
          pressure: rng.int(5, 15),
          assets: [],
          hostility: rng.int(5, 20),
          lastMove: ''
        }]
      };
    }
  }

  // 20% chance: reduce a faction's hostility (peace period)
  if (rng.nextFloat() < 0.20 && w.factions.length > 0) {
    const idx = rng.int(0, w.factions.length - 1);
    const reduction = rng.int(10, 30);
    w = {
      ...w,
      factions: w.factions.map((f, i) =>
        i === idx ? { ...f, hostility: Math.max(0, f.hostility - reduction) } : f
      )
    };
  }

  // 25% chance: reduce ecology corruption/scarcity (recovery)
  if (rng.nextFloat() < 0.25) {
    const reduction = rng.int(5, 15);
    w = {
      ...w,
      ecology: {
        corruption: Math.max(0, w.ecology.corruption - reduction),
        scarcity: Math.max(0, w.ecology.scarcity - reduction),
        instability: w.ecology.instability
      }
    };
  }

  // 15% chance: introduce a thread from pack objectives
  if (rng.nextFloat() < 0.15 && objectives.length > 0 && w.threads.length < 4) {
    const obj = objectives[rng.int(0, objectives.length - 1)];
    const fac = w.factions.length ? rng.pick(w.factions) : null;
    w = {
      ...w,
      threads: [...w.threads, {
        id: `perturb_thread_${tick}`,
        objective: String(obj).replace(/\s*\(\d+\)\s*$/, ''),
        tension: rng.int(1, 3),
        trajectory: 'static',
        factionId: fac ? fac.id : '',
        active: true,
        age: 0
      }]
    };
  }

  return w;
}

export function runSettlementHistory(node, world, pack) {
  const baseSeed = seedFromString(`${node.id}|${world.meta.seed}|settlement`);
  const rng = makeRng(baseSeed);

  const tags = Array.isArray(node.tags) ? node.tags : [];
  const tickCount = tickCountFromTags(tags, rng);

  let state = buildFoundingState(node, world, pack, rng);
  const allEvents = [];

  for (let era = 0; era < tickCount; era++) {
    const preTick = state;
    const tickSeed = `${node.id}|${world.meta.seed}|settlement|era${era}`;
    state = worldTick(state, tickSeed);

    const events = detectEvents(preTick, state, era);
    allEvents.push(...events);

    // Perturbations between ticks to prevent monotonic escalation
    if (era < tickCount - 1) {
      state = applyPerturbations(state, era, pack, rng);
    }
  }

  return {
    finalState: state,
    history: allEvents,
    tickCount,
    tags
  };
}
