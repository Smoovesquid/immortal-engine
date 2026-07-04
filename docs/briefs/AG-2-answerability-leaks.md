# AG-2 — the broad explore/referent claim must yield to a typed direct question

**Model:** Claude Sonnet (grace/playloop answerability lane — same lane that built AG-1/DLG-1/NBIO-1).
**Solo packet — NOT parallel.** Both parts live in `playloop.js` + `engine/grace/` (serial-hot files), and they
share the SAME root, so this is ONE worker doing two related reroutes in sequence. If the routing-precedence gets
gnarly (a fix in Part A breaks a Part B case or an existing diverge), STOP and flag for a Codex/Opus sub-packet
rather than deep-surgery on playloop's dispatch order.

## Context — the two residual leaks from the post-family gate
The post-family Opus gate (`docs/playtests/opus-gate-2026-07-02-postfamily.md`) left four DM-Test failures that are
ONE bug shape: **a broad "look-around / unknown-referent" claim fires BEFORE the typed direct-question reroute, so
the answer machinery never runs.** AG-1 built the classifier (`directQuestionIntent`) and the reroute, but wired
the reroute at `playloop.js:1658` for only ONE of the classifier's six kinds (`referent-followup`). The other kinds
still fall through. Close that.

**This is the bounded, no-taste-call half of the post-family findings.** The crunch-transparency cluster
(Rules-Lawyer demanding raw dice) is DEFERRED — it's a LAW-level question going to Fable's second-order diagnosis,
NOT this packet. Do not touch the hide-the-math behavior here.

## Read first
- `engine/grace/answerability.js` — `directQuestionIntent(text, world)` → typed
  `kind: rules|self|npc-addressed|place|object|referent-followup`. Already correct; you're widening its CONSUMERS.
- `engine/playloop.js:1652-1690` — the explore-intent branch. `:1658` reroutes ONLY `referent-followup`; `:1671`
  `ungroundedNpcReferentForText` fires `[clarify:referent]` with NO classifier check in front of it (this is what
  eats "Gravedigger … class" — the proper-noun-looking word is read as an NPC name).
- `engine/playloop.js:~6923` — the info-path presence detector (`PRESENCE_Q_RE` / `namesPresentNpc` →
  `buildLocationSurvey(world, { presence: true })`). It never runs for a compound "what do I see … and who's
  standing here?" because the explore branch at `:1652` claims the turn first.
- Other `[clarify:referent]` emitters that may need the same guard: `playloop.js:1182`, `:2770`, `:6454`.
- `engine/grace/gracefulAdjudication.js:2488` `buildLocationSurvey` — the `insideStructure && !opts.presence`
  room-scoped branch (`:2519`) is what produced "The room holds little of note." for the who's-here question.
- The existing answer machinery you route TO (invent NO new content): `answerOrDeclineQuestion`, `personQuery` /
  `placeQuery`, and the rules-answer path (grep how a `class`/`ability` question is answered elsewhere — DTD-A
  added meta/knowledge answering; reuse it).

## Part A — `rules`/`place`/`object` questions must not die at the referent/atmosphere sinks
Repros (all `[clarify:referent]` or atmosphere-dodge today; must become answer-or-honest-decline):
- **"Gravedigger's an odd class — what can I actually do with it? special abilities?"** → `kind: 'rules'` → route
  to the rules/knowledge answer (what the class is / honest "that's not a class here"), NOT read "Gravedigger" as
  a person. The classifier's `rules` kind must be consulted BEFORE `ungroundedNpcReferentForText` at `:1671`
  claims the proper-noun.
- **"tell me about the last traveler who slept on this pallet"** → `kind: 'place'` (imperative-info) → route to
  `answerOrDeclineQuestion` (an honest "no record of who came before" is a PASS — a grounded decline beats an
  atmospheric `[clarify:referent]` dodge).
- **"who's this letter from?"** → `kind: 'place'`/`object` referent → answer-or-decline about the letter's sender
  from canon (or honest "no name on it"), never atmosphere-bank.
