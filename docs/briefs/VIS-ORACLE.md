# VIS-ORACLE — the Screen-Truth Oracle: the drawing is asserted against the world, forever

*Cut 2026-07-06 on Tim's word, from the morning's lesson: the engine has a standing machine gate and
never broke; the screen has none and broke twice in one night (bed lump · four NPCs drawn indoors).
Tim's house law — "the browser screen is the only acceptance instrument" — becomes machinery.
This is MR-ORACLE for pixels: same arc (RED against today's live bug → wired into `npm run check`
when green → permanent).*

## The instrument
`scripts/screenTruth.mjs` + `npm run playtest:screen`: boot canonical scenes headless, mount the REAL
renderer, and assert the DRAWN MODEL against ENGINE TRUTH — numerically first, pixels second.

**Canonical scenes (deterministic boots, LLM off):** wake interior · cottage exterior · settlement
square (morning AND evening — time-of-day placement must show) · wild road at walking zoom · deep
wild (fog edge in frame) · combat board with one defeated foe (corpse swap).

**Assertion classes (the load-bearing, byte-deterministic part — mirror positionProbe's finding
format):**
- `PROJECTION_EQUALITY` — every rendered token/mini (player, people, props, wild, corpses) sits at
  the exact transform of its engine-truth position.
- `PHANTOM` — nothing rendered without an engine-truth source entity/feature.
- `MISSING` — engine-truth entities within the frame must be rendered.
- `LAYER_ORIGIN` — all render layer groups (plan ink, props, people, wild, player) share one origin
  transform (generalizes REND-TRUTH-1's U550 guard).
- `INK_EXCLUSION` — TT-OCC's law re-checked in rendered space: no figure inside foreign plan ink.

**Golden-image layer (the beauty lock, taste-side):** one small golden per scene, perceptual diff
with tolerance; goldens live in-repo; updates ONLY via a deliberate `screen-goldens:accept` script +
a changelog line — never automatic. Headless trap: 0×0 canvas renders black — fallback size first.

## Sequencing + expected colors
- Runs RED today on the wake-interior scene (the live people-projection bug) — that RED is an
  INDEPENDENT confirmation of REND-TRUTH-1's repro, exactly like MR-ORACLE's first RED. Encode the
  known-red as an expected-fail marker that REND-TRUTH-1's landing flips (the U497-todo pattern).
  **Lesson pinned from U539: NO `git show HEAD:`-style or dirty-tree assertions — pin any historical
  reference to an immutable hash.**
- Goldens are captured ONLY for scenes whose truth-assertions pass at build time; the red scene's
  golden lands with the flip.
- Wire into `npm run check` as a rung when all scenes green (the position-probe arc, step for step).

## Lanes
Worker owns: `scripts/screenTruth.mjs` (+ helpers), ONE `package.json` script line (plus the accept
script), goldens dir, tests U551–U554. Renderer/engine READ-ONLY (REND-TRUTH-1 is live in
`public/map` — reuse its harness patterns when it lands rather than editing render3d; if a headless
mount genuinely needs a test-only export, flag it, keep it one line).
