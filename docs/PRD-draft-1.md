# Immortal Engine — Product Requirements Document

*Status: draft for critique · Owner: Tim (product) + Basecamp (build) · Scope target: one shippable vertical slice*

> **Purpose of this document.** Not to make the project sound impressive. To (a) prevent drift, (b) define the first shippable player experience, and (c) name the smallest coherent version of the game that proves the thesis. Where a claim depends on repo specifics not verified in this document, it is tagged **NEEDS ARTIFACT** so a critic (human or model) can demand evidence.

---

## 1. Product Thesis

Immortal Engine is a voice-native, deterministic tabletop RPG in which a large language model plays the *voice and interface* of a Dungeon Master while a deterministic engine owns everything real: canon, mechanics, inventory, world state, NPC truth, and every state transition. The thesis it exists to prove is that you can have both halves of a great tabletop session at once — the open-ended improvisational richness of a human DM **and** the fairness, memory, and permanence of a real game engine — *because* narration and canon are physically separated. The LLM interprets what the player means and renders what happened in prose; it never has runtime authority over what is true. If that separation holds, the player gets a DM who never forgets, never contradicts itself, never cheats the dice, and still says "yes, and" to anything they try.

---

## 2. Target Player and Use Case

**Who, first.** A solo tabletop RPG player (D&D-literate or D&D-curious) who wants a competent DM on demand and has been burned by "AI DM" chatbots that forget the map, contradict yesterday's canon, and fudge outcomes. They value fairness and continuity as much as flavor. They are one person, at a keyboard or a microphone, in one sitting.

**Not, first:** groups/multiplayer, world-builders who want a sandbox authoring tool, or players who want a polished console-game surface. Those are later audiences.

**The exact play situation the MVP must support:**
- One player, solo, one 20–45 minute session, resumable across sessions.
- Play happens **by talking** — typed natural language for the MVP, with voice input as a fast-follow (see Open Questions). Output is DM prose; the map/UI are read-only aids, never the primary verb.
- One small, hand-authored region — the Aldermere slice (Aldermere town · the Greenwood · Crowfoot Camp · the Hollowed Chapel) — under a fixed seed. *(Region content: **NEEDS ARTIFACT** — confirm the slice is the MVP surface vs. the tallow module.)*
- The session has a real beginning, a real middle, and at least one permanent consequence the player caused. It can be put down and picked up with canon intact.

---

## 3. Core Promise

The player experiences **open-ended natural-language agency with deterministic, auditable, permanent consequences** — a combination none of the three obvious alternatives delivers:

| Alternative | What it can't do that we do |
|---|---|
| **A normal chatbot "DM"** | It forgets, contradicts itself, retcons, and cheats dice because *it is* the world model. Ours can't: canon lives in the engine, not the transcript. The DM literally cannot change what already happened. |
| **A VTT (Roll20/Foundry)** | Requires a human DM, manual prep, and manual bookkeeping. Ours narrates, adjudicates, and remembers for you — zero prep, zero sheet-juggling. |
| **A scripted RPG / CYOA / video game** | Punishes any input outside its menu. Ours accepts "I try to bribe the gravedigger with the chapel key" and returns a coherent, mechanically-resolved, consequenced result — not "invalid action." |

The one-sentence promise: **A DM who will let you try anything, and a world that will hold you to it forever.**

---

## 4. Non-Negotiable Invariants

These are load-bearing. A change that violates one is a regression regardless of how good it feels. (These mirror `docs/IMMORTAL_INVARIANTS.md` and the Core Contracts in `CLAUDE.md`.)

