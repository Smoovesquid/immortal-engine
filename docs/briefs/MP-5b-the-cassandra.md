# MP-5b — the Cassandra: one person says the hard thing, once

**Spec (read FIRST, it is the law):** `docs/MORAL_PHYSICS.md` §5: "The Cassandra fires at the
T2→T3 boundary — a person who sees you clearly and says the hard thing once, plainly, and can be
waved off (the Creator's quiet register; heeding is the drama)." Voice sources: MORALITY_SYSTEM's
manifest-karma register + MP-5a's landed vocabulary (`engine/morality/omenVocabulary.js`).
Predecessors to study: MP-3's `huntedT` latch (worldTick), MP-5a's read-only surfacing
(`narratorContext.js` → `llmAdapter.js`, the omen-line idiom).

**Step 0 (mandatory).** Worktree branches from `main`, ~900 commits stale: `git fetch origin &&
git reset --hard origin/v2-polish`; confirm HEAD ≥ v0.30.11 b109. Do NOT work in the main checkout.
Then `docs/WORKER_BRIEF.md`.

## The interpretation (pinned at cut — flag if you disagree, don't silently deviate)

"At the T2→T3 boundary" = the APPROACH BAND: the Cassandra fires once when the actor's heat ENTERS
`[HUNT_HEAT − CASSANDRA_MARGIN, HUNT_HEAT)` — BEFORE the hunt, so heeding can still matter (cool
off, make amends, leave). If a single deed blows through the whole band and the threshold in one
turn, Cassandra + hunt on the same turn is acceptable fiction (the warning came as the hounds
slipped the leash). `CASSANDRA_MARGIN` = named constant in `engine/morality/escalation.js`
(starting calibration ≈ 8 — inside MP-3's decay horizon so a warned player CAN cool back out).

## Deliverable

1. **The latch:** worldTick detects heat entering the band → arms a ONE-SHOT Cassandra beat
   (additive state field, default 0, MP-3's pattern; invariant; re-arm only after heat falls below
   the band floor — a player who cools off and re-offends earns one more plain warning).
2. **The speaker:** a REAL present NPC chosen deterministically (seeded from world state; prefer a
   witness-trusted or story-anchored NPC at the player's node; if truly nobody is present, the beat
   HOLDS until someone is — the Cassandra is a person, never a voice from nowhere).
3. **The delivery:** one-time line in the DM system prompt (MP-5a's exact idiom): the named NPC
   "sees you clearly and says the hard thing once, plainly" — the Creator's QUIET register (no
   thunder, no sermon; MORALITY_SYSTEM's voice). The beat then CLEARS — it never repeats, the DM
   is told it is waveable, and no mechanical demand rides it (heeding is the player's drama).
4. **Hide-the-math:** zero numerics, zero mechanic names, in any prompt or player-facing string.
5. **LLM-off:** the base narration path gains a plain one-line rendering of the same beat (the
   silent-fallback law — the Cassandra exists without the API too).

## Constraints

- Files: `engine/worldTick.js` (the band detection — free lane), `engine/morality/escalation.js`
  (CASSANDRA_MARGIN + band helper), `engine/ai/narratorContext.js` + `engine/llmAdapter.js` (the
  beat surfacing — MP-5a's files, now free), `engine/state.js`/`invariants.js` (additive only),
  your tests. Stay OFF `engine/playloop.js`, `engine/effectsCore.js`, `engine/instrument.js`,
  `engine/npc/**` + `engine/scene/**` placement modules (OCC-STORY-2's LIVE lane), `public/map/**`
  (WILD-SCALE-1's live lane), `scripts/**`, `package.json` + `public/v1.js` (never bump versions),
  `server.js` fixtures.
- `rng.js` only, own seeded stream (no-moral runs byte-identical); if additive fields enter the
  fingerprint, re-pin U454-E with the living-anchor ritual + justify the sole delta — and expect
  Basecamp to recompute at integration if another packet lands ahead (it has happened twice today).
  Do NOT duplicate the anchor literal in your own tests (U579-01's lesson — assert what YOUR packet
  owns, not another test's pin).
- Screen goldens + `playtest:screen` stay locked.

## Tests — U583–U585 (yours alone; ignore the allocator)

- **U583** latch algebra: fires ONCE on entering the band; holds while nobody present; clears after
  delivery; re-arms only after cooling below the band floor; blow-through turn = Cassandra + hunt
  same turn allowed.
- **U584** the beat surfaces: a present, named, deterministically-chosen NPC; the quiet register;
  one turn only; ZERO numerics/mechanic names (U578's wall pattern); LLM-off fallback renders it.
- **U585** determinism wall: byte-identical replay of a scripted warned-then-cooled run AND a
  warned-then-hunted run; boot anchor per the ritual.

## Done-when

Full `node --test` green · `npm run check` GREEN · live playtest per `docs/PLAYTEST_PROTOCOL.md`
(drive heat into the band with the LLM on, meet your Cassandra, wave them off, then cross the line
and meet the hunt; `PORT=5191 npm run dev`) · commit in YOUR WORKTREE ONLY (no push, no main
checkout) · plain-English report: commit SHA, files, test counts, the actual Cassandra line you saw
live, and any deviation flags (Tim is not a coder — translate jargon).

## Standing conduct

All judgment calls yours; never wait on Tim; reversible option + flag when unsure.
