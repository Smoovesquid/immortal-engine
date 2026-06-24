# THE BUILD SYSTEM — the apparatus that builds the game

*The index the doc-system was missing. [THE_PLAYBOOK](THE_PLAYBOOK.md) is the **principles** (universal,
portable); this is the **principles made physical** — the project-specific constellation of MD files and
protocols that actually organize the build. The specific files don't transfer to a new project, but the
**eight organs and the one lifecycle do**: every AI-built project wants this shape.*

> The repo has ~80 design docs, ~80 playtest reports, ~16 research volumes. That looks like chaos. It isn't —
> every file plays one of **eight functional roles**, and work flows through them in **one repeating loop**.
> Name the organs and the loop and the whole apparatus becomes legible. When something feels off, you can ask
> "which organ is weak?"; when a new doc appears, you know where it belongs.
>
> **The apparatus points up and answers down.** It exists to serve the *product* (organ 3, the North Star) —
> never itself; an apparatus that grows to serve its own tidiness has become the disease it treats. And it is
> kept honest from *below* by the **gardening loop** (last section) — the method-eval applied to the docs
> themselves. Read this whole thing as **context engineering at the project scale**: the Map and the Memory are
> the team's external memory, the worker lanes are sub-agent isolation, `/compact` is compaction. Same craft,
> bigger window.

---

## The eight organs

| Organ | What it does | Load-bearing files | Playbook principle it makes physical |
|---|---|---|---|
| **1. The Constitution** | Non-negotiable law, run before shipping | `THE_DM_TEST`, `THE_TABLE_TEST`, `IMMORTAL_INVARIANTS`, `DETERMINISM_DOCTRINE`, `LAW_OF_EARNED_KNOWLEDGE`, `THE_REF`, §0 (in `DEMO_REGION`) | Governing principles as named tests; Propose-vs-Commit |
| **2. The Map** | Where am I / what actually exists | `WHAT_THIS_IS` (status-tagged audit), `REPO_MAP`, `ARCHITECTURE_OVERVIEW`, `CAPABILITY_LEDGER` | Legibility; honest "what exists" |
| **3. The North Star + Roadmaps** | Where we're going & the critical path | `NORTH_STAR` (+`CRUNCH_V1`/`RUMOR_LAYER`/`PROSE_TO_WORLD`/`SLICE_PLAN`), `ROADMAP`, `PATH_TO_SELLABLE`, `DEMO_BUILD_PLAN`, `PROSE_MECHANIC_PLAN` | Direction; anti-drift; **the layer everything else serves** |
| **4. The Protocols** | How we do specific things | `PROMPT_ARCHITECTURE`, `BASECAMP`, `AGENT_PROTOCOL`, `BUILD_BUDGET`, `PLAYTEST_PROTOCOL`, `DEBUG_OPERATING_PROTOCOL`, `DRIFT_GUARD_PROTOCOL`, `LANE_MAP`, `WORKER_BRIEF`, `HARNESS_USAGE_STRATEGY` | The workflow; the agent operating model |
| **5. The Work Queue** | The unit of work + active backlog | `PACKETS`, `DECISIONS_FOR_TIM` (+ spent worker-prompts, archived once closed) | Packet discipline; small bounded diffs |
| **6. The Specs** | The design of each system | `COMBAT_SPEC`, `MORALITY_SYSTEM`, the staged `*_R3…R7` series, `WORLD_AND_DUNGEONS`, the victory-gate definitions, content bibles (`HISTORICAL_FIGURES`, `CHURCH_OF_INCREMENTALISM`) | "Done-when"; the reference for *this* build |
| **7. The Eval System** | The three signals, instantiated | the convergence corpus (`tests/corpus/`), `dm-playtest.mjs` (the discovery gate), `check.mjs` (one-command green), `playtest.js` (bug classes), `docs/playtests/` (the empirical record), `HUMAN_PLAYTEST_HARNESS` | Three-signal evals; determinism → cheap verification |
| **8. The Memory** | So ideas / research / history don't evaporate | `IDEA_GARDEN` (+echoes), `biblioteca/` (16 vols, demand-pulled), `AGENT_CHANGELOG`, `CAPABILITY_LEDGER`, `memory/`, `BASECAMP_HANDOVER` | Knowledge structures; recall across sessions |

---

## The one lifecycle (how work flows through the organs)

