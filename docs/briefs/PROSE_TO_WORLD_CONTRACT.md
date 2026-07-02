# The Prose-to-World Materialization Contract — root diagnosis & design

*Fable brief output, 2026-07-02. Target: turn the "DM invents geography/objects → suppress" stopgap
into its inverse — observation collapses latent detail into persistent canon, deterministically —
without breaking replay (`worldHash` equality under same seed + same transcript). Grounded against
v2-polish @ `2f0c272`.*

---

## 1. The hypothesis, confirmed in PATTERN and refuted in LOCATION — plus the one correction that makes it implementable

The brief's hypothesis: *latent canon exists in a seed-derived superposition; DM narration triggers
a deterministic collapse of the pre-seeded value; collapsed canon is never overwritten; the seam is
`engine/csl/latent.js` + `mintFact` in `playloop.js`/`effectsCore.js`.*

### 1a. Confirmed: waveform-collapse is already the engine's proven idiom — at four scales

The engine does not need this architecture invented. It already runs it, live, wherever content
materializes correctly today:

| Scale | Latent form | Collapse trigger | Committed record | File |
|---|---|---|---|---|
| **Settlement** | thin node + seeded generators | first node entry | `settlement.decompressed: true` + full settlement stored on the node | `engine/decompression/decompress.js:15-88` (`makeRng(seedFromString(\`${nodeId}\|${seed}\|extract\`))`) |
| **Container contents** | pure function `containerContents(seed, nodeId, pieceName, category)` over an authored bank | player opens/searches (`tryContainerReveal`, `tryFurnitureStateChange`) | ONE stored bit: `state:'open'` via `modifyFurniture`; the value is re-derived forever | `engine/decompression/generateFurniture.js:129-146`; `engine/playloop.js:6122-6203` ("derived from seed + node + piece name, so the reveal is deterministic and stable … with no hashed state") |
| **Authored things** | `thing.trueEdge` latent until discovery | player examines (`tryRevealThing`) | `trueEdge.discovered = true` | `engine/things.js:10-16, 63-77` ("True edges are latent until a player act of discovery") |
| **Rumors** | seed + hop/tier skeleton; LLM writes prose *at the computed tier* | first dialogue surfacing (designed) | `mintRumor` op + `rumor.minted` canon event (skeleton only — no body) | `engine/rumor/mint.js:145-253`; `engine/effectsCore.js:667`; body excluded from hash at `engine/worldHash.js:37` |

The "never overwrite collapsed canon" rule (§0) is also already enforced idiomatically:
`tryContainerReveal`'s `alreadyOpen` branch acknowledges without re-mutating (`playloop.js:6193-6195`);
`mintThing`/`mintRumorForNpc` are idempotent by stable id (`things.js:31`, `rumor/mint.js:164-168`);
`appendCanonEvent` dedupes by event id (`engine/csl/canonLog.js`); `canonizeSurface` no-ops on an
already-canonical surface (`engine/csl/latent.js:24-26`); and pure derivations are immutable by
construction — a fixed function of fixed hashed inputs cannot change.

### 1b. Refuted: the named seam is a dark prototype, and `mintFact` no longer exists

- `engine/csl/latent.js` (54 lines) + `engine/world/resolveSurfaceContact.js` operate on
  `world.nodes` — the **minimal-world prototype shape**. The live world keeps nodes at
  `world.map.nodes` (`decompress.js:16`, `rumor/mint.js:121`). Their only importers are
  `engine/world/minimalWorld.js` and the U8/latentProjection tests. `resolveSurfaceContact` also
  mutates the world directly instead of through `applyDeltas`. It is a proof-of-concept of the
  CANON_CREATE idea, not the seam. Do not build on it (packet PW-6 disposes of it).
- `mintFact` does not exist at HEAD. History (`git log -S mintFact`) shows it in the H-96 arc
  ("revealed letters deliver authored prose", `5750bf8`) — that lineage *became*
  `containerItemText` (`generateFurniture.js:168-173`), i.e. it already evolved into the pure-deriver
  pattern.

### 1c. The correction that decides the whole architecture: **narration cannot be the trigger**

The brief says "DM narration does not INVENT, it TRIGGERS a deterministic collapse." Half right.
The code proves the trigger must be the **player's text**, never the narration:

- Replay is defined as re-driving the **player-text transcript** through the synchronous reducer
  with the LLM off: `tests/U19.worldHashDeterminism.test.js` (`replayFromTimeline` feeds timeline
  `resolution`/`blocked` text back through `playerMove`), U21/U22/U27/U30 same family.
