import { ensureWorld } from './state.js';
import { stableStringify } from './log.js';

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
    goals: w.goals,
    recentBeats: w.recentBeats,
    timeline: w.timeline
  };
}

function toHex(uint8) {
  let out = '';
  for (let i = 0; i < uint8.length; i++) out += uint8[i].toString(16).padStart(2, '0');
  return out;
}

export async function worldHash(world) {
  const projected = projectForHash(world);
  const s = stableStringify(projected);

  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle?.digest) throw new Error('WebCrypto unavailable (crypto.subtle.digest).');

  const bytes = new TextEncoder().encode(s);
  const digest = await cryptoObj.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}
