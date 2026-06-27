# What This Is — Immortal Engine, in Plain English

*A field guide to the whole machine, written for Tim (not for a coder). Audited from
the actual code on 2026-06-16. The goal: you can hold this in your head, and we can plan
from it.*

> **Banner (read me first):** the *facts* in this doc are current, but it predates the
> **realization-ladder** reframe. For how we now *sequence* the work (rung 1 first, surface
> the rest in order), see `docs/PATH_TO_SELLABLE.md` — it supersedes the "surface the depth"
> strategy framing here. This file stays the **system inventory**; the ladder is the **plan**.

---

## How to read this doc

Every system gets a **status tag** so you can tell "exists in the code" apart from
"a stranger would actually feel it in a 20-minute playthrough." That difference is the
whole story of where we are.

- 🟢 **Live** — built, wired, and surfaces in normal play. A player feels it.
- 🟡 **Built but dark** — the system exists and works, but the player rarely or never
  sees it, usually because it's the last wire (a single assignment or a UI panel) that's
  missing. *This is where most of our hidden value is sitting.*
- 🔴 **Partial** — started, real in places, not yet a finished thing.

And a **moat note** — one line on whether a typical competitor (an "AI dungeon master"
chatbot) has this. That column is the sellable argument.

---

## The one-paragraph version

Immortal Engine is an **infinite, AI-narrated tabletop RPG you play by talking.** You
type what you want to do in plain English; an AI dungeon master answers in prose. But
underneath the prose is a real, deterministic game engine — it knows your stats, rolls
real dice, runs real combat against a bestiary of ~640 creatures, tracks 175 spells,
remembers every fact as permanent canon, and simulates a living world with its own gods,
creation myth, and a social network down which rumors travel and distort. The AI is the
*voice*; the engine is the *world*. Crucially, the engine never forgets and never
contradicts itself — the thing every other AI-RPG fails at — because the world is a
simulation with a permanent ledger, not a chatbot trying to remember.

---

## The big map (the one page to hold in your head)

| # | System | What it is | Status |
|---|--------|------------|--------|
| 1 | **The DM Loop** | You talk; the engine resolves; the AI narrates | 🟢 Live |
| 2 | **The Deterministic Core + Canon Log** | The permanent memory; same seed → same world, forever | 🟢 Live |
| 3 | **The World & Map** | One continuous walkable world, overworld down to a room | 🟢 Live |
| 4 | **The Creation Myth (Substrate)** | A real cosmology→region→town history under every place, with a sealed secret | 🟡 Built but dark |
| 5 | **NPCs & Dialogue** | Procedural people with personality, memory, knowledge, and secrets | 🟢 Live |
| 6 | **Historical Figures (RAG voices)** | NPCs who can speak as real people, grounded in their real writings | 🟡 Built but dark |
| 7 | **The Rumor / Claims Social Graph** | Six-degrees gossip that distorts as it spreads | 🟡 Built but dark |
| 8 | **The Pantheon & Magic (Will)** | Ten gods of Will, ten schools, prices and taboos | 🟡 Built but dark |
| 9 | **Morality (The Dark Path)** | A re-enchanted moral universe where karma is physically real | 🔴 Partial (designed in full, built to M2) |
| 10 | **Combat** | Real 5e-style crunch: dice, conditions, grapples, hazards, loot | 🟢 Live |
| 11 | **The Bestiary, Spells & Items** | ~640 creatures, 175 spells, full item system | 🟢 Live (content), 🟡 (depth surfaced) |
| 12 | **Character Creation** | 5e-lite chargen, the Wanderer archetype | 🟢 Live |
| 13 | **Genre Packs & Prose-to-World** | 5 settings; an importer that turns prose into a playable world | 🟢 Live (packs), 🟡 (importer) |

The pattern jumps out: **the things that make this special are mostly 🟡 — built and
working, but not yet reaching the player.** That's not a content problem (the content
exists). It's a *wiring and surfacing* problem, which is far cheaper and faster to fix
than building. More on that at the bottom.

