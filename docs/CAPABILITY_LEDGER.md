# Capability Ledger — the finite list + the convergence meter

**The living tracker for [`RUNG1_CONVERGENCE_PLAN.md`](RUNG1_CONVERGENCE_PLAN.md).** The plan argues the
hard-tail loop is closeable because *failure categories are finite* even though phrasings are infinite. This
doc is that finite list, plus the two-signal meter that tells us whether we're converging. Backed by Biblioteca
[Vol 8](biblioteca/vol-8-evaluation-harness.md) (the harness spec) and [Vol 7](biblioteca/vol-7-hybrid-architecture-patterns.md)
(the graduation target).

---

## The two signals (replaces the bouncing gate %)

- **Regression signal** — % of the *frozen paraphrase corpus* (below) that passes. Runs on the **deterministic
  engine path** (`playerMove`, LLM-off) → **free + replayable**, run it on every change like `node --test`.
  Must stay **100%**. Proves we never go backward on a solved category.
- **Discovery signal** — from a paid gate run, the count of HARD failures that map to **no existing capability
  row** (a genuinely new category, not a fresh phrasing of a known one). This is the real progress meter; it
  can fall to ~0 even over infinite input. Classification is a Basecamp judgment call per gate (tag each
  failure with a `C#` or `NEW`).

**Done-when:** regression corpus green **+** N consecutive gates open zero new capabilities **+** residual is
phrasing-tail / forgivable SOFT, not real defects.

---

## The ledger (C1–C14 seed; append as gates surface genuinely new categories)

`corpus` = paraphrase-sets exist & green · `graduated` = handled by the typed packet (Vol 7), not scattered
detectors. Status starts `seed`.

