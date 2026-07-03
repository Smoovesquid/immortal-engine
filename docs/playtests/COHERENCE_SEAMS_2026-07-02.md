# Phase 0 coherence seams — full-transcript audit (2026-07-02)

**Source:** the two gates with complete per-turn audit trails — `gate-…-bridge.jsonl` + `gate-…-v1.jsonl` (96 turns, passes included). Combed by Basecamp (Opus) with a *coherence* lens the gate judge does not apply.

## The headline: the gate is blind to coherence

The v1 gate scored **3/48**. But across those same turns the world contradicts itself ~a dozen times — walls change material, NPCs materialize, the player teleports rooms, a looted letter reappears in a chest. **The judge passed almost all of it**, because cross-turn consistency isn't in its VIBE/CRUNCH/RAG rubric. So the **Phase-0 exit test (≤2 broken/48) is currently dishonest** — the floor is wobblier than the number says. Fixing that measurement is prerequisite to trusting Phase 0.

This is the known **Interior Object Model** root (`docs/playtests/harness/WHOLE_BUILDING_FINDINGS.md`); the flagrant cases (invented staircases WB-Q1, phantom pickup WB-Q4) are closed — what leaks now is the subtler layer: *who's in the room, what it's made of, where things are.*

## The seams (cited, routed)

| # | Seam | Evidence | WB map | Route |
|---|---|---|---|---|
| C1 | **NPCs materialize on demand, retconned "always there"** | bridge Chaos T3 ("the carter" → becomes Elske mid-headbutt); bridge RL T9–10 (Elske answers though player is "alone"); v1 Chaos T11 ("suddenly standing in my burning cottage"); both Newbie T5 ("has indeed been here all along… easy to overlook") | occupancy gap (`roomOccupancy.js` exists but doesn't hold NPCs in place) | **DEEP → Fable design** |
| C2 | **Walls/objects change material & location** | v1 Chaos: "wooden wall" (T2) → "stone wall" (T7) → "it was always stone" (T8); blood on the wall (T7) → "the stone basin's rim" (T9) | material identity not pinned | **DEEP → Fable design** (part of room-state) |
| C3 | **Node-global furniture + teleporting letter** | chest/pallet/lantern/basin are THE contents everywhere; bridge Chaos: letter from Elske's coat (T7) → "no letter here" (T9) → in the chest (T11) | **WB-Q5** (open; needs WORLD_VERSION bump) | **DEEP → design + queue** |
| C4 | **Player teleports between rooms** | v1 Chaos T9→T10 ("when did I walk into a back room?"); bridge Newbie T1 "the room" → T2 "this back room" | interior nav drift | **DEEP → Fable design** |
| C5 | **Settlement scale flip-flops** | v1 RL T3 "a single building" → T9 "a handful of buildings" → "which is it?" | **WB-Q9** (open) | **queue** |
| C6 | **Every NPC shares one canned deflection** | bridge Lore T12 (Dalla says Elske's exact words; player: "who taught you both to say that?") | **WB-Q6** (open) | **queue** |

Plus two non-coherence seams the same audit surfaced (judge-missed / mis-shaped):
- **C7 — "That"/"Interesting" parsed as NPC names** (v1 Lore T6/T9; bridge Lore T6/T7 "Outpost"/"Wayfarers"): sentence-initial discourse word grabbed as a referent → clarify bounce. Same class as H-90/91. **SAFE FIX now.**
- **C8 — papercut self-harm over-fires** on bare "scratch my \<bodypart\>" (from the bleed diff review). **SAFE FIX now.**

## The move (all Phase 0 — "sort into named seams → fix safe, queue deep → regress")

1. **Make the gate SEE coherence** — a post-hoc coherence analyzer over the JSONL that tracks material/NPC/location/object across turns and flags contradictions. Turns the dishonest 3/48 into an honest floor number. *(worker lane)*
2. **Safe seam fixes now:** C7 (discourse-word denylist) + C8 (papercut over-fire). *(worker lane)*
3. **Deep seam design:** the persistent room-state / NPC-occupancy model (C1/C2/C4, and the plan for C3/WB-Q5's WORLD_VERSION bump) — audit `roomOccupancy.js`/`roomState.js` + the IOM docs first; **design, don't blind-build** a schema bump unattended. *(Fable lane)*
4. **Queue for Tim's taste:** C5 (settlement scale), C6 (NPC dialogue-echo — dialogue voice is taste-critical).

Dispatched as overnight lanes 2026-07-02; Basecamp verifies + integrates, holds the WORLD_VERSION-bumping work for Tim.
