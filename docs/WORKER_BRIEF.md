# Worker Brief — the self-assembling task template

**What this is.** The single template Basecamp fills to brief a worker (Codex / Claude / another window) on
ONE packet, and that a worker can also run cold. It is **self-assembling**: the worker's first move is to
gather the *current* repo artifacts (Step 0), so the brief never goes stale. Basecamp produces a filled copy
from a loose or blank Tim ask — see `docs/BASECAMP.md` → "Prompt assembly."

**Authority & anti-drift.** The invariant docs are authoritative and loaded **by reference** — never copied
into a brief (two copies = drift, per `docs/AGENT_PROTOCOL.md`). If a brief and a canonical doc disagree,
the canonical doc wins.

**How to use.**
- *Basecamp:* fill the `{{SLOTS}}`, keep the rest verbatim, emit paste-ready — or inline the Step-0 artifacts
  if the target window has no repo access — or dispatch per Worker routing.
- *Worker:* do Step 0 first; do not edit until a code path is verified; never commit unless Tim says
  `LAND`/`COMMIT`; never run the paid gate without approval.

---

## ▼ BEGIN BRIEF (everything below is the paste-ready prompt)

**Role & altitude.** You are working the **{{TRACK — e.g. narration-quality track | scoped packet H-##}}**
of the Immortal Engine (branch `{{BRANCH — usually v2-polish}}`). {{Fresh cold-start | continuation}};
target model **{{MODEL — e.g. Opus 4.8}}**. You are solving **judgment-under-constraints, not
task-completion** — a patch that crosses a layer boundary is a failure even if every test passes.

**Autonomy (controlling).**
- Inspect freely, run free deterministic commands, create/modify tests, make the minimal verified edit.
- **Never commit unless Tim says `LAND` or `COMMIT`.** On `LAND`: atomic commit *by path*, only after the
  verification ladder (below) is green. Never `git add -A` with unrelated changes present.
- **Never run the paid gate** (`node scripts/dm-playtest.mjs`, ~$2.8/run) without explicit approval.
- If the fix needs canon / state / RNG / deltas / event-log / `effectsCore` semantics → **STOP** and write a
  scoped-packet proposal instead of editing.
- **Decision policy (controlling).** Make ALL judgment calls yourself — never route a question back to Tim
  mid-run (he is not a coder and is usually away; a question back to him is a stalled lane). If genuinely
  blocked between options, take the reversible one and flag it under "Residual risk". New test numbers come
  from `scripts/next-test-number.sh <prefix>` — never guessed.

**Step 0 — self-assemble (do this FIRST; do not skip).** Run and paste:
```
pwd && git status --short && git log --oneline -6 && find . -maxdepth 4 -type f \( -name "package.json" -o -name "CLAUDE.md" -o -name "IMMORTAL_INVARIANTS.md" -o -name "THE_DM_TEST.md" -o -name "THE_REF.md" -o -name "CAPABILITY_LEDGER.md" -o -name "*corpus*.mjs" -o -name "opus-gate-*.md" \) | sort
```
Then load the **current** artifacts (trust the repo, not this template's memory):
1. **Invariants — authoritative, inviolable.** Read `docs/IMMORTAL_INVARIANTS.md`, `docs/THE_DM_TEST.md`,
   and `CLAUDE.md` (Core Contracts / Purity Rules). Load-bearing summary (the files win): narration ≠ canon
   (the narration layer touches **words only** — no mechanics/deltas/Canon-Log/RNG); determinism rails
   (`engine/rng.js` sole randomness; mutation only via `engine/effectsCore.applyDeltas`; `worldHash` stable
   under replay; tests **U19/U21/U22/U27/U30** are the tripwires); the LLM is **never** runtime authority
   over canon; the LLM layer **never throws** — silent fallback to base narration.
2. **Track context.** `docs/THE_REF.md` (narration plan + failure taxonomy) + `docs/CAPABILITY_LEDGER.md`
   (the finite C-list + the latest dated gate findings).
3. **Real failures.** Open the newest `docs/playtests/opus-gate-*.md` (the bare-date filename is the latest;
   suffixed ones are older). Pull 2–3 transcripts relevant to the packet: *player input → DM output → judge
   reason*.
4. **Lock format.** Open the `tests/corpus/C#.corpus.mjs` matching the packet's capability for the case shape
   (`status:'locked'`, `fixture`, `paraphrases` ≥5, `assert.surface_matches/excludes`, `diverge`).
5. **Golden trajectory.** Read the most recent DONE entry in `docs/AGENT_CHANGELOG.md` — a real
   reproduce→fix→lock→verify→commit example to mirror.
6. **Commands.** Confirm from `package.json`: `npm run convergence` (free regression, must stay 100%),
   `node --test` (full suite + determinism), `npm run dev` (server :5179, needed for the gate), `node
   scripts/dm-playtest.mjs` (PAID gate — ask first).

If a required artifact is missing → **STOP**, list it under "Missing artifacts," do not invent it.

**The packet.**
{{PACKET — the specific failure/goal. If Tim's ask was loose, Basecamp's inferred interpretation goes here in
ONE line, followed by: "Redirect instantly if this isn't what you meant."}}

**Operating loop.**
1. Investigate before editing — read the exact code lines (never guess file/line).
2. Identify the layer; generate ≥2 competing root-cause hypotheses (optimize for coverage first, filter after
   evidence — surface even low-confidence causes).
3. Reproduce with the **smallest free** command (LLM-off repro / `npm run convergence` / `node --test`).
4. Patch **minimally** — words/selection/routing only (for the narration track).
5. Lock with a corpus/paraphrase case (≥5 paraphrases + `diverge` negatives proving over-fire safety).
6. Verify ladder: targeted test → `npm run convergence` → `node --test` (determinism tripwires) — all green.
7. **Ask before any paid gate.** Prefer free signals.
8. Commit atomically by path **only on `LAND`**.

**Decision rubric.**
- **Tier 0/1** (deterministic; may land after verification + `LAND`): reproducible LLM-off; cause is
  parser/intent/narration routing; lockable with corpus tests; patch touches words/selection/routing only;
  determinism tripwires stay green.
- **Tier 2** (LLM-judge / taste): depends on fuzzy narration quality; multiple plausible phrasings; free
  tests can't separate good from bad output. **Propose; don't free-land.**
- **Defer to a scoped packet:** needs canon/state/RNG/effects/event-log changes, a broad refactor, a layer
  crossing, new product policy, or can't be proven with current tests/artifacts.
- **Anti-kick-back:** bias HARD toward resolving intent in the fiction; bounces/clarifications are rare,
  in-character, specific. A fix that increases generic "what do you want to do?" bounces is probably wrong.

**Forbidden.** Touching canon/state/RNG/deltas/event-log/`effectsCore` unless scoped + verified + approved ·
over-indexing the noisy paid-gate % (trust the free corpus + the new-capability discovery rate) · defaulting
to kick-backs/menus · broad refactors / speculative abstractions · inventing files/APIs/commands/behavior ·
silently weakening or deleting a test.

**Done-when.** Relevant corpus green · determinism tripwires green · `npm run convergence` 100% · full suite
green · no new capability regressions · residual failures style-only, not dead-ends · measurement honesty
preserved (report what the *free* signals prove, separately from the noisy gate) · **player-visible changes
self-playtested through live `v1.html`** (per `docs/PLAYTEST_PROTOCOL.md`) — a report without playtest
evidence is not DONE; Tim must never be handed a broken game to discover the break himself.

**Output contract (every response).**
```
PROGRESS: -10..10
What was wrong:
What changed:
What proved it:     (exact commands + pass counts)
Files changed:
Tests run:
Residual risk:
Rollback plan:
Plain English (for Tim): <one short jargon-free paragraph — what was broken, what changed, why it matters>
```

**Missing artifacts:** {{none — or the exact list to locate/request before editing}}

## ▲ END BRIEF
