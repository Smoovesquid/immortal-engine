# Spatial Exploration Victory Gates

Purpose:
Define the deterministic spatial exploration architecture of the engine.

Principles:
- Map layers are projection-only.
- Spatial generation must be deterministic.
- Interiors generate lazily on entry.
- Canon state never mutates from rendering.
- Exploration reveals information, it does not create it.

--------------------------------------------------

Gate S1 — Node Spatial Identity

Objective
Every world node generates a deterministic spatial profile.

Acceptance Criteria
- Node type defined (village, ruin, shrine, dungeon, etc).
- Node seed derived from world seed + node id.
- Spatial profile object created.

Example

nodeSpatial = {
  nodeId,
  type,
  seed,
  sizeTier,
  factionPresence
}

Invariant
Same world seed → identical node spatial profiles.

Non-Goals
No rendering yet.

--------------------------------------------------

Gate S2 — Settlement Road Graph

Objective
Generate deterministic road graphs for settlements.

Acceptance Criteria
- Central road produced.
- Secondary roads branch from primary.
- Optional outer loop road.
- Graph stored in projection layer only.

Example

roads = [
  {type: "primary", angle: 0},
  {type: "secondary", angle: 120},
  {type: "secondary", angle: 240}
]

Invariant
Road layout reproducible from seed.

--------------------------------------------------

Gate S3 — Building Plot Generation

Objective
Derive building plots from road graph.

Acceptance Criteria
- Buildings attach to road edges.
- Plot spacing deterministic.
- Building types assigned.

Example

building = {
  type: "house",
  roadIndex,
  offset
}

Invariant
Plot positions deterministic.

--------------------------------------------------

Gate S4 — Structure Projection Rendering

Objective
Display buildings and roads on the local map.

Acceptance Criteria
- Roads render as deterministic vectors.
- Buildings render as plot markers.
- Rendering never mutates engine state.

Invariant
Renderer receives projection only.

--------------------------------------------------

Gate S5 — Structure Identity

Objective
Structures become addressable locations.

Acceptance Criteria
Each structure has:

structure = {
  id,
  type,
  nodeId,
  seed
}

Invariant
Structure ids deterministic.

--------------------------------------------------

Gate S6 — Enterable Structures

Objective
Player can enter structures.

Acceptance Criteria
Entering structure triggers interior generation.

Example flow

enter structure
 → generateInterior(structure.seed)
 → load tactical map

Invariant
Interiors generated lazily.

--------------------------------------------------

Gate S7 — Interior Map Generation

Objective
Create deterministic interior layouts.

Acceptance Criteria
Interior types supported:

house
tavern
temple
tower
dungeon
shop

Each interior produces a tactical grid.

Invariant
Interior map reproducible from seed.

--------------------------------------------------

Gate S8 — Tactical Interaction Layer

Objective
Interior maps support interaction.

Acceptance Criteria
- Obstacles deterministic.
- Entry/exit points defined.
- Movement grid valid.

Invariant
Tactical maps remain projection layers.

--------------------------------------------------

Gate S9 — Landmark Nodes

Objective
Major landmarks generate unique spatial structures.

Examples

ruin
fortress
ancient shrine
wizard tower

Acceptance Criteria
Each landmark uses unique structure grammar.

Invariant
Landmarks deterministic per node.

--------------------------------------------------

Gate S10 — Dungeon Generation

Objective
Dungeon interiors generate procedural labyrinths.

Acceptance Criteria
Dungeon generator produces:

rooms
corridors
branch loops
boss chamber

Invariant
Dungeon layout deterministic.

--------------------------------------------------

Gate S11 — Faction Spatial Influence

Objective
Faction pressure affects settlement layout.

Acceptance Criteria
- Military factions add walls and towers.
- Religious factions add temples.
- Trade factions add markets.

Invariant
Faction presence modifies projection only.

--------------------------------------------------

Gate S12 — Spatial Discovery Memory

Objective
Player remembers discovered locations.

Acceptance Criteria
Discovery records store:

nodeId
structureId
lastVisitedTurn

Invariant
Discovery logs deterministic.

--------------------------------------------------

End State

Player experience:

travel region
 → enter node
 → explore structures
 → enter interiors
 → engage tactical space

World becomes navigable narrative geography.

