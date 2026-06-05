# PROSE_MECHANIC_PLAN — perfecting the prose mechanic

The plan for making the prose mechanic *perfect*, plus the playtest discipline that
keeps me honest about it. Governed by `docs/THE_DM_TEST.md`. Companion to
`docs/PLAYTEST_PROTOCOL.md` (the standing rule) and `docs/PROSE_TO_WORLD.md`.

---

## The bar (definition of done for the whole mechanic)

> **The DM Test (governing):** every response is what a competent human DM would do —
> the player's intent resolved *in the fiction*, never bounced back as a mechanical
> prompt or system artifact. See `docs/THE_DM_TEST.md`.
>
> Operationally: any reasonable thing a player would say to a DM produces — **AI-off** —
> a grounded, coherent, **visible** response that reflects the real world state and the
> true outcome, with no dead-ends and no abstract filler. **AI-on** makes that same
> response prettier, not different.

## Architecture principle (the spine)

Two layers narrate. Perfect = make the first always right, the second only polish.

1. **Deterministic base** (`engine/` handlers + `composer.js`) — always runs, works AI-off.
   This is what we perfect. It must be grounded, correct, visible, never a dead-end.
2. **AI polish** (`engine/llmAdapter.js`) — rewrites the base when a key is present.
   It must *elaborate* the base skeleton, **never invent** facts the base didn't assert.

---

## ★ Playtest discipline — how I stay honest (read this every stage)

The recurring failure: I verify with unit tests / DOM dumps, declare "ready," and hand
over a broken game. Intention doesn't fix that. **An auditable artifact does.** These
rules are binding:

1. **Play as a human, on the live surface.** Drive `http://localhost:5179/v1.html` in a
   real browser (Chrome MCP): click Begin, type into the input box, take **screenshots**,
   read what's *on screen*. `get_page_text` / DOM dumps do **not** count — they see
   clipped and hidden content a player can't.
2. **Pre-register the attack list.** Before (or as) a stage starts, write the list of
   inputs I will throw at it into the stage's playtest report. Writing the test after the
   fact lets me rationalize a weak one. Pre-commit to the severe version.
3. **Play as "The Skeptic" persona.** Not a cooperative tester — a real player who:
   - phrases things naturally and inconsistently ("head out", "go outside", "leave"),
   - tries the obvious thing, then the weird thing, then the thing that should break it,
   - plays **multi-turn sequences** (does the world remember? do exits/objects persist?),
   - probes **cross-feature interactions** (examine → manipulate → move → come back),
   - feeds garbage (empty, "asdf", "the thing") and checks for graceful handling.
4. **Evidence or it didn't happen.** Each stage produces a committed report at
   `docs/playtests/<stage>-<date>.md` containing: the pre-registered attack list, the
   transcript of what was typed and what came back, screenshot IDs proving it was
   **visible**, a findings table (works / broken / friction / fixed / remaining), and an
   explicit **"NOT verified"** list. No report = stage not done.
5. **The severity minimum** (per stage): ≥20 distinct inputs spanning normal,
   natural-language variants, adversarial/garbage, multi-turn sequences, and at least one
   cross-feature interaction. Find **improvements**, not just pass/fail.
6. **Fix, then re-verify on the live surface.** Bugs found get fixed and re-played in the
   browser with a fresh screenshot before the stage closes.
7. **The handoff gate.** I may only tell Tim "ready to playtest" when: full suite green,
   `playtest:quick` clean, the stage's prose harness clean, **and** the committed live
   playtest report is green with screenshot evidence. The handoff message links the report
   and states the "NOT verified" gaps plainly.

**Two-tier testing, both required:**
- **Breadth (automated):** `scripts/prose-playtest.mjs` — hundreds of inputs through the
  real routing, graded for crashes / dead-ends / abstract-floor leakage / target-blindness
  / value leaks. Fast, catches regressions.
- **Depth (human):** the live browser Skeptic session above. Slow, catches what automation
  can't — visibility, feel, coherence, multi-turn world-grounding.

---

## Workstreams (in execution order)

Each stage = scope → where it lives → definition of done → **Severe Playtest charter**.
A stage is not closed until its `docs/playtests/<stage>-<date>.md` report is green.

