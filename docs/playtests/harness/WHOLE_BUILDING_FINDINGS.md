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

### WB-Q4 — ✅ DONE (PW-1, v0.22.0) — Phantom acquisition: "pocket the letter" added no inventory item
`object-interaction/high` (run -15-40-57 t15): "I pocket the letter" — the DM narrated
acquiring it, but the letter was **revealed container text**, not a takeable entity, so the
engine added nothing to the pack (narration ≠ canon). The player could then "show the letter"
to an NPC that the engine had no record of.
- **Fixed by PW-1** (the prose-to-world materialization contract, `docs/briefs/PROSE_TO_WORLD_CONTRACT.md` §PW-1;
  commit `4b8c8747`, shipped v0.22.0). A take/pocket intent naming a revealed item now COMMITS the
  acquisition: the gate `tryTakeRevealedContainerItem` (`engine/playloop.js`) mints a real inventory
  item via `applyDeltas` (`createItem`, the authored body carried in the item's `notes` so reading
  from the pack stays byte-identical) plus a `modifyFurniture {takenItems}` overlay that subtracts the
  item from the container's derived view (never re-offered), and pushes a `resolution` event
  (`updateKind:'take:revealed'`) so replay re-executes the path. Re-taking is inert
  (`[take:already-held | no roll]`, hash unchanged). Value-source is the pure `containerContents`
  deriver — the LLM sets no value; determinism-safe (no `WORLD_VERSION` bump). Locked by
  `tests/U323.takeRevealedItem.test.js` (open→take→pack lists it; survey no longer offers it;
  read-before ≡ read-after ≡ read-after-save/load; second take hash-equal; two-fresh-worlds
  transcript determinism). Note: `takeReveal` allocated `U322` in the brief but landed as `U323`
  (U322 was taken by trait-algebra).

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
  the biggest remaining quality lever), node-global furniture (**WB-Q5**), dialogue
  memory/voice (**WB-Q6/Q8**), and the settlement-layer + fidelity residuals (**WB-Q9**). None
  are first-building blockers; each is its own packet. *(Phantom item pickup — **WB-Q4** — is
  now ✅ DONE via PW-1, v0.22.0.)*
- The harness still reports "stuck" because `tour-building` demands probing every object AND
  the AI player wanders into the settlement — NOT because the building is broken (the
  hermetic `U258-F` proves the building tours to completion when driven properly).

---

# Surrounding-town playtest (2026-06-24) — "On to the surrounding town"

**Goal:** `explore-town` (new, `engine/harness/goals.js` — locked by `U259`): leave the
building and MEET THE TOWNSFOLK (engage ≥2 present non-hostile NPCs). Scored on the
reachable social signal so the soft-lock oracle reads true progress; the description is
broad so the LLM player also wanders the streets/roads (surfacing spatial breaks).

**Town shape (seed `tallow`):** `Wayfarers' Outpost` (settlement) — ONE building (Dalla's
cottage), 5 NPCs (Elske, Dalla, Asha, the Lingerer, + Ashblade the bandit), roads to
`Sooted Bridge` (S) and `Old Shrine` (W). The "town" the player/DM imagine is larger than
what the engine generates (one building + roads), which is the root of the entry breaks.

## FIXED this packet (deterministic repro + tests; validated across 3 real-DM runs)

