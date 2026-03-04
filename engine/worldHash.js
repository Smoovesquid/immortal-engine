import crypto from 'node:crypto';
import { ensureWorld } from './state.js';
import { stableStringify } from './log.js';

// Canon-identity projection: exclude UI-only fields; include all deterministic state + timeline.
function projectForHash(world) {
  const w = ensureWorld(world);

  return {
    meta: w.meta,
    ruleset: w.ruleset,
    pack: w.pack,
    party: w.party,
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
    timeline: w.timeline
  };
}

export function worldHash(world) {
  const projected = projectForHash(world);
  const s = stableStringify(projected);
  return crypto.createHash('sha256').update(s).digest('hex');
}
