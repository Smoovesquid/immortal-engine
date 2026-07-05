# PACK-TRIO — Decision Memo

*Read-only audit, 2026-07-04. No code changed. Worktree verified at `21e59d3a` (v0.28.23).*

## The one-line version

`locations`, `objectives`, and `sensoryMotifs` are silently dropped by `normalizePack()`
(`engine/rulesets.js:3-19`) before the engine ever sees them — including in the **live server
path** (`server.js:533`). All three fields have real, working consumer code that expects them.
Today every consumer falls back to a thin 3-item "starter" pool or one hardcoded string instead,
and nothing looked broken because the fallback never crashes — it just quietly always plays the
worse version of the scene. This is the same bug shape as `threads` from last night's memo, just
already masked instead of visibly inert, and with one twist: I found and reproduced a **second,
deeper break** in the same three lines of code — `mergeSubRegion()` (the function that's supposed
to stitch Westmarch/Ashenmoor/Crownlands/Hallowed-Reaches content onto the base Fantasy pack)
also runs on already-stripped input, so today it silently produces **empty arrays**, not the
"base + subregion" union its own code comment claims.

## Content inventory

| Pack | `locations` | `objectives` | `sensoryMotifs` | Quality read |
|---|---|---|---|---|
| **fantasy** (base) | 75 | 75 | 75 | First 50 are procedurally templated (5 base names × 10 numbered repeats — "sunken crypt (level 1)" … "sunken crypt (level 71)"). **Entries 51-75 (25 of them) are hand-authored**, and read as aligned triples by index — e.g. index 51: location *"a court road where someone was escorted and did not arrive"* / objective *"carry a sealed letter without opening it"* / motif *"ink and river mud smell occupying the same room"*. That's a legible mini-scene, not filler. |
| **haunted** | 50 | 50 | 50 | 100% procedural template (10 unique bases × numbered repeats, confirmed by dedup: exactly 10 unique location/objective/motif "bases" across all 50 entries). No hand-authored tail. |
| **modern** | 50 | 50 | 50 | Same — 100% procedural, 10 unique bases. |
| **space-rift** | 50 | 50 | 50 | Same — 100% procedural, 10 unique bases. |
| **zombie** | 50 | 50 | 50 | Same — 100% procedural, 10 unique bases. |
| **westmarch** (fantasy subregion) | 20 | 15 | 15 | Hand-authored, named NPCs (Dalla, Warden Maren, Captain Hale, scout Pel), concrete hooks — *"track the missing Compact scout Pel"*, *"recover strange tools from the old tunnels beneath Ashfall Ridge."* |
| **ashenmoor** (fantasy subregion) | 20 | 15 | 15 | Hand-authored, faction-flavored — *"learn why the monks keep silence (without breaking trust)"*, *"translate the old script above the undercroft."* |
| **crownlands** (fantasy subregion) | 20 | 15 | 15 | Hand-authored, Shakespeare-flavored political intrigue — *"prevent the youngest heir from signing the division,"* *"convince the apothecary to name the draught she prepared."* |
| **hallowed_reaches** (fantasy subregion) | 24 | 18 | 15 | Hand-authored, divine-gaze/morality flavor — *"reach the lord's hall before the mirror-crowned consolidates another ally,"* *"ask the augur the right question before they stop answering."* |

**Taste sample (best material, fantasy base pack tail, index 51):**
> Location: *a court road where someone was escorted and did not arrive*
> Objective: *carry a sealed letter without opening it*
> Motif: *ink and river mud smell occupying the same room*

This is the same authored-richness signature the sibling `threads` memo found — political intrigue,
specific concrete hooks, nothing generic. Only `fantasy` (the base pack) has this two-tier split;
the four non-fantasy genre packs (haunted/modern/space-rift/zombie) never got a hand-authored tail
at all — their `locations`/`objectives`/`sensoryMotifs` are pure filler regardless of what happens
to the whitelist.

## Consumer trace — the bug, reproduced end-to-end

**Where the engine reads each field, confirmed by direct code trace:**

| Field | Read site | Fallback on empty |
|---|---|---|
| `locations` | `playloop.js:278` — `pickFrom(pack, 'locations', rng) \|\| rng.pick(pack.starterLocations)` | 3-item `starterLocations` pool: `["roadside shrine", "mossy stairwell", "ruined watchtower"]` |
| `objectives` | `playloop.js:279` — `pickFrom(pack, 'objectives', rng) \|\| rng.pick(pack.starterObjectives)` | 3-item `starterObjectives` pool: `["find the missing courier", "recover a stolen relic", "break a local curse"]` |
| `sensoryMotifs` | `composer.js:158` (`pickMotifWithMemory`) and `instrument.js:85` (`seedMotifs`) | One hardcoded string: `'a low hum threads through the walls'` |

