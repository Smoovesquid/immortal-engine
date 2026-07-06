# Contradiction Hunt — 2026-07-06 (Fable day, item #3)

*One adversarial cross-read of the week's landed laws (position canon, functional doors,
occupancy, windows, the wild, combat range bands) **plus** the two moral/epistemic
constitutions written or verified today (`MORAL_PHYSICS.md`, `briefs/PROSE_TO_WORLD_CONTRACT.md`),
hunting where they quietly disagree before they calcify. Root-finding aimed at our own
constitution stack.*

**Method:** grep-verified against HEAD (2026-07-06, v0.30.0 b098). Findings ranked; each cites code.
This pass went deep on the reputation/rumor seam (highest yield) and flags the rest for focused checks.

---

## F1 — HIGH · concrete dead-code bug: player-deed reputation never surfaces

`engine/rumor/rumorsReaching.js:101` gates player-deed reputation on `severity >= 25`
("below gossip threshold"). But every recorded deed stores `severity: dominant.sev`
(`playloop.js:8798`, and the coerced-build path `:6407`), and `dominant.sev` is the **max of
`DEED_SEV = {LIGHT:5, MOD:12, HEAVY:20}` = 20**. Severity is stored per-deed, never accumulated.
**20 < 25 → the branch never fires.** The whole `world.deeds → reputation` synthesis is dead.

- **Consequence:** "reputation precedes you" (MORALITY_SYSTEM core-loop step 4) is dark for
  player deeds — not because it's unwired, but because a live path is calibrated past its own
  input ceiling.
- **Fix (calibration on a LIVE organ, not a new system):** lower the gate to catch HEAVY
  (and decide whether MOD travels), OR make deed severity accumulate per subject. This is a
  design-owned magnitude → a determinism-tested packet, **not** a blind flip. Becomes the real
  content of **MP-1**.
- rumorsReaching is a read-time pure projection (not stored) → no `worldHash` impact; needs a
  string/behavior test + live playtest.

## F2 — HIGH · architecture: THREE reputation substrates, and the two constitutions target different ones

| Substrate | What | Written by | Read by |
|---|---|---|---|
| `world.claims[]` | epistemic per-NPC beliefs, two-variance wall, distortion/weight | `mintClaim` (**one** scripted site, `playloop.js:152`); `propagateClaims` on `worldTick:66` | `npc/dialogue.js:890` only |
| `world.rumors[]` | pre-garbled bodies, tiers, `npc.rumorIds` (Pass R1, WORLD_VERSION 17) | `appendVillainRumor` (villain track), `rumor/mint.js`/`propagate.js` | `rumorsReaching`, `perspectiveFilter`, `dialogue:1217` |
| `world.deeds[]` | moral ledger; **synthesized to reputation at read-time** | `recordDeed` (deed chokepoint) | `rumorsReaching:87` (the F1 dead branch) |

- **`MORAL_PHYSICS.md` leaned on `world.claims`** (the two-variance-wall story). **`PROSE_TO_WORLD_CONTRACT.md`
  is built on `world.rumors`** (S3 prose body, `rumor/mint.js`). **The two laws disagree on the
  substrate.** Left unreconciled, MP-1 and PW-3 would build a fourth and fifth path.
- **`rumorsReaching` is already the shared READ sink** — it unifies `rumors` + `deeds` at read-time.
  That is the natural authority.
- **Ruling recommendation (engine-authoritative, fewer-systems — [[feedback_architecture_by_principle]]):**
  `rumorsReaching` is the authoritative reputation **read sink**. Player-deed reputation feeds it via
  `world.deeds` (fix F1). NPC-villain reputation feeds it via `world.rumors`. `world.claims` is
  either (a) unified into the rumor layer, or (b) scoped explicitly to the epistemic-dialogue niche
  and marked so — **not** a general reputation store. **Both constitutions must name the same sink.**

## F3 — MEDIUM · built-but-dark: the epistemic claim system runs on empty

`mintClaim` is called at exactly one scripted site (`playloop.js:152`, the gallows/`npc_lingerer`
event). `propagateClaims` runs every `worldTick` (`:66`) over a `world.claims` that is almost always
empty. A whole deterministic propagation engine (weight decay, provenance, fracture, cycle-block)
is effectively idling. **Decide at the F2 ruling:** light it up (route deeds/villainy through it) or
retire it to its niche. Do not leave it half-alive.

## F4 — SEAM · owed a focused check: collapse-trigger vs deed-trigger composition

Both the prose-to-world **collapse** gates and the moral **deed** detector fire on *player text* in
the synchronous reducer (`playerMoveCore` gate chain vs `applyDeedCharges` wrapping `playerMove`).
A single utterance — *"I pocket the letter I took off the man I just gutted"* — could hit both an
acquire-collapse **and** `tryDarkDeed`. **Not yet resolved here.** Owed: confirm the gate ordering,
that neither suppresses the other, and that the deed's `summary` and the collapse's mint don't
double-count or contradict. Likely fine (different sinks), but it is the exact place the two
constitutions physically meet in one turn — verify before MP/PW land.

## F5 — RECONCILED (name it so no one "fixes" it): the wild has no witnesses

A deed in the unpainted fog-procgen wild has no `node.settlement.npcs` → no witnesses → no
reputation propagation. This is **correct physics** (no one saw) and IS the "getting away with it"
asymmetry (MORALITY_SYSTEM decision #7), not a bug. Agrees with the wild's design. Left as-is,
documented in `MORAL_PHYSICS.md §6`.

## F6 — SEAM · flagged: fair combat must not tag as cruelty

The deed detector tags cruelty only on *helpless/surrendered* context; a fair/bare combat kill is
untagged (`playloop.js:8741`). The moral escalation ladder must **not** fire on fair combat. Keep the
helpless-context gate tight as MP-2/MP-3 add accumulation, or the ladder over-fires on ordinary
XCOM-style combat (the DND_XCOM range-band law). Agrees today; watch it under the new ladder.

---

## Feedback into the constitutions (the point of the hunt)

- **`MORAL_PHYSICS.md` MP-1 reframed:** not "mint claims from deeds" (a parallel substrate) but
  **"reconcile the deed→reputation path"** — fix F1's calibration and adopt the F2 substrate ruling.
  Corrected in the doc.
- **The F2 substrate ruling is a shared dependency of MP-1 and PW-3** — both constitutions must be
  built to the same reputation sink (`rumorsReaching`). This is the one cross-law decision owed
  before either arc's rumor packet ships.
- **F4 is owed a focused pass** before the first MP/PW rumor packet lands.

No code changed in this pass (engine writes are brief-gated; F1's fix is design-owned). This is
diagnosis; the fixes are MP-1 / the F2 ruling / the F4 check.
