# Building Canon Contract — v0

*Design only. Status 2026-07-08 (merged with an independent Codex draft of the same
contract — the two agreed on every settled principle; the Codex deltas are folded in).
Sibling of `docs/BUILDING_BUILDER.md` (the "what's left"
gap list) and `docs/MAP_REAL.md` (the drawn-world-is-the-real-world commission). This doc
defines the **contract**: the smallest runtime artifact the Building Builder must export and
the deterministic engine may safely consume — before any Builder UI, asset pipeline, or new
runtime code is written.*

> **A building is a compiled deterministic artifact, not a mesh.**

**Grounding, not invention.** This contract is implementation-neutral by intent, but it is
written against the repo as it exists so it names real seams and does not drift into fantasy.
Where it cites current behavior (e.g. the load-time orphan repair in
`engine/structures/authoredStructure.js`, the `house-builder/vN` export format, the
single-storey interior model in `engine/structures/roomState.js`, `STRUCTURE_SCHEMA_VERSION`),
those citations are diagnostic. It does **not** prescribe new function names, module layouts,
or field names — those belong to later implementation packets.

---

## 1. Purpose

The **Building Canon Contract** defines the boundary between three artifacts — the editable
draft a human (or AI assistant) authors, the frozen validated structure the engine consumes,
and the mutable per-play state that records what happened inside the building during a game —
and pins down which facts are *canon* (queryable truth the engine and the DM may rely on) and
which are merely *presentation* (meshes, Lincoln-Log pieces, roof caps, previews).

**The problem it solves.** Today there is authoring richness (`house-builder.html` exports
`house-builder/v7`+ with rooms, walls, tunnels, corridors, curves, furniture, secrets) and a
loader that maps that export *down* onto a simpler engine interior model — and in doing so the
loader **silently invents structure** to keep the graph connected (orphan repair). That is fine
as a tolerance for messy drafts, but it is dangerous as a runtime behavior on *finalized*
content, because it means the thing the author drew, the thing the engine simulates, and the
thing the DM narrates can quietly disagree. The contract closes that gap: it says where each
fact lives, who is allowed to change it, and that finalized canon is never repaired behind the
author's back.

**Why a building is not primarily a mesh, model, or visual object.** In Immortal Engine a
building is a **deterministic playable artifact**. It can be:

- **queried** — "how many exits does this room have?", "is the chest looted?"
- **narrated** — the DM projects a truthful room description with no invented doors
- **traversed** — the player stands outside, enters, moves room-to-room, leaves
- **fought in** — tactical positions, cover, line of sight, who can hear a kicked door
- **damaged** — walls breached, doors kicked, fires started
- **searched** — secrets discovered, chests looted
- **logged** — every change is a deterministic effect that replays identically

A mesh can do *none* of those things as truth. A GLB of a cabin cannot tell you whether the
door is barred, whether the north wall has a breach, or whether the room beyond is reachable.
Geometry is how a building *looks*; canon is what a building *is*. The renderer reads canon to
draw; the engine never reads geometry to decide.

---

## 2. Non-Negotiable Principles

These are settled. Section 18 (Open Questions) may not reopen them.

1. **Runtime never reads mesh geometry for truth.** No collision query, reachability check,
   line-of-sight test, or narration fact is ever derived from a mesh, GLB, or drawn pixel.
2. **The LLM never invents rooms, exits, stairs, doors, windows, openings, or props.** It
   narrates only what the closed-world projection (§15) contains. Absence in the projection
   means absence in the fiction.
3. **BuilderDrafts are not runtime artifacts.** The engine never loads a draft. It loads only a
   validated `RuntimeBuildingDefinition`.
4. **Only validated `RuntimeBuildingDefinition`s enter runtime.** Validation is a gate, not a
   suggestion. A definition that fails a blocking check (§13) does not load.
5. **`RuntimeBuildingInstanceState` must not mutate the original `RuntimeBuildingDefinition`.**
   The definition is frozen for the life of the play session. State layers *over* it.
6. **Mutable state changes happen only through logged deterministic effects** — the same
   `applyDeltas()` mutation discipline the rest of the engine already enforces. No direct
   writes to instance state.
7. **Visuals bind to canon by ID.** A mesh is attached to a room/opening/prop *id*. The id is
   canon; the mesh is a swappable presentation binding.
8. **The Builder may be rich and messy; the runtime artifact must be compact and
   deterministic.** Same JSON in → byte-identical definition out, forever; `worldHash` stable
   under replay (authored content is fixed data, like a pack).
9. **Authored Builder exports are not silently repaired by runtime.** Finalized canon is taken
   as the author's final word.
10. **Repairs, if allowed, happen as explicit authoring-time operations before export** — the
    export carries the *chosen canonical answer*, and the fact that a repair was applied is
    recorded in the validation report.

> **Live-seam note.** Principle 9/10 is the one the current code does *not* yet satisfy:
> `authoredStructure.js` performs orphan repair at load time and flags it on a non-enumerable
> `__loaderInfo`. That is acceptable for *draft tolerance* and *procgen* content, but the
> contract's direction is to move the decision to authoring time for *finalized* buildings.
> See §14.

---

## 3. Three-Artifact Boundary

Three artifacts, three owners, three lifetimes. Blurring them is the root drift this contract
exists to prevent.

### A. BuilderDraft — the editable authoring artifact

- **For:** authoring. It is where a human or AI assistant *works*.
- **May contain:** anything useful to editing — templates, Lincoln-Log wall/roof/floor pieces,
  source meshes, AI prompts and generated drafts, preview data, drag handles, snap guides,
  redundant geometry, freeform/bowed walls, corridors, tunnels, per-wall curves, authoring
  history/undo, and **validation warnings including known-invalid intermediate states**.
