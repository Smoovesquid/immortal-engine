# Social Provocation — insults carry risk, and the risk is personal

*[[IG-11]] social physics. The verbal sibling of `engine/magic/castConsequence.js` (gratuitous-magic recoil): a deterministic consequence ladder, aimed at words instead of cantrips. Module: `engine/npc/provocation.js`. Tests: `tests/U292.provocation.test.js`.*

## The rule
Disrespect is a tracked social act, not flavor. Insulting an NPC accumulates **offense** against you. When offense crosses *that individual's* tolerance, they act — up to and including attacking first. A real DM never lets you spit on someone for free, and never makes a saint snap like a thug.

## Temperament — the fuse is personal
Every NPC has a **fuse length** (`npcTemperament(seed, npcId)` → 6..100), seeded from who they are (innate, deterministic, *derived* not stored — same pattern as locks / day-night, so no `WORLD_VERSION` bump):
- **volatile** (`< 22`): a single slight — sometimes just a look — and they sucker-punch. Rare (~6%). The "psychos waiting to be disrespected."
- **even** (most people): a ladder of warnings before it ever comes to blows.
- **stoic** (`> 76`): suffers almost anything — goes cold, walks away, remembers — but won't be baited into violence. ~13%.

## The ladder (`resolveProvocation`, pure numbers)
`offense` vs. `fuse` → **shrug → warn → bristle → attack**. Crossing into `attack` routes through the existing `mintEnemyFromNpc` + `beginCombat` seam (`reason: 'provoked'`). The player *discovers* the threshold by misreading someone (a rung-4 consequence) — never a meter, never a toast.

## Modifiers (what moves the fuse)
- **Severity** (`insultSeverity`): look (6) < mild (12) < sharp (25) < grievous (40).
- **Disposition**: an NPC who already mistrusts you starts closer to the edge and snaps sooner — wired from `conversationState.trustLevel` (0–10, 5 = neutral) via `dispositionFromTrust`, mapped onto the resolver's −100..100 disposition. Low trust shortens the fuse; neutral/high reads as no penalty.
- **Mood jitter**: a seeded ±10 — a bad day shortens the fuse — deterministic per (npc, accumulated pressure), so a replay is identical.
- **Grudge memory** (`carriedGrudge`, `GRUDGE_RETENTION = 0.5`): an offense burns at **full** only on the turn it lands; every prior offense is carried at **half** — never as hot as the moment it happened, but never gone. Walk off and come back and they're *half-primed*, not still mid-rage. A volatile soul still snaps on a fresh slight (the new jab alone clears their low fuse); an even/stoic one takes a touch more sustained pushing, since the older jabs have cooled.

## Seams it plugs into
- **Detector:** the existing insult vocabulary (`isCombatSocialNonAction`, `engine/playloop.js`), generalized to a non-combat address.
- **Attitude:** `npc.disposition` (`engine/npc/npcGenesis.js`).
- **Combat:** `mintEnemyFromNpc` / `beginCombat` (`engine/combat/combatLifecycle.js`).
- **Accumulation:** offense events recorded on the canon timeline → offense derived by replay (replay-safe).

## Invariants
Deterministic (`engine/rng.js` only; **no LLM sets the number** — Biblioteca Vol 11, route social deltas through deterministic tables). §0 untouched (no cosmology surfaced). `worldHash` stable. The DM proposes the *words*; the deterministic table commits the *consequence*.

## Done-when
Repeatedly insulting an NPC produces a felt, graded response that differs by person — most warn-then-escalate, a few attack on the first slight, some never break — and crossing the line begins real combat via the seam we already have. No "offense +3" popup.
