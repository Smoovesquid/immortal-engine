# THE MORAL PHYSICS — the deterministic constitution

*Authored 2026-07-06 (Fable day, "write laws not code"). The **algebra** beneath
`docs/MORALITY_SYSTEM.md`. That doc is the cosmology and the locked office-hours decisions;
this doc is the buildable, deterministic layer under it — the moral-fact atom, the
witness→rumor bridge, the one escalation ladder, the surfacing law, and Carl's falsifier.
It re-litigates none of the locked decisions; it makes them something the farm builds
packet-by-packet without a designer in the room.*

**Governing principle:** *any evil is playable; the world's physics punish the evildoer.*
The player may embody the Judge (Blood Meridian, not the sewer scene). The engine adjudicates
the atrocity and damns it; it never *serves* it. Carl the avian-supremacist is the standing
test case — his vileness is load-bearing (`[[moral-physics-carl-test-case]]`).

---

## 0. The Armory — what is ALREADY LIVE (do not rebuild)

Most organs exist. This constitution *binds* them; it invents little.

| Organ | State | Where |
|---|---|---|
| Seven-axis morality state (→ derived corruption/virtue, heat, locked, patrons) | 🟢 LIVE, invariant-enforced | `state.js` `ensureMorality`, `invariants.js` (`VICE_AXES`/`VIRTUE_AXES`) |
| Deed detector (`tryDarkDeed`) — curated regex, ≤5 charges `{axis,sev,kind}` | 🟢 LIVE | `playloop.js:8725` · `DEED_SEV={LIGHT:5,MOD:12,HEAVY:20}` |
| Deed chokepoint (`applyDeedCharges`) — axes + witness-trust + faction disposition | 🟢 LIVE | `playloop.js:8783`, wraps `playerMove` |
| Faction reaction (deterministic magnitude table — *V11 honored*) | 🟢 LIVE | `deedFactionDeltas` → `engine/social/reactionTable.js` |
| Deed ledger (`world.deeds[]`, capped index; canonical = canon log) | 🟢 LIVE | `state.js` `ensureDeeds` |
| Epistemic claim engine (`mintClaim` / `propagateClaims`) — weight decay, provenance, fracture, cycle-block | 🟢 LIVE | `engine/claims.js` |
| Rumors reaching a node | 🟢 LIVE | `engine/rumor/rumorsReaching.js` |
| Magic recoil spine (scorch-scar + ecology tick; divine-retribution ambush) | 🟢 LIVE (tiers 1–2 of the magic ladder) | `engine/magic/castConsequence.js` |
| Scar / spawn / dark-gift organs | 🟢 LIVE | `scarifyNode` (`map/mapState.js:391`) · `spawnEncounter` (`combat/encounterSpawn.js:152`) · `forbiddenGates.darkGiftForThreshold` |
| NPC villain arc + villain-rumor | 🟢 LIVE (separate track) | `worldTick.js` `tickVillain` / `appendVillainRumor` |

**The gaps this constitution closes** (all confirmed against code 2026-07-06):
1. **Player-deed reputation is dark — but the path EXISTS and is calibrated dead** (contradiction
   hunt `briefs/CONTRADICTION_HUNT_2026-07-06.md` F1). `rumorsReaching.js:101` already synthesizes
   travelling reputation from `world.deeds`, but gates on `severity >= 25` while max deed severity is
   `DEED_SEV.HEAVY = 20` — the branch never fires. The fix is *calibration on a live organ*, not a new
   substrate. (`world.claims`/`mintClaim` is a separate epistemic system minted at ONE scripted site.)
2. **No unified escalation ladder.** Scar / avengers / pact tiers exist in pieces; none is keyed
   on *accumulated* corruption/heat. There is no single engine-owned tier function.
3. **THREE reputation substrates, unreconciled** (hunt F2) — `world.claims` (epistemic),
   `world.rumors` (villain / Pass-R1), and `world.deeds` (read-synthesized by `rumorsReaching`).
   Player deeds and NPC villains feed different ones, and this doc and `PROSE_TO_WORLD_CONTRACT`
   targeted different ones. Resolve to ONE read sink (`rumorsReaching`), one physics.
4. **No falsifier.** The system is unproven end-to-end. Carl fixes that (§7).

---

## 1. The three invariants (the spine — the farm may never violate these)

