import { ensureWorld } from '../state.js';
import { ensureMap } from '../map/mapState.js';
import { applyDeltas } from '../effectsCore.js';
import { adjacentRooms, normalizeTopology, interiorExitsFrom } from './topology.js';
import { reachableRooms } from '../movement/interiorMovement.js';
import { doorThresholdCells } from '../map/spatial/tacticalPos.js';
import { doorBetween, exteriorDoorOf, crossable, needsForcing } from './doors.js';

function sortedStructuresAtNode(world) {
  const w = ensureWorld(world);
  const nodeId = String(w.map?.currentNodeId || '');
  const byId = w.structures?.byId || {};
  return Object.values(byId)
    .filter(s => String(s?.nodeId || '') === nodeId)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function parseSelectionIndex(ref) {
  const s = String(ref || '').trim();
  if (!s) return null;
  const m = s.match(/^#?(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function resolveStructureForEnter(world, structureRef = '') {
  const all = sortedStructuresAtNode(world);
  if (!all.length) return { structure: null, reason: 'none-available' };

  const rawRef = String(structureRef || '').trim();
  const ref = rawRef.toLowerCase();
  if (!ref) return { structure: all[0], reason: 'matched' };

  const idx = parseSelectionIndex(rawRef);
  if (idx !== null) {
    const s = all[idx - 1] || null;
    return s ? { structure: s, reason: 'matched' } : { structure: null, reason: 'index-out-of-range' };
  }

  const s = all.find(x => String(x.id).toLowerCase() === ref || String(x.kind).toLowerCase() === ref) || all[0];
  return { structure: s, reason: 'matched' };
}

function structureTopology(structure) {
  const sid = String(structure?.id || 'structure');
  return normalizeTopology(structure?.topology) || {
    kind: 'rooms',
    rooms: [{ id: `room:${sid}:entry`, tags: ['entry'] }],
    edges: []
  };
}

export function resolveStructureSelection(world, structureRef = '') {
  return resolveStructureForEnter(world, structureRef);
}

// Keep party[0].position.interior in sync with scene.interior. ensureWorld
// (state.js) re-derives scene.interior FROM position.interior whenever
// scene.interior is absent — so if the two ever disagree, the next ensureWorld()
// snaps the player back inside. Enter sets it; exit clears it. (This was the
// "go outside does nothing" bug: exit cleared scene.interior but not position.)
function setPartyInterior(party, structureId, roomId) {
  const arr = Array.isArray(party) ? party : [];
  return arr.map(p => ({
    ...p,
    position: { ...(p && p.position ? p.position : {}), interior: { structureId: String(structureId), roomId: String(roomId) } }
  }));
}
function clearPartyInterior(party) {
  const arr = Array.isArray(party) ? party : [];
  return arr.map(p => {
    const pos = { ...(p && p.position ? p.position : {}) };
    delete pos.interior;
    return { ...p, position: pos };
  });
}

export function enterStructureInterior(world, structureRef = '') {
  const w = ensureWorld(world);
  const sel = resolveStructureForEnter(w, structureRef);
  const st = sel.structure;
  if (!st) return w;

  const topo = structureTopology(st);
  const firstRoomId = String(topo.rooms[0]?.id || '');
  if (!firstRoomId) return w;

  // Wrap in ensureWorld so the rewritten party positions are canonicalized
  // (key order, field shape) identically to an export/import round-trip —
  // otherwise worldHash diverges under replay (U21).
  return ensureWorld({
    ...w,
    party: setPartyInterior(w.party, st.id, firstRoomId),
    map: {
      ...ensureMap(w.map),
      currentStructureId: String(st.id),
      currentRoomId: firstRoomId
    },
    scene: {
      ...w.scene,
      interior: {
        structureKey: String(st.id),
        roomId: firstRoomId,
        visited: [firstRoomId]
      }
    }
  });
}

export function exitStructureInterior(world) {
  const w = ensureWorld(world);
  if (!w.scene?.interior) return w;

  // OBJ-HOLD-6A — the carry-lock's STRUCTURAL backstop: carry is structure-local, so
  // egress with a held environmental object refuses as a no-op at this one seam. The
  // narrating call sites (door exit, window exit, the interior travel bridges) all
  // consult heldObjectOf FIRST and refuse in fiction; this guard guarantees that any
  // future caller that forgets cannot leak a held object outside — the world simply
  // does not change (no branch may narrate success after it).
  {
    const partyKey = String(w.party?.[0]?.id || 'party');
    const objs = (w.objects && typeof w.objects === 'object') ? w.objects : {};
    for (const oid of Object.keys(objs)) {
      if (String(objs[oid]?.heldByActorId ?? '') === partyKey) return w;
    }
  }

  // MR-1a — EGRESS WRITES THE DOORSTEP (docs/POSITION_AS_CANON.md §2/§3).
  // Compute where the body should land BEFORE clearing the interior: the region
  // cell just outside the door of the structure being left. The entry room is the
  // door the player came in by (scene.interior.visited[0] = the room enter dropped
  // them in); doorThresholdCells prefers it, else the structure's entry room.
  // Without this, exit clears the interior, then ensureWorld's backfill sees a
  // struct pos with no interior (stale), re-seeds it via placeNearNode's ±50-cell
  // jitter — the 247-ft teleport the fiction never narrated. We WRITE the doorstep
  // through applyDeltas ({op:'pos'} — the sole mutation path) so backfill finds a
  // CONSISTENT region pos and leaves it untouched.
  const exitedKey = String(w.scene.interior.structureKey || '');
  const entryDoorRoom = Array.isArray(w.scene.interior.visited) ? w.scene.interior.visited[0] : null;
  const threshold = exitedKey ? doorThresholdCells(w, exitedKey, entryDoorRoom) : null;

  // MR-2a — NEVER SOFT-LOCK ON THE WAY OUT (docs/briefs/MR-2-FUNCTIONAL-INK.md
  // §MR-2a; THE DM TEST). A locked/barred FRONT door keeps people OUT, not in — from
  // inside you lift the bar / turn the latch and leave. Unbarring is PART of the exit
  // action, so open the exterior door here (canon `door` op — no roll, no witness
  // fact: it's your own door and you're leaving through it) BEFORE clearing the
  // interior. Guarantees the no-soft-lock property (U506): a room you could enter is
  // always a room you can leave.
  let wExit = w;
  const exitedSt = exitedKey ? w.structures?.byId?.[exitedKey] : null;
  const frontDoor = exitedSt ? exteriorDoorOf(exitedSt) : null;
  if (frontDoor && needsForcing(frontDoor.state)) {
    wExit = applyDeltas(w, [{ op: 'door', structId: exitedKey, doorId: frontDoor.id, to: 'open', how: 'opened' }]);
  }

  // Wrap in ensureWorld so cleared positions canonicalize identically to an
  // export/import round-trip (worldHash replay stability — U21).
  const cleared = ensureWorld({
    ...wExit,
    party: clearPartyInterior(w.party),
    map: {
      ...ensureMap(w.map),
      currentStructureId: '',
      currentRoomId: ''
    },
    scene: {
      ...w.scene,
      interior: null
    }
  });

  // Commit the doorstep pos. applyDeltas re-ensures at its head (backfill runs, then
  // the pos op overwrites with the doorstep — no re-ensure after, so the doorstep
  // stands). If the threshold couldn't be grounded (unusual structure/plan/node),
  // fall through to `cleared` and keep the existing seeded-placement behaviour.
  if (threshold && threshold.outside) {
    return applyDeltas(cleared, [{ op: 'pos', id: 'party', to: threshold.outside }]);
  }
  return cleared;
}

// MR-2a — the door-state a room-to-room move must clear (docs/briefs/
// MR-2-FUNCTIONAL-INK.md §MR-2a). A pure read the playloop consults BEFORE it calls
// moveWithinInterior, so it can narrate/resolve the door honestly (THE DM TEST):
//   { state, crossable, needsForcing, door } for the door between the current room
//   and `toRoomId`, or null when there is no such door (no adjacency / no record).
// crossable → walk straight through (open). needsForcing → barred/locked, real play.
// Otherwise (shut) the move opens it first as a narrated part of the move.
export function interiorDoorBlock(world, toRoomId) {
  const w = ensureWorld(world);
  const interior = w.scene?.interior;
  if (!interior || typeof interior !== 'object') return null;
  const structureKey = String(interior.structureKey || '');
  const fromRoomId = String(interior.roomId || '');
  const targetRoomId = String(toRoomId || '').trim();
  if (!structureKey || !fromRoomId || !targetRoomId) return null;
  const st = w.structures?.byId?.[structureKey];
  if (!st) return null;
  const door = doorBetween(st, fromRoomId, targetRoomId);
  if (!door) return null; // no door record between these rooms (legacy / non-adjacent)
  return {
    state: door.state,
    crossable: crossable(door.state),
    needsForcing: needsForcing(door.state),
    door,
  };
}

export function moveWithinInterior(world, toRoomId) {
  const w = ensureWorld(world);
  const interior = w.scene?.interior;
  if (!interior || typeof interior !== 'object') return w;

  const structureKey = String(interior.structureKey || '');
  const fromRoomId = String(interior.roomId || '');
  const targetRoomId = String(toRoomId || '').trim();
  if (!structureKey || !fromRoomId || !targetRoomId) return w;

  const st = w.structures?.byId?.[structureKey];
  if (!st) return w;

  const exits = adjacentRooms(structureTopology(st), fromRoomId);
  if (!exits.includes(targetRoomId)) return w;

  // MR-2a — walls block; doors gate. A barred/locked door between here and the
  // target REFUSES the move at this structural seam (moveWithinInterior is the
  // "can this move happen" gate — a no-op return, exactly like a non-adjacent
  // room). The playloop consults interiorDoorBlock FIRST and routes barred/locked
  // through the force/pick roll (resolve.js); it only reaches here to actually
  // cross once the door is open. A SHUT door is opened as part of the move (a canon
  // `door` op — narrated by the caller), so from here it reads as open. `open`
  // passes straight through. No record (legacy structure) → move freely (backward
  // compatible with pre-v31 saves whose doors[] the tail hasn't authored).
  let wMove = w;
  const door = doorBetween(st, fromRoomId, targetRoomId);
  if (door) {
    if (needsForcing(door.state)) return w; // barred/locked — refuse (playloop resolves the roll)
    if (String(door.state) === 'shut') {
      // Open it as part of the move — the sole mutation path (the `door` op).
      wMove = applyDeltas(w, [{ op: 'door', structId: structureKey, doorId: door.id, to: 'open', how: 'opened' }]);
    }
  }

  const iv = wMove.scene?.interior;
  const visited = Array.isArray(iv?.visited) ? iv.visited.slice()
    : (Array.isArray(interior.visited) ? interior.visited.slice() : []);
  if (!visited.includes(targetRoomId)) visited.push(targetRoomId);

  const next = ensureWorld({
    ...wMove,
    map: {
      ...ensureMap(w.map),
      currentStructureId: structureKey,
      currentRoomId: targetRoomId
    },
    scene: {
      ...w.scene,
      interior: {
        structureKey,
        roomId: targetRoomId,
        visited
      }
    }
  });

  const actorId = String(next.party?.[0]?.id || '');
  return actorId
    ? applyDeltas(next, [{ op: 'position', entityId: actorId, set: { interior: { structureId: structureKey, roomId: targetRoomId } } }])
    : next;
}

// interiorDirectionalExits(world) -> { north, east, south, west } room id or null
// for the room the player currently stands in. Built from the reciprocal interior
// compass so "south" only resolves when a south doorway genuinely exists.
export function interiorDirectionalExits(world) {
  const w = ensureWorld(world);
  const interior = (w.scene && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  if (!interior) return { north: null, east: null, south: null, west: null };
  const st = w.structures?.byId?.[String(interior.structureKey || '')];
  if (!st) return { north: null, east: null, south: null, west: null };
  return interiorExitsFrom(structureTopology(st), String(interior.roomId || ''));
}

export function getInteriorView(world) {
  const w = ensureWorld(world);
  const interior = (w.scene && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;

  if (!interior) {
    return {
      active: false,
      structures: sortedStructuresAtNode(w).map((s, i) => ({ id: s.id, kind: s.kind, index: i + 1 }))
    };
  }

  const structureKey = String(interior.structureKey || '');
  const roomId = String(interior.roomId || '');
  const st = w.structures?.byId?.[structureKey];
  if (!st) return { active: false, structures: [] };

  const topo = structureTopology(st);
  // Tag each doorway with the compass direction it leaves by, so the player-facing
  // "Exits: north, east" matches the direction that actually moves you there.
  const dirByRoom = interiorExitsFrom(topo, roomId);
  const ORDER = ['north', 'east', 'south', 'west'];
  const exits = adjacentRooms(topo, roomId)
    .map(id => ({ id, dir: ORDER.find(d => dirByRoom[d] === id) || '' }))
    .sort((a, b) => {
      const ai = a.dir ? ORDER.indexOf(a.dir) : 99;
      const bi = b.dir ? ORDER.indexOf(b.dir) : 99;
      return ai - bi || a.id.localeCompare(b.id);
    });

  return {
    active: true,
    structureKey,
    roomId,
    exits,
    surfaces: []
  };
}

// describeInteriorLayout(world) -> { buildingType, roomCount, atEntry, doorways[] } | null
// An ENGINE-OWNED, compact description of the interior the player stands in, for the DM
// prompt. The live narrator had been inventing navigable geography the topology lacks —
// a staircase, an upper floor, extra rooms — so the player navigated a fiction the engine
// couldn't honor and soft-locked (WB-Q1). Feeding the REAL room graph (count, single
// storey, the doorways out of THIS room) lets the prompt constrain narration to it. Pure
// read; never mutates; returns null when not inside a known structure.
export function describeInteriorLayout(world) {
  const w = ensureWorld(world);
  const interior = (w.scene && typeof w.scene.interior === 'object' && w.scene.interior) ? w.scene.interior : null;
  if (!interior) return null;
  const st = w.structures?.byId?.[String(interior.structureKey || '')];
  const topo = normalizeTopology(st?.topology);
  if (!topo || !topo.rooms.length) return null;
  const roomId = String(interior.roomId || '');
  const adj = adjacentRooms(topo, roomId);
  const entryRoom = topo.rooms.find(r => (Array.isArray(r.tags) ? r.tags : []).some(t => String(t).toLowerCase() === 'entry'));
  const entryId = String(entryRoom?.id || topo.rooms[0]?.id || '');
  const { dist } = reachableRooms(topo, entryId);
  const here = dist.get(roomId);
  const doorways = [];
  if (adj.some(id => (dist.get(id) ?? Infinity) < (here ?? Infinity))) doorways.push('a doorway back toward the front');
  if (adj.some(id => (dist.get(id) ?? -Infinity) > (here ?? -Infinity))) doorways.push('a doorway leading deeper in');
  // Fallback when the entry-relative split is ambiguous (e.g. a non-linear plan).
  if (!doorways.length && adj.length) {
    doorways.push(adj.length === 1 ? 'a doorway to the adjoining room' : `${adj.length} doorways to adjoining rooms`);
  }
  return {
    buildingType: String(st?.buildingType || 'building'),
    roomCount: topo.rooms.length,
    atEntry: here === 0,
    doorways,
  };
}
