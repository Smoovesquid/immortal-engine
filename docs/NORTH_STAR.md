# Immortal Engine — North Star

**Version:** 1.0
**Established:** 2026-04-11
**Supersedes:** The finite-arc framing in `_archive/VICTORY_LADDER_MVP_v1.md` (archived 2026-06-24) and `CAMPAIGN_LIFECYCLE_SPEC_v1.md`. Those docs remain as historical artifacts; when they conflict with this one, this one wins.

---

## The one-line vision

**A deterministic, AI-narrated, infinite RPG where the world never stops surprising you.**

A book you can read forever if you keep your wits about you. Full tabletop crunch — stats, spells, weapons, armor, loot, a bestiary, bonds with NPCs that matter when you break them. No artificial ending; the only true ending is the player character's death.

---

## The three load-bearing ideas

### 1. Infinite by design, not by padding

The existing finite-arc framing (60–90 minute campaigns, convergence triggers, sequel continuation) is **retired**. Dread, scars, threads, inevitability — all of those remain, but as **world weather**, not termination conditions. The world persists. Sessions are chapters, not campaigns. Home village (Pass H) is a life anchor you return to, not an intro scene you leave.

**Why this works:** the engine is already deterministic-by-seed, already has Canon Log as the immortal ledger, already has recent beats / goals / threads / scars as accumulating state. It has never needed to end — only the docs pretended it should.

**Ending states that remain real:**
- Player character dies in combat (`'The Cost Paid'`, Pass 5).
- Player chooses to retire the character (chronicle export, continue later with heir or new character).

### 2. Full RPG crunch — stats, items, spells, bestiary

Not "an LLM with a d20 bolted on." A real mechanical substrate that knows what a longsword does, what a level-3 fireball's save DC is, what your AC is, what an owlbear's stat block looks like. The engine resolves. The LLM narrates.

**Scaffolding ruleset:** **5e-lite.** Proven math, familiar to players, tractable to implement, compatible with existing `stats: {MIGHT, AGILITY, WITS, GRIT, CHARM}` (thin relabeling). The ruleset itself lives in `world.ruleset` (already an existing hook) and is queried by `resolve.js`, `combat/`, and the composer. Future packs may ship alternate rulesets; this is not an MVP concern.

**Starting scope for the vertical slice:**
- Five stats (existing).
- Wound track as scaled HP (`wounds/maxWounds`, scaled by level + GRIT).
- Skills as proficiency bonuses on existing approach verbs.
- Equipment with real properties (damage dice, AC, weight, rarity, magic effects).
- One character archetype — **Wanderer** — with three skill foci the player picks at start.
- A spell system: slotted, typed-effect spells (`fireball` is data, the LLM narrates the data).
- A bestiary with real stat blocks (AC, HP, damage, traits, CR).
- Loot drops on victory.
- A simple economy: currency + shops as dialogue intents.
- XP and leveling (milestone-based, not XP-grinding).

**What we are NOT building for the slice:**
- Multiclassing.
- Grid combat. (Current approach-based combat stays.)
- Full spell component tracking. (Concentration yes, components no.)
- Crafting / gathering.
- Faction politics beyond what already exists.
- Multiplayer anything.

### 3. Prose-to-world authoring + distance-weighted rumor collapse

This is the unlock that makes "the world never stops surprising you" a real property rather than a marketing line.

**Prose-to-world (author-time):** a world author writes prose. An LLM importer — run **exactly once per prose document, at build time** — translates that prose into canonical engine structures: regions, factions, NPCs, scars, threads, motifs, latent seeds. Output is cached, content-hashed, and versioned. Runtime is 100% deterministic on the cached output. **The LLM is the importer, never the runtime authority.**

**Rumor collapse (runtime):** distant latent seeds announce themselves before the player reaches them, via NPCs who carry *garbled, distance-attenuated, unevenly distributed* versions of what's out there. A full-fidelity kingdom-in-civil-war seed five hops away becomes "trouble with the orc queen" in the local tavern. Rumors are minted **on first surfacing** (when an NPC would actually utter one), then **cached in Canon Log forever**. Never regenerated on replay. Garbling tier is a deterministic function of (hop count, rumor age, carrier type); the LLM only writes the prose at the computed tier.

**Why the two reinforce each other:** prose-to-world gives you dense, cohesive lore that was designed by a human. Rumor collapse gives you the *mechanism* by which that lore reaches the player organically. Together, they make the world feel both authored and alive.

