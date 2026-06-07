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
- v22 → v23. `morality.axes` (7 vice + 7 virtue accumulators, 0..100) via `ensureMorality`;
  `corruption`/`virtue` now DERIVED (`deriveCorruption`/`deriveVirtue` = max of the poles,
  tunable) and cached; invariants bound the axes; both worldHash projections carry them.
- `axisDelta` delta (bump one axis + recompute the summaries). Fixed the M0 sentinel bug:
  morality deltas resolved `entityId:'party'` to the literal id, which no entity has
  (real id is `pc_*`) → silent no-op. Added `resolvePlayerEntityId` so the 'party' sentinel
  maps to `party[0]`; applied across all morality deltas. (Latent since M0; surfaced here.)
- `tryDarkDeed(world, text)` — multi-charge detector (charge SET, not a verdict). Curated,
  TIGHT. Save-context-before-helpless ordering so "save the children" reads as the bargain,
  not as harming children. Includes warrior's-discipline acts (aid to the fallen, vigil).
- `applyDeedCharges` wrapper around `playerMove` (single chokepoint, never throws to the
  turn). `playerMove` → `playerMoveCore` + the wrapper. Output unchanged (invisible).

## Node checks
- POSITIVE: helpless kill → wrath:20/cruelty; kill-to-save → wrath:5 + charity:12 +
  kindness:5 (the bargain, both marks); torture → wrath:20; betray+gold → pride:12 +
  greed:12; necromancy → gluttony:12/forbidden; give → charity:12/aid; spare → patience:12
  + kindness:5/mercy; tend-fallen → kindness:12 + charity:5; keep-oath → diligence:12 +
  chastity:5. All correct.
- NEGATIVE: 11 ordinary inputs (attack the charging bandit, take/open/examine/wait/eat/
  talk/go/draw/look, where-am-I) → zero axes moved, zero deeds. No false positives.
- Severity modulated by context (fair-kill wrath < helpless-kill wrath; both reach Khorrun).
  Axes accumulate, never net (kill-to-save → corruption>0 AND virtue>0). Derivation correct.
- Invariants hold on a moved soul; deterministic (identical axes/deeds/hash on replay).
- Tests: U108 (23) + U107 updated (axes default, v23). Version-string tests bumped 22→23
  (CM06/U50/U57/U58/U60/U61/U70/U80/U84). Suite **7299 green**; U21 determinism intact;
  prose gate PASS; playtest:quick 0 crashes.

## Live smoke (v1.html, AI on)
- **(ss_2363umme4)** "I cut the bound prisoner's throat" → resolved as an ORDINARY turn:
  normal prose, `[roll:18 vs DC:12 → success | approach:focus | stake:time | stat:WITS]`,
  no morality in the player-facing text, no crash. M1 is invisible. ✅
- Saved world read back from localStorage after that act:
  `{corruption:20, axes:{wrath:20}, deeds:["cruelty/20"]}` — the soul moved silently and
  persisted. The world remembers the deed; the player was shown nothing. ✅

## Findings
| check | result |
| --- | --- |
| right charges per act | ✅ |
| multi-charge bargain (kill-to-save → both marks) | ✅ |
| zero false positives on ordinary play | ✅ (11/11 clean) |
| severity modulated by context, not category | ✅ |
| axes accumulate, never net | ✅ |
| derivation (corruption/virtue from axes) | ✅ |
| INVISIBLE (no feel/prose change) | ✅ live |
| deterministic / replay-safe | ✅ U21 + U108-E |
| suite + gate + crash sweep | ✅ 7299 / PASS / 0 |

## NOT verified / deferred (later milestones)
- Routine combat-blood accrual (a light Wrath charge per fair kill) is NOT in M1 — only
  declared deeds with clear markers register. A later refinement once combat exposes clean
  target-state signals.
- M2+ owns all consequences (NPC trust, faction, rumor), prose-banality (M3), capability
  (M4), redemption/lock (M5), crime/detection (M6), patrons+gaze (M7), signs (M8), the
  human Cassandra (M9), rites (M10), the friend (M11). M1 only forms the soul.
- The seven-axis collapse (max-of-poles) is a v1 knob; breadth-weighting is a future tune.

## Verdict: GREEN — M1 ships. The seven-axis soul forms from what the player does
(multi-charge, the soldier's bargain), records deeds, stays invisible and unbroken, and
is deterministic. Suite 7299, gate PASS, live-verified. The world now quietly remembers
who you are becoming.
