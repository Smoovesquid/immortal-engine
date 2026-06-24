# THE TABLE TEST — the governing principle for the functional layer

> For **any** question of how the game should *behave* — a kick, a murder, a searched pouch,
> a step through a door — the correct behavior is **whatever would happen at a real D&D table.**
> Actual D&D is a fifty-year-playtested spec we already own. When behavior is wrong, it has
> almost always **drifted from the table**, not gone *undesigned*. So don't invent the answer —
> **restore the table's answer.**

This is the bigger sibling of [THE_DM_TEST](THE_DM_TEST.md). The DM Test governs the **interface**
("what would the DM *say*?"). The Table Test governs the whole **physics** — movement, combat,
consequence, persistence — and points all of it at one source of truth.

> **The DM Test asks: *what would the DM say?***
> **The Table Test asks: *what would happen at the table?***

The table is bigger than the DM: it's the DM, the dice, the rules, *and* everyone's shared,
decades-deep sense of how a world is supposed to behave when you act on it.

## Texture, not skin (the load-bearing distinction)
What we want is D&D's **functional texture**, never its **surface**. Not d20s on screen, not the
SRD spell list, not stat blocks in your face — the engine deliberately hides all that (narration ≠
canon; the crunch stays under the hood). The texture is the *felt physics* of a real table:

- **Intent resolves in the fiction** — you say what you want; the world makes it true or tells you why not. (= the DM Test.)
- **Consequences are legible and fair** — cause → effect you can reason about; rules you can *feel* even when you can't see the math.
- **The world reacts and remembers** — deeds land; the town turns on a murderer; an NPC recalls you; choices carry weight that persists.
- **Stakes are earned, never arbitrary** — at level one a fight is dangerous but not random; death is real but *paid for*, never handed out by a misfire.
- **Adjudication has a rhythm** — you try something → the DM weighs it → difficulty is set against how hard the moment is → it resolves → the outcome flows back into the story.

The line: **D&D's *behavior*, not D&D's *math*.** A player who has never rolled a die should *feel*
that texture — fair, reactive, consequential, intent-honoring — without ever seeing a number.

## The test (run it on any behavior in question)
Would this happen at a real D&D table? If no, it's wrong — no matter how "correct" the code is.

**Failures (the engine drifted from the table):**
- A kick to the groin **instakills** a guard. → At a table an improvised unarmed strike rolls
  against a hit-point pool; nothing dies to one level-one blow.
- You **murder a townsman and the town shrugs**. → A table turns the room on you; a level-one
  killer does not walk away clean.
- "What's in the pouch I found?" → silence or a navigation prompt. → You found a pouch; the DM
  tells you what's in it.
- "I head south out of the building" → you end up **inside, to the north**. → You go where you
  said. A DM never teleports you somewhere you didn't choose.
- Every interior room reads **identically**. → A storeroom is not the common room; the DM gives
  each space its own face.

**Passes (the table's behavior, delivered through fiction):**
- A fight is dangerous but survivable; HP and consequence are real and earned.
- Deeds ripple — kill someone and the world remembers and reacts, proportionate to the deed.
- Found loot is named and handed over.
- You move where you say; the DM narrates the going.
- Each room carries its own texture.

## What this subordinates
The combat math, the consequence ladder, the movement / interior model, the affordance set — all
**implementation in service of the table's felt behavior.** Hide the math; deliver the texture. When
a behavior question is open, the engine's job is not to design a novel answer — it is to find the
table's answer and honor it.

## Why it governs — and why it is the harness's reference spec
The hardest question in any coherence judge is *"coherent against **what**?"* The Table Test answers
it: **against actual D&D** — the one reference that is exhaustively documented, battle-tested over
fifty years, *and* sitting in deep priors inside every model we'd point at it. "Would this happen at
a real table?" is a question Claude answers far more reliably than "is this good fiction." So D&D is
not only the taste target; it is the [Human Playtest Harness](HARNESS_USAGE_STRATEGY.md)'s **oracle
spec** — the deterministic oracles check the table's *mechanics* (kick ≠ kill, murder → reaction,
search → reveal); the LLM judge checks the table's *texture*.

When a playtest finds a behavior that fails the Table Test, **that is the bug — even if every unit
test is green.**
