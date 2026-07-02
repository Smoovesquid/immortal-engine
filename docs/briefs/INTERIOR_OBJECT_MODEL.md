# The Interior Object/Space Model — root diagnosis & design

*Fable brief output, 2026-07-01. Target symptoms: WB-Q2 / WB-Q3 / WB-Q5 / WB-Q9 (dialogue-invents-space), from `docs/playtests/harness/WHOLE_BUILDING_FINDINGS.md`. Precedent studied: WB-Q1/WB-F5.*

---

## 1. The root — hypothesis CONFIRMED, with a sharper statement

The brief's hypothesis was: *there is no single authoritative "room state" that the resolver
and every narration/dialogue sink read from; each layer improvises and they diverge.*
**Confirmed** — but the code says something more specific and more actionable:

**The engine has TWO disjoint object models, and FIVE consumers each assemble their own
partial answer to "what exists here." No two consumers agree, and two of the five
(the DM prompt and the dialogue voice) get NO object facts at all — so they invent.**

### 1a. The two object models

**Model A — `node.furniture`: stored, NODE-scoped, mutable. The interaction canon.**
- Born at decompression: `generateNodeFurniture(nodeId, seed)` picks 2–4 *distinct*
  templates (wooden table, iron-bound chest, straw pallet…) per **node** —
  `engine/decompression/generateFurniture.js:179-210`, stored on the map node at
  `engine/decompression/decompress.js:53-58` (and sync path `:164-168`).
- Mutated via `applyDeltas` ops `modifyFurniture` / `removeFurniture`
  (`engine/effectsCore.js:801-812` — note `removeFurniture` **splices**, so indexes shift).
- Read by every interaction gate: the interior look-around survey
  (`engine/grace/gracefulAdjudication.js:2491`), object-presence answers
  (`engine/playloop.js:1640`), `furnitureNameAt` (`playloop.js:5778`),
  `tryContainerReveal` (`playloop.js:5854`), `tryReadRevealedContainerItem`
  (`playloop.js:5891`), `tryFurnitureStateChange` (`playloop.js:5937`), and the physics
  detection layer (`engine/llmPhysics.js:33,230,404`).
- **It has no room dimension whatsoever.** That is WB-Q5 verbatim: the same chest,
  pallet, lantern, and basin are listed in every room of the cottage, because they are
  attached to the node and every reader is node-global.

**Model B — `roomDetail(room).furniture`: derived, ROOM-scoped, immutable. The
tactical/visual canon.**
- A pure function of the room id alone (`engine/structures/roomDetail.js:271-321`):
  building type → room role → role-appropriate furniture with positions, cover tiers,
  light, loot flags.
- Consumed ONLY by the render/combat layer: `floorPlan.js:122`, `coverFeatures.js:22`,
  `roomWindows.js:36`. Its header (`roomDetail.js:22-27`) claims "SINGLE SOURCE OF
  TRUTH … the combat resolver, the floor-plan render, and DM narration all read the SAME
  room from here" — **the DM-narration third of that claim is false.** No narration or
  interaction path reads it.

So the tactical map draws a bed, nightstand, chest, and wardrobe in the bedchamber
(Model B), while the prose survey in that same room lists the node's wooden table, straw
pallet, oil lantern, and stone basin (Model A) — and lists the *same four* again in the
scullery. The map and the prose describe different worlds (a standing violation of the
map-fidelity rule, `feedback_map_fidelity_rule`).

### 1b. The five consumers and what each one actually sees

