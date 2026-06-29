// THE SHIPPABLE SLICE — the authored four-place region (SL-1).
//
// Scope-locked 2026-06-29 (docs/DEMO_REGION.md banner, docs/PACKETS.md SL-1):
// the demo is cut to ONE walkable ~100 km² region with exactly four hand-placed
// places — a town, a forest (bandits roam), a bandit camp, and a haunted chapel
// a couple km from town. Unlike the 'tallow' demo (a fixed seed run through the
// PROCEDURAL generator + authored overlays, locked by tests/U246), this region is
// AUTHORED directly: fixed nodes, fixed edges, fixed integer tile positions, so
// distances are exact ("a couple km from town") and replay is trivially stable.
//
// This rides ALONGSIDE 'tallow' (Tim's 2026-06-29 call): tallow + the 5 figures +
// the orb climax stay intact as the campaign sandbox; the slice is its own seed and
// touches nothing the procedural path or the determinism gates (U19/21/22/27/30)
// depend on. §0 holds — the cosmology is never surfaced; the only thread that
// survives here is the symptom that makes the chapel haunted (DEMO_REGION §3:
// "the recently dead don't always stay dead"), never explained.

import { seedFromString } from '../rng.js';
import { assertMapStructure } from '../map/mapState.js';

// The slice's own fixed seed (sibling of DEMO_SEED='tallow'). v1 opts in by
// invoking with this seed; every other seed is untouched.
export const SLICE_SEED = 'aldermere';

// Authored layout. Names are provisional/evocative — easy to re-skin later.
// nodeType is set EXPLICITLY (we author, so we don't rely on classifyNodeType):
//   settlement       — town + bandit camp (camp gets a hostile pass in SL-4)
//   wilderness       — the forest (bandit encounters bind here in SL-4)
//   dungeon_entrance — the chapel surface; its interior is built in SL-3
// Positions are on the same integer tile grid the overworld uses. Town at origin;
// the woods sit between town and chapel; the camp branches off the woods. The
// chapel is deliberately farther from town than the forest is ("a couple km out").
// SL-4 tags drive the travel-encounter system (engine/playloop.js brigandNodeKind):
//   'bandits'    — bandit country: traveling this node has a CHANCE of a brigand standoff.
//   'banditCamp' — a bandit stronghold: arriving ALWAYS confronts the captain + crew.
const LAYOUT = [
  { key: 'town',   name: 'Aldermere',            nodeType: 'settlement',       tags: ['village'],                   x: 0, y: 0 },
  { key: 'forest', name: 'The Greenwood',        nodeType: 'wilderness',       tags: ['forest', 'bandits'],         x: 2, y: 0 },
  { key: 'camp',   name: 'Crowfoot Camp',        nodeType: 'settlement',       tags: ['hamlet', 'camp', 'banditCamp'], x: 3, y: 2 },
  { key: 'chapel', name: 'The Hollowed Chapel',  nodeType: 'dungeon_entrance', tags: ['haunted'],                   x: 4, y: 0 },
];

// Edges keep the woods as the gateway: town → forest → chapel, with the camp
// branching off the forest. A small tree — fully reachable from the start town.
const EDGE_KEYS = [
  { a: 'town',   b: 'forest', kind: 'road' },
  { a: 'forest', b: 'chapel', kind: 'path' },
  { a: 'forest', b: 'camp',   kind: 'path' },
];

// The guarantees the slice must keep (asserted by tests/U299). Exact, not minimums:
// the whole point of the scope-lock is that this stays four places, not five-plus.
export const SLICE_REGION_SPEC = {
  settlements: 2,        // town + camp
  wilderness: 1,         // the forest
  dungeonEntrances: 1,   // the chapel
  totalNodes: 4,
  fullyReachable: true,
};

// Stable, format-matching node id (mirrors generateInitialMap's scheme so any
// downstream code that parses `n{i}_{hash}` ids behaves identically).
function nodeId(seed, packId, i, name) {
  return `n${i}_${seedFromString(`${seed}|${packId}|${name}`)}`;
}

/**
 * buildSliceRegion({ seed, packId }) → map (generateInitialMap's return shape).
 * Pure + deterministic: same inputs → identical region, every time.
 */
export function buildSliceRegion({ seed = SLICE_SEED, packId = 'fantasy' } = {}) {
  const idByKey = new Map();
  const nodes = LAYOUT.map((spec, i) => {
    const id = nodeId(seed, packId, i, spec.name);
    idByKey.set(spec.key, id);
    return {
      id,
      name: spec.name,
      nodeType: spec.nodeType,
      tags: spec.tags.slice(),
      motifs: [],
      scars: [],
      x: spec.x,
      y: spec.y,
    };
  });

  const edges = EDGE_KEYS.map(e => ({
    a: idByKey.get(e.a),
    b: idByKey.get(e.b),
    kind: e.kind,
  }));

  const startNodeId = idByKey.get('town');

  const map = {
    nodes,
    edges,
    discovered: [startNodeId],
    currentNodeId: startNodeId,
  };

  assertMapStructure(map);
  return map;
}
