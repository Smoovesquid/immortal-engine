# Capability Ledger — the finite list + the convergence meter

**The living tracker for [`RUNG1_CONVERGENCE_PLAN.md`](RUNG1_CONVERGENCE_PLAN.md).** The plan argues the
hard-tail loop is closeable because *failure categories are finite* even though phrasings are infinite. This
doc is that finite list, plus the two-signal meter that tells us whether we're converging. Backed by Biblioteca
[Vol 8](biblioteca/vol-8-evaluation-harness.md) (the harness spec) and [Vol 7](biblioteca/vol-7-hybrid-architecture-patterns.md)
(the graduation target).

---

## ⛳ ERA MARKER — Road-A is CLOSED; the track is now WORLD-WIRING (2026-06-22)

**Road-A (deterministic regex/state-guard hard-tail bug-fixing) is closed.** Seven consecutive paid gates
(gates 6–12) opened **zero new capabilities** — every HARD failure mapped to an existing C-row or to a
non-Road-A frontier. The regression corpus stands at **94/94 locked (100%)**; the finite set C1–C16 is
graduated or corpus-closed for its abstract/role forms.

**Do not reopen Road-A over narration quality.** When a gate shows *right content, wrong words* (empty-success
on a succeeded roll, machine-dumps, invented barriers), that is the **narration track** (`docs/THE_REF.md`),
NOT a new deterministic capability — another regex detector will not move it.

**The frontier moved to WORLD-WIRING (W-#).** The insight: the open narration failures (empty-success /
fact-invention / *answer from real data*) and *the world is thin* are the SAME seam — the DM narrates against a
hollow test world with no true facts to materialize. The track now wires the demo region
(`docs/DEMO_REGION.md`) **one tested LOCATION at a time**, giving the DM real location facts to
deliver-or-decline from. New packets are **W-#** (world-slice), distinct from the H-# hard-tail loop. §0 of the
region bible (the hidden-why) is a HARD narration constraint on every slice.

