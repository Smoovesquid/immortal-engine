# The Room Occupancy Model — persistent room-state design

*Fable brief output, 2026-07-02. Target seams: C1/C2/C3/C4 from
`docs/playtests/COHERENCE_SEAMS_2026-07-02.md` (the Phase-0 coherence audit).
Successor to `docs/briefs/INTERIOR_OBJECT_MODEL.md` (P1–P5 shipped; this is the
open tail: WHO is here, WHAT it's made of, WHERE the player stands). Every claim
below is cited to a line on `v2-polish@645671d` or to the two gate JSONLs
(`docs/playtests/gate-runs/gate-2026-07-02*-{bridge,v1}.jsonl`).*

---

## 0. What `roomOccupancy.js` does today — live vs dark

`engine/structures/roomOccupancy.js` is a pure, seeded deriver: each settlement
NPC is deterministically assigned to `outdoors` or to one `(building, room)`
(`assignedPlace` :33-38, `assignedRoom` :41-46; keyed
`${seed}|${id}|place` — no stored state, no `WORLD_VERSION`, hash-stable by
construction, per its own header :1-9).

**Live consumers (real, working):**
- the look-around survey's people lines — `engine/grace/gracefulAdjudication.js:1911-1912, 2586, 2604, 2666-2667`;
- window peek naming who is really in the seen room, and window-entry stealth
  witnesses — `engine/playloop.js:1616, 1645`;
- `getRoomState().occupants` (`engine/structures/roomState.js:61,83`) → the
  npc-voice `sceneFacts` (IOM-P3, `server/npcVoicePrompt.js:126,155`).

**Dark consumer (built, never runs live):** IOM-P2's `inRoomWithPlayer` flag.
`buildNPCsPresent` computes it (`engine/ai/narratorContext.js:454-473`), it
renders as `| IN THIS ROOM` / `| not in this room` in `buildDMSystemPrompt`
(`engine/llmAdapter.js:1318-1320`) — but that prompt's only consumer is
`callDM` (`llmAdapter.js:1661`), and **`callDM` has no live callers** (only
`tests/U91.aiHashTrace.test.js` and `engine/llmModelRules.js`). The live turn is
`playerMove` (in-process) → `/api/npc-voice` → `/api/narrate`
(`scripts/dm-playtest.mjs:5-6` documents exactly this; `server.js:133-190` is
the route). The live narration prompt is `buildSystemPrompt`
(`llmAdapter.js:252` via `augmentNarration` :1222-1226), whose context
(`buildNarratorContext`, `narratorContext.js:33-101`) **never computes
`npcsPresent` at all**. `tests/N10.roomStateFacts.test.js:65-89` asserts the
flags on `buildDMSystemPrompt` — the test passes while the feature is dark.
Occupancy answers *questions about* rooms; nothing *enforces* it when a person
is placed, voiced, or attacked.

## 1. The confirmed root — occupancy is a view; presence has no authority

The IOM closed "what objects are here" (P1 `objectsHere` is the candidate list
for every interaction gate — `playloop.js:1949,6053,6210,6301,6371,6446,6514`;
`llmPhysics.js:36,231`). The remaining incoherence is that **no sink which
places a PERSON, names a MATERIAL, or states the player's ROOM reads any
authoritative source.** Four sub-roots, each grounded:

### 1a. C1 — every person-sink is node-scoped, with `npcs[0]` fallbacks

On the live tallow seed the wake room's occupancy is **empty** (verified by
boot: roster `0=Elske Nightherd (representative), 1=Dalla, 2=Asha, 3=Ashblade,
4=the Lingerer`; `occupantsOfRoom(wake room) = []`, Asha outdoors). Yet:

