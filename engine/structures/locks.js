// Locks — a door or window may be locked. Like roomWindows/occupancy, this is DERIVED state: a pure
// function of (seed) plus canon lock events on the timeline. No stored field, no WORLD_VERSION bump,
// worldHash stays stable. The lockpick mechanic itself (a D&D-style check) lives at the verb sites in
// playloop; this module only answers "is this locked, and how hard (DC)?".
//
// WINDOWS latch by default (a minority are latched from inside) — so climbing IN often needs a pick
// or a force. DOORS are NOT auto-locked (every generated building is an ordinary dwelling, and
// auto-locking them all would gate routine entry everywhere) — but a door CAN be locked deliberately
// by a 'lock-close' event (a quest, a wary householder, content). Either way, the latest lock event
// wins: 'lock-open' (picked/forced) unlocks; 'lock-close' locks.

import { seedFromString, makeRng } from '../rng.js';

const LOCKED_SHARE = { door: 0, window: 0.4 };

/**
 * lockState(world, kind, key) -> { locked, dc }
 *   kind: 'door' | 'window'
 *   key:  the structureKey (door) or `${structureKey}:${roomId}` (window)
 * Deterministic; the most recent lock-open / lock-close event for this (kind,key) wins.
 */
export function lockState(world, kind, key) {
  const seed = world?.meta?.seed ?? '';
  const k = String(kind);
  const id = String(key);
  const rng = makeRng(seedFromString(`${seed}|${k}|${id}|lock`));
  let locked = rng.nextFloat() < (LOCKED_SHARE[k] ?? 0); // derived default
  const dc = 12 + rng.int(0, 4); // a workaday lock: DC 12–16
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const d = tl[i] && tl[i].data ? tl[i].data : null;
    if (!d || String(d.lockKind) !== k || String(d.lockKey) !== id) continue;
    if (d.updateKind === 'lock-open') { locked = false; break; }
    if (d.updateKind === 'lock-close') { locked = true; break; }
  }
  return { locked, dc };
}

/** lockOpenEventData(kind, key, how) — canon payload marking a lock OPENED (picked / forced). */
export function lockOpenEventData(kind, key, how) {
  return { updateKind: 'lock-open', lockKind: String(kind), lockKey: String(key), how: String(how || 'picked') };
}

/** lockCloseEventData(kind, key) — canon payload marking a lock CLOSED (a quest / householder). */
export function lockCloseEventData(kind, key) {
  return { updateKind: 'lock-close', lockKind: String(kind), lockKey: String(key) };
}
