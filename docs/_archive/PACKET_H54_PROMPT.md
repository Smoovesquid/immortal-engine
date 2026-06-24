# H-54 packet — compound/meta-query answer-binding + rules-confirmation + declared-check (Claude-Sonnet, grace)

Paste everything below the line to the Claude-Sonnet worker. **Parallel with H-55 (Codex, combat lane) —
file-disjoint: you own ONLY `engine/grace/gracefulAdjudication.js` + `tests/U217...`. If your fix appears to
need `engine/playloop.js`, `engine/combat/*`, `engine/llmAdapter.js`, or `engine/resolve.js`, STOP and report.**

---

## Context

Opus gate `docs/playtests/opus-gate-2026-06-20-postH52-H53.md` (11/48) — the dominant cluster is the
meta-query answer-binding family (H-25/H-31/H-40 lineage) under four NEW shapes the Rules-Lawyer + Chaos
personas hit. All live in the `handleMetaQuestion` / `isMetaQuestion` layer of
`engine/grace/gracefulAdjudication.js`. The dispatcher is a sequential if-return chain where well-behaved
branches already fold compound sub-parts via `extras.push(...)` (see the `META_NAME` branch ~L920 folding
class/gear/HP, and `META_WEAPON_DAMAGE` ~L905 folding AC/purse) — your job is to close detection gaps, not
rebuild the pattern.

## Read first

- `engine/grace/gracefulAdjudication.js`:
  - `META_HEALTH` (~L162), `META_CHARACTER` (~L220), `META_STATS_REQ` (~L221), `META_NAME` branch (~L920,
    the compound fold using `META_HEALTH.test`), `mentionsCharacterClass`/`mentionsGearAsk` helpers.
  - `META_WEAPON_DAMAGE` (~L260), `answerWeaponDamage` (~L679), the `META_WEAPON_DAMAGE` branch (~L905).
  - `META_MECHANICS` (~L254), `META_MODIFIER_FORMULA` (~L277) — the existing rules-explainer detectors; R3's
    new rules-confirmation answer is a sibling.
  - `META_BARE_DC` branch (~L994) + `META_EXPLICIT_CHECK_A`/`META_EXPLICIT_CHECK_B` (it already defers to
    these when a check is declared — R4 widens them).
  - `isMetaQuestion` (~L341) — every `META_*` you add for R3 must be OR'd in here too, or the gate never
    routes to `handleMetaQuestion`.

## Four fixes, one packet

### R1 — compound query must include the HP part ("name, class, and current HP?")
`META_HEALTH` does NOT match bare "current HP" / "HP" in a list (verified:
`META_HEALTH.test("name, class, and current HP?") === false` — its `hp` alternatives all require "my hp" /
"hit points" / "hp total"). So the META_NAME branch's `if (META_HEALTH.test(lowerText)) extras.push(answerHealth)`
silently drops the HP half. **Fix:** add a small `mentionsHpAsk(lowerText)` helper (catches "current hp",
bare "hp", "hit points" appearing in a multi-part character ask) and use it for the compound FOLD in the
META_NAME branch (and the META_CHARACTER branch if it has the same fold) so HP is always answered when asked.
Do NOT loosen `META_HEALTH` itself for the standalone "am I hurt?" path — add the fold-only detector. Gate
phrasing to cover: *"...what's my character's name, class, and current HP?"* → answer must contain the real
current HP (13/13 in the test world).

### R2 — weapon-damage compound phrasing ("what damage does each deal?")
*"What's the AC or defense value on my Worn Blade vs the Kitchen cleaver — and what damage does each deal?"*
fell through to observe-only because `META_WEAPON_DAMAGE` (~L260) doesn't match "what damage does **each**
deal" (it keys on "damage on/of the <weapon>" / "how much damage" / "damage die"). **Fix:** broaden
`META_WEAPON_DAMAGE` to also catch "what damage does each deal" / "damage ... each ... deal" / "what damage do
they deal". `answerWeaponDamage` already folds multiple named weapons — confirm it lists BOTH the Worn Blade
and the Kitchen cleaver here. The player also conflates "AC on a weapon" (weapons have no AC) — answer the
damage and, if it's cheap, note weapons don't carry an AC; do NOT invent an AC for a weapon.