| # | Capability (DM obligation) | Lineage / H-IDs | Current home (detectors to unify) | Corpus | Graduated |
|---|---|---|---|---|---|
| C1 | Answer **every part** of a compound query | H-25/H-31/H-40/H-54/**H-59** | `handleMetaQuestion` typed sub-intent decomposition | 4L/0T | **✓** |
| C2 | A **named referent** must be grounded before the turn resolves | H-56/C2-grad/H-60, **H-79** | `ungroundedNpcReferentForText` + `hasPersonReferentSignal` + observe/travel hoist + social-resolver guard | 6L/0T | **✓** |
| C3 | A **declared check** gets a DC + roll | H-54 R4 | `META_EXPLICIT_CHECK_*` | 0L/3T | — |
| C4 | Info-seeking **delivers a grounded fact or honestly declines** | H-22/23/29/31/39/H-63/H-74, **H-78** | `isInfoSeekingText` (+provenance widen) + `META_PURSE` + dialogue place-branch + pre-roll `isUngroundedInfoCheck` | 6L/2T | **partial** |
| C5 | A **rules/mechanic question** is answered straight, never rolled | H-25/H-54 R3/H-61, **H-80** | `META_DAMAGE_RULE`/`META_ATTACK_MOD` + governing-stat classifier (skill + `META_ATTACK_GOVERNING_STAT` for attacks) | 4L/1T | **partial** |
| C6 | **Number-transparency**: own stats/mods/AC/HP/items from the sheet | H-25/H-31/H-40, **H-68** | `answerSkillModifier`, `META_ARMOR_VALUE`, `META_HELD_ITEMS`, `META_INVENTORY` (widened) | 5L/0T | **✓** |
| C7 | **Item/consumable** query answers from real def; **use** applies effect | H-45/H-47/H-65/H-69/H-70/H-73/H-76, **H-77** | `answerItemQuery`/`META_ITEM` + `CONSUME_RE` + count/compound + bare-count list + sheet-rider guard + effect-cue/`ITEM_EFFECT_DEMAND_RE` widen | 13L/0T | **partial** |
| C8 | **Narration ≤ mechanics** — no hit/defeat the dice didn't produce | H-26/H-28/H-43, **H-72** | `llmAdapter` R1–R3 + playloop `attackResolutionIntent` | 4L/0T | **corpus✓ / live⚠** |
| C9 | **Canon non-invention** — no invented name/date/tenure/relationship | H-27/H-49/H-52 | `findInventedFactClaim` | 2L/2T | — |
| C10 | A **declared attack** routes to real combat resolution | H-30/H-32/H-43/H-48/H-55/H-64/H-71, **H-72** | playloop attack gates + `go for`/flip-onto-person/npc-generic/firebolt + attack-resolution-over-meta | 10L/1T | **partial** |
| C11 | **Confrontation under pressure** → in-character NPC reaction | H-42 | `isConfrontationChallenge`, `confrontationReaction` | 3L/0T | — |
| C12 | **Movement/travel intent** resolves in fiction, no travel-gate bounce | THE_DM_TEST residuals, H-62, **H-75** | playloop talkRef-before-free-movement + `extractFindPersonRef` + `detectPhysicalAssault` point/edge de-weaponize | 4L/0T | **✓** |
| C13 | **Absurd / out-of-bounds** input declines in-character | IG-10, **H-67** | `tryRidiculous`/`RIDICULOUS` (playloop, Road A) | 4L/0T | **✓** |
| C14 | **Meta / system check-in** acknowledged, no roll | H-51, **H-66** | `META_SYSTEM_CHECKIN` (widened) | 4L/1T | **partial** |
| C15 | **Active combat is reflected, not narrated as calm conversation** | gate 2026-06-20 → **H-58** | `playloop` `isCombatConversationNonAction` guard | 2L/0T | **✓** |

**Findings log.** *2026-06-20:* H-56 (`3e214ec`) §7-verified — closes the `U219` referent shapes with no
regression and no over-fire (grounded names/roles unaffected), but a Basecamp adversarial probe found **C2 still
misses** *"what's keeping Brokefang so quiet over there?"* and *"take me to Sera Voss and her stall"* (both fall
through to observe/travel, no clarify). **C2 is a correct partial point-fix, not a closed category** — those two
phrasings are its first `target` cases and make C2 a prime early graduation candidate. (The plan validating
itself: an over-fire probe doubled as a paraphrase-invariance probe and caught exactly the phrasing-tail the
per-packet loop would have shipped as "done.")

*2026-06-20 (C2 partial graduation):* added `hasPersonReferentSignal` to `ungroundedNpcReferentForText` —
a fabricated name carrying a person-signal (addressed, "ask X"; or subject of a person verb, "won't X look at
me") now clarifies, beyond H-56's exact shapes. Over-fire-safe: place gaze-OBJECTS ("stare at the Old Spire")
and grounded roles stay unaffected (Basecamp probe). Suite 8285 green, determinism 6/6. **3 phrasings promoted
backlog→locked (C2-003).** Remaining C2 backlog left for a **supervised** pass: (1) "what is X staring/quiet"
is intercepted by the observe/look-around handler *upstream* of the referent guard → needs routing-precedence
work; (2) bare "take me to &lt;Name&gt;" → person/place disambiguation. A *partial* graduation, not the full
typed-packet migration.

*2026-06-20 (first gate under the convergence framework — `docs/playtests/opus-gate-2026-06-20-convergence-baseline.md`,
10/48):* tagged every failure by capability — **the discovery signal.** **7/10 map to existing capabilities**
(C1×1 compound-query-dropped-HP · C4×3 newbie dialogue-dodge/empty-filler · C7×1 Tonic-effect-unstated · C8×1
defeated-NPC-spoke-as-alive · C9×1 invented-oath) = phrasing-tail of known categories. **3/10 = ONE new cluster**
(Lore-hound t10–t12): the DM narrates an *active combat* as a calm interrogation → new capability **C15**.
**Verdict: the thesis holds** — failures cluster onto ~6 categories (5 known + 1 new), not a sprawl; discovery
rate ≈ 1 new category → finite and closeable. The **C2 graduation held** in live play (no referent failures, no
over-fire). C15 may be a real engine bug (combat state dropped when the player pivots to dialogue mid-fight) —
flagged for the supervised pass.

*2026-06-21 (H-66 C14 + H-67 C13 — two file-disjoint grace/playloop graduations, both §7-VERIFIED by Basecamp,
dispatched in parallel):* **C14** (system check-in) 2L/3T → 4L/1T by widening `META_SYSTEM_CHECKIN` (phrasing
coverage on both halves; the repetition-callout + check-in structure guard kept intact). **C13** (absurd/
out-of-bounds) 4L/3T → **4L/0T** by widening the playloop `RIDICULOUS` array (3 target families closed, merged
into their locked siblings with diverge guards preserved; an independent off-corpus over-fire probe ran 5/5
resolve / 4/4 decline). **IG-10 reframe:** C13 was a *presumed* Tier-B / LLM-arbiter capability — it is in fact
handled by the same deterministic Road-A detector as every other capability; no Tier-B needed for the known
families (✓ = the regression corpus is closed, NOT that discovery is done — keep the gate probing novel
absurdities). Sole residual is cross-lane (playloop): **C14-003** (combat-context check-in needs the handler
hoisted ahead of the combat loop) — joins the accumulating cross-lane cleanup packet. Overall convergence
52/52 → 54/54, 100% throughout. Process note: the H-67 commit was found sitting unverified on local HEAD by the
pre-push `origin/v2-polish..HEAD` check (parallel-lane workers commit into the shared tree) — verified before push.

*2026-06-21 (gate 2 under the convergence framework — `docs/playtests/opus-gate-2026-06-21-pre-judge-hardening.md`, 18/48 raw):* the
DISCOVERY signal = **0 new capabilities** (baseline opened C15; this opens none → the 1st zero-discovery gate).
All 18 HARD failures map onto C4/C5/C7/C8/C9/C10/C12/C15; the 10→18 raw jump is the ruler bouncing (this run's
Rules Lawyer drilled the Tonic vein ~9 turns, the Chaos-griefer firebolt-in-combat). **#1 finding
(methodological): C7 is corpus-GREEN but LIVE-BROKEN** — the LLM-off corpus never exercises the compound /
dose-count phrasings or the live narration sink; add C7 compound+dose-count targets + an LLM-on probe before the
next C7 packet. **Confirmed live:** C6 holds (H-68), C15 improved (baseline combat-as-table-talk cluster gone,
H-58), C13 holds. **Next by live density:** C8/C9 (fabricated roll/ledger — least-graduated, now live-confirmed)
> C7 live-coverage > C10 spell/cast resolution > C4 empty-success. Judge caveat (Vol 14, Opus×Opus
self-preference): HARD tags are a discovery pointer, confirmed against canon in the mech column; a cross-family
re-judge is the future hardening.

*2026-06-21 (post-gate corpus closures H-70..H-73):* C6✓, C7 (9L→10L, dose-count/compound/bare-count), C10
(firebolt + attack-resolution-over-meta), and **C8's corpus is now closed (4L/0T)** via H-72's
`attackResolutionIntent` (a declared attack with a stats rider resolves over the meta-question gate). **But C8 is
marked `corpus✓ / live⚠`, NOT a clean ✓:** the gate's worst C8 failure — the LLM narrating a *fabricated* roll
("the ledger shows 18 vs DC 12") with mech `(none)` — is a NARRATION-LAYER defect (`llmAdapter`) that reproduces
clean LLM-OFF, so the deterministic corpus structurally **cannot** lock it. The remaining high-live-density work
(C8/C9 fabricated-roll, C4 empty-success) lives in the narration sink and needs validator-hardening + a paid gate
to confirm — not more corpus point-fixes. This is the convergence meter doing its job: the regression corpus is
near-saturated (63/63, last gate 0-new), and the frontier has moved to the LLM layer (Biblioteca [Vol 15] backs it).

*2026-06-21 (narration-track localization — a Vol 10/14 payoff):* the gate's #2 "real failure" — the C8/C9
**fabricated "18 vs DC 12" roll** — is a **JUDGE FALSE-POSITIVE, not an engine bug.** That line is a deterministic
grace response (`answerRollRecall`, `gracefulAdjudication.js:1845–1855`) citing `world.conversation.lastRoll` (a
REAL stored roll) to defend canon against the player's misremembered "14"; the Opus judge flagged it
`CANON_HALLUCINATION` only because it can't see the roll ledger. Confirmed against ground-truth (Vol 10 discipline)
BEFORE scoping a fix — which would have broken correct behaviour. **Two real next steps:** (1) **gate-judge
hardening** — reference-guided judging that feeds the judge `world.conversation.lastRoll` / NPC-presence / Canon
Log, so the discovery signal stops mis-flagging correct roll-recall & presence (the 18/48 is inflated; needs a
paid gate to confirm the recal); (2) **C4 empty-success** is the genuinely-real narration bug — an NPC asked an
info-question it has no knowledge for answers with a generic place-line non-sequitur (`[dialogue ask | place]`)
instead of delivering a fact or honestly declining (reproduces LLM-off → corpus-lockable; a dialogue-system
deliver-or-decline gap, distinct from C4-001b's "this village" common-knowledge false-positive). **Lesson: trust
the judge-free corpus + canon ground-truth over the gate's HARD tags (Vol 10/14); the gate is a noisy pointer.**

*2026-06-21 (gate 3 — HARDENED judge — `docs/playtests/opus-gate-2026-06-21-gate3-hardened.md`):* **5/48, down from run-1's
18/48** on the same seed/personas. The reference-guided judge fix (commit `6e39d5c`: `world.conversation.lastRoll`
+ ROLL-RECALL clause) **validated the false-positive thesis** — ~13 of run-1's 18 were judge artifacts; the
roll-recall false-positive is gone, Rules-Lawyer 8→2, **Chaos-griefer 12/12 clean.** The gate is now a trustworthy
instrument (Vol 10/14 reference-guided judging, confirmed live). **Discovery = 0 new capabilities (2nd consecutive
zero-discovery gate → the loop is near-closed).** The 5 real failures: C7 ×2 (live item-effect phrasing-tail +
cross-item compound effect-of-X/count-of-Y), C4 ×1 (compound dismiss+question, question dropped), C9 ×1 (wrong
elder identity), and the standout **C12/intent: "point me to Kael" resolved as a real ATTACK on Kael** (directions
→ combat — highest severity, the next bug to chase). True live DM quality ≈ 90% on this gate. Budget after:
~$2.38 (below the one-run floor — top up before the next gate).

*2026-06-21 (H-75 — C12, gate-3's #1 fix):* the standout gate-3 failure (**"point me to <NPC>" → real ATTACK**) is
closed. `detectPhysicalAssault` branch C listed "point" in BOTH the weapon-noun and the bring-verb alternations, so
"point me to Mira" + trailing "to Mira" satisfied all three legs and mis-fired a strike. Removed "point"/"edge"
(blade-PARTS, not weapons) from the weapon-noun list — a genuine blade-threat must still name a real weapon. **C12
3L/0T → 4L/0T** (C12-004 locked); convergence 64/64 → 65/65 (100% throughout); **C10 declared-attack held 10/10** (the
regression risk cleared); suite 8285/0. §7-VERIFIED by Basecamp — worker self-committed+pushed `ae75558` mid-verification
(lesson-(a) concurrency, caught by the pre-push range check). **4 of gate-3's 5 failures now remain — all
free/corpus-lockable** (C7 ×2, C4 ×1, C9 ×1); batch before the next paid gate (budget ~$2.38, below the one-run floor).

*2026-06-21 (H-76 — C7, the consume-vs-sheet rider):* C7-002b graduated target→locked. A consume ACTION carrying a
"what changes on my sheet" rider ("uncork the Tonic and drink it — tell me what changes on my sheet") was caught by
grace's `META_SHEET_CONFIRM` and answered with the static stat-block before the consume resolved. Fix (grace-only,
mirrors H-74's negative-guard idiom): a local `SHEET_CONSUME_CUE_RE` declines the sheet branch when a real consume cue
co-occurs, so the turn falls through to playloop's already-correct `CONSUME_RE`/`tryUseConsumable`. **C7 10L/1T → 11L/0T**;
convergence 65/65 → 66/66 (100%); suite 8285/0; over-fire-safe (bare sheet queries unaffected, diverge locked).
§7-VERIFIED by Basecamp (Sonnet grace lane, clean claim-before-code per §3). **C7 stays "partial":** the two remaining
gate-3 C7 live failures — the cross-item compound (effect-of-X + count-of-Y) and the "give me X's effect or flag it
undefined" phrasing-tail — are **H-77** (grace, scoped, ready to dispatch now the seam is free). Budget re-confirmed
$7.29 (gating unblocked).

*2026-06-21 (H-77 — C7, the two effect-query phrasing-tails):* the remaining gate-3 C7 failures closed. (A) the
cross-item compound ("what's the Tonic do — and how many rations") dropped the effect because `ITEM_EFFECT_CUE_RE`
missed the "what's X do" contraction → widened it. (B) "give/tell me X's mechanical effect or flag it undefined"
matched no `META_ITEM*` detector → added `ITEM_EFFECT_DEMAND_RE` (first alt "give/tell me … effect" catches the gate
phrasing AND the bare demand — both verified → "heals 2d4"; second alt requires the "…undefined" tail, deliberately
narrow so it does NOT sweep the C7-003 diverge "Tell me what the Tonic does"). C7-008/009 locked → **C7 11L/0T → 13L/0T**,
convergence 66→68 (100%), suite 8285/0, determinism green. §7-VERIFIED by Basecamp incl. an empirical `playerMove` probe.
**RESIDUAL (pre-existing, NOT from H-77, low-priority):** "Tell me what the Tonic does." rolls (`[roll:11 vs DC:12]`)
instead of stating the effect — no cue verb any `META_ITEM*` detector catches — so C7-003's diverge *reason* ("DM states
real effect proactively") is inaccurate (reality rolls; the diverge still passes because no *correction* fires). A future
C7 packet should route "tell me what X does" → effect query and correct that diverge reason. **All three C7 gate-3
fixes (H-76/H-77) are corpus-closed → confirm them live in the next gate.**

*2026-06-21 (gate 4 — post H-75/76/77, HARDENED judge, `docs/playtests/opus-gate-2026-06-21.md`):* **7/48** (seed
glass-harbor, same personas as gate 3's 5/48; gate 3 preserved at `opus-gate-2026-06-21-gate3-hardened.md`). **Discovery
= 0 new capabilities — 3rd consecutive zero-discovery gate → the loop is CLOSED on discovery.** All 7 map to known rows:
**C4 ×5** (empty-success — an UNANSWERABLE info-question, "who carried me in last night / where was I found", a fact canon
doesn't hold, gets routed to a generic d20 resolve that narrates a CONTENTLESS success — "it goes your way" / "something
real to go on" / "it half-works" — instead of delivering a fact OR honestly declining; Lore t2/t4/t9/t11, + t10 = C1 the
compound dropped the name half), **C2 ×1** (Lore t12: player INVENTED "Brae Copperforge"; engine resolved the intimidation
against the real present NPC Corwin WITHOUT clarifying the mismatch — judge mis-tagged CANON_HALLUCINATION, but Corwin is
real/present, so it's a referent-clarify gap, not invention), **C5 ×1** (RL t8: "which modifier applies to a melee strike —
roll it now" → dumped the raw breakpoint table + full stat block, never said "MIGHT for melee", never rolled the demanded
d6). **The fixes HELD live:** Newbie **12/12** (C12 attack-misroute gone), Rules-Lawyer **11/12** (gate-3's C7 Tonic-effect
dodges gone), Chaos **12/12**. **The 5→7 is the ruler bouncing onto the DEFERRED C4 tail** — this run's Lore-hound drilled
an unanswerable-info vein 6 turns deep, exposing **C4 empty-success in the RESOLVE/narration path** (distinct from H-74's
dialogue place-branch: that was the dialogue handler; this is an info-question mis-routed to `resolve()` yielding a
contentless success). **#1 NEXT PACKET (H-78):** route info-seeking questions to the deliver-or-decline path BEFORE the
generic d20 resolve, so an unanswerable info-question honestly declines instead of "succeeding" with no content. Minor
tail: C2 clarify-on-invented-referent (t12), C5 governing-stat-on-melee + honor-the-roll-demand (t8). Judge note (Vol 14):
the hardened judge held (no roll-recall false-positives; sole loose tag = t12 invention-vs-referent) — trustworthy as a
pointer, confirmed against the DM lines + canon. **Budget after: ~$4.44** (~$2.85 spent, 96 Opus calls).

*2026-06-21 (H-78 — C4 empty-success in the RESOLVE path, gate-4's #1 fix):* closed. The gate-4 Lore-hound deadends
("who carried me in last night / where did they find me", t2/t9/t10/t11) were info-questions about the PC's own
PROVENANCE — a past event canon doesn't hold — that matched NONE of `isInfoSeekingText`'s sub-REs, so the pre-roll
`isUngroundedInfoCheck` gate never fired and the turn rolled a generic WITS check that "succeeded" with contentless
flavor. Added `INFO_SEEKING_PROVENANCE_RE` (question-word + PAST-tense transport/discovery verb + me/us) → the existing
`noInfoCheckResult`/`declineInfoSeek` machine now honest-declines with NO roll. **C4 5L/2T → 6L/2T** (C4-006 locked);
convergence 68→69 (100%); suite 8285/0; over-fire-safe (escort "take me to X" + C12 "point me to <NPC>" stay movement —
8/8 negatives verified). §7-self-verified (Basecamp acting as worker, Tim away — "run all of this here"). **Reproduced
LLM-off FIRST** — the empty-success only triggers when an NPC is addressed (bare forms went observe-only), the
fixture-coverage lesson: the gate path needed the vocative/address form to reproduce. Remaining gate-4 tail: t4 + t12 =
**C2 identity** (H-79 next), RL t8 = **C5 melee-stat** (H-80).

*2026-06-21 (H-79 — C2, invented social-action target, gate-4 t12):* closed. The gate resolved an intimidate against
the present NPC (Corwin) when the player addressed an invented "Brae" — `socialTarget` falls back to `npcs[0]` on no
name/role match. Added an ungrounded-referent guard at the top of `resolveSocialAdjudication` (reusing
`ungroundedNpcReferentForText` + `npcReferentClarify`); reached only out of an active dialogue, so C11's in-dialogue
confrontations are untouched. **C2 5L/0T → 6L/0T** (C2-004 locked); convergence 69→70 (100%, C11 3/3 held); suite 8285/0;
over-fire-safe (present NPC by name/role + "everyone"/"them" still resolve). Judge note (Vol 14): the gate mis-tagged
this CANON_HALLUCINATION — it was a C2 referent-clarify gap (Corwin is real/present, nothing invented). Only RL t8
(**C5 melee-stat**, H-80) remains of the gate-4 tail.

*2026-06-21 (H-80 — C5 melee governing-stat — DONE, grace core):* gate-4 RL t8 ("which ability modifier applies to a
melee strike — MIGHT or AGILITY? roll it now") leaked the raw breakpoint table. **CLOSED the out-of-combat case (the
actual gate failure):** added `META_ATTACK_GOVERNING_STAT` + `answerAttackGoverningStat` (melee→MIGHT with the real mod +
d20/d6 formula, ranged→AGILITY), wired into `isMetaQuestion` + checked FIRST in `handleMetaQuestion`. C5 3L/1T → 4L/1T
(C5-005 locked); convergence 70→71 (100%); suite 8285/0; over-fire-safe (attack-modifier number-ask, attack declarations,
AC questions all unaffected). **Residuals (NOT the gate failure — deferred to a future pass):** (c) the in-`active_combat`
variant still SWINGS on a rules question (needs an H-72-style combat-meta exception, playloop), and (d) the literal d6
roll-demand isn't rolled (the formula answer covers its intent). Original scoping reference (rule + layers) retained below: **(1) RULE confirmed** — melee = MIGHT (`escapeCombat.js:16`:
d20+MIGHT to hit, d6+MIGHT damage), ranged = AGILITY, AC = 12+AGILITY. **(2) THREE layers:** (a) the exact phrasing hits
the breakpoint-table dump (`gracefulAdjudication.js:1407`, last-resort in the stat-mod handler) — needs a governing-stat-
FOR-ATTACK answer paralleling `answerSkillModifier` (:1008, which maps SKILLS→stat only, not attacks); (b) "which stat to
hit in melee?" / "what modifier applies to a melee attack?" fall through to a generic WITS resolve (same detector must
intercept pre-roll); (c) in `active_combat` the question triggers a SWING (combat-meta gate intercepts — needs a rules-
question exception à la H-72's `attackResolutionIntent`). (d) the unmet d6 roll-demand half (rolling damage outside
combat — lowest priority; likely decline-with-explain). **FIX SHAPE:** add `META_ATTACK_GOVERNING_STAT` ("which/what
(stat|modifier|ability) (applies to|governs|do I use for) a (melee|ranged) (strike|attack|hit)", incl. the "MIGHT or
AGILITY?" framing) + an answer ("Melee strikes use MIGHT — d20+MIGHT to hit, d6+MIGHT damage; ranged uses AGILITY"),
wired into `isMetaQuestion` + `handleMetaQuestion` BEFORE the breakpoint last-resort, and ahead of the combat swing for
the in-combat case. Over-fire guard: a WHICH-question, NOT an attack declaration ("I strike with MIGHT" must still
resolve as combat). Grace + playloop (in-combat half) → serialize. Lowest-severity gate-4 item; not blocking.

**Social-physics categories to mine next (Biblioteca Vols 2–6, mostly not yet failing-in-gate but on the map):**
sarcasm/irony inversion (Vol 2; transcript: `docs/playtests/ridiculous-sarcasm-2026-06-06.md`), loaded
questions / presupposition (Vol 3, "have you stopped stealing?"), bluff vs. claim (Vol 5), request/order/threat
disambiguation (Vol 2 §13). Add a `C#` row when one actually surfaces — the map is finite (see plan §2.4).

---

## Corpus format (the shared interface — Lane B builds the runner to this, Lane C fills content to this)

Corpus lives in `tests/corpus/<Cn>.corpus.mjs`, each exporting `default` an array of **cases**:

```js
{
  id: 'C1-001',
  capability: 'C1',
  status: 'locked',                  // 'locked' = solved, MUST stay green (the regression signal);
                                     // 'target' = known gap (the graduation backlog — reported, does NOT fail the build)
  fixture: 'village_baker',          // named world setup, see fixtures below
  intent: 'ask name, class, and current HP in one breath',
  paraphrases: [                      // ≥5; all must satisfy `assert` (paraphrase invariance, Vol 8 §6)
    "what's my name, class, and current HP?",
    "remind me — who am I, what class, how many hit points right now?",
    "name / class / current HP?",
  ],
  assert: {
    surface_matches: [/HP|hit points/i, /class/i],  // ALL parts answered
    surface_excludes: [/\[roll:/],                   // and it did NOT roll
  },
  diverge: [                          // hard negatives: look similar, MUST be handled differently (Vol 8 §6.3)
    { text: 'I add MIGHT to damage and swing at the door', reason: 'an action, not a status query' },
  ],
  source: 'opus-gate-2026-06-20-postH52-H53.md (RL compound query)',
}
```

Runner contract: for each case, build `fixture`'s world; for **each** paraphrase call
`playerMove(world, PACKS, text)`, take `surface = narration + ' ' + mechanics`, assert every `surface_matches`
present and every `surface_excludes` absent. For each `diverge[]` text, assert the case's signature does **not**
hold. Report **locked** cases (pass-% MUST be 100% — the regression signal) separately from **target** cases
(the graduation backlog: a target that starts passing is a promote-to-`locked` candidate; target fails do not
break the build). Exit nonzero only when a `locked` case fails.

### Standard fixtures (factory fns; model them on `tests/U219.ungroundedNpcReferent.test.js`)
- `village_baker` — settlement node, one non-hostile baker NPC ("Mira Hearth"), no combat, no dialogue.
- `active_combat` — escape-mode combat active, one live foe at ~6 HP, `meta.escapeHp`/`escapeMaxHp` set.
- `dialogue_active` — mid-dialogue with a present NPC (`scene.dialogue` populated).
- `empty_room` — bare interior, no NPCs, no combat.

All fixtures deterministic (fixed seed), LLM-off. Cases requiring other setups note it in `intent` and Lane B
adds the fixture.

---

## How to run (once Lane B lands)
- `npm run convergence` → regression table + overall %. Free, deterministic, run like `node --test`.
- Paid gate (`scripts/dm-playtest.mjs`) stays the **discovery** instrument only — read its report, tag each
  HARD failure `C#`/`NEW`, log the discovery count here under a dated heading.
