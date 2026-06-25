# Windows — status (updated 2026-06-25)

The windows feature is **complete** end to end. Generated per-room (`engine/structures/roomWindows.js`),
listed in look-around, acted on from both sides, with combat and a persistent shutter:

| Verb / behavior | Status | Tag / test |
|---|---|---|
| Generated per-room (1–2 lit, 0 underground); listed in survey | ✅ | `roomWindows`, U282 |
| Look out (LOS outlook) | ✅ | U282 |
| Climb/jump/crawl out (escape exit) | ✅ | `[window:exit]`, U284 |
| Break / smash | ✅ | `[window:break]`, U282 |
| Shoot **out** in a fight (fire from cover) | ✅ | `[window:shoot]`, U282 |
| Peek **in** from outside (scout) | ✅ | `[window:peek]`, U284 |
| Climb **in** from outside | ✅ | `[window:enter]`, U284 |
| **Shoot IN through a window** (combat, both directions) | ✅ W-Q2 | `[window:shoot-in]`, U284 |
| **Contested stealth on entry** (witnesses → spotted+pressure / unseen) | ✅ W-Q1 | `[window:enter\|spotted\|unseen]`, U284 |
| **Open/close/bar the shutters** (persistent toggle, no schema bump) | ✅ W-Q3 | `[window:shutter-close\|open]`, U285 |
| Shutter gates: survey + look-out + peek-in + shoot-in | ✅ W-Q3 | U285 |
| Map follows in/out (canonical position) | ✅ | — |
| "throw myself out the window" stays a fall | ✅ | U284 |

W-Q3 note: shutter state is **event-sourced** — the seed-derived default, overridden by the latest
`window-shutter` timeline event. No new world field, no `WORLD_VERSION` bump, worldHash stable.

---

## Per-room occupancy — now DONE (`engine/structures/roomOccupancy.js`, U286)

NPCs are placed per BUILDING ROOM (derived, deterministic, no schema bump). Folk gather in the
common/entry room; a private back room is usually empty. Resolved:
- **look around** names only who is in YOUR room — no roster dump in a private room;
- the **peek** NAMES who is in the room it sees into (earned-knowledge), instead of hedging;
- the **contested-stealth** check runs against the people IN the room you climb into.

Also closed the live-display note: the window-shot framing now rides the first combat **beat**
("Firing in through the window — …"), so it reaches the screen (beats aren't LLM-condensed). U284.

### Two small remainders (not blocking)
- **Multi-building disambiguation.** Occupancy distributes the *node's* roster across the rooms of the
  building you're in; it doesn't yet split a town's people *between* its several buildings. Single
  buildings / your home are exact; a dense multi-building town is approximate.
- **Shoot-in named target.** Firing in resolves a real combat turn but still frames an abstract foe,
  not a specific room occupant — escape combat models enemies abstractly. Low value; deferred.