1. **Assault targeting.** `detectPhysicalAssault` → `fuzzyMatchNpc`
   (`playloop.js:8763-8830`). Its own header says the quiet part:
   *"If violence is clearly intended and NPCs exist but no specific match,
   picks the first NPC"* (:8438-8439). Step 4b: any generic word
   (`him/man/figure/…`) anywhere in the ref → `npcs[0]` (:8821-8823).
   **Gate evidence:** bridge/chaos t2 — player: *"I grab the carter by his
   collar and headbutt him in the face"* (no carter exists anywhere in canon;
   the player invented a cart at t0, the generic-roll floor narrated it as
   real, and a carter was inferred from it). `him` → `npcs[0]` → the DM
   narrates *"your forehead against Elske Nightherd's nose"* — in a room
   occupancy says is empty. Retcon complete.
2. **The talk path.** `resolveNpcAtCurrentNode`
   (`engine/npc/dialogue.js:1093-1098`) resolves against
   `node.settlement.npcs` — no room dimension; `beginDialogue` fires from any
   room of any building (`playloop.js:2357-2363`).
3. **Addressed questions.** `handleNpcAddressedQuestion`
   (`gracefulAdjudication.js:2781-2801`) — *"Who lit that lantern, Elske?"*
   answers from the node roster wherever Elske actually is.
4. **The egress door voices ghosts.** `egressRepair`'s voiced decline picks
   `socialTarget(world, text)` (`playloop.js:6713-6726`) — node roster,
   final fallback `return npcs[0]` (:6725). **Gate evidence:** v1/chaos t9 —
   *"When did I walk into a back room?"* → `[egress:repair]` → **"Elske
   Nightherd shrugs. 'Can't say. No record I've ever seen.'"** — the engine
   itself materialized Elske to answer, alone in the cottage. t10's follow-up
   (*"why is she suddenly standing in my burning cottage?"*) is answered by the
   person-identity sink placing her *"in the doorway of your cottage"*.
5. **The live prompt.** `buildNarratorContext` hands the polish LLM the full
   roster as `SETTLEMENT DATA` with zero occupancy (`llmAdapter.js:134-142`)
   AND auto-picks a `speaker` — default `settlement.npcs[0]`
   (`narratorContext.js:46-54`) — so Elske's perspective/secrets ride along on
   every turn at the outpost. The one prompt that carries the flag never runs
   (§0).
6. **The validator enforces the wrong model.** Rule 4f rejects polish that
   *denies* the presence of any NPC in `collectPresentNpcNames`
   (`llmAdapter.js:923-942`), and that set is built from
   `ctx.npcsPresent ∪ settlement.npcs ∪ world.npcs` (:1186-1199) — i.e.
   node-global. A truthful polish line "Elske isn't here" **gets rejected**;
   a line placing her bodily in the room passes every check (she is a
   "grounded noun" — the invented-proper-noun guard :966-968 grounds her from
   the roster).
7. **The judge is structurally blind.** The gate's canon feed carries
   `npcsPresent` = the whole roster and **no interior/room field at all**
   (`grep -n interior scripts/dm-playtest.mjs` → zero hits; visible in every
   JSONL record). The judge passed the headbutt turn with *"consistent with
   combat state and canon NPC"*. Cross-room contradiction is invisible to it
   by construction — the audit's "gate is blind to coherence" is not a rubric
   gap first, it is a **feed gap**.

### 1b. C2 — material has no canon anywhere in the prose stack

The renderer knows the building's shell: `BUILDING_SHELL`
(`engine/structures/floorPlan.js:40-43` — cottage/tavern/longhouse = timber,
chapel = stone, keep = fortified…) and draws the hull in it (:165-181). The
prose stack never hears it: `interiorLayoutFact` states type, room count,
storeys, doorways, objects — **no material** (`llmAdapter.js:52-68`);
`validateNarrationCandidate` has no material axis (:540-1000). **Gate
evidence:** v1/chaos t1 *"wooden wall"* → t6 *"stone wall"* → t7 **"it was
always stone"** — the polish free-associates, then retcons its own drift, and
"stone" contradicts the timber cottage the map actually draws (a standing
map-fidelity violation).

### 1c. C4 — the player's room is hashed canon nobody speaks

