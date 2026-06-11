# Storyline Spec — pluggable arcs for a living county

**Status:** v1 spec + proving slice ("The Cold Well").
**Law:** storylines surface only diegetically — rumors, NPC wants, the world's
reaction. No quest markers, no journal entries the fiction didn't earn, no
"trust +1". (Ruling 2026-06: the player remembers exchanges; the world
evidences consequence.)

## What an arc is

An arc is a **data file** (`content/arcs/*.json`) describing a story that
binds itself to whatever world the seed generated. The arc doesn't ship NPCs
or places — it ships **roles** and **predicates**, and the engine casts the
arc from the people and settlements that already exist. The same arc plays
differently on every seed because the cast, geography, and names differ.

Everything an arc does goes through systems that already exist:

| Arc concept     | Engine system it compiles to                                |
|-----------------|-------------------------------------------------------------|
| hook (rumor)    | `world.rumors[]` entry carried by a bound NPC               |
| cast knowledge  | facts merged into the bound NPC's `knowledgeGraph`          |
| stage done-when | `engine/goals/goalContract.js` predicates (learn/reach/obtain/defeat/talkTo) |
| world-effects   | `effectsCore.applyDeltas()` ops (incl. `recordDeed`)        |
| branch morality | `recordDeed` → the seven-axis soul (M1)                     |
| abandonment     | world-clock check in the story tick                         |

Determinism: casting, rumor minting, and stage checks are all seeded off
`world.meta.seed + arc.id`. Same seed + same arcs ⇒ same story state.
`worldHash` covers `world.story`.

## File format

```json
{
  "arc": "the-cold-well",
  "version": 1,
  "scale": "village",
  "cast": [
    {
      "role": "the-witness",
      "bind": { "roles": ["miller", "laborer", "farmer"], "personality": { "honesty": ">0.5" } },
      "knows": [
        { "factId": "arc_cold_well_truth", "body": "…", "guard": "trust" }
      ]
    }
  ],
  "hooks": [
    { "rumor": "They say the well at {home} runs cold and wrong since the new moon.", "carrier": "the-witness", "tags": ["arc:the-cold-well"] }
  ],
  "stages": [
    {
      "id": "hear-it",
      "doneWhen": { "learned": "arc_cold_well_truth" },
      "worldEffects": [],
      "spawns": { "nextStage": "see-it" }
    },
    {
      "id": "see-it",
      "doneWhen": { "reached": "@castNode:the-witness" },
      "branches": {
        "default": { "deeds": [], "rumorSeed": "…" }
      }
    }
  ],
  "abandonment": { "afterDays": 12, "rumor": "…", "worldEffects": [] }
}
```

### Field reference

- **`arc`** — kebab-case id, unique across loaded arcs.
- **`scale`** — `village | county | realm`. Gates which maps the arc loads on
  (a realm arc won't cast on a 6-node hamlet).
- **`cast[]`** — roles to fill at bind time.
  - `bind.roles` — acceptable NPC `role` strings, first match wins.
  - `bind.personality` — predicate map; values are `">0.5"`-style comparisons
    against `npc.personality.*`. All must hold.
  - Casting scans settlements in deterministic node order; if no NPC
    satisfies the bind, the arc **stays dormant** (it may cast on a later
    decompression — casting re-runs until filled).
  - `knows[]` — facts planted into the bound NPC's `knowledgeGraph` so the
    existing dialogue system shares them by its own rules. `guard: "trust"`
    marks the fact non-public (shared only past the dialogue layer's trust
    gating); `guard: "public"` is tavern talk.
- **`hooks[]`** — how the player first smells the story. Each mints one
  `world.rumors` entry (sourceSeedId `arc:{arc}:{n}`) carried by a cast
  member. Template vars: `{home}` (carrier's settlement name), `{carrier}`
  (carrier's name), `{node:<role>}` (a cast member's settlement).
- **`stages[]`** — strictly ordered. Exactly one stage is `current`.
  - `doneWhen` — one of `learned: factId`, `reached: nodeRef`,
    `obtained: itemId`, `defeated: enemyRef`, `talkedTo: castRole` —
    compiled to the goal-contract predicates (the arc engine evaluates them
    directly; it does not occupy the player's 12-goal cap).
  - `nodeRef` may be `@castNode:<role>` (resolved at bind time).
  - `worldEffects[]` — deltas applied through `applyDeltas` the moment the
    stage completes.
  - `spawns` — `{ nextStage }` or, on the final stage, omitted.
  - `branches` — keyed outcomes for the final stage. The arc engine picks the
    branch by inspecting how the done-when fired (e.g. `defeated` vs a
    `sparedWhen` predicate). Each branch may carry `deeds[]`
    (→ `recordDeed`), `worldEffects[]`, and a `rumorSeed` (the county talks
    about what you did).
- **`abandonment`** — if the arc has been heard (stage ≥ 1) but not advanced
  for `afterDays` world-days, it resolves itself **without the player**:
  apply `worldEffects`, mint the `rumor`. Stories don't wait politely.

## State (`world.story`)

```js
story: {
  arcs: {
    "the-cold-well": {
      status: "dormant" | "cast" | "active" | "resolved" | "abandoned",
      castIds: { "the-witness": "npc_3@node_7" },   // role → npcId@nodeId
      stage: "hear-it",
      heardAtHours: 132,      // world clock when stage 0 completed (for abandonment)
      branch: null            // set on resolution
    }
  }
}
```

Caps: ≤8 loaded arcs, ≤3 simultaneously `active`. Invariants assert status
enum, stage exists in the arc file, castIds point at real NPCs.

## Tick points

1. **Decompression / arrival** — `castArcs(world)` tries to fill dormant
   arcs' casts from the now-materialized NPCs; on success plants `knows`
   facts and mints hook rumors.
2. **`playerMove` tail** — `tickArcs(world)` evaluates the current stage's
   `doneWhen`; on completion applies effects, advances stage or resolves a
   branch.
3. **`worldTick` (day boundary)** — abandonment check.

## The DM-test contract

The player never sees the word "arc". They hear a rumor in a tavern, notice
an NPC who wants something, follow it or don't, and the county remembers
either way. If a stage completes, the *narration* carries it ("the well runs
clean again; Petra won't say your name without a kind of wariness") — the
mechanics line may log `[arc:the-cold-well|stage:see-it→done]` for
debugging, but nothing UI-side renders arc chrome.

## Authoring checklist

1. Validate: `node scripts/validate-arcs.mjs` (schema + stage-graph checks).
2. Every `factId` referenced by a `learned` done-when must appear in some
   cast member's `knows`.
3. Abandonment is mandatory — every arc must say what happens if ignored.
4. Branches must include at least one non-violent resolution unless the
   fiction truly forbids it.
5. Playtest on ≥3 seeds — the bind predicates must cast on most worlds.