- **Why it may be invalid:** editing is a process. A half-drawn building with an orphan room, a
  door on nothing, or overlapping rects is a normal *moment* in authoring, not a defect.
- **Why runtime must not consume it directly:** it is not guaranteed connected, consistent,
  compact, or deterministic; it carries editor-only cruft the engine has no meaning for; and
  its invalid states would force the engine to either crash or *invent structure to cope* — the
  exact drift we forbid.

### B. RuntimeBuildingDefinition — the frozen validated structure

- **For:** being the trusted canon the engine and DM read.
- **Must contain** (conceptually — see §4): schema version, building id, archetype/tags, levels
  (if any), rooms, exits, openings, structural boundaries (or their compiled residue),
  tactical regions, props, default state flags, asset bindings, and a validation report/hash.
- **Why frozen, validated, schema-versioned, compact:**
  - *Frozen* — so instance state can layer over an immutable base and replay is well-defined.
  - *Validated* — so the engine never has to guess or repair; every required fact is present
    and consistent at load.
  - *Schema-versioned* — so old exports upgrade explicitly, mirroring the engine's existing
    `STRUCTURE_SCHEMA_VERSION` discipline (interior schema pinned independently of
    `WORLD_VERSION`).
  - *Compact* — so it is cheap to hash, cheap to project to the LLM, and free of editor-only
    data with no runtime meaning.

### C. RuntimeBuildingInstanceState — the mutable per-play state

- **For:** recording what changed during *this* play session — doors opened, locks broken,
  windows shuttered, chests looted, walls damaged, secrets discovered, fires started,
  barricades moved.
- **May mutate:** only the mutable facts enumerated in §5/§10, and only through logged
  deterministic effects.
- **How it relates to the definition:** it is a *sparse overlay keyed by canonical id*. It holds
  no geometry, no room list, no exit list — only deltas from the definition's default state
  flags. The effective state of any door/opening/prop is `definition.default ⊕ instanceOverlay`.
- **How it is reconstructed:** from **seed + event log**, or equivalently from a serialized
  overlay in a save. Because every change is a logged deterministic effect, replaying the log
  against the frozen definition reproduces byte-identical instance state.

### Failure modes if the three are blurred

- **Draft treated as canon** → the engine repairs/guesses at load, so the played building
  differs from the drawn building and neither matches what the author *decided*. Non-reproducible
  across loads if repair depends on iteration order.
- **Instance state written into the definition** → the "original" building mutates, so reload,
  replay, and any second instance (another save, another player, a re-entry) inherit a corrupted
  base. Determinism breaks; `worldHash` diverges.
- **Definition carrying mutable state** → ambiguity about whether "door: shut" is the *default*
  or the *current* value; save/replay cannot tell authored intent from play history.
- **Mesh treated as either canon or state** → geometry becomes load-bearing; a missing or
  swapped asset silently changes gameplay; the LLM narrates from pixels and invents.

---

## 4. Runtime Artifact Overview — `RuntimeBuildingDefinition`

Conceptual contents. Illustrative pseudostructure only; field names are non-normative.