`scene.interior.roomId` is real, mutated only through the interior-move
machinery, and inside the hash projection (`worldHash.js:20` hashes `scene`).
But the live prompt never says *which room the player is in* —
`interiorLayoutFact` names the building, not the room (`llmAdapter.js:56-68`;
`getRoomState().room.name` exists and goes unused here) — and no validator
rule checks a narrated position. **Gate evidence:** v1/chaos t8 — polish
invents *"here in the back room of the cottage"* unprompted; t9 the player
calls it out. The engine never moved them; the prose did.

### 1d. C3 — three unlinked object layers (the "teleporting letter")

The letter is not one object moving; it is three systems that don't share an
identity space: (i) narration mints objects freely ("the letter from Elske's
coat" — never canon); (ii) presence gates answer from canon ("no letter
here" — correct); (iii) `containerContents` derives contents from seed
(`playloop.js:6240`), so a chest can independently offer *a* letter. The PW-1
`takenItems` overlay (`playloop.js:6236-6243`, `effectsCore.js:493-499`)
correctly stops *container* re-offers — but a narration-minted object has no
entity to subtract. This is an **object-identity/provenance** gap, not an
occupancy gap; it shares the fix's shape (canon-or-nothing at the sink) but
not its files.

**Verdict.** The IOM's §2 consumption contract — *"no consumer answers a
'what/who is here' question from `node.furniture`, `settlement.npcs`, or raw
topology directly"* — shipped for objects and for the *survey/question* sinks,
and was never applied to the sinks that **commit or voice a person**, to
**materials**, or to the **player's narrated position**. That is the whole
root. Nothing here needs new state; it needs the existing seed-derived state
to be made *binding*.

---

## 2. The persistent room-state contract

**One sentence:** `getRoomState(world)` — already the shared façade
(`roomState.js:33-86`) — becomes the **single authority for presence,
material, and position**, and every sink that places/voices a person, names a
material, or states the player's location either reads it or is validated
against it; the node roster survives only as *continuity memory* (who exists
at this settlement), never as *presence*.

All of it stays **seed-derived, replay-stable canon**: occupancy and material
are pure functions of hashed inputs (`meta.seed`, `structures.byId[*]`,
`map.currentNodeId`, `scene.interior` — all inside `projectForHash`,
`worldHash.js:8-42`); position is already stored canon. No new stored fields;
`worldHash` byte-identical; old saves unaffected. (V11: the world supplies the
facts; the LLM never gets to set them. Law 1/3: engine decides, canon wins.)

The contract adds two obligations to `getRoomState` and one rule to every
person-sink:

```
getRoomState(world) gains:
  material: {                    // NEW — engine/structures/structureMaterial.js
    shell,                       // the SAME word floorPlan draws (map-fidelity)
    walls, floor,                // prose descriptors ("timber-framed, wattle walls")
    line,                        // one prompt-ready fact sentence
    forbidden: [ ... ]           // contradiction lexicon for the validator
  }
  // occupants (P2) and room.name (P2) already exist — they become BINDING:
```

**The presence rule (every person-sink):** the candidate list for engaging,
voicing, or blaming a person is `occupantsOfRoom(here)`; the node roster is
reachable only through the **seek rule**:

- *Named/role-matched NPC, elsewhere in the SAME structure* → **auto-seek**:
  the engine executes the real room moves (`moveWithinInterior` — existing,
  canon-mutating, replay-stable) and narrates the walk — a real DM resolves
  "I ask Elske…" by taking you to Elske, never by teleporting her (DM Test:
  resolve in fiction, never bounce).
- *Elsewhere at the node (another building / outdoors)* → a **concrete
  absence-with-pointer**, derived from occupancy: "Elske isn't in the
  cottage — she's out by the pens." (Occupancy already knows; today nothing
  asks it.)
