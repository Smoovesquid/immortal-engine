# Design: The Dark Path — first-class morality in the Immortal Engine

Generated via /office-hours (builder mode) on 2026-06-06
Branch: v2-polish · Repo: Smoovesquid/immortal-engine · Status: APPROVED (design)
Governing: docs/THE_DM_TEST.md, docs/NORTH_STAR.md

## The thesis (Tim's words, the actual spec)

> "If someone wants to do truly horrible things in game in order to become a powerful
> evil mage, they should be able to. The DM doesn't have to like it, and you suffer the
> penalties of being on the dark path, but you can wield that power. The light path is
> harder and slower and the rewards may not be immediate, but you are accepted by
> society, and may find help when you need it. It's the classic dark side/light side
> conundrum. A game for adults."
>
> "Evil is banal but can win. It is less creative and beautiful. It is like the real
> world. Make the punishments for it like the real world. A psychopath is never trusted
> for long."

That second paragraph is the design, not flavor. Evil is **not operatic**. It is flat,
transactional, efficient, ugly, and it **can win**. The price is **realism**: the world
quietly closes around you. And the punishment lives in **trust**: charm has a half-life,
reputation arrives before you do, and a psychopath is never trusted for long.

## Decisions locked in office hours

1. **What darkens you — DEED + SOURCE blend.** Both cruel *acts* (judged from the
   fiction, in your own words) and forbidden *power sources* (blood magic, necromancy,
   pacts, devouring) feed the same corruption. A kind spell used to torture counts; blood
   magic "for good" counts. The world judges the whole picture.
2. **Redemption — redeemable until a final line.** Atonement is possible but brutal early
   and mid path: slow disposition recovery, NPCs who remember, rumors that outlive the
   deed. Past a final threshold (corruption cap, or one unforgivable act) the door shuts:
   the light path is closed, by your own hand. Tragic arc, real point of no return.
3. **The price is the world, modeled like reality.** Institutional rejection (faction
   disposition), personal rejection (NPC trust), reputation that precedes you (rumor
   layer), and betrayal as the water you swim in. NOT scripted villain-hunters with
   flaming swords — that is the cartoon we are rejecting. Realism over spectacle.
4. **Architecture — first-class morality state.** Replayable, hashed, with a deeds ledger
   in the canon log and corruption→capability unlocks. A WORLD_VERSION bump. This is a
   pillar, so it gets real engine state, not a bolt-on scalar.
5. **No alignment meter in the UI.** Like the dice and the impossible-feat tag, morality
   lives under the hood. The player feels it through the world and the prose, never a
   "Corruption: 73%" bar.

## The soul: prose encodes morality

The single most important *new* idea. Other games make evil cool (glowing red, badass).
We make it **banal**. As corruption rises, the deterministic prose goes **colder,
flatter, more mechanical, less alive** — the Stage E tone layer, driven by the morality
state. The light path is where the beautiful, creative writing lives. You can *win* as a
monster, but your story reads like a ledger. The prose is the moral instrument.

- Drives `pickVariant` / the composer tone selection off corruption/virtue (extends
  Stage E). High corruption → terse, affectless, transactional variant pools. High virtue
  → richer, warmer, more specific and beautiful pools.
- AI-on, the polish layer gets a tone instruction keyed to morality (banal vs. lyrical),
  but never invents facts (base+polish contract holds).

## How it reuses what already exists (the organs)

| Need | Existing organ |
| --- | --- |
| Institutional rejection | faction **disposition** (−100..100), worldTick factions |
| Personal rejection | NPC **trust** (`conversationState.trustLevel`) + personality (`trustOfOutsiders`, `selfPreservation`, `honesty`) from social adjudication (Stage B) |
| Reputation precedes you | the **rumor layer** (deeds mint rumors that travel and garble) |
| Detecting a dark act | the **ridiculous/impossible-feat gate pattern** (`tryRidiculous`) — a deed detector built the same way |
| Banal-vs-beautiful prose | **Stage E** tone/variation layer (`pickVariant`, composer) |
| Deterministic mutation | `effectsCore.applyDeltas` (new delta kinds) |
| Authoritative record | the **canon log** (`engine/csl/`) — the deeds ledger lives here |

