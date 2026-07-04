# GRAPH-PAPER UI — one continuous sheet

**Status:** Slice 1 (substrate) SHIPPED + live-verified 2026-06-26 on `v2-polish`.
**Ask (Tim):** the entire game interface is ONE continuous graph-paper sheet —
not a dark app with panels, not separate cards. The graph paper is the
substrate *and* the interface model. Everything player-facing appears on that
one sheet: map = drawn ink; character sheet = written blocks; inventory = rows /
pinned annotations; combat HUD = temporary marks around the tokens, not a
permanent panel; dice/mechanics = brief marginal marks; narration/input/voice =
part of the sheet, not app chrome.

**Law:** THE DM TEST + the two-surface rule still govern. Everything belongs
either *on the sheet* or *on the map* — but both are now regions of the same
physical graph-paper artifact. Presentation only: **no engine / server / world
state is touched** by this track. Revertable by file.

## The audit (what existed, 2026-06-26)

**The map was already the target aesthetic; the chrome was its opposite.**
- `public/map/LocalMap.js`, `handDrawnPlace.js`, `handDrawnInterior.js` all draw
  on a "cheap greenish-cream quadrille pad" — `PAPER.paper = #e7ecdd`, teal grid
  rule (`rgba(92,134,120,.22/.40)`), dark-blue ballpoint ink, graphite pencil,
  red felt-tip "you are here". `reference-dungeon.html` is the canonical sample.
  `oneMap.js` (the zoomable world map, M5 beauty pass) is hand-drawn parchment.
- `public/styles.css` was the inverse: a **dark grimoire app** — `--bg:#0d0d0d`,
  glossy gradient panels (`#1c1810`), gold accents, `box-shadow`, `radius:14px`.
  The graph-paper map sat as a lonely island inside a dark dashboard (Diablo
  HP/STR orbs, dark status cards). This is exactly the "dark app with panels"
  Tim wants gone. The fix is an **inversion**, not a new theme: bring the whole
  page onto the paper the map already uses.

**Wired vs orphaned (play surface = `public/v1.html` + `v1.js` + `styles.css`):**
- Live play layout: `renderPlay()` → `.play-layout` (main col + `.status-panels`
  aside). Main col = gear header, `.play-body` (map canvas + `.transcript`),
  compass/kit bars, `.play-hud-row` (Diablo orbs + input). Aside = character
  sheet, party, inventory, combat HUD, beats, rumor board (`renderStatusPanels`).
- **Orphaned / against-the-rules:**
  - `.goal-*` CSS (~10 rules) — `renderGoalsSection` was already deleted (v1.js
    ~L1830); the styles are dead. Tim HATES a quest log → safe to remove. *(no
    system-maintained quest/rumor tracker, per the brief.)*
  - `renderRumorBoardSection` + `.rumor-*` CSS (~25 rules) — a system-maintained
    rumor board. Conflicts with "no system-maintained quest/rumor tracker."
    Candidate for removal / demotion to in-fiction only (see Stage 4).
  - Diablo HP/STR orbs (`panels/DiabloOrbs.js`) — redundant (vitals are on the
    character sheet) and pure game-chrome. **Hidden in Slice 1.**
  - `prototypes/character-card/` — MEMORY calls it the "LOCKED reference," but
    the directory now holds only `node_modules` + `.DS_Store`; the reference
    files are gone. Do not depend on it; this doc is the reference of record.
