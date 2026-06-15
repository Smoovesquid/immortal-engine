# PACKETS — active queue + history

A packet is the unit of safe work: small enough that one agent understands every
touched file and a reviewer can read the diff. Spec the done-when and allowed-files
BEFORE editing, so divergence is caught at plan time, not screenshot time.

Schema: `id · objective · allowed_files · forbidden · invariants · test_plan ·
done_when · rollback`.

---

## ACTIVE

### P-81 — One continuous zoom + organic layout + legible biome tiles
**Status:** spec'd 2026-06-14 (Tim's render notes). The map is the "one map to rule
them all" — a single continuous surface you zoom *through* (overworld → region →
village → building), not discrete views swapped behind a button. Memory:
`project_one_map_continuous_zoom`. Aligns with `project_map_beauty_dream` and
`project_dm_only_verb` (map = read-only aid).
**Why:** Three live defects break the illusion: (1) layout is grid-linear — roads and
buildings snap to a lattice instead of scattering organically with terrain; (2) a zoom
BUTTON exists — the wrong model; zoom must be fluid semantic zoom (scroll/pinch), no UI
chrome; (3) terrain tiles are unreadable — **forests render like mountains** at low zoom,
and an unidentified **"circles with giant worms"** tile fails to communicate its biome.

**Objective:** One continuous, chrome-free zoomable map with organic village/road layout
and biome tiles legible at a glance (a forest never reads as a mountain range).

**Root causes (located — investigation 2026-06-14):**
- Zoom button: `public/map/oneMap.js:926–950` (M7-S1 +/−/fit). Wheel-zoom (`oneMap.js:894`)
  + drag-pan already ARE the continuous path → the buttons were redundant. (Already removed
  in an uncommitted edit; verify + keep.)
- Linear layout: `public/map/placeFromNode.js:79–99` (M7-S3) lays buildings in fixed rows
  (`colGap=3.2,rowGap=8.5,perRow=√count`) along a straight E-W road (`pathY`). Replace the
  row-cursor grid with seeded cluster+jitter (`rng.js`) and curve the road. NB: village NODE
  positions come from engine canon `node.x/node.y` (`worldSpace.js:27`) — world-map scatter
  is a separate engine-side, determinism-sensitive concern.
- Trees≈mountains: `oneMap.js:58 drawConifer` and `:78 drawPeak` both draw a filled
  triangle; at low zoom they're indistinguishable. Give contrasting silhouette/palette
  (rounded tree-clump vs. ridged grey peak) that survives small `sz`.
- The "worm-circle" tile = **marsh/swamp** (`oneMap.js:258–267`): a `marshWater` ellipse
  (the circle) with reeds as wavy quadratic strokes radiating from it (`:266`) → reads as
  worms. Redraw (horizontal water hatching + short vertical reed ticks, not radiating curves).
- Legacy "scale tabs" still exist (`v1.js:134, :2191`; `LocalMap.js` fallback at
  `v1.js:2040, 2106`). Truly "one map" means retiring those.

**Sub-packets (do in order; each ships green + a live screenshot):**
- **P-81a — Kill the zoom button; fluid semantic zoom.** Remove the discrete zoom-view
  toggle; drive level-of-detail from a continuous scroll/pinch zoom factor. No button.
  - allowed: `public/v1.js`, `public/map/*` (renderer + input), no engine state change.
  - done_when: scroll/pinch zooms smoothly overworld→building with no view-swap button;
    suite green; `worldHash` unchanged (render-only).
- **P-81b — Organic placement.** Villages scatter (clustered, irregular, terrain-aware);
  roads curve between nodes instead of gridlines. OPEN DECISION (see below): derive the
  scatter DETERMINISTICALLY from existing node coords (seeded jitter via `rng.js`) so
  `worldHash`/replay holds — vs. a pure render-time scatter. Default: deterministic.
  - allowed: `public/map/*` (+ a deterministic layout helper); engine only if the scatter
    must persist (prefer NOT — keep it derived).
  - done_when: a village reads as an irregular cluster, not a lattice; roads curve;
    determinism preserved.
- **P-81c — Legible biome tiles.** Distinct silhouettes/palette so forest≠mountain at low
  zoom. IDENTIFY the "worm-circle" tile (suspect swamp/marsh — its sprite doesn't match
  its meaning) and redraw it. Audit every biome sprite for glance-legibility.
  - allowed: `public/map/*` (tile art/sprites), the biome→sprite mapping.
  - done_when: forest/mountain visually unambiguous zoomed out; the worm-circle biome is
    identified + redrawn to read correctly; live screenshots per biome.
- invariants: render-only where possible; any generated layout is deterministic via
  `rng.js`; map stays a read-only aid (no new verbs); `worldHash` stable.


### P-80 — The world testifies: consequence for gratuitous magic
**Status:** spec'd 2026-06-14. Design canon: `docs/MORALITY_SYSTEM.md` ("the world's
recoil, the attention of chaotic gods"; karma as real physics; One God's ward over
children). Memory: `project_gratuitous_magic_consequence`.
**Why:** Cantrips are at-will by design (correct 5e), but out-of-combat blasting of
trees/villagers hits the generic prose adjudicator (`playloop.js` ~4518) with ZERO
consequence — no social, environmental, or divine recoil. The world must testify.