| Element | Meaning | Notes |
|---|---|---|
| **schema version** | which contract/export version produced this | gates explicit upgrade; parallels `house-builder/vN` + engine `STRUCTURE_SCHEMA_VERSION` |
| **building id** | stable identifier for the building | referenced by the map node it attaches to |
| **archetype / tags** | cottage / stone-keep / cellar / taproom, plus role hints | drives DM tone + furniture defaults + material shell |
| **levels** | list of floors, if any | v0 may be single-level; the field exists so multi-floor is additive, not a schema break |
| **rooms** | the room graph nodes | each with id, coordinate region, role, level |
| **exits** | connections a body can traverse | interior room↔room, and room↔exterior (the entrance) |
| **openings** | door / window / archway / breach on a boundary | each with a *default* state flag set |
| **structural boundaries / wall segments** | which room edges are solid vs open | may be retained, or compiled into cells + openings (see §18) |
| **tactical cells / coordinate regions** | the walkable grid or rectangles per room | one continuous metric scale (the engine's `wu ≈ 1 m`) |
| **props** | hearth, chest, table, altar… placed in a room | each with id, room, position, role, and default state flags |
| **default state flags** | authored starting values for every mutable entity | e.g. door: shut, chest: locked+unlooted, window: unshuttered |
| **asset bindings** | id → visual (GLB / Lincoln-Log piece / placeholder) | presentation only; never consulted for truth |
| **validation report / hash** | proof the artifact passed the gate, plus a content hash | records any authoring-time repairs that were applied |

Illustrative (non-normative) shape:

```
RuntimeBuildingDefinition {
  schema: "building-canon/0",
  id: "cabin_hollow_01",
  archetype: "cottage", tags: ["timber","one-storey"],
  levels: [{ id: "L0", label: "ground" }],
  rooms:   [{ id:"r.main", level:"L0", role:"hearth-room", region:{...} },
            { id:"r.back", level:"L0", role:"bedchamber",  region:{...} }],
  exits:   [{ id:"e.front", from:"EXTERIOR", to:"r.main", opening:"o.door.front" },
            { id:"e.inner", from:"r.main", to:"r.back",   opening:"o.door.inner" }],
  openings:[{ id:"o.door.front", kind:"door",   boundary:"...", default:{ shut:true } },
            { id:"o.door.inner", kind:"archway", boundary:"...", default:{} },
            { id:"o.win.side",   kind:"window", boundary:"...", default:{ shuttered:false } }],
  props:   [{ id:"p.hearth", room:"r.main", role:"hearth", default:{} },
            { id:"p.chest",  room:"r.back", role:"chest",  default:{ locked:true, looted:false } }],
  assets:  [{ target:"r.main", mesh:"...", placeholderOk:true }, ...],
  validation: { ok:true, hash:"…", repairs:[] }
}
```

---

## 5. Instance State Overview — `RuntimeBuildingInstanceState`

The mutable overlay. It holds *only* facts that changed from the definition's defaults during
play, each keyed by a canonical id.

**Mutable facts that belong in instance state** (see §10 for the full mutation rules):

- door: open / closed
- lock: locked / unlocked
- bar: barred / unbarred
- shutter: shuttered / unshuttered
- secret/hidden: hidden / discovered
- structure: broken / repaired
- burn/damage: burned / damaged (with severity if modeled)
- container: looted / not looted
- barricade: barricaded / unbarricaded
- movable prop position, *only if props are allowed to move in v0*
- temporary hazards: fire, smoke, collapse-risk, flooding, magical effect (with lifetime)

**Immutable facts that stay in the definition:** the room graph, exits, opening *existence* and
*kind*, boundaries, tactical regions, prop *existence* and *role*, asset bindings, and every
*default* state flag. Play changes the door's *state*; it never removes the door.

**How instance state references canon:** every overlay entry names a canonical id from the
definition (`o.door.front`, `p.chest`, `r.main`). An overlay entry whose id is absent from the
definition is a **blocking corruption** (§13), not a silent tolerate.

**Why state changes must be event-logged:** so the overlay is *derivable*, not *authoritative*.
The log is the source; the overlay is a cache of the log applied to the definition. This is what
lets a save be a seed + log (compact, replayable) rather than a full geometry dump.

**Replay / determinism (conceptual):**

```
effective_state(entity) = definition.default(entity)  ⊕  replay(event_log)   [entity]
```

Given the same frozen definition and the same ordered event log, the effective state is
byte-identical on every machine and every reload — the same guarantee `worldHash` already
enforces for the rest of the world.

---

## 6. Entity Definitions

For each entity: what it means · what it owns · what it must **not** own · how the LLM may refer
to it · how gameplay interacts · where its mutable state lives.

### Building
- **Means:** the whole compiled artifact — a graph of rooms with a boundary to the exterior.
- **Owns:** id, archetype/tags, levels, the room graph, the validation report/hash, schema
  version, the set of asset bindings.
- **Must not own:** meshes-as-truth; any per-play mutable state; editor-only draft data.
- **LLM:** may name it and its archetype ("a small timber cabin"); may not add rooms to it.
- **Gameplay:** the unit that attaches to a map node; the unit a player enters/leaves.
- **Mutable state:** none at the building level in v0 (aggregate states like "burning down" are
  derived from room/hazard instance state, not stored on the building).

### Room
- **Means:** a bounded interior space (or the exterior pseudo-room; see §7).
- **Owns:** id, level, coordinate region, role, membership of its cells, list of openings on its
  boundary.
- **Must not own:** its neighbors' geometry; global building facts; mutable occupancy as canon
  (occupancy is derived from where actors are, not stored on the room definition).
- **LLM:** narrates the current room by role and contents; may not invent adjoining rooms.
- **Gameplay:** the player is always *in exactly one* room (or EXTERIOR); look/search/fight are
  scoped to it.
- **Mutable state:** none intrinsic in the definition; per-play facts like "on fire" live in
  instance state as a hazard keyed to the room id.

### Exit
- **Means:** a traversable connection between two rooms, or a room and the exterior.
- **Owns:** id, endpoints (from/to), and a reference to the **opening** it passes through.
- **Must not own:** the opening's physical state (that is the opening's job); geometry.
- **LLM:** may state "there is a way through to the back room" only if the exit exists.
- **Gameplay:** movement resolves along exits; traversability depends on the referenced
  opening's *current* state (a barred door's exit is temporarily impassable).
- **Mutable state:** none of its own — an exit is structural; its passability is a *function of*
  the opening's instance state.

### Opening
- **Means:** a hole in a boundary — door, window, archway, breach, secret opening.
- **Owns:** id, kind, the boundary it sits on, and its **default** state flags.
- **Must not own:** whether a body can currently pass (that is *derived* from kind + current
  state); the mesh.
