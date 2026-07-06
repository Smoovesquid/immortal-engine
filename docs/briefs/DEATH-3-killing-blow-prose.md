# DEATH-3 — the killing-blow prose: as gory as the fact honestly supports

**Spec (read FIRST, it is the law):** `docs/DEATH_CONTRACT.md` §3's final bullet + §5's DEATH-3 row
+ §6 falsifiers + §1 invariants. The TABLE TEST governs: what a great DM gives a kill. DEATH-1/2
are LANDED — every kill carries a full §2 death fact (means, woundPath, stance, intent, witnesses,
light, locale; beg state included); your packet turns that fact into PROSE and GUARDS the
agreement, forever.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.31.2 b115, `engine/combat/deathFact.js` +
`downedResolve.js` exist. Do NOT work in the main checkout. Then `docs/WORKER_BRIEF.md`.

## Deliverables

1. **The prompt surface (the omen-line idiom, MP-5a's precedent):** at a kill turn, the DM prompt
   receives the death fact's FICTION-FACING fields (means, stance, woundPath as wounds-in-words,
   killerIntent, light/locale, beg state) — never a number, never a mechanic name. The LLM writes
   the blow means-tailored (an axe death is not an arrow death is not a fire death), stance-aware
   (a beggar's death reads differently than a duelist's), as gory as the fact pattern HONESTLY
   supports. Prose at full craft; tone tracks the fiction, never a verdict on the player (the
   McCarthy correction stands).
2. **The LLM-off base line:** the silent-fallback narration composes a real killing-blow line FROM
   the fact fields (means + stance + intent template family, deterministic) — the kill reads as a
   kill without the API, byte-stable.
3. **THE CG DEATH CLASS (the guard, forever):** a new detector in the coherence bank
   (`engine/coherence/checks.js`) asserting prose⇄fact agreement on the kill turn: the prose may
   not contradict the fact's means/victim/stance/intent (a "clean mercy" fact never reads as
   torture; an arrow fact never reads as an axe). Tier it per CG-2b's map: contradiction =
   STRUCTURAL (blocks — the validator is LIVE, so your tiering choice has real teeth: prove the
   detector on fixtures before it ever sees live traffic); wording looseness = cosmetic/WARN.
   Extend the shadow log labels. The swap rule stands: the fallback must beat the candidate or no
   swap.
4. **Corpus locks:** lock the LLM-off kill lines for the scripted verb fights (mercy/worse/clean/
   abandon × a means or two) into the convergence corpus — the regression net for the base prose.

## Constraints

- The narration lane is yours alone: `engine/llmAdapter.js`, `engine/ai/narratorContext.js`,
  `engine/composer.js` (base line), `engine/coherence/checks.js` (+ its tier map), corpus fixtures,
  + your tests. Stay OFF `engine/combat/**` (read the fact, never write it), `playloop.js`,
  `state.js`, `worldTick.js`, `public/**`, `scripts/**`, version files, `server.js` fixtures.
- Zero numerics anywhere (U578's wall pattern). Determinism: LLM-off lines byte-stable ×2;
  corpus relocks documented individually (taste-critical lane — the OCC-STORY-1 ritual).
- Gore is LAW (the contract's ship-gate note): the prose does not flinch, and it never invents
  beyond the fact — gory-honest, not gory-embellished. No beg prose for the speechless (§6 —
  DEATH-2 gates the STATE; your prose layer must not conjure a plea the fact doesn't hold).
- Boot anchor untouched; screen goldens locked.

## Tests — U602–U604 (yours alone; ignore the allocator)

- **U602** the base line: LLM-off kill prose composes from the fact (axe≠arrow≠fire families;
  beggar≠duelist stance; mercy reads merciful; abandonment reads cold); byte-stable ×2; zero
  numerics; no plea language when the fact holds none.
- **U603** the CG death class: fixture turns — a contradicting candidate (mercy fact, torture
  prose) BLOCKS as structural with the fallback strictly better; a loose-but-honest candidate
  passes; cosmetic wording lands WARN-tier never blocking; labels threaded.
- **U604** the wall: corpus locks green; prompt carries no numerics/mechanic names; the six screen
  goldens + the existing 131 convergence locks unmoved except your documented kill-line additions.

## Done-when

Full `node --test` green · `npm run check` GREEN (the new corpus locks counted) ·
`npm run playtest:quick` clean · live playtest (`PORT=5199 npm run dev`, LLM ON, a handful of
turns): one mercy kill and one brutal kill — capture both blows' prose, verbatim, in the report ·
commit in YOUR WORKTREE ONLY (no push, no main checkout, no version files) · plain-English report:
the two blows you read, the CG class's tiering rationale, every corpus relock listed (Tim is not a
coder).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
