# IMMORTAL ENGINE — STRUCTURES & ROOMS V1
## STRUCTURE LAYER LADDER v0.1

---

## GOVERNING PRINCIPLES

1. Determinism is absolute (same inputs → same worldHash).
2. Map is projection-only; view state never mutates canonical state.
3. “Entering” anything is a canonical event (node entry, structure entry, room entry).
4. Discovery is monotonic (seen/visited timestamps never decrease).
5. Structure topology is canonicalized (sorted, deduped, stable ids).
6. No implicit generation on read; generation happens only on explicit entry hooks.
7. Every gate must be machine-checkable via tests.

---

## SCOPE

Structures are engine-generated spatial entities anchored to:
- a node (building, dungeon, camp, landmark),
- an edge (road segment, bridge, wall segment, tunnel),
- or coordinates within a node (future; remains normalized/clamped).

Each structure may include:
- topology (rooms + adjacency edges) OR null (single-space structure),
- tags (sorted/uniq, string),
- surfaces (optional; future integration),
- discovery state (what the party has seen / entered).

This ladder explicitly supports:
- buildings, dungeons, roads, walls, bridges, tunnels, landmarks.

---

# GATE LADDER

---

## Gate S0 — Data Contracts Locked

**Objective**
Define stable canonical shapes for: structures, anchors, topology, discovery.

**Acceptance Criteria**
- `ensureStructures()` normalizes and clamps deterministically.
- `normalizeAnchor()` deterministic (node/edge/coord).
- `normalizeTopology()` deterministic (rooms/edges sorted, invalid dropped).
- `ensureStructureDiscovery()` deterministic.
- Tests exist: U44–U49 (or successors) covering normalization + determinism.

**Invariant**
Invalid input cannot introduce nondeterminism or unstable ordering.

---

## Gate S1 — Projection Generator (Pure)

**Objective**
Provide a pure generator for structures from explicit inputs (no world mutation).

**Acceptance Criteria**
- `generateStructuresForNode({seed,nodeId,engineVersion,nodeTags})` returns stable output.
- Same inputs => identical deep-equal output.
- Different nodeId => deterministic divergence.
- If no trigger => stable empty output.

**Non-Goals**
- No integration with playloop yet.
- No discovery stamping yet.

---

## Gate S2 — Canonical Storage (Global State)

**Objective**
Store structures canonically in `world.structures.byId`, stable across export/import.

**Acceptance Criteria**
- `ensureWorld()` includes `structures` in canonical hash projection (already true).
- Export/import roundtrip preserves `world.structures` exactly.
- Adding a structure is only via explicit canonical write-site(s) (see S3).

**Invariant**
No structure data is derived implicitly during hashing/serialization.

---

## Gate S3 — Entry Hooks (Node → Structures Materialize)

**Objective**
On explicit node entry, structures for that node become available canonically.

**Acceptance Criteria**
- A single deterministic entry hook is defined:
  - `onEnterNode(world, nodeId)` OR integrated into `moveToNode()`.
- The hook:
  - generates structures for the node (via S1),
  - merges into `world.structures.byId` deterministically,
  - updates structure discovery for that node (see S4),
  - does not re-add duplicates (id-based).
- Tests:
  - entering same node twice does not change worldHash the second time.
  - entering a new node adds the same structures every replay.

**Invariant**
Entry is the only canonical moment structures “appear”.

**Non-Goals**
- No room navigation yet.

---

## Gate S4 — Discovery (Seen vs Entered)

**Objective**
Track what structures are known/seen/entered at node/edge granularity.

**Acceptance Criteria**
- Structure discovery state exists in canonical world:
  - `world.structuresDiscovery` (name final; must be in `ensureWorld()` + worldHash).
- On node entry:
  - discovered structures for node are stamped in `byNodeId[nodeId]`,
  - `lastSeenTurn` is monotonic.
- On edge travel:
  - optional stamp via `byEdgeId[edgeKey(a,b)]` for edge-anchored structures.
- Tests:
  - monotonic lastSeenTurn.
  - deterministic edgeKey.
  - deterministic stable set semantics.

**Invariant**
Discovery is strictly additive + monotonic.

---

## Gate S5 — Structure Selection Surface (Player Can Choose)

**Objective**
Expose deterministic structure choices in the narrative surface without UI complexity.

**Acceptance Criteria**
- On node entry, scene surface includes a deterministic list of available structures:
  - ids + kind + tags + (optional) short label.
- Player text intents can select a structure deterministically:
  - e.g. “enter the building”, “go into the dungeon”, “take the road north”.
- Selection produces a canonical event:
  - `structureEnter { structureId }`
- Tests:
  - same seed + same transcript => same chosen structureId and same worldHash.

**Non-Goals**
- No rooms yet.
- No map visualization requirements.

---

## Gate S6 — Room Topology Navigation (Structure → Rooms)

**Objective**
Within a structure that has topology, allow deterministic room entry and adjacency enforcement.

**Acceptance Criteria**
- Canonical state tracks:
  - `world.map.currentStructureId` (or equivalent)
  - `world.map.currentRoomId` (or equivalent)
- Entering a structure sets currentRoomId deterministically:
  - first room by canonical ordering.
- Room travel must enforce adjacency using `adjacentRooms(topology, roomId)`.
- Canonical events:
  - `roomEnter { structureId, roomId }`
- Tests:
  - adjacency enforcement (no illegal moves).
  - deterministic default room selection.
  - replay stability.

**Invariant**
Room movement obeys topology; no teleporting.

---

## Gate S7 — Unified Spatial Language (Buildings/Dungeons/Roads/Walls)

**Objective**
Generalize the same mechanics to linear structures and boundary structures.

**Acceptance Criteria**
- Edge-anchored structures (roads/bridges/walls/tunnels) can be:
  - discovered on edge traversal,
  - optionally “entered” as a segment context.
- Node-anchored structures (buildings/dungeons/landmarks) can be:
  - entered + navigated (rooms optional).
- Deterministic parsing maps player intents to either:
  - node travel, structure enter, or room travel.
- Tests:
  - each structure kind has at least one deterministic path from text intent to event.

---

# CONSTRAINT BLOCK

Until Gate S6 passes, the following are forbidden:
- Map UI “room mode”
- Click-to-move inside structures
- Dynamic topology mutation
- Any generation on read (only on entry)

---

# EVOLUTION LEDGER (Template)

Version:
Change:
Reason:
Impact:

---

# EVOLUTION LEDGER (Entries)

Version: STRUCTURE LAYER v0.1
Change: Established the Structures & Rooms ladder (S0–S7) aligned to deterministic entry hooks and canonical discovery.
Reason: Provide a victory ladder for buildings/dungeons/roads/walls generated by the engine and described by the AI, without UI coupling.
Impact: Documentation only; no engine changes.
