# CG-2b — the cure must beat the disease (validator swap rule)

**Model:** Claude Sonnet (engine-adjacent lane — `engine/coherence/` + one guarded llmAdapter seam).
**Your tests: U482–U484** (assigned manually — the allocator can't see the in-flight map lane's
U478–U481; do NOT take numbers from `next-test-number.sh` this run).
**Spec of record:** `docs/PACKETS.md` §CG-2b (controlling — allowed/forbidden/done-when) ·
`docs/briefs/COHERENCE_GATE.md` (the CG arc design) · `engine/coherence/validator.js` header comments
(the three COHERENCE_VALIDATE modes — the OFF-mode byte-identical guarantee is sacred).
**Provenance:** Tim's 2026-07-05 on-screen review of the GATE 2026-07-05 shadow-compare log. His
ruling: **"fix first, watch meanwhile"** — watch mode is already ON locally; the live flip is
blocked on THIS packet.

## The evidence record (verbatim — the raw log is gitignored, so it's pasted here; also use it as your fixture)

```json
{"type":"coherence-validate","ts":"2026-07-05T12:30:06.907Z","seed":"tallow","persona":"campaign","input":"The broken locket — I open it. Is there a portrait or anything inside?","dm":"The locket clicks open at Wayfarers' Outpost's midday light, revealing nothing inside — the hinge is intact, but both chambers are bare and empty.","wouldBlock":true,"fallbackKind":"base","fallbackText":"Wizard: Elske Nightherd shrugs. \"Can't say. No record I've ever seen.\"","pointers":[{"class":"CG-6","seed":"tallow","persona":"campaign","turn":null,"span":"The locket clicks open at Wayfarers' Outpost's midday light, revealing nothing inside — the hinge is intact, but both chambers are bare and empty.","canonField":"clock.segment","expected":"morning","narrated":"afternoon","severity":"fail"}]}
```

What it proves: the detector was RIGHT (canon `clock.segment=morning`, prose said "midday light" —
a true, cosmetic canon miss) and the replacement was WORSE (the deterministic base for that turn was
a non-sequitur NPC "no record" dodge — the exact pattern INFO-HONESTY banned). The validator's
current rule trusts the fallback blindly; this record proves the fallback can fail harder than the
candidate.

## Step 0 — self-assemble (FIRST)

1. `git fetch origin && git reset --hard origin/v2-polish`; confirm `git log --oneline -1` is recent
   v2-polish (this brief must exist in your worktree — if it doesn't, your reset didn't happen).
2. Read `engine/coherence/validator.js` + `checks.js` (SEVERITY, SINGLE_TURN_DETECTORS) +
   the llmAdapter.js finalize seam that consults `coherenceRejects` (grep `COHERENCE_VALIDATE` /
   `coherenceRejects` in `engine/llmAdapter.js`).
3. `npm run check` green BEFORE editing.

## The three rules to build

1. **Severity tiering.** Add a per-detector-class tier map (in `checks.js` or alongside SEVERITY —
   your call, keep it declarative). `CG-6` (clock/time-word desync) = `cosmetic` at minimum; judge
   each other class yourself and document the choice in the map's comment — the default for
   anything unlisted stays the current blocking behavior. A cosmetic-tier detection NEVER blocks in
   any mode: shadow-compare logs `wouldBlock:false, tier:"cosmetic"` (keep the pointers in the
   record); ON mode delivers the candidate unchanged.
2. **The swap gate (the cure must beat the disease).** Wherever the block decision commits (validator
   or adapter seam), before any replacement: run the SAME detector bank over the fallback text
   against the SAME canon bundle. The swap happens ONLY if the fallback's failure set is strictly
   better than the candidate's (fewer/lower-tier fails; define "strictly better" conservatively and
   test it). Otherwise the candidate stands and the log records both results
   (`fallbackFails:[...]`, `swapDenied:"fallback-not-better"`).
3. **Label the log.** Thread real persona/turn identifiers into shadow-compare records — today they
   arrive as `persona:"campaign"`, `turn:null`. Source them from whatever the narrate request
   actually carries; if the request genuinely has no persona (live play), label it `live`. Do not
   invent fields on world state to carry this — request-scoped plumbing only.

## Hard constraints

- **`COHERENCE_VALIDATE` unset/off stays BYTE-IDENTICAL** — the dark-mode guarantee has tests; keep
  every one green. The LLM layer never throws (silent-fallback law) — a crash in your new code paths
  must degrade to delivering the candidate.
- **forbidden:** world state writes, rng, `WORLD_VERSION`, `playloop.js`, `dialogue.js`, `grace/`.
  If the seam seems to demand one of those → STOP, write a scoped proposal in your report.
- No paid gate (`scripts/dm-playtest.mjs`). Free ladder only.
- Determinism ladder U19/21/22/27/30 + convergence 100% + full suite green.

## Tests (U482–U484)

- **U482 — the locket fixture:** replay the evidence record (candidate + canon bundle with
  `clock.segment:"morning"` + the dodge fallback). Assert: shadow-compare logs
  `wouldBlock:false, tier:"cosmetic"`; ON mode delivers the candidate unchanged.
- **U483 — the swap gate, both directions:** (a) synthetic hard-fail candidate (e.g. names a dead
  NPC as present — pick a real detector class) with a CLEAN fallback → swap happens; (b) same
  candidate with a fallback that fails equal-or-worse → candidate stands, `swapDenied` logged.
- **U484 — labels + never-throw:** records carry real persona/turn (or `live`); a detector bank that
  throws mid-fallback-recheck still delivers the candidate (silent-fallback law).

## Commit & report protocol

- Commit IN YOUR WORKTREE, atomic by path, `fix(coherence): CG-2b — <what>`; do NOT push; do NOT
  touch the main checkout. Basecamp integrates.
- Append your dated section to `docs/AGENT_CHANGELOG.md` (append-only) in your worktree.
- Final report: commit SHA, files changed, tests with pass counts, the tier map you chose (with your
  reasoning per class), residual risk, and a plain-English paragraph for Tim (what was broken / what
  changed / why it matters). Honest partials over rationalized dones.
