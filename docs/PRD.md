# IMMORTAL ENGINE — The Victory PRD

*Status: **canonical** — supersedes `PRD-draft-1.md` (the critique draft).*
*Written from a line-by-line audit of the actual engine, 2026-07-02. Every
status in this document was verified against code, not against other documents.*

*How to use this: print PAGE ONE and put it on the wall. When you're lost,
reread page one. When you want detail, read the rest. When you want today's
work, open `docs/PACKETS.md`.*

---

# PAGE ONE — THE WALL

```
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   WORKING TITLE: _______________________________               ║
║   (Decision One. Tim's pen only. No technical blocker.)        ║
║                                                                ║
║   A DUNGEONS & DRAGONS MODULE YOU PLAY BY TALKING.             ║
║   The Dungeon Master is an AI voice.                           ║
║   The world underneath is a real, honest game engine.          ║
║                                                                ║
║   IT LETS YOU TRY ANYTHING —                                   ║
║   AND HOLDS YOU TO IT FOREVER.                                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

**THE ONE LAW.** The DM speaks; the engine decides. The AI is the voice at
the table — it never rolls the dice, never owns the truth, never changes
what already happened. If the voice and the world ever disagree, the world
wins and the voice is the bug.

**THE LADDER** — what a player discovers, rung by rung, with no signposts:

```
  6   "There's something underneath all of this."     (the soul — V2)
  5   "This world is alive when I'm not looking."     (V1 gets a taste)
  4   "It REMEMBERS what I did."                      (V1 — must be FELT)
  3   "This adventure was my own idea."               (V1 — must be FELT)
  2   "It speaks — every character a voice."          (V1.5 fast-follow)
  1   "I can say anything, and the story holds."      (V1 floor — the grind)
```

**THE THREE VICTORIES** — in order, and only in order:

```
  V1 — THE MODULE (sell this one)
      One complete adventure: Aldermere, its woods, a bandit camp, a
      haunted chapel. A stranger pays a few dollars, plays two to four
      evenings, reaches a real ending — or a real death — and says:
      "That was a good DM running a solid game."

  V2 — THE CAMPAIGN (the county opens)
      Five towns. The orb. The buried why. Rungs 5 and 6. Death gets
      its second act. The module becomes a world.

  V3 — THE DREAM (the horizon)
      Voice-native. Infinite worlds. Shared worlds that hold through
      consequence — permanence as the multiplayer law.

  RULE: no victory begins until the one before it is FINISHED and FELT.
