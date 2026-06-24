# Whole-Building Playthrough — findings & fix queue (2026-06-24)

The Human Playtest Harness was pointed at **working through the entire starting
building** on seed `tallow` — a 3-room cottage (`entry — bedchamber — back room`,
a line graph; the player wakes in the middle room) — driven by the **real LLM
Dungeon Master** (`augmentNarration`) + the Tier-2 quality judge.

**Goal:** `tour-building` (visit every room AND examine the objects in them).
**Runs:** `docs/playtests/harness/harness-2026-06-24-15-40-57.md` (pre-meta-fix) and
`-15-48-57.md` (post). Repro (LLM-off, re-drives the saved actions on the seed):
`node scripts/playtest-harness.mjs --replay docs/playtests/harness/actions-2026-06-24-15-48-57.json --seeds tallow`

---

## ✅ Fixed this session (committed, test-locked, suite green 8647/8647)

| # | What was broken | Fix | Commit / test |
|---|---|---|---|
| WB-F1 | **Can't walk through the building in plain language.** "go through the doorway into the next room" → "blocked" ("through" grabbed as a fake room id); "go back the way I came" → ROLLED a d20; "head to the front room" → EJECTED outside ("no such place"). | `inferInteriorAction` classifies the relative-room vocabulary ("next/other/back/front room", "through the doorway", "further in", "go back", "toward the entrance") as `kind:'move'` with a topology-resolved hint (`resolveInteriorRoomHint`: fore=toward entry, aft=deeper/new). A room-noun move wins over the NPC-approach guard; "go back **to <NPC>**" still approaches. | `fc2c2ae` · `tests/U258` A–G |
| WB-F2 | **Look-around hid the other rooms.** "look around" said only "the way out leads back to the open air" — never naming interior doorways, so the player couldn't discover the other rooms exist. | `buildLocationSurvey` describes the actual doorways (toward the front / deeper in) + the way out from the entry room. | `fc2c2ae` · `U258-H` |
| WB-F3 | **Meta-gate swallowed movement.** "head toward the front doorway **to see what's out there**" returned a static bearings recap instead of moving (a soft-lock cause) — `META_LOCATION` matched the trailing "what's out there" / "who's here". | `isMetaQuestion` suppresses the location-survey verdict when the text has a clear motion-verb + spatial-preposition (`META_MOVE_TO_PLACE`); bare surveys stay meta. Only the location branch is guarded. | `05f1f7f` · `U258-I` |
| WB-F4 | **Over-match (cold fresh-eye catch):** "check the rest of my inventory" and "press through the crowd" were classified as room moves and teleported the player. Also the fore-blocked message quoted a command ("Go outside") — a machine-voice tell. | Tightened the aft patterns: "through [the] [front] **doorway/passage**" now requires a threshold noun (so "through the crowd/pain" don't match), and "the rest **of the house/building**" requires a place noun (so "the rest of my inventory" doesn't). Rephrased the blocked line. Bonus: "push through the front doorway" now moves (was rolling). | `2380e87` · `U258-J/K` |
| WB-F5 | **WB-Q1 — the DM invented geography (THE root).** The live narrator turned the 3-room cottage into an inn with a staircase and an upper floor; the player navigated the fiction and soft-locked. | The DM prompt was told "don't invent topology" but never given the room graph. Now `describeInteriorLayout(world)` feeds the REAL layout (building type, room count, single storey, the doorways out of this room) into BOTH DM prompts (`buildSystemPrompt` + `buildDMSystemPrompt` via the shared `buildScene`), and the rule bites: never add a staircase/floor/room not listed; a room-to-room move keeps you inside. **Validated across 6 real-DM runs** — the DM now DENIES invented space ("no second storey, single floor, nowhere upward to go"); free-action findings 6→2. | this commit · `N7` |
| WB-F6 | **Layout questions answered incoherently.** "are there other rooms?" → "no rooms here" (wrong object reply); "is there another doorway?" → machine-voice; "check if there are doorways I missed" → failed d20; "are there more rooms deeper in?" → silently moved you. | The engine knows the topology, so a layout QUESTION is answered from the map: `META_INTERIOR_LAYOUT` routes "are there/is there/any other/how many … rooms/doorways/exits" (and "check/look for other … doorways") to `buildLocationSurvey` (the real doorways), never a roll/move. Imperative moves untouched. | this commit · `U258-L` |