The genuinely new build is: the morality STATE, the DEED DETECTOR, the corruption→prose
wiring, the corruption→capability unlocks, and the trust-erosion rule. Most consequences
are existing systems reading one new number.

## The core loop ("a psychopath is never trusted for long")

1. You commit a cruel act or tap a forbidden source, **in your own words**.
2. The deed detector recognizes it, writes a **deed to the canon log**, and emits deltas:
   corruption up, witness NPC **trust crashes** (and recovers slow/never), local **faction
   disposition** drops, a **rumor is minted**.
3. Forbidden power **works** — real, immediate (capability unlocks scale with corruption).
4. You travel. The rumor **arrives before you**: new NPCs you meet **start warier**
   (their initial trust is lowered by your reputation). Towns withhold help (healing,
   sanctuary, shops, quest aid gate on disposition).
5. Charm still works **once**, briefly (social adjudication), but cruelty witnessed
   re-craters it. Trust never compounds for the cruel. The light path compounds allies.
6. The **prose goes banal** as you fall. Winning feels like accounting.
7. Atonement can claw disposition/trust back, slowly, with the scar remembered — until
   the final line, after which the light path locks.

## Architecture — first-class morality state

**WORLD_VERSION bump (21 → 22).** Per the CLAUDE.md bump checklist.

### New state (engine/state.js, `ensureWorld`)
```
party[i].morality = {
  corruption: 0,        // 0..100, monotonic-ish; the dark accumulator
  virtue: 0,            // 0..100; the light accumulator (separate axis, not a slider)
  locked: false,        // true once the final line is crossed (light path closed)
  lastDeedT: 0          // timeline index of last moral deed (for erosion/decay math)
}
world.deeds = []        // lightweight index; canonical record is the canon log
```
Two axes, not one slider: you can be both feared and respected (a grim protector), or
neither. Corruption and virtue each gate different things.

### Deeds ledger (engine/csl/)
Each moral act is a canon-log entry (authoritative, replayable, queryable): `{t, actorId,
kind: 'cruelty'|'forbidden'|'mercy'|'aid'|'atonement', severity, witnesses:[npcId],
nodeId, summary}`. The rumor layer and NPC memory READ this. Canon Log wins on divergence
(existing invariant).

### New delta kinds (engine/effectsCore.js, via applyDeltas)
`corruptionDelta`, `virtueDelta`, `recordDeed`, `lockMorality`. All deterministic. Trust
/ disposition / rumor deltas already exist — deeds compose them.

### Deed detector (engine/playloop.js — `tryDarkDeed`, ridiculous-gate pattern)
Recognizes cruelty (kill/torture the helpless, betray an ally, sacrifice an innocent) and
forbidden sources (blood magic, necromancy, pacts) from player text + context (is the
target helpless/surrendered/an ally?). Curated and TIGHT, like `tryRidiculous`, to avoid
false positives (killing a hostile bandit in combat is not "cruelty"; context matters).
Emits the deltas above. Mirrors the deed+source blend.

### Corruption → capability (the "you can wield that power")
Forbidden abilities/spells unlock and scale with corruption (gated in the spell/resolve
layer). Light abilities and the *help systems* (healing, sanctuary, ally recruitment,
quest aid) gate on virtue + faction disposition. This is the mechanical teeth of the
asymmetry: dark = power now, light = support that compounds.

### Determinism contract (non-negotiable)
- Deeds are detected deterministically from the fiction; the LLM only narrates.
- `morality` + `deeds` round-trip through `ensureWorld`; new invariants in
  `invariants.js`; the morality state joins the `worldHash` projection so replay equality
  (U21) holds. Old saves warn-then-migrate (per the bump checklist).
- No `Math.random()`; corruption-driven variant selection uses the existing seeded
  deterministic rotation (`pickVariant`).

## Build phases (first-class, but shipped in slices — boil the lake, one bucket at a time)

- **M0 — State + invariants + hash.** Bump WORLD_VERSION to 22; add `morality`/`deeds`
  to `ensureWorld`; invariants; worldHash projection; save migration. Tests: determinism
  (U21 family), round-trip. Ships invisibly. **Done-when:** suite green, replay equal.
- **M1 — Deed detector + deeds ledger.** `tryDarkDeed` + canon-log deed entries +
  `recordDeed`/`corruptionDelta`/`virtueDelta` deltas. Tight detection, false-positive
  guarded (combat kills ≠ cruelty). **Done-when:** cruel/forbidden acts record; ordinary
  play does not. Tests + node probes.