1. **Determinism-by-seed.** The world is a pure function of seed + ordered player inputs. A single randomness source (`engine/rng.js`) is the *only* entropy; no `Math.random()`. Replaying the same seed and input log reproduces an identical world fingerprint (`worldHash`). *Enforcement:* determinism tests assert hash equality under replay.
2. **Engine-owned canon.** The engine is the sole authority on what is true — positions, inventory, NPC state, world facts. If narration and canon diverge, **canon wins** and narration is the bug. The Canon Log (`engine/csl/`) is authoritative over transient world state on divergence.
3. **LLM-as-interface-only.** The model does exactly two jobs: (a) interpret player intent into a *proposal*, and (b) render a *committed* result as prose. It never writes state, never rolls dice, never decides an outcome. "GM proposes, system commits."
4. **Explicit state + event logging.** Every state transition is an explicit, ordered, serializable event (a delta) applied through one mutation path (`engine/effectsCore.js → applyDeltas()`). No direct state writes anywhere else. The event log is the source of truth for replay and audit.
5. **Replayability / auditability.** Given a save, you can reconstruct exactly how the world reached its current state, turn by turn, and re-derive the same `worldHash`. A session is inspectable after the fact.
6. **Invariants throw; the LLM never throws.** Two layers with opposite failure semantics, and you must always know which you're in: `assertWorldInvariants()` hard-fails on any structural violation (that's a bug we want loud); the LLM layer silently falls back to deterministic base narration if the model is missing or errors (the game must never crash because an API call failed).
7. **Drift prevention is a first-class feature, not hygiene.** The system actively resists narration inventing canon (geography, NPCs, items, outcomes the engine didn't author). Narration that asserts un-authored facts is a defect caught by behavioral gates, not a stylistic preference.

> **Design corollary:** any feature that requires the LLM to "just remember" or "just decide" something is, by definition, out of bounds. Route it through the engine or don't ship it.

---

## 5. First 10 Minutes of Play

The bar: within ten minutes the player has spoken freely, been understood, seen a fair mechanical outcome rendered as fiction, and caused one thing that will still be true next session.

**0:00 — Launch.** The player opens the game to a front door that states the build version and drops them straight toward play. No lengthy menus. *(Exact launch surface / chargen flow: **NEEDS ARTIFACT**.)*

**0:30 — Light character establishment.** The player states who they are in a sentence or two ("a down-on-his-luck sellsword looking for the last honest work in Aldermere"). The engine fixes a small, deterministic character state from this — not a 40-field sheet. The DM voice acknowledges it in-fiction.

**1:30 — Arrival in a place that exists.** The player is placed at a concrete node in the Aldermere slice — say, the common room of an inn. The DM describes *only what the engine authored*: the room, an NPC or two who are actually present in world state, the exits that actually exist. Nothing hallucinated.

**2:30 — Free exploration by talking.** The player says things, not clicks. "Look for the innkeeper." "Ask her who's been through lately." "Head out toward the Greenwood." Each utterance is interpreted, adjudicated, and answered as fiction. The map updates as a read-only reflection of engine truth.

**4:00 — First NPC with real memory.** The player talks to an NPC whose knowledge, disposition, and secrets are engine-owned. The NPC answers from truth, not from vibe. If the player lies to them or threatens them, that is recorded.

**6:00 — First meaningful roll, hidden as story.** The player attempts something uncertain — pick a lock, intimidate the gravedigger, cross the rotted chapel floor. The engine rolls (deterministically, from the seed), checks a DC, generates deltas. The DM narrates the *read*, never the number: the lock "gives with a wet click" or "the tumblers refuse you and something inside stirs." The math is invisible; the fairness is total.

**8:00 — The first permanent consequence.** The outcome sticks. A resource is spent, an NPC now distrusts the player, a door is now open, the chapel now knows someone is inside. This is written to canon. It is not narration flavor — it is a fact the world will act on.

**10:00 — A thread the player is holding.** The player leaves the scene with an unresolved intent they chose (never a quest-log checklist handed to them). The world will remember. If they close the game now and return tomorrow, everything above is exactly as they left it.

---

## 6. MVP Scope

The smallest version that produces a *real, satisfying* session:

- **One region, one seed, solo, resumable.** The Aldermere slice, built fresh under its seed. No procedural generation, no second region.
- **Play by natural language.** Typed for MVP; the DM voice interprets free input and never bounces intent back as a mechanical menu.
- **The full loop, thin but complete** (see §8): speech → intent → deterministic adjudication → narration → state update → next prompt.
- **A handful of authored NPCs with engine-owned truth** (knowledge, disposition, a secret or two), reachable and conversational.
- **One category of real mechanical conflict** resolved deterministically end-to-end — e.g. a single skill/social/combat encounter that can genuinely go badly. *(Which conflict system is the MVP's spine — social check vs. the live escape-combat path — **NEEDS ARTIFACT**; pick one and prove it whole rather than three half-built.)*
- **Persistent canon + save/resume** with replayable event log and a stable `worldHash`.
- **A real arc with a real end-state.** The session can reach a satisfying stopping point / consequence — it is not an infinite idle. ("Must END, must run in the live build" — per `docs/SOBRIETY.md`.)

**Explicitly good enough for MVP:** small content, few NPCs, one region, text input, minimal character sheet, ugly-but-honest map. **Not good enough:** a DM that forgets, contradicts, or fudges; intent that gets bounced to a menu; a session with no consequence.

---

## 7. Anti-Scope (seductive, do **not** build yet)

Every item here is a real, catalogued ambition of this project. Each is parked *on purpose* because building it now trades a shippable slice for an unfalsifiable platform.

- **Multiplayer / shared-seed worlds / canon merge-conflict.** (IG-15.) One player first.
- **Infinite or procedurally-generated world.** One hand-authored region proves the thesis; infinity hides whether it's any good.
- **Full 3D tactical minis / "D&D street view" / figurine realism.** The renderer dream. Read-only 2D map is enough for MVP.
- **1000-creature bestiary + trait-as-code depth.** One or two authored threats is the MVP ceiling.
- **Living economy / trade-with-anyone.** (IG-13.)
- **The REF / appeals layer / second-model validator.** (IG-12.) A second model is a second thing to debug.
- **Rumor-collapse cosmology surfaced in-world.** §0 stays hidden by law; do not build UI for it.
- **Prose-to-world materialization at scale.** The seam is real; the MVP uses authored world, not player-authored world.
- **Voice TTS output / character-voiced audio.** Input voice is a fast-follow; synthesized DM audio is later.
- **Deep chargen / full character sheet / leveling.** Light establishment only.
- **Packs / marketplace / genre-switching.** One genre, one region.
- **The Church of Incrementalism and other Easter eggs.** Delightful; not load-bearing.

> Rule of thumb from `SOBRIETY.md`: if a feature makes the demo *bigger* rather than the first session *better*, it's anti-scope this cycle.

---

## 8. Core Game Loop

One turn, six stages. The hard boundary between stages 2 and 3 (propose vs. commit) is the whole product.

```
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. PLAYER SPEECH                                              │
   │    Free natural language. No menu. "I wedge the door and      │
   │    listen for the guard."                                     │
   ├──────────────────────────────────────────────────────────────┤
   │ 2. INTENT RESOLUTION  (LLM — proposes only)                   │
   │    Map utterance → a structured intent the engine understands │
   │    (actor, verb, target, manner). Interpret richly; commit    │
   │    narrowly. Ambiguity is resolved in-fiction, not by         │
   │    bouncing a clarification menu.                             │
   ├──────────────────────────────────────────────────────────────┤
   │ 3. DETERMINISTIC ADJUDICATION  (ENGINE — commits)            │
   │    Engine, not LLM: rolls via rng.js, checks DC/rules,        │
   │    computes deltas. Numbers and outcomes are decided here     │
   │    and ONLY here. Invariants asserted.                        │
   ├──────────────────────────────────────────────────────────────┤
   │ 4. STATE UPDATE                                               │
   │    Deltas applied through effectsCore.applyDeltas(); event    │
   │    written to the Canon/event log; worldHash advances.        │
   ├──────────────────────────────────────────────────────────────┤
   │ 5. NARRATION  (LLM — renders the committed result)           │
   │    Turn the committed outcome into DM prose. Hide the math,   │
   │    respect agency, assert no un-authored canon. If the LLM    │
   │    is unavailable, deterministic base narration ships instead.│
   ├──────────────────────────────────────────────────────────────┤
   │ 6. NEXT PROMPT                                                │
   │    Present the new world truth and hand the floor back.       │
   └──────────────────────────────────────────────────────────────┘
              ▲                                              │
              └──────────────────── loop ────────────────────┘
```

**Why the order matters:** narration (5) happens *after* state update (4), so the DM is always describing something that is already true. The model is never asked "what happens?" — only "how do I say what happened?"

---

## 9. Required Systems (packetized, modular)

Each is a module with a single responsibility; none may reach across the propose/commit line.

1. **Input layer** — capture player utterances (text MVP; voice adapter fast-follow). Owns nothing about world truth.
2. **Intent resolver** — LLM call that maps utterance → structured intent proposal. Interpret-richly / commit-narrowly. *(Current implementation surface: **NEEDS ARTIFACT** — the conductor/adapter split.)*
3. **Adjudication** — deterministic rules + dice + DC → deltas. Single entropy source. No LLM inside.
4. **Effects / mutation** — the one write path (`applyDeltas()`); nothing else mutates state.
5. **Canon + event log** — ordered, serializable, authoritative-on-divergence (`engine/csl/`); the replay/audit spine.
6. **World state + invariants** — the world object and `assertWorldInvariants()` on every ensure; hard-fail on violation.
7. **NPC truth model** — engine-owned knowledge/disposition/secrets; NPCs answer from state, not vibe; caps enforced.
8. **Narration / composer** — assemble committed outcome + world truth → DM prose; drift guard against un-authored canon.
9. **Save / load** — export/import a resumable, replayable session; version-aware. *(Format: **NEEDS ARTIFACT**.)*
10. **Determinism harness** — replay + `worldHash` equality; the desync oracle.
11. **Session boundary / arc** — a real start, a stopping point, and consequence persistence across sessions.

---

## 10. Success Criteria (observable proof)

The MVP works if, without special pleading, all of these are true:

1. **The DM Test passes.** For a battery of real player inputs, the system does what a competent human DM would do — resolves intent in the fiction — and never bounces intent back as a mechanical prompt. *(Governed by `docs/THE_DM_TEST.md`.)*
2. **The stranger verdict.** A tabletop-literate player who didn't build this plays a full session and independently says, in substance, "that was a good DM running a solid game" — on both vibe and crunch. *(The Opus experiential gate is the standing proxy for this; target: the stranger bar.)*
3. **Zero canon contradictions** in a full session: no forgotten items, no NPC contradicting its own established truth, no geography that shifts under the player.
4. **Deterministic replay holds.** Replaying the session's seed + input log reproduces an identical `worldHash`. Audit tests green.
5. **No menu-bounce, measured.** Across the session, the count of "clarify / choose an option / invalid action" responses to reasonable input is zero.
6. **A real consequence occurred and persisted.** The player caused ≥1 permanent, canon-written change, and it survives save → quit → resume unchanged.
7. **Graceful degradation proven.** With the LLM disabled, the game still runs to completion on deterministic base narration — no crash, no thrown error to the player.

---

## 11. Failure Modes (how this project most likely dies)

| # | Failure | The tell | Guardrail |
|---|---|---|---|
| 1 | **Narrative drift** | DM prose slowly starts asserting rooms, NPCs, and outcomes the engine never authored. | Drift guard on narration; behavioral gates (DM/Table Test) that fail on un-authored canon; canon-wins invariant. |
| 2 | **Hallucinated state** | The world "remembers" something that was only ever said in prose, or forgets something canon holds. | Engine-owned canon; narration renders *after* commit; the transcript is never a source of truth. |
| 3 | **Overbuilding** | Weeks pass; the demo is bigger but no first session is better; prototypes multiply. | `SOBRIETY.md` discipline; Anti-Scope list; "one bounded module that ends." Ship gates on *session quality*, not feature count. |
| 4 | **Weak gameplay** | It's coherent but boring — nothing is at stake, no roll matters. | MVP requires ≥1 real conflict that can go badly + ≥1 permanent consequence. Success criterion #2/#6. |
| 5 | **Excessive clarification** | The DM keeps asking "do you mean X or Y?" instead of ruling. | Interpret-richly / commit-narrowly; resolve ambiguity in-fiction; menu-bounce metric (§10.5) must be zero. |
| 6 | **Menu-bounce** | Free input gets answered with "choose: [a] [b] [c]" or "invalid action." | Same as #5; DM Test is the hard gate; treat any menu as a bug report. |
| 7 | **Test brittleness** | Determinism/canon tests break on unrelated changes; the suite becomes noise people ignore. | Tests assert *behavior and hashes*, not prose strings; version-embedded strings updated on bumps; three-signal eval (§12) so no single flaky gate blocks. |
| 8 | **Architecture sprawl** | Two combat engines, three play surfaces, mutation paths that bypass `applyDeltas()`. | One write path; know which layer you're in (throws vs. fallback); `REPO_MAP.md` two-surface discipline; new state must go through the contracts. |

---

## 12. Test Strategy

**Governing principle:** a feature is not *real* until the relevant gate proves it. "Built" ≠ "done"; "runs on my machine" ≠ "true in the live build."

What must be proven before a new feature counts:

1. **Determinism preserved.** Any change touching world shape re-passes `worldHash` replay-equality. This is non-negotiable and comes first.
2. **Invariants hold.** `assertWorldInvariants()` green on every path the feature touches; new fields get new invariants and safe defaults.
3. **Canon authority intact.** On any narration/state divergence, canon wins — asserted, not assumed.
4. **Behavioral gates.** The feature passes the **DM Test** (intent resolved in fiction, no bounce) and the **Table Test** (behaves as a real table would). These are correctness gates for *behavior*, not style.
5. **Three-signal evaluation** (no single judge is trusted):
   - **Corpus / regression** — the always-on green suite (`node --test`, `npm run check`), the cheap fast loop.
   - **Gate / discovery** — the standing experiential gate (broad, for finding new failure classes), run on the API key from the CLI, not interactively, because it is the costliest thing in the repo.
   - **Human / taste** — a live playtest through the real player gesture in the live build, screenshotted, before anything is called done. *(Per `docs/PLAYTEST_PROTOCOL.md`.)*
6. **Playtest harness bug classes.** After anything touching state shape / the main loop / world tick, run the headless harness across its bug classes (crash, invariant, determinism-break, save-corruption, ending-leak, etc.).
7. **Graceful-degradation test.** Prove the LLM-disabled path still completes.

**Anti-goal:** tests that pin exact prose. Narration is allowed to vary; *canon and hashes* are what must be stable. Judge-based gates must guard against halo/self-preference bias (prefer cross-family / atomic / no-CoT judging).

---

## 13. Open Questions (unresolved product + architecture)

**Product**
1. **Voice input in MVP or fast-follow?** Text is the safe MVP; voice is the identity ("voice-native"). What accuracy/latency bar makes voice shippable, and does chargen work by voice?
2. **How does a session *end*?** What is the satisfying stopping point for a resumable, open-ended slice — a scene beat, an explicit "rest," a consequence threshold?
3. **How much crunch is surfaced?** Fully hidden math (narrate-the-read) vs. optional dice visibility for crunch-lovers. Default is hidden; is there a reveal toggle?
4. **How is intent ambiguity resolved without menu-bounce?** The line between "interpret richly and commit" and genuinely under-determined input the DM must probe *in-fiction*.
5. **What's the exact MVP arc?** One authored spine, or a small set of player-chosen threads in the slice? What makes 20–45 minutes feel complete?

**Architecture**
6. **Which conflict system is the MVP spine?** Social check vs. the live escape-combat path — commit to one and prove it whole. **NEEDS ARTIFACT.**
7. **MVP play surface: the Aldermere slice or the tallow module?** Which is the front door for a stranger. **NEEDS ARTIFACT.**
8. **Save format + versioning story.** Shape, migration, and old-save warnings for the MVP. **NEEDS ARTIFACT.**
9. **Intent-resolver boundary.** Exactly what the LLM returns (schema of a proposal) and how the engine rejects a malformed/over-reaching proposal. **NEEDS ARTIFACT.**
10. **Two play surfaces / two combat engines.** Confirm the MVP runs entirely on the live surface (not a prototype) and hooks the *live* combat path. **NEEDS ARTIFACT.**

---

## 14. Packet Roadmap

Small, bounded, independently-verifiable packets forming one vertical slice. Order is roughly dependency order; each is spec-before-edit and closes with a committed proof. Sizes: **S** ≈ hours, **M** ≈ a day, **L** ≈ multi-day.

> Note: some capability below almost certainly already exists in some form. Each packet is written as "prove it whole and wire it to the live MVP surface," not "build from zero." Reconcile against `docs/PACKETS.md` and `docs/WHAT_THIS_IS.md` before starting — **NEEDS ARTIFACT** for current status of each.

### P1 — Slice front door
- **Purpose:** A stranger launches and is in the Aldermere slice within seconds, on a known seed, version visible.
- **Player-facing effect:** Open the game → light character establishment → standing in an authored place.
- **Deterministic requirement:** Same seed → identical starting `worldHash`.
- **Proof/test:** Launch-to-play replay produces a fixed start hash; live playtest screenshot.
- **Risk:** Chargen tempts scope creep into a full sheet. Keep it to a sentence.
- **Size:** M

### P2 — Free-input intent resolution (no bounce)
- **Purpose:** Player utterances become structured intent proposals; ambiguity resolved in-fiction.
- **Player-facing effect:** "I wedge the door and listen" is understood and answered as story, never as a menu.
- **Deterministic requirement:** The resolver proposes only; the engine commits. Identical input log → identical outcomes.
- **Proof/test:** DM-Test battery: zero menu-bounces on a fixed input set; determinism replay green.
- **Risk:** Over-clarification; malformed proposals reaching the engine. Reject at the boundary.
- **Size:** L

### P3 — Deterministic adjudication for one conflict
- **Purpose:** One real conflict (chosen spine — social/skill/combat) resolved end-to-end by the engine.
- **Player-facing effect:** An uncertain attempt can genuinely succeed or fail, and it matters.
- **Deterministic requirement:** All rolls via `rng.js`; DC/rules in-engine; deltas via `applyDeltas()`.
- **Proof/test:** Unit + replay tests on the resolution path; invariants hold; harness clean.
- **Risk:** Building three half-conflicts instead of one whole one. Commit to one.
- **Size:** L

### P4 — Narrate-the-read (hide the math)
- **Purpose:** Committed outcomes render as DM prose that never states numbers and never asserts un-authored canon.
- **Player-facing effect:** "The tumblers refuse you" — not "you rolled 8 vs DC 14."
- **Deterministic requirement:** Narration runs *after* commit; consumes only committed truth.
- **Proof/test:** Quality/drift gate on narration; graceful-degradation test (LLM off → base narration).
- **Risk:** Prose inventing canon (drift). Guard it as a gate, not a preference.
- **Size:** M

### P5 — NPC truth model
- **Purpose:** A few authored NPCs answer from engine-owned knowledge/disposition/secrets.
- **Player-facing effect:** Talking to someone who actually knows things and remembers how you treated them.
- **Deterministic requirement:** NPC state is engine-owned; dialogue caps enforced; no LLM-authored facts.
- **Proof/test:** NPC-depth tests; a conversation replay reproduces identical NPC state.
- **Risk:** Secret leakage in narration. Enforce at the reveal sink.
- **Size:** M

### P6 — Canon + event log (audit spine)
- **Purpose:** Every transition is an ordered, serializable event; canon authoritative on divergence.
- **Player-facing effect:** Invisible to the player — but the reason nothing ever contradicts.
- **Deterministic requirement:** One write path; log replays to identical `worldHash`.
- **Proof/test:** Replay-from-log equality; canon-wins-on-divergence test.
- **Risk:** A mutation path that bypasses `applyDeltas()`. Audit for it.
- **Size:** M

### P7 — Save / resume with intact canon
- **Purpose:** Put the session down and pick it up with everything true still true.
- **Player-facing effect:** Quit mid-arc, return tomorrow, the world is exactly as left.
- **Deterministic requirement:** Save round-trips to identical `worldHash`; version-aware with old-save warning.
- **Proof/test:** Save→load→hash-equality test; save-corruption harness class.
- **Risk:** Silent save-corruption on shape changes. Version + warn.
- **Size:** M

### P8 — Permanent consequence + arc end
- **Purpose:** Guarantee ≥1 player-caused permanent change and a satisfying stopping point.
- **Player-facing effect:** Something you did sticks; the session can *finish*, not just idle.
- **Deterministic requirement:** Consequence written to canon; persists across save/resume.
- **Proof/test:** Consequence survives quit/resume; ending path reachable (no ending-leak).
- **Risk:** Infinite-idle with no stakes (Failure #4). The end-state is the point.
- **Size:** M

### P9 — Standing experiential gate wired to the slice
- **Purpose:** The stranger-verdict proxy runs against the live MVP surface.
- **Player-facing effect:** None directly; it's how we know the MVP is good.
- **Deterministic requirement:** Gate reads real play through the live path, not a prototype.
- **Proof/test:** Gate scores the slice; three-signal loop (corpus + gate + human) green.
- **Risk:** Judge bias / halo. Use debiased judging; keep the human taste signal decisive.
- **Size:** M

### P10 — Voice input adapter (fast-follow, gated behind the slice)
- **Purpose:** Deliver the "voice-native" identity once the loop is proven in text.
- **Player-facing effect:** Speak your action instead of typing it.
- **Deterministic requirement:** Voice → text → identical intent path; no new entropy into the world.
- **Proof/test:** Transcribed-input replay matches typed-input replay for the same utterances.
- **Risk:** Latency/accuracy makes it feel worse than typing. Gate on a quality bar; ship text first.
- **Size:** L

---

### Assumptions a critic should attack
- That one hand-authored region is enough to prove the thesis (vs. the thesis secretly requiring scale).
- That "narrate-the-read, hide the math" is what the target player actually wants (vs. wanting visible dice).
- That the propose/commit split is cleanly holdable in practice under the pressure of rich intent.
- That the stranger-verdict gate is a valid proxy for product-market fit rather than a taste echo chamber.
- That the MVP conflict spine (once chosen) is deep enough to make a session *satisfying*, not merely coherent.
