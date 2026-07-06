# WILD-SCALE-1 — wild minis match their own ink (the one-size-law reaches the trees)

**Provenance:** REND-SCALE-1 (b104, `381fdde2`) made people/props ride the ground sheet's live
transform for SIZE (true feet × `sheetScenePerWu`, token-look floor) — and deliberately left wild
minis (trees/boulders/brush/deadfall/stumps, MR-3b's bubble) and the settlement tree scatter
authored-fixed. Same class of lie remains: the 2-D ink draws each tree/feature at its own wu
footprint, but the 3-D mini standing on that ink keeps a fixed authored size — wrong against the
ink at every zoom the squares are visible.

**Study FIRST:** REND-SCALE-1's pattern in `public/map/render3d.js` (`repositionEntities`'s scale
law, `wuPerAuthored`/`heightWu`/`authoredSize` rec fields, `window.__rendScaleAudit`) and
`figures3d.js` (`miniSheetScale`, `measureAuthoredSize`). Also `drawModel.js`'s
`INK_PARAMS.treeRadiusWu` (the ink's own tree size) and MR-3a's `wildFeaturesAround` derivation
(each feature's kind/size in engine truth).

## Deliverable — the law, extended

A wild mini's FOOTPRINT on the sheet equals the ink's own footprint for that feature, through the
SAME `sheetScenePerWu` transform, floored at today's authored look for zoomed-out legibility:

- **Trees:** the mini's canopy diameter on the sheet == the ink's drawn tree circle
  (`treeRadiusWu`-derived, or the feature's own wu size where the derivation provides one). Height
  follows the mini's authored proportions — the footprint is the truth the ink states; do not
  invent a height table.
- **Boulders/brush/deadfall/stumps:** footprint matches the feature's derived wu extent; same floor.
- **Where:** the MR-3b wild-bubble build path (`refreshWildMinis`) computes scale at build from the
  live transform AND rescales on camera change (join the existing reproject pass — the wild set
  rebuilds per real move, so build-time scale + reproject-on-zoom must both hold). The settlement
  tree-scatter path (worldAssets/addTreeScatter) joins the same law if it shares the sheet; if it
  turns out to live on a different scale contract, flag it and leave it — reversible option.
- Extend `window.__rendScaleAudit` with wild entries (the numeric receipt idiom).

## Taste guard (honest, not timid)

At plan zoom a mature tree LEGITIMATELY dwarfs a cottage — that is real and correct. If a scene
reads absurd on the actual screen, do not silently cap: screenshot it, apply the smallest
reversible cap (a named constant), and FLAG it in your report as a Tim taste call.

## Constraints

- Pure renderer lane: `public/map/render3d.js`, `public/map/figures3d.js`, `public/map/worldAssets.js`
  (only if the scatter path needs it) + your tests. Stay OFF `engine/**` entirely, `playloop.js`
  (JR-HUNT-1's live lane), `scripts/screenTruth*`/`check.mjs`, `package.json` + `public/v1.js`
  (never bump versions), `server.js`.
- Determinism: U540's byte-identical wild-mini rebuild law must hold (same seed+cell → same mini,
  now at the same scale). No `Math.random`.
- The 2-D ink is UNTOUCHED (this sizes minis to match ink, never the reverse); the 7 screen goldens
  and `npm run playtest:screen` must stay byte-locked — they raster the 2-D rails.

## Tests — U575–U576 (yours alone; ignore the allocator)

- **U575** the footprint law (pure): for each wild kind, drawn footprint on the sheet == ink/feature
  footprint × transform at three zooms; floor binds at region zoom; degenerate guards.
- **U576** regression: goldens byte-identical; U540 rebuild determinism green at the new scale;
  people/prop scaling (U566/U567 values) untouched.

## Done-when

Full `node --test` green · `npm run check` GREEN (screen rung included) · live receipt per
`docs/PLAYTEST_PROTOCOL.md`: screenshots of a wild road scene + a settlement at street AND plan
zoom (`PORT=5187 npm run dev`) · commit in YOUR WORKTREE ONLY (no push, no main checkout) ·
plain-English report: commit SHA, files, test counts, before/after screenshots, any taste flag.

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
