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
| C2 | A **named referent** must be grounded before the turn resolves | H-56, C2-grad, **H-60** | `ungroundedNpcReferentForText` + `hasPersonReferentSignal` + observe/travel hoist | 5L/0T | **✓** |
| C3 | A **declared check** gets a DC + roll | H-54 R4 | `META_EXPLICIT_CHECK_*` | 0L/3T | — |
| C4 | Info-seeking **delivers a grounded fact or honestly declines** | H-22/23/29/31/39, **H-63** | `isInfoSeekingText` (+existential/origin patterns), `META_PURSE` widened | 4L/2T | **partial** |
| C5 | A **rules/mechanic question** is answered straight, never rolled | H-25/H-54 R3, **H-61** | `META_DAMAGE_RULE`/`META_ATTACK_MOD` + typed governing-stat classifier | 3L/1T | **partial** |
| C6 | **Number-transparency**: own stats/mods/AC/HP/items from the sheet | H-25/H-31/H-40, **H-68** | `answerSkillModifier`, `META_ARMOR_VALUE`, `META_HELD_ITEMS`, `META_INVENTORY` (widened) | 5L/0T | **✓** |
| C7 | **Item/consumable** query answers from real def; **use** applies effect | H-45/H-47/H-65/H-69/H-70, **H-73** | `answerItemQuery`/`META_ITEM` + `CONSUME_RE` + count/compound + bare-count list | 10L/1T | **partial** |
| C8 | **Narration ≤ mechanics** — no hit/defeat the dice didn't produce | H-26/H-28/H-43, **H-72** | `llmAdapter` R1–R3 + playloop `attackResolutionIntent` | 4L/0T | **corpus✓ / live⚠** |
| C9 | **Canon non-invention** — no invented name/date/tenure/relationship | H-27/H-49/H-52 | `findInventedFactClaim` | 2L/2T | — |
| C10 | A **declared attack** routes to real combat resolution | H-30/H-32/H-43/H-48/H-55/H-64/H-71, **H-72** | playloop attack gates + `go for`/flip-onto-person/npc-generic/firebolt + attack-resolution-over-meta | 10L/1T | **partial** |
| C11 | **Confrontation under pressure** → in-character NPC reaction | H-42 | `isConfrontationChallenge`, `confrontationReaction` | 3L/0T | — |
| C12 | **Movement/travel intent** resolves in fiction, no travel-gate bounce | THE_DM_TEST residuals, **H-62** | playloop talkRef-before-free-movement + `extractFindPersonRef` | 3L/0T | **✓** |
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

*2026-06-21 (gate 2 under the convergence framework — `docs/playtests/opus-gate-2026-06-21.md`, 18/48 raw):* the
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
