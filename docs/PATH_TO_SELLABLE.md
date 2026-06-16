# Path to Sellable Software — The Realization Ladder

*Rewritten 2026-06-16. **Supersedes** the earlier "three moves / Phase 0–4 / pick-a-wedge"
framing in this doc's prior version. That version let the experiments drive the plan and
quietly chose a marketing wedge. This one is built on Tim's own articulation of how the game
hooks a player — and it doubles as the build order. Companion docs: `docs/WHAT_THIS_IS.md`
(the system inventory), `docs/PACKETS.md` (the carrying packets), `docs/IDEA_GARDEN.md`
(parked ideas).*

---

## What changed, and why

The old plan asked "which feature do we lead with?" Wrong question. Tim's answer was better:
the game doesn't hook with *a* feature — it **baits the player from one realization to the
next, through discovery.** That chain of realizations is the product. And here's the move
that makes it a plan: **the ladder is also the build order.** A player physically cannot
reach a higher rung until the one below it has landed — so the rungs tell you exactly what
you're allowed to work on. This is the cure for the project's central risk (wanting the game
to do everything too soon): the ladder forbids skipping.

---

## What we're selling (the moat — unchanged)

> A deterministic, simulated RPG world that **never forgets and never contradicts itself**,
> because it's a simulation with a permanent ledger, not a chatbot transcript.

The #1 reason people churn out of AI role-playing apps (a 20M+ MAU category) is reset-drift:
the AI forgets and contradicts last session. Every competitor is a language model trying to
remember. We are a deterministic world (Canon Log + worldHash) where the AI is only the
voice. We don't *mitigate* drift — we're built on the one architecture that doesn't have it.

Two halves of the claim, and where each lives on the ladder:
- **"Never contradicts"** = rung 1's faithfulness — the narration never says something the
  engine's canon denies. This is the moat's *visible skin*, and it's the leakiest layer (the
  gate has caught the narrator inventing stats and fire). It is not hygiene; it is the moat.
- **"Never forgets"** = proven by a **return-session test** (play → leave → come back → the
  world remembers exactly), and felt structurally at rung 4, where consequences persist.

---

## The core principle: spine / slice / inventory

Most of the repo is **inventory**, not product. Sort everything into three buckets:

- **The spine** — the thing that *is* the product: a DM that never forgets and does what a
  real DM would do. Non-negotiable; everything serves it.
- **The slice** — the small bit a stranger actually touches: one place, a handful of NPCs,
  ~8 creatures, the core loop done well.
- **The inventory** — 642 creatures, 488 RAG files, historical figures, 5 packs, the
  importer. **Optionality.** You draw into the slice only what earns its place on a rung; the
  rest waits, losing nothing (the engine is deterministic and permanent — built work doesn't
  rot).

The discipline: never let "we already built it" graduate into "so it must ship." That's sunk
cost in a strategy costume.

---

## The Ladder

Each rung is a realization the player *discovers* (never is told), with a **"wow" acceptance
test** that is a feeling, not a feature. You build the lowest rung that does not yet reliably
produce its wow.

### Rung 1 — "I can do anything here, and it fits the math."
**The spine.** The DM resolves any plain-English intent in the fiction and the crunch is
correct and consistent (5e-lite under the hood). · **System:** `playloop.js` adjudication +
`resolve.js` + combat + `gracefulAdjudication.js`. · **Wow test:** a stranger (esp. the
Rules-Lawyer-DM persona) tries something weird, it resolves sensibly *and* the rules hold —
they say "okay, that's a real game." · **Status: 🟡 wobbling.** The Opus gate fails ~17% of
turns (down from 35%), almost all rung-1 seams: meta-questions answered with dice, a hazard
narrated without applying damage, melee mistagged as a spell. **This is where we stand, and
where the work is.** Nothing above pays off until this is solid. · **Carrying packet:** P-86
(promoted to the foundation, not a "floor").

### Rung 2 — "I can really *talk* to these people — coherent, and it fits the world."
**System:** `npc/dialogue.js`, `npcDepth`, `perspectiveFilter`, the knowledge graph; the
bespoke voice via the local model. · **Wow test:** a five-minute conversation with an NPC
that stays in character, in-world, and remembers what was said — the player keeps talking
because it's *good*, not to farm a quest. · **Status: 🟢 mostly live, under-tested for the
wow.** · **Inventory it can draw on (optional):** the 488 RAG backstories (= the Westmarch's
authored population) and the historical figures. **Benched for now** — rung-2 *flavor*, not
load-bearing; pull them in only once the plain conversation already wows. · **Climbed by
discovery:** the player finds the person interesting; nothing is announced.

### Rung 3 — "They told me about a problem I can go solve — an actual adventure."
The quest is **born inside the conversation**, not handed from a quest-board. · **System:**
dialogue → `goals/goalContract.js`; the connective tissue between talk and doing. · **Wow
test:** an NPC's real concern becomes a thing the player chooses to go do with sword and
spell, and it feels like *their* idea. · **Status: 🔴 likely the thinnest rung** — the
talk→goal bridge is where "interesting person" must become "interesting thing to do." Verify
and strengthen before climbing past it. · **Inventory:** the bestiary/spells/items are the
*ammunition* for the doing — need ~8 creatures for the slice, the other ~634 wait.

### Rung 4 — "Oh my god — my actions have *consequences* here."
**System:** permanence (Canon Log) + the world's reaction: trust, faction, the rumor/claims
graph (reputation travels and distorts), and morality M2 (witnessed deeds move the world). ·
**Wow test:** the player does something, leaves, and later finds a *closed door* — a
consequence they discover, never a popup that says "reputation −3." · **Status: 🟡/🔴** —
the organs exist (claims graph tested, M2 partial) but the player rarely *feels* the
consequence land. **This is the first rung where "never forgets" becomes visible** — so the
return-session test belongs here. · **Climbed by discovery:** consequences are *found*, never
reported.

