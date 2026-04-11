# Immortal Engine — Plan

**Philosophy:** Canon is the engine. AI can only describe what the canonical surface says is true. The surface must be correct before AI touches it.

---

## Current North Star (2026-04-11)

**An infinite, deterministic, AI-narrated RPG with full tabletop crunch, dense authored lore, and a world that never stops surprising the player.**

Canonical vision docs (read these first):
- [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md) — the one-page vision and the three load-bearing ideas
- [`docs/CRUNCH_V1.md`](docs/CRUNCH_V1.md) — stats, items, spells, bestiary, loot, XP (5e-lite ruleset)
- [`docs/RUMOR_LAYER.md`](docs/RUMOR_LAYER.md) — distance-weighted rumor collapse from distant latent seeds
- [`docs/PROSE_TO_WORLD.md`](docs/PROSE_TO_WORLD.md) — author-time LLM pipeline: prose → canonical pack
- [`docs/SLICE_PLAN.md`](docs/SLICE_PLAN.md) — vertical slice worker-pass breakdown

**Supersedes:** the finite-arc framing in `docs/VICTORY_LADDER_MVP_v1.md` and `docs/CAMPAIGN_LIFECYCLE_SPEC_v1.md`. Those docs remain as history; when they conflict with the north star, the north star wins. They'll be rewritten post-slice.

**Active work:** vertical slice (see `docs/SLICE_PLAN.md`). Pass S1 (UI surface spine) is the first worker pass.

---

## Historical Milestone: Canonical Surface v1

**Goal:** The world the player inhabits must be real and honest. Every place has a type, every place generates content appropriate to that type, and entering/exiting structures produces verified state changes. Only when this is true is the surface ready for an AI narrator.

**Status: ✅ COMPLETE — all 6 gates passed, 204 tests green**

---

### Gates

#### ✅ S1 — Node type classification
- Every map node has a deterministic type: `settlement`, `wilderness`, `landmark`, or `dungeon_entrance`
- Type is derived from the node's seed + pack tags (not random at runtime)
- **Test:** same seed always produces same type for same node — **178 tests pass**

#### ✅ S2 — Local projection respects node type
- `settlement` nodes get road graph + building plots
- `wilderness` nodes get terrain features (no roads, no buildings)
- `landmark` nodes get one significant structure, no road grid
- `dungeon_entrance` nodes go straight to interior
- **Test:** wilderness node produces no buildings; settlement node produces at least 2 — **185 tests pass**

#### ✅ S3 — Player position is honest
- `localFtX` / `localFtY` always reflect where the player actually is
- Dot renders at correct position on local map
- Node arrival resets position to (0,0)
- **Test:** 3 moves north = `localFtY` of -90 — **190 tests pass**

#### ✅ S4 — Structure enter/exit is a real state change
- Entering a structure sets `scene.interior` with a valid `structureKey` + `roomId`
- Exiting clears `scene.interior` and returns player to node
- Re-entering the same structure produces identical interior layout (determinism)
- **Test:** enter → export → import → re-enter same structure = same `roomId` — **195 tests pass**

#### ✅ S5 — Room navigation inside a structure
- Player can move between rooms via door adjacency
- Current `roomId` updates in world state
- Attempting to move to a non-adjacent room is blocked
- **Test:** move to adjacent room succeeds; move to non-adjacent room is rejected — **200 tests pass**

#### ✅ S6 — Surface is stable under replay
- Given the same seed + same sequence of inputs, the world hash is identical
- No randomness leaks into the surface from projection or rendering
- **Test:** replay 10 turns from same seed = identical `worldHash` — **204 tests pass**

---

---

## Historical Milestone: AI Narration v1

**Goal:** The AI narrator describes only what the canonical surface says is true. It knows the place type, the structures, the room, the tone. It cannot invent topology. If the API is unavailable, the game continues silently with base narration.

**Model:** `claude-sonnet-4-6`

**Status: ✅ COMPLETE — all 6 gates passed, 236 tests green**

---

### Gates

#### ✅ N1 — Surface context reaches the narrator
- `buildNarratorContext(world, outcome)` emits a structured object: place name, nodeType, structures present, interior state (room if inside), pack tone words
- The narrator cannot describe what it doesn't know — this is the data contract
- **Test:** pure function, no API. All 4 nodeTypes produce distinct context objects.

#### ✅ N2 — Anthropic API replaces OpenAI
- `callLLM` posts to Anthropic's Messages API (`/v1/messages`) with correct headers
- Falls back silently if key is absent
- **Test:** real API call with key from env returns a non-empty string

#### ✅ N3 — Prompt is grounded — narrator cannot invent topology
- System prompt explicitly names what is canonical and includes "do not invent"
- Each nodeType produces a distinct system prompt
- **Test:** verify system prompt string for each nodeType contains correct canonical facts

#### ✅ N4 — Grounding guard catches node-type violations
- `validateNarrationCandidate` extended: wilderness narration must not mention roads/buildings; dungeon narration must not mention open sky
- **Test:** unit test validator with violating strings for each nodeType

#### ✅ N5 — Pack tone shapes narration voice
- `toneWords` from the pack (cooperative/grim/blood) are injected into the system prompt
- Grim and cooperative packs produce demonstrably different prompts
- **Test:** prompt strings differ by tone profile

#### ✅ N6 — Narration integrates into playloop
- `playerMove` returns real AI narration in `output.narration` instead of "Wizard: ..."
- Offline/error path falls back to base narration silently, no throws
- **Test:** integration test with real key; null-key test proves silent fallback

---

## Parking Lot

- Node type system feeds into faction/ecology pressure (wilderness nodes have different pressure profiles)
- Voice output (TTS with good voice)
- Voice input (STT)
- Multiplayer session sync
- Mobile UI

---

## Completed

- Player dot moves with cardinal directions (30ft local step)
- Node arrival resets dot to center
- Structure IDs no longer leak into narration (shows "building #1")
- Explore intent signals "observe only — no roll" in mechanics
- Bare directional commands are local movement, not node travel
- Game resets cleanly via `?reset` URL param
