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

## THE GOVERNING LAW: Earning the Judge — The Camera Rule

Everything below serves this. It is the constraint that makes the rest possible.

> **The engine adjudicates any atrocity. It never *serves* one.**

The line that makes a work both incredible and ghastly is not the darkness of the
material. The Judge in *Blood Meridian* is far worse than anything in *It*. The difference
is what the prose does to the reader. McCarthy renders the Judge's atrocities with cold,
biblical distance: you are never invited to enjoy them, never titillated, never handed the
act as a thing to consume. You are made to feel the weight and the wrongness. King's
infamous sewer scene fails because the prose delivers a gratification it has no business
delivering. McCarthy *earns* the Judge. King did not earn that scene. The test is not "how
dark" — it is **does the work make you feel the horror of evil, or does it hand you evil
as pleasure.** The first is art. The second is the thing we refuse.

So, two clauses:

1. **The hard exclusion (narrow, absolute).** The engine never depicts, describes,
   simulates, or sexualizes the abuse of children, in any form, under any framing. That
   one specific thing is a real-world harm, not a fictional register. It is out of the
   mechanics entirely. This is one thing, not a fence around darkness.

2. **The McCarthy law (the engine that does the real work).** The prose of evil is
   **engineered to withhold gratification.** The darker the act, the colder, flatter, and
   more banal the rendering. The player is never handed the satisfying, titillating beat.
   Evil is delivered only ever as **weight and consequence, never as pleasure.** This is
   the same banal-prose principle as the morality→tone wiring (M3) — but here it is
   reframed as a *moral* law, not a stylistic one. It is how the engine "earns the Judge."

**This is how you play as the Judge without becoming horror-porn for the worst people.**
A player may embody true, even child-harming, monstrousness the way the Judge exists on
McCarthy's page: through implication, the world's recoil, the attention of chaotic gods,
and prose that refuses them the high. The engine *knows* you crossed into the
unforgivable; it damns you for it; it never stages it for your enjoyment. "The
unforgivable" is a category the system recognizes and punishes (it is the final line of
the redemption arc), not a scene it renders.

The exclusion is not a limit on the Judge. It is the discipline that separates the Judge
from the sewer. McCarthy stays in *because* he never gives you the high; the scene we
refuse is refused *because* it does.

**Why this makes light harder, and why that is just.** Withholding the gratification of
evil means the dark path is easy, banal, and lonely — exactly as it should be. It also
means **beauty and light become the hard thing**, the thing that must be *built* against
resistance, earned slowly, and that is the only place the engine ever lets the writing
become truly beautiful. If beauty were as cheap as cruelty, neither would mean anything.
Making evil unrewarding to *experience* is precisely what gives the light something to
mean. The difficulty of writing the light well is not a side effect of this rule. It is
the proof the rule is honest.

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
6. **Divine patrons are asymmetric — light protects its own, evil is treacherous.** Gods
   of light protect their faithful (virtue buys real divine aid when you are desperate).
   Gods of evil are chaotic, disloyal, sometimes stupid; they may toy with you, gift you,
   or devour you for crossing their path. The dark "reward" is high-variance and unsafe by
   design. Loyalty to you is a performance until you are wholly their instrument — and
   even then it is conditional.
7. **Getting away with it is a skill ("you'd better be good at it").** Atrocities generate
   investigation pressure. You can hide what you've done for a long time, but pressure
   compounds, witnesses and evidence accrue, and the truth gets pulled. A crime/detection
   layer, not a guaranteed clean escape.
8. **No power ceiling, two curves.** Light: slow, disciplined, compounding, safe, immense
   over time. Dark: fast, immediate, jagged, capped by nothing but the treachery of your
   patrons and the hunt. "Play with fate and roll the dice" is literal — the
   transyuggothian gift is a high-variance roll that can ascend or unmake you.

## Divine patrons, crime, and the shape of power

These three extend the morality state; all serve the Camera Rule (a dark patron's "gift"
is rendered as dread and cost, never as a power-fantasy high).

