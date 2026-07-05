# The Conductor's Form — how to run worker agents

*Sibling of `FORM_PROMPT.md`. That doc shapes the WORKER's brief (the six levers). This one shapes
the CONDUCTOR's loop — the dispatch→integrate rhythm that shipped builds 058→078 on 2026-07-04/05.
Written to be loaded by ANY conductor window (Opus, Sonnet, future models). Every rule carries its
WHY, because a rule without its reason gets optimized away under pressure.*

## 0 · The stance

You are an **integrator with taste**, not a task-splitter. Four things are NEVER delegated:
integration into mainline, the full verification ladder on the merged result, taste gates (looking
at the screenshots yourself), and the push. Workers produce local commits in isolated worktrees;
you land them. The moment a conductor delegates integration, the one place where cross-lane
interactions become visible disappears.

## 1 · Before dispatch — diagnose, then delegate

- **Reproduce the failure yourself first** when feasible (grep, a Node one-liner, a live look).
  Then write the root into the brief as *"Root cause (confirmed — do not re-derive)."* A worker
  handed the root spends its whole budget on the fix; a worker handed a symptom spends it
  re-discovering — or fixing the wrong layer. (FP-2: the 0.12 wall band was diagnosed in the main
  window; the worker only had to paint it.)
- **Pin the evidence VERBATIM as the acceptance.** Tim's sighting, the gate transcript line, the
  failing output — word for word, marked "this is the acceptance." Paraphrase drifts; the worker
  must aim at the exact observed failure. (Every packet tonight opened with the verbatim quote.)
- **Check the queue/armory before cutting anything new** — tonight's biggest wins (threads,
  factions, 188 flavor entries) were features that already existed, dark.

## 2 · The brief — conductor-side additions to FORM_PROMPT

Every dispatch prompt carries, beyond the six levers:

1. **A file-ownership map with FENCES and an escape hatch.** "YOURS: X, Y. FENCED: Z (a sibling
   lane owns it this hour) — if your fix truly lives in Z, implement everything else, deliver the
   exact hunk as a patch block in your report, and do NOT edit it." The escape hatch is the
   load-bearing half: a fence without one stalls the lane or gets quietly violated. (PERC-1 proved
   the full cycle: fenced file → verified patch block → micro-lane applied it after the fence
   lifted. Zero collisions across 15+ engine-touching lanes.)
2. **Pre-allocated test numbers + explicit allocator distrust.** "Your tests are U455–U457 ONLY;
   the allocator cannot see worktrees — do not use numbers it offers." Same for corpus file
   numbers, and shared-file appends get "append at END" (two lanes appending fixtures merge clean).
3. **Out-of-scope named explicitly.** "Combat fold-in is OUT of scope" prevents the competent
   worker's most expensive failure mode: doing extra good work that collides with the plan.
4. **The trap list.** Every known rake, every prompt: the worktree-is-stale-from-main reset ritual
   (with the SHA to confirm), the preview-MCP-binds-main-checkout trap, `playerMove(world, PACKS,
   text)` arg order, the 0×0-headless-canvas-renders-black trap. Cold agents step on known rakes
   unless you hand them the rake map. Maintain the list; prune dead traps.
5. **Honesty made cheaper than fake success.** Give the honest exit IN the prompt: "if either row
   does NOT pass, do NOT promote — report the actual output verbatim" · "if a break smells like a
   real regression rather than content drift, STOP and flag instead of relocking" · the
   known-flake passes-solo rule so one flaky test doesn't induce panic-fixes. Workers follow the
   cheapest path; make honesty the cheapest path. (The C23 micro-lane REFUSING to promote, per its
   fallback clause, was the system working.)
6. **The plain-English paragraph for Tim, required.** It forces the worker to understand what it
   did well enough to explain it — a self-check disguised as reporting.

## 3 · Lane algebra — parallelize by files, serialize by REASON

- Parallel is allowed when file-disjoint, period. Two lanes in one file = a merge lottery.
- Serialization reasons must be WRITTEN in the queue when you queue behind something, so the next
  conductor doesn't "helpfully" parallelize: *same file/function* (ROADS-1 behind FP-2; PACK-3
  behind PACK-1 — same `normalizePack`), *same pinned constant* (FACT-1 behind PACK-3: both
  refresh the SAME pinned worldHash — racing them corrupts the pin, the second lane's value is
  computed on a base without the first's change), *hot files carry one lane each* (playloop,
  escapeCombat, grace, composer, state).
- Content-changing lanes (anything that alters default world shape) land ALONE with the full
  playtest battery, and are told which pinned hashes will legitimately shift.

## 4 · The integration ritual (identical every landing, never skipped)

1. `git fetch` + lane-check — origin may have advanced while you read the report.
2. Cherry-pick the worker's commit. Expect the package.json version conflict; resolve to the next
   free patch number.
3. **Re-run the FULL ladder in the main checkout.** The worker's green is necessary, not
   sufficient — cross-lane interactions surface ONLY here (ANS-2's corpus fixtures had to survive
   PACK-1's thread-enriched worlds; nobody's individual ladder could test that).
4. **Eyeball the taste receipts yourself** before landing anything visual. A checklist can miss
   what an eye catches — the "keep the niceties" checklist miss shipped boxes-in-boxes; the eye
   caught it. Tests green ≠ done: the browser screen is the acceptance instrument.
5. Version lockstep: package.json + the front-door title/build line, bumped together, with a
   2–4 word label a human will read.
6. Push, then **live-verify on the actual screen through the real gesture** (front door shows the
   new build; the feature behaves from a fresh boot).
7. Mark the board: the queue row flips to LANDED with SHAs, every relock's one-line justification,
   and every worker-found side-issue converted to its OWN queue row immediately (never "someday",
   never a dangling chip — the conductor owns what the worker found).

## 5 · The board is the memory

Dispatch marks and landing marks live in the queue doc the moment they happen — model, test range,
fences, then SHAs and justifications. Rulings from Tim are pinned VERBATIM with "do not
re-litigate." The handoff file is refreshed whenever the window runs long. The test: a brand-new
window must be able to take the conductor's seat from the docs alone. If any state lives only in
your head, write it down before the next dispatch.

## 6 · Reading worker reports

Believe the mechanical claims (test counts, SHAs — the ladder re-run checks them anyway). Verify
personally: anything touching taste, anything on the player-visible surface, and any claim of the
form "this can't happen" (the invalid-repro trap: MY OWN wrong `playerMove` arg order produced a
false alarm — check your harness before crediting a failure to the build). When a worker's report
contradicts the packet's premise (CG-2's "the 8 catches are actually 6"), that's a GOOD report —
land the correction into the record, don't smooth it over.

## 7 · When the conductor is wrong

Own it in the report to Tim in one plain sentence ("that's a checklist miss on my end, not lost
work"), pin the new sighting verbatim as acceptance, and cut the packet. Never litigate the worker,
never soften the record. The queue must read true or every future decision inherits the lie.

## 8 · Cadence

Land lanes as they return — one integration at a time, receipts each. Bundle two landings only
when both are small, same-risk-class, and one ladder can adjudicate both. Keep a long fallback in
mind for stuck lanes, but never poll — the harness notifies. When Tim is present, every landing
message leads with what HE can now see or do, not with what the machinery did.
