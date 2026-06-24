# THE BUILD SYSTEM — the apparatus that builds the game

*The index the doc-system was missing. [THE_PLAYBOOK](THE_PLAYBOOK.md) is the **principles** (universal,
portable); this is the **principles made physical** — the project-specific constellation of MD files and
protocols that actually organize the build. The specific files don't transfer to a new project, but the
**eight organs and the one lifecycle do**: every AI-built project wants this shape.*

> The repo has ~80 design docs, ~80 playtest reports, ~16 research volumes. That looks like chaos. It isn't —
> every file plays one of **eight functional roles**, and work flows through them in **one repeating loop**.
> Name the organs and the loop and the whole apparatus becomes legible. When something feels off, you can ask
> "which organ is weak?"; when a new doc appears, you know where it belongs.

---

## The eight organs

| Organ | What it does | Load-bearing files | Playbook principle it makes physical |
|---|---|---|---|
| **1. The Constitution** | Non-negotiable law, run before shipping | `THE_DM_TEST`, `THE_TABLE_TEST`, `IMMORTAL_INVARIANTS`, `DETERMINISM_DOCTRINE`, `LAW_OF_EARNED_KNOWLEDGE`, `THE_REF`, §0 (in `DEMO_REGION`) | Governing principles as named tests; Propose-vs-Commit |
| **2. The Map** | Where am I / what actually exists | `WHAT_THIS_IS` (status-tagged audit), `REPO_MAP`, `ARCHITECTURE_OVERVIEW`, `CAPABILITY_LEDGER`, `KB_MAP` | Legibility; honest "what exists" |
| **3. The North Star + Roadmaps** | Where we're going & the critical path | `NORTH_STAR` (+`CRUNCH_V1`/`RUMOR_LAYER`/`PROSE_TO_WORLD`/`SLICE_PLAN`), `ROADMAP`, `PATH_TO_SELLABLE`, `DEMO_BUILD_PLAN`, `PROSE_MECHANIC_PLAN` | Direction; anti-drift |
| **4. The Protocols** | How we do specific things | `PROMPT_ARCHITECTURE`, `BASECAMP`, `AGENT_PROTOCOL`, `BUILD_BUDGET`, `PLAYTEST_PROTOCOL`, `DEBUG_OPERATING_PROTOCOL`, `DRIFT_GUARD_PROTOCOL`, `LANE_MAP`, `WORKER_BRIEF`, `HARNESS_USAGE_STRATEGY` | The workflow; the agent operating model |
| **5. The Work Queue** | The unit of work + active backlog | `PACKETS`, the `PACKET_H5*` specs, `RUNG1_QUEUE`, `*_PUNCHLIST`, `DECISIONS_FOR_TIM` | Packet discipline; small bounded diffs |
| **6. The Specs** | The design of each system | `COMBAT_SPEC`, `MORALITY_SYSTEM`, the staged `*_R3…R7` series, `WORLD_AND_DUNGEONS`, the `VICTORY_GATE*` family, content bibles (`HISTORICAL_FIGURES`, `CHURCH_OF_INCREMENTALISM`) | "Done-when"; the reference for *this* build |
| **7. The Eval System** | The three signals, instantiated | the convergence corpus (`tests/corpus/`), `dm-playtest.mjs` (the discovery gate), `check.mjs` (one-command green), `playtest.js` (bug classes), `docs/playtests/` (the empirical record), `HUMAN_PLAYTEST_HARNESS` | Three-signal evals; determinism → cheap verification |
| **8. The Memory** | So ideas / research / history don't evaporate | `IDEA_GARDEN` (+echoes), `biblioteca/` (16 vols, demand-pulled), `AGENT_CHANGELOG`, `CAPABILITY_LEDGER`, `memory/`, `BASECAMP_HANDOVER` | Knowledge structures; recall across sessions |

---

## The one lifecycle (how work flows through the organs)

```
  capture          research          spec             build under           verify by             record               recall
  an idea    →     before      →     it as a     →    the Constitution  →   three signals    →    append-only    →     across
 (Idea Garden)    reinventing       Packet          (Protocols + Specs)   (corpus·gate·play)    (Ledger·Changelog)    sessions
                  (Biblioteca)     (justified vs                           + npm run check        + playtest report    (Memory·
                                    North Star)                            defines "done"                              Handover)
```

**capture → research → spec → build-under-law → verify-three-ways → record → recall**, looping forever. The whole
apparatus is organs of that single loop.

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

If a doc fits two organs, it's probably two docs.

---

## The health note (the cost of a living apparatus)

Eighty living docs accrue entropy. Current sprawl signals worth a periodic "archive the spent, merge the
overlapping" pass:
- **Three overlapping Maps** — `WHAT_THIS_IS`, `REPO_MAP`, `KB_MAP` (candidate to unify).
- A **superseded Protocol** — `WORKFLOW.md` (replaced by `PROMPT_ARCHITECTURE`).
- **Spent Work-Queue prompts** — the one-off `PACKET_H5*` specs (served their purpose; archive).
- A **five-headed Spec family** — `VICTORY_GATE*` (consolidate).

The sprawl is not a flaw in the *method* — it's the natural entropy of a real, working build system. The fix is
this doc (the index it was missing) plus an occasional gardening pass. Keep the **organ-set** small and stable;
let the **files** within each organ come and go.