- *Generic ref ("him", "the man") / voiced-decline speaker* → the fallback
  becomes `occupantsOfRoom(here)[0] ?? null` — **never** `settlement.npcs[0]`.
  An empty room answers as an empty room ("there's no one here to grab").
  The `[0]`-fallback sites: `fuzzyMatchNpc` steps 3/4b/5
  (`playloop.js:8797-8828`), `socialTarget` (:6725),
  `resolveNpcByRoleOrDescriptor` `allowGeneric` (:5024),
  `buildNarratorContext`'s auto-speaker (`narratorContext.js:53`).

**The narration rule (prompt + validator, both sides of the same fact):**
- The live `buildSystemPrompt` gains three facts from `getRoomState`:
  `You are in the <room.name>.` · `PEOPLE HERE: <occupants|no one>` (earned
  names preserved) · `<material.line>` — plus one law line: *"anyone else at
  this settlement is elsewhere — never place, voice, or have them act in this
  room; never state a wall/floor material other than the one above."*
  `SETTLEMENT DATA` stays (continuity/memory) but each NPC not in the room is
  marked `— elsewhere`.
- `validateNarrationCandidate` gains the mirror checks, all engine-side and
  deterministic: (i) fix Rule 4f's source to the occupancy set so truthful
  absence is *accepted*; (ii) reject a candidate that voices (`**Name:**` /
  `Name said/says/shrugs`) or physically places a roster NPC who is not in
  `occupants` (absence statements exempt); (iii) reject a candidate whose
  wall/floor material words hit `material.forbidden`; (iv) reject a candidate
  that names the player's position as a room ≠ `room.name` when inside.
  Every rejection falls back to the grounded base — the existing, proven
  failure mode (Purity rule 4).
- The npc-voice path already carries room `sceneFacts` (P3); it gains the
  same `PEOPLE HERE` line so a voiced NPC can't hand the mic to an absent one.

**The measurement rule (the judge feed):** the gate canon gains
`interior {roomId, roomName}`, `roomOccupants`, and `material.shell` so the
sibling lane's coherence analyzer (and the judge itself) can *see* the room
dimension. Until the feed carries it, every coherence number over-counts
passes.

