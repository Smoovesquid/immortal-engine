# D&D × XCOM — the tactical design lock

*Decided 2026-06-28 (Tim: "take control… yes to permadeath… yes to everything tabletop D&D can support… DnD/XCOM is an INCREDIBLY marketable move"). Source reference: `XCOM_MECHANICS_REFERENCE.md`. Governing tests still apply: [[THE_DM_TEST]], [[THE_TABLE_TEST]], determinism, narration≠canon.*

## The frame
XCOM splits cleanly in two. We **adopt its tactical brain**; we **reject its strategic metagame**.
- **Adopt (tactical):** turns, cover, flanking, line-of-sight, high ground, fog of war, ambush, encounter "pods", deterministic engine-owned math, data-driven content.
- **Reject (strategic):** the Geoscape mission-select, base-building, research tree, doom-clock. We are an **open-ended sandbox** ([[project_north_star]]) with no quest log and obscure goals — not a mission grinder.

The product is **"D&D XCOM you can play blind / in your earbuds."** The 3D map is a luxury *view*; the canonical game is the DM's voice + your commands.

---

## THE LAW: narrate the read, never the number
XCOM's soul is *no hidden information* — it shows "72% to hit, here's every modifier." We deliver the **same decision-relevant clarity through fiction, not a HUD.**
- **NOT:** "−25% cover, 49% hit, +50% crit if flanked."
- **YES:** *"The cart gives you decent cover from the archer — but the wolf's slipped to your flank. Call it even odds, and if it lands it'll hurt."*
- Every fact a sighted XCOM player would read off the screen, **the DM says out loud**, as fiction. A blind player gets identical tactical information.
- This reconciles XCOM transparency with our **hide-the-math** guard (`qualityJudge.js`) and the DM Test: *surface the decision, never the arithmetic.* The number exists in the engine; it reaches the player only as a spoken read.
- **Map = optional.** Anything the map shows, the DM must also say. The map may never hold information the narration withholds.

---

## Turn structure (tabletop-authentic, XCOM-clear)
- **Individual initiative** (D&D-authentic), presented with XCOM clarity: the world is **frozen** until you act; you give a command, the DM resolves your turn, **then** the world takes its turn (the "set in motion" beat), then it freezes again.
- After each resolve, the camera **recenters on you** (XCOM anchor — keeps "you" the centre, prevents drifting/clipping into other locations).
- **Action economy = D&D**, surfaced clearly (the one XCOM-UI idea we keep): Action · Bonus Action · Move · Reaction. The HUD/voice always answers *"what can I still do this turn?"*
- **Overwatch = Ready action**, **ambush = surprise round**, **fog of war = light + perception**, **pods = encounter triggering** — all already D&D, just made legible.

