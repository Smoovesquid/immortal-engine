# Playtest — Full-Game Shakedown, Round 2 (2026-06-10)

**Build:** v2-polish · **Probe:** `scripts/probes/full-game-shakedown.mjs` (combat-aware scripted session: wake → social → explore → travel → ambushes → features → loot → rest → level → time)
**Persona:** crusty DM playing a whole session start to finish, four seeds.

## Verdict: GREEN after fixes — six findings, all closed

| # | Found | The DM-correct fix (shipped) |
|---|---|---|
| 1 | "rage" / "second wind" out of combat → **failed d20 rolls** ("the moment slips past you") | In-voice, free: *"Save it — there's no fight here to spend that on. It'll be ready when one finds you."* `[no-target]` |
| 2 | "use my strongest attack" / "strike the biggest one" with nobody around → meaningless adjudicated successes | Same no-target gate (extended person-words: biggest/big one/nearest) |
| 3 | Movement mid-combat ("head east") → **a sword swing** via the strike default | Table-talk redirect: *"There's steel between you and the road — no running from this one. Strike, guard, cast, or talk."* Also catches "flee" — escape fights are designed unfleeable, so the DM now SAYS so (and the status answer no longer advertises flee). |
| 4 | "rest up" mid-combat → sword swing | *"Not while something is trying to kill you. Finish this first."* |
| 5 | "loot the bodies" after victory → d20 roll + *"You take the bodies and stow it"* (narration falsehood; no inventory pollution, verified) | Honest and free: *"You already went through them when the dust settled — anything worth taking is in your pack."* |
| 6 | **The clock never moved** on free-roam hops; "what time is it?" said "early — first day" after 20 hops and a night's sleep | Hops cost 1 hour + 1 league; long rest rolls the clock to the next first light. Live transcript now reads *"It's evening — day 2 of your journey, 13 leagues behind you."* |

## The session it produces now (seed shakedown-1, abridged)

Wake → survey → outside → clarify-who → dialogue with Elske (want surfaced,
deflection, clean exit) → examine grounded against real furniture → ambush →
fight → victory +XP → second ambush → rest denied in the wild becomes a
breather → 20 hops with the light changing ("The light is going; shadows lean
long" now AGREES with the clock) → **LEVEL 2! +9 HP. New: Action Surge** mid-
journey → honest corpse-loot answer → evening of day 2, 13 leagues. No
crashes, no invariant violations, across four seeds.

## Verification

- UX2 grew 4 tests / 16 rows (feature-verbs-no-target, honest looting,
  combat redirects, the moving clock). Suite 7,405 green; playtest:full 500
  clean. Probe preserved at `scripts/probes/full-game-shakedown.mjs` for
  future rounds — run with any seed.

## Notes for future rounds

- Dialogue deflection on first ask ("changes the subject") is the trust system
  working, but a session-zero stranger deflecting EVERY topic reads stony —
  worth a warmth pass when dialogue gets its turn.
- "look around" mid-combat gives the location survey; a DM would describe the
  FIGHT. Cosmetic; combat status is one question away.
- Time now flows but nothing consumes night yet (no dark penalties — also the
  darkvision hook, still parked).