Object identity (C3's letter) is intentionally **out of this contract** — it
is the P6/object-provenance track (§3, ROM-5): same law, different state.

---

## 3. Packetized plan

Ordered; ROM-0 is landed with this brief. File-ownership per lane; ROM-1 is
serial (hot file). Test numbers from U348 (this lane's allocation).

### ROM-0 — FOUNDATIONAL (landed here): material identity + the binding surface
**Files:** `engine/structures/structureMaterial.js` (new),
`engine/structures/floorPlan.js` (shell table moves here — floorPlan imports
it; renderer output byte-identical), `engine/structures/roomState.js`
(`material` field), `tests/U348.structureMaterial.test.js`.
Derived-only (fixed table keyed by `buildingType`), no RNG, no stored state,
no `WORLD_VERSION`, `worldHash` untouched. Exports the contradiction lexicon
(`forbidden`) so ROM-2's validator imports rather than re-derives.
**Done-when:** suite + convergence green; map shell === prose shell for all 9
building types; hash byte-identical before/after derivation on a booted world.

### ROM-1 — presence authority at the person-sinks (Codex lane; `playloop.js` + `npc/dialogue.js` + `grace/` — SERIAL, hot)
Swap candidate lists to `occupantsOfRoom` + implement the seek rule (§2) at:
`fuzzyMatchNpc` call sites / `detectPhysicalAssault` (:8515-),
`resolveNpcAtCurrentNode` consumers for talk (:2357), `socialTarget` (:6713),
`handleNpcAddressedQuestion` (grace :2781), `resolvePresentNpcLoose` (:5029).
Auto-seek uses `moveWithinInterior` (already canon-safe); cross-building seek
is v2 — start with absence-with-pointer. **Regression sentries:** the U258
family (building traversal), U319 (egress), the 121-case corpus, C-prefix
dialogue tests. **Done-when:** a repro of bridge/chaos t2 ends with either an
empty-room line or a seek — never an out-of-room engagement; suite green.
*Note:* `GENERIC_PERSON_REF`'s and `fuzzyMatchNpc`'s `npcs[0]` fallbacks are
load-bearing for outdoor scenes — outdoors the candidate list is
`outdoorOccupants(w)`, not the roster; keep the fallback, change the pool.

### ROM-2 — the prompt + validator learn presence, material, position (Sonnet lane; `llmAdapter.js` + `ai/narratorContext.js`)
The three fact lines + the law line in `buildSystemPrompt`; auto-speaker
(`narratorContext.js:53`) becomes room-scoped; Rule 4f source fix; the three
new validator rules (§2), each conservative, each falling back to base.
`N10` extends to assert the *live* prompt (the dark-prompt lesson of §0: **the
test must drive the path the game runs**). **Done-when:** N-suite green; a
live probe shows a turn voicing an out-of-room NPC falls back to base.

### ROM-3 — the judge feed sees rooms (worker lane; `scripts/dm-playtest.mjs` — pairs with the coherence-analyzer lane)
Add `interior{roomId,roomName}`, `roomOccupants`, `material.shell` to the
canon block. Zero engine change. **Done-when:** next gate JSONL records carry
the room dimension on every turn.

### ROM-4 — QUEUED FOR TIM (WORLD_VERSION) — room-scoped stored furniture, Model-B convergence (WB-Q5 endgame = IOM-P6)
See §4 for the full blast radius. Not started unattended, per standing law.

### ROM-5 — object identity/provenance (C3's letter; own Opus-class brief)
Narration-minted objects become canon-or-refused at the sink: either the mint
is committed (a `ledger` fact / inventory entity via existing deltas — **no
schema change needed for v1**) or the reveal is blocked. Rides after ROM-1/2
soak. The full object store (stable ids for NPC-possessed things) belongs to
ROM-4's bump if Tim green-lights it.

**Symptom → packet:** C1 → ROM-1 + ROM-2 · C2 → ROM-0 + ROM-2 · C4 → ROM-2
(+ROM-1's seek making real moves) · C3 → ROM-5 (+ROM-4 endgame) · judge
blindness → ROM-3.

---

## 4. WORLD_VERSION / worldHash blast radius — the WB-Q5 tail (ROM-4), analyzed for a safe later execution

**What does NOT need the bump (everything in ROM-0..3, explicitly):**
occupancy gating, seek moves (existing canon ops), prompt facts, validator
rules, material derivation, judge feed — all pure reads over hashed inputs or
narration-layer checks. `node.furniture` bytes untouched; `projectForHash`
output byte-identical. The IOM-P1 partition already room-scopes the *view* of
furniture with no schema change (`roomObjects.js:1-13`).

**What the bump is actually FOR:** making Model B (`roomDetail`'s per-room
drawn furniture) the interactable catalog, with a **stored mutation overlay**
(state/removed/taken per stable furniture id `room:<sid>:<n>#f<i>`), replacing
node-furniture as the object canon — and, if ROM-5 wants it, first-class
object entities. Stored ⇒ shape change ⇒ bump.

**The enumerated radius (a worker can execute from this list):**
1. `engine/state.js` — `WORLD_VERSION++`; `ensureWorld` default for the new
   field (recommend `world.roomOverlays = {}` top-level, NOT inside
   `structures.byId[*]` — structures are regenerated by `STRUCTURE_SCHEMA_VERSION`
   logic and an overlay inside them would be lost on regen).
2. `engine/invariants.js` — overlay well-formedness (ids resolve to real
   rooms; caps).
3. `engine/worldHash.js` — **no code change**, but be aware: `structures` and
   any new top-level field must be added to `projectForHash` deliberately
   (:8-42 hashes an explicit allowlist — a forgotten field = silent
   determinism hole; an added field = intended cross-version hash break).
   Within-version replay stays stable because overlay writes go only through
   `applyDeltas`.
4. `engine/effectsCore.js` — re-key `modifyFurniture`/`removeFurniture`
   (:801-812; today `(nodeId, index)`, and `removeFurniture` SPLICES — the
   index instability is why P1 keyed by name) to the stable room-furniture id.
   Add the overlay op.
5. Consumers: **contained by design** — P1/P2 mean the swap happens inside
   `roomObjects.objectsHere` + `roomState`; the gates, physics layer, survey
   and prompts already read the façade (§0). `llmPhysics` delta emission
   (`furnitureId = nodeIndex`, `llmPhysics.js:231`) re-keys with #4.
6. `STRUCTURE_SCHEMA_VERSION` stays 27 — generation is unchanged; the overlay
   is state, not gen (`project_structure_gen_version_decoupled`).
7. Old saves: warn-before-upgrade path (commit `d50c49f` pattern).
8. Tests: grep version-embedded strings (`stgen:v27` stays; any `v<N>:` world
   strings bump); U19/U21/U22/U27/U30 re-baseline; `npm run playtest:quick`
   DETERMINISM_BREAK + SAVE_CORRUPTION oracles are the exit gates.
9. The opening fiction / tallow wake-room props must be re-verified live
   (the IOM residual risk (a) — "you wake on a straw pallet" must still be
   true in the room the player wakes in).

**Verdict:** the bump is real but *small and contained* thanks to P1/P2's
façade — the danger is concentrated in #3 (hash allowlist) and #4 (re-keying
a splicing op). It stays queued for Tim; nothing in ROM-0..3 depends on it.

---

## 5. Falsifiable next-gate predictions (for the coherence analyzer)

Checkable mechanically against the next 48-turn gate JSONL once ROM-3's feed
lands (predictions 1–4 assume ROM-0..2 landed; 5–6 are true today):

1. **C1 → ~0:** no turn whose narration voices or physically places a roster
   NPC absent from `roomOccupants` at that turn's position (analyzer rule:
   name-in-narration ∧ name ∉ occupants ∧ no absence-verb ⇒ flag). Today's
   transcripts flag ≥4 such turns (bridge t2/t9-10, v1 t9/t10/Newbie t5).
2. **C2 → 0 on cottage seeds:** zero narration turns containing
   `material.forbidden` words for the occupied structure (e.g. "stone wall"
   inside the tallow cottage). Any hit = ROM-2 validator regression.
3. **C4 → 0:** no narration names a player position ≠
   `roomDetail(current).name` while inside (v1 t8's "back room" shape).
4. **No new bounce:** the DM-Test corpus (121 cases) stays green — the seek
   rule must never produce "she's not here, did you mean…?" menus; declines
   stay in-fiction. (The over-match oracle for ROM-1.)
5. **Falsifier for the root itself:** if, with ROM-1/2 landed, Elske still
   materializes in a fresh gate, the residual channel is the npc-voice
   dialogue path (P3's `sceneFacts` constrain space but not WHO speaks —
   `server/npcVoicePrompt.js`) — that would locate the leak, not refute the
   model.
6. **Determinism control (true now, must stay true):** `worldHash`
   byte-identical across ROM-0..3 on any existing save; U19/U21/U22/U27/U30
   green (ROM-0 landed with this property; see
   `tests/U348.structureMaterial.test.js`).

---

*Plain English: the engine already knows, deterministically, who is in every
room of every building — but that knowledge is a display, not a law. When you
punch "the carter", ask a question into an empty room, or the narrator wants a
speaker, the code reaches for the settlement's full cast list and grabs the
first name on it, and the prompt/validator/judge all treat "at this
settlement" as "standing beside you". So people teleport, and the narrator
retcons them as having always been there. Same story for walls (the map knows
the cottage is timber; the prose is never told, so it says stone) and for
which room you're in (the engine knows; the narrator guesses). The fix is not
new state — it's making the existing, replay-stable answers binding at every
door they currently walk past: the resolver only engages people who are
actually in the room (walking you to them when they're nearby), the narrator
is told who/what/where and is checked against it, and the judge is finally
shown the room so it can catch what it's been passing.*