### Rung 5 — "...why? Why is the world *this* way?"
**System:** the cosmology — the 10-Governor pantheon with prices and taboos
(`magic/cosmology.js`), the substrate's region/age history. · **Wow test:** the player starts
asking *why* — why this god is ascendant, why that taboo, why the town fears the fog — and
the world has real, consistent answers under it. · **Status: 🟡 built but dark.** · **Idea
Garden tie:** IG-1 (magic *is* the universe's pre-cataclysm AI) is a candidate spine for the
metaphysics that answers the "why."

### Rung 6 — "How do I find out why this world is the way it is?"
Discovery becomes the engine. The player pulls the thread toward the buried truth. ·
**System:** the substrate's sealed `deep:foundation`; an authored arc, not procedural; the
witness-object / god-frame wall holds. · **Wow test:** the player is now playing *to
understand the world*, the way you'd read a mystery — the longest hook there is. · **Status:
🔴 the door isn't open yet.** · **This is also where the soul lives:** the dark path / morality
(rungs 4–6) is **the destination the whole ladder baits toward — earned, not led-with.** It's
last because it's the payoff, and payoffs require the setup. Tracked in
`docs/MORALITY_SYSTEM.md` (built to M2).

---

## The build discipline (the cure for "everything too soon")

1. **Work the lowest rung not yet producing its wow.** Today that's **rung 1.**
2. **A rung's done-when is a feeling, gated by the experiential test** (`dm-playtest.mjs` /
   the Rules-Lawyer bar), *not* a green unit suite. 7,700 passing tests coexisted with the
   17% — green tests are necessary and have been proven insufficient. Climb on the *wow*,
   not the suite.
3. **Every rung is climbed by discovery, never exposition.** A consequence is a closed door,
   not a notification; the "why" is a wrong-aged thing you notice, not a lore dump. If a rung
   can only be delivered by *telling* the player, it isn't built yet.
4. **Capture, don't build, what belongs to a higher rung.** Park it in the Idea Garden so the
   nag is gone and you're free to leave it for later.

---

## Red-team fixes, folded in (these hold regardless of anything else)

1. **The return-session test** is now a first-class gate at rung 4 — without it we test
   everything *except* the moat ("never forgets" can't appear in a single session).
2. **Rung 1 / correctness is the foundation, not a floor** — it's the moat's visible skin.
3. **Write the bespoke-voice cost model before lighting up rung-2 inventory** — per-NPC voice
   on a local 8B is a quality *and* a production-economics question (cloud-per-line cost vs.
   hosted GPUs). It may force "marquee NPCs get bespoke voice, the rest get templates," which
   would change the rung-2 inventory plan. De-risk on paper first.
4. **Experiential gate is the real done-when** (see discipline #2).
5. **Name the content-distribution risk:** the dark path's adult themes (rungs 4–6) invite
   app-store / platform content-policy scrutiny that can block distribution. A real line item
   for whenever "sellable" means a storefront, not a surprise.

---

## Inventory → rung map (what's benched, and where it plugs in)

| Inventory | Serves | Verdict now |
|---|---|---|
| DM loop + crunch | Rung 1 (spine) | **Active — the work** |
| ~8 creatures / core spells / items | Rung 1 & 3 | Pull into slice |
| 642 creatures / 175 spells (rest) | Rung 3 ammunition | Bench; draw as needed |
| NPC dialogue + knowledge graph | Rung 2 | Active |
| 488 RAG backstories (= the Westmarch) | Rung 2 flavor | **Bench** until plain talk wows |
| Historical figures | Rung 2 flavor | **Bench** (capability proven; not needed) |
| Rumor / claims social graph | Rung 4 (+ rung-2 texture) | Surface at rung 4 |
| Pantheon / cosmology | Rung 5 | Surface at rung 5 |
| Substrate / creation myth + IG-1 | Rung 6 | The destination |
| Morality M-track | Rungs 4–6 (the soul) | The payoff, sequenced last |

---

## The decisions still yours

- **The wedge question is retired.** You don't lead with one realization — you guarantee the
  *sequence*. The product is the ladder.
- **First audience** (still open): RPG enthusiasts (forgiving, demand crunch, evangelize —
  maps to the Rules-Lawyer bar; recommended for the first cut) vs. normies/lapsed players
  (bigger market, less tolerance, need the blank-page fully solved). This only changes *how
  high* each rung's wow bar sits — not the order.
- **How hard to lean on "never forgets"** (still open): the strongest, most defensible claim
  — *the* headline, or one pillar among several?

---

## Risks to keep named

- **Rung 1 is harder than it looks to finish** — the last 17% is edge-seam whack-a-mole, and
  it's load-bearing for the entire funnel.
- **Bespoke voice may not pencil out** at production scale (the cost model decides).
- **The soul is a tar pit if rushed** — it's rungs 4–6 and carries the Camera Rule's ethical
  weight; sequence it, don't cram it.
- **"Sellable" crosses from "Claude builds it" to "a business"** at the storefront/hosting/
  accounts line — that's the engineer-friend-plus-money conversation, not a packet.

---

## Bottom line

You're on **rung 1, and it wobbles.** That's the whole answer to "which direction." Make a
stranger reliably say *"I can do anything here and it fits"* — then, and only then, climb. The
historical NPCs go on the bench (capability proven, not needed yet). The dark path isn't
deferred as an afterthought; it's the **top of the ladder, the thing everything below is
baiting toward.** Build the rungs in order, climb on the wow, and let discovery do the
pulling.