| Consumer | What it reads | Room-scoped? | Objects? | Cited |
|---|---|---|---|---|
| Look-around survey | Model A + `occupantsOfRoom` + `roomWindows` + topology | people/windows/doorways YES, **objects NO** | Model A, node-global | `gracefulAdjudication.js:2447-2576` |
| Resolver gates (open/search/examine/presence/physics) | Model A only | **NO** | Model A, node-global | `playloop.js:1640,5774-5971`; `llmPhysics.js:33-61` |
| DM narration prompt | `buildScene` → `interior.layout` (geometry only) + **whole settlement roster** | geometry YES, people NO | **NONE — invents** | `narratorContext.js:387-391,437-449`; `llmAdapter.js:52-63,113-118` |
| Dialogue voice (`/api/npc-voice`) | npc personality/facts/rumors/manner — **no world at the route** | **NO spatial input at all** | **NONE — invents** | `npcBrain.js:68-109`; `public/v1.js:594-609`; `llmAdapter.js:411`; `server/npcVoicePrompt.js:17` |
| Failed-roll floor (`genericGroundedOutcome`) | raw text + place NAME | **NO** | regex-extracted from text only | `playloop.js:6793-6906` |

Three details worth pinning, because they are the mechanism of the symptoms:

- **WB-Q9 (dialogue invents space):** the npc-voice payload (`public/v1.js:594-609`)
  carries `npcName, role, mood, manner, trust, mode, factPhrase, playerLine, …` — no
  location, no building, no room. `engine/llmAdapter.js:411` says it outright: *"there is
  NO `world` object at this route."* And the SHARE instruction
  (`server/npcVoicePrompt.js:17`) explicitly licenses *"invent small local color."*
  "Guest rooms upstairs" in a single-storey cottage is that license operating exactly as
  written, with zero spatial facts to constrain it. The WB-F5 fix went to `buildScene` →
  both DM prompts; the dialogue path bypasses `buildScene` entirely.
- **WB-Q5's second half (DM invents furniture):** the DM prompt's CANONICAL FACTS block
  (`llmAdapter.js:113-118`) contains the WB-F5 geometry line but **no object line** — the
  interior context is `{structureKey, roomId, layout}` only (`narratorContext.js:390`).
  The DM doesn't contradict object canon out of malice; it is never shown any.
- **WB-Q8's enabler (in passing):** `buildNPCsPresent` (`narratorContext.js:443-445`)
  hands the DM the **entire settlement roster** with no in-the-room marker, while the
  survey carefully applies room-occupancy line-of-sight. The DM can voice Elske into a
  room she isn't in because nothing tells it who is actually present.

### 1c. Refinement — WB-Q3 and WB-Q2 are only PARTLY this root

Honesty about the harness evidence (run `-15-48-57`, turns 19/21):

The t19 player text was **"I head back to my room and open that iron-bound chest I saw
there this morning."** — a *compound* intent (move + open). `tryFurnitureStateChange`
requires `classifyTrivial` to parse `open <object>` from the text; the leading "head back
to my room and…" defeats it, every regex gate falls through, and the action lands on the
generic d20 (`resolveMove`) → gen-bank success line "You manage it, and the way ahead
opens a little" (`playloop.js:6903`). The immediate next turn, plain "I look inside the
chest," hit `tryContainerReveal` and worked perfectly. So WB-Q3-as-observed has **two**
causes: (1) no room-scoped object context (this doc's root — the engine can't reason
"the chest is in the bedchamber, you're in the hearth room, this is a move-then-open"),
and (2) **compound intents fall off the regex-gate chain** — a routing gap the shared
room-state does not by itself fix. It gets its own packet (P5).

WB-Q2 has been partly addressed since the findings snapshot: `genericGroundedOutcome`
now names a concrete direct object when it can extract one (`genericActionObject`,
`playloop.js:6793-6803`, the IT-5 fix) and has verb-class banks. The residuals are
(a) the extractor is single-clause-anchored, so compound sentences yield '' and fall to
place-filler; (b) the floor has no room state to ground against; and (c) a literal
template bug: `const what = takeTargetOf(t) || 'it'` interpolated into "You reach for
the ${what}" produces **"reach for the it"** (`playloop.js:6839-6842`) — the exact t11
text bug from the findings. Packet P4.