- **No existing graph-paper UI work to harvest:** the `notebook/map-beauty`
  worktree only touched `oneMap.js` (the zoomable map's beauty pass), nothing on
  the play-screen chrome. The graph-paper aesthetic lives only in the canvas
  renderers — this track extends it to the DOM.

## Palette (the load-bearing 20%) — matches the map canvas

| token | value | role |
|---|---|---|
| `--paper` | `#e7ecdd` | the sheet (identical to `LocalMap` PAPER) |
| `--grid-minor` / `--grid-major` | `rgba(92,134,120,.17)` / `.34` | quadrille rule (24px / 120px) |
| `--ink` | `#222c48` | dark-blue ballpoint — body text, walls |
| `--accent` | `#2a4a78` | emphasis pen (player input, focus) |
| `--danger` / `--ok` / `--gold` | `#b3331f` / `#2e7d5b` / `#9a7b2e` | red felt-tip / green pencil / ochre, all darkened to read on cream |
| `--hand` | Bradley Hand → Marker Felt → cursive | hand-lettered margin labels |

## Stages (each ships green + live-verified, PACKETS discipline)

- **Slice 1 — the substrate. ✅ DONE 2026-06-26.** Append-only override block at
  the end of `styles.css` (revertable by deleting it). Repaints the existing
  palette vars ink-on-paper so component rules flip automatically; sets `body`
  to paper + a real quadrille grid (minor 24px / major 120px) + an aged
  vignette; neutralizes panel/card/section chrome → transparent with thin ink
  rules ("ruled boxes"); stat cells / doll slots / hp tracks patched off their
  hardcoded navy fills; buttons → ink-outline stamps (primary = filled ink);
  input → write-on-the-ruled-line; map canvas → thin ink frame (melts into the
  sheet); Diablo orbs hidden; compass/kit/gear → ink marks. Live-verified
  desktop + mobile (375px), zero console errors; body computes `#e7ecdd` with
  grid image, narration ink `#222c48`, sections transparent + ink border.
  *Known follow-ups surfaced here, for later stages:* the map canvas paper tint
  is a hair greener/denser than the page grid (faint "map within map"); the ink
  borders are clean rectangles, not yet hand-wobbled.

- **Slice 2 — handmade texture.** Make the boxes read as *drawn*, not CSS: a
  subtle skew/wobble or double-stroke on `.status-section` borders, "taped
  scrap" corners on one or two blocks, hand-lettered headings throughout, a
  faint fold crease down the sheet. Reconcile the map-canvas paper tint with the
  page paper so the seam disappears (or lean in: frame it as a sketch boxed on
  the sheet). Keep it texture, not noise.

- **Slice 3 — the character sheet as written blocks.** Re-lay the right column
  as one annotated sheet region rather than three stacked cards: ability scores
  as a penciled stat block, equipment as a paper-doll margin sketch, inventory
  as a checklist in ink. One column of writing, not three boxes.

- **Slice 4 — combat HUD as marginal marks + tracker cleanup.** Combat vitals /
  initiative / enemy HP become temporary marks *around the map tokens* (pencil
  rings, struck-through names, marginal d20 results) that appear only mid-fight
  and erase after — never a permanent panel. Delete the dead `.goal-*` CSS;
  remove or demote `renderRumorBoardSection` to honor "no system-maintained
  tracker" (rumors live in the fiction / newspaper surface, per IDEA_GARDEN
  IG-14).

- **Slice 5 — dice & mechanics as marginal marks.** `panels/DiceRoller.js` and
  the `.mech` lines re-styled as quick pencil jottings in the margin (vs / DC /
  result), brief and disposable.

- **Slice 6 — chargen + front door on the sheet.** Bring the species/class/
  ability screens and the "Ordinary Morning" front door onto the same paper so
  the whole app, first frame to last, is one artifact. (No invented landing
  page — the front door stays the real entry.)

## Invariants

1. Presentation only — never touch `engine/`, `server/`, or world state; the
   `worldHash` is unaffected. Revertable by file (`styles.css`, panel JS).
2. Graph paper is **structural**, not wallpaper: the grid is visible and the
   interface lives on it. No glossy cards, no dark panels, no dashboard chrome.
3. No system-maintained quest/rumor tracker surfaces on the sheet.
4. Text stays readable on desktop and mobile (ink-on-cream contrast holds).
5. The two-surface rule: every element is on the sheet or on the map, and both
   read as one physical graph-paper artifact. The map stays a read-only aid
   (DM-only-verb) — no click-to-travel reintroduced.