### Stage 1 — C: Movement & transitions
- **C.1 Interior ↔ exterior — DONE** (2026-06-05). "go outside"/"go inside"/"enter" now
  transition correctly and visibly. Report: `docs/playtests/stageC-movement-2026-06-05.md`.
- **C.2 DM-resolved travel between places — the real work.** "I go to the Old Shrine" must
  be resolved like a DM runs a journey, **not** bounced back as "which way?".

  **The travel-resolution model (per THE_DM_TEST):**
  1. **Resolve the destination** the player named to a known place (adjacent or multi-hop
     across the world graph). Unknown → the DM asks a real in-fiction clarifying question
     ("you know of no Old Shrine nearby — the ruins east, maybe?"), never a UI prompt.
  2. **Plan the route** and compute **distance** (leagues/cells) and the **intervening
     terrain** (regions/biomes the path crosses — e.g. the dangerous Blackwood).
  3. **Run the journey leg by leg:**
     - each leg **costs time** ∝ distance → advance the clock (`world.time`); track turns/
       hours elapsed and cumulative distance.
     - each leg **rolls for an encounter weighted by the terrain's danger** (deterministic,
       seeded). A dangerous wood → real chance of a **fight**; the safe road → little.
     - **on encounter → the journey is interrupted:** the party ends up *there, in it*
       (in the wood, in a fight), not at the destination. Travel resumes after it resolves.
     - **on a clear leg →** brief biome-grounded travel narration.
  4. **On arrival:** narrate reaching the place; clock and distance reflect the trip
     ("most of a day's walk; by dusk the shrine's arch rises ahead").
  5. The whole thing reads as a DM narrating a trip. The tile/cardinal overworld becomes an
     *aid*, not the gate — intent drives travel.
- **Encounters, foes & ambush (locked 2026-06-05):**
  - Encounter *chance* is weighted by terrain; the *kind* is drawn from the terrain's
    table, not generic:
    - **Road** → brigands, robbers, highwaymen, a toll-gang (humanoid / faction); plus
      non-combat beats — a passing caravan, a wary traveler with a rumor, an abandoned cart.
    - **Wood / wilds** → wolves, beasts, monsters (bestiary / ecology); plus non-combat —
      fresh tracks, an eerie shrine, a hermit.
    - **Settled / safe** → little or nothing.
  - **Mixed outcomes** — a DM varies it: sometimes a fight, sometimes a beat you can talk,
    pay, or slip past (routes through the dialogue / social systems).
  - **Ambush = surprise:** when a travel encounter becomes a fight, the attacker has the
    **element of surprise** — a surprise round / first move + initiative advantage (extends
    the existing travel `ambushed` flag). You got caught on the road or in the trees.
