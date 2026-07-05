# PACK-THREADS-1 — Decision Memo

*Read-only audit, 2026-07-04. No code changed. Worktree verified at `fcbc4f3d` (v0.28.22).*

## The one-line version

`normalizePack()` in `engine/rulesets.js` is a strict 7-field whitelist (`id, name, toneWords,
starterLocations, starterObjectives, starterGoals, skills`). Everything else authored in pack
JSON — including 19 hand-written story arcs across 4 packs — gets silently dropped before it
ever reaches the engine. This is bigger than the `threads` field alone: it also drops
`locations, objectives, complications, npcArchetypes, sensoryMotifs` — fields the engine
actively tries to read, with fallbacks quiet enough that nobody noticed the loss.

## Inventory — the 19 dropped story arcs

| Pack | Arc count | Names | Quality read |
|---|---|---|---|
| **Crownlands** | 5 | The Deposed · The General's Marriage · The Divided Estate · The Drowned Twin · The Three at the Crossroads | Genuinely good — political-intrigue arcs with faction ties, tension scores (25-60), specific concrete hooks. Shakespeare-flavored per the code comment. Not stubs. |
| **Hallowed Reaches** | 8 | The Red Hour's Mark · The Coinmother's Debt · The Mirror-Crowned · The Grey Tide · The Green Eye · The Unbroken Furrow · The Surveyor's Route · The Convergence | Best-developed set — divine-gaze/morality arcs, tension range 20-85, named NPCs and gods baked into each hook. |
| **Ashenmoor** | 3 | The Sealed Undercroft · The Peat War · The Fog's Hunger | Solid, tension 35-55, faction-linked (Greyfen vs. the abbey). |
| **Westmarch** | 3 | The Greywood Silence · The Bridge Dispute · The Ridge Mines | Solid but missing `tension` values (undefined in JSON — a minor authoring gap, not a blocker). |

All 19 read as playable, not placeholder text.

## What else the whitelist drops (bigger than the brief anticipated)

Diffing every pack's top-level JSON keys against `normalizePack`'s admitted set:

| Field | Has a real code consumer? | Where |
|---|---|---|
| `threads` | **Yes** | `playloop.js:287` seeds them into `w.instrument.threads`; `worldTick.js` escalates tension every tick |
| `factions` | **Yes** | `playloop.js:301-302` — same silent-drop bug, smaller blast radius (3-8 factions/pack, no downstream escalation logic) |
| `locations` | **Yes** | `playloop.js:278`, `sceneDirector.js:105` — falls back to `starterLocations` silently |
| `objectives` | **Yes** | `playloop.js:279`, `sceneDirector.js:108` — falls back to `starterObjectives` silently |
| `sensoryMotifs` | **Yes** | `composer.js:158`, `instrument.js:85` — falls back to one hardcoded generic motif string |
| `complications`, `npcArchetypes` | Likely (same `pickFrom` pattern) | not individually traced, same shape as the two above |
| `regions`, `npcs`, `seeds` (rumor hooks), `toneVectors` | **No consumer found** | dead weight — authored but nothing reads them anywhere in `engine/` |

The `locations`/`objectives`/`sensoryMotifs` losses are silent because every read site has a
graceful fallback to the base pack's `starter*` list — so the game never crashed or looked
broken, it just quietly always used the thinner content. This is the same failure shape as
the `threads` bug, just already masked instead of visibly inert.

## What admitting `threads` (and `factions`) would take

**The seam already runs — this was just proven end-to-end.** `tests/U454.threadedPackBoot.test.js`
(landed today under PL-RNG-1) boots `beginAdventure` with **raw, un-normalized** packs — bypassing
`normalizePack` on purpose — and proves: no crash, threads seed into `w.instrument.threads`,
`worldTick.tickLivingThreads` escalates tension and mutates objectives over time, and the boot is
deterministic ×2 under a fixed seed. The downstream machinery is real, tested, and already
working — it just never receives input in production.

**This is NOT an opt-in mixer-pack feature.** `beginAdventure` (`playloop.js:200-215`)
unconditionally merges all four threaded subregions (westmarch/ashenmoor/crownlands/
hallowed_reaches) into any `fantasy`-primary pack via `mergeSubRegion()`, independent of the
player's mixer dropdown. Since `fantasy` is the default primary pack for both the shippable
slice (`aldermere`) and the `tallow` demo, **this fix touches the default game everyone
plays**, not an opt-in subset.