**Also noted:** `engine/objects/query.js` (an object-query layer over Model A) has no
importers anywhere in `engine/`/`server/` — it is dead-ish code. Don't build on it;
don't touch it in these packets.

---

## 2. Target architecture — one deriver, every sink

**One authoritative, engine-owned answer to "what is in THIS room right now," derived
(not stored), consumed by the resolver and every narration/dialogue sink.** This
generalizes the WB-F5 pattern (engine-owned view → prompt fact) exactly as the brief
suspected, and it follows the codebase's own repeatedly-proven idiom for room-grained
truth: `roomOccupancy` (derived, seeded, "no WORLD_VERSION bump, worldHash stays stable"
— its own header, `roomOccupancy.js:1-9`), `roomWindows`, `containerContents`,
`roomDetail`.

```
engine/structures/roomState.js  (P2 — thin façade over existing derivers + P1)

getRoomState(world) -> {
  inside: boolean,
  structureId, roomId,
  building: { type, roomCount, singleStorey: true },   // describeInteriorLayout
  room:     { name, role, dark },                      // roomDetail
  atEntry, doorways,                                   // describeInteriorLayout
  objects:  [ { name, state, category, notes, nodeIndex } ],  // P1: room-scoped Model A
  occupants: [ npc, … ],                               // occupantsOfRoom / outdoorOccupants
  windows:  { count, shuttered },                      // roomWindows
}
```

Consumption contract (the invariant this cluster establishes): **no consumer answers a
"what/who is here" question from `node.furniture`, `settlement.npcs`, or raw topology
directly.** They all go through the deriver:

- **Resolver gates** match player text against `objects` (which carry `nodeIndex`, so the
  existing `modifyFurniture`/`removeFurniture` deltas keyed `(nodeId, index)` are
  untouched).
- **`buildLocationSurvey`** renders it (it already reads occupants/windows/doorways this
  way — only its object line changes).
- **`buildScene` → DM prompts** gains `interior.objects` and per-NPC in-the-room flags;
  `interiorLayoutFact` grows one object-facts line beside the WB-F5 geometry line.
- **npc-voice payload** gains a compact `sceneFacts` block assembled engine-side and
  passed through the existing client→server plumbing.
- **`genericGroundedOutcome`** checks a named object against `objects` (here vs. in a
  sibling room) before falling to place-filler.

### The object-source decision: partition Model A now, converge on Model B later

Two candidate sources for `objects`:

- **(A) Room-scope the stored `node.furniture`** by a pure, seeded partition — each of
  the node's 2–4 pieces is assigned to exactly one room. No schema change, no
  WORLD_VERSION bump, hash-identical, mutation path untouched. Small blast radius.
- **(B) Adopt `roomDetail`'s per-room furniture** as the physical truth everywhere.
  Spatially richer and it *is* what the map draws — but it is immutable, so it needs a
  stored mutation-overlay (state per furniture id) = new world shape = WORLD_VERSION
  bump + migration + invariants + every physics op re-keyed. Large blast radius.

**Decision: (A) is the foundational packet; (B) is the destination, staged as P6.**
The room-state *interface* hides the source, so swapping A→B later is contained inside
the deriver + one mutation-overlay packet. To pull the two models toward each other
immediately, the P1 partition uses **role-affinity**: a piece prefers rooms whose
`roomDetail` loadout contains a kindred kind (straw pallet → the room that draws
beds/bedding; stone basin → the room that draws a basin; iron-bound chest → the room
that draws a chest). The prose and the drawn map start agreeing about *where things
are* even before the catalogs merge.

---

## 3. Packetized plan

Ordered so P1 lands the foundation and makes every later packet a small consumer-side
change. Each is one bounded file-set; a Sonnet/Codex worker can implement from this
section without re-deriving anything above.

### P1 — FOUNDATIONAL: room-scoped object attachment (Model A partition)