---

# The systems, one by one

## 1. The DM Loop — *how a turn actually works* 🟢 Live

**In plain terms:** You type "I shoulder the door open and look for the ledger." The
engine figures out what you're trying to do (open a door, then search), checks it against
the real world (is there a door? is it locked? what's your strength?), rolls dice if the
outcome is uncertain, updates the world, and *then* hands the result to the AI to write
up as prose. The AI never decides what happens — it only describes what the engine already
decided. That's the core trick and the reason this doesn't drift.

**Under the hood:** `playloop.js` (the single biggest file, ~5,700 lines) is the spine.
It parses your text into an *intent*, routes it (move / attack / cast / talk / search /
travel / examine / meta-question…), runs it through `resolve.js` (d20 vs a difficulty
class), and produces *deltas* (structured changes) that `effectsCore.js` applies. The AI
narration sits at the very end and is allowed to fail silently — if the AI is down, you
still get a plain, correct description and the game continues.

**The governing rule** (`docs/THE_DM_TEST.md`): *do what a real dungeon master would do.*
Resolve the player's intent in the fiction; never bounce it back as a menu or a system
error. A huge amount of the recent work is closing the gaps where the engine used to
answer a question with a non-sequitur (you ask "what's my Might modifier?" and it rolls
dice at you). The current automated playtest fails ~17% of turns, almost all in those
edge seams, down from ~35%.

**Moat:** The "engine decides, AI narrates" split is the architectural bet competitors
*don't* make. Most let the AI decide everything (and accept the drift). This is the moat's
foundation.

---

## 2. The Deterministic Core + Canon Log — *the permanent memory* 🟢 Live

**In plain terms:** The world is built from a *seed* (a starting number). The same seed
plus the same sequence of player actions always produces the exact same world — every
NPC, every street, every dice roll, identical, forever. And every fact that becomes true
(you killed the captain; the bridge burned; the elder's name is Kael) is written into a
permanent ledger called the **Canon Log**. If the AI's prose ever disagrees with the
ledger, *the ledger wins.*

**Why this is the whole ballgame:** The number-one reason people quit AI role-playing
games is that the AI forgets and contradicts itself — the character you married last
session doesn't know you today; the city that burned is fine. Immortal Engine *structurally
cannot* do that, because memory isn't the AI's job. The world is a deterministic
simulation with an immortal ledger. The AI is just the narrator reading from it.

**Under the hood:** `state.js` defines the world shape (currently `WORLD_VERSION = 27`).
`worldHash.js` produces a fingerprint of the world that must stay identical under replay —
there are dedicated tests (U19/21/22/27/30) that fail the build if determinism ever
breaks. `csl/canonLog.js` is the ledger; `save.js` exports/imports a whole world as a file.

**Moat:** *This is the single strongest thing you own.* "Never forgets, never contradicts,
provably" is a category-defining claim, and no chatbot-with-memory can make it. Everything
else is downstream of this.

---

## 3. The World & Map — *one continuous walkable place* 🟢 Live

**In plain terms:** There's one seamless world. You zoom from an overworld of regions and
roads, down to a village laid out organically (not on a grid), into a specific building,
into a specific room — and it's all one consistent space. Walls block you, doors and
windows are real openings, and where you stand matters.

**Under the hood:** `map/generateMap.js` and `world/regions.js` build the world; nodes
(settlements, dungeons) decompress into detailed places on first visit
(`decompression/`, `structures/`). The browser renders a continuous place
(`public/map/handDrawnPlace.js`) with line-of-sight and collision, not a tile grid. There's
an authored building catalog (cottage, tavern, chapel, keep, smithy, mill, manor,
bathhouse…) that gives interiors real floor plans.

**Where it's still moving:** the "one continuous zoom, kill the zoom button" ideal is
partly done — this is an active polish track, not a finished surface.

**Moat:** Most text-AI-RPGs have no real spatial model at all — "you are in a room" is
just words. Here the space is real and consistent, which is what lets movement-by-
conversation actually work.

---

## 4. The Creation Myth (Substrate) — *real history under every place* 🟡 Built but dark

**In plain terms:** Under every town is a real, generated history that descends causally:
the **age of the world** (which god is ascendant) → the **region's** founding and crises →
the **town's** own founding and local events. NPCs know their slice of it with appropriate
fuzziness — a townsperson speaks of their own town *vividly*, the region *dimly*, the
cosmic age as *myth*. And beneath all of it is a single **sealed secret** the author holds
(`deep:foundation`): an object older than the founding the world's own religion teaches —
*"set down here, on purpose, in an age the town's story says had no one in it, and it has
been awake the whole time."* A genuine cosmological mystery, deliberately buried.

**Under the hood:** `substrate.js` generates the cosmology and region layers
deterministically; node history is added lazily on first visit. `npcSubstrateContext()`
hands each NPC their cascade-weighted view (vivid / dim / myth), and the server *does*
feed this into the NPC voice prompt. So the history is real and it touches the voice layer.

**Why it's 🟡:** The history exists and colors how NPCs talk, but it isn't yet a *thread
the player can pull* — the sealed secret isn't surfaced as a mystery you can chase, and the
substrate's specific events ("the winter a stranger stayed three months and left something
behind") aren't yet reliably answerable when a player asks a pointed question. The depth is
real; the player's *door into it* is narrow.

**Moat:** Nobody else has a buried, internally-consistent creation myth with a real secret
at the bottom. This is the answer to "why would I keep playing?" — and to "what's the
hook?" (see the plan).

---

## 5. NPCs & Dialogue — *people, not quest-dispensers* 🟢 Live

**In plain terms:** The world is full of procedurally-generated people who each have a
personality (how much they trust outsiders, how much they fear for themselves, how honest
they are), a memory of what they've witnessed, a set of things they know (some public,
some secret), and relationships with other NPCs. When you talk to one, *how* they answer —
guarded, blunt, open, skittish — comes from their personality, and *what* they'll tell you
is gated by how much they trust you. An honest innkeeper tells you the road north is
washed out; a frightened smuggler deflects until you've earned it.

**Under the hood:** `npc/npcGenesis.js` births them; `npc/dialogue.js` runs the
conversation; `npc/perspectiveFilter.js` decides what each person will share based on
trust and secrecy; `npc/npcDepth.js` and a per-NPC *knowledge graph* hold their facts and
secrets; `npc/npcMemory.js` records what they've seen you do. The system honors the DM
Test: ask a villager their name, the town's news, or the way to the next town, and they
just answer — from real world data, in their own voice.

**The bespoke voice:** an NPC's actual spoken line can be generated by a *local* AI model
(Ollama on your machine) through `/api/npc-voice`, grounded in that NPC's manner, mood,
trust, the substrate history, and what they actually know. If the local model isn't
running, it falls back to solid templated dialogue.

**Moat:** Trust-gated, personality-driven, memory-having NPCs are well beyond "the AI
plays everyone the same." The knowledge-graph + perspective-filter combo is real social
simulation.

---

## 6. Historical Figures (RAG voices) — *speak with the dead* 🟡 Built but dark

**In plain terms:** An NPC can be wired to a *real historical person* and speak grounded
in that person's actual writings. There's a library of **488 backstory files** in
`server/rag/corpus/` — ~437 are original NPC backstories (the academy librarian, the
apothecary, the bookbinder…), and ~51 are **real people**: Lincoln, Marcus Aurelius,
Frederick Douglass, Joan of Arc, Cleopatra, Genghis Khan, Sun Tzu, Darwin, da Vinci — plus
a set of deliberate *mashups* (Steve Jobs × da Vinci as an artificer-sage; Jeff Goldblum ×
Socrates as a marketplace questioner; Muhammad Ali × Achilles as a champion-bard). When you
say something to one, the system retrieves the four most relevant chunks of their real
words and colors their reply with that vocabulary and rhythm.

**The honest, important finding (the cleanest example of 🟡 in the whole project):** This
pipeline is **fully built and wired end to end** — the server route, the retriever
(`ragRetriever.js`), the voice-prompt assembler (`npcVoicePrompt.js`) all work, with a
graceful fallback. But **no NPC in the live, procedurally-generated world is currently
*assigned* a historical figure.** The procedural world hands out generated names, not
corpus-backed ones. So in a normal playthrough today, *none of those 488 files reach the
player.* It is a finished, powerful feature sitting one assignment-step away from being
live. Lighting it up is wiring, not building.

**Moat:** "Argue philosophy with Marcus Aurelius, who is grounded in the actual
*Meditations*; then go con Mark Twain" is a demo nobody can match — and it's already coded.
This is possibly the most *immediately marketable* asset in the repo and it's currently
switched off.

---

## 7. The Rumor / Claims Social Graph — *gossip that bends* 🟡 Built but dark

**In plain terms:** Information travels through people. When something happens, a witness
forms a *claim* (their belief about it). That claim spreads NPC-to-NPC along their actual
friendships — and every hop, it loses a little certainty and gains a little distortion. A
self-protective person clings to what they already believed instead of updating, so the
*town's* version of events can fracture: two people, two contradictory stories, both
traceable back through the chain of who-told-whom. Distant, big events arrive in your local
tavern as small, garbled rumors ("trouble with the orc queen" five hops from a kingdom in
civil war). And your *own* deeds become rumors that reach the next town before you do.

**Under the hood:** `claims.js` is the six-degrees engine — real provenance chains,
weight-decay (0.85 per hop), distortion bumps, a cycle guard, and a resistance/fracture
rule. It is deterministic and uses *zero* AI calls; the AI only writes the words at speak-
time. The separate `rumor/` system mints rumors about distant content at a computed
fidelity tier (truth → fresh → distorted → rumor → vague dread) and caches them in the
Canon Log forever.

**Why it's 🟡:** The propagation engine works and is tested, but it isn't yet *visible* —
there's no "rumor board," and a casual player won't notice that the gossip they hear is a
distorted, traceable artifact rather than flavor text. The mechanism is real; the player's
awareness of it is thin.

**Moat:** A *distorting, fracturing, traceable* information network is genuinely novel —
it's the "rumor collapse" idea, and it's the mechanism that makes the world feel alive
rather than scripted. No competitor has it.

---

## 8. The Pantheon & Magic (Will) — *ten gods, ten prices* 🟡 Built but dark

**In plain terms:** Magic is an act of *will*, and there are ten **Governors** — lesser
gods, one per school of magic. Each owns a mode of will, exacts a price, and forbids a
thing: The Unbound Flame (evocation — the will to destroy; price: wrath turns on its
wielder); The Crowned Tongue (enchantment — the will to rule another's will; its taboo is
*the* sin, overriding a True Will); The Hour That Turns (chronomancy — forbidden outright).
One Governor is *ascendant* in any given world, which blesses its school and makes the
opposite school the age's great taboo. Each god has a sign, a cult (a faction), and an
opposite.

**Under the hood:** `magic/cosmology.js` holds the ten Governors as data with their
relationships; `magic/will.js`, `willCost.js`, `forbiddenGates.js`, `daemon.js`, and
`castConsequence.js` implement willed magic and its consequences (the project memory note:
"gratuitous magic must have consequence" — blasting villagers draws social, environmental,
and divine recoil). The ascendant god feeds the substrate's "age" layer.

**Why it's 🟡:** The pantheon is real data and feeds the world's history and some
consequences, but the gods aren't yet *visible actors* a player consciously navigates —
the full "draw the gaze of the god you resemble" layer is designed (see Morality, below)
but not built. The bones are there; the drama isn't surfaced yet.

**Moat:** A magic system where each school is a *god with a price and a taboo* is far richer
than "fireball costs a slot." It's the spine the morality system hangs on.

---

## 9. Morality (The Dark Path) — *a world where karma is physically real* 🔴 Partial

**In plain terms:** This is the most ambitious design in the project, and the one you
care most about. The pitch (your words): *a player can do truly horrible things to become
a powerful evil mage, and they can — the power is real and immediate. But the price is the
world, modeled like reality: a psychopath is never trusted for long. Doors close. Help
doesn't come. Your reputation beats you to town. The light path is slower and harder, but
it compounds — and its ultimate reward is the one thing no god can grant: a friend, earned
only by listening to someone tell you a hard truth and not turning away.*

It's built on a real cosmology: a three-tier pantheon (a Creator who asks nothing, above
the Virtue gods who keep covenant, above the Sin gods who *cannot* keep a contract because
disorder is what they *are*). Your soul is tracked on **seven axes** (the seven deadly sins
and their contrary virtues), not one slider — so you can be "a proud, wrathful man who was
never greedy a day in his life." The gods respond to what you've *become*, and the world
speaks in omens the wise learn to read. There's no morality meter in the UI — the world
*is* the meter. And there's a hard line, governed by "the Camera Rule": the engine
adjudicates any atrocity but never *serves* one (it renders evil as weight and consequence,
never as a power-fantasy high; and child-harm is simply out of the engine, framed in-world
as the one unseen god's single law).

**Status — what's actually built vs. designed:** The full design exists in
`docs/MORALITY_SYSTEM.md` (and `MORALITY_GRIMOIRE.md`) and it is *extraordinary* — but the
code is at the early milestones:
- 🟢 **M0–M1 built:** the moral state (seven axes + derived corruption/virtue), the
  permanent deeds ledger, and a *deed detector* that recognizes cruelty/forbidden-power
  from your own words and records the right charges (kill-to-save marks *both* wrath and
  charity — "the soldier's bargain").
- 🟡 **M2 partial:** witnessed deeds shift that NPC's trust, and your corruption/virtue
  already bends how hard you are to charm or intimidate. The rest of M2 (reputation
  traveling via rumors, towns withholding help) is specced, not built.
- 🔴 **M4–M11 designed, not built:** corruption→capability unlocks, redemption + the point
  of no return, crime & detection ("you'd better be good at it"), the visible pantheon and
  the gaze, the omen/sign layer, the human Cassandra who warns you once, dedication rites,
  and the keystone — friends who choose you and can be lost forever.

**Moat:** If even half of this ships, it's unlike anything in the genre — a moral universe
with real physics, rendered as literature. This is the *soul* of the product. It's also
the biggest remaining build.

---

## 10. Combat — *real crunch, run from your words* 🟢 Live

**In plain terms:** Combat is real D&D-style mechanics, but you fight by *describing*, not
by picking from a menu. "I feint left and drive my shoulder into him to put him on the
ground" becomes a real grapple attempt with a real roll and a real *condition* (prone,
grappled, choked, restrained) that then changes what's possible next turn. You can grab,
throw, choke, trip; you can use the environment (collapse a ceiling, set a fire, shove
someone off a ledge); you can take a swing at a training dummy and the engine knows it's a
dummy.

