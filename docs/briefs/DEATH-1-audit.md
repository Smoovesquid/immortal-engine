# DEATH-1 — AUDIT: current 0-HP handling in the live combat engine

*Committed BEFORE building, per THE DEATH CONTRACT's own order ("audit current 0-HP handling
FIRST"). Maps the enemy-0-HP and player-0-HP paths end-to-end in `engine/combat/escapeCombat.js`
(the ONLY live combat hook-point; the other engine, `engine/combat/combatResolve.js`, is dead code
in v1). Every seam DEATH-1 rides or extends is named. Findings drive the schema decision below.*

## The live engine
- `engine/combat/escapeCombat.js` (2649 LoC) is the live per-turn resolver: `resolveEscapeCombatTurn`
  → `resolveEscapeCombatTurnCore`. House law (MEMORY: two-combat-engines): a combat feature must hook
  THIS file or it never runs in v1.
- Enemy HP lives in `world.combat.enemies[].hp` / `.maxHp`; player HP lives in `world.meta.escapeHp`
  / `world.meta.escapeMaxHp` (NOT on the party record — a combat-scoped mirror).
- All combat-state writes go through `applyDeltas(w, [{ op: 'combatState', set: {...} }])`. Lifecycle
  (`beginCombat`/`endCombat`) is in `engine/combat/combatLifecycle.js`.

## ENEMY at 0 HP — today
1. Damage lands via `applyEnemyDamage(enemy, rawDmg, dmgType, world)` (escapeCombat.js:1269).
   It subtracts trait-adjusted damage, sets `enemy.hp`, and when `hp <= 0`:
   - runs `applyDeathTraits` (Undead Fortitude / Rejuvenation etc.) — a foe may claw back ONCE per
     fight (`enemy._traitRevived` latch). Otherwise **`enemy.defeated = true`** and it returns
     `{ dropped, defeated }`.
   - **There is no intermediate state.** A foe at 0 HP is either revived (hp≥1) or `defeated`.
     It never lingers as "downed and pleading." This is exactly the gap DEATH-1 fills.
2. Victory check (escapeCombat.js:2160): `const anyAlive = enemies.some(e => !e.defeated && e.hp>0)`.
   When none are alive → roll loot, `awardXpAndLevel`, `endCombat({reason:'enemies-defeated'})`,
   push the loot event, `beats.push('The way is clear…')`, return `outcome:'success'`.
