# Rumor Layer — Architecture Spec

**Status:** Draft v1, 2026-04-11
**Depends on:** `engine/csl/latent.js`, `engine/scene/latentProjection.js`, `engine/npc/perspectiveFilter.js`, `engine/ledger.js`, `engine/worldTick.js`, Canon Log

---

## Purpose

Make the world feel lived-in by leaking partial information about distant latent content through the NPCs the player can actually reach. Rumors are the bridge between the canonical-but-hidden parts of the world and what the player experiences.

---

## Core contract

A **rumor** is a canonical, immortal record of a piece of information about a latent seed, carried by a specific NPC, at a specific fidelity tier, known to the engine at the turn it was minted.

```
Rumor = {
  id:            string,       // stable, deterministic
  sourceSeedId:  string,       // the latent seed this rumor is about
  carrierNpcId:  string,       // who knows it
  hopCount:      int,          // distance from source at mint time
  tier:          0..4,         // fidelity: 0 = truth, 4 = "bad news somewhere"
  age:           int,          // turns since mint
  mintedAt:      int,          // world.time.turn at mint
  body:          string,       // LLM-generated prose at the computed tier
  tags:          string[]      // topic tags for dialogue matching
}
```

Rumors live in `world.rumors[]` and are serialized as canonical events in Canon Log. They are **never regenerated** on replay.

---

## Fidelity tiers

Deterministic function of `(hopCount, age, carrierType)`.

| Tier | Name             | What survives                                        |
|------|------------------|------------------------------------------------------|
| 0    | Truth            | All facts, all framings, named entities              |
| 1    | Fresh            | Correct facts, slightly off framing or motive        |
| 2    | Distorted        | Correct framing, wrong details, garbled names        |
| 3    | Rumor            | A name + a direction + an emotional tone             |
| 4    | Whisper          | Vague dread. "Bad news from the east."               |

**Tier computation (deterministic):**

```
baseTier = clamp(hopCount - carrierSophistication, 0, 4)
agedTier = clamp(baseTier + floor(age / 10), 0, 4)
```

Where `carrierSophistication` is an NPC property (0 = shut-in, 1 = townsfolk, 2 = traveler, 3 = priest/scholar, 4 = spymaster).

**Rule:** tier is computed in the engine. The LLM is told "write a tier-2 distortion of this seed for this carrier" — it never picks the tier itself.

---

## Lifecycle

### Mint
Rumors are minted **lazily, on first surfacing**. Surfacing is triggered when:

1. Player asks an NPC about a topic tag that matches a reachable latent seed.
2. Player enters dialogue with an NPC who has a "notable" reachable seed within hop range and the NPC's canonical topic pool is empty.
3. `worldTick` notices an NPC has been idle and rolls a deterministic "gossip" event.

On mint:
- The engine picks the seed, carrier, hop count, and tier.
- The LLM is called with a tight prompt: `{seed_summary, tier, carrier_persona, tone}` → prose body.
- The result is wrapped in a Rumor object, assigned a deterministic id (`rumor:{seedId}:{carrierId}:{mintTurn}`), and appended to `world.rumors` via `effectsCore.applyDeltas` using a new op `mintRumor`.
- The full rumor is written to Canon Log as event `rumor.minted`.

**LLM failure fallback:** if the LLM call fails, the engine synthesizes a deterministic placeholder body from the seed's public tags and the tier (e.g. tier 3: `"They say there's something about ${seed.primaryName} over in ${seed.direction}."`). The placeholder is canonized just like an LLM body — it is NOT regenerated on success later.

### Propagation
`worldTick.js` ticks rumors forward:
- `age` increments on each scene transition.
- Rumors at `age > 30` may propagate to adjacent NPCs at `tier + 1` (gossip spread). Deterministic RNG.
- Rumors at `age > 60` may be forgotten (removed from carrier but archived in Canon Log for replay fidelity).

### Query (dialogue)
When the player asks an NPC about a topic, `perspectiveFilter` now checks:
1. The NPC's directly-witnessed facts (existing behavior).
2. The NPC's carried rumors (new).
Rumors are returned with their tier and body.

### Validation
A rumor about a distant seed can be **verified** by reaching the seed. When the player decompresses the source seed, the engine marks matching rumors with `verified: 'true' | 'false' | 'partial'` based on how well the rumor's body matches the now-canonical truth. This is a comparison, not a mutation — the original rumor body is immutable.

