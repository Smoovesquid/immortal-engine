# SOBRIETY — the guardrails against never shipping

*The sober counterweight to the vision docs. Read this **when the scope is growing or a feature is "done."** Written 2026-06-28 after the "can it be a No Man's Sky × XCOM × D&D hybrid?" conversation — the honest answer was "yes, and that is exactly the danger." Sibling to [[THE_DM_TEST]] / [[THE_TABLE_TEST]], but pointed at the PROJECT, not the prose.*

## The one law
**Infinite is free. Infinite-and-good is the entire game. The thing most likely to kill this is not the ceiling — it's never shipping.**

Deterministic seeds are the easy 5% (every roguelike has them). Coherent, surprising, *good* content is the hard 95% — and that 95% is the **LLM-DM, the part you can least control, can least QA, and pay for per turn.** "We already have the hard part" is the flattering lie. We have the substrate. The game is the output.

## Five tripwires — if you catch yourself doing one of these, STOP
1. **Build-dark.** A feature is NOT done when the suite is green. It is done when it runs in **v1 (the live `escapeCombat` path) and a real player feels it.** "Tested but not in v1" = not done. (DX-2a shipped green and *dark*; the two-engines trap, [[project_two_combat_engines]], is the pattern, not a fluke. A repo where "done + tested" routinely means "not in the game players touch" has a credibility gap between its suite and its product.)
2. **Three-giant scope.** "No Man's Sky × XCOM × D&D" is a **metaphor, not a feature list.** The product is the **LLM-DM (D&D)**. XCOM is seasoning (in flight). **No Man's Sky means "infinite and yours," NOT "you'll see the planet."** Never put visuals you cannot ship on the box — naming three beloved giants invites three audiences who will each be disappointed it isn't enough like their favorite.
3. **The meter.** Every meaningful turn is a metered LLM call; your *most engaged* players cost the most. That is inverted unit economics — NMS has ~zero marginal cost per player-hour; we have a meter that runs hardest for our best users. Before adding an LLM call to the hot loop: *does this scale to thousands of players?* Cache / gate / cheapest-model-that-works first. (The Opus gate is already flagged "the costliest thing.")
4. **Prototype gravity.** Gorgeous sandbox prototypes that **fake their data** are seductive and do not ship. **One wired loop in v1 beats the most beautiful diorama.** (The 2026-06-28 map session — dungeon → cathedral → town → fortified outpost — is the cautionary example: beautiful, fake-fed, not in v1, not in the engine.)
5. **Unfalsifiable vision.** If the next idea makes the scope **bigger** and there is no "done," stop and cut. This session's own arc (room → cathedral → town → fortified town → "can it also be NMS?") is the gravity. The danger is never the ceiling; it's that an unfalsifiable ceiling means you never have to finish.

## The anchor: ship ONE Module
The cure for all five is a **bounded, ENDING-having, v1-runnable D&D module** — one curated region with a beginning, a middle, and a real end. NOT the infinite universe. **The module proves the engine; the infinity is the expansion you earn AFTER.** A module is falsifiable ("is it done?"), it hides the engine's weakness (coherence-at-infinite-scale doesn't bite in one curated region), and it shows its strength (the LLM-DM improvising inside a tight, authored frame). DnD players instantly understand "module."

**Done-when:** a stranger plays it **start-to-finish in v1** and says *"that was a good DM running a real adventure"* ([[project_opus_gate]] MVP bar) — with permadeath stakes, the narrate-the-read tactical combat, and **it ENDS.** (The engine *wants* to be infinite; for the module, resist that. A module ends.)

## What's actually real (so this is sober, not doom)
The deterministic core is solid and genuinely tested (8962). The **one-turn-clock** — explore / talk / fight on one beat — is a real synthesis. The **audio-first / playable-blind** angle is a differentiated, defensible, press-worthy niche almost nobody serves. The authored figures, the easter eggs, the literary bestiary — that's real panache, already in the parts. And LLM-DM cost/quality is on a curve moving our way.

**The assets are real. The discipline is the risk.** That's why this doc exists.