| id | bug | fix | test |
|----|-----|-----|------|
| **T-F1** | **Multi-building entry desync (HIGH, = WB-Q9).** "I step **into** the inn **and** ask Dalla…" — the engine routed it to the dialogue path and stayed OUTDOORS while the live DM narrated stepping inside (narration≠canon). The enter-classifier only fired for `inside/in` at END-OF-LINE, missing `into` + trailing clauses. | `classifyOutdoorEnter` in `playloop.js`: motion-verb + inward particle → `kind:'enter'`, tolerant of `into`/trailing clauses; the handler's `all[0]` fallback enters the one structure so canon matches the narration. Over-match guarded (`into a rage`, `inside the ring`). | `U260` |
| **T-F2** | **Exit fidelity (= WB-Q9 "move/exit").** "I step **back** outside" / "go back outside" / "walk back outside" did NOT exit (rolled a free move while the DM narrated leaving) — the exit rules needed verb+`out` adjacency. | Broadened the exit disjunct to `<motion> (back\|on\|right) out(side\|doors)`. Adverb REQUIRED (a bare "head outside" stays free so "head outside … who do I see?" still answers the presence question — `U235`); `riseOnly` guards "out of bed", a lookahead guards the "out of line/turn" idioms (`U257`). | `U260` |
| **T-F3** | **"push through the inn door" → forced/stuck door.** "I push through the inn door and head to the bar" was read as forcing a barrier (rolled, narrated a door that "does not give"). | `classifyOutdoorEnter` also accepts `through the <building> door/doorway` — requires BOTH a building noun AND a threshold noun, so "push through the crowd" / "press through the pain" never count. | `U260` |

## Queued — town residuals (concrete, NOT "someday")

- **T-Q1 (minor, intent-routing): bare "head outside" / "walk outside" (no adverb) does
  not exit.** Deliberately left free this packet because a compound "I head outside … who
  do I see?" must reach the presence answer (`U235-03`), and a bare "head outside" exit
  would preempt it. *Fix:* in the `playloop.js` exit handler (`interiorAction.kind ===
  'exit'`, ~L1049), let a bare `<motion> outside` classify as exit BUT yield when the
  text is a presence/who question (the path that reaches `buildLocationSurvey(world,
  {presence:true})` ~L6031). Add the bare forms to the exit disjunct AND guard that
  handler with the presence-query predicate. Test: "I head outside" exits; "I head
  outside, who's here?" delivers the roster.
- **T-Q2 (= WB-Q4 reconfirmed): phantom item acquisition — ✅ DONE (PW-1, v0.22.0).** Town run
  t1 — the DM "handed you an item the engine never put in your pack." The revealed-container
  case (take/pocket a named revealed item) now `applyDeltas` a real item; PW-2 (v0.31.4) added
  the honest floor so an *ungrounded* take no longer narrates a phantom acquisition either. See
  the WB-Q4 row above.
- **T-Q3 (med, = WB-Q3): rolled-a-free-action.** Town run t17 — a free action got a d20.
  Same intent-routing seam as WB-Q3.
- **T-Q4 (cosmetic, = WB-Q9): building-type "inn" drift.** The DM calls the cottage "the
  inn" because Dalla's role is innkeeper; the topology says `cottage`. Not a navigation
  bug — a label the DM prompt could pin from `describeInteriorLayout.buildingType`.
- **T-Q5 (quality, discovery-only): the haiku DM's prose.** The Tier-2 judge flags
  `concise-no-filtering`, `specific-and-grounded`, `natural-DM-voice`, `no-machine-voice`
  (e.g. "building number one", "forty-four souls", purple/filtering prose). NEVER
  auto-fixed — human-triage. This is the standing narration-quality lever (the same class
  as WB-Q2), strongest on the cheap DM model; re-mine when prose quality is the focus.

## Triage summary
- **The town's headline bug is fixed:** entering/leaving the settlement's building in plain
  language now keeps canon and narration in sync — **NO state-desync across 3 post-fix
  real-DM runs** (was a HIGH desync pre-fix). The DM also respects the real geometry at the
  settlement layer ("building number one", "the single substantial building") — WB-Q1 holds.
- **What's left is not town-navigation:** a free-action roll (T-Q3/WB-Q3), a cosmetic label
  (T-Q4), and DM prose quality (T-Q5). Each is queued. *(Phantom items — T-Q2/WB-Q4 — are now
  ✅ DONE via PW-1+PW-2.)*
- The harness "stuck"/goal-miss in some runs is the AI player's wandering path, not an
  engine block — `explore-town` is reachable (runs #1–#2 reached it; `U259` proves the
  metric climbs as the player gets out and meets people).

---

# Journey to another town (2026-06-24) — "from bed out into the world and into another town"