**Known deferred deterministic tail (bounded — NOT a reason to reopen Road-A):**
- **H-94 (combat-truth, Codex/escapeCombat lane):** throw-a-bystander-into-a-hazard substitution (#10/E); the
  `its hand`+flee-word compound edge.
- **THE_REF (narration-emphasis):** gate-12 A/B — hazard-damage / defeat narration read *worse* than the
  mechanics actually are (judge-emphasis, not a missed deduction; reproduce-first disproved an engine miss).
- **Playloop-lane low-yield tail:** C3 DECLARED-check forms handed to playloop; C9-001/004 (named-NPC /
  sentence-initial false-NER).

This marker summarizes the dated findings log below so a future agent does not re-run the closed loop. See the
gate-12 verdict (this doc) + `docs/THE_REF.md` + `docs/DEMO_REGION.md`.

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
| C1 | Answer **every part** of a compound query | H-25/H-31/H-40/H-54/H-59, **H-83** | `handleMetaQuestion` typed sub-intent decomposition (+ stats-into-AC fold) | 5L/0T | **✓** |
| C2 | A **named referent** must be grounded before the turn resolves | H-56/C2-grad/H-60/H-79/H-90, **H-91** | `ungroundedNpcReferentForText` + `hasPersonReferentSignal` + observe/travel hoist + social-resolver guard + sentence-initial proper-name stopwords + person-signal-preferred referent selection | 8L/0T | **✓** |
| C3 | A **declared check** gets a DC + roll | H-54 R4, **H-86** | `META_EXPLICIT_CHECK_*` + bare-DC bounce-guard now defers to C/D (a declared stat-check + DC-ask states the DC+formula, not "no standing DC") | 1L/3T | **partial** |
| C4 | Info-seeking **delivers a grounded fact or honestly declines** | H-22/23/29/31/39/H-63/H-74/H-78/N-1/N-2 Ex-2/N-4/H-92, **W-1** | `isInfoSeekingText` (+provenance/surveillance/`BACKSTORY`/`IDENTITY` REs) + `META_PURSE` + dialogue place-branch + pre-roll `isUngroundedInfoCheck` + `isUngroundedObjectRead` + `META_RECAP` backstory-guard + `tryNpcStatusQuery` (alive/dead/pulse from canon) + the **World-Query Resolver** (`engine/world/placeQuery.js`: `classifyPlaceQuery`→`resolvePlaceFact`, place scope — delivers the node **substrate** founding fact, no roll; the W-# track's typed home, render-free, founding+events+population slots, DM/NPC sibling renderers **both live** — narrator via playloop, NPC via `commonKnowledgeAnswer`→`resolvePlaceFact`, W-6) + the **PERSON-scope sibling** (`engine/world/personQuery.js`: `classifyPersonQuery`→`resolvePersonFact`, `identity` slot — names a present NPC from the roster, deliver-or-fall-through, both voices, P-2) | 21L/2T | **partial** (Ex-1 open) |
| C5 | A **rules/mechanic question** is answered straight, never rolled | H-25/H-54 R3/H-61/H-80, **H-87** | `META_DAMAGE_RULE`/`META_ATTACK_MOD` + governing-stat classifier + `META_ROLL_QUERY` (a roll-result query reports `lastRoll`, never denies/re-rolls) | 5L/1T | **partial** |
| C6 | **Number-transparency**: own stats/mods/AC/HP/items from the sheet | H-25/H-31/H-40/H-68, **N-1** | `answerSkillModifier`, `META_ARMOR_VALUE`, `META_HELD_ITEMS`, `META_INVENTORY` (widened, +filler-adverb), `describePack` (inventory as prose, no category-dump/sheet-deflect); **H-82** armor-slot grounding (bare "armor" isn't a bogus possession when armor is worn) | 7L/0T | **✓** |
| C7 | **Item/consumable** query answers from real def; **use** applies effect | H-45/H-47/H-65/H-69/H-70/H-73/H-76/H-77/N-3, **H-88** | `answerItemQuery`/`META_ITEM` + `CONSUME_RE` + count/compound + bare-count list + sheet-rider guard + `ITEM_EFFECT_DEMAND_RE` + item-effect-over-named-stat guard + `META_ITEM_VERB_FINAL` (verb-final "what the X does") | 15L/0T | **partial** |
| C8 | **Narration ≤ mechanics** — no hit/defeat the dice didn't produce | H-26/H-28/H-43, **H-72** | `llmAdapter` R1–R3 + playloop `attackResolutionIntent` | 4L/0T | **corpus✓ / live⚠** |
| C9 | **Canon non-invention** — no invented name/date/tenure/relationship | H-27/H-49/H-52/H-84/H-85/H-89, **W-1** | `findInventedFactClaim` + `INFO_SEEKING_FOUNDING_RE`/`TENURE_RE`/`PRIOR_HOLDER_RE` (ungrounded founding/tenure/prior-owner → honest-decline) + the W-1 deliver/decline BOUNDARY (a known founding CIRCUMSTANCE never leaks into a who/how-many AGENT answer) | 6L/2T | — |
| C10 | A **declared attack** routes to real combat resolution | H-30/H-32/H-43/H-48/H-55/H-64/H-71/H-72/H-92, **H-93** | playloop attack gates + `go for`/flip-onto-person/npc-generic/firebolt + attack-resolution-over-meta + inanimate-practice-target guard (swing "at the post/dummy" ≠ NPC attack) + `isNaturalWeaponAttack` (bite/maul resolves as a strike, not table-talk; C15-flavored) + `stamp` recognized as unarmed/targeted + `isCombatNonAttackBodyIdle` (self/emotion/idle beat ≠ phantom swing) | 14L/1T | **partial** |
| C11 | **Confrontation under pressure** → in-character NPC reaction | H-42 | `isConfrontationChallenge`, `confrontationReaction` | 3L/0T | — |
| C12 | **Movement/travel intent** resolves in fiction, no travel-gate bounce | THE_DM_TEST residuals, H-62, H-75, **H-81** | playloop talkRef-before-free-movement + `extractFindPersonRef` + `approachPresentNpcRef` (indoors approach-present-NPC → dialogue) + `detectPhysicalAssault` point/edge de-weaponize | 5L/0T | **✓** (residual: "the elder"→wrong-NPC = C2) |
| C13 | **Absurd / out-of-bounds** input declines in-character | IG-10, **H-67** | `tryRidiculous`/`RIDICULOUS` (playloop, Road A) | 4L/0T | **✓** |
| C14 | **Meta / system check-in** acknowledged, no roll | H-51, **H-66** | `META_SYSTEM_CHECKIN` (widened) | 4L/1T | **partial** |
| C15 | **Active combat is reflected, not narrated as calm conversation** | gate 2026-06-20 → **H-58** | `playloop` `isCombatConversationNonAction` guard | 2L/0T | **✓** |
| C16 | **In-character address to a present NPC enters dialogue** (greeting / "who are you" / "do I know you") | gate 6/7 → **N-3** | `isDirectAddressIntent` (widened) + direct-address guard + observe-gate yield + greeting filler-reject | 1L/0T | **✓** |

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

*2026-06-21 (gate 4 — post H-75/76/77, HARDENED judge, `docs/playtests/opus-gate-2026-06-21-gate4-postH77.md`):* **7/48** (seed
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

*2026-06-21 (gate 5 — post H-78/79/80, the full tail, `docs/playtests/opus-gate-2026-06-21-gate5.md`):* **10/48** (5→7→10
across gates 3→4→5, same seed/personas). **The H-75→H-80 fixes HELD** — none of their targeted bugs recurred (no
attack-misroute, no "who carried me in" empty-success, no Tonic-effect dodge, no melee breakpoint-dump). **The rise is
NOT regression** — it's the stochastic personas drilling fresh long-tail veins each run. **BUT the "0-discovery" streak
BROKE — discovery is NOT at 0;** gates 3/4's "loop near-closed" was premature (only 3 gates of personas sampled). New
flavors: (a) **DM invents an access-OBSTACLE to a PRESENT NPC** ×2 (Newbie t4 Kael / t10 Tove — "go say hi" → "that way
is blocked"; fabricated barrier, CANON_HALLUCINATION-class); (b) **quest/negotiation info** ×2 (RL t10/t11 — "what's the
pay for the job?" → generic exits-dump / own-purse non-sequitur); (c) **object-reading empty-success** ×1 (Newbie t8 —
"open the book" → "it goes your way"; H-78's empty-success class but a NEW trigger — reading an object, not a backstory
question); (d) **inventory-as-machine-dump** ×2 (RL t1 / Newbie t6 — RIGHT content, delivered as a UI category-dump or
"read your sheet"); + C4-deadend phrasing-tails (Lore t3 "Nothing's happened yet") + a dropped compound-strike (Chaos t9,
C1/C10). **#1 FINDING — the frontier has shifted to the NARRATION/PRESENTATION layer.** 8 of 10 are VIBE/DEADEND where the
engine has the RIGHT content but delivers it as a machine artifact, an empty-success, a deflect-to-sheet, or an invented
barrier — LLM-narration-quality / **Road-B** failures, NOT deterministic-regex-patchable ones. **Rung-1 implication:** the
Road-A one-regex-per-vein loop is hitting diminishing returns (close a vein, the next stochastic run finds three more);
the closer looks like **narration-layer hardening** — a live output-validator (cross-family, the gate judge moved into
the loop), which is exactly what **[[IG-12]]** (the Dungeon Ref, parked 2026-06-21) is a seed of. **Budget after: ~$1.71**
(~$2.73 spent, 96 calls) — BELOW the one-run floor; top up before gate 6. Gate 4 preserved as `opus-gate-2026-06-21-gate4-postH77.md`.

*2026-06-21 (gate 6 — post N-1 Fix 1/2/3, `docs/playtests/opus-gate-2026-06-21-gate6.md`):* **7/48** (gate 5 was 10/48, same
seed/personas; RL 4 · Chaos **0** · Lore 1 · Newbie 2). **DISCOVERY = 0 new capabilities** — all 7 map to known rows
(C4 ×2, C5 ×3, C9 ×1, C12 ×1). **N-1 HELD:** none of the three fixed narration classes recurred — no inventory
category-dump, no deflect-to-sheet, no object-read empty-success — and the corpus locks (C6-006/C4-007) prove it
DETERMINISTICALLY, independent of whether this run's stochastic personas re-probed them (RL drilled roll-recall/look,
Newbie drilled approach/call-out — neither hit the N-1 veins; the 10→7 is fresh-vein sampling, not regression). **The
DEFERRED Fix 4 (approach to a PRESENT NPC → invented barrier) RECURRED** (Newbie t3 "go talk to that stranger" →
"the passage is cluttered… no clear path to the stranger" — an invented obstacle, no resolution/roll) → confirmed as
the next packet **H-81** (C12/C9 invented-barrier; root cause already diagnosed: a leading "go" makes `inferInteriorAction`
read the greeting as a blocked interior MOVE at `playloop.js` ~1052, pre-empting the talkRef/dialogue path at ~1266; the
extractors also miss apposition "that elder guy, Kael", "ask <NPC>", and pronoun anaphora "ask **her**" — Codex lane).
**Frontier = the NARRATION track (THE_REF), confirmed live:** the new dominant shape is **empty-success on a SUCCEEDED
action** — RL look-at-stranger rolled 14-success but the DM cited the roll and delivered NO description; Newbie "call out
to them" rolled 16-success → "a useful answer comes back" (empty filler, no answer). DISTINCT from H-78's
empty-success-on-resolve (there the ask was unanswerable; here the roll SUCCEEDED and an outcome was earned, but the
words deliver nothing) → THE_REF Tier-0/1: deliver the content the success earned, else honest-decline. Plus recurring
**C5 roll-recall dodge** (RL t11/t12 ledger-dispute: canon lastRoll=9 but DM deflects to the modifier/observe instead of
stating it — H-12/13 lineage) and **C9 invention** (Lore t8: invented a baker/miller/mill not in canon). **Judge note
(Vol 14):** the hardened judge held — RL's cited 14-success was credited correctly (no roll-recall false-positive), C9 +
empty-success tags confirmed against the DM lines. **Budget after: ~$2.58** (~$2.83 spent, 96 calls) — at/below the
one-run floor; TOP UP before gate 7. Gate 5 preserved as `opus-gate-2026-06-21-gate5.md`.

*2026-06-21 (gate 7 — post N-1 + N-2 Ex-2, `docs/playtests/opus-gate-2026-06-21-gate7.md`):* **12/48** (gate 6 was 7/48,
same seed/personas; RL 4 · Chaos 1 · Lore 2 · Newbie 5). **DISCOVERY = 0 new capabilities** — all 12 map to
C1/C2/C4/C6/C7/C10/C12. **N-1 + N-2 Ex-2 HELD, verified no-regression:** none of their classes recurred (no
inventory category-dump; no deflect-to-sheet — RL t7 gave identity+stats, not "read your sheet"; no object-read
empty-success; no surveillance empty-success). The canonical C7 still answers LLM-off ("What does the Tonic of grit
do?" → "it heals 2d4") and convergence held 74/74 → the **7→12 is the ruler bouncing onto fresh veins, confirmed
LLM-off before trusting the count.** The veins:
- **C7 item-effect phrasing-tail (RL t2/t4/t5) — dominant new vein.** An item-effect question that NAMES A STAT
  ("does the Tonic boost my GRIT", "restore HP or a GRIT bonus") is hijacked to the stat/HP readout before the
  item-effect detector fires → "GRIT is 9" / "13/13 HP" instead of "heals 2d4". Reproduces LLM-off (deterministic,
  corpus-lockable) → **next C7 packet** (item-effect must win over a stat name when the subject is an item).
- **N-2 Ex-1 empty-success-on-a-SUCCEEDED-action (Newbie t6/t7) — the UNIMPLEMENTED half, recurred as expected.**
  "do I know you?" → "It comes off cleanly" [roll:17 success]; "who are you?" → "the way opens" non-sequitur.
  **Ex-1 diagnostic (worker, this session):** `look at <NPC>` has NO deterministic describe path (every
  "look/describe X" returns the generic location-observe); the only describe output ("Mira Hearth, a baker…
  watching from nearby") fires on a narrow `who is the stranger` form, breaks when the NPC is named, and is thin.
  Fork = **(A)** route the dropped half to the identify path + de-brittle it (medium routing; names-who-you-see,
  no rich appearance/activity); **(B)** in-character decline floor (smallest, flat); **(C)** Tier-2 LLM describe
  from NPC canon (richest; paid/judge tier). **Tim's A/B/C decision pending — not free-landed.**
- **C12 can't-leave (Newbie t5):** "I keep trying to leave but nothing's happening" → DM restates the static scene,
  "answers nothing." Movement intent unresolved — adjacent to the deferred **H-81** invented-barrier class.
- **Dialogue-info-delivery / kick-back (Newbie t11/t12):** DM teased a "trader dispute," then bounced "what
  happened?" back as a clarification stall instead of delivering the info it teased (THE_REF Tier-2 fuzzy).
- **C2 invented-referent, in-dialogue variant (Lore t9/t10):** player addressed an INVENTED "Brae Copperforge"; DM
  rolled a generic success / observe-deadend instead of clarifying. H-79 closed the social-ACTION variant; this is
  the dialogue-QUESTION variant — a known un-closed seam.
- **C1/C10 compound-drop (Chaos t4):** "headbutt Brokefang AND rip the pouch" — headbutt resolved, pouch-grab
  half dropped. **C6 stats-compound (RL t7, judged NONE/low):** stats correct but "active effects: none" not
  explicitly stated — arguably not a real failure.
**Frontier still the NARRATION track:** ≥8/12 are "right content, wrong words." **Judge note (Vol 14):** hardened
judge held; one soft tag (RL t7 NONE). **Budget after: ~$0** (~$2.87 spent; est. $2.58 pre-gate — the run completed,
so the real balance covered it but is now exhausted). **TOP UP before gate 8.** Gate 6 preserved as
`opus-gate-2026-06-21-gate6.md`.

*2026-06-21 (gates 8–9 — the N-3/N-4 two-gate cycle, autonomous; gate 8 `-gate8.md` **5/48**, gate 9
`opus-gate-2026-06-21-gate9.md` **10/48**):* **Cycle headline gate 7→8→9 = 12 → 5 → 10 — a BOUNCING RULER, not a
regression.** Same seed/personas; the engine only improved: convergence held **77/77** throughout, and NONE of
the fixed classes recurred across either gate (no conversational-address→roll, no Tonic-names-a-stat→GRIT, no
"what happened last night"→"Nothing's happened yet"). **Discovery = 0 new capabilities both gates.** The 5→10 is
the stochastic personas drilling fresh veins (gate-8 RL drilled dialogue-stalls → N-4 fixed them; gate-9 RL drilled
stats/AC/declared-roll).
- **N-3 (gate 8, 12→5):** C16 (in-character address → dialogue) + C7 (item-effect wins over a named stat) landed +
  held — RL 4→1, the Tonic cluster + conversational-address gone. Dominant gate-8 residual (3/5) = dialogue/info
  about an ungrounded past → "Nothing's happened yet" / vague roll → became **N-4**.
- **N-4 (gate 9):** C4 dialogue/info honest-decline landed + held (the "Nothing's happened yet" / "who was it"
  classes did not recur). Gate-9's 10 all map to known rows: RL stat/AC compound + **AC self-contradiction**
  ("no armor" yet "wearing Padded coat" — C6/C8) + a player-**DECLARED roll honored** ("I roll a 15…" → success
  despite lastRoll fail — CRUNCH, fresh vein); Lore **"Then" parsed as a name** (C2 false-NER on a sentence-initial
  connective) + invented-vocative-in-dialogue mis-attributed to the wrong NPC (C2 in-dialogue seam) + invented kin
  (C9); Chaos shove-not-adjudicated (C10); Newbie "look at them [the NPCs]"→objects (the deferred **Ex-1**
  describe-present-NPC) + **"go talk to the elder [Kael, present]"→blocked (C12/H-81)**.
- **THE PERSISTENT #1 — C12/H-81: approach a PRESENT NPC → invented navigation barrier.** "go say hi to Kael" /
  "go talk to the elder/Lingerer" → "the way leads nowhere closer." **Recurred gates 6, 8, AND 9** — it survives
  every round because it's the deep playloop interior-move pre-emption (Codex lane), never yet dispatched. **This
  is the highest-value next packet** (most reliably-reproduced live failure left).
- **Other recurring (not new):** C9 invention (kin/backstory — narration-layer, the Ref/validator's job); Ex-1
  describe-present-NPC (look-at-NPC→objects; A/B/C fork still pending Tim); C2 false-NER on sentence-initial
  connectives ("Then"/"Was"/"Has" → name — a denylist gap).
- **Methodology takeaway (re-confirmed): trust convergence (77/77) + the discovery rate (0 new), NOT the bouncing
  headline.** The two-gate cycle is the clean demonstration: identical engine improvements, headline 5 then 10.
  **Budget: EXHAUSTED** (gate 8 ~$2.80 + gate 9 ~$2.80). Gates 7/8 preserved as `-gate7.md`/`-gate8.md`; gate 9 = bare.

*2026-06-21 (H-82 — C6 AC self-contradiction, gate-9 RL t2; grace lane, concurrent with H-81):* closed. Challenging
a stated AC ("you said my Armor is 11 — does my AGILITY -1 factor in?") tripped `findBogusPossessionClaim`: the word
"armor" was read as a CLAIMED gear item, found bogus (the PC's armor is a "Cloak of many patches", NAME lacks "armor"),
and "corrected" to a self-contradiction — *"There's no armor — you're wearing <coat>"* — eating the real AC question.
Root cause: the grounding check matched item NAMES only, not the armor CATEGORY. Fix grounds the bare category word
"armor"/"armour" against `inv.armor` (non-empty) → the turn falls through to the consistent AC readout. **C6 6L→7L**
(C6-007 locked, 6 paraphrases + 2 diverge), convergence 100% (79/79), suite 8285/0, determinism green. Over-fire-safe:
bogus weapon/shield claims and "armor" with no armor equipped still correct (LLM-off probe). Reproduced LLM-off FIRST on
`village_baker` (its generated PC carries the category-armor item natively). **Residual (Tier-2, deferred):** the deeper
AC-MATH arithmetic ("the -1 is baked into 12 base") still isn't spelled out — states the value, not the derivation.

*2026-06-21 (H-83 — C1/C6 stats+AC compound-drop, gate-9 RL t1; grace lane):* closed. "What are my stats … AND my
armor class?" answered ONLY the AC — `META_ARMOR_VALUE` matches and returns before any stats branch, dropping the
stats half. The AC branch now folds in `answerFullStats(world)` when `META_STATS_REQ` co-occurs (the same compound-fold
idiom already used by answerSkillModifier / META_WEAPON_DAMAGE), so both halves land. **C1 4L→5L** (C1-005 locked, 6
paraphrases + 2 diverge proving the fold isn't one-sided), convergence 100% (80/80), suite 8285/0, determinism green.
Over-fire-safe: bare AC, the H-82 AC-challenge phrasings, and bare stats queries are each unaffected (LLM-off probe).

*2026-06-21 (H-84 — C9 ungrounded settlement-founding honest-decline, gate C9-004; grace lane):* closed the lockable
subset. "How many founders were there?" / "founding family or built by merchants?" matched no `isInfoSeekingText` sub-RE
(`INFO_SEEKING_ORIGIN_RE` only covers an NPC's MOTIVE) → rolled or observe-deadended on a fact canon doesn't hold, where
a success could only invent founders (the C9 rail). `INFO_SEEKING_FOUNDING_RE` routes the founding shapes to the existing
deliver-or-decline path (grounding gate still delivers where canon holds; only ungrounded declines). **C9 2L→3L** (C9-005
locked, 6 paraphrases + 2 diverge — the search ACTION and the NPC-knowledge speculation stay non-declining), convergence
100% (81/81), suite 8285/0, determinism green (the widen touches every `isInfoSeekingText` call site, no regression).
**Residual:** "Is there a founding family…" is deferred — the playloop sentence-initial false-NER reads "Is"/"Then" as a
name and bounces a `[clarify:referent]` before grace runs (the denylist gap noted in H-81's remaining/next; a playloop seam).

*2026-06-21 (H-85 — C9 ungrounded leader-tenure honest-decline, gate C9-001; grace lane; sibling to H-84):* closed the
lockable subset. "how long has the village leader held the post?" / "how many years has the elder ruled?" observe-deadended
or rolled on a tenure canon doesn't hold. `INFO_SEEKING_TENURE_RE` (how-long/many → leadership role → tenure verb) routes
them to deliver-or-decline; grounding gate still delivers where canon holds a tenure. **C9 3L→4L** (C9-006 locked, 6
paraphrases + 3 diverge — leadership ACTION / speculation / arrival-time all stay non-declining), convergence 100% (82/82),
suite 8285/0. **Residual:** "…been IN CHARGE" forms are deferred — the shared `INFO_SEEKING_EXCLUDE_RE` matches "charge"
(the attack verb) and short-circuits before any tenure RE; widening that exclude is a broader change. They + the Kael-named
referent-clarify forms remain the C9-001 target (playloop). **Meta:** the H-84/H-85 pair shows the ungrounded-history
honest-decline vein (founding + tenure) is now corpus-closed for the role/abstract forms; the remaining C9 tail is
NER-blocked or named-NPC (playloop) — the grace-lane C9 work is saturating.

*2026-06-21 (H-86 — C3 first graduation, declared-check DC; grace lane; autonomous loop):* C3 was the only capability at **0 locked** (0L/3T). Reproduced LLM-off FIRST — and the repro **contradicted the stale corpus notes** (calibrated 2026-06-20, which described a `[dialogue ask | deflected]` deflection that no longer occurs; routing has since improved — a Vol-10 "verify against live ground-truth, not stale notes" catch). The real current gap: `"WITS check to read his face — what's the DC?"` / `"shove him with a MIGHT check. What's the DC?"` hit the bare-DC bounce (`"There's no standing DC — tell me what you're attempting"`) because the bounce guard at `gracefulAdjudication.js:1516` listed `!A && !B && !DECLARED` but **omitted `!C` and `!D`**, so a declared stat-check that also asked the DC deflected instead of falling through to the explicit-check handler (`:2004`, which states the DC + d20+mod formula). Fix = add `!META_EXPLICIT_CHECK_C && !META_EXPLICIT_CHECK_D` to the guard. **C3 0L→1L** (C3-004 locked: 6 paraphrases across WITS/MIGHT/AGILITY × read/shove/slip + 2 diverge — bare "what's the DC?" still bounces, vague read-intent doesn't fabricate a DC). Convergence 82→83 (100%), suite 8285/0, determinism green. **Residual (3 target cases stay backlog, all playloop-lane — NOT touched):** (a) `"I sheathe the blade and roll WITS to read his face"` (DECLARED) is deliberately handed to playloop, which resolves it as a trivial auto-success instead of rolling; (b) `"I'm rolling WITS against Corwin"` misses `isMetaQuestion` (`META_EXPLICIT_CHECK_C` needs `roll` not `rolling`, + a preposition before the stat); (c) cosmetic — the handler's flavor clause always says "to read <npc>" even for a shove/slip (DC+stat correct, verb flavor wrong).

*2026-06-22 (gate 10 — post H-81..H-86, autonomous Basecamp loop; `docs/playtests/opus-gate-2026-06-22-gate10.md`):* **4/48** (RL 3 · Chaos **0** · Lore 1 · Newbie 1), down from gate-9's 10/48 — same seed/personas; **remember the bouncing ruler, this is fresh-vein sampling, not a real 2.5× improvement.** The actual signal: **DISCOVERY = 0 new capabilities** — all 4 map to known rows, AND the **H-81..H-86 milestone HELD live** (no invented-barrier to a present NPC, no "no standing DC" on a declared check, no founding/tenure/AC-contradiction recurrence; Chaos-griefer 12/12 clean). The 4: **(1) C5 roll-result query DENIED** (RL t11, CRUNCH — "no roll to report" while `lastRoll`=4 vs DC 12) → fixed THIS session as **H-87**; **(2) C5 roll-result echo** (RL t9, judge-rated LOW — DM narrated the failure outcome but didn't echo the raw "5/13" already in the mech tag — borderline/soft, arguably not a real fail); **(3+4) dialogue deflect / empty non-answer** (Lore t11 "who DOES remember…" → "you manage it, the way opens"; Newbie t11 "just tell me straight, what do you want from me?" → NPC answers a question with a question) — both **VIBE/DEADEND on the NARRATION track** (right-content-wrong-words / dialogue deliver-or-decline), NOT deterministic-grace-lockable; this is the THE_REF frontier the ledger has flagged since gate 5. **Cost: ~$2.76** (96 calls, 152,351 tokens) — note this is the REAL per-run cost; the session brief's "$1.10/run" estimate was ~2.5× low. **Methodology held:** the hardened judge produced no roll-recall false-positives (it credited the cited rolls correctly); the one soft tag (RL t9 LOW) is honestly marked. Zero API-retry events — the harness retry-hardening (commit `f0be305`) wasn't exercised this run but stands for the next overload window.

*2026-06-22 (H-87 — C5 roll-result query, gate-10 RL t11; grace lane):* closed. "what did I roll — give me the die number and the DC" got "no roll to report" (observe-only) while `world.conversation.lastRoll` held 4 vs DC 12 — a DENIED recorded check. Root cause: `META_ROLL_RECALL` only matches a CITED number ("I rolled a 4"); a QUESTION asking FOR the number matched no `isMetaQuestion` detector, so the turn fell to playloop's observe path. Added `META_ROLL_QUERY` (asks-for-the-roll, no number cited), wired into `isMetaQuestion`, handled before the bare-DC bounce: reports `lastRoll` straight, never re-rolls; guarded with `!META_ROLL_RECALL` so the cited-recall path is untouched; falls through when no roll is on record (no over-claim). New `prior_roll` fixture (village_baker + preset `lastRoll`, preserved by `ensureWorld`). **C5 4L→5L** (C5-006 locked: 6 paraphrases + 2 diverge — a fresh check declaration and an HP query both stay off the roll-report path). Convergence 83→84 (100%), suite 8285/0, determinism green. Reproduced LLM-off FIRST. **Residual:** the gate's RL t9 "echo the raw 5/13" (LOW severity) isn't covered — the numbers are in the mech tag but not the prose; deferred as borderline.

*2026-06-22 (H-88 — C7 verb-final item-effect query; grace lane; the H-77 residual closed):* "Tell me what the Tonic does" / "what the Tonic of grit does" rolled or observe-deadended instead of stating "it heals 2d4" — the verb TRAILS the noun, and `META_ITEM` only matches the verb-INITIAL shape ("what does the X do"). Added `META_ITEM_VERB_FINAL` (`what (the|my|this|that) <phrase> do(es)`), wired into `isMetaQuestion` + the existing item-handler disjunction so it routes through `answerItemQuery`. Deliberately broad: the regex doesn't decide item-vs-not — `answerItemQuery` returns null for a non-item, so "what the elder does around here" / "what does the door do" still fall through to observe (verified). **C7 14L→15L** (C7-011 locked: 6 verb-final paraphrases + 2 non-item diverges). Caught a real corpus interaction: C7-003's diverge "Tell me what the Tonic does" was divergent ONLY because the behavior was broken (rolled, no effect) — the fix made it correctly state "heals 2d4", matching C7-003's `/heals 2d4/` signature → convergence dropped to 84/85 until I replaced that stale diverge with a value/opinion question (exactly the "correct that diverge reason" the H-77 note predicted). Convergence 84→85 (100%), suite 8285/0, determinism green. Reproduced LLM-off FIRST.

*2026-06-22 (H-89 — C9 ungrounded prior-holder history; grace lane; gate-10 Lore t11, the sole grace-lockable gate-10 fail):* "who DOES remember who ran this inn before Corwin?" rolled a contentless success ("you manage it, the way opens", `[roll:18]`) — the C4/C9 empty-success rail on an ungrounded past. Some prior-holder phrasings already declined (matched an existing RE), but "who remembers who ran this bakery before her?" / "who used to run this stall before?" / "who had this place before the baker took over?" missed every `isInfoSeekingText` sub-RE → observe-deadend. `INFO_SEEKING_PRIOR_HOLDER_RE` (who + holding verb {ran/owned/kept/held/managed/had} + before) routes them to deliver-or-decline. **C9 4L→5L** (C9-007 locked: 6 paraphrases + 2 diverge — the current-owner "who runs this place?" stays answerable, the "run … before" movement action stays an action). Convergence 85→86 (100%), suite 8285/0, determinism green (the widen touches every `isInfoSeekingText` call site, no regression). Reproduced LLM-off FIRST. **The grace-lane ungrounded-history vein (founding + tenure + prior-holder) is now corpus-closed for the abstract/role forms;** the remaining C9 tail (C9-001/004 target) is NER-blocked or named-NPC = playloop, as before.

*2026-06-22 (gate 11 — CAPSTONE post H-87..H-90, Basecamp main window; `docs/playtests/opus-gate-2026-06-22-gate11.md`):* **12/48** (RL 3 · Chaos 2 · Lore 3 · Newbie 4), up from gate-10's 4/48 on the same seed/personas — **the bouncing ruler: persona-variance onto fresh veins, NOT regression** (the frozen corpus held **87/87 green**, which deterministically rules out any locked-case regression; this run's RL drilled a combat-death vein, Newbie an elder/info vein). **DISCOVERY = 0 new capabilities — all 12 map to known rows (C2/C4/C5/C8/C9/C10/C12/C15) → the 6th consecutive 0-discovery gate (6→7→8→9→10→11). The Road-A capability set is closed.** **H-87/88/89 HELD** (none of their shapes recurred). **H-90's mechanism HELD but its denylist is incomplete:** Lore t10 *"Enough about Corwin…"* parsed "Enough" as an NPC name (`no one named Enough`) — the SAME sentence-initial false-NER class with a token H-90 didn't cover → **H-91** (the ONLY clearly grace/playloop-lockable new fail). This sub-vein has now recurred across H-84/H-90/gate-11 with fresh tokens each time → per §2.4 that argues for the **durable positive-signal gate** (require `hasPersonReferentSignal`/known-NPC inside `concreteNpcReferentFromText`) over another denylist token-add. **The other 11 are the two live frontiers — both previously flagged, neither Road-A-grace-lockable:** **(a) NARRATION track / THE_REF ×4** — empty-success-on-a-succeeded-action (Newbie t9), kick-back-as-a-UI-prompt (Newbie t11), an ignored yes/no answerable from canon (RL t11, Corwin is dead), a hand-wavy non-answer to a present-NPC question (Lore t11); **(b) COMBAT-TRUTH (C8/C10/C15, playloop/Codex lane) ×4** — a harmless practice-swing hijacked into an unrequested NPC attack (RL t3) that cascaded into a kill with NO roll behind it + Corwin speaking after he "crumpled" (RL t8, C8 narration>mechanics), active combat resolved as mere table-talk with no dice/HP (Chaos t5, C15), a declared-action substitution (Chaos t8, C10); **(c) RAG deliver-canonical-fact ×2** — the canonical elder Kael not surfaced for "the oldest person" (Lore t1), the bandit Brokefang omitted (Newbie t3) → C4/C2; **(d) C12/C9 invented-barrier to a PRESENT NPC ×1** — the present elder placed "out of reach" (Newbie t12), the H-81 tail. **Strategic verdict: Road-A grace is DONE** (6th 0-discovery gate; the sole new grace-lockable fail = H-91 "Enough"). **The frontier is NARRATION (THE_REF: Ex-1 + Tier 0/1) + COMBAT-TRUTH (Codex/playloop, C8/C10/C15).** The next paid gate should FOLLOW a narration/combat batch, not precede it (batch-before-gate). **Methodology:** the hardened judge held — no roll-recall false-positives; tags confirmed against the per-turn judge rationales. The Vol-14 Opus×Opus self-preference caveat stands; a cross-family re-judge is the future hardening. **Cost ~$2.86** (96 calls, 152,929 tokens).

*2026-06-22 (H-92 — combat-truth cluster, 3 of 4; playloop, Basecamp-authored autonomous, Tim away):* gate-11's combat-truth fails — **#1** practice-swing-at-object fabricated an attack on a present bystander (RL t1, C10), **#9** a natural-weapon bite read as a social taunt → `[combat:table-talk]` (Chaos t6, C15/C10), **#2** an alive/dead status query swallowed by the leading-body-verb trivial gate → "You kneel" (RL t2, C4). Fixes (all `playloop.js`): inanimate-target guard in `detectAttackAnyIntent` (a strike "at the post/dummy/wall" naming no present NPC returns null — the trailing "hit it" no longer mints a foe via `fuzzyMatchNpc`'s generic-descriptor arm); `isNaturalWeaponAttack` added to the active-combat `explicitAction` set (bite/maul/"with my teeth"/"rip…throat" resolves as a strike); `tryNpcStatusQuery` answers alive/dead from canon (defeated→dead, else alive) before the trivial gate. **C10 10L→12L** (C10-005/006), **C4 9L→11L** (C4-010/011); + fixtures `crowd_baker`/`defeated_npc`. Convergence 88→92 (100%), suite 8285/0, determinism green. Reproduced LLM-off FIRST (#1 needed a 2-NPC world). **#10 (throw-a-bystander-into-a-hazard → Improvised-Burning-Oil strike substitution) deferred → H-93** (escapeCombat resolver, needs design); #8 (unsubstantiated kill) falls out with #1.

*2026-06-22 (gate 12 — post H-91/H-92, autonomous Basecamp; `docs/playtests/opus-gate-2026-06-22-gate12.md`):* **7/48** (RL 2 · Chaos 5 · Lore 1 · Newbie **0**), down from gate-11's 12/48 same seed/personas — **bouncing ruler** (this run's Newbie was clean, Chaos drilled combat/coins; the corpus held **92/92** → no locked regression). **H-92 HELD LIVE — none of its three classes recurred** (no practice-swing→NPC-attack, no bite→table-talk, no alive/dead→"You kneel"); the autonomous combat-truth work validated. **DISCOVERY = 0 new Road-A capabilities (7th straight, gates 6–12).** The 7 map to known classes + one parked-feature theme:
- **Combat-truth (C8/C10/C15) ×3 — still the live frontier.** (a) **C15/C10 — "I stamp my boot on Corwin's hand" in active combat → `[combat:table-talk]`** (Chaos), no roll/HP — the SAME table-talk-swallows-a-combat-action class H-92 #9 fixed for natural weapons, but UNARMED/improvised strikes (stomp/stamp/kick-down) aren't covered → **`isNaturalWeaponAttack` is too narrow; H-93 must generalize to unarmed strikes.** (b) **C8 — "count the coins in his face" → an INVENTED grapple-throw of Corwin** + 4 dmg vs 4 HP yet `defeated:false` (Chaos) — action-substitution + defeat-not-registered. (c) **C8 — leap-onto-stall `[hazard:fall|9]`** at PC HP 1 but HP not shown decreasing (Chaos) — hazard-damage reconciliation.
- **Narration / THE_REF empty-success ×2.** "hold the rings up, shout for the village to see" → `[roll:15 success]` "It comes off cleanly; the moment turns toward you" (Chaos); "who handed the rope to the stranger — coin or barter?" → `[roll:17 success]` same empty filler (Lore, **high**). Succeeded-roll-delivers-no-content — THE_REF Tier-0/1, flagged since gate 5.
- **TRADE ([[IG-13]] feature gap) ×2 — this run's NEW theme.** "will you take the Worn Blade and give me anything for it?" → NPC says "Yes" but `[physics:Worn Blade | deltas:0 | offline]` (no transfer); "what's Torva got worth buying, what'd she pay for my Blade?" → atmospheric dialogue, neither resolved. **This is trade-from-anyone — a PARKED FEATURE, not a Road-A grace capability** — surfaced live because the personas drilled trade/coins. → Tim decision: build trade-from-NPC resolution, or keep parked.
**Verdict: Road-A stays CLOSED** (0 new capabilities, 7th gate); **H-91/H-92 held live.** Actionable Road-A/playloop work = **H-93 — combat-resolution truthfulness** (Codex/playloop+escapeCombat lane): generalize the combat-action recognizer so unarmed/improvised strikes RESOLVE (not table-talk) + defeat/HP registration + hazard-damage application; folds in the deferred #10. Narration empty-success = THE_REF. Trade = IG-13 product call. **Cost ~$2.78** (96 calls, 152,257 tokens); **budget $19 → ~$16.22.**

*2026-06-22 (H-93a probe — a NON-fix worth recording; reproduce-first caught it):* before extending the combat-action recognizer for gate-12 #4, an LLM-off probe in `active_combat` showed unarmed/improvised strikes (stomp/stamp/punch/knee/kick at the foe) **ALREADY resolve as strikes** (`[strike:Kick|Stomp|Punch|Knee]`) — so #4's `[combat:table-talk]` is **NOT a recognizer gap**; it is context-specific to the gate's Corwin-as-combatant-in-a-settlement-building state (round 3), which `active_combat` (Lingerer/escape-mode) does not reproduce. → #4 belongs to the DEEP combat-path work (**H-93**, Codex/escapeCombat lane), needs a gate-matching fixture, NOT a quick playloop guard. The probe also surfaced a **pre-existing over-fire: "I stomp my feet in frustration" resolves as a Stomp strike at the foe** (the escape resolver's strike-default is too eager on unarmed verbs with no real foe target) → fold into H-93. **Net: H-93a NOT shipped** (no unverifiable fix) — the combat-truth frontier is confirmed DEEP (escapeCombat/combat-state), not a recognizer tweak. **H-93 scope (Codex/escapeCombat, when available): (1)** #4 stomp-in-active-NPC-combat → resolve (with a gate-matching fixture); **(2)** defeat/HP registration (4 dmg vs 4 HP must set `defeated`); **(3)** hazard-damage application (fall at HP 1 must deduct/down); **(4)** the #10 throw-a-bystander-into-a-hazard substitution; **(5)** the stomp-frustration over-fire (strike-default needs a foe-target guard).

*2026-06-22 (H-93 DONE — combat-truth, escapeCombat/playloop; Opus deep-engine stand-in, Tim away):* closed the reproducible half of the gate-12 cluster and **disproved the other half as measurement artifacts** (the H-93a scope's items 2/3 + the brief's A/B). **Reproduce-first verdict:** **(2/A defeat registration)** a direct `resolveGrappleAction` at hp≤0 sets `defeated:true` ("they don't get up") and the victory check ends combat — the gate's "4 dmg vs 4 HP → defeated:false" just means the foe held >4 HP (judge misread, not an engine miss). **(3/B hazard damage)** `resolveHazard` DOES apply to `meta.escapeHp` in BOTH paths — leap-off-roof at escapeHp 1 → 0 HP + `[combat:dying]` (in-combat) / hazard-death ending lock (out-of-combat), narration shows "(You: 0/12 HP)"; the gate complaint was narration-emphasis (THE_REF), not a missed deduction. **Shipped (1/5 + #4/D):** the escape resolver's strike-DEFAULT was over-firing — **(C/#5)** "stomp my feet in frustration" / "pace the room" / "wring my hands" became phantom swings, and **(D/#4)** a foe-directed `stamp` (recognizer only knew `stomp`), incl. a compound after a non-combat clause, was eaten by the flee guard → table-talk. Fixes: `stamp` added to `parseEscapeAction` unarmed + `isTargetedViolentCombatAction`; new `isCombatNonAttackBodyIdle` guard (no-foe-ref + no-weapon-verb + self/emotion/idle frame → table-talk). **C10 12L→14L** (C10-007 over-fire→table-talk, C10-008 foe-directed/stamp/compound→strike). Convergence 92→94 (100%), suite 8285/0, determinism 200/0. **Regression caught in-flight:** adding `its` to the foe-pronoun set broke U149 ("kick the door off **its** hinges" → false foe-strike) — reverted; the `its hand`+flee-word compound stays a deferred edge. **Deferred → H-94:** E (throw-a-bystander substitution; needs design), the `its hand` compound edge, and A/B narration-emphasis (THE_REF). **Meta:** two of the four cluster items were the test-not-the-engine — the second time this gate's combat tags have read worse than the mechanics actually are; a cross-family re-judge / per-turn state-dump would cut these false combat fails.

*2026-06-22 (W-1 — FIRST WORLD-WIRING SLICE: place-history materialization; playloop, Basecamp-authored, Tim away):*
the pivot's first location slice — give the DM one real location's worth of TRUE facts and the empty-success /
"answer from real data" problem becomes deliver-or-decline. **Root cause:** `engine/substrate.js` was built but
its Phase-2 narration wiring was never done — it already mints a deterministic per-node founding fact on visit
(vivid/dim/myth clarity, §0-safe by construction: labels never allude to the cosmology), wired into dungeon-gen /
settlement-ticker / NPC-dialogue-voice but **NOT into the location-level deliver path**. So "how was this town
founded?" floored ("your eyes move slow…"), rolled a fake failure, or declined — while the true fact sat unread.
**Fix (`playloop.js`, no roll, before the explore floor + before resolve):** `isPlaceFoundingQuery` (how/why
CIRCUMSTANCE forms only) + `nodeFoundingFact` (NODE-layer substrate, never region/cosmology) → deliver the true
founding fact, else honest-decline. CIRCUMSTANCE-only is the safety: who/whose/how-many/which-family asks request
an AGENT/COUNT the label never holds, so they stay on the existing founding-decline path (C9 non-invention). New
`trade_town_tavern` fixture (a node with its substrate SEEDED — the thing `village_baker` deliberately lacks, which
is why village_baker's founding questions keep declining: NODE-scope + no node events = unchanged → C9-005/006/007
locked). **C4 11L→12L** (C4-012 deliver), **C9 5L→6L** (C9-008 the deliver/decline boundary on a real location).
Convergence 94→**96 (100%)**, suite **8285/0**, determinism **6/6** (substrate is RNG-isolated by design).
Reproduced LLM-off FIRST on `trade_town_tavern` AND on a real `beginAdventure` world. **Live-verified in v1.html**
(per PLAYTEST_PROTOCOL, screenshots): seeded a played save into a settlement, "how was this town founded?" →
*"Settled where the road bends and the water table is reliably shallow — the well never runs dry"* (true fact, no
roll), "who founded this town? give me a name." → honest in-character decline (no invented founder). **This is the
WORLD-WIRING track (W-#), not Road-A** — the seam stressed was the known-vs-unknown / materialization boundary, now
locally wired and behavior-locked. **Next slices (toward `docs/DEMO_REGION.md`):** the local-event "what happened
here?" deliver (riskier — collides with relational history, deferred deliberately); the barkeep voicing the
founding IN dialogue (the `npcSubstrateContext` path, already fed); region-layer history one rung up the clarity
ladder. One location at a time.

*2026-06-22 (W-2 + W-3 — the World-Query Resolver + its first extension; playloop/world, Basecamp-authored):* the
category-first graduation of the W-1 spike (Tim's Rung-1-lesson correction: structure FIRST, phrasings as water).
**W-2** built `engine/world/placeQuery.js` — a render-free typed resolver (`classifyPlaceQuery`→`resolvePlaceFact`)
that OWNS place knowledge — and lifted W-1 `founding` into it **behavior-locked** (byte-identical). **W-3** added
`events` ("what happened here?" → node substrate local-event) as the **first new TYPE = one `{type,classify,resolve}`
slot + one renderer-detail line** — proving extension is a slot, not a handler. The agent/count boundary is a
SHARED `PLACE_AGENT_COUNT_RE` (circumstance-vs-agent = a property of the data); `events` is place-anchored so
relational/person history still deflects (C9-002/003 green). C4 12→13L (C4-013; C4-004 made variant-robust —
matches the `no-record` decline signal, excludes unchanged). U220 locks the resolver contract directly (8/8).
**W-4** (`463538d`) added `population` ("who lives here?" → the sociable `settlement.npcs` roster) — a category-BOUNDARY
proof: the type is one slot, the work is the *exclusions* (a who-question that must never answer founder / cause /
secret-control / services / leadership / hidden-watcher) + the **hostile-never-named** safety. Verified the roster
source FIRST (don't invent data); `META_NPC_ROSTER` untouched (fires first; a future unify target). C4 12→14L
(C4-013 events, C4-014 population). Convergence 98/98, suite 8297/0, determinism 6/6; live-verified in v1.html
(founding + events + population all deliver; the hostile unnamed). Design + build sequence:
`docs/WORLD_QUERY_RESOLVER.md`. **3 types live → next = wire the NPC-dialogue renderer, then the natural point to
spend a gate on the materialization lift.**

*2026-06-22 (W-5 — `control` DEFERRED, design note only, NO behavior; the "verify source first, don't invent"
discipline working as intended):* "who runs this place?" was investigated as the next slot and **deliberately not
implemented** — there is **no grounded public-leadership source** in the engine (no `settlement.leader`/`node.ruler`/
faction-controls-node field; `elder` is one NPC *role* among seven, not a designated governor; `'Civic Authority'`
is a generic fallback faction; the tenure-grounding path has nothing feeding it; `NOT_PLACE_DESCRIPTION_RE` + the
locked C9-006 tenure-decline already decline it on purpose). A deliver-slot would have to **invent a ruler**, which
contradicts C9 non-invention. Verified the five control phrasings classify to `null` (so `population` does not poach
them) and fall to a safe non-inventing floor. **What unlocks it:** a node-level public-governance field (or wiring
the `DEMO_REGION.md` authorities as engine data — today only *content*). Boundary + design recorded in
`docs/WORLD_QUERY_RESOLVER.md` §2a. **No convergence/suite/determinism delta — zero code changed.**

*2026-06-22 (W-6 — NPC-dialogue renderer; "one fact, two voices" closed):* `commonKnowledgeAnswer` now calls
`resolvePlaceFact` for founding/events/population and renders the same grounded fact the narrator delivers, in NPC
voice (`renderPlaceFactNpc`) — **not a second resolver.** Key design call: **resolver-FIRST**, so the existing
`NOT_PLACE_DESCRIPTION_RE` carve-outs were **kept** (not dropped) as the honest-decline backstop for the null case
(unknown node → decline, not a generic blurb). Population threads an `excludeId` perspective param so the speaking
NPC doesn't list itself. Speaker-knows is structural (node-clarity = locally common × purity #8 co-location), so no
separate "speaker knows this?" policy was needed. The required control negative surfaced + closed a **pre-existing
leak** (control questions fell to the generic place blurb) by tightening the guard to mirror `PLACE_POPULATION_EXCLUDE_RE`.
**C4 14L→18L** (C4-015/016/017 voiced + C4-018 unknown-node decline), **+U221** (6), convergence **102/102**, suite
**8303/0**, determinism green, **live-verified in v1.html** (founding voiced; control deflected, no invention).

*2026-06-22 (W-7 — materialization-batch hardening/audit, pre-gate):* focused architecture audit over the
founding/events/population batch (both voices). **Verdict: no code defect** — narrator + NPC both render the same
grounded fact via `resolvePlaceFact`; control stays deferred/non-inventive; services/directions/news/self route
correctly; person/object/cause/bare-"what happened?" all deflect (not poached); §0 hidden at every sink. Patch =
tests only: 2 diverge-LOCKS (bare "what happened?" + object-query) added to C4-016/017 (no new locked cases →
**C4 stays 18L**). convergence 102/102, suite 8303/0, determinism untouched. Batch stable → paid-gate request
drafted (not run). Residual (non-blocking): some unknown-founding phrasings fall to a pre-existing generic blurb
(non-inventing) instead of a curt decline — a future decline-coverage tidy.

*2026-06-22 (P-1/P-2 — PERSON scope, first slot `identity`):* the second World-Query scope goes live
(`engine/world/personQuery.js`, sibling of placeQuery). Closes a Rung-1 **under-claim** hole: "who is the
tavern-keeper? / who is Corwin? / what do I know about Bram?" had grounded roster data but **floored** — now names
the present non-hostile NPC (name+role), NO roll, both voices. **P-1 found it's not greenfield:** grace's
`META_NPC_OBSERVER` already does the generic-descriptor narrator ask (left untouched — documented seam), so
personQuery takes the floor-gap (named/specific-role/"about them") + the dialogue gap (W-6 left NPCs only able to
do `self`). DELIVER-or-FALL-THROUGH: unknown→`[clarify:referent]`, demonstrative→dialogue-enter unchanged.
DEFERRED (no grounded source): motive/secret/backstory/allegiance/cult/thoughts/tenure/leadership + history-fate
("who was X before… what happened to them") — fall through, never invented. Caught + fixed in-flight a loose-role
over-claim (history-fate now in the DEFER guard; 104/105 → 105/105). **C4 18L→21L** (C4-019/020/021), **+U222** (7),
convergence **105/105**, suite **8310/0**, determinism **225/225**, **live-verified in v1.html** (both voices).

*2026-06-22 (EK-1 — Law of Earned Knowledge: kill the narrator fabrication license; + O-1 ObjectQuery defer):*
the one narrator path licensed to **fabricate** — `llmAdapter.js:151`, "on a `→ success` proper-noun ask, state a
concrete answer, **invent a plausible one**" — closed. It contradicted the standing `:147` grounded-only rule and
was **self-defeating**: clean-origin repro (inline `playerMove` probes) showed an info-ask that escapes
`isInfoSeekingText` DOES roll a real `→ success` ("tell me the name" **15/80 seeds**, "give me a date" 15/80,
"name him" 11/80) and reaches :151 — but the post-LLM validator (`validateNarrationCandidate` /
`findInventedProperNoun` [U142], `findInventedFactClaim` [U212]) already rejects the invented name/place/date/
duration and `augmentNarration` falls back to base, so :151 mostly produced the very **deflection it banned**
(ACTIVE-but-largely-latent; the narrow live residual = lowercase/numberless "identifiable facts" slipping both
guards). **Fork A (prompt-only):** :151 rewritten to deliver a specific ONLY when grounded (facts / PLACE HISTORY /
base narration) and forbid coining any ungrounded name/title/date/fact, keeping the anti-deflection win. **+U223**
(5 assertions, pure `buildSystemPrompt`), convergence **105/105**, suite **8315/0**, determinism green. Governing
doc `docs/LAW_OF_EARNED_KNOWLEDGE.md`. **O-1 (ObjectQuery boundary):** investigated, **deferred docs-only** —
`object.identity/description` is already a competent handler (`tryExamineTarget`, `playloop.js:4670`: delivers real
furniture name/notes/state/parts + carried items, miss → grounded redirect, never invents, observe-only), so a
parallel `objectQuery.js` would duplicate/refactor working code with no question pulling it. One non-blocking seam
(verb-less bare demonstratives "what is that object?" under-surface present furniture → room-overview) =
**DEFERRED_COVERAGE**, not a Rung-1 blocker. Recorded in `docs/WORLD_QUERY_RESOLVER.md` §9.

*2026-06-23 (H-94 — combat-initiation parity; playloop, Basecamp-authored):* attacking a not-yet-hostile present
NPC with an unarmed/improvised strike must START combat, not fall to generic grace. **(1)** "I stamp my boot down on
Corwin's hand" hit a WITS skill roll because `ANY_VIOLENCE`/`DIRECT_ATTACK_VERB` knew `stomp` not `stamp` — added
`stamp`. **(2)** "I tell Corwin I could stomp him" wrongly started combat (`DIRECT_ATTACK_VERB` matched "stomp him"
→ "him" → present NPC) — new `isSpokenOrHypotheticalViolence` (speech-frame opener **and** a reported first-person
modal) bails reported speech in all three initiation detectors; "I tell X off and punch him" and "Corwin, I'll kill
you" still fight. **+U224** (12 cases: 6 positive, 4 negative, 2 guard-precision). Convergence 105/105, suite
8315→8327/0, determinism green. Reproduced LLM-off FIRST. Commit `e4a5c22`.

*2026-06-23 (H-95 — grapple/throw bystander + hazard; playloop, Basecamp-authored; the gate-12 #10 / H-93-deferred
E):* mid-fight, "throw the fleeing villager into the burning stall" fabricated `[strike:Improvised Burning Oil]` at
the active foe (the escape resolver models only combatants); the same "unknown text → strike the foe" default also
turned "help the fleeing villager away from the fire" into a worn-blade swing. New `isCombatBystanderHandling`
(handling verb + bystander noun matching no present enemy) → honest `[combat:bystander-unreachable]` decline,
guarded BEFORE `detectNewCombatTarget`, firing regardless of `explicitAction`. There is NO throw-a-person-into-hazard
mechanic (`hazard.js` FIRE_RE = "throw MYSELF into fire") → decline is the honest resolution (P4). Untouched: "throw
oil AT the monster" (prop → improvised weapon), "grab the monster" (grapple), and the out-of-combat
assault-a-villager-starts-combat path (C10-003, via `engageNpcCombat`). **+U225** (8 cases). Convergence 105/105,
suite 8327→8334/0, determinism green. Reproduced LLM-off FIRST. Commit `e600b90`.

*2026-06-23 (gate 13 — TARGETED lore-hound, post EK-1 / world-query / H-94 / H-95; `docs/playtests/opus-gate-2026-06-23.md`):*
`node scripts/dm-playtest.mjs --personas lore-hound --turns 12` (1 persona × glass-harbor × 12). **11/12 pass —
0 crunch / 0 RAG / 1 vibe.** Cost **~$0.70** (24 Opus calls, 37,637 tokens). The lore-hound drilled invention bait
(oldest person, Corwin's teacher, Kael's age, founder + year, founding tale, a single founder name) →
**EK-1 holds LIVE: 0 invented facts**; **world-query materialization works live** (0 RAG); **honest declines
acceptable** (the founding YEAR and a teacher-name declined; the adversarial player conceded "fine — no year, then"
with no vibe fail); **no §0/protected-lore leakage**. **Sole failure: turn-5 empty-success** — a pointed challenge to
Kael ("did Corwin lie?") on `[roll:20 vs DC:12 → success]` returned *"You see it through, and it goes your way"*
(content-free, resolves nothing) → **THE_REF empty-success / DM_TEST_DEADEND**, NOT deterministic. **Conclusion: the
deterministic Rung-1 floor is live-validated** (combat-truth + world-query + earned-knowledge); **THE_REF
empty-success is the one open Rung-1 competence gap → THE_REF-1.** Full 4-persona panel deferred until post-THE_REF-1
(measure the delta, don't re-confirm).

*2026-06-23 (THE_REF-1 — empty-success materialization; narration/grace, Basecamp-authored; gate-13 turn-5):* the
sole gate-13 failure — a pointed challenge to Kael ("are you telling me he lied?") on `[roll:20 vs DC:12 → success]`
returned the content-free `gen:s` filler "You see it through, and it goes your way" (DM_TEST_DEADEND / empty-success).
**Deterministic root cause** (not LLM/validator), two gaps: **(1)** `isConfrontationChallenge` missed the
accusation-BY-QUESTION shape ("are you telling me … lied?", "are you lying?") — it only had present-tense
"you're lying"; **(2)** `genericGroundedOutcome`'s confrontation branch was FAILURE-only, so a succeeded challenge
fell through to the gen:s/gen:m atmosphere bank. **Fix:** `CONFRONTATION_TELLING_LIED_RE` (tight: a telling/saying
frame + a lie token, or bare "are you lying" — "are you telling me the truth/where Kael is?" do NOT match) +
outcome-aware `confrontationReaction` (success = a landed read/tell, mixed = a half-caught flicker, failure =
stonewall) fired on ALL outcomes. The contested FACT is never conceded or invented — a landed read is a tell, not
the lore (EK-1 / Law of Earned Knowledge holds). In-dialogue confrontations unchanged (askNpc already reacts).
**+U226** (8 cases); **U205-27/28 flipped** from the now-superseded failure-only scope to the THE_REF-1 behavior
(success/mixed react, no filler, no concession — strengthened, not weakened). Convergence 105/105, suite
8334→8342/0, determinism green. Reproduced LLM-off FIRST. Commit `7534c16`. **Conclusion: the gate-13 empty-success
failure class is fixed on the deterministic floor; targeted lore-hound rerun next to confirm live.** (Separate
deferred THE_REF defect, NOT fixed here: the composer's garbled material-injection prose "In the Saltmarket Town,
flour—… what do you do?".)

*2026-06-23 (THE_REF-1 targeted rerun — lore-hound, post-THE_REF-1; `docs/playtests/opus-gate-2026-06-23-theref1-rerun.md`):*
`node scripts/dm-playtest.mjs --personas lore-hound --turns 12` (glass-harbor). **8/12 pass — 0 crunch / 0 RAG /
4 vibe.** Cost ~$0.72 (24 calls, 37,620 tokens). Fresh-vein sampling (Corwin→Kael→Tove→Brae) — the frozen corpus held
105/105 and EK-1/RAG/crunch were clean (0 invented, 0 hallucinated). The 4 vibe fails split into two deterministic
classes: **(a) two MENU-BOUNCES** — "That's no answer, Corwin…" / "That's a dice roll, not Brae's voice…" →
`[clarify:referent]` "no one named That" → **closed by H-96**; **(b) two EMPTY-SUCCESS siblings** — "Why does Kael
have no surname?" (a succeeded info-question → gen:s filler) and "Did Tove arrive on a road, or born here? One of
them's wrong." (a contradiction THE_REF-1's classifier misses → gen:s). The exact THE_REF-1 shape ("are you telling
me … lied") was NOT re-asked this run (different vein) — no regression. **Conclusion: proceed to THE_REF-3 (the two
empty-success siblings) BEFORE the full panel (measure a clean delta).**

*2026-06-23 (THE_REF-2 / H-96 — clarify-referent false-NER on sentence-initial contractions; grace,
Basecamp-authored; rerun turns 5 & 11):* "That's no answer, Corwin…" / "That's a dice roll, not Brae's voice. I asked
Brae…" bounced `[clarify:referent]` "no one named That" even with real present NPCs named later. **Deterministic root
cause:** `hasPersonReferentSignal`'s possessive arm (`\b<name>'s\b`) FALSELY matched the copula contraction "That's"
(= "that is") as a possessive person-signal → "That" won the referent over the unsignalled real NPCs and, being
ungrounded, bounced. The clarify gate (`playloop.js:1006`) ALREADY required a positive person-signal
(`requirePersonSignal:true` — the ledger's prescribed approach); the signal itself was lying. **Fix (positive-signal
honesty, NOT a name denylist):** the "'s" arm no longer fires for closed-class function words
(that/there/here/what/where/who/this/it/he/she/they/…); a real possessive ("Brae's voice", "Garrett's brother")
still signals; the his/her/their arm is unchanged. One clause split + a function-word guard — smallest seam, no
extraction/NER refactor. **+U227** (11 cases: 7 contraction positives incl. both gate-turn repros + There's/What's,
2 negatives — absent name via address-verb AND via real possessive still clarify, 2 regression). Convergence 105/105,
suite 8342→8353/0, determinism green. Reproduced LLM-off FIRST. Commit `dd84633`.

*2026-06-23 (THE_REF-3 — empty-success siblings DONE; grace, gate-13 rerun turns 4 & 10):* the two empty-success
shapes the THE_REF-1 rerun surfaced, closed deterministically. **(1)** "Why does Kael have no surname?" —
`isInfoSeekingText` missed the "why does X have no/a <name/attribute>" reason-for-absent-attribute shape → generic
WITS roll → gen:s. Added `INFO_SEEKING_WHY_ABSENT_RE` → deliver-or-decline (delivers if grounded, honestly declines
if not; never invents a reason). **(2)** "One of them's wrong" / "one of those is wrong" / "that contradicts what X
said" — `isConfrontationChallenge` missed the contradiction shape → gen:s. Added `CONFRONTATION_ONE_OF_WRONG_RE` +
`CONFRONTATION_CONTRADICTS_WHO_RE` → outcome-aware `confrontationReaction`; the contested fact is never invented
(EK-1). Tight ("what is wrong?", "wrong turn/road", ordinary "why" do NOT match). **+U228** (11 cases). Convergence
105/105, suite 8353→8365/0, determinism green. Reproduced LLM-off FIRST. Commit `ad9d997`.

*2026-06-23 (gate 14 — FULL 4-persona panel, post THE_REF-1/2/3 + H-94/95/96; `docs/playtests/opus-gate-2026-06-23-fullpanel.md`):*
`node scripts/dm-playtest.mjs --personas rules-lawyer,chaos,lore-hound,newbie --turns 12` (glass-harbor). **6/48
(87.5% pass)** — the BEST result yet on this seed/personas (gate-11 12/48 → gate-12 7/48 → gate-14 6/48). Cost ~$2.70
(96 calls, 148k tokens). Per-persona: RL 1v · Chaos 1v+1c · Lore 1v+1RAG · Newbie 1RAG. **All prior fixes HELD LIVE:**
H-96 "That's…" no-clarify, THE_REF-1 confrontations reacted, H-94/95 combat resolved, THE_REF-3 shapes didn't recur,
EK-1 held under aggressive name/date pressure (only the one lowercase residual below slipped). **The 6 failures were
then closed by a PARALLEL deterministic sprint** (4 file-exclusive lanes on the shared v2-polish branch; Codex on
combat):

| gate-14 fail | shape | packet | commit |
|---|---|---|---|
| Newbie t4 | "who's the elder?" → wrong NPC (Corwin, not Kael) | U231 | `928e7c8` |
| Lore t4 | "name me one other old family" → empty-success | U232 | `dda9e6f` |
| Chaos t7 | tackle a 1-HP foe → `[combat:fled]` on a success roll | U229 | `4a13059` |
| RL t11 | "leave X and walk to Y" → travel clause dropped | U233 | `2ddd65a` |
| Chaos t1 | "kick the door open" → fabricated Improvised-Fixture strike | U230 | `138f856` |
| Lore t12 | fabricated "the quarrel was over the deed" (CANON_HALLUCINATION) | U234 | `b8823d8` |

Post-sprint: convergence 105/105, suite 8398/0, determinism green; all six on origin. **5 of 6 are FULL deterministic
closures; #6 (EK-2 / U234) is BOUNDED** — `findInventedFactClaim`'s new `DISPUTE_CAUSE_RE` closes the one-party
dispute-cause class at the post-LLM validator, but the GENERAL lowercase-fabrication problem remains the **THE_REF
second-model output-validator frontier** (a regex over the validator is whack-a-mole; the principled close is a model
judging the candidate against canon). **Methodology win:** the parallel sprint validated the file-ownership lane model
(escapeCombat / gracefulAdjudication / playloop / llmAdapter exclusive; same-file pairs serialized; pre-assigned
disjoint U-numbers U229–U234; rebase-on-shared-branch). Next decision: re-gate to measure the six live, or keep
building — gate spend is a deliberate call.

*2026-06-23 (gate-15 deterministic batch — empty-result + dialogue-threat-redirect; narration/playloop, Basecamp-
authored; from `docs/playtests/opus-gate-2026-06-23-regate-gate15.md`, 4/48):* the gate-15 failures converged onto
TWO deterministic classes, both now closed:

| gate-15 fail | shape | packet | commit |
|---|---|---|---|
| Lore t11 "is there a healer here?" | empty-SUCCESS — presence question → gen:s | U235 | `4c1d997` |
| Chaos t11 "…where's Corwin?" | empty-MIXED — where-is-present → gen:m | U235 | `4c1d997` |
| RL t5 "who do I see?" | empty-FAILURE — roster question → gen:f | U235 | `4c1d997` |
| RL t12 threat to the Lingerer | dialogue routing → partner's role-talk | U236 | `68ff029` |

**U235 (empty-result class):** a who's-here / where-is-present / is-there-here PRESENCE question escaped every detector
(isInfoSeekingText / meta / confrontation / npc-observer) and fell to `genericGroundedOutcome`'s gen:s/m/f atmosphere
bank — answering a concrete question with content-free filler. Fix: `answerOrDeclineQuestion`, wired into BOTH the
`grounded` chain (so it fires regardless of whether the composer floored — a fresh-world repro hits composer
atmosphere, the gate hit the gen bank; same class, two paths) AND `genericGroundedOutcome`'s floor. Presence → the live
roster (`buildLocationSurvey` — the present people are canon); grounded fact → delivered; else honest `declineInfoSeek`.
Confrontations stay owned by `confrontationReaction`; action/permission questions ("can I climb?") and action statements
with a trailing "?" keep the action floor — diverge-locked. **U236 (dialogue-threat-redirect):** `isDialogueBreakingIntent`
only broke on movement/physics, so a threat/attack at a present NPC fell to the "ask the partner" branch (even a bare
"I attack the Lingerer" was swallowed as a deflected ask to Corwin). Fix: it now breaks on (a) an explicit attack on any
present NPC, and (b) a threat/ultimatum aimed at a NON-partner present NPC; `detectApproach` now recognizes the ultimatum
shape ("last chance to talk before I make you") so the redirected threat resolves AS an intimidate against its target,
never atmosphere. Partner-threats and advice-questions stay in dialogue — diverge-locked. **+U235 (13 cases), +U236
(8 cases).** Convergence 105/105, suite 8398→8415/0, determinism green. Both reproduced LLM-off FIRST; pushed
`a13f574..68ff029`. (Gate-16 was initially BLOCKED ~1h by an Anthropic API outage — 500→529 all models; rode through
it with a more-patient gate retry, `3d58f99`.)

*2026-06-23 (gate 16 — FULL 4-persona panel, post U235/U236; `docs/playtests/opus-gate-2026-06-23-gate16.md`):*
`node scripts/dm-playtest.mjs --personas rules-lawyer,chaos,lore-hound,newbie --turns 12` (glass-harbor). **5/48**
(trend 12→7→6→4→5; the ±1 is ruler-noise — corpus 100% is the floor). Cost ~$2.79 (96 calls, 150k tokens). **Gate
budget: 1/7.** **U235/U236 HELD** — the exact gate-15 empty-result/dialogue-routing shapes did NOT recur. The 5 NEW
failures, classified:

| gate-16 fail | shape | class | disposition |
|---|---|---|---|
| Lore "name one person old enough to remember the Boneknits" → gen:s | empty-success, IMPERATIVE info-request (not question-shaped, not "name me") | DETERMINISTIC | fix (U235/U232 sibling) |
| Newbie "what happened in the old days?" → "Nothing's happened yet" | backstory ask; `INFO_SEEKING_BACKSTORY_RE` misses "the old days" → meta-recap bounce | DETERMINISTIC | fix |
| RL "level the blade at the figure—roll my attack. what did I roll?" → quotes prior roll | meta roll-query preempts a declared attack; "the figure" doesn't resolve to the lurker | DETERMINISTIC (combat-adjacent) | assess |
| Chaos grab+throw Brokefang → damage attributed backwards | grapple/throw egress mis-attributes the hit to the PC | DETERMINISTIC, **escapeCombat hot-file** | DEFER to combat lane |
| Lore Kael "recite the ledger — how many nights, who vouched" → fabricated "three nights / Corwin vouched" | NPC-voice fabricates a non-existent record | **THE_REF frontier** (second-model validator) | note |

The #1/#2 grace gaps were closed (U237, `3b3f220`). #3 was NOT reproducible LLM-off (a faithful
reconstruction — present hostile lurker + prior roll — starts combat correctly; the gate miss is a
glass-harbor-specific fuzzyMatch on the lurker's name) → DEFERRED. #4 flagged for the combat lane
(`task_22892b66`). #5 stays the THE_REF frontier.

*2026-06-23 (gate 17 — FULL 4-persona panel, post U237; `docs/playtests/opus-gate-2026-06-23-gate17.md`):*
`node scripts/dm-playtest.mjs --personas rules-lawyer,chaos,lore-hound,newbie --turns 12` (glass-harbor). **3/48**
(trend 12→7→6→4→5→3; BEST yet). Cost ~$2.80. **Gate budget: 2/7.** **U235/U236/U237 HELD** — 0 empty-result,
0 fabrication, 0 combat recurrence. The 3 NEW failures (all DM_TEST_DEADEND, all "intent bounced not resolved",
all narration/grace/movement lane):

| gate-17 fail | shape | class | disposition |
|---|---|---|---|
| RL "look around the room — what do I have on me? check gear/stats" → room survey, inventory dropped | compound: explore (META_LOCATION) preempts the meta-inventory query | DETERMINISTIC | fix |
| RL "what's your name, and which old dispute…?" → NPC "turns and waits" | dialogue-ENTER on first contact drops the question instead of answering it | DETERMINISTIC | fix |
| Newbie "go talk to that stranger" (from inside a building) → "That way is blocked from here" | interior→approach-NPC bounces with a logistics wall (THE_DM_TEST violation) | DETERMINISTIC | fix |

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
