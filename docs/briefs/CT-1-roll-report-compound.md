# CT-1 — the roll-report half of a compound demand answers; codify the tier rider

**Model:** Claude Sonnet (grace lane). **Runs in PARALLEL with DS-1a** (file-disjoint: DS-1a is `playloop.js`
only). **Stay in `engine/grace/gracefulAdjudication.js` + `docs/DND_XCOM.md`** — if you find yourself needing
`playloop.js`, STOP and flag it (that's DS-1a's file).

## Context — the "give me the number" turns were never a law conflict
Fable's second-order diagnosis (`docs/briefs/SECOND_ORDER_DIAGNOSIS.md` §3) proved the hide-the-math law never
fired on the Rules-Lawyer's crunch demands. The engine already speaks raw dice on demand (`META_ROLL_QUERY:1777`
answers *"The ledger shows 14 vs DC 12 — success"*; `META_BARE_DC`, `answerSkillModifier`, `META_WEAPON_DAMAGE` all
report sheet numbers; `public/v1.js:1583` even shows `[roll:` lines on screen). The one real failure (RL-5) was a
**compound-drop**: *"give me the raw d20 and the damage die"* answered the damage-die half and dropped the
roll-report half — `META_ROLL_QUERY` never folded into the weapon-damage answer.

## Two workstreams

### 1. The compound fold (the bug)
- `engine/grace/gracefulAdjudication.js`: the H-59 typed compound-decomposition (`~:566–625`) and the stats
  compound fold (`~:1764`). A **damage×roll** compound ("raw d20 AND damage die") has no fold — the weapon-damage
  branch wins alone. Add the fold so a demand naming BOTH the roll and the damage die answers BOTH halves
  (the last roll's number+DC+outcome via `META_ROLL_QUERY`'s machinery, then the weapon damage die), mirroring the
  stats fold's shape.
- **`META_ROLL_QUERY` (`:541`) doesn't match "raw d20" phrasings.** Widen it minimally to catch "the raw d20",
  "the d20 result", "the actual d20/attack roll" — the numbers the player is asking for. Do NOT widen it into
  predictive territory (no "what's my hit chance").
- **Reachable mid-/post-combat:** RL-5 was a combat turn. Confirm the roll-report answer is reachable while
  `combat.active` (the `[combat:table-talk]` gate must let a pure roll-report question through to the meta answer,
  not swallow it). If the combat gate blocks it, note precisely where and route the meta-roll query through.

### 2. The tier rider (Option B — RULED; Tim delegated the call to Basecamp, Basecamp chose B)
Add ONE paragraph to `docs/DND_XCOM.md` §THE LAW (line 14) — **no behavior change**, just naming the line the
engine already walks so the gate judge stops mis-bucketing:

> **Tier rider (what "never the number" does and does not cover).** The law governs *predictive* numbers only.
> Four tiers: **(1) Sheet** — your dice, modifiers, HP, abilities → plain numbers on demand *(shipped)*.
> **(2) Resolved ledger** — your last roll, its DC, its outcome → plain numbers on demand; the mech line already
> shows them *(shipped)*. **(3) Predictive** — odds to hit, un-set DCs, enemy HP → **the read, never the number**
> *(the law's true and only domain)*. **(4) World-content quantities** — how many dead, how many exits, how many
> riders → fiction facts from canon, always answerable, deterministically sourced (V11: the world supplies the
> count, never the LLM). At a real table your sheet and your die are yours to see; the DM's screen hides the
> monster's HP; "how many goblins do I see?" gets a number because it's fiction, not math.

## Invariants — by reference
THE_DM_TEST + THE_TABLE_TEST. V11 — numbers come from the ledger/sheet, never LLM-invented. Determinism:
`rng.js` sole; `worldHash` stable; U19/21/22/27/30 green. LLM never throws. §0 never surfaced. **Do NOT touch tier
3 (predictive):** hide-the-math stays exactly as-is for odds/enemy-HP/un-set-DCs.

## Test plan
- **`tests/U317.rollReportCompound.test.js`** (pre-assigned, LLM-off): "give me the raw d20 and the damage die"
  (with a `lastRoll` set) → the answer contains BOTH the stored roll digits (number + DC + outcome) AND the weapon
  damage die; reachable with `combat.active`. Diverge: "what's my chance to hit?" → still the read, never a number
  (tier-3 guard); a single "what did I roll?" still answers as before.
- Existing meta/crunch corpus stays green; `npm run convergence` 100%.

## Done-when
`U317` green · `npm run convergence` 100% · `node --test` fully green · determinism green ·
`npm run playtest:quick` 0 bugs. **Do NOT touch `package.json`/`public/v1.js`** — DS-1a runs in parallel; Basecamp
does ONE consolidated version bump when both land.

## Commit protocol
Stage ONLY your files by explicit path (`engine/grace/gracefulAdjudication.js`, `docs/DND_XCOM.md`,
`tests/U317.*`) — **never `git add -A`** (many untracked briefs in the tree). Commit locally
(`fix(grace): CT-1 — roll-report folds into the damage compound; codify the DND_XCOM tier rider`).
**Report the commit hash; do NOT push** — Basecamp verifies (the compound answers both halves, tier-3 untouched)
and pushes.