**Goal:** `journey-to-town` (new, `engine/harness/goals.js`, locked by `U263`): bed → out
of the building → out of the home settlement → travel the road graph → a DIFFERENT
settlement. On seed `tallow` the world is 39 nodes / 8 settlements; the nearest OTHER town
is **Crossway Village**, two hops out (Wayfarers' Outpost → Old Shrine → Crossway Village).
Farther: Saltmarket Town (5), Riverside Inn (6), Pilgrim's Rest (12), Trader's Camp (15).

## FIXED (tested; VALIDATED — the journey now completes; goal reached 1/2 real-DM runs, up from 0/2 pre-fix)
- **J-F1 — travel vocabulary.** "take the road/path to X", "follow the trail", "continue/
  press on", "make my way" fell to the action floor (no move). Added to
  `isFreeMovementIntent`; road-noun + travel-continuation guards "take the road MAP". `U263`.
- **J-F2 — the soft-lock ROOT: onward roads were invisible to the DM.** `buildScene`
  computed `exits` from `e.from`/`e.to`, but map edges are keyed `{a,b}` → the exits list
  was **ALWAYS EMPTY**. The DM never knew where the roads led, so it narrated a waypoint
  (Old Shrine's standing stones) as a *blocked dead end* and the player burned turns
  trying to "get past the stones." Fixed the edge-schema read + fed `exits` into the DM
  prompt ("The roads from here lead onward to: …; never describe this place as having no
  way out or the road blocked"). The travel analog of WB-Q1. `N7`. Post-fix, the DM says
  *"the roads lead to … Crossway Village to the south"* and the player travels on.
- **J-F3 — oracle precision (IT-2 follow-up).** Figurative "the road is yours" (a combat-
  fled line) no longer reads as a phantom acquisition; a concrete object "is yours" still
  fires. `object-interaction.test.js`.

## QUEUED
- **J-Q1 ✅ DONE** (`b3093a5` + `9b3d52c`). The DM over-narrated player movement — on an
  info-ask it narrated *"you leave the building"* while canon kept the player inside. Fixed
  with a DETERMINISTIC guard (not just the existing RESPECT-AGENCY prompt nudge the LLM
  ignored): `validateNarrationCandidate` now REJECTS polish that claims an exit/entry canon
  didn't commit (Rules 1b/1c → fall back to grounded base), the live analog of the harness
  oracle. Also fixed the oracle's own over-fire on FUTURE intent ("ready yourself to step
  out" while dressing ≠ a committed move). `U264`, `oracles.test.js`. Validated: state-
  desync findings dropped to ~0 across the post-fix runs.
- **J-Q2 (intent, DEFERRED — ambiguity).** Partial place-names don't resolve ("I walk to
  Crossway" misses "Crossway Village"). Deferred on purpose: the seed has TWO "Crossway
  Village" nodes, so a prefix match is ambiguous — needs a disambiguation pass (pick the
  nearest, or ask "which Crossway?"), not a blind substring-loosen.
- **J-Q3 (not a bug).** Travel encounters (toll-gangs, ambushes) interrupt the journey —
  pay/talk/fight/slip past. Working as designed; lengthens the trip and can stall a
  dithering LLM player.

## Triage
- **The journey works end to end** — run #1 reached Crossway Village cleanly in 26 turns
  (the DM now names the roads: *"…Crossway Village to the south"* and the player travels
  on). The travel MECHANICS are solid: no rolled-free-action, no phantom in the runs.
- **Honest caveat — 1/2, not a guarantee.** Run #2 did NOT finish: the LLM player wandered
  the WRONG way first (south to Sooted Bridge, a landmark, instead of west to Old Shrine),
  burned the 30-turn clock backtracking, and hit a J-Q1 agency-desync inside a shop. So the
  fix lifts completion from 0/2 → 1/2 — real improvement, not certainty. The residual is
  (a) the J-Q1 narration-agency lever and (b) the LLM player's own navigation, NOT a travel
  blocker (the deterministic `U263` drive completes every time).
- The bulk of findings are **DM prose quality** over a long (~26–30 turn) journey — the
  standing lever (50+ discovery-only judge findings).
