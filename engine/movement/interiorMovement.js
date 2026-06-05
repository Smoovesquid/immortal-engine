/**
 * Interior movement — room-granular reachability for click-to-move (XCom-style).
 *
 * A structure interior is an undirected room graph (topology.js). Movement is
 * room-to-room through doorways, never tile-by-tile, so it stays legible on the
 * hand-drawn map. This module is the pure graph layer the UI and the stealth
 * resolver sit on top of.
 *
 * PURE + DETERMINISTIC (BFS over the sorted adjacency from topology.js).
 */

import { adjacentRooms, normalizeTopology } from '../structures/topology.js';

// roomAdjacency(topology) -> Map<roomId, neighborId[]>
export function roomAdjacency(topology) {
  const t = normalizeTopology(topology);
  const adj = new Map();
  if (!t) return adj;
  for (const r of t.rooms) adj.set(r.id, adjacentRooms(t, r.id));
  return adj;
}

// reachableRooms(topology, startId) -> { dist: Map<id,steps>, parent: Map<id,id|null> }
// BFS from the start room. Distance 1 == adjacent (a "careful step"); >=2 is a
// "bold dash" path. parent lets you reconstruct the route for the ambush check.
export function reachableRooms(topology, startId) {
  const t = normalizeTopology(topology);
  const start = String(startId ?? '');
  const dist = new Map();
  const parent = new Map();
  if (!t || !t.rooms.some(r => r.id === start)) return { dist, parent };

  dist.set(start, 0);
  parent.set(start, null);
  const queue = [start];
  while (queue.length) {
    const u = queue.shift();
    for (const v of adjacentRooms(t, u)) {
      if (!dist.has(v)) {
        dist.set(v, dist.get(u) + 1);
        parent.set(v, u);
        queue.push(v);
      }
    }
  }
  return { dist, parent };
}

// pathBetween(topology, startId, goalId) -> [startId, ..., goalId] (empty if unreachable)
export function pathBetween(topology, startId, goalId) {
  const { dist, parent } = reachableRooms(topology, startId);
  const goal = String(goalId ?? '');
  if (!dist.has(goal)) return [];
  const path = [];
  let c = goal;
  while (c != null) { path.push(c); c = parent.get(c); }
  return path.reverse();
}