**Divine patrons (a layer on `morality`).** A patron axis tracks which powers have taken
an interest in you, earned by your deeds. Light patrons form a *covenant*: virtue +
faction standing unlock reliable aid (a sanctuary heals you, an ally arrives when you are
about to die, a door opens). Evil patrons form an *appetite*: corruption draws their gaze,
they extend power, and they are unreliable on purpose — a betrayal/whim table means the
"help" can curdle into poison, mockery, or annihilation, especially if you are not fully
committed. The light covenant is a contract; the dark appetite is a predator that smiles.

**Crime & detection ("you'd better be good at it").** Each atrocity carries a `heat` /
investigation-pressure value scaled by severity, witnesses, and how cleanly you acted
(WITS/deception vs. the world's scrutiny). Heat is hidden from the player (no meter),
accrues, decays slowly with distance/time, and when it crosses thresholds the world acts:
questions asked, evidence found, agents of light pulling the thread. This is the realism —
a monster operates in the dark until the pattern gives him up. Maps onto the rumor layer
(rumors are the propagation of heat) and faction disposition (institutions investigate).

**Two power curves (no ceiling either direction).** Corruption→capability and
virtue→capability are *both* unbounded, shaped differently. Virtue compounds: slow, safe,
reliable, and over a long disciplined life it becomes immense. Corruption spikes: fast,
strong, immediate access to forbidden power — but jagged, unsafe, and gated only by patron
treachery and the hunt. The transyuggothian gift is the dark curve's signature beat: a
high-variance fate roll (uses the seeded RNG) that can grant tremendous power or unmake
the character. You play with fate; fate plays back.

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
  corruption: 0,        // 0..100 (uncapped curve at the gate layer); the dark accumulator
  virtue: 0,            // 0..100; the light accumulator (separate axis, not a slider)
  locked: false,        // true once the final line / unforgivable is crossed
  heat: 0,              // hidden investigation pressure (crime & detection)
  patrons: {},          // patronId -> standing; light = covenant, evil = appetite
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
- **M6 — Crime & detection ("you'd better be good at it").** `heat` accrues per atrocity
  (severity × witnesses × inverse-cleanliness via WITS/deception), decays slowly, and at
  thresholds the world investigates (questions, evidence, agents pull the thread) via the
  rumor + faction systems. **Done-when:** a sloppy killer gets found out; a careful one
  buys time. No heat meter shown.
- **M7 — Divine patrons.** The patron axis: light = covenant (virtue buys reliable aid
  when desperate), evil = appetite (corruption draws their gaze; an unreliable
  betrayal/whim table can turn "help" into poison/mockery/ruin unless wholly committed).
  The transyuggothian gift is the high-variance fate roll (seeded). **Done-when:** a
  faithful light character gets saved at the brink; a dark dabbler gets burned by a god.

Each milestone is independently playtested per PLAYTEST_PROTOCOL (pre-register → build →
suite + prose gate → live browser → committed report). **Every milestone is checked
against the Camera Rule:** no milestone may render evil as gratification, and the hard
exclusion holds across all of them.

## Premises (confirmed in office hours)
0. **The Camera Rule governs everything** (see top): the engine adjudicates any atrocity
   but never serves one. Hard exclusion (no depiction/sexualization of child abuse) +
   the McCarthy law (evil prose withholds gratification). ✅
1. No alignment meter in the UI. ✅
2. Reuse organs (faction/trust/rumor/gate-pattern/Stage E), don't rebuild. ✅
3. Prose encodes morality — the biggest new build, and the heart. ✅
4. Realism over spectacle (social/institutional consequences, not scripted hunters). ✅
5. Light is *harder* to render than dark, by design — and that difficulty is the proof
   the system is honest. The light is the only place the prose is allowed to be beautiful. ✅
6. Divine patrons are asymmetric (light covenant / evil appetite); crime carries
   detection risk; both power curves are uncapped, shaped differently. ✅

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
