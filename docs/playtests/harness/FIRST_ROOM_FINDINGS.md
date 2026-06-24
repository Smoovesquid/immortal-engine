# First Room — playtest findings + fix queue (2026-06-24)

*Source: the Human Playtest Harness (`--real-dm`, goal `probe-room`, seed `tallow`) + an independent
COLD fresh-eye review (cross-model audit of the full transcript). Log: `harness-2026-06-24-13-12-55.md`
(has the full untruncated transcript). This doc is the durable fix queue.*

## Verdict (fresh eye): the first room is genuinely BROKEN — not judge-noise.
The character wakes in a private bedchamber on `tallow`. A goal-directed player probed the room for 12
turns; the goal never completed (0/1). Confirmed failures, with transcript evidence:

- **The chest never yields its contents** — across FIVE attempts (open / peer / look inside). Responses
  were a bare echo ("it stands open now"), a generic room-survey ("Ways lead off east and south"), a
  NAT20 non-sequitur ("It comes off cleanly; the moment turns toward you"), and a NAT1 that *invented a
  "concentration breaks" mechanic* to punish looking in a chest. **This is why the goal never completes:
  the engine has no narration path from "look inside container" → the container's contents.**
- **"Look around" returns the identical NPC-roster dump 3× verbatim** (turns 1, 8, 12) — the canned
  settlement-overview (meta path) leaking into the DM channel as a name-by-name checklist.
- **State-desync + free-action on exit (turn 10):** "step out through the way to the open air" rolled a
  DC check (free movement shouldn't roll) AND narrated going outside while `scene.interior` stayed set
  (the DM lied about the player's location). Both deterministic oracles fired — real bugs.
- **Room state bleeds outdoors (turn 12):** after "exiting," the bedroom furniture (pallet, lantern,
  chest) was narrated sitting outside in the dirt. Broken world model.
- **Judge over-fires ~30%** (co-fires 3–5 criteria on one root cause) — but the underlying failures are
  REAL; the over-firing inflates the count, it does not invent findings.

## Fix queue (prioritized by leverage)

| # | Fix | Lane | Status |
|---|---|---|---|
| 1 | **Container contents routing.** "open/peer/look inside" a present container must deliver its contents (from `room.contents` / furniture def) or say "empty" — never a room-survey or a roll. Highest leverage; it's what blocks the goal. | ENGINE (`playloop.js` interaction routing ~2369–2385, `room.contents`) | **DONE 2026-06-24** — `containerContents` (deterministic, seeded; `generateFurniture.js`) + `tryContainerReveal` + open-path reveal in `playloop.js`; test `tests/U256`; verified live (run `13-59-34`, the chest reveals in one action). |
| 2 | **Free movement must not roll.** "step out / step out through the way / step outside" must route to the interior-exit path (`interiorAction.kind==='exit'`, playloop ~1046), never `resolve()`. Same class as the proven `step inside` fix in `inferInteriorAction` (~3152), but the compound phrasing ("…to explore the rest") needs care not to over-match. | ENGINE (`inferInteriorAction`) | **DONE 2026-06-24** — `inferInteriorAction` now classifies compound/bare "step out …", "out the door", "to the open air"/"into the open" as `kind:'exit'`, guarded against the "step out of line/turn" idioms. Fixes #2 AND #3 (one bug). Test `tests/U257`. |
| 3 | **Commit interior state on exit.** If an EXIT intent resolves with a valid exit, `scene.interior` MUST be null in `after` — the narration claimed outside while state stayed inside. | ENGINE (`exitStructureInterior` / the exit path) | **DONE 2026-06-24** — same fix as #2; once classified as exit, the existing exit path resolves with no roll and clears `scene.interior` (verified null in `after`). Test `tests/U257-A/B`. |
| 4 | **Kill the meta-roster leak.** "look around / get my bearings" inside a room should route to the DM describing the physical space, not `handleMetaQuestion`'s canned NPC-roster overview. | ENGINE (meta-question routing) | **DONE 2026-06-24** — `buildLocationSurvey` inside an interior now describes the room's furniture (varied lead, no byte-identical repeat) instead of the settlement roster; the roster stays for OUTDOORS + explicit who's-here PRESENCE questions (`opts.presence`). Tests `U93-S6/S7`; `U161` updated (this supersedes its old "name NPCs inside" assertion). |
| 5 | **Judge firing discipline.** One root flaw should fail 1–2 criteria, not all. | HARNESS (`qualityJudge.js`) | **DONE 2026-06-24 (real fix)** — `judgeSession` now judges each criterion in its OWN focused call (6 isolated calls/session, fixed cost; Autorubric/RULERS halo guard), each with a calibrated PASS-anchor so an isolated axis doesn't hunt-to-fail. Verified by a controlled A/B (same frozen transcript through both judges, isolating the judge change from player non-determinism): quality findings **17→11/12 (~30% drop)**, max single-turn co-fire **4→3**, turns failing ≥4 criteria **2→0**, the real chest-failure signal intact. Note: a naive per-criterion judge (no anchors) made it WORSE (16→20) — the anchors are load-bearing. The earlier "worked example" was the soft fix; this is the real one. Hermetic `qualityJudge.test.js` updated + green; full suite green. |

> **Probe-room is now blocked by #4, not #1** (run `harness-2026-06-24-13-59-34.md`). With the container path fixed, the live goal still reaches 0/1 because "look around the room" returns the NPC-roster dump (#4) instead of the room's furniture — so the LLM player never learns the chest/basin are there, runs out of known objects, and wanders out the door (#2/#3) before probing the room. The engine **can** complete probe-room on tallow when the objects are actually probed (hermetic test `U256-G` proves it). **#4 is the next leverage point for this goal.**

## Why #1–#4 are queued, not hand-fixed
They are intricate interior/container/meta routing in `playloop.js` (~7.4k LoC). A wrong regex over-matches
and is NOT caught by the suite (narration/routing is LLM-exercised), so an unattended blind edit risks a
silent play regression. The safe paths: the **gated auto-fix loop** for the deterministic free-action seam
(#2), and a **careful engine session / Codex** for the routing+state ones (#1, #3, #4). The harness now
reliably reproduces all of them with the full-transcript log, so each is verifiable before/after.