**Shape:** at `:1658`, widen the reroute beyond `referent-followup` — when `directQuestionIntent` is non-null and
the pending fall-through is a clarify/atmosphere sink, hand to the deliver-or-decline path for `rules`/`place`/
`object`/`self` too. Guard the ORDER so a `rules` classification pre-empts the `:1671` ungrounded-referent clarify.
**Do not** swallow a genuine unknown-NPC referent that ISN'T a typed question ("who is that?" with a real
demonstrative referent still clarifies — see the diverge guards).

## Part B — a presence sub-question inside an explore claim routes to the roster, not "little of note"
Repro: **"What do I see in here — and who's standing in it?"** → today the explore branch (`:1652`) builds the
room-scoped survey with `presence` unset, so `buildLocationSurvey` hits `!opts.presence` → "The room holds little
of note." **while canon has 5 present NPCs.** (CANON_HALLUCINATION, high.)
**Shape:** when an explore/look turn ALSO carries a presence question ("who's standing here/in it/in the room",
"who's in here"), route with **`presence: true`** so the roster branch runs — do NOT let the bare-look branch
answer a "who's here" question with a people-blind survey. Reuse `PRESENCE_Q_RE`/`namesPresentNpc`; if
`PRESENCE_Q_RE` doesn't catch "who's standing in it", widen it minimally.
**Anti-regression (critical):** this must NOT reopen the FIRST_ROOM #4 roster-leak — a BARE "look around" (no
presence question) stays room-scoped (furniture only, no settlement dump). Only an explicit who's-here question
flips `presence:true`. Keep the existing look-around corpus green.

## Invariants — by reference (do not weaken)
THE_DM_TEST + THE_TABLE_TEST. Road A / Biblioteca V11 — reroute to canon answers/declines; invent no fact;
the honest "no record" decline is a valid terminal (better than a dodge). Determinism: `engine/rng.js` sole
randomness; `worldHash` stable; U19/21/22/27/30 green. LLM never throws. §0 never surfaced. **Over-match: bare
look-around stays room-scoped; a real unknown-NPC demonstrative still clarifies; declared actions still act.**
The crunch-transparency behavior is OUT OF SCOPE — don't touch hide-the-math.

## Test plan
- **`tests/U316.answerabilityLeaks.test.js`** (pre-assigned, LLM-off): Part A — "Gravedigger … class … abilities?"
  → a rules/knowledge answer, NOT `[clarify:referent]`; "the last traveler who slept here" → answer or honest
  no-record decline, NOT `[clarify:referent]`; "who's this letter from?" → sender answer or honest no-name, NOT
  atmosphere. Part B — "what do I see in here — and who's standing in it?" with ≥1 present NPC → the roster names
  them, NOT "little of note". Diverge guards: bare "look around" stays room-scoped (no roster); "who is that?"
  (real unknown demonstrative) still clarifies; "I search the chest" still acts. Assert determinism.
- **`tests/corpus/C19.corpus.mjs`** (pre-assigned) — paraphrase families for both parts, locked. Keep the whole
  corpus 100% (`npm run convergence`), especially the existing look-around / referent cases.

## Done-when
`U316` + `C19` green · `npm run convergence` 100% locked · `node --test` fully green · determinism green ·
**`npm run playtest:quick` 0 bugs** (playloop + grace touched). Bump the version (solo): `package.json` →
**0.20.8**, `public/v1.js` → **v0.20.8 / build 033 · 2026-07-02 · every question, an answer**.

## Commit protocol
Stage ONLY your files by explicit path (`engine/playloop.js`, `engine/grace/answerability.js` if touched,
`engine/grace/gracefulAdjudication.js`, `package.json`, `public/v1.js`, `tests/U316.*`, `tests/corpus/C19.*`) —
untracked briefs/docs are in the tree, so **never `git add -A`**. Commit locally (`fix(grace): AG-2 — rules/place
questions + who's-here don't die at the referent/survey sinks`). **Report the commit hash; do NOT push** —
Basecamp verifies (the 4 repros + the FIRST_ROOM anti-regression + determinism) and pushes.