**Determinism:** admission is safe under the replay contract. U19/U21/U22/U27/U30 all assert
"same code + same seed ⇒ same hash" (relative consistency), not a hash pinned to a historical
constant — I found no golden-hash fixture that would conflict, with one exception:
`U454-E` DOES pin an explicit constant (`HASH_BEFORE_FIX`) for the `tallow` seed's default
boot specifically to prove *today's* behavior is unaffected by the PL-RNG-1 fix. **That
assertion will need updating** the moment `threads` is admitted, because the `tallow`/`aldermere`
default boot's `worldHash` will change (new entries land in `w.instrument.threads`, and
`worldHash` includes `w.instrument` directly — confirmed in both `worldHash.js` and
`worldHash.browser.js`). This is an expected, one-time hash shift for existing saves replayed
against the new code — not a determinism break; a save continues to replay byte-identically
against itself.

No `WORLD_VERSION` bump needed — `w.instrument.threads` is an existing, already-versioned shape
(`ensureInstrumentLayer` already normalizes/caps it at 12). Thread seeding uses the seeded
`threadRng`, never `Math.random()` — purity rule intact.

**Packet size: S.** Concrete work items:
1. Add `threads` and `factions` to `normalizePack`'s returned object (2-3 lines, mirroring the
   `arrayStrings`/pass-through pattern already used for `skills`).
2. Update `U454-E`'s `HASH_BEFORE_FIX` constant to the new post-admission value (re-capture once).
3. Run `npm run playtest:quick` to confirm no `THREAD_STARVATION`/`DEATH_SPIRAL` probe trips —
   the probe logic already exists and already reads `inst.threads`, so this is verification, not
   new code.

Note one nuance: `introduceThread(w, pt.name)` only carries the thread's **label** into
`w.instrument.threads` — the rich `description` and `factions` linkage authored in the pack JSON
is discarded at the seam today (confirmed: `pack.threads` has exactly one consumer, this line).
Admitting the field lights up thread *presence and escalation* immediately; surfacing the prose
`description` in narration would be a separate, small follow-up if Tim wants it.

## The two options

### Option A — Admit `threads` (+ `factions`) through the whitelist
- **Cost:** S packet (~2-3 hours): whitelist edit, one hash-fixture update, one playtest run.
- **What Tim gets:** 19 authored story arcs go live in the default game immediately — tension
  escalation, faction ties, objective mutation over time — using machinery that's already built,
  tested, and proven safe today via U454. No new design, no new prompt, no new LLM surface area.
- **Risk:** the default boot's `worldHash` shifts once (expected, not a bug) — anyone with the
  test suite open will see `U454-E` fail until its constant is refreshed (a 2-minute fix,
  already scoped above). Slightly more thread pressure in the default game (worldTick escalates
  these ticks-after-tick) — worth one `playtest:quick` run to eyeball, per item 3 above, but the
  `DEATH_SPIRAL`/`THREAD_STARVATION` probes already guard this class of problem.

### Option B — Delete the dead fields (honesty cut)
- **Cost:** also S — strip `threads`/`factions`/`regions`/`npcs`/`seeds`/`toneVectors` out of
  the 4 pack JSON files (or leave the JSON as historical/reference and just formally document
  the whitelist as intentional).
- **What Tim gets:** a codebase that matches its own claims — no content silently lied about
  being "in the game."
- **Risk:** **content loss.** These are 19 well-written arcs with no other reference anywhere in
  the codebase (confirmed: no rumor/newspaper/dialogue system reads these arc names or IDs) — so
  deleting them destroys real authored work with a working, tested consumer sitting right next to
  it, for the sake of not having to touch two files. `factions` has a real consumer too and would
  be cut for nothing. Only `regions`/`npcs`/`seeds`/`toneVectors` are actually dead-weight by this
  audit — those four are the honest candidates for deletion regardless of what happens to
  `threads`.

## Recommendation

**Admit `threads` and `factions` (Option A) — and separately, delete `regions`/`npcs`/`seeds`/
`toneVectors`, which really are dead weight.** Plain English: this bug isn't "unfinished content
nobody built a home for" — it's the opposite. Somebody already built the home (`worldTick`'s
tension escalation, the deterministic seeding, the starvation-probe safety net), tested it today
under a raw-pack harness, and proved it works — the only thing stopping 19 finished story arcs
from reaching players is a 7-line whitelist in one file that was never updated when this content
was authored. That's the cheapest, lowest-risk kind of fix there is: turning on a switch that's
already wired, not building anything new. The one wrinkle (a test's pinned hash constant needing
a refresh) is expected and scoped. Meanwhile `regions`/`npcs`/`seeds`/`toneVectors` genuinely are
dead — nothing reads them — so cutting those separately is the honest, no-cost move that doesn't
touch the same line and doesn't block the threads decision. Net effect: more of the game you
already paid to have written shows up on screen, with no new engine surface, no new LLM calls,
and the safety nets (determinism replay, starvation probe) already in place to catch it if
something goes wrong.
