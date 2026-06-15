# MVP Punchlist — from here to "a good DM running a solid game"

**MVP bar (locked):** a stranger plays `v1.html` for ~20 min by conversation alone and comes away
saying *"that was a good DM running a solid game"* — **vibe** (intent always resolved in the fiction,
no system artifact) **and crunch** (the rules underneath are correct & consistent), both required.

**How this list was built:** the Opus-4.8 experiential gate (`scripts/dm-playtest.mjs`) — four
in-character player personas driving the real live DM path, an adversarial Opus judge scoring every
turn. Single seed: baseline 17/48 (35%) → after fixes **9/48 (19%)**. A second run on **two fresh
seeds** then scored **33/96 (34%)** — not a regression (the fixes generalize) but harder worlds +
probing that expose the remaining critical-path items at full force. The items below are what the gate
still catches, triaged by what blocks the MVP bar.

Evidence: `opus-gate-2026-06-15-baseline.md`, `-postfix.md`, `-2seed.md`, `FIX_LOG_2026-06-15.md`.

---

## ✅ Solid today (don't re-litigate)
- **Deterministic floor** — 7,646 unit tests, worldHash replay, invariants, Canon Log authority. Strong.
- **Prose breadth** — `prose:gate` 216 inputs, 0 issues.
- **Fixed this session (F1–F7)** — canon proper-noun guard (no invented NPC/place names); self-harm
  deals a wound; equipment/sheet queries answered in-voice (no fabricated roll); `swing X at <NPC>`
  starts real combat; article grammar in the look-for pivot; interior survey acknowledges the living
  settlement; character-identity queries ("who am I / class / level / stats") answered in-voice.

---

## 🔴 Critical path (MVP blockers — the gate proved these break the experience fast)

1. **Combat from natural language — make it total.** *(ROADMAP R3/R4.)* The wedge now handles
   `swing/punch/lunge at <NPC>`, but the 2-seed chaos run broke the fiction across a whole family it
   doesn't cover: **grapples, hostage-grabs, shove/throw-a-person, fire & hazard spread**, and
   knife-to-throat standoffs — all narrated to effect with **zero mechanics**. Worst, the world goes
   **incoherent under sustained violence** (an NPC stabbed/thrown is "whole again" next turn). This was
   the single biggest cluster (13 CRUNCH fails). *Done-when:* any plausible attack/contest on a present
   NPC either starts/continues real combat (or a contest with a tracked outcome) or is refused
   in-fiction; a stabbed/thrown NPC stays down. **ROI: highest — one aggressive player breaks the game
   in two minutes.**

2. **Starting loadout / chargen content.** The starting Sellsword "Nyx" has an **empty weapon &
   armor loadout**, `dnd:null`, and a signature item literally named **"Thing"**. The crunch cannot
   read as "solid" when the PC has no gear — and it's *why* the DM kept inventing "a short sword".
   *Done-when:* each archetype gets a coherent starting kit; signature item is authored. *(Touches
   `WORLD_VERSION` + worldHash — follow the bump checklist.)* **ROI: first thing a player inspects.**

3. **Movement intent resolution.** "go out the door and head south toward the elder" → stalled at the
   door with a **clarify prompt** instead of journeying. Violates THE_DM_TEST and "the DM is the only
   verb." *Done-when:* a stated destination/direction resolves into a DM-narrated journey, never a
   UI-style bounce. **ROI: navigation is constant; a stall reads as broken.**

4. **Content-withholding deadends.** "read the carved name letter by letter", "what do the grooves
   spell out", "read the note" → the DM teases content then **withholds it with no in-fiction reason**.
   *Done-when:* the DM either delivers the content or gives a fiction reason it can't (smudged, a
   language you don't read). **ROI: lore-hounds and curious players hit this every session.**

## 🟡 Polish (first-impression quality)

4b. **Mixed/failed rolls must bind the fiction.** The 2-seed run caught trades and social contests
    where a `mixed`/`failure` roll was narrated as an **unconditional success** — the fiction ignored
    the mechanical outcome. A won/lost/partial check must change the fiction accordingly. *(Crunch gate.)*
5. **Interior "empty room" still leaks on a second path.** F6 fixed `buildLocationSurvey`, but the
   interior **explore / room-overview** branch still asserts an empty room while NPCs are present —
   chase that path too. *(P3 sight-scoping.)*
6. **Unify thrown-at-NPC with combat.** "hurl the jar **at** Corwin" routes to the innocent-harm
   *consequence* system while "swing the chair **at** Corwin" starts combat — inconsistent.
7. **"go for X" attack idiom** is eaten by the movement gate (runs before combat-begin). Needs
   combat-intent resolved around/before movement parsing.
8. **Success must pay off.** The narrator still occasionally answers a *successful* roll with an
   atmospheric stall; a won check should change the fiction concretely.

## 🟢 Nice-to-have (post-launch / tooling)

9. **Grow the gate:** more seeds, a 5th "speedrunner" persona, 40-turn sessions for trajectory
   coherence, and the multi-action `/api/intent` split for full path fidelity.
10. **RAG depth:** place RAG is wired only for dungeon interiors; settlement/outdoor place files are
    unauthored — the differentiator is thin outside dungeons.
11. **Wire the gate into CI** as the standing experiential regression test.

---

## Process recommendation
The Opus gate is now the standing experiential regression test. Re-run `node scripts/dm-playtest.mjs`
after each critical-path item. Targets: **<10% failing turns** to consider the slice playtest-ready,
then drive vibe+crunch toward **0 on the four critical-path classes** for the stranger-MVP bar.