**Before/after pair, reproduced live in Node against the actual production code path** (not a
guess — I ran `normalizePack()` and `mergeSubRegion()` exactly as `server.js:533` and
`playloop.js:9954` call them):

```
RAW pack.json (what's actually authored):
  fantasy.locations.length   = 75
  westmarch.locations sample = ["Thornwall market square (level 1)", "Thornwall garrison tower (level 2)"]
  westmarch.objectives sample = ["find Dalla's missing apprentice in the Greywood (1)", ...]

AFTER normalizePack() (what the server actually produces today):
  fantasyNorm.locations    = undefined  (field doesn't exist on the returned object)
  westmarchNorm.locations  = undefined
  westmarchNorm.objectives = undefined

AFTER mergeSubRegion(fantasyNorm, westmarchNorm) — the REAL production merge call:
  merged.locations.length   = 0   (expected: 75 + 20 = 95)
  merged.objectives.length  = 0   (expected: 75 + 15 = 90)
  merged.sensoryMotifs.length = 0 (expected: 75 + 15 = 90)
```

**This is worse than a single dropped field — it's a compounding break.** `mergeSubRegion()`
(`playloop.js:9954-9971`) is the function whose entire job is to stitch Westmarch/Ashenmoor/
Crownlands/Hallowed-Reaches content onto the Fantasy base pack. Its code reads cleanly — `append('locations')`
concatenates `basePack.locations` and `regionPack.locations` — and would work correctly if either
input still had the field. But because **every pack in the manifest, including the four subregion
packs, goes through the identical `normalizePack()` call** (`server.js:530-534`, one loop, no
exceptions), both `basePack` and `regionPack` arrive at `mergeSubRegion` already stripped. The
function runs, returns a shape that looks right, and produces an empty array. Every single day the
game has shipped with this merge landed, this line has silently done nothing.

**Consequence in play:** at scene start, `beginAdventure` calls `pickFrom(pack, 'locations', rng)`
against an array that is always empty in production, so it always falls through to
`rng.pick(pack.starterLocations)` — the same 3-item pool, regardless of which of the 9 packs is
active, regardless of whether Westmarch/Ashenmoor/Crownlands/Hallowed-Reaches merged in. A player
running the Fantasy pack with all four subregions merged should be drawing from a pool of up to 95
authored locations; they are actually drawing from 3 generic ones, every time, forever. Same for
objectives (90 authored → 3 generic) and sensory motifs (90 authored → 1 hardcoded sentence,
repeated verbatim every scene until pinned/recent memory rotates it out).

**Tested?** No. `D01.ashenmoorPack.test.js:15-16` asserts `pack.locations.length >= 20`, which
passes today and gives false confidence — but that test reads the **raw JSON file directly**
(`JSON.parse(readFileSync(packPath))`, line 9), never calling `normalizePack()`. It proves the
*pack.json file* has the content; it does not prove the *engine* ever receives it, which is exactly
where this breaks. By contrast, `U454.threadedPackBoot.test.js` (the test that proved `threads`
works) deliberately boots with **raw, un-normalized** packs to bypass the bug and test the
downstream machinery in isolation — its own file comment (line 16-17) names `locations`,
`objectives`, `sensoryMotifs` as fields the whitelist drops, but no test exercises the real
`normalizePack → mergeSubRegion → pickFrom/composer` chain end-to-end for any of the three. There
is a zero-coverage gap on the actual consumer path for all three fields.

## Admission cost per field

