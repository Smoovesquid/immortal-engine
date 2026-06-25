# DEMO BUILD PLAN — the granular path to the 1,000 sq km demo

**Written 2026-06-23. The packet-level build plan for the walk-in demo region.** The CONTENT destination is
[`docs/DEMO_REGION.md`](DEMO_REGION.md); the CAPABILITY order is the realization ladder in
[`docs/PATH_TO_SELLABLE.md`](PATH_TO_SELLABLE.md); the METHOD is the world-wiring track (one tested LOCATION at a
time) recorded in [`docs/CAPABILITY_LEDGER.md`](CAPABILITY_LEDGER.md). This doc fuses the three into a sequenced
packet list. It is the spec the autonomous build block reads.

> **The core discipline (non-negotiable, from PATH_TO_SELLABLE + the ledger):** most of the repo is *inventory*,
> not product. The demo **rides systems that already exist** (substrate, RAG voices, pantheon, morality, rumor,
> goals) — it does not build parallel ones. **Wire the smallest real scene that stresses a seam, refactor that
> seam, repeat.** Climb the ladder *in order* — a player cannot reach a higher rung until the one below produces
> its "wow." Never let "we already built it" become "so it must ship."

---

## The shape of the gap (what's done vs. what the demo needs)

- **Solid 🟢:** deterministic core + Canon Log + determinism (the moat floor); DM loop; map; NPCs & dialogue;
  combat; chargen; packs; **THE REF** (narration ≠ canon, on by default). Engine: 260 files, suite 8,485/0,
  corpus 107/107, determinism green.
- **Rung 1 (spine) ≈ 90%:** Road-A closed; THE REF closed the narration frontier. Residual = design-locked
  taste calls + combat-model choices, not defects.
- **The real capability gaps:** **rung 3 (talk→quest) does not exist** — `dialogue.js` never calls
  `createGoal` (confirmed); **rung 4 (felt consequence + return-session) is unproven**; **rungs 5–6
  (the why / the buried truth) are dark.**
- **Content gaps:** the region map (biome-bleed), 5 town populations, the 5 figures, 2 dungeons, the 3 moral
  vises (faith-war / cannibals / orb fork).
- **One paper decision gating scale:** the bespoke-voice cost model for ~200 NPCs.

**Existing packets this plan reuses (do NOT reinvent):** P-82 (figure voices), P-83 (rumor surface), P-84
(creation-myth door), P-85 (world answers), P-86 (correctness gate), P-89 (return-session), P-90 (map
inhabitants), P-76 (hazards), P-74 (adversary, optional), Phase-4 (morality M4–M11), the W-# world-slice
resolvers (`engine/world/placeQuery.js`, `personQuery.js`, `regionGen.js`).

---

## Packet ID scheme

New demo packets are **D-{phase}{n}** (e.g. D-B1). Each names: **goal · seam (real files) · done-when ·
hypotheses (where the design is genuinely open) or the existing packet it reuses.** Done-when is always: the
targeted behavior lands **+** `npm run check` green (corpus 100% / suite 0-fail / determinism U19/21/22/27/30)
**+** the experiential gate (or a human read) confirms the *wow* — never a green suite alone.

---

## PHASE A — Lock the spine + the first complete town (rung 1 solid; the region skeleton)

*Goal: a stranger plays ONE town and says "I can do anything here and it fits," and the region exists to walk.*

### D-A1 — Spine residual triage (reuses P-86)
- **Seam:** `scripts/dm-playtest.mjs` gate → classify each residual (real-deterministic / design-locked /
  combat-taste / narration→THE REF). Fix ONLY real-deterministic ones (Road-A discipline; corpus-lock each).
- **Done-when:** the gate residual is only design/taste/forgivable-SOFT; corpus 100%; zero new capability rows.
- **Note:** the compound-meta-precedence class (gate-17/18) is a DESIGN tension (conflicts with locked
  C16-001) — a Tim decision (Open Decision 4), not a fix.

### D-A2 — One town end-to-end (the vertical-slice proof; extends the W-# track)
- **Seam:** `engine/world/placeQuery.js` + `personQuery.js` (extend Tallow Cross's facts to a full town: place,
  people, local events, a public concern); THE REF on; the dialogue voice path.
- **Done-when:** a fresh playthrough of one town — arrive → look → talk to 2–3 NPCs → ask about the place/people
  → deliver-or-decline holds, no fabrication, no §0 leak — passes the experiential gate.