**Net:** the player can now genuinely move room-to-room in natural language, discover
rooms by looking, and isn't trapped by perception-clause phrasing. Confirmed live in
`-15-48-57.md` (turn 2 "head toward the front to see what's out there" → moves into the
common room; turn 1 look-around reveals "deeper in").

**Cold fresh-eye review (independent, 2026-06-24):** judged the live transcript and the
diffs. Verdict — the three fixes are sound; it caught the two over-matches now fixed as
WB-F4. It independently ranked **WB-Q1 (invented geography) as the critical root** and
confirmed the rest are deep/queue-class. Latent robustness note: `resolveInteriorRoomHint`
and the survey's fore/aft labels assume the topology sets an `entry` tag (true on `tallow`);
if a structure generator omits it, the `topo.rooms[0]` fallback could invert the labels —
worth a guard when WB-Q1 is taken up.

---

## 🔴 Queued — deep / architectural (NOT safe to hack unattended; each is a packet)

> These are the residual "tests well but doesn't make coherent sense" causes. They are
> narration-grounding / item-model / generation / dialogue changes with broad blast
> radius — they need a spec'd packet (an Opus 4.8 worker), not an inline regex. Repro
> via the replay command above; quote turns from `-15-48-57.md`.

### WB-Q1 — ✅ DONE (see WB-F5) — The DM invented geography the topology didn't have
The 3-room cottage was narrated by the live DM as **an inn with a staircase, an upper
floor, and a storage space** (turns 7–9: "a narrow staircase leading up to … sleeping
quarters"; "you climb the narrow staircase … emerge into a modest upper floor … a
storage space"). None of that exists in the topology (3 rooms, one floor). The player
then navigates the *invented* geography ("the deeper doorway I haven't gone through",
"head up the staircase"), the engine can't resolve it against the real room graph, and
the action falls to a generic d20 — which fails (turns 17/21/23: NAT1 → "Whatever you
meant to do, Wayfarers' Outpost doesn't give it to you" / "It falls short here") →
**soft-lock** (progress stuck at 0.5 from turn 9; `soft-lock` finding at t17).
- **Why deep:** this is the narration ≠ canon seam at the spatial layer. The fix is to
  GROUND the DM's spatial elaboration in the actual topology (the DM may dress a room,
  but must not invent navigable rooms/floors/stairs the engine doesn't have), and/or to
  represent richer interiors in the topology. Touches `augmentNarration` system prompt +
  the interior view context fed to the DM. **Packet.**
- **Proposed prompt:** *"The live DM (`augmentNarration`, `buildSystemPrompt` in
  engine/llmAdapter.js) invents navigable interior geography — staircases, upper floors,
  extra rooms — that the structure topology does not contain, so the player navigates a
  fiction the engine can't honor and falls to generic roll-failures (soft-lock). Constrain
  the DM's spatial narration to the real room graph: pass the interior view (current room +
  named doorways/adjacent rooms from `interiorDirectionalExits`/topology) into the DM
  context, and instruct the prompt to describe ONLY rooms/exits that exist — it may dress
  the room, never add navigable space. Add a harness/coherence assertion that the DM's
  narrated exits ⊆ the topology's. Seed `tallow`, repro via the replay above (turns 7–9,
  17, 21, 23)."*

