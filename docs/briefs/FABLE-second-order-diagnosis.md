# FABLE — second-order diagnosis: why the answerability family did NOT collapse

**Model:** Claude Fable 5 (run in Tim's window — the hardest-architectural-diagnosis lane). **Diagnosis only — no
code.** Output: a written analysis + falsifiable predictions, like your first meta-diagnosis. Commit locally;
Basecamp verifies + pushes.

## The situation — your P5 prediction was falsified
Your first meta-diagnosis (`docs/briefs/FAILURE_META_DIAGNOSIS.md`, commit `1eed65e`) identified G1 (a direct
question terminating as a non-answer) as the one still-generating root, and predicted that closing the
answerability family (AG-1 + DLG-1 + NBIO-1 + CMB-SINK-1) would drive **DM_TEST_DEADEND ≤ 1/48** (prediction P5).

All four packets shipped and are verified green on the deterministic floor (suite 9114/9114, convergence 100%,
playtest 0 bugs). The clean post-family Opus gate then measured:

**`docs/playtests/opus-gate-2026-07-02-postfamily.md` — 10/48 failing: DM_TEST_DEADEND 9, CANON_HALLUCINATION 1.**

P5 is falsified (9, not ≤1). But the *composition* moved in a way worth a second-order read:
- **Combat answerability CLOSED cleanly.** The Chaos-griefer scored 12/12 — every forceful/improvised combat
  action resolved, and the escape law held ("won't even let me die"). CMB-SINK-1 did exactly what it promised.
- **DLG-1 + NBIO-1 held** — no dialogue enter-and-wait, no born-here misroute.
- **The remaining 10 failures cluster into three shapes** (see §Buckets below), one of which the family never
  targeted at all.

## Read first
- `docs/playtests/opus-gate-2026-07-02-postfamily.md` — the full gate (per-turn player text, DM output, judge
  severity). **This is your primary evidence.**
- `docs/briefs/FAILURE_META_DIAGNOSIS.md` — your own first diagnosis (roots R1/R2/R3, predictions P1–P5).
- `engine/grace/answerability.js` — AG-1's `directQuestionIntent` classifier (returns typed
  `kind: rules|self|npc-addressed|place|object|referent-followup`).
- `engine/playloop.js:1652-1690` — the explore-intent branch. **Note the load-bearing detail:** AG-1's
  postcondition here (`:1658`) reroutes ONLY `kind === 'referent-followup'`; a `rules`/`place`/`object` question
  falls through to the ungrounded-referent clarify (`:1671`) or the atmosphere/survey sink. i.e. AG-1 wired the
  reroute for ONE of its classifier's six kinds.
- `engine/playloop.js:~6923` — the info-path presence detector (`PRESENCE_Q_RE`); it never runs for a compound
  "what do I see … and who's standing here?" because the explore branch at `:1652` claims the turn first.

## The three buckets (Basecamp's read — pressure-test or overturn it)
1. **Residual entrance-leaks (3 turns).** "Gravedigger's an odd class — what can I do?" (read as a *person's name*
   → `[clarify:referent]`), "the last traveler who slept here", "who's this letter from?". Basecamp's read: these
   are the SAME root you named — AG-1 patched some entrances but wired its postcondition for only the
   `referent-followup` kind, so `rules`/`place`/`object` questions still hit the pre-existing clarify/atmosphere
   sinks. The canon-erasure turn ("who's standing in it?" → "little of note" while 5 NPCs stand there) is the same
   shape: a presence sub-question swallowed by the broad explore claim. AG-2 (the sibling packet) targets these.
   **Q for you: is that the whole story, or does the fact that AG-1's postcondition covered only 1 of 6 kinds
   reveal a deeper flaw in "postcondition-at-the-sink" as the chosen mechanism** (e.g. the sinks are too many and
   too scattered to enumerate — is there a single choke point the reroute should live at instead)?
2. **Crunch-transparency (4 turns — the biggest cluster, and NEW).** The Rules-Lawyer *explicitly demands raw
   mechanics* — "give me the d20 and the damage die", "how many dead within range, which direction, actual
   numbers" — and the DM refuses / a NAT20 death-sense returns zero concrete content. This is
   *narrate-the-read-never-the-number* (the DX law, [[project_dnd_xcom]]) colliding head-on with a player who asks
   for the number. At a real table you CAN ask "what did I roll?" and be told. **Q for you: is this a genuinely
   separate axis from G1 (answerability), or a special case of it — "a mechanically-answerable question is also a
   direct question the DM must answer"? And where is the line between the hide-the-math LAW and the DM-Test duty to
   answer a direct request?** This is the one that needs your altitude — it may mean revising a LAW, not adding a
   gate.
3. **Contentless success (subset of bucket 2).** The death-sense *succeeds on the roll* but the world models no
   queryable "dead nearby" fact, so even success narrates emptiness. **Q: is this a world-content-modeling gap
   (the check has no grounded result-space to draw from) rather than a routing/answerability problem at all?** If
   so it's a different track from AG-* entirely.

## What we need from you
1. **Why P5 missed** — was the family the wrong cut, the right cut incompletely wired, or right-but-swamped by a
   pre-existing separate axis (crunch-transparency) the gate happened to probe harder this run? (Note the honest
   variance caveat: the player is stochastic Opus; this run's Rules-Lawyer pushed raw-crunch demands earlier runs
   didn't — 5/48→10/48 is not apples-to-apples.)
2. **Is "postcondition at the sink" the right mechanism, or should the reroute live at a single choke point?**
   AG-1 covered 1 of 6 kinds precisely because the sinks are scattered — is enumerating them a losing game?
3. **The crunch-transparency ruling** — your recommended stance on the hide-the-math LAW vs the explicit-demand
   duty, at the level of principle (this is a taste-critical LAW question for Tim, so give options + your pick,
   not a unilateral rewrite).
4. **New falsifiable predictions** for the next gate, tied to the packets you'd order (AG-2 is already scoped for
   bucket 1; tell us if it's right, and what the crunch-transparency / contentless-success packets should be and
   in what order).

## Invariants — by reference
Diagnosis respects the whole doc apparatus (THE_DM_TEST, THE_TABLE_TEST, Road A / Biblioteca V11 — the world
supplies facts, never the LLM; §0 never surfaced). You may recommend revising a LAW (e.g. hide-the-math) — flag it
loudly as a LAW-level change for Tim's call, don't assume it.

## Done-when
A written second-order diagnosis at `docs/briefs/SECOND_ORDER_DIAGNOSIS.md` (mirror the shape of your first): the
three questions answered, the mechanism critique, the crunch-transparency ruling options + your pick, and ordered
packets with falsifiable next-gate predictions. Commit locally
(`docs(meta): second-order diagnosis — why the answerability family didn't collapse P5`); **report the hash, do
NOT push** — Basecamp verifies and pushes.
