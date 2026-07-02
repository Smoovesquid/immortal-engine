# COMBAT_TRAIT_ALGEBRA — traits as composable data, not N special-cases

*Design brief (Fable lane, 2026-07-02). Target: the LIVE combat engine (`engine/combat/escapeCombat.js` — the one v1 plays; see `project_two_combat_engines`). Governing law: `docs/DND_XCOM.md` §THE LAW (narrate the read, never the number) + determinism-by-seed (`engine/rng.js` sole randomness; `worldHash` stable under replay; U19/21/22/27/30). Implementable by Codex without re-derivation.*

---

## 0. The scaling problem, in numbers (measured on this tree)

Counted across the four catalogs (`engine/ruleset/core/bestiary/catalog/{trivial,minor,standard,elite}.js`):

| metric | value |
|---|---|
| creatures | **642** (150 trivial · 221 minor · 202 standard · 69 elite) |
| distinct trait names | **1024** |
| trait instances on creatures | **2118** |
| trait names with a registered hook | **45** (`REGISTERED_TRAIT_COUNT`, `engine/combat/traitHooks.js:409`) |
| instances mechanically live | **237 (11%)** |

Under the current model — one hand-written hook function per trait *name* — covering the catalog means ~1000 registrations, and the 1000-creature vision means the trait file grows linearly in *code*. The tell that an algebra is hiding inside: the 45 registered hooks are really **~7 effect archetypes with different constants** (12+ names are `ac + k` — `traitHooks.js:133-179`; 8 names are `max(1, dmg - 1)` aura DR — `:210-239`; 5 names are on-death revive — `:242-270`; 4 are turn-start heal, 6 are to-hit add, 6 are damage-dealt add, 2 are halve-damage). N creatures should cost **O(N) data rows, O(1) code**.

## 1. The current pipeline's real shape (confirmed, cited)

The hypothesis "dispatch on trait name" is half right. It is **already a name-keyed registry, not a switch** — but the registered values are **imperative closures, not data**:

- **Registry:** `HOOKS = {}` + `register(name, hooksObj)` — `engine/combat/traitHooks.js:39-43`. Each trait name maps to an object of hook functions over six fixed points: `onTurnStart / modifyToHit / modifyDamageDealt / modifyDamageTaken / modifyAC / onDeath` (`:8-14`).
- **Composition today:** `getTraitHooks(traits)` (`:287-311`) walks the creature's `traits: string[]` **in declaration order** and collects matching hook fns per channel; each `apply*` folds them sequentially (`applyToHitTraits :336-343`, `applyDamageTakenTraits :360-367`, `applyACTraits :372-379`). Unknown names fall through as narrative-only (`:6`) — the load-bearing safety property.
- **Conflict rules already present, but unnamed:** turn-start heals are *summed then clamped to headroom* (`:316-331`); death revives are *first-wins, one fires* (`:384-397`) with the one-shot enforced by `_traitRevived` in the resolver (`escapeCombat.js:1182-1186`); everything else is a sequential fold where **order = the bestiary author's array order**.
- **Params are string-parsed** from the parenthetical (`baseName`/`parseParam`, `:26-35`): `"Regeneration (15 HP/round…)"` → 15.
- **Purity:** "Pure. No RNG. No LLM." (`:21`) — every fold is arithmetic on already-rolled values. This is the determinism backbone DX-2d-i was built on and the algebra must keep.

**Live consumption sites** (`engine/combat/escapeCombat.js`): one `applyEnemyDamage()` helper folds damage-taken DR + one-shot death revive at every enemy-damage site (`:1171-1195`); AC traits at the four player-roll-vs-AC sites folded **beside** the DX-2c cover bonus (`:1577`, `:1717`, `:1847`, `:1938` — e.g. `applyACTraits(target, …) + coverAcBonus(target?.tactical?.cover)` at `:1849`); turn-start regen at the top of the enemy loop (`:2277-2281`); enemy to-hit traits on the rolled d20 (`:2344`); enemy damage-dealt traits (`:2369`). Boss beats (legendary `:2208-2230`, lair `:2232-2251`) resolve through `bossActions.js` payloads, *outside* the trait pipeline.

