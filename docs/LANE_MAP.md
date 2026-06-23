# Immortal Engine — Parallel Work Lane Map

**Purpose:** run multiple AI/agent lanes at once *faster* without corrupting the repo, crossing
architectural boundaries, or creating hidden merge risk.

**Core position:** parallelism is good only when lanes follow the architecture. Parallelize along the
**competence/coverage seam** — never across hot files or global invariants.

**Default posture (Homebase):** attempt the maximum *worthwhile* concurrency — but the default is **per
lane-type**, not global. Parallel by default for content / UI / docs-design; **serial** by default for
competence hot files, schema/`WORLD_VERSION`, and taste-critical narration.

---

## 1. The seam

```
Competence = what the DM does with a question, given what it knows  → resolver/routing/test CODE
Coverage   = how much world content the DM has available            → DATA that feeds resolvers
```

Content/data feeds the resolver interfaces without changing resolver logic, so the two run in parallel
with near-zero collision — and coverage *multiplies* the value of competence (a resolver with no content
is dark). This is the highest-leverage parallel pairing.

**When is a lane worth it?** Collision-safety is necessary, not sufficient. Spin a lane only when the
work is (a) **independent** (own file-set), (b) **chunky** enough to amortize branch+merge ceremony, and
(c) **not coherence-critical** (a single design — e.g. the resolver series — wants one mind). For *cold*
agent lanes add (d) the work must beat the cold-start cost. Already-warm, separately-driven models skip
(d) — they're free to run; Homebase just OKs and integrates.

---

## 2. Homebase = conductor / integrator

One role is not a peer lane: **Homebase plans the split, owns the merge into `v2-polish`, holds the
context, and never delegates the serialized lane.** Worker lanes (warm models on UI/content) produce
branches; **Homebase lands them.** Parallel lanes need one integration owner or the interleave problem
just moves to the merge layer.

---

## 3. Lanes

| Lane | Owns | Parallel? |
|---|---|---|
| **A — Competence / code** | `engine/playloop.js`, `engine/world/*Query.js`, `engine/npc/dialogue.js`, `engine/escapeCombat.js`, `engine/grace/`, composer/render surfaces, competence corpus + U-tests | ⚠️ **serial** (one owner per hot file) |
| **B — Coverage / content** | packs/canon data, NPC rosters, substrate/local-event data, rumors, bestiary entries, location/object data, `DEMO_REGION` data | ✅ **parallel** (best surface) |
| **C — UI / presentation** | `public/v1.*`, CSS, map renderer, transcript/browser polish | ✅ **parallel** |
| **D — Narration-law / design** | `docs/LAW_OF_EARNED_KNOWLEDGE.md`, `docs/THE_REF.md`, `docs/THE_DM_TEST.md`, prompt/validator design notes | ✅ **parallel (docs-only)** — code touching `llmAdapter`/`playloop`/`dialogue`/composer sequences with A |
| **E — Global invariants** | `WORLD_VERSION`, `engine/state.js`, `ensureWorld`/migrations, `engine/rng.js`, `engine/effectsCore.js`, Canon Log/CSL, `worldHash` | ⛔ **serialize — never parallel** |

**Lane rules.** B: don't touch resolver logic or hot files; structured data over LLM-only prose; don't
resolve `DEMO_REGION` §12 creative questions without the user. C: render engine output, never reinterpret
canon; no state/RNG/`worldHash`/mechanics changes. D: design freely; code work sequences with A. E: one
owner, full verification, rollback plan, update invariants/docs on any semantics change.

---

## 4. Mechanism: worktree-per-lane (not just branch-per-lane)

**Branch names do NOT isolate a shared working directory.** Two models editing the same checkout collide
on *uncommitted* changes regardless of branch (observed live: foreign edits to `playloop.js` +
`grace/` appeared in Homebase's tree mid-discussion). Isolate each parallel lane:

```bash
git worktree add ../immortal-<lane> -b <lane>/<short-purpose>   # separate working dir per lane
# e.g.  git worktree add ../immortal-content content/tavern-roster
```

(The `Agent` tool's `isolation: "worktree"` does this automatically for spawned agents.) Branch naming:
`<lane>/<short-purpose>` → `content/tavern-roster`, `ui/map-renderer-pass`, `docs/earned-knowledge`.
Merge target: **`v2-polish`**, integrated by Homebase.

**Tiny solo packets** (a few files, no hot-file contention) may still go direct to `v2-polish`.
**Multi-hour or parallel work** must use a worktree+branch and integrate through the gate below.

---

## 5. Merge gate

Before any push/merge into `v2-polish`:

```bash
scripts/lane-check.sh        # status + outgoing + incoming + hot-file/foreign-edit flags
npm run check                # convergence + suite + determinism + git sync
```

Required: tree clean except declared strays · outgoing commits are **only this lane's** · origin has not
advanced unseen (if it has: `git pull --rebase && npm run check`) · `npm run check` green · rollback
plan stated. **Never push on top of unseen work.**

---

## 6. Shared append-surfaces (docs collide too)

`CAPABILITY_LEDGER.md`, `AGENT_CHANGELOG.md`, `PACKETS.md` are written by *every* lane and interleave as
often as code. Rule: **each lane appends its own dated section** (append-only → conflict-free); Homebase
owns doc integration on merge. Don't edit another lane's section.

---

## 7. Collision policy

If two lanes need the same hot file: **stop and coordinate** — do not edit around each other in one file.
(1) Identify which lane owns the current packet. (2) Other lane switches to docs/design or waits.
(3) Merge the owning lane. (4) Rebase the other. (5) Re-run `npm run check`. The long-game fix is
**decomposition**: every handler carved out of `playloop.js` into its own module (the `engine/world/*Query.js`
pattern) is a new independently-ownable lane — extraction *manufactures* parallel capacity.

---

## 8. Standing decisions

- **Multi-hour / parallel work → worktree+branch.** Direct-to-`v2-polish` only for tiny solo packets.
- **Merge authority into `v2-polish` = Homebase** (the integrator).
- **Paid gates: user only**, by explicit request.
- **One owner at a time** for `playloop.js`, `dialogue.js`, composer/render, `escapeCombat.js`, grace.
- **Global invariants (Lane E): never parallel.**

---

## 9. One-line rule

> Parallelize work that's independent, chunky, and not taste-coherent — isolate it in its own worktree,
> and let Homebase integrate. Serialize hot files, schema, and anything one mind should hold.
