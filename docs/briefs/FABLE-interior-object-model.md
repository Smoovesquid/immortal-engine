# Fable brief — the interior object/space model (find the shared root, design the fix)

**Model:** `claude-fable-5`, effort `high` (or `xhigh`). This is one well-specified turn — take it slowly and get it right; a long turn is expected.

---

You are a senior engine architect on the **Immortal Engine**, a deterministic, seed-driven
text-RPG. This is a hard, ambiguous, *architectural* diagnosis-and-design task — the kind
where the value is in finding the real root, not in shipping the first plausible patch.
Read before you conclude; cite lines, not impressions.

## The problem

Inside buildings, the **world model and the layers that read it disagree about what exists
in a room and what the player can do with it.** Four symptoms, all flagged in the findings
doc as entangled and *not* safe to fix in isolation:

- **WB-Q5 — node-global furniture.** The same chest/dresser appears in *every* room of a
  building; furniture is attached to the node, not to a topology room id.
- **WB-Q3 — free actions still roll.** "open the chest", "reach for the letter" resolve as a
  d20-vs-DC and fail, partly because the object isn't actually in the room's context to act on.
- **WB-Q9 — dialogue invents space.** An NPC offered "guest rooms upstairs" in a single-storey
  cottage. The WB-Q1 fix (`describeInteriorLayout`) fed the *real* room graph into the DM
  narration prompts but **not** the dialogue path, so dialogue still improvises geometry.
- **WB-Q2 — failed-roll narration ignores the player's stated intent.**

**Hypothesis to confirm or refute (don't assume it):** there is no single authoritative
"room state" — the set of objects, exits, and occupants that exist in *this* room right now —
that the resolver AND every narration/dialogue sink read from. Each layer therefore improvises
its own answer and they diverge. Study how **WB-Q1 (already DONE, see WB-F5)** was fixed for
the DM narration path, and decide whether the correct move is to generalize that pattern into a
shared room-state consumed everywhere, or something else the code tells you.

## Grounding — read these first

- `docs/playtests/harness/WHOLE_BUILDING_FINDINGS.md` — the WB-Q rows. WB-Q2/Q3/Q5/Q9 are the
  target; WB-Q1/WB-F5 is the *solved precedent* to learn from.
- Topology / room model: `engine/structures/interiors.js` (`describeInteriorLayout`),
  `engine/structures/topology.js`, `floorPlan.js`, `roomDetail.js`, `roomOccupancy.js`.
- Narration sinks: `engine/grace/gracefulAdjudication.js` (`buildLocationSurvey`),
  `engine/ai/narratorContext.js` (`buildScene`), `engine/llmAdapter.js` (the DM prompts).
- Dialogue sink (still invents space): `engine/npc/dialogue.js` (+ `npcBrain.js`,
  `npcVoiceResolve.js`, `perspectiveFilter.js`).
- Action classification + resolution: `engine/playloop.js` (`inferInteriorAction`),
  `engine/resolve.js` (d20 vs DC → deltas).
- Mutation: `engine/effectsCore.js` (`applyDeltas` — the *sole* mutation path).

## Constraints — invariants by reference (the docs win; do not weaken them)

- **Determinism is sacred.** `engine/rng.js` is the only randomness source. `worldHash` must
  stay stable under replay; tests `U19/U21/U22/U27/U30` must stay green. Any room-state you
  introduce must be either seed-derived (reproducible) or excluded from the hash the way
  pure-view data is — decide which, and prove it.
- All mutations go through `effectsCore.applyDeltas`. The Canon Log (`engine/csl/`) is
  authoritative on divergence. `engine/invariants.js` throws on violation — respect it.
- `docs/THE_DM_TEST.md` + `docs/THE_TABLE_TEST.md` govern behavior; `docs/IMMORTAL_INVARIANTS.md`
  and the CLAUDE.md purity rules are non-negotiable.
- Per `docs/biblioteca/` Vol 11: **never let the LLM set a number** — route any resolution
  deltas through deterministic tables. Vol 7: interpret richly, commit narrowly.
- Do not touch the *wording* of the DM/dialogue prompts (taste-critical, a separate lane).
  You may change what *facts* are fed into them; not their voice.

## Deliverable (output contract)

**PRIMARY — a design doc at `docs/briefs/INTERIOR_OBJECT_MODEL.md`:**
1. The confirmed shared root (or a reasoned refutation + the real root), cited to specific
   files/lines.
2. The target architecture: the single authoritative per-room state, and exactly how the
   resolver and each sink (survey, DM prompt, dialogue) consume it instead of improvising.
3. A **packetized** implementation plan — each packet bounded to one file-set, with a test
   plan and a done-when, ordered so the *foundational* piece lands first and makes the rest
   small. A Sonnet/Codex worker should be able to implement each packet from this without
   re-deriving the root.
4. An explicit **determinism / worldHash** analysis for the foundational change.

**OPTIONAL — implement the FOUNDATIONAL packet only** (room-scoped object attachment), *iff*
`node --test` and `npm run convergence` both stay green and determinism holds. One local
commit. Do **not** implement the whole cluster in one pass. Do **not** push.

## Working style

- When you have enough to act, act; in your final message give a recommendation, not a survey.
- Don't add features, refactors, or abstractions beyond the task. A diagnosis doesn't need
  surrounding cleanup.
- Ground every "verified"/"done" claim in a tool result (a line you read, a test you ran). If
  something is unverified, say so plainly.
- Boundaries: this is diagnosis + design **first**. Land at most the single foundational
  packet, and only with the full suite + convergence + determinism green. If you're unsure a
  change holds determinism, **stop and put it in the plan** rather than committing it.
- Run `node --test` and `npm run convergence` before claiming green. Leave commits local —
  Basecamp verifies and pushes.

## Done-when

The design doc exists and is concrete enough to implement from without re-deriving the root;
the determinism analysis is explicit; and if you implemented the foundational packet, the full
suite + convergence + determinism are green in a single local commit.