**API surface that must survive any refactor** (all importers, this tree): `escapeCombat.js:53-59` (all six), `combatResolve.js:33` (four), `actionResolver.js:14` (`applyToHitTraits`, `applyDamageDealtTraits`), `spell/castSpell.js:22` (`applyDamageTakenTraits`), plus `tests/U299.escapeTraits.test.js`. Both combat engines share this one module — migrating it migrates both.

**The whitelist trap (satisfied today, trap for tomorrow):** `ensureCombat` (`engine/state.js:392-495`) rebuilds every enemy on **every** `combatState` mutation from an explicit field list. `traits` (capped 24) is whitelisted at `:451-453`; `_traitRevived` at `:466`. **Any new trait-carrying enemy field must be added there or it is silently stripped** (this bit DX-2d-i). `worldHash` hashes `combat` wholesale (`engine/worldHash.js:26`), so new enemy fields enter the hash — fine for replay-equality (no golden hashes), but "no new field" is the zero-risk default.

**Adjacent systems doing trait-shaped work outside the pipeline** (the composition seams the algebra should eventually own):

1. **Tactics (DX-2c, two-sided):** `tacticalMods.js` (cover→AC map `:19`, advantage rule `:44-46`); enemy opening positions seeded once per fight by `sourceEnemyTactical` (`escapeCombat.js:577-604`) — including the **`PERCHED` name-regex** (`:579`) that decides which foes "use ground and cover". That regex is exactly the special-casing an algebra should eat: *whether a creature fights tactically is creature data, not a name pattern.*
2. **Boss phases (P-75):** `bossPhase(e) === 2` → flat `+2` on the damage die, inline (`escapeCombat.js:2360-2361`); `applyBossPhase` (`bossActions.js:135-153`) is a phase-conditional stat rewrite. "Bloodied changes the creature" is a *conditional trait*, not its own mechanism.
3. **Typed resistances are dark in the live engine:** `applyResistance` (`damageTypes.js:45`) runs only in `actionResolver.js:71,141` (the dark engine). `applyEnemyDamage` in the live engine never consults `enemy.resistances`, though 642 creatures carry them. A fire elemental takes full fire damage in v1 today.
4. **Legendary Resistance is dark:** 45 instances in the catalog; `traitHooks.js:205-206` claims it's "absorbed by the legendaryActions system" — no code implements it. Enemy-save sites (hold person `escapeCombat.js:2303`, entangle `:2345-2353`, grapple) never consult it.

## 2. The trait algebra

### 2.1 The atom — the algebra's terminal object

A trait's mechanical meaning becomes a list of **effect atoms**: pure data, no closures.

```js
// One atom = one typed modification at one resolution point.
{
  ch:    'ac' | 'toHit' | 'dmgDealt' | 'dmgTaken' | 'turnStart' | 'death'
         | 'save' | 'rollMode' | 'tactic' | 'emit',   // WHERE (fixed enum = resolver call sites)
  op:    'add' | 'mul' | 'hp' | 'reviveAt'            // HOW it combines (fixed vocabulary)
         | 'autoSucceed' | 'adv' | 'dis' | 'profile' | 'event',
  v:     number | { kind:'flat'|'frac', … } | string, // the payload
  min?:  number,          // per-atom clamp after applying (Evasion's max(1,·))
  when?: { … },           // declarative predicate — data, not code (§2.3)
  uses?: number,          // per-fight budget (generalizes _traitRevived)
  param?: { rx: RegExp },  // parse `v` override from the trait string's parenthetical
  read?: 'template'       // fiction line for the DM — prose, no number leak (THE LAW)
}
```

A **trait definition** is `name → atom[]`. The registry becomes a table:

