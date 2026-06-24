# Immortal Basecamp — overnight handover (2026-06-24)

**Paste this whole file (or point the agent at this path) into a fresh window and say "You are Immortal
Basecamp." It carries everything needed to pick up cold and work the remaining FREE/deterministic work
autonomously overnight, then hand Tim a green build + the open decisions for his morning playthrough.**

---

## 0. Role + the prime directive

You are **Immortal Basecamp**, the orchestrator for the Immortal Engine (an AI-narrated, deterministic
tabletop RPG). Read **`docs/BASECAMP.md`** (the full role) and **`CLAUDE.md`** (durable rules — these OVERRIDE
defaults) before touching anything.

**RE-DERIVE STATE FROM GIT FIRST. Never trust this file's state claims.** A worker or another window may share
this exact local checkout and have advanced `HEAD` since this was written. Run, before anything else:
```
git log --oneline -20 && git status --short && git log origin/v2-polish..HEAD --oneline && npm run check
```
Branch is **`v2-polish`** (the mainline). If `npm run check` is not green on arrival, find out why before
building (a worker may have landed something).

**The mandate (overnight, autonomous):** Tim is asleep and will PLAY the demo in the morning. Carry out **all
the remaining FREE / deterministic work** yourself — land it green + pushed — and leave the **open DECISIONS
written up clearly** for him. Do **not** guess Tim's decisions, do **not** build Phase C/D population without
the gating decision, and **do not spend a paid gate while he's away** (no phase will complete tonight; save
gate spend for him).

---

## 1. Where the project is (verify against git; snapshot as of this handover)

**Phase A — COMPLETE + gate-confirmed.** One town is legible end-to-end; the demo region is LOCKED at
`engine/world/demoRegion.DEMO_SEED = 'tallow'` (8 towns, 6 dungeons, fully reachable, biome-bled); §0 holds.

**Phase B — COMPLETE + PROVEN** (the make-or-break talk→quest→consequence→return loop):
- **D-B1 talk→quest** (`engine/goals/proposeGoal.js` + the playloop wiring): a declared intent in conversation
  mints a tracked goal in fiction (no quest-board artifact). Gate-confirmed, zero over-claim.
- **The Lasting Word** — the cannibal-published newspaper (`engine/newspaper/lastingWord.js`, IG-14). A pure,
  deterministic, §0-safe surface: **NP-1** generate (From the Roads / The Forgotten / Kasual Korner with HIDDEN
  ad kinds), **NP-2** reputation-travels (a stranger greets you by your deeds — `playerReputation` in the
  dialogue-enter), **NP-4** read it in-game (`isNewspaperRead`), **NP-3** answer a Kasual Korner ad → the engine
  flips its hidden card (tryst/contract/trap/both — `resolveKasualKornerEncounter`; a contract names the target
  so the player commits via D-B1). Locked by `tests/U249.newspaper.test.js`.
- **D-B3 the moat** (`tests/U250.returnSession.test.js`): play → save → reload is byte-identical (worldHash),
  goals/NPC-memory/deeds/position intact, reputation persists.
- **D-B4 the full-loop gate** (`docs/playtests/opus-gate-2026-06-24.md`): 10/48, **NO regression** (the
  adversarial personas don't walk the loop, so the gate measured robustness; the loop itself is proven by a free
  end-to-end probe + the tests). §0 held.

**The combat lane fix** landed (`d2600e4`, escapeCombat lethal-blows/embedded-attacks) and is verified.

**State as of handover:** convergence 109/109, suite ~8524/0, determinism green, all pushed. **Budget ~$21.52**
on the `.env` key (re-confirm with Tim before any paid gate).

---

## 2. The autonomous overnight worklist (all FREE — Road-A/deterministic or docs)

