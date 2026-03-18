# Immortal Engine — Plan

**Philosophy:** Canon is the engine. AI can only describe what the canonical surface says is true. The surface must be correct before AI touches it.

---

## Active Milestone: Canonical Surface v1

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

## Parking Lot

Noted, not active. Do not work on these until Surface v1 is complete.

- Node type system feeds into faction/ecology pressure (wilderness nodes have different pressure profiles)
- Voice output (TTS with good voice)
- Voice input (STT)
- Multiplayer session sync
- Mobile UI
- AI narration layer — **blocked until Surface v1 gates all pass**

---

## Completed

- Player dot moves with cardinal directions (30ft local step)
- Node arrival resets dot to center
- Structure IDs no longer leak into narration (shows "building #1")
- Explore intent signals "observe only — no roll" in mechanics
- Bare directional commands are local movement, not node travel
- Game resets cleanly via `?reset` URL param
