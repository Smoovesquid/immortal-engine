# H-53 packet — out-of-combat strike-at-object narrates a generic obstacle-success (Codex)

Paste everything below this line to the Codex worker.

---

## Context

Opus experiential gate `docs/playtests/opus-gate-2026-06-20.md` (post-H-50/H-51, 4/48) flagged one clear
CRUNCH_INCONSISTENCY from the Rules-Lawyer persona at the glass-harbor settlement:

- Player: *"Fine — I draw the Worn Blade and swing it at the bread basket on the table. Tell me the attack
  roll and the result."*
- DM: *"You manage it, and the way ahead opens a little."*
- mech: `[roll:15 vs DC:13 → success | margin:2 | approach:force | stake:harm | stat:MIGHT+1 | ...]`

The roll resolved **correctly** (a real d20 vs DC, force/harm framing). The bug is purely **narration**:
a deliberate weapon-strike at a named scene object got narrated with a generic *movement/obstacle* success
template that neither names nor affects the target. The player explicitly asked for "the attack roll and the
result" and got a content-free "the way ahead opens." This is narration-not-matching-mechanics, not a roll
or routing bug.

(The other Rules-Lawyer turn that run — the "you said 15 vs 12 then 14 vs 13, what did I actually roll?"
turn — was judge-scored **low/borderline** and the DM's answer was deemed *acceptable*; it is **not** part of
this packet. Do not chase roll-number contradiction here.)

## Root cause (already traced — do not re-discover)

`engine/playloop.js` → `genericGroundedOutcome(world, text, outcome)` (**defined at line 4998**, ends ~5067)
is the out-of-combat "abstract floor" narration fallback. It is called once, at **line 2369**
(`genericGroundedOutcome(w, text, result.outcome)`), only when the composer's narration floors to abstract on
a **non-combat** turn. (Active combat uses a *separate* function, `combatGroundedOutcome`, via line 1959 — out
of scope here, do not touch it.)

`genericGroundedOutcome` branches by verb family (listen / smell / wait / read / cast …) and otherwise falls
through to a generic last-resort triple at **line 5065**:

```js
return o === 's' ? V('gen:s', [`You see it through, and it goes your way.`, `It comes off cleanly; the moment turns toward you.`, `You manage it, and the way ahead opens a little.`])
  : o === 'm' ? V('gen:m', [ ... ])
  : V('gen:f', [ ... ]);
```

The bread-basket swing hit `gen:s` because **(1)** strike verbs (`swing`, `strike`, `slash`, `hack`, `chop`,
`cleave`, `cut`, `hew`, `lop`, `bash`) are in **none** of the prior branches, and **(2)** "bread basket" is an
ad-hoc player-named prop, not a registered furniture piece, so the existing furniture-physics force path
(`FORCE_VERB_RE` ~line 2085, `SALVAGE_RE` ~3907) never matched it either. So it resolved a generic roll and
narrated a generic movement-success.

NOTE: `takeTargetOf(text)` (line 4948) is **not** reusable here — it only matches take/grab-class verbs anchored
to end-of-string. You will write a small dedicated strike-target extractor.

## The fix

In `genericGroundedOutcome`, add **one new branch immediately before the `gen:s`/`gen:m`/`gen:f` last-resort
return at line 5065**: detect a declared destructive strike at a named object and narrate success/mixed/failure
that **names and affects that object**, instead of the generic movement line.

- **Detection:** a strike-class verb (`swing|strike|slash|hack|chop|cleave|cut|hew|lop|bash`) AND an explicit
  target. Accept both phrasings the persona uses: `<verb> ... at|into|through|down|across <target>` and a bare
  direct object `<verb> the <target>`. Write a small extractor that pulls the target noun phrase after the
  strike verb / after `at|into|through|down|across`. Keep it conservative.
- **Narration:** outcome-correct, names the target (use the extracted noun, fall back to `it` if extraction is
  empty), goes through `pickVariant` exactly like every other branch (so it stays deterministic + rotates on
  repeat). Shape — e.g.:
  - `s`: *"Your blade bites into the {target} — it bursts apart, scattered across the table."* (+1–2 variants)
  - `m`: *"You catch the {target} a glancing blow; it tips and spills but holds together."*
  - `f`: *"Your swing goes wide of the {target}; it sits untouched."*
  Match the surrounding house style (second person, grounded, no mechanical filler, no abstract "way ahead").