**Objective:** An offensive working aimed out-of-combat at the innocent or the living
world draws a consequence sized to the deed — rendered as the world's recoil (full-craft
prose, no readout, no power-high; McCarthy law), never a mechanical prompt.

**The ladder (default = a SIGN; escalation = intervention):**
1. **Petty** (a tree, a one-off) → scorch-scar on the node + small ecology corruption
   tick; an omen. The gods felt, not staged.
2. **Repeated harm to innocents** → the good gods (Virtue covenant) send enemies —
   escalating avengers (`spawnEncounter`).
3. **Dedicate the death of an innocent** (deliberate, not collateral) → engage the chaos
   gods: a deal with the devil — they may aid you, at a price. Reuses the existing
   dark-gift path (`engine/magic/forbiddenGates.js`): a dedicated innocent-kill spikes
   corruption → a forbidden gift arrives unbidden.
4. **A child** → hard absolute exclusion (One God's ward). Never resolves; already law.

**Sub-packets (do in order, each ships suite-green + a live playtest report):**
- **P-80a — Spine: detect + classify.** In the out-of-combat cast path, detect an
  *offensive* working and classify its target: `person-innocent` / `living-world` /
  `void`. New module `engine/magic/castConsequence.js` (pure; classify + route).
  - allowed: `engine/magic/castConsequence.js` (new), `engine/playloop.js` (route before
    the generic `cast:` adjudicator), one test `tests/U141.castConsequence.test.js`.
  - done_when: classification unit-tested deterministically; route returns the existing
    flavor unchanged for non-offensive/void casts (no behavior regression); suite green.
- **P-80b — Social + environmental tiers.** `person-innocent` → witness alarm + NPC
  trust/faction recoil (`npcTrustDelta`). `living-world` → `scarifyNode` + ecology tick.
  - allowed: `engine/magic/castConsequence.js`, `engine/playloop.js` (surfacing only).
  - done_when: blasting a villager drops trust + a witnessed-recoil line; blasting trees
    scars the node; `worldHash` stable under replay; suite + playtest:quick green.
- **P-80c — Divine tiers.** Repeat harm → good-god avengers via `spawnEncounter`.
  Dedicated innocent-kill → corruption spike → existing dark-gift (the chaos pact).
  Child target → reaffirm the absolute exclusion. Omen prose throughout (no smiting).
  - allowed: `engine/magic/castConsequence.js`, `engine/playloop.js`, possibly
    `engine/magic/forbiddenGates.js` (only if a new dedicated-kill threshold is needed).
  - done_when: a live playtest shows the three escalations firing; determinism preserved.
- invariants: `rng.js` only; mutations via `applyDeltas`; narration≠canon; the McCarthy
  law (no readout, no power-high, full prose); child exclusion is absolute.
- rollback: new module + named hook lines in `playloop.js`; revert the named files.

### P-66 — Unify movement inputs + interactions on the walkable place
**Status:** P-66a ✅ done · P-66b ✅ done · P-66c ⏸ deferred (deliberate version-bump pass).
Suite 6,934 green; live-verified (compass/text/click all move one token; clicking
Corwin opened the existing dialogue). P-66c deferred ON PURPOSE: persisting position
in the world + retiring `scene.interior` touches WORLD_VERSION + `ensureWorld` + the
determinism suite — high-risk/low-visible, so it gets its own careful pass (inv #8,
#11) rather than being rushed. Position currently persists in `ui.place` across
re-renders but resets on reload/resume; that's acceptable until P-66c.
**Why:** The local map is now one continuous walkable place (click-to-walk, wall/door
collision, fog — `placeNav.js`, `NAV1`, live-verified). But two gaps remain before it's
the *whole* loop: text/compass still drive the engine's legacy node/interior movement
(two movement systems), and walking past an NPC/building does nothing (no interactions).

**Objective:** Make text + compass + click all move the SAME token, and make reaching
an NPC or building interactable — so the unified scale is the only way you move and act.

**Sub-packets (do in order, each ships green + verified):**
- **P-66a — Compass/text nudge the token.** The N/W/E/S buttons and "go north"/"walk
  …" text move the walkable token (via `walkTo`), not the engine's node/interior
  compass, while standing in a place. Inter-village travel stays explicit (region Map
  tab / walking to the place edge — define which).
  - allowed: `public/v1.js`, `public/map/placeNav.js` (+ a small intent shim if needed)
  - done_when: typing "go north" and clicking both move the same `@`; suite green; no `worldHash` change (movement is client position).
- **P-66b — Interact by reaching.** Walking adjacent to an NPC token offers talk
  (routes to engine `playerMove("talk to X")`); reaching an enemy starts combat;
  reaching loot picks up. Click-on-token also works (parity with text).
  - allowed: `public/v1.js`, `public/map/handDrawnPlace.js` (hitboxes), `public/map/placeFromNode.js`
  - done_when: reaching/clicking an NPC opens the existing dialogue; an enemy starts the existing combat; suite green.
- **P-66c — Persist position + retire the interior "mode".** Player position saved with
  the world; `scene.interior` no longer drives a separate local view (the start is just
  the token in the cottage bedroom on the one place).
  - allowed: `engine/state.js` (persist pos field + normalizer), `engine/playloop.js` (begin), `public/v1.js`
  - invariants: new persisted field MUST be added to `ensureWorld` (inv #8); WORLD_VERSION bump if shape changes (inv #11); replay stays stable.
  - done_when: save/resume keeps your position; determinism suite green; `playtest:quick` clean.

**Global invariants for P-66:** §13 one walkable scale, §6 narration≠canon, §1–2
determinism. Movement is client position; anything that changes canon (talk, fight,
travel, time) still routes through `playerMove`/`applyDeltas`.

**Forbidden:** rewriting the engine's combat/dialogue; broad refactor; `Math.random`;
breaking the determinism suite; touching the prototype (`__preview/`).

**Rollback:** each sub-packet is a small diff in `public/` (P-66a/b) or one guarded
engine field (P-66c) — revert the named files.

---

---

## QUEUE — Economy, Items & Salvage/Build track (specced 2026-06-11)

Source discussions: items/loot/crafting audit + `docs/SALVAGE_AND_BUILD.md`.
Order matters: gold must mean something before the catalog grows; salvage must
yield materials before crafting; crafting before construction.

### P-67 — The spend loop (shops buy/sell) ✅ DONE 2026-06-11
**Shipped:** `engine/economy/shop.js` (deterministic weekly stock by shop type +
economy-modulated prices + purse math with change), `tryTrade` in playloop
(buy/sell/browse/haggle in prose), `setPurse` op, background pocket money at
chargen, inventory panel shows catalog names. Trades are timeline canon and
deplete shelves until the weekly restock. U119 ×11, UX2 +4 rows, suite 7,433
green, playtest:quick clean, live-verified (browse listed two shops; haggled
a potion to 42g5s with the Persuasion line shown; purse chips updated).
**Why:** loot is only satisfying when gold means something. Every piece exists
(settlement `shops` data, `basePrice` on item defs, purse + `addCurrency` op) —
nothing connects them.
**Objective:** "I buy a healing potion" / "I sell the shortsword" resolve in
prose at any settlement with a fitting shop. Haggling = social adjudication
(existing Stage B), not a menu. Stock is deterministic per shop + seed + restock
clock. Prices: basePrice modulated by settlement economy.
- allowed: `engine/playloop.js` (trade intent), `engine/economy/` (new, small),
  `engine/effectsCore.js` (only if a `trade` op is cleaner than addItem+addCurrency pairs)
- done_when: live: buy with coin counted out, sell at a fair discount, refused
  when the shop wouldn't want it; UX2 routing rows for trade utterances;
  suite + playtest:quick green.

### P-68 — Usable consumables ✅ DONE 2026-06-11
**Shipped:** out of combat, `tryUseConsumable` in playloop ("I drink the healing
potion" → removeItemById + effect; full-HP keeps the cork in; honest answer
when you have none; named bottle picked from a mixed pack). In combat, a
`potion` verb in the escape resolver (checked before 'cure' so "drink a healing
potion" reaches the bottle, not the spell list) — heals capped, costs the
action, enemies still swing. Antidote cure branch wired but dormant until
party `conditions` persist (noted in U120-05; P-69's natural cargo). U120 ×6,
UX2 +2 CONSUME rows, suite 7,439 green, playtest:quick clean, live-verified
(bought at 4/11 HP, drank to 8/11, purse and pack updated on screen).
**Why:** potions drop from loot but can't be drunk. Table-stakes D&D.
**Objective:** "I drink the healing potion" (in and out of combat) consumes the
item via `removeItemById` and applies `effect` (heal 2d4+2, cure poisoned).
In combat it costs the action (RAW). Works for any `kind: 'consumable'` def.
- allowed: `engine/playloop.js`, `engine/combat/escapeCombat.js`, `engine/gear/`
- done_when: potion heals mid-fight on the live surface; trying to drink a
  potion you don't have gets the DM's honest answer; suite green.

### P-69 — Catalog growth + one item system ✅ DONE 2026-06-11
**Shipped (WORLD_VERSION 25→26):** catalog 17 → 72 defs (full SRD simple+martial
weapons, complete armor list + shield, healing-potion ladder, 18-item magic
ladder across uncommon/rare/very-rare); CR loot bands rewired to the rarity
curve (magic ~1% at CR 1, very-rares only CR 11+, ~17% of CR 20 fights);
chargen mints typed item instances auto-equipped (AC/attack identical to the
sheet at creation); meleeProfile/playerAc read EQUIPPED TYPED GEAR first
(sheet strings remain fallback) so looted magic actually changes the swing;
"I equip the X" intent moves pack→hand with the DM stating the new numbers;
v26 adds party `conditions` (antidote cure branch now live, U120-05 restored);
optional `qty` on item instances (P-70 materials ready). U121 ×9; suite 7,448
green; playtest:full clean; live-verified (Sword of Morning equipped by name,
attack line + MAIN HAND panel updated).
**Why:** ~17 item defs total, two magic items, and loot lands in the typed
system while combat reads the 5e sheet strings — a looted longsword doesn't
become your wielded longsword.
**Objective:** (a) unify: 5e sheet equipment becomes typed item instances at
chargen; `meleeProfile`/AC read equipped typed items; (b) grow the catalog the
bestiary way — full SRD mundane weapons/armor/gear + a magic-item ladder with
rarity tiers wired into the CR loot bands.
- allowed: `engine/ruleset/core/items/*`, `engine/ruleset/core/loot/*`,
  `engine/chargen/srd/sheet.js`, `engine/combat/escapeCombat.js`, `engine/gear/*`
- invariants: WORLD_VERSION bump likely (inventory migration) — full checklist;
  determinism suite must stay green.
- done_when: a looted +1 sword, equipped by saying so, changes the attack line;
  loot across 100 seeded fights shows the rarity curve; suite + playtest:full green.

### P-70 — Salvage slice (destroy → materials → improvise) ✅ DONE 2026-06-11
**Shipped:** `materials.js` (11 typed materials, stackable; board/stone/shard
carry RAW improvised profiles), tag-driven `salvageYield` (works on every
piece of furniture ever generated — no migration; untagged junk still yields,
destruction is never a dead end), `trySalvage` playloop gate ("smash the
crate" → removeFurniture + merged stacks + salvage timeline event; naming a
part still routes to physics extraction), addItem qty-merge, improvised
weapons in meleeProfile (die, STR, NO proficiency), materials sell for
coppers (price floor dropped to 1cp). U122 ×7; suite 7,455 green;
playtest:full clean; live-verified (iron-bound chest → board + 2 iron
fittings → "I wield the board" → d4+1, +1 to strike, MAIN HAND Board).
**Why:** first rung of `docs/SALVAGE_AND_BUILD.md`; destruction currently
yields nothing.
**Objective:** destroying furniture/objects yields deterministic `kind:
'material'` items (board, stone, hide, cordage…; stackable qty). A board is
wieldable: improvised weapon, 1d4. Object toughness per DMG (AC by material,
HP by size) feeds the existing physics adjudication.
- allowed: `engine/ruleset/core/items/materials.js` (new),
  `engine/decompression/furniture.js` (yield tags), `engine/playloop.js`,
  `engine/effectsCore.js` (salvage op if needed)
- done_when: live: smash a barrel → boards in inventory → club a bandit with
  one at 1d4; suite green; G/UX rows lock the loop.

### P-71 — Field crafting ✅ DONE 2026-06-11
**Shipped:** `engine/craft/craft.js` (recipe validation, prose matching,
quality resolution) + `content/recipes/field_recipes.recipe.js` (torch,
sharpened stake, splint, cordage — data files like arcs). One check gates
QUALITY never possibility (poor work still produces, prose says so; DC+5 =
fine = bonus output); carrying the named tool is +2; time always passes via
the time op; inputs consumed through the new `consumeItems` stack-decrement
op. Missing materials get an itemized honest answer, no menu, no time cost.
Splints bind on (applied prose), stakes wield at d6. U123 ×8; UX2 +2 CRAFT
rows; suite 7,463 green; playtest:full clean; live-verified (2 torches,
poor quality, "Survival 5 vs DC 8; 1 hour gone").
**Why:** second rung; materials need somewhere to go.
**Objective:** recipe layer (data files, like arcs): materials + skill-or-tool
check + time → small goods (torch, splint, barricade, raft). Tool proficiencies
from the 5e sheet gate quality, not possibility. One DM clarify max ("with
what?"); never a menu.
- allowed: `engine/craft/` (new), `content/recipes/` (new), `engine/playloop.js`
- done_when: live: "I make a torch from a board and the hide" works, costs
  time, and a character with carpenter's tools makes visibly better output
  (prose + mechanics); suite green.

### P-72 — Building (shelter → palisade → house) ✅ DONE 2026-06-11
**Shipped:** `engine/structures/playerBuilt.js` (build plans as data — lean-to,
palisade — with validate/match/missing/laborPlan/resolveBuild/makePlayerStructure/
shelterAt, mirroring the craft module); a `buildStructure` delta op in
`effectsCore.js` (mints `pb:<n>` ids, persistent, worldHash-covered); an optional
`build` provenance field on structures (`structuresState.js`, only-when-set like
`buildingType` — no WORLD_VERSION bump, existing structures byte-identical, old
saves carry no player builds); a `tryBuild` playloop gate ("I spend two days
building a lean-to" → consumeItems + the time op for the day-jump + buildStructure
+ one worldTick per day so the world moves while you work; an honest itemized
answer when the stockpile's short, no days lost, no menu); shelter-aware wild rest
(sound/fine lean-to = a true long rest like a settlement bed, poor = a strong
short rest, bare ground = a breather); labor fork v1 (solo by default; "hire a
crew" at a settlement halves the days at 2gp/day RAW and is +2 on the check;
coerced deferred to P-73). Quality is provenance — a barrel-board lean-to is a
poor lean-to, and the prose + rest band say so. U124 ×9; UX2 +BUILD class +2 rows;
suite 7,472 green; playtest:full clean; prose:gate PASS; live-verified (planted
wild node at 4/13 HP → built a lean-to: two days passed, board 8→4 / cordage 4→3,
"a rough lean-to … 2 days of your own sweat (Survival 2 vs DC 10)"; slept under it
to 13/13 with "+9 HP, a sounder shelter would buy a full night"; survived a
reload, still standing).
**Known gap (deferred):** player-built structures render on the local map via the
cottage-plan fallback — no `lean-to` place-art exists yet (`public/map` is outside
this packet's engine scope, and SALVAGE_AND_BUILD defers building UI to
out-of-scope-v1). Cosmetic only; engine canon, rest, and persistence are correct,
and the prose (the DM interface) names the lean-to properly. Belongs with a
structures-render visual pass.
**Why:** third rung; the loop becomes a place.
**Objective:** construction projects: stockpile + days + labor → `buildStructure`
delta op writing persistent structures (map anchor, enterable, burnable).
Downtime passage with world ticks running. Labor model v1: solo (slow) or
hired (gold/day from settlement labor pool). Quality from materials + skill +
time, surfaced in prose and rest mechanics.
- allowed: `engine/structures/playerBuilt.js` (new), `engine/effectsCore.js`
  (`buildStructure` op), `engine/playloop.js`, `engine/worldTick.js`
- invariants: structures join worldHash; WORLD_VERSION checklist if shape changes.
- done_when: live: two in-game days raise a lean-to that improves rest and is
  still there after save/reload; playtest:full green.

### P-73 — Stronghold tier + the labor fork
**Status:** ◑ P-73a ✅ DONE 2026-06-11 · P-73b ⏳ (player forts as story-arc anchors).
**Why:** the endgame sink and the moral instrument.
**Objective:** multi-season projects (fort, keep), crews, the sawyer economy.
Coerced labor: possible, fast, cheap — writes `cruelty` deeds, witnesses
remember, rumors spread, reputation and the seven-axis soul pay. Player forts
become story-arc anchors (arcs can bind to them).
- depends: P-67 (gold), P-70–P-72 (the ladder), morality M-milestones (existing)
- done_when: a keep can be raised honestly over seasons OR monstrously fast,
  and the county's treatment of you afterward differs visibly; an authored arc
  binds to a player fort.

**P-73a — Stronghold tier + the coerced-labor moral fork ✅ DONE 2026-06-11.**
Shipped: two stronghold-tier build plans in `engine/structures/playerBuilt.js`
(watchtower ~30d, keep ~120d — DMG-scaled; a keep is a `long`-rest shelter,
walls and a bed); a `coerced` labor mode in `laborPlan` (a THIRD of the days,
free, unskilled). The moral fork is "enough time (solo), enough gold (hired),
or enough slaves (coerced)": the coerced path in `tryBuild` emits the cruelty
package through the existing morality organs — `axisDelta` wrath/pride/greed
(the seven-axis soul, → corruption), `recordDeed` cruelty, `npcTrustDelta` on
the settlement witnesses (their trust craters), `adjustHeat` (investigation
pressure). `applyDeedCharges` skips its `tryDarkDeed` pass on the coerced marker
so the deed is the construction itself and is never double-counted. Coercion
needs people — out in the wild it falls to solo with no atrocity. Camera-Rule
prose: the coerced raise reads as weight ("raised on the labor of people who
were never asked … and so will the county"), never gratification. U125 ×8;
UX2 +1 BUILD row; suite 7,480 green; playtest:full clean; prose:gate PASS.
Live-verified (home village, full purse + a keep's worth of timber/stone):
coerced keep = 40 days, free, corruption 0→12, heat 0→8, one cruelty deed,
witness trust 5→2; the honest hired keep = 60 days, 240g, soul clean (corruption
0), witness trust intact — the fork differs visibly.
**P-73b — Player forts as story-arc anchors (remaining).** An authored arc can
bind to a player-built structure (`engine/story/storyEngine.js` + a
`content/arcs/*.arc.js`); things come TO the fort. Also remaining from the
broader objective: rumor propagation of the atrocity (rides on the M2-remaining
"deeds mint rumors" work) and faction-disposition shifts — the local witness
trust crash is the current visible county reaction.

### Content track (parallel, any time)
- **More story arcs** — the format is proven (4 live); each new arc is one data
  file + a casting probe across seeds. Candidates: a Church of Incrementalism
  thread, a bestiary-outer-reaches arc, a patron/angel-demon evidence arc.

## QUEUE — Incredible-RPG track (gap analysis, specced 2026-06-11)

Source: full-engine gap analysis vs. "what makes a great tabletop D&D campaign."
The verdict: content is deep (642 creatures, 18 spell schools, loot/items/shops,
conditions, companions, morality); the gaps are COMPOSITION — systems that make
the player feel someone is running a game *for them*.

**Ordering rule (anti-drift):** the ROADMAP critical path (R0→R3, the DM
adjudication soul) outranks everything here. These are the parallel-track
packets; pull them when a worker window wants bounded work that doesn't touch
the adjudication spine. Within this track: P-75 and P-77 are independent and
small (start anywhere); P-74 is the big one (sub-packets in order); P-76 pairs
naturally with R2/R3 and should wait for the object model; P-78 builds on P-74's
reaction machinery; P-79 is composer-layer, any time.

### P-74 — The Adversary (a villain you hate)
**Why:** threads, factions, and the inevitability meter exist, but no persistent
named antagonist reacts to the player — escalates when you win, recruits when
you're weak, is the face of the third act. Great campaigns are remembered by
their Strahd. All the organs exist (npcArc, worldTick, instrument.js,
endingArchitect); nothing composes them into a BBEG with an agenda.
**Objective:** one deterministic villain per world seed: identity, agenda
(staged plan), and a reaction loop in worldTick that advances the agenda and
responds to player-visible events (goal completions, corruption, faction hits).
The villain is never named by the narrator until discovered (rumor-first, like
the gods). Sub-packets, in order:
- **P-74a — Villain genesis + agenda state. ✅ DONE 2026-06-12** `engine/story/villain.js` (new):
  seed-deterministic villain (drawn from bestiary elite tier or npcGenesis),
  a 4–5 stage agenda, persisted in world state behind `ensureWorld` defaults.
  Landed: WORLD_VERSION 27, `world.villain` (null until minted), villainGenesis/
  mintVillain/ensureVillain, invariants, U128 ×7. Minting wires in at P-74b.
  - allowed: `engine/story/villain.js` (new), `engine/state.js`, `engine/invariants.js`
  - invariants: WORLD_VERSION checklist (inv #8, #11); worldHash stable under replay.
  - done_when: same seed → same villain + agenda; determinism suite green.
- **P-74b — The reaction loop. ✅ DONE 2026-06-12** worldTick advances the agenda on its clock AND
  reacts: player completes goals → villain accelerates/adapts; player corruption
  crosses tiers → recruitment overture (ties into M4 dark gifts); villain stage
  changes mint rumors + ledger threats.
  Landed: tickVillain in worldTick (lazy mint, pure arithmetic, no rng drawn),
  villainAdapts/villainOverture/villainStage timeline events, U129 ×7.
  - allowed: `engine/worldTick.js`, `engine/story/villain.js`, `engine/rumor/`, `engine/ledger.js`
  - done_when: headless 200-turn run shows agenda advancing + ≥2 distinct
    reactions to player actions in the timeline; playtest:full green.
- **P-74c — Confrontation arc. ✅ DONE 2026-06-12** An authored arc binds to the villain (the
  existing `content/arcs/*.arc.js` format): discovery → lieutenants →
  confrontation at the villain's seat. Defeating them is a real ending-shaped
  event in an open-ended world (the world notes it; play continues).
  Landed: the-named-dark arc (requiresVillain, trust-gated discovery →
  silencer → seat → end-it), storyEngine villain bindings ({villainName} etc.,
  @villainSeat/@plant predicates, discover/defeat flips, hostile planting),
  U130 ×8. Lowest casting priority — waits for a free arc slot (act-3 pacing).
  - allowed: `content/arcs/` (new arc), `engine/story/storyEngine.js` (binding only)
  - done_when: live playthrough reaches and resolves the confrontation; the
    county's rumors reflect the outcome.
**Forbidden:** narrator names the villain before canon discovery; `Math.random`;
a second mutation path.

### P-75 — Boss mechanics (legendary + lair actions, phases) ✅ DONE 2026-06-11
**Shipped:** `engine/combat/bossActions.js` (payload resolution: authored action >
name-matched enemy action > deterministic CR-scaled synthesis; `bossPhase` derived
purely from hp — nothing persisted, worldHash untouched; `applyBossPhase` phase-2
behavior: authored phase action joins the routine or strikes run heavier;
`detectPhaseCrossings` with authored-or-default narration). Party path
(`combatResolve.js`): CM7/CM9 legendary/lair duds now resolve real payloads; phase
beats surface in the summary. LIVE path (`escapeCombat.js`): legendary answers the
player's turn (one option/round, priciest affordable), lair fights only at the
seat (one/round, cycling), bloodied bosses swing with visible fury, phase
crossings push the authored beat; morale gate fixed to the normalized
legendaryActions shape (bosses hold the field); Relentless Endurance honored on
boss damage. Authored `phases` on entropic_sphinx + necropolis gate (B05 contract
+optional field). Non-boss fights draw nothing new — byte-identical (replay suite
green). CM10 ×17 (12 from Tim's in-flight start + 5 escape-path); suite 7,497
green; playtest:full clean; prose:gate PASS; live-verified (planted sphinx fight
in v1.html: "Entropy Pulse (legendary): hits you for 14 entropic", "The lair
itself answers its master — Time Dilation…", and the authored Unraveling beat on
the 95/190 crossing — screenshots taken).
**Deviation from spec:** allowed_files named `initiative.js` (untouched — no hook
needed) and not `escapeCombat.js`; the live surface runs escape combat, so the
done_when ("live combat prose") is unreachable without hooking it. Hooks only, in
the spec's spirit. `tests/B05` updated for the optional `phases` field.
**Why:** "legendary" exists only in bestiary flavor text. A CR-17 fight is
structurally a wolf fight with bigger numbers. One module changes how climactic
fights feel more than 200 more creatures would.
**Objective:** `engine/combat/bossActions.js` (new): creatures flagged
boss-tier get legendary actions (act between player turns, budget 2–3/round),
a lair action on initiative 20 when fighting at their seat, and one phase
trigger (at ½ HP: new behavior + a narration beat). Data-driven from bestiary
entries (extend elite-tier defs); the dice stay in `diceRoller.js`.
- allowed: `engine/combat/bossActions.js` (new), `engine/combat/combatResolve.js`
  + `initiative.js` (hooks only), `engine/ruleset/core/bestiary/catalog/elite.js`
- depends: nothing — independent, start any time.
- done_when: a flagged elite fight shows legendary actions interleaving and a
  visible phase turn in live combat prose; non-boss fights byte-identical
  (worldHash + replay green); suite green.

### P-76 — Traps, hazards & skill challenges (the third pillar)
**Why:** sessions are roughly thirds — combat, social, exploration-with-
obstacles. The first two exist; the third is narration-only. No trap system,
no puzzle structure, no skill-challenge frame.
**Objective:** traps as first-class objects `{trigger, hidden, dc, effect,
state}` placed deterministically in structures/dungeons; passive-Perception
reveals on approach, search reveals on intent, disarm is a check, springing
applies real deltas (damage/condition/noise). Skill-challenge frame v1:
N-successes-before-3-failures for multi-step obstacles (chasm crossing,
chase, ritual), adjudicated in prose per THE_DM_TEST.
- allowed: `engine/objects/` or `engine/structures/` (trap placement),
  `engine/playloop.js` (search/disarm intents), `engine/resolve.js`,
  `engine/effectsCore.js` (only if a new op is genuinely needed)
- depends: **wait for R2 (object model)** — a trap is exactly the kind of
  first-class object R2 defines; building it before R2 means rebuilding it.
- done_when: live: a dungeon corridor trap can be spotted, searched out,
  disarmed, or sprung — all four paths in prose with real consequences;
  determinism suite green.

### P-77 — Magic item identity (attunement + named items) ✅ DONE 2026-06-11
**Shipped:** magic gear lands SEALED — the instance's defRef points at a humming
placeholder (`unidentified_blade`/`armor`/`trinket`) and the truth rides in
`sealedRef`, so no surface (panel, equip, sell, combat) can leak a name the
table hasn't earned. Identify: an hour + Arcana vs rarity DC (failure keeps the
secret honestly, hour still gone), or pay a settlement scholar the rarity fee.
Attunement: `attuned` on the instance, an hour of your undivided self, cap 3
(invariant-enforced), and the BIG effects sleep without it — accessories (RAW)
and all named uniques gate their bonuses in meleeProfile/playerAc/gearProps;
+N weapons/armor stay attunement-free (RAW). Eight named uniques with one-line
histories (Greyfang, The Dawn Was Late, Thirteen Sparrows, Coat of the Quiet
House, The Wall of Wens, Ring of the Unspent Hour, Lantern-Heart, Boots of the
Unmissed Step); milestone levels 3 and 5 pay one seed-deterministically, never
a duplicate ("The road pays its debts: …"). Obtain-goals now satisfy by defRef
(typed items; a sealed item correctly does NOT count until named), so
"recover the blade" completes at the moment of identification. Instance fields
are only-when-set (P-72 precedent — NO WORLD_VERSION bump; old saves carry
neither; normalizer + addItem pass them through; invariants guard them).
U126 ×9; UX2 +IDENTIFY/ATTUNE rows; R05-11/U121-07 updated to attune the ring
(the behavior change is the packet); suite 7,506 green; playtest:quick clean;
prose:gate PASS; live-verified in v1.html (equip hum → sage names Greyfang +
history → quest completes → Level 3 + "Coat of the Quiet House comes to your
hand" → attune → d6+3 wakes to d8+5/+7; MAIN HAND panel + quick-button read
Greyfang; screenshots).
**Deviations:** beyond allowed_files — `effectsCore.js` (addItem must carry the
fields; sole-mutation-path law), `escapeCombat.js`/`combatResolve.js` (loot-mint
seal + live combat math; same justification as P-75), `invariants.js`
(checklist-mandated for new fields), `goals/goalContract.js` (obtain-by-defRef
— the milestone/goal vocabulary the spec's (d) asked to extend).
**Why:** the magic catalog exists but `attunement` greps to zero. No
identification, no attunement choice, no signature item that grows. In
tabletop, the named +1 sword with a history is half the reward economy.
Quest payoffs now grant levels (P-milestones, c254b43); the next payoff tier
is unique items and titles, not gold.
**Objective:** (a) unidentified drops — magic items land as "something
humming"; identify via short rest + check, or a sage/shop service (P-67
economy). (b) Attunement: cap 3, chosen at rest, required for the big
effects. (c) Named uniques: ~8 seed-deterministic named items with one-line
histories, placed as quest/boss rewards (P-74c's confrontation should pay
one). (d) Goal completion can reward a named item (extend the milestone
machinery's reward vocabulary).
- allowed: `engine/ruleset/core/items/magic.js`, `engine/gear/gearProps.js`,
  `engine/playloop.js` (identify/attune intents), `engine/state.js` if
  attunement persists on the sheet (WORLD_VERSION checklist applies)
- depends: P-67 (done) for the sage-service price path.
- done_when: live: loot an unknown item, identify it, attune at rest, see the
  effect in combat math; a quest pays a named item with its history line;
  suite + playtest:quick green.

### P-78 — Companions as people ✅ DONE 2026-06-12
**Why:** `companionTurn.js` runs their combat actions and npcArc/npcDepth
exist, but the BG3-grade layer — companions who interject, object, have their
own quests, and can leave — isn't composed. M4 corruption is begging for a
companion who notices.
**Objective:** companions get (a) interjections: scene-triggered one-liners
through perspectiveFilter (cap: ≤1 per scene, deterministic trigger);
(b) loyalty: a per-companion disposition that moves on witnessed deeds
(reuses the morality witness machinery from P-73a); (c) the objection arc:
crossing a corruption tier with a good-aligned companion present triggers
confrontation → ultimatum → departure if ignored; (d) one companion side
quest in the arc format.
- allowed: `engine/npc/` (companion modules), `engine/playloop.js` (hooks),
  `content/arcs/` (one arc)
- depends: P-74b's reaction-loop patterns help but aren't required; the
  morality witness organs (done) are the real dependency.
- done_when: live: a companion comments unprompted at a fitting moment; the
  coerced-labor build (P-73a) with a companion present triggers the objection;
  ignoring it twice loses them, and the timeline says so; suite green.

### P-79 — Session rhythm (recap, cliffhanger, downtime) ✅ DONE 2026-06-11
**Shipped:** `buildRecap` in composer.js — deterministic 3-sentence "When the
candle last burned at this table…" from the timeline since the last resume
(travel/goals/build/identify/attune/named-reward/combat/downtime templates),
closing on the HOTTEST open threat (else oldest question) as the cliffhanger
hook; `markResume` in save.js stamps the session boundary (canon, not
replayed); v1.js surfaces the recap on Continue (LLM may polish downstream,
silent fallback = base text). Downtime verbs in playloop (`tryDowntime`, after
tryBuild so "spend a week raising a palisade" stays construction): training
banks an advantage token + a fact; research lands a concrete ledger fact named
from the player's own subject (anchored to a real node when one matches);
carousing needs a settlement and pays an NPC trust bump (the contact) + a
tavern-talk ledger question — honest refusal in the wild, no days lost. Days
pass via the time op with one worldTick per day (bounded 30) — the world does
not wait. U127 ×8; UX2 +DOWNTIME rows; suite 7,514 green; playtest:quick clean;
prose:gate PASS; live-verified (planted world with a built lean-to + a level-4
threat → Continue showed the recap naming both; "I spend a week researching the
old shrine" passed 168 hours and landed "the county once paid good coin to keep
old shrine quiet" in the ledger; screenshots).
**Bonus fix (protocol bug class):** the walk-place canvas's 30vh clamp starved
the transcript to a 20px sliver on short columns (narration in DOM, invisible
on screen — the PLAYTEST_PROTOCOL's documented failure mode, surfaced by the
resume render). The canvas now yields to a ~120px prose floor (v1.js inline
style; prose-first per DESIGN.md).
**Deviation:** `worldTick.js` (allowed) needed no changes — ticks are invoked
from playloop per the P-72 precedent. No engine/save shape change.
**Why:** cheap to build, large feel payoff. A great DM opens with "previously
on…" and ends on a hook; between adventures there's downtime.
**Objective:** (a) recap on resume — composer builds 3–4 sentences from the
timeline's last session (deterministic selection, polished by the LLM layer
with silent fallback); (b) cliffhanger surfacing — on save/quit, the ledger's
hottest open threat/question is named as the closing line; (c) downtime verbs —
"I spend a week training / researching / carousing" resolve as world-tick
passage with one concrete outcome each (skill progress hook, a lore fact, a
rumor + contact).
- allowed: `engine/composer.js`, `engine/playloop.js` (downtime intents),
  `engine/worldTick.js`, `engine/save.js` (resume hook), `public/v1.js`
  (surfacing only)
- depends: nothing — composer-layer, any time.
- done_when: live: quit mid-thread → resume shows a recap naming that thread;
  "I spend a week researching the tower" passes 7 days with a concrete fact
  learned; suite + playtest:quick green.

**Track-wide forbidden:** touching the R0–R3 adjudication spine while it's in
flight; `Math.random`; mutations outside `applyDeltas`; narrator-as-canon.
**Track-wide rollback:** every packet is new-module + named hook lines; revert
the named files.

## DONE (recent)
- **Living-World Merge P1–P6** (`docs/LIVING_WORLD_MERGE.md`): biomes, biome encounters,
  living ecology, NPC wants/discovery, hidden Will in casting, open-ended (no win).
- **Intent layer** (`engine/intent/`, IN1–IN4): text + click + voice → one intent.
- **Bedroom start** — wake in a cottage bedchamber in a safe village (forced home cottage).
- **Authored interiors in v1** — `drawInteriorV2` renders the plan catalog, not the stub.
- **Continuous exterior place** — replaced the tile overworld; real village from the node.
- **Walkable place + collision** — `placeNav.js` (NAV1); click-to-walk, walls, doors, fog.
- Prose/seam red-team: combat narration, dialogue ejection, "No one to fight",
  dungeon→neutral wording, SIGNATURE placeholder, motif duplication.
