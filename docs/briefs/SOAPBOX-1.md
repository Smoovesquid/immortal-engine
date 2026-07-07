# SOAPBOX-1 — the zealot's cause: NPCs evangelize their obsession regardless of trust

**Worker lane, Opus, executed alone. Tim-approved 2026-07-07 (soapbox design, over "just raise trust").**
**Your tests: U637, U638, U639, U640** (use ONLY these).

## Step 0 — worktree base (known trap)
Your `isolation: worktree` branches from `main` (~886 commits stale behind `v2-polish`). FIRST:
`git fetch origin && git reset --hard origin/v2-polish`; confirm `git log --oneline -1` is a recent
v2-polish commit (HEAD at dispatch: `8bb56282`, v0.32.12 b132). `npm run check` GREEN before any work.
Commit locally, atomic by path, do NOT push. Follow `docs/WORKER_BRIEF.md`.

## The mission (one breath)
Carl the failed sculptor is an avian-supremacy demagogue with an 8k-word manifesto wired as his voice
(`server/rag/corpus/carl_manifesto.json`, `voiceCorpusId:'carl_manifesto'`). But he DEFLECTS everything —
including his own obsession — because `npcBrain` gates all sharing on trust and he starts at trust 0.
A proselytizer is EAGER to preach his cause to any stranger while staying guarded about personal things;
the engine can't model that today. Add a **soapbox**: per-NPC topics the NPC volunteers on regardless of
trust. (Governing principle: `docs/THE_DM_TEST.md` — a real DM would have Carl light up, not clam up.
V11/V15 discipline: the brain still COMMITS the decision; the soapbox only flips the SHARE gate on-topic.)

## Evidence (reproduced headless, LLM-OFF, deterministic brain)
Boot the aldermere slice (`SLICE_SEED`, Bryn quickstart), `go outside`, Carl is at the settlement node
with `playerRelationship.trust:0`, `personality.trustOfOutsiders:0.2`, `voiceCorpusId:'carl_manifesto'`.
- `go talk to Carl` → dialogue OPENS (`scene.dialogue.npcId='figure_carl'`) but the opener is a guarded
  manner-beat: *"You approach Carl… open eyes meet yours. They don't step closer, and they don't ask your name."*
- `tell me about chickens` → *"That's not a thing I talk about with strangers," Carl says, wary.*
- `are you a chicken?` → same deflection.
Root cause: `engine/npc/npcBrain.js` `fallbackRules` (~L385–430) — `effectiveTrust<4 → approach:'deflect',
share:[]`. His manifesto corpus grounds his VOICE but the brain commits deflect before it matters, so it
never surfaces. All three of Tim's symptoms (won't admit the cause · tight-lipped · flat greeting) are
this one gate.

## Read first (targeted)
- `engine/npc/npcBrain.js`: `buildNpcContext` (L68, already carries `context.playerInput` L104 + a
  `personality` block L85) and `fallbackRules` (the trust ladder ~L385–430; note the existing memory-match
  trust nudge ~L360–378 as the precedent for reading `playerInput` in the decision). The decision returns
  `{ share, mood, approach, why }`.
- `engine/world/demoFigures.js` L122–130: Carl's authored record (`personality`, `voiceCorpusId`,
  `nodeSelector`) + `buildFigureNpc` (L136) which shapes the live NPC — the soapbox field must survive into
  the built NPC and reach `buildNpcContext`.
- `engine/npc/dialogue.js`: the `askNpc`/voice path (voiceCorpusId at L1005) and the beginDialogue OPENER
  (in `engine/playloop.js` ~L3060 `openerByManner`) — the greeting derives from manner; a soapbox NPC's
  opener should reflect EAGERNESS, not guardedness.
- `docs/THE_DM_TEST.md`, `docs/biblioteca` V11/V15 cards (magnitude discipline).

## The shape of the fix
1. **REPRODUCE FIRST (U637, failing on HEAD):** LLM-off, drive the sequence above; assert Carl DEFLECTS
   "tell me about chickens" today. Must be red pre-fix, green post-fix.
