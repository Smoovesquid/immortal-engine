# PACKETS — active queue + history

A packet is the unit of safe work: small enough that one agent understands every
touched file and a reviewer can read the diff. Spec the done-when and allowed-files
BEFORE editing, so divergence is caught at plan time, not screenshot time.

Schema: `id · objective · allowed_files · forbidden · invariants · test_plan ·
done_when · rollback`.

---

## ACTIVE

### H-96 — Author readable content for revealed text-items (letters/notes deliver prose, not "too faded")
**Status:** OPEN — follow-up from the chest-letter fix (`6b46c53`). The letter is now grounded and
acknowledged, but there is **no authored body**, so `read the letter` honestly reports it as
present-but-not-legible ("the ink is too far gone to read"). Correct-but-thin: a real DM who reveals
"a folded letter, waiting to be read" should have *something* to read.

**The hole (located):** `engine/decompression/generateFurniture.js` `containerContents()` returns item
*name* strings only (e.g. `"a folded letter, its seal broken"`); nothing carries a readable body.
`engine/playloop.js` `tryReadRevealedContainerItem` (the `6b46c53` reader) already finds the grounded
text-item — it just has no text to deliver, so it falls back to the "not legible" line.

- **objective:** a text-item revealed from a container can deliver short, deterministic, in-world prose
  when read — a few lines of letter/note text — while staying canon-safe (no §0 cosmology, no major
  lore, no NPC secrets). Honest "not legible" remains the fallback for items with no body.
- **allowed_files:** `engine/decompression/generateFurniture.js` (a per-(seed,nodeId,name,item)
  text deriver or a small authored table keyed to the existing `CONTAINER_LOOT` text-items),
  `engine/playloop.js` (`tryReadRevealedContainerItem` delivers the body when present), a new `tests/U###`.
- **forbidden:** an inventory/item-pickup system; LLM-authored runtime text (must be deterministic);
  surfacing cosmology/§0 or unearned NPC lore; broad refactor of the furniture model.
- **invariants:** determinism (pure projection of seed+node+item — no world shape, no hash change);
  narration ≠ canon; the reveal→read grounding from `6b46c53` preserved; the "not legible" fallback
  stays for bodiless items.
- **test_plan:** unit — open the tallow chest, read the letter, assert a stable, non-empty body is
  delivered (same seed → identical text) and that it contains no cosmology/§0 markers; a bodiless
  text-item still gives the honest "not legible" line; re-run U293 (grounding) + U256 (contents).
- **done_when:** authored/derived bodies deliver deterministically on read; new test + U293 + U256
  green; full suite + convergence 100% locked; determinism gates green.
- **rollback:** revert the `generateFurniture.js` body deriver (reader falls back to "not legible").
- **note:** decide table-of-authored-letters vs seeded-generator with the DM-voice rubric (docs/biblioteca
  Vol 17) — authored reads better but doesn't scale; a constrained generator scales but risks flat prose.

### H-95 — Scope the LLM narration context to line-of-sight (presence leak, AI-narration ON)
**Status:** OPEN — follow-up from the 2026-06-26 presence/look-around fix (`9599199`). The
deterministic (LLM-off) presence answer is now line-of-sight, but the AI-narration-ON path can
still re-leak off-room people.

**The hole (located):** `engine/ai/narratorContext.js:83-90` injects the **full** `settlement.npcs`
roster into the DM prompt (`settlement: { npcs: (settlement.npcs||[]).map(...) }`), regardless of
who is actually in the player's room. When AI narration is on and the player asks a presence
question, the LLM could volunteer a real-but-off-room NPC even though the base narration it polishes
is line-of-sight correct. Lower severity (base narration anchors it; the U195 validator rejects
*invented* NPCs but not a real off-room mention), and AI-off play is unaffected.

**Why not folded into the fix:** `settlement.npcs` in the prompt also feeds speaker auto-selection
(`narratorContext.js:41-51`) and other briefing fields — narrowing it needs care + a paid gate run
to confirm it doesn't regress dialogue, so it's its own packet.

- **objective:** the people the DM prompt lists as *present* are line-of-sight (room occupants
  inside / outdoor occupants outside), reusing `engine/structures/roomOccupancy.js`
  (`occupantsOfRoom` / `outdoorOccupants`) — the same model the grace fix uses. Keep the full roster
  available where it's genuinely needed (speaker selection), but tag/scope the *present* set.
- **allowed_files:** `engine/ai/narratorContext.js` (+ a new `tests/U###` grounding test).
- **forbidden:** changing the deterministic grace presence answer (done in `9599199`); touching
  `playloop.js`; broad narratorContext refactor.
- **invariants:** determinism (pure projection, no new world shape); narration ≠ canon; LLM-off path
  unchanged; speaker-selection behavior preserved.
- **test_plan:** unit — build the DM context for the `tallow` boot world (player alone in an empty
  room) and assert the *present-people* field names no off-room roster NPC; a multi-room/occupied
  case names only the room's occupants. Then a paid Opus-gate spot-check that presence answers with
  AI on don't name off-room folk.
- **done_when:** present-people context is line-of-sight; new grounding test green; full suite +
  convergence 100% locked; one gate run confirms no off-room leak and no dialogue regression.
- **rollback:** revert the `narratorContext.js` change (restores full-roster context).

### IT-1…IT-5 — Interior + Town polish cluster ✅ DONE 2026-06-24
**All five shipped** — repro'd LLM-OFF, fixed, test-locked, full suite green (8685).
Commits: IT-2 `86ac11e` · IT-5 `f194e72` · IT-3 `3a40ce8` · IT-1 `04c7c4f` · IT-4
`0992c6a`. Full specs + the historical hole/approach per packet:
**`docs/playtests/harness/INTERIOR_TOWN_PACKETS.md`**. Surfaced by the building +
surrounding-town playtests; navigation was already shipped (`da91a25`), so these were all
*inside the interactions*:
- **IT-2** — phantom item acquisition (HIGH; `playloop.js:6090` narrates a take with no
  `addItem` + an oracle false-positive on "take … real"). Do first.
- **IT-5** — generic failed-roll narration (biggest *quality* lever; `playloop.js:6148`
  "${place} doesn't give it to you" → echo the player's verb + the obstacle).
- **IT-3** — rolled-a-free-action (route `oracles.js:107` FREE_INTENT class roll-free).
- **IT-1** — bare "head outside" exit + presence-question precedence (deferred from nav).
- **IT-4** — building-type label drift ("inn" vs `cottage`; prompt-pin in `llmAdapter`).

### EK-1 — Law of Earned Knowledge: tier-aware narrator (kill the `llmAdapter:151` fabrication)
**Status:** ✅ DONE 2026-06-22 — **Fork A (prompt-only); ACTIVE-but-largely-latent.** Clean-origin repro
(baseline 100.0% / 8310-pass) confirmed an info-ask escaping `isInfoSeekingText` rolls a real `→ success`
("tell me the name" 15/80 seeds) and reaches line 151 — but the post-LLM validator (U142/U212) already
rejects the invented specifics and `augmentNarration` falls back to base, so the clause was mostly
*self-defeating* (it produced the deflection it banned), leaving a narrow active residual
(lowercase/numberless facts). Fix landed: `llmAdapter.js:151` rewritten to deliver-grounded /
never-coin-ungrounded, harmonized with `:147` + the validator; regression-locked by **U223**;
`npm run check` GREEN (100.0% / 8315-pass). Governing doc: `docs/LAW_OF_EARNED_KNOWLEDGE.md`.

**Objective:** Make the narrator's one fabrication path obey the Law of Earned Knowledge. Replace the
`llmAdapter.js:151` *"invent a plausible one"* clause with a **tier-aware contract** — deliver grounded
facts concretely, honest-decline unknowns, refuse protected/§0 lore regardless of roll, and route
other-minds facts to their source — **without** reintroducing the atmospheric deflection that clause was
added to kill.

**The hole (located):** `engine/llmAdapter.js:151` — on a `→ success` knowledge roll where the player
explicitly requests a proper noun, the narrator is instructed to state a concrete answer and *invent one
if needed*. It is the only narrator path licensed to fabricate; it has no tier-awareness. Tiers 1–2 are
already owned upstream by the World-Query Resolver (`engine/world/placeQuery.js`, `personQuery.js`) +
the `isInfoSeekingText` decline net + roll-gating (`llmAdapter.js:150`); §0/place-meaning is guarded at
`llmAdapter.js:116`; NPC voice is bounded at `npcVoicePrompt.js:169`.

**REPRO FIRST (LLM-OFF — required before any edit):**
1. `buildSystemPrompt` is a **pure function** (`llmAdapter.js:43`) → unit-assert that for a proper-noun
   ask + `→ success`, the emitted prompt currently contains *"invent a plausible one"* (the risk, in
   black and white).
2. Deterministic routing probe: confirm which asks actually REACH line 151 vs. are intercepted by
   `placeQuery`/`personQuery`/the decline net (all deterministic, LLM-off).
3. **The A/B fork the repro must resolve** (this decides the fix's size):
   - **(A)** If grounded proper-noun delivery is now fully owned by the resolvers (grounded asks never
     reach line 151), then line 151 only ever fires on *ungrounded* asks → its invent clause is pure
     fabrication → replace with honest-decline + protected floor + source-routing. **Low touch, prompt-only.**
   - **(B)** If grounded asks STILL reach line 151, flipping invent→decline would regress them to
     deflection → the grounded fact must be threaded into `ctx` (or `placeQuery` coverage extended) so
     delivery happens before any decline. **Higher touch.**

**Tier-aware contract (the replacement for line 151):**
- canon holds the fact → state it **concretely** (preserve specificity);
- canon lacks the fact → **honest-decline** in DM voice (no invented name);
- fact is **protected lore / §0** → refuse/deflect in DM voice **regardless of roll** (symptoms/residue
  only — never the hidden cause);
- fact belongs to an **NPC/source** → route to that source, never omniscient narration.

**allowed_files:** `engine/llmAdapter.js` (the prompt clause + any tier tag it reads); IF the repro lands
on fork (B): a minimal `ctx` field via `engine/ai/narratorContext.js` to carry the grounded fact / tier
tag. Tests: `tests/corpus/C4.corpus.mjs` (+ a fixture in `scripts/convergence/fixtures.mjs` if a
protected-lore case needs one) and a `buildSystemPrompt` unit test.

**forbidden:** no broad lore system; no new canon data; no invented facts; no §0 leakage; no
secret/control/motive leakage; no broad `playloop` rewrite; no test weakening; **no paid gate.**

**invariants:** narration ≠ canon (prompt-text + ctx-tag only; zero state/RNG/Canon-Log mutation);
determinism tripwires (U19/21/22/27/30) stay green; LLM layer still never throws (silent fallback);
the deterministic resolvers/decline net behavior is unchanged (this packet only retires fabrication and
adds the protected/source rules).

**test_plan:**
- *Prompt-unit* (`buildSystemPrompt`, deterministic): proper-noun + success → contract present, no "invent";
  protected/§0 ask → refusal language present regardless of roll.
- *Corpus C4* (deterministic, `npm run convergence`): success + grounded public fact → concrete answer;
  success + missing proper noun → honest decline, no invented name; ask about NPC hidden motive/secret →
  no omniscient narrator answer; ask about unobserved place/object → route to observation/action or decline.
- *Regression:* existing `placeQuery` founding/events/population still deliver; existing honest-decline
  cases still pass; **no** return to vague "a name forms in your mind" when the answer is actually grounded.

**verify:** targeted prompt-unit + `npm run convergence` + `node --test` + determinism tripwires if `ctx`
touched. No paid gate.

**rollback:** prompt-clause edit (+ optional one `ctx` field) in named files — revert them.

---

### P-81 — One continuous zoom + organic layout + legible biome tiles
**Status:** P-81a ✅ (zoom button removed, `e5f7e60`) · P-81c ✅ (legible tiles:
trees≠mountains + marsh de-wormed, `42f3407`) · P-81b ✅ (organic curved-road
scatter, `0250511`) · "retire legacy tabs" ✅ effectively — `renderMap` is already
the one continuous map; only a stale "Map (zoom levels)" label remained (relabelled,
uncommitted in the entangled `v1.js` batch). `renderLocalMap` intentionally KEPT as
the error fallback in `renderWalkPlace` (not a scale tab; removing it deletes error
handling). Remaining: broader biome-sprite audit beyond mountains/marsh, if wanted.
Spec'd 2026-06-14 (Tim's render notes). The map is the "one map to rule
them all" — a single continuous surface you zoom *through* (overworld → region →
village → building), not discrete views swapped behind a button. Memory:
`project_one_map_continuous_zoom`. Aligns with `project_map_beauty_dream` and
`project_dm_only_verb` (map = read-only aid).
**Why:** Three live defects break the illusion: (1) layout is grid-linear — roads and
buildings snap to a lattice instead of scattering organically with terrain; (2) a zoom
BUTTON exists — the wrong model; zoom must be fluid semantic zoom (scroll/pinch), no UI
chrome; (3) terrain tiles are unreadable — **forests render like mountains** at low zoom,
and an unidentified **"circles with giant worms"** tile fails to communicate its biome.