| Field | Normalization change | Determinism | Test refresh | Separable? |
|---|---|---|---|---|
| `locations` | Add `locations: arrayStrings(p.locations)` to `normalizePack` (1 line, mirrors existing `starterLocations` pattern) | `worldHash.js:13` includes `w.pack` directly — hash shifts once for any world that boots with a non-empty `locations` pool (i.e., immediately, since it's currently always empty) | New/updated test needed: nothing currently exercises `pickFrom(pack,'locations',rng)` against real content — recommend a small unit test plus one `playtest:quick` run | **S** — same size as the `threads` fix; can ship alone |
| `objectives` | Add `objectives: arrayStrings(p.objectives)` (1 line) | Same hash-shift mechanism as `locations` — same world, same shift, no *additional* cost if done together | Same gap — no current test of the real path | **S** — trivially bundled with `locations` (same PR, same whitelist edit, same verification run) since both feed the identical `beginAdventure` two-liner at `playloop.js:278-279` |
| `sensoryMotifs` | Add `sensoryMotifs: arrayStrings(p.sensoryMotifs)` (1 line) | `w.instrument` (which stores seeded/pinned motifs) is also hashed directly — motifs seeded from real pack content instead of the one hardcoded string will shift `worldHash` the moment a world boots and calls `seedMotifs` | Same gap — `composer.js`/`instrument.js` fallback paths are untested against real pack content | **S** — can go in the same whitelist-edit PR as the other two, or ship separately; no shared code path with `locations`/`objectives` beyond the whitelist line itself |

**Net:** all three are individually S-sized, and because they're 3 near-identical one-line additions
to the same function, the honest recommendation is **one packet, not three** — same shape as the
`threads`+`factions` packet already in flight. Bundling means one hash-fixture refresh instead of
up to three, and one `playtest:quick` verification pass instead of three. The only reason to split
them is if Tim wants to stage the risk (ship `locations` alone, watch it, then `objectives`, etc.) —
given the fallbacks are graceful and the U454-style safety net exists, that caution isn't obviously
needed, but it's a legitimate staging choice if he wants to watch one variable move at a time.

**Pinned-test exposure:** I did not find a `HASH_BEFORE_FIX`-style pinned constant for these three
fields specifically (unlike `U454-E`'s explicit pin for `threads`) — but any test that boots a
world with the default `fantasy`/`tallow`/`aldermere` seed and asserts an exact `worldHash` value
will need a one-time refresh the moment this ships, for the same reason `threads` admission
requires one. This is expected, not a regression — a save continues to replay byte-identically
against itself; only the *default boot's* hash changes once, going forward.

## Risk — §0 cosmology and quest-log law

**No violations found.** I scanned every `objectives` entry across all 5 files (base + 4 subregions,
188 entries total) for quest-log/UI-shaped phrasing (`"Quest:"`, `"Objective:"`, checkbox markup,
`"TODO"`) — zero hits. The content reads as atmospheric flavor text seeding a scene, not a
checklist: e.g. *"convince the apothecary that what she knows will not stay safe in silence"* is a
sentence a DM would say aloud, not a task-tracker row. Critically, **the render site only ever
surfaces one entry at a time** — `playloop.js:279` is `rng.pick()`-ing a single string into a single
`objective` variable that becomes ambient scene framing, exactly the same mechanism already used
today (harmlessly) for the 3-item `starterObjectives` pool. Admitting `objectives` doesn't change
*how* it's shown to the player, only the size and quality of the pool it's drawn from. No reshaping
or gating is needed to stay compliant with the no-quest-log law — this content was never going to
render as a list, and admitting the field doesn't create that risk. I also found no §0
cosmology-leak language (nothing referencing the game's own meta-layer, hidden DM purpose, or
world-is-a-simulation material) in any of the 188 entries.

## Recommendation

**Admit all three (`locations`, `objectives`, `sensoryMotifs`) as one packet, alongside or
immediately following the sibling `threads`+`factions` packet.** Plain English: this is three
copies of the exact same bug the other lane is already fixing tonight, in the exact same function,
caught by the exact same kind of mistake — a whitelist that was never updated when this content got
written. The authored material is genuinely good (90 hand-written location/objective/motif triples
across the Fantasy pack and its four subregions, reading like real DM notes, not filler) and every
consumer that's supposed to use it already exists, already runs, and already has a safe fallback if
something goes wrong — so there's no new engine surface, no new prompt, no new LLM call, nothing to
design. The one real surprise this audit turned up beyond what the `threads` memo predicted: the
subregion-merge function (`mergeSubRegion`) that's supposed to combine Westmarch/Ashenmoor/
Crownlands/Hallowed-Reaches content with the base Fantasy pack is currently non-functional for
these three fields specifically — it runs, looks correct, and silently returns nothing, because
both sides of the merge already lost the content before the merge function ever saw it. Fixing the
whitelist fixes both problems at once: the fields start reaching the engine, *and* the merge starts
actually merging. The cost is the same one-time ripple as the `threads` fix — a pinned test hash
will need a routine refresh, and it's worth one `playtest:quick` pass to eyeball nothing broke — but
there is no content-quality risk, no quest-log risk, and no cosmology risk. This is a switch that's
already wired to a lightbulb; it just isn't plugged in.

**No fields in this trio warrant "leave dark" or "delete."** Unlike the four genuinely dead fields
named in the `threads` memo (`regions`, `npcs`, `seeds`, `toneVectors`), all three fields here have
live, working, currently-firing consumer code — leaving them dark means continuing to throw away 90
hand-written entries for no reason, and deleting them would destroy real authored work that a
working pipeline is sitting right next to, unable to reach it only because of a stale list in one
function.
