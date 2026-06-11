# PACKETS — active queue + history

A packet is the unit of safe work: small enough that one agent understands every
touched file and a reviewer can read the diff. Spec the done-when and allowed-files
BEFORE editing, so divergence is caught at plan time, not screenshot time.

Schema: `id · objective · allowed_files · forbidden · invariants · test_plan ·
done_when · rollback`.

---

## ACTIVE

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
**Why:** the endgame sink and the moral instrument.
**Objective:** multi-season projects (fort, keep), crews, the sawyer economy.
Coerced labor: possible, fast, cheap — writes `cruelty` deeds, witnesses
remember, rumors spread, reputation and the seven-axis soul pay. Player forts
become story-arc anchors (arcs can bind to them).
- depends: P-67 (gold), P-70–P-72 (the ladder), morality M-milestones (existing)
- done_when: a keep can be raised honestly over seasons OR monstrously fast,
  and the county's treatment of you afterward differs visibly; an authored arc
  binds to a player fort.

### Content track (parallel, any time)
- **More story arcs** — the format is proven (4 live); each new arc is one data
  file + a casting probe across seeds. Candidates: a Church of Incrementalism
  thread, a bestiary-outer-reaches arc, a patron/angel-demon evidence arc.

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