- **LLM:** describes visible openings and their current state ("the door is barred from
  inside"); never invents an opening.
- **Gameplay:** blocks/allows movement, sight, and sound per kind and state (§9).
- **Mutable state:** **default** flags in the definition; **current** flags in instance state
  (open/closed, locked, barred, shuttered, breached, discovered).

### StructuralBoundary / WallSegment
- **Means:** a solid edge between rooms, or between a room and outside — the thing an opening
  punches through.
- **Owns:** which two regions it separates; whether it is solid or carries an opening.
- **Must not own:** freeform bowed geometry as *truth* (drawn curves are draft/presentation; the
  runtime boundary is the abstract "these two regions are separated here").
- **LLM:** may say "a solid stone wall" but not place a door in it that canon lacks.
- **Gameplay:** blocks movement/sight/sound where solid; a *breach* is an opening added to
  instance state (walls become passable only by being broken through a logged effect).
- **Mutable state:** breach/damage in instance state; the boundary's *existence* is immutable.
- **Open question (§18):** whether boundaries are retained in runtime or compiled entirely into
  cells + openings.

### TacticalCell / CoordinateRegion
- **Means:** the walkable positions inside a room — a grid of cells or a set of rectangles/
  polygons on one continuous metric scale.
- **Owns:** its coordinates, the room it belongs to, and per-cell/region flags (blocked, cover,
  hazard-prone).
- **Must not own:** membership in two rooms simultaneously (a cell belongs to exactly one room;
  see §8); mesh geometry.
- **LLM:** generally does not address cells directly at v0; it narrates rooms, not coordinates.
- **Gameplay:** positioning, movement range (the ≤6-squares movement law), cover, line of sight.
- **Mutable state:** transient overlays (fire on a cell, rubble blocking a cell) in instance
  state; the cell's existence/room-membership is immutable.

### Prop
- **Means:** a placed object with gameplay meaning — hearth, chest, table, altar, bed, barrel.
- **Owns:** id, room, position, role, and default state flags.
- **Must not own:** structural connectivity (a prop never creates an exit); its mesh as truth.
- **LLM:** describes props in the current room by role; may not invent props absent from the
  projection.
- **Gameplay:** searched, looted, used as cover, burned, sometimes moved.
- **Mutable state:** looted/unlooted, locked/unlocked (containers), broken/burned, moved-position
  (if allowed) — all in instance state; the prop's existence and role are immutable.

### StateFlag
- **Means:** one named mutable boolean/enumeration on an entity (door.shut, chest.locked,
  room.onFire).
- **Owns:** its key, its allowed values, and its default (in the definition).
- **Must not own:** structure — a flag never adds/removes rooms, exits, or openings.
- **LLM:** may report a flag's current value when it is in the projection.
- **Gameplay:** the atomic unit of change; every mutation flips one or more flags via a logged
  effect.
- **Mutable state:** the *default* is in the definition; the *current* value is in instance
  state. A mutable entity **must** declare a state key (a mutable entity with no key is a
  blocking failure, §13).

### AssetBinding
- **Means:** a link from a canonical id to a visual (GLB, Lincoln-Log piece, placeholder).
- **Owns:** the target id, the asset reference, and a placeholder-fallback marker.
- **Must not own:** any gameplay meaning; it is presentation only.
- **LLM:** never sees asset bindings; it narrates from canon, not from meshes.
- **Gameplay:** none — a missing or swapped binding never changes what is true or possible.
- **Mutable state:** none in v0.

### ValidationReport
- **Means:** the proof, attached to the definition, that it passed the export gate.
- **Owns:** ok/fail, the content hash, the list of blocking failures (must be empty to load),
  the list of non-blocking warnings, and the **list of authoring-time repairs that were
  applied** (§14).
- **Must not own:** any runtime-mutable data; it is authored metadata, frozen with the
  definition.
- **LLM:** does not see it.
- **Gameplay:** the loader checks `ok` and hash; it never re-derives or re-repairs.
- **Mutable state:** none.

---

## 7. Room Graph Rules

- **What makes a room valid?** A stable id, a non-empty coordinate region (§13 forbids a room
  with no region), a role (or an explicit default role), a level, and reachability from the
  entrance — *unless* it is explicitly marked sealed/secret (an intentionally unreachable room
  is valid; an *accidentally* unreachable one is a blocking failure).
- **Can the exterior be a pseudo-room?** Yes — v0 treats `EXTERIOR` as a distinguished
  pseudo-room so "stand outside the cabin" and "enter" are ordinary exit traversals. Whether it
  is truly a pseudo-room or a world map-node adapter is an open question (§18); the *contract*
  only requires that "outside" is addressable and that the entrance is an exit between EXTERIOR
  and an entry room.
- **Can a room have no exits?** Only if it is explicitly sealed/secret (a hidden vault reachable
  solely by discovering a secret opening). A non-sealed room with zero exits is a blocking
  failure (soft-lock).
- **How are secret doors represented?** As an opening of kind `secret` (or a normal opening
  with a `hidden:true` default). It exists in canon from the start; it is simply *undiscovered*
  until a logged discovery effect flips `hidden→discovered` in instance state. The engine always
  knows it is there; the player and the DM projection do not, until discovered.
- **Stairs / vertical transitions (forward design, not v0):** modeled as exits between rooms on
  different `levels` through an opening of kind `stair`. v0 may ship single-level (matching the
  engine's current single-storey model), but the `levels` field and cross-level exit shape exist
  now so multi-floor is additive, never a schema break.
- **How does the engine know where the player is?** The player's position is a room id (plus a
  tactical cell within it), held in world state — never inferred from geometry. Entering sets the
  room to the entry room; moving along an exit updates it. (This is the "node/interior desync"
  failure class the engine already guards; the contract's job is to make the room graph the
  single source that occupancy reads.)
- **"Unknown to player" vs "nonexistent":** a first-class distinction. The definition is the full
  closed world (everything that exists). The *projection* to the LLM and player is filtered by
  discovery state. A secret room is *unknown* (exists, not yet in the projection); a room the
  author never drew is *nonexistent* (not in canon at all). The engine must never collapse these
  two — that collapse is exactly how "the DM invents a room that isn't there" happens.
- **Discovery vs closed-world narration:** the LLM narrates only the *discovered* projection. It
  is not told about undiscovered secrets unless the engine explicitly asks for secret-aware
  narration (e.g. resolving a successful search). Closed-world means: what is not in the
  projection does not exist *for the DM*, even though it may exist in canon.

---

## 8. Tactical Layer Rules

- **Does each room own its cells?** Yes. Every walkable cell/region belongs to exactly one room.
  A room's tactical footprint is the union of its cells.
- **Can a cell belong to more than one room?** No. Shared-boundary ambiguity is a blocking
  failure (§13 "ambiguous room ownership"). A doorway *cell* is assigned to one room; the
  *opening* on the boundary is what connects the two.
- **Walls, doors, windows, cover, blocked movement:** walls are boundaries between regions
  (movement-blocking where solid); doors/windows are openings on those boundaries with pass/see
  rules per kind and state; cover is a per-cell/per-prop flag; blocked movement is a per-cell
  flag (rubble, a barred door's cell, a hazard).
- **Line of sight at v0:** kept simple and grid-derived — sight is blocked by solid boundaries
  and by opaque closed openings (a shut door, a shuttered window). An open door or unshuttered
  window permits sight through. No per-mesh occlusion, no soft shadows — geometry never decides
  LoS. (Exact algorithm — raycast over cells vs region adjacency — is deferred; the contract only
  fixes that LoS reads canon, not meshes.)
- **Sound / hearing at v0:** a coarse propagation over the room graph — a loud event (a kicked
  door) is audible in the room it occurs in and in *directly adjacent* rooms whose connecting
  opening is not fully sound-sealing, with attenuation by one graph step. Enough to answer "does
  the NPC in the next room hear the door?" No acoustic simulation. How far v0 needs to go is an
  open question (§18).
- **Tactical position ↔ room membership:** a position is `(room id, cell)`. Room membership is
  primary; the cell refines it. You cannot be "in a cell" without being "in the room that owns
  the cell."
- **Intentionally out of scope for v0:** elevation/verticality within a room, destructible-cover
  physics, flanking geometry, diagonal-cost nuance, per-mesh collision. Cover and blocking are
  flags, not simulated solids.

---

## 9. Opening vs Exit Rules

**The distinction.** An **exit** is a *graph edge* — "these two rooms are connected, and here is
the traversal." An **opening** is a *physical feature on a boundary* — a door, a window, an
archway, a breach. An exit *references* an opening; passability is the exit's edge existing AND
the opening's current state permitting a body through. Not every opening is an exit (a window is
an opening you can see/shoot/climb through but that is not a normal walking exit); not every exit
looks like a door (an archway is an always-open exit).

**Opening kinds and what they block** (default behavior; instance state can change it).
*Movement* is whether a body walks through right now; *Traversal* is whether — and how — a
body can eventually get through by changing the opening's state:

| Opening kind | Movement | Sight | Sound | Traversal |
|---|---|---|---|---|
| **archway** (open passage) | pass | see through | carries | freely |
| **door** (open) | pass | see through | carries | freely |
| **door** (closed) | blocked | blocked | muffled (audible adjacent) | once opened / forced |
| **locked door** | blocked | blocked if solid | muffled | once unlocked / forced |
| **barred door** | blocked | blocked | muffled | once unbarred (from inside) / broken |
| **window** (unshuttered) | no walk | see through | carries | conditional — climb, if size permits |
| **window** (shuttered) | no walk | blocked | muffled | once opened/broken, then as unshuttered |
| **hole / breach** | pass (created by damage) | see through | carries | conditional — clamber through |
| **secret opening** (undiscovered) | blocked + invisible | not projected | as its underlying kind | unavailable until discovered |
| **secret opening** (discovered) | as its underlying kind | as its underlying kind | as its underlying kind | as its underlying kind |

**Default vs current state.** The definition carries each opening's **default** flags (front
door `shut:true`, interior archway open, window `shuttered:false`, secret `hidden:true`). During
play the **current** flags live in instance state and are changed only by logged effects (open,
close, lock, unlock, bar, unbar, shutter, unshutter, breach, discover). The effective behavior at
any moment is `kind` resolved against `default ⊕ current`.

