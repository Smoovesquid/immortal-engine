# Interior + Town polish — specced packets (2026-06-24)

> **✅ ALL FIVE SHIPPED 2026-06-24** — each repro'd LLM-OFF, fixed, test-locked, full
> suite green (8685). Commits: IT-2 `86ac11e` · IT-5 `f194e72` · IT-3 `3a40ce8` · IT-1
> `04c7c4f` · IT-4 `0992c6a`. Tests: U259–U262, N7, object-interaction.test.js. Notable
> finding: IT-2 was a *measurement* false-positive (the rest idiom "take a real bed"), not
> a live engine phantom — the audit found takes route to the trivial-action path. The spec
> below is kept as the historical record of each hole + approach.

Spec-out of the residuals the building + surrounding-town playtests queued (see
`WHOLE_BUILDING_FINDINGS.md` → WB-Q* / T-Q*). Each packet is sized so one agent
understands every touched file. **House rule (PACKETS.md): repro LLM-OFF first, then
edit.** Schema per packet: *objective · the hole (file:line) · approach · allowed_files ·
invariants · test_plan · done_when · risk · lane*.

Navigation (enter/exit/geometry) is already fixed and shipped (`da91a25`, WB-Q1 +
T-F1/F2/F3, locked by U258/U260/N7). What remains is **inside the interactions** —
items, free-action routing, and narration quality — none of them navigation blockers.

## Priority / sequencing
1. **IT-2 — phantom item acquisition** (HIGH; canon≠narration on the inventory axis). Do first; it's partly an oracle-precision fix (cheap) + a bounded engine audit.
2. **IT-5 — generic failed-roll narration** (the biggest *quality* lever; the "stop sounding like a robot" one).
3. **IT-3 — rolled-a-free-action** (table-test fidelity; intent routing).
4. **IT-1 — bare "head outside" exit + presence precedence** (minor polish; I deliberately deferred it from the nav packet).
5. **IT-4 — building-type label drift** (cosmetic).

---

## IT-2 — Phantom item acquisition (= T-Q2 / WB-Q4)
**Severity:** HIGH (narration≠canon on inventory) — but FORK measurement vs engine first.

**The two holes (located):**
- **Engine:** `engine/playloop.js:6090-6094` — `genericGroundedOutcome`'s take branch
  narrates a *completed* acquisition on a `success` outcome (`"You take the ${what} and
  stow it."` / `"The ${what} is yours now…"`) with **no `addItem` delta**. Any take that
  routes to this generic-prose fallback (rather than the real object-grant path) is a
  phantom: the DM hands you an item the engine never put in your pack.
- **Measurement (oracle):** `engine/harness/oracles.js:213` — `ACQUIRE_CLAIM` matched
  *"you take … real"* in the run-#3 t1 finding (`"head to the window … take in the
  real…"`). "real" is an adjective, not an item. The oracle over-fires on abstract /
  non-object nouns ("in", "real", "stock"-likes not yet in `STOP_NOUNS`).

**Repro (LLM-OFF, required first):**
1. Oracle precision: unit-feed `runObjectInteraction` a narration `"you take in the real
   weight of it"` with unchanged inventory → it currently fires `acquired-nothing`. It
   should NOT (no concrete object).
2. Engine: drive a take that falls to `genericGroundedOutcome` (a take of a non-furniture
   target, or with the physics path disabled) and assert `inventoryItemCount` is unchanged
   while the narration claims a completed take. (Note: takes of *present furniture* appear
   to route to the real object path and narrate `"You take the oil lantern."` — confirm
   whether THAT path grants; the phantom is the generic fallback, not every take.)

**Approach:**
- *Measurement:* tighten `ACQUIRE_CLAIM` / `STOP_NOUNS` to reject abstract nouns and the
  bare-preposition case ("take in the…"). Require the captured noun to be a plausible
  concrete object (≥1 present-room object head-noun, or not in an abstract-noun stoplist).
