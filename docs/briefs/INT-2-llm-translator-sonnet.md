# INT-2 (Sonnet lane) — the LLM takes the seat (`source:'llm'`) + the translator benchmark

**Model:** Claude Sonnet. **Serial lane** — this packet extends the INT-1 seam in `engine/playloop.js`
(hot file) and touches `server/llmProvider.js`/`server/localLlmProvider.js`; no other worker may be on
playloop/grace/server-provider files while it runs. **Worktree + branch** (suggested:
`int-2-llm-translator`). **Prerequisite: INT-1 is landed on `v2-polish`** (commit `57b878c`,
`engine/intent/assemblePacket.js` + the shadow call-site in `playerMove`) — build on top of it, don't
re-derive it.
**Spec of record:** `docs/PACKETS.md` → ACTIVE → INT arc → INT-2 (on conflict, PACKETS wins). Context:
`docs/RUNG1_CONVERGENCE_PLAN.md` (ADOPTED 2026-07-03) §3, `docs/LOCAL_LLM.md` (provider-chain contract),
`docs/RUNG1_QUEUE.md` (queue history — the DM_TEST_DEADEND family this arc is closing).

## Mission — ONE bounded packet

INT-1 built a *shadow* packet: a pure, deterministic function aggregates existing detectors into one
typed `IntentPacket`, watched but never acted on. INT-2 gives the packet a second, optional source: when
the deterministic parse is unclassified or low-confidence, a **server-side** LLM call proposes the same
packet shape instead of guessing with more regexes. The engine then **deterministically grounds** that
proposal — every id it names must resolve against the real scene bundle, or it's rejected outright. This
packet does NOT change what the game does with a resolved intent (that's INT-3); it only changes *how the
packet gets filled in* when the deterministic floor comes up empty.

Why it matters (plain English): today, when the player says something the pattern-matchers don't
recognize, the DM either mis-fires a mechanic or stonewalls the player (the "DM_TEST_DEADEND" bug family
that's dominated the last several playtest gates). An LLM is much better at "what did they mean" than any
hand-written regex — but it must never be trusted to invent facts or act directly. This packet lets the
LLM *fill in the packet*, while the deterministic engine still checks every claim against what's actually
in the scene before anything is allowed to use it.

## Step 0 — self-assemble (FIRST, before any edit)

```
pwd && git status --short && git log --oneline -6
```
Confirm you're building on `57b878c` (INT-1) or later. Then read (current repo state wins over this
brief's memory):
- `docs/PACKETS.md` — the INT arc header + INT-2 packet (objective/allowed/forbidden/done-when).
- `docs/IMMORTAL_INVARIANTS.md` + `CLAUDE.md` (Core Contracts / Purity Rules, especially **rule 9: browser
  never sees the API key** — this is the load-bearing constraint of this whole packet, read the next
  section before writing any code).
- `engine/intent/assemblePacket.js`, `engine/intent/intentSchema.js`, `engine/intent/parseIntent.js` — the
  packet you're extending.
- `engine/playloop.js` around the INT-1 seam (`assemblePacket` call inside `playerMove`) and
  `engine/instrument.js` (`traceIntentPacket`).
- `server/llmProvider.js` (`chatCompletion`, `detectProvider`, `hasLlmKey`) and
  `server/localLlmProvider.js` (`queryLocal`, Ollama chain) — the provider abstraction you'll call through.
- `server.js` — the `/api/move` route (~line 493) that currently calls `playerMove` synchronously for the
  logged-in web client.
- `public/v1.js` — grep for `playerMove(` (it is called directly here too, client-side).
- `docs/LOCAL_LLM.md` — the provider-chain contract (Anthropic → Ollama → deterministic floor) and the
  existing "layers never decide, never mutate, never throw" table — this packet is a new row in that
  table, follow its shape.
- `engine/csl/` (skim, don't deep-read) — check whether an existing event/log mechanism can carry a
  turn's chosen packet for replay without a `WORLD_VERSION`-shape change (see "Replay" below).

## THE HARD CONSTRAINT — read this before touching any file

`engine/playloop.js` is imported by **both** `server.js` (Node/Express, has `process.env.ANTHROPIC_API_KEY`)
**and** `public/v1.js` (served to and executed in the browser). **`playerMove` and `assemblePacket` must
stay callable, synchronous, and side-effect-free from the browser path exactly as they are today.** Do
**not** add a live network call, a `chatCompletion` import, or any async LLM step inside
`engine/playloop.js` or `engine/intent/assemblePacket.js` — if that code ships to the browser bundle, you
either leak key-check logic to the client or (worse) someone later wires a real key through and the
browser calls Anthropic directly. Neither is acceptable under Purity Rule 9.

**The seam:** the LLM proposal step is **server-only**. It runs in `server.js`'s `/api/move` handler,
*before* `playerMove` is called — the same place that already special-cases meta-questions
(`isMetaQuestion`) ahead of the engine call. Give `playerMove` one new **optional** parameter so its
default (no 4th arg) signature and behavior are byte-identical to today:

```js
// engine/playloop.js
export function playerMove(world, packsById, text, { llmPacket } = {}) { ... }
```

When `llmPacket` is provided (only ever passed by `server.js`, only ever after grounding — see below), the
free-text path uses it in place of calling `assemblePacket` itself. When omitted (every browser call, and
every server call where the deterministic floor already classified confidently, or the key/Ollama are
absent), behavior is **exactly** today's INT-1 shadow path — `assemblePacket` runs as it does now. This is
the reversible option if you hit a fork here: an optional trailing param that defaults to "do nothing
different" beats any design that makes `playerMove` async or moves the call into shared code.

If you find a materially better seam after reading the code (e.g. Express route already has a natural
async pre-step you can hook cleaner), you may deviate — but the invariant above (no LLM code path reachable
from `public/v1.js`'s `playerMove` import) is non-negotiable. Flag any deviation under "Residual risk" in
your report.

## The work

1. **`engine/intent/llmIntent.js`** (new, server-only module — never imported by `playloop.js` or anything
   `public/v1.js` pulls in): exports an async `proposeIntentViaLlm(world, text, bundle)` that:
   - Only fires when the deterministic packet (from `assemblePacket`) is unclassified or low-confidence.
     Define the threshold from what `parseIntent` already emits (see `confidence` values in
     `parseIntent.js` — e.g. the `verb:'ask'` fallback paths at confidence 0.2/0.4) — don't invent a new
     scale, reuse the existing 0–1 range.
   - Builds a **compact scene bundle** (current node, visible NPCs/objects/enemies by id+name, party
     abilities/spells/items — same candidate universe `assemblePacket`'s `buildParseCtx` already gathers,
     reuse it, don't rebuild it) and sends utterance + bundle to the LLM via `server/llmProvider.js`'s
     `chatCompletion`, **temperature 0**, asking for the same `IntentPacket` shape back as strict JSON
     (no prose, no markdown fences — parse defensively, catch and treat any parse failure as a silent
     miss, never throw).
   - Provider chain per `docs/LOCAL_LLM.md`: try Anthropic (`chatCompletion`) first; on any failure/absent
     key, try Ollama (`server/localLlmProvider.js` `queryLocal`) with the same prompt+schema; if both are
     unavailable, return `null` — the caller falls back to the deterministic floor. **Never throws.**
   - Returns the raw LLM-proposed packet fields (or `null`) — grounding happens next, separately, so the
     validation logic is unit-testable without a network call.
2. **Deterministic grounding** (same file or a sibling `engine/intent/groundPacket.js` — your call, keep
   it small): a pure function that takes the LLM's proposed packet + the scene bundle and:
   - Rejects (drops to `null`/empty) any `target`/`targets[]`/`objects[]` entry whose id/name doesn't
     resolve against the bundle's real candidate set. **An invented id is a hard reject of that field, not
     a warning** — this is the `V12-13 secret-leakage`/`invented-ID` failure mode the benchmark measures.
   - Marks the resulting packet `source:'llm'` only if it survived grounding with at least the verb intact;
     otherwise falls back to the deterministic packet untouched (`source:'text'`/`'click'` as today).
   - Never mutates world state, never rolls dice, never decides an outcome — it only fills in the *packet*.
     Routing on `kind`/`verb` stays exactly as it is until INT-3.
3. **One server-side call-site** in `server.js`'s `/api/move` handler: after the existing meta-question
   short-circuit and before `playerMove`, if a key or Ollama is available AND the deterministic packet
   (compute it once — you may need to expose `assemblePacket` or replicate its confidence check cheaply)
   is unclassified/low-confidence, `await proposeIntentViaLlm(...)`, ground it, and if it survives, pass
   `{ llmPacket }` into `playerMove`. **Never block the turn** — wrap in try/catch, on any error or timeout
   fall through to calling `playerMove` with no override (today's path). Budget a short timeout (reuse the
   pattern in `server/localLlmProvider.js`'s `AbortController`, ~3-5s) so a slow/hung call can't stall a
   turn indefinitely.
4. **Replay — bounded scope.** The full spec asks for the committed packet to ride the turn log so replay
   never re-calls the LLM. Investigate `engine/csl/` for a zero-risk way to append the chosen packet
   (particularly its `source` and grounded fields) to an existing per-turn log entry **without** changing
   `WORLD_VERSION` or any hashed world-state shape. If a clean append point exists, wire it. If it would
   require a state-shape change or is genuinely ambiguous, **do not force it** — ship INT-2 without full
   replay-of-LLM-packets, note it as a named gap in "Residual risk," and leave a one-line TODO pointing at
   a follow-up packet. The two invariants that are NOT optional and must hold regardless: (a) with no key
   and no Ollama, behavior is provably identical to INT-1 (the deterministic floor always still runs); (b)
   no ungrounded id ever reaches `playerMove` labeled `source:'llm'`.
5. **The benchmark** (`scripts/intent-eval.mjs`, new): scores ANY backend against a frozen
   utterance→packet corpus. Seed the corpus from real failing turns in the gate history — pull concrete
   examples from `docs/RUNG1_QUEUE.md`'s gate logs and `docs/playtests/` (e.g. "who lit that lantern,
   Elske?", "what's my name and HP?", "I take him out", "I use the table", "I stab the goblin by the
   door", "I teleport through the wall" — the memo's own table, cited in PACKETS.md INT-2). Store the
   corpus as a small JSON/JS fixture under `tests/corpus/` (allowed_files). For each backend (Anthropic
   fast tier, local Ollama if available, and the parser-only baseline / `parseIntent` alone) report:
   packet-match %, invented-id count (**>0 on any backend is a hard fail line in the report**, not a
   average-away metric), clarify precision/rate, latency. Write the report to `docs/playtests/` (new file,
   dated). **Budget discipline: this hits the real `.env` Anthropic key** — run the smallest corpus that's
   still meaningful (aim for 15-30 utterances, not hundreds), and note the request count + rough $ cost in
   your final report per `docs/BUILD_BUDGET.md`. Do not loop/retry against the API on failures.
6. **Tests** (allocate numbers with `scripts/next-test-number.sh U` — never guess): unit tests for
   grounding (invented id rejected; valid id survives; no-key/no-Ollama falls back to deterministic
   untouched; malformed LLM JSON is swallowed, never throrws) — all with a fake/mocked `fetchImpl`, **no
   real network calls in `node --test`**. A `playerMove(world, packs, text)` call with no 4th argument
   must be provably identical output to pre-INT-2 (same guard style as INT-1's flag-off test). The
   benchmark script itself is exercised separately (see step 5), not part of `node --test`.

## Invariants — by reference (do not weaken any assertion)

`docs/IMMORTAL_INVARIANTS.md` in full. Specifically load-bearing here: **Purity Rule 9 (browser never sees
the key)** — the single most important constraint in this packet, verify it by grepping the diff for any
new import of `llmProvider`/`chatCompletion`/`llmIntent` from `playloop.js` or anything reachable from
`public/v1.js`'s import graph, and confirm there are none; **rng.js sole randomness** (grounding/proposal
code uses none — LLM temperature-0 nondeterminism is expected and fine, it's not `rng.js`, but nothing
here should read `Math.random()`); **no direct state writes** (grounding/proposal never call
`applyDeltas` or touch world fields); **LLM layer never throws** (wrap every LLM call site); **worldHash
replay equality** stays green — you are not changing persisted world shape (see the bounded replay note in
step 4); **no new contract enum** — the LLM proposes packets using intentSchema's existing verb vocabulary,
never a new parallel enum.

## Verification ladder → done-when

`node --test` fully green (no real network calls in the suite — mock `fetchImpl` everywhere) ·
`npm run convergence` **100%** unchanged from the INT-1 baseline · determinism gates green ·
`npm run playtest:quick` 0 crashes/0 bugs · `npm run check` green · with no `ANTHROPIC_API_KEY` and no
Ollama running, a manual playtest turn behaves identically to the INT-1 baseline (paste a before/after
diff of the turn output in your report) · the benchmark report is committed under `docs/playtests/` with
≥3 backends scored and 0 invented-ids reported as the headline pass/fail line, not buried.

## Landing contract

Commit ON YOUR WORKTREE BRANCH only (authorized by this brief), atomic, staged **by path** —
`feat(intent): INT-2 — LLM-proposed packets, server-side, deterministically grounded`. **Never push to or
merge `v2-polish`; never `git add -A`.** Basecamp verifies and lands. No paid gate (`dm-playtest.mjs`) —
this packet's proof is the deterministic ladder + the intent-eval benchmark (which does spend real
`.env` budget — keep it small, per step 5). No version bump (the feature is dark/off by default — it only
activates when a key or Ollama is present AND the deterministic floor is already low-confidence; report
whether you consider that "dark" or "quietly live" and let Basecamp make the call if it's a fork).
Make all judgment calls yourself; if genuinely forked, take the reversible option and flag it under
"Residual risk" in your report. End your report with a plain-English paragraph for Tim: what was broken,
what changed, why it matters — jargon translated.

## Out of scope (hard)

Routing/behavior changes based on `kind`/`verb`/`ambiguity` (that's INT-3) · retiring/rewriting any
existing detector · a new contract/verb enum · `WORLD_VERSION` or persisted world-shape changes ·
`public/` UI changes · the LLM deciding an outcome, rolling a die, or mutating state · blocking a turn on
LLM latency/failure · large/expensive benchmark runs · anything not in PACKETS.md INT-2 `allowed_files`
(`engine/intent/*`; `server/llmProvider.js` + `server/localLlmProvider.js` — one new task route; the one
`server.js` call-site added by this packet — a necessary amendment to PACKETS.md's listed files since the
LLM call cannot live in `playloop.js` itself, flag this amendment in your report; the INT-1 seam in
`engine/playloop.js`; new `scripts/intent-eval.mjs`; `tests/corpus/*` additions; `.env.example`; new tests).
