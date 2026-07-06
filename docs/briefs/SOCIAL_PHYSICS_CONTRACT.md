# The Social Physics Contract — deeds move standing, tables set the number

*SP-series. [[IG-11]] social physics as a NAMED layer; the M2 remainder from `docs/MORALITY_SYSTEM.md`
("faction disposition", "help-gating", "new-NPC starting-trust by reputation"). Governing law:
**Biblioteca Vol 11 §7.3** (`docs/biblioteca/vol-11-frontier-pragmatics-common-ground.md:215`):
"Do not allow the model's uncalibrated magnitude estimates to directly mutate canonical social state" —
LLMs get social DIRECTION right and MAGNITUDE wrong, so every social delta's size comes from a
deterministic table, routed through `effectsCore.applyDeltas`. SP-1 (the foundational packet) is
IMPLEMENTED alongside this doc; SP-2..6 are specced below.*

> **Reputation substrate:** governed by [`../REPUTATION_UNIFICATION.md`](../REPUTATION_UNIFICATION.md) —
> faction rep / trust are its Layer 4, the `deeds`→`rumorsReaching` synthesis its Layer 5; read
> reputation only via `rumorsReaching`. Its **F1** fix lifts the dead `severity>=25` deed-rumor gate
> this contract cites at §1.3. Reconciled 2026-07-06.

---

## 1. What exists today vs. greenfield (the audit)

The hypothesis "there is no first-class social-standing state" was **wrong**. The state, the ops, the
propagation channels, and the consumers all exist. What was missing was one link: **no producer ever
moved player↔faction standing.** The consumer was live and starved.

### 1.1 Social state (all first-class, all hashed)

| Relationship | State | Range | Where | Status before SP-1 |
|---|---|---|---|---|
| player ↔ faction | `w.reputation.factions[fid]` | −100..100 | `engine/state.js:1050` (`ensureReputation`), hashed `engine/worldHash.js:32` (+ `.browser.js:30`) | **State existed, NO producer.** Only writer: `worldTick.js:457` `tickReputation` — a −1/tick uniform drift that fires only in blood-fate worlds; nothing player-caused ever moved it |
| player ↔ NPC (trust) | `npc.conversationState.trustLevel` | 0..10 | `npcTrustDelta` op, `engine/effectsCore.js:233` | LIVE both directions (dialogue modes, witnessed deeds, social rolls) |
| player ↔ NPC (anger) | provocation offense — **derived from timeline replay, not stored** | pts vs. fuse | `engine/playloop.js:6484` `priorProvocationOffense`; `engine/npc/provocation.js` | LIVE (shrug→warn→bristle→attack) |
| player identity | `party[0].morality` (14 axes, corruption/virtue, heat, patrons) + `w.deeds` (cap 64) | 0..100 / — | `engine/state.js:752,831`; deltas `axisDelta`/`recordDeed`/`adjustHeat` (`effectsCore.js:90,143,108`) | LIVE (M0–M1) |
| NPC ↔ faction | `npc.factionId` + `npc.disposition[fid]` | id / −100..100 | `engine/npc/npcGenesis.js:113–127` (NPC 0 gets the dominant faction; others 40%) | LIVE (used below) |
| factions themselves | `w.factions[]` `{id, goal, pressure, assets, hostility, lastMove}` | — | `engine/state.js` `ensureFactions`; agendas advance in `worldTick.js:tickFactions` | LIVE (demo world: `civic` + `shadow`) |

### 1.2 The reaction pattern already exists in miniature — and it IS the Vol-11 pattern