**Under the hood:** The *live* combat engine is `combat/escapeCombat.js` (classic HP, the
mode the v1 game actually boots). On top of it this session we built `combat/grapple.js`
(clinch/throw/choke/escape, control modeled as conditions), `combat/hazard.js`
(collapse/fire/fall with real dice and DCs), plus the `conditions.js` /
`conditionEffects.js` / `conditionInference.js` stack. There's a *second*, deeper combat
engine (`combat/combatResolve.js`) that isn't the one wired into v1 — a known fork to be
aware of.

**Where it's still rough:** the automated playtest still catches the occasional seam — a
fall that's narrated but doesn't deduct HP, a physical attack that gets tagged as a spell.
These are the last-mile reconciliation bugs, not missing systems.

**Moat:** "Fight by describing, with real grappling and environmental hazards resolved by
genuine rules" is a long way past "you attack. you hit." And the roadmap here is delicious —
you've already imagined the master on the hill who teaches judo throws and submissions.

---

## 11. The Bestiary, Spells & Items — *the content mass* 🟢 Live / 🟡 depth

**In plain terms:** There's a *lot* of real game content: roughly **640 creatures** with
full stat blocks (armor, hit points, damage, traits, challenge rating), graded trivial →
minor → standard → elite; **175 spells** across all ten schools; and a full item system
(weapons with damage dice, armor with AC, consumables, magic items, quest items) with
equip/loot flows that combat actually reads.

