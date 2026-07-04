# AG-3b — the egress door's whitelist becomes intent-aware (a read-action tag doesn't answer a person-question)

**Model:** Codex 5.5 (deep playloop egress surgery — same hot path as AG-3). **Solo, serial** on `playloop.js`.
**Priority: LOW / polish.** The answerability arc is CLOSED (P10 gate 9→3, milestone v0.21.0 shipped). This packet
closes the ONE genuine answerability residual the gate found; it is optional hardening on an already-good result —
scope it tight, do not gold-plate.

## First: what AG-3b is NOT
Fable's original AG-3b idea (source-tag every answer-bearing empty-mech path so empty-mech can default to
"suspect") targets a gap the **P10 gate did not surface** — none of the three residuals were empty-mech fog without
movement. That version is deferrable insurance, not this packet. (If you want it later, it's a separate hardening
pass.) **This packet targets the real, observed residual.**

## The real residual (Newbie-7, `docs/playtests/opus-gate-2026-07-02-P10-AG3.md`)
Turn: _"Sorry, I mean the letter — it says someone got married. Do you know who?"_ → the engine keyed on "the
letter" and routed to the **letter-read path** (`playloop.js:6220`, emits `[read:revealed-item …]`), which re-read
the letter body; the narration layer then wrapped the no-name re-read in an atmospheric NPC dodge ("some names are
kept closer…"). The player asked a **direct person-question** ("do YOU know who?") and got a read-action + mood-fog
instead of a legible answer or honest decline.

**Root:** this is Fable Blocker A (a broad upstream claimer shadows the precise answerer) surviving into the egress
era — the letter-read path is answer-bearing for *read/object* intents, but it claimed an **`npc-addressed`**
question it doesn't serve, and AG-3's whitelist trusts any `[` bracket tag regardless of the asked intent. The
classifier already types this correctly: `directQuestionIntent("…do you know who?")` → `kind: 'npc-addressed'`
(AG-2R's second-person `do you` rule). The door just isn't consulting the *match*.

## Fix shape — intent-aware whitelist at the egress (`applyEgressRepair`, `playloop.js:551`)
A whitelisted provenance is answer-bearing **only for the intent kinds it actually serves.** Add a narrow
mismatch rule: when `directQuestionIntent` types the turn as **`npc-addressed`** (or `person`/`place` fact) and the
output's provenance is a **read/observe/object-action** tag (`[read:…]`, `observe only`, object-presence) — i.e.
the turn asked a PERSON a question but got answered by a THING-interaction — treat it as **suspect → repair** via
the existing `answerOrDeclineQuestion(w, text, outcome, intent)` (which post-AG-2R gives an honest in-voice decline
when the fact isn't in canon: "I couldn't say — the letter never names them").

**Over-match guards (critical — this is why it's tight):**
- A genuine **read/object question** ("what does the letter say?", "is there a name on it?", `kind:'object'` /
  `referent-followup` about the item) IS served by the read path → must still pass through untouched.
- The mismatch fires ONLY on the specific cross: an addressed-person/fact question (`npc-addressed` / `place` /
  `person`) landing on a read/observe/object-action provenance. Do not touch dialogue-ask/answer tags, meta
  answers, place/person query outputs, or the honest `…→ no-record` declines.
- Determinism unchanged: narration-only repair, no state write, no rng (same contract as AG-3 — U19/21/22/27/30
  must stay green).

## Invariants — by reference
THE_DM_TEST + THE_TABLE_TEST. Road A / V11 — the decline/answer is canon-sourced, never LLM-invented. §0 never
surfaced. narration ≠ canon (why narration-only repair is legal). The 121 locked corpus cases MUST stay 100% —
they prove the read/object answer-paths still pass through; if one goes red, the mismatch rule is too broad.

## Test plan
- **`tests/U320.intentAwareWhitelist.test.js`** (pre-assigned, LLM-off): "do you know who [X]?" on a revealed
  letter with no such name in canon → an honest in-voice decline (names the gap), NOT a bare `[read:revealed-item]`
  re-read. Diverge guards: "what does the letter say?" / "is there a name on it?" → still the read path
  (untouched); a real dialogue answer still passes; determinism (same seed → same repaired narration).
- **`tests/corpus/C22.corpus.mjs`** (pre-assigned) — the person-question-vs-read-tag mismatch family + the
  read/object diverge cases, locked. `npm run convergence` 100%.

## Done-when
`U320` + `C22` green · `npm run convergence` 100% · `node --test` fully green · **determinism green
(U19/21/22/27/30)** · `npm run playtest:quick` 0 bugs. Bump the version (solo): `package.json` → **0.21.1**,
`public/v1.js` → **v0.21.1 / build 036 · 2026-07-02 · ask a person, not a thing**.

## Commit protocol
Stage ONLY your files by explicit path (`engine/playloop.js`, `package.json`, `public/v1.js`, `tests/U320.*`,
`tests/corpus/C22.*`) — **never `git add -A`** (many untracked briefs in the tree). Commit locally
(`fix(playloop): AG-3b — the egress whitelist is intent-aware; a person-question can't be answered by a read-action`).
**Report the commit hash; do NOT push** — Basecamp verifies (the repro + the read/object over-match guards +
determinism) and pushes.

## Out of scope (separate, if Tim wants them)
- **RL-1** inventory-compound (stats answered, item-list dropped) → a CT-family meta-answer completeness fix, grace.
- **Chaos-5** window-menu on a decisive "climb through the burning window" → a window-handler bug (not
  answerability), playloop.
- **Lore-8** "Old Shrine / Sooted Bridge" road names → TRACE FIRST (are they real adjacent nodes = judge
  false-positive, or a genuine egress-repair fabrication?) before any packet.