### R3 — a rules-confirmation question is answered straight, NEVER rolled (highest value)
*"With MIGHT 12 my modifier is +1 — so a hit with either blade is 1d6+1? Confirm that's the right mod."* and
*"Yes or no: do I add my MIGHT +1 to melee damage with these blades?"* currently match no `META_*`, so
`isMetaQuestion` is false and the turn is resolved as an ACTION (a d20 rolled vs DC13 — jarring; the second
matched a stat branch and just restated "MIGHT is 12, +1" without answering the damage rule). **Fix:** add a
`META_DAMAGE_RULE` / rules-confirmation detector ("do I add my <stat> to (melee) damage", "is a hit
1d6+1 / weapon die + mod", "confirm (that's) the right mod", "yes or no: do I add") and answer it from the
real rule the engine uses: state plainly that the ability modifier adds to a hit's damage (weapon die + the
relevant ability modifier — mirror the exact phrasing `answerWeaponDamage` already uses: "plus your ability
modifier on a hit"). Read the real modifier off the sheet so the number is correct. OR this detector into
`isMetaQuestion`. NEVER roll for it.

### R4 — a declared check gets a DC + resolution, not the bare-DC deflection
*"I sheathe the blade and roll WITS to read his face. What's the DC and what do I get?"* hit the `META_BARE_DC`
branch (~L994) and got "no standing DC — I set one when you commit," even though the player committed a
concrete check (roll WITS to read his face). The branch already excludes `META_EXPLICIT_CHECK_A/B`, but those
don't match this "roll <stat> to <action>" phrasing. **Fix:** widen `META_EXPLICIT_CHECK_A`/`_B` (or add a
sibling the bare-DC guard also checks) to catch "roll <stat> to <verb/action>" / "make a <stat> check to
<action>" so the bare-DC branch defers and the turn falls through to real action resolution. **Do NOT
implement the resolution yourself** — just stop the bare-DC branch from swallowing a declared check; the
existing resolution path handles it once grace doesn't intercept. If that turns out NOT to be true (the
declared check needs playloop/resolve changes to actually roll), STOP and report — that's H-55/Codex territory.

## Test plan — `tests/U217.metaQueryAnswerBinding.test.js` (U216 is the current highest)

RED-first. Build a minimal `world` with a party[0] carrying real stats (MIGHT 12 → +1), HP 13/13, and a
Worn Blade + Kitchen cleaver, mirroring existing grace test fixtures (find one via
`grep -l "handleMetaQuestion" tests/`). Assert against `handleMetaQuestion` / `isMetaQuestion` directly:
- R1: the name+class+HP compound answer **contains the HP** (e.g. "13"); a bare "am I hurt?" still works.
- R2: the weapon-damage compound answer names **both** weapons' damage; `isMetaQuestion` is true for it.
- R3: both rules-confirmation phrasings are `isMetaQuestion === true` and the answer states the damage rule;
  add a guard that a real in-fiction action ("I swing at the door") is NOT captured by the new detector.
- R4: "roll WITS to read his face — what's the DC?" is NOT answered by the bare-DC deflection (assert the
  output is not the "no standing DC" string / `isMetaQuestion` does not route it to bare-DC); a true bare
  "give me the DC" with no declared check still gets the deflection (regression guard).

## Done-when

1. U217 RED-first then green; existing grace meta-query tests (U163/U172/U203/U207 etc.) still green.
2. Full suite green (`node --test`); determinism U19/21/22/27/30 green.
3. `git diff --stat` shows ONLY `engine/grace/gracefulAdjudication.js` + `tests/U217...` (+ your changelog line).
4. Claim `[CLAIMED] H-54` in `docs/AGENT_CHANGELOG.md` before starting; replace with a full DONE entry after.
5. Claude-Sonnet: commit AND push your own work (still independently §7-verified after).

## Out of scope
- No `playloop.js` / `engine/combat/*` / `llmAdapter.js` / `resolve.js` edits (H-55 owns combat; halt if needed).
- Don't build new action-resolution; R4 is purely "stop grace from intercepting a declared check."
- No `WORLD_VERSION` bump, no `Math.random`/`Date.now`, no `effectsCore`/`invariants` changes.
