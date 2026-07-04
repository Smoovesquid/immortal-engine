# NODE-DESYNC-1 — movement can never change your node (the law's enforcement point)

**Model:** Opus (deep playloop lane). **Lane:** SERIAL — playloop is a competence hot file; nothing else
may touch it while you run. **Your tests: U403–U406.**
**Spec of record:** `docs/PACKETS.md` → NODE-DESYNC-1 (top of ACTIVE) + `docs/POSITION_AS_CANON.md` §3
(THE MOVEMENT LAW, revised 2026-07-04-pm). Read both first.

## The law you are enforcing (Tim, 2026-07-04)

**Self-powered movement is ≤ 6 cells (30 ft) per turn — with no other mechanism.** A movement command
must be *structurally unable* to change `map.currentNodeId`, silently or otherwise. Node-scale travel
survives ONLY as the explicit journey verb (DM-mediated fast travel; its risk premium is packet JR-1,
NOT yours — but the routing separation IS yours).

## The live bug (reproduced 2026-07-04, v0.28.9, pre-rolled Bryn Holt boot)

1. _"I get up and walk out to the hearth room."_ → trivial-gate auto-success, **no move** (trivial
   leading clause + unrecognized named-room movement remainder — the INT-4a class).
2. _"go to the hearth room"_ → treated as TRAVEL, narrated **"It falls short here in The Greenwood, and
   you're left where you started."** — but `map.currentNodeId` **FLIPPED n0 (Aldermere) → n1 (The
   Greenwood)** while `scene.interior` stayed the Aldermere cottage. The narration is false twice: a
   move happened, and "where you started" was Aldermere.
3. Interior named-moves keep "working" in the stale building (pantry → scullery at a node you're not at).
4. _"look around"_ → **"You're inside The Greenwood."** And because `nodeRoster()` keys occupancy off the
   current node, EVERY presence read (`occupantsOfRoom`, `outdoorOccupants`, `getRoomState`) returns
   empty from the flip onward — the CG-1b empty-canon signature.

## Scope — four pieces, one packet

1. **LLM-off repro FIRST** (bug protocol): a script (`scripts/_repro_*.mjs` pattern) driving the exact
   three utterances above against the pre-rolled/tallow boot, printing `currentNodeId`,
   `scene.interior.structureKey/roomId`, and the mech line per turn. Determine WHICH path fired for
   "go to the hearth room" (parseIntent floor vs. Haiku ears vs. a travel/destination matcher inside
   playloop) — the fix must hold on BOTH the LLM-off floor and the LLM-on path.
2. **Root + fix the node commit.** Find where a movement-shaped input reaches node-travel resolution and
   where the node move commits despite a failed roll (commit-then-narrate-failure, or a wrong-target
   match against the node list — "hearth room" should never have matched Greenwood). After the fix:
   - While `scene.interior` is set, movement input NEVER reaches node-travel. Named-room targets ("go to
     the hearth room" / "walk out to the hearth room") resolve on the INTERIOR room graph (the positive
     path — same named-move narration `baf1b51` established: "You step through into the hearth room.").
   - Outdoors, directional/local movement stays local (existing local-walk behavior); a FAR-place target
     ("go to the Greenwood") routes to the EXPLICIT journey handler as its own intent — never as a
     side-effect resolution of a generic move, and never committing on a failed roll.
3. **The invariant** so this class can never sleep: `scene.interior` set ⇒ the interior structure's node
   == `map.currentNodeId` (`engine/invariants.js`, `assertWorldInvariants` — throws). Add safe handling
   for legacy saves that are ALREADY desynced (ensureWorld repair: clear the stale interior or restore
   the node — pick the least-destructive repair, document it; a hard throw on old saves is not
   acceptable).
4. **Honest narration:** if no move happened, the line must not claim you moved; if a move happened, the
   line must not claim you didn't. (The repro's turn ② produced both lies in one line.)

## Watch out

- **Corpus/tests that assert the old behavior** (directional or "go to X" inputs that node-jump): relock
  deliberately per the DLG-1/C16-001 precedent and DOCUMENT each relock in your report. `npm run
  convergence` must exit 100%.
- **Determinism:** U19/21/22/27/30 replay equality; no `WORLD_VERSION` bump (schema untouched; the
  ensureWorld repair must be shape-preserving); rng.js only.
- **playloop.js is ~7.4k lines** — grep to locate (travel/journey/destination matchers, the movement
  seams near `dxFt/dyFt` ~:4148, `classifyTrivial`, the INT-4a compound seams), read slices, never the
  whole file.
- The AG-4 brief (`docs/briefs/AG-4-pointed-questions.md`, PARKED) overlaps this file — it is NOT running;
  you have the playloop lane exclusively.
- Version: patch-bump `package.json` +1 from current and `public/v1.js` title + build line (+1 build,
  today's date, label like `movement never node-jumps`).

## Done-when

- The repro script shows: turn ② leaves `currentNodeId` unchanged and resolves interior-side ("You step
  through into the hearth room." or an honest interior answer); turn ① no longer eats the movement
  clause (moves, or honestly says what it did); "go to the Greenwood" from OUTDOORS routes to the journey
  verb explicitly (journey behavior itself unchanged — JR-1 adds the premium later).
- U403–U406: repro-locks for the three utterances + the invariant (a hand-built desynced world throws;
  ensureWorld repairs a legacy desynced save without throwing).
- `npm run check` GREEN (suite + convergence + determinism); `npm run playtest:quick` clean.
- One local commit on your branch (do NOT push); changelog + PACKETS row updated in the same commit.

## Report (plain English for Tim, ALWAYS)

What was broken (saying "go to the hearth room" secretly teleported you a region over while the game
still thought you were in the cottage — and from then on every room read as empty), what changed (your
legs can only ever carry you 30 feet a turn; big travel only happens when you explicitly ask to journey;
the world now *crashes loudly in dev* if the two position truths ever disagree again), why it matters
(this one bug was silently poisoning who-is-here answers everywhere — the ghost-town feeling).
