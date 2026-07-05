# MR-1a — stepping through a door lands you at that door (egress writes pos; backfill demoted to repair)

Worker lane brief. Owns: playloop interior-exit seam, engine/map/spatial/tacticalPos.js (threshold
helper), guarded touch in engine/state.js backfillTacticalPositions, scripts/check.mjs (wire
playtest:position), tests/U497 (flip todo) + U498–U500. Forbidden: public/**,
engine/structures/roomOccupancy.js (parallel worker), engine/decompression/**, WORLD_VERSION.
Full prompt of record = the dispatch prompt (AGENT_CHANGELOG 2026-07-05 MR-1a entry).
Contract: docs/POSITION_AS_CANON.md §2 ("arrivals enter at the doorway they came by"), §3
(threshold crossing at the door's mapped cells), §5 (pos is hashed canon; applyDeltas only).
Evidence: MR-ORACLE layer diagnosis (PACKETS row) — engine pos jitter-teleports 49 cells/247 ft on
exit via state.js:367→backfillTacticalPositions→placeNearNode (tacticalPos.js:406 ±50-cell jitter)
because exit NULLS pos instead of writing the door threshold. Repro: `npm run playtest:position`.
Done-when: probe green ×2 byte-identical · U497 todo flipped on + green · U498–U500 green ·
playtest:position wired into npm run check + GREEN · determinism U19/21/22/27/30 green · suite green.
