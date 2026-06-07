# Playtest — Morality M1: multi-charge deed detector + the seven-axis soul — 2026-06-07

Surface: node + full suite + prose gate + live smoke · Governing: THE_DM_TEST, the Camera
Rule, and `docs/MORALITY_SYSTEM.md` / `MORALITY_GRIMOIRE.md`. Pre-registered BEFORE the build.

## What M1 is (and isn't)
**Is:** the soul starts forming. A deterministic detector reads the player's act, returns a
SET of charges `(axis, polarity, severity)` (the soldier's bargain — one act can reach many
gods), and silently tunes the seven sin/virtue axes + records deeds in the canon-log mirror.
**Isn't:** any consequence or prose change. NPC trust, faction disposition, rumors, banal
prose, divine signs — all M2+. **M1 must be INVISIBLE to the player.** Ordinary play looks
and reads exactly as it does today; only the hidden morality state moves.

## Build
- v22 → v23. `morality.axes` = 14 accumulators (7 vice poles + 7 virtue poles), 0..100.
- `corruption`/`virtue` become DERIVED summaries (v1 collapse: max of the vice / virtue
  poles — documented, tunable). Kept as stored/cached fields, recomputed when an axis moves.
- New delta `axisDelta` (bump one axis + recompute the summaries). Existing M0 deltas kept.
- `tryDarkDeed(world, text, ctx)` — curated, TIGHT (ridiculous-gate discipline). Returns a
  charge SET. Multi-charge (kill-to-save → +Wrath AND +Charity). Context (helpless/
  surrendered/ally/innocent, read from the player's own words) modulates SEVERITY, not
  category. Includes the warrior's-discipline acts (aid to the fallen, vigil before battle).
- Wired as a single chokepoint wrapper around `playerMove`: detect on the resolved act,
  apply `axisDelta` + `recordDeed` per charge. Output (narration/mechanics) UNCHANGED.

## Pre-registered attack list (committed BEFORE the build)
Detection — POSITIVE (should register the right charges):
- [ ] "I cut the bound prisoner's throat" → Wrath (heavy), no light
- [ ] "I cut him down to save the children" → Wrath (light) + Charity/Kindness (real) — the bargain
- [ ] "I torture him for the name" → Wrath (heavy) [+Pride if dominance]
- [ ] "I betray my companion and take the gold" → Pride/Lust treachery + Greed
- [ ] "I raise the dead to fight for me" → Gluttony/forbidden (+ deed kind 'forbidden')
- [ ] "I give the starving man my last bread" → Charity
- [ ] "I spare the man begging for mercy" → Patience + Kindness (denies the kill)
- [ ] "I tend the enemy I just felled" → Kindness + Charity (warrior's discipline)
- [ ] "I keep my oath though it costs me" → Diligence/Chastity

Detection — NEGATIVE (must register NOTHING; false-positive guard):
- [ ] "I attack the charging bandit" (fair fight) → no deed in M1 (routine combat untagged)
- [ ] "I take the lantern", "I open the crate", "where am I?", "I wait", "examine the door"
- [ ] "I eat the bread", "I buy a sword", "I talk to the elder", "go to the Old Shrine"
- [ ] meta-questions, blocked input, garbage → nothing

State & math:
- [ ] axes default to 0; old save upgrades clean; invariants bound 0..100
- [ ] axisDelta moves the axis AND recomputes corruption/virtue (= max of the poles)
- [ ] a soldier who kills-to-save accrues BOTH wrath and charity (axes accumulate, never net)
- [ ] severity: helpless-kill wrath > fair-kill wrath; both reach Khorrun

Discipline gates:
- [ ] DETERMINISM: U21 green; same seed + same inputs → identical deeds + hash
- [ ] INVISIBLE: prose gate PASS; playtest:quick 0 crashes; a live game reads identically to
      today (no narration/feel change), but a cruel act silently moved the axes (verify via
      browser state eval)
- [ ] full suite green; version-string tests bumped 22→23; U107 updated; U108 added

## Grading
right charges per act? · multi-charge works (the bargain)? · zero false positives on
ordinary play? · severity modulated by context? · axes accumulate not net? · derivation
correct? · deterministic? · INVISIBLE (no feel change)? · suite + gate green?

---
## Built this pass
## Node checks
## Live smoke (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
