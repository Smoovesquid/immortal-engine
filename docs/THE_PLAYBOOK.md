# THE PLAYBOOK — how we build software here (portable to any project)

*A transferable operating model for building software with AI agents. Strip the game-specifics and this
applies to any repo. Copy it to a new project, adapt the examples, and you reproduce the way of working —
not the product. Immortal Engine is the running example in (parentheses); your project substitutes its own.*

> The point of this doc: the experience that feels good here is not magic and not five separate ideas — it's
> **one idea wearing many costumes**, plus a handful of disciplined habits. The one idea: *something
> probabilistic proposes; something deterministic commits*, drawn at every altitude of the stack. Hold the
> **spine** (§1); everything else (§2–§5) is the spine, applied.
>
> **This doc serves a layer above it and answers to a loop below it.** Above sits the *product's North Star* —
> method is never the point, the product is; if polishing the method stops serving the product, stop polishing.
> Below sits a *method-eval* — periodically ask "is the way we work actually producing good work, fast?" and
> revise this doc when the honest answer is no. The Playbook is itself a packet that never closes.

---

## 1. The spine — one boundary, drawn at every altitude

The five principles below aren't a list to memorize — they're the *same boundary* (propose ↕ commit) seen from
different heights, grouped by the question each answers:

- **Own the truth** (#1 propose/commit + #4 determinism) → makes the product *reliable*, not merely plausible.
- **Define "right"** (#2 named tests + #5 the reference you already own) → makes it *correct*, not merely functional.
- **Measure honestly** (#3 three signals) → tells you *where you actually are*.
- **Keep the human the author** (#6) → the meta-pillar that governs the other three.

The boundary is **fractal** — it recurs at every altitude: narration ↕ Canon Log (runtime), probe ↕ corpus
(evaluation), worker ↕ conductor (workflow), capture ↕ build (ideas). Name it once and the method stops being a
checklist and becomes a single move you make everywhere.

**1. Propose vs. Commit — the probabilistic layer NEVER owns the truth.**
The LLM authors *words and proposals*; a **deterministic system commits state**. The model never has runtime
authority over what is true. (Immortal: "narration ≠ canon" — the LLM writes prose, the Canon Log is
authoritative; the LLM can't mutate world state.) This one principle is what makes an AI product *reliable*
instead of *plausible*. Every judge, every generator, every agent **proposes**; your deterministic core
**commits/validates**. If you take one thing, take this. *(The field has names for the costumes: the
reasoning-level version is the **evaluator-optimizer** loop; the team-level version is **orchestrator-workers**;
the tool-call version is "natural-language → structured outputs." Same boundary, every time.)*

**2. Governing principles as named "tests" — your product's soul as a question.**
Distill the soul of the product into 1–3 single-sentence, quotable principles, phrased as a **question you
run on any output before shipping.** (Immortal: *THE_DM_TEST* — "would a real DM do this?"; *THE_TABLE_TEST* —
"would this happen at a real D&D table?".) Put them at the **top** of the agent guide. When a change is
ambiguous, you don't debate — you run the test. *"When a playtest finds a response that fails the test, that's
the bug, even if every unit test is green."* (No external playbook ships these for you — they're domain soul,
and they're a moat. This is the one place you can't copy precedent.)

**3. Three-signal evaluation — and know which signal is which.**
Never trust one number. Three orthogonal signals:
- **Corpus (regression, PRIMARY):** a locked set of cases that must stay 100% green. Deterministic, free, the
  thing that catches *regressions*. This is the signal you *trust*.
- **Discovery probe (SECONDARY, noisy):** an adversarial / LLM-driven prober that *finds new problems*. It's a
  **pointer, not a verdict.** Its score bounces (you're sampling fresh veins, not measuring clean progress —
  *"remember the bouncing ruler"*). Use it to *discover*, never to *certify*. Score reliability the field's way:
  **pass^k** ("does it hold across *k* samples?") not **pass@1** ("could it pass *once*?") — a stochastic probe
  certifies nothing on a single run, and "passes every time" is the bar that matters.
- **Human (taste, IRREPLACEABLE):** is it *good*? No automated signal answers this. Protect human time for it.

*Growing the corpus is error analysis — and error analysis is the moat.* New cases come from **reading traces
by hand**: cluster the failures into a taxonomy, *then* write the automated check. Don't outsource that reading —
it's where product understanding actually accrues. (Immortal: re-judging gate transcripts for coherence is this,
done free.)

**4. Determinism + a single source of truth → verification gets cheap.**
Own your state. Make it reproducible (seed-driven where you can), with **one mutation path** and one
authoritative store. The payoff compounds: every bug becomes a **reproducible repro** (a seed + a transcript),
verification becomes a cheap deterministic diff, and "did it actually work" stops being a vibe. (Immortal:
deterministic-by-seed RNG, all mutations through one `applyDeltas`, a `worldHash` that must be stable on replay —
which the field would recognize as a *stateless reducer over an event log*.)

**5. The reference-spec you already own — don't invent what's been solved.**
Before designing a behavior from scratch, find the battle-tested reference that already answers it and **align to
it.** Wrong behavior is usually *drift from a known-good*, not an undesigned gap. (Immortal: actual D&D is the
50-year-playtested spec for "what should happen when you kick someone / search a room / murder an NPC".) For your
project the reference might be a platform's HIG, an RFC, a reference implementation, or a proven competitor flow.
*This applies to your own operating model too: before inventing a workflow, check whether the agent-building
field already named it (orchestrator-workers, context engineering, spec-driven development) and align.*

**6. Keep the human the author — the meta-pillar.**
The other five make the *machine* reliable; this one keeps *you* its author and not its passenger. It shows up
as: **plain-language state reports** (translate jargon, surface the real seams — an agent that hides risk steals
authorship); **human taste as the final, irreplaceable gate** (no number certifies *good*); **capture-without-
committing** (the Idea Garden parks ideas so the backlog never becomes pressure); and **decisions routed back to
the human** at the points only a human can call. As the agents do more each month, this is the principle that
decides whether the system stays *yours*.

---

## 2. The workflow — small, verifiable loops

- **Packet discipline.** Spec a small, bounded unit of work ("a packet") *before* editing. One packet at a time.
  Small diffs that match their commit message. (Don't `git add -A` with unrelated changes in the tree — stage by
  explicit path.)
- **The bug-fix protocol — reproduce FIRST, with the expensive layer OFF.** *Reproduce (deterministically, model
  off) → find the root cause → fix the **smallest seam** → lock it with a regression test → verify → commit.* No
  fix without a root-cause repro. The regression test is what stops the bug from coming back. And before you patch
  a *failing check*, fork **engine-wrong vs measurement-wrong** — the test itself can be the defect; fix the right
  one.
- **One command that says GREEN.** Have a single command that runs the whole verification ladder (regression
  corpus + test suite + determinism + repo-sync) and prints GREEN or not. (Immortal: `npm run check`.) "Shippable"
  becomes a fact, not an opinion.
- **Atomic commits by explicit path**, message format `type(scope): what`, each commit independently sensible.
- **Plain-language state reports — legibility = authorship.** Translate jargon; keep the human holding the
  verdict; show the real seams (what's uncertain, what you compressed, what you skipped). An agent that hides risk
  steals authorship from the human.

---

## 3. The three traps (hard-won — these are the ones that bite)

- **"Tests well" ≠ "is good" — mind the orthogonal axis.** A green metric on *one* axis is not goodness on the
  others. (Immortal: the per-turn text gate was green for weeks while the *whole-session play* axis — can you move
  through the world, can you finish — was never measured and was broken.) Enumerate **every axis a user actually
  experiences**, and don't let a number on one stand in for the rest. When you find an axis you're blind to,
  **build the measure for it** (a goal-directed harness, a coherence oracle — whatever exercises that axis).
- **"It loads" ≠ "it plays" — dogfood the real surface.** Verifying that something *renders / compiles / returns
  200* is not verifying it *works for a user*. Walk the actual user path through the real surface before you say
  "done." (This one is so easy to violate that it deserves its own protocol doc.)
- **"Built" ≠ "wired" — the dark-capability trap.** Code can pass its tests and still never run, because the live
  surface never reaches it. (Immortal: features built in a sandbox surface that `v1.html` never calls; the 🟡
  "built-but-dark" tags in `WHAT_THIS_IS`.) A capability isn't *real* until the user's actual path exercises it.
  Audit for reachability, not just correctness.

---

## 4. The agent operating model

- **Brief agents with structure, not vibes.** Every task carries: **altitude** (how much latitude), **autonomy**
  (decide vs. ask), **layer** (which part of the stack), **missing-artifact** (what to create if absent),
  **done-when** (the explicit finish line), **output-contract** (the shape of the result). (Immortal:
  `PROMPT_ARCHITECTURE.md` + a self-assembling `WORKER_BRIEF` template. The field's lesson, hard-won the same way:
  vague subagent briefs make workers collide or repeat each other — be explicit about objective and boundaries.)
- **Govern spend — model-fit per task.** Default to a cheap/fast model for mechanical work (reads, edits, wiring,
  running tests); escalate to the strongest model only for hard reasoning (architecture, gnarly debugging), then
  drop back. The sharper dial isn't task-type, it's **spec clarity**: the clearer the packet, the cheaper the
  model can run it — *ambiguity is the thing you actually pay the strong model for.* Targeted reads (grep → read a
  slice), never whole large files; don't re-read what's in context.
- **Context is an attention budget, not storage — engineer it.** The context window degrades with length
  (*"context rot"*: recall sags in the bloated middle). Curate the **minimal high-signal set**; write the agent
  guide at the **"right altitude"** — specific enough to steer, general enough to flex — and push detail into
  linked docs the agent pulls on demand. The three field techniques, all of which you already run: **compaction**
  (summarize-and-restart a long session), **structured note-taking** (durable external memory the agent re-reads),
  **sub-agent isolation** (workers keep their own clean windows). The agent guide itself is the first thing to
  keep on a diet.
- **Persistent, typed, indexed memory.** Give the agent a file-based memory of durable facts, typed
  (*user / feedback / project / reference*), with a one-line index. Convert relative dates to absolute. Don't
  store what the repo already records; update rather than duplicate; delete what turns out wrong.
- **Parallel lanes without collisions.** Isolate parallel agents in their own git worktrees; serialize on
  "hot files" (the few competence-critical files); shared docs are **append-only dated sections**; before any
  push, confirm the outgoing commits are *only this lane's* and never publish another lane's work unasked. *(This
  is the **orchestrator-workers** pattern — the conductor decomposes and integrates, workers execute in isolation
  — and it only pays when the work truly decomposes into independent threads. Forced parallelism just buys merge
  cost. Architecture follows task structure.)*

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
- **The spec is becoming the durable artifact.** The field's 2025 turn — *spec-driven development*, "the spec is
  the prompt" — is your packet discipline scaled up: versioned specs as the source of truth, code as the last
  mile. You were early. Lean in where it helps: write the **done-when** sharp enough that an agent could regenerate
  the work from it.

---

## 6. Bootstrapping this in a NEW project (day-one checklist)

1. **Write the agent guide** (`CLAUDE.md` / `AGENTS.md`) with, at the very top: the 1–3 **governing tests**, the
   **Propose-vs-Commit** boundary for your stack, and the **one-command green** invocation. Keep it at the **right
   altitude** — minimal high-signal, detail in linked docs.
2. **Name your governing test(s).** What's the single question that captures "is this *right* for this product"?
   Write it as a `THE_*_TEST.md` and link it from the guide. Find your **reference spec** (§1.5) and name it.
3. **Stand up the three signals.** A regression **corpus** (start tiny, lock it at 100%); a **discovery probe**
   (even a manual adversarial checklist to begin); and a standing reminder that **human taste** is the third gate.
4. **Establish the source of truth + one mutation path.** Decide what's authoritative and make all writes go
   through it. Make repros reproducible (seeds/fixtures).
5. **Write the bug-fix protocol + the one-command ladder** so "shippable" is a fact.
6. **Add the structures as you need them** (memory, idea garden, ledger) — demand-pulled, not all at once.
7. **Encode the three traps** (§3) as protocol docs so future-you (and the agents) can't forget them.
8. **Name your patterns against the field** — map your method to the published vocabulary (orchestrator-workers,
   context engineering, evaluator-optimizer, spec-driven development) so you stand on precedent and can recruit.

---

## 7. The shortest version
It's **one move at every altitude**: let the probabilistic side **propose** and a deterministic core **commit** —
prose ↕ canon, probe ↕ corpus, worker ↕ conductor, capture ↕ build. Name the 1–3 questions that define "right"
and run them on everything. Trust the regression corpus, treat the discovery probe as a noisy pointer (reliability
is **pass^k**, not pass@1), and guard human time for taste. Own your state so bugs are reproducible and "green" is
a fact. Don't invent what a proven reference already answers — including for your own workflow. Work in small
spec'd packets, reproduce before fixing (and check whether the *test* is the bug), report in plain language. Never
let a green number on one axis convince you the thing is *good* — that's the human's call, made by actually using
it. And treat the way you work as a packet that never closes: measure it, prune it, keep it yours.
