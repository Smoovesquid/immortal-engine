# Worker Prompt — Rung 1 (the correctness floor, P-86)

*Home-base → worker-window handoff. Paste the block below into a fresh Claude Code window to
grind on the foundation. **Set `/model sonnet` in that window first** (the fix-loop is
mechanical; on Sonnet your Pro window lasts ~5× longer). Expect it to hit the Pro cap
eventually — it commits in small increments, so finished work is banked. Review the
`rung1-foundation` branch when you're back.*

---

```
You are a worker session continuing the Immortal Engine build (a deterministic, AI-narrated
tabletop RPG). Home base gave you ONE bounded job: solidify the foundation — Rung 1 of the
realization ladder (packet P-86, the correctness floor). Work autonomously; the owner is
asleep. Don't ask questions — make reasonable taste calls and keep going. Bank progress with
small commits as you go.

FIRST, orient (read these in order; TARGETED reads only, never whole large files):
1. CLAUDE.md — project rules, the bug-fix protocol, staging discipline, the Build-budget block.
2. docs/PATH_TO_SELLABLE.md — the ladder. You are working RUNG 1: "I can do anything here and
   it fits the math." Read that rung + the build discipline.
3. docs/playtests/opus-gate-2026-06-16.md — the latest experiential-gate report. These are the
   exact failing turns you are fixing.
4. docs/BUILD_BUDGET.md — efficiency rules; follow them strictly.
5. Skim scripts/dm-playtest.mjs — the gate harness (it calls the Anthropic API via the .env
   key, NOT the subscription).

EFFICIENCY (Pro account — burns fast):
- Stay on Sonnet for all mechanical work.
- Use `node --test` for the fast verify loop. Run the LLM gate (dm-playtest.mjs) at most ONCE
  near the end to measure; it bills the .env API key.
- NEVER read engine/playloop.js whole (~5.7k lines) — grep to the relevant gate, read with
  offset/limit.
- Small committed increments so progress is banked if the window caps mid-run.

THE JOB — fix the recurring Rung-1 seams in the gate report. For EACH, follow the CLAUDE.md
bug-fix protocol: reproduce → write a baseline FAILING test (tests/U###.shortName.test.js) →
fix in the engine → retest → run the full suite (`node --test`) and confirm determinism tests
pass (U19/21/22/27/30) → commit. Known classes, highest frequency first:
1. Meta-questions get dice rolls. "How do you resolve a sword swing — is there a dice
   mechanic?" and "what's my Might modifier?" must route to the grace/meta layer
   (engine/grace/gracefulAdjudication.js), NEVER generate a roll.
2. Hazard/fall damage narrated but not applied. A fall ("vault out the window") rolls a
   hazard but PC HP (meta.escapeHp) isn't decremented. Apply it. (playloop hazard gate +
   engine/combat/hazard.js / escapeCombat.js.)
3. Physical attack mis-tagged as a spell. Swinging a beam through a window gets a
   `cast-consequence` tag / invented fire. Route physical attacks to the physical path.
4. Advice questions get a navigation deadend. "Should I go talk to them?" returns "that way
   is blocked." Advice about present NPCs must be answered, not bounced as movement.
5. Roll artifact vs a no-threat target. Swinging at a training dummy surfaces a raw [roll…]
   with no foe. Resolve without a combat artifact.

GUARDRAILS (do NOT cross):
- Do NOT touch founding rails: determinism (rng.js only, no Math.random; all mutation via
  effectsCore.applyDeltas; worldHash stable) or the canon-authority rule. If a fix would need
  a WORLD_VERSION bump or an invariant change, STOP and leave a note instead of doing it.
- Correctness ONLY. Do NOT build features, cosmology, mintFact, the "collapse-law," morality
  milestones, or the surfacing packets (P-82/83/84/85). Those are reserved for home base.
- Stage files explicitly by path (no `git add -A`). Commit messages: `fix(<module>): <class>
  — <what>`, ending with the Co-Authored-By line from CLAUDE.md.
- Work on a new branch off the current one (v2-polish): `git checkout -b rung1-foundation`.

LOG + REPORT:
- Append each fix (one line: what failed → what changed → test added) to
  docs/playtests/FIX_LOG_2026-06-16.md (create if absent).
- Leave the suite GREEN and the tree committed at every stopping point. End with a short
  summary: classes fixed, tests added, suite count, any class you couldn't safely fix + why.

Keep going through the list until cleared or you run out of budget.
```