```

**YOU ARE HERE — 2026-07-02.** The engine is most of V1 already, and it is
*ahead of every document written about it*. What wobbles: the DM still
breaks the fiction about one turn in twelve (4 of 48 on the last measured
gate, down from 9 at this audit). What's missing is small and nameable: an
opening scene, a
town that *wants* something, a death that leaves a mark, and tuning so the
built world is actually *felt*. Current work: **Phase 0 (the floor) +
Phase 1 (the hook)** — see The Plan.

---

## 1. The product, in one paragraph

The product is not an engine. It is **an evening**: one person, a keyboard
(a microphone later), and a DM who understands anything they say, rules it
fairly, remembers it forever, and never once breaks the spell. The engine
exists so that evening can be honest — every roll provable, every fact
permanent, every consequence real. We sell evenings. The engine is how we
keep the promise.

## 2. Who it's for

A solo tabletop player — D&D-literate or D&D-curious — who wants a
competent DM on demand and has been burned by AI-DM chatbots that forget
the map, contradict yesterday, and fudge the dice. They value fairness and
continuity as much as flavor.

Why nothing else works for them:

- **A chatbot DM** forgets, retcons, and cheats, because the transcript
  *is* its world. Ours can't — the world lives in the engine, and the DM
  literally cannot change what already happened.
- **A virtual tabletop** (Roll20, Foundry) needs a human DM and hours of
  prep. Ours narrates, adjudicates, and bookkeeps for you. Zero prep.
- **A video game / CYOA** punishes anything off the menu. Ours takes "I
  bribe the gravedigger with the chapel key" and rules it, in the story.

Not first: groups/multiplayer, world-builder sandboxers, console-polish
audiences. They come at V2/V3.

## 3. The Laws (non-negotiable — a change that breaks one is a bug, however good it feels)

1. **The DM speaks; the engine decides.** The AI interprets what you meant
   and narrates what happened. It never writes truth, rolls dice, or picks
   outcomes.
2. **Same seed, same world.** The world is reproducible from its starting
   seed plus your choices. The dice are honest and *provably* honest —
   any session can be replayed and checked against the world's fingerprint.
3. **Canon wins.** Nothing ever un-happens. If narration and world state
   disagree, the world state is the truth and the narration is a defect.
4. **The DM is the only verb.** All action happens by talking. The map and
   UI are read-only aids — beautiful, but they never act.
5. **Never bounce intent back as a menu.** No "did you mean A or B?", no
   "invalid action." A real DM rules and plays on. (THE DM TEST.)
6. **Narrate the read, never the number.** No HP, no DCs, no percentages
   in the fiction. The player gets the *read* — the sagging floor, the
   guard's half-turned back — and it's always enough to choose well.
7. **No quest logs.** Goals live in the player's head and the world's
   memory, never in a checklist panel.
8. **Consequences are forever — and must eventually be SEEN.** A permanent
   change that no player ever witnesses might as well not exist. (THE
   WITNESS TEST, defined below.)
9. **The why stays buried.** The cosmology is never explained in-world.
   Symptoms, faith, rumor — never the answer.
10. **The game never crashes because the AI failed.** If the model is
    missing or errors, deterministic base narration carries the session.

## 4. What victory looks like — Dana's evenings

*(Illustrative fiction. This is the bar, not a spec. Note there is not one
number in it.)*

Dana is thirty-four, played 5e for years, can never find a DM. She buys
the game, types one line about who she is — or just picks Wrenna Vale from
the five ready-made heroes — and she's in Aldermere's inn before her tea
cools. She doesn't get a tutorial. She gets an argument already in
progress: a carter shouting about the road toll, a name — Crowfoot —
spat like a curse, and the innkeeper watching the door like it owes her
something.

Dana talks. That's the whole interface. She asks the innkeeper what's
wrong and gets a person, not a lore dump: a brother who went up to the
chapel to bury the same cousin *twice*, and hasn't come back. Dana says,
"I'll look in on him." No banner drops. No quest chime. The innkeeper just
looks at her like she's the first person to say it out loud.

In the Greenwood the bandits step onto the road, and Dana talks her way
past — mostly. It costs her the wine in her pack, and they'll remember her
face. At the chapel the DM tells her the floor sags before she crosses it,
so when it gives way, it's her gamble, not the game's cruelty. She fights
something that shouldn't be walking, wins ugly, and limps back to town for
a real bed. While she sleeps, the world moves — and the morning mentions it.

The next evening opens like a table: *previously* — her deeds, her debts,
still true. A stranger at the bar nods at her: he's read about the toll
road in the county paper, and the paper got it wrong in exactly the way
news gets things wrong. She laughs out loud. It's the first time a game
has ever *gossiped about her*.

Two evenings later she ends it — the chapel's truth faced, the camp's fate
settled — and the game hands her a chronicle of everything that is now
true because of her, and asks one quiet question about what comes next.

Or she dies down there. And the next evening, Bryn Holt walks into the
same Aldermere, where the road still talks about the outlander who went
under the chapel and didn't come up — and her sword is still down there.

Dana tells a friend: **"It let me try anything, and it never once forgot."**
That sentence is the product.

## 5. The Armory — what is ALREADY BUILT (verified in code, 2026-07-02)

The single biggest fact this document exists to record: **the engine is
ahead of its own reputation.** Before building anything, check this table
and `docs/WHAT_THIS_IS.md` — the audit found the last PRD proposing five
systems that already existed.

Legend: 🟢 live and working · 🟡 live in code but not yet *felt* in play
(needs content, tuning, or proof) · 🔴 missing.

| System | What it gives the player | State |
|---|---|---|
| Deterministic world + canon log | Honest dice, permanent facts, provable replay — the moat | 🟢 |
| Free-speech understanding + rulings | Say anything; it resolves in fiction (egress doors, meta-handling, graceful adjudication) | 🟢 with seams — 9/48 → 4/48; structural close adopted 2026-07-03 (**INT arc**) |
| Escape combat, two-sided tactics, monster traits-as-code | Fights where positioning, traits, and nerve matter | 🟢 |
| Mixed outcomes + stake clocks | Failure is never "nothing happens" — success-at-cost is built in | 🟢 |
| Stakes telegraphs ("XCOM read as pure fiction") | You see the danger before you gamble | 🟢 |
| Talk→goal bridge | "I'll help you" mints the NPC's own want as *your chosen* goal — no quest board | 🟢 machinery / 🟡 wants are generic |
| NPC depth: knowledge, secrets, memory, insult physics | People who know things, keep things, and remember you | 🟡 partial felt |
| Rumors that travel node-to-node and distort by teller | The world retells your deeds — imperfectly, while canon stays perfect | 🟡 may be tuned too slow to feel in one evening |
| The county newspaper + reputation-travels | Strangers who've *read about you* greet you by your deeds | 🟡 unverified in the slice |
| Faction standing (deed → institutional reaction, witness-gated) | Institutions that learn what you did and shift | 🟡 tested, not yet surfaced |
| Rest system (beds, shelters, breathers) | The night as a real mechanic | 🟢 |
| Resume recap ("previously, at this table…") | Session two opens like a real table | 🟢 |
| Endings, epilogue, chronicle export, sequel hook | A run can *finish* and hand you its story | 🟡 wired; session shape undefined |
| The slice: Aldermere · Greenwood · Crowfoot Camp · Hollowed Chapel, themed undead, pre-rolled heroes | The whole V1 stage, live on its own seed | 🟢 |
| 3D map layer, authored interiors, figures | The look of a real place | 🟢 built / 🟡 one-map + notebook UI pending |
| The bench: 640 creatures, 175 spells, 488 backstories, 5 genre packs, economy, magic | Optionality — draw into the slice only what earns a rung | 🟡 benched on purpose |
| Cold open (an opening scene in motion) | — | 🔴 |
| Town wants pointed at the module's dangers | — | 🔴 |
| Death legacy (world carries on; next hero inherits it) | — | 🔴 |
| Voice input / character voices | — | 🔴 (V1.5 / V2) |
| Name, storefront, payment | — | 🔴 (Phase 4–5) |

## 6. The Gap — everything between today and V1

Small and nameable. In order of weight:

1. **The floor wobbles (rung 1).** 4 of 48 turns still break the fiction
   on the standing gate (down from 9). The 07-02/03 meta-diagnosis found
   these are not many seams but ONE root patched at the wrong layer — so
   the close is now *structural* (the **INT arc**: the LLM reads the
   player, the engine rules the world), not an endless seam hunt. Still
   the mortgage on everything else.
2. **Nothing pulls (rung 3).** The town has no wants pointed at the two
   authored dangers, and minute zero is a blank page.
3. **The memory is invisible (rung 4).** Rumors, the newspaper, faction
   shifts — built, wired, and possibly *sub-perceptual* at session scale.
   Built is not done; done is not felt.
4. **A run can't land.** The ending machinery exists but the session
   ritual (rest as chapter break, module resolution, death-with-legacy)
   isn't authored.
5. **It has no face and no door.** No name, notebook UI not locked, no
   place to pay.

**THE WITNESS TEST** (new law, sibling of the DM Test and Table Test): *a
feature exists when a stranger mentions it unprompted.* Not when it's
merged, not when its test is green — when a playtester who wasn't told
about it brings it up on their own. Phase 2 exists to make the armory's
🟡 rows pass this test.

## 7. The Plan — six phases to V1

Each phase is a playable milestone with an exit test. Phases 1–4 are
mostly *content, wiring, and tuning* — the audit's lesson is that the
machinery largely exists.

**PHASE 0 — THE FLOOR HOLDS** *(rung 1 · always on · weeks, interleaved)*
Method changed 2026-07-03: from per-seam patching (the meta-diagnosis:
~25 packets spent on one root) to the **structural close** — an LLM
translates player speech into ONE typed intent; the deterministic engine
grounds, validates, rolls, and commits. THE ONE LAW untouched:
interpretation is not authority. Packets **INT-1…INT-4** (`PACKETS.md`),
families graduated one at a time; the standing gate stays on as discovery.
*Exit: ≤ 2 broken turns per 48 gate probes, twice in a row, and no
categorically-new failure class across those runs (today: 4/48, from 9).*

**PHASE 1 — THE HOOK: Aldermere wants something** *(rung 3 · days)*
Give the townsfolk real worries that point at the two authored dangers —
attached at the existing NPC-want seam, feeding the already-live "I'll
help you" goal path. Author one cold-open beat at minute zero that voices
the first worry out loud. This is packet **SL-5**, next on the queue.
*Exit: a cold stranger states a self-chosen goal inside 10 minutes — no
quest UI, no menu.*

**PHASE 2 — THE MIRROR: make the memory felt** *(rung 4 + a taste of 5 · ~a week)*
Tune the built world to evening scale: rumor travel speed (today a rumor
may wait 30+ world-ticks before it can move — likely never inside one
session), the newspaper actually appearing in the slice, faction shifts
surfacing as a greeting line, one "while you slept…" line at rest, an
echo audit (the opened door, the disturbed grave).
*Exit: THE WITNESS TEST — strangers mention ≥ 2 "it remembered" moments
unprompted; the quit→resume return test passes every time.*

**PHASE 3 — THE END: a run can finish** *(the most taste-laden phase · a week-plus)*
Author the module's resolution across the four places — the chapel's
truth, the camp's fate. Shape the wired ending/epilogue/chronicle into
the session ritual. Death v1 = **legacy**: the world keeps your story;
your next ready-made hero enters the *same* world, where your bones and
rumors persist. (Not the underworld — that's V2.)
*Exit: two strangers finish the module and call the ending satisfying;
dying and returning visibly references the fallen hero.*

**PHASE 4 — THE FACE: it looks like what it is** *(taste-days)*
The name (Decision One). Notebook-aesthetic UI locked. One continuous
map, legible tiles. A front door worth a screenshot.
*Exit: the screenshot alone makes a stranger say "that's a real game."*

**PHASE 5 — THE DOOR: someone can pay** *(not code)*
Hosting, accounts, payment, a store page. Content-policy check *before*
the storefront (V1 is clean — the dark path is V2). Price it.
*Exit: a stranger pays, plays, and finishes with Tim not in the room.*

**After V1, in order:** voice input (V1.5 — rung 2's first half) →
Khazekhrok under the inn cellar (the 20-level expansion, port-kit ready)
→ V2 the campaign (five towns, the orb, rungs 5–6, the underworld) →
V3 the dream.

## 8. The Proof Regime — how we know any of it is true

Three signals, none trusted alone:

1. **The machine suite** — ~9,000 automated checks, always green,
   including the world-fingerprint replay that proves the dice honest.
2. **The standing gate** — AI playtesters probing the live game like real
   players, judged cross-family to avoid the AI grading its own homework.
   This is the repo's costliest instrument; it runs from the CLI, on
   purpose, with a ledger.
3. **Humans** — Tim and strangers, in the live build, through the real
   player gestures, screenshotted.

Plus the table laws as hard gates: **THE DM TEST** (intent resolved in
fiction, never bounced), **THE TABLE TEST** (behaves like a real table),
**THE MAP-FIDELITY RULE** (not done until the map shows it), **THE
WITNESS TEST** (not done until a stranger mentions it).

**V1 SHIPS WHEN — the checklist:**

- [ ] Fiction holds: ≤ 2 broken turns per 48 on the standing gate, twice in a row.
- [ ] The stranger verdict: 3 of 4 blind playtesters say, in substance, "a good DM running a solid game."
- [ ] The return test: quit → resume → the recap is true and the world intact, every time.
- [ ] The witness test: strangers mention ≥ 2 remembered-consequences unprompted.
- [ ] It ends: the module completes with a chronicle; death produces a legacy, not just a screen.
- [ ] The kill switch: with the AI disabled, the game still plays to an ending on base narration.
- [ ] Someone pays: one real stranger buys it, plays it, finishes it, unassisted.

## 9. Anti-Scope for V1 (real ambitions, parked on purpose)

Multiplayer / shared worlds · the underworld death-run · infinite or
procedural worlds · prose-to-world at scale · voice *output* / character
audio · the runtime second-model referee · surfacing the cosmology
(hard law №9) · the 1000-creature bestiary · living economy · deep
chargen / leveling · genre packs · the campaign's five towns · Easter
eggs. **Rule of thumb: if it makes the demo bigger instead of the first
evening better, it waits.**

## 10. The Dangers (how this dies, ranked)

1. **Rebuilding what exists.** The audit caught the last plan proposing
   five already-built systems. Check the Armory and `WHAT_THIS_IS.md`
   before any build.
2. **Drift.** The voice inventing rooms, people, outcomes. The gate and
   the canon-wins law exist for this; never relax them.
3. **Built-but-never-felt.** Features tuned below perception. The Witness
   Test is the antidote.
4. **Scope gravity.** Every shiny thing above in §9. `SOBRIETY.md` is the
   brake; use it.
5. **The naming stall.** Decision One has no technical blocker. A blank on
   the wall is a to-do, not a mystery.
6. **Content-policy surprise.** Check distribution rules before building
   the storefront, not after.
7. **Test brittleness.** Assert behavior and fingerprints, never exact
   prose — narration is allowed to breathe.

## 11. The Doc Map — where everything else lives

| Document | Job |
|---|---|
| **This file** | What winning is, and the road to it |
| `PACKETS.md` | Today's work queue (the live to-do) |
| `RUNG1_CONVERGENCE_PLAN.md` | How rung 1 closes — ADOPTED 2026-07-03, spec behind the INT arc |
| `WHAT_THIS_IS.md` | Full per-system status audit |
| `PUNCHLIST.md` | The ladder + sell checklist (source of the rungs) |
| `NORTH_STAR.md` / `ROADMAP.md` | The dream and the direction (V2/V3) |
| `SOBRIETY.md` | The brakes |
| `THE_DM_TEST.md` / `THE_TABLE_TEST.md` | The behavior laws |
| `IMMORTAL_INVARIANTS.md` | The engine's non-negotiables, in full |

---

*The engine is built. Make it felt. Make it end. Then sell the evening.*