`applyDeedCharges` (`engine/playloop.js:7542`, wrapped around `playerMove` at `:620` — "every action
type at a single chokepoint") is the established idiom:

1. **Direction from a deterministic detector** — `tryDarkDeed` (`playloop.js:7484`) reads the player's
   words and returns charges `(axis, severity, kind)`; severities from the constant table
   `DEED_SEV = { LIGHT: 5, MOD: 12, HEAVY: 20 }` (`playloop.js:7482`).
2. **Magnitude from a table, never the LLM** — witness trust shift `mag = clamp(round(sev/10|12), 1, 3)`
   (`playloop.js:7564`).
3. **One batch through `applyDeltas`** — `axisDelta`s + one `recordDeed` + `npcTrustDelta` per witness.

Sibling instances of the same contract: `engine/npc/provocation.js` (insult severity table + seeded
temperament fuse; doc `docs/SOCIAL_PROVOCATION.md`), `engine/magic/castConsequence.js` (gratuitous-magic
recoil ladder, same `SEV` table at `:33`).

### 1.3 Propagation channels (all live)

- **Deed → rumor**: `engine/rumor/rumorsReaching.js` synthesizes traveled rumors from `w.deeds`
  (severity ≥ 25; tier 0 local / 2 elsewhere), consumed by `engine/npc/reputation.js`
  (`notorietyReaching`) → the dialogue greeting sours (`engine/npc/dialogue.js:410–427`).
- **The Lasting Word (IG-14)**: `engine/newspaper/lastingWord.js` is **wired live** (`playloop.js:39`,
  NP-1..4: read the paper, answer Kasual Korner ads, `playerReputation` recognition clause in greetings).
- **Gossip + claims**: `worldTick.js:tickGossip` (one-hop knowledge spread), `claims.js` six-degrees graph.

### 1.4 Consumers (live, and one was starving)

- **`npcBrain.js` Pass F1** (`engine/npc/npcBrain.js:338–447` `fallbackRules`; `:149,183` in both LLM
  prompts): faction standing thresholds — rep ≤ −50 (or hostility ≥ 70 with rep < 0) → **hostile/deflect
  regardless of personal trust** (< 7); ≤ −25 → wary; ≥ +50 → warm + trust boost. *This consumer was
  fully built and could never fire: reputation never moved.*
- **`narratorContext.js:573`** exposes `reputation.factions` to the DM prompt (facts flow; prompt wording untouched).
- **Provocation disposition** (`playloop.js:6496` `dispositionFromTrust`) — low trust shortens the fuse.

### 1.5 The genuine gaps (greenfield before this packet)

1. **No deed→faction producer** — the missing link above. The M2 remainder named in
   `docs/MORALITY_SYSTEM.md:500` ("faction disposition"). **← SP-1, implemented.**
2. **Severity scale starves reputation-travels**: every live producer caps at severity 20
   (`DEED_SEV.HEAVY`), but the rumor travel threshold is ≥ 25 (`rumorsReaching.js:101`, asserted by
   `tests/U272:139`). `notorietyReaching` is reachable only from hand-crafted saves — never from play. **← SP-5.**
3. **No differential faction ethos** — civic and shadow currently react in the same direction; "the
   thieves' den warms when the watch curses your name" needs a faction stance field (state change). **← SP-2.**
4. **New-NPC starting trust ignores reputation** (M2 remainder). **← SP-3.**
5. **Help-gating** ("towns withhold help — healing/sanctuary/shops", M2 remainder). **← SP-4.**
6. **Purity wrinkle**: `setNpcTrust` (`playloop.js:6569`) mutates `conversationState.trustLevel`
   directly, bypassing `applyDeltas`, while an equivalent op (`npcTrustDelta`) exists. **← SP-6.**

---

## 2. The contract

> **A deed is the event. Witness affiliation is the conduit. The table is the magnitude.
> `applyDeltas` is the pen. Thresholds are the behavior.**

1. **Direction may come from detectors; magnitude only from tables.** Detectors (regex today, LLM
   proposals later) may only *classify* — kind, target, severity **band**. The number applied to any
   social state comes from a constant table in a pure module. An LLM-proposed delta with a magnitude is
   rejected at the seam (nothing accepts one today; keep it that way).
2. **One mutation path.** Every social delta is an `effectsCore` op: `npcTrustDelta` (personal),
   `factionRepDelta` (institutional, NEW — `effectsCore.js`, after `npcTrustDelta`). Ops are dumb clamped
   writes; **composition lives in producers** (the `applyDeedCharges` idiom), never in op handlers.
3. **Witness-gated institutions.** A faction learns a deed only if an affiliated NPC witnessed it
   (`npc.factionId` among `deed.witnesses`). One shift per faction per deed — institutions are informed,
   not multiplied by headcount. **No witnesses → no institutional shift** (the unseen crime is heat/M6's
   business, not standing).
4. **Event-sourced, no double-count.** The reaction fires once, in the same delta batch as its
   `recordDeed`. Replay re-runs the producer → identical deltas. No "processed deeds" bookkeeping state.
5. **Reactions are consumed by thresholds, not prose flags.** NPC behavior derives from state each turn
   (F1 thresholds, notoriety greeting, provocation fuse). Nothing stores "NPC is now angry at player" —
   anger is always *derived*, so it decays/compounds naturally and replays exactly.
6. **Discovered, never announced.** No meter, no toast ([[project_obscure_goals_no_quest_log]]). The
   player learns their standing from cold greetings, deflections, and doors that don't open.
7. **§0 holds.** Deeds/rumors/newspapers carry the WHAT, never cosmology.

### 2.1 SP-1, the foundational packet (IMPLEMENTED)

**New module** `engine/social/reactionTable.js` — pure, no rng, no I/O:

```
severity band:  < 10 light   ·   10..19 moderate   ·   ≥ 20 grave
                (aligned with DEED_SEV / castConsequence SEV = {5, 12, 20})

FACTION_REP:    dark   (cruelty | forbidden):  light −2 · moderate −5 · grave −10
                bright (mercy | aid | atonement): light +1 · moderate +3 · grave +6
```

Asymmetry is deliberate: standing is easier to lose than earn (mirrors the witness-trust asymmetry and
"the light path is slower and harder, but it compounds"). Calibration anchor = the F1 thresholds:
**3 witnessed grave atrocities → the faction's people turn wary (−30 ≤ −25); 5 → hostile (−50);
~9 witnessed grave good deeds → warm (+54 ≥ +50).**

`deedFactionDeltas(world, deed) → [{op:'factionRepDelta', factionId, by}]` — resolves witnesses at
`deed.nodeId` to distinct, *existing* faction ids; output sorted by factionId.

**New op** `factionRepDelta {factionId, by}` (`engine/effectsCore.js`) — clamped write to
`w.reputation.factions[factionId]`, −100..100; **unknown faction = no-op** (a stray key would be
normalized away by `ensureReputation` and desync the hash image — refused at the op).

**New invariant** (`engine/invariants.js`, after the deeds block): `reputation.factions` is an object,
keys ⊆ known faction ids, values integers −100..100.

**Wire** (`engine/playloop.js` `applyDeedCharges`): one line — push `deedFactionDeltas(...)` into the
existing batch, after the witness-trust deltas.

**Consumption: zero new code.** F1 and the narrator context light up on their own.

### 2.2 Proven on the live demo world (seed `aldermere`, WORLD_VERSION 29)

```
start:                        { civic: 0, shadow: 0 }
1 witnessed torture:          { civic: −10 }          ← exactly FACTION_REP.dark.grave
3:                            { civic: −30 }          ← crosses F1 wary (−25)
6:                            { civic: −60 }          ← crosses F1 hostile (−50)
then decompress Crowfoot Camp: Elske (civic, trust 5, metPlayer:false, witnessed NOTHING)
  → fallbackRules verdict: hostile / deflect — "Faction hostility overrides — withholding."
same seed + same script, twice → worldHash EQUAL
```

"Your reputation beats you to town" (`docs/MORALITY_SYSTEM.md:23`) is now mechanically true through the
institutional channel — a stranger who never saw anything goes cold because their institution knows —
with zero LLM-set numbers and zero new state.

---

## 3. The packet queue (ranked)

| # | Packet | Size | Done-when |
|---|---|---|---|
| **SP-1** | **Deed→faction producer** (reaction table + `factionRepDelta` op + invariant + chokepoint wire) | **DONE** | `tests/U322` (12): table pure-function, op clamp/no-op, live-wire exact values, no-witness invariance, hash determinism. Full suite 9193/9193 · convergence 123/123 locked · playtest:quick clean |
| SP-1b | The other two live deed producers adopt the table: coerced build (`playloop.js:5374` block) and `castConsequence.js:159` push `deedFactionDeltas(...)` into their existing batches. (storyEngine branch deeds are data-authored — their `worldEffects` can carry explicit `factionRepDelta` ops.) | XS | Coerced construction / villager-blasting at a settlement moves the witnesses' factions by table values; U322-style asserts; suite green |
| SP-5 | **Grave deeds travel**: add `GRAVE: 30` to the deed severity scale for the worst contexts (torture, helpless-kill, innocent-sacrifice — `tryDarkDeed` already distinguishes them) so atrocities clear the ≥ 25 rumor threshold and `notorietyReaching` fires from real play. Do NOT lower the threshold (U272 pins it; light cruelties staying local is correct). Ripple: witness-trust `mag` cap (3) and rep band (`grave`) already absorb sev 30 — verify U109/U272/U322 exact-value asserts | S | A torture in town A sours a greeting in town B via `notorietyReaching` in a real script (no hand-crafted save); U272 still green |
| SP-3 | **Starting trust reads standing** (M2 remainder): at NPC genesis/decompression, initial `trustLevel` = 5 + floor(rep[factionId]/25), clamped 3..7 (table constants; unaffiliated NPCs use notoriety score instead). Deterministic at mint time; hash-stable (new NPCs are new state, not reshaped state) | S | In the −60 demo scenario, freshly decompressed civic NPCs start at trust 3; a +50 hero meets trust 7; determinism suite green |
| SP-4 | **Help-gating** (M2 remainder): rest/healing/sanctuary/shop verbs consult `(faction rep, notoriety)` thresholds — refusal is narrated in-fiction ("the innkeeper's rooms are all full, suddenly"). Table-driven thresholds, same F1 constants | M | At rep ≤ −50, an inn/healer at a civic-affiliated settlement refuses; at ≥ +50, aid improves; DM Test: the refusal reads as the world, not an error |
| SP-2 | **Faction ethos** (differential reaction): add `ethos: 'lawful'\|'outlaw'\|'neutral'` to `w.factions[]`. Outlaw factions read the dark table with sign flipped at half magnitude (shadow warms +5 when you torture in front of its informant). **This is the one packet that touches state shape → WORLD_VERSION bump** (checklist: `ensureFactions` default `ethos:'neutral'` derived deterministically from goal keywords for old saves; invariant enum; grep version-embedded test strings; U50 stgen unaffected — structure gen is pinned to STRUCTURE_SCHEMA_VERSION) | M | The same witnessed atrocity moves civic −10 and shadow +5; save-upgrade warning path exercised; hash replay green |
| SP-6 | Purity cleanup: `setNpcTrust` (`playloop.js:6569`) → emit `npcTrustDelta` through `applyDeltas` | XS | Behavior byte-identical (same clamps); grep confirms no direct `conversationState` writes outside effectsCore |

Deliberately NOT in this series: IG-13 trade/economy (own track; haggling will *consume* this state —
trust → price — via the same table discipline), newspaper expansion (IG-14 is live; SP-5 feeds it better
inputs for From-the-Roads), NPC↔NPC standing dynamics (claims graph already covers belief propagation).

---

## 4. Determinism / WORLD_VERSION analysis (SP-1)

- **No new state fields. No WORLD_VERSION bump.** `w.reputation.factions` has existed since its
  introduction (`ensureReputation` state.js:1050) and is already in BOTH hash projections
  (`worldHash.js:32`, `worldHash.browser.js:30`). SP-1 adds code, an op, and an invariant — not shape.
- **No rng.** The table is pure arithmetic; `deedFactionDeltas` consumes only `(world, deed)`. No rng
  streams consumed → zero drift in existing seeded sequences.
- **Replay-stable.** The producer runs inside `applyDeedCharges` on the player's text — replaying the
  same script re-derives identical deltas (same guarantee the existing axis/trust deltas rely on).
  Verified: same seed + same script → equal `worldHash` (U322-C, and the probe above).
- **Old saves.** `ensureWorld` already defaults `reputation` per faction (state.js:167); the new
  invariant is satisfied by construction (`ensureReputation` builds keys only from `w.factions`; the op
  refuses unknown ids). Loading a pre-SP-1 save changes nothing until a new deed occurs.
- **Invariant posture.** Violations throw (`invariants.js` layer); the op layer clamps silently
  (`effectsCore` layer) — consistent with the repo's two-layer doctrine.
- **Gates run**: full suite **9193/9193** · convergence **123/123 locked (100%)** · determinism family
  U19/21/22/27/30 green · `npm run playtest:quick` 50 runs, 0 crashes, no bug classes (includes
  DETERMINISM_BREAK + INVARIANT_VIOLATION probes).

## 5. Falsifiable predictions (mech/string-checkable, next gate)

1. **Exact institutional arithmetic**: seed `aldermere`, script = N × "I torture the prisoner here in
   front of everyone" at the start town → `w.reputation.factions.civic === −10·N` (floor −100),
   `shadow` unchanged at 0. (U322-C pins N=1; the probe pinned N=3, 6.)
2. **The stranger goes cold**: after civic ≤ −50, ANY civic-affiliated NPC — including one freshly
   decompressed at another settlement, `metPlayer:false`, trust 5 — returns `fallbackRules` mood
   `hostile`, approach `deflect`, why `"Faction hostility overrides — withholding."` (string-exact,
   `npcBrain.js:426-431`).
3. **No witnesses, no institution**: the same atrocity text at a node with no settlement NPCs leaves
   `reputation.factions` deep-equal to before (U322-A/C).
4. **Bright compounding**: N × witnessed moderate aid ("I give the starving man my last bread") →
   civic `+3·N`; the +50 warm threshold needs ≥ 17 such acts or ~9 grave ones — the light path is
   slower, by table.
5. **Determinism**: any fixed (seed, script) pair produces equal `worldHash` across repeated runs, and
   U19/21/22/27/30 stay green (no rng stream consumed by SP-1).
6. **Clean-player identity**: a script with no deed-detector hits leaves `reputation.factions` all-zero
   (fate < blood), byte-identical to pre-SP-1 worlds — SP-1 is invisible until the player acts.

*Anti-prediction (known limit, honest seam): standing does NOT yet travel to factions with no witness
present (SP-5 covers person-to-person notoriety; SP-2 covers differential ethos). If the gate shows a
judge expecting the thieves' den to celebrate a public murder, that is SP-2, not a bug in SP-1.*