- The live server does the same: `server.js:525` runs deterministic `playerMove` first;
  `augmentNarration` (`server.js:176`) runs on the *output* afterward. LLM narration is returned to
  the client and **never stored in world state** — it is pure view.
- The engine already refused this temptation once: the deterministic loop calls
  `evaluatePhysicsSync` — offline fallback only — and pushes a timeline `resolution` event
  precisely "so deterministic replay re-executes this physics path" (`playloop.js:2975, 3042-3054`).
  The async LLM physics path (`llmPhysics.js:173`) exists and is deliberately unused by the reducer.

If a collapse keyed off narration content, replay (which has no narration, or different narration)
could not re-execute it → `worldHash` diverges on the first such turn. So the roles are:

> **The player's observation collapses. The engine derives the value. The DM renders it.**

The "LLM proposes where to look" slot in the hypothesis is filled by the **player** (whose words
ARE in the transcript). The DM's prose is downstream of collapse: it receives collapsed facts as
prompt canon (the IOM-P2 pattern, `llmAdapter.js:52-68`) and is validated against canon
(`validateNarrationCandidate`, `llmAdapter.js:540+`; `applyEgressRepair`, `playloop.js:559-605` —
both narration-only, state untouched). Suppression is not deleted by this arc; it becomes the
**backstop** while the sinks stop being starved.

### 1d. One scoping law: TOPOLOGY is authored, not latent — CONTENT is the latent frontier

WB-Q1 (the DM narrating staircases/upper floors a 3-room cottage lacks —
`docs/playtests/harness/WHOLE_BUILDING_FINDINGS.md`) is **not** an un-collapsed latent value. Walkable
space is governed by IMMORTAL_INVARIANTS #13/#14 (one walkable scale; interiors render from the
authored catalog) — geography is *pre-collapsed at generation time* and the WB-F5 denial fix is
correct and permanent. What may be latent is **content inside the authored space**: what a container
holds, what a room's dressing detail is, what an NPC knows/has heard, what a distant place is
rumored to be. That is where "the world never stops surprising you" lives, and none of it moves a
wall.

### 1e. The live gap that proves the missing half (the foundational packet's target)

The collapse pipeline currently runs `reveal → read` and then **drops the baton at `acquire`**:

- WB-Q4 / T-Q2 (phantom acquisition, HIGH, twice-confirmed by the harness): "I pocket the letter"
  narrates acquisition and mutates nothing. At HEAD the path is: the trivial free-action classifier
  passes it (`playloop.js:7651-7652`), and the outcome bank renders "You pocket the ${what} and move
  on." (`playloop.js:7246-7257`) with **no `addItem`, no container overlay, nothing persisted**. The
  player later "shows the letter" to an NPC the engine has no record of them holding.
- Everything needed already exists: the value (`containerContents` — seed-derived), the observation
  record (`state:'open'` persisted via `modifyFurniture`), the mutation ops (`createItem` takes a
  raw `{name, tags, weight, noise, light, bulk, notes}` item — `effectsCore.js:421-441`), the
  visibility sink (`describePack` lists every bucket's item names —
  `engine/grace/gracefulAdjudication.js:1305-1331`), and physics coherence for free
  (`detectPhysicalInteraction` scans all inventory buckets — `llmPhysics.js:70-83`).
- The missing pieces are exactly two: an **acquire gate** (player-text-triggered, like the reveal
  gate) and a **taken-overlay** so the derived view stops re-offering what was taken (the
  never-overwrite rule expressed as *view subtraction*, never value mutation).

**Verdict: the root is confirmed as an architecture that already exists and wants finishing, not
inventing. The engine suppresses at the narration layer because the canon layer under it was
incomplete — finish the canon layer's observation verbs (acquire now; rumor-surfacing, dressing,
NPC knowledge next) and suppression demotes itself to a backstop.**

---

## 2. The Materialization Contract (what a worker implements against)

Definitions:
- A **latent value** is content not yet shown, defined as a *pure function of hashed canon* (seed +
  stable keys such as nodeId/pieceName/npcId) — usually a seeded pick over an **authored bank**
  (`CONTAINER_LOOT`, `LETTER_BODIES` pattern, `generateFurniture.js:109-161`).
- An **observation** is a deterministic classifier hit on **player text** (never on narration),
  running in the synchronous reducer (`playerMoveCore` gate chain, e.g. `playloop.js:1745-1762`).
- A **collapse-commit** is the `applyDeltas` batch recording the observation — small stored bits
  and/or minted entities — plus a timeline `resolution` event so replay re-executes the path.
- **Rendering** is narration built FROM collapsed facts and validated against them.

The six laws:

