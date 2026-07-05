# MR-1b — the marker reads the engine's position (TAC-4, verbatim)

*READY-TO-FIRE: dispatch the moment MR-1a lands (sequenced for display correctness only — no file
overlap with MR-1a). Renderer lane, parallel-safe, no engine gate (public/** only). Tests U501–U502.*

**Files owned:** `public/map/worldSpace.js` (frame transform: `{frame,gx,gy}` → `{wx,wy}` = frame
origin + cell × CELL_WU — `docs/POSITION_AS_CANON.md` §6), `public/map/placeFromNode.js` (player token
consumes engine `pos`, not the lane-entry pin — MR-ORACLE proved it "never consumes pos at all"),
`public/v1.js` `ui.place` seam ONLY (~lines 155, 529, 2203–2218: demote pixel walk-pos `ux/uy` to an
animation TWEEN toward engine truth — §6: "demoted permanently to animation tween").
**Forbidden:** `engine/**` (read-only), any camera/zoom behavior change (WS-2 owns camera), map beauty.

**Done-when:** with MR-1a landed, the marker stands at the doorstep after "go outside" — verified
headless (render the wake→exit sequence, assert token wx/wy within threshold of the door cell's
projection) AND live on Tim's screen after integration (map fidelity rule). Determinism: token
placement pure f(world); U398/U410/U480/U494/U495 green; new U501 (transform unit: frame→wu for
region + struct frames, all door orientations) + U502 (token-follows-pos across the probe's scripted
transitions). Tween is presentation-only: no test may depend on tween timing.