- *Engine:* `genericGroundedOutcome`'s take branch must not assert a *completed* stow it
  can't back with state. Two options — (a) **minimal/safe:** narrate the take as an
  *attempt/observation* ("You get a hand on the ${what}" / "You take hold of the
  ${what}") so it never claims carriage without a grant; (b) **full:** when a concrete
  takeable object is present at the node, apply `addItem` (the sole mutation path,
  `effectsCore.applyDeltas`) and only then narrate acquisition. Prefer (a) for this
  packet; file (b) as a follow-up if real phantoms remain after the audit.

**allowed_files:** `engine/harness/oracles.js`, `engine/playloop.js` (only
`genericGroundedOutcome` + `takeTargetOf`), `tests/`.
**forbidden:** the real object-interaction/physics take path (out of scope unless the
audit proves it phantoms), RNG, `WORLD_VERSION`.
**invariants:** determinism (narration-only change is hash-safe); mutation only via
`applyDeltas`; LLM layer untouched.
**test_plan:** new `U2xx` — (a) oracle no longer fires on "take in the real…"; still
fires on a true phantom; (b) `genericGroundedOutcome` take branch never emits a
completed-acquisition phrase the `ACQUIRE_*` oracle would flag (assert the prose is
attempt-shaped). Re-run the harness object-interaction oracle on a saved transcript.
**done_when:** the object-interaction oracle is green on the existing town transcripts
AND a forced-generic take no longer claims an ungranted item; full suite + determinism.
**risk:** LOW (narration + oracle regex). Watch over-tightening `ACQUIRE_CLAIM` (keep it
firing on a genuine "you pocket the brass key" with no grant).
**lane:** Sonnet (narration + oracle regex) — or Codex if the audit opens option (b).

---

## IT-5 — Generic failed-roll narration (= T-Q5 / WB-Q2)  *(biggest quality lever)*
**Severity:** quality (discovery-only judge findings; never auto-fixed) — but it's the
single most-flagged thing the Tier-2 judge sees on the live DM.

**The hole (located):** `engine/playloop.js:6148` — the `gen:f` (and `gen:m/gen:s`)
atmosphere bank: *"Whatever you meant to do, ${place} doesn't give it to you."* / "falls
short here in ${place}". These are CONTENTLESS — they don't say what the player tried or
what actually resisted, so the judge flags `resolves-the-intent`, `specific-and-grounded`,
and `concise-no-filtering`. (Sibling banks: the `take:f`, `ask:f`, etc. branches above it.)

**Repro (LLM-OFF):** `genericGroundedOutcome(world, "I pry the floorboards up", "failure")`
→ currently returns the place-generic "doesn't give it to you". Assert it names neither the
*verb* (pry) nor the *obstacle*. That's the defect, in black and white.

**Approach (narration-craft, Vol 17 rubric — engine owns adjudication; only voice
transfers):** make the failure prose **echo the player's verb + the concrete obstacle**
instead of a place-generic shrug. Deterministic, no new LLM authority:
- Extract the action's head verb + target (reuse `takeTargetOf` / `strikeTargetOf` /
  examine-target helpers already in the file) and template a failure that names them:
  *"The floorboards hold — your pry-bar finds no purchase."* vs the current "${place}
  doesn't give it to you".
- Keep it ≤2 sentences, no "you feel/notice" filtering (HIDE-THE-MATH + the Angry-GM
  "concise + call-to-action" guardrail already in `buildSystemPrompt`). Leave a hook
  ("…but the seam by the wall looks looser") so a failure is still a call to action.
- This is the *base* narration; the live DM polishes it — but the base must already be
  specific so the judge passes even on API-off.