2. **Authored data (`demoFigures.js`):** add an optional `soapbox` to Carl —
   `{ topics:[...keywords...], cause:'avian supremacy', eager:true }`. Keywords: chicken(s), avian, bird(s),
   feather, poultry, rooster, hen, comb, beak, fowl, sculpt/sculptor/sculpture, art, form, proportion,
   supremacy, hierarchy, skull, and the manifesto's foils (duck, pigeon). Thread it through `buildFigureNpc`
   so it lands on the live NPC, and through `buildNpcContext` into the decision context (mirror how
   `personality` flows). Keep it OPTIONAL — NPCs without a soapbox behave exactly as today (prove with a
   regression assert).
3. **The gate inversion (`npcBrain.js fallbackRules`):** when `context.playerInput` matches the NPC's
   soapbox topics (whole-word / stem match — reuse the memory-match tokenizer idiom, mind the
   apostrophe-word-boundary pitfall in learnings), OVERRIDE: `approach:'evangelize'` (a NEW approach value),
   `mood:'fervent'` (or 'eager'), and open `share` to the PUBLIC facts (+ rumors) **regardless of trust**.
   **PERSONAL secrets stay trust-gated** (a zealot preaches the cause, guards personal secrets — keep the
   `personalFacts` behind `effectiveTrust>=8`). Off-topic input → the existing trust ladder, unchanged.
   Deterministic (no rng/LLM in fallbackRules — keep it that way).
4. **The voice consumes 'evangelize':** ensure the downstream voice/template path (dialogue.js) renders an
   evangelize/fervent turn as Carl HOLDING FORTH (his manifesto corpus does the live LLM content; write an
   eager, preachy, RECRUITING deterministic LLM-OFF fallback line — Tim: "he needs help rallying his fellow
   chicken-folk," so the fallback should push the cause and seek the player's help, never deflect). For
   `are you a chicken?` the on-topic path must ENGAGE eagerly, not deny — Carl is a human PROPHET of the
   cause (grounded in the corpus); if the exact "is he literally a chicken vs their prophet" lore reads
   ambiguous, engage eagerly + FLAG it for Tim, do not invent a hard canon.
5. **The opener (`playloop.js` openerByManner / beginDialogue):** a soapbox+eager NPC greets you already
   reaching for his cause ("…and you — you have the LOOK of someone who's wondered about the natural order")
   rather than the guarded "they don't ask your name." Manner-derived, deterministic.

## Determinism / boundaries
- `npcBrain` decisions are per-turn narration, NOT in worldHash; the soapbox must NOT mutate stored trust
  (it flips the SHARE gate, not the trust value) → no hash/determinism surprise. Run U19/21/22/27/30 anyway
  and state the result. NO WORLD_VERSION bump (authored data + derived decision).
- **Own:** `engine/npc/npcBrain.js`, `engine/world/demoFigures.js`, `engine/npc/dialogue.js` (voice/opener
  seam only), `engine/playloop.js` (the `openerByManner` block ONLY — playloop is a HOT 7.4k-line file,
  minimal surgical diff, nothing else), your 4 tests.
- **Do NOT touch:** version files, `engine/state.js`, `effectsCore.js`, the reputation/SP tables,
  `public/**`. Don't broaden the soapbox to other figures in this packet (Carl is the proof; note others
  for a follow-up).
- `rng.js` only randomness; LLM never throws; invariants throw; existing dialogue tests (C-prefix, U132
  stickiness, N-narration) must stay green.

## Done-when
- U637 red→green (Carl now evangelizes on-topic at trust 0).
- U638: off-topic at trust 0 STILL deflects (the trust system is intact) + a no-soapbox NPC is byte-unchanged.
- U639: personal secrets STILL gated (soapbox opens the cause, not the vault).
- U640: the eager opener differs from the guarded one for a soapbox NPC.
- `npm run check` GREEN; determinism family green; `playtest:quick` clean. Live LLM-off receipt in the
  report: the before/after of "tell me about chickens" and "are you a chicken?".

## Report
Commit SHAs (diag+fix), files, the 4 tests + suite counts, determinism statement, any LORE flag (chicken
vs prophet), and a plain-English paragraph for Tim: what changed, why Carl now holds forth, and what the
soapbox unlocks for future zealot NPCs (priests, cultists, cranks).
