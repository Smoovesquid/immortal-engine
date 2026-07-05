# LOAD-1 — the smallest loader: one hand-authored room becomes walkable

**Model:** Opus (deep-engine lane). **Your tests: U513–U517.**
**Decision (Tim, 2026-07-05): ENGINE LEADS.** Map authored data DOWN to the engine's existing
interior model; IGNORE/DEGRADE what the engine can't represent yet. Goal is the smallest thing that
proves the PATH: **one hand-authored room, entered and looked-at in the live game.** Not the whole
building. Spec of record: `docs/BUILDING_BUILDER.md` (Tier 0 #1–#5). Tool that produces the input:
`public/house-builder.html` (export `house-builder/v6`).

## Step 0 — self-assemble (FIRST)

1. `git fetch origin && git reset --hard origin/v2-polish`; confirm HEAD is recent v2-polish.
2. **Read the seam you plug into** — likely already exists: `engine/structures/applyGeneratedStructuresForNode.js`
   (it references an "authored plan for '<id>'" that builds for a node and falls back to procgen — this
   is probably your attach point). Then: `engine/structures/structuresState.js` `ensureStructures` (the
   structure object shape: `{kind, nodeId, anchors, topology, surfaces, tags, buildingType, build}`);
   `engine/structures/topology.js` `normalizeTopology` (`{kind:'rooms', rooms:[{id,tags}], adjacency}`);
   `engine/structures/roomDetail.js` (the ~30 room ROLES + furniture catalogue); `engine/structures/
   structureMaterial.js` (timber/stone shells); `engine/structures/interiors.js` `enterStructureInterior`/
   `exitStructureInterior` (how a room is entered/walked); `engine/world/demoFigures.js` `injectDemoFigures`
   (the pattern for injecting AUTHORED content into a node at boot — your model if the applyGenerated seam
   isn't the right hook).
3. `npm run check` GREEN before editing. LLM-off throughout (Node driving; no paid gate).

## The build (smallest — ONE room)

**Input:** a `house-builder/v6` JSON. You author a minimal FIXTURE yourself (hand-write ~20 lines: one
rectangular room with `material`, an optional `role`, 1–2 furniture, one door) under `tests/fixtures/` or
`docs/playtests/loader/`. (A full export has rooms/walls/openings/tunnels/furniture/secrets — you consume
only the subset below.)

**Loader** (`engine/structures/authoredStructure.js`, new — or extend the applyGenerated authored-plan
path): `loadAuthoredStructure(json, { nodeId })` → an engine structure object via `ensureStructures`:
- **One room** — the first room. Rectangular OR round (`shape:'round'` exists in the engine). Give it an
  `id`, and a **role**: use `room.role` if present, else a sensible default (`'quarters'`/`'chamber'`) —
  the role drives narration + which furniture reads right (`roomDetail.js`).
- **Material** — map `timber`/`stone` → the `structureMaterial` shell.
- **Furniture** — map the tool types that HAVE engine equivalents: `bed`→bed, `barrel`→barrel,
  `dresser`→wardrobe (or nearest); `cookpot`→`hearth` or DROP it (note which). Place them in the room's
  detail so "look around" names them.
- **A door** — one entry so the room is enterable.
- **IGNORE (v1, engine-leads):** bowed walls, freeform walls, tunnels, multi-floor, sized/angled openings,
  secrets, extra rooms. Note each as "degraded — future" in your report; do NOT try to represent them.

**Attach + wire ONE demo** so it's live-verifiable: inject the built structure at a chosen map node at
boot (the demoFigures pattern, or the applyGenerated authored-plan hook), behind a specific seed or a flag
(e.g. `AUTHORED_STRUCTURE=1` or a `loaderDemo` seed) so the default game is byte-identical. The point is
the PATH exists end-to-end for one room.

**Behavior to achieve:** from that node the player can ENTER ("go inside"), LOOK AROUND (the room + its
furniture + material narrate truthfully), and EXIT — with NO invented geography beyond the one room
(the DM-invents-geography guard must hold).

## Hard constraints

- **Determinism sacred.** Authored content = FIXED data (like packs) → `worldHash` stable under replay
  (assert in a test). NO `Math.random` (rng.js only if any randomness). Prefer NO `WORLD_VERSION` bump
  (reuse existing shapes); if a new field is unavoidable, follow the bump protocol in CLAUDE.md and flag
  it loudly.
- **Invariants throw** — the loaded structure must pass `assertWorldInvariants()`; malformed authored JSON
  must fail loudly (validate via `normalizeTopology` + a clear error), never silently corrupt state.
- Mutations via `effectsCore.applyDeltas` where world state changes; match the exact structure/topology/
  material/roomDetail shapes (don't invent parallel fields).
- **allowed_files:** `engine/structures/**` (new `authoredStructure.js` + minimal edits to the
  applyGenerated/attach seam), a demo wire-in at the smallest boot seam, `tests/U513–U517`, a fixture JSON,
  `docs/playtests/loader/` receipts. **forbidden:** `playloop.js` hot-path rewrites, `dialogue.js`,
  `grace/`, escapeCombat, WORLD_VERSION (unless truly forced), any change to the DEFAULT (non-demo) boot.

## Tests (U513–U517) + live-verify

- U513 fixture JSON → `loadAuthoredStructure` yields a valid structure (`ensureStructures` clean, topology
  normalized, one room with role + furniture). U514 the room is enterable (`enterStructureInterior` works;
  occupancy/scene sane). U515 furniture + material present in the room's detail/narration context. U516
  **determinism** — same JSON → identical structure; `worldHash` stable across a boot+replay. U517
  malformed JSON fails loudly (invariants/validation), default boot byte-identical (demo behind flag/seed).
- **Live-verify LLM-off** on your OWN port (`PORT=52xx node server.js`, never :5179): boot the demo seed,
  "go inside", "look around" → the authored room + its furniture narrate; "go outside" exits. Save the
  transcript to `docs/playtests/loader/`.

## Report

Commit in your worktree, atomic by path, `feat(structures): LOAD-1 — smallest authored-structure loader`;
do NOT push. Append your dated `docs/AGENT_CHANGELOG.md` section (the seam you plugged into, what maps down
vs what you degraded, the demo wire-in + how to trigger it, determinism proof, residual risk). Final
report: commit SHA, tests, the live transcript, and a plain-English paragraph for Tim: a room he drew is
now one he can walk into — how, and what got simplified on the way in.
