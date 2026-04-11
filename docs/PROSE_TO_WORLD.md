# Prose-to-World — Architecture Spec

**Status:** Draft v1, 2026-04-11
**Depends on:** `engine/csl/`, `packs/`, `engine/world/regions.js`, `engine/map/generateMap.js`, `engine/npc/npcGenesis.js`

---

## Purpose

Enable world authoring via natural-language prose. A creator writes a paragraph (or a page, or a novella) describing a world; an LLM pipeline translates that prose into the engine's canonical pack structures. Output is cached, versioned, and deterministic from then on. The engine runs its normal deterministic-by-seed operation on the cached output.

**Why this matters:** it is the only way to get *dense, cohesive lore* into the engine at the scale the "infinite readable world" vision demands. Hand-authoring every region, faction, NPC, scar, and thread does not scale. Prose-to-world turns "write a compelling world description" into a pack.

---

## Core principle

**The LLM runs at author time, never at runtime.**

Import is a build step that produces a cached artifact. At runtime, the engine loads the artifact and runs deterministically. The same prose + the same importer version → the same pack output, every time. Replay is unaffected because replay never hits the importer.

This is the cleanest use of an LLM imaginable for this problem: natural-language → structured-data, run once, frozen into canon, forever.

---

## Pipeline stages

```
PROSE DOC  →  STAGE 1: STRUCTURE  →  STAGE 2: EXPANSION  →  STAGE 3: SEEDS  →  VALIDATED PACK ARTIFACT
  (input)       (skeleton)            (named entities)      (latent seeds)     (cached, hashed)
```

### Stage 1 — Structure

**Input:** raw prose.
**LLM prompt:** "Extract the high-level structure of this world. Identify regions, factions, cultures, major historical events, motifs. Output JSON matching the provided schema."
**Output:** a structure manifest.

```json
{
  "worldName": "...",
  "tone": ["grim", "hopeful", ...],
  "regions": [
    { "id": "...", "name": "...", "vibe": "...", "threatLevel": 1..5,
      "dominantFaction": "...", "adjacency": [...] }
  ],
  "factions": [
    { "id": "...", "name": "...", "goal": "...",
      "personality": { "scarcity": 0..10, "curiosity": 0..10, ... } }
  ],
  "motifs": [ "..." ],
  "historicalEvents": [
    { "id": "...", "description": "...", "impact": "scar" | "thread" | "myth" }
  ]
}
```

### Stage 2 — Expansion

**Input:** structure manifest from Stage 1 + original prose.
**LLM prompt:** "For each region, generate 2–4 named places, 3–6 named NPCs with archetypes and hooks, and 1–2 local threads. Ground everything in the prose; do not invent contradictory material. Output JSON."
**Output:** expanded entity set per region.

### Stage 3 — Seeds

**Input:** expanded entity set + structure manifest.
**LLM prompt:** "For each place, NPC, and event, generate a latent seed — a structured content fragment that the engine can decompress on first contact. A seed includes: public tags, private truth, garbling hints for rumor propagation, tone words, and tier-0 rumor body."
**Output:** full latent seed catalog.

### Validation

After Stage 3, the importer runs the output through `engine/csl/validator.js` and a new `packValidator.js` that checks:
- All region adjacencies reference real regions.
- All NPC faction refs reference real factions.
- All thread `nodeId` refs resolve.
- No seed is orphaned.
- Motif strings are non-empty.
- Tone vectors are in range.

**If validation fails,** the importer reports the specific failure (which stage, which entity) and **aborts**. It does not silently produce a broken pack.

---

## Artifact format

Each imported pack lives under `packs/{packId}/` alongside the existing hand-authored packs. The imported pack has the same shape as a hand-authored one — the engine does not care which path the pack came from.

**New file:** `packs/{packId}/source.md` — the original prose.
**New file:** `packs/{packId}/import.meta.json` — `{importerVersion, promptHashes, inputHash, generatedAt, modelId}`.

