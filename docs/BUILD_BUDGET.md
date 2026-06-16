# Build Budget — how Claude governs this build without hitting the wall

*Created 2026-06-16 because Tim is hitting the 5-hour usage cap inside an hour. This is the
operating protocol for spending tokens efficiently. The must-fire rules are mirrored into
`CLAUDE.md` so they load every session; this file holds the detail and the why.*

---

## The reality (verify on your billing page — limits/prices move)

- **Pro (~$20/mo):** the 5-hour rolling cap **doubled on 2026-05-06** (≈45 → ≈90 prompts per
  window), plus a weekly cap.
- **Opus 4.8 IS available on Pro** (confirmed by Tim — some 2026 write-ups citing older Opus
  4.7 policy claimed otherwise; they're stale). So there's no tier mystery: the fast cap is
  simply **Opus eating the Pro window**.
- **Opus burns budget ≈5× faster than Sonnet** — that is the single biggest dial. On Pro,
  running routine work on Opus is what empties the window in an hour. Sonnet-default fixes it.

## Two budgets, kept separate (the key idea)

1. **The subscription window** — spent by *interactive* work with Claude (strategy, building,
   editing, reading output). This is the 5-hour wall.
2. **The API key (`.env`)** — pay-per-token, **no wall**. The automated playtest harness
   (`scripts/dm-playtest.mjs`, the Opus gate) already calls this, not the subscription. So
   **heavy automated testing should run on the API key**, never by hand in an interactive
   session. (Caveat: when Claude *orchestrates* a long test run for you, Claude's own
   reasoning/tool turns still bill to the window even though the harness's LLM calls bill to
   the API. For true marathon/overnight runs, use the headless/API path, not a live session.)

---

## The governing rules (Claude follows these every session)

**Model discipline — the #1 lever.**
- Default to **Sonnet** for mechanical work: file reads, edits, greps, running tests/builds,
  routine wiring, anything where the path is clear.
- Escalate to **Opus** only for genuinely hard reasoning: architecture, design tradeoffs,
  gnarly multi-file debugging, this kind of planning. Drop back to Sonnet after.
- If unsure, it's Sonnet. Most of a build session is not deep reasoning.
- **Listen + suggest (do at the start of each new request):** classify the incoming task and,
  if it mismatches the active model, say so in one line before proceeding — routine work on
  Opus → suggest `/model sonnet`; genuinely hard reasoning on Sonnet → suggest `/model opus`.
  Once per task, no nagging, skip for trivial/conversational turns. Proceed either way.

**Context discipline — every token in context is spent every turn.**
- **Targeted reads only.** Never read a whole large file. In THIS repo that means: NEVER read
  `engine/playloop.js` (~5,700 lines), the bestiary catalogs (`minor/standard/trivial/elite.js`,
  ~3–8k lines each), or the `server/rag/corpus/` files in bulk. Use Grep to locate, then Read
  with `offset`/`limit` for just the span.
- **Prefer Grep/Glob over reading.** Search for the answer; don't load the haystack.
- **Don't re-read what's already in context**, and don't re-read a file just to confirm an
  edit landed (the tool already confirmed it).
- **Batch independent tool calls** into one turn.
- **Keep `CLAUDE.md` lean.** It loads every turn — add a line only if it must fire every
  session; otherwise it goes in a doc that's read on demand.

**Session discipline.**
- **One packet per session** (the repo already works in bounded packets — `docs/PACKETS.md`).
  Small scope = small context = less burn.
- **`/clear` between unrelated tasks**; **`/compact`** when a session gets deep rather than
  letting context balloon. Watch the status-bar %; near 80%, wrap and restart.
- **Don't spawn subagents** unless the task truly needs fan-out — each starts cold and
  re-derives context (expensive). Do it inline.

**Testing discipline (where the big spend hides).**
- Route the **Opus experiential gate** and any large playtest sweep to the **API key**, run
  from the CLI — not interactively, turn by turn, with Claude reading every line.
- Use `node --test` and `npm run playtest:quick` (cheap, deterministic, no LLM) for the
  fast loop; reserve the LLM gate for milestone checks, not every change.
- Make the **experiential gate** the done-when, but don't run it on every tiny edit — it's
  the most expensive thing in the repo.

---

## The per-session ritual (what "governing efficiently" looks like in practice)

1. Open on Sonnet. Load only `CLAUDE.md` + the one packet's named files.
2. Locate with Grep, read narrow, edit small.
3. Verify with `node --test` (cheap) — not with re-reads or the LLM gate.
4. Escalate to Opus only for the hard thinking, then come back down.
5. `/clear` before the next packet.
6. Send the heavy LLM testing to the API key, off the window.

## If the wall is still a problem after all this

The honest fallback (from the subscription conversation): for solo, Opus-heavy, test-the-
shit-out-of-it building, the setup that stops the pain is **Max 20× for interactive work +
the `.env` API key carrying the automated harness + Sonnet for the grunt work.** No
subscription tier, however large, is built for unattended marathon runs — that's the API/
headless path. Park this until the build cadence proves it's needed.

---

**Sources** (2026-06): truefoundry.com/blog/claude-code-limits-explained ·
morphllm.com/claude-code-usage-limits · code.claude.com/docs/en/costs ·
firecrawl.dev/blog/claude-code-token-efficiency · ccforeveryone.com/guides/claude-code-limits-and-pricing