**Under the hood:** `engine/ruleset/core/bestiary/catalog/` (the four big catalog files
are ~24,000 lines of creature data alone), `spells/catalog/`, `items/`, `loot/`. This is
the part of the "1,000 creatures, combat deeper than D&D" vision that's furthest along.

**Why part 🟡:** The *content* is there in bulk, but a 12-turn playtest only ever meets a
sliver of it, and the deeper combat engine that would show off creature traits isn't the
live one. The library is huge; the player's exposure to it is small.

**Moat:** The sheer mass of authored, mechanically-real content is a genuine asset — and
the literary bestiary vision (Lovecraft/King/Asimov-flavored outer reaches, world-native
not modern-Earth) is a differentiator most AI-RPGs, which generate monsters on the fly,
can't match.

---

## 12. Character Creation — *who you are* 🟢 Live

**In plain terms:** You make a character through a guided flow — five stats (Might,
Agility, Wits, Grit, Charm), a background, skills, starting gear. The slice archetype is
the **Wanderer**, who picks three skill focuses at the start. The math is 5e-lite: proven,
familiar, and the engine knows what a +2 modifier means.

**Under the hood:** `chargen/` plus a full SRD layer (`chargen/srd/`: abilities, classes,
species, backgrounds, skills, level-up, the character sheet). XP and leveling are
milestone-based, not grind-based.