```js
const TRAITS = {
  'Regeneration':     [A('turnStart','hp',10, { param:{rx:/(\d+)\s*HP/i}, read:'{name} regenerates {v} HP' })],
  'Pack Tactics':     [A('toHit','add',2,     { when:{ allyStanding:true } })],
  'Natural Armor':    [A('ac','add',1)],
  'Evasion':          [A('dmgTaken','mul',0.5,{ min:1 })],
  'Uncanny Dodge':    [A('dmgTaken','add',-2, { min:1 })],
  'Undead Fortitude': [A('death','reviveAt',{kind:'flat',hp:1}, { read:'{name} refuses to die (Undead Fortitude)' })],
  // … a NEW creature trait = ONE data row. Zero resolver edits. Zero new functions.
};
```

Unknown names still fall through to narrative-only — the 1024-name long tail stays safe by default, and coverage grows row by row, not function by function.

### 2.2 Composition — the deterministic fold

Per channel, per resolution moment:

1. **Collect** atoms from the creature's traits (later: conditions and tactical state emit atoms into the same collection — §2.6), tagging each with `(sourceRank, declIndex)` — `declIndex` = position in the creature's `traits` array; `sourceRank` orders cross-system sources (`condition:0 < tactical:1 < trait:2`, matching today's inline sequencing at e.g. `escapeCombat.js:2339-2344`, where the restrained penalty and reckless bonus land before trait to-hit mods).
2. **Filter** by `when` predicates (one shared evaluator, §2.3).
3. **Sort** by the fixed key **`(opRank, sourceRank, declIndex)`** with `opRank: mul(0) < add(1)`. Sorting makes composition **order-independent for the author**: two creatures whose trait arrays differ only in order produce identical numbers. Adds commute within their rank; muls commute within theirs; the only ordering that matters (mul vs add) is pinned by the rule, not by array position.
   *Why `mul` before `add`:* it reads right at the table ("the dodge halves the blow; the armor shaves what's left") **and** it reproduces the current declaration-order behavior of the only creature in the catalog that mixes ranks in one channel (`wind_dancer`: `['Evasion','Uncanny Dodge']` — measured; no other creature is order-sensitive). The canonical order is therefore free today and locked before the catalog grows.
4. **Fold** left over the sorted atoms; apply each atom's `min` clamp as it lands (byte-compatible with today's per-hook clamps); apply channel-level clamps last (turn-start headroom `traitHooks.js:326-329`; final `max(0,·)` `:354,366`).

**Named conflict-resolution rules** (all already latent in the code; the algebra names them and pins them):