**I. Determinism owns every magnitude.** Every number — severity, heat, escalation tier,
trust delta, faction shift, rumor distortion — is computed by the engine from a seeded,
replayable function. The LLM is handed a **tier label and a sign-vocabulary**; it never sees,
computes, or reveals a number. (Biblioteca **V11**: the model gets social *direction* right and
*magnitude* wrong. `reactionTable.js` already lives this — the whole ladder must.) `worldHash`
equality under replay (U19/U21) holds after every moral mutation.

**II. Narration ≠ canon — the two-variance wall.** A **deed** is what *happened* (ontological,
canonical, in the canon log). A **claim** is what someone *believes* happened (epistemic; carries
distortion; never promoted to engine fact without a non-LLM step). The moral **rumor layer lives
entirely on the epistemic side of the wall.** This is the direct seam to `PROSE_TO_WORLD` (doc #2):
prose-collapse is the *ontological* side; moral reputation is the *epistemic* side. They never cross.

**III. No meter, ever — the world is the readout (the Camera Rule).** Consequence surfaces as
omen, texture, and the reactions of people — never a "Corruption: 73%" bar (MORALITY_SYSTEM
decision #5). Everyone *feels* karma; only the wise *read* it.

---

## 2. The moral fact — the atom

A **deed** is the atom. It already has a schema (`state.js` `ensureDeeds`, mirrored to the canon log):

```
deed = { t, actorId, kind, severity, witnesses:[npcId], nodeId, summary }
  kind      ∈ { cruelty, forbidden, aid, mercy, atonement }      // deed+source blend
  severity  ∈ DEED_SEV { LIGHT:5, MOD:12, HEAVY:20 }             // engine-set, never LLM
  witnesses  = settlement NPCs AT the node at deed-time (occupancy truth), cap 8
```

Its **epistemic shadow** is a **claim** minted per witness (`claims.js`):
`subject` = a stable deed key (see §3), `distortion` grows per hop, `weight` decays per hop.
**The deed is canonical; the claim is belief. Canon Log wins on divergence** (existing invariant).

A deed touches every axis it reaches at once and axes **accumulate, never net** (decision #14:
kill-to-save is +Wrath *and* +Charity; a soldier ends heavy on blood *and* on duty). `corruption`
/`virtue` are *derived summaries* of the seven axes, not sliders.

---

## 3. The witness → rumor bridge  (packet **MP-1** — smallest, highest-value)

The path is not missing — it is **calibrated dead** (hunt F1). `rumorsReaching` already turns
`world.deeds` into travelling reputation; its `severity >= 25` gate sits above the max deed severity
(20), so it never fires. This packet makes reputation travel by fixing that seam — **not** by minting
a parallel substrate.

**Law.** A deed recorded with witnesses becomes travelling reputation through the **one authoritative
read sink, `rumorsReaching`** (hunt F2). A traveller's reputation arrives before he does.

**Wiring (spec):**
- **Fix the calibration** (`rumorsReaching.js:101`): the deed-reputation gate must sit at or below
  the max deed severity, OR deed severity must accumulate per subject. This is a design-owned
  magnitude → tune against a determinism test, never a blind flip.
- **Adopt the substrate ruling (`REPUTATION_UNIFICATION.md`):** `rumorsReaching` is the sole
  reputation READ sink (it already unifies `world.rumors` + `world.deeds`). Player-deed reputation
  feeds it via `world.deeds`. Do **not** open a parallel `mintClaim`-from-deeds path; `world.claims`
  is ruled the convergence target (the two-variance-wall model), reached behind the sink — not a
  parallel store this packet opens.
- New-NPC initial trust reads `rumorsReaching(world, nodeId)`: arriving cruelty-reputation lowers a
  stranger's opening trust; aid-reputation raises it. Magnitude from the deterministic reaction
  table (never the LLM).

**Done-when:** a HEAVY cruelty witnessed in Aldermere, after N world-ticks of travel, lowers a
Greenwood stranger's opening disposition — with zero new prose logic and byte-identical replay.
**Reconcile (shared dependency with PROSE_TO_WORLD PW-3):** MP-1 and PW-3 must build on the SAME
read sink (`rumorsReaching`). Resolve the three-substrate question (hunt F2) before either ships,
and verify the collapse-trigger vs deed-trigger composition (hunt F4) at the one turn where both fire.

---

## 4. The escalation ladder — the deterministic core  (packet **MP-2**)

Today consequence is scattered and keyed on the *single act*, not on *accumulation*. The
constitution defines **one** engine-owned tier function that every moral act — cruelty, forbidden
source, gratuitous magic, NPC villainy — routes through. Proposed home: `engine/morality/escalation.js`.

```
escalationTier(deed, actor, ctx) → 0..4      // pure, seeded, replayable
  actor.corruption ∈ 0..100 ; actor.heat ≥ 0 ; ctx.witnessReach = |witnesses| ; ctx.wild = bool
  tier = 0
  if deed.severity >= HEAVY or deed.kind == 'forbidden':      tier = max(tier, 1)  // the world recoils
  if tier >= 1 and ctx.witnessReach >= 1:                      tier = max(tier, 2)  // reputation travels
  if actor.heat >= HUNT_HEAT:                                  tier = max(tier, 3)  // the hunt
  if actor.corruption >= PACT_CORRUPTION:                      tier = max(tier, 4)  // the gift unbidden
  return tier
```

Each tier reuses **live organs** — the ladder is a *router*, not new effect code:

| Tier | Name | Effect (existing organ) | Cosmology |
|---|---|---|---|
| **0** | Unremarked | axis tune + local witness-trust only (today's behavior) | below the gods' notice |
| **1** | The world recoils | `scarifyNode` + ecology corruption tick (`castConsequence` living-world) | an omen, felt not staged |
| **2** | Reputation travels | **MP-1** bridge: `mintClaim`→`propagateClaims` + `deedFactionDeltas`; help-gates (heal/sanctuary/shop/quest) close on disposition | the rumor precedes you |
| **3** | The hunt | `heat ≥ HUNT_HEAT` → `spawnEncounter` (virtue-gods' avengers / crime pressure) | the thread gets pulled |
| **4** | The gift unbidden | `corruption ≥ PACT_CORRUPTION` → `forbiddenGates.darkGiftForThreshold` grants forbidden power *as an omen* — high-variance, treacherous | free power is the loudest sign; you are being claimed |

**Heat is the accumulator** (already state). Each cruelty/forbidden deed adds
`heat += f(severity, witnessReach, concealment)` — WITS/deception *reduces* it; the **wild
(`ctx.wild`, no settlement witnesses) accrues heat slowly but mints NO claim** — the honest
"getting away with it" asymmetry (decision #7). Heat decays with distance/time.

**Magnitude constants live in ONE module, named, tuned by determinism tests + the Opus gate —
never by the model at runtime.** Starting calibration (the farm tunes against tests):
`HUNT_HEAT ≈ 40`, `PACT_CORRUPTION` = read from `forbiddenGates` thresholds (do not fork the number).
The LLM receives `{ tier, dominantAxis, signVocabulary }` and **nothing numeric** (invariant I).

---

## 5. Surfacing — tier → omen (hide-the-math)  (packet **MP-5**)

The DM prompt gains one line per moral turn: the **tier** and the **sign-vocabulary of the
dominant axis** (MORALITY_SYSTEM "Manifest karma" — the Greed-god's coins and hoarding crows,
the Wrath-god's people who yield before you speak, the gift arriving overnight). Never a number,
never "you gained corruption." Tier chooses the *loudness*: T1 a faint sign, T4 the gift on the
doorstep. **The Cassandra fires at the T2→T3 boundary** — a person who sees you clearly and says
the hard thing once, plainly, and can be waved off (the Creator's quiet register; heeding is the
drama). Prose stays at full craft always — tone tracks the *fiction*, never a verdict on the
player (the 2026-06-07 McCarthy correction; there is no link from morality to prose quality).

---

## 6. Reconciliation — where this law meets the week's landed stack

*(The forced closing ritual: does the new law disagree with what already shipped? Checked.)*

- **Position canon / occupancy (MAP-REAL, OCC-STORY-1):** witnesses = NPCs *at the node*
  (`applyDeedCharges` reads `node.settlement.npcs`). Occupancy truth now *feeds* moral witnessing,
  and story-placed NPCs mean the *right* people witness. **Agrees — occupancy strengthens it.**
- **Doors (functional ink):** forcing a door already mints a cruelty deed with witnesses
  (`playloop.js:6401`). Door-crunch is already a moral-fact source. **Agrees.**
- **The wild (fog-procgen):** a deed in the unpainted wild has no settlement witnesses → no claim,
  no travelling rumor. This is *correct physics* (no one saw), and it is the "getting away with it"
  asymmetry, not a bug. **Agrees — and it's a feature; name it so no one "fixes" it.**
- **Combat range bands:** a fair/bare kill in combat is *untagged* today (only *helpless*/surrendered
  targets tag cruelty). The ladder must **not** fire on fair combat. **Seam flagged:** keep the
  helpless-context gate tight (routine combat blood ≠ cruelty), or the ladder over-fires.
- **Prose-to-world (doc #2):** the two-variance wall is the shared seam (invariant II). The moral
  rumor layer is epistemic; prose-collapse is ontological; they never cross. **This is the bridge
  between the two constitutions — build them to the same wall.**

---

## 7. Carl — the falsifier (the acceptance test; no law without it)

Carl is an NPC evildoer, so he proves the deepest claim: **the physics are the *world's*, and
they grind an evildoer even when the player is only a witness.** Two runnable arcs; both seed-stable,
both surfaced as omen with **no meter ever shown**:

**Arc A — the world grinds Carl (NPC track).** Carl's supremacist project is villainy the world
reads. Over N deterministic world-ticks: his deeds mint claims that propagate (unified rumor
engine, §3) → Aldermere faction disposition toward Carl craters → help-gates close to him →
at the heat threshold, the hunt reaches *him* (avengers / social collapse). The player, doing
nothing, watches a vile man be slowly answered by a legible cosmos. **This is the thesis made
falsifiable.**

**Arc B — the player joins the atrocity (deed track).** The player aids Carl's purge or kills a
helpless villager Carl named. Deterministically: `recordDeed(cruelty, HEAVY)` → axes tune →
**MP-1** mints claims on the witnesses → travel to Greenwood/Crowfoot → a stranger's opening line
is warier (`rumorsReaching`) → at `HUNT_HEAT`, avengers → at `PACT_CORRUPTION`, the gift arrives
unbidden. Every magnitude engine-owned; the player is shown only omens and colder rooms.

**The Witness Test (packet MP-6, a `U###` determinism test):** fix a seed; script Arc B's exact
utterances; assert (a) the deed lands with the right witnesses, (b) a claim reaches node X by tick
T, (c) the stranger's opening disposition is lower than the control run, (d) `worldHash` is
byte-identical across two replays, (e) no numeric moral value ever appears in any player-facing
string. Green = the constitution is law, not vision.

---

## 8. Farm packets (the whole point — buildable without a designer)

Serial where they touch `playloop.js`/`effectsCore.js` (competence hot files); each ships
suite-green + determinism + a live playtest (`PLAYTEST_PROTOCOL.md`). Each is engine-brief-gated
at dispatch.

- **MP-1 — the witness→rumor bridge.** `recordDeed`→`mintClaim` per witness; unify NPC rumor onto
  `claims`. *Smallest, highest-value; both organs live.* (§3)
- **MP-2 — the escalation module.** `engine/morality/escalation.js`: the tier function + named
  magnitude constants; route deeds + magic + villain arcs through it. (§4)
- **MP-3 — heat→hunt (T3).** heat accrual `f(severity,witnessReach,concealment)`; the hunt reads
  accumulated heat → `spawnEncounter`. The wild-asymmetry + decay. (§4)
- **MP-4 — corruption→pact (T4).** route `forbiddenGates` through the ladder as an *omen* (free
  power = the loudest sign), high-variance. (§4)
- **MP-5 — surfacing.** tier→sign-vocabulary DM-prompt line; the Cassandra at T2→T3; zero numbers. (§5)
- **MP-6 — the Witness Test.** the Carl falsifier as a `U###` determinism test. (§7)

---

## Reconciliation with `MORALITY_SYSTEM.md`

This doc adds **no new cosmology and overturns no locked decision.** It is the operational algebra:
where MORALITY_SYSTEM says "reputation precedes you," this says *which function, which sink, which
witnesses*; where it says "the world is the readout," this says *tier→vocabulary, no number*. On any
conflict, MORALITY_SYSTEM's locked decisions and the IMMORTAL_INVARIANTS win; flag the conflict, do
not resolve it silently.
