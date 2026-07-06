# PW-3 — first live rumor surfacing: the built-but-dark layer gets its trigger

**Spec (read FIRST, it is the law):** `docs/briefs/PROSE_TO_WORLD_CONTRACT.md` PW-3 row +
`docs/RUMOR_LAYER.md` (lifecycle trigger #1, the S2/S3 split, the mint budget) +
`docs/REPUTATION_UNIFICATION.md` (rumorsReaching = the sole read-sink — your minted rumors flow
INTO the substrate it reads; no new read paths). PW-1 (v0.22.0) + PW-2 (b117) are landed law:
mint what canon holds, decline what it doesn't. This packet is the arc's third rung: the rumor
layer — BUILT and tested for months, with **zero live call sites** (`mintRumorForNpc`, grep: only
tests) — finally fires in real play.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.31.4 b117. Do NOT work in the main checkout.
Then `docs/WORKER_BRIEF.md`.

## Deliverable — RUMOR_LAYER lifecycle trigger #1

Player asks an NPC about a topic matching a reachable latent seed ⇒
1. **The deterministic skeleton mints in the reducer** (the engine turn path — playloop's dialogue
   answer assembly; grep `factPhrase:` ~:1008): seed → skeleton with the deterministic fallback
   body (S2). Seeded, replayable, worldHash-honest.
2. **The server's async layer may upgrade the PROSE BODY only** (S3) afterward — NEVER the
   skeleton (`server.js` async post-reducer step; the silent-fallback law holds: no key, no
   upgrade, the S2 body stands and the game never knows the difference).
3. **The mint budget:** ≤3 per scene (the cap is law — enforce engine-side).
4. **The doc-vs-code seam, fixed in passing (the contract's own instruction):** RUMOR_LAYER.md:144
   claims the rumor hash includes `verified`; `worldHash.js:37` projects only `{id, tier, age}` —
   ALIGN explicitly (doc to code, or code to doc, with the determinism ritual if the projection
   changes — a projection change moves worldHash: the living-anchor re-pin ritual applies, sole
   delta justified; if you align the DOC instead, no hash moves — pick the honest one and say why).

## Constraints

- Files: `engine/playloop.js` (the dialogue path — the serial slot is yours), `server.js` (the
  async post-reducer — coordinate NOTHING else there; Tim's U381 session historically owns its
  test fixtures, stay off `server.js` TEST fixtures), `engine/rumor/*` (the contract expects NO
  logic changes — wiring only; flag if reality disagrees), + your tests. Stay OFF
  `llmAdapter/narratorContext/composer/coherence` (landed lanes), `engine/combat/**`, `state.js`
  beyond what the projection alignment demands, `public/**`, `scripts/**`, version files.
- The LLM upgrades prose ONLY — never facts, never the skeleton, never which rumor (V15: the
  system proposes, the engine commits; V11: no LLM authority over magnitudes/choices).
- Determinism ×2 LLM-off; the S3 upgrade path proven side-effect-free on canon (upgrade then
  re-hash: only the display body differs per the projection's own law); mint budget boundary
  tested; zero numerics in surfaced rumor prose.
- npc dialogue caps stand (topic cap ≤20, NPC at player's node — Purity rule 8).

## Tests — U608–U610 (yours alone; ignore the allocator)

- **U608** (failing-first): the ask-about-a-latent-topic turn mints the skeleton + S2 body in the
  reducer (LLM-off), deterministic ×2; an unreachable/unmatched topic mints NOTHING; the budget
  caps at 3/scene with the 4th ask declining honestly in voice.
- **U609** the S2/S3 wall: with a mock upgrade, the prose body upgrades and the skeleton is
  byte-identical; upgrade failure/absence leaves S2 standing silently; canon/worldHash unmoved by
  the upgrade per the (now-aligned) projection law.
- **U610** the seam: the RUMOR_LAYER.md:144 vs worldHash.js:37 alignment — whichever side you
  aligned, a test pins it so the doc and the code can never drift apart silently again.

## Done-when

Full `node --test` green · `npm run check` GREEN · `npm run playtest:quick` clean · live playtest
(`PORT=5201 npm run dev`, LLM ON briefly): ask an NPC about a latent seed, hear the rumor surface,
ask twice more, watch the budget hold — transcript in the report · commit in YOUR WORKTREE ONLY
(no push, no main checkout, no version files) · plain-English report: the rumor you heard verbatim,
the S2 vs S3 body difference, the seam decision and why (Tim is not a coder).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
