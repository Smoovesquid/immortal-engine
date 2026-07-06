# VIS-ORACLE golden images (screen-truth beauty lock)

These are the golden rasters for `scripts/screenTruth.mjs` (`npm run playtest:screen`) —
the LOOK lock for each canonical scene, one PGM per scene.

## What they are
Each `*.pgm` is a small (64×48) grayscale raster of one scene's **drawn model** — the
building rects, people/props, player marker (or the combat board grid + minis),
rendered by the dependency-free rasterizer in `scripts/screenTruth.goldens.mjs`. It
locks the *layout* of ink and figures in frame: a regression that moves a wall or a
mini shifts pixels and trips the diff, while a pure re-run reproduces the identical
raster. PGM (P2 ASCII) is a trivial, diffable, human-inspectable grayscale format —
no image library, zero dependencies.

## Grayscale legend
`255` blank paper · `120` structure wall · `170` decorative building · `40` person ·
`0` player · `200` prop · `70` live enemy · `210` corpse (defeated foe).

## Updating them (deliberate ONLY)
```
npm run screen-goldens:accept
```
This regenerates goldens for scenes whose **truth assertions pass** and prints exactly
which changed and by how much. It never runs automatically, and it never captures a
scene that is still RED (e.g. `wake_interior` today — its golden lands when
REND-TRUTH-1 flips it green). Commit the changed `.pgm` files with a changelog line
describing the intended look change.

## The one missing golden
`wake_interior.pgm` is intentionally absent: that scene is EXPECTED-RED (the live
figure-off-its-building bug, REND-TRUTH-1's target). Its golden is captured with the
fix (delete `wake_interior` from `EXPECTED_RED` in `scripts/screenTruth.mjs`, flip the
`todo` in `tests/U553`, then run the accept ritual).
