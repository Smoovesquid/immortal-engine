# WS-2 — one camera, player-centered: the map re-orients around you

**Model:** Claude Sonnet (renderer lane — `public/map/`). **Your tests: U407–U408.**
**Spec of record:** `docs/MAP_PATH.md` Phase 1.2 (+1.3 where cheap) · `docs/POSITION_AS_CANON.md` §6
(camera law, revised 2026-07-04-pm) · WS-1's landed rail (`public/map/worldSpace.js`,
`resolveEntityWu` — commit `cf9455e`). Read these first.

## The law you are implementing (Tim, 2026-07-04)

**The camera keeps the player centered.** As the player moves, the map re-orients around them — you
never move toward an edge, because there are no per-place sheets and no edges: ONE continuous sheet
covers all the space. Manual pan-to-look stays legal (the map is a read-only aid); the next player
movement re-centers. No zoom button, no scale tabs, no mode switches.

## Scope

1. **One camera model** `{cx, cy, z}` (center in world units, z = px/wu) for the continuous map, with
   wheel-zoom + drag-pan and LOD bands (county → settlement → building detail fading by zoom) — this
   largely exists in `continuousMap.js`; unify and make it THE camera for both the in-play embed and the
   fullscreen Map screen (they already share `renderContinuousMap`; kill any remaining per-surface camera
   forks or fixed-scale seams that are cheap to kill — MAP_PATH 1.3; if a seam is NOT cheap, defer it and
   flag).
2. **Follow-the-player default:** on every player move/turn, the camera re-centers on the player's
   position **read through WS-1's `resolveEntityWu`** (node → outdoors or room-granular indoors). Manual
   pan sets a "user is looking" state; the next player movement snaps focus back. (`cameraFor` recenter
   logic exists for node changes — generalize it to every move + room change.)
3. **Marker through the rail:** the player marker/dot position derives from `resolveEntityWu` — retiring
   the last legacy walk-pos-only placement for the MARKER (pixel `ux/uy` remains only as animation tween
   toward that truth). This closes VG-F3 (marker lags rooms / inside↔outside) on the live surface.
4. **Scale tabs:** if any fixed-scale tab UI remains reachable, retire it (the one camera replaces it).

## Explicitly OUT of scope (defer, flag if tempted)

- Absorbing the interior branch (`drawInteriorV2` stays the interior draw; its unification into the
  continuous zoom is WS-3).
- 3D / tilt (MAP-3DR), drawn-structure ink (TT-DRAW), any engine file (all read-only to you).
- Any people-token logic (landed separately: `placeFromNode.js` occupancy + `interiorTokens.js`).

## Files

`public/map/continuousMap.js`, `public/map/oneMap.js` (camera seams), `public/map/worldSpace.js`
(read-only consumer; extend ONLY with pure helpers if needed), **minimal** `public/v1.js` seam if truly
required — flag any v1.js hunk prominently in your report. New tests U407–U408.

## Tests (U407–U408) — hermetic, no DOM required where possible

- **U407:** camera math — given a world + player location (outdoors, then a scripted interior room
  move via real engine calls), the computed camera center equals the player's `resolveEntityWu` point;
  a simulated manual pan then a player move returns focus to the player; LOD band selection is a pure
  function of z (two builds, same seed → identical).
- **U408:** no-write proof — camera/pan/zoom operations never touch the world (worldHash byte-identical
  before/after), and the marker's derived position for the boot world matches `resolveEntityWu` exactly.

## Done-when

- One camera drives the in-play map and the Map screen; the player stays centered through moves
  (including room-to-room indoors and inside↔outside); manual pan works and re-centers on next move;
  U407/U408 green; full suite green; zero engine diffs.
- One local commit on your branch (do NOT push). Basecamp live-verifies with screenshots at land
  (marker centered after moves at multiple zooms — the VG-F3 acceptance).

## Rollback

Revert the commit (camera forks return).

## Report (plain English for Tim)

What this is (the map now follows YOU — you're always the center of the sheet, and the marker always
stands exactly where the engine says you are, indoors or out), why it matters (no more walking "off the
map," no more marker lagging a room behind — the one-map promise starts feeling real).