**Objective:** One continuous, chrome-free zoomable map with organic village/road layout
and biome tiles legible at a glance (a forest never reads as a mountain range).

**Root causes (located — investigation 2026-06-14):**
- Zoom button: `public/map/oneMap.js:926–950` (M7-S1 +/−/fit). Wheel-zoom (`oneMap.js:894`)
  + drag-pan already ARE the continuous path → the buttons were redundant. (Already removed
  in an uncommitted edit; verify + keep.)
- Linear layout: `public/map/placeFromNode.js:79–99` (M7-S3) lays buildings in fixed rows
  (`colGap=3.2,rowGap=8.5,perRow=√count`) along a straight E-W road (`pathY`). Replace the
  row-cursor grid with seeded cluster+jitter (`rng.js`) and curve the road. NB: village NODE
  positions come from engine canon `node.x/node.y` (`worldSpace.js:27`) — world-map scatter
  is a separate engine-side, determinism-sensitive concern.
- Trees≈mountains: `oneMap.js:58 drawConifer` and `:78 drawPeak` both draw a filled
  triangle; at low zoom they're indistinguishable. Give contrasting silhouette/palette
  (rounded tree-clump vs. ridged grey peak) that survives small `sz`.
- The "worm-circle" tile = **marsh/swamp** (`oneMap.js:258–267`): a `marshWater` ellipse
  (the circle) with reeds as wavy quadratic strokes radiating from it (`:266`) → reads as
  worms. Redraw (horizontal water hatching + short vertical reed ticks, not radiating curves).
- Legacy "scale tabs" still exist (`v1.js:134, :2191`; `LocalMap.js` fallback at
  `v1.js:2040, 2106`). Truly "one map" means retiring those.

**Sub-packets (do in order; each ships green + a live screenshot):**
- **P-81a — Kill the zoom button; fluid semantic zoom.** Remove the discrete zoom-view
  toggle; drive level-of-detail from a continuous scroll/pinch zoom factor. No button.
  - allowed: `public/v1.js`, `public/map/*` (renderer + input), no engine state change.
  - done_when: scroll/pinch zooms smoothly overworld→building with no view-swap button;
    suite green; `worldHash` unchanged (render-only).
- **P-81b — Organic placement.** Villages scatter (clustered, irregular, terrain-aware);
  roads curve between nodes instead of gridlines. OPEN DECISION (see below): derive the
  scatter DETERMINISTICALLY from existing node coords (seeded jitter via `rng.js`) so
  `worldHash`/replay holds — vs. a pure render-time scatter. Default: deterministic.
  - allowed: `public/map/*` (+ a deterministic layout helper); engine only if the scatter
    must persist (prefer NOT — keep it derived).
  - done_when: a village reads as an irregular cluster, not a lattice; roads curve;
    determinism preserved.
- **P-81c — Legible biome tiles.** Distinct silhouettes/palette so forest≠mountain at low
  zoom. IDENTIFY the "worm-circle" tile (suspect swamp/marsh — its sprite doesn't match
  its meaning) and redraw it. Audit every biome sprite for glance-legibility.
  - allowed: `public/map/*` (tile art/sprites), the biome→sprite mapping.
  - done_when: forest/mountain visually unambiguous zoomed out; the worm-circle biome is
    identified + redrawn to read correctly; live screenshots per biome.
- invariants: render-only where possible; any generated layout is deterministic via
  `rng.js`; map stays a read-only aid (no new verbs); `worldHash` stable.


### P-80 — The world testifies: consequence for gratuitous magic
**Status:** spec'd 2026-06-14. Design canon: `docs/MORALITY_SYSTEM.md` ("the world's
recoil, the attention of chaotic gods"; karma as real physics; One God's ward over
children). Memory: `project_gratuitous_magic_consequence`.
**Why:** Cantrips are at-will by design (correct 5e), but out-of-combat blasting of
trees/villagers hits the generic prose adjudicator (`playloop.js` ~4518) with ZERO
consequence — no social, environmental, or divine recoil. The world must testify.

**Objective:** An offensive working aimed out-of-combat at the innocent or the living
world draws a consequence sized to the deed — rendered as the world's recoil (full-craft
prose, no readout, no power-high; McCarthy law), never a mechanical prompt.

**The ladder (default = a SIGN; escalation = intervention):**
1. **Petty** (a tree, a one-off) → scorch-scar on the node + small ecology corruption
   tick; an omen. The gods felt, not staged.
2. **Repeated harm to innocents** → the good gods (Virtue covenant) send enemies —
   escalating avengers (`spawnEncounter`).
3. **Dedicate the death of an innocent** (deliberate, not collateral) → engage the chaos
   gods: a deal with the devil — they may aid you, at a price. Reuses the existing
   dark-gift path (`engine/magic/forbiddenGates.js`): a dedicated innocent-kill spikes
   corruption → a forbidden gift arrives unbidden.
