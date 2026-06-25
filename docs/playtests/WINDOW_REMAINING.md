# Windows — remaining packets (queued 2026-06-25)

The windows feature is **live**: generated per-room (`engine/structures/roomWindows.js`), listed
in look-around, and acted on from both sides —
- **inside:** look out (LOS outlook), climb/jump/crawl out (`[window:exit]`), break/smash
  (`[window:break]`), shoot out in a fight (`[window:shoot]`).
- **outside:** peek in to scout (`[window:peek]`), climb in past the door (`[window:enter|stealth]`),
  with the map following inside/outside via the canonical enter/exit primitive.
- "throw myself out the window" stays a fall.

Tests: `U282.roomWindows`, `U284.windowEntry`. The three packets below are the deeper completions
that each carry a design or risk surface — queued rather than solo-built while away.

---

## W-Q1 — Contested stealth on window-entry (the real "sneaking" mechanic)

**Why queued, not built:** climbing in is currently framed as stealthy (`[window:enter|stealth]`)
but there is no *check* — and an honest one is blocked on a modelling gap. NPCs live at the **node**
(`node.settlement.npcs`), not per **building/room**, so "did anyone inside see you?" can't be answered
truthfully yet, and the *consequence* of being seen (alert state? +pressure? a reputation ding?) is a
real design choice.

**Prompt:**
```
You are a worker on the Immortal Engine. Make climbing in a window a real CONTESTED stealth action.
git worktree add ../immortal-winsneak -b windows/stealth origin/v2-polish && cd ../immortal-winsneak

ORIENT: the window-entry handler is in engine/playloop.js (search "[window:enter|stealth]" and
windowEntryKind). Today it always succeeds silently. Combat/flee already spend a "pressure clock"
and stress (search isFleeIntent in playloop) — reuse that machinery for a consequence; do NOT invent
a new system. rng.js is the only randomness; resolve.js holds the d20-vs-DC check.

DECISION TO MAKE FIRST (then implement): what does "spotted while climbing in" cost? Options, pick the
one that fits the escape game best and note it in the commit: (a) +1 pressure clock (tightens the
escape timer); (b) the entry still works but a witness beat is recorded so NPCs react later; (c) a
reputation/suspicion ding. Lean (a)+(b) unless there's a better fit.

BUILD: on window-entry, if the node is populated (potential witnesses to the act of scaling a wall —
this is honest at node granularity; per-building occupancy is a separate gap, see note), roll a stealth
check (AGILITY vs a moderate seeded DC). Success → "you slip in unseen" [window:enter|unseen]. Failure
→ "a board creaks / a face turns at the glass" [window:enter|spotted] + the chosen consequence. An
EMPTY node stays a free, clean entry. Deterministic.

OPTIONAL (bigger): model which NPCs are in which building so peek + entry can answer true per-building
occupancy. Only if it stays canon-safe and worldHash-stable.

DONE-WHEN: entry into a populated place rolls a real check with a real consequence; empty place is free;
deterministic; the existing peek / climb-out / fall-guard are unchanged. Test-lock (U###). npm run
check GREEN. Push the branch; report to Homebase to land.
```

---

## W-Q2 — Windows as combat positions for BOTH sides (shoot *in*, be shot *at*)

**Why queued:** shoot-**out** from cover exists (player inside, firing at pursuers). The inverse —
firing **through a window into** a building, or a foe at a window firing at you outside — touches the
live combat engine (`escapeCombat.js`, serial hot file) and is a rarer scenario. Low priority.

**Prompt:**
```
You are a worker on the Immortal Engine. Extend window combat to BOTH directions. Branch
windows/combat off origin/v2-polish.
ORIENT: shoot-OUT lives in engine/playloop.js (search windowShoot, "[window:shoot]"): it strips the
window phrase, resolves a real combat turn via resolveEscapeCombatTurn, and frames it as firing from
cover. escapeCombat.js is a SERIAL hot file — tread carefully, mirror the existing path, do not
restructure it.
BUILD: (1) from OUTSIDE, "fire/shoot through the window" at a foe inside → a real ranged line in, framed
through the glass (cover for the target). (2) a foe positioned at a window is a covered target / can fire
out at you. Reuse roomWindows for "is there a window to shoot through". A shuttered window blocks the line.
DONE-WHEN: both directions resolve as real combat turns (never an object-bounce), cover is reflected,
shuttered blocks it; deterministic; shoot-out unchanged. Test-lock (U###). npm run check GREEN. Report
to Homebase to land.
```

---

## W-Q3 — Open / close / bar a shutter (persistent window state)

**Why queued:** a window's `shuttered` is currently a **pure derived** value (50%, in roomWindows.js) —
there is no stored state to toggle. Making "close the shutters" persist needs a real field, which means a
**WORLD_VERSION bump** (the careful multi-step in CLAUDE.md: state.js + ensureWorld defaults + invariants
+ old-save warning + version-string test sweep + playtest). Not an unsupervised change.

**Payoff:** one toggle gates three things already in place — a closed shutter blocks **peek** (W done),
blocks the **combat line** (W-Q2), and gives **concealment** (you can't be seen → ties to W-Q1). That's
the unifying mechanic, worth doing once the version bump is on the table anyway.

**Prompt:**
```
You are a worker on the Immortal Engine. Make a window's shutter a TOGGLEABLE, persistent state.
Branch windows/shutter off origin/v2-polish. This BUMPS WORLD_VERSION — follow CLAUDE.md "When Bumping
WORLD_VERSION" exactly (state.js number + ensureWorld shape + safe defaults + invariants for the new
field + old-save warning + grep/fix version-embedded test strings + full suite + playtest:quick).
MODEL: store per-(structure,room) shutter overrides (e.g. scene.interior or a small structures-side map);
roomWindows.js derives the DEFAULT, the override wins when present. Keep worldHash stable under replay.
VERBS: "close/shut/bar the shutters", "open the window/shutters" — set the override. Then wire the gates:
a closed shutter blocks peek-in (W done), blocks the shoot line (W-Q2 if landed), and grants concealment
(feeds W-Q1's stealth). DONE-WHEN: toggle persists across turns + save/load; the three gates honor it;
determinism + invariants intact. Test-lock (U###). npm run check GREEN. Report to Homebase to land.
```