---

## State shape changes

### New: `world.rumors[]`
Array of Rumor objects. Capped at 64 per world; oldest forgotten rumors evict first (but remain in Canon Log).

### New: `npc.rumorIds[]`
Each NPC carries a list of rumor IDs they know. Enforced by invariant: every ID in `npc.rumorIds` must exist in `world.rumors`.

### New: `npc.sophistication: 0..4`
Determines how much tier garbling they resist.

### New: `effectsCore` op `mintRumor`
```js
{ op: 'mintRumor', rumor: Rumor }
```

### New: `effectsCore` op `forgetRumor`
```js
{ op: 'forgetRumor', rumorId: string }
```

### New: Canon Log event types
- `rumor.minted` — full rumor payload.
- `rumor.propagated` — `{rumorId, fromNpcId, toNpcId, newTier}`.
- `rumor.verified` — `{rumorId, verdict}`.
- `rumor.forgotten` — `{rumorId, carrierId}`.

### `WORLD_VERSION` bump
From 15 → 16. Follow the `CLAUDE.md` checklist including `worldHash.browser.js` and `projectForHash` allowlist.

---

## Invariants

1. Every `npc.rumorIds[x]` references a real rumor in `world.rumors`.
2. Every rumor's `carrierNpcId` references a real NPC (or is archived with carrier=`''`).
3. Rumor `tier` in 0..4.
4. Rumor `sourceSeedId` references a real latent seed in Canon Log's seed registry.
5. `world.rumors.length` ≤ 64.
6. A rumor's `body` is non-empty.
7. Once minted, a rumor's `id`, `sourceSeedId`, `mintedAt`, and `body` are immutable. Only `age`, `tier` (on propagation), and `verified` can change.

---

## Determinism contract

- Rumor minting is deterministic given `(seed, canonLog)`.
- LLM failure fallback is deterministic.
- On replay from Canon Log, no LLM call is made — rumors are loaded from the `rumor.minted` events.
- `worldHash` projection includes `world.rumors` (id, tier, age, verified — NOT body, since body is immutable and body changes are impossible).

---

## Budget model

- Rumor minting is the only runtime LLM call introduced by this feature.
- Worst case: 1 mint per dialogue turn where the player asks about a new topic.
- Budget cap: max 3 rumor mints per scene transition (batch if more would fire; rest deferred to next turn).
- Typical session of 50 turns: ~15–25 rumor mints. At ~150 tokens each, ~3k tokens per session. Negligible cost.

---

## UI surface

A **Rumor Board** panel in the UI surface pass. Replaces / absorbs the "Goal Tracker" panel from the previous UI plan, because **rumors are soft goals** — half-facts the player chooses whether to chase.

Each rumor renders as:
- Body text
- Carrier NPC name + location
- Age + tier indicator (subtle — e.g. a fade or fuzz)
- Verification state if known
- Tags for topic filtering

---

## Test gates

- **U70 — rumor mint determinism:** Same seed + same dialogue trigger → same rumor (excluding LLM body, which uses deterministic fallback in tests).
- **U71 — canon log roundtrip:** Mint rumor, export, import, `worldHash` equal.
- **U72 — tier computation:** Fixed fixture of `(hopCount, age, sophistication)` tuples → fixed tier outputs.
- **U73 — invariant: rumor references:** Dangling `npc.rumorIds[x]` throws.
- **U74 — propagation:** worldTick at age 31 propagates adjacent NPCs deterministically.
- **U75 — verification:** Decompressing source seed after a rumor exists updates `verified` correctly.
- **U76 — LLM fallback:** Failing LLM produces deterministic placeholder, still canonized.

---

## Open questions

1. **Rumor tags vs topics:** do rumors piggyback on existing NPC dialogue topics, or is the rumor tag system separate? (Lean: separate, rumor tags bubble up as topics when relevant.)
2. **Player-authored rumors:** should the player be able to *seed* a rumor by writing prose (e.g. "I spread the word at the tavern that the mayor is corrupt")? This is genuinely interesting but belongs in a later pass.
3. **Rumor contradiction UI:** when two NPCs have contradictory rumors about the same seed, does the UI surface the conflict, or let the player discover it organically through re-reading? (Lean: organic, with a subtle "contested" marker only after the player has seen both.)
