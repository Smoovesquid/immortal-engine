# SL-5 — "Aldermere wants something" — packetization draft

**Status:** DRAFT for Tim's taste pass. No code in this brief; docs-only lane.
**Author:** Sonnet drafting lane, 2026-07-05.
**Reads first:** `docs/PRD.md` §5 (Armory) + §7 Phase 1 · `docs/PACKETS.md` §SL + the
SL-5/SEEK-PERSON/GATE 2026-07-05 rows · `docs/SLICE_PLAN.md` · `docs/DEMO_REGION.md` ·
`engine/goals/goalContract.js` · `engine/goals/proposeGoal.js` · `engine/npc/npcArc.js` ·
`engine/world/placeQuery.js` (the `concern` resolver) · `packs/fantasy/westmarch/pack.json`
(the `bridge-dispute` thread) · `packs/fantasy/crownlands/pack.json` (`the-drowned-twin`).

## Table of contents

1. [What already exists (read this before proposing anything)](#1-what-already-exists)
2. [Candidate A — light up the concern resolver with place-pinned wants](#candidate-a--curated-concern-the-recommended-pick)
3. [Candidate B — a living thread pinned to the Greenwood/Chapel](#candidate-b--a-pinned-living-thread)
4. [Candidate C — the cold-open voices the worry unprompted](#candidate-c--cold-open-worry-line)
5. [Recommended pick + why](#recommended-pick)
6. [Proposed PACKETS row (ready to paste)](#proposed-packets-row)
7. [Open taste questions for Tim](#open-taste-questions-for-tim)

---

## 1. What already exists

The PRD's Armory entry for the talk→goal bridge reads **"🟢 machinery / 🟡 wants are
generic."** Tracing the actual code, that's precise almost to the character, and the
gap is narrower and cheaper to close than a fresh read of Phase 1 might suggest.

**The full loop that's ALREADY live, end to end:**

1. A player can ask "what's troubling folk here?" / "anything I can help with?" and
   `resolveConcern()` (`engine/world/placeQuery.js:267-289`, shipped as commit `9716e115`,
   tests `U220`) answers in fiction: *"folk here carry their small wants — Galen the
   artisan wants a commission worthy of the craft, Brogan wants a harvest that holds."*
2. If the player then says "I'll help" to a present NPC, `proposeGoalFromDialogue()`'s H1
   path (`engine/goals/proposeGoal.js:154-161`, commit `16c1d3b7`, tests `G06`) mints a
   **`learn` goal** from that SAME NPC's want and the DM acknowledges it in one line —
   *"You set yourself to it — you'll help Galen — a commission worthy of the craft."*
   No quest banner. No menu.
3. `goalContract.createGoal`/`checkGoals` (`engine/goals/goalContract.js`) tracks it
   silently in `world.goals`, cap 12, completion is a predicate check (never a UI list).
4. `worldTick.js` ages `world.instrument.threads` every tick (`tickLivingThreads`,
   ~line 184) — tension climbs, and past 4 unresolved ticks the objective text itself
   **mutates deterministically** ("age > 4 && age % 3 === 0" → `mutateObjective`). This
   is a real, tested, already-firing consequence engine for anything routed through
   `introduceThread()`.
5. `worldTick.js` also ages `world.factions[].pressure/hostility` every tick
   (`tickFactions`, ~line 161) — past hostility 80 a faction enters "war posture" and
   bumps the world pressure clock. **12 authored factions are live on the fantasy
   boot** (FACT-1, v0.28.28 b077, commit `909bfe16`): `crown-watch, seil-compact,
   ember-quill, greyfen-cutters, the-regency, wandering-faithful, merchant-league,
   order-long-watch, crimson-brotherhood, hollow-guild` + the load-bearing `civic`/
   `shadow` defaults.
6. **Authored story threads already exist and already boot into the slice.** PACK-1
   (v0.28.25 b074, commit `ecc86514`) admitted `pack.threads` through the merge
   whitelist. `packs/fantasy/westmarch/pack.json` carries **"The Bridge Dispute"**
   (Crown Watch taxing crossings; the Compact disputes it) pinned at `nodeId:
   seils-bridge`; `packs/fantasy/crownlands/pack.json` carries **"The Drowned Twin"**
   (a twin declared dead at sea, alive, asking questions at the harbor) tagged to the
   `merchant-league` faction. `beginAdventure` (`engine/playloop.js:286-298`) shuffles
   1–3 of ALL loaded packs' threads by fate band into `world.instrument.threads` on
   every fresh boot — **these are live in the Aldermere slice's own boot today**,
   they're just not pinned to Aldermere's own four places and not yet voiced as a
   town's opening worry.

**What's genuinely missing (the real gap, and it's small):**

- `npcWant()` (`engine/npc/npcArc.js:20-32`) is a **role-keyed generic pool**
  ("a harvest that holds," "a quiet night for once") with zero awareness of the
  Greenwood bandits or the Hollowed Chapel's undead — the two authored dangers the
  whole module is built around. This is the "wants are generic" 🟡.
- Nothing **proactively voices** a want. The concern resolver only answers a direct
  question; the cold-open (`composer.js:255`, the generic "morning finds you"
  waking line) never mentions a worry. Minute zero is a blank page, exactly as
  PRD §6 says.
- `world.threads` — a SEPARATE, geographically-typed thread shape
  (`{objective, tension, trajectory, factionId, nodeId, active, age}`,
  `ensureLivingThreads` in `state.js:1217-1231`) — is fully normalized, hashed
  (`worldHash.js:29`), invariant-checked, and read by `sceneDirector.chooseLivingThread`
  (`sceneDirector.js:364`)... but **nothing anywhere writes a real entry into it.**
  It's dark scaffolding with the exact shape SL-5 needs (a `nodeId`-pinned want with a
  tension clock) and zero authoring cost to wire — the consumer, hash, and invariant
  are already paid for.

This reframes SL-5 from "build a want system" to "point three already-tested seams at
two already-authored places." That's the SOBRIETY-aligned read.

---

## Candidate A — curated concern (the recommended pick)

**The want itself.** Aldermere's public concern, when asked, stops being a lottery of
generic NPC flavor-wants and becomes ONE curated, rotating civic worry that names (in
fiction, never by system label) the road through the Greenwood or the chapel's dead not
staying dead. Concretely: override `resolveConcern()`'s source for the slice's town node
with a small authored list —
- *"the toll road's gone quiet in a bad way — nobody's come up from the woods in two
  days"* (points at the Greenwood/bandits)
- *"the Hollow says the chapel bell rang Tuesday, and nobody's rung it in a year"*
  (points at the chapel)

— chosen deterministically by seed (same mechanism `npcWant`'s `pick()` already uses),
so it's stable across replays of the same seed and still varies run to run if the seed
varies.

**How a player discovers it (3–5 turn sketch):**

```
> look around
Wizard: Aldermere wakes around you — Senna the Fox minding the counter, Galen at
his bench, the Lingerer by the door who watches more than he talks.

> what's troubling folk here?
Wizard: Senna wipes down the bar without looking up. "Toll road's gone quiet in a
bad way," she says. "Nobody's come up from the Greenwood in two days. Used to be
someone through by noon." She doesn't ask you to do anything about it. She's just
saying it out loud, the way people do when a worry won't sit still.

> I'll go take a look
Wizard: You set yourself to it — you'll look into the quiet road. Senna marks
your word with a short nod, like she wasn't sure anyone would.

> [travels to the Greenwood, the standoff scene fires per SL-4]
```

The player was never told this was A Quest. They asked a normal table question, got a
person's worry, and chose to act — the D-B1 "learn" goal born from their own declared
sentence, word-for-word the existing H2 `learn` verb path (`find out/learn/discover` →
`proposeGoal.js:34`), no new verb grammar needed.

**What the engine tracks and where.** A `learn` goal in `world.goals`
(`goal_N`, `targetRef: "learn:the quiet road"`) via the EXISTING `createGoal` call
site already in `playloop.js` (no new mint path). The curated concern text itself lives
as a small new authored table (2-4 entries) keyed to the slice's own node ids, read by
`resolveConcern()` only when `world.map.currentNodeId` is the slice's town — every other
pack/seed is byte-identical, since the override triggers on the SAME "is this the
authored slice" signal `sliceRegion.js`/`demoRegion.js` already establish.

**Consequence if ignored.** The concern text is wired into `introduceThread()` at the
SAME boot moment other pack threads seed today (`playloop.js:286-298`), so it ages
through the EXISTING `tickLivingThreads` clock — after ~4+ unattended world ticks the
objective text mutates ("the quiet road" → something worse, deterministically, via the
already-tested `mutateObjective`). No new consequence engine; this is the one PACK-1's
Bridge Dispute/Drowned Twin already ride.

**No-quest-log compliance.** Nothing new renders. The concern is spoken prose,
answerable only by asking; the goal (if the player commits) sits in `world.goals`
exactly like every other D-B1 goal today — no list, no panel, no checklist ever reads
`world.goals` for UI. `tests/U472` already asserts the sibling `scene.objective` field
stays a single spoken string, never a plural surface — the same discipline applies here
by construction (the concern resolver returns one `body` string, not an array for the
UI to enumerate).

**Effort: S.** Files: `engine/world/placeQuery.js` (`resolveConcern`'s source swap —
the function's own comment at line 244 anticipates exactly this), a new small authored
table (2-4 entries, could live inline or in `engine/world/sliceRegion.js` alongside the
existing `LAYOUT`), `engine/playloop.js` (thread-seeding call, ~5 lines near the existing
pack-threads block). No `WORLD_VERSION` bump — reuses existing shapes throughout.

---

## Candidate B — a pinned living thread

**The want itself.** Instead of (or alongside) the spoken concern, write ONE real entry
into the dark `world.threads` field at slice boot: `{id: 'greenwood-quiet', objective:
'find out why the Greenwood's gone quiet', tension: 1, trajectory: 'static', factionId:
'', nodeId: <greenwood's id>, active: true, age: 0}`. This activates the
already-normalized, already-hashed, already-invariant-checked shape that today sits
empty — `sceneDirector.chooseLivingThread()` already picks the highest-tension active
thread and could surface it in ambient narration (a line that colors a scene without the
player asking a direct question), which Candidate A's concern-only surfacing doesn't
reach.

**How a player discovers it (3–5 turn sketch):**

```
> [arrives in Aldermere, scene composer's ambient thread-line fires]
Wizard: Morning finds you where it always has — your own bed, your own four
walls. Down in the common room somebody's already talking about the Greenwood
road, low and worried, the way people talk about a thing they don't want to
name straight.

> ask Senna about the road
Wizard: "Gone quiet," Senna says. "That's never good news out there."

> I'll find out why the road's gone quiet
Wizard: You set yourself to it — you'll find out why the road's gone quiet.
```

**What the engine tracks and where.** `world.threads[]` (the `ensureLivingThreads` shape
in `state.js:1217`), populated once at slice boot in `beginAdventure`
(`engine/playloop.js`, a new small block sibling to the pack-threads seed at
line 286-298). `sceneDirector.chooseLivingThread` is an EXISTING reader; whether it's
wired into ambient narration output is the open question (see below) — today it's read
but I did not find a call site that renders its objective into visible prose, which
means this candidate's "ambient" framing needs one more small wiring step beyond A's.

**Consequence if ignored.** The SAME `tickLivingThreads`-family aging exists for
`world.threads`? — checked: **no** — `tickLivingThreads` (worldTick.js:182) reads
`w.instrument.threads`, a DIFFERENT array than `w.threads`. Wiring B's consequence would
need either (a) a small new tick function mirroring `tickLivingThreads` but keyed to
`w.threads`, or (b) writing the same want into BOTH arrays (redundant, ugly). This is
the real cost differentiator vs. Candidate A: A reuses one proven aging path end-to-end;
B needs a second one built or a duplicate-write hack.

**No-quest-log compliance.** Clean — `world.threads` has never been surfaced by any UI
panel (confirmed: it's read only by `sceneDirector.js` and the hash modules), so there's
no existing enumeration risk. But the SAME care applies: any future rendering of this
field must stay single-line ambient color, never a list.

**Effort: M.** Files: `engine/playloop.js` (thread-seed block), possibly
`engine/worldTick.js` (new aging function OR fold into `tickLivingThreads` reading both
arrays — a slightly bigger, more surgical worldTick edit than Candidate A touches),
`engine/sceneDirector.js` (wire `chooseLivingThread`'s output into an actual narration
line if "ambient, unprompted" is the point — today it's read but I couldn't confirm it
renders). No `WORLD_VERSION` bump (shape pre-exists).

---

## Candidate C — cold-open worry line

**The want itself.** The PRD's Phase 1 exit test names this explicitly: *"Author one
cold-open beat at minute zero that voices the first worry out loud."* Replace (or
extend) the generic waking-opener line bank (`composer.js:248-260`, currently one
neutral "morning finds you" paragraph) with a slice-specific variant that puts the
worry directly in the first thing the player reads — before they ask anything.

**How a player discovers it (3–5 turn sketch):**

```
> [new game, wakes in Aldermere — this line replaces the generic waking opener]
Wizard: Morning finds you where it always has — your own bed, your own four
walls, the rafters you could trace blind. Down past the shutters somebody's
arguing about the toll road again — a carter, loud, insisting nobody's come up
from the Greenwood since Sunday. The innkeeper isn't answering him. She's just
watching the door. What do you do?

> ask the innkeeper what's wrong
Wizard: She doesn't look away from the door. "Nothing," she says, which is a
lie, the kind people tell when they haven't decided who to trust with the real
answer yet.

> I'll look into it
Wizard: You set yourself to it — you'll look into the quiet road.
```

**What the engine tracks and where.** Nothing new by itself — this is a NARRATION-ONLY
change (one line bank entry gated on the slice seed, `composer.js`'s existing
`pickWakingOpener`/`sceneTime === 'waking'` branch). The actual tracked want still needs
Candidate A's (or B's) mechanism underneath for the player's "I'll look into it" to mint
a real goal — C is the HOOK, not the whole mechanism. Treat C as a small addition ON TOP
of A, not a standalone alternative.

**Consequence if ignored.** Inherits whichever of A/B it's paired with — C by itself is
prose, not state.

**No-quest-log compliance.** Trivially clean — it's one paragraph of opening flavor,
never enumerable.

**Effort: S** (if riding on Candidate A's mechanism — just the composer line-bank entry)
**or duplicated effort** if built standalone without A/B underneath (a hook with nothing
to hook into). Files: `engine/composer.js` (waking-opener bank, ~10-15 lines), gated on
the slice seed the same way `sliceRegion.js` already gates its own content.

---

## Recommended pick

**Candidate A (curated concern), with Candidate C's cold-open line folded in as a
same-packet second beat — not built standalone.**

Reasoning: A is the cheapest possible change that closes the PRD's exact stated gap
("wants are generic" → wants that name the two authored dangers) by touching a resolver
whose own inline comment already prescribes this exact override, reusing FOUR
already-tested, already-shipped mechanisms (the concern resolver, the D-B1 mint path,
`introduceThread`'s aging, PACK-1's thread-seeding pattern) without inventing a fifth. B
is a legitimate future upgrade (ambient ARC narration instead of query-gated) but its
consequence-aging isn't free — it needs new worldTick wiring B's own analysis surfaces,
which is exactly the kind of unbounded expansion `SOBRIETY.md` warns against for a
Phase-1 hook packet. C alone is theater without A's tracked want underneath it, but
riding on top of A it's what actually satisfies the PRD's literal "voices the first
worry out loud" exit-test line at near-zero marginal cost. Ship A+C together as one
bounded packet; leave B as a documented future rung (Phase 2, "make the memory felt,"
where ambient thread narration belongs more naturally anyway).

---

## Proposed PACKETS row

```
### SL-5 — "Aldermere wants something" (Phase 1's named next)  ·  Phase 1

- **objective:** the slice's town carries ONE curated, seed-deterministic civic worry
  naming (in fiction only) the Greenwood road or the Hollowed Chapel; a player
  discovers it by asking a normal concern-question (existing `resolveConcern()` trigger
  regex, unchanged) OR reads it unprompted in the cold-open waking line; committing to
  it ("I'll look into it" / "I'll help") mints a real `learn` goal via the EXISTING
  D-B1 H2 path (no new verb grammar); an unattended worry ages and mutates via the
  EXISTING `introduceThread`/`tickLivingThreads` clock (same mechanism PACK-1's Bridge
  Dispute/Drowned Twin already ride).
- **allowed_files:** `engine/world/placeQuery.js` (`resolveConcern`'s source, gated to
  the slice's town node id only — every other pack/node byte-identical); a new small
  authored want table (2-4 entries) — inline in `placeQuery.js` or alongside the
  existing `LAYOUT` in `engine/world/sliceRegion.js`, implementer's call;
  `engine/playloop.js` (thread-seed call for the chosen want, ~5-10 lines sibling to the
  existing `pack.threads` block at lines 286-298); `engine/composer.js` (one new
  waking-opener line-bank entry, gated on the slice seed, sibling to the existing
  generic entry at line 255); new `tests/U###.aldermereWants.test.js`.
- **forbidden:** `dialogue.js`/`grace/` (serial taste-critical lane, untouched here);
  `WORLD_VERSION` bump (reuses existing `instrument.threads`/`goals` shapes — no schema
  change); `Math.random` (rng.js only — reuse the seeded-pick pattern `npcWant`'s
  `pick()` already establishes); inventing any §0 cosmology reference in the want text
  (civic/mundane danger only — a quiet road, a ringing bell — never the Scar); touching
  `resolveConcern()`'s behavior for any NON-slice node/pack (must stay byte-identical —
  verify against `tallow` and the generic `fantasy` boot).
- **invariants:** determinism U19/21/22/27/30 unchanged (same seed → same chosen want,
  every time); convergence 100% (no corpus row currently asserts the generic-want
  concern text, but re-run the corpus to confirm no incidental relock); no-quest-log —
  `resolveConcern()` continues to return ONE spoken `body` string, never an array/list
  the caller could enumerate (mirror `tests/U472`'s single-string discipline).
- **test_plan:** unit — the slice's town node returns the curated want (not the generic
  role-pool) on a concern-query; a non-slice pack/node is byte-identical to today;
  "I'll look into it" mints the SAME learn-goal the concern named (round-trip: ask →
  commit → `world.goals` has it); an unattended want ages ~5 ticks and its objective
  text has mutated (reuse `tickLivingThreads`'s existing test pattern); the cold-open
  waking line fires only on the slice seed and is unchanged for `tallow`/generic boots.
  Full suite + `npm run check` GREEN; `playtest:quick` clean.
- **done_when:** a cold stranger, on the slice seed, either reads the worry unprompted
  at wake OR asks a normal concern-question and gets it named — states a self-chosen
  goal pointed at the Greenwood or the chapel inside the PRD's 10-minute exit test; no
  quest UI, no menu; `npm run check` GREEN; determinism/convergence untouched for every
  other seed/pack.
- **rollback:** revert the packet's commit — `resolveConcern()`, the composer line bank,
  and the thread-seed call all fall back to their current generic behavior; no schema
  to unwind (no `WORLD_VERSION` touched).
```

(Test numbers: allocate fresh via `scripts/next-test-number.sh U 3` at implementation
time — `U485-U487` are currently reserved by the parallel SEEK-PERSON packet and may have
moved on by the time this lands.)

---

## Open taste questions for Tim

1. **How many curated worries, and does the player see the SAME one every time on a
   given seed, or does it rotate across a playthrough?** *My default: exactly 2 (one
   Greenwood-pointed, one chapel-pointed), chosen once at boot by seed and held stable
   for the whole session — matching how `npcWant`'s existing `pick()` behaves (stable
   per NPC-id, not re-rolled). A single fixed worry per seed is the simplest thing that
   satisfies "a cold stranger states a self-chosen goal inside 10 minutes," and holding
   it stable avoids the awkwardness of the concern resolver answering differently to the
   same question asked twice in one session.*

2. **Does the worry ever explicitly implicate the bandit camp (Crowfoot Camp) as its
   own third thing, or does it stay folded into the Greenwood's "the road's gone
   quiet" framing?** *My default: fold it in — the road IS the bandit encounter node
   (SL-4's tagging), so "the road's gone quiet" already covers it in-fiction without a
   third authored want diluting the two-danger focus the PRD names explicitly (Greenwood
   + Chapel, not three things).*

3. **Cold-open (Candidate C) — ship it in the SAME packet as the concern resolver
   (Candidate A), or hold it back as a fast-follow once A is live and felt?** *My
   default: same packet — it's a ~10-line addition riding entirely on A's mechanism, and
   PRD's Phase 1 exit test explicitly names "author one cold-open beat" as part of this
   named work, so splitting it into two packets would just be re-litigating scope the
   PRD already settled.*

All three defaults are reversible (a line-bank entry and a resolver source swap, not a
schema change) — flagged here rather than blocking on an answer.
