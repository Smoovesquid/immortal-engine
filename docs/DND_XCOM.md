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

## Queued engine work (do NOT blind-hack the hot files — these are specced packets)
- **DX-1 · narrate-the-read in the DM/combat prompt.** Extend the `llmAdapter` DM system prompt + `qualityJudge` rubric so tactical state (cover / flank / odds / "what can I still do") is *always surfaced as fiction, never as numbers*. Owner: serial on narration/competence hot files.
- **DX-2 · tactical positions confer mechanics in `escapeCombat.js`.** Cover→AC, flank→advantage, high ground→advantage, read from committed positions (the propose/commit spatial resolver, MAP_PATH Phase 2.3). Serial hot file; bump per protocol if state-shape changes.
- **DX-3 · permadeath + the death-run hook.** Death is terminal in state; wire the underworld second-act entry (IG-17). Schema-sensitive.
- **DX-4 · port plot-and-parcel into engine settlement rules.** The deterministic slot/parcel generator becomes the village-layout function keyed to the node seed (today it runs in the prototype's JS).
