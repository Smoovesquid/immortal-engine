# INT-2R (Sonnet lane) — course correction: the LLM becomes the ACTUAL primary ears, Ollama first

**Model:** Claude Sonnet. **Serial lane** (touches `engine/playloop.js`, `server.js`, `public/v1.js` — no
parallel worker on these). **Worktree branch** (suggested: `int-2r-ollama-ears`). **Spec of record:**
`docs/PACKETS.md` → INT arc → INT-2 objective ("the LLM is the **PRIMARY reader of all typed/spoken free
text**… no confidence-gated regex pre-filter") + this brief. The original
`docs/briefs/INT-2-llm-translator-sonnet.md` is **superseded** — it drifted from the spec (it said
"only fires when the deterministic packet is low-confidence"), and the build faithfully implemented the
drift. Tim's standing order 2026-07-03: **the local Ollama model is the PRIMARY ears.**

## What is wrong today (audited 2026-07-03, commits `57b878c..b3d600e`)

1. **The live game never asks the LLM anything.** `public/v1.js` imports `playerMove` and runs the engine
   in-browser (`v1.js:722, :737`) with no 4th argument. The LLM seat exists only in `server.js`'s
   `/api/move` handler (`server.js:527-556`) — a route v1 does not call. Wrong door.
2. **The seat is gated by the vetoed design.** `server.js:544-548` fires the proposal only when
   `isLowConfidencePacket(detPacket)` — regex-primary, LLM-secondary. The spec explicitly forbids this.
3. **Even a produced packet is decorative.** `engine/playloop.js:638-656`: `playerMove` selects
   `__intentPacket` (the LLM packet when supplied) but passes only the deterministically-computed
   `__dqIntent` into `playerMoveTraced`. The comment admits it: the packet "only swaps which packet gets
   traced." The INT-3/4a/4b consumers therefore run on the deterministic verdict on every turn.
4. **Provider order is inverted vs Tim's ruling.** `engine/intent/llmIntent.js:149-155` tries Anthropic
   first, Ollama on failure. Tim ruled: **Ollama primary** (local, free, always-on), Anthropic fallback.
5. **The local model scored 0% in the committed benchmark**
   (`docs/playtests/intent-eval-2026-07-03T15-11-38-707Z.md`) — llama3.1:8b returned valid JSON but
   non-canonical verbs ("stab"), which `makeIntent` coerces to `'ask'`. Fixable: harder prompt + Ollama
   JSON-format mode + a deterministic verb-synonym normalization at grounding.
6. **The Anthropic fallback is silently broken by default**: `server/llmProvider.js`'s hardcoded
   `ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-20250514'` 404s unless `LLM_MODEL` is set (documented in
   the benchmark report). One-constant fix, in scope because it gates the fallback ear.

What is SOUND and must not be re-broken: INT-1's assembler + trace, `groundPacket`'s hard rejection of
invented ids, the never-throws/silent-fallback discipline, `INTENT_LLM=off` = zero provider calls (U377),
and the INT-3/4a/4b single-shared-verdict refactors (they consume ONE verdict — the fix is to let a
grounded LLM packet BE that verdict, not to add a second path).

## Step 0 — self-assemble

`git status --short && git log --oneline -8`. Read: `docs/PACKETS.md` INT section;
`docs/IMMORTAL_INVARIANTS.md`; `CLAUDE.md` Purity Rules (esp. 9 — browser never sees a key);
`engine/intent/*.js` (all six files); `server.js:490-560`; `server/localLlmProvider.js`;
`server/llmProvider.js` (model default + `chatCompletion`); `public/v1.js:200-230` (the `/api/narrate`
fetch pattern to mirror) and `:700-745` (the turn submit path); `tests/U376*`, `tests/U377*`,
`tests/corpus/intentEvalCorpus.mjs`; the benchmark report above.

## The fix — five moves

1. **Ollama first.** In `llmIntent.js`, reorder: `tryOllama` → `tryAnthropic`. Extend `INTENT_LLM` to
   `off | ollama | anthropic | auto` (empty/unset = `auto` = Ollama→Anthropic). `off` keeps U377's
   zero-outbound-calls guarantee. Update `.env.example`.
2. **Kill the confidence gate.** In `server.js` `/api/move` AND the new endpoint (move 3): every typed
   free-text turn requests translation — no `isLowConfidencePacket` precondition (keep the function
   exported for tests/telemetry; it is no longer a gate). Structural bypasses only: empty text, the
   click/journey step path (`source:'click'`), and (optional) a literal exact-match micro-set (bare
   `north`/`look` etc.) if one already exists — do not invent new pattern-matching.
3. **Put the ears on the live door.** New `POST /api/intent` in `server.js`, mirroring the `/api/narrate`
   registration (`server.js:138`) — body `{ text, bundle }` where `bundle` is the candidate ctx the
   CLIENT computes via `buildParseCtx(world)` (browser-safe import; the key-bearing `llmIntent.js` stays
   server-only per its header). Server: propose via `proposeIntentViaLlm(null, text, bundle)` →
   `groundPacket(proposed, bundle)` → return `{ ok, packet: grounded|null }`. In `public/v1.js`'s typed-
   turn path (~`:737`): `await` a fetch to `/api/intent` with an AbortController budget ≤ **2800ms**;
   on ok+packet pass `{ llmPacket: packet }` into the local `playerMove`; on ANY failure/timeout/offline
   call `playerMove` exactly as today (deterministic floor — the game must run with the server down).
   The multi-step journey loop (`v1.js:722`) stays packet-less (it feeds synthesized commands).
4. **Make the packet drive the turn.** In `playerMove` (`playloop.js:638-656`): when
   `useLlmPacket` is true, derive the shared verdict FROM the grounded packet — construct the
   `__dqIntent`-shaped verdict from `packet.kind` + grounded referents when `packet.kind` is non-null,
   falling through to `directQuestionIntent(text, world)` when the packet carries no question-kind; pass
   THAT into `playerMoveTraced` so the already-graduated consumers (INT-3 egress, INT-4a referent, INT-4b
   dialogue-address) obey the LLM's grounded reading. Verify field-compatibility by reading what
   `playerMoveTraced`/`applyEgressRepair` actually consume from `__dqIntent` — map every consumed field,
   never guess. Do NOT re-plumb verb-routing beyond this seam (that is INT-4c+, out of scope).
5. **Make llama3.1:8b a real translator.**
   - `server/localLlmProvider.js` / `queryLocal` call for this lane: Ollama `format: 'json'` (JSON mode),
     `options.temperature: 0`, `options.num_predict ≤ 160`, keep-alive as-is.
   - Prompt (shared builder in `llmIntent.js`): enumerate the 10 canonical verbs EXPLICITLY as the only
     legal `verb` values, add 2–3 few-shot pairs (utterance → exact JSON), keep the never-invent-ids and
     null-over-guess rules verbatim.
   - Grounding (`groundPacket.js`): before `makeIntent` coerces an unknown verb to `'ask'`, normalize the
     proposed verb through `parseIntent.js`'s existing `VERB_SYNONYMS` table (export it; do NOT create a
     second vocabulary) — "stab" → `attack`. Grounding still hard-rejects unknown ids; nothing ungrounded
     may pass.
   - Fix `server/llmProvider.js`'s default model constant to a live id (match `engine/llmAdapter.js`'s
     working default) so the Anthropic fallback works without `LLM_MODEL`.