### WB-Q2 — Generic failed-roll narration ignores the player's intent
When an action rolls and fails/mixes, the narration is content-free and doesn't engage
what the player tried: "Whatever you meant to do, Wayfarers' Outpost doesn't give it to
you" (t21), "It falls short here … you're left where you started" (t17/t23), "It lands,
after a fashion — partial, imperfect" (t14), "It comes off cleanly; the moment turns
toward you" (t19 — also wrong: it was opening a chest). This is the biggest quality-judge
signal (resolves-the-intent / natural-DM-voice / specific-and-grounded fired across t9,
t14–16, t19–21). A real DM names *what* failed and *why*.
- **Why deep:** this is the failed/mixed-roll fallback narration (the `genericGroundedOutcome`
  / resolve floor) — taste-critical, broad. **Packet** (pairs with Vol 17 DM-craft rubric).
- **Proposed prompt:** *"On a failed or mixed roll the base narration falls to a generic,
  intent-blind floor ('Whatever you meant to do, X doesn't give it to you', 'It falls
  short here'). Make the failure/mixed narration NAME the attempted action and a concrete
  obstacle (resolves-the-intent, Vol 17). Locate the generic floor (grep 'doesn't give it
  to you' / 'falls short' / genericGroundedOutcome in engine/) and ground it in the action
  + scene. Seed tallow, turns 14/17/21/23 of the replay."*

### WB-Q3 — Free actions still roll (opening a chest; reaching for an object)
`free-action` oracle fired at t11 ("take stock … reach for the it" — rolled, NAT-fail,
and note the text bug **"reach for the it"**) and t19 ("open that iron-bound chest" →
roll:16 instead of the free container path). Opening/looking-in a container is meant to
be the free `tryContainerReveal` path (WB-F-prior #1); here it rolled — likely because
the player was in an *invented* location (WB-Q1) so the chest wasn't in context. Partly
downstream of WB-Q1 + WB-Q5.
- **Why deep-ish:** entangled with invented-geography + node-global furniture; fixing in
  isolation risks masking the real cause. **Queue** (revisit after WB-Q1/Q5). Also fix
  the **"reach for the it"** templating bug (a missing object name).

### WB-Q4 — Phantom acquisition: "pocket the letter" adds no inventory item
`object-interaction/high` (run -15-40-57 t15): "I pocket the letter" — the DM narrates
acquiring it, but the letter is **revealed container text**, not a takeable entity, so the
engine adds nothing to the pack (narration ≠ canon). The player then "shows the letter"
to an NPC that the engine has no record of.
- **Why deep:** requires modeling revealed container contents as takeable item entities
  (inventory + canon). **Packet.**
- **Proposed prompt:** *"Revealed container contents (the letter from the iron-bound chest,
  via tryContainerReveal / containerContents) are narrative-only — 'take/pocket the letter'
  narrates acquisition but adds no inventory item (phantom-acquisition oracle, high). Make
  named revealed contents takeable: on a take/pocket intent targeting a revealed item, mint
  a real item via applyDeltas so it enters the pack and can later be shown/read. Determinism-
  safe. Seed tallow."*

### WB-Q5 — Node-global furniture: the same chest is in every room
Furniture lives on the NODE, not the room, so "look around" lists the SAME "straw pallet,
oil lantern, iron-bound chest, stone basin" in the bedchamber, the back room, AND the
common room (every `buildLocationSurvey` in both runs). The live DM independently invents
room-appropriate furniture ("a hearth, worn chairs"), which then contradicts the engine's
canon furniture.
- **Why deep:** room-scoping furniture changes world SHAPE → `WORLD_VERSION` bump,
  invariants, `worldHash` determinism, and every furniture reader (presentRoomObjects,
  buildLocationSurvey, object-presence/examine, container reveal, the object-interaction
  oracle). **Packet.**
- **Proposed prompt:** *"Furniture is node-scoped (`node.furniture`), so every room of a
  multi-room interior shows the same objects (the bedroom's chest appears in the common
  room). Scope furniture to the room (topology room id) it belongs to: attach generated
  furniture to rooms, update all readers (presentRoomObjects in engine/harness/goals.js,
  buildLocationSurvey, the examine/presence/container paths in playloop), bump WORLD_VERSION
  with safe defaults + invariants, and keep worldHash stable under replay. Seed tallow."*

### WB-Q6 — Dialogue repeats verbatim and ignores shown evidence
Run -15-40-57 (t17/t19): asked about a letter and then SHOWN the letter, Elske gives the
**byte-identical** deflection "Don't know. Honest. Why — what have you heard?" twice — no
reaction to the evidence. Dialogue doesn't acknowledge produced items or vary on repeat.
- **Why deep:** dialogue subsystem (memory of what was shown, anti-repeat). **Packet.**

### WB-Q8 — Wrong NPC voiced in narration (cold fresh-eye catch)
Run -15-48-57 turn 8: the player was in dialogue with **Dalla** (the innkeeper) and asked
where they hadn't explored; the DM answered as **Elske Nightherd** ("Elske Nightherd nods
at your offer…"). The narration layer interpolated the wrong NPC name — the active social
target wasn't carried through.
- **Why deep:** the composer/narration must receive and respect the active dialogue
  identity. **Packet** (pairs with WB-Q6 dialogue work).

### WB-Q9 — Residuals surfaced by the WB-Q1 validation runs (settlement layer + fidelity)
With the interior geometry grounded, the remaining incoherence moved OUT of the first
building to the settlement / narration-fidelity layer (runs `-16-17-26`, `-16-28-49`):
- **Multi-building entry desync** (`state-desync` high, -16-28-49 t17): "head back out the
  door to explore the other building" — the DM narrated stepping INSIDE while the engine
  kept `scene.interior` null (still outdoors). The first-building entry is solid; the
  OTHER settlement buildings aren't wired the same way.
- **Move/exit fidelity:** a fore-move to the front room was over-narrated as fully stepping
  outside (the engine left the player in the entry room). Partly addressed by the new
  "a room-to-room move keeps you inside" prompt clause (WB-F5), but it's LLM-compliance —
  worth a deterministic guard if it recurs.
- **Building-type drift:** the DM calls the cottage "the inn" because Dalla's role is
  innkeeper (the layout says `cottage`). Cosmetic, not a navigation bug.
- **Dialogue mode invents space:** in dialogue, an NPC mentioned "guest rooms upstairs"
  (the DM then denied navigating there). The dialogue narration path should inherit the
  same interior-geometry constraint.
- **Why queue:** these are settlement-wiring + dialogue-narration packets, not first-
  building bugs. The first building (the cottage) is now coherent and navigable.

### WB-Q7 (minor) — Consecutive look-arounds are byte-identical
`buildLocationSurvey` varies its lead by `timeline.length`, which does NOT advance on a
meta-question (they take no turn), so two look-arounds in a row are identical. Minor
cosmetic (the #4 anti-repeat intent); fold into a buildLocationSurvey pass.

---

## Triage summary
- **Walking through the building works** (WB-F1/F2/F3) and **the DM now respects the real
  geometry** (WB-F5/WB-Q1 ✅) — validated across 6 real-DM runs; the narrator denies
  invented stairs/floors/rooms instead of soft-locking the player in a phantom upper floor.
  Layout questions are answered from the map (WB-F6). **The first building (the cottage) is
  coherent and navigable.**
- **What's left has moved off the first building:** generic failed-roll narration (**WB-Q2**,
  the biggest remaining quality lever), phantom item pickup (**WB-Q4**), node-global furniture
  (**WB-Q5**), dialogue memory/voice (**WB-Q6/Q8**), and the settlement-layer + fidelity
  residuals (**WB-Q9**). None are first-building blockers; each is its own packet.
- The harness still reports "stuck" because `tour-building` demands probing every object AND
  the AI player wanders into the settlement — NOT because the building is broken (the
  hermetic `U258-F` proves the building tours to completion when driven properly).
