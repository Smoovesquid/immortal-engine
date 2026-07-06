# DEATH-2 — the beg and the four verbs: mercy becomes possible, and it counts

**Spec (read FIRST, it is the law):** `docs/DEATH_CONTRACT.md` §3 in full (the DYING state · the
beg · the four verbs) + §5's DEATH-2 row + §6 falsifiers + §1 invariants. DEATH-1 is LANDED
(`4de584e1` — the death fact assembles at every kill; DOWNED is built, save/load-proven, and
FLAGGED OFF behind `dyingEnabled`; the killer-intent routing seam defaults to `clean`; its audit
`briefs/DEATH-1-audit.md` maps every 0-HP seam you will touch). The moral-physics constitution is
law (MP-1..6, b101–b113) — your verbs WIRE INTO those live organs, they invent nothing.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.31.1 b114 (`9440b18e`), `engine/combat/deathFact.js`
exists, and `dyingEnabled` is present and OFF. Do NOT work in the main checkout. Then
`docs/WORKER_BRIEF.md`.

## Deliverables (§3, whole — the killing-blow PROSE is DEATH-3's, not yours)

1. **Flip `dyingEnabled`** — DOWNED goes live for communicators (capability-gated by the bestiary
   record `canCommunicate`; beasts/mindless die outright — §6 falsifier: a creature that cannot
   communicate NEVER begs). The deterministic dying clock runs; walking away lets it finish.
2. **The beg:** cornered (flee unavailable/failed) + communicator + DOWNED-or-hopeless (engine
   computes hopelessness from odds, not vibes) ⇒ the NPC MAY beg, personality-driven (the seven
   axes + faction + self-preservation): **for life** or **for a quick death** — two distinct pleas
   CHOSEN BY THE ENGINE (seeded; some proud ones never beg — defiance is an answer). The plea's
   VOICE is the LLM's, in-character, through the existing npc-voice path — the engine hands it the
   plea TYPE and the persona, never prose-authority over WHICH plea (V11: direction yes, magnitude
   never; LLM-off fallback line included).
3. **The four verbs, all real deeds, all witnessed, all through the LANDED organs:**
   - **Mercy** — quick clean kill on plea or unprompted: deed killing, mercy-flagged — EXTENDS F6's
     boundary (quick-kill of a begging foe ≠ butchery; U556's law grows a case, it does not break).
   - **Worse** — the example-making: HEAVY+ cruelty, pact-relevant (MP-4's corruption feels it),
     the gods lean in (witnesses[] already carries them from DEATH-1).
   - **Sparing — at your own peril:** stabilize/bind/release costs REAL actions while allies still
     fight + supplies; mints a LIVING WITNESS with memory — the spared may owe, may spread the tale
     (mercy travels the SAME rumorsReaching engine as atrocity — **the first strong POSITIVE claim
     source**; REPUTATION_UNIFICATION's sole-sink law holds, no parallel path), or may BETRAY
     (personality + seed, engine-owned odds — the peril made real).
   - **Walking away** — abandonment, its own deed kind (≠ mercy ≠ cruelty); witnesses read it as
     exactly what it is.
4. **Intent routing completes:** the four verbs set `killerIntent` (mercy|worse|clean|—) on the
   death fact; abandonment's fact records the clock, not a blow.

## Constraints

- Serial slot: `engine/combat/escapeCombat.js` + `engine/combat/**` + `state.js`/`invariants.js`
  (EVERY new enemy field joins the ensureCombat whitelist at state.js:730 + normalize + the
  invariants enemy loop — the trap is proven live) + the deed/moral seams you WIRE (recordDeed
  with the landed NPC-honest attribution; rumorsReaching read-side untouched) + your tests.
  Stay OFF `playloop.js` beyond the existing combat verb seam (flag if more), `worldTick.js`
  internals (the organs fire through existing calls), `public/**`, `scripts/**`, version files,
  `server.js` fixtures.
- Intent phrasing for the verbs routes through the EXISTING intent translator (INT house law) —
  "I give him a clean death" / "make an example of him" / "bind his wounds" / "leave him" must
  resolve as the right verb from typed free text; the LLM interprets, the engine commits.
- Determinism ×2 whole-fight incl. beg choice + betrayal odds (seeded streams); no numerics in any
  player-facing string; fair combat never stains (U556 + its new mercy case); boot anchor
  untouched; screen goldens locked (combat_one_defeated included — DOWNED's visual is a FUTURE
  renderer packet, do not draw it).
- Gore is LAW; consequences never soften.

## Tests — U599–U601 (yours alone; ignore the allocator)

- **U599** the beg algebra: capability + cornered + hopelessness gates; two plea types seeded-
  deterministic; the proud never beg; the speechless NEVER beg (§6 falsifier verbatim); dying
  clock runs and finishes on walk-away.
- **U600** the four verbs as deeds: each verb mints its honest deed kind (mercy-flag NOT cruelty —
  the F6 extension case; worse = HEAVY+ cruelty feeding heat/pact; sparing mints the living
  witness + the POSITIVE claim that travels via rumorsReaching to a neighbor node; abandonment its
  own kind); betrayal odds engine-owned + seeded; player record honest throughout.
- **U601** the wall: byte-identical replay ×2 of a full beg→verb fight for EACH verb; `dyingEnabled`
  regression — every pre-DEATH-2 combat test stays green with the flag ON (the flip is the packet's
  riskiest bit — prove the old kill paths still resolve); zero numerics run-wide.

## Done-when

Full `node --test` green · `npm run check` GREEN · `npm run playtest:quick` clean · live playtest
(`PORT=5198 npm run dev`, LLM on for the plea voice, a handful of turns): corner a bandit, hear the
beg, try mercy in one run and sparing in another — screenshot both · commit in YOUR WORKTREE ONLY
(no push, no main checkout, no version files) · plain-English report: the beg you heard verbatim,
each verb's consequence chain, and what DEATH-3 (the prose) inherits (Tim is not a coder).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