- **Distance & time (locked):** track real **elapsed hours** and **distance in leagues**
  (~1 league/hour on foot; an adjacent place is a few leagues, multi-hop sums). Hours
  advance the dawn→…→night cycle. Stored as numbers; spoken in DM language ("an hour down
  the road", "most of a day's walk", "by dusk the arch rises ahead") — never a stat dump.
- **Substrate that already exists:** overworld step-travel + `nodeAtCell` arrival, biomes
  (`biomeForNode`/`biomeFlavor`), `ecologyTravelLine`, **ambush-on-travel**, `world.time.turn`,
  the 6-step time-of-day cycle. C.2 assembles these over *intent* and adds distance/turn
  accounting + multi-hop named-travel — replacing the "which way?" deflection. Determinism-
  sensitive (U21) — change with the replay tests watched.
- **Lives:** `engine/playloop.js` travel branch, `engine/map/` (routing/distance), `world.time`.
- **Done when:** "go to <known place>" / "head to the shrine" / "let's travel to the capital"
  resolves a real journey (time + distance tracked, terrain-weighted encounter possible,
  arrive-or-interrupted) narrated as a DM would — and nothing bounces intent back as a
  mechanical prompt.
- **Severe playtest:** travel to adjacent and multi-hop places; routes through safe vs
  dangerous terrain (does the wood produce fights? does the road stay calm?); confirm
  turns/distance advance and are surfaced naturally; interrupted journeys (fight mid-trip)
  then resume; unknown places (in-fiction clarification, not "which way?"); "go outside →
  travel → arrive → where am I?" continuity.

### Stage 2 — A: Unified intent router + taxonomy
- **Scope:** one documented classifier mapping every input to {observe, manipulate, move,
  skill, social, combat, meta}. No silent fall-through to the abstract floor.
- **Lives:** new `engine/intent/` module; `playloop.js` gates call it.
- **Done when:** every input's category is decidable and logged; nothing reaches the
  composer floor unintentionally; existing handlers route through the taxonomy.
- **Severe playtest:** a corpus spanning all categories + ambiguous hybrids ("smash the
  door open and run"); confirm each lands in the right category with grounded prose.

### Stage 3 — B: Ground the floor (kill abstract dead-ends)
- **Scope:** the composer "instrument" narration must always name the **target** and the
  **concrete outcome**. "force the door" → consequence prose, never "a low hum threads…".
- **Lives:** `composer.js` + target/outcome context threaded from `resolve.js`.
- **Done when:** no input produces target-blind abstract prose; skill outcomes read as
  what happened to the thing acted on.
- **Severe playtest:** every skill/risk verb against present and absent targets; success,
  mixed, and failure outcomes; confirm prose names the object and the result each time.

### Stage 4 — F: Standing prose gate
- **Scope:** grow `scripts/prose-playtest.mjs` into the enforced pre-handoff gate; add a
  browser visible-output check and a "no unintentional floor" assertion.
- **Lives:** `scripts/`, `tests/`, wired into PLAYTEST_PROTOCOL.
- **Done when:** the gate fails loudly on dead-ends, floor leakage, value leaks, or
  invisible output.
- **Severe playtest:** intentionally regress a handler and confirm the gate catches it.

### Stage 5 — D: Consequence & permanence (prose-to-world)
- **Scope:** actions mutate the scene model (furniture state, contents, new exits, sensory
  residue) and later prose reflects it. (Reconcile with `docs/PROSE_TO_WORLD.md` first.)
- **Lives:** `effectsCore.js` deltas + scene model + `composer.js` reads state.
- **Done when:** the world remembers — an opened crate stays open, a broken door is an exit,
  and narration acknowledges prior changes.
- **Severe playtest:** long sessions; break/open/take things, leave, return, and verify the
  world and prose remember; chain consequences (noise → response).

### Stage 6 — E: Voice, variation, pacing
- **Scope:** world-tone into deterministic prose; seeded variation (no identical repeats);
  `guard.js` blocks id/mechanic leaks and contradictions; AI polishes a grounded skeleton.
- **Lives:** `composer.js`, `llmAdapter.js`, `guard.js`.
- **Done when:** repeated situations read differently; tone tracks the world; AI-on never
  contradicts the base.
- **Severe playtest:** repeat the same action many times (variation?); push tone extremes
  (safe vs dire); AI-on vs AI-off side-by-side for faithfulness.

---

## Report location & template

Reports live in `docs/playtests/`. One per stage (and per re-test). Template:

```
# Playtest — <stage> — <date>
Surface: live v1.html (browser)   AI: on/off
## Pre-registered attack list
- [ ] ...inputs I committed to trying...
## Transcript (input → response, with screenshot IDs)
## Findings
| input | result | grounded? | visible? | correct? | note |
## Fixed this pass
## NOT verified (honest gaps)
## Verdict: green / not yet
```

## Progress log
- Stage 1 — C: Movement & transitions — **PARTIAL** (2026-06-05).
  - ✅ Interior↔exterior transitions ("go outside"/"go inside"/"enter") fixed & verified
    live. Root cause: scene.interior vs position.interior desync + missing replay events.
    Report: `docs/playtests/stageC-movement-2026-06-05.md`.
  - ❌ OPEN: node-to-node travel via prose. Engine has overworld step-travel but `v1.js`
    intercepts cardinals as local place-walk, so you can't walk between settlements by
    typing (only the Map tab travels). Needs a movement-model design pass — likely the
    next slice before A.