**Moat:** Standard but solid. It's table stakes done properly, which matters for the
"Rules Lawyer DM" who needs the crunch to be correct.

---

## 13. Genre Packs & Prose-to-World — *more than fantasy* 🟢 Live / 🟡 importer

**In plain terms:** The engine isn't hardwired to fantasy. There are **five genre packs** —
Fantasy, Space Rift (sci-fi), Zombie Apocalypse, Haunted House, and Modern IRL — each a
different setting the same engine can run. And there's an **importer** that takes a page of
*prose* describing a world and turns it into a playable, canonical region (run once at
build time, then frozen — the AI is the importer, never the live authority). Several fantasy
sub-regions (Westmarch, Ashenmoor) were built this way and carry their source prose.

**Under the hood:** `packs/` + `rulesets.js`; the importer lives in `scripts/import/` with
a validator (`packValidator.js`). Westmarch and Ashenmoor have `source.md` + generated
artifacts.

**Why importer is 🟡:** It works and produced real regions, but it's a CLI build tool, not
a polished authoring surface — and the "anyone writes a world in prose and plays it" dream
is a post-slice ambition.

**Moat:** Multi-genre from one engine, plus "describe a world in a paragraph and walk into
it," is a platform story, not just a game story. That's the version of this that a software
investor leans forward for.

