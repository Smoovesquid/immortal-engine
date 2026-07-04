# DS-1a — a successful sense over empty canon says "nothing there", never fog

**Model:** Claude Sonnet (playloop lane). **Runs in PARALLEL with CT-1** (file-disjoint: CT-1 is
`gracefulAdjudication.js` + a doc). **Stay in `engine/playloop.js`** — if you find you need `grace/`, STOP and flag
it (that's CT-1's file).

## Context — a check with no payload
Fable's second-order diagnosis (`docs/briefs/SECOND_ORDER_DIAGNOSIS.md` §4a): on the gate, the Rules-Lawyer's
death-sense **succeeded** (NAT20) but the DM narrated *"You manage the death-sense, and it goes your way"* — the
gen-bank filler — conveying zero information. A successful information/sense check that renders atmosphere is a
dead-end wearing a success's clothes. **The rule: no check without a payload.** For an *enumerable presence-domain*
(nearby dead, people in view, exits), **canon's absence is itself the answer** — the engine already does this for
objects: `playloop.js:1683–1705` answers "is there a mirror here?" with a definite *"No — no mirror here; what's
here is…"*. Generalize that: a successful death-sense over a world with nothing dead in range should say so —
*"your sense sweeps the outpost and finds nothing dead within reach — a rare quiet."* A grounded **definite
negative is an answer; fog is not.**

## Read first
- `engine/playloop.js:~6934` `genericGroundedOutcome` — the info/generic outcome path; its comment at `:6958`
  already says "NEVER the gen:s/m/f atmosphere bank" for grounded outcomes, but the SENSE-check success still falls
  to it.
- `engine/playloop.js:7183/:7187/:7188` — the gen-bank templates (`gen:s` "it goes your way", `gen:m` "after a
  fashion") that DS-1a must NOT emit for a sense-check over an enumerable domain.
- `engine/playloop.js:1683–1705` — the object-presence definite-negative precedent to mirror ("No — no X here").

## Fix shape (a grounded negative, deterministically; invent nothing)
When a turn is an **information/sense/detection check** (perception, a "detect/sense/scan for X" intent) that
resolves **success or mixed**, and the relevant **enumerable canon domain is empty**, render the **definite
negative** for that domain instead of the gen bank:
- **death-sense / "what do I detect?"** over a world with no dead/remains modeled in range → *"…nothing dead within
  reach"* (honest: the demo has no necro-substrate yet — absence IS the fact, and it's §0-safe).
- Keep it deterministic and canon-sourced (V11) — the negative comes from scanning existing state (no minted
  content, no LLM number). Vary the phrasing by seed like the other survey leads (don't hard-code one string).

**Critical distinction — do NOT swallow the epistemic gap.** A question about something canon **never minted**
("who was the last traveler who slept here?") is NOT a presence-domain scan — its honest hedge/decline stays
correct (that's the answerability family's job, not DS-1a). DS-1a fires only for a *sense/detection check that
succeeded* and found an enumerable domain *empty* — not for missing history/lore.

**Scope guard:** this is the general rendering fix (4a). The *content* question — should the Gravedigger's
death-sense ever have something to find at Wayfarers' Outpost (a thin necro-substrate) — is **DS-1b, parked for
Tim**. Do NOT add world content here; a permanently-honest "nothing dead within reach" is the correct DS-1a
terminal.

## Invariants — by reference
THE_DM_TEST + THE_TABLE_TEST (a success delivers *something*, even if that something is a grounded "nothing").
V11 — the negative is scanned from canon, never LLM-invented. Determinism: `rng.js` sole randomness; `worldHash`
stable; U19/21/22/27/30 green. §0 never surfaced (a quiet nothing, no cosmology). LLM never throws.

## Test plan
- **`tests/U318.definiteNegative.test.js`** (pre-assigned, LLM-off): a death-sense / detect check that succeeds
  over empty canon → the narration states the definite negative ("nothing dead"/"finds nothing"/"a rare quiet"),
  and does **NOT** contain the gen-bank strings ("goes your way" / "after a fashion" / "see it through"). Assert
  determinism (same seed → same negative). Diverge guards: an epistemic-gap question ("who was the last traveler?")
  still hedges/declines (unchanged); a genuinely grounded check (something present) still delivers the positive.
- **`tests/corpus/C20.corpus.mjs`** (pre-assigned) — sense-over-empty paraphrases, locked. `npm run convergence`
  100%.

## Done-when
`U318` + `C20` green · `npm run convergence` 100% · `node --test` fully green · determinism green ·
**`npm run playtest:quick` 0 bugs** (playloop touched). **Do NOT touch `package.json`/`public/v1.js`** — CT-1 runs
in parallel; Basecamp does ONE consolidated version bump when both land.

## Commit protocol
Stage ONLY your files by explicit path (`engine/playloop.js`, `tests/U318.*`, `tests/corpus/C20.*`) — **never
`git add -A`** (many untracked briefs in the tree). Commit locally (`fix(playloop): DS-1a — a successful sense over
empty canon renders the definite negative, not the gen bank`). **Report the commit hash; do NOT push** — Basecamp
verifies (the negative is grounded + the epistemic-gap diverge holds + determinism) and pushes.