1. **Value-source law** (Biblioteca Vol 11; North-Star rail 6). The value of any minted canon —
   name, id, quantity, placement, topology — is engine-derived (pure function of hashed canon, or a
   seeded pick from an authored bank). The LLM never sets a value. The only LLM-writable slot is a
   **prose body** whose skeleton the engine committed first (rumor pattern), and a deterministic
   fallback body must exist (`rumor/mint.js:60-78, 204-223`).
2. **Trigger law.** Collapse triggers are functions of `(world, playerText)` only. Narration cannot
   trigger a collapse because narration is not in the replay transcript (§1c). If the DM's prose
   needs latitude, grant it by handing it *derived facts* (law 6), not by letting its output write
   canon.
3. **Commit law.** Every collapse-commit goes through `effectsCore.applyDeltas` ops (extend the op
   whitelist explicitly when a new field is needed — `modifyFurniture` whitelists its `changes`
   fields at `effectsCore.js:460-477`; unlisted fields are silently dropped, the DX-2d-i trap). Push
   a timeline `resolution` event (`updateKind` named for the path) so replay re-executes it — the
   physics precedent (`playloop.js:3042`).
4. **Immutability law (§0: never overwrite collapsed canon).** Enforced four ways, all precedented:
   idempotent mints by stable id; acknowledge-don't-remutate branches for repeat observations;
   append-only + deduped canon events; and **view subtraction** — post-collapse changes (an item
   taken) are overlay fields that *subtract from the derived view*; the derivation itself is never
   edited. Code-version freeze: a shipped deriver's key-space is frozen; changing it is a
   version-pinned migration (`STRUCTURE_SCHEMA_VERSION` precedent), never an in-place change.
