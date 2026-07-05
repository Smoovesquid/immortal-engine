# SL-5 live-verify — Aldermere's curated worry + cold-open

**Date:** 2026-07-05
**Server:** own worktree, `PORT=5279 node server.js` (never `:5179` — Tim's live save lives there)
**LLM state:** OFF by construction — no `.env` file present in this worktree, `hasLlmKey()` false,
so every response below is the deterministic engine floor, not an API-augmented narration.
**Seed:** `aldermere` (SLICE_SEED) — this run's seed-chosen worry: **the chapel bell** (Hollowed
Chapel entry; a different seed is free to land on the Greenwood-road entry instead — see U488's
determinism test for both entries reachable).
**Driven via:** the real HTTP path a browser client uses — `POST /api/auth/register` →
`POST /api/worlds` (saves a freshly `beginAdventure`-booted slice world) → `POST /api/move` × 2
(the real player gesture, not an internal function call).

## (a) Cold-open — the worry voiced unprompted, before the player asks anything

This is the FIRST narration the player reads, straight off `beginAdventure` (no move needed):

> Wizard: Light the colour of watered milk lies across the floorboards. Your room; your blanket,
> heavy and warm. Beyond the shutters the village is clearing its throat — a door, a dog, a bucket
> set down on stone. Nothing in the morning suggests it will be anything but ordinary. Down past
> the shutters somebody's talking low about the chapel bell — it rang Tuesday, they say, and
> nobody's set foot up there to ring it in a year. Nobody's laughing about it. What do you do?

## (b) `POST /api/move` — "what's troubling folk here?"

Request: `{"worldId":"sl5verify1","action":"what's troubling folk here?"}`

Response narration:

> Wizard: The Hollow says the chapel bell rang Tuesday, and nobody's rung it in a year.

Response mechanics: `[place-history → grounded | what folk here need, no roll]`

Names the SAME seed-chosen danger the cold-open voiced (the chapel bell) — asked again in the same
session, it would answer identically (stability asserted by U488).

## (c) `POST /api/move` — "I'll look into it"

Request: `{"worldId":"sl5verify1","action":"I'll look into it"}`

Response narration:

> Wizard: You set yourself to it — you'll find out chapel bell. Carl marks your word.

Response mechanics: `[goal:born | learn]`

Response `state.goals`:

```json
[
  {
    "id": "goal_0",
    "kind": "learn",
    "targetRef": "learn:chapel bell",
    "label": "Find out chapel bell",
    "status": "active",
    "createdAt": 1,
    "completedAt": null
  }
]
```

**No quest banner, no menu, no enumerable list surface.** The player typed one sentence; the engine
answered in one sentence; the goal that landed in `world.goals` is the SAME worry named in (a)/(b) —
`targetRef: "learn:chapel bell"` matches the curated worry's own `target: "the chapel bell"` field
(article-stripped by the pre-existing, unmodified `proposeGoal.js` `clean()` — the same treatment
every other `learn` goal in the engine already gets, confirmed against the `tallow` seed in the
report below; not a regression this packet introduced).

## Full session artifacts

- `state.scene.objective` after move (c): unrelated to the worry (scene objective is a different
  field, the pre-existing per-scene flavor line) — the actual tracked commitment lives in
  `world.goals`, exactly as D-B1 has always worked.
- No response body at any point carries an `objectives` (plural) field, and `output.narration` is a
  plain string on every turn — no-quest-log holds by construction (also machine-asserted by
  `tests/U489`).

## Byte-identical control checks (same server, same session)

- `tallow` boot: cold-open unchanged (verbatim generic bedroom line, no worry clause appended);
  `instrument.threads` carries only `["The Bridge Dispute"]`, no Aldermere worry.
- A `some-other-seed` generic boot: same — no worry vocabulary anywhere in the opener.

Both confirmed via `tests/U488`/`U490`'s automated byte-identical assertions, re-verified live in
this session against the running server.
