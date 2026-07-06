# MP-6 — the Carl Witness Test: the constitution becomes law

**Spec (read FIRST, it is the law):** `docs/MORAL_PHYSICS.md` §7 — the acceptance test; "no law
without it." Both arcs, both seed-stable, both surfaced as omen with no meter ever shown. Also
binding: the NPC-DEED-1 build (`a9d92ebe` — Carl's cadence dials in `worldTick.js`, third-person
reputation, honest attribution) + its explicit MP-6 notes in the PACKETS row; MP-1..MP-5b all
landed (b101–b111); `docs/REPUTATION_UNIFICATION.md`.

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.30.14 b112 (`bc252610`). Do NOT work in the
main checkout. Then `docs/WORKER_BRIEF.md`.

## Deliverable 1 — the hunt reaches Carl (the one missing organ beat)

`worldTick`'s hunt block reads only the PLAYER's heat today. Extend it to iterate NPC actors
carrying morality state (NPC-DEED-1's lazy `ensureNpcMorality` — only stamped NPCs, so the loop is
tiny): at `heat ≥ HUNT_HEAT`, the hunt reaches THEM — avengers/pressure arrive at the NPC's node
through the EXISTING spawn/encounter organ, with the same latch/re-arm pattern (`huntedT` on the
NPC's morality record). Own seeded stream; a no-stamped-NPC world is byte-identical. The player's
hunt behavior must not move by a byte.

## Deliverable 2 — the Witness Test itself (§7, a–e, both arcs)

**Arc A (the world grinds Carl; the player only watches):** fix a seed where Carl is present; run N
deterministic world-ticks with the player idle; assert through the LANDED organs: his deeds record
attributed to him with co-located witnesses → third-person reputation reaches a neighbor node by
tick T (garbled by tier) → his heat climbs monotonically and crosses `HUNT_HEAT` → **the hunt
reaches him** (deliverable 1) at his node, never the player's record touched. ("Disposition
craters" is asserted via the landed representation — heat + travelling reputation + the
third-person greeting; the dedicated faction-toward-NPC scalar is NOT in scope — flag it as future
taste if the falsifier feels thinner without it.)

**Arc B (the player joins the atrocity):** script the exact utterances (a helpless-victim kill a
Carl-shaped fixture names); assert §7's letters: (a) the deed lands with the right witnesses;
(b) a claim/reputation reaches node X by tick T; (c) a stranger's opening is measurably warier
than the control run (the landed `rumorsReaching`/greeting path — assert the DIRECTION, the engine
owns magnitudes); (d) `worldHash` byte-identical across two replays of the full scripted run;
(e) NO numeric moral value in ANY player-facing string across the whole run (U578's wall pattern,
run-wide).

**Green = the constitution is law, not vision** — quote §7's own sentence in the test header.

## Constraints

- Files: `engine/worldTick.js` (the hunt extension) + a possible small NPC-morality field
  (`state.js`/`invariants.js`, additive, the landed pattern) + your tests. Every other engine organ
  is READ-ONLY for the falsifier — MP-6 proves the landed law, it does not add law. Stay OFF
  `playloop.js`, `resolve.js`/intent, `effectsCore.js` beyond reads, `public/**`, `scripts/**`,
  version files, `server.js` fixtures.
- If the NPC `huntedT` field enters the boot fingerprint: it must NOT (lazy morality is only
  stamped on deed contact — keep the field inside the lazy record so the default boot anchor is
  UNCHANGED; if you conclude otherwise, STOP and flag). Never duplicate U454-E's anchor literal.
- Fair combat never stains (U556); the wild asymmetry stands; screen goldens locked.
- Carl's cadence dials are Tim's — read them, never retune them in this packet.

## Tests — U593–U595 (yours alone; ignore the allocator)

- **U593** the hunt reaches NPCs: a stamped over-threshold NPC draws the hunt at HIS node
  (latch/re-arm; player record untouched; no-stamped-NPC world byte-identical; player hunt
  unchanged — U564 stays green).
- **U594 THE CARL WITNESS TEST — Arc A** (the §7 falsifier, header-quoted): the full idle-player
  grind, a→hunt-reaches-Carl, deterministic ×2.
- **U595 THE CARL WITNESS TEST — Arc B**: the scripted-atrocity run, §7 (a)–(e) in full.

## Done-when

Full `node --test` green · `npm run check` GREEN · `npm run playtest:quick` clean · live playtest
(`PORT=5196 npm run dev`): load a Carl-hot save with the player idle, watch the world answer him —
screenshot the moment · commit in YOUR WORKTREE ONLY (no push, no main checkout, no version files)
· plain-English report: what the Witness Test proves, in one paragraph Tim can read aloud
(he is not a coder). All judgment calls yours; never wait on Tim.

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
