# THE PLAYBOOK — how we build software here (portable to any project)

*A transferable operating model for building software with AI agents. Strip the game-specifics and this
applies to any repo. Copy it to a new project, adapt the examples, and you reproduce the way of working —
not the product. Immortal Engine is the running example in (parentheses); your project substitutes its own.*

> The point of this doc: the experience that feels good here is not magic and not one big idea — it's ~5
> load-bearing principles plus a handful of disciplined habits. You don't have to hold it all at once. Hold
> the **spine** (§1). Everything else (§2–§5) is the spine, applied.

---

## 1. The spine — the five ideas everything else serves

**1. Propose vs. Commit — the probabilistic layer NEVER owns the truth.**
The LLM authors *words and proposals*; a **deterministic system commits state**. The model never has runtime
authority over what is true. (Immortal: "narration ≠ canon" — the LLM writes prose, the Canon Log is
authoritative; the LLM can't mutate world state.) This one principle is what makes an AI product *reliable*
instead of *plausible*. Every judge, every generator, every agent **proposes**; your deterministic core
**commits/validates**. If you take one thing, take this.

**2. Governing principles as named "tests" — your product's soul as a question.**
Distill the soul of the product into 1–3 single-sentence, quotable principles, phrased as a **question you
run on any output before shipping.** (Immortal: *THE_DM_TEST* — "would a real DM do this?"; *THE_TABLE_TEST* —
"would this happen at a real D&D table?".) Put them at the **top** of the agent guide. When a change is
ambiguous, you don't debate — you run the test. *"When a playtest finds a response that fails the test, that's
the bug, even if every unit test is green."*

**3. Three-signal evaluation — and know which signal is which.**
Never trust one number. Three orthogonal signals:
- **Corpus (regression, PRIMARY):** a locked set of cases that must stay 100% green. Deterministic, free, the
  thing that catches *regressions*. This is the signal you *trust*.
- **Discovery probe (SECONDARY, noisy):** an adversarial / LLM-driven prober that *finds new problems*. It's a
  **pointer, not a verdict.** Its score bounces (you're sampling fresh veins, not measuring clean progress —
  *"remember the bouncing ruler"*). Use it to *discover*, never to *certify*.
- **Human (taste, IRREPLACEABLE):** is it *good*? No automated signal answers this. Protect human time for it.

**4. Determinism + a single source of truth → verification gets cheap.**
Own your state. Make it reproducible (seed-driven where you can), with **one mutation path** and one
authoritative store. The payoff compounds: every bug becomes a **reproducible repro** (a seed + a transcript),
verification becomes a cheap deterministic diff, and "did it actually work" stops being a vibe. (Immortal:
deterministic-by-seed RNG, all mutations through one `applyDeltas`, a `worldHash` that must be stable on replay.)

**5. The reference-spec you already own — don't invent what's been solved.**
Before designing a behavior from scratch, find the battle-tested reference that already answers it and **align to
it.** Wrong behavior is usually *drift from a known-good*, not an undesigned gap. (Immortal: actual D&D is the
50-year-playtested spec for "what should happen when you kick someone / search a room / murder an NPC".) For your
project the reference might be a platform's HIG, an RFC, a reference implementation, or a proven competitor flow.

---

## 2. The workflow — small, verifiable loops

- **Packet discipline.** Spec a small, bounded unit of work ("a packet") *before* editing. One packet at a time.
  Small diffs that match their commit message. (Don't `git add -A` with unrelated changes in the tree — stage by
  explicit path.)
- **The bug-fix protocol — reproduce FIRST, with the expensive layer OFF.** *Reproduce (deterministically, model
  off) → find the root cause → fix the **smallest seam** → lock it with a regression test → verify → commit.* No
  fix without a root-cause repro. The regression test is what stops the bug from coming back.
- **One command that says GREEN.** Have a single command that runs the whole verification ladder (regression
  corpus + test suite + determinism + repo-sync) and prints GREEN or not. (Immortal: `npm run check`.) "Shippable"
  becomes a fact, not an opinion.
- **Atomic commits by explicit path**, message format `type(scope): what`, each commit independently sensible.
- **Plain-language state reports — legibility = authorship.** Translate jargon; keep the human holding the
  verdict; show the real seams (what's uncertain, what you compressed, what you skipped). An agent that hides risk
  steals authorship from the human.

---

## 3. The two traps (hard-won — these are the ones that bite)

- **"Tests well" ≠ "is good" — mind the orthogonal axis.** A green metric on *one* axis is not goodness on the
  others. (Immortal: the per-turn text gate was green for weeks while the *whole-session play* axis — can you move
  through the world, can you finish — was never measured and was broken.) Enumerate **every axis a user actually
  experiences**, and don't let a number on one stand in for the rest. When you find an axis you're blind to,
  **build the measure for it** (a goal-directed harness, a coherence oracle — whatever exercises that axis).
- **"It loads" ≠ "it plays" — dogfood the real surface.** Verifying that something *renders / compiles / returns
  200* is not verifying it *works for a user*. Walk the actual user path through the real surface before you say
  "done." (This one is so easy to violate that it deserves its own protocol doc.)

---

## 4. The agent operating model

- **Brief agents with structure, not vibes.** Every task carries: **altitude** (how much latitude), **autonomy**
  (decide vs. ask), **layer** (which part of the stack), **missing-artifact** (what to create if absent),
  **done-when** (the explicit finish line), **output-contract** (the shape of the result). (Immortal:
  `PROMPT_ARCHITECTURE.md` + a self-assembling `WORKER_BRIEF` template.)
- **Govern spend — model-fit per task.** Default to a cheap/fast model for mechanical work (reads, edits, wiring,
  running tests); escalate to the strongest model only for hard reasoning (architecture, gnarly debugging), then
  drop back. Targeted reads (grep → read a slice), never whole large files; don't re-read what's in context.
- **Persistent, typed, indexed memory.** Give the agent a file-based memory of durable facts, typed
  (*user / feedback / project / reference*), with a one-line index. Convert relative dates to absolute. Don't
  store what the repo already records; update rather than duplicate; delete what turns out wrong.
- **Parallel lanes without collisions.** Isolate parallel agents in their own git worktrees; serialize on
  "hot files" (the few competence-critical files); shared docs are **append-only dated sections**; before any
  push, confirm the outgoing commits are *only this lane's* and never publish another lane's work unasked.

---

## 5. The knowledge structures (so good ideas don't evaporate)

- **An Idea Garden** — a place to *park* ideas without committing to build them, each with **"echoes"**: trigger
  phrases that resurface the idea associatively when the conversation rhymes with it. Capture-without-committing
  keeps the backlog from becoming pressure.
- **A research library, mined before reinventing — and demand-pulled.** Before scoping anything non-trivial,
  check whether the field already solved it (precedent + state of the art). Pull research **when a real near-term
  need names it** — never stockpile ahead (dead weight + drift). (Immortal: the *Biblioteca*.)
- **An append-only capability ledger** — what's built, what's dark, the convergence meter, dated era-markers. The
  honest map of "what actually exists," kept append-only so history is never rewritten.

---

## 6. Bootstrapping this in a NEW project (day-one checklist)

1. **Write the agent guide** (`CLAUDE.md` / `AGENTS.md`) with, at the very top: the 1–3 **governing tests**, the
   **Propose-vs-Commit** boundary for your stack, and the **one-command green** invocation.
2. **Name your governing test(s).** What's the single question that captures "is this *right* for this product"?
   Write it as a `THE_*_TEST.md` and link it from the guide. Find your **reference spec** (§1.5) and name it.
3. **Stand up the three signals.** A regression **corpus** (start tiny, lock it at 100%); a **discovery probe**
   (even a manual adversarial checklist to begin); and a standing reminder that **human taste** is the third gate.
4. **Establish the source of truth + one mutation path.** Decide what's authoritative and make all writes go
   through it. Make repros reproducible (seeds/fixtures).
5. **Write the bug-fix protocol + the one-command ladder** so "shippable" is a fact.
6. **Add the structures as you need them** (memory, idea garden, ledger) — demand-pulled, not all at once.
7. **Encode the two traps** (§3) as protocol docs so future-you (and the agents) can't forget them.

---

## 7. The shortest version
Let the model **propose** and a deterministic core **commit**. Name the 1–3 questions that define "right" and run
them on everything. Trust the regression corpus, treat the discovery probe as a noisy pointer, and guard human time
for taste. Own your state so bugs are reproducible and "green" is a fact. Don't invent what a proven reference
already answers. Work in small spec'd packets, reproduce before fixing, report in plain language. And never let a
green number on one axis convince you the thing is *good* — that's the human's call, made by actually using it.