---

## Multi-LLM Lanes — *which model does what* (ML-1…ML-3 audit, 2026-06-27)

The engine runs **three AI clients** in parallel by design. They don't share a pipeline; each
has a distinct job and failure mode.

| Lane | Model(s) | Job | Status |
|---|---|---|---|
| **DM narration** | Claude Haiku (polish) / Sonnet (DM mode) | One-sentence polish or full structured DM turn | 🟢 Live |
| **NPC voice** | Opus 4.8 primary → Ollama fallback → templates floor | One spoken dialogue line in the NPC's voice | 🟢 Live |
| **The REF (narration judge)** | Claude Sonnet (via `llmAdapter.ref/`) | Accepts or regenerates the polish pass | 🟢 Live |
| **Intent arbiter** | Claude Sonnet (via `playloop.js` `askNpc`) | Structured NPC-decision output → engine acts on it | 🟢 Live |
| **NPC brain** | Ollama 7-8B (`dialogue.js:545` `fallbackRules`) | Personality-flavored NPC behavior choices | 🟡 Built but dark — fallbackRules fires instead; determinism constraint keeps this dark |
| **LLM memory** | Ollama 7-8B (`dialogue.js:736` `extractMemory`) | Extracts salient memory from conversation | 🟡 Built but dark — same reason: a live non-deterministic LLM decision breaks seed-replay (U19/U21/U22) |
| **Async physics** | Ollama 7-8B (`llmPhysics.js:291` `evaluatePhysicsSync`) | "Can I climb this wall?" — physics classification | 🟡 Built but dark — same reason |

