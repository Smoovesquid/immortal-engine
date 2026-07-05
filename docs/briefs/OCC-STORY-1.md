# OCC-STORY-1 — nobody materializes: every settlement NPC is where their story puts them

**You are a worker lane for immortal-engine. Execute this brief end-to-end, alone.**
**Files you own:** `engine/structures/roomOccupancy.js`, a NEW sibling module (suggest `engine/structures/storyAnchors.js`), and your tests `tests/U491–U493.*.test.js`.
**Files you must NOT touch:** `engine/playloop.js` (SL-5 serial lane owns that turf — your API must stay drop-in compatible so playloop needs ZERO edits), `public/**` (TT-OCC renderer packet owns mini drawing), `engine/state.js` / `WORLD_VERSION`, `engine/rng.js`, `engine/decompression/decompress.js` (read it, don't edit it).
**Your test numbers:** U491, U492, U493 (pre-allocated — do not take others).

## Step 0 — ground yourself (before ANY work)
```
git fetch origin && git reset --hard origin/v2-polish   # worker worktrees start stale from main — this is MANDATORY
node -p "require('./package.json').version"             # expect 0.28.32 or later
npm ci --no-audit --no-fund 2>/dev/null || npm install
node --test tests/ 2>&1 | tail -3                       # baseline must be green before you change anything
```
If the state doesn't match, STOP and report that — do not improvise a workaround.

## The mission (one breath)
Settlement NPC placement is currently a seeded hash-scatter over whatever buildings happen to be
materialized. Tim's design ruling (2026-07-05, verbatim intent): *"folks show up in places that are
explained by their personal story… they show up in their respective buildings or they may be up to
something. Just having them materialize at random won't work."* The test for every placement: **if the
player asks "why is he here?", the answer must already exist.** Placement becomes narration fuel.

## Evidence (self-contained — assume you know nothing beyond this document)
Live-save probe from Tim's actual session (seed default, turn 0, wake scene, node `n0_2935788122`,
player inside `stgen:v27:n0_2935788122:0` room `…:0:2`):
- `occupantsOfRoom(w, 'stgen:v27:n0_2935788122:0', 'room:…:0:1')` → **Carl, Brogan, Scarvein, the
  Lingerer** — four strangers in the sleeping player's entry room at dawn.
- Room `…:0:4` → **Senna the Fox**. `outdoorOccupants(w)` → **Galen** (role `artisan`) only.
- **Scarvein is the seeded HOSTILE bandit** (`ensureHostileNpc`, `engine/decompression/decompress.js`
  ~line 189: `hostile: true`, `combatProfile.canParley: false`). The current model placed an armed
  robber in the player's front room, by accident, with no story attached.
- Root cause: `assignedPlace()` (`engine/structures/roomOccupancy.js` ~line 34) rolls 35% outdoors,
  else uniform over `nodeBuildings()` (~line 24) — which reads `world.structures.byId`, i.e. only
  buildings whose interiors have MATERIALIZED. At wake exactly one is materialized: the player's own
  cottage. Everyone indoors piles into it.

## Read first (targeted; grep to locate, read slices, never whole files)
- `engine/structures/roomOccupancy.js` (whole file — it is small): the current derivation, its
  header comment (derived state, no WORLD_VERSION, worldHash-stable — that contract SURVIVES you).
- `engine/decompression/decompress.js` — grep `role:` / `hostile` / `secrets`: the NPC record shape
  (role, factionId, personality, secrets, epithets in names). This is your story material.
- The settlement's building inventory: trace what `public/map/placeFromNode.js` draws its buildings
  from (imports at top) — you need the ENGINE-SIDE source of the drawn-building list (node settlement
  data / stgen catalog). **The engine must NEVER import from `public/`** — if the ink list turns out
  renderer-only, derive anchors from the same underlying settlement data, not the renderer.
- `world.time.segment` (e.g. 'morning') — the time-of-day input.
- Existing occupancy tests: grep tests/ for `roomOccupancy|occupantsOfRoom|outdoorOccupants` and keep
  every one green or honestly relock with documented reasoning.

## The shape of the fix
1. **REPRODUCE FIRST.** Write U491 as the failing baseline: boot the default world exactly as v1 does,
   assert the wake structure's rooms contain NO strangers and that a hostile NPC is never assigned
   inside a non-anchor building. It must FAIL against current code. If it doesn't, stop and report.
2. **Story anchor derivation** (new module): each roster NPC → ONE anchor among the settlement's
   drawn buildings, derived deterministically from who they are (role, name/epithet, factionId,
   hostile flag, secrets) — kind-matched where building kinds exist, seed-stable so the anchor is
   permanently "theirs" for this world. The player's wake structure is excluded from stranger anchors.
3. **Time-of-day movement**: anchor by day; home/inn/common spaces by evening; outdoor share becomes
   errand spots (well/market/road), all derived, all with reasons.
4. **"Up to something" minority**: seeded per (npc, segment) off-anchor placement carrying a reason
   string (loitering, watching, meeting). Hostiles ALWAYS get purpose-spots (edges, shadows, outside)
   — never idle inside an unrelated interior. (Thread-driven jobs are OCC-STORY-2 — out of scope.)
5. **Every occupant carries its why**: an additive `reason` field (short, narratable, deterministic)
   on the records `occupantsOfRoom`/`outdoorOccupants` return. ADDITIVE ONLY — same functions, same
   signatures, same return shape otherwise; all existing consumers (playloop presence logic,
   placeFromNode tokens, drawModel people) must work UNMODIFIED.
6. U492: story-anchor properties (determinism across two boots of the same seed; anchor stability;
   hostile purpose-spot rule; reason non-empty + from the fixed taxonomy). U493: time-of-day movement
   (same seed, different `time.segment` → placements move, reasons update, still deterministic).

## Invariants that must hold (non-negotiable)
- Occupancy stays a PURE DERIVED read: no new stored world fields, no `WORLD_VERSION` bump, no writes
  outside `effectsCore.applyDeltas` (you make none). `worldHash` untouched by construction — prove it:
  determinism tests U19/U21/U22/U27/U30 green.
- All randomness through `engine/rng.js` seeded streams; zero `Math.random`.
- Line-of-sight model unchanged: outdoors sees outdoor folk, a room sees its room. Only WHO-IS-WHERE
  changes, not who-sees-whom.
- Ledger caps, NPC-at-node dialogue rule, LLM-never-throws: untouched territory.

## Done = verification, not effort
- U491 (was failing) now green; U492, U493 green. Full `node --test` green. `npm run check` GREEN
  (convergence + suite + determinism). `npm run playtest:quick` clean.
- Fresh default boot: wake cottage contains only the player; every placed NPC (indoor + outdoor)
  exposes a non-empty story `reason`; Scarvein is somewhere a bandit would actually be.
- Commit locally in your worktree branch (`feat(occupancy): OCC-STORY-1 — …`). Do NOT push, do NOT
  touch the main checkout — Basecamp integrates.

## Autonomy + honesty
No one is watching. Do not ask questions — take the reversible option and flag it in your report.
Report failures RED, correct premises out loud, document every divergence from this brief. Your final
report ends with a plain-English paragraph: what was broken, what changed, why it matters — Tim reads
it and he is not a coder.