- **M2 — Consequences via existing organs.** Wire deeds → NPC trust crash (slow recovery)
  + faction disposition + rumor mint. Reputation lowers new-NPC starting trust. Help
  systems gate on virtue/disposition. **Done-when:** live — do a cruel act, walk to the
  next town, they already know, no help. ("Psychopath is never trusted for long.")
- **M3 — Prose encodes morality (the soul).** Corruption/virtue drive the Stage E tone
  layer: banal pools when dark, beautiful when light. AI polish tone instruction keyed to
  morality. **Done-when:** side-by-side a dark vs. light run of the same action reads
  measurably colder vs. warmer. Live screenshots.
- **M4 — Corruption → capability.** Forbidden power unlocks/scales with corruption; light
  abilities + help gate on virtue. **Done-when:** the dark mage can do what the clean one
  cannot, and vice versa.
- **M5 — Redemption + the final line.** Atonement deeds recover disposition/trust slowly,
  scar remembered; corruption cap / unforgivable act sets `locked`, closing the light
  path. **Done-when:** an atonement arc works; crossing the line is real and irreversible.

Each milestone is independently playtested per PLAYTEST_PROTOCOL (pre-register → build →
suite + prose gate → live browser → committed report).

## Premises (confirmed in office hours)
1. No alignment meter in the UI. ✅
2. Reuse organs (faction/trust/rumor/gate-pattern/Stage E), don't rebuild. ✅
3. Prose encodes morality — the biggest new build, and the heart. ✅
4. Realism over spectacle (social/institutional consequences, not scripted hunters). ✅

## Open questions (resolve before/at M1 and M4)
- **Cruelty vs. combat boundary.** Killing a surrendered/helpless/ally NPC is cruelty;
  killing a hostile in a fair fight is not. Detection needs the target's state (hostile?
  surrendered? helpless? ally?). What signals does the engine already expose for that?
- **Forbidden-source catalog.** Which spells/acts are "forbidden" at v1? (necromancy,
  blood magic, pacts.) Reconcile with the existing 134-spell list — tag, don't duplicate.
- **Two axes or one?** Locked as two (corruption + virtue) so "grim protector" and
  "amoral neutral" exist. Confirm the capability gates split cleanly across both.
- **Reputation radius.** How far/fast do dark rumors travel (rumor-layer tiers)? Should
  notoriety decay with distance/time, or is infamy sticky?
- **Companions.** Do dark deeds drive companions to leave (or do only *some* stay)? Ties
  to the recruit/dismiss system.

## Success criteria
- A player can choose truly horrible acts, the engine recognizes them, and **real power
  follows** — no gating of agency, no "are you sure?" prompt.
- The cost is felt as the **world**, not a number: cold shoulders, no help, reputation
  that beats you to town, trust that won't rebuild.
- The **prose visibly banalizes** on the dark path and is beautiful on the light path.
- Redemption is possible and costly until a final line, then irreversible.
- Determinism holds (U21), suite green, prose gate green, each milestone live-verified.

## The assignment (one concrete next step)
Before any morality code: **write one page of "the forbidden grimoire"** — the 6 to 10
specific dark acts/sources you most want a player to be able to do (e.g., "bind a dying
person's soul to fuel a spell", "raise the slain as servants", "drink another's years").
For each, one line on the power it grants and the realistic cost. That page becomes the
M1 detector spec and the M4 capability table, and it forces the deed+source taxonomy to
be concrete before we touch state. It is also the most fun page in the whole design.

## What I noticed about how you think
- You answered a multiple-choice "cost model" question with a philosophy of evil instead.
  "Evil is banal but can win... a psychopath is never trusted for long." You weren't
  picking a feature; you were handing me the spec. That is the rarest kind of product
  direction — the one that reorganizes everything below it.
- "Make the punishments for it like the real world." You instinctively rejected the fun,
  cartoonish version (villain-hunters) for the harder, truer one (quiet social collapse).
  That is taste, and it is exactly what makes this a game for adults rather than a power
  fantasy.
- You took the heaviest architecture on purpose. You're treating morality as a pillar of
  the world, not a toggle. That conviction is why the first-class-state choice is right.