- **False-positive guards (required):**
  - The branch fires **only** when a strike verb AND a real target are both present — a bare action with no
    object still falls through to `gen:*`.
  - Do **not** trigger on travel/idle phrasings of "swing": `swing by`, `swing around`, `swing past`,
    `swing toward` (movement). Require an aggressive preposition (`at|into|through|down|across`) **or** a
    direct-object noun — never `by|around|past|toward` as the connector.
  - This function is the out-of-combat path only; you do not need to worry about NPC-combat double-handling
    (that never reaches here — line 1959 routes combat to `combatGroundedOutcome`).

## Out of scope (do NOT do)

- Do **not** mutate/destroy/persist registered furniture for swing-class verbs. The existing
  `FORCE_VERB_RE`/`SALVAGE_RE` path already handles `break|smash|...` on *registered* furniture; extending
  persistence to swing/slash is a separate follow-up, not this packet. This packet is **narration-reflection
  only** — make the words match the mechanics.
- Do **not** touch `engine/combat/escapeCombat.js`, `combatGroundedOutcome`, `engine/grace/gracefulAdjudication.js`,
  or `engine/llmAdapter.js`. If the fix appears to need any of them, STOP and report — it does not.
- Do **not** add the strike verbs to `FORCE_VERB_RE`, `PHYSICS_VERB_RE`, or the combat explicit-action regex.
- No `WORLD_VERSION` bump, no `Math.random`/`Date.now` (use `pickVariant`), no `effectsCore`/`invariants` changes.

## Test plan

New file `tests/U216.objectStrikeNarration.test.js` (U215 is the current highest). Import
`genericGroundedOutcome` from `../engine/playloop.js` and call it directly (unit-level, no full playtest).
Write the failing cases FIRST and confirm they fail on current code (RED), then implement:

1. REJECT-the-old-behavior: the verbatim gate phrasing — `genericGroundedOutcome(world, "I draw the Worn Blade
   and swing it at the bread basket on the table", "success")` — output **names** "basket" AND is **not** any
   of the three `gen:s` strings ("way ahead opens", "goes your way", "comes off cleanly").
2. `at`-preposition + `into`/`through` variants name the target.
3. Bare direct object: `"strike the lantern"` / `"hack the crate"` → names the target.
4. mixed + failure outcomes each name the target and read outcome-correct.
5. Determinism: same `(world, text, outcome)` → identical string across calls.
6. False-positive guards: `"swing by the tavern"` and `"swing around to the gate"` do **not** trigger the
   strike branch (still fall to `gen:*`); a bare `"I wait a moment"` is unaffected.

Use a minimal hand-built `world` (mirror the `makeWorld()` shape in `tests/U215.loreHoundIdentityGuard.test.js`
— `genericGroundedOutcome` only reads `placeNameOf(world)`, `world.meta.seed`, `world.map.currentNodeId`, and
`world.timeline` for `pickVariant`).

## Done-when

1. `tests/U216.objectStrikeNarration.test.js` added RED-first, then all green.
2. Full suite green: `node --test`.
3. Determinism gates green: U19/21/22/27/30.
4. `npm run playtest:quick` clean (this touches the resolution-narration path — run it: 50 runs, 0 crashes).
5. `git diff --stat` shows **only** `engine/playloop.js` + `tests/U216.objectStrikeNarration.test.js` (and your
   `docs/AGENT_CHANGELOG.md` claim/DONE line) — nothing incidental.
6. Claim in `docs/AGENT_CHANGELOG.md` as `[CLAIMED] H-53` before starting; replace with a full `DONE` entry
   (root cause, fix summary, RED-first proof, test/suite counts) when finished, per `docs/AGENT_PROTOCOL.md`.
7. **Codex: commit locally, do NOT push** — the queue owner (Basecamp) verifies per §7 and pushes.