## Tests & proof

- Update `U376` (grounding: add verb-synonym normalization cases) and `U377` (`INTENT_LLM=off` → zero
  outbound calls — must still pass; add `INTENT_LLM=anthropic|ollama` order assertions with injected
  `fetchImpl` mocks; no real network in `node --test`).
- New unit: provider ORDER (mock both providers; assert Ollama consulted first under `auto`); the gate is
  gone (a high-confidence sentence still triggers a proposal request at the server seam); `/api/intent`
  returns a grounded packet and never 500s on provider failure; v1-path fallback contract (endpoint
  handler unit-level — browser automation not required).
- **Re-run `node scripts/intent-eval.mjs`** (network, outside `node --test`) with the hardened prompt;
  commit the new report to `docs/playtests/`. Bar: Ollama packet-match **must beat the 66.7%
  parser-only baseline**; report the honest number either way (Tim has ruled Ollama primary regardless —
  the number tells us what to tune next, and misses degrade safely to the floor).
- **Live proof:** dev server + `INTENT_TRACE=1`, type "I stab the goblin" (a sentence the regex parses
  CONFIDENTLY) through real v1 — the trace must show the packet arriving `source:'llm'`, proving both the
  ungating and the live-door wiring. Screenshot or paste the trace line in the report.
- Full ladder: `node --test` green · `npm run convergence` 100% · determinism U19/21/22/27/30 green
  (they call the engine directly, no llmPacket — must be untouched) · `npm run playtest:quick` clean ·
  `npm run check` green.

## Invariants — by reference (do not weaken)

`docs/IMMORTAL_INVARIANTS.md` in full. Load-bearing: LLM proposes, engine grounds/validates/rolls/commits
— no ungrounded referent may reach resolution; browser never sees a key (`llmIntent.js` stays out of the
v1 import graph — the browser talks ONLY to `/api/intent`); LLM layer never throws/never blocks a turn;
`rng.js` sole randomness; no `WORLD_VERSION` bump; no canon/event-log shape change; no new contract enum.

## Landing contract

Commit on the worktree branch, atomic, staged by path:
`fix(intent): INT-2R — LLM primary ears on the live path, Ollama-first, packet drives the verdict`.
**Version bump required** (this changes the live build): `package.json` minor (`0.26.x` → `0.27.0`) +
`public/v1.js` header title + build line (increment counter, today's date, label like "Ollama ears").
Never push; never touch `v2-polish`; Basecamp verifies + lands. Budget note: Ollama is free; the eval run
may spend ≲$0.05 Anthropic — authorized; no paid Opus gate. Make all judgment calls yourself; flag
reversible forks under "Residual risk". End with a plain-English paragraph for Tim: what was broken, what
changed, why it matters.