**allowed_files:** `engine/playloop.js` (`genericGroundedOutcome` + its verb helpers),
`tests/`; optionally `engine/harness/qualityJudge.js` only to add a regression anchor.
**forbidden:** RNG, world state, `WORLD_VERSION`, the adjudication/outcome decision (only
the PROSE of an already-decided outcome changes).
**invariants:** determinism (pure narration; `pickVariant` is seeded); narration≠canon
(no new facts coined — only the player's own verb/target echoed).
**test_plan:** new `N#` — for a sample of failed actions, the prose contains the action's
verb or target and NOT the place-generic "doesn't give it to you"; no filtering tokens.
Re-judge a saved town transcript and confirm the `resolves-the-intent` /
`specific-and-grounded` finding count drops.
**done_when:** the gen:f bank names what was tried/what resisted on a sampled corpus;
quality-finding count on the regression transcript drops; full suite green.
**risk:** MEDIUM — taste-critical narration (serial lane). Over-templating can sound
mechanical; keep 2–3 seeded variants per verb-class. Don't coin specifics not in the input.
**lane:** narration/grace (Sonnet) — taste-critical, serial; review the prose by hand.

---

## IT-3 — Rolled-a-free-action (= T-Q3 / WB-Q3)
**Severity:** med (THE_TABLE_TEST — a DM doesn't call a check to walk out a door / look
around / greet someone).

**The hole:** the oracle defines the high-confidence free intents at
`engine/harness/oracles.js:107-118` (`FREE_INTENT`: step out/in, head out/in, get up,
stand up, look around, take stock, survey, talk/speak to, greet…). A finding means one of
those reached `resolve()` and rolled a d20. The fix is in **`engine/playloop.js`** —
route these to a roll-free resolution BEFORE `resolve()`.

**Repro (LLM-OFF, required first):** the action log of the town runs that fired
`free-action` (replay `--replay docs/playtests/harness/actions-2026-06-24-17-23-47.json`)
isolates the exact phrasings; OR unit-drive each `FREE_INTENT` phrasing through
`playerMove` on `tallow` and assert `mechanics` carries no `roll: … vs DC`. Some already
pass (movement) — capture the ones that DON'T; that's the seam.

**Approach:** identify which free intents fall through the existing free-movement /
explore / approach classifiers (`isFreeMovementIntent`, `isExploreIntent`, the
approach-guard) and extend the nearest classifier so the intent resolves narratively
(auto-success, no roll). Do NOT widen so far that a *contested* action ("I sneak out past
the guard") loses its roll — free means uncontested.

**allowed_files:** `engine/playloop.js` (intent classifiers), `tests/`.
**forbidden:** RNG semantics, the resolve DC math, `WORLD_VERSION`.
**invariants:** determinism; contested actions still roll; the free-action oracle stays
green.
**test_plan:** new `UX#`/`U#` — each `FREE_INTENT`-class phrasing resolves with no roll on
`tallow`; a contested sibling ("sneak past the guard and slip out") STILL rolls (guard
against over-widening). Re-run the free-action oracle on the saved transcripts → 0.
**done_when:** every `FREE_INTENT` phrasing is roll-free; contested actions unaffected;
full suite + determinism.
**risk:** MED — intent routing in the hot file; precision over recall (don't free-pass
contested actions). Pairs with IT-1 (both intent-routing).
**lane:** Codex or Sonnet (intent routing; serial on `playloop.js`).

---

## IT-1 — Bare "head outside" exit + presence-question precedence (= T-Q1)
**Severity:** minor (deliberately deferred from the nav packet to avoid hijacking
presence questions).

**The hole:** `engine/playloop.js` exit handler (`interiorAction.kind === 'exit'`, ~L1049)
+ the presence path (`buildLocationSurvey(world, { presence:true })`, ~L6031). A bare
`<motion> outside` ("I head outside") currently does NOT classify as exit — `U260`'s
exit disjunct requires an adverb ("head **back** outside") precisely so a compound "I head
outside … who do I see?" still reaches the presence answer (`U235-03`).

**Approach:** add the bare `<motion> outside/outdoors` forms to the exit disjunct
(`inferInteriorAction`), AND guard the exit *handler* (L1049) to YIELD when the text is a
presence/who question (the predicate that routes to the L6031 presence path) — so the
question wins, the bare exit fires otherwise. Mirrors the existing L810 meta-gate's
`!META_LOCATION` exclusion.

**allowed_files:** `engine/playloop.js`, `tests/U260*`.
**forbidden:** RNG, `WORLD_VERSION`, the enter classifier (already correct).
**invariants:** determinism; `U235` (presence-question floor) and `U260` (exit fidelity)
both stay green.
**test_plan:** extend `U260` — "I head outside" exits; "I head outside, who do I see?"
delivers the roster (does NOT exit-and-stop); "I walk outside" exits.
**done_when:** bare outside-motion exits; presence-question compound still answers; suite +
determinism green.
**risk:** LOW-MED — the precedence is the subtle part; lean on the `U235`/`U260` pair to
catch regressions (this is exactly where the nav packet's two self-regressions came from).
**lane:** Sonnet (or homebase) — small, well-fenced by tests.

---

## IT-4 — Building-type label drift (= T-Q4)
**Severity:** cosmetic (no navigation impact).

**The hole:** the live DM calls the `tallow` cottage "the inn" because Dalla's role is
innkeeper, while `describeInteriorLayout(world).buildingType` (`engine/structures/
interiors.js`) says `cottage`. The grounded label exists; the prompt doesn't pin it hard
enough against the NPC-role cue.

**Approach:** in `interiorLayoutFact` (`engine/llmAdapter.js`, the helper N7 added),
state the building TYPE as authoritative and instruct the DM to use it ("This is a
**cottage**, not an inn/tavern, regardless of who lives here"). Pure prompt; no state.

**allowed_files:** `engine/llmAdapter.js`, `tests/N7*`.
**forbidden:** state, RNG, the topology.
**invariants:** `buildSystemPrompt`/`buildDMSystemPrompt` stay pure; N7 green.
**test_plan:** extend `N7` — the emitted prompt names the real `buildingType` and forbids
substituting a role-implied label. (Prompt-content assertion; hermetic, no API.)
**done_when:** prompt pins the building type; N7 green. (Live confirmation optional via one
harness run.)
**risk:** LOW (prompt-only). Won't fully bind a stochastic DM — it's a nudge, not a gate.
**lane:** Sonnet / homebase (prompt-craft).

---

### Cross-refs
- WB-Q5 (node-global furniture), WB-Q6/Q8 (dialogue memory/voice) remain in
  `WHOLE_BUILDING_FINDINGS.md` — interior, but not surfaced by the town runs; spec when
  a run re-raises them.
- All five above are **Road-A-safe**: the engine keeps adjudication; only narration prose,
  prompt nudges, intent routing, and oracle precision change. No new LLM authority.
