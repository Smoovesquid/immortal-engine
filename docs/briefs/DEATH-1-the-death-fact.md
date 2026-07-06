# DEATH-1 — the death fact: the atom, the DOWNED state, the killing-blow verbs

**Spec (read FIRST, it is the law):** `docs/DEATH_CONTRACT.md` — Tim's direct commission (taste
given: gory, kill-tailored, loss-delivering; never soften the facts). This packet is §5's DEATH-1:
the §2 DEATH FACT atom · the DOWNED/dying state for communicators · killing-blow verb routing.
§1's invariants and §6's falsifiers bind everything. §0 lists the live organs you ride — do not
rebuild them.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.31.0 b113 (`8bb7781b`). Do NOT work in the
main checkout. Then `docs/WORKER_BRIEF.md`.

## AUDIT FIRST (the contract's own order — commit the diagnosis before building)

Map current 0-HP handling end-to-end in the LIVE combat engine — `engine/escapeCombat.js` is the
hook-point (house law: features must hook escapeCombat or they never run in v1; the OTHER combat
engine is dead code). What happens today at enemy 0 HP? At player 0 HP? Where does "defeated"
state live, what consumes it (TT-MINIS corpse minis read something), and where would DOWNED sit
between fighting and dead? Name every seam in your report.

## Deliverables (§2 + §5's DEATH-1 scope — NOT the beg/prose/elegy, those are DEATH-2..4)

1. **The DEATH FACT atom** — assembled by the engine at the killing moment, pure
   f(world, combat log): `{ victim, killer, means, woundPath (this fight's accumulated wounds —
   the blow that opened the thigh in round 2 finishes through it), locale + light + weather,
   witnesses[] (occupancy truth), victimStance (fighting|fleeing|begging|helpless|defiant),
   killerIntent (clean|brutal|mercy|worse), finalWords? }`. Stored canonically (§2) — which means
   the **WORLD_VERSION protocol** applies if you add stored state: follow CLAUDE.md's
   When-Bumping checklist to the letter (ensureWorld defaults · invariants · old-save warn ·
   grep version-embedded test strings · full suite · playtest:quick). If you find an additive
   no-bump path that is HONEST (the lazy-record precedent), prefer it and justify; never force
   either way — the contract pre-authorizes the bump.
2. **DOWNED/dying** for communicators (the state DEATH-2's beg fires from): a real combat state
   in escapeCombat — entered deterministically at the 0-HP boundary for beings that can plead,
   skipped for the speechless (§3's "no beg from the speechless" is DEATH-3's prose rule, but the
   STATE gate lives here). **THE ensureCombat WHITELIST TRAP:** any new combat-enemy field must
   join `ensureCombat`'s whitelist in `engine/state.js` or it is silently stripped (bit DX-2d-i;
   the contract cites it).
3. **Killing-blow verb routing** — the moment produces the fact with `killerIntent` from the
   player's actual verb/intent (clean kill vs brutal vs the mercy/worse verbs land in DEATH-2;
   here the ROUTING seam exists and defaults honestly). Wound accumulation (`woundPath`) tracked
   through the fight deterministically.

## Constraints

- `escapeCombat.js` + `state.js` (+ `invariants.js`) are your serial hot files — nothing else is
  in flight, the slot is yours. Stay OFF `playloop.js` beyond what the combat seam already
  requires (flag if more), `worldTick`/morality organs (READ them — the fact feeds MP organs in
  DEATH-2, not here), `public/**`, `scripts/**`, version files, `server.js` fixtures.
- Determinism: same fight, same seed, same fact, ×2. `rng.js` only. Combat replay tests and the
  DX traits-as-code suite must stay green. Screen goldens locked (combat_one_defeated golden —
  your DOWNED state must not drift it; if DOWNED is drawn later that's a future renderer packet).
- Never duplicate U454-E's anchor; if stored state moves the boot fingerprint, the WORLD_VERSION
  protocol subsumes it (documented).
- Gore is LAW per the contract's ship-gate note — the fact records what happened, never softened.

## Tests — U596–U598 (yours alone; ignore the allocator)

- **U596** the atom: a scripted fight → the death fact assembles with every §2 field truthful
  (woundPath matches the fight's actual blows; witnesses = occupancy truth; stance/intent honest);
  pure — no fact without a death, byte-identical ×2.
- **U597** DOWNED: a communicator at 0 HP enters DOWNED (not dead) deterministically; the
  speechless die outright; ensureCombat preserves the new fields (the whitelist trap test);
  defeat/corpse behavior for non-communicators byte-identical to today.
- **U598** the wall: WORLD_VERSION protocol proven if bumped (old save warns + upgrades) OR the
  additive path proven boot-stable; full replay determinism; no numerics in any player-facing
  string this packet adds.

## Done-when

Full `node --test` green · `npm run check` GREEN · `npm run playtest:quick` clean (+ `playtest:full`
if WORLD_VERSION bumped — state-shape law) · live playtest (`PORT=5197 npm run dev`): a real fight
to the killing moment, screenshot the turn · commit in YOUR WORKTREE ONLY (no push, no main
checkout, no version files) · plain-English report: the 0-HP audit, the atom, the schema decision
(bump or lazy) with rationale, and what DEATH-2 can now hang the beg on (Tim is not a coder).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