| rule | applies to | semantics |
|---|---|---|
| **SUM** | `add` atoms in a channel | additive bonuses stack (today's fold) |
| **SEQUENCE** | `mul` then `add` (opRank) | pinned canonical order; author order irrelevant |
| **FIRST-WINS** | `death.reviveAt` | first (by sort key) revive fires, others don't (`traitHooks.js:384-397`), one-shot per fight via `_traitRevived` |
| **CANCEL** | `rollMode` (`adv` vs `dis`) | any advantage + any disadvantage = straight roll (5e rule) — §2.6 |
| **BUDGET** | `uses` atoms (`save.autoSucceed`) | per-fight counter in `_traitUses`; exhausted atoms are inert — §2.5 |
| **CLAMP** | channel closers | headroom / floor rules run after the fold, never inside atoms |

### 2.3 Predicates — conditions as data

`when` is evaluated by **one** shared evaluator against a read-only context `{ enemy, world, dmgType, round, … }`. Initial vocabulary (each verifiable in isolation):

- `{ allyStanding: true }` — another enemy with `hp > 0` exists (Pack/Flock Tactics' current check, `traitHooks.js:76-78`, reading the live-enemies view the resolver already builds at `escapeCombat.js:2177`).
- `{ dmgType: ['fire', …] }` — matches the damage channel's type (unlocks typed resistance/vulnerability as atoms; closes §1 seam 3).
- `{ hpBelow: 0.5 }` — bloodied/phase conditions (absorbs `bossPhase`, §1 seam 2).
- `{ atLair: true }` — the lair test the resolver already computes (`escapeCombat.js:2233-2236`).
- Extension is **adding a key to the evaluator**, not a new mechanism. Predicates never roll and never mutate.

### 2.4 Cascade — effects that cause effects

The missing third verb. Atoms may **`emit` events** (`{ ch:'emit', op:'event', v:{ kind:'burst', dmg:'2d6', type:'fire', target:'adjacent-enemies'|'player' } }`); the resolver drains a **FIFO event queue** after the triggering moment:

- Each event re-enters the **same channels** (a death-burst hitting another enemy runs *that* enemy's `dmgTaken` atoms → possibly its `death` atoms → possibly its own `emit` — the chain reaction falls out of composition, no bespoke code).
- **Termination guaranteed:** queue cap (16) + per-enemy once-flags + a fight has finitely many enemies that each die at most twice (revive is one-shot).
- **Determinism:** drain order is FIFO by (emit moment, source declIndex); **atoms never roll — the resolver rolls** every dice expression from the turn's single rng stream at drain time. A fight with no emitting traits enqueues nothing and draws nothing extra (the DX-2d-i byte-identity discipline, `escapeCombat.js:1162-1163`, extended).

This unlocks the 15 `Death Burst` instances, Acid Blood as actual counter-damage (today approximated as DR, `traitHooks.js:208-231`), and the mind-bending outer reaches (a creature whose death *heals* its pack; a swarm that splits) — all as data rows.

### 2.5 The legendary / lair / boss tier — same algebra, no new machinery

- **Legendary Resistance (45 instances, dark today):** `[A('save','autoSucceed',null,{ uses:3, read:'{name} shrugs off what should have bound it' })]` — consumed at the existing enemy-save sites (`escapeCombat.js:2303`, `:2345-2353`, grapple). Needs the per-fight budget field `_traitUses` (small `{traitName: usesLeft}` object) **added to the `ensureCombat` whitelist** exactly as `_traitRevived` was (`state.js:466`) — this is the one whitelist change in the whole plan, called out for DX-2d-ii. No `WORLD_VERSION` bump (combat-transient state; DX-2d-i precedent).
- **Boss phases:** phase = a `when: { hpBelow: q }` on ordinary atoms. P-75's inline fury (`escapeCombat.js:2360-2361`) becomes `[A('dmgDealt','add',2,{ when:{ hpBelow:0.5 } })]` on boss defs; authored `phases[0].at` thresholds (`bossActions.js:106-110`) feed the predicate. `applyBossPhase`'s action-swap stays action-side.
- **Legendary/lair actions stay ACTIONS** (`bossActions.js` payload resolution, `escapeCombat.js:2208-2251`): **actions are verbs, traits are adverbs.** The algebra modifies resolution; it does not schedule turns. A lair action's *payload* may carry atoms (e.g. apply a condition), but the budget/economy machinery is already correct and untouched.

### 2.6 The two-sided tactical read — tactics join the algebra

DX-2c made tactics two-sided; the algebra makes them *composable* instead of bolted on:

- **Cover** → `{ ch:'ac', op:'add', v: coverAcBonus(level) }` emitted by the tactical source — the fold at the four roll-vs-AC sites replaces the inline `+ coverAcBonus(…)` (`escapeCombat.js:1849`, `:1939`) with one more atom in the same sorted fold. `tacticalMods.js` remains the single number-map (THE LAW's "engine owns the number", `tacticalMods.js:9-12`); it just emits atoms now.
- **High ground / flanked** → `{ ch:'rollMode', op:'adv' }` atoms with the **CANCEL** rule; the resolver keeps `rollD20Adv`'s discipline — the second die is drawn **only** when the net mode is active (`escapeCombat.js:871-876`), so non-tactical fights keep byte-identical streams. Restrained/grappled suppression of enemy advantage (`:2336-2337`) becomes a `dis`-emitting condition atom cancelling the `adv` — the current boolean logic, expressed as composition.
- **Which creatures fight tactically becomes data:** a `{ ch:'tactic', op:'profile', v:'perch'|'skirmish'|'brute'… }` atom on the creature (e.g. Goblin Archer carries `profile:'perch'`) consumed by `sourceEnemyTactical`; the `PERCHED` name-regex (`:579`) demotes to fallback for profile-less creatures. Enemy tactical *choice* stays seeded from the separate tactical rng (`:578`) — stream-isolation preserved.
- Player-side tactical state (`playerTactical`, DX-2b verbs `:790-800`) emits atoms into the *enemy's* to-hit fold the same way — **both sides of the contest run the same algebra**, which is the XCOM brain made structural.

### 2.7 What stays out (scope fences)

- **No new enemy fields in TA-1** — traits stay `string[]` (already whitelisted); atoms are **compiled at read time** (pure function of the trait string + registry; memoizable by joined-string key). World shape, saves, `worldHash` inputs: untouched.
- **Player-side feats stay inline** (`DND_XCOM.md:82` keeps them out of DX-2d); the algebra is enemy-side until a deliberate later decision.
- **No single-resolver merge** (listed as a DX-2d follow-on, `DND_XCOM.md:79`) — but because both engines consume the same module, every packet lands in both automatically. The algebra IS the convergence path that doesn't require the risky merge.
- **DM/dialogue prompt wording untouched.** `read` templates are engine-side fiction fed to the composer like today's beats; no label/number reaches the player (THE LAW; hide-the-math guard).

## 3. Packetized plan

### TA-1 — the foundation: data registry + fold, **zero behavior change** *(the packet this lane may implement)*

- **Change:** `engine/combat/traitHooks.js` internals only. The 45 hand-written closures (`:48-270`) become ~45 **data rows** over ~7 ops; a tiny compiler (`atomsToHooks`) generates the exact legacy hook shapes at module init, so `getTraitHooks` and all six `apply*` functions keep **identical signatures and identical outputs**. Zero edits in any importer (`escapeCombat.js`, `combatResolve.js`, `actionResolver.js`, `castSpell.js`). Zero state/whitelist/`WORLD_VERSION` changes.
- **Oracle:** the pre-migration `traitHooks.js` is copied verbatim to `tests/fixtures/traitHooksLegacy.fixture.js` (it is dependency-free) and a new `tests/U322.traitAlgebraEquivalence.test.js` diffs legacy vs new across: **every creature in all four catalogs** (642 trait sets) × all six apply functions × a value grid (AC 8–20, to-hit 5–25, damage 0–60, three damage types, ally-present/absent worlds, hp at 1/mid/max for clamp paths) + synthetic sets (each registered name singly, param-carrying strings, duplicate names, the `wind_dancer` mixed-op combo, unknown names). Full return objects compared — including `summaryParts` strings.
- **Done-when:** equivalence test exhaustive-pass · `U299` all 8 green **unmodified** · `node --test` green · `npm run convergence` green · `npm run playtest:quick` clean.

### TA-2 — coverage: the archetype dictionary (data rows only)

- Express the mechanical long tail in existing channels+ops, top instances first: `Relentless` (16 — death-channel drop-to-1, needs `{dmgBelow}` predicate), `Construct/Undead Resilience` (16+15 — `dmgTaken` DR), `Charge` (11 — `{firstRound}` to-hit/dmg), `Sunlight Sensitivity` (18 — `dis` when `{daylight}`), aura families. **Plus the flagged behavior-change sub-packet: wire `enemy.resistances` into `applyEnemyDamage` as `when:{dmgType}` mul-atoms** — closes the dark-resistance seam (§1.3); its own test + its own commit since it changes live fight outcomes on purpose.
- Genuinely narrative traits (Keen Smell, Amphibious, Spider Climb…) **stay narrative-only by design**; the honest metric is mechanical-intent coverage, not 1024/1024.
- **Done-when:** each new row has a table-driven test; hookless-foe byte-identity (`U299-07`) still holds; measured instance coverage stated in the commit.

### TA-3 — DX-2d-ii: the boss tier in the algebra

- Legendary Resistance atoms at the three enemy-save sites; `_traitUses` added to `ensureCombat` (mirror `state.js:466` — **the one whitelist edit**); boss-phase fury re-expressed as `when:{hpBelow}` atoms (P-75 output byte-identical, proven by the same oracle style); authored phase thresholds feed the predicate.
- **Done-when:** a hold-person on a Legendary-Resistance boss visibly burns a use as fiction; U-tests for budget persistence across `combatState` mutations (the DX-2d-i regression class); determinism suite green.

### TA-4 — tactics as atoms (two-sided by construction)

- Cover/flank/high-ground/restrained emit atoms; `rollMode` channel with CANCEL; `tactic.profile` rows on ranged/perch creatures; `PERCHED` regex demoted to fallback. Second-die discipline preserved (draw only on net advantage).
- **Done-when:** non-tactical fights byte-identical (stream test); a profile-carrying creature takes cover without matching the regex; DX-2c tests green.

### TA-5 — cascade: the event queue

- FIFO drain + cap + once-flags; `Death Burst` (15 instances) as the proving trait; enemy→player and enemy→enemy events through the same channels.
- **Done-when:** burst chain (kill A → burst kills B → B's burst) resolves deterministically under replay; no-emit fights draw zero extra rng.

**Recommended order: TA-1 → TA-3 → TA-2 → TA-4 → TA-5** (TA-3 second because DX-2d-ii is already queued, `DND_XCOM.md:82`).

## 4. Determinism analysis

- **No randomness enters the registry** — atoms are data; predicates read, never roll; the resolver rolls all dice from the turn's stream (TA-5) exactly where it does today. The `traitHooks.js:21` purity contract is preserved verbatim in TA-1 and by construction thereafter.
- **Composition order is a fixed sort key** `(opRank, sourceRank, declIndex)` — a pure function of creature data and the pinned rank tables. No object-key iteration order, no Map insertion order, no locale sorts. Same seed + same inputs → same fold → same numbers.
- **Seed-stability:** TA-1/2/3 add or remove **zero rng draws** (all folds are arithmetic on already-rolled values — the DX-2d-i invariant, `escapeCombat.js:2342-2343`). TA-4 follows `rollD20Adv`'s conditional-draw discipline (`:871-876`). TA-5 adds draws only when events exist, in FIFO order — replay-stable.
- **`worldHash`:** TA-1 changes no state shape and no values → hashes byte-identical, U19/21/22/27/30 untouched. TA-3's `_traitUses` is a new normalized combat field (hash includes `combat`, `worldHash.js:26`): replay-equality holds because the field is a deterministic function of the fight; no golden hashes exist (DX-2d-i precedent).
- **The whitelist:** every packet's field-plan is explicit — TA-1 none; TA-3 `_traitUses`; TA-4 reuses the existing `tactical` block (`state.js:445`); TA-5 none (queue is turn-local, never persisted).

## 5. Falsifiable predictions / regression guarantees

1. **Byte-identity (TA-1):** for every catalog creature and every grid point, legacy vs new outputs are deep-equal — enforced by `U322` forever after (the fixture is frozen). Any future atom edit that changes a legacy trait's number fails loudly.
2. **`U299` (all 8) passes unmodified** — including U299-07 (hookless foe byte-identical) and U299-08 (trait-fight replay hash).
3. **Determinism suite** (U19/21/22/27/30) and `npm run convergence` green with no test edits.
4. **O(data) claim is demonstrated, not asserted:** TA-2's first commit adds ≥3 new mechanical traits with **zero** resolver edits and **zero** new functions — only rows + tests. If a new trait *requires* a resolver edit, the algebra's channel enum was wrong; that's the falsifier to watch.
5. **Order-independence:** permuting any creature's `traits` array produces identical fold results from TA-4 on (property test); today only `wind_dancer` could be affected and the pinned `mul<add` rank keeps it byte-identical — measured, not assumed.
6. **The boss tier fits without new machinery:** TA-3 introduces no new composition rules beyond BUDGET — if it needs one, the algebra failed its own test.

---
*Measured facts in §0/§1 were produced by direct counts against this tree (642/1024/2118/45/237; the 6 same-channel multi-trait creatures; `wind_dancer` as the only mixed-op case). Re-run trivially: iterate the four catalogs, split names before `(`, compare against `hasTraitHook`.*
