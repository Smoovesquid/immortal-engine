# Reflection Notes — Setup Diagnosis from 179 Session Transcripts

*Date: 2026-07-02. Method: 5 subagents mined the full transcript archive
(`~/.claude/projects/-Users-timothysmith-Projects-immortal-engine/`, ~180 sessions,
June 2 – July 2), extracting only Tim's own messages plus interruption/error markers.
Clustering and verdicts by the main session. Diagnosis only — nothing was built.*

**Verdict key:** SKILL = new slash-command/skill · AUTOMATION = hook/script that runs
without asking · FIX = one-time doc/config change · NOTHING = already solved or not
worth the build cost.

Ranked most leverage first.

---

## 1. Tim is the human message bus between windows — retire the clipboard relay

**Verdict: SKILL + workflow change (the single biggest win).**

The dominant pattern in the entire archive: Basecamp writes a worker prompt → Tim
copies it into another window → worker finishes → Tim pastes the report back →
Basecamp re-verifies the paste because it can't trust it. Every hop is manual,
error-prone, and Tim-blocking.

**Evidence (≥25 sessions across every slice):**
- Basecamp slice: courier work in ≥15 of 29 sessions — "h-93 prompt please. for opus
  in another window" (ce5e32d6), "workers are done. Please double check what is
  remaining and deliver the next prompt" (af3dede8), "Ah shit. I already sent these!"
  (af3dede8 — stale-prompt courier error), "Please make that packet and I will
  deliver it to codex" (9b8522a6).
- Interactive slice: ≥14 sessions — "I will deliver it to another window and then
  give you back the result" (3d5a8034), "Sorry, I just sent the first one you gave
  me" (426f2cbe — mixed up which prompt was sent).
- July slice: duplicate botched paste of a worker report (3b6b6411), Basecamp
  re-running all gates "rather than trust the report" (c9f8b651).
- Tim already wished for the fix directly: "hey, can you actually control Claude in
  my terminal?" (ce5e32d6).

**The fix is already proven in your own history.** Session 71c36dc2 (July 2): "Can
you do these here autonomously with a fable subagent? If so, go" → 5 background
subagents in isolated worktrees, all succeeded, shipped v0.22.0. No pasting, no
trust boundary — Basecamp verified by hash in-process.

**Proposal:** a `/dispatch` skill (or a Basecamp-doc rule) making subagent-in-worktree
the DEFAULT dispatch path for any packet that doesn't need Codex or a genuinely
separate account. Human relay only for the true cross-account lanes (Codex, the Pro
farm). Include the three known gaps from the successful run: test-number allocation
(three parallel agents all claimed "U322"), stale-HEAD refresh before integration,
and serial locking on hot files.

---

## 2. Basecamp boot + handoff ritual — formalize as skills, kill the re-derivation tax

**Verdict: SKILL (two small ones: `/basecamp` boot, `/handoff`).**

Every orchestration session opens with the same incantation and closes (when the
window dies) with Tim begging for a hand-written kickoff prompt. Each boot burns
time re-deriving state from git because docs/changelogs lag ("re-derived from git +
the live docs (not the stale changelog)", 42ddcae6).

**Evidence:**
- "❯ You are immortal Basecamp. docs/BASECAMP.md —" opens ≥14 sessions verbatim;
  bespoke variants open ~10 more. Typed bare as "basecamp" in 42ddcae6, c9f8b651,
  71c36dc2, e3164592.
- Handoff-prompt requests in ≥8 sessions: "I'm going to bed... Give me a prompt for
  a new basecamp" (3e016166), "May I have the kickoff for a new basecamp" (82e48fc7),
  "You're almost at a reset. Please create the prompt" (ccb3e1a8), "I need a handoff
  prompt... You just used half the 5 hour limit" (3d5a8034).
- One full session (3b388170) is recovery from a reset with Tim manually pasting
  "what was sent before the reset".
- Context management is explicitly opaque to him: "Can you explain when I should
  compact basecamp vs when I should create a new one... Is there a way you can
  monitor this and tell me explicitly? Still not sure I understand." (0cf7f0cb)
- MAPNINJA has the same shape: bare "mapninja!!!" summons in 4 sessions, plus
  machine-written kickoff packets ferried by hand (36f8f259, ec79946e ×3).

**Proposal:** `/basecamp` = boot from verified git state (branch check, unpushed
work, gate status, PACKETS queue head) and print a plain-English board. `/handoff` =
write the next window's kickoff from live state (the `checkpoint` skill already
installed covers part of this — wire it to the Basecamp format rather than building
from scratch). Same skill can announce "context is getting low, checkpoint now" so
Tim never has to judge compaction himself.

