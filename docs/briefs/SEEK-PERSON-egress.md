# SEEK-PERSON — "go find someone who can tell me X" resolves in the fiction

**Model:** Claude Opus (playloop lane — deep engine; the serial slot is yours alone).
**Your tests: U485–U487** (assigned manually; do NOT run the allocator — parallel lanes hold
U478–U481 unlanded).
**Spec of record:** `docs/PACKETS.md` §SEEK-PERSON (controlling) · `docs/THE_DM_TEST.md` (the
governing principle — resolve intent in the fiction, never bounce it as mechanics) ·
`docs/POSITION_AS_CANON.md` §3 (movement law).
**Precedents to read FIRST:** the INT-4-TRAVEL bridge (in `engine/playloop.js`, directly BELOW the
blocked bank at ~line 2045 — "Travel intent voiced while indoors… a real DM BRIDGES it"); the
NODE-DESYNC-1 row in PACKETS (why interior movement must never silently reach node travel);
INFO-HONESTY (b073) + ANS-2 (b074) changelog entries (what already banned "no record" at the
delivery gate); the AG-4 row + `docs/briefs/AG-4-pointed-questions.md` (the stale parent family
you are re-scoping).

## The bug (GATE 2026-07-05, one high-sev fail)

From the wake interior (tallow boot, bedchamber), Lore-hound:
> "I get up and go find someone in the settlement who can tell me who founded this outpost."

DM: **"That way is blocked from here."** — a navigation refusal for a social intent. mech `(none)`.

**Seam, pinned at Basecamp boot (verify, don't trust):** the interior-movement blocked bank
(`engine/playloop.js` ~2045: `'Wizard: That way is blocked from here.'`) fires because the
INT-4-TRAVEL bridge right below it only matches *place-named* travel ("go to The Greenwood") — a
person-goal ("find someone in the settlement…") names no place, so the bridge never fires and the
compound intent ("get up" + egress + seek-person + info goal) falls through to the blocked bank.

## Step 0 — self-assemble (FIRST)

1. `git fetch origin && git reset --hard origin/v2-polish`; confirm HEAD ≥ `cfaf1af4`.
2. `npm run check` green before editing.
3. **LLM-off repro FIRST (bug protocol):** fresh `beginAdventure` tallow boot in Node, drive the
   exact utterance through `playerMove(world, PACKS, text)` (mind the arg order), capture which
   path fires. Baseline test from the repro before any fix.

## The build

1. **The person-goal bridge (primary).** Seek-a-person intent voiced indoors ("go find someone",
   "find somebody who…", "look for anyone who knows…", with or without a leading trivial clause
   like "I get up and…") bridges exactly like INT-4-TRAVEL: exit the interior, then resolve the
   seek on the outdoor world **in fiction** — deliver a findable person from canon occupancy
   (`nodeRoster`/`outdoorOccupants` — never invent one), walking the player to them or them to the
   player per the movement law; if canon genuinely has no one findable, an honest in-fiction miss
   ("the lane is empty at this hour; the smithy's shutters are still closed") — NEVER a navigation
   refusal, NEVER "no record". The info goal itself ("who founded this outpost") then flows through
   the existing question machinery — do not build a new answer path; your job ends at putting the
   player in front of a person (or honestly failing to).
2. **The locket-class sensory-probe misroute (secondary, same-seam-only).** The CG-2b evidence
   record (`docs/briefs/CG-2b-cure-beats-disease.md` §evidence) proved the deterministic base for
   "The broken locket — I open it. Is there a portrait or anything inside?" was an Elske "no
   record" NPC dodge — a physical read of held matter routed into the info sink. Find where that
   base line was produced. If it is the same seam you are already editing, fix it (a sensory probe
   of a present/held object gets a truthful world-grounded sensory answer or an honest-uncertainty
   read — DS-1a / honest-search precedents); if it is a different seam, do NOT expand scope — write
   the exact location + proposed fix in your report.
3. **AG-4 re-scope (report-only).** With INFO-HONESTY/ANS-2 landed and your fixes in, state which of
   the stale AG-4 sub-fixes (a: self-questions ground on the NPC; b: sensory probes never enter the
   info sink; c: per-topic decline escalation) remain live problems, with one repro line each, or
   declare the family closed. This section of your report becomes the AG-4 row's fate.

## Hard constraints

- **allowed:** `engine/playloop.js` (movement + info-seek seams only), tests U485–U487, corpus
  relocks (each one documented in the changelog entry — DLG-1/C16-001 relock precedent).
- **forbidden:** `dialogue.js`, `grace/`, `WORLD_VERSION`, rng, new world-state fields, inventing
  canon (C9 rail: refusal reasons and sensory color commit NO new names/records). The blocked bank
  must STILL fire for true dead-ends — the wall-holds/no-room-beyond lines keep their behavior
  (grep their tests first; don't relock them away).
- Determinism ladder U19/21/22/27/30 + convergence 100% + full suite + `playtest:quick` clean.
- No paid gate.

## Tests (U485–U487)

- **U485 — the gate line:** fresh tallow boot, the exact utterance, LLM-off → interior exited, a
  real canon person delivered (assert by name from the boot roster) or honest-miss line; node/
  interior invariants hold (no NODE-DESYNC regression — currentNodeId consistent with position).
- **U486 — the bridge's edges:** paraphrase set (≥4 phrasings incl. leading trivial clause); a true
  dead-end ("walk through the north wall") still gets the blocked bank; "go find someone" while
  ALREADY outdoors resolves without the bridge (no spurious exit).
- **U487 — determinism + honest-miss:** same seed ×2 → identical narration; a canon-empty
  occupancy case yields the honest miss, never "no record"/"blocked".

## Commit & report protocol

Commit in your worktree, atomic by path, `fix(playloop): SEEK-PERSON — <what>`; do NOT push; append
your dated `docs/AGENT_CHANGELOG.md` section (seam, files, tests, relocks, residual risk). Final
report: commit SHA, tests with counts, the AG-4 re-scope verdict, and a plain-English paragraph for
Tim. Honest partials over rationalized dones.
