# LOCAL MAP VISUALIZATION — VICTORY LADDER

## Core Rule

Map = projection layer only.

Map must:
- never mutate world
- never emit commands
- never change worldHash
- never influence mechanics

---

# Gate A7 — Edge Infrastructure

Objective:
Render infrastructure between nodes.

Structures:
road
wall
river
bridge

Anchor:
edge

Visual rules:
road → thin line
wall → thick line
river → blue line
bridge → road marker

Acceptance Criteria:
- infrastructure derived deterministically from seed + edgeId
- stable render ordering
- projection only
- no world mutation

---

# Gate A8 — Settlement Morphology (Road Spine Generator)

Objective:
Generate believable settlement shapes.

Algorithm:
1. determine primary road vector
2. spawn secondary streets
3. place buildings along roads

Deterministic Inputs:
seed
nodeId
regionId
packId

Acceptance Criteria:
- identical seed produces identical settlement layout
- buildings align with streets
- projection only

---

# Gate A9 — Settlement Density

Objective:
Generate deterministic building counts.

hamlet: 4–8
village: 8–15
town: 20–40
city: 60–120
ruin: 3–10

Acceptance Criteria:
- density deterministic
- clusters stable across replay
- buildings projection only

---

# Gate A10 — District Generation

Objective:
Generate settlement districts.

district types:
market
residential
military
religious
industrial
ruin

Behavior:
district centers determined via deterministic hash

Acceptance Criteria:
- districts deterministic
- district tags stable across replay

---

# Gate A11 — Landmark Structures

Objective:
Render major structures.

examples:
castle
tower
cathedral
arena
port
fort
ancient_ruin

Render Priority:
landmarks
walls
roads
buildings
terrain

Acceptance Criteria:
- deterministic placement
- stable render ordering

---

# Gate A12 — Terrain Overlay

Objective:
Provide environmental context.

terrain types:
forest
cliff
marsh
fields
riverbank
hills

Deterministic Inputs:
seed
nodeId

Acceptance Criteria:
- terrain deterministic
- terrain purely visual

---

# Gate A13 — Map Hierarchy Alignment

World Map
Region Map
Local Map

world → regions
region → nodes + roads
local → structures + terrain

Acceptance Criteria:
- node position consistent across zoom levels
- roads align across projections

---

# Gate A14 — Projection Stress Test

Scenario:
200 nodes
120 buildings per node

Acceptance Criteria:
projection time < 50 ms
no worldHash change
replay identical

---

# Gate A15 — Interior Reveal Boundary

Rule:
interiors appear only after:

enter structureId

Engine Trigger:
ensureStructureTopology()

Acceptance Criteria:
interiors invisible before entry
deterministic topology after entry
