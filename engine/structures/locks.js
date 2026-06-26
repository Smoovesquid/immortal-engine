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
import { isNight } from '../dayNight.js';

/**
 * lockState(world, kind, key) -> { locked, dc }
 *   kind: 'door' | 'window'
 *   key:  the structureKey (door) or `${structureKey}:${roomId}` (window)
 *
 * The valley locks up at NIGHT: seen from OUTSIDE, a door or window is locked between 10pm and 6am
 * and open by day. From INSIDE the very building this lock belongs to it is ALWAYS open — a lock
 * keeps people out, not in, so you can always walk out the door or climb out a window. A deliberate
 * lock event (a wary householder bolting up, a pick) still wins at any hour. Deterministic; no
 * stored state (worldHash-stable).
 */
export function lockState(world, kind, key) {
  const seed = world?.meta?.seed ?? '';
  const k = String(kind);
  const id = String(key);
  const rng = makeRng(seedFromString(`${seed}|${k}|${id}|lock`));
  const dc = 12 + rng.int(0, 4); // a workaday lock: DC 12–16

  // Inside the building this lock belongs to → open to you. (A door key IS the structureKey; a
  // window key is `${structureKey}:${roomId}`, so it starts with the structureKey you're inside.)
  const sk = String(world?.scene?.interior?.structureKey || '');
  const insideThis = Boolean(sk) && (k === 'door' ? id === sk : id.startsWith(`${sk}:`));

  let locked = !insideThis && isNight(world); // from outside: locked after dark, open by day
  // Latest deliberate lock event wins (and overrides the time-of-day default).
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const d = tl[i] && tl[i].data ? tl[i].data : null;
    if (!d || String(d.lockKind) !== k || String(d.lockKey) !== id) continue;
    if (d.updateKind === 'lock-open') { locked = false; break; }
    if (d.updateKind === 'lock-close') { locked = !insideThis; break; } // still open to you from inside
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
