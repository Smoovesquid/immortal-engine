import crypto from 'node:crypto';
import { ensureWorld } from './state.js';
import { stableStringify } from './log.js';
import { projectPartyForHash } from './crunchHashProjection.js';

// Canon-identity projection: exclude UI-only fields; include all deterministic state + timeline.
function projectForHash(world) {
  const w = ensureWorld(world);

  return {
    meta: w.meta,
    ruleset: w.ruleset,
    pack: w.pack,
    // Pass T1: sort non-load-bearing party arrays (foci, items, known spells)
    // so trivial reorderings don't break replay hash equality.
    party: projectPartyForHash(w.party),
    deeds: w.deeds,
    map: w.map,
    env: w.env,
    scene: w.scene,
    time: w.time,
    ledger: w.ledger,
    instrument: w.instrument,
    ending: w.ending,
    clocks: w.clocks,
    combat: w.combat,

    factions: w.factions,
    threads: w.threads,
    scars: w.scars,
    ecology: w.ecology,
    reputation: w.reputation,
    structures: w.structures,

    canonLog: w.canonLog,
    // Pass R1: project rumors for hash — exclude body (immutable prose).
    rumors: (w.rumors || []).map(r => ({ id: r.id, tier: r.tier, age: r.age })),
    goals: w.goals,
    story: w.story,
    recentBeats: w.recentBeats,
    timeline: w.timeline
  };
}

export function worldHash(world) {
  const projected = projectForHash(world);
  const s = stableStringify(projected);
  return crypto.createHash('sha256').update(s).digest('hex');
}