**Files:** `engine/structures/roomObjects.js` (new), `engine/playloop.js`,
`engine/grace/gracefulAdjudication.js`, `engine/llmPhysics.js`,
`tests/U307.roomScopedObjects.test.js` (new).

**Build:**
1. `roomObjects.js` exports:
   - `furnitureRoomAssignments(world, nodeId)` → `Map<pieceName, {structureId, roomId}>`.
     Pure + seeded: for each piece in `node.furniture` (names are unique per node —
     `generateNodeFurniture` picks distinct templates, `generateFurniture.js:186-192`),
     collect all rooms of all structures at the node that have a normalized topology
     (sorted by structureId then roomId); filter to rooms whose
     `roomDetail(room, st.buildingType)` furniture kinds intersect the piece's affinity
     set (table→table/longtable, chair→chair/bench, chest→chest, lantern→lantern/candles,
     basin→basin/font, crate→crate/barrel, brazier→brazier/firepit/hearth,
     pallet→bedding/bed, rack→rack/shelf); if the filter is empty use all rooms; pick via
     `makeRng(seedFromString(`${seed}|${nodeId}|furn-room|${name}`))`. **Key by NAME, not
     index** — `removeFurniture` splices (`effectsCore.js:806-809`), so index-keyed
     assignment would let surviving pieces hop rooms after a removal.
   - `objectsHere(world)` → `[{ piece, nodeIndex }]` for the player's position:
     not inside a structure → the full node list (current behavior, unchanged);
     inside a structure with no topology or a single room → the full node list
     (matches `occupantsOfRoom`'s bare-fixture fallback, `roomOccupancy.js:72`);
     inside a room of a multi-room structure → only pieces assigned to
     `(interior.structureKey, interior.roomId)`.
2. Switch the Model A readers to `objectsHere` (each keeps its own matching/rendering
   logic; only the *candidate list* changes): survey features line
   (`gracefulAdjudication.js:2491`), presence gate (`playloop.js:1640`),
   `furnitureNameAt` (`:5778`), `tryContainerReveal` (`:5854`),
   `tryReadRevealedContainerItem` (`:5891`), `tryFurnitureStateChange` (`:5937`),
   `llmPhysics` detection + fallback (`:33`, `:230`, `:404` — deltas still emit the
   node-level `furnitureId` from `nodeIndex`).

**Test plan (U307):** same world → same assignment (determinism, twice); every piece
assigned to exactly one room; assignments unchanged after a `removeFurniture` splice of
a sibling piece; on a multi-room interior the survey feature lists of two different
rooms are disjoint and their union covers the node list; affinity smoke (a bed-kindred
piece lands in a bed-drawing room on a concrete seed); no-topology and outdoors
fallbacks preserve the full list; open-chest flow (move to the chest's room → open →
reveal) still auto-succeeds; deriver never mutates the world.

**Done-when:** full suite green (`node --test`), corpus convergence green
(`npm run convergence`), determinism gates U19/U21/U22/U27/U30 green, and a `tallow`
interior look-around lists a *different, smaller* object set per room.

**Behavioral note for the implementer:** some existing tests may drive "open the chest"
from a room the partition doesn't put the chest in. Those are the bug being fixed —
adjust the drive to walk to the piece's room (or use a single-room/no-topology fixture),
never weaken the partition to make a test pass.

### P2 — the façade + the DM prompt learns the room's objects and occupants

**Files:** `engine/structures/roomState.js` (new façade as specced in §2),
`engine/ai/narratorContext.js`, `engine/llmAdapter.js`, N-prefix test.

`buildScene` (`narratorContext.js:387-391`): `interior` gains `objects` (name+state,
cap ~6) from `getRoomState`. `buildNPCsPresent` (`:437-449`): add a per-NPC
`inRoomWithPlayer` boolean (derived from `occupantsOfRoom` when inside /
`outdoorOccupants` when out) — *add the flag, don't filter the roster*, since downstream
dialogue continuity reads the full list. `interiorLayoutFact` (`llmAdapter.js:52-63`):
one added fact line naming the room's real objects ("In this room: a straw pallet, an
iron-bound chest (open). These are the room's furnishings — do not invent others you
expect the player to act on."), and the NPCs-present block marks who is actually in the
room. Facts only — no change to voice/style lines (taste lane).
**Done-when:** N7 stays green; a new N-test asserts the prompt contains the room's real
object names and marks an out-of-room NPC as not-in-the-room.

### P3 — the dialogue voice stops inventing space (WB-Q9)

**Files:** `engine/playloop.js` (the dialogue-output assembly that already carries
`factPhrase`/`mood`/`manner` — grep `factPhrase:` near `playloop.js:1008`),
`public/v1.js:594-609` (payload passthrough), `server/routes` for `/api/npc-voice` +
`server/npcVoicePrompt.js`, `engine/llmAdapter.js:411-465`, prompt-builder unit test
(`npcVoicePrompt` is a pure function — its own header says testable without a model).

Attach `sceneFacts` from `getRoomState` engine-side: `{ buildingType, roomCount,
singleStorey, roomName, doorways, objects: names≤5 }`. Forward it through the client
call and render it in the prompt as a WHERE-YOU-ARE facts block with one grounding rule
(the WB-F5 clause, adapted: *speak only of rooms, floors, and furnishings listed here; a
single-storey building has no upstairs*). This adds facts and a constraint; existing
manner/decision wording untouched. Mind the existing withheld-mode leak guard
(`llmAdapter.js:452-458`) — scene facts must not enter the leak-check denylist.
**Done-when:** unit test proves the rendered prompt contains the real layout facts and
the rule; a live probe (LLM on, `.env` key, CLI) shows an NPC in the tallow cottage no
longer offering upstairs rooms.

### P4 — the failure floor grounds in the room (WB-Q2 residual + the "the it" bug)

**Files:** `engine/playloop.js` only (+ unit tests on the exported
`genericGroundedOutcome`).

Fix `takeTargetOf(t) || 'it'` → article-safe fallback ("You reach for it," never "the
it") at `playloop.js:6839-6842`. Extend `genericActionObject` (`:6793-6803`) to scan
clause-by-clause (split on `,;` and ` and `) so a compound sentence still yields the
acted-on object. When the named object matches `objectsHere` in a *sibling* room, say so
concretely ("the iron-bound chest is back in the bedchamber — nothing like it here")
instead of the place-generic. Keep every line in the existing banks' voice.
**Done-when:** t11/t19-shaped inputs produce intent-naming, room-true prose in unit
tests; suite green.

### P5 — compound move-then-act routing (the rest of WB-Q3)

**Files:** `engine/playloop.js` (`inferInteriorAction` / the action dispatch),
`tests/U258`-family extension.

Recognize `<interior move clause> and (then )?<act clause>` (t19's exact shape:
"I head back to my room and open that iron-bound chest"): execute the move via the
existing interior-move machinery, then re-dispatch the remainder clause through the
normal gate chain in the new room — where P1 now makes the chest genuinely present, so
the free container path fires. Highest regression surface in the cluster (this is the
hot intent-routing file-set); over-match guards in the U258 style are mandatory
("press through the crowd" precedent, WB-F4). **Done-when:** the t19 repro line ends in
a container reveal with `no roll` mechanics; U258/U260/U263 all stay green.

### P6 — model convergence (map fidelity endgame; DESIGN-SKETCH ONLY, separate pass)

Make Model B (`roomDetail`) the single physical catalog: rooms' interactable objects =
their drawn objects; Model A retires into a **stored mutation overlay** keyed by the
stable `roomDetail` furniture id (`room:<sid>:<n>#f<i>`), holding only deviations
(state, removed, contents-taken). That overlay is new world shape → WORLD_VERSION bump,
`ensureWorld` defaults, invariants, save-warning, and re-keying the physics ops — plus
name/metadata mapping (FURN kinds → materials/hardness/categories). Do NOT start this
until P1–P3 have soaked in play; it should get its own Opus-class brief. P1's affinity
partition is deliberately designed to make this migration a *rename*, not a re-layout.

**Order:** P1 → P2 → P3 (P2/P3 are parallel-safe after P1; different file-sets) → P4 →
P5. P6 later, own brief.

**Symptom → packet map:** WB-Q5 → P1 (+P6 endgame) · DM-invents-furniture → P2 ·
WB-Q9-dialogue → P3 · WB-Q8-enabler → P2 · WB-Q2 residual → P4 · WB-Q3 compound → P5.

---

## 4. Determinism / worldHash analysis (foundational packet P1)

The brief demands the introduced room-state be either seed-derived or hash-excluded,
decided and proven. **Decision: seed-derived, never stored — the `roomOccupancy`
pattern.** Proof obligations:

1. **World shape is untouched.** No new stored field; `node.furniture` bytes are
   identical before/after. `projectForHash` (`engine/worldHash.js:8-42`) hashes `map`
   (and thus `node.furniture`) wholesale — since we store nothing, `worldHash` is
   byte-identical for any existing world. No WORLD_VERSION bump, no `ensureWorld`
   defaults, no new invariants, old saves work unchanged. (Aside: the comment at
   `playloop.js:5789` claiming "furniture isn't hashed" is stale — `map: w.map` includes
   it. Harmless today because generation and mutation are both deterministic, but don't
   repeat the claim.)
2. **The derivation's inputs are all canon.** `world.meta.seed`, `map.currentNodeId`,
   `structures.byId[*].topology` + `buildingType`, and `node.furniture` names — all
   inside the hash projection. Same world → same assignment, on every machine, every
   replay.
3. **No time dependence.** The assignment key is `${seed}|${nodeId}|furn-room|${name}` —
   no timeline length, no turn counter (the `buildLocationSurvey` lead-variation bug,
   WB-Q7, shows why: turn-keyed derivation drifts mid-session). A piece's room is fixed
   for the life of the world.
4. **Splice stability.** Keys are piece NAMES (unique per node by construction,
   `generateFurniture.js:186-192`), so a `removeFurniture` splice
   (`effectsCore.js:806-809`) cannot re-room the survivors.
5. **Sole randomness source** is `engine/rng.js` (`seedFromString`/`makeRng`) — purity
   rule 1 holds; no `Math.random`.
6. **Replay equality.** Replays re-run player text; the gates now filter candidates by a
   deterministic function before the same matching logic; emitted deltas still carry
   `(nodeId, furnitureId=nodeIndex)` — the identical ops in the identical order →
   identical post-states → U19/U21/U22/U27/U30 hold. Empirically re-proven by running
   the full suite (those gates are in it) plus `npm run playtest:quick`'s
   DETERMINISM_BREAK oracle.
7. **The one true behavior change** is *which* candidates the gates see when the player
   stands inside a multi-room interior. That is the fix, not a side effect; it changes
   forward-play narration, never the identity of committed canon under replay.

Residual risks, stated plainly: (a) opening-fiction coupling — if any authored opening
narration names a Model A piece in the wake-up room ("you wake on a straw pallet"), the
affinity partition *usually* lands the pallet in the bed-role room, but this must be
verified live on `tallow` (the U307 affinity smoke covers the seed we ship);
(b) `roomDetail`'s `forcedType` must be passed the same way everywhere
(`st.buildingType` — the `roomWindows.js:36` call shape) or affinity and the drawn map
could disagree on a structure with a forced kind; (c) outdoors interaction stays
node-global by design in P1 (unchanged behavior; scoping outdoor pieces is a P6-era
question).