**Why the 🟡 lanes stay dark:** A live LLM routing decision inside the turn loop would break
`worldHash` determinism under replay. The dark lanes are working code held intentionally offline
until a canonical-log-backed replay strategy lands. They are NOT stale — do not remove them.

**The OpenAI client coexists by design:** `server/ai.js` uses the `openai` npm package for the
victory-gates trace/replay flow (polish + activation path). This is a separate API client from
the Anthropic-backed narration/voice layer. Both are live. Do not consolidate them.

---

# What's solid vs. what's in the way

**Rock solid (the foundation is real):**
- The deterministic engine and the permanent Canon Log. *This is the moat.*
- The talk-to-play DM loop with the engine-decides/AI-narrates split.
- The mechanical mass: ~640 creatures, 175 spells, items, the combat crunch.
- One continuous, spatial, walkable world.
- Procedural NPCs with personality, trust, memory, and knowledge.

**In the way (and the honest read on *why*):**

1. **The depth is dark, not missing.** The audit's clearest finding: the systems that make
   this special — the historical-figure voices, the rumor/claims graph, the creation-myth
   secret, the pantheon — are *built and working but not reaching the player.* The single
   sharpest example: a fully-wired 488-file RAG voice pipeline that no live NPC is assigned
   to. **The work to fix most of this is wiring and surfacing, not building** — which is
   weeks, not months, and it makes the moat *visible* instead of just *true*.

2. **The morality system — the soul — is mostly still design.** It's the most valuable and
   most ambitious piece, fully specced, built only to M2. This is the one place where the
   gap really is *build*, not wire. It should be sequenced deliberately, not rushed.

3. **The last-mile correctness seams.** ~17% of automated playtest turns still fail —
   meta-questions answered with dice, a hazard narrated without applying damage, a melee
   swing mistagged as a spell. Individually small; collectively they're the difference
   between "a good DM" and "a solid game" for the Rules-Lawyer bar. These are bug-fix work,
   and they've been trending down (35% → 17%).

4. **It depends on two AI paths and a local model.** DM narration uses the cloud
   (Anthropic); bespoke NPC voices use a *local* model (Ollama) that has to be running.
   Both fall back gracefully, but the best experience currently assumes a developer setup.
   For a sellable product this becomes a hosting/packaging decision.

5. **There's no real UI yet.** (You're handling this in a separate track.) The depth above
   has nowhere to *show* — no character sheet panel, no rumor board, no spellbook. Surfacing
   work (point 1) and UI work are the same coin.

---

# The one-sentence pitch this audit earns

> *Not an AI chatbot with memory bolted on — a deterministic, simulated world with a real
> cosmology, a pantheon whose gods exact prices, hundreds of authored characters (including
> real historical figures grounded in their own writings), and a social graph down which
> rumors distort as they travel — that never forgets and never contradicts itself, because
> the world is a simulation, not a transcript.*

Every clause of that sentence is backed by code that exists today. The job ahead is mostly
to make a stranger *feel* all of it in twenty minutes. The plan for that is in
`docs/PATH_TO_SELLABLE.md`.
