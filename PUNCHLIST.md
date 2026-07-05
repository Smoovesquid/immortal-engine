# 🔨 Punch List: Immortal Engine — "Sell Copies"

**Generated:** 2026-06-26
**Target user:** first cut = RPG enthusiasts (forgiving, demand crunch, will evangelize). Normies come after.
**Launch target:** when rung 1 stops wobbling — not before.
**Current state:** A real deterministic RPG world with a genuine moat ("never forgets, never contradicts"), sitting on a DM loop that breaks the fiction ~17% of turns. The engine is further along than the *experience*. You're on rung 1, and it wobbles.

> **The one frame to hold:** the product is not a feature, it's a **ladder of realizations** the player climbs by discovery. You can't sell rung 4's soul if rung 1's floor gives way. Build the lowest rung that doesn't yet reliably produce its "wow." Today that's rung 1.

---

## 🔴 Critical Path — No Product Without These

If any of these is undone, you have a tech demo, not something a stranger pays for.

- [ ] **Rung 1: the DM never breaks the fiction.** Drive the Opus-gate failure rate from ~17% → near-zero. Every failure is a seam: meta-question answered with dice, hazard narrated but no damage applied, melee mistagged as a spell. This is the moat's *visible skin*, not hygiene.
  _ROI: every turn that breaks immersion is a refund → "okay, this is a real game" is the whole sale._

- [ ] **The first 5 minutes don't show a blank page.** A stranger needs to know what to do without a tutorial that violates "the DM is the only verb." Strong start, a clear first beat, an obvious first thing to try.
  _ROI: blank-page paralysis = closed tab in 60 seconds → a confident first move = they're in._

- [ ] **Prove "never forgets" out loud (return-session test).** Play → leave → come back → the world remembers exactly. This is the headline claim; it must be demonstrably, repeatably true, not asserted.
  _ROI: if the moat isn't provable it isn't a moat → the one thing every competitor fails becomes your one undeniable line._

- [ ] **One complete slice a stranger can finish.** One place, a handful of NPCs, ~8 creatures, the core loop from open to a satisfying stopping point. Not the 640-creature world — the one session that wows.
  _ROI: a wide shallow world reads as unfinished → one deep slice reads as a real game with more behind it._

- [ ] **Rung 3: an adventure is born in conversation.** The talk→goal bridge (`goals/goalContract.js`) is the thinnest rung. An NPC's real concern becomes a thing the player *chooses* to go do — and it feels like their idea, not a quest-board handout.
  _ROI: no bridge = great chat with nothing to do → the bridge is what turns "interesting person" into "I have to go deal with this."_

**Critical path estimate:** rung 1 is the multi-session grind (edge-seam whack-a-mole, honestly weeks of tightening, not a 30-min fix). Slice + onboarding + return-test are days each with CC.

---

## 🟡 Polish — The 8 Seconds That Decide Trust

Doesn't block launch mechanically, but it's "feels legit" vs "feels like a hackathon build."

- [ ] **A sellable name + identity.** "Immortal Engine" is the repo. Pick the player-facing title (you've floated "Tough Shit" for the early game). A name, a one-line pitch, a hero image.
  _ROI: no name = nothing to put on a store page → identity is the difference between a link and a product._

- [ ] **The map/UI is legible and beautiful.** Lock the notebook aesthetic, one continuous-zoom map, biome tiles you can actually read (trees ≠ mountains).
  _ROI: ugly UI undercuts "real game" before a word is read → the look buys the benefit of the doubt._

- [ ] **Consequence lands as a discovery (rung 4).** A closed door, a stranger who greets you because they *read* about you (the newspaper / reputation-in-print) — never a "reputation −3" popup.
  _ROI: invisible consequence = actions feel weightless → a found consequence is the first time the world feels alive._

- [ ] **Death has stakes.** Make dying *land* — the cost paid / underworld second act, not a screen you click through.
  _ROI: free death = no tension → stakes are what make the whole loop matter._

- [ ] **DM voice craft.** Apply the narration rubric (hide the math, respect agency, no machine-voice, concise). Make the DM *talk* like a great DM.
  _ROI: stat-dumps and purple prose read as "AI" → a real DM voice is half of why they keep typing._

---

## 🟢 Later — Post-Launch / The Payoff (Don't Touch Yet)

Real, but not why you're not shipping. The ladder forbids skipping to these.

- [ ] **Rung 5–6: the "why" (cosmology, the dark path, the buried truth).** This is the *soul* and the longest hook — and it's last on purpose. It's the payoff the whole ladder baits toward; payoffs need the setup built first.
  _ROI: huge depth → but rushing it is a tar pit, and it carries content-policy weight. Sequence it._

- [ ] **Multiplayer (the "Tough Shit" constellation).** Shared world held by consequence, the underworld, accountable identity. Genuinely a gamechanger — and genuinely the hardest thing in the genre (Canon-Log merge conflict).
  _ROI: category-defining → but a post-launch bet, not a v1 line item._

- [ ] **The benched inventory.** 640 creatures, 175 spells, 488 RAG backstories, historical figures, 5 packs. It's *optionality*, not product. Draw into the slice only what earns a rung.
  _ROI: built work doesn't rot (it's deterministic) → "we built it" is not "it must ship."_

---

## 💰 The Business Swimlane (Not Game Design — But It's On The Board)

"Sellable" crosses from "Claude builds it" to "a business" here. These won't ship themselves and they're not packets.

- [ ] **Storefront + hosting + accounts + payment.** Where does someone actually buy and play this? The engineer-friend-plus-money conversation.
- [ ] **Bespoke-voice cost model.** Per-NPC voice on a local 8B vs cloud-per-line — a production-economics question that may force "marquee NPCs get voice, the rest get templates." De-risk on paper *before* lighting up rung-2 voice.
- [ ] **Content-policy / distribution risk.** The dark path's adult themes invite app-store scrutiny that can block distribution. Know the line before you build the storefront on it.

---

## Totals

| Tier | Items | Note |
|------|-------|------|
| 🔴 Critical Path | 5 | Rung 1 is the long grind; everything else gates on it |
| 🟡 Polish | 5 | The trust layer — days each |
| 🟢 Later | 3 | The payoff + optionality — sequenced, not skipped |
| 💰 Business | 3 | Not code — but no "copies sold" without it |

> 💡 **Contractor's note:** You're closer than the 17% feels, and further than the engine inventory suggests. The whole game right now is one number — make a stranger reliably say *"I can do anything here and it fits the math."* Everything above rung 1 is already baited and waiting. Don't climb until the floor holds.
