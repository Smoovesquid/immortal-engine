# Campaign Lifecycle Spec v1.0 (Revised)

> **Status:** Superseded by `NORTH_STAR.md`. The finite-arc campaign model (convergence triggers, ending thresholds, sequel chaining) has been retired. This document is revised to describe the current campaign lifecycle.

---

## 1. Campaign creation

A campaign is a deterministic world instance created from:

- **seed** -- drives all RNG via `engine/rng.js`
- **pack** -- content pack (e.g. `fantasy`), versioned and pinned at creation
- **chargen choices** -- archetype (currently Wanderer), stat allocation, skill foci, background, starting gear

**Entry point:** `engine/playloop.js` `beginAdventure()` calls `engine/state.js` `newWorld()` to materialize the world, then runs `engine/chargen/` to apply player choices. The player wakes in their home village bedroom.

**Determinism contract:** same seed + same pack version + same chargen choices = identical initial worldHash.

---

## 2. Play loop

Each player turn flows through:

1. **Player input** -- free text parsed into an intent (move, talk, cast, examine, etc.)
2. **Guard** -- `engine/guard.js` validates the input against canon (prevents impossible actions)
3. **Resolution** -- `engine/resolve.js` rolls d20 vs DC using stats, proficiency, and equipped gear
4. **Delta generation** -- resolution produces structured deltas
5. **Mutation** -- `engine/effectsCore.js` `applyDeltas()` applies all state changes (sole mutation path)
6. **World tick** -- `engine/worldTick.js` advances factions, threads, ecology, scars, and rumor aging/propagation
7. **Canon Log** -- all meaningful transitions are recorded as canonical events via `engine/csl/`
8. **Narration** -- `engine/composer.js` assembles structured output; `engine/llmAdapter.js` optionally polishes it via Claude (silent fallback on failure)
9. **Invariant check** -- `engine/invariants.js` `assertWorldInvariants()` runs on every `ensureWorld()` call

**Key subsystems active during play:**
- **Combat** -- `engine/combat/combatResolve.js` reads equipped weapons/armor, uses bestiary stat blocks
- **Spells** -- `engine/spell/castSpell.js` handles slot tracking, concentration, typed effects
- **NPC dialogue** -- `engine/npc/dialogue.js` with `npcBrain.js` for personality-aware decisions via local LLM (Ollama) or rule-based fallback
- **Rumor surfacing** -- `engine/rumor/mint.js` lazily mints rumors when NPCs mention distant latent seeds; cached in Canon Log forever
- **Decompression** -- `engine/decompression/decompress.js` materializes latent content on player contact
- **Goals** -- `engine/goals/goalContract.js` tracks reach/obtain/talkTo/learn/defeat objectives

---

## 3. Canon Log authority

`engine/csl/` (schema, validator, serializer, grammar, latent, domains) maintains the canonical event stream. If Canon Log and world state diverge, Canon Log is authoritative.

Canon Log records:
- State transitions (scene, travel, resolution, thread shifts, scar formation)
- Rumor events (minted, propagated, verified, forgotten)
- NPC decisions (canonized for replay determinism)
- Combat outcomes, spell casts, loot drops

---

## 4. Rumor system

Distant latent seeds announce themselves through NPCs carrying garbled, distance-attenuated rumors. Key properties:

- **Tier computation** is deterministic: `clamp(hopCount - carrierSophistication + floor(age/10), 0, 4)`
- **Minting** is lazy (first surfacing only) and cached in Canon Log -- never regenerated on replay
- **Propagation** occurs via `worldTick` -- rumors age, spread to adjacent NPCs, and eventually fade
- **Verification** happens when the player reaches the source seed

See `docs/RUMOR_LAYER.md` for the full architecture.

---

## 5. World persistence and the infinite model

Campaigns do not have convergence triggers or forced endings. The world persists across sessions as chapters of a continuous story.

**Ending states that remain real:**
- Player character dies in combat
- Player chooses to retire the character (chronicle export)

**What persists:** threads, scars, NPC relationships, discovered locations, rumor board, inventory, level/XP, Canon Log.

---

## 6. Save / load

`engine/save.js` handles export/import:

- **Export** serializes the full world state including Canon Log
- **Import** restores and runs `ensureWorld()` for migration safety
- **Version pinning** -- worlds pin their `WORLD_VERSION` and pack version; old saves warn before upgrade
- **Roundtrip invariant** -- export then import produces identical worldHash

---

## 7. Replay guarantee

**Invariant:** same seed + same transcript = same canonical log + same worldHash.

LLM outputs (narration, NPC decisions, rumor bodies) are canonized at first evaluation. On replay, the engine reads from Canon Log instead of querying the model. The LLM is never a source of nondeterminism.

---

## References

- `docs/NORTH_STAR.md` -- canonical vision
- `docs/ARCHITECTURE_OVERVIEW.md` -- high-level engine model
- `docs/DETERMINISM_DOCTRINE.md` -- determinism rules
- `docs/CRUNCH_V1.md` -- RPG mechanical substrate
- `CLAUDE.md` -- engine map and purity rules