## Permadeath — YES
- **Dead is dead.** Death carries real weight (XCOM's emotional core). This is the default lethality, not a setting buried off.
- Rhymes with the parked seeds: **"Tough Shit"** (consequence, accountable identity, [[IDEA_GARDEN]] IG-16) and the **underworld death-run** as a playable second act (IG-17). Permadeath is the *front door* to those.
- Resurrection exists in the fiction but is **costly and rare**, never a casual undo.

## What we keep vs. drop, by tabletop support
| XCOM | Keep? | D&D form |
|---|---|---|
| Cover (−25 / −50 hit) | ✅ | Half cover +2 AC / three-quarter +5 AC |
| Flanking (+crit) | ✅ | Advantage (flanking variant) |
| High ground (+aim) | ✅ | Advantage / +2 from elevation |
| Overwatch | ✅ | Ready action / opportunity attack |
| Concealment / ambush | ✅ | Stealth / surprise round |
| Fog of war | ✅ | Light radius + Perception |
| Pods | ✅ | Encounter design (rooms/areas) |
| Deterministic additive math | ✅ | engine owns the number ([[biblioteca]] V11) — surfaced as a *read*, never a % |
| On-screen hit % | ❌ | replaced by the narrated read (THE LAW) |
| Geoscape / base / research / doom-clock | ❌ | open sandbox, obscure goals |

---

## Town generation: PLOT-AND-PARCEL (replaces procedural scatter)
XCOM doesn't scatter buildings — it lays a **plot** (rule-defined non-overlapping *slots*) and fills each with a curated **parcel** (a building that fits). We adopt this for settlements:
1. **Roads first**, then **slots** subdivide the frontage — non-overlapping *by construction* (this is what kills the "church clipping the inn" bug: anchors get distinct reserved slots).
2. **Parcels** = a small library of buildings with known footprints (inn, chapel, smithy, cottage, store…). Each slot is filled by a parcel that *fits*.
3. **Doors face the slot's street; roof ridge along the long axis; yard behind.**
4. **Fortify by danger** (frontier → palisade / motte-and-bailey → star fort). The fort shape *defines the slots* — which dissolves the "bigger fort vs buildings-in-a-circle" question: the wall's plan is the plot.
5. **Seeded / deterministic** — same seed → same town.

Demonstrated in `public/map-proto/outpost.html`.

---

## Engine work — located seams (2026-06-28 read-only audit; much is BUILT-BUT-DARK → wire, don't rebuild)
- **DX-1 · narrate-the-read in the DM prompt — ✅ DONE + VALIDATED (`881cb14`).** Added the TACTICAL READ rule to the combat branch of `buildSystemPrompt` in `engine/llmAdapter.js`. **Validated 2026-06-28:** suite 8941/0 · convergence **109/109 locked-pass** (no regression) · a wiring probe confirms the rule is present in combat ctx and absent when calm · a **live Haiku combat call produced a real read** (the wolf's commitment, the wall-at-your-back cover, the stakes — all as fiction) with **zero number/label leaks**. The negative half is also guarded by the `qualityJudge` `agency` criterion (leave its 6-criterion calibration alone). Combat narration runs on Haiku (`NARRATION_MODEL`) — cheap to re-probe.
- **DX-2a · tactical position confers mechanics — ✅ DONE + LANDED (`53a90ee`→`84eb9d5`).** Tactical schema (**WORLD_VERSION 27→28**): every enemy carries `tactical {cover, flanked, highGround}`, combat carries `playerTactical` of the same shape (`engine/combat/tacticalMods.js` normalize/default; invariants validate-when-present; threaded through `applyDeltas`). Cover→effective AC (+2/+5), flank/high-ground→advantage in `combatResolve.js`; surfaced to the DM via `narratorContext`. Tests `U296`. **Plus the cross-lane fix `e2ea1d0`:** pinned `STRUCTURE_SCHEMA_VERSION = 27` so a combat WORLD_VERSION bump can't reshape demo interiors (Homebase-confirmed). **Caveat that drove DX-2b:** combatResolve is the *structured* path — **`v1.html` always runs escape mode (`escapeCombat.js`), so DX-2a was real+green but DARK in the playable demo** (the two-engines trap, [[project_two_combat_engines]]).
- **DX-2b · tactical intent by voice in the LIVE engine — ✅ DONE + LANDED (`28ac341`).** "take the high ground" / "flank it" recognized in `escapeCombat.parseEscapeAction`; set `playerTactical.highGround` / the foe's `tactical.flanked`; honored as **real advantage (2d20 keep higher, `rollD20Adv`)** on the player's attack + extra-attack rolls (2nd die drawn only when advantage active → rng stream identical otherwise, determinism preserved); `beginCombat` resets `playerTactical` (no cross-fight leak); cover mirrored for the DM read. **Reuses DX-2a's schema → starts CONVERGING the two engines** onto one tactical model + one DM read. Tests `U297`. **Live escape-mode read verified:** `Wolf [flanked]` / `Player [high-ground]` reach the DM and return as fiction, zero number leak.
  - **Verified at integration (Homebase, 2026-06-28):** `npm run check` GREEN — convergence **109/109**, suite **8962/0** (determinism U19/21/22/27/30 included), `playtest:quick` clean. lane-check clear. Fast-forward merged to `v2-polish`.
  - **Follow-ons → DX-2c:** enemy terrain-sources in escape (foes spawn with cover/high-ground); full engine convergence (escapeCombat adopts combatResolve's cover→DC + trait/boss pipeline); *contested* position (a foe dislodging you / breaking the flank). And the richer path still open: x,y grid + the LLM spatial-intent resolver + 3D render (MAP_PATH Phase 2.2/2.4/3).
- **DX-3 · permadeath + the death-run hook.** Death terminal in state; wire the underworld second-act entry ([[IDEA_GARDEN]] IG-17). Schema-sensitive — version-bump protocol; queue.
- **DX-4 · extend `generateBuildingPlots` for plot-and-parcel.** `engine/map/spatial/buildingPlots.js` (Gate **S3**, pure/deterministic, keyed to seed+nodeId+settlementType, reads `roadGraph`) already emits `{roadType, roadIndex, offset01, size, kind}` along roads — but **no non-overlap guarantee, no door-facing, no fortification.** **Work (additive, preserve stable ordering + the S3 gate):** (1) allocate **non-overlapping slots** per frontage (kills the church-clip-inn class of bug); (2) **parcel-fit** — choose a `kind` whose footprint fits the slot; (3) emit **orientation + door-facing-the-road**; (4) **fortify by danger** — settlementType/threat → palisade / motte-and-bailey / star-fort ring that *defines the slots*. Then `localProjection.js` renders door/orientation. Determinism-gated → careful, with S3.
