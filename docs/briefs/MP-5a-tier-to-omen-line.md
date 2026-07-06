# MP-5a — surfacing: the DM hears the tier, never the number (the omen line)

**Spec (read FIRST, it is the law):** `docs/MORAL_PHYSICS.md` §5 — the DM prompt gains ONE line per
moral turn: the tier and the sign-vocabulary of the dominant axis (MORALITY_SYSTEM "Manifest karma"
— the Greed-god's coins and hoarding crows, the Wrath-god's people who yield before you speak).
Never a number, never "you gained corruption." Tier chooses LOUDNESS: T1 a faint sign … T4 the gift
on the doorstep. Prose stays at full craft always — tone tracks the FICTION, never a verdict on the
player (the 2026-06-07 McCarthy correction; there is no link from morality to prose quality).

**SLICE NOTE — this is MP-5a, not all of MP-5:** the Cassandra beat (a person who sees you clearly
and says the hard thing once at the T2→T3 boundary) needs a boundary-crossing latch in the tick
path, which is MP-4's live lane — it is EXCLUDED here and ships as MP-5b after MP-4 lands. Your
packet: the prompt line only. NO worldTick/state edits of any kind.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.30.8 (`9cd1fe28`). Do NOT work in the main
checkout. Then `docs/WORKER_BRIEF.md`.

## Deliverable

- The DM system-prompt assembly (`engine/llmAdapter.js` / the composer's prompt seam — find the
  ONE assembly point; study how MR-2b's DOORS line and MR-3c's TERRAIN line landed, they are the
  house idiom for exactly this) gains a moral-omen line derived READ-ONLY from landed state:
  the actor's current tier (deed records carry `tier` since MP-2; heat/hunt state since MP-3) and
  the dominant axis's sign vocabulary.
- **Vocabulary is data, not prose:** a small named table (axis → 2-4 sign phrases, MORALITY_SYSTEM's
  manifest-karma register) the line samples DETERMINISTICALLY (seeded from world state — `rng.js`
  discipline; no Math.random, no LLM authority over which sign).
- **Loudness by tier:** T0 = NO line at all (unremarked means unremarked); T1 faint; T2 the rumor
  register; T3 the hunted register; T4 the claimed register. One line, never more.
- **Invariant I (hard):** nothing numeric — no tier number, no heat, no corruption value — reaches
  the prompt or any player-facing string. The LLM receives register + vocabulary only.
- LLM-off (base narration) behavior is UNCHANGED — this is a prompt-side surfacing; the silent
  fallback path must be byte-identical.

## Constraints

- Files: the prompt-assembly seam (`engine/llmAdapter.js` and/or `engine/composer.js` — whichever
  the doors/terrain idiom actually uses), a small new vocabulary module under `engine/morality/`
  if cleaner, + your tests. Stay OFF `engine/worldTick.js`, `engine/magic/forbiddenGates.js`,
  `engine/escalation.js`'s magnitudes (read-only), `engine/effectsCore.js`, `engine/instrument.js`,
  `playloop.js` (JR-HUNT-1's lane), `public/map/**` (WILD-SCALE-1's lane), `scripts/**`,
  `package.json` + `public/v1.js` (never bump versions), `server.js` fixtures.
- Taste-critical lane: you are the ONLY narration lane in flight. If corpus/convergence fixtures
  need relocks because a prompt fixture captures the new line, relock honestly and DOCUMENT each
  (the OCC-STORY-1 relock ritual); if base-narration outputs move, that is a FAILURE (the line is
  prompt-side only).
- `worldHash` untouched (read-only surfacing; prove the default boot anchor unchanged).

## Tests — U577–U579 (yours alone; ignore the allocator)

- **U577** the line's algebra: tier 0 → absent; tiers 1–4 → the right register; dominant-axis
  vocabulary selection deterministic (same world → same sign, ×2); no digit characters in the line.
- **U578** invariant I wall: scripted high-heat/high-corruption world → prompt contains NO numeric
  moral value anywhere; LLM-off narration byte-identical to pre-packet for the same world.
- **U579** determinism + fallback: default-boot U454-E anchor unchanged; silent-fallback path
  byte-identical; the line survives a save/load round-trip (derived, not stored).

## Done-when

Full `node --test` green · `npm run check` GREEN · live playtest per `docs/PLAYTEST_PROTOCOL.md`
with the LLM ON (the .env key; keep it to a handful of turns — the omen line visible in a real
moral moment; `PORT=5188 npm run dev`) · commit in YOUR WORKTREE ONLY (no push, no main checkout)
· plain-English report: commit SHA, files, test counts, the actual line text at each tier, any
relocks documented (Tim is not a coder — translate jargon).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