```
  ↺ two doors in, and the tail feeds the head — the loop never really ends:

  door A · a new idea ─────────────────▶ capture ─▶ research ─▶ spec ─▶ build ─▶ verify ─▶ record ─▶ recall ─╮
  door B · a live bug ─▶ reproduce ─▶ root cause ────────────────┘  under     by three   append-     across   │
           (model OFF, deterministic)                                the law   signals    only        sessions │
            (Idea Garden / Biblioteca feed the head)                (Protocols (corpus·   (Ledger·   (Memory·  │
                                                                    + Specs)    gate·play) Changelog) Handover) │
                                                                    = "done"   + npm run check                  │
  ╰──────────────  recall feeds the next turn's capture; a bug-fix's regression test re-enters as Spec + Eval  ◀╯
```

**capture → research → spec → build-under-law → verify-three-ways → record → recall**, looping forever, entered
from either door. Most work starts at **door A** (a new idea, justified against the North Star). Bug-fixing starts
at **door B** (reproduce first, expensive layer *off*) and merges in at the spec/build stage — its regression test
is not a detour but a new permanent Spec + Eval case. The whole apparatus is organs of that single loop.

---

## Which organ does a new doc belong to? (the decision aid)

- Is it a rule you'd *run on output before shipping*? → **Constitution.**
- Does it answer *"what exists / where am I"*? → **Map.**
- Does it answer *"where are we going"*? → **North Star / Roadmap.**
- Does it answer *"how do we do X"*? → **Protocol.**
- Is it a *bounded unit of work with a done-when*? → **Work Queue (a Packet).**
- Is it the *design of a specific system*? → **Spec.**
- Does it *measure* whether something works? → **Eval.**
- Is it *captured knowledge / research / history*? → **Memory.**

If a doc fits two organs, it's probably two docs. If it fits *no* organ, it's probably an artifact of finding
your way — a candidate for the gardening loop below.

---

## The gardening loop (how the apparatus stays honest)

A living doc-system accrues entropy exactly the way a context window does — and **stale docs tax every session
the way a bloated context window taxes every inference** (recall sags, the agent trusts a Map that's no longer
true). So the apparatus needs its *own* recurring maintenance pass, not a one-time cleanup. This is the method-eval
of §"points up and answers down": run it when the sprawl starts costing more than it carries.

**Two failure modes to garden against:**
- **Spent scaffolding piles up.** One-off worker-prompts, superseded protocols, early victory-ladders — the
  remnants of *finding* a way to work. Don't delete (history is append-only); **archive** them out of the live
  set so they stop competing for attention. (`git mv` to `docs/_archive/` preserves the trail.)
- **Forward-docs rot silently.** History is protected (the append-only Ledger), but the *Map, Specs, and Roadmap*
  can drift out of true with nothing flagging it. Apply the memory rule to docs: **verify before trusting** —
  every forward-doc should be *datable and falsifiable* (a "last-true-as-of" date, a one-line "still true?" check).

**The pass itself:** *archive the spent · merge the overlapping · date the forward-looking · re-file the orphans.*
Keep the **organ-set** small and stable (eight); let the **files** within each organ come and go. The fix for
sprawl is never "stop making docs" — it's this loop, run on purpose.

> **Gardening run — 2026-06-24 (done):** archived 17 spent docs to `docs/_archive/` — the superseded
> `WORKFLOW.md`; the `PACKET_H5*` / `WORKER_PROMPT_rung1` worker-prompts; `PRE_SESSION_PUNCHLIST`; and the six
> historical `VICTORY_*` ladders + their `.log` (each self-marked "superseded" by `NORTH_STAR` / `SLICE_PLAN`).
> **Kept live:** `API_ACTIVATION_GATES` (an active gate), `RUNG1_*` (the *current* backlog frame),
> `CONVERSATION_PUNCHLIST` (half reusable pipeline-map). **Done since:** `CLAUDE.md` trimmed (commit `1310aa8`);
> `CAMPAIGN_LIFECYCLE_SPEC_v1` archived; the archived `SPATIAL_EXPLORATION_VICTORY_GATES`' un-built future intent
> (interiors, tactical layer, landmarks, dungeons, faction spatial influence, discovery memory) lifted into
> `ROADMAP`'s parallel section (off the `S#` labels). **Still open:** `KB_MAP` / `ONE_MAP` are Specs wearing Map
> names (rename deferred — cosmetic); and a periodic *method-retro* (the down-layer gap) is offered but unbuilt.
