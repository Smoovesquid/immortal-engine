# MAP-OCC-2 — position hygiene: pixels out of the determinism fingerprint

**Model:** Claude Sonnet. **Lane:** engine-tiny (no hot files). **Your tests: U396–U397.**
**Packet of record:** `docs/PACKETS.md` → MAP-OCC-2 (spec'd 2026-07-03). This brief inlines it.

## Why (one breath)

"The map never affects the world" must be structural, not good manners. Today pixel `ux/uy`
render coordinates sit INSIDE the worldHash: `engine/crunchHashProjection.js` `projectMember`
spreads `...m` with `position` included. Determinism holds only because the engine never
authors ux/uy (only the renderer does) — an accident of authorship. Worse, the live comment at
`public/v1.js:2224` claims *"position is excluded from hash projection"* — **false**, and it
will mislead the next editor into silently breaking U21.

## The fix

1. `engine/crunchHashProjection.js` — drop `position` (or specifically its ux/uy pixel fields)
   from the hashed member projection in `projectMember`.
2. `public/v1.js:2224` — make the comment true (ONE line; touch NOTHING else in v1.js — another
   lane is active in that file today; keep your hunk to the single comment).
3. New guard test **U396**: hash a world → write `party[0].position.ux/uy` → re-hash → assert
   **EQUAL** (pre-fix this differs; post-fix equal). **U397** if you need a second file for the
   NPC/member variant.

## Cautions

- Dropping a field from the projection CHANGES hash values for worlds whose members carry
  `position`. Replay-equality tests (U19/U21/U22/U27/U30) compare hash-vs-hash so they should
  stay green — but if any test asserts a hash LITERAL, update it per that test's documented
  intent and say so in your report.
- **Forbidden:** removing `position` from *state* (`engine/map/spatial/positioning.js` +
  `invariants.js` expect the field); wiring the dark `engine/adjudication/spatialRulings.js`
  layer (leave it dark); any other v1.js change; `WORLD_VERSION`; rng.

## Done-when

- U396 proves a renderer ux/uy write does NOT move worldHash; full suite + determinism green
  (`node --test`); `npm run convergence` 100%.
- One local commit on your branch (do NOT push): `fix(map): MAP-OCC-2 — pixel position out of
  the determinism fingerprint; the "excluded" comment is now true`.

## Rollback

Revert both edits.

## Report (plain English for Tim)

What was broken (the map's pixel coordinates were secretly part of the world's fingerprint —
safe only by luck), what changed, why it matters (now it is physically impossible for drawing
the map to alter the world).