5. **Hash law** (the brief's (a)-vs-(b) question — the answer is *both, by role*):
   - **S1 — pure projection, never stored** (preferred; IMMORTAL_INVARIANTS #3): values re-derivable
     on demand add nothing to the hash. (`containerContents`, `roomObjects`, `roomDetail`.)
   - **S2 — stored, IN the hash**: observation bits and minted entities live inside already-hashed
     containers (`map`, `party`, `canonLog` — `worldHash.js:10-42`) and are functions of
     (seed, transcript), so replay re-commits them identically. A hash *value* may change when a new
     deterministic field starts being set; replay-*equality* must never break (IMMORTAL_INVARIANTS
     #2).
   - **S3 — stored, OUT of the hash, immutable once minted**: LLM prose bodies only
     (`rumor.body`; projection excludes it at `worldHash.js:37`, and the canon event carries the
     skeleton, not the body — `rumor/mint.js:242-250`). An S3 body must never feed back into an
     S1/S2 derivation.
6. **Rendering law.** Collapsed facts flow to the DM prompt as CANONICAL FACTS (the
   `interiorLayoutFact` / IOM-P2 pattern) and to the dialogue voice as `sceneFacts` (IOM-P3).
   Guards (`validateNarrationCandidate`, `applyEgressRepair`, `refJudge`) stay as the backstop and
   must learn about each newly collapsible fact class only in one direction: **never reject
   narration for rendering a fact the engine derived** (feed the guard's grounded-noun set from the
   same deriver). Prompt *wording* is a separate taste lane — packets here change what facts flow,
   not the voice.

---

## 3. Packetized plan (each one file-set, foundational first)

### PW-1 — FOUNDATIONAL: acquire the revealed item (closes WB-Q4/T-Q2) — *implemented in this worktree*

**Files:** `engine/effectsCore.js`, `engine/playloop.js`, `tests/U322.takeRevealedItem.test.js` (new).

**Build:**
1. `effectsCore.js` — extend `modifyFurniture`'s whitelisted `changes` with
   `takenItems: string[]` (map String, cap 8, dedupe). Furniture pieces survive `ensureWorld`
   untouched (`engine/map/mapState.js:473-474` preserves `node.furniture` wholesale; `state.js`
   never normalizes pieces), so no WORLD_VERSION bump.
2. `playloop.js`:
   - `remainingContainerContents(w, node, f)` = `containerContents(...)` minus `f.takenItems` —
     used by `containerContentsClause` (:6140) and `tryReadRevealedContainerItem`'s revealed-item
     scan (:6227). View subtraction, law 4.
   - New gate `tryTakeRevealedContainerItem(w, text)` inserted in the gate chain right after
     `tryReadRevealedContainerItem` (:1757): take-verb + named noun (reuse `takeTargetOf`
     head-noun logic, :6938) matched against the remaining contents of OPEN containers here
     (room-scoped `objectsHere`). Bare "take it" resolves only when exactly one revealed item
     remains here (mirrors the read gate's pronoun rule, :6239). Read-verb compounds
     ("take the letter and read it") are left to the read gate, which runs first.
     - Already in a pack bucket → acknowledge, mutate nothing (idempotence at the player surface).
     - Else ONE `applyDeltas` batch: `createItem` (compact display name; the letter's authored body
       — `containerItemText`, pure — goes into the item's `notes` so reading from the pack stays
       possible and byte-identical) + `modifyFurniture {takenItems: [...prior, originalString]}`;
       then `pushEvent` `resolution` with `updateKind:'take:revealed'`.
   - Extend `tryReadRevealedContainerItem` to also match a text-noun item already in the party's
     buckets and read its `notes` body — reading must not regress after pocketing.

**Explicit non-goals:** taking non-revealed nouns keeps today's behavior (PW-2 owns it); outdoor
scope, multi-take ("take everything"), and container restocking are out.

**Test plan (U322):** tallow boot (the U293 fixture — the iron-bound chest deterministically holds
"a folded letter, its seal broken"): open → take → pack contains it (and `describePack` names it);
survey/re-open clause no longer lists it; read-after-take returns the same authored body as
read-before-take (string-equal); second take acknowledges without mutating (hash-equal before/after);
full-transcript determinism U19-style (two fresh worlds, same moves → equal `worldHash`); take
before opening does NOT acquire (observation precedes acquisition).

**Done-when:** `node --test` green, `npm run convergence` green, U19/U21/U22/U27/U30 green,
`npm run playtest:quick` clean.

### PW-2 — the honest floor for ungrounded takes (suppression-side complement)

**Files:** `engine/playloop.js` (the free-action classifier :7651 + the take bank :7246-7257),
corpus additions.
A take/pocket naming a noun that is NOT (a revealed remaining item | a present furniture piece | an
inventory item | a combat-loot target) stops narrating acquisition; it gets an in-voice honest line
("nothing like that here to take") or pivots to the search path. This is behavior-corpus sensitive —
run `npm run convergence` per change; expect corpus rows to need re-blessing only where they were
phantom. PW-1 and PW-2 pair: mint what canon holds; decline what it doesn't.

### PW-3 — first live rumor surfacing (the built-but-dark layer gets its trigger)

**Files:** `engine/playloop.js` dialogue path (grep `factPhrase:` ~:1008 and the dialogue-answer
assembly), `server.js` (async post-reducer step), `engine/rumor/*` (no logic changes expected).
`mintRumorForNpc` currently has **zero live call sites** (grep: only tests). Wire the RUMOR_LAYER.md
lifecycle trigger #1: player asks an NPC about a topic matching a reachable latent seed → the
deterministic skeleton mints in the reducer with the deterministic fallback body (S2); the server's
async layer may *upgrade the prose body only* (S3) afterward — never the skeleton. Respect the
mint-budget cap (≤3/scene). Note the doc-vs-code seam to fix in passing: RUMOR_LAYER.md:144 claims
the hash includes `verified`; `worldHash.js:37` projects only `{id, tier, age}` — align the doc (or
the projection) explicitly. Needs its own worker brief; this is the first LLM-in-the-loop
materialization and must cite law 1's fallback rule.

### PW-4 — derived room dressing (the "license to invent" becomes license to render)

**Files:** `engine/structures/roomDressing.js` (new, pure), `engine/ai/narratorContext.js`,
`engine/llmAdapter.js` (facts only), N-test.
A pure deriver `roomDressing(seed, structureId, roomId)` → 1–2 micro-details from an authored bank
(cobwebbed corner, water-stained beam, initials scratched in a sill …), keyed like `roomDetail`.
Feed into `buildScene.interior` and one prompt fact line beside the IOM-P2 objects line; add the
dressing nouns to `collectGroundedNouns` so `validateNarrationCandidate` never rejects them (law 6).
S1 — nothing stored, nothing hashed. This makes narrated texture *pre-authorized derived canon*
(stable across re-visits — the same water stain is there next week) instead of per-turn improv.

### PW-5 — NPC latent knowledge on the ask path (scope by grep FIRST)

The unknown-topic dialogue deflection is the NPC-scale analog of the pre-fix container (a dead-end
where a latent value should collapse). Substantial prior machinery exists (`claims.js`,
`personQuery.js`, earned-knowledge law, AG-1/AG-3 answerability) — a worker must first map what
`askNpc`'s miss-path does at HEAD and where a seeded knowledge bank could answer without violating
LAW_OF_EARNED_KNOWLEDGE. Deliberately unscoped here; needs its own brief. Do not start before PW-3
soaks.

### PW-6 — prototype disposal + doc alignment (hygiene)

Retire or clearly quarantine `engine/csl/latent.js` + `engine/world/resolveSurfaceContact.js`
(minimal-world only; header comment saying so) so no future worker builds on the wrong shape; fix
RUMOR_LAYER.md:144 (PW-3 note); update `docs/playtests/harness/WHOLE_BUILDING_FINDINGS.md` WB-Q4 row
when PW-1 lands.

**Order:** PW-1 → PW-2 (pairs with 1) → PW-3 → PW-4 (parallel-safe with PW-3; disjoint files) →
PW-5 → PW-6 anytime after PW-3.

---

## 4. Determinism / worldHash analysis for PW-1 (the foundational change)

**Strategy: S1 for the value + S2 for the observation — nothing new is hash-excluded.**

1. **The value is already-latent canon.** `containerContents`/`containerItemText` are pure functions
   of `(seed, nodeId, pieceName, itemString)` — all inside the hash projection (`meta`, `map`).
   PW-1 reads them; it does not add a value source.
2. **New stored state rides inside already-hashed containers.** The minted item lands in
   `party[0].inventory.junk` (hashed via `projectPartyForHash` — buckets pass through, push-order =
   transcript-order, `crunchHashProjection.js:27-42`); `takenItems` lands on a furniture piece
   inside `map` (hashed wholesale, `worldHash.js:19`). No `projectForHash` key changes → U27's
   surface contract untouched.
3. **Both mutations are (seed, transcript)-functions.** Trigger = player text through a
   deterministic gate; value = pure derivation; commit = one `applyDeltas` batch + a timeline
   `resolution` event. Replay re-runs the same text → same gate → same derivation → same deltas in
   the same order → byte-equal hash. This is exactly the physics-path discipline
   (`playloop.js:3042`).
4. **No normalization strip.** `ensureMap` preserves `node.furniture` arrays wholesale
   (`mapState.js:473-474`); `state.js` has no per-piece whitelist; `exportWorld`/`importWorld`
   round-trip is covered by U27 and the new U310 save-roundtrip assertion. `modifyFurniture` DOES
   whitelist `changes` fields (`effectsCore.js:460-477`) — hence the explicit op extension, not a
   free-form write (the DX-2d-i lesson applied in advance).
5. **No time/turn keying.** `takenItems` is keyed by the item's original content string;
   derivation keys carry no timeline length (the WB-Q7 lesson).
6. **Old saves:** field absent = nothing taken = today's behavior; no WORLD_VERSION bump, no
   migration, no invariant shape change.
7. **Empirical proof executed:** full suite (`node --test`, includes U19/U21/U22/U27/U30) +
   `npm run convergence` + U310's own two-fresh-worlds hash-equality case. Results in the commit.

Residual risks, stated plainly: (a) the compact display name is a string transform of the content
string — U310 pins the tallow letter's name so a bank edit that breaks the transform fails loudly;
(b) `notes` on the minted item duplicates the authored body — if `LETTER_BODIES` is ever edited,
already-minted items keep the OLD body (correct under law 4 — collapsed canon is immutable — but
worth knowing); (c) the read-gate/take-gate compound ordering ("take and read") resolves as a read —
acceptable, covered by a U310 case documenting the choice.

---

## 5. Falsifiable predictions for the next Opus gate (mech/string level, no judge taste)

1. **Phantom-acquisition oracle goes quiet on the container flow.** The harness
   `object-interaction/high` finding (WB-Q4: -15-40-57 t15; town t1) does not fire on
   open-chest→pocket-letter on `tallow`; the take turn's mechanics string is
   `[take:revealed-item …]`, not a trivial/gen-bank tag.
2. **The pack tells the truth.** After the take, "what am I carrying?" includes the letter's name in
   the `describePack` line; before the take (fresh boot) it does not.
3. **Read is stable across acquisition and save/load.** `read the letter` before take, after take,
   and after export/import all return the SAME authored body (string-equal) — three-way equality
   checkable in transcript.
4. **Re-take is inert.** A second "pocket the letter" produces an acknowledge line, a
   `[take:already-held]` tag, and `worldHash` unchanged across that turn.
5. **Determinism gates hold.** U19/U21/U22/U27/U30 green; `playtest:quick` reports zero
   DETERMINISM_BREAK; two fresh worlds driven with the identical take transcript hash equal (U322).
6. **After PW-2 (not PW-1):** "I pocket the crown jewels" (never revealed) yields no acquisition
   narration and an unchanged inventory — the decline register, mechanics carrying no `[take:` tag.