3. **No moral event is minted on a kill.** `recordDeed` is called in `playloop.js` (typed-text
   cruelty), `magic/castConsequence.js`, `story/storyEngine.js`, `worldTick.js` — but **NEVER in the
   escapeCombat kill path.** Killing a foe in a real fight currently produces XP + loot and nothing
   else: no witness reckoning, no rumor, no heat. (DEATH-2 wires the four verbs → moral physics; this
   audit flags that the seam is bare so DEATH-2 knows it's building the whole bridge.)
4. Morale (escapeCombat.js:2220): a foe at ≤25% HP may break and flee (leaves the enemy list, player
   gets XP, a threat ledger entry "the {name} fled"). This is the existing "spare yourself the kill"
   valve — but it is FLIGHT, not a beg. The contract's DYING/beg is a distinct state.
5. Persistence: `endCombat` (combatLifecycle.js:205) writes `meta.npcCombatHp[sourceNpcId] =
   { hp, down: defeated||hp<=0 }` so a re-engaged NPC stays wounded. "down" here just means dead/at-0
   — not the new DOWNED state.

## PLAYER at 0 HP — today
1. Player HP decremented in the enemy-turn loop (escapeCombat.js:2273+). After the loop, defeat check
   at escapeCombat.js:2583:
   - **If any enemy still stands:** commit state with `round+1`, `beats.push('You fall — the foe
     still stands. You are down and dying.')`, return `outcome:'failure'`, mechanicsLine `…[combat:dying]`.
     The player is at 0 HP and — per the status line at escapeCombat.js:1082 — "cannot act; only
     healing or stabilization can pull you back." So a *narrative* dying beat exists for the player,
     but it is **not a modeled state** and there is **no death fact, no elegy, no world-canon minting**
     (grave/rumor/heat). Invariant IV (permadeath keeps the death) is unfulfilled. → DEATH-4's job.
   - **If no enemy stands (mutual kill):** `endCombat({reason:'defeated-in-combat'})`, set
     `world.ending = { locked:true, reason:'defeated-in-combat', epilogueLine:'Your strength fails.
     The dark keeps you.' }`, `beats.push('You fall.')`, `outcome:'failure'`.
2. `endCombat` clears combat; `ending.locked` is the terminal gate the shell reads. No loss ledger,
   no pale-root beat, no continuation — all DEATH-4/5.

## The ensureCombat WHITELIST TRAP (the load-bearing constraint)
`ensureCombat(c)` (state.js:657) rebuilds EVERY enemy from a fixed field list at **state.js:730**:
```
const enemy = { id, name, hp, maxHp, damage, ac, cr, damageType, resistances,
  conditionImmunities, conditions, actions, multiattack, saveProficiencies, canParley,
  defeated, sourceNpcId, lootTableRef, initMod, legendaryActions, reactions, lairActions,
  senses, tactical, traits, cx, cy };
```
Any field NOT in this literal is **silently dropped on the next `ensureWorld`** (bit DX-2d-i). Proof
this trap is live and unforgiving: `mintEnemyFromNpc` (combatLifecycle.js:88) emits `stats`, `traits`,
`level` — but `ensureCombat` only preserves `traits`; **`stats` and `level` are stripped** the moment
the world is re-normalized. So: **any DOWNED field I add to an enemy MUST be added to the state.js:730
literal (and normalized above it, and asserted in invariants.js's enemy loop at ~449) or DOWNED
evaporates between turns.** This is the single highest-risk seam in the packet.

## The `combat_one_defeated` GOLDEN (the visual contract I must not drift)
`scripts/screenTruth.goldens.mjs:132` draws each enemy dot as `CORPSE` iff `e.defeated`, else `ENEMY`.
`scripts/screenTruth.assertions.mjs:113` asserts `drawn.defeated === engine.defeated` (PROJECTION_EQUALITY).
Golden scene 7 (`screenTruth.scenes.mjs:362`) sets one enemy `defeated:true` to draw the corpse-swap.
**Therefore `defeated` IS the corpse-vs-live visual boolean.** A DOWNED (dying-but-alive, pleading)
enemy is still a LIVE combatant and must draw as ENEMY, not CORPSE. ⇒ **DOWNED must be ORTHOGONAL to
`defeated`: a new field, never `defeated:true` while dying.** Kept orthogonal, the golden is untouched
(a DOWNED foe reads `defeated:false`, drawn exactly as today). Whether DOWNED ever gets its own mini is
a future renderer packet, explicitly out of scope here.

## Capability gate for DOWNED — the `canCommunicate` question
DEATH-1 §2 gates DOWNED to "beings that can plead"; beasts/mindless die outright. The existing
`canParley` is the WRONG signal — it means "negotiation can end this fight" and is set FALSE for
explicit hostiles (mintEnemyFromNpc:66, so a hostile bandit has `canParley:false` yet can absolutely
beg). No `canCommunicate` field exists in the bestiary records (`engine/ruleset/core/bestiary/*.js`:
they carry `stats`, `actions` with `damage:'1d8+3'` dice strings, `traits`, `canParley`, `loreHook` —
no intelligence/type/speech marker). ⇒ DEATH-1 introduces `canCommunicate` as a **derived capability**
(default from the bestiary record where present, else a humanoid/name heuristic), engine-owned,
capability-gated — NOT reusing canParley.

## The DEATH FACT's environment inputs (all already available — pure reads)
- `victim`/`killer`: enemy record / the PC (party[0]).
- `means`: the killing action's weapon/spell/means — the player's `meleeProfile`/`cantripProfile`
  name, or the enemy's `actions[0]` for a player death. `damageType` on the enemy gives the wound kind.
- `woundPath`: this fight's accumulated wounds — see schema decision (must be tracked deterministically
  through the fight; the blow that opened the thigh in round 2 is allowed to finish through it).
- `locale`: `world.map.nodes.find(n => n.id === world.map.currentNodeId)` (playloop idiom).
- `light` / `weather`: `world.env.light` (0..6, envCore.js) + clock/time-of-day; weather is thin today
  (no rich weather model) — record what exists, honestly (light + time), leave a labelled gap.
- `witnesses[]`: **occupancy truth** — the established idiom is `node.settlement.npcs.map(n=>n.id)`
  (playloop.js:6445, 8842) or `occupantsOfRoom(w, structureKey, roomId)` for interiors. Reuse it.
- `victimStance`: fighting | fleeing (morale-broken) | begging (DOWNED+plea, DEATH-2) | helpless |
  defiant — computed from combat state at the moment (DEATH-1 wires fighting/fleeing/helpless honestly;
  begging/defiant get their real values once DEATH-2's beg lands).
- `killerIntent`: clean | brutal | mercy | worse — routed from the player's verb/intent
  (`parseEscapeAction` + the raw action text). DEATH-1 lands the ROUTING seam + honest default
  (`clean`); the mercy/worse/brutal verbs are DEATH-2.
- `finalWords?`: optional; populated by DEATH-2's beg (voiced by the LLM). Null here.

## SCHEMA DECISION — lazy-additive combat-scoped, NOT a WORLD_VERSION bump
**Decision: no WORLD_VERSION bump. Two moves, both combat-scoped / non-persistent-at-boot:**

1. **DOWNED lives on the enemy as combat-scoped fields** added to the `ensureCombat` whitelist
   (state.js:730), normalized + invariant-checked. Precedent: `surprised` (JR-1) is a combat-scoped
   boolean that explicitly took **no WORLD_VERSION bump** ("Combat-scoped — cleared with the fight",
   state.js:745). DOWNED fields default to the not-dying value (`downed:false`, `dyingClock:0`,
   `canCommunicate` derived) so a trait-less/absent-field enemy normalizes byte-identical to today.
   Because enemies only exist during an **active fight** and `defaultCombat()` seeds `enemies:[]`,
   these fields are **absent from the boot world** → they do NOT enter the boot `worldHash` → **U454-E's
   heavily-pinned boot anchor does NOT move.** (That anchor has been re-locked on every additive STORED
   field — MP-3's `huntedT`, OCC-STORY-1's NPC pos, etc. Adding boot-visible stored state is precisely
   what forces the bump + re-lock the brief forbids duplicating. Combat-scoped fields dodge it honestly.)

2. **The DEATH FACT is assembled pure at the killing moment and recorded as a TIMELINE EVENT**
   (`{ kind:'death-fact', data:{...} }`), NOT as a new top-level stored world field. The timeline is
   already the append-only canon record and already normalized (state.js:1205 shows timeline events
   carry a `witnesses` array today). A death-fact event rides the existing timeline shape → **no new
   `ensureWorld` field, no invariant surface change, no boot-hash movement.** The prose layer (DEATH-3/4)
   and CG death class read the fact off the timeline; DEATH-2's moral wiring reads the same event.
   This is the HONEST lazy-additive path the brief pre-authorizes ("if you find an additive no-bump
   path that is HONEST … prefer it and justify").

**Why this is honest, not a dodge:** the contract says the fact is "stored canonically." The timeline
IS the canon store (append-only, replayed, hashed in-sequence). Storing the fact as a timeline event
satisfies "stored canonically" without inventing a parallel store or perturbing the boot fingerprint.
Determinism holds because (a) the fact is pure f(world, combat log) drawn from already-committed state +
the seeded fight, drawing NO fresh rng, and (b) timeline events already participate in `worldHash` in
order, so a replayed fight appends a byte-identical event. If a later packet needs the fact indexed
outside the timeline, THAT packet can bump — DEATH-1 does not need it.

**Falsifier for the decision (U598):** boot `worldHash` is byte-identical before/after this packet
(no bump needed); full replay determinism on the fight→fact chain; the DOWNED fields survive an
`ensureCombat` round-trip (the whitelist-trap guard); no numeric appears in any player-facing string
this packet adds.

## Seam summary (what DEATH-1 builds vs what later packets hang on it)
- **DEATH-1 builds:** `canCommunicate` capability (derived, engine-owned) · the DOWNED enemy state
  (combat-scoped fields on the whitelist, entered deterministically at the 0-HP boundary for
  communicators, speechless die outright) · the DEATH FACT atom (pure, all §2 fields, on the timeline)
  · `woundPath` accumulation through the fight · killerIntent routing seam (honest `clean` default).
- **DEATH-2 hangs on it:** the beg fires FROM the DOWNED state (capability + hopelessness gates already
  present); the four verbs read `killerIntent` off the routing seam and write mercy/worse/spare/abandon
  as deeds through `recordDeed` (which the audit confirms is currently ABSENT from the combat path —
  DEATH-2 wires the whole moral bridge); `finalWords`/`victimStance:'begging'` populate then.
- **DEATH-3 hangs on it:** enemy killing-blow prose reads the DEATH FACT off the timeline (means/wound/
  stance-tailored, gore-honest, no numerics).
- **DEATH-4 hangs on it:** the player-death fact (same atom, player as victim) is the case file for the
  elegy + loss ledger + world-canon minting; the audit flags the player path currently mints NO
  grave/rumor/heat, so DEATH-4 builds that too.