The importer writes directly to `packs/{packId}/` and produces the same files the hand-authored pack produces (`manifest.json`, region data, NPC catalogs, etc.).

**Regenerating a pack** from updated prose: bump the pack version, run the importer again, commit both the updated prose and the updated artifact. Old worlds using the old artifact version continue to replay deterministically — each world pins its pack version.

---

## Pack version pinning

```
world.pack = { primaryId: "fantasy", mixerId: null, version: 7 }
```

A world loads the exact pack version it was created with. This means:
- Old saves are immune to pack updates.
- New saves use the latest pack.
- The `worldHash` projection includes `pack.version`, so two worlds with the same seed but different pack versions hash differently.

Adding version pinning is a `WORLD_VERSION` bump follow-on.

---

## Runtime behavior (unchanged)

At runtime, nothing changes. The engine reads the pack, generates the world via `generateRegions` + `generateInitialMap`, and runs. Rumors mint on top of seeds in the pack. The player cannot tell (and doesn't need to know) whether a pack was hand-authored or prose-imported.

---

## Determinism contract

1. Same prose + same importer version + same model ID → same pack artifact.
2. Importer output is **cached by hash of (prose, importer version, model id)**. Re-running the importer on unchanged inputs skips the LLM calls entirely and reuses the cache.
3. Runtime never calls the importer. Runtime only reads the cached artifact.
4. LLM calls at import time must be logged in `import.meta.json` for audit.

**Caveat — model drift:** if Anthropic updates the Sonnet 4.6 model under the same ID, re-importing the same prose might produce a different artifact. This is acceptable because the importer is a build step and pack version pins the artifact. New imports go into a new pack version.

---

## UI for authoring (post-slice)

Not in the vertical slice. Post-slice, a simple web form at `/author` that:
1. Accepts prose input.
2. Runs the importer live (with a progress indicator).
3. Shows the generated structure for review.
4. Lets the author regenerate any stage with a constraint edit.
5. Publishes the pack to a personal library.

For the slice, the importer is a CLI: `npm run import-pack -- packs/myworld/source.md`.

---

## Worker-pass breakdown (importer only)

1. **P1 — Pack validator.** Write `scripts/packValidator.js` and make it pass against the existing `fantasy` pack. Gate: existing pack validates; a deliberately corrupted pack fails with a useful error.
2. **P2 — Stage 1 importer.** `scripts/import/stage1-structure.js`. Wire to the Anthropic API. Test against a short prose fixture. Gate: fixture produces valid structure JSON.
3. **P3 — Stage 2 importer.** Builds on P2. Gate: fixture produces expanded entities with no dangling refs.
4. **P4 — Stage 3 importer.** Builds on P3. Gate: full pack artifact validates through P1.
5. **P5 — Cache layer.** Hash-keyed cache under `.pack-cache/`. Gate: rerunning the importer on unchanged inputs makes zero API calls.
6. **P6 — CLI entry.** `npm run import-pack`. Gate: `import-pack packs/myworld/source.md` writes a working pack.
7. **P7 — Slice pack.** Write a 1-page prose document describing the slice region. Run it through the importer. Commit both the prose and the artifact.

---

## Test gates

- **I10 — Stage 1 shape:** fixture prose → structure JSON conforming to schema.
- **I11 — Stage 2 no orphans:** no faction ref without a faction definition.
- **I12 — Stage 3 seed coverage:** every place/NPC/event has a latent seed.
- **I13 — Pack validator strict:** validator rejects known-bad inputs.
- **I14 — Cache determinism:** same input hash → same output (byte-equal).
- **I15 — Pack version pinning:** worlds created with pack v1 still load after pack v2 exists.

---

## Non-goals

- Runtime prose injection by the player. (Considered; postponed. It's genuinely interesting but risky — the garbling and rumor layers need to be battle-tested first.)
- Multi-prose merging.
- Authoring UI.
- Prose-to-ruleset (we're keeping 5e-lite as the fixed ruleset for now).
