// Room Windows — a deterministic, derived room feature. A window is NOT stored
// world state: it is a PURE function of (seed + structureKey + roomId + the room's
// daylight), exactly like the interior doorways and container contents are derived.
// That keeps worldHash stable — no new field, no WORLD_VERSION bump, no invariant.
//
// Which rooms have windows: ABOVE-GROUND / exterior-facing rooms — i.e. rooms that
// get daylight. roomDetail() already marks the windowless ones with `dark` (cellars,
// crypts, caves, pantries, vaults, dungeon chambers). dark → no windows; lit → 1-2.
// The entry room is always lit (daylight spills in), so it faces outside too.

import { seedFromString, makeRng } from '../rng.js';
import { normalizeTopology } from './topology.js';
import { roomDetail } from './roomDetail.js';

const EMPTY = Object.freeze({ count: 0, shuttered: false, outlook: '' });

// What the window looks onto — derived, never a place-name (line of sight is
// honored at look-out time; this is just the near framing for the survey).
const OUTLOOKS = ['onto the road', 'onto the yard', 'onto the street below', 'onto the open ground beyond'];

/**
 * roomWindows(world, interior) -> { count, shuttered, outlook }
 * count 0 = no windows (cellar / windowless interior room / no topology).
 * Pure and deterministic: same seed + structure + room = same windows.
 */
export function roomWindows(world, interior) {
  if (!interior || typeof interior !== 'object' || !interior.structureKey) return EMPTY;
  const st = world?.structures?.byId?.[String(interior.structureKey)];
  const topo = normalizeTopology(st?.topology);
  // No topology (e.g. a generated dungeon, which is underground anyway) → no windows.
  if (!topo || !Array.isArray(topo.rooms)) return EMPTY;
  const roomId = String(interior.roomId || '');
  const room = topo.rooms.find(r => String(r.id) === roomId);
  if (!room) return EMPTY;

  const detail = roomDetail(room, st?.buildingType || null);
  if (detail.dark) return EMPTY; // below-ground / windowless service room

  const rng = makeRng(seedFromString(`${world?.meta?.seed ?? ''}|${interior.structureKey}|${roomId}|windows`));
  const count = 1 + rng.int(0, 1); // 1-2 windows
  let shuttered = rng.nextFloat() < 0.5; // seed-derived default
  const outlook = rng.pick(OUTLOOKS) || OUTLOOKS[0];
  // A player can close/open the shutters; that is canon (a 'window-shutter' timeline event),
  // so the CURRENT state is the derived default unless a LATER toggle overrode it. Reading it
  // from the timeline keeps this a pure, replayable function of the world — no stored field, no
  // WORLD_VERSION bump, worldHash stays stable (events are already hashed). Latest toggle wins.
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  for (let i = tl.length - 1; i >= 0; i--) {
    const d = tl[i] && tl[i].data ? tl[i].data : null;
    if (d && d.updateKind === 'window-shutter'
        && String(d.structureKey) === String(interior.structureKey)
        && String(d.roomId) === roomId) {
      shuttered = Boolean(d.closed);
      break;
    }
  }
  return { count, shuttered, outlook };
}

const FACINGS = ['north', 'east', 'south', 'west'];

/**
 * roomWindowFacings(world, interior) -> string[]
 * A compass facing for each window in the room (distinct, deterministic) — so climbing out names a
 * real side ("the east window") and >1 window can ask "which?". Derived (seeded), no stored state.
 * Returns [] when there are no windows.
 */
export function roomWindowFacings(world, interior) {
  const win = roomWindows(world, interior);
  if (!win.count) return [];
  const rng = makeRng(seedFromString(`${world?.meta?.seed ?? ''}|${interior?.structureKey ?? ''}|${interior?.roomId ?? ''}|facings`));
  const pool = [...FACINGS];
  const out = [];
  for (let i = 0; i < win.count && pool.length; i++) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  return out;
}

/**
 * windowSurveyPhrase(win) -> string  — the noun phrase "look around" lists.
 *   "a shuttered window" / "a window looking onto the road" / "two windows ..."
 * Returns '' when there are no windows.
 */
export function windowSurveyPhrase(win) {
  if (!win || !win.count) return '';
  if (win.count === 1) {
    return win.shuttered ? 'a shuttered window' : `a window looking ${win.outlook}`;
  }
  return win.shuttered ? 'two shuttered windows' : `two windows looking ${win.outlook}`;
}