---

## 3. "Execute: brief.md" — formalize the one-line launch

**Verdict: SKILL (small — `/execute <brief>` with a `--review` mode).**

Tim's newest and best workflow: ~13 sessions in 5 days are a single line ("Execute:
CMB-SINK-1-combat-advance.md") and the worker runs unattended to a consistent
plain-English report. It works — 11 of 13 needed zero intervention. But the syntax
is informal and the failure modes are known.

**Evidence (July slice):**
- Syntax drifts every time: "Execute:", "execute:", "AG-3b-intent-aware-whitelist.md
  Execute" (d10d91f3), full paths vs bare names.
- Lane confusion stalls: DX-2d-i.codex.md → executor tried to figure out "how Codex
  is dispatched here" → interrupt → "It's not necessarily for Codex. You can just
  carry out the prompt" (eba288f2). Same hesitation in 3b6b6411.
- Pre-flight review is an unmet mode Tim keeps improvising: "What do you think of
  this prompt (don't carry it out)" (985384ec — the review caught a real collision
  with locked art direction), "Please check out this prompt" (ffd467df).

**Proposal:** `/execute <brief>` — resolves the file, reads its lane header, decides
run-here vs dispatch (per #1), and just goes. `/execute --review <brief>` runs the
985384ec-style critique first. Cheap to build; the brief format already exists
(docs/WORKER_BRIEF.md).

---

## 4. Stale-build / "am I playing the latest version?" — automate freshness

**Verdict: AUTOMATION (hook) + tiny SKILL (`/play`).**

Tim playtests the live build and repeatedly can't tell if it's current. Twice he
playtested an old build and reported phantom bugs — the most expensive possible
waste of his playtest time.

**Evidence:**
- "This is an old version. It has wounds and stress and no character sheet and the
  map is gone... Just look at it" (af3dede8); "I need to know if I'm playing the
  latest" (af3dede8); "Can I have the game pulled up in a fresh browser with a new
  version number on it" (26708aca); "yes i need to know im playing the right
  version" (03f005c4).
- Direct ask for the automation: "please always update the version number. At the
  end of any changes, list the new version number. I need to be sure I'm playing
  the correct version" (01fa2d8d). Today this is enforced only by CLAUDE.md prose +
  agent memory — it still gets missed.
- "Open the game for me" asked 10+ times across interactive sessions ("could you
  open the game for me in the browser?" afb0d62b, edb57d84, e58135c1 ×3...), plus
  stale-cache ghosts ("stale browser cache serving the old render3d... hard-refresh
  needed" 80076a5e; also flagged in feedback memory).

**Proposal:** (a) a post-commit hook (or extension of the existing Stop hook) that
verifies package.json semver and the v1.js build line moved together and blocks
"shipped" claims otherwise; (b) `/play` — one command that starts the dev server if
needed and opens v1.html with a cache-busting query param, printing the version it's
serving. Very low build cost, kills a high-frustration recurring class.

---

## 5. Briefs that leave a decision open, stall — harden the brief template

**Verdict: FIX (edit docs/WORKER_BRIEF.md + BASECAMP.md prompt-assembly rules).**

Across all slices, any question routed back to Tim mid-execution is a workflow
failure. Briefs that pre-delegate every judgment call succeed unattended; ones that
leave a seam open stall until he returns.

**Evidence:**
- "Bro I'm not a coder. I need you to be in control here." (a3fb1cd1 — worker asked
  a seam question mid-DX-2a); "I have no idea. I need you to handle it so I can go
  chop wood." (ce5e32d6); "That's not a decision I want to make" (e30b7ffb); "I
  don't know what these things mean, brother... not ask me questions unless it's
  life or death" (af3dede8); "Do you always automatically finish with a question
  like that?... It makes me think you never finish the job" (d376605b).
- The strongest single correction in the archive: "You must remember to playtest all
  of the new features before I playtest... Most of the time, you are handing me a
  broken game" (e0f6ec17) — became PLAYTEST_PROTOCOL.md, yet broken handoffs
  recurred after.

**Proposal:** add two hard rows to the brief template: (1) "Decision policy: worker
makes ALL judgment calls; never route a question to Tim; if truly blocked, pick the
reversible option and flag it in the report"; (2) "Definition of done includes a
self-playtest through live v1.html — a report without playtest evidence is not
DONE." Cheap, and it converts a repeated verbal correction into structure.

---

## 6. Gate budget + API-key micromanagement — a small ledger

**Verdict: AUTOMATION (tiny script + file).**

Every paid Opus-gate run starts with Tim reciting the remaining dollar balance from
memory, and key swaps are manual and confusing. One autonomous run stalled precisely
because the agent "wasn't sure if it should spend" (ce5e32d6).

**Evidence (≥9 sessions):** "you have $7.29" (558c513a), "$10.51. Go for it"
(323ff873), "Budget is actually $5.41" (dfdd79aa), "FYI you have $50 total for
testing. Not $20" (d055d8b4), "(You keep saying $2.30, when in reality they cost
$1.10)" (dfdd79aa), key-on-clipboard swap choreography (3b388170), budget policing
of a worker ("You've spent $$$$00.57, you spendthrift!" 0e10e9e6).

**Proposal:** a gitignored `.budget.json` (balance, per-gate cost history) +
`scripts/budget.mjs` that gates read before spending and decrement after. Tim
updates one number when he loads a key; agents never guess and never stall on
spend-permission (this also encodes the existing "no spend-stall" feedback memory
as machinery instead of memory).

---

## 7. Parallel-lane guardrails — three small scripts

**Verdict: AUTOMATION (small, additive to what exists).**

Parallel work keeps grazing the same three hazards; each has bitten at least twice.

**Evidence:**
- Shared-checkout contamination: a worker's suite run "includes the parallel H-36b
  worker's uncommitted in-progress combat changes" (f94d2d76); CT-1 worker tiptoeing
  around "a parallel worker's unstaged changes in the same checkout" (39ca7c28).
- Test-number collision: three parallel Fable agents all named their test U322
  (71c36dc2).
- Stale HEAD at integration: "a worker landed commits on v2-polish while I was
  reading" (71c36dc2); briefs are full of defensive scar tissue ("pull first",
  "HEAD should be X" — ≥5 explicit pins; suite baselines re-pinned 12+ times
  7726→7994).
- A worker pushed when it shouldn't have, and the correction had to be hand-baked
  into the next brief (259ae4b8).

**Proposal:** (a) a `scripts/next-test-number.sh` allocator (greps tests/, prints
the next free U/C/N number — workers call it instead of guessing); (b) extend
`scripts/lane-check.sh` to FAIL when uncommitted changes exist that the current
lane doesn't own; (c) make worktree isolation the default in the brief template for
any parallel dispatch (it's already the rule in LANE_MAP — enforce it in the
template, not prose).

---

## 8. Recurring saved form-prompts — turn the two real ones into commands

**Verdict: SKILL (two one-file slash commands). Only these two actually recur.**

- "Analyze this slowly and adversarially. Do not optimize for reassurance..." —
  hand-pasted 5× across af3dede8 (×3) and e3164592 (×2). → `/adversarial` (takes
  whatever's under discussion and runs the skeptical pass).
- "Please rearticulate" / "rearticulate before you proceed" — Tim's manual
  confirm-understanding gate, 15+ occurrences across ≥6 sessions (af3dede8,
  ce5e32d6, dfdd79aa, 558c513a, 03f005c4, 0ad17374). → cheaper as a FIX: one line in
  CLAUDE.md — "Before executing any multi-step ask from Tim, restate the plan in
  plain English and proceed (don't wait for approval unless destructive)." That
  gives him the rearticulation without the pause-for-permission he hates.

---

## 9. Layman-mode reporting — promote from memory to CLAUDE.md

**Verdict: FIX (one paragraph in CLAUDE.md).**

The plain-language rule lives in agent memory (`feedback_plain_language_state`) —
so it only protects sessions that recall it. Worker windows booted from pasted
briefs don't have it, and the jargon tax recurs there.

**Evidence (≥10 sessions):** "Holy shit. I dum primate. Pleez expayn eezier"
(e30b7ffb), "Please summarize in a paragraph before you go on and on with your
fancy talk:)" (af3dede8), "Can you explain to me what we did in plain terms (not a
coder)" (ccb3e1a8), "Sorry, what's the next move? Layman friendly" (f584e306),
"Can you please simplify your language and be much briefer?" (3b6b6411), "I get
lost in coding jargon" (9bb2d1b5).

**Proposal:** add to CLAUDE.md (which every window reads): "Tim is not a coder.
Every report ends with a plain-English 'what changed and why it matters' paragraph;
translate jargon on first use." Also add it to the WORKER_BRIEF done-schema so
worker reports carry it natively (many July reports already do this — make it law).

---

## 10. Meshy/GLB asset intake — a light pipeline script

**Verdict: AUTOMATION (borderline — only if the asset push continues).**

One 19MB session (36f8f259) was dominated by hand-dropping Meshy GLBs from
Downloads, with the same manual chain every time: load → check triangles → decimate
→ normalize scale → screenshot → register. Tim asked for the missing pieces
directly: "Are you building a library of assets?", "Can you give me a list of
assets you need for the entire demo?", "So how do I make 3d assets with lower
triangle count?"

**Proposal:** `scripts/asset-intake.mjs <glb>` — reports tris, decimates to budget,
normalizes scale, drops a showroom screenshot, appends to an asset manifest with a
"still needed" list. Build only when the next asset batch is queued (demand-pulled);
recurrence so far is concentrated in one session, so this ranks below the others.

---

## Judged NOT worth building (and why)

- **Idea capture skill** — the Idea Garden doc + echo triggers already work; Tim
  feeds it successfully ("Can you park all of this in the idea garden?" 2088ee00).
  NOTHING.
- **Model-routing advisor** — asked often early ("AM I SILLY IN THIS?" af3dede8,
  "Will Haiku be enough?" 26708aca) but now covered by CLAUDE.md's build-budget
  section + the worker-routing memory, and the July sessions show it settled.
  NOTHING (revisit if the anxiety recurs post-Fable-window).
- **Autonomous-loop harness** — Tim hand-wrote loop prompts 7+ times ("keep it at 4
  for this session" 470fbf26), but the harness now has `/loop`, scheduled wakeups,
  and background agents built in; the fix is using #1/#2 above, not new machinery.
  NOTHING new.
- **Preview 0×0-canvas black screenshots** — burned most of one session through 6
  wrong hypotheses (36f8f259), but the root cause is already captured in memory
  (`preview_black_is_zero_canvas`) with the fix recipe. Worth folding one line into
  MAPNINJA.md; not worth tooling. FIX-lite.
- **Biblioteca desktop-file shuttling** (6+ sessions of @-dropping ChatGPT research)
  — inherently manual (external tool boundary); the ingest side already works
  smoothly. NOTHING.
- **Same-bug-refixed** (Look Around ×3 sessions, "go outside" ×3, Dungeon Ref
  pitched twice) — the corpus/regression-test ritual and Idea Garden now catch
  these; the remaining instances predate those systems. NOTHING new, but it is the
  standing argument for #5's "failing test before fix" row staying non-negotiable.

---

## Interruption/error telemetry (context for the ranking)

~80 user interruptions archive-wide, heavily concentrated in orchestration-era
sessions (af3dede8: 19; e58135c1: 10) and near-zero in the July "Execute: brief"
sessions (11 of 13 fully unattended). API-error worst case: d055d8b4 (19, an
Anthropic 529 day). The trend line is the headline: **the workflow has already
evolved toward one-line dispatch + autonomous workers, and interruptions collapsed
when it did.** Items #1–#3 finish that evolution; #4–#9 sand off the residual
recurring burrs.
