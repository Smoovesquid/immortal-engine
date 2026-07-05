# TT-WORLD + TT-INK + TT-PROPS — the whole world on the paper (one lane, three staged commits)

**Model:** Claude Sonnet (renderer lane — `public/map/`). **Your tests: U478–U481** (pre-allocated;
if you need more, `bash scripts/next-test-number.sh U <n>` — never guess).
**Spec of record:** `docs/TABLETOP_MAP.md` — especially **§"The 2026-07-05 directive"** (Tim's verbatim
intent, confirmed after rearticulation) · `docs/GRAPH_PAPER_UI.md` (paper/ink palette) ·
`docs/PACKETS.md` §TT-WORLD row (allowed/forbidden/done-when — controlling) ·
`docs/POSITION_AS_CANON.md` §3/§6 (movement law + player-centered camera).
**Parents (read their briefs FIRST, reuse don't fork):** the landed 2-D TT-DRAW arc —
`docs/briefs/TT-DRAW-tabletop-look.md` (`02c3721`), `TT-DRAW-2-one-sizing-truth.md` (`33f8fa73`),
`TT-DRAW-3-graphpaper-real-plans.md` (**the "one drawing brain"** — the floor-plan/ink renderer you
will reuse as the paper's plan source) · MAP-3DR (changelog 2026-07-05 §MAP-3DR, `e55747ff`; the
persistent 3-D mount + tilt you are building ON — U475–U477 must stay green).

## Step 0 — self-assemble (FIRST, do not skip)

1. You are in a fresh worktree: `git fetch origin && git reset --hard origin/v2-polish` (worker
   worktrees branch stale-from-main — this reset is MANDATORY before reading anything).
2. Read the spec-of-record docs above + the PACKETS §TT-WORLD row.
3. Baseline: `npm run check` must be green BEFORE you edit; then baseline screenshots (protocol below)
   at three zoom bands: region (2-D sheet), mid (blend band), full-zoom tilt. Commit receipts to
   `docs/playtests/tabletop/` in your worktree.

## The build (three stages, one commit each, serial — same files)

**Diagnosed root you are fixing (2026-07-05, code+live):** `public/map/render3d.js` creates its
WebGL canvas with `alpha:false` + its own sky, and the scene contains only the local slice
(`buildSettlement`/`buildChapelRuin`/`buildWilderness` over `heightAt` relief). At full zoom
(`continuousMap.js` blend=1) that opaque canvas covers the 2-D world sheet entirely → "the rest of
the map" vanishes. Outer zooms are intact (blend=0).

### Stage 1 — TT-WORLD: the paper carries the world
At the tilt band the ground becomes ONE flat graph-paper sheet carrying the world's cartography as
INK — terrain washes/edges, water contours, ruled roads, neighboring places — player-centered, no
edges. **Suggested seam (verify perf yourself, don't take it on faith):** render the 2-D sheet's own
drawing (`oneMap.js`) into a canvas-texture on the paper plane, so 2-D and 3-D can never disagree;
re-render on world-signature change (same diff discipline MAP-3DR already uses). The sheet is FLAT —
retire `heightAt` relief from the tilt view; terrain reads as ink, not geometry. **Fog of war OFF
for this build** (Tim's 2026-07-05 amendment — he wants to watch the whole map render; the RESTORE
decision is a later flag flip, do not wire fog in).

### Stage 2 — TT-INK: architecture is ink, never geometry (yet)
Stop mounting building/wall meshes in the tilt scene; buildings render as their DRAWN floorplans on
the paper — walls = pen lines, doorway = a gap in the line, dungeon = drawn rooms/corridors. Reuse
the one drawing brain (TT-DRAW-3) as the plan source so the tilt view's plans match the 2-D sheet
exactly. "(Yet)" honored: do NOT delete the mesh builders or assets — they just stop mounting.

### Stage 3 — TT-PROPS: everything standing is a mini
Discrete standing things become placed pieces at their engine positions (room granularity until TAC
lands): trees (already law), plus props — barrels, beds, dressers, chests. Simple solid pieces,
base + soft shadow, Dejarik-alive idle (`figures3d.js` precedent). The decision rule for any edge
case: **if you could pick it up off the table → mini; if it's the shape of the world → ink.**
Positions come from the engine scene contract (`sliceScene.js` / `resolveEntityWu`) — the renderer
NEVER invents a position.

## Decisions already made (do NOT relitigate)
Whole world on paper at the tilt view · architecture ink-only, meshes unmounted not deleted · props
are minis · sheet is FLAT · fog OFF during build · the 58° tilt default and zoom bands stay exactly
as b078 shipped them · combat board (S4b fold-in) untouched · minis art direction locked (solid,
full-color, alive).

## Hard constraints (from PACKETS row — controlling)
- **allowed:** `public/map/**`, new tests, `docs/playtests/tabletop/` receipts; `public/v1.js` ONLY
  if a mount-point line demands it. **Version bump / front-door build line: NOT yours** — Basecamp
  does it at integration.
- **forbidden:** `engine/**`, `server/**`, world state, rng, save shape, render coords onto world
  state (U21 precedent). If you think you need an engine change → STOP, write a scoped-packet
  proposal in your report instead.
- **invariants:** determinism ladder U19/21/22/27/30 · U475–U477 (persistent mount, zero-jump) ·
  convergence 100% · full suite green.
- **Never run the paid gate** (`scripts/dm-playtest.mjs`). Free ladder only.

## Live-verify protocol (map-fidelity rule: not DONE until it registers on the player map)
- Run your OWN server: `PORT=52xx node server.js` from your worktree. **NEVER drive
  `localhost:5179`** — that origin holds Tim's live save (`ai-dm-v2:slot:slot1`), and ⚠️ clicking
  any front-door hero button with a save present fires a native overwrite-`confirm` (2026-07-05
  finding — it wedges eval AND threatens his game). On your own port the origin is clean: use a
  pre-rolled hero for a fresh boot.
- Headless screenshot quirk: a 0×0 canvas renders "black" — fall back to an explicit size /
  `window.__resize` before screenshots.
- Receipts per stage: same three zoom bands as baseline + a mid-tilt shot showing world ink
  continuing past the old slice boundary (the "no void" proof), committed to
  `docs/playtests/tabletop/`.

## Commit & report protocol
- Commit IN YOUR WORKTREE, atomic by path, one commit per stage, message
  `feat(map): TT-<STAGE> — <what>`; never touch the main checkout. Basecamp integrates and pushes.
- Append your own dated section to `docs/AGENT_CHANGELOG.md` (append-only) in your worktree: seam
  found, files changed, tests added, receipts, residual risk.
- Your final report ends with a plain-English paragraph for Tim: what was broken, what changed, why
  it matters — jargon translated. If a stage is blocked, say exactly where and why; do not
  rationalize a partial as done.
