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

## One residual refinement (not blocking)

**Per-building / per-room occupancy.** Three things currently work at *node* granularity because NPCs
are modeled per-node, not per-room:
- the **peek** hedges ("you cannot tell whether anyone waits within") instead of naming who is inside;
- the **contested-stealth** check on entry rolls against *witnesses to the act of climbing* (honest at
  node level), not against whoever is *inside the room* seeing you come through;
- **shoot-in** frames firing at an abstract foe rather than a specific occupant of that room.

Modelling which NPCs occupy which building/room would let peek report true occupancy, make the stealth
check "did someone inside see you," and let shoot-in/out target a specific occupant. It's a broader
NPC-placement change (canon-safe, worldHash-stable) — worth a dedicated packet if/when interiors get
more populated. Until then the node-level behavior is honest and self-consistent.
