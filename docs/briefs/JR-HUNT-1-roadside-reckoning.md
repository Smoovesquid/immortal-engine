# JR-HUNT-1 — the hunt meets you on the road (journey arrival runs the reckoning)

**Provenance:** MP-3's worker finding (2026-07-06, correct to leave — playloop was off its lane):
`playloop.js`'s fast-travel journey resolver returns before the per-turn `worldTick`, so a hunt due
on a fast-travel turn fires on the NEXT normal action instead. Heat is preserved — the deferral is
one turn — but hunters meeting the traveler AT THE ROADSIDE is thematically the best place for them.

**Diagnose FIRST (CONDUCTOR_FORM discipline):** map the actual turn flow — where the journey
resolver returns, where the normal per-turn `worldTick` call sits, and whether any other early
returns share the shape. Do not guess; read the path.

## Deliverable

A hunt (MP-3's `worldTick` block, `heat ≥ HUNT_HEAT`) that is due on a fast-travel turn fires ON
that turn — the hunters arrive at the journey's destination (or interrupt it; honor JR-1's existing
risk-premium/interruption semantics — COMPOSE with journey encounters, never replace them).

**The trap — NO DOUBLE-TICK:** if journey arrival now runs `worldTick` (or the hunt check), a
journey turn must not tick the world twice — thread ages must advance exactly 1 per player turn
(CONSEQ-1's U568 must stay green), heat decay exactly once, ecology once. Prefer invoking the
EXISTING exported organ at the right point (or reordering the existing single call) over any new
tick machinery. Do NOT edit `engine/worldTick.js` itself (MP-4's live lane) — playloop-side only.

## Constraints

- Files: `engine/playloop.js` (the serial hot-file slot is yours alone) + your tests. Stay OFF
  `engine/worldTick.js`, `engine/morality/**`, `engine/magic/forbiddenGates.js`,
  `engine/effectsCore.js`, `engine/instrument.js` (other live/landed lanes), `public/map/**`,
  `scripts/**`, `package.json` + `public/v1.js` (never bump versions), `server.js` fixtures.
- Determinism: same seed, same journey, same hunt tick — byte-identical `worldHash` replay; a
  no-hunt journey turn byte-identical to today (prove it — this is the regression wall).
- Hide-the-math stands: hunters arrive in the fiction, no numbers.

## Tests — U573–U574 (yours alone; ignore the allocator)

- **U573** (failing-first): script heat to just under HUNT_HEAT, cross it with a deed, fast-travel →
  the hunt fires ON the journey turn, hunters present at arrival; below-threshold journey → nothing.
- **U574** the no-double-tick wall: on a journey turn, thread `age` advances exactly 1 (U568's law),
  heat decays exactly once; `worldHash` replay byte-identical ×2; a plain walk turn unchanged.

## Done-when

Full `node --test` green · determinism green · `npm run playtest:quick` clean · `npm run check`
GREEN · live playtest per `docs/PLAYTEST_PROTOCOL.md` (drive an over-threshold fast-travel in the
browser, watch hunters meet the road; `PORT=5186 npm run dev`) · commit in YOUR WORKTREE ONLY
(no push, no main checkout) · plain-English report with commit SHA, files, test counts, and the
turn-flow diagnosis you made (Tim is not a coder — translate jargon).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