---

## 10. State and Event Rules

**Which building facts are mutable** (the complete v0 set):

- open / closed
- locked / unlocked
- barred / unbarred
- hidden / discovered
- broken / repaired
- burned / damaged
- looted / not looted
- barricaded / unbarricaded
- moved / unmoved (only if props may move in v0 — see §18)
- temporary hazard states (fire, smoke, collapse-risk, flooding, magical effect), each with a
  lifetime

**Mutation discipline.** Every one of these changes only through a **deterministic logged
effect**, routed through the engine's existing single mutation path (`applyDeltas()`). No code
writes instance state directly; no LLM output mutates state; narration is downstream of state,
never a cause of it.

**The four distinct things — never conflate them:**

1. **Authored default state** — the starting value baked into the definition ("the front door
   starts shut, the chest starts locked"). Immutable for the session.
2. **Current instance state** — the live overlay ("the door is now open because the player kicked
   it"). Mutable, keyed by canonical id.
3. **Event log** — the ordered list of logged effects that *produced* the current state. The
   source of truth; the overlay is its cache.
4. **Derived narration** — the DM prose the LLM writes *from* the projection of current state.
   Purely downstream: narration never becomes canon, and canon is never read back out of
   narration. (This is the engine's standing "narration ≠ canon" invariant.)

**Why event-logged:** it makes state *derivable and replayable* — a save is seed + definition +
log, reproducing byte-identical instance state, preserving `worldHash` equality under replay.

---

## 11. Asset Binding Rules

**What binds:** mesh/GLB references, Lincoln-Log visual pieces (log walls, roof caps, floor
boards), wall/roof/floor assets, prop meshes, placeholder assets, and the explicit *missing-asset*
case.

- **Asset bindings are presentation-only.** They attach a visual to a canonical id. The engine
  reads canon to decide truth and reads bindings only to *draw*. No query, reachability, LoS, or
  narration fact ever flows from an asset.
- **Missing visuals must not break gameplay.** A canonical door with no bound mesh still opens,
  blocks, and is narrated; the renderer falls back to a placeholder (a hand-drawn door, a plain
  box). "No art yet" is a rendering degrade, never a play failure.
- **Visual assets must not create gameplay features.** A mesh that *looks* like it has a second
  door does not add an exit. If the art shows something canon lacks, the **art is wrong**, not
  the canon (this is the `MAP_REAL` "functional ink" law, applied to buildings). Fix the binding
  or the definition — never let the picture win.
- **Lincoln-Log assets bind to structural boundaries without becoming truth.** A stack of log
  pieces is *one presentation* of a wall segment; the runtime boundary is the abstract "these
  two regions are separated here." Swap the logs for stone blocks and the canon is unchanged. The
  logs decorate the boundary; they are not the boundary.
- **Builder preview renders from compiled canon where possible.** The preview the author sees
  should be driven by the *compiled* `RuntimeBuildingDefinition` (or a faithful projection of it),
  not by raw draft assumptions — so "what I previewed" equals "what will play." Where the preview
  must show pre-compile draft geometry, it should be visibly marked as draft, not canon.

---

## 12. Builder Export Requirements

Before runtime accepts a building, the Builder must provide:

- **valid rooms** — every room has an id, a coordinate region, a role (or default), a level.
- **valid exits** — every exit connects two real endpoints (rooms or EXTERIOR) through a real
  opening.
- **valid openings** — every opening sits on a real boundary and carries a default state.
- **reachable required spaces** — every non-sealed room is reachable from the entrance.
- **no dangling doors/windows** — no opening references a boundary/room that does not exist.
- **tactical regions consistent with the room graph** — cells belong to exactly one room; every
  room has a region; no off-grid segments.
- **asset bindings checked but not trusted** — bindings are validated for *target existence*
  (the id they point at is real) but never consulted for gameplay truth.
- **default state flags** — every mutable entity declares its starting value.
- **validation report** — pass/fail, warnings, and the list of applied authoring-time repairs.
- **schema version** — the export/contract version, for explicit upgrade.
- **stable ids** — deterministic, collision-free ids so instance state and the log stay valid
  across reloads and re-exports.

**The export pipeline:**

```
BuilderDraft
  → validation                         (find blocking failures + warnings)
  → explicit authoring-time repairs     (only if the author requests them; each is recorded)
  → re-validation                       (must now pass with zero blocking failures)
  → RuntimeBuildingDefinition           (frozen, hashed, schema-versioned)
  → runtime load                        (engine checks report.ok + hash; never re-repairs)
  → RuntimeBuildingInstanceState         (created fresh for play; overlays the definition)
```

**Finalized Builder-authored structures are never silently repaired by runtime.** If a
definition arrives with an orphan room, an exit to nowhere, or a missing default, the loader
**rejects** it (or degrades to procgen for non-authored content) — it does not invent the
missing structure. The place to fix an orphan is the Builder, at authoring time, recorded in the
report.

---

## 13. Validation Failures

**Blocking failures — the definition does not load:**

- unreachable required room (an orphan that is not explicitly sealed/secret)
- exit to nowhere (endpoint or opening id does not resolve)
- opening not attached to a valid boundary
- a door that visually exists (asset/draft) but is missing from canon
- a canon door with no visual placeholder resolvable (renderer would draw nothing traversable)
- grid / room mismatch (a room's cells disagree with its declared region)
- off-grid structural segment (a boundary not resolvable to the coordinate space)
- ambiguous room ownership (a cell claimed by two rooms)
- missing required state defaults (a mutable entity with no declared default)
- duplicate ids (any two entities share an id)
- invalid asset-binding target (a binding points at a nonexistent id)
- orphan room (see first item — called out explicitly because it is the live drift case)
- room with no valid coordinate region
- prop placed outside any valid room
- secret opening with no discovery/default state
- mutable entity without a state key
- instance state referencing a nonexistent canon id (corruption at load/replay)

**Non-blocking warnings — the definition loads, but the report notes them:**

- room has no props
- building has only one exit
- window has no visual binding but a placeholder fallback exists
- decorative asset has no gameplay binding (expected for pure décor)
- unusual room size (very large / very small vs archetype)
- no roof / enclosed flag set
- no lighting metadata (defaults to lit)
- asset present but marked decorative-only (expected; confirms it carries no gameplay meaning)
- room label missing but role exists (narration falls back to the role)
- placeholder art used for a canonical object (fine at v0; noted so an art pass can find it)

---

## 14. Repair Policy

**The live reality this policy corrects.** Today `engine/structures/authoredStructure.js`
`buildEdges()` connects a building in three passes — doors→edges, abutment fallback, then
**orphan repair**: any room still unreachable from the entry is joined to its nearest neighbor so
the graph is never a soft-lock. That repair is *flagged* (reported on a non-enumerable
`__loaderInfo`), which is honest — but it happens at **load time**, and it *invents a connection
the author never drew*. That is the exact behavior the contract moves out of runtime for
finalized content.

**Policy:**

- **When may the Builder *suggest* a repair?** During authoring/validation, whenever it detects a
  blocking structural failure with a safe canonical fix — e.g. an orphan room → "add a doorway to
  the nearest room" or "mark this room sealed/secret."
- **When may the user *accept* a repair?** Explicitly, at authoring time, before export. The
  author chooses the canonical answer (add the doorway *here*, or seal the room). Acceptance is a
  deliberate authoring operation, not a background default.
- **How is an accepted repair recorded?** In the validation report's `repairs` list — what was
  wrong, what fix was chosen, and (ideally) that it was author-approved. The export then carries
  the *result* of the repair as ordinary canon; there is nothing left to "repair" at load.
- **Why must runtime not repair finalized Builder exports?** Because a finalized definition is the
  author's final word. If runtime invents a doorway, the played building diverges from the
  authored one, the divergence can depend on iteration order (non-deterministic across engine
  changes), and the author never sees or blesses it. Silent repair reintroduces the drift the
  three-artifact split exists to kill.
- **May generated / non-authored structures use repair paths differently?** Yes — this is the key
  carve-out. **Procgen** content is not authored canon; the generator *is* its author, and
  runtime repair of a procgen candidate is legitimate (it is the generator finishing its own
  job, deterministically, from the seed). The distinction is **provenance**: authored (from the
  Builder, finalized) → never silently repaired; generated (from `rng.js`, deterministic) → may
  use the existing repair passes. The definition should carry its provenance so the loader knows
  which rule applies.
- **How does validation distinguish "repairable draft" from "invalid runtime artifact"?** By
  *stage*, not by content. The same orphan room is a *repairable draft issue* while it is a
  `BuilderDraft` (fixable, suggestable) and a *blocking failure* once it reaches the
  `RuntimeBuildingDefinition` gate (a finalized authored artifact must already have the answer
  baked in). Repair belongs before the freeze, never after.

**The orphan-room example (canonical):** a `BuilderDraft` contains a room unreachable from the
entrance. The Builder *may* suggest "add a doorway to the adjacent room" or "mark this room
sealed/secret." The author picks one. The exported `RuntimeBuildingDefinition` contains the
**chosen** answer — either a real opening+exit, or a `sealed:true` room. Runtime loads that as-is.
Runtime must **not** look at an orphan and silently add a doorway.

---

## 15. LLM Closed-World Projection

When the DM narrates a building or room, it receives a **closed-world projection** — a filtered,
current-state view of *only what exists and is known*. It never receives the raw definition, the
draft, or any geometry.

**A projection contains:**

- **current room** — id, role, a short description handle
- **known exits** — where you can go from here, and through which opening, with each opening's
  current state ("archway to the back room — open"; "front door — shut")
- **visible openings** — doors/windows/archways on this room's boundary and their current state
- **visible props** — the props in this room by role, with relevant current state ("a hearth,
  cold"; "an iron chest — locked, unlooted")
- **relevant current instance state** — hazards, damage, discovered/undiscovered facts that apply
  here ("smoke is filling the room")
- **hidden/secret items** — **omitted** unless already discovered, *or* unless the engine is
  explicitly asking for secret-aware narration to resolve a search
- **explicit "do not invent" constraints** — a standing instruction: narrate only what is listed;
  do not add exits, doors, windows, stairs, rooms, or props that are not in this projection.

**Example — a two-room cabin, player in the main room:**

```
YOU ARE NARRATING: room r.main ("hearth room") of building cabin_hollow_01 ("a small timber cabin").
EXITS (only these exist):
  - front door  → EXTERIOR   [door: SHUT]
  - archway     → r.back ("bedchamber")   [OPEN]
OPENINGS visible here:
  - front door [SHUT]
  - a side window [UNSHUTTERED — you can see the yard]
PROPS here:
  - a stone hearth [cold]
CURRENT STATE: nothing damaged; nothing on fire; no smoke.
NOT VISIBLE / NOT PRESENT: there are no stairs, no cellar, no other doors, no other windows,
  and no other rooms than the two named above.
CONSTRAINT: Narrate only what is listed. Do NOT invent exits, doors, windows, stairs, rooms,
  or props. If the player asks about something not listed, it is not there.
```

**Handling a player asking about something absent from the projection.** The DM answers truthfully
*in the fiction* that it is not there — "You see no other way out of this room; the only doors are
the front and the archway to the back." It does **not** invent a cellar hatch to satisfy the
question, and it does **not** break character with a mechanical "that doesn't exist." If the thing
*could* be a secret (an undiscovered opening exists in canon but not in the projection), the
correct move is not to reveal it but to let the ordinary search/discovery path resolve it — the
projection stays closed until a logged discovery effect opens it. Absence in the projection is a
truthful "no" in the world.

---

## 16. Minimal v0 Cabin Example

The smallest valid `RuntimeBuildingDefinition`, in plain English:

- a **20×20 cabin**, single level, enclosed (roof/enclosed flag set)
- **two rooms** — a main hearth room and a back bedchamber
- **one exterior door** — the front door, entrance from the map node, default **shut**
- **one interior opening** — an archway between the two rooms, default **open**
- **one window** — on the main room's outer wall, default **unshuttered**
- **one hearth** — a prop in the main room
- **one locked chest** — a prop in the back room, default **locked** and **unlooted**
- **placeholder assets allowed** — every id may render as a hand-drawn/placeholder visual
- **default state flags** present for the door (shut), window (unshuttered), and chest
  (locked+unlooted)
- a **`RuntimeBuildingInstanceState`** created empty when play begins, layering over the frozen
  definition

**Player actions this v0 cabin must support:**

- stand outside the cabin (in EXTERIOR, at the front door)
- enter the cabin (traverse the front-door exit into the main room)
- know which room the player occupies (position = room id, always exactly one)
- look around without hallucinated exits (projection lists only the two real exits)
- look through the window (unshuttered → see the exterior; shuttered → cannot)
- open / close / kick the front door (logged effects flipping door state; a kick may breach)
- move through the interior archway (main ↔ back)
- inspect the locked chest (see it is locked and unlooted)
- try to open the chest (locked → resolve against the lock; success flips looted on taking)
- ask whether there are other exits (truthful "no" — only front door and archway)
- have an NPC hear a kicked door, *if* sound propagation is in v0 (adjacent room hears it)

---

## 17. Out of Scope for v0

Explicitly excluded from v0:

- freeform 3D editing
- procedural town generation
- multi-floor buildings (present only as forward-compatible `levels`/`stair` placeholder design)
- real physics destructibility
- arbitrary mesh collision as gameplay
- AI direct-to-runtime generation (AI may draft; only a validated export enters runtime)
- beauty-first asset production
- the full Building Builder UI
- the full asset pipeline
- runtime geometry inference from mesh
- complex fire / flood / collapse simulation
- automatic runtime repair of authored invalid structures

---

## 18. Open Questions

Genuinely unresolved. (Settled and *not* reopenable: mesh is not canon · the LLM may not invent
structure · BuilderDrafts do not enter runtime · runtime does not silently repair authored
exports. Those are "no.")

1. **Exact grid unit.** The engine's sheet is metric (`wu ≈ 1 m`). Does v0 fix a 1 m cell, a
   5 ft cell, or a configurable unit — and how does it reconcile with the feet-authored mini
   sizes (the existing `WU_PER_FT` seam)?
2. **Cells vs rectangles vs polygons.** Does a room's tactical region enumerate cells, or store
   rectangles/polygons compiled to cells on demand? Affects compactness and LoS cost.
3. **Exterior: pseudo-room or world node.** Is EXTERIOR a distinguished pseudo-room inside the
   building definition, or an adapter to the existing map-node the building attaches to?
4. **How much sound propagation v0 needs.** One-step adjacency with attenuation, or nothing at
   all in v0 with hearing deferred?
5. **How secret doors appear in LLM projections.** Fully omitted until discovered (current
   leaning), or hinted under a secret-aware narration mode the engine opts into?
6. **How much destructibility v0 models.** Just "door kicked / wall breached as a new opening,"
   or graded damage states on boundaries and props?
7. **Whether structural boundaries are retained in runtime or compiled away.** Keep explicit
   `WallSegment`s in the definition, or compile them entirely into tactical cells + openings and
   drop the boundary as a first-class runtime entity?
8. **Movable props in v0.** Are props allowed to change position (barricades, shoved furniture),
   or is "moved" out of scope until v1?
9. **Where lighting lives.** Is light a room metadata field (lit/dark/dim per room), a prop
   state (the hearth or a lantern is the light source), or a tactical-region state (per-cell
   light for stealth/LoS)? v0 defaults everything to lit; the answer decides where the flag
   goes when darkness matters.

---

## 19. Final Recommendation

**The canonical definition of a building (one paragraph).** A building in Immortal Engine is a
*compiled, validated, deterministic playable artifact* — a frozen room graph with exits,
openings, tactical regions, props, and authored default states, addressed entirely by stable ids
— that the engine and the DM may query, traverse, fight in, damage, search, and narrate, and over
which a sparse per-play instance state records every change through logged deterministic effects.
It is authored as a rich, messy `BuilderDraft`; it *plays* only as the compact
`RuntimeBuildingDefinition` that Draft exports; and its meshes, Lincoln-Log pieces, and roofs are
presentation bound to canon by id — never truth. Absence in canon is absence in the world, and
finalized canon is never repaired behind the author's back.

**Minimum `RuntimeBuildingDefinition` v0 contents:** schema version · building id · archetype/tags
· one level · rooms (id, region, role) · exits (from/to/opening) · openings (id, kind, boundary,
default state) · tactical regions (cells/rects, one per room) · props (id, room, role, default
state) · default state flags for every mutable entity · asset bindings (placeholder-OK) ·
validation report (ok, hash, applied repairs).

**Minimum `RuntimeBuildingInstanceState` v0 contents:** a sparse overlay keyed by canonical id,
holding only changed flags — door open/closed, lock, bar, window shutter, secret discovered,
container looted, breach/damage, and any active temporary hazard — reconstructible from
definition + event log.

**First prototype acceptance test list:**

1. A valid two-room cabin definition loads; an orphan-room definition is **rejected**, not
   repaired.
2. A definition with a door/window attached to no valid boundary (a dangling opening) is
   **rejected** at the gate.
3. Player stands outside, enters, and the engine reports the correct room; the projection lists
   exactly two exits.
4. "Look around" and "are there other exits?" never surface a door/room/stair absent from canon.
5. Kick the front door → door state flips via a logged effect; the definition's default is
   unchanged; replaying the log reproduces the same instance state (worldHash stable).
6. The locked chest is locked+unlooted at load; opening + looting flips instance state only.
7. Window unshuttered → the projection shows the exterior; shuttered → it does not.
8. Swapping the door's mesh for a placeholder changes nothing about traversal, sight, or
   narration.
9. (If sound is in v0) a kicked door is heard by an NPC in the adjacent room and not two rooms
   away.

**The first thing NOT to build:** the Building Builder UI — and equally, any mesh-to-runtime
inference pipeline (deriving rooms, exits, or collision from geometry is the tempting shortcut
this whole contract exists to forbid). The contract, the export/validate
gate, and the loader-reject-not-repair boundary come first. Until one hand-authored cabin loads
as frozen canon, plays without a single invented exit, and replays deterministically, every new
authoring feature — and every mesh — piles onto a foundation that cannot yet be trusted.