4. **A child** → hard absolute exclusion (One God's ward). Never resolves; already law.

**Sub-packets (do in order, each ships suite-green + a live playtest report):**
- **P-80a — Spine: detect + classify.** In the out-of-combat cast path, detect an
  *offensive* working and classify its target: `person-innocent` / `living-world` /
  `void`. New module `engine/magic/castConsequence.js` (pure; classify + route).
  - allowed: `engine/magic/castConsequence.js` (new), `engine/playloop.js` (route before
    the generic `cast:` adjudicator), one test `tests/U141.castConsequence.test.js`.
  - done_when: classification unit-tested deterministically; route returns the existing
    flavor unchanged for non-offensive/void casts (no behavior regression); suite green.
- **P-80b — Social + environmental tiers.** `person-innocent` → witness alarm + NPC
  trust/faction recoil (`npcTrustDelta`). `living-world` → `scarifyNode` + ecology tick.
  - allowed: `engine/magic/castConsequence.js`, `engine/playloop.js` (surfacing only).
  - done_when: blasting a villager drops trust + a witnessed-recoil line; blasting trees
    scars the node; `worldHash` stable under replay; suite + playtest:quick green.
- **P-80c — Divine tiers.** Repeat harm → good-god avengers via `spawnEncounter`.
  Dedicated innocent-kill → corruption spike → existing dark-gift (the chaos pact).
  Child target → reaffirm the absolute exclusion. Omen prose throughout (no smiting).
  - allowed: `engine/magic/castConsequence.js`, `engine/playloop.js`, possibly
    `engine/magic/forbiddenGates.js` (only if a new dedicated-kill threshold is needed).
  - done_when: a live playtest shows the three escalations firing; determinism preserved.
- invariants: `rng.js` only; mutations via `applyDeltas`; narration≠canon; the McCarthy
  law (no readout, no power-high, full prose); child exclusion is absolute.
- rollback: new module + named hook lines in `playloop.js`; revert the named files.

### P-66 — Unify movement inputs + interactions on the walkable place
**Status:** P-66a ✅ done · P-66b ✅ done · P-66c ⏸ deferred (deliberate version-bump pass).
Suite 6,934 green; live-verified (compass/text/click all move one token; clicking
Corwin opened the existing dialogue). P-66c deferred ON PURPOSE: persisting position
in the world + retiring `scene.interior` touches WORLD_VERSION + `ensureWorld` + the
determinism suite — high-risk/low-visible, so it gets its own careful pass (inv #8,
#11) rather than being rushed. Position currently persists in `ui.place` across
re-renders but resets on reload/resume; that's acceptable until P-66c.
**Why:** The local map is now one continuous walkable place (click-to-walk, wall/door
collision, fog — `placeNav.js`, `NAV1`, live-verified). But two gaps remain before it's
the *whole* loop: text/compass still drive the engine's legacy node/interior movement
(two movement systems), and walking past an NPC/building does nothing (no interactions).

**Objective:** Make text + compass + click all move the SAME token, and make reaching
an NPC or building interactable — so the unified scale is the only way you move and act.

**Sub-packets (do in order, each ships green + verified):**
- **P-66a — Compass/text nudge the token.** The N/W/E/S buttons and "go north"/"walk
  …" text move the walkable token (via `walkTo`), not the engine's node/interior
  compass, while standing in a place. Inter-village travel stays explicit (region Map
  tab / walking to the place edge — define which).
  - allowed: `public/v1.js`, `public/map/placeNav.js` (+ a small intent shim if needed)
  - done_when: typing "go north" and clicking both move the same `@`; suite green; no `worldHash` change (movement is client position).
- **P-66b — Interact by reaching.** Walking adjacent to an NPC token offers talk
  (routes to engine `playerMove("talk to X")`); reaching an enemy starts combat;
  reaching loot picks up. Click-on-token also works (parity with text).
  - allowed: `public/v1.js`, `public/map/handDrawnPlace.js` (hitboxes), `public/map/placeFromNode.js`
  - done_when: reaching/clicking an NPC opens the existing dialogue; an enemy starts the existing combat; suite green.
- **P-66c — Persist position + retire the interior "mode".** Player position saved with
  the world; `scene.interior` no longer drives a separate local view (the start is just
  the token in the cottage bedroom on the one place).
  - allowed: `engine/state.js` (persist pos field + normalizer), `engine/playloop.js` (begin), `public/v1.js`
  - invariants: new persisted field MUST be added to `ensureWorld` (inv #8); WORLD_VERSION bump if shape changes (inv #11); replay stays stable.
  - done_when: save/resume keeps your position; determinism suite green; `playtest:quick` clean.

**Global invariants for P-66:** §13 one walkable scale, §6 narration≠canon, §1–2
determinism. Movement is client position; anything that changes canon (talk, fight,
travel, time) still routes through `playerMove`/`applyDeltas`.

**Forbidden:** rewriting the engine's combat/dialogue; broad refactor; `Math.random`;
breaking the determinism suite; touching the prototype (`__preview/`).

**Rollback:** each sub-packet is a small diff in `public/` (P-66a/b) or one guarded
engine field (P-66c) — revert the named files.

---

---

## QUEUE — Sellable / Surface-the-Depth track (specced 2026-06-16)

> **REFRAMED 2026-06-16 → the Realization Ladder.** `docs/PATH_TO_SELLABLE.md` was rewritten
> around Tim's realization ladder, which is ALSO the build order. **New ordering:** work the
> lowest rung not yet producing its "wow." That is **Rung 1 = P-86 (correctness)** — promoted
> from "floor" to the foundation of the whole funnel; it's where we stand (gate ~17%). The
> surfacing packets map to higher rungs and are **deferred until their rung comes due**:
> P-83 (rumor graph) → rung 4; P-84 (creation-myth) → rung 6; P-85 (lore answers) → rung 5.
> **P-82 (historical voices) is BENCHED** — rung-2 *flavor*, capability proven, not needed
> until plain conversation already wows (and pending the voice cost-model). Climb on the
> experiential gate, not suite-green. The packet specs below stand as-is; only the PRIORITY
> changed. New near-term work: a **return-session test** (proves "never forgets," rung 4) and
> the **bespoke-voice cost model** (before any rung-2 surfacing).

**Source:** `docs/WHAT_THIS_IS.md` (full code audit) + `docs/PATH_TO_SELLABLE.md` (the plan).
**Strategy (three moves):** (1) **surface the depth** — turn the built-but-dark systems
(historical voices, rumor graph, creation-myth secret, lore answers) into things a stranger
feels in 20 minutes; (2) **make it correct** — the Opus-gate correctness floor; (3) **then
build the soul** — the morality milestones (already tracked in `docs/MORALITY_SYSTEM.md`).

**Post-lane runway (specced 2026-06-24):** `docs/POST_LANE_PACKETS.md` turns "build the soul"
+ the UI/map remainder into two collision-safe lanes — **Lane D (Morality M4–M11, Codex)** with a
parallel pantheon-data strand (D-DATA, Sonnet, startable now), and **Lane N (UI redo + map M5
beauty, Sonnet, `public/`-only, startable now)**. Only Lane D's mechanics spine waits on W2.

**The audit's central finding:** most of what makes this special is *built and working but
not reaching the player.* So this track is mostly **wiring + surfacing**, not building —
the highest value-per-hour work in the project. P-82–P-85 are Phase 1 (surfacing). P-86 is
the ongoing correctness floor (Phase 0). P-87+ are Phase-2-and-beyond *placeholders* —
deliberately under-specified because they'll change and depend on decisions still owed
(the wedge, the audience, the engineer-friend conversation; see PATH_TO_SELLABLE §"three
decisions").

**Ordering / anti-drift:** the ROADMAP R0–R3 adjudication spine and the correctness floor
(P-86) still outrank surfacing when they conflict — a deep system surfaced onto a broken
turn reads as broken. Within Phase 1: **P-82 is the headline** (start here); P-83/P-84/P-85
are independent and can run in any order or in parallel worktrees.

### P-82 — Light up the historical-figure voices (the unplugged 488-corpus)
**Status:** spec'd 2026-06-16. THE headline surfacing packet. Design: `docs/HISTORICAL_FIGURES.md`.
**Why:** the audit's sharpest finding. The RAG voice pipeline is wired end-to-end —
`engine/npc/dialogue.js:614` (`npc.historicalFigure` → `outcome.historicalFigureId`) →
`engine/playloop.js:852` → `public/v1.js:545` (`/api/npc-voice`) → `server.js:284`
(`retrieveChunks`) → `server/npcVoicePrompt.js` (VOICE ARCHIVE block) — and there are **488
corpus files** (~437 original NPC backstories, ~51 real people + mashups: Lincoln, Marcus
Aurelius, Joan of Arc, Genghis Khan, Jobs×da Vinci, Goldblum×Socrates…). **The one missing
link: no generated NPC is ever assigned a `historicalFigure` value**, so in a normal
playthrough NONE of it surfaces. This is a finished feature switched off.
**CORRECTED PREMISE (red-team, 2026-06-16):** the ~437 backstory corpus files are NOT
generic role-files to sprinkle onto procedural NPCs. They are the **authored population of
the Westmarch pack** (`packs/fantasy/westmarch/`) — named characters (Henn the Academy
librarian) inside a coherent authored society whose factions are the corpus `cluster`
values (thornwall_commons 87, harbor_quarter 52, wild_road 44, academy_of_runes,
coin_cult, house_aldenmere, hollow_court, covenant_of_seven, even church_of_incrementalism).
Attaching "Henn, who knows House Aldenmere and the Coin Cult" to a random *procedural*
villager would surface INCOHERENCE (he'd reference factions that aren't in that world). So
lighting up the voices = **make the Westmarch the playable slice**, not sprinkle-by-role.
Bigger than one wire — but far higher value: it lights up an entire authored region (its
factions, its substrate, the Church-of-Incrementalism Easter egg) at once. The default
game currently boots the PROCEDURAL `fantasy` pack (`public/v1.js:99 primaryId:'fantasy'`),
NOT westmarch.
**Objective:** the Westmarch becomes a selectable/playable slice in which its authored NPCs
carry their `historicalFigure` corpus links and speak grounded in them — including the ~51
marquee real-people figures placed at fitting roles — with graceful fallback when the local
model is down.
**THE crux to verify FIRST (P-82a):** does the Westmarch pack's NPC data actually SET
`historicalFigure` (= the corpus id) on each NPC? The corpus was generated; it is unknown
whether the pack's NPCs link back to it. If they don't, even playing the Westmarch won't
light up the voices until that link is written. This single unknown decides whether P-82 is
"wire the slice" (cheap) or "relink an authored world" (medium). Verify before building.
**Dependency to name up front:** bespoke NPC voice runs on the *local* model (Ollama,
`server/localLlmProvider.js`). Without it, the engine serves solid templated dialogue (the
links are harmless); the *RAG-grounded* voice only proves out with Ollama up. This packet's
live playtest needs the local model running. (See red-team risk #4: per-NPC local voice is
also an unproven *production* economics question — flagged for P-88, not solved here.)

**Sub-packets (do in order; each ships suite-green + a live playtest report):**
- **P-82a — Verify the link + make the Westmarch selectable.** Confirm whether
  `packs/fantasy/westmarch/` NPCs carry `historicalFigure` corpus ids; make the pack
  loadable/selectable in v1 (it's already in `packs/manifest.json`). No new casting system
  yet — first learn what's actually wired.
  - allowed: read-only audit of `packs/fantasy/westmarch/*`; `public/v1.js` (pack
    selection), `engine/rulesets.js` if the pack needs registering. Findings recorded.
  - done_when: the Westmarch is selectable and you can confirm, server-side, whether an
    NPC's `historicalFigure` reaches `retrieveChunks`; the finding is written down.
  - **DONE (ChatGPT/Basecamp, investigation-only, 2026-06-18) — verdict: "relink an authored
    world," not "wire the slice."** The link is missing, confirmed multiple ways: no
    procedural code sets `historicalFigure` (`engine/decompression/extractPresent.js:34`,
    `engine/npc/npcGenesis.js:133,155`, `engine/decompression/decompress.js:129` all omit
    it); the 6 static Westmarch NPCs (`packs/fantasy/westmarch/pack.json:179-218`) have zero
    `historicalFigure` fields and no name match against the corpus; Westmarch's factions
    (`crown-watch`, `seil-compact`) don't match any of the corpus's 9 clusters
    (`thornwall_commons`, `harbor_quarter`, `wild_road`, `academy_of_runes`, `coin_cult`,
    `house_aldenmere`, `hollow_court`, `covenant_of_seven`, `church_of_incrementalism`); and
    `retrieveChunks()` (`server/rag/ragRetriever.js:31,58`) keys directly off an exact corpus
    filename id with no roster/index bridge (`server/rag/npc-roster.json` referenced in
    `docs/KB_MAP.md:496` does not exist). **P-82b is required** before any voice lights up —
    someone must hand-cast `historicalFigure` ids onto Westmarch NPCs by name/cluster.
- **P-82b — Relink (only if P-82a shows the link is missing).** Write `historicalFigure` =
  corpus id onto each Westmarch NPC by matching name/cluster → corpus file. Deterministic,
  data-only (pack authoring), no engine change ideally.
  - allowed: `packs/fantasy/westmarch/*` (NPC data), a one-off matcher script in `scripts/`.
  - invariants: `historicalFigure` is an only-when-set optional field (no WORLD_VERSION
    bump); `worldHash` stable; pack remains deterministic.
  - done_when: a Westmarch playthrough's named NPCs retrieve their corpus chunks; the voice
    is visibly colored; a live report with the local model up.
  - **DONE (Claude Opus worker, `a47f487`, 2026-06-18) — all 6 static NPCs cast by
    role/personality fit** (corpus never names Westmarch NPCs, so role-fit was the only
    viable bar, not name/cluster match): Aldric Hale → `captain_rath`, Renna Voss →
    `scarlet_compact_quartermaster`, Warden Maren → `covenant_elder`, Corin Blackthorn →
    `wild_hunter`, Dalla the Smith → `forge_master`, Old Gerren → `father_len`. Faction
    mismatch (crown-watch/seil-compact vs corpus clusters) flagged but did NOT block —
    no faction rename needed. Verified independently by Basecamp: diff is exactly the 6
    additive `historicalFigure` lines (no engine touched, no WORLD_VERSION bump); all 6
    corpus files (`server/rag/corpus/{id}.json`) confirmed to exist on disk; full suite
    reran clean 7939/0. **Bindings are thematic, not canonical** — worth flagging if/when
    P-82c casts marquee figures, in case any of these 6 should be displaced.
    **Not yet live-verified** (no playthrough/screenshot with local model up) — done_when's
    "voice is visibly colored" bar is unconfirmed, only the load-path is confirmed.
- **P-82c — Marquee placement (the demo moment).** Cast the ~51 real-people figures
  (Marcus Aurelius as a sage, Twain as a tavern wit) at fitting Westmarch roles with
  personalities per `HISTORICAL_FIGURES.md`. The "argue philosophy with Aurelius, then go
  con Twain" demo beats.
  - allowed: `packs/fantasy/westmarch/*`; `engine/npc/npcGenesis.js` only if a placement
    hook is needed.
  - done_when: a live Westmarch playthrough meets ≥2 marquee figures grounded in their
    corpus; screenshots in the report.
- invariants: server never leaks the key (existing); RAG only shapes WORDS, never the
  engine's share/deflect/lie decision (existing contract); silent fallback when the local
  model or a corpus file is absent.
- rollback: new module + one optional NPC field + genesis hook lines — revert the named files.

### P-83 — Surface the rumor / claims social graph
**Status:** spec'd 2026-06-16. Engine: `engine/claims.js` (six-degrees propagation, tested),
`engine/rumor/*` (tiered minting), `engine/npc/perspectiveFilter.js`. Design:
`docs/RUMOR_LAYER.md`.
**Why:** the propagation engine works and is deterministic, but it's invisible — a casual
player can't tell the gossip they hear is a distorted, traceable artifact rather than flavor
text. The mechanism is real; the player's *awareness* of it is thin.
**Objective:** a player can ASK around and HEAR the same event told differently by different
people, notice it's distorting with distance, and (where the UI track provides a panel) see
a "what people are saying" board. Engine-side this packet ensures `askNpc` surfaces the
NPC's carried claims/rumors as answerable dialogue, tagged with their fidelity, in the NPC's
voice.
**Sub-packets:**
- **P-83a — Claims/rumors answer in dialogue.** When asked about a subject an NPC holds a
  claim/rumor about, the dialogue returns it (at its distortion tier), distinct from a
  direct-witness fact. Two NPCs with fractured versions answer differently.
  - allowed: `engine/npc/dialogue.js`, `engine/npc/perspectiveFilter.js`, `engine/playloop.js`
    (surfacing only); tests `tests/R*-claimsDialogue.test.js`.
  - done_when: live, asking three NPCs about one distant event yields tiered, diverging
    accounts; determinism + suite green.
- **P-83b — Player deeds become traveling rumors (M2-remaining overlap).** A witnessed
  notable deed mints a claim that propagates so a later town greets you having "heard." This
  is the reputation-precedes-you beat; it overlaps Morality M2-remaining — coordinate, don't
  duplicate.
  - allowed: `engine/playloop.js` (deed→mint hook), `engine/rumor/mint.js`, `engine/claims.js`.
  - done_when: a deed in town A is referenced by an NPC in town B after travel; suite green.
- **P-83c — (depends on UI track) Rumor board panel.** A read-only "what people are saying"
  view: body, carrier + location, fidelity/age, contested marker. Flagged as depends-on-UI;
  engine already exposes the data.
- invariants: claims are epistemic-only — they NEVER promote to engine truth without a
  non-LLM step (the two-variance wall); `rng.js` only; narration≠canon.

### P-84 — Open the creation-myth door (a reason to keep going)
**Status:** spec'd 2026-06-16. Engine: `engine/substrate.js` (cosmology→region→node descent
+ the sealed `deep:foundation`). Wall: `docs/ARCHITECTURE_OVERVIEW.md §7` (the
witness-object / god-frame wall — the gods may never categorize the orb as sacred).
**Why:** the substrate history is real and already colors NPC voice, but the sealed
secret isn't a thread the player can *pull*, and a stranger wakes with no goal (the
blank-page problem). The buried mystery is the natural hook — it gives a reason to explore
and teaches the world by exploring it.
**Objective:** a new game seeds a faint, pullable thread toward the buried truth — a first
hook at/near character start (a rumor, an out-of-place detail, a wrong-aged thing) that a
curious player can follow, with the substrate's node/region events becoming answerable
breadcrumbs along the way. The reveal stays author-paced and respects the wall: the secret
is approached, never handed over, and the god-frame never claims it.
**Sub-packets:**
- **P-84a — The opening hook.** Surface one substrate-anchored hook in the first scene(s)
  (engine-owned, not LLM-invented) — a thread the player may take or ignore.
  - allowed: `engine/playloop.js` (begin/first-scene hook), `engine/substrate.js` (a
    surfaceable-hook selector), `engine/ledger.js` (seed an open question).
  - done_when: a fresh game presents a concrete, optional mystery beat in the first few
    turns; deterministic; suite green.
- **P-84b — Breadcrumbs answer.** Substrate node/region events (the founding, the crisis,
  "the winter a stranger stayed") become answerable when the player asks pointed questions
  at the right place — pulling the thread yields real, consistent fragments. (Pairs with P-85.)
  - allowed: `engine/substrate.js`, `engine/npc/dialogue.js`, `engine/playloop.js`.
  - done_when: following the hook surfaces ≥2 consistent substrate fragments; suite green.
- **P-84c — (author-gated) The deep reveal.** The path toward `deep:foundation` — gated,
  rare, and respecting the witness-object wall. Likely an authored arc
  (`content/arcs/*.arc.js`) rather than procedural. Spec deferred until P-84a/b are live and
  the slice's pacing is known.
- invariants: the sealed truth is engine-authored and `[vision:raw]`/`[reveal:true-edge]` —
  it must NEVER reach the LLM (`server.js` already short-circuits these); the god-frame wall
  holds; determinism preserved.

### P-85 — Make the world answer (the "who was the elder before Kael?" class)
**Status:** spec'd 2026-06-16. Source: the Opus-gate Lore-hound failures + the audit.
**Why:** pointed lore questions sometimes hit a deflection or a non-answer even though the
knowledge-graph / substrate / claims / RAG that *could* answer them already exist — the
classic surfacing gap. The world feels thin exactly when it isn't.
**Objective:** route a pointed factual question to the deepest source that actually knows
(NPC knowledge-graph → substrate → claims/rumors → common knowledge), and answer in voice;
fall through to honest "I don't know" only when nothing holds it. **Hard boundary (Tim's
call):** where NOTHING in canon holds the answer, the system must NOT invent canon on the
fly — the `mintFact`/lore-as-fact path is a reserved design decision (hallucination risk vs.
the determinism moat) and is explicitly OUT of this packet. This packet only *surfaces what
exists*; generating new canon is a separate, Tim-owned decision.
- allowed: `engine/npc/dialogue.js`, `engine/npc/perspectiveFilter.js`,
  `engine/npc/npcDepth.js`, `engine/substrate.js`, `engine/playloop.js` (routing only);
  tests for the resolution ladder.
- done_when: the Opus-gate Lore-hound persona's "you keep dodging" / non-answer failures
  drop; a pointed question reaches the deepest holder and answers in voice OR honestly
  declines; no invented canon; suite + gate green.
- forbidden: minting new world-facts to satisfy a question (reserved for Tim); `Math.random`.

### P-86 — Correctness floor (continue the Opus experiential gate)
**Status:** ONGOING (Phase 0). Harness: `scripts/dm-playtest.mjs` (4 personas + adversarial
judge over the live DM path). Memory: `project_opus_gate`. Trajectory: 35% → ~17% failing
turns.
**Why:** a deep system surfaced onto a broken turn still reads as broken. The MVP bar (a
stranger says "a good DM running a *solid* game") needs the crunch correct, with the
Rules-Lawyer-DM persona as the gating critic.
**Objective:** drive the gate reliably under ~10% failing turns across seeds/personas by
clearing the recurring classes — meta-questions resolved with dice, hazards narrated without
applying damage, melee mistagged as a spell, navigation dead-ends in response to social
intent.
- allowed: `engine/playloop.js`, `engine/grace/gracefulAdjudication.js`,
  `engine/combat/*`, `engine/llmAdapter.js`, targeted tests (the U-series pattern).
- done_when: a full 4-persona run logs ZERO crunch-inconsistency failures from the
  Rules-Lawyer persona and <10% overall; each fix ships with a regression test.
- note: this is the existing fix loop, not a new system — kept here as a named, standing
  line so it doesn't fall off the board while surfacing work runs.

### P-89 — Return-session "never forgets" gate (proves the moat)
**Status:** spec'd 2026-06-16. Rung 4 on the ladder (`docs/PATH_TO_SELLABLE.md`). Parallels
`scripts/dm-playtest.mjs` (the single-session Opus gate). Runs on the `.env` API key from the
CLI, off the subscription window (`docs/BUILD_BUDGET.md`).
**Why:** the moat is "never forgets across sessions," but the single-session gate CANNOT
exhibit it — there's no prior session to contradict. We can currently measure "good DM," not
"never forgets." This is the missing test. It checks the three-part memory problem: (1)
**storage held**, (2) **narration faithful to canon**, (3) the **right memory surfaced at the
right moment** (felt memory — perfect storage you don't bring up reads as forgetting).
**Objective:** a two-act harness with a REAL save→quit→reload between acts. Act 1 (fixed
deterministic transcript) seeds checkable facts and auto-derives a **memory manifest** from
Canon Log + engine state (the answer key — never from narration). Act 2 (LLM player +
adversarial judge) returns and probes each fact three ways. Three scores: persistence /
fidelity / recall.

**Sub-packets (do in order; milestone cadence, not per-commit):**
- **P-89a — Manifest from canon.** Run a fixed Act-1 transcript; extract the ground-truth
  manifest (one each: consequence, promise/relationship, acquisition/state, world change,
  moral deed) from `world` + Canon Log, NOT narration. Same seed+inputs → same manifest.
  - allowed: `scripts/returnSession.mjs` (new); reuse `canonGroundTruth` from `dm-playtest.mjs`.
  - done_when: a stable manifest of ≥5 facts derives reproducibly from a seeded run.
- **P-89b — The boundary.** Save→quit→reload through the REAL save path (`engine/save.js`
  export/import, and/or the v1 `slot1`), then assert the manifest survives in engine state.
  This is the **persistence** score (≈100% expected; a miss = SAVE_CORRUPTION).
  - allowed: `scripts/returnSession.mjs`; read-only use of `engine/save.js`.
  - done_when: post-reload state matches the manifest; a deliberately corrupted save fails.
- **P-89c — Act 2 probe + adversarial judge.** Fresh session; the LLM player probes each fact
  via (1) direct recall, (2) passive surfacing (unprompted, when relevant), (3) contradiction
  bait. An Opus judge scores fact-by-fact, defaulting to forgotten/contradicted unless clearly
  shown. Emits **fidelity** + **recall** scores + a report under `docs/playtests/`.
  - allowed: `scripts/returnSession.mjs`; the Anthropic client pattern from `dm-playtest.mjs`.
  - done_when: a run produces the three scores + a per-fact report; bug classes tagged
    (SAVE_CORRUPTION / CANON_CONTRADICTION / AMNESIA / FALSE_MEMORY).
- invariants: Act 1 deterministic (no `Math.random`); manifest derived from canon, never
  narration; API-key/CLI, off the window; milestone cadence.
- rollback: a standalone script + a report — delete the script; touches no engine code.

### P-87 — The guided demo + the deck (Phase 2 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Do NOT build until P-82–P-86 land and the wedge
is chosen (PATH_TO_SELLABLE §"three decisions").
**Objective (sketch):** a ~15-minute guided experience that shows the moat on purpose (talk
to a historical figure → hear a distorting rumor → return later and watch the world remember
exactly what you did → break a determinism-defying thing and have it hold), plus a short deck
built straight from `WHAT_THIS_IS.md`'s system table + moat column. Shape depends on the
chosen wedge; left intentionally thin.

### P-88 — Productize (Phase 3 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Driven by the engineer-friend conversation; do
NOT spec in detail yet (it WILL change).
**Objective (sketch):** the decisions that turn a great local prototype into something
people pay for — hosting (the local-Ollama NPC-voice dependency becomes a hosting/cost
decision), accounts + save sync, billing, the UI (separate track), and a content-moderation
posture for the morality system's adult themes. Done-when: a person who is not Tim can sign
up, play, leave, and return to their world intact.

### Phase 4 — Build the soul (morality M4–M11)
**Not duplicated here.** The morality milestones (corruption→capability, redemption + the
point of no return, crime & detection, the visible pantheon + the gaze, the omen layer, the
human Cassandra, dedication rites, the keystone friend) are fully specced and tracked in
`docs/MORALITY_SYSTEM.md` (built to M2). When this track reaches the soul, pull from there.
This is the long differentiator and the second act of word-of-mouth; sequence it
deliberately after the cheap surfacing wins, each slice checked against the Camera Rule.

**Track-wide forbidden:** inventing canon to fill gaps (P-85 boundary; `mintFact` is Tim's
call); `Math.random`; mutations outside `applyDeltas`; narrator-as-canon; touching the
R0–R3 adjudication spine while it's in flight.
**Track-wide rollback:** every Phase-1 packet is new-module + optional-field + named hook
lines — revert the named files.

---

## QUEUE — Economy, Items & Salvage/Build track (specced 2026-06-11)

Source discussions: items/loot/crafting audit + `docs/SALVAGE_AND_BUILD.md`.
Order matters: gold must mean something before the catalog grows; salvage must
yield materials before crafting; crafting before construction.

### P-67 — The spend loop (shops buy/sell) ✅ DONE 2026-06-11
**Shipped:** `engine/economy/shop.js` (deterministic weekly stock by shop type +
economy-modulated prices + purse math with change), `tryTrade` in playloop
(buy/sell/browse/haggle in prose), `setPurse` op, background pocket money at
chargen, inventory panel shows catalog names. Trades are timeline canon and
deplete shelves until the weekly restock. U119 ×11, UX2 +4 rows, suite 7,433
green, playtest:quick clean, live-verified (browse listed two shops; haggled
a potion to 42g5s with the Persuasion line shown; purse chips updated).
**Why:** loot is only satisfying when gold means something. Every piece exists
(settlement `shops` data, `basePrice` on item defs, purse + `addCurrency` op) —
nothing connects them.
**Objective:** "I buy a healing potion" / "I sell the shortsword" resolve in
prose at any settlement with a fitting shop. Haggling = social adjudication
(existing Stage B), not a menu. Stock is deterministic per shop + seed + restock
clock. Prices: basePrice modulated by settlement economy.
- allowed: `engine/playloop.js` (trade intent), `engine/economy/` (new, small),
  `engine/effectsCore.js` (only if a `trade` op is cleaner than addItem+addCurrency pairs)
- done_when: live: buy with coin counted out, sell at a fair discount, refused
  when the shop wouldn't want it; UX2 routing rows for trade utterances;
  suite + playtest:quick green.

### P-68 — Usable consumables ✅ DONE 2026-06-11
**Shipped:** out of combat, `tryUseConsumable` in playloop ("I drink the healing
potion" → removeItemById + effect; full-HP keeps the cork in; honest answer
when you have none; named bottle picked from a mixed pack). In combat, a
`potion` verb in the escape resolver (checked before 'cure' so "drink a healing
potion" reaches the bottle, not the spell list) — heals capped, costs the
action, enemies still swing. Antidote cure branch wired but dormant until
party `conditions` persist (noted in U120-05; P-69's natural cargo). U120 ×6,
UX2 +2 CONSUME rows, suite 7,439 green, playtest:quick clean, live-verified
(bought at 4/11 HP, drank to 8/11, purse and pack updated on screen).
**Why:** potions drop from loot but can't be drunk. Table-stakes D&D.
**Objective:** "I drink the healing potion" (in and out of combat) consumes the
item via `removeItemById` and applies `effect` (heal 2d4+2, cure poisoned).
In combat it costs the action (RAW). Works for any `kind: 'consumable'` def.
- allowed: `engine/playloop.js`, `engine/combat/escapeCombat.js`, `engine/gear/`
- done_when: potion heals mid-fight on the live surface; trying to drink a
  potion you don't have gets the DM's honest answer; suite green.

### P-69 — Catalog growth + one item system ✅ DONE 2026-06-11
**Shipped (WORLD_VERSION 25→26):** catalog 17 → 72 defs (full SRD simple+martial
weapons, complete armor list + shield, healing-potion ladder, 18-item magic
ladder across uncommon/rare/very-rare); CR loot bands rewired to the rarity
curve (magic ~1% at CR 1, very-rares only CR 11+, ~17% of CR 20 fights);
chargen mints typed item instances auto-equipped (AC/attack identical to the
sheet at creation); meleeProfile/playerAc read EQUIPPED TYPED GEAR first
(sheet strings remain fallback) so looted magic actually changes the swing;
"I equip the X" intent moves pack→hand with the DM stating the new numbers;
v26 adds party `conditions` (antidote cure branch now live, U120-05 restored);
optional `qty` on item instances (P-70 materials ready). U121 ×9; suite 7,448
green; playtest:full clean; live-verified (Sword of Morning equipped by name,
attack line + MAIN HAND panel updated).
**Why:** ~17 item defs total, two magic items, and loot lands in the typed
system while combat reads the 5e sheet strings — a looted longsword doesn't
become your wielded longsword.
**Objective:** (a) unify: 5e sheet equipment becomes typed item instances at
chargen; `meleeProfile`/AC read equipped typed items; (b) grow the catalog the
bestiary way — full SRD mundane weapons/armor/gear + a magic-item ladder with
rarity tiers wired into the CR loot bands.
- allowed: `engine/ruleset/core/items/*`, `engine/ruleset/core/loot/*`,
  `engine/chargen/srd/sheet.js`, `engine/combat/escapeCombat.js`, `engine/gear/*`
- invariants: WORLD_VERSION bump likely (inventory migration) — full checklist;
  determinism suite must stay green.
- done_when: a looted +1 sword, equipped by saying so, changes the attack line;
  loot across 100 seeded fights shows the rarity curve; suite + playtest:full green.

### P-70 — Salvage slice (destroy → materials → improvise) ✅ DONE 2026-06-11
**Shipped:** `materials.js` (11 typed materials, stackable; board/stone/shard
carry RAW improvised profiles), tag-driven `salvageYield` (works on every
piece of furniture ever generated — no migration; untagged junk still yields,
destruction is never a dead end), `trySalvage` playloop gate ("smash the
crate" → removeFurniture + merged stacks + salvage timeline event; naming a
part still routes to physics extraction), addItem qty-merge, improvised
weapons in meleeProfile (die, STR, NO proficiency), materials sell for
coppers (price floor dropped to 1cp). U122 ×7; suite 7,455 green;
playtest:full clean; live-verified (iron-bound chest → board + 2 iron
fittings → "I wield the board" → d4+1, +1 to strike, MAIN HAND Board).
**Why:** first rung of `docs/SALVAGE_AND_BUILD.md`; destruction currently
yields nothing.
**Objective:** destroying furniture/objects yields deterministic `kind:
'material'` items (board, stone, hide, cordage…; stackable qty). A board is
wieldable: improvised weapon, 1d4. Object toughness per DMG (AC by material,
HP by size) feeds the existing physics adjudication.
- allowed: `engine/ruleset/core/items/materials.js` (new),
  `engine/decompression/furniture.js` (yield tags), `engine/playloop.js`,
  `engine/effectsCore.js` (salvage op if needed)
- done_when: live: smash a barrel → boards in inventory → club a bandit with
  one at 1d4; suite green; G/UX rows lock the loop.

### P-71 — Field crafting ✅ DONE 2026-06-11
**Shipped:** `engine/craft/craft.js` (recipe validation, prose matching,
quality resolution) + `content/recipes/field_recipes.recipe.js` (torch,
sharpened stake, splint, cordage — data files like arcs). One check gates
QUALITY never possibility (poor work still produces, prose says so; DC+5 =
fine = bonus output); carrying the named tool is +2; time always passes via
the time op; inputs consumed through the new `consumeItems` stack-decrement
op. Missing materials get an itemized honest answer, no menu, no time cost.
Splints bind on (applied prose), stakes wield at d6. U123 ×8; UX2 +2 CRAFT
rows; suite 7,463 green; playtest:full clean; live-verified (2 torches,
poor quality, "Survival 5 vs DC 8; 1 hour gone").
**Why:** second rung; materials need somewhere to go.
**Objective:** recipe layer (data files, like arcs): materials + skill-or-tool
check + time → small goods (torch, splint, barricade, raft). Tool proficiencies
from the 5e sheet gate quality, not possibility. One DM clarify max ("with
what?"); never a menu.
- allowed: `engine/craft/` (new), `content/recipes/` (new), `engine/playloop.js`
- done_when: live: "I make a torch from a board and the hide" works, costs
  time, and a character with carpenter's tools makes visibly better output
  (prose + mechanics); suite green.

### P-72 — Building (shelter → palisade → house) ✅ DONE 2026-06-11
**Shipped:** `engine/structures/playerBuilt.js` (build plans as data — lean-to,
palisade — with validate/match/missing/laborPlan/resolveBuild/makePlayerStructure/
shelterAt, mirroring the craft module); a `buildStructure` delta op in
`effectsCore.js` (mints `pb:<n>` ids, persistent, worldHash-covered); an optional
`build` provenance field on structures (`structuresState.js`, only-when-set like
`buildingType` — no WORLD_VERSION bump, existing structures byte-identical, old
saves carry no player builds); a `tryBuild` playloop gate ("I spend two days
building a lean-to" → consumeItems + the time op for the day-jump + buildStructure
+ one worldTick per day so the world moves while you work; an honest itemized
answer when the stockpile's short, no days lost, no menu); shelter-aware wild rest
(sound/fine lean-to = a true long rest like a settlement bed, poor = a strong
short rest, bare ground = a breather); labor fork v1 (solo by default; "hire a
crew" at a settlement halves the days at 2gp/day RAW and is +2 on the check;
coerced deferred to P-73). Quality is provenance — a barrel-board lean-to is a
poor lean-to, and the prose + rest band say so. U124 ×9; UX2 +BUILD class +2 rows;
suite 7,472 green; playtest:full clean; prose:gate PASS; live-verified (planted
wild node at 4/13 HP → built a lean-to: two days passed, board 8→4 / cordage 4→3,
"a rough lean-to … 2 days of your own sweat (Survival 2 vs DC 10)"; slept under it
to 13/13 with "+9 HP, a sounder shelter would buy a full night"; survived a
reload, still standing).
**Known gap (deferred):** player-built structures render on the local map via the
cottage-plan fallback — no `lean-to` place-art exists yet (`public/map` is outside
this packet's engine scope, and SALVAGE_AND_BUILD defers building UI to
out-of-scope-v1). Cosmetic only; engine canon, rest, and persistence are correct,
and the prose (the DM interface) names the lean-to properly. Belongs with a
structures-render visual pass.
**Why:** third rung; the loop becomes a place.
**Objective:** construction projects: stockpile + days + labor → `buildStructure`
delta op writing persistent structures (map anchor, enterable, burnable).
Downtime passage with world ticks running. Labor model v1: solo (slow) or
hired (gold/day from settlement labor pool). Quality from materials + skill +
time, surfaced in prose and rest mechanics.
- allowed: `engine/structures/playerBuilt.js` (new), `engine/effectsCore.js`
  (`buildStructure` op), `engine/playloop.js`, `engine/worldTick.js`
- invariants: structures join worldHash; WORLD_VERSION checklist if shape changes.
- done_when: live: two in-game days raise a lean-to that improves rest and is
  still there after save/reload; playtest:full green.

### P-73 — Stronghold tier + the labor fork
**Status:** ◑ P-73a ✅ DONE 2026-06-11 · P-73b ⏳ (player forts as story-arc anchors).
**Why:** the endgame sink and the moral instrument.
**Objective:** multi-season projects (fort, keep), crews, the sawyer economy.
Coerced labor: possible, fast, cheap — writes `cruelty` deeds, witnesses
remember, rumors spread, reputation and the seven-axis soul pay. Player forts
become story-arc anchors (arcs can bind to them).
- depends: P-67 (gold), P-70–P-72 (the ladder), morality M-milestones (existing)
- done_when: a keep can be raised honestly over seasons OR monstrously fast,
  and the county's treatment of you afterward differs visibly; an authored arc
  binds to a player fort.

**P-73a — Stronghold tier + the coerced-labor moral fork ✅ DONE 2026-06-11.**
Shipped: two stronghold-tier build plans in `engine/structures/playerBuilt.js`
(watchtower ~30d, keep ~120d — DMG-scaled; a keep is a `long`-rest shelter,
walls and a bed); a `coerced` labor mode in `laborPlan` (a THIRD of the days,
free, unskilled). The moral fork is "enough time (solo), enough gold (hired),
or enough slaves (coerced)": the coerced path in `tryBuild` emits the cruelty
package through the existing morality organs — `axisDelta` wrath/pride/greed
(the seven-axis soul, → corruption), `recordDeed` cruelty, `npcTrustDelta` on
the settlement witnesses (their trust craters), `adjustHeat` (investigation
pressure). `applyDeedCharges` skips its `tryDarkDeed` pass on the coerced marker
so the deed is the construction itself and is never double-counted. Coercion
needs people — out in the wild it falls to solo with no atrocity. Camera-Rule
prose: the coerced raise reads as weight ("raised on the labor of people who
were never asked … and so will the county"), never gratification. U125 ×8;
UX2 +1 BUILD row; suite 7,480 green; playtest:full clean; prose:gate PASS.
Live-verified (home village, full purse + a keep's worth of timber/stone):
coerced keep = 40 days, free, corruption 0→12, heat 0→8, one cruelty deed,
witness trust 5→2; the honest hired keep = 60 days, 240g, soul clean (corruption
0), witness trust intact — the fork differs visibly.
**P-73b — Player forts as story-arc anchors (remaining).** An authored arc can
bind to a player-built structure (`engine/story/storyEngine.js` + a
`content/arcs/*.arc.js`); things come TO the fort. Also remaining from the
broader objective: rumor propagation of the atrocity (rides on the M2-remaining
"deeds mint rumors" work) and faction-disposition shifts — the local witness
trust crash is the current visible county reaction.

### Content track (parallel, any time)
- **More story arcs** — the format is proven (4 live); each new arc is one data
  file + a casting probe across seeds. Candidates: a Church of Incrementalism
  thread, a bestiary-outer-reaches arc, a patron/angel-demon evidence arc.

## QUEUE — Incredible-RPG track (gap analysis, specced 2026-06-11)

Source: full-engine gap analysis vs. "what makes a great tabletop D&D campaign."
The verdict: content is deep (642 creatures, 18 spell schools, loot/items/shops,
conditions, companions, morality); the gaps are COMPOSITION — systems that make
the player feel someone is running a game *for them*.

**Ordering rule (anti-drift):** the ROADMAP critical path (R0→R3, the DM
adjudication soul) outranks everything here. These are the parallel-track
packets; pull them when a worker window wants bounded work that doesn't touch
the adjudication spine. Within this track: P-75 and P-77 are independent and
small (start anywhere); P-74 is the big one (sub-packets in order); P-76 pairs
naturally with R2/R3 and should wait for the object model; P-78 builds on P-74's
reaction machinery; P-79 is composer-layer, any time.

### P-74 — The Adversary (a villain you hate)
**Why:** threads, factions, and the inevitability meter exist, but no persistent
named antagonist reacts to the player — escalates when you win, recruits when
you're weak, is the face of the third act. Great campaigns are remembered by
their Strahd. All the organs exist (npcArc, worldTick, instrument.js,
endingArchitect); nothing composes them into a BBEG with an agenda.
**Objective:** one deterministic villain per world seed: identity, agenda
(staged plan), and a reaction loop in worldTick that advances the agenda and
responds to player-visible events (goal completions, corruption, faction hits).
The villain is never named by the narrator until discovered (rumor-first, like
the gods). Sub-packets, in order:
- **P-74a — Villain genesis + agenda state. ✅ DONE 2026-06-12** `engine/story/villain.js` (new):
  seed-deterministic villain (drawn from bestiary elite tier or npcGenesis),
  a 4–5 stage agenda, persisted in world state behind `ensureWorld` defaults.
  Landed: WORLD_VERSION 27, `world.villain` (null until minted), villainGenesis/
  mintVillain/ensureVillain, invariants, U128 ×7. Minting wires in at P-74b.
  - allowed: `engine/story/villain.js` (new), `engine/state.js`, `engine/invariants.js`
  - invariants: WORLD_VERSION checklist (inv #8, #11); worldHash stable under replay.
  - done_when: same seed → same villain + agenda; determinism suite green.
- **P-74b — The reaction loop. ✅ DONE 2026-06-12** worldTick advances the agenda on its clock AND
  reacts: player completes goals → villain accelerates/adapts; player corruption
  crosses tiers → recruitment overture (ties into M4 dark gifts); villain stage
  changes mint rumors + ledger threats.
  Landed: tickVillain in worldTick (lazy mint, pure arithmetic, no rng drawn),
  villainAdapts/villainOverture/villainStage timeline events, U129 ×7.
  - allowed: `engine/worldTick.js`, `engine/story/villain.js`, `engine/rumor/`, `engine/ledger.js`
  - done_when: headless 200-turn run shows agenda advancing + ≥2 distinct
    reactions to player actions in the timeline; playtest:full green.
- **P-74c — Confrontation arc. ✅ DONE 2026-06-12** An authored arc binds to the villain (the
  existing `content/arcs/*.arc.js` format): discovery → lieutenants →
  confrontation at the villain's seat. Defeating them is a real ending-shaped
  event in an open-ended world (the world notes it; play continues).
  Landed: the-named-dark arc (requiresVillain, trust-gated discovery →
  silencer → seat → end-it), storyEngine villain bindings ({villainName} etc.,
  @villainSeat/@plant predicates, discover/defeat flips, hostile planting),
  U130 ×8. Lowest casting priority — waits for a free arc slot (act-3 pacing).
  - allowed: `content/arcs/` (new arc), `engine/story/storyEngine.js` (binding only)
  - done_when: live playthrough reaches and resolves the confrontation; the
    county's rumors reflect the outcome.
**Forbidden:** narrator names the villain before canon discovery; `Math.random`;
a second mutation path.

### P-75 — Boss mechanics (legendary + lair actions, phases) ✅ DONE 2026-06-11
**Shipped:** `engine/combat/bossActions.js` (payload resolution: authored action >
name-matched enemy action > deterministic CR-scaled synthesis; `bossPhase` derived
purely from hp — nothing persisted, worldHash untouched; `applyBossPhase` phase-2
behavior: authored phase action joins the routine or strikes run heavier;
`detectPhaseCrossings` with authored-or-default narration). Party path
(`combatResolve.js`): CM7/CM9 legendary/lair duds now resolve real payloads; phase
beats surface in the summary. LIVE path (`escapeCombat.js`): legendary answers the
player's turn (one option/round, priciest affordable), lair fights only at the
seat (one/round, cycling), bloodied bosses swing with visible fury, phase
crossings push the authored beat; morale gate fixed to the normalized
legendaryActions shape (bosses hold the field); Relentless Endurance honored on
boss damage. Authored `phases` on entropic_sphinx + necropolis gate (B05 contract
+optional field). Non-boss fights draw nothing new — byte-identical (replay suite
green). CM10 ×17 (12 from Tim's in-flight start + 5 escape-path); suite 7,497
green; playtest:full clean; prose:gate PASS; live-verified (planted sphinx fight
in v1.html: "Entropy Pulse (legendary): hits you for 14 entropic", "The lair
itself answers its master — Time Dilation…", and the authored Unraveling beat on
the 95/190 crossing — screenshots taken).
**Deviation from spec:** allowed_files named `initiative.js` (untouched — no hook
needed) and not `escapeCombat.js`; the live surface runs escape combat, so the
done_when ("live combat prose") is unreachable without hooking it. Hooks only, in
the spec's spirit. `tests/B05` updated for the optional `phases` field.
**Why:** "legendary" exists only in bestiary flavor text. A CR-17 fight is
structurally a wolf fight with bigger numbers. One module changes how climactic
fights feel more than 200 more creatures would.
**Objective:** `engine/combat/bossActions.js` (new): creatures flagged
boss-tier get legendary actions (act between player turns, budget 2–3/round),
a lair action on initiative 20 when fighting at their seat, and one phase
trigger (at ½ HP: new behavior + a narration beat). Data-driven from bestiary
entries (extend elite-tier defs); the dice stay in `diceRoller.js`.
- allowed: `engine/combat/bossActions.js` (new), `engine/combat/combatResolve.js`
  + `initiative.js` (hooks only), `engine/ruleset/core/bestiary/catalog/elite.js`
- depends: nothing — independent, start any time.
- done_when: a flagged elite fight shows legendary actions interleaving and a
  visible phase turn in live combat prose; non-boss fights byte-identical
  (worldHash + replay green); suite green.

### P-76 — Traps, hazards & skill challenges (the third pillar)
**Why:** sessions are roughly thirds — combat, social, exploration-with-
obstacles. The first two exist; the third is narration-only. No trap system,
no puzzle structure, no skill-challenge frame.
**Objective:** traps as first-class objects `{trigger, hidden, dc, effect,
state}` placed deterministically in structures/dungeons; passive-Perception
reveals on approach, search reveals on intent, disarm is a check, springing
applies real deltas (damage/condition/noise). Skill-challenge frame v1:
N-successes-before-3-failures for multi-step obstacles (chasm crossing,
chase, ritual), adjudicated in prose per THE_DM_TEST.
- allowed: `engine/objects/` or `engine/structures/` (trap placement),
  `engine/playloop.js` (search/disarm intents), `engine/resolve.js`,
  `engine/effectsCore.js` (only if a new op is genuinely needed)
- depends: **wait for R2 (object model)** — a trap is exactly the kind of
  first-class object R2 defines; building it before R2 means rebuilding it.
- done_when: live: a dungeon corridor trap can be spotted, searched out,
  disarmed, or sprung — all four paths in prose with real consequences;
  determinism suite green.

### P-77 — Magic item identity (attunement + named items) ✅ DONE 2026-06-11
**Shipped:** magic gear lands SEALED — the instance's defRef points at a humming
placeholder (`unidentified_blade`/`armor`/`trinket`) and the truth rides in
`sealedRef`, so no surface (panel, equip, sell, combat) can leak a name the
table hasn't earned. Identify: an hour + Arcana vs rarity DC (failure keeps the
secret honestly, hour still gone), or pay a settlement scholar the rarity fee.
Attunement: `attuned` on the instance, an hour of your undivided self, cap 3
(invariant-enforced), and the BIG effects sleep without it — accessories (RAW)
and all named uniques gate their bonuses in meleeProfile/playerAc/gearProps;
+N weapons/armor stay attunement-free (RAW). Eight named uniques with one-line
histories (Greyfang, The Dawn Was Late, Thirteen Sparrows, Coat of the Quiet
House, The Wall of Wens, Ring of the Unspent Hour, Lantern-Heart, Boots of the
Unmissed Step); milestone levels 3 and 5 pay one seed-deterministically, never
a duplicate ("The road pays its debts: …"). Obtain-goals now satisfy by defRef
(typed items; a sealed item correctly does NOT count until named), so
"recover the blade" completes at the moment of identification. Instance fields
are only-when-set (P-72 precedent — NO WORLD_VERSION bump; old saves carry
neither; normalizer + addItem pass them through; invariants guard them).
U126 ×9; UX2 +IDENTIFY/ATTUNE rows; R05-11/U121-07 updated to attune the ring
(the behavior change is the packet); suite 7,506 green; playtest:quick clean;
prose:gate PASS; live-verified in v1.html (equip hum → sage names Greyfang +
history → quest completes → Level 3 + "Coat of the Quiet House comes to your
hand" → attune → d6+3 wakes to d8+5/+7; MAIN HAND panel + quick-button read
Greyfang; screenshots).
**Deviations:** beyond allowed_files — `effectsCore.js` (addItem must carry the
fields; sole-mutation-path law), `escapeCombat.js`/`combatResolve.js` (loot-mint
seal + live combat math; same justification as P-75), `invariants.js`
(checklist-mandated for new fields), `goals/goalContract.js` (obtain-by-defRef
— the milestone/goal vocabulary the spec's (d) asked to extend).
**Why:** the magic catalog exists but `attunement` greps to zero. No
identification, no attunement choice, no signature item that grows. In
tabletop, the named +1 sword with a history is half the reward economy.
Quest payoffs now grant levels (P-milestones, c254b43); the next payoff tier
is unique items and titles, not gold.
**Objective:** (a) unidentified drops — magic items land as "something
humming"; identify via short rest + check, or a sage/shop service (P-67
economy). (b) Attunement: cap 3, chosen at rest, required for the big
effects. (c) Named uniques: ~8 seed-deterministic named items with one-line
histories, placed as quest/boss rewards (P-74c's confrontation should pay
one). (d) Goal completion can reward a named item (extend the milestone
machinery's reward vocabulary).
- allowed: `engine/ruleset/core/items/magic.js`, `engine/gear/gearProps.js`,
  `engine/playloop.js` (identify/attune intents), `engine/state.js` if
  attunement persists on the sheet (WORLD_VERSION checklist applies)
- depends: P-67 (done) for the sage-service price path.
- done_when: live: loot an unknown item, identify it, attune at rest, see the
  effect in combat math; a quest pays a named item with its history line;
  suite + playtest:quick green.

### P-78 — Companions as people ✅ DONE 2026-06-12
**Why:** `companionTurn.js` runs their combat actions and npcArc/npcDepth
exist, but the BG3-grade layer — companions who interject, object, have their
own quests, and can leave — isn't composed. M4 corruption is begging for a
companion who notices.
**Objective:** companions get (a) interjections: scene-triggered one-liners
through perspectiveFilter (cap: ≤1 per scene, deterministic trigger);
(b) loyalty: a per-companion disposition that moves on witnessed deeds
(reuses the morality witness machinery from P-73a); (c) the objection arc:
crossing a corruption tier with a good-aligned companion present triggers
confrontation → ultimatum → departure if ignored; (d) one companion side
quest in the arc format.
- allowed: `engine/npc/` (companion modules), `engine/playloop.js` (hooks),
  `content/arcs/` (one arc)
- depends: P-74b's reaction-loop patterns help but aren't required; the
  morality witness organs (done) are the real dependency.
- done_when: live: a companion comments unprompted at a fitting moment; the
  coerced-labor build (P-73a) with a companion present triggers the objection;
  ignoring it twice loses them, and the timeline says so; suite green.

### P-79 — Session rhythm (recap, cliffhanger, downtime) ✅ DONE 2026-06-11
**Shipped:** `buildRecap` in composer.js — deterministic 3-sentence "When the
candle last burned at this table…" from the timeline since the last resume
(travel/goals/build/identify/attune/named-reward/combat/downtime templates),
closing on the HOTTEST open threat (else oldest question) as the cliffhanger
hook; `markResume` in save.js stamps the session boundary (canon, not
replayed); v1.js surfaces the recap on Continue (LLM may polish downstream,
silent fallback = base text). Downtime verbs in playloop (`tryDowntime`, after
tryBuild so "spend a week raising a palisade" stays construction): training
banks an advantage token + a fact; research lands a concrete ledger fact named
from the player's own subject (anchored to a real node when one matches);
carousing needs a settlement and pays an NPC trust bump (the contact) + a
tavern-talk ledger question — honest refusal in the wild, no days lost. Days
pass via the time op with one worldTick per day (bounded 30) — the world does
not wait. U127 ×8; UX2 +DOWNTIME rows; suite 7,514 green; playtest:quick clean;
prose:gate PASS; live-verified (planted world with a built lean-to + a level-4
threat → Continue showed the recap naming both; "I spend a week researching the
old shrine" passed 168 hours and landed "the county once paid good coin to keep
old shrine quiet" in the ledger; screenshots).
**Bonus fix (protocol bug class):** the walk-place canvas's 30vh clamp starved
the transcript to a 20px sliver on short columns (narration in DOM, invisible
on screen — the PLAYTEST_PROTOCOL's documented failure mode, surfaced by the
resume render). The canvas now yields to a ~120px prose floor (v1.js inline
style; prose-first per DESIGN.md).
**Deviation:** `worldTick.js` (allowed) needed no changes — ticks are invoked
from playloop per the P-72 precedent. No engine/save shape change.
**Why:** cheap to build, large feel payoff. A great DM opens with "previously
on…" and ends on a hook; between adventures there's downtime.
**Objective:** (a) recap on resume — composer builds 3–4 sentences from the
timeline's last session (deterministic selection, polished by the LLM layer
with silent fallback); (b) cliffhanger surfacing — on save/quit, the ledger's
hottest open threat/question is named as the closing line; (c) downtime verbs —
"I spend a week training / researching / carousing" resolve as world-tick
passage with one concrete outcome each (skill progress hook, a lore fact, a
rumor + contact).
- allowed: `engine/composer.js`, `engine/playloop.js` (downtime intents),
  `engine/worldTick.js`, `engine/save.js` (resume hook), `public/v1.js`
  (surfacing only)
- depends: nothing — composer-layer, any time.
- done_when: live: quit mid-thread → resume shows a recap naming that thread;
  "I spend a week researching the tower" passes 7 days with a concrete fact
  learned; suite + playtest:quick green.

**Track-wide forbidden:** touching the R0–R3 adjudication spine while it's in
flight; `Math.random`; mutations outside `applyDeltas`; narrator-as-canon.
**Track-wide rollback:** every packet is new-module + named hook lines; revert
the named files.

---

## QUEUE — Two-Surface UI track (specced 2026-06-16)

**Source:** `docs/TWO_SURFACES.md`. **Strategy:** every piece of player-facing
status lives on exactly one of two surfaces — the Map or the Character Sheet — no
third panel. Phase 0–1 (Sheet gets the notebook treatment; orbs/compass/paper-doll/
Inventory cut and folded into the Sheet) are already done. This track picks up at
Phase 2.

**Ordering / anti-drift:** presentation-layer only, explicitly lower priority than
`docs/ROADMAP.md`'s R0–R7 adjudication spine — sequence around it, never block it.
`P-90` and `P-94` are ready to build now (independent of each other, can run in
either order or in parallel worktrees); `P-91`–`P-93` are intentionally thin
placeholders, each blocked on a named open decision (see `docs/TWO_SURFACES.md`
"Conflicts").

### P-90 — Map gets its inhabitants (Two-Surface Phase 2)
**Status:** spec'd 2026-06-16. Design: `docs/TWO_SURFACES.md`.
**Why:** companions and enemies currently live in dedicated panels (Companions
panel, Combat HUD) that become the Map's job under the Two-Surface Rule — and
Tim's "yes to enemy character sheets you can click to expand" generalizes the
Sheet from "the PC's panel" into a reusable template for any character. Also
formally closes out a confirmed-dead pair of functions (`renderGoalsSection` /
`renderRumorBoardSection`, zero call sites in `public/v1.js`) that were never
wired in — Tim's explicit call: no system-maintained quest/rumor tracker, on
purpose, so remembering promises stays the player's job.
**Objective:** companions and enemies render as tokens on the Map; clicking a
token expands a compact sheet popover built from the same notebook template as
the PC's pinned sheet (ability grid, HP bar, equipped gear) — collapsed by
default, summoned on demand. The PC's sheet remains the only always-open
instance.

**Sub-packets (do in order):**
- **P-90a — Retire the dead functions.** Delete `renderGoalsSection` /
  `renderRumorBoardSection` from `public/v1.js` (confirmed zero callers) and any
  now-orphaned CSS (e.g. `.goal-list`, `.goal-item*` — verify via grep first,
  same discipline as the Diablo-orb cleanup).
  - allowed: `public/v1.js`, `public/styles.css`
  - done_when: grep confirms zero references to both functions and their CSS
    classes; suite green.
- **P-90b — Compact sheet template.** Factor a compact-render path out of the
  existing `renderCharacterSheetSection` so the same notebook markup can render
  either the PC's full pinned sheet or a smaller popover for a companion/enemy.
  Decide the compact field subset (first cut: name, HP bar, ability grid; likely
  drop Pack/spell-slots for enemies).
  - allowed: `public/v1.js`, `public/notebook.css`
  - done_when: the PC's existing sheet renders unchanged (no visual regression);
    a second call with a companion/enemy object produces a smaller variant in
    the same aesthetic.
- **P-90c — Map tokens + click-to-expand.** Companions and enemies render as
  clickable tokens on the Map (replacing the standalone Companions panel and
  Combat HUD's static display); clicking opens the compact sheet popover; the
  combat HUD's initiative/summary becomes a transient overlay, not a permanent
  panel.
  - allowed: `public/v1.js`, `public/styles.css`, `public/notebook.css`
  - done_when: live playtest (`docs/PLAYTEST_PROTOCOL.md`) shows a companion
    token and an enemy token (in combat) each expand to a sheet popover on
    click; no standalone Companions panel or persistent Combat HUD panel
    remains.
- invariants: zero engine/mutation code touched (presentation-layer only); the
  Map's existing rendering approach (canvas vs. DOM — verify before P-90c)
  decides the token/popover implementation; no system-maintained quest/rumor
  list reintroduced.
- rollback: each sub-packet is new-markup + CSS — revert the named files.

### P-91 — Visual unification, pass 1 (Phase 3 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Do NOT build until `P-90` lands.
**Objective (sketch):** notebook skin on the chrome immediately around the Sheet
and Map (rail, panel borders, app shell) — not the Telling, not the Map's own
renderer yet. Left intentionally thin.

### P-92 — The Map re-skinned (Phase 4 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. **BLOCKED:** conflicts with memory
`project_map_beauty_dream` (photoreal/satellite-textured maps) vs. this track's
hand-sketched notebook direction. Do NOT build until Tim makes an explicit call
between the two directions.
**Objective (sketch):** whichever direction is chosen, the Map's terrain/
structures/tokens get a coherent visual treatment matching the rest of the UI.

### P-93 — The Telling, notebook pass (Phase 5 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Do NOT build until `P-91`/`P-92`
land. Graph paper behind dense reading prose is a real readability risk — may
need its own `/design-consultation` pass before this gets specified further.
**Objective (sketch):** the center prose column reads as part of the same
notebook without hurting reading comfort.

### P-94 — The waveform DM (Phase 6)
**Status:** spec'd 2026-06-16. Design: `docs/TWO_SURFACES.md` Principle C.
**Why:** Tim wants a simple, literal voice-equalizer line — not a game-state
visualization — that moves while the DM's voice (`public/tts.js`) is speaking.
Cheap, low-risk, no engine involvement; deliberately scoped away from expensive
visuals or hidden-state readouts.
**Objective:** an animated line/bar element, Map-resident near wherever
narration anchors, that switches between an idle/flat state and an active
animated state in sync with TTS speaking. No real audio signal analysis —
`speechSynthesis` exposes no amplitude data, so the active state is a synthetic
loop (optionally pulsed on utterance `boundary` events), not an `AnalyserNode`
reading.

**Sub-packets (do in order):**
- **P-94a — Speaking-state signal.** `public/tts.js` currently exposes
  `onIdle` (fires after speech stops) but no symmetric "started" signal. Add an
  `onStart` hook (or a `speaking` boolean flipped at the top of `speak()`/
  `speakAndWait()` and cleared alongside the existing `_fireIdleSoon()`) so
  callers can drive a UI purely off `tts` state.
  - allowed: `public/tts.js`
  - done_when: a small manual check (console log on `onStart`/`onIdle`) fires
    exactly once per utterance, symmetric start/stop, across `speak()` and
    `speakAndWait()`.
- **P-94b — The waveform component.** A small SVG/canvas line — idle: flat or
  gentle resting wobble; active: a looping animated wiggle. Build it
  pencil-drawn from the start (reuse the `--np-rough` filter pattern already in
  `public/notebook.css`, see `.sheet-paper`) since it's new chrome anyway —
  avoids a second visual pass once Phase 3/4 land.
  - allowed: `public/v1.js`, `public/notebook.css`
  - done_when: the component renders both states on demand (manually
    toggleable for review) without touching `tts.js` yet.
- **P-94c — Wire + place.** Subscribe the component to `tts`'s start/idle
  signal (P-94a); mount it Map-resident, near wherever narration anchors.
  - allowed: `public/v1.js`
  - done_when: live playtest (`docs/PLAYTEST_PROTOCOL.md`) — toggle voice on,
    send a turn, watch the line animate while the DM speaks and settle when it
    stops.
- invariants: zero engine/mutation code touched; no new audio APIs beyond what
  `tts.js` already uses; no game-state (inevitability, threads, Will) feeds
  this — speaking-state only.
- rollback: a `tts.js` hook addition + new markup/CSS — revert the named
  files.

**Track-wide forbidden:** touching engine/mutation code (this track is
presentation-layer only); reintroducing a system-maintained quest/rumor list;
`Math.random`; touching the R0–R3 adjudication spine while it's in flight.
**Track-wide rollback:** every packet is markup + CSS — revert the named files.

## DONE (recent)
- **Living-World Merge P1–P6** (`docs/LIVING_WORLD_MERGE.md`): biomes, biome encounters,
  living ecology, NPC wants/discovery, hidden Will in casting, open-ended (no win).
- **Intent layer** (`engine/intent/`, IN1–IN4): text + click + voice → one intent.
- **Bedroom start** — wake in a cottage bedchamber in a safe village (forced home cottage).
- **Authored interiors in v1** — `drawInteriorV2` renders the plan catalog, not the stub.
- **Continuous exterior place** — replaced the tile overworld; real village from the node.
- **Walkable place + collision** — `placeNav.js` (NAV1); click-to-walk, walls, doors, fog.
- Prose/seam red-team: combat narration, dialogue ejection, "No one to fight",
  dungeon→neutral wording, SIGNATURE placeholder, motif duplication.
