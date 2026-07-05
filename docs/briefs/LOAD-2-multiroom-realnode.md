# LOAD-2 — an arbitrary building at a real node: all rooms, doors as doorways

**Model:** Opus (deep-engine lane). **Your tests: U518–U522.**
**Builds on LOAD-1** (`engine/structures/authoredStructure.js` `loadAuthoredStructure`, landed v0.29.4).
**Decision (Tim): ENGINE LEADS** — map down, degrade the rest. Spec: `docs/BUILDING_BUILDER.md`
(LOAD-2 row). Input tool: `public/house-builder.html` (`house-builder/v7`).

LOAD-1 loads ONE room behind a demo seed. LOAD-2 makes a WHOLE hand-drawn building — ALL its rooms,
connected by its doors — walkable at a REAL map node, so you can walk from the map into it and move
room-to-room. This is "the castle you drew is the castle you explore," minimal version.

## Step 0 — self-assemble (FIRST)

1. `git fetch origin && git reset --hard origin/v2-polish`; confirm HEAD ≥ the LOAD-1 release
   (`v0.29.4`/`a room you drew`). Read `docs/briefs/LOAD-1-smallest-loader.md` + the module it built
   (`engine/structures/authoredStructure.js`) + its tests (U513–U517) — you EXTEND it, don't fork.
2. Read the topology/adjacency model you must produce: `engine/structures/topology.js` (`{kind:'rooms',
   rooms:[{id,tags}]}` + the **reciprocal compass adjacency** — leaving A "north"→B means B "south"→A,
   assigned deterministically by the engine from the room graph); `engine/structures/floorPlan.js` (how
   abutting rooms + doorways draw); `engine/structures/interiors.js` (room-to-room movement); how a
   structure attaches at a node (the applyGenerated/authored-plan seam LOAD-1 used).
3. `npm run check` GREEN before editing. LLM-off Node driving; no paid gate; live-verify on your OWN port.

## The build

1. **All rooms, not just the first.** Consume every `room` in the export → topology `rooms:[{id, tags}]`
   (tags from `room.role`, default `chamber`/`quarters`). Keep each room's material + furniture in its
   detail so "look around" is truthful per room.
2. **Doors → adjacency (the crux).** Build the room graph the engine's reciprocal-compass topology needs.
   A room-connecting relationship exists when an authored **door** (`openings[].kind==='door'` with a
   `room`, or one sitting on the boundary between two rooms) joins two rooms — that's the edge the player
   "goes through". Where the tool's data is ambiguous, fall back to **rooms that abut** (share an edge).
   Produce a connected graph; if a room is unreachable, attach it to the nearest neighbour (never a
   soft-lock / orphaned room). The engine assigns the compass slots — you supply the adjacency.
3. **Attach at a REAL node.** Extend the LOAD-1 wire-in so an authored building loads at a chosen SLICE
   node (a real place on the map), not only the demo seed — e.g. a small registry keyed by node id, or a
   loader that reads a saved export from `packs/base/structures/authored/`. Keep it behind a seed/flag so
   the DEFAULT game stays byte-identical, but under that flag the building sits at a real node you can
   walk to from the map and enter.
4. **Openings.** Authored doors become the room-to-room doorways (above). Windows: set the room's
   window-presence honestly if cheap, else DEGRADE (roomWindows is derived — don't fight it).
5. **DEGRADE (engine-leads, note each):** bowed/freeform walls, tunnels, per-wall curves, secrets,
   sized/angled openings, multi-floor. Round rooms use the engine round shape.

## Hard constraints
- Determinism sacred (worldHash stable; no `Math.random`; prefer NO `WORLD_VERSION`/`STRUCTURE_SCHEMA_VERSION`
  bump — reuse shapes; if forced, follow the protocol + flag). Invariants must pass; a malformed/
  disconnected building fails loudly or auto-repairs to connected, never soft-locks.
- Movement between authored rooms must be honest (no invented geography; the reciprocal-compass rule holds
  — no "walk south forever"). Reuse `interiors.js`; do NOT rewrite playloop hot paths.
- **allowed_files:** `engine/structures/**` (extend authoredStructure.js + the attach seam), a demo/fixture
  wire-in, `tests/U518–U522`, a multi-room fixture JSON, `docs/playtests/loader/` receipts. **forbidden:**
  `playloop.js` hot-path rewrites, `dialogue.js`, `grace/`, escapeCombat, the DEFAULT boot.

## Tests (U518–U522) + live-verify
- U518 a multi-room export → all rooms present in topology with correct roles. U519 door→adjacency: two
  rooms joined by an authored door are reciprocal-compass adjacent (A north→B ⇒ B south→A); no room
  orphaned. U520 walk it: enter → move room-to-room through the doorways → each room narrates truthfully,
  no invented geography, no soft-lock. U521 determinism (same export → identical structure + worldHash
  stable across a multi-room walk). U522 malformed/disconnected fails loudly or repairs; default boot
  byte-identical.
- Live-verify LLM-off (own port): hand-write a 3-room fixture (e.g. hall + two side rooms with doors),
  load it at a real slice node, walk from the map into it and room-to-room. Transcript → `docs/playtests/loader/`.

## Report
Commit in your worktree, atomic by path, `feat(structures): LOAD-2 — multi-room authored building at a real
node`; do NOT push. Append your dated `docs/AGENT_CHANGELOG.md` section (how doors→adjacency, the attach
seam, what degraded, determinism proof, residual risk). Final report: commit SHA, tests, the multi-room
walk transcript, and a plain-English paragraph for Tim.