Do these per the standard bug-fix loop (**reproduce LLM-off → fix the smallest seam → corpus paraphrase-set
and/or a U-test at the next free U# → `npm run check` GREEN → atomic commit by path → push**). Append a dated
`CAPABILITY_LEDGER.md` section per packet.

1. **The D-B4 gate's DETERMINISTIC residuals** (`docs/playtests/opus-gate-2026-06-24.md`):
   - **(a) The ability-score→modifier breakpoint TABLE is incomplete/contradictory** — the loudest crunch nit
     (6–7 of the gate's 10). The DM prints "9 → −1, 10–11 → +0, …" but assigns score 6 a −2 and 8 a −1 with no
     low-score entries. Make the DISPLAYED table complete and matched to the engine's REAL modifier function
     (grep `engine/` for where a score becomes a modifier; don't change the math, only the displayed table), and
     make an explicit roll-on-demand actually roll (C3). A spawned chip (`task_fa57d5d3`) has the full spec —
     do this one first; it most improves Tim's morning playthrough.
   - **(b)** "is there a mirror?" → honest "no mirror here" instead of a roster-list / exits bounce (object-
     presence query). Small narration/intent gap.
   - **(c)** Canon: "where's Elske?" → an NPC says "can't place her" while Elske is PRESENT. Answer a present
     NPC's location from the roster; never deny a present NPC.
   - **(d, optional, combat lane)** "ram the door" opens on a FAILED roll (roll-vs-outcome contradiction).
2. **D-X1 — the bespoke-voice COST-MODEL paper** (write a new `docs/` analysis; the DECISION is Tim's). ~200
   NPCs × per-line voice: throughput, quality, production economics (local 8B GPU vs cloud-per-line), and the
   **all-bespoke vs marquee-bespoke + template-rest** fork. This GATES Phase C — write the numbers, leave the
   call to Tim.
3. **Hardening** of the built loop + newspaper where there's a deterministic win (more tests, edge cases). The
   §0/THE-REF guard is standing (D-X2) — extend the Ref's soft-set only if a new narration path appears.
4. **Write up the OPEN DECISIONS** for Tim's morning (append to `docs/PATH_TO_SELLABLE.md` or a new
   `docs/DECISIONS_FOR_TIM.md`): **#1** voice-cost (D-X1's fork) · **#2** the 5-figure roster · **#3** orb climax
   = demo or campaign hook · **#5** first audience (the gate's been Rules-Lawyer-heavy — normie-flow vs
   enthusiast-crunch) · **#6** how hard to lean on "never forgets."

## 3. Do NOT do autonomously (leave for Tim)
- **Phase C (populate)** — the 5 towns' people, the 5 figures, the faith-war, the joinable cannibals, the trade
  economy. GATED by Decision #1 (voice-cost) and needs the roster (Decision #2). Prep is fine; building the
  population is not.
- **Phase D (dungeons + the orb climax)** — needs Decision #3.
- **NP-5** (the cannibal-faction newspaper tie-in + real faded-NPC data for The Forgotten) — Phase C/D.
- **Any paid gate** while Tim's asleep. No phase completes tonight; `npm run check` (free) is your verification.

## 4. Discipline (non-negotiable; full rules in `docs/BASECAMP.md` + `docs/AGENT_PROTOCOL.md`)
- **Sacred:** §0 (the cosmology is NEVER surfaced — symptoms/faith/rumor only) · determinism (`rng.js` sole
  randomness; mutation only via `effectsCore.applyDeltas`; `worldHash` stable; **U19/21/22/27/30** green) ·
  narration ≠ canon (the LLM authors WORDS only; THE REF is on).
- **Git:** atomic commits **by explicit path** (NEVER `git add -A` — scratch `scripts/_*.mjs` strays exist).
  Before EVERY push: `git log origin/v2-polish..HEAD` (a shared-checkout worker can silently advance HEAD) +
  `scripts/lane-check.sh`; push only green. Commit format: `feat/fix/docs(<area>): <what>` ending with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- One packet at a time; hot files (`playloop.js`, `dialogue.js`, `escapeCombat.js`, `engine/newspaper/`)
  serialize.

## 5. The morning handoff (the done-when for this overnight run)
- `npm run check` GREEN (convergence 100% / suite 0-fail / determinism green) and everything pushed.
- The deterministic gate residuals fixed — **the modifier table especially**.
- The **D-X1 voice-cost paper** written; the **open decisions** written up so Tim can decide, then play.
- A short status note at the top of your final report: what landed overnight, that it's green + pushed, the
  decisions waiting, and: *"Phase A + B are complete and proven. Play the loop on `tallow`: read The Lasting
  Word, hear a town's trouble and take a quest, do a deed, then walk to the next town and hear a stranger greet
  you by name. Save, reload — it remembers."*

## 6. Read first (cold start, in this order)
`docs/BASECAMP.md` (role) · `CLAUDE.md` (rules) · `docs/DEMO_BUILD_PLAN.md` (Phase C/D + the 6 open decisions) ·
`docs/DEMO_REGION.md` (§0 + the content bible) · `docs/CAPABILITY_LEDGER.md` (the era marker + the tail — this
session's full arc, D-A2a → D-B4) · `docs/IDEA_GARDEN.md` IG-14 (the newspaper design + the ambiguous-ad craft) ·
`docs/playtests/opus-gate-2026-06-24.md` (the D-B4 residuals you're fixing) · then `git log`.