### D-A3 — The demo-region skeleton (the map)
- **Seam:** `engine/map/generateMap.js` (node-count knob) + `engine/world/regionGen.js`/`regions.js` + `biome.js`.
- **Goal:** the valley exists — all biomes packed, **5 town nodes + 2 dungeon nodes** placed and reachable, the
  **biome-bleed** adjacency (DEMO_REGION §3) visible, replay-stable.
- **Hypotheses (pick one):** **(A, RECOMMEND) a locked demo PRESET** — a fixed seed/authored region object
  (it's a curated demo; determinism makes a preset trivial and controllable). **(B)** procedural with demo
  params (reusable but less curatorial control). **(C)** hybrid — procedural layout, authored town/dungeon
  anchors.
- **Done-when:** the region map replays stable; all 5 towns + 2 dungeons reachable; biome-bleed legible on the board.

---

## PHASE B — The talk→quest→consequence loop (rungs 3 + 4 — THE capability gap)

*Goal: an NPC's concern becomes the player's adventure; they go do it; they discover a consequence; they leave,
return, and the world remembered. This is the highest-leverage work — everything above sits on it.*

### D-B1 — The quest-birth bridge (rung 3) — **the lynchpin packet**
- **Seam:** `engine/npc/dialogue.js` (the topic/want surface) → `engine/goals/goalContract.js`
  (`createGoal({kind,targetRef,label})`, kinds reach/obtain/talkTo/learn/defeat). Today dialogue NEVER creates a
  goal — this builds that bridge. Possibly the Tier-B arbiter (`server.js /api/intent`) for player self-declared quests.
- **Hypotheses (genuinely open — prototype the cheapest, gate on the *feeling*):**
  - **H1 — NPC-want-driven:** NPCs carry wants (`npcDepth`/`perspectiveFilter`); surface a want as a concern in
    dialogue; an affirmative player turn mints the goal. Maximal reuse; "it was their idea."
  - **H2 — Player-intent-driven:** the player declares ("I'll go find the caravan"); a goal-detection step on the
    intent path mints it. "It was my idea"; needs the arbiter.
  - **H3 — Hybrid (RECOMMEND):** one `proposeGoalFromDialogue(world, npc, topicOrLine)` seam serving BOTH —
    NPC-surfaced wants AND player self-declaration. Covers both felt-origins; single tested seam.
- **Done-when:** in conversation, a concern becomes a tracked goal the player chose; `checkGoals` completes it on
  the deed; the gate judges it born-in-fiction (no quest-board / no "NEW QUEST" artifact). Corpus-lock the
  no-artifact contract.
- **DESIGN LAW (Tim 2026-06-24 — "I HATE that mechanic"):** goals are **obscure + player-held**, NOT
  video-game fetch-quests. The engine may track intent INTERNALLY (for completion → discovered consequence),
  but the player surface NEVER shows a checklist: no quest log, no objective markers, no "quest updated" toast,
  no go-fetch-and-return-for-reward loop. Origin is diegetic — a concern in talk, or a bounty decoded from the
  **Kasual Korner** ([[IG-14]] classifieds, read between the lines). "We write it down or forget it." **KILL the
  live violation:** `public/v1.js renderGoalsSection` (the `aria-label="Goal tracker"` panel). See
  `memory/project_obscure_goals_no_quest_log.md`.

### D-B2 — Consequence the player DISCOVERS (rung 4) (reuses P-83 + morality M2)
- **Seam:** the rumor/`claims.js` graph + `rumor/` fidelity tiers; morality M2 (witnessed deeds → trust/faction);
  `castConsequence`/deeds ledger.
- **Hypothesis (first felt consequence):** **reputation-travels** — a witnessed deed in town A changes a stranger's
  greeting in town B (the rumor graph already propagates + distorts). Cheapest path to a *discovered* (not
  reported) consequence.
- **Done-when:** a witnessed deed changes a later, elsewhere interaction the player did not expect — found, never a
  "reputation −3" popup.

### D-B3 — Return-session "never forgets" gate (the moat made visible) — **this is P-89, promoted**
- **Seam:** `engine/save.js` + the worldHash replay; a standing test: play → save → reload → position, goals, NPC
  memory, and consequences all intact.
- **Done-when:** the return-session test passes as a standing gate (the moat's "never forgets" half, provable).

### D-B4 — The full-loop proof (human + gate)
- **Done-when:** one playthrough — talk → quest born → go do it (combat/exploration) → consequence discovered →
  leave → return → it stuck — and Tim (taste) + the gate confirm rungs 3+4 *land*.

---

## PHASE C — Populate the region (content on built rails) — *gated by D-X1 (voice cost)*

### D-C1 — The 5 towns' populations + viewpoints (DEMO_REGION §5)
- **Seam:** `engine/npc/npcGenesis` + `perspectiveFilter` — each town a distinct populace (profiteers / blamers /
  cranks / deniers), the fading as backdrop.
- **Done-when:** each town reads as its own place with its own takes; NPCs corpus-voiced; §0 held.

### D-C2 — The 5 figures (the before-time echoes, §4) (reuses P-82)
- **Seam:** `npcGenesis` assignment → `npc.historicalFigure` → `server/rag/ragRetriever` → `npcVoicePrompt`
  (name/role separate from corpus; "shape your voice, don't quote").
- **Roster (Open Decision 2 — leads, not locked):** steward-king (Aurelius re-skin → *Theodore Augustus*),
  Cassandra (Joan), scholar, clown-leader (Goldblum-Socrates), cannibal-prophet.
- **Done-when:** the 5 figures speak in grounded voice, never quoting source, never breaking §0.

### D-C3 — The faith-war: COUG vs. the Incrementalist clowns (§6)
- **Seam:** the three-tier pantheon (Creator tier) + morality + factions; folds into `CHURCH_OF_INCREMENTALISM.md`.
- **Done-when:** the player can find the hidden clowns and face the vise (shelter / betray-for-reward / join);
  COUG rewards orb-destruction + hunts heretics. *No clean path.*

### D-C4 — The cannibals: the joinable rational-horror (§7)
- **Seam:** the Sin-tier god + morality + factions; the outlier town + prophet.
- **Done-when:** joining is a real, playable path (stop fading + consumption + belonging) with real cost
  (COUG+king turn, virtue doors close, karma compounds) — *not* a fail-state.

### D-C5 — The trade-economy hooks (§5.4, IG-13) (reuses P-67 spend loop)
- **Done-when:** the trade-town-in-denial is a living economy — wards, "cures," fake orbs, buying the fading's property.

---

## PHASE D — The dungeons + the orb climax (rungs 5 + 6 — the soul)

### D-D1 — The two dungeons + monster gradient (§9) (reuses bestiary + dungeon gen + P-76 hazards)
- **Goal:** the **Tomb of the Foundation** (architecture un-collapses as you descend through pre-cataclysm strata)
  + the **cannibal warren**; monster gradient = proximity to the Scar (mundane → pre-cataclysm guardians →
  reality-warped outer-reaches; world-native filter holds; Lovecraft/King/Asimov flavor at the bottom).
- **Done-when:** both dungeons playable; the gradient legible (the deeper, the *wronger*).
- **✅ MUCH OF D-D1 LANDED (2026-06-25):**
  - **Multi-level descent** (`c9a8478`): `dungeon_entrance`s default to a multi-level `site` (`buildSite`) —
    self-contained floors linked by a stair down at each vault, a narrow go-deeper intent, a real bottom,
    dread-building §0-safe narration + stair telegraphs. `U140`.
  - **Inter-level ascent + the monster gradient** (`15aac11`): "go up" at a stair climbs one floor (else
    bails to surface — never trapped); `selectCreatures` gained a depth-scaled CR FLOOR so deeper floors drop
    the mundane and hold the wronger things (depth 0 → cr-2 beasts, depth 2 → cr-4 elites). Fixed a depth
    desync in the move-into-room handler. `U140-05`.
  - **The cannibal WARREN** (`8c9b9d8`) — one of the two real dungeons: a `warren` theme (the eaters' archive
    beneath the gallows, "a library that smells of smoke"; the long table with a blank place set for you),
    placed at Gallows Hill (2) by the outlier, on the descent engine. `U141`.
- **Remaining on D-D1:** the **Tomb of the Foundation** (the OTHER dungeon — the un-collapsing pre-cataclysm
  strata; §0-sensitive); a curated **reality-warped deep-creature pool** (the gradient is CR-tier today,
  not yet bespoke outer-reaches horrors); the warren's **bespoke cannibal denizens** + a hand-laid layout.
  Deferred: lazy-infinite `mega` depth. Then D-D2 (cosmology-as-symptom), D-D3 (climax), D-D4 (death-prose).

### D-D2 — The cosmology as SYMPTOMS only (rung 5, §0/§3) (reuses P-84, §0-constrained)
- **Seam:** `substrate.js` cascade + THE REF §0 guard (the hard narration constraint).
- **Done-when:** a player asking "why is the world this way" gets symptoms / faith / rumor — **never** cosmology;
  THE REF treats a cosmology-explanation line as a defect. (Corpus-lock a §0 negative.)

### D-D3 — The hole + the hive (rung 6, §8 — the climax) — *reshaped 2026-06-24*
- **Seam:** the sealed `deep:foundation` — the orb is **GONE**; in its place a perfectly round hole, and something
  escaped. Canon-safe (§0: the orb's leaving / its destination are never explained — a hole, a horror, rumor).
- **Climax (demo):** an **ALIENS-ending** — a hive pours up the shaft; the player can only **run, fight, or seal the
  hole.** The old relic-fork (free/destroy/consume/leave) survives as fragment-rehearsal on the way down + the
  **campaign hook** (the true orb's fate). Plus **fragments-as-police** — wardens that answer a lawbreaker with
  *unmaking* ([[IG-16]] *Tough Shit* / [[IG-8]] the law; §0-hidden, symptom-only).
- **Decision 3 — largely RESOLVED by the reshape:** the demo gets a *contained* climax (the hive battle); "wake the
  orb" is mooted (orb absent) and its fate becomes the hook. Remaining nuance: is the seal permanent (clean ending)
  or temporary (a hook)?
- **Done-when:** a deep player reaches the hole and the run / fight / seal lands with *discovered* stakes (no
  exposition); the unmaking-warden reads as judgement, never as the machine.

### D-D4 — Death-prose / the pale-root vision (IG-5) in the deepest reaches
- **Seam:** engine-owned `[vision:raw]` (NEVER sent to the LLM — the iron rule in `server.js`).
- **Done-when:** the deepest death → afterlife glimpse → pale-root vision lands as authored, §0-safe.

---

## CROSS-CUTTING (de-risk on paper / parallel tracks)

### D-X1 — Bespoke-voice cost model (PAPER FIRST — gates Phase C scale) — **Tim decision**
- ~200 NPCs × per-line voice on a local 8B: throughput, quality, production economics (local GPU vs. cloud-per-line).
  Decide **all-bespoke vs. marquee-bespoke + template-rest** (red-team #3). Write it before lighting up the population.

### D-X2 — §0 enforcement, standing (THE REF)
- Built (dialogue + generic-resolve covered). Extend the Ref's soft-set as new narration paths appear (watch the
  dungeon/cosmology paths). Standing, not a one-time packet.

### D-X3 — The map renderer (reuses P-81 / P-90 / P-91–93 + the map-beauty dream) — parallel, opportunistic
- The satellite-real, material-differentiated, one-continuous-zoom surface. **Demo polish, NOT on the critical
  path to "playable."** Advance opportunistically.

### D-X4 — The guided demo + the showable surface (reuses P-87) + content-distribution posture (red-team #5)
- When "playable" → "showable": the scripted demo path + the deck; and the platform content-policy line for the
  dark themes (rungs 4–6). A real line item before any storefront.

---

## The critical path (dependency order)

```
A (spine + one town + region skeleton)
        │
        ▼
B (talk→quest→consequence loop)   ◄── the gating capability; the whole adventure sits on it
        │
        ▼
C (populate: towns, figures, faith-war, cannibals, trade)   ◄── D-X1 RESOLVED ✅ (all-Opus voice, 2026-06-24)
        │
        ▼
D (dungeons + cosmology-as-symptom + orb climax + death-prose)   ◄── the payoff; rungs 5–6
```
Parallel/anytime: **D-X3** (renderer), **D-X4** (showable). Paper-first: **D-X1** before C.

**One-line sequencing rule:** finish A; pour everything into B (it's the thinnest rung and the highest leverage);
only then populate (C) and descend (D). Climb on the *wow*, not the suite.

---

## Open decisions (Tim's — surfaced as hard stops in the build block)

1. **Bespoke-voice cost model (D-X1)** — ✅ **DECIDED 2026-06-24: all-bespoke, Opus 4.8 for every NPC** (see `DECISIONS_FOR_TIM.md` #1 / `VOICE_COST_MODEL.md` §6). *Unblocks Phase C.*
2. **The 5-figure roster (D-C2)** — confirm/replace the re-skin leads (Aurelius/Joan/Goldblum-Socrates…).
3. **The orb climax (D-D3)** — is "wake it" the demo climax or the campaign hook?
4. **The compound-meta-precedence design tension (D-A1)** — re-litigate the locked C16-001 split, or leave it?
5. **First audience (sets every wow bar's height)** — RPG-enthusiast (Rules-Lawyer bar) vs. normie.
6. **How hard to lean on "never forgets"** — the single headline, or one pillar among several?

---

## Honest scope note

This is the **full vertical slice of the vision** — large, but mostly *wiring + content + climbing rungs 3–6*,
not new engines (the organs are built-but-dark). The risk that kills it is doing too much at once: hold the
world-slice discipline (one location/seam at a time), keep the corpus at 100% and determinism green throughout,
and let the experiential gate — not a green suite — decide when a rung is climbed.
