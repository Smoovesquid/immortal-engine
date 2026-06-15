# Design System — Immortal Engine

> Read this before any visual or UI change to the play surface (`public/v1.html`,
> `public/v1.js`, and the `public/map/` renderers). It is the source of truth for
> the look, the type, the color, and the layout architecture. Do not deviate
> without explicit approval. Created 2026-06-11 via /design-consultation.

## Product Context
- **What this is:** a voice-first, DM-adjudicated tabletop RPG. You play in prose;
  a deterministic engine + LLM narrator runs the table. Prose in, prose out is the
  interface (see `docs/THE_DM_TEST.md`).
- **Who it's for:** players who want a real DM, not a menu — readers as much as gamers.
- **Space:** AI-narrative / interactive fiction (peers: AI Dungeon for gamers,
  NovelAI for writers). We are the third thing: a DM running a table for you.
- **Primary surface:** desktop web first; full feature parity on phone.

## The governing idea: "available, not imposed"
The play screen is a **grimoire**. The center is the **Telling** (the DM's prose,
a living manuscript). Around it are the **Margins** (map, character sheet, pack) —
marginalia you summon and can pin, never a HUD forced into the fiction. This is
how the UI honors `THE_DM_TEST` (mechanics stay invisible until the fiction
surfaces them) while still letting a player who wants the map and sheets track
them at all times, on any device.

Input is **modal and switchable**: pure text, pure voice, or both, the player's
choice, changeable mid-session. The losing move (per the research) is bolting a
mic onto a text box; the winning move is one stream that does not care how you
talk to it. Voice flow is designed as if no screen existed; the screen supports it.

## Aesthetic Direction
- **Direction:** dark literary grimoire. Candlelit warm-black, ink-on-parchment.
- **Decoration level:** intentional (restrained). Type and contrast do the work;
  no ornament for ornament's sake. Wrong genre for bounce, glow, or gradients.
- **Mood:** the prose should read like a King/McCarthy novel at night, not a chat
  log. The interface recedes; the writing carries it.
- **Reference peers studied:** AI Dungeon (modal Do/Say input), NovelAI (calm
  writer UI), inkle/Ink IF (machinery invisible to the reader).

## Typography
- **Narration (the Telling):** `Newsreader` — a literary serif built for screen
  reading. ~15–16px, line-height 1.75–1.8, measure ~60–65ch. This is the spine.
- **Display / flourish:** `Fraunces` (opsz) — section labels, the rare heading.
- **Player input + mechanics tags:** `JetBrains Mono` — the semantic split: the
  world speaks in serif, your hand answers in mono. The interface teaches the DM
  Test without a word.
- **UI / labels / the Margins:** `DM Sans` (use `tabular-nums` for stats/HP).
- **Loading:** Google Fonts (`fonts.googleapis.com`) for v1; self-host before ship.

## Color (warm dark, candlelit)
- **Background:** `#14110E` (warm near-black, aged ink).
- **Surface / Margins / input:** `#1C1813` (and `#191510` for the rail).
- **Primary text (the Telling):** `#E8DFC8` (bone/parchment — never pure white).
- **Muted text / labels:** `#9A8F7A`; hints `#6F6757`.
- **Accent — candle-gold `#C9A24B`:** grace, UI affordances, the active state, the
  player's own line. Load-bearing.
- **Accent — ember/oxblood `#8E2B20`** (text tint on dark: `#CB5E3E`): blood, harm,
  combat, cruelty. The McCarthy darkness lives here. Used sparingly, on purpose.
- **Hairlines:** `rgba(233,223,200,0.10–0.16)`.
- **Semantic:** danger reuses the ember; success a muted sage `#6E7A4E`; warning
  the gold; info a cold slate `#5B6B78`.
- **Dark only.** This product has no light mode; the palette is content, not theme.

## Play Surface Architecture
- **Desktop:** center **Telling** column (novel measure) is the default focus, the
  whole story scrolls here. A calm **input bar** pinned at the bottom: a mono field
  + an equal-weight `Type / Speak / Both` toggle + a mic. Whatever mode you use, the
  answer lands in the same stream. A quiet right **Margins** rail: collapsed to a
  thin strip showing only HP / location / goal; expands to Map / Sheet / Pack tabs;
  pin to keep open, collapse for pure prose.
- **Phone:** full-screen Telling; input bar + big mic pinned at bottom; the Margins
  become a swipe-up sheet (Map / Sheet / Pack) plus a small top status pill. Full
  parity with desktop.
- **The compass and quick-buttons recede:** movement and actions resolve from what
  the player says (THE_DM_TEST); the compass becomes optional, living in the Margins
  rather than under the prose.

## Spacing
- **Base unit:** 4px. **Density:** comfortable for the Margins, spacious for the Telling.
- **Reading rhythm:** paragraph gap ~12px, generous leading; the Telling breathes.
- **Scale:** 4 / 8 / 12 / 16 / 22 / 32 / 48.

## Layout
- **Approach:** reading-first single column (the Telling) + a summonable rail/sheet.
- **Max reading measure:** ~62ch. **Window/app radius:** 12px; controls 8px; pills 5–6px.
- **Border radius:** sm 5px, md 8px, lg 12px.

## Motion
- **Approach:** minimal-functional. The Telling settles in as the DM finishes
  (optional typewriter cadence, player can disable). Margins slide from the edge.
  Mode toggle is instant. No bounce, no springs.
- **Easing:** enter ease-out, exit ease-in. **Duration:** short 150–250ms.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-11 | Initial design system created | /design-consultation. Direction approved by Tim: grimoire play screen ("Telling" + "Margins"), modal Type/Speak/Both input, dark literary look, desktop-first with phone parity. Built on THE_DM_TEST + the voice-UX "continuity over bolt-on mic" finding. |
