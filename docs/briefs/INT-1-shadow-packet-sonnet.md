# INT-1 (Sonnet lane) — typed IntentPacket in SHADOW mode (zero behavior change)

**Model:** Claude Sonnet. **Serial lane** — this packet touches `engine/playloop.js` (hot file); no other
worker may be on playloop/grace while it runs. **Worktree + branch** (suggested: `int-1-shadow-packet`).
**Spec of record:** `docs/PACKETS.md` → ACTIVE → INT arc → INT-1 (on conflict, PACKETS wins). Context:
`docs/RUNG1_CONVERGENCE_PLAN.md` (ADOPTED 2026-07-03) §3 — this is its "Phase 2: control layer first,
richness later."

## Mission — ONE bounded packet

Build the typed **IntentPacket** as a *shadow observer*: every free-text player turn gets exactly one
packet, assembled purely from detectors that ALREADY exist — and **nothing about the game's behavior
changes**. No routing changes. No LLM call (that is INT-2). No detector rewrites or deletions (that is
INT-3). This packet exists so the packet's shape can be trusted before anything consumes it.

Why it matters (plain English): the engine currently re-derives "what did the player mean" with scattered
pattern-matchers on every path, and a month of gate history proves patching them one at a time never ends.
Step one of the fix is a single, typed, testable summary of player intent per turn — watching silently
until it has earned authority.

## Step 0 — self-assemble (FIRST, before any edit)

```
pwd && git status --short && git log --oneline -6
```
Then read (current repo state wins over this brief's memory):
- `docs/PACKETS.md` — the INT arc header + INT-1 packet (objective/allowed/forbidden/done-when).
- `docs/IMMORTAL_INVARIANTS.md` + `CLAUDE.md` (Core Contracts / Purity Rules) — authoritative, inviolable.
- `engine/intent/intentSchema.js` (the Intent shape + `makeIntent`), `engine/intent/parseIntent.js`
  (deterministic text→Intent), `engine/intent/intentFromClick.js` (a caller you must not break).
- `engine/grace/answerability.js` — `directQuestionIntent` (typed question kinds: rules | self |
  npc-addressed | place | object | referent-followup).
- `engine/llmPhysics.js` — `detectPhysicalInteraction` (scene-object matches).
- `engine/playloop.js:613` `playerMove(world, packsById, text)` — the free-text turn entry.
- `engine/instrument.js` — the trace channel the shadow packet rides.

## The work

1. **Extend the schema ADDITIVELY** (`engine/intent/intentSchema.js`): `makeIntent` gains optional
   `targets: []` (entity ids), `objects: []` (scene-object names/ids), `compoundParts: []` (sub-asks of a
   multi-part utterance), `ambiguity: null | 'target' | 'object' | 'goal' | 'referent'`, `kind: null |
   <directQuestionIntent kind>`. All default to empty/null; every existing caller (`parseIntent`,
   `intentFromClick`) keeps working unmodified. Do NOT rename or repurpose existing fields (`verb`,
   `target`, `at`, `with`, `approach`, `stake`, `text`, `source`, `confidence`).
2. **New assembler** `engine/intent/assemblePacket.js`: a PURE function `(world, text) → IntentPacket`
   that AGGREGATES existing detectors — it writes **no new regexes** and re-implements nothing:
   - `parseIntent` → baseline `verb/target/with/approach/stake/confidence`;
   - `directQuestionIntent(text, world)` → `kind` (and `ambiguity:'referent'` when that's what it signals);
   - `detectPhysicalInteraction(world, text)` → `objects[]`;
   - a simple split on sentence/`and` seams for `compoundParts[]` is allowed ONLY if an existing compound
     helper isn't importable — check `gracefulAdjudication.js` (the C1 fold logic) first.
   Each field's source detector is named in a one-line comment. No rng, no Date, no state writes: calling
   it twice with the same `(world, text)` returns deep-equal packets.
3. **One shadow call-site** at the top of the free-text path in `playerMove` (`engine/playloop.js:613`):
   compute the packet, hand it to an `engine/instrument.js` trace hook. Surface it on the turn output
   ONLY behind `INTENT_TRACE=1` (env, default OFF). With the flag off, every byte of player-visible
   output — narration, mechanics line, world state — is identical to before this packet.
4. **Tests** (allocate numbers with `scripts/next-test-number.sh U` — never guess): a table-driven
   utterance→expected-fields test, LLM-OFF, on the `tallow` start, covering at least:
   - "Who lit that lantern, Elske?" → `kind:'npc-addressed'`, verb stays non-mechanical;
   - "I stab the goblin" → `verb:'attack'`;
   - "I search the wooden table" → `objects[]` includes the table;
   - "what's my name and HP?" → `compoundParts.length ≥ 2`;
   - purity: same `(world, text)` twice → deep-equal packet;
   - flag OFF → `playerMove` output deep-equals the packet-less output (guard the zero-diff promise).

## Invariants — by reference (do not weaken any assertion)

`docs/IMMORTAL_INVARIANTS.md` in full. Specifically load-bearing here: `rng.js` sole randomness (the
assembler uses none); no state mutation outside `effectsCore.applyDeltas` (the assembler mutates nothing);
`worldHash` replay equality (U19/21/22/27/30 stay green); **no `WORLD_VERSION` change** (the packet is not
persisted world state in this packet); ledger/dialogue caps untouched. Never replace a failing assertion
with a weaker one.

## Verification ladder → done-when

`node --test` fully green · `npm run convergence` **100%** · determinism gates green ·
`npm run playtest:quick` 0 crashes/0 bugs · `npm run check` green · with `INTENT_TRACE=1`, a playtest turn
shows exactly one packet per free-text input; with it off, zero output diffs.

## Landing contract

Commit ON YOUR WORKTREE BRANCH only (authorized by this brief), atomic, staged **by path** —
`feat(intent): INT-1 — typed IntentPacket shadow assembler (zero behavior change)`. **Never push to or
merge `v2-polish`; never `git add -A`.** Basecamp verifies and lands. No paid gate (`dm-playtest.mjs`) —
this packet's proof is the deterministic ladder. No version bump (the feature is dark until INT-2).
Make all judgment calls yourself; if genuinely forked, take the reversible option and flag it under
"Residual risk" in your report. End your report with a plain-English paragraph for Tim: what was broken,
what changed, why it matters — jargon translated.

## Out of scope (hard)

Routing/behavior changes · any LLM call or provider wiring (INT-2) · retiring/rewriting detectors (INT-3)
· new detection regexes · `WORLD_VERSION` / persisted state shape · `public/` UI · anything not in
PACKETS.md INT-1 `allowed_files` (`engine/intent/*`, the one playloop call-site, `engine/instrument.js`
trace field, new tests).