See `docs/PROSE_TO_WORLD.md` and `docs/RUMOR_LAYER.md` for the architectures.

---

## Non-negotiable engine rails

These do not change and nothing in the vision may compromise them:

1. **Determinism.** Same seed + same transcript → same `worldHash`. Always.
2. **Canon Log is authoritative.** On divergence, Canon Log wins.
3. **All mutations through `effectsCore.applyDeltas()`.** No direct state writes.
4. **LLM layer never throws.** Silent fallback to deterministic path.
5. **Invariants layer always throws.** Hard failures on violation.
6. **LLM is never a runtime authority.** It narrates deterministic outcomes and it imports prose at build time. It does not decide what happens.
7. **Rumor and prose-import LLM outputs are canonized at first mint and never regenerated.**

---

## Architecture map of the vision

```
                     ┌───────────────────────────────┐
                     │     AUTHOR-TIME PROSE         │
                     │     (world description)       │
                     └──────────────┬────────────────┘
                                    │
                                    ▼
                     ┌───────────────────────────────┐
                     │   PROSE IMPORTER (LLM, once)  │
                     │   prose → CSL structures      │
                     └──────────────┬────────────────┘
                                    │ cached & hashed
                                    ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                    PACK  (canonical, versioned)                │
   │  regions, factions, NPCs, scars, threads, motifs, latent seeds │
   │  ruleset (5e-lite), item defs, spell defs, bestiary, loot      │
   └────────────┬───────────────────────────────┬───────────────────┘
                │                               │
                ▼                               ▼
   ┌──────────────────────────┐    ┌──────────────────────────────┐
   │    ENGINE RUNTIME        │    │   LATENT SEEDS (per-world)   │
   │  Canon Log authoritative │◀──▶│   decompressed on contact     │
   │  Deterministic           │    └──────────────┬───────────────┘
   │  effectsCore sole mut.   │                   │
   └────────┬─────────────────┘                   ▼
            │                         ┌───────────────────────────┐
            │                         │   RUMOR PROJECTION        │
            │                         │   (distance + age + tier) │
            │                         │   minted at first surface │
            │                         │   cached in Canon Log     │
            │                         └──────────────┬────────────┘
            │                                        │
            ▼                                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │              NARRATIVE LAYER (LLM, contained)                │
   │   polishes mechanics into prose, narrates rumors at tier,    │
   │   NEVER mutates canon, silent fallback on failure            │
   └──────────────────────────────────────────────────────────────┘
            │
            ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                      UI SURFACE                              │
   │  Character sheet, inventory, spellbook, map, journal,        │
   │  bestiary, rumor board, chat. Mobile-first, reads canon.     │
   └──────────────────────────────────────────────────────────────┘
```

---

## The plan: vertical slice, not horizontal foundation

Ship a playable vertical slice that demonstrates **every load-bearing idea** in a narrow scope. The slice answers the question "is this real?" in the smallest possible code footprint, then expansion becomes content work, not architectural work.

**Slice scope:**
- One pack: `fantasy` (the obvious choice, and the one the dev default uses).
- One character archetype: Wanderer (3-skill-focus pick at start).
- One region fully authored via prose-to-world pipeline.
- ~12 items, ~6 spells, ~8 bestiary entries.
- Rumor layer active across the authored region.
- Full character sheet UI, inventory UI, spellbook UI, map UI, rumor board UI.
- Mobile-responsive layout from day one.

**Not in slice:**
- TTS voice output. (Strong temptation. Deferred to post-slice because it's a big chunk of work and the slice needs to prove the engine, not the presentation.)
- Server-authoritative state.
- Accounts, billing.
- Second region, second pack, multiclassing.

See `docs/SLICE_PLAN.md` for the worker-pass breakdown.

---

## Why we think this has impact

The hard thing about AI-narrated RPGs is that the LLM wants to drift. It wants to contradict itself. It wants to invent topology. It wants to forget what happened two turns ago. Every attempt so far has either (a) let the LLM be authoritative and accepted the drift, or (b) caged the LLM so tightly that it's just a Mad Libs generator.

**Immortal Engine's bet:** the LLM is spectacular at two things — *narrating structured state* and *translating natural language into structured data*. We use it for exactly those two things, and only those. The engine provides the state, the determinism, and the rails. The LLM provides the voice at runtime and the import pipeline at build time.

If we nail the slice, we will have demonstrated something nobody has shipped: an infinite AI-narrated RPG with real mechanical crunch, real memory, real lore density, and zero drift. That's worth the push.
