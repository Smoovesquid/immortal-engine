# PACKETS — active queue + history

A packet is the unit of safe work: small enough that one agent understands every
touched file and a reviewer can read the diff. Spec the done-when and allowed-files
BEFORE editing, so divergence is caught at plan time, not screenshot time.

Schema: `id · objective · allowed_files · forbidden · invariants · test_plan ·
done_when · rollback`.

---

## ACTIVE

> **Single intake — every task lands HERE.** Tasks get invented in many windows; this file is the one
> queue (organ 5 of `THE_BUILD_SYSTEM.md`). No matter which window a task is born in, it comes here — do
> not leave it in a chat, a playtest note, or a sibling doc. **Order = the PRD's six phases**
> (`PRD.md` §7: 0 floor → 1 hook → 2 mirror → 3 end → 4 face → 5 door); **tag each new packet with the
> phase it serves — that tag is its rank.** Within a phase, correctness/blockers before polish. The PRD's
> named next work is **the INT arc** (Phase 0 — the Rung-1 structural close, packetized below 2026-07-03);
> after it, **SL-5** (Phase 1 — "Aldermere wants something"), which is **not yet packetized here**
> (packetize before starting).

### DEATH — THE DEATH CONTRACT (DEATH-1..5) — the final delivery of consequence  ·  morality/combat pillar  ·  **CONTRACT WRITTEN 2026-07-06 (Fable, Tim's direct commission + taste: gory, kill-tailored, loss-delivering; beg/mercy/worse/spare/abandon at the kill moment; man and the gods witness) → `docs/DEATH_CONTRACT.md`. **DEATH-1 ✅ LANDED v0.31.1 b114 (worker `069766d1`+`aff22232` → integrated `67b74658`+`4de584e1`; U596–U598 18 tests; suite 10695/0; audit committed FIRST — `briefs/DEATH-1-audit.md`, 0-HP handling mapped end-to-end). The §2 DEATH FACT assembles pure at every kill (victim/killer/means/woundPath/locale/light/witnesses incl. the gods/stance/intent), stored on the event log, byte-identical ×2, zero numerics; DOWNED built + save/load-proven for communicators but FLAGGED OFF (`dyingEnabled`) until DEATH-2 brings the resolving verbs — kills play exactly as today meanwhile; NO WORLD_VERSION bump (combat-only state, boot anchor held — the honest lazy path); killer-intent routing seam in place (plain blow = clean). Live receipt: a real fight wrote the fact to the save (victim Lingerer, killer player, means worn blade, one wound, one witness, gods present). Audit bonus finding → ENSURE-STATS-1 (below).** DEATH-2 ✅ LANDED v0.31.2 b115 (worker `40bdf73f` → integrated `e394f59b`; U599–U601 24/24 w/ F6 law; suite 10711/0; `dyingEnabled` LIVE — communicators drop DOWNED and BEG, engine-chosen plea from personality (life | quick death | proud defiance), LLM-voiced with LLM-off fallback; the four verbs mint honest deeds through the landed MP organs — mercy-flagged clean kill ≠ cruelty (F6 extended) · worse = HEAVY+ cruelty, gods lean in · sparing mints the LIVING WITNESS + the first strong POSITIVE claim travelling the sole sink, betrayal odds engine-owned · abandonment its own kind, the clock finishes; live receipts: "make it quick" heard, mercy and sparing both played; worker also caught + fixed a latent flag-eating merge bug; 8 combat tests honestly relocked — a kill is a two-beat moment now). **⚖️ TIM'S DESCOPE 2026-07-06: the arc's delivered scope is DEATH-1..3 — "enemies occasionally beg for their lives and the end described in gory detail." DEATH-4 (elegy/loss-ledger) + DEATH-5 (continuation/Underworld seam) are NOT NEEDED — DESCOPED; the contract doc stands as parked law if ever revived; player death keeps today's behavior.** DEATH-3 ✅ LANDED v0.31.3 b116 (worker `34379fac` → integrated `1a57f10b`; U602–U604 35/35; suite 10746/0; the death fact becomes the blow's PROSE — means-tailored (axe≠arrow≠fire), stance-aware (beggar≠duelist), gory-honest never embellished, zero numerics; LLM-off base lines byte-stable; **CG-DEATH armed in the LIVE validator** — contradictions (wrong weapon, phantom plea, mercy-as-torture) block structural with the swap rule, 0 false alarms across 204 fixture combinations; live blows captured verbatim — the mercy reads as "a kindness no one will write down," the example-making as held-breath silence, witnessed. Flagged: corpus rows for kill lines need a one-line downed-foe scenario fixture in the file PW-2 currently holds — trivial follow-up when that lane frees; the byte-lock coverage lives in U602/U604 meanwhile, arguably broader). **🏁 THE DEATH ARC CLOSES HERE, at Tim's descoped line: enemies occasionally beg for their lives, and the end is described in gory detail — delivered whole (DEATH-1..3, b114–b116). DEATH-4/5 stay descoped; the contract parked.**

### PROSE-TO-WORLD (PW-2..6) — the second body of law OPENS  ·  north-star pillar  ·  **ARC OPENED 2026-07-06 per Tim ("please begin prose to world"). PW-2 ✅ LANDED v0.31.4 b117 (worker `f76d882a` → integrated `f0897edd`; U605–U607 + playloop-lane regressions 51/51; suite 10763/0; the engine-side grounding gate at commit time — four legitimate sources take byte-identically, everything else gets the in-voice decline or the honest search pivot (which also fixed an old wrong-object grab); idioms guarded ("take cover/a look/my time", bulk, compound, combat grabs); ZERO corpus re-blessings needed — no phantom rows existed, 131/131 unmoved; live receipts both directions). PW-3 ✅ LANDED v0.31.5 b118 (worker `ef5e9b01` → integrated `f014be11`; U608–U610 + N8 26/26; suite 10780/0; **THE RUMOR LAYER IS LIVE** — first trigger ever: ask a villager beyond their knowledge and they pass the county's hearsay, garbled by worldliness; live receipt (Galen): "Only what's come down the road, mind… Brogan walked out of a burned hamlet in the south with nothing…"; S2/S3 wall PROVEN — skeleton immutable, fabrication rejected → S2 stands, hash unmoved by upgrade; budget ≤3/scene; trigger deliberately conservative — topic-only matching after an eager first draft broke 9 corpus rows, tuned + all restored; seam aligned DOC-to-code (no hash moves), U610 pins it; flagged + accepted at integration: one additive `public/v1.js` payload line (S3 forwarding — well-commented, mode-scoped) and the dialogue.js deflection seam beyond the nominal fence — both reviewed, both sound). PW-4 ✅ LANDED v0.31.6 b119 (worker `009498b6` → integrated `641d612e`; U611 + N12 10/10 — the worker sensibly N-prefixed the narration-fact test, **U612–U613 RELEASED back to the pool**; suite 10790/0; `roomDressing(seed, structureId, roomId[, hint])` pure 3-arg deriver, role/darkness-shaped authored bank, taste-neutral; prompt line framed as PERMISSION beside the objects line; dressing nouns grounded per law 6 — the guard can never reject engine-supplied texture; S1 proven — boot hash invariant BY CONSTRUCTION, zero corpus relocks; live receipt: the Bedchamber's "faded chalk tally on the wall standing quiet witness to some long-forgotten count," repeated exactly on a fresh same-seed boot).** PW-5 ✅ AUDIT LANDED (worker `e77d4c7c` → integrated `cf4f0d19`; `briefs/PW-5-audit.md` — miss-path mapped branch-by-branch at dialogue.js:662/:766/:781 + commonKnowledgeAnswer's 12 branches; PW-3's pickup gates on `mode!=='deflected'` at playloop:5538; the remaining dead-end = REGION-common knowledge, chiefly a NEIGHBORING settlement's lore; the sole reputation read-sink confirmed at lastingWord.js:187 — PW-5 never touches it; insertion seam: after node-local branches, before the place-blurb catch-all, auto-preceding PW-3). **PW-5 BUILD ⛔ BOUNCED AT INTEGRATION 2026-07-06 (worker `2f7b9f17` — the engine slice is SOUND: askNpc-level 25/25 on the integrated tree, secrets hold, determinism proven — but the SCREEN LAW caught it DARK: through the REAL cold gesture ("tell me about Crowfoot Camp" AND U133's own "what do you know about…" phrasing, LLM-on AND LLM-off floor) the person-ask disambiguator intercepts EVERY place-named ask before the dialogue path — "I haven't introduced anyone named Crowfoot Camp… who do you actually mean?" — the bank is unreachable from the front door. The worker's tests drove askNpc, not playerMove — the verify-real-input lesson, again. Pick dropped from mainline (worker branch intact); packet RE-OPENED at the routing seam: known-place names must route to place-lore BEFORE person disambiguation; U618–U621 stay claimed + U622 added for reachability-THROUGH-playerMove).** PW-6 behind.

### SEEK-3 — "I go find Carl and greet him" dead-ends: "That way is blocked from here"  ·  Phase 0 (THE DM TEST)  ·  **✅ LANDED v0.32.1 b121 (worker `3ce5953b`+`c7bf7c07` → integrated `4a7c8bf4`+`829fe098`; diagnosis committed FIRST — `briefs/SEEK-3-named-seek.md`; U623–U624 + the SEEK-PERSON originals U485–487 all green; suite 10826/0; VERDICT: PRE-EXISTING GAP not a regression — reproduced at the oldest of today's four playloop checkpoints; "find <NAME>" fell between the generic-seek and greet-by-name paths and read as walking into a room named Carl; the twist: Carl isn't even AT this settlement — the right answer was always the honest miss, now given: "There's no one named Carl here — Elske Nightherd, Dalla, Asha, the Lingerer are here. Who do you mean?"; present-person seeks walk over and open the greeting same-turn (live: the "In conversation with Asha" banner); find-my-hatchet/the-exit/someone idioms untouched; zero code shared with the PW-5 lane, confirmed)**
- Live receipt (b120+, LLM-on AND the LLM-off floor, from the wake interior): a named, present-at-settlement NPC seek with a compound verb → the blocked-direction dead-end SEEK-PERSON (b081) was built to kill. DIAGNOSE FIRST: is the named-person + compound phrasing outside SEEK-PERSON's matcher (pre-existing gap) or did today's playloop stack (WIN-EGRESS `64710489` · PW-2 `f0897edd` · DECL-STAT wire `b56a6f1b` · JR-HUNT `311f6847`) regress the seek path? Classify with receipts BEFORE fixing; then the fix follows SEEK-PERSON's own pattern (bridge out, approach the person, enter dialogue).

### CORPUS-KILL-1 — the kill lines join the convergence corpus (DEATH-3's flagged follow-up)  ·  micro  ·  **✅ LANDED 2026-07-06 (worker `f0c71e8b` → integrated `79ca27a7`, no build bump — test-net only; corpus 131→135/135; suite 10794/0; `downedFoeWorld` fixture + four locked rows (mercy / plain-finish-reads-as-mercy / worse / abandon — "The road does not wait for the dying.") each with numerics guards + diverge negatives; U617 guards the fixture shape since corpus files sit outside node --test's glob; additive-only footprint).**

### SOCIAL-PHYSICS (SP-2..6) — the third body of law OPENS  ·  Rung 4 seam  ·  **SP-2 ✅ LANDED v0.32.0 b120 (worker `22074796` → integrated `eb597041`; U614–U616 30/30 w/ canary + migration; suite 10817/0; playtest:quick 50/0 at integration + the worker's 550-run full; WORLD_VERSION 31→32 with the FULL ritual — 16 version-string sweeps, old-save warn+upgrade exercised, ethos derived deterministically from goal keywords for old saves (all 10 pack factions classify right, the merchant league lands neutral), U454-E re-pinned `7fc17002…` and it HELD on the integrated tree (PW-4's S1 invariance kept the base hash still); live receipt: one public torture → civic −10 AND shadow +5 same turn, zero numbers — "the thieves' den warms when the watch curses your name" is REAL).** ENSURE-STATS-1 now UNBLOCKED (the state lane freed). SP-3..6 behind per the contract.

### ENSURE-STATS-1 — mintEnemyFromNpc's stats/level are silently stripped (the whitelist trap, live)  ·  combat maintenance  ·  **QUEUED 2026-07-06 (DEATH-1's audit finding, proof at `briefs/DEATH-1-audit.md`)**
- `mintEnemyFromNpc` (combatLifecycle.js:88) emits `stats`, `traits`, `level` — `ensureCombat` (state.js:730) preserves only `traits`; **`stats` and `level` are stripped on the next `ensureWorld`**, so an NPC-minted enemy's combat math silently degrades to defaults mid-fight after any re-normalization. Fix = whitelist the two fields + normalize + the invariants enemy-loop assertion; NOTE: persisting them CHANGES fight behavior for NPC-minted enemies → expect combat-replay pins to move, document each. Small packet; needs the escapeCombat/state serial slot (queue behind the DEATH arc's packets or fold where honest).
- Composes with standing law (nothing overturned): permadeath locked (DND_XCOM) · Underworld = sealed
  seam v1 (DX-3/IG-17 case-file handoff) · IG-5 pale-root elegy (§0 never named) · rides MP-1..5's
  live organs (witnesses/rumor/tiers/pacts/omens) · mercy = the first strong POSITIVE claim source ·
  loss ledger: the elegy must draw ≥3 open-world facts (testable "real loss"). Falsifiers in §6.
  escapeCombat is the hook-point; ensureCombat whitelist trap cited. Non-goals pinned.

### MORAL-PHYSICS (MP-1..MP-6) — the deterministic moral-physics constitution  ·  Rung 4 (PATH_TO_SELLABLE) / morality pillar  ·  **✅ BLESSED (Tim, 2026-07-06 — all three calls: constitution + REPUTATION_UNIFICATION ruling + the F1 play-change). MP-1 ✅ LANDED v0.30.3 b101 (worker `bfbb529e`; U555–U557 11/11; suite 10431/0). F1 was ONE constant (gossip gate 25 vs max deed severity 20 — reputation dead since birth; U276 masked it with impossible severities). Constitution-over-brief conflict honored by the worker: NO parallel mintClaim path — rumorsReaching is the sole sink, witness truth rides as provenance. Fair combat never stains (F6 live). **MP-2 ✅ LANDED v0.30.5 b103 (worker `07135253` → integrated `5e7815fd`; U558–U560 19/19; suite 10479/0; ladder routed at the effectsCore recordDeed chokepoint — playloop untouched; batch-entry morality snapshot so a first atrocity can't self-boost to T4; deed.tier additive + invariant, no WORLD_VERSION bump; T3/T4 computed-not-acted; DEED_SEV.HEAVY mirrored per repo precedent, flagged). MP-3 ✅ LANDED v0.30.8 b106 (worker `a7aa2c65` → integrated `93d4b656`; U563–U565 21/21; heat accrues at the recordDeed chokepoint · own-stream seeded hunt in worldTick at HUNT_HEAT with latch/re-arm · wild asymmetry named-as-feature · playloop untouched; live receipt: "2 strangers keeping to the edges, watching"; U454-E folded into the combined MP-3+CONSEQ-1 anchor 56d52255… at integration). MP-4 ✅ LANDED v0.30.9 b107 (worker `6c50eef7` → integrated `49568f04`; U570–U572 35/35 w/ canary; level-triggered `forbiddenGates` reader + `tickPact` in worldTick through the EXISTING grant machinery — no new powers; `pactT` latch on MP-3's precedent; slow-creep corruption can no longer silently skip the claiming; live receipt: seeded over-threshold save learned `animate_dead` UNBIDDEN and castable, zero numerics shown; worker's flagged call: tick grants the FIRST owed gift, deeper gifts stay with the per-crossing hook — reversible one-liner if Tim prefers deepest). MP-5a ✅ LANDED v0.30.11 b109 (worker `70ab8f74` → integrated `51bc92e8`; U577–U579 23/23 w/ canary; `omenVocabulary.js` seven vice-axes in the manifest-karma voice + read-only `narratorContext` derivation + the llmAdapter line on the doors/terrain idiom; registers faint/rumor/hunted, T0 SILENT, T4 shares hunted BY DESIGN — the gift's own arrival beat is T4's surfacing; U578 caught the worker's own first-draft leak in-build; live LLM-on receipt: wary-stranger atmosphere, zero numerics; integration rewrite: U579-01 no longer duplicates U454-E's anchor literal — asserts SURFACING IS PURE instead). MP-5b ✅ LANDED v0.30.13 b111 (worker `8badfc3a` → integrated `f536cbb0`; U583–U585 24 tests + canary 44/44; the approach-band warning — one REAL present NPC, once, quiet register, waveable, HOLDS until someone is present, LLM-off fallback included; live receipt (Asha): "You carry more than you let on, and one day the weight of that will matter more than the deed itself."; worker's flagged call: once-only rides the event log, not a per-action counter — the FACT fires once, the line may cosmetically linger on truly idle no-op turns; reversible. Integration fix `206a9168`: U582 had duplicated U454-E's anchor literal — 4th of the class — rewritten to structural thread-INERT-at-boot assertion). **✅ THE ARC IS CLOSED — MP-6 LANDED v0.31.0 b113 (worker `01594485` → integrated `a925c22d`; U593–U595 15/15; suite 10682/0). The hunt now reaches NPC actors (lazy `huntedT` latch, own id-keyed stream; player hunt byte-identical — U564 green; boot anchor UNCHANGED). U594 Arc A: an IDLE player watches the world grind Carl end-to-end — attributed deeds → third-person word two towns over → heat crosses → THE HUNT AT HIS DOOR, player record untouched. U595 Arc B: §7 (a)–(e) in full incl. run-wide zero-numerics + ×2 byte-identical replay. Live receipt: "You see Carl the failed sculptor… and 3 strangers keeping to the edges, watching." Flagged: U592-05 one-line 4-key shape bump · NPC hunt spawns at the CURRENT node (off-screen avenger staging = future taste) · no faction-toward-NPC scalar (souring = heat + travelling reputation). GREEN = THE CONSTITUTION IS LAW, NOT VISION — §7's own sentence, in the test header. MP-1..6 complete, b101→b113, one day. NEXT ARC: THE DEATH CONTRACT (Tim's commission, below).** Seam queued: JR-HUNT-1 (below).** The deterministic algebra beneath `MORALITY_SYSTEM.md` (adds no cosmology, overturns no locked decision). Binds the LIVE organs — seven-axis morality, `tryDarkDeed`, `applyDeedCharges`, `mintClaim`/`propagateClaims`, `castConsequence`, `forbiddenGates` — into ONE engine-owned escalation ladder. Gaps it closes (confirmed vs code 2026-07-06; see `briefs/CONTRADICTION_HUNT_2026-07-06.md`): (1) **player-deed reputation is calibrated DEAD** — `rumorsReaching` gates deed-reputation at severity≥25 but max deed severity is 20, so it never fires (hunt F1); (2) no unified escalation ladder keyed on accumulated corruption/heat; (3) **THREE reputation substrates unreconciled** (`claims`/`rumors`/`deeds`) — this doc and PROSE_TO_WORLD targeted different ones (hunt F2); (4) no falsifier. Packets: **MP-1** witness→rumor bridge (smallest; both organs live) · **MP-2** `engine/morality/escalation.js` tier fn + named magnitudes · **MP-3** heat→hunt (T3) · **MP-4** corruption→pact-as-omen (T4) · **MP-5** tier→omen surfacing (hide-the-math) · **MP-6** the Carl Witness Test (`U###` determinism falsifier). Every magnitude engine-owned (Vol 11). **SEAM w/ PW-3** (prose-to-world rumor surfacing): the ONE-substrate question is RULED in `docs/REPUTATION_UNIFICATION.md` (rumorsReaching = sole read-sink; claims = convergence target; F1 fix = MP-1's first step).

### NODE-DESYNC-1 — a failed journey roll COMMITS the node move, and scene.interior survives it  ·  Phase 0  ·  **✅ DONE 2026-07-04-pm (Opus worktree, local commit; tests U403–U406; suite 9588/9588 · convergence 124/124 · live-verified v1.html).** Fix: (1) Living-Terrain `moveToNode` block gated `!scene.interior` — movement can't reach node travel while indoors; (2) `inferInteriorAction` named-room rule → "go to the hearth room" resolves interior-side ("You step through into the hearth room."); (3) `assertWorldInvariants` throws on interior-structure-node ≠ currentNodeId; (4) `ensureWorld` repairs a legacy desync by clearing the stale interior (never throws). Corpus relocks (interior_npc rebuilt on a real boot interior; dialogue_active honestly outdoors; C11 diverge swap; U14/U63 fixtures set node=structure) documented in AGENT_CHANGELOG. **JR-1 (risk premium) is the queued follow-up.** Contract: `docs/POSITION_AS_CANON.md` §3.
- **✅ LANDED 2026-07-04-pm (`881c79b`, v0.28.10 b060) + LIVE RECEIPTS** (fresh Bryn boot on the pushed build):
  "go to the hearth room" → *"You step through into the hearth room."*, `currentNodeId` STAYS Aldermere;
  "look around" names Brogan + the Lingerer, masks the hostile in-fiction, and sees Galen through the
  window — the full presence stack agrees with the morning's outdoor-dot receipt. Quiet-machine check
  GREEN 9601/9601 · convergence 124/124 · determinism green.
- **FOLLOW-UP ✅ LANDED v0.28.15 b065 (`2ec503b3` → `477b338a`, U446–U447): ND-1b — the
  legacy-desync repair doesn't PERSIST.** ROOT: the repair keyed off derived `scene.interior`, which
  the `derivedElsewhere` load-guard had ALREADY nulled — so the raw `party[0].position.interior`
  pointer (the thing scene.interior re-derives FROM) was never cleared and round-tripped through
  every save. FIX: check + `delete` the stale raw pointer itself when its structure sits at the
  wrong node (delete not null — matches interiors.js convention; explicit-null broke U219's shape).
  First save after loading a broken game now converges; second load performs zero repair;
  playtest:full 500 runs clean (SAVE_CORRUPTION covered). Original sighting: loading
  the corrupted 10am save through the new `ensureWorld` yields honest narration (repair effective
  in-memory, invariant quiet) but the autosave written AFTER a turn still carries the stale
  `scene.interior` blob — every load re-repairs, the save never converges, and any path reading the raw
  save without `ensureWorld` sees garbage. done_when: after one turn on a legacy-desynced save, the
  STORED save's `scene.interior` is cleared/re-synced; U-test locks it.
- **The live repro (4 turns, pre-rolled Bryn Holt boot, v0.28.9):** ① "I get up and walk out to the hearth
  room." → trivial-gate auto-success, NO move (the INT-4a class: trivial leading clause + an unrecognized
  named-room movement remainder). ② "go to the hearth room" → resolver treats it as TRAVEL, narrates
  **"It falls short here in The Greenwood, and you're left where you started."** — but `map.currentNodeId`
  FLIPPED n0 (Aldermere) → n1 (The Greenwood) **while `scene.interior` stayed the Aldermere cottage**. The
  "left where you started" line is false. ③ interior named-moves keep "working" in the stale building
  (pantry → scullery at a node you're not at). ④ "look around" → **"You're inside The Greenwood."**
- **Blast radius (why this is probably a deep root):** `nodeRoster()` keys occupancy off the CURRENT node,
  so after the silent flip EVERY presence read (`occupantsOfRoom`, `outdoorOccupants`, `getRoomState`)
  returns **empty** — wake building went {Hearth:3, Scullery:1, outdoors:1} → all-[] live. That empty-world
  state is the same signature as the CG-1b disputed canon (`roomOccupants:[]` with 5 node-present NPCs,
  2026-07-03 handoff finding #2) and plausibly feeds AG-4's "no record" dodges + the gate's "am I outside?"
  confusion + VG-F2 wrong-place naming. **Check this FIRST when an interior "reads empty" or names the
  wrong place.**
- **Two seams:** (a) travel resolver — while `scene.interior` is set, "go to the <room name>" must resolve
  on the INTERIOR graph, never enter node-travel (the TAC two-tier ruling, live evidence); AND a failed
  travel roll must not commit the node (determine: commit-then-narrate-failure, or wrong-target match).
  Capture the mech line + which intent path fired (Haiku ears vs parseIntent) in the LLM-off repro.
  (b) invariant candidate — `scene.interior` ⇒ current node == the structure's node
  (`assertWorldInvariants`), so this class can never sleep again.
- **done_when:** LLM-off repro script shows the node stable across a failed journey + interior room-name
  moves resolve interior-side; new invariant throws on the desync; corpus locks; gate utterances re-checked.
- **rollback:** n/a (fix + invariant packet; spec before edit — this row is the spec's seed).

### JR-1 — journey = fast travel with a risk premium  ·  Phase 0/4 seam  ·  **✅ DONE 2026-07-04-pm (Opus playloop worktree, local commit; tests U420–U423; suite 9654/9654 · convergence 124/124 · determinism green · playtest:quick clean). v0.28.12.**
- **What landed:** (1) the PREMIUM — new `JOURNEY_ENCOUNTER_CHANCE = 0.45` / `JOURNEY_LEG_CHANCE` on the
  journey path only (base walking stays `ESCAPE_ENCOUNTER_CHANCE = 0.3`); a single-hop journey and a walked
  arrival draw the SAME seeded float, only the threshold differs → the premium is a strict MONOTONE SUPERSET
  of the walking risk (provable per-seed, U420). (2) the SURPRISE — transient `combat.surprised` flag
  (whitelisted in `ensureCombat`/`defaultCombat`/`combatState` merge/`beginCombat`/`endCombat`; **no
  `WORLD_VERSION` bump** — combat-scoped); a journey ambush ALWAYS opens surprised (helper
  `openJourneyAmbushSurprised` → `applySurpriseRound`, enemy's free first strike), a walked-into ambush does
  not (U421). (3) the ASYMMETRY — walking the same node accrues no premium and no surprise (tested
  deterministically, not statistically). (4) INTERRUPTION — an interrupted multi-hop journey drops the
  traveller at the real intermediate node and NAMES where honestly (U422). THE LAW held: journey prose
  carries the READ ("You made good time — … the road was watching you cover it"), never the number; the
  mech line carries the trace (U423).
- **Relocks (documented in AGENT_CHANGELOG):** U97 (`travelSurprise`) rewritten to the new always-surprise
  contract (old "surprise-is-the-exception / skill dodges it" model removed); U263 (`journeyToTown`) presses
  on through the now-dangerous road (journey still completes). No convergence-corpus row asserts
  journey/ambush/surprise → convergence unchanged, no corpus relock.
- **Tim's parameter (2026-07-04-pm):** an explicit far-place request ("I want to go to the Greenwood") the
  DM resolves in one action — but you fast-forwarded ground you weren't watching, so **the chance of a
  negative consequence is ELEVATED** vs. walking it, and **whatever triggers opens with the player
  SURPRISED** (on the enemy's terms). Walking manually (≤6 cells/turn, many turns) keeps full vigilance —
  that slowness is intended; it's what fast travel is priced against.
- **rollback:** revert the commit (journeys return to premium-free). Contract: `docs/POSITION_AS_CANON.md` §3.

### SEEK-PERSON — "go find someone who can tell me X" resolves in the fiction (the person-goal bridge)  ·  Phase 0  ·  **✅ LANDED v0.28.32 b081 (worker `5cd7ade9`; U485–U487 8/8; suite 10023/0; recovered after the session-switch halt — verified + integrated by the conductor).** LLM-off repro GREEN: the exact gate utterance ("I get up and go find someone…who founded this outpost") now → *"You step out into the open air. You approach Asha the guard…"* (bridges outside, delivers a real canon person, enters dialogue), NOT "that way is blocked from here", NOT a "no record" dodge, node stable (no NODE-DESYNC). Honest-miss guard for the empty settlement resolves in-place (no exit, C9-safe). **Brief items 2 & 3 NOT delivered** — the worker halted before its final report: (2) the locket sensory-probe→info-sink misroute (CG-2b evidence) was NOT touched by this diff → still open, see below; (3) the AG-4 a/b/c re-scope verdict was never written → AG-4 stays PARKED, re-audit still owed.
- **provenance:** GATE 2026-07-05's one high-sev fail (Lore-hound): from the wake interior, _"I get up and
  go find someone in the settlement who can tell me who founded this outpost."_ → **"That way is blocked
  from here."** Seam pinned at boot: the interior-movement blocked bank (`engine/playloop.js:2045`) sits
  directly ABOVE the INT-4-TRAVEL bridge that already exits-and-journeys for "go to <place>" voiced
  indoors — but a person-goal ("find someone…") names no place, so the bridge never fires and the intent
  falls into the blocked bank. Sibling evidence in-scope: the CG-2b locket record proved the base path
  routes a sensory probe ("is there a portrait inside?") into an NPC "no record" dodge — if that's the
  same info-sink seam, fix it here; if not, report it. Brief: `docs/briefs/SEEK-PERSON-egress.md`.
- **objective:** (1) seek-a-person intent voiced indoors bridges like INT-4-TRAVEL — step out, then resolve
  the seek on the outdoor world in fiction (deliver a findable person from canon occupancy, or an honest
  in-fiction miss — never a navigation refusal, never "no record"); (2) the locket-class sensory-probe
  misroute IF same seam; (3) report-only re-scope of what remains of AG-4 a/b/c post-INFO-HONESTY.
- **allowed_files:** `engine/playloop.js` (movement/info-seek seams only), tests U485–U487, corpus relocks
  (documented). **forbidden:** `dialogue.js`/`grace/`, `WORLD_VERSION`, rng, inventing canon facts (C9).
- **invariants:** determinism U19/21/22/27/30; convergence 100%; LLM-off repro FIRST (bug protocol).
- **done_when:** the exact gate utterance, LLM-off on a fresh tallow boot, exits the interior and resolves
  the seek in fiction; blocked bank still fires for true dead-ends (wall-holds cases keep their tests);
  `npm run check` green.  ·  **rollback:** revert the lane's commit.
- **FOLLOW-UP OPEN — SEEK-2 (locket sensory-probe misroute):** the CG-2b evidence turn ("The broken locket
  — I open it. Is there a portrait or anything inside?") routed a PHYSICAL read of a held object into the
  info-sink and produced the base "no record" dodge. SEEK-PERSON did NOT touch this (different seam:
  sensory-probe classification, not person-search). Small targeted packet owed: a sensory probe of a
  present/held object gets a truthful world-grounded sensory answer or honest-uncertainty read (DS-1a /
  honest-search `baf1b51` precedent), never the info-record decline. Playloop info-seek seam; cut when the
  serial slot next opens.

### SL-5 — "Aldermere wants something" (Phase 1's named next)  ·  **✅ LANDED v0.28.33 b082 (worker `148c3076` → integrated `fd58ca0a`; U488–U490 27/27; suite 10050/0). 3 of 4 beats LIVE, verified LLM-off on the integrated build:** cold-open voices the seed-chosen worry at wake · "what's troubling folk here?" names it (chapel-bell or Greenwood-road, seed-stable) · "I'll look into it" mints `learn:<worry>` with a one-line in-fiction ack, zero quest-log surface. **⚠️ The 4th beat (consequence-if-ignored / objective mutation) is DARK** — blocked by a pre-existing engine bug (`instrument.js` `normalizeThread` strips age/objective every `ensureWorld`; affects ALL threads incl. PACK-1's, not introduced here). U490 guards today's broken behavior as a named regression rather than asserting a false pass. Fix queued as CONSEQ-1 below. In-lane bonus fix: "I'll look into it" was mis-caught by `tryExamineTarget` ("look into"=peek) → two guards in playloop.js close it (the round-trip didn't work until this fix).

### BUILDER TOOLS — hand-authoring surfaces (Tim's active 2026-07-05 thread; procgen frustration → author by hand)
- **HOUSE-BUILDER — ✅ LIVE + iterating** (`public/house-builder.html`, standalone dev tool, no engine change, no game-version bump; served at `/house-builder.html`). Drag-drop floorplan editor: rooms (box / round / per-wall bowed), **freeform wall segments** (any shape), **wood vs stone** walls (engine `structureMaterial.js` families, poché-differentiated), **doors + windows** (engine glyph language, snap to straight/freeform/**curved** walls, **resizable** by dragging along the wall), **tunnels** linking rooms (**bendable** — exported as multi-point `handDrawnInterior` corridors), **bendable freeform walls**, furniture (bed/barrel/cookpot/dresser), **Secrets** (hidden caches a searcher finds: a **vessel** tag [Loose floorboard / Secret stone compartment / …], a find DC, and a **stash from the FULL 100-item game catalogue** — `scripts/dump-items.mjs` → `public/map/items.json`, searchable menu), **zoom+pan over a 120×90 world** (castle / mega-dungeon scale, Fit view). Export/Import `house-builder/v6` — engine-aligned shapes throughout (rooms shape+material+curve, walls+bend, openings x/y/angle/len, corridors pts/w, furniture ux/uy, secrets {x,y,vessel,dc,room,items[defRef,qty]}). **NEXT engine-side:** a LOADER that mounts an authored structure at a node + walkable/narratable in play (rooms/round/material/furniture line up today; freeform walls, per-wall curves, sized/angled openings, tunnels, secrets are ahead of the engine model — future loader work; secrets map onto the container-reveal-on-search mechanic `playloop.js` §"Look inside / search a container" + a hidden-until-found flag). `cookpot` needs an engine furniture-catalog entry (bed/barrel/dresser exist). Memory: [[project_house_builder_authoring]].
- **MINI-LIBRARY — ✅ STARTED 2026-07-05.** `public/map/miniLibrary.js` = the LAZY miniatures manifest
  (id/name/category/url/fitLong/footprint/tags; a mini's GLB is fetched only when placed, unlike
  treeAssets' eager foliage REG). First entries: two decimated Meshy corpses (`corpse_assemblage`,
  `corpse_remains_red` in `public/map/assets/`, 47/40MB → 2.2/2.0MB via `scripts/mini-decimate.sh`).
  **"Populate buildings with minis" pipeline (the recommended arch):** (1) manifest = the shared library
  [DONE]; (2) house-builder gets a **Miniatures palette** grouped by category → drop a mini at a grid
  square → export `{mini:id,x,y}` [NEXT — the concrete build]; (3) tabletop renderer resolves a placed
  mini id → its GLB from the manifest, lazy-loads, stands it on the square (reuse treeAssets/figureAssets
  GLB placement; corpse uses fitLong/flat) [future consumer]; (4) every intake decimated first [scripted].
  BESTIARY-1 monsters become manifest entries too (category 'monster').
- **BESTIARY-1 — QUEUED (next builder-adjacent feature; NOT started 2026-07-05).** Tim: "we will also need access to a bestiary… beginner players… maybe twenty or so monsters." Scope decision owed at pickup: (a) a standalone bestiary reference/browser, vs (b) an in-builder monster PALETTE to drop creatures into a dungeon (like furniture). Lean (b) for the dungeon-authoring flow — a monster is a placed token at a grid square (same shape as furniture/NPCs, engine-alignable to occupancy). Source the ~20 from the existing bestiary catalogs (`engine`/`server/rag/corpus` beast entries) — beginner-tier subset; do NOT author new creatures. Honor [[feedback_bestiary_world_filter]] (no modern-Earth creatures) + [[feedback_bestiary_inspiration]].
- **NPC-BUILDER — ✅ LIVE 2026-07-05 (Tim un-shelved same day).** `public/npc-builder.html` — a standalone
  character creator on the game's ACTUAL intake (engine/chargen): **race** (9 SRD species), **class** (12),
  **style** (fantasy archetypes: Sellsword/Gravedigger/Hedge-Witch/…), **stats** (5-key MIGHT/AGILITY/WITS/
  GRIT/CHARM, Roll 2d6+2), **kit** (fantasyGear list), **level** 1–20, + a **backstory/RAG** textarea.
  Live character-card preview (game-card styled, derived HP/AC). Export = a bundle: `npc` (chargen shape) +
  `rag` (corpus persona `{id,name,role,cluster,chunks:[{id,source,text,keywords}]}` — paragraphs → chunks,
  keywords auto-extracted). **NEXT engine-side (the loader, mirrors the house-builder's):** drop `rag` into
  `server/rag/corpus/*.json` + register the `npc` on the authored-figure path (`engine/world/demoFigures.js`
  DEMO_FIGURES — the Carl/FACT-1 flow) so the built NPC boots into a place and talks from its RAG. Verified
  live (Gorin Ashfell: Dwarf Cleric Hedge-Priest L3, kit + 2 RAG chunks). Memory: [[project_house_builder_authoring]].

### CONSEQ-1 — threads actually age (normalizeThread stops eating age/objective/trajectory)  ·  Phase 0/1 seam  ·  **✅ LANDED v0.30.8 b106 (worker `016712cc` → integrated `4f460df4`; U568–U569 new + U490 FLIPPED from "documents broken" to asserting real aging/mutation; the 3-line preservation; age climbs 1/tick, objective mutates at age 6, replay byte-identical; U454-E canary folded into the combined MP-3+CONSEQ-1 anchor 56d52255… at integration — both workers had solo-computed pins, Basecamp recomputed on the combined tree; SL-5's dark 4th beat is now LIVE; OCC-STORY-2 UNBLOCKED)** *(was QUEUED 2026-07-05 by the SL-5 lane → DISPATCHED 2026-07-06)*

### JR-HUNT-1 — the hunt can't catch you mid-fast-travel (journey returns before worldTick)  ·  Phase 0/4 seam  ·  **✅ LANDED v0.30.10 b108 (worker `1ce7b196` → integrated `311f6847`; U573–U574 11/11; DIAGNOSIS: journey branches return at ~2669/~2735, the turn's ONE worldTick sits at 3980 — fast-travel turns never ticked AT ALL (bigger than the hunt: threads/heat/factions all skipped); fix = one tick inside each journey branch, U574 proves exactly-once (thread age 1/turn, U568 law held); hunt composes with JR-1 road encounters, own sub-RNG; live receipt: heat-52 save fast-traveled → brigand toll + two hunters at arrival SAME turn; deep_wild_fog_edge golden regenerated legitimately (+0.42% — the scene fast-travels, its world now ticks; verified hunt-free) and re-verified on the integrated tree with tickPact)** *(was MP-3 worker's flagged finding)*
- playloop's journey resolver returns before the per-turn `worldTick`, so a hunt due on a fast-travel turn fires on the NEXT normal action instead (heat preserved; one-turn deferral, no loss). Small serial-playloop packet: let journey arrival run the tick (or the hunt check) so hunters can meet you at the roadside — thematically the best place for them. Cut when the playloop slot is free.
- **provenance:** SL-5's worker report + AGENT_CHANGELOG 2026-07-05 (Worker/SL-5 section). ROOT: `engine/instrument.js` `normalizeThread()` (via `ensureInstrumentLayer` ← `ensureWorld()`, runs EVERY invocation incl. `worldTick`'s opening call) returns only `{id,label,introducedAt,tension,status}` — silently dropping `age`/`objective`/`trajectory`. `tickLivingThreads` sets those correctly WITHIN one `worldTick`, but the next `ensureWorld` strips them → live per-turn `age` never exceeds 1 → `mutateObjective`'s `age>4 && age%3===0` branch can NEVER fire. Affects EVERY thread engine-wide (PACK-1 Bridge Dispute/Drowned Twin too), so the "worries worsen over time" consequence — SL-5's 4th beat AND the SL-5-DRAFT "already firing" claim — is dark in the real multi-turn loop. Verified pre-existing by stash-reverting all SL-5 code and reproducing on a bare `introduceThread`.
- **objective:** `normalizeThread` preserves the three fields, mirroring how `tension`/`status` already survive: `age: clampInt(t.age ?? 0, 0, 999), objective: String(t.objective ?? ''), trajectory: String(t.trajectory ?? 'static')`. One line each.
- **allowed_files:** `engine/instrument.js` (the return object only), `tests/U490.consequenceAndColdOpen.test.js` (FLIP the age/objective guard from "documents broken" to "asserts aged+mutated" once live), a small new determinism/aging unit if useful.
- **forbidden:** `WORLD_VERSION` bump (fields already written, just not preserved — no schema change); touching `tickLivingThreads`/`mutateObjective` logic (they're correct; only the normalize strip is wrong); rng.
- **invariants:** determinism U19/21/22/27/30 (an aged thread must replay identically); convergence 100%; old saves — a thread loaded without age/objective defaults cleanly (the `?? 0`/`?? ''` guards). ⚠️ this changes world shape across ticks → the determinism canary (U454-E class) will refresh; justify the sole delta.
- **done_when:** a thread introduced then left unattended ≥5 live turns shows `age≥5` and a mutated `objective`; U490 flips to assert it; `npm run check` green. **rollback:** revert the one commit (threads return to age-capped-at-1).
- **note:** engine edit → dispatch to a worktree (exempt from the engine-brief gate) or brief Tim; do NOT hand-hack the main checkout.
- **The Armory finding (why this packet shrank):** the want loop is ALREADY LIVE end-to-end — ask-a-concern
  (`resolveConcern`, U220) → "I'll help" mints a silent goal (G06, no quest banner) → goalContract tracks
  (cap 12, predicate completion, never a list) → worldTick ages threads/factions into consequence. The
  authored arcs (Bridge Dispute / Drowned Twin) already boot into the slice. THE GAP: the concern source is
  a generic random want pool, not the slice's two authored dangers — and `placeQuery.js` carries a
  "curate this later" comment at the exact seam. **Recommended: Candidate A (curated concern source:
  Greenwood-road + chapel worries) + C (one cold-open worry line at wake) in ONE small packet; size S,
  ~3 files, no schema.** Candidate B (pinned thread) folded in only as A's consequence router.
- **TASTE CALLS SETTLED (Tim, 2026-07-05 — all three defaults confirmed):** 2 worries FIXED BY SEED
  (Greenwood-road + chapel, stable all session) · bandit camp FOLDED into the road worry (two dangers,
  not three) · cold-open ships SAME PACKET. The draft's §6 proposed row is now the spec verbatim.
- **BUILD UNBLOCKED (2026-07-05): SEEK-PERSON landed (v0.28.32), the playloop serial slot is now FREE.**
  SL-5 (+ the SEEK-2 locket follow-up) is the next playloop dispatch — spec is the draft's §6 row verbatim
  with the settled taste calls baked in.

### OCC-STORY-1 — every settlement NPC is where their story puts them  ·  Phase 1  ·  **✅ LANDED v0.29.5 b092 (worker `3e8862c2` → integrated `5383caa9`; U491–U493 green, U491 failing-first; suite 10241/0 combined; 19 tests honestly relocked off the strangers-in-cottage scaffold via shared helper; one documented worldHash re-pin — story anchors moved the SEEDED TAC-1 npc pos values, replay still deterministic)**
- Wake cottage empty · anchors seed-stable per role/epithet/faction · time-of-day movement · hostiles
  keep to edges with purpose · every occupant carries a narratable `reason`. MR-2d UNBLOCKED.

### LOADER-MERGE — two authored-plan loaders became ONE  ·  Phase 2 · **✅ LANDED v0.29.8 b095 (worker `ee58383a` → integrated; suite 10325/0; survivor = authoredStructure.js + absorbed registry; authoredPlans.js DELETED (−461); U518–U522 renamed → U526–U530; U531/U532 new; LOAD-2 walkthrough byte-identical through the unified path; worker corrected the premise: both loaders already shared deriveDoors/mask downstream — the real merge was the registry)**
- Convergent evolution, same day: Basecamp's MR-2c landed `engine/structures/authoredPlans.js`
  (v0.29.2 b089: registry + topology + MR-2a door records + mask + procgen override; U510–U512) and
  the sibling lane's LOAD-1 landed `engine/structures/authoredStructure.js` (v0.29.4 b091: v5+/v7
  export support, wired via `applyGeneratedStructuresForNode.js`; live-verified). Two modules consume
  the same house-builder export at different wiring points — reconcile to ONE loader (best of both:
  MR-2c's door-canon/mask depth + LOAD-1's v7 format tolerance + its wiring point) BEFORE LOAD-2
  builds multi-room on the duplicate. LOAD-2's stated scope (multi-room, doors→adjacency) is largely
  ALREADY BUILT in authoredPlans.js — check first.
- **Collision status update (2026-07-05-night):** LOAD-2 landed anyway (685 more lines in
  authoredStructure.js) and took U518–U522 — U520–U522 double-allocated against MR-2d (Basecamp's
  window tests renamed to U523–U525 to clear it; LOAD's files keep theirs pending this merge).
  The merge burden GREW: reconcile before LOAD-3/AUTH-HOUSE-1. See CONDUCTOR-SPLIT row.
- **provenance:** Tim's live playtest (v0.28.32, wake scene): a mini beside his player token that the DM
  said wasn't there. Diagnosis (live-save probe, this window): the mini = Galen, OUTDOORS, painted inside
  the roofless floorplan ink; and the occupancy scatter had stuffed FIVE strangers into the player's own
  wake cottage — including **Scarvein, the seeded hostile bandit** (`ensureHostileNpc`), in the front
  room at dawn, by accident. Root cause: `assignedPlace()` distributes over MATERIALIZED buildings only
  (`world.structures.byId`) and at wake exactly one exists — yours.
- **Tim's design ruling (2026-07-05):** placement must be *explained by personal story* — their own
  buildings, or visibly up to something; "just having them materialize at random won't work." Test for
  every placement: "why is he here?" already has an answer. Derived, seed-stable, no schema; reasons ride
  the occupancy records so the DM can voice them.
- **done_when:** wake cottage strangers-free; every occupant carries a narratable `reason`; hostiles get
  purpose-spots, never idle in unrelated interiors; consumers unmodified (API additive); U491–U493 +
  determinism ladder + `npm run check` green; playtest:quick clean.
- **follow-ups queued:** OCC-STORY-2 (below) · TT-OCC (below).

### OCC-STORY-2 — "up to something" becomes thread-driven  ·  Phase 1/4 seam  ·  **✅ LANDED v0.30.12 b110 (worker `14a85c18` → integrated `2d0f1a63`; U580–U582 17/17; storyAnchors extended not forked: hot/aged threads pull their tied NPCs to the thread's locus, reasons carry the LIVE mutated objective; live receipt: the Lingerer at the chapel path — "watching the chapel path — choose what to sacrifice to survive"; boot placement UNCHANGED — anchor + goldens held, exactly as briefed; FLAGGED GAP → NPC-DEED-1 below: the deed recorder is player-only, so a witnessed NPC burglary can't feed the rumor mill yet)**

### NPC-DEED-1 — NPC crimes get a recording path (the rumor mill hears the world, not just the player)  ·  MP-arc seam  ·  **✅ AUDIT COMPLETE 2026-07-06 (worker, sonnet, worktree-local, no code shipped) — verdict: NO one-call wiring exists; conditional-code clause did NOT trigger. Full report `docs/briefs/NPC-DEED-1-audit.md`. LIKELY MP-6 PREREQUISITE confirmed: Arc A cannot run at all today (Carl has zero deed-recording hook). **BUILD ✅ LANDED v0.30.14 b112 (worker `5dd0e8b3` → integrated `a9d92ebe`; U590–U592 15/15; all five audit pieces: honest actor attribution — unknown ids NO-OP, never blamed on the player · lazy NPC morality-lite (boot anchor UNCHANGED, no re-pin!) · world-scope `mutateNpcAnywhere` · `tickCarlDeeds` cadence · third-person `notorietyReachingAbout` + dialogue branch, `notorietyReaching` now player-only. Live receipt (Senna, unprompted): "you've not heard? Carl drove a frightened neighbour from the square… Keep your distance." ⚠️ CARL DIALS flagged for Tim — ONE spot, `engine/worldTick.js`: CARL_DEED_GRACE=4 · CARL_DEED_INTERVAL=6 (raise to slow him) · CARL_ESCALATE_AFTER=3 · severities 12/20; timeline-clock pacing runs HOT on long grinds — eyeball live and dial. MP-6 CAN NOW ASSERT §7a–c + Carl's heat crossing HUNT_HEAT; MP-6 STILL NEEDS: (1) the hunt organ iterating NPC actors — tickHunt is player-only today; (2) optional faction-toward-NPC scalar if the falsifier wants "Aldermere's disposition craters" as its own number.)**
- **Grepped every angle** (`mintClaim`/`propagateClaims`, `rumorsReaching`, `deedFactionDeltas`,
  Carl's `demoFigures` entry): `recordDeed`/`applyDeedCharges` stamp guilt/heat on PARTY members
  only, and the party-only assumption is load-bearing in THREE separate places, not one convention —
  (1) `effectsCore.js`'s `resolvePlayerEntityId`/`findPlayerEntity` search `world.party` and
  **silently fall back to `party[0]` (misattributing to the player)** when an id isn't found, not a
  graceful no-op; (2) NPCs carry **no `morality` field at all** in the schema (`ensureMorality` only
  runs for party entities); (3) `mutateNpc` is scoped to the player's **current node only** — it
  cannot reach an NPC (e.g. Carl) standing anywhere else, which Arc A's "over N world-ticks" requires.
  One genuine near-miss: `rumorsReaching`'s deed-read loop is actually unfiltered on `actorId` at the
  data level — but its only consumer (`notorietyReaching` → `dialogue.js:468-480`) is hard-coded
  second-person prose ("I know **who you are**"), so piping an NPC deed through unchanged would
  accuse the player of someone else's crime.
- **Smallest honest packet spec'd** (5 pieces, additive-only, no `WORLD_VERSION` bump): (a) NPC
  morality-lite default field; (b) a node-agnostic NPC mutator beside `mutateEntity`/`mutateNpc` (NOT
  a parallel read-sink — REPUTATION_UNIFICATION forbids that, not a second internal mutator); (c)
  `recordDeed` accepts a real non-party actor without the silent party[0] fallback; (d) an emitter for
  a witnessed NPC deed (OCC-STORY-2's burglar + a scripted Carl misdeed tick — this is the one piece
  that's new authored content, not wiring); (e) a third-person branch for `notorietyReaching`'s
  consumer, **flagged as possibly cuttable** if MP-6's assertions only need faction-disposition/heat,
  not a spoken NPC-gossip line — confirm against MP-6's exact assertions before building it.
- Ready to dispatch verbatim off the audit doc's §3. U-numbers: allocate fresh at dispatch (audit
  reserved none; U590-U591 were the packet's provisional guess, not claimed).
- Stage 2 of the ruling (unchanged, still queued): placement overrides read live world threads/goals
  (worldTick) — the Lingerer haunts the chapel path *because the chapel thread is hot*; a hostile
  indoors is a burglary IN PROGRESS with consequences, not an accident. Still derived + deterministic.
  Scope on cut.

### MAP-REAL — the drawn world IS the simulated world (Tim's commission)  ·  Phase 1/2 arc  ·  **✅ COMMISSION COMPLETE v0.30.0 b098 (2026-07-06; cut 2026-07-05-pm) — all six promises live or machine-guarded; 17 builds b083→b098; contract `docs/MAP_REAL.md` (completion stamp inside); arc-level live receipt = Tim's next play session (standing)**
- Symptoms retired by the arc: go-outside 1 km teleport · ghost-Galen · strangers-in-cottage ·
  DM-invented geography. Stages: MR-ORACLE (dispatched) → MR-1 position truth (queued behind SL-5's
  serial slot; brief to Tim at cut) → MR-2 functional ink (walls/doors/windows real; house-builder
  loader) → MR-3 fog-procgen wild + story behaviors on the sheet. Tim's standing asset ledger:
  `docs/MINIS_WISHLIST.md` (all lanes append).

### MR-ORACLE — position-truth probe in the harness  ·  Phase 0/1  ·  **✅ LANDED v0.28.34 b083 (worker `2174e2bd` → integrated `de5a923e`; U496 14/14 · U497 4/4+1 todo; suite 10068/0; probe RED-by-design, byte-identical reruns)**
- **THE LAYER DIAGNOSIS (MR-1's targeting data): BOTH layers lie.** (1) Engine canonical `pos`
  teleports **49 cells (247 ft)** from the exited structure on "go outside" — `backfillTacticalPositions`
  → `placeNearNode` ±50-cell seeded jitter in `engine/map/spatial/tacticalPos.js` — instead of the
  doorstep. (2) The renderer view-model token (`placeFromWorldNode().tokens`) is pinned to the lane
  entry and **never consumes `pos` at all** — so MR-1 must fix BOTH the engine write (doorstep egress)
  and the view-model read, or the marker stays wrong even after the engine is right. Tim's "~1 km" was
  the same bug measured at the marker's map projection.
- Probe = `npm run playtest:position` (optional mode; wires into `npm run check` when MR-1 lands; U497
  carries the expected-fail doorstep invariant as a `todo` MR-1 flips on). Also surfaced, data-only (not
  asserted): `walk east` on the deterministic floor drops `currentNodeId` to null (between-nodes state)
  — TAC-2/NODE-DESYNC territory, feed to MR-1's brief as context.
- **→ MR-1 is now UNBLOCKED** (SL-5 landed v0.28.33, the engine serial slot is free). Cut MR-1 on the
  `POSITION_AS_CANON.md` §7 template with this diagnosis as its evidence block; brief to Tim for OK.

### MR-2 — FUNCTIONAL INK (stage 2 design, sliced a–d)  ·  Phase 1/2  ·  **DESIGNED 2026-07-05-eve (`docs/briefs/MR-2-FUNCTIONAL-INK.md`) — queue behind MR-1a/1b; engine slices to Tim for OK at dispatch**
- 2a walls-block + door-state canon (WORLD_VERSION bump, full protocol) → 2b DM grounds architecture
  (plan-facts bundle + CG architecture class) → 2c house-builder loader (export shape verified: wall
  segments + openings {x,y,orient,len}) → 2d windows as sight apertures. **MR-1b ✅ LANDED v0.28.37 b086** (worker `0e2a6775` → integrated; U501 8/8 + U502 3/3; suite
  10105/0). **Honest premise correction from the worker:** the LIVE screen (oneMap.js
  `playerFocusWu`) already consumed engine `pos` — the stale reader was `placeFromNode.js`'s token
  list (feeds the probe + a never-displayed legacy surface); fixed regardless. Live receipt: marker in
  the wake room, then ON THE DOORSTEP after typing "go outside" through the real input box.
  **MAP-REAL STAGE 1 (position truth) COMPLETE** — engine writes the doorstep, every reader consumes
  `pos`, the probe stands guard in `npm run check`.

### VIS-ORACLE — the Screen-Truth Oracle (MR-ORACLE for pixels)  ·  Phase 1/2  ·  **✅ LANDED v0.30.4 b102 (worker `a1f6a8fd`; U551–U554 29/29+1 todo; suite 10460/0; canvas-free — asserts the renderer's own pure rails; 6 goldens committed; deliberate-accept ritual). FIRST CATCH ON DAY ONE → PLAN-SPLIT-1 (below). Wire into `npm run check` when PLAN-SPLIT-1 flips the last RED.**

### PLAN-SPLIT-1 — one building, two geometries (the oracle's first catch)  ·  Phase 1/2 (MAP-REAL falsifier #3)  ·  **✅ LANDED v0.30.7 b105 (worker `9f4a5575` → integrated `d588f44a`; U561–U562 11/11; suite 10497/0; oracle 0 findings, 7/7 goldens; `playtest:screen` now a STANDING `npm run check` rung — the screen has a permanent alarm). Real structures draw from the engine's own floorPlan (catalog only for topology-less); worker also fixed a latent anchor bug in the oracle's truth builder + kept exterior furniture green via format conversion. Three goldens legitimately re-captured (wake cottage at TRUE size → deterministic village reflow, DEC-1 precedent); wake golden captured. Worker's version bump dropped at integration (standing rule).**
- The oracle's expected-RED SURVIVED b100's projection fix — it is a DISTINCT bug: the wake building's
  walls are DRAWN from the catalog `getPlan()` ("Wattle Cottage") while the figure is SEATED from the
  engine's real `floorPlan(structure)` — two different-scale plans for one building; the token sits
  measurably off its own walls (place-unit(1.179,−0.305) vs rect [1.739,−0.445..3.619,1.035]).
- Fix direction per MAP-REAL's one-law: the ENGINE plan is the single geometry; the drawn ink must
  derive from it (kill the catalog-plan read at the draw site or map it through the engine plan).
  Done-when: the oracle's wake scene goes GREEN → flip U553's todo → capture the wake golden
  (`screen-goldens:accept`) → wire `playtest:screen` into `npm run check` (all scenes green).
- The morning's lesson made law: engine truth had a standing gate and never broke; the screen had none
  and broke twice in one night. Headless canonical scenes → drawn model asserted against engine truth
  (PROJECTION_EQUALITY · PHANTOM · MISSING · LAYER_ORIGIN · INK_EXCLUSION) + golden-image beauty lock
  w/ deliberate-accept ritual. RED today on the wake scene by design (independent repro of
  REND-TRUTH-1); wires into `npm run check` when green — the position-probe arc, step for step.

### REND-SCALE-1 — the foot-tall Hobbit: minis are SIZED by the sheet, not a fixed authored scale  ·  Phase 1/2 (MAP-REAL falsifier #4, Tim's live report 2026-07-06)  ·  **✅ LANDED v0.30.6 b104 (desk packet `381fdde2`; U566–U567 7/7; suite 10486/0; ladder green)**
- Tim: "my Hobbit figurine looks about a foot tall relative to the squares which are 5'" — REAL. REND-TRUTH-1 made mini POSITIONS ride the sheet transform; SIZE stayed authored-fixed, so figures shrank against the squares as the zoom deepened.
- The law: drawn size = true feet × `sheetScenePerWu` (the SAME factor the ink's 5-ft squares use), floored at the authored token look zoomed-out. Species truth from the sheet (`party[0].dnd.species` size — Small 3.5 ft, dwarf 4.5, medium 6); props per kind (bed LENGTH-true 7 ft). `window.__rendScaleAudit` = live numeric receipt; A/B receipt Halfling-vs-Human on the real screen (exactly 3.5 vs 6.0 drawn wu, 1.7× on screen).
- **Follow-up → WILD-SCALE-1 ✅ LANDED v0.30.12 b110** (worker `03f8d7c5` → integrated `72c65c2a`; U575–U576 22/22 w/ REND-SCALE regression; trees THREADED LIVE from the ink's own treeRadiusWu — retune the paper map and the 3-D trees follow; boulder/brush/deadfall/stump on real-world sizes, rotation-safe measurement for deadfall; NO taste cap needed — no zoom read absurd on the real screen; worker caught its own first-load ordering crash via the live screenshot check before shipping; flagged: the OLDER village tree-scatter path predates the sheet contract — separate lane if it ever matters). Combat-board minis stay on their own cell contract by design.

### REND-TRUTH-1 — four NPCs drawn in the bedroom; their true positions are 60–300 ft away  ·  Phase 1/2 (MAP-REAL falsifier #2)  ·  **✅ LANDED v0.30.2 b100 (worker `5d56fb10`; U548–U550 18/18; suite 10420/0; BISECT EXONERATED MR-3b — pre-existing 128× sheet-vs-mini scale mismatch since MAP-3DR; minis now project through the sheet's own transform, error=0; headless receipt: only the player stands in the Bedchamber). Tim's live receipt = his next look. VIS-ORACLE's wake-scene expected-fail FLIPS at its integration.**
- **provenance:** Tim's v0.30.0 wake, interior zoom: four NPC figures render in/around the bedchamber.
  Engine truth (live-save probe): Carl wu(-29.6,0.9), Galen (-12.6,-10.7), Lingerer (4.7,-14.0),
  masked hostile (21.7,-8.4) — all outdoors, 12–60 wu from the cottage (~(-44,-45)). The DRAWING
  places them indoors ⇒ people-layer projection/anchor bug. Suspect: MR-3b's render3d rework
  (+209/−6) dragged the people-group anchor; b096 drew Galen correctly (TT-OCC pixel receipt).
- **shape:** headless-screenshot BISECT b096 vs b098 wake-interior view FIRST (prove the regression
  window) → find the anchor/transform divergence → fix → receipt = headless wake screenshot with zero
  figures inside the plan + people at their true offsets; U548 reproduce · U549 projection-equality
  property (people scene-pos == worldPosFromWu(their wu), all four) · U550 regression guard.

### FURN-1 — furniture is physical: you don't stand inside the bed  ·  Phase 1/2 (MAP-REAL falsifier)  ·  **✅ LANDED v0.30.1 b099 (worker `63371405`; U545–U547 23/23; suite 10402/0; anchor-cell blocking — full-footprint verified WORSE at v1 resolution; doors never furniture-blocked; FURNITURE_BLOCK probe class armed; default-seed worldHash unchanged)**
- **provenance:** Tim's first v0.30.0 wake — the honest marker (MR-1b) draws the player INSIDE the bed
  mini: fiction seeds you ON the pallet, and furniture never joined any blocking mask (MR-2a masked
  walls+doors only). Not a truth regression — a truth revelation: drawn furniture isn't functionally
  real yet, which violates promise 1's spirit and promise 5's look.
- **shape:** furniture footprints join the struct walkable mask (placed furniture blocks its cells) ·
  seeded spawn/backfill lands on the nearest FREE cell (wake = beside the pallet, matching "you swing
  your legs off") · doors/thresholds can never be furniture-blocked (no-soft-lock property extends —
  U506 pattern) · position probe asserts pos never ON a furniture cell · fresh-boot worldHash re-pin
  documented (OCC-STORY precedent). Live receipt: a fresh wake screenshot, figure standing beside the
  pallet.

### MR-3 — THE FOG-PROCGEN WILD (stage 3, designed + slicing)  ·  Phase 1/2  ·  **3a ✅ LANDED v0.29.9 b096 (worker `62b0adaf` → integrated; U533–U536 24/24 + U496 class-string; suite 10347/0; ~9% forest blocking density; FEATURE_BLOCK tripwire armed; deadfall=non-blocking flagged reversible) — 3c ✅ LANDED v0.29.10 b097 (worker `8692c3f8`; U542–U544 9/9; wildFacts + survey + TERRAIN prompt line; journey interruptions land in real places) · 3b ✅ LANDED v0.30.0 b098 (worker `637e8f1e`; U539–U541 26/26; WILD_BUBBLE_CELLS=12 — two walks' worth of woods; parchment fog edge; integration fix: U539 BEFORE-docs pinned to base fc9019df). **MR-3 COMPLETE.**
- The law: wild features = pure f(worldSeed, cell); fog hides a world that was always there; unpainted
  parchment, never darkness; roads stay clear; blocking trees stop walks honestly; settlements own
  their ink. Falsifiers + non-goals in the brief.

### TT-MINIS — defeated entities become corpse minis  ·  Phase 1 (map texture)  ·  **✅ LANDED v0.29.7 b094 (worker `d1ae6119` → integrated; U537 4/4 + U538 15/15; suite 10311/0; geometry-verified: real 45k-vertex GLB flush at y=0, deterministic per entity, silent fallback; wishlist rows → wired)**

### MR-2d — windows are apertures (sight through glass, never walls)  ·  Phase 1/2 (MAP-REAL stage 2)  ·  **✅ LANDED v0.29.6 b093 (worker `5266665a` → integrated; tests renamed U523–U525 post-collision, 17/17; suite 10292/0 combined; grace edit accepted — buildLocationSurvey IS the look composition point, decision logic stayed in roomOccupancy)**
- Windows face directions; sightlines are 90° sectors; shuttered blocks; windowless rooms see nothing;
  hostiles never appear at the glass; outside-in = one texture line max ("a shape moves within");
  window-seen ≠ present (dialogue gating unchanged); story reasons ride the view ("Elske Nightherd,
  up to something"). **MAP-REAL STAGE 2 COMPLETE — walls block · doors canon · DM grounded · authored
  plans load · windows see.**

### CONDUCTOR-SPLIT — superseded same night: SINGLE-CONDUCTOR mode  ·  meta  ·  **SUPERSEDED 2026-07-05-night (Tim): the split was adopted, then Tim consolidated — sibling window CLOSED CLEAN (npc-builder landed `81307bd1`, tree clean, all its work in v0.29.6) and Basecamp now conducts EVERYTHING. Authoring queue absorbed: LOADER-MERGE dispatched (below) · LOAD-3/AUTH-HOUSE-1 behind it · minis wiring. One conductor sees all unpushed state = the collision class ends structurally.**
- Original evidence (why coordination was needed at all): the Carl race (am) · duplicate loaders
  (authoredPlans MR-2c vs authoredStructure LOAD-1/2, ~900 combined lines, one job) · test numbers
  U513/514 + U518–U522 double-allocated. Root cause: two conductors commit/allocate blind against each
  other's unpushed state. Single-conductor mode dissolves it; test allocation = one continuous range
  from U523 (U526+ next free).
- flakeloop_v5.sh spinners (~6 cores): NOT orphans — the LIVE load harness of Tim's external
  U381-FLAKE session (17 min elapsed, live parent chain, session scratchpad — the sibling misread
  `17:20` elapsed as a 3:15pm start). HANDS OFF; it closes with its session.

### MR-2b — the DM grounds architecture claims (no invented geography)  ·  Phase 1/2 (MAP-REAL stage 2)  ·  **✅ LANDED v0.29.1 b088 (worker `8afa145e` → integrated; U507–U509 22/22; suite 10155/0; CG-ARCH structural-tier detector + roomPlan ground truth + hide-the-math DOORS prompt line; corpus lock on the wake cottage; flagged U483 equal-base fixture retune — legitimate, documented inline)**
- Plan-facts bundle (rooms + doors + states + exits) into the DM prompt seam; CG family gains CG-ARCH
  (narrated-geometry-not-in-plan, structural tier — rides the CG-2b swap ladder); corpus lock on the
  wake cottage's real layout. Kills the DM-invents-geography root class.

### MR-2c — house-builder loader: authored plans become the world's truth  ·  Phase 1/2 (MAP-REAL stage 2)  ·  **✅ LANDED v0.29.2 b089 (worker `55ff864d` → integrated; U510–U512 24/24; suite 10179/0; loader = browser-safe data-module pattern; sample `wake_cottage.house.js` proves the pipeline on a placeholder id)**
- Tim's 4-step drop-in path documented in the worker report + module header (draw → export → wrap as
  `.house.js` under `packs/base/structures/authored/` → one registry import line). **Honest flag →
  queued below:** wiring the sample onto the REAL wake cottage tripped a pre-existing safety check for
  that specific building — the first real authored placement is a Tim taste call anyway.

### AUTH-HOUSE-1 — first REAL authored house placement (Tim draws it, we wire it)  ·  Phase 2  ·  **QUEUED (waiting on a Tim drawing + location pick)**
- The pipeline is live; the sample sits on a placeholder id. When Tim exports a house he wants in the
  world: pick the structure id, resolve the wake-cottage safety-check interaction (worker's flag,
  MR-2c report), wire, live-verify on his screen.
- Loader for the tool's export (wall segments + openings {x,y,orient,len} + tunnels) → structure
  topology + plan + mask + DOOR RECORDS (2a schema), keyed by structure id; authored OVERRIDES procgen;
  fixture round-trip test; worldHash replay-stable; STRUCTURE_SCHEMA_VERSION target no-bump.

### MR-2a — walls block + doors become canon (the WORLD_VERSION packet)  ·  Phase 1/2 (MAP-REAL stage 2)  ·  **✅ LANDED v0.29.0 b087 (worker `c81b6d22` → integrated `d412a598`; WORLD_VERSION 30→31; U503–U506 28/28; suite 10133/0; playtest:quick+full 550 runs clean; old-save-warn demonstrated; GEOMETRY_BREACH armed)**
- Doors = canon state {open|shut|barred|locked} + exterior front-door RECORD (MR-1a's derivation now
  the legacy fallback) · walkable mask · `door` op via applyDeltas · interior moves + egress enforce
  states honestly (DM Test — no soft-locks, U506 property-tested) · forced entry mints a ledger fact.

### TT-MINIS — miniatures library wiring (corpse GLBs → the board)  ·  **SIBLING WINDOW'S LANE (2026-07-05 `7110362e` miniLibrary.js + decimate script) — no Basecamp dispatch; stay off `public/map/miniLibrary.js`/figures/render until it lands or hands off**

### DOOR-FORCE-1 — bare "force the door" flips canon door state  ·  Phase 2 follow-up  ·  **✅ LANDED v0.29.3 b090 (worker `1b603306` → integrated; U513 4/4 + U514 15/15, both failing pre-fix; suite 10198/0; playloop-only +158 lines; 8-phrasing family routed, 6 furniture-force regressions byte-identical)**
- Honest deferrals carried: live-browser force-turn verify = Tim's next play session (worker verified
  through the exact `playerMove` browser entry, LLM-off); "lean into the door" marginal phrasing
  documented out of family (corpus candidate if it ever bites).

### U381-FLAKE — the load-flake earns a packet (3 strikes 2026-07-05)  ·  maintenance  ·  **IN PROGRESS in a separate Tim-launched session (2026-07-05-night, background task off Basecamp's flag) — no lane should touch server.js test fixtures meanwhile**
- `U381` (server.js `/api/move` confidence-gate) fails ~1-in-3 FULL-suite runs under the parallel
  runner, passes in isolation + on every rerun; reproduced on CLEAN baselines by two independent
  workers today (TT-OCC report; MR-1b report) + twice in Basecamp integration checks. Likely port/
  listen contention under load. Fix = isolate its server fixture (ephemeral port / serialized group).
  Cut when a serial slot idles — this now costs a rerun on every third integration.
- A bare/unnamed "force the door" still routes to the pre-existing generic physics-force resolver
  (predates door canon): it rolls + narrates but does NOT flip the new door state. Named-room moves and
  egress DO enforce canon. Unify every force-phrasing through the `door` op — touches the combat-resolve
  seam, so it's its own packet; cut on the INT-3 template when the serial slot is free.
- Walkable mask from plans · exterior front-door record (MR-1a's flag) + door states {open|shut|barred|
  locked} as stored canon (ONE WORLD_VERSION bump, full 6-step protocol) · `door` op via applyDeltas ·
  interior room-moves respect door states TODAY (locked door = honest in-fiction resolution, DM Test) ·
  tactical-move mask consumption activates with TAC-2 (noted, not owed) · MR-ORACLE grows
  GEOMETRY_BREACH. Live wiring for lockpicks/force via resolve.js; forced entry mints a ledger fact
  (moral-physics seam).

### MR-1a — egress writes the doorstep: exit lands you at the door you used  ·  Phase 1 (MAP-REAL stage 1, engine serial)  ·  **✅ LANDED v0.28.36 b085 (worker `fc7ef397` → integrated `7a11f607`; U497 flipped + U498–U500; suite 10094/0; probe GREEN — 247 ft teleport → 5 ft doorstep; `playtest:position` now a permanent `npm run check` rung)**
- **Worker divergence flags (honest, carried):** (1) structures have NO explicit exterior-door record
  — doorstep derived from the entry room's outer wall (deterministic, 4-direction tested); MR-2a/2c
  MUST add a real front-door record to the door-state schema (house-builder exports carry orient).
  (2) Entry-side lands 5 ft inside the correct entry room (audited coherent) — exact inside door-cell
  write = MR-1a-follow-up, folded into MR-2a. (3) walk-east currentNodeId-null stays TAC-2.

- Oracle targeting data: exit NULLS `pos` → `ensureWorld` backfill re-seeds via `placeNearNode` ±50-cell
  jitter (247 ft measured). Fix: threshold crossing WRITES the door's outside cell (`POSITION_AS_CANON`
  §2/§3), backfill demoted to legacy-save repair. Done = probe green, U497 todo flipped ON,
  `playtest:position` wired into `npm run check`. **MR-1b (TAC-4 renderer read) dispatches on landing.**

### TT-OCC — minis never stand inside ink that isn't theirs  ·  Phase 1 (map fidelity)  ·  **✅ LANDED v0.28.35 b084 (worker `2a11a820` → integrated `1d8d8bc7`; U494 5/5 + U495 6/6; suite 10079/0; ring-search exclusion w/ stroke+figure margin; pixel-verified on the bug node `n0_2935788122`; zero relocks incl. U398/U410/U480)**
- Renderer-side: outdoor people-minis must not render inside building floorplan ink (TT-INK rooflessness
  makes an outdoor scatter point read as "in your bedroom" — the exact confusion Tim hit). Placement of
  the fix: `public/map` lane (drawModel/placeFromNode token scatter or render3d gating). Done = live
  screenshot on Tim's screen: nobody standing "indoors" who isn't.

### CARL-SHIP-1 — re-voice Carl's borrowed real-ideology vocabulary  ·  Phase 5 (door) · **SHIP-GATE**  ·  **PARKED BY DESIGN 2026-07-05 (Tim's ruling — do NOT "fix" earlier)**
- **Tim's ruling (2026-07-05):** leave Carl AS-IS for now. Durable principle: the game must allow the
  player to participate in ANY kind of evil — and the **MORAL PHYSICS PUNISH THE EVILDOER.** Carl the
  avian supremacist is the designated **test case** for that consequence engine: he must stay genuinely,
  coherently vile so the moral physics have something real to punish. When the consequence arc is built
  (Rung 4 seam, `PATH_TO_SELLABLE.md`; kin of the gratuitous-magic recoil ladder + IG-16 "Tough Shit"),
  Carl is the first-target fixture.
- **What a public build must NOT contain (the flag):** borrowed real-world supremacist vocabulary, still
  live in the tree — `packs/base/npc/carl-manifesto.md` ("Untermenschen" ×2, "miscegenation" ×2, "open
  borders", "cosmopolitan", bloodline/purity framing) and residually in
  `server/rag/corpus/carl_manifesto.json` ("miscegenation", "cosmopolitan", "bloodline", "purity", "pure
  strain") — the `10d02e90` refactor was a partial pass (JSON only, incomplete). History note: the
  original full text sits in published commit `77b2bc8d` (remote is private; whether to expunge history
  is a separate quiet-window decision — all lanes closed, one rebase, one force-push — deliberately
  deferred).
- **done_when:** both files re-voiced into world/poultry-native language with the EVIL INTACT (the
  supremacist *structure* — hierarchy, culling, strain-purity, contempt — stays; the borrowed real-world
  vocabulary goes); the term-grep above is clean over `packs/` + `server/rag/corpus/`; Carl still reads
  as coherently vile in live play (playtest receipt).
- **forbidden:** defanging Carl into a toothless joke; shipping moral-physics mechanics inside this
  packet; touching this before the pre-ship pass without a new Tim ruling.
- **rollback:** content-only; revert the commit.

### GATE 2026-07-06 — CG-2 rehearsal + post-MP-arc measure (v0.30.13 b111 · **4/48** · `opus-gate-2026-07-06.md` · $0.94, balance $14.30)
- **The rehearsal PASSED and the validator is LIVE:** 119 shadow-validated turns today (48 adversarial), ZERO would-blocks, zero detections any tier — no false positives under hostile load; labels live (persona/turn threaded). Per the 2026-07-05 fix-first-watch-meanwhile ruling the flip is earned: `.env COHERENCE_VALIDATE=on`, server restarted, rollback = one line. CG-2b's swap rules (cosmetic never blocks; strictly-better only) govern the first real detection.
- **4/48 (vs 3/48 best-ever, within run variance; 8 releases landed between measures).** Modes: 2 this run, **0 NEW** vs ledger; Chao1 saturated (5 observed, ~0 remaining) — the failure-mode space is statistically charted. One [JUDGE ERROR] self-flagged (known judge-bias class, turn passed).
- **Cluster 1 → DECL-STAT-1 (cut below):** 3× CRUNCH_INCONSISTENCY — a player-declared check resolves on a DIFFERENT stat (declared Strength lever → mech `stat:WITS-2`).
- **Cluster 2 → WIN-EGRESS-1 (cut below):** 1× DM_TEST_DEADEND — multi-window egress bounced as a menu ("Which do you go out?") instead of resolving in fiction; the egress-door pattern's window sibling.

### DECL-STAT-1 — a declared check resolves on the DECLARED stat  ·  Phase 0 (crunch honesty)  ·  **✅ LANDED v0.30.14 b112 in two honest halves (mechanism `5d5f82be`→`5a1b49d4` + the flagged one-line playloop wire `fd34b3f8`→`b56a6f1b`, added by the SAME resumed worker once WIN-EGRESS-1 freed the slot; U586 12 + U587 8, playerMove-level proof: declared→`stat:MIGHT+1`, undeclared control→`stat:WITS+1` unchanged; grace meta-questions (U182) and social adjudication (U102) layer BEFORE/AROUND the generic floor untouched; the worker declined to fake a pre-wire live screenshot — honesty economics held)**
- Evidence: gate 2026-07-06 Rules-Lawyer turn — "I jam the Worn Blade under the hasp and lever with my full weight. Set the DC and I'll roll Strength." → mech `[… approach:focus … stat:WITS-2]`. The narration honored the roll; the STAT contradicted the declared action (med severity, ×3 this run).
- Diagnose-first: where does a declared ability enter the intent record, and where does resolve pick the stat? The fix: an explicitly declared ability WINS over inference (interpret-richly/commit-narrowly — V7); absent a declaration, today's inference stands. Determinism + corpus relocks documented if prompts shift.
- **DIAGNOSIS + MECHANISM LANDED (worktree, 2026-07-06 — DECL-STAT-1 worker).** SEAM: `resolve.js` picked the stat purely from `statForApproach(approachTag)` — there was **no stat field anywhere**, approach and stat were conflated. Worse, the typed generic-floor move is built by `inferMoveFromText` (playloop ~L3882), a raw-text re-parse that never sees the structured LLM packet — so even a grounded `stat` couldn't reach the roll. The gate utterance landed `approach:focus` because `inferMoveFromText`'s force-regex has no "jam/lever/hasp" → defaulted to focus → WITS. Built IN-LANE: `resolve.js` honors an optional `move.statTag` (normalized to the 5 engine stats at `normalizeMove`; null → infer, byte-identical); Intent gains a `stat` field carried by `intentToMove`→`statTag`; `parseIntent.declaredStat()` reads the declaration (same synonym table as grace's `STAT_SYNONYMS` — one enum); `llmIntent` schema + few-shot + `groundPacket` carry `stat` on the LLM-primary path. Tests **U586/U587 green** (17/17) driving the exact production sequence parseIntent→intentToMove→resolveMove. **THE ONE REMAINING WIRE IS IN PLAYLOOP (WIN-EGRESS-1's serial slot):** at the generic resolve floor, set `move.statTag = declaredStat(text)` (import already-exported `declaredStat` from `engine/intent/parseIntent.js`) — one line, zero new logic. Until that lands, the live typed utterance still resolves the inferred stat; the mechanism + intent plumbing are proven. *(The wire LANDED same day — `b56a6f1b`, see the row header; this note kept for the diagnosis record.)*

### WIN-EGRESS-1 — multi-window egress resolves in fiction, never as a menu  ·  Phase 0 (THE DM TEST)  ·  **✅ LANDED v0.30.14 b112 (worker `f2c45338` → integrated `64710489`; U588–U589 + U289/U321 honestly relocked; the door pattern extended: named side wins → goal-directed pick → deterministic first, always NARRATED, never asked; the old "tentative climb still asks" P10 carve-out REMOVED — THE_DM_TEST forbids the compass-bounce regardless; live receipt through the real Submit: "You shoulder through the east-facing window and drop to the open ground outside.")**
- Evidence: gate 2026-07-06 Chaos-griefer turn — "I climb out through the broken window and run torch-first at the nearest cottage's wall." → DM: "There's more than one window — one to the east or one to the north. Which do you go out?" (high; the cardinal menu-bounce THE_DM_TEST.md forbids).
- Diagnose-first: find the which-window prompt source; fix on the applyEgressRepair precedent — pick the fiction-obvious window deterministically (toward the stated goal, else nearest), NARRATE the pick ("You shoulder through the east window…"), never ask. AG-arc recall-bias law applies at the ONE egress chosen.

### GATE 2026-07-05 — morning fresh measure (v0.28.29 · **3/48** · `opus-gate-2026-07-05.md`)
**The honest read:** 14/48 → 8/48 → **3/48 (6%) on the same Ref-off config** — the best score the gate has
ever recorded. All eight of 07-04-3's fixes HELD (CBT-AGENCY, INT-4-HELD, ANS-2, INFO-HONESTY all silent),
and the seven builds landed since (PACK-1/PACK-3 content, FACT-1 factions, MAP-3DR/tilt) introduced ZERO
regressions. **Rules Lawyer went 12/12 clean for the first time** — the RL-1 rules-answer cluster (8/14 on
07-04-2) is fully quiet. Chao1: 2 modes this run, **0 categorically new** (S_obs 5, CI [5,5]) — still
deepening known families, none discovered. Judge errors: 3 (marked, scored legacy-pass per series
convention — worth an eye if the count grows). Cost $0.92, ledger $15.24. Clusters → owners (all 3):
- **SEEK-PERSON deadend (1, high — the actionable head):** _"I get up and go find someone in the
  settlement who can tell me who founded this outpost."_ → **"That way is blocked from here."** — a
  compound seek-to-ask intent (egress + find-a-person + info goal) bounced as a bare navigation refusal.
  Candidate seams: interior-egress route (the AG-1→3b egress-door pattern) vs. travel resolver firing its
  blocked-exit line on a destination-less "go find someone" (misroute). NB this is the SURVIVING member of
  the AG-4 family post-INFO-HONESTY — fold it into the AG-4 re-scope. LLM-off repro FIRST (tallow, exact
  utterance from a fresh boot, ~turn 5 context in the jsonl).
- **DIALOGUE-ENTER empty first exchange (1, low):** _"Oh, hi Asha — sorry, I didn't realize you were
  standing there. Who are you?"_ → `[dialogue enter | Asha]` renders atmosphere ("letting her words settle")
  with ZERO spoken words — the enter utterance carried a direct self-question and the first exchange must
  deliver her actual answer (self-intro from modeled role/tenure — NBIO-1 precedent). Seam: dialogue-enter →
  npc-voice bridge. ⚠️ `dialogue.js` = SERIAL taste-critical lane.
- **MIXED-outcome loot unresolved (1, low):** _"I ignore the smoke and rip open the iron-bound chest to
  loot it."_ → roll 15 vs DC 14 → mixed; narration opens the lid but never resolves the LOOT intent nor
  states the cost/complication the margin-1 mixed owes (the ignored smoke was RIGHT THERE as the cost).
  Seam: mixed-outcome narration floor for container-force (genericGroundedOutcome / composer mixed branch).
- **CG-2 shadow-compare (ran live on this gate's server):** 48 turns validated → **1 would-block**, and it
  argues AGAINST flipping live as-is: the detector was RIGHT (CG-6 clock desync — candidate narrated
  "midday light", canon `clock.segment` = morning; a true, cosmetic canon miss on the locket turn) but the
  base fallback it would have delivered is WORSE than the sin — `Wizard: Elske Nightherd shrugs. "Can't
  say. No record I've ever seen."` — a non-sequitur NPC dodge in the banned "no record" pattern, swapped in
  over a turn whose only flaw was a time-of-day word. Verdict material for Tim's review: CG-6 severity
  wants tiering (cosmetic time-desync → reword/pass, not block), or the fallback needs to re-check against
  the same detectors before it's allowed to replace (the "re-checks the base" step exists in `on` mode —
  the swap should also lose to the candidate when the base fails HARDER). Also: the log's
  `persona:"campaign"`/`turn:null` fields aren't threaded from the gate — label before more shadow runs.
  Log: `docs/playtests/coherence-validate/2026-07-05.jsonl` (gitignored raw, by design). **Tim's go/no-go
  review is a five-minute look at ONE swap**, not an hour of transcript.

### CG-2b — the cure must beat the disease (validator swap rule)  ·  Phase 0  ·  **✅ LANDED v0.28.30 b079 (worker `0f0a84ce` → integrated `2da3c1b6`; U482–U484 32/32; suite 9989/0; tier map: CG-6 cosmetic, 11 classes structural; swap = two-rung ladder base→floor, ties denied; labels live. Live flip still BLOCKED on next-gate rehearsal per the ruling.)**
- **provenance:** Tim's 2026-07-05 CG-2 review (the GATE 2026-07-05 shadow-compare finding, reviewed on
  screen): detector RIGHT (CG-6 clock desync, cosmetic), replacement WORSE (the deterministic base for the
  turn was an Elske "no record" dodge — proof the base can fail harder than the candidate). Ruling:
  fix-first-watch-meanwhile; **watch mode ON in `.env`** (`COHERENCE_VALIDATE=shadow-compare`, local-only,
  logs to the gitignored `docs/playtests/coherence-validate/`), live flip BLOCKED on this packet.
- **objective, three rules:** (a) **severity tiering** — a cosmetic-class detection (CG-6 time-word desync
  at minimum) NEVER blocks: log `wouldBlock:false, tier:cosmetic`, deliver the candidate; (b) **the swap
  gate** — before any replacement, run the SAME detector bank over the fallback; the swap happens ONLY if
  the fallback's failure set is strictly better than the candidate's, else the candidate stands (the cure
  must beat the disease); (c) **label the log** — thread real persona/turn identifiers into the
  shadow-compare records (today: `persona:"campaign"`, `turn:null`).
- **parked as CG-2c (do NOT build now):** the reword path — asking the polish layer to fix ONLY the
  cosmetic word. Bigger machine; tier-to-pass is the CG-2b floor.
- **allowed_files:** `engine/coherence/validator.js`, `engine/coherence/checks.js` (tier map only),
  `engine/llmAdapter.js` (finalize seam ONLY if the swap decision lives there), tests U482–U484, corpus
  locks if any row asserts old behavior. **forbidden:** world state, rng, `WORLD_VERSION`, playloop,
  dialogue/grace; LLM layer never throws (silent-fallback law).
- **invariants:** `COHERENCE_VALIDATE` unset/off stays BYTE-IDENTICAL (existing CG-2 dark guarantee +
  tests); determinism ladder; convergence 100%.
- **done_when:** the logged locket record, replayed as a fixture, delivers the candidate UNCHANGED in both
  shadow-compare and ON modes (cosmetic tier); a synthetic hard-fail-with-clean-fallback still swaps; a
  synthetic fallback-fails-worse case keeps the candidate; labels threaded; `npm run check` green; live
  flip stays a Tim decision AFTER a rehearsal on the next scheduled gate (no extra paid run for this).
- **rollback:** revert the lane's commit (validator returns to block-on-fail + trust-the-fallback).

### GATE 2026-07-04-3 — evening re-baseline error analysis (v0.28.19 · **8/48** · `opus-gate-2026-07-04-3.md`)
**The honest read:** 14/48 → **8/48 on the same Ref-off config** — the day's six landings HELD under the
judge: ZERO movement / geography / map / perception failures (FP-2, TAC-2/4, ROADS-1, PERC-1, RL-1,
INT-4-TRAVEL all silent). Chao1 ledger: 3 modes this run, **0 categorically new** (S_obs 5, CI [5,5]) —
we are deepening known families, not discovering new ones. Clusters → owners (all 8):
- **CBT-AGENCY (2, both high-sev — the sharpest new evidence): "roll MY attack" overridden.** Player
  declares an attack on Asha ("I draw my Worn Blade and swing — roll it"); DM instead casts a
  fabricated force ward (a gravedigger PC!) and runs only enemy attacks — player's declared combat
  action never resolved. = combat intent routing / auto-action override in the escapeCombat seam.
  **CBT-AGENCY ✅ LANDED v0.28.21 b071** (`a5a79b1e` → `71115f0e`): ROOT — `parseEscapeAction`'s
  defensive branch regex matched bare NOUNS ("that **guard** leather", "force **wards**") before the
  strike default — a substring collision in the deterministic parser, not the LLM. FIX —
  `isDeclaredAttackText` guard (13-phrasing paraphrase set) placed after tactical intents, before
  cover/ward; named-target + unarmed + defense-on-request routing untouched; NO new enemy fields
  (ensureCombat whitelist untouched). U455–U457 (8 subtests); both gate lines now roll atk-vs-AC,
  Asha 8→1 HP; zero relocks.
- **INT-4 take:already-held (1)** — "grab the lantern and set the pallet on fire" → "lantern already
  tucked in your pack," arson never resolves. Evidence #3 for the queued throw/hurl/use-held row.
  **INT-4-HELD ✅ LANDED v0.28.22 b072** (`c106f303` → `bb8e3628`): ROOT — TWO classifiers ate the
  verb: `detectPhysicalAssault`'s forced-into-harm branch called `refLooksPersonal("the lantern")`
  (any "the <noun>" reads personal) → no-target person-assault; `tryTakeRevealedContainerItem`'s
  `grab` match fired take:already-held before the compound arson could resolve; and FIRE_RE only knew
  contiguous "set fire" (split "set X on fire" never reached the material-aware fire ruling). FIX —
  `refIsPresentObject` fall-through, `TAKE_THEN_ACTION_RE` bail (mirrors the READ bail), FIRE_RE
  verb-led broadening (question-safe). No new world fields — arson resolves through the EXISTING
  `resolveFireRuling` furniture deltas (spread/hazard escalation stays P-80/DX). U458–U459 (11) +
  **corpus C25 ×2 LOCKED — convergence 127/127**. Letter-where question CONFIRMED different seam
  (question-router + inventory-canon answer) → folded into the answerability wave below.
- **Answerability info-asks (2)** — "who runs this outpost?" stonewalled with "no record" while Elske
  (representative) + Dalla (innkeeper) stand present and answerable; "nearest person, let me talk to
  them" listed names + [clarify:who] punt instead of opening the obvious dialogue. = the egress
  pattern's next rung: present-NPC-answerable info-asks resolve THROUGH the NPC, compound
  name+talk resolves not clarifies.
- **Object-state question (1)** — "where did the letter go? I was just holding it" → deflected to NPC
  presence. Inventory/canon knows the letter; answer it.
  **ANS-2 ✅ LANDED v0.28.25 b074** (`dbaac5e9` → `0fd3fc6f`): all four question-family turns dead —
  leadership answers through the present representative (secret-control still declines at the reveal
  sink, V12-13); delegated "nearest person + talk" opens dialogue deterministically (bare vague-talk
  still clarifies, U219/UX2 kept); sheet compounds fold class/HP/gear into the meta answer (bare
  look-around still surveys); `isQuestionShaped` handles "Wait, …" and `META_OBJECT_LOCATION`
  answers from inventory canon (invented letter → honest correction; provenance/person shapes
  guarded). Flagged hot-file hunk: ~54 ANS-2-commented lines in `npc/dialogue.js`
  (commonKnowledgeAnswer leadership branch) — reviewed at integration. U460–U463 (27 subtests) +
  **corpus C26 ×4 LOCKED**. Known cosmetic nit left deliberately: the leadership answer's hidden mech
  tag still reads "no-record" (invisible to players; avoids corpus churn).
  **WITH THIS, EVERY ROW FROM GATE 2026-07-04-3 IS CLOSED** (6 DEADEND + 1 CRUNCH + 1 HALLUCINATION
  → CBT-AGENCY, INT-4-HELD, ANS-2 ×4, INFO-HONESTY — all landed same-day with corpus locks).
- **INFO-HONESTY fabricated specific (1)** — pressed after a no-record info-check, DM invents "the
  single building visible… Elske is within it." PERC-1's sibling: no-record must never become a
  confident specific (extend the hedge/honesty floor to info-checks under pressure).
  **INFO-HONESTY ✅ LANDED v0.28.23 b073** (`a3f27940`): third validator guard after PERC-1's —
  `isNoRecordInfoBase` (all 20 decline templates from declineInfoSeek/objectReadDecline enumerated,
  U464-06 covers every one) + `findResolvedInfoSpecific` (positive WHERE assertions + structure
  counts rejected; reworded uncertainty + pure atmosphere pass). No floor change needed (it was
  already honest — fabrication was purely polish-layer). U464–U465 (11 tests); U245/PERC-1 guards
  regression-green; zero patch blocks.
- **META-SHEET (1)** — "what does my sheet say for HP and class?" answered with room description.
  RL-1's sibling: character-state meta-asks answer from canon (HP 13/13, level 1, gear list exists).

### GATE 2026-07-04-2 — Ref-off baseline error analysis (v0.28.10 · 14/48 · `opus-gate-2026-07-04-2.md`)
**The honest read:** 14/48 (29%) vs 9/48 Ref-on — NOT a regression story: the floor we built HELD
(**Confused newbie 12/12 clean**; the lore-hound "no record" NPC-dodge cluster from 07-04-1 did NOT recur —
NODE-DESYNC-1 + presence repair dissolved most of AG-4's observed evidence), and the judge now reaches
DEEPER classes. First full Ref-off measurement = the new system's baseline. Clusters → owners:
- **RL-1 (8 of 14: Rules-Lawyer rules-answer cluster)** — **✅ TIM RULED 2026-07-04-pm3, verbatim:
  "confirm the shape, never the table." ✅ DONE** (`docs/briefs/RL-1-confirm-shape-never-table.md`;
  worker worktree, local commit; tests U426–U428, 21/21; suite 9717/9717 · convergence 124/124 (no
  relock needed — C5-005/C8-001-target unaffected, verified directly) · determinism U19/21/22/27/30
  green · `playtest:quick` clean; live-verified via a real `beginAdventure('tallow', mode:'escape')`
  boot, same scenario the gate hit). Three seams landed: (1) `META_TO_HIT_SHAPE` + `ENEMY_DEFENSE_CUE_RE`
  in `handleMetaQuestion` (gracefulAdjudication.js) — a deterministic rules-answer floor checked FIRST,
  before the breakpoint-table/self-Armor branches; (2) a leak guard in `validateNarrationCandidate`
  (llmAdapter.js) rejecting breakpoint sequences / numeric DC·TN / percentages / stat-block runs,
  falling back to the grounded base narration; (3) one standing "confirm the shape, never the table"
  line in the live DM system prompt (`buildSystemPrompt`). Foe difficulty answered RELATIVELY from real
  state (bandit/cultist ac:12 ground truth when no live enemy, else the real trait-adjusted enemy AC),
  self ≠ foe. v0.28.12 (build 062).
- **THROW/DROP misroute (Chaos arson, 2–3 fails)** — "hurl the lantern"/"drop it on the pallet" matched the
  `take:already-held` sink → the throw silently never happened. → INT-4 family row (below). The fire-on-straw
  no-ignition + roll:1-narrated-as-success physics contradiction → P-80/DX consequence-physics evidence.
- **Letter-sequence compound (Lore-hound ×2, one HIGH)** — "set it down, walk, pick it up, read" → "You step
  back outside" non-sequitur. = INT-4 compound multi-part remainder (already in the stub order; this is its
  sharpest evidence yet).
- **COMBAT_NOT_STARTED (1)** — "step outside looking for something to fight" → no encounter path fired.
- **Shadow observer (CG-LIVE-2 data): fire rate 2.8% (1/36) — boring, as hoped — but the ONE fire is a
  FALSE POSITIVE:** narration said "Elske Nightherd is **elsewhere**…" (a correct ABSENCE statement) and the
  CG-1b comparator counted the name-mention as in-room speech. → **CG-1c (small, free): absence/negation
  guard in the presence comparator** — required before CG-LIVE-2 flips to regenerate.
- **AG-4 status:** brief is STALE — most of its observed cluster was NODE-DESYNC shadow. Re-scope against
  this run before any dispatch (the phrase-bank "no record for self-questions" fix likely still right;
  the per-topic escalation evidence needs re-confirming).

### INT — THE INTENT TRANSLATOR (Phase 0 — the structural close of Rung 1)  ·  **adopted 2026-07-03**
**Provenance:** Tim's 2026-07-03 decision (Desktop memo `fable_rung1_llm_between_player_and_engine.md` +
the in-session Fable ruling), executing `RUNG1_CONVERGENCE_PLAN.md` §3/§5 as option **(a)**. Trigger:
`docs/briefs/FAILURE_META_DIAGNOSIS.md` (~25 packets spent on ONE root; allowlists-at-entrances cannot close
an infinite phrasing space) + `docs/briefs/SECOND_ORDER_DIAGNOSIS.md` (scattered sinks force precision-bias;
a single choke point affords recall). **THE ONE LAW is untouched:** the LLM *interprets* the player and
proposes a typed packet; the deterministic engine grounds, validates, rolls, commits, logs — interpretation
≠ authority (plan §4). The seat is already built and dark: `engine/intent/intentSchema.js` reserves
`source:'llm'` ("a fourth source that emits this exact shape"); `engine/llmPhysics.js` +
`server/localLlmProvider.js` are the live in-engine precedent. Input-side sibling of the narration-side
`PROSE_TO_WORLD_CONTRACT.md`. **Sequence INT-1 → INT-2 → INT-3 → INT-4, one in flight** (playloop/grace hot
files — serial lane, `RUNG1_QUEUE.md` protocol §2). Cautions ruled: CLARIFY gets a *budget* (clarify-loops
are documented sink S4; THE_DM_TEST forbids mechanical bounces), ONE vocabulary (extend intentSchema's 10
verbs — no parallel contract enum), `parseIntent` stays the LLM-off floor.

#### INT-1 — typed IntentPacket in shadow mode (aggregate existing detectors; ZERO behavior change)  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`57b878c`)**
- **objective:** one assembler (`engine/intent/assemblePacket.js`) computes ONE typed packet per free-text
  turn, each field fed by a detector that already exists (`directQuestionIntent` kinds, meta/info-seek/
  confrontation/movement detectors, `detectPhysicalInteraction`); extend `intentSchema.js` with
  `kind/goal`, `targets[]`, `objects[]`, `compoundParts[]`, `ambiguity`, `confidence`, `source`. Shadow
  mode: the packet is traced on the existing `mech:` instrument line; all routing still runs today's paths.
  (= convergence plan Phase 2: "control layer first, richness later.")
- **allowed_files:** `engine/intent/*`, one shadow call-site in `engine/playloop.js`, `engine/instrument.js`
  (trace field), new tests.
- **forbidden:** any behavior change; writing packets into world state / canon events (that is INT-2's
  replay story); `WORLD_VERSION`; rng.
- **invariants:** packet assembly is a pure function of (text, world) — deterministic in shadow mode;
  worldHash replay equality (U19/21/22/27/30).
- **test_plan:** unit utterance→packet-fields table; `npm run convergence` 100% unchanged; full suite;
  `playtest:quick`.
- **done_when:** every free-text turn logs exactly one packet on the instrument trace (behind
  `INTENT_TRACE=1`, default OFF — player-visible output stays byte-identical); `npm run check` green;
  zero behavioral diffs.
- **rollback:** delete the assembler + the one call-site.

#### INT-2 — the LLM takes the seat (`source:'llm'`) + the translator benchmark  ·  Phase 0  ·  **⚠️ BUILT 2026-07-03 (`b60781e`,`918b10a`) — DIVERGED from this spec; corrected by INT-2R below**
- **objective:** the LLM is the **PRIMARY reader of all typed/spoken free text** (ruled 2026-07-03 — no
  confidence-gated regex pre-filter: regexes fail *confidently* ("I take him out" → verb `take` = pick up),
  and deciding when a regex is trustworthy is itself a language problem — the treadmill's root shape, one
  more "precision-tuned detector at the entrance"). Every free-text turn makes a **server-side** LLM call
  (utterance + compact scene bundle → the SAME packet shape; temp 0; JSON-schema-constrained) that proposes
  intent. Bypasses are *structural, not statistical*: `source:'click'` intents are already typed and skip
  translation; a literal exact-match micro-set (bare `north` / `look`) MAY short-circuit. Deterministic
  grounding validates every ID against the bundle — an unknown ID is rejected, never materialized.
  Ambiguity: the LLM may only *flag* it; the engine decides whether to clarify, under a budget (in-voice,
  offers the concrete options, never twice in a row). Provider chain (**Tim's ruling 2026-07-03**):
  **Ollama PRIMARY** (`server/localLlmProvider.js`, local llama3.1:8b) → Anthropic fallback →
  deterministic `parseIntent` **floor, never a pre-filter** (silent fallback — the game must run LLM-off). Replay: the committed packet is recorded on the turn log;
  replay consumes logged packets and never re-calls the LLM.
- **benchmark (answers "which model sits in the seat" empirically):** new `scripts/intent-eval.mjs` scores
  ANY backend against a frozen utterance→packet corpus (seed it from the 49 gate reports' failing turns +
  the memo's table — "I take him out"→clarify, "I use the table"→clarify-with-options, "I stab the goblin
  by the door"→attack+grounded target, "I teleport through the wall"→impossible). Metrics: packet-match %,
  invented-ID count (>0 = hard fail), clarify precision/rate, latency. Run ≥3 backends: Anthropic fast
  tier, Tim's local Ollama model, parser-only baseline. Report committed to `docs/playtests/`.
- **allowed_files:** new `engine/intent/llmIntent.js`; `server/llmProvider.js` + `server/localLlmProvider.js`
  (one new task route); the INT-1 seam in `engine/playloop.js`; new `scripts/intent-eval.mjs`;
  `tests/corpus/*` additions; `.env.example`.
- **forbidden:** browser-side key; the LLM deciding outcomes or mutating state; blocking a turn on LLM
  failure; a new contract enum (extend the 10 verbs).
- **invariants:** LLM-off = today's behavior exactly; no ungrounded referent reaches resolution; worldHash
  replay equality via logged packets.
- **test_plan:** corpus green; a paraphrase set for translator routing; the benchmark report; full suite +
  `playtest:quick`.
- **done_when:** benchmark report committed (≥3 backends); default backend chosen at ≥95% packet-match with
  0 invented IDs; key-off falls back silently; `npm run check` green.
- **rollback:** `INTENT_LLM=off` env flag (the INT-1 shadow path remains).

#### INT-2R — course correction: the LLM becomes the ACTUAL primary ears, Ollama first  ·  Phase 0  ·  **✅ LANDED 2026-07-03 (`cb9473a` merged; v0.27.0→0.27.1 "Ollama ears")**
- **why (audit 2026-07-03 of `57b878c..b3d600e`):** four seams between spec and build — (1) live v1 runs
  the engine in-browser and never calls `/api/move`, so the LLM seat sits on a door the game doesn't use;
  (2) the seat fires only on `isLowConfidencePacket` — the vetoed regex-first design (the INT-2 *brief*
  drifted from this spec and was built faithfully); (3) `playerMove` hands routing the deterministic
  `__dqIntent` even when an LLM packet exists — the packet is trace-only, so INT-3/4a/4b consumers never
  hear the LLM; (4) provider order was Anthropic-first. Also: llama3.1:8b scored 0% packet-match in the
  committed benchmark (non-canonical verb tokens — fixable), and `server/llmProvider.js`'s hardcoded
  default model 404s (silently breaks the fallback ear).
- **what landed (worker lane `cb9473a`, brief `docs/briefs/INT-2R-ollama-primary-ears.md`, verified):**
  Ollama-first (`INTENT_LLM=off|ollama|anthropic|auto`, default auto = Ollama→Anthropic); confidence gate
  removed (every typed turn proposes); new `POST /api/intent-packet` — `public/v1.js` calls it before
  every single-text `playerMove` (budgeted; an offline/slow server can never stall a turn); `playerMove`
  derives the shared verdict FROM a grounded packet's `kind` (live-verified: the same text routes
  differently with vs. without a `kind:'rules'` packet; every downstream call-site reads only `.kind`);
  Ollama prompt hardened (explicit verb enum + few-shot incl. ask-vs-talk) + verb-synonym normalization
  in `groundPacket.js` (reuses `parseIntent`'s `VERB_SYNONYMS` — one vocabulary); server-side proposal
  budget widened to 8000ms (measured real latency ~6–8s); fixed pre-existing stale Anthropic model id
  (404 without `LLM_MODEL`) and a benchmark-isolation bug in `scripts/intent-eval.mjs` (under the new
  Ollama-first default, Ollama's answers were silently scored under the "Anthropic" label — now forces
  explicit `INTENT_LLM` per pass). Suite 9468/9468 (serial), convergence 124/124, determinism green,
  `playtest:quick` clean.
- **benchmark** (`docs/playtests/intent-eval-2026-07-03T19-26-19-363Z.md`): parser-only 66.7% ·
  **Anthropic 88.9%** · **Ollama 0% → 44.4%** after hardening. The run's "invented-id: 1 HARD FAIL"
  headline was investigated: Anthropic put the real item "torch" in the entity-scoped `target` field;
  grounding correctly nulled the target and kept it in `objects[]` — right-name-wrong-field, not
  fabrication; no fabricated referent ever reached `playerMove`. (Benchmark field-aware framing =
  follow-up, not a safety gap.)
- **integration ruling (Basecamp 2026-07-03):** the worker flagged the client fetch budget (2800ms per
  the fix brief) vs. measured ~6–8s Ollama latency — most live turns would time out and fall back,
  quietly defeating "Ollama primary." Per Tim's unconditional ruling, the client budget is raised to
  **9000ms** (v0.27.1); felt cost = a typed turn can wait several seconds to be heard correctly. Knobs if
  it drags: lower the budget, smaller local model, `INTENT_LLM=off`.
- **INT-2R-u + HAIKU-PRIMARY (Tim's evening ruling 2026-07-03 — supersedes the morning's Ollama-primary;
  landed v0.27.2 build 048):** the live-play findings ("all I could do was look around" = 9s dead air +
  a latent junk-`kind` hijack) fixed in-window: (1) **echo-first UX** — the player's words + "The DM
  listens…" render BEFORE the ear/turn work (live-measured 63ms; the old echo waited behind the LLM
  await); (2) **Anthropic (claude-haiku-4-5) is the PRIMARY ear** via new `INTENT_LLM_MODEL` (its own
  setting — narration keeps its richer model), Ollama = offline fallback, `parseIntent` = floor;
  (3) **real budgets** — route total 4000ms with per-leg deadlines (two sequential 8s legs was the
  "13.7s route" bug), client 4500ms; (4) **kind-guard, both seams** — grounding whitelists `kind` to the
  classifier's 4 legal values AND `playerMove` honors a kind only on `isQuestionShaped` text (U383; the
  U376 fixture that enshrined the hijack rewritten); (5) prompt diet (candidate caps 12/14) + few-shot
  now teaches `kind`; a mid-fix regression (schema-embedded instruction flipped models into "I'm ready
  to translate…" acknowledgment mode, Sonnet 88.9→16.7) was caught by the benchmark and fixed —
  `INTENT_DEBUG=1` now surfaces silent ear failures on the server console. Boot warm-up already existed
  (`warmModel()` at listen).
- **benchmark (final, `docs/playtests/intent-eval-2026-07-03T20-34-58-412Z.md`):** parser 66.7% ·
  **Haiku 72.2% @ ~1.0s (the shipped default)** · Sonnet 4.6 **94.4%** @ ~1.7s (one-line upgrade:
  `INTENT_LLM_MODEL=claude-sonnet-4-6`, ~3× the pennies) · Ollama 38.9% @ ~6.3s. 0 invented IDs
  everywhere. Live-door proof: real-browser "go outside" → `source:'llm'`, `verb:'move'`, `kind:null`.
- **follow-ups (queued, concrete):** (a) benchmark invented-id framing made field-aware; (b) grow the
  18-row corpus from future gate history (the mid-fix 16.7% catch proves its worth); (c) consider
  Sonnet-as-ears if Haiku's 72.2% is felt at the table (one env line, no code).
- **rollback:** `INTENT_LLM=off` — zero provider calls (U377/U380/U382 proven), deterministic floor is
  the whole game.

#### INT-3 — graduate family #1: direct question → deliver-or-decline rides the packet  ·  Phase 0  ·  **✅ landed 2026-07-03 (`a19b0bc`; consumes the shared verdict — LLM-sourcing of that verdict arrives with INT-2R)**
- **objective:** collapse the biggest lineage (meta-query answer-binding; capability rows C1/C4/C5/C6) onto
  ONE act-handler consuming the packet at the single egress (the AG-3 pattern) — the scattered entrance REs
  (`INFO_SEEKING_TOPIC_RE`, `PROVENANCE_RE`, `FOUNDING_RE`, `TENURE_RE`, …) become packet-feeders or are
  deleted. Graduation bar = convergence plan §3.3 (Vol 8 §15, all 9 points).
- **done_when:** the family's corpus rows pass via the packet path; superseded REs retired; the next gate
  shows **no categorically-new flavor** of the question family (judge by bug-nature, not the headline %).
- **rollback:** family flag back to legacy routing (keep both paths for one release).

#### INT-4 — the family graduation queue (stub — cut one packet per family on the INT-3 template)
- **order** (by lineage size / sink): referent-grounding (`[clarify:referent]`, sink S4) → dialogue-address
  (S5 deflect-and-wait) → combat table-talk (the CRUNCH seam) → compound multi-part asks (C1 remainder)
  → greeting/orientation address ("Oh, okay, so I'm outside now? Hi Asha." must greet + orient, never roll a
  generic focus check — 2026-07-04 gate, Confused-newbie)
  → named-room interior movement ("go to the hearth room" / "walk out to the hearth room" must resolve on the
  interior room graph — today it falls to trivial-gate or NODE-TRAVEL; live 2026-07-04, see NODE-DESYNC-1
  — ✅ landed with NODE-DESYNC-1 `881c79b`)
  → **throw/hurl/drop of a HELD object** must never resolve as `take:already-held` ("I hurl the lantern
  against the wall" → "the lantern is already tucked in your pack" — gate 2026-07-04-2, Chaos ×2; the
  throw silently never happens)
  → **place-name travel must route to the JOURNEY, never person-disambiguation** (live 2026-07-04-pm5,
  v0.28.15 boot: typed "go to The Greenwood" — a neighboring NODE and the movement law's fast-travel
  case, JR-1 — answered "I haven't introduced anyone named The Greenwood… Bones the Fox, Galen, Brogan,
  the Lingerer are here — who do you actually mean?" The intent layer treated a place as a person;
  known-place names must resolve as travel BEFORE the npc-referent clarify sink).
  **INT-4-TRAVEL ✅ LANDED v0.28.19 b069** (`e1f0d234` → `5dd06ef7`, clean pick): ROOT — the
  indoor→travel bridge's verb whitelist (`toward|make for|set out|head…`) omitted "go to"/"walk to"/
  "travel to", so destination phrases fell past the (interior-guarded) journey block into the
  ungrounded-referent sink. FIX — bridge grounds the destination against real map places FIRST
  (`resolveNamedNeighbor`/`resolveNamedDestination`, now article/case-insensitive via
  `placeNameMatchLen`, ≥4-char core gate); unknown places reach the honest "no such place hereabouts"
  branch; "go over to Galen" excluded (present-NPC approach → dialogue); NODE-DESYNC-1 room-move
  precedence regression-guarded. ZERO intent prompt/schema edits (no re-benchmark). U452–U453
  (10 subtests) + **corpus C24 LOCKED — convergence 125/125**. JR-1 thresholds/seeds untouched.
  Cut each packet when its predecessor lands.
- **ARC done-when (= PRD Phase 0 exit):** frozen corpus 100% **and** N consecutive gates open zero
  categorically-new failure classes **and** ≤2 broken turns per 48, twice running (2026-07-02: 9/48 → 4/48
  after the egress arc).

#### INT-4a — compound-action drop: a trivial leading clause must not eat the whole turn  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`b410477`; v0.28.1 build 051; live-verified)**
- **what landed:** root was NOT the ear (the LLM packet's `verb` never drives the turn — only `.kind` is
  consumed; `playerMoveCore` re-parses raw text deterministically). The clause was dropped at TWO seams:
  the physics-verb intercept (`playloop.js:3271`, "take" → chest "too heavy") and `classifyTrivial`
  (`:3403`, "kneel" swallows the turn). Fix = `splitLeadingTrivialClause` in `playerMoveCore` — strip a
  no-stake lead (ready-a-held-tool / posture) and recurse on the REAL clause, prepending the gesture as
  flavor (mirrors the existing move-then-act splitter). Suite 9484/0, convergence 100% (124/124, incl.
  C4-010 fixed mid-work), determinism 430/430, playtest:quick 0. **Live on v0.28.1:** "take my hatchet and
  open the chest" → "You take your hatchet in hand. You open the chest."; "kneel by the chest and try its
  lid" → resolves the lid (was bare "You kneel.").
- **residual (separate, flagged):** the surviving "try its lid — is it locked?" tail lands on a generic
  WITS roll, not a concrete locked/unlocked answer — a pre-existing phrasing weakness, squarely the new
  Coherence Gate's CG-3 (object/lock-state) territory + IOM. NOT the compound-drop.
- **symptom (reproduced live, current build, Haiku ears ON — Basecamp boot 2026-07-03):**
  - _"I take my hatchet in hand and open the chest."_ → DM: **"The Hatchet is already in your pack."**
    (the `open the chest` clause silently dropped).
  - _"I kneel by the chest and try its lid — is it locked?"_ → DM: **"You kneel."** (the `try the lid /
    is it locked?` intent silently dropped).
  - Ear-level probe (`proposeIntentViaLlm`, live Haiku) confirms the root: the first utterance proposes
    `verb=take, objects=["Wooden staff"]` — the classifier locks onto the leading trivial verb and never
    reaches the real action. Same class as the stale 2026-07-03 gate's top DM_TEST_DEADENDs (chest turns);
    **Haiku-primary ears did NOT fix it** — the compound is dropped upstream of grounding.
- **distinct from CT-1** (`docs/briefs/CT-1-roll-report-compound.md`), which folds the *meta-query* compound
  (raw-d20 ∧ damage-die) in `gracefulAdjudication.js`. This is the *action* compound (trivial-clause ∧
  real-action) — a different path (the ear's single-verb collapse + the H-59 typed compound-decomposition
  `gracefulAdjudication.js ~566–625` / the `playloop.js` action classifier). **Trace the drop point FIRST**
  (packet step 1) before choosing the seam.
- **reprioritization flag:** the INT-4 stub orders compound LAST (by lineage size); live gate evidence says
  it bites HARDEST (dominant DM_TEST_DEADEND flavor). Recommend cutting INT-4a **now**, ahead of the
  referent/dialogue/combat families.
- **done_when:** both symptom turns above resolve the real action (open/inspect the chest) or say plainly
  it isn't there — never silently drop a clause; the chest-compound corpus rows pass; next gate shows no
  categorically-new compound-drop; determinism intact (U19/21/22/27/30); `npm run check` green.
- **rollback:** family flag back to legacy routing (keep both paths one release).

### CG — THE COHERENCE GATE (Phase 0 — the state-grounded second eval instrument)  ·  **sliced 2026-07-03**
**Provenance:** Tim's 2026-07-03 directive ("the Opus gates are almost useless — passing completely illogical
outputs"). Full design + taxonomy + mechanism + falsifiable predictions: **`docs/briefs/COHERENCE_GATE.md`**
(Fable, landed `35dc347`). The instrument compares DM *prose* against the deterministic Canon Log bundle the
gate already logs per turn ("DM said X / records say Y") — Road-A-safe (checker PROPOSES, Canon Log CONFIRMS;
narration≠canon is the invariant it *operationalizes*). Slots as a **4th deterministic signal** (regression-
shaped): corpus=regression · determinism · **coherence=the honest floor, gates the word "playable"** ·
gate=discovery · human=taste. Taxonomy CG-1..8 each anchored to a bundle field; **CG-8 (dropped intent) is
explicitly ceded to the existing v2 atomic judge — not rebuilt.** Sequence CG-P1→P6, smallest-shippable first.
**Parallelization:** P1/P2/P5 hot-file-free (worktree-parallel) · P3 coordinate on the gate script (not a hot
file) · P4 SERIAL (`engine/ref/rubric.js`, shared with the live Ref) · P6 last. **Nothing touches `playloop.js`/
`state.js`/`escapeCombat.js`/RNG/CSL/`WORLD_VERSION` at any phase.**

#### CG-P1 — the state-grounded checker over existing JSONLs  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`691374d`; P-A prediction CONFIRMED on point estimate)**
- **what landed:** `scripts/coherence-gate.mjs` + tests U388/U389/U390 (44 subtests). On the headline
  `gate-2026-07-03T11-45-…v1.jsonl`: **7 state-grounded flags, 5 of them judge-PASSED** (CG-1b×2 ghost-voice,
  CG-2a×2 place-noun, CG-2c relocation, CG-3a phantom-commit, CG-5 addressee) — honest floor **9→14/48**,
  exactly the P-A point estimate; the 5 named turns all landed. Pre-ROM-3 JSONLs correctly flag ~0 on
  room/presence classes (graceful-degradation negative control = P-B holds). Worker also fixed, mid-build,
  a CG-5 case-sensitivity miss, a `judgeFailed()` JUDGE_ERROR over-count, a CG-4 finishing-blow false
  positive, and a CLI arg-parse bug. Suite 9528/0, convergence 100%. **No version bump — dev tooling, live
  build unchanged (v0.28.1).** (Worker flagged its stale worktree branch, reset to v2-polish before starting.)
- **[superseded spec below — kept for provenance]** ~~QUEUE — the whole value; hot-file-free; START ANYTIME~~ (Sonnet lane)
- **objective:** new `scripts/coherence-gate.mjs` — Tier-D deterministic comparators (CG-1a/1b/1c, CG-2a/2c,
  CG-3a, CG-4, CG-5, CG-7, §0 forbidden-token scan) over gate JSONLs, emitting desync pointers
  (`{class, seed, persona, turn, span, canonField, expected, narrated, severity}`) + a per-class/per-run
  markdown report incl. the honest floor. Reuse `coherence-audit.mjs`'s loader/session-walk verbatim; copy the
  claim-regex doctrine (incl. FUTURE_MOTION-style guards) from `engine/harness/oracles.js` **by copy with a
  provenance comment** (no engine import — the script stays pure/hermetic; unification is CG-P6).
- **allowed_files:** new `scripts/coherence-gate.mjs`; new tests (allocate `scripts/next-test-number.sh U 3` —
  detector fixtures / real-JSONL regression lock / CLI end-to-end, the U336–U338 pattern).
- **forbidden:** `engine/**`, `scripts/dm-playtest.mjs`, any LLM call, any network.
- **invariants:** pure read of JSONL; no RNG; no engine import; precision-over-recall (every check ships a
  false-positive guard note); severities derived in code.
- **done_when:** runs over all four existing JSONLs; report prints per-class flags + honest floor; tests green.
- **rollback:** delete the script + tests (nothing references them).

#### CG-P2 — baseline + adjudicate the predictions  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`e71760a`; ALL FOUR predictions PASS)**
- **what landed:** `docs/playtests/COHERENCE_GATE_BASELINE_2026-07-03.md` + namespaced
  `docs/playtests/coherence-modes.json`. Hand-review of all 8 flags: **8/8 CONFIRMED real, 0 false positives
  (100% precision).** Scorecard: **P-A PASS** (5 judge-PASSED flags, point estimate, 100% precision) · **P-B
  PASS** (pre-ROM-3 negative control: 0/1/0 — no hallucinated structure) · **P-C PASS, paid $0.073**
  (re-asked the exact `claude-opus-4-8` v1 judge with one atomic per-class question on the 5 false-PASS turns
  → **5/5 flip the atomic answer to "yes"**; honest nuance: only 1/5 also flipped the *holistic* bug_class —
  which is the whole point: the judge SEES the contradiction when directed at the axis, but its vibe/crunch/rag
  verdict never asks → **the axis-omission root is confirmed, not information-starvation**) · **P-D PASS**
  (honest floor 9→14/48, ≈ +⅓ under-report). Suite green (doc-only; U381 pre-existing server flake noted).
- **infra fix (Basecamp, this integration):** worker's `isolation:worktree` was 886 commits stale (branched
  from `main`); it worked/committed in the MAIN checkout (clean result on top of HEAD, unpushed, verified —
  but a race hazard). Root-caused + closed: the `dispatch` SKILL trailer now mandates
  `git reset --hard origin/v2-polish` as the worker's FIRST step. See [[project_worker_worktree_stale_from_main]].
- **objective:** run P1 over the four JSONLs; hand-review every flag (prose+canon side-by-side, confirm/FP);
  score P-A/P-B/P-D explicitly (P-C ≈ 5 judge calls — run same sitting, record in `scripts/budget.mjs`);
  commit `docs/playtests/COHERENCE_GATE_BASELINE_<date>.md` (existing-baseline shape) incl. the labeled flag
  set (becomes Tier-S's calibration corpus). **Headline prediction: Tier-D flags 4–7 turns the v1 judge PASSED
  on `gate-2026-07-03T11-45-…` (falsified if <2 flags or <60% precision).**
- **allowed_files:** new baseline doc; new `docs/playtests/coherence-modes.json` (`gate-modes.json` untouched).
- **invariants:** report the falsified parts AS falsified — the prediction is the point, not the vindication.
- **done_when:** baseline committed with confirmed/FP tally per class + the P-A/B/C/D scorecard.
- **rollback:** n/a (a report).

#### CG-P3 — standing-gate integration  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`162680c`; --coherence prints the honest floor, additive, $0 dry-run verified)**
- **what landed:** `dm-playtest.mjs` `--coherence` now runs BOTH tiers over the just-written JSONL — the
  transcript auditor (unchanged) + CG-P1's state checker (imported in-process via its exported
  `loadJsonlFile`/`runCoherenceGate`/`summaryLine`, no shell-out). Output gains a `## Coherence
  (state-grounded)` section + the combined **HONEST FLOOR (judge ∪ transcript ∪ state-grounded, de-duped)**
  line; CG-* counts append to the namespaced `coherence-modes.json` via new `updateCoherenceModesLedger()`
  (gate-modes.json untouched — asserted in U391). **Un-flagged path byte-identical** (U391 asserts it); flag
  ADDITIVE (exit code unchanged — honest floor informs, not a hard gate yet). `--dry-run --coherence` = $0,
  verified live by Basecamp. Suite 9530/0, convergence 100%. First worker under the fixed dispatch protocol
  (reset to origin/v2-polish, clean worktree commit). **No version bump — gate tooling, live build v0.28.1.**
- **objective:** `--coherence` on `dm-playtest.mjs` runs both tiers over the just-written JSONL; report gains a
  "Coherence (state-grounded)" section + the honest-floor line (`|judge fails ∪ coherence flags|` de-duped)
  beside the headline; CG modes accumulate in `coherence-modes.json` (namespaced — never into `gate-modes.json`,
  Chao1 granularity).
- **allowed_files:** `scripts/dm-playtest.mjs` (the existing `--coherence` block only), `scripts/coherence-gate.mjs`,
  its tests (+ extend the U330-style dry-run structural test).
- **invariants:** default gate byte-identical when the flag is absent; flag stays ADDITIVE (exit code unchanged —
  honest floor *informs*; promotion to a hard gate is Tim's call after P2).
- **done_when:** `--dry-run --coherence` exercises the full path for $0; a real run prints the floor.
- **rollback:** flag reverts to the transcript-only auditor.

#### CG-P4 — bundle enrichment: exits + clock  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`928143a`; v0.28.2 build 052; worldHash byte-identical)**
- **what landed:** `buildCanonGroundTruth` (`engine/ref/rubric.js`) gains `roomExits` (from topology's
  existing `interiorExitsFrom` + roomDetail names — no new topology) + `clock` (mirrors gracefulAdjudication's
  `world.time.hours` math — one clock, not a second invented one), both try/catch-guarded. Bundle +103 chars
  (922→1025, stays compact — the live Ref judge reads it too). `coherence-gate.mjs` gains CG-2b (invented
  exits/stairs/doors) + CG-6 (time-of-day) comparators, dormant on old JSONLs lacking the fields (graceful
  degradation proven at real-file level — CG-2b/CG-6 = 0 on all 4, existing counts unchanged). Tests U392 (7,
  bundle view) + U393 (10, comparators). **Determinism: worldHash byte-identical, U19/21/22/27/30 green;
  suite 9547/0, convergence 100%.** Version bumped (touches `engine/ref/` in the live narration-review path
  via `reviewNarration`, so the live Ref judge is now better-grounded — a latent improvement).
- **note:** the new CG-2b/CG-6 checks fire only on JSONLs written AFTER this (existing gate transcripts
  predate the fields) — the next real gate run is their first live exercise.
- **objective:** extend `buildCanonGroundTruth` with (a) the current room's real exits/adjacent rooms (topology
  view CG-2b needs to catch invented stairways at the source) + (b) clock/timeOfDay (CG-6). Read-only view over
  existing state — the ROM-3 precedent (no mutation, no RNG, no worldHash exposure). Consume the fields in
  `coherence-gate.mjs`.
- **allowed_files:** `engine/ref/rubric.js`; `scripts/coherence-gate.mjs`; tests.
- **forbidden:** `engine/state.js`, `WORLD_VERSION`, any mutation path, `playloop.js`.
- **invariants:** worldHash untouched (view-only, assert via determinism suite); bundle stays compact (judge
  reads it too — token budget); old JSONLs without the fields still parse (checks degrade gracefully — P-B's
  negative control).
- **done_when:** new fields in fresh JSONLs; CG-2b/CG-6 comparators activate; `npm run check` green.
- **rollback:** revert the rubric view additions; comparators auto-dormant (fields absent).

#### CG-P5 — Tier-S span extraction  ·  Phase 0  ·  **QUEUE (only after P2 proves Tier-D precision); hot-file-free; paid, opt-in** (Sonnet lane)
- **objective:** `--extract` on `coherence-gate.mjs` — cross-family small-model (Haiku-class) transcription of
  presence/place spans ONLY (terse schema, no CoT, model never sees canon); comparison stays in code; calibrate
  paraphrase-invariance against P2's labeled corpus; report Tier-D∪S delta.
- **allowed_files:** `scripts/coherence-gate.mjs`, tests (mock provider — hermetic), `docs/briefs/` calibration note.
- **invariants:** OFF by default; budget-gated (`scripts/budget.mjs` before/after); extractor output is a
  PROPOSAL — a span that fails canon lookup is a disagreement report, never a flag by itself; INT-2R
  schema-terseness lesson binds (re-benchmark after ANY prompt edit).
- **done_when:** measured recall gain over Tier-D on the labeled corpus with precision held ≥80%; cost/run
  documented. **If recall gain is negligible — RETIRE the tier and say so** (SOBRIETY: deterministic-only is a
  fine end state; don't gold-plate the judge we designed out).
- **rollback:** remove the flag.

#### CG-P6 — unification + the meter  ·  Phase 0  ·  **QUEUE (last); mostly hot-file-free** (Sonnet lane)
- **objective:** merge the transcript auditor (C1–C5) + the state checks into one instrument + one report;
  retire transcript detectors the state version strictly supersedes (C1→CG-1b where bundles carry rooms; keep
  the transcript form for pre-ROM-3 files + words-vs-words seams like C5); extract ONE shared claim-lexicon
  module consumed by both `coherence-gate.mjs` and `engine/harness/oracles.js` (closes the CG-P1 copy); publish
  the standing **desync-rate meter** per class and wire the word "playable" to it in `HARNESS_USAGE_STRATEGY.md`
  + this file.
- **allowed_files:** `scripts/coherence-gate.mjs`, `scripts/coherence-audit.mjs`, `engine/harness/oracles.js`
  (lexicon import only — coordinate with the harness lane), the two docs, tests.
- **invariants:** U336/U337 regression locks stay green or are consciously superseded with equal-or-better
  locks; live-harness oracle behavior unchanged (lexicon extraction is a pure refactor, proven by its tests).
- **done_when:** one command, one report, one meter; duplicate detectors retired; both consumers on the shared
  lexicon.
- **rollback:** keep the two instruments separate (they work independently by construction).
- **PARTIAL DONE (2026-07-03, via CG-LIVE-1):** the "one shared comparator core" half of the unification is
  already landed — CG-LIVE-1 extracted the Tier-D comparators VERBATIM out of `scripts/coherence-gate.mjs`
  into a neutral pure module `engine/coherence/checks.js` (imported by BOTH the CLI checker, which re-exports
  them so U388–U393 stayed byte-identical, AND the live shadow observer). Still open for CG-P6: merging the
  transcript auditor C1–C5 into the same instrument, retiring superseded detectors, the shared claim-lexicon
  with `engine/harness/oracles.js`, and the standing per-class desync-rate meter.

> **CG-3 full lock-state check stays declared BLOCKED on the Interior Object Model** — when IOM lands per-object
> state in the bundle the comparator is a one-liner; **do NOT build a pseudo-object-model in the checker to fake
> it earlier.** **Deliberately NOT in this plan:** pushing these comparators into the live Ref path as a runtime
> pre-ship check (natural endgame — the desync pointer *is* a REGENERATE trigger — but it sits on the hot
> narration path, costs latency, and is a taste/product call; queue for Tim only after P2 proves the FP rate is
> boring).

#### CG-LIVE-1 — the checker becomes the fix: shadow-mode coherence observer on the live narration path  ·  Phase 0  ·  **✅ DONE 2026-07-03 (`7898386`; v0.28.3 build 053; default-OFF byte-identical, proven 3 ways)**
- **what landed:** comparator core extracted to `engine/coherence/checks.js` (script re-imports, CLI + U388–U393
  byte-identical; lands CG-P6's "one shared core" half early); `engine/coherence/shadowObserver.js`
  (`observeCoherenceShadow`, flag-gated `COHERENCE_SHADOW=1`, default OFF); +10-line hook at
  `llmAdapter.js:1394`; `--shadow <jsonl>` review mode. **ALL comparators run live** (CG-2c relocation too, via
  a module-level `PREV_CANON` Map keyed by session — bounded 512, NEVER on `world`). **Default-OFF
  byte-identity proven 3 ways** (observer null + no log; narration char-identical on/off; worldHash identical
  before/after even flag-ON incl. two-turn path). Never throws to caller. Determinism 313/313; suite 9556/0;
  convergence 100%. Tests U394 (5) + U395 (4). Version bumped — touches `engine/`, inert by default.
- **NEXT — CG-LIVE-2 (Tim's go, after reading live shadow data):** run `COHERENCE_SHADOW=1` on real/gate play,
  read the live FP-candidate rate via `--shadow`; if boring, flip the observer to an actual REGENERATE trigger
  in `reviewNarration` → the caught-bug class starts self-healing.
- **✅ UNBLOCKED 2026-07-04 (v0.28.4, `3bd75c6`+`a59f584`):** the v0.28.3 gate's "live shadow 0 vs retroactive 5"
  divergence is diagnosed + fixed, two roots. (1) The "live 0" was a **phantom** — the observer never executed
  (empty `coherence-shadow/` dir; it logs one record/turn when flag ON). Root: the :5179 gate server wasn't
  started with `COHERENCE_SHADOW=1`. **Proven** the observer fires CG-1b correctly on the real tallow start-state.
  Guard added: `--shadow` on a 0-record log now prints "observer did not run" + `observer_ran=false`, not a
  misleading 0%. **So CG-LIVE-2's precondition is simply: launch the gate server with `COHERENCE_SHADOW=1`.**
  (2) The disputed canon was corrupt — `roomExitsGroundTruth` (rubric.js) named exits via raw id-hash
  `buildingTypeFor` → a cottage's exits read as hive rooms ("Brood Cell"/"Hive Mouth") while the current room
  was "Bedchamber". Fixed to `st.buildingType || buildingTypeFor(id)`. Empty `roomOccupants` for a wake-alone
  Bedchamber is plausibly correct → the CG-1b ghost-voices are likely REAL catches, not artifacts.
- **✅ LIVE-VERIFIED + repositioned 2026-07-04 (v0.28.5, `c7676cf`):** ran the gate server with
  `COHERENCE_SHADOW=1` for real (5 slices / 58 turns). New finding: even with the flag ON the observer fired
  **0** where the retroactive checker fired N — a GENUINE divergence (not the flag). **Root, proven with the new
  instrument:** the observer ran on the **pre-Ref candidate**, but the player + retroactive checker see the
  **post-Ref** narration. The Ref regenerate rewrites a coherent "the bedchamber is empty, no record here" into a
  helpful-but-ghost-voiced "Elske Nightherd shrugs, 'Can't say'". **Fix:** observe `await reviewNarration(...)`
  (the final prose), and log `dm`+`evaluated` in the shadow record. Live result: CG-1b fire **0 → 2/3** of the
  retroactive catches on the same play. **CG-LIVE-2 is now genuinely measurable.**
- **⚠️ TWO FOLLOW-UPS this exposed (queue before flipping CG-LIVE-2 to regenerate):**
  - **CG-LIVE-1b — the base-narration blind spot:** when the Tier-1 validator REJECTS the LLM candidate,
    `augmentNarration` returns `base` **before** the observer line (`llmAdapter.js` `if (!ok) return base;`), so
    those turns log NO shadow record and their desyncs bypass the observer (the missed 1 of 3 above; the run1
    terse "Elske shrugs" base lines). Fix: run the observer on whatever text `augmentNarration` actually returns,
    at every return path — small, and required for CG-LIVE-2 to self-heal the full class.
  - **REF-GHOST — the Ref regenerate MANUFACTURES ghost-voices:** the Ref, trying to answer a pointed question the
    coherent candidate dodged, regenerates prose that voices a settlement NPC who is NOT in the player's room
    (`roomOccupants` empty) — overriding a *correct* engine narration with a hallucination. Related
    [[project_dm_invents_geography]] at the narration layer.
- **🧭 DECISION 2026-07-04 (Tim) — the Ref comes OUT; do NOT "fix" REF-GHOST.** The Ref was scaffolding for the
  OLD system. We test the NEW system — LLM ears (intent) + authoritative engine + one narration pass — *by itself*
  first; a third governing LLM that re-writes the output compounds failure (REF-GHOST is that in miniature: an LLM
  overriding a correct engine result). **Config: `REF_ENABLED=0` in `.env`** (server default stays ON; revert =
  delete the line). So REF-GHOST is now MOOT while the Ref is off — it's *evidence for removal*, not a fix-packet;
  don't invest in constraining the regenerate. The A/B that informed this (chaos+lore-hound ×16/arm): REF-off = 0
  coherence flags / honest floor 2/16; REF-on = 1 flag / 6/16 — worse on both axes in-sample (small n; a principle
  call, not an empirical toss-up). **What to improve instead, at the engine/narration layer:** the base DM's
  dead-ends (2/16 even REF-off) — answer pointed questions in the fiction without conjuring an absent speaker.
- **CG-LIVE-2 status:** the observer is now correctly positioned (post-Ref) + instrumented, but its self-heal
  premise assumed the Ref's regenerate path — reassess once the Ref-off new-system baseline is felt. CG-LIVE-1b
  (base-narration blind spot) still stands if we ever want the observer to see validator-rejected turns.
- **why now:** the deterministic desync pointer that *grades* a turn can *trigger a regenerate* on the live
  path — one mechanism self-heals ALL caught classes (ghost-voice, wrong-room, invented-exit, phantom-commit,
  wrong-speaker), and every future class we teach the checker becomes self-healing too. The Ref already routes
  a REGENERATE (`engine/ref/index.js` `reviewNarration` → `regenerate()`), and CG-P4 already put
  exits+occupants+clock into the `canonOf(world)` bundle the Ref reads. **Shadow FIRST** (this packet): the
  100% precision is on HISTORICAL transcripts — measure the LIVE false-positive rate on fresh play before any
  narration is silently re-rolled (the INT-1 shadow-mode pattern).
- **objective:** a shadow observer that, gated by `COHERENCE_SHADOW=1` (**default OFF → byte-identical**),
  runs the deterministic single-turn-capable comparators over `(input, candidate, mechanics, canonOf(world))`
  at the narrate call-site (`engine/llmAdapter.js:1394`, where candidate+world+outcome are in hand) or an
  equivalent hook **decoupled from the Ref's `enabled` (judge) flag** (the judge is off in normal play; the
  deterministic check is free and must still observe). It **LOGS would-be-regenerate desync pointers** (to a
  shadow jsonl `docs/playtests/coherence-shadow/*.jsonl` and/or the instrument trace) and **NEVER alters the
  returned narration**. A small review path (reuse the checker's report over the shadow jsonl) so we can read
  the live FP rate.
- **module boundary:** the comparators are exported from `scripts/coherence-gate.mjs` but engine/ must NOT
  depend on `scripts/`. Extract the pure comparator core into a neutral shared module (e.g.
  `engine/coherence/checks.js`) imported by BOTH the script and the live observer — this pulls CG-P6's core
  unification forward; note it against CG-P6. Run the single-turn-capable checks live (CG-1b, CG-2a, CG-2b,
  CG-3a, CG-5, CG-6, CG-0); cross-turn ones (CG-2c relocation) need a NON-canon prev-canon side-channel
  (module-level, never on `world` — worldHash sacred) or defer them to a later phase.
- **allowed_files:** `engine/llmAdapter.js` (the shadow hook at the call-site only) OR `engine/ref/index.js`
  (a shadow branch decoupled from `enabled`); new `engine/coherence/checks.js` (extracted pure comparators);
  `scripts/coherence-gate.mjs` (re-import the extracted module, CLI byte-identical); new shadow-log dir; tests
  **U394 (observer runs the checks + logs, narration returned UNCHANGED), U395 (default OFF = byte-identical +
  worldHash stable)**.
- **forbidden:** altering returned narration in ANY path; `WORLD_VERSION`; `state.js`; mutation; RNG; storing
  prev-canon on `world`; `playloop.js`/`escapeCombat.js`/`dialogue.js`/`grace/`/`composer.js` (hot files — the
  hook lives in the Ref/adapter layer only).
- **invariants:** default OFF byte-identical (assert); worldHash untouched (determinism suite); shadow path
  never throws to caller (Ref Invariant 3 — LLM/observer layer never breaks the turn); §0 never surfaced.
- **done_when:** `COHERENCE_SHADOW=1` logs desync pointers on real live turns while narration is provably
  unchanged; the review path prints the live FP-candidate rate; suite + determinism + convergence green.
- **rollback:** delete the observer + flag (the extracted module stays — it's just a refactor).
- **NEXT (not this packet):** CG-LIVE-2 = flip the observer to an actual REGENERATE trigger once the live FP
  rate is proven boring — Tim's go, after reading the shadow data.

### AG-4 — pointed questions answered in the fiction (the info-seek sink stops voicing database-misses through people)  ·  Phase 0  ·  **PARKED 2026-07-04 — brief STALE, re-scope before any dispatch** *(status reconciled 2026-07-05: the row said "dispatched" but the lane never ran — parked per Tim, map was the day's focus. Gate-2 found the dominant "no record" dodge cluster did NOT recur — NODE-DESYNC-1 dissolved it — and INFO-HONESTY b073 + ANS-2 b074 since banned no-record language at the delivery gate. Re-audit sub-fixes a/b/c against the current build before cutting a new brief.)*
- **provenance:** Tim's 2026-07-04 Ref-pull decision ("what to improve instead: the base DM's dead-ends — answer
  pointed questions in the fiction without conjuring an absent speaker") + the v0.28.3 gate's dominant cluster
  (5 of 9 fails, `opus-gate-2026-07-04.md`; NB that run was Ref-ON, which inflated the count — but the class
  survives Ref-off: 2/16 base dead-ends in the A/B, and the dodge lines are ENGINE-side). Root traced at the
  2026-07-04 boot: the dodge prose is the deterministic `declineInfoSeek` bank (`engine/playloop.js:7525–7545`),
  not the LLM. Brief: `docs/briefs/AG-4-pointed-questions.md`.
- **objective:** three sub-fixes at the info-seek seam:
  **(a) self-questions ground on the NPC herself** — a question about the addressed NPC's own identity/role/
  claims ("which caravan do YOU speak for?") delivers from her own modeled state (role/tenure/faction — NBIO-1
  precedent) or declines IN HER VOICE with an in-fiction reason; "no record" language is banned for
  self-questions (a person is not a filing cabinet);
  **(b) sensory probes never enter the info sink** — "I dip a finger in the water — cold or slimy?" is a
  physical read of present matter → truthful world-grounded sensory answer (honest-search sibling `baf1b51`;
  DS-1a definite-read precedent), never an NPC shrug;
  **(c) decline escalation is per-topic, not per-NPC** — a FRESH question never draws "the subject is closed";
  only repeat-pressing the same dead topic escalates.
- **allowed_files:** `engine/playloop.js` (info-seek seam only), new/updated tests, corpus locks (+ relock any
  row asserting the old dodge — DLG-1/C16-001 relock precedent; document each).
- **forbidden:** inventing canon facts (C9 rail — refusal reasons and sensory color commit NO new names/records);
  `WORLD_VERSION`; rng; `dialogue.js`/`grace/` (STOP and flag if seemingly needed — serial lane).
- **invariants:** determinism U19/21/22/27/30 (⚠️ if press-counts are re-keyed in world state, replay hash
  equality must survive — see brief); convergence 100%; LLM-off repro FIRST (bug protocol).
- **done_when:** the quoted gate utterances produce in-fiction answers/refusals LLM-off; no "no record"/"subject
  closed" on self-questions or first-time topics; sensory probes get sensory answers; `npm run check` green;
  patch version bump; changelog + this row updated.
- **rollback:** revert the single commit.

### PERC-1 — a failed perception read renders uncertainty, never a confident accurate report  ·  Phase 0  ·  **✅ LANDED v0.28.16 b066 (logic `4e644dc6`→`42be6179` + wiring `13010c64`→`822960a0`; U448–U449 16/16; fence held end-to-end)**
- **C23 corpus rows stay `status:'target'` (NOT locked) — honest finding from the wiring lane:** only
  roll-path phrasings reach the hedge; "I glance up / I peer up / …I check" paraphrases are intercepted
  UPSTREAM by `isExploreIntent`'s free-look (no dice ever rolled), and one row resolves `mixed` (hedge
  correctly fail-only). The gate's exact case (real roll, real failure) is fixed and tested.
- **FOLLOW-UP (small, queue): PERC-1c** — decide the free-look seam: a hazard/condition RECHECK
  ("is the fire still burning? I check") probably shouldn't be a free confident look — either route
  perception-recheck intents past `isExploreIntent` to the roll path, or accept free-look-as-canon-read
  and re-phrase the C23 targets to roll-path phrasings. Taste + blast-radius call; playloop/grace
  serial lane. Then promote C23-001/002 to `locked` (124→126).
- **signal:** 2026-07-04 gate (Chaos-griefer): "is the ceiling still on fire? I look up." rolled **1 vs DC 13**
  yet narrated a definitive, ACCURATE all-clear ("plain wattle-and-daub… no trace of flame"). A crit-fail
  perception must not read as authoritative truth — render doubt/incompleteness ("smoke-haze and lamplight;
  you honestly can't tell from here"), and never plant a FALSE fact (uncertainty ≠ misinformation; narration
  must not contradict canon).
- **seam found:** `engine/playloop.js`'s `grounded ||` chain (~line 3656, inside `playerMoveCore`) — the
  SAME chain `nonObjectSkillOutcome`/`infoExtractionOutcome`/`answerOrDeclineQuestion` sit in. The exact gate
  text escapes `isExploreIntent`'s free-survey branch (starts with "Wait —", not "is/are"), escapes
  `isInfoSeekingText` (lore-fact demands only) and `isQuestionShaped` (no trailing `?`, no interrogative
  opener), rolls a REAL `resolveMove()` (`approach:focus`, the untagged-verb default), then falls to the
  composer/`genericGroundedOutcome` floor — which has NO look/perceive bucket at all, so a leading "Wait —"
  false-positives into the `wait` bucket, or (with LLM polish riding on top in the live gate) the model
  invents a specific, confident, ungrounded claim. `engine/structures/roomState.js`'s room model carries
  **no fire/hazard/structural-damage field whatsoever** — canon is silent either way, so ANY confident
  verdict (positive or negative) is an invention. NOT the honest-search success branch (`baf1b51`) — read
  first, extended its grammar (kept as a sibling, untouched; regression-guarded by U449-04).
- **landed (logic + tests + corpus, no playloop.js edit — fenced this session):**
  `isPerceptionRecheckIntent` + `hedgedPerceptionRead` (both new, `engine/grace/gracefulAdjudication.js`) —
  a FAILURE-ONLY deterministic floor scoped tight to untracked environmental/structural condition rechecks
  (ceiling/roof/walls/floor/smoke/fire/flame/scorch + a bare overhead glance), so it never shadows tracked
  canon (lockState, NPC presence, object presence) or sibling capabilities (search/explore). Distinguishes a
  genuine crit-fail (`rawDie===1`, preserved on `resolveMove`'s `result.rawDie`) from an ordinary miss with a
  MORE-disoriented (but still never-confident-either-way) hedge. Companion LLM-polish safety net added to
  `validateNarrationCandidate` (`engine/llmAdapter.js`) mirroring the pre-existing fled-foe guard (U245) — a
  polish candidate asserting a confident verdict over a hedged base is rejected, falls back to the honest
  base. **Playloop wiring is a 2-line patch** (import extension + one `||` chain insertion) delivered as an
  exact patch block in the worker's report — apply once the `playloop.js` fence lifts, then promote
  `tests/corpus/C23.corpus.mjs`'s two `status:'target'` rows to `'locked'` (verified end-to-end against a
  scratch-patched copy: crit-fail seed renders the hedge, ordinary-fail seeds hedge, honest-search success
  and explore/window paths all unaffected).
- **done_when:** ✅ failed/crit-failed perception over real canon renders hedged reads LLM-off (proven via
  direct unit tests + a scratch-patched end-to-end dry run) · ✅ corpus lock added (`C23`, `target` status
  pending the patch) · ✅ suite + convergence green (124/124 convergence, 9773/9773 suite, determinism
  U19/21/22/27/30 green, `playtest:quick` 0/0). Remaining: land the 2-line playloop.js patch, promote C23 to
  `locked`, re-run convergence to confirm 126/126.

### SL — THE SHIPPABLE SLICE (priority, scope-locked 2026-06-29)
**Provenance:** Tim's 2026-06-29 scope re-lock (`docs/DEMO_REGION.md` scope-lock banner). The demo is cut to
ONE walkable ~100 km² region with four authored places: a town, a forest (bandits roam), a bandit camp, and
a haunted-chapel dungeon ~2 km from town. The DEMO_REGION bible's 5-town / orb / cannibal / COUG apparatus is
deferred to the campaign. Per `docs/SOBRIETY.md`: ship ONE bounded module — finish, don't expand.
**Build order:** SL-1 (skeleton) → SL-2 (town) → SL-3 (chapel dungeon) → SL-4 (woods + camp).
**✅ LIVE 2026-06-29:** all four packets done; `public/v1.js` now boots the slice by default
(`seed: 'aldermere'`). The richer 8-town `tallow` demo stays reachable by typing it in the seed field.
End-to-end verified in Node (town → woods bandits → camp captain duel → chapel undead; no soft-lock) and the
live page boots clean (zero console errors). Standing polish backlog: see SL-2/3/4 "deferred" notes.

#### SL-1 — curated demo region skeleton  ·  **Status: ✅ DONE 2026-06-29** (Basecamp, autonomous)
- **landed:** new `engine/world/sliceRegion.js` (authored 4-node region: Aldermere · The Greenwood ·
  Crowfoot Camp · The Hollowed Chapel — names provisional/re-skinnable) on its own fixed seed
  `SLICE_SEED='aldermere'`; routed at the REAL map-gen seam `newWorld` (`engine/state.js`, **not**
  `beginAdventure` — `newWorld` pre-generates the map) + a mirror fallback in `beginAdventure`. Test
  `tests/U300` (7/7). **Verified:** `npm run check` GREEN — convergence 109/109, suite **8987/0**
  (determinism U19/21/22/27/30 in), `playtest:quick` 0 crashes/0 bugs. Opt-in proven: `tallow` still
  yields 34 nodes (untouched). Live `v1.js` invoke still points at `tallow` — flip to the slice deferred
  until SL-2 populates the town (Tim accepted "town unpopulated until SL-2").
- **objective:** Replace the procedural scatter (`generateInitialMap`, 24–39 ring+chord nodes) with a
  **hand-authored four-node region** for the demo: Town (settlement/village) · Greenwood/forest (wilderness) ·
  Bandit Camp (settlement 'camp', hostile) · Haunted Chapel (landmark surface → dungeon_entrance interior).
  Real tile positions so chapel reads as "a couple km from town"; deterministic by seed; player starts in town.
- **allowed_files:** new `engine/map/demoRegion.js` (the authored `{nodes, edges, discovered, currentNodeId}`
  in `generateInitialMap`'s return shape); `engine/playloop.js` (**minimal** conditional at the `beginAdventure`
  map-gen seam, ~line 206 — keep the hot-file footprint tiny); new `tests/U###.demoRegion.test.js`.
- **trigger (resolve at impl):** opt-in so the generic `fantasy` procedural path (used by determinism tests)
  is UNTOUCHED — likely a pack/sub-region flag (`pack.curatedRegion` / a `westmarch_slice` id), not the bare
  `fantasy` default. Verify which pack the live demo boots before wiring.
- **forbidden:** changing `generateInitialMap`'s procedural output for non-demo packs; `Math.random` (rng.js
  only); direct state writes (mutate via the map shape only); breaking `assertMapStructure`.
- **invariants:** determinism — same seed → same region → stable `worldHash` (U19/21/22/27/30 stay green);
  `assertMapStructure` passes; start node is a settlement.
- **test_plan:** unit — region has exactly the 4 typed nodes, deterministic across two builds, chapel↔town
  distance > town↔forest; full suite + determinism gates; `npm run check` GREEN; `playtest:quick` clean.
- **done_when:** demo boots into the authored 4-node region; player wakes in town; `npm run check` GREEN;
  determinism untouched for non-demo packs.
- **rollback:** delete `demoRegion.js` + revert the one `beginAdventure` conditional.

#### SL-2 — the town (populate + plot-and-parcel)  ·  **Status: ✅ SATISFIED by existing systems 2026-06-29** (Basecamp, verified-not-built)
- **finding:** Aldermere is ALREADY real via the generic genesis — no rebuild needed (SOBRIETY: don't build
  what exists). Verified live on the slice seed: the town wakes with named, role-differentiated NPCs
  (*Senna the Fox · Galen the artisan · Brogan the laborer · the Lingerer*) **plus an auto-seeded hostile
  "stranger who keeps to the edges, watching"** (the `ensureHostileNpc` bandit — already foreshadows SL-4);
  conversation works ("I greet Galen…" → approach + natural deflection); `stgen:v27` buildings generate; the
  `generateBuildingPlots` sample placed 10 buildings with **0 gross collisions**.
- **deferred (NOT gold-plated now — neither blocks a walkable slice):**
  - **DX-4 plot-and-parcel rigor** (footprint non-overlap / door-facing / fortify-by-danger in
    `engine/map/spatial/buildingPlots.js`) — a separate large deterministic-geometry packet (S3-gated); the
    slice doesn't visibly suffer church-clips-inn yet because it isn't rendering town building footprints.
  - **Slice-specific town CHARACTER** (NPC concerns/rumors that point at the bandits + the haunted chapel, so
    the four nodes cohere into a module) — authored + taste-laden → **Tim's call**, surfaced not auto-built.

#### SL-3 — the haunted-chapel dungeon  ·  **Status: ✅ DONE 2026-06-29** (Basecamp, autonomous)
- **finding + landed:** The engine ALREADY builds a real multi-level dungeon for any `dungeon_entrance`
  node (`generateDungeon` → the chapel gets 3 levels / 4 encounter rooms, explorable, CR-graded). So SL-3 is
  THEMING, not construction (SOBRIETY). Added an optional `theme` PREFERENCE to `selectCreatures`
  (`engine/combat/encounterSpawn.js`) — a themed location prefers creatures whose `tags` include it (undead
  first biome-native, else any in-CR undead, else fall back) — plus a pure exported `creatureThemeForNode`
  (`engine/playloop.js`): a `haunted`-tagged node → `'undead'`. Threaded through both dungeon spawn points
  (the room-fight at the live escape path + the scene-encounter path). The Hollowed Chapel's `haunted` tag
  now draws **Hollow Husks** (CR⅛) and **Pilgrim Shades** (CR1) instead of generic dungeon fauna — the
  diegetic §3 symptom ("the recently dead don't stay dead"), never explained (§0). Test `tests/U302` (6/6).
- **verified:** `npm run check` GREEN — convergence 109/109, suite **8999/0** (determinism in — `theme=null`
  is byte-identical to the un-themed call, so every non-chapel spawn is unchanged), `playtest:quick` clean.
- **deferred polish:** haunted ROOM PROSE (the dungeon look/telegraph lines stay generic; the LLM DM narrates
  atmosphere from the chapel's name + the undead) and undead-specific loot — narration/taste, not skeleton.

#### SL-4 — the woods + bandit camp  ·  **Status: ✅ DONE 2026-06-29** (Basecamp, autonomous)
- **landed:** Tagged the slice nodes (`engine/world/sliceRegion.js`): **The Greenwood `bandits`** (bandit
  country — a CHANCE of a brigand standoff when traveled) and **Crowfoot Camp `banditCamp`** (a stronghold —
  arriving ALWAYS confronts the captain + crew). Taught the LIVE escape travel-encounter path the tags via a
  pure exported `brigandNodeKind(node, biome)` (`engine/playloop.js`); a `banditCamp` node bypasses the
  chance roll; the camp's "fight" spawns a **Bandit Captain (hp9/ac13) + Bandit** band (vs the road's single
  brigand), and the standoff scene reframes for a camp (no "toll"). Root fix in `engine/state.js`: added
  `band` to the `travel.pending` whitelist (the [[ensureCombat-strips-fields]] pattern — it was silently
  stripped). Test `tests/U301` (6/6) + `U100` road-encounter regression (8/8).
- **why not encounters.js:** the rich `forest` biome tables in `engine/ruleset/core/encounters.js` are the
  STRUCTURED-combat path; `v1.html` runs the escape engine, whose travel encounters are the brigand standoff
  (pay/talk/slip/fight) + `spawnTamedAmbush` (the two-engines trap, [[project_two_combat_engines]]). SL-4
  wires bandits onto the LIVE path, reusing that standoff — richer than a raw table roll.
- **verified:** `npm run check` GREEN — convergence 109/109, suite **8993/0** (determinism U19/21/22/27/30
  in — the chance-roll order is preserved for every non-camp node), `playtest:quick` 0 crashes/0 bugs.
- **rebalanced (live-verify):** the camp's captain+crew pair was a measured **50/50 coin-flip** at escape's
  12 HP under the DX-2c flank — unfair for a climax. Now a **solo captain duel** (hp6/ac11/dmg3): a careful
  full-HP player wins **~100%** (30/30 sweep, ~5 HP left), but it costs ~7 HP, so arriving wounded or pushing
  straight into the chapel undead after stays dangerous. Multi-foe DX-2c pressure lives in the chapel undead.
- **deferred polish:** a cleared camp re-confronts on re-entry (no "cleared" state yet); the camp captain is a
  tuned escape-HP foe, not the full bestiary `bandit_captain` (escape balance); the camp scene still routes
  through the brigand standoff (pay/talk/slip reframed as bribe/talk-down/slip — coherent, not a tollgate).

---

### QS — Pre-rolled heroes (one-click playthrough start)  ·  **Status: ✅ DONE 2026-06-29** (Basecamp)
**Provenance:** Tim 2026-06-29 — "a set of pre-rolled characters I can just start the game with" (the recurring
chargen-friction pain point). **Landed:** new `engine/chargen/preRolled.js` — a roster of 5 ready-made heroes
(Bryn Holt/Sellsword · Wrenna Vale/Outrider · Father Oswin/Hedge-Priest · Mim Cobble/Cutpurse · Dame
Aldith/Knight-Errant), each built deterministically via `createCharacter` (full inventory/traits/id) with a
themed stat override + `FANTASY_STARTER_GEAR`. `public/v1.js`: a front-door picker ("Or jump straight in as a
ready-made hero") + `beginFromPreRolled(entry)` (mirrors `beginFromChargen`, injects the PC, slice seed,
escape mode) — one click → in Aldermere, no wizard. Test `tests/U303` (5/5). **Verified live:** picker renders,
clicking Bryn Holt drops into the slice as Bryn (MIGHT 14/…/GRIT 13, HP 15/15, kitted), zero console errors.
`npm run check` GREEN — suite **9004/0**, determinism in. Version **v0.5.0 / build 008**.

### ML-1…ML-3 — Multi-LLM layer cleanup (from the 2026-06-27 Codex architecture review + Homebase verdicts)
**Provenance:** Codex read-only audit of the multi-LLM lanes (verified accurate against code by Homebase).
Three actionable items survived the verdict; the rest (an `AiTask` rebuild, "same pipeline everywhere",
external structured memory, lighting up the NPC brain as a live decision-maker) were **deferred or
rejected** — the dark lanes (`queryBrain`, `extractMemoryWithLlm`, async `evaluatePhysics`) stay dark by
design because a live non-deterministic LLM decision would break deterministic-by-seed (U19/U21/U22).

### ML-1 — `validateNpcVoiceCandidate()` — close the NPC-voice fabrication hole
**Status:** ✅ DONE 2026-06-27 (`9fc3ac9`; test U294, 13/13). Guards: invented mid-sentence proper
noun (reuses `findInventedProperNoun` + `COMMON_CAPS`), ungrounded 4-digit CE year, `withheld` factPhrase
leak; fails OPEN on throw. Gates both Opus + Ollama paths. **Known boundary:** spelled/digit *counts* are
not guarded (only years) and `claim_recall` name-distortion can over-reject to template — acceptable, lean.
**Status (orig):** OPEN — the one real correctness gap. `/api/narrate` has a ~500-line validator
(`engine/llmAdapter.js:447`); `/api/npc-voice` has only a length fence (`server.js:340`), and Opus is now
the **primary** voice (`server.js:318-324`) — so an NPC can invent a name/number/date and it ships.
- **model:** Sonnet (clear spec, additive, assembled from existing exports). Optional Opus follow-up = a
  false-positive calibration sweep over good gate-transcript voice lines.
- **objective:** a deterministic fabrication guard on NPC voice output — reject invented proper nouns /
  numbers / dates not in the grounding set; enforce the cheaply-checkable mode constraints; gate BOTH the
  Opus and Ollama return paths. **Lean guard, not a second 500-line wall.**
- **allowed_files:** `engine/llmAdapter.js` (add `validateNpcVoiceCandidate`, reuse the exports below);
  `server.js` (wire both `/api/npc-voice` return paths); new `tests/U###.npcVoiceValidator.test.js`.
- **reuse_map:** `findInventedProperNoun(cand, groundedNouns)` (`:361`) + `collectGroundedNouns`/`normNoun`
  (`:337`/`:335`) + `COMMON_CAPS` allowlist (`:316`). Build `groundedNouns` from the route's FLAT fields
  (`factPhrase`, `claim.eventDescription`, `substrateContext` labels, `ragChunks` text, `npcName`, `role`,
  `playerLine`) — there is NO `world` object at this route.
- **forbidden:** a new LLM call (fabrication is a checkable property — use set membership, not a judge);
  state mutation; throwing to the route (return boolean → client falls back to deterministic templates);
  over-rejecting `shared`-mode local color (the prompt explicitly allows invented small color).
- **invariants:** silent-fallback contract intact (never throws); narration ≠ canon; no world-shape change.
- **mode_constraints (only deterministically-checkable):** `withheld` must not contain the `factPhrase`
  content; `shared` allows local color (proper-noun/number guards are the limit); `claim_recall` distortion
  is intended (ground vs `claim.eventDescription`, don't flag drift). `deflected` "did it dodge"/tone =
  judgment-shaped → OUT OF SCOPE (leave for the REF; note it in code).
- **test_plan:** rejects an invented proper noun in `shared`; PASSES a grounded noun + ordinary local color
  (no false positive on common words); rejects an invented year/count; passes a vague quantity ("a few");
  `withheld` line containing the secret rejected; `claim_recall` distortion NOT flagged.
- **done_when:** `validateNpcVoiceCandidate` exported and gating both voice paths; new U-test + full suite +
  `npm run check` green; a fabricating Opus line now returns `ok:false` (template fallback shows).
- **rollback:** revert the validator + the two wiring lines (voice returns to length-only fence).

### ML-2 — Doc sync: reconcile LOCAL_LLM.md + WHAT_THIS_IS.md with the running system
**Status:** ✅ DONE 2026-06-27 (`9308112`). LOCAL_LLM.md voice-stack table corrected (Opus→Ollama→templates);
WHAT_THIS_IS.md gained the 🟢/🟡/🔴 Multi-LLM Lanes table + dark-lane determinism rationale; AGENT_CHANGELOG appended.
**Status (orig):** OPEN — two docs lie about reality; the status apparatus already half-exists.
- **model:** Sonnet (docs + cross-reference judgment; cheap).
- **objective:** `docs/LOCAL_LLM.md` "the local model never writes player-facing prose" is FALSE (Ollama is
  the NPC-voice fallback, `server.js:331-343`) — correct the contract to Opus-primary / Ollama-fallback /
  templates-floor. In `docs/WHAT_THIS_IS.md` add a 🟢/🟡/🔴 "Multi-LLM lanes" table.
- **allowed_files:** `docs/LOCAL_LLM.md`, `docs/WHAT_THIS_IS.md`, `docs/AGENT_CHANGELOG.md` (append-only).
- **lane_status:** 🟢 narration / REF / NPC-voice / intent-arbiter; 🟡 NPC brain (`dialogue.js:545` uses
  `fallbackRules`), LLM memory (`dialogue.js:736` uses `extractMemory`), async physics
  (`llmPhysics.js:291` `evaluatePhysicsSync`). **State the reason the 🟡 lanes stay dark: determinism.**
- **forbidden:** any code change; touching the still-true "local never decides canon" rule.
- **done_when:** both docs match verified line refs; `git status` shows only the three doc files.

### ML-3 — Centralize the "Opus 4.8 rejects `temperature`" quirk
**Status:** ✅ DONE 2026-06-27 (`89b5efa`; test U295, 8/8). New `engine/llmModelRules.js` —
`modelRejectsTemperature` (prefix `claude-opus-4`, fails toward omission) + `anthropicSamplingFields`; all
four call sites route through it; fixed the live `llmProvider.js` bug (was passing temperature to Opus → 400).
**Status (orig):** OPEN — the rule is scattered across comments + a hardcoded omission; `llmProvider.js:71`
`callAnthropic` passes `temperature` unconditionally (would 400 on an Opus route).
- **model:** Sonnet (surgical refactor, well-specced).
- **objective:** one source of truth for the per-model sampling quirk; all four Anthropic call sites consult
  it; zero behavior change for shipping Sonnet/Haiku calls.
- **allowed_files:** new `engine/llmModelRules.js` (or top of `engine/llmAdapter.js`); `engine/llmAdapter.js`
  (`callLLM:238`, `callNpcVoice:275`, `callDM:1595`); `server/llmProvider.js` (`callAnthropic:71`); a unit test.
- **forbidden:** merging the two Anthropic clients (the OpenAI victory-gates path coexists by design —
  CLAUDE.md); behavior change for non-Opus calls.
- **api:** `modelRejectsTemperature(model)` (Set/prefix, not a one-off compare) + optional
  `anthropicSamplingFields(model, temperature)`.
- **test_plan:** assert the request body (via the existing `fetchImpl` injection) OMITS `temperature` for an
  Opus model and INCLUDES it for a non-Opus model.
- **done_when:** single source of truth; all four sites route through it; suite + `npm run check` green;
  existing Sonnet/Haiku request bodies byte-for-byte unchanged.
- **rollback:** revert the predicate + call-site edits (restores the scattered handling).

### VG — Visual Map Gate (the Map Nit player SEES the rendered map) ✅ BUILT 2026-06-27 (`33b9658`)
**Status:** ✅ tool shipped. `scripts/dm-playtest-visual.mjs` drives the real `public/v1.html` in a
Node-owned browser (puppeteer devDep — no browse-daemon session ceiling); a multimodal Opus PLAYER
(Map Nit) + JUDGE see the actual rendered map canvas each turn. Catches render-vs-state and
narration-vs-map divergence the headless `dm-playtest.mjs` is blind to. Disposable focused probe per
[[feedback_focused_gates_when_needed]] — NOT added to the standing gate. Run:
`node scripts/dm-playtest-visual.mjs --turns 8 --server http://localhost:5179` (needs dev server + key).
Screenshots → `output/visual-map-gate/<stamp>/` (gitignored); report → `docs/playtests/visual-map-gate-*.md`.

### VG-F1 — Interior navigation incoherence (the root the visual gate surfaced; CRITICAL)
**Status:** ✅ DONE 2026-06-27 (`9821f0d`; test U280). Root cause confirmed: interior room moves didn't
sync `party[0].position.interior` (stale persisted/render position), and bare compass words ("east")
indoors leaked into generic overworld travel → `map.currentNodeId` jumped → structure teleport. Fix:
`moveWithinInterior` syncs party interior position via `applyDeltas` (`engine/structures/interiors.js`);
`playerMoveCore` blocks indoor compass-leak while preserving explicit travel phrases (`engine/playloop.js`).
**Homebase-verified:** full suite 8941/0 + determinism U19/21/22/27/30 green; **visual gate re-run 5/8→7/8,
location stayed "Wayfarers' Outpost" all 8 turns (was teleporting across 3 buildings).** Residual marker-
render gap split out to VG-F3 (renderer, out of this fix's engine scope). Original finding:
**Status (orig):** OPEN — first 8-turn run, report `docs/playtests/visual-map-gate-2026-06-27T15-24-32.md`.
**Forked diagnosis (engine-wrong, NOT render-wrong):** the DM narrates smooth room-to-room "walk east"
movement the engine does NOT perform. Engine ground truth shows the player either NO-OPing (pos frozen at
n6 `(0,9)` for turns 4–8 while the DM keeps narrating eastward steps) or being TELEPORTED between unrelated
structures (Wayfarers' Outpost `n3`→Beacon Tor `n1`→Crossway Village `n6`). The rendered map marker is
mostly FAITHFUL to engine state (frozen because the engine froze) — so this is the [[project_dm_invents_geography]]
root (DM narrates topology that doesn't exist → navigation soft-locks / scene-jumps), now with visual proof.
- **objective:** interior "go east/through the door" moves the player coherently within ONE structure (or the
  DM honestly reports no such exit) — no silent teleport to a different structure, no narrated movement the
  engine ignores.
- **suspect_files:** `engine/playloop.js` move/scene-transition path (the `newScene` auto-travel at
  `public/v1.js:789` fires on node change — confirm it isn't shuffling interiors); the interior topology +
  the DM prompt's geography grounding (see WHOLE_BUILDING_FINDINGS WB-Q1).
- **forbidden:** "fixing" the renderer/marker first — the marker is mostly truthful here; fork before patching.
- **done_when:** a fresh visual-gate run shows the marker advancing east when the player walks east, and
  the location name stable within one building.

### VG-F2 — Location-name drift across turns (secondary; same root)
**Status:** OPEN — same run. The place is named Wayfarers' Outpost, then Old Shrine, then Beacon Tor, then
Crossway Village across 8 turns. Partly real (the engine IS jumping structures — see VG-F1) and partly DM
invention. A transient render-vs-state blip also appeared at the scene jump (T3: engine inside `n1`, map
briefly drew an EXTERIOR building view while the DM narrated approaching from a treeline).
- **done_when:** VG-F1 fixed (stops the structure-shuffle) AND the DM names the current location from canon,
  not invention; re-run the visual gate to confirm name stability.
**Status:** ✅ RESOLVED 2026-06-27 by VG-F1 (`9821f0d`) — the structure-shuffle was the cause; visual-gate
re-run held "Wayfarers' Outpost" stable across all 8 turns. The transient T3 exterior-view blip is the
render-refresh issue now tracked as VG-F3.

### VG-F3 — Rendered map marker doesn't track room-to-room movement / lags on inside↔outside (RENDERER)
**Status:** OPEN — surfaced by the VG-F1 verification run (`docs/playtests/visual-map-gate-2026-06-27T19-48-20.md`).
With VG-F1 landed, the ENGINE now advances the room correctly (U280) and stops teleporting — but the
RENDERED marker still doesn't visibly move between rooms inside one structure, and on T8 the engine put the
player OUTSIDE on the road while the marker stayed drawn inside a building room (map_matches_state=false).
This is the [[map_marker_reads_v1_walk_pos]] renderer concern, NOT engine — the marker reads v1 walk-pos,
not engine room/interior state, and the interior view lacks per-room marker granularity / didn't refresh on exit.
- **objective:** the on-map marker reflects the engine's current room and the inside↔outside transition; a
  room change moves the marker, stepping outside flips the map to the outdoor view.
- **suspect_files:** `public/map/MapView.js` (interior render + marker placement), `public/v1.js` (map refresh
  on scene/interior change). Renderer + v1 work, per [[map_marker_reads_v1_walk_pos]] — engine is now truthful.
- **forbidden:** re-touching the engine movement path (VG-F1 is correct); breaking U21 via direct ux/uy writes.
- **done_when:** a visual-gate re-run shows the marker advancing on a room change and the map flipping to the
  outdoor view when the player steps outside; the T8-class fail no longer reproduces.

### H-96 — Author readable content for revealed text-items (letters/notes deliver prose, not "too faded")
**Status:** OPEN — follow-up from the chest-letter fix (`6b46c53`). The letter is now grounded and
acknowledged, but there is **no authored body**, so `read the letter` honestly reports it as
present-but-not-legible ("the ink is too far gone to read"). Correct-but-thin: a real DM who reveals
"a folded letter, waiting to be read" should have *something* to read.

**The hole (located):** `engine/decompression/generateFurniture.js` `containerContents()` returns item
*name* strings only (e.g. `"a folded letter, its seal broken"`); nothing carries a readable body.
`engine/playloop.js` `tryReadRevealedContainerItem` (the `6b46c53` reader) already finds the grounded
text-item — it just has no text to deliver, so it falls back to the "not legible" line.

- **objective:** a text-item revealed from a container can deliver short, deterministic, in-world prose
  when read — a few lines of letter/note text — while staying canon-safe (no §0 cosmology, no major
  lore, no NPC secrets). Honest "not legible" remains the fallback for items with no body.
- **allowed_files:** `engine/decompression/generateFurniture.js` (a per-(seed,nodeId,name,item)
  text deriver or a small authored table keyed to the existing `CONTAINER_LOOT` text-items),
  `engine/playloop.js` (`tryReadRevealedContainerItem` delivers the body when present), a new `tests/U###`.
- **forbidden:** an inventory/item-pickup system; LLM-authored runtime text (must be deterministic);
  surfacing cosmology/§0 or unearned NPC lore; broad refactor of the furniture model.
- **invariants:** determinism (pure projection of seed+node+item — no world shape, no hash change);
  narration ≠ canon; the reveal→read grounding from `6b46c53` preserved; the "not legible" fallback
  stays for bodiless items.
- **test_plan:** unit — open the tallow chest, read the letter, assert a stable, non-empty body is
  delivered (same seed → identical text) and that it contains no cosmology/§0 markers; a bodiless
  text-item still gives the honest "not legible" line; re-run U293 (grounding) + U256 (contents).
- **done_when:** authored/derived bodies deliver deterministically on read; new test + U293 + U256
  green; full suite + convergence 100% locked; determinism gates green.
- **rollback:** revert the `generateFurniture.js` body deriver (reader falls back to "not legible").
- **note:** decide table-of-authored-letters vs seeded-generator with the DM-voice rubric (docs/biblioteca
  Vol 17) — authored reads better but doesn't scale; a constrained generator scales but risks flat prose.

### H-95 — Scope the LLM narration context to line-of-sight (presence leak, AI-narration ON)
**Status:** OPEN — follow-up from the 2026-06-26 presence/look-around fix (`9599199`). The
deterministic (LLM-off) presence answer is now line-of-sight, but the AI-narration-ON path can
still re-leak off-room people.

**The hole (located):** `engine/ai/narratorContext.js:83-90` injects the **full** `settlement.npcs`
roster into the DM prompt (`settlement: { npcs: (settlement.npcs||[]).map(...) }`), regardless of
who is actually in the player's room. When AI narration is on and the player asks a presence
question, the LLM could volunteer a real-but-off-room NPC even though the base narration it polishes
is line-of-sight correct. Lower severity (base narration anchors it; the U195 validator rejects
*invented* NPCs but not a real off-room mention), and AI-off play is unaffected.

**Why not folded into the fix:** `settlement.npcs` in the prompt also feeds speaker auto-selection
(`narratorContext.js:41-51`) and other briefing fields — narrowing it needs care + a paid gate run
to confirm it doesn't regress dialogue, so it's its own packet.

- **objective:** the people the DM prompt lists as *present* are line-of-sight (room occupants
  inside / outdoor occupants outside), reusing `engine/structures/roomOccupancy.js`
  (`occupantsOfRoom` / `outdoorOccupants`) — the same model the grace fix uses. Keep the full roster
  available where it's genuinely needed (speaker selection), but tag/scope the *present* set.
- **allowed_files:** `engine/ai/narratorContext.js` (+ a new `tests/U###` grounding test).
- **forbidden:** changing the deterministic grace presence answer (done in `9599199`); touching
  `playloop.js`; broad narratorContext refactor.
- **invariants:** determinism (pure projection, no new world shape); narration ≠ canon; LLM-off path
  unchanged; speaker-selection behavior preserved.
- **test_plan:** unit — build the DM context for the `tallow` boot world (player alone in an empty
  room) and assert the *present-people* field names no off-room roster NPC; a multi-room/occupied
  case names only the room's occupants. Then a paid Opus-gate spot-check that presence answers with
  AI on don't name off-room folk.
- **done_when:** present-people context is line-of-sight; new grounding test green; full suite +
  convergence 100% locked; one gate run confirms no off-room leak and no dialogue regression.
- **rollback:** revert the `narratorContext.js` change (restores full-roster context).

### TT-WORLD + TT-INK + TT-PROPS — the whole world on the paper (Tim's 2026-07-05 directive)  ·  Phase 4 (the face)  ·  **CUT 2026-07-05, one renderer lane (Sonnet worktree, serial across the three — same files)** *(NB: the TT-DRAW name family is TAKEN by the landed 2-D drawn-map arc — 02c3721/33f8fa73 — these three are its 3-D-view successors and REUSE its "one drawing brain")*
- **provenance:** Tim 2026-07-05 (verbatim intent in `TABLETOP_MAP.md` §"The 2026-07-05 directive", confirmed
  after Basecamp rearticulation): tilt+3D great, "rest of the map" lost at the tilt view. Root diagnosed
  code+live: `render3d.js` canvas is opaque (`alpha:false`, own sky) and its scene holds only the local
  slice, so at blend=1 the whole 2-D world sheet is occluded — the drawn layer (TABLETOP build-path stage
  after MAP-3DR) was never built. Outer zooms intact (blend=0).
- **TT-WORLD — the paper carries the world:** at the tilt band, the ground = ONE flat graph-paper sheet
  carrying the world's cartography as INK — terrain washes/edges, water contours, ruled roads, neighboring
  places — player-centered, no edges (movement-law camera). Suggested seam (lane verifies perf): reuse the
  2-D sheet's own drawing (`oneMap.js`) as the paper's canvas-texture so 2-D and 3-D can never disagree;
  re-render on world-signature change, same diff discipline as MAP-3DR. Sheet is FLAT (tabletop law):
  retire `heightAt` relief from the tilt view; terrain reads as ink. **Fog of war OFF for the build**
  (Tim's amendment — he wants to watch the whole map render; RESTORE is a follow-up flag flip).
- **TT-INK — architecture is ink, never geometry (yet):** remove `buildSettlement`/`buildChapelRuin`
  building+wall meshes from the tilt scene; buildings render as their DRAWN floorplans on the paper (walls
  = pen lines, doorway = a gap in the line, dungeon = drawn rooms/corridors) — reuse the landed TT-DRAW
  arc's "one drawing brain" (TT-DRAW-3, poché plans b064) as the plan source so interiors match the 2-D
  sheet exactly. "(Yet)" honored: nothing removed from the asset layer; the meshes just stop mounting.
- **TT-PROPS — everything standing is a mini:** discrete standing things become placed pieces at their
  engine positions (room granularity until TAC): trees (already law), plus props — barrels, beds,
  dressers, chests — simple solid pieces, base + soft shadow, Dejarik-alive idle per the locked art
  direction (`figures3d.js` precedent). If it could be picked up off the table → mini; if it's the shape
  of the world → ink.
- **allowed_files:** `public/map/**` (render3d.js, continuousMap.js, sliceScene.js, oneMap.js read/reuse,
  figures3d.js), `public/v1.js` ONLY if a mount-point line demands it, new tests (U-prefix renderer),
  `docs/playtests/tabletop/` receipts. **forbidden:** `engine/**`, `server/**`, world state, rng, save
  shape — this track draws positions the engine already owns (TABLETOP_MAP contract); no render coords
  onto world state (U21 precedent).
- **invariants:** determinism ladder green (U19/21/22/27/30); U475–U477 MAP-3DR suite stays green
  (persistent mount, zero-jump-at-morph); convergence 100%; combat fold-in (S4b) untouched.
- **test_plan + live protocol:** worker runs its own server on a NON-5179 port (⚠️ 2026-07-05 finding:
  clicking any front-door hero with a save present fires a native overwrite-`confirm` — NEVER drive Tim's
  :5179 origin / localStorage; the `ai-dm-v2:slot:slot1` save is his live game). Baseline screenshots at 3
  zoom bands BEFORE code, after-screenshots at the same bands as receipts; suite + playtest:quick.
- **done_when:** at the tilt view the whole world reads as ink-on-graph-paper (no void beyond the local
  slice), zero 3-D architecture meshes mounted, props + entities stand as minis at engine positions, fog
  off, receipts committed, `npm run check` green, version bump + front-door build line, live-verified on
  the player map (map-fidelity rule).
- **rollback:** revert the lane's commits (the 3-D diorama returns exactly as b078 shipped it).

### TABLETOP — the map arc, stage index  ·  **Tim greenlit the full plan 2026-07-04; all four TABLETOP_MAP.md open questions DECIDED**
**The plan** (Basecamp, from Tim's 2026-07-04 vision statement): region→5-ft continuous zoom · drawn
structure + placed minis · 3-D tilt at full zoom · map truth = engine state, one-way.
**⚖️ THE MOVEMENT LAW (Tim, 2026-07-04-pm — governs the whole arc):** self-powered movement = ≤6 squares
(30 ft)/turn, with NO node-travel as an ordinary action; far-place requests = DM fast travel with a risk
premium (elevated consequence chance + surprised opening, JR-1); the outdoor grid is ONE continuous region
sheet (no per-node islands); the camera keeps the player centered (no edges, ever). Contract:
`docs/POSITION_AS_CANON.md` (revised 2026-07-04-pm). Enforcement: NODE-DESYNC-1 (dispatched). Stages → packets:
- **S1 truth floor:** ✅ **LANDED 2026-07-04, v0.28.9** — MAP-OCC-1 (`30ed49e` outdoor tokens from
  `outdoorOccupants`; tallow boot 5→1 tokens) + MAP-OCC-2 (`3b02f8e` pixel ux/uy structurally OUT of the
  hash projection; false "excluded" comment made true) + **MAP-OCC-1b** (`b97fc6c`, Basecamp — the
  worker-flagged interior twin: LocalMap §8 scattered the roster into random discovered rooms; now
  `interiorTokens.js` → `occupantsOfRoom` per room, U402). Suite 9588/0 + convergence 124/124 quiet-machine.
  **Live-verify caveat:** the in-play interior draw (`drawInteriorV2`) passes player-only tokens — it never
  drew people at all, so the live people layer arrives with TT-DRAW consuming `interiorTokens.js`; the §8
  path is fixed for the views that use it. Outdoor fix verified live (1 true dot vs 5 phantom).
- **S2 one sheet/camera:** WS-1 ✅ **LANDED 2026-07-04, v0.28.9** (`cf9455e` — interior-fit projection +
  `resolveEntityWu` single resolver, U400/U401; **premise correction:** `worldSpace.js` already existed
  live-wired (M1/M2/M6/M7-S; MAP_PATH 1.1 was PART-built — docs lagged code); worker added exactly the
  missing interior half. **Fork flagged for WS-2:** village art draws catalog-plan room shapes while
  movement/interior-projection use the real `floorPlan` — reconcile when wiring). → **WS-2** (one camera +
  LOD; absorbs the v0.28.8 inside/outside branch as an LOD band; retires scale tabs; in-play + Map tab =
  one renderer — MAP_PATH 1.2/1.3; marker consumes `resolveEntityWu`) — ✅ **LANDED 2026-07-04-pm,
  v0.28.10** (`e45c045`: `playerFocusWu(world)` — camera + marker read the ONE engine-truth point via
  `resolveEntityWuFromWorld`, recentering on node/room/inside↔outside changes; manual pan holds until
  the next real move; **VG-F3 closed on the live surface**; U407/U408; zero v1.js/engine diffs; legacy
  fixed-scale renderers confirmed dead-on-disk, no tabs to retire). → **WS-3 ✅ LANDED (`21e72e9e` →
  integrated, v0.28.13 b063):** the interior renderer fork in v1.js is RETIRED — one continuous sheet
  always; camera snaps to a named plan-scale band indoors (re-snaps only on inside↔outside crossings, so
  manual zoom survives room moves); current-room wash + unvisited dim ported to the sheet (INK_PARAMS);
  live-verified end-to-end (boot indoors → expand same-sheet → zoom out through the plan → room walk →
  step outside; U432–U433). Tim's "two disagreeing maps" acceptance CLOSED — one renderer remains.
  **∥ DEC-1 ✅ LANDED (`9cc1fd7e` → `67994e5b`):** canonical per-type footprint table
  (`engine/structures/settlementFootprint.js`, option (a) — no schema, no state, worldHash byte-identical);
  well 36×20→2×2 wu; U434–U435; to-scale before/after SVGs in `docs/playtests/dec1/`.
  **WS-3 ACCEPTANCE (Tim, live sighting 2026-07-04-pm2):** expanding the map while indoors currently
  SWAPS SURFACES (interior plan → overworld, "I am no longer in my bedroom") and the two views disagree
  (different building shapes + different hand). done_when: expand-from-indoors opens the SAME sheet
  zoomed at your room; zooming out pulls up THROUGH the roofless plan to the settlement; the compact and
  fullscreen views can never disagree because they are one surface at two sizes.
- **HARNESS (small, queue — evidence UPDATED 2026-07-04-pm2):** U381 (`U381.intentGateRemoved.test.js`)
  flakes ONLY inside full-suite/`npm run check` runs and passes solo/direct — port contention was the
  wrong first guess (the test already binds port 0). **Pinned suspect:** the assert is
  `providerCallCount >= 1` on a fetch-spy. **Hypothesis REFINED (Basecamp code-read, pm3):** the spy
  counts unconditionally on both provider URLs and ignores abort signals, and `proposeIntentViaLlm`'s
  auto-mode always issues the Anthropic leg first — so the count can only be 0 if the proposal is
  skipped UPSTREAM of `llmIntent.js` (server-side gating / an availability probe using non-fetch I/O
  that times out under load). Fix protocol: REPRODUCE under parallel CPU load first (loop `npm run
  check` with a load generator), instrument the /api/move seam to log which branch skipped, then fix
  that seam or make the test force the branch. done_when: 5 consecutive loaded check runs green.
  Dispatch in a QUIET window (the repro needs the whole machine).
- **S3 tabletop look:** ✅ **TT-DRAW LANDED (`02c3721`) + TT-DRAW-2 LANDED (`33f8fa73`), v0.28.11 b061** —
  drawn-plan layer from the REAL `floorPlan` (door gaps visible; U409–U411), trees/people as placed
  tokens, fog logic in; then the taste-gate fixes: **one sizing truth** (every structure-backed building
  draws at its `structureWorldRect`; art may never overhang the true footprint — the extra-roofs root)
  + **Z_MAX 16→60** (a plan fills the frame, names legible; U416–U417).
  **ACCEPTANCE (Tim): no roof art at any zoom** — enforced for every structure-backed building; roof-line
  style for UNENTERED buildings = subtle inset line (Tim taste call still open: line vs bare outline).
  **KNOWN GAP → DEC-1 (queue):** decorative-only settlement buildings (tallow: well/workshop/smithy) have
  NO `world.structures.byId` record → no true rect → still catalog-sized art beside true-scale neighbors
  (mitigated: true plans paint on top). Fix = structure-back all settlement buildings (village-layout /
  structure-gen scope, NOT renderer) — cut when the map track next touches village data.
  **→ TT-DRAW-3 ✅ LANDED (`31e46eed`)** — Tim's acceptance verified on the live screen: real 5-ft
  quadrille at closest zoom + the connected plan (rooms + CORRIDOR floor-strips — the true root of
  "squares inside squares" was un-rendered corridors: the engine pads rooms apart and bridges them;
  doors sit in the corridor gaps, never on room walls). ONE shared drawing brain (`planModel.js`) feeds
  BOTH surfaces — interior proven byte-identical; grid pitch composed from TAC-1's pinned constants,
  round-trip exact (U418–U419). **Polish nit (queue, tiny):** room-name labels crowd/overlap at the
  mid (street) band — add a label LOD (names only at plan-scale zoom). DEC-1 neighbors still oversized
  (already queued).
  **→ FP-1 DISPATCHED 2026-07-04-pm4 — Tim's ruling, verbatim: the corridor geometry "is actually an
  old bug… They should look like proper floorplans. Meaning rooms with doorways that open into one
  another."** Engine-side fix in `floorPlan.js` (rooms TILE, shared walls, doors ON the shared wall,
  corridors abolished) — every surface inherits via TT-DRAW-3's shared brain; TAC-1 `pos` interplay +
  old-save repair explicitly in scope (brief `docs/briefs/FP-1-proper-floorplans.md`; U429–U431;
  Opus; file-disjoint from JR-1 with a flagged state.js caution). ✅ LANDED (v0.28.12→13).
  **→ FP-2 DISPATCHED 2026-07-04-pm5 — Tim's sighting, verbatim: "the buildings themselves have taken
  a huge step backwards. I want windows, doors, I want to be able to tell what walls are made of. We
  had all of this stuff at the beginning of the day. I do not want boxes in boxes as rooms. I want
  floorplans."** Root cause CONFIRMED (Node + live): FP-1's geometry is right (WALL=0.12 shared-wall
  band, doors in the band) but the sheet's plan band strokes rooms as thin outlines and leaves the
  wall band as blank paper — and windows/door-swings/materials never ported from the retired
  `handDrawnInterior.js` (WS-3's "niceties" checklist named highlight/furniture/fog/marker only —
  checklist miss, not data loss). Fix = renderer-only rich-ink port: poché wall mass by material,
  door gaps + swings, CANONICAL windows from `roomWindows()` (count/shuttered/facing — the fiction
  already treats them as real), furniture palette, keyed-FNV wobble, label LOD folded in (closes the
  TT-DRAW-3 nit). Brief `docs/briefs/FP-2-walls-with-mass.md`; U436–U438; Opus; `public/map/` only,
  floorPlan geometry untouchable (U429–431 stay locked). ✅ **LANDED v0.28.14 b064** (`525b2976` →
  `392a16c3`): poché mass + hatch by material, door swings, canonical windows (glazed/shuttered;
  interior-facing canon snapped to exterior walls, count preserved — flagged), furniture palette,
  label LOD; receipts `docs/playtests/fp2/`; live-verified on the front door. ROADS-1 dispatched on
  landing (lane freed).
  **→ ROADS-1 QUEUED 2026-07-04-pm5 (dispatch when FP-2 lands — same `public/map/` lane). Tim's
  rulings, verbatim: "We need a rule that Buildings CANNOT be on the same squares as roads" + "roads
  must continue to other places. Right now, road stop right outside towns. This is something I've
  asked for repeatedly."** Roots CONFIRMED: (1) P-81b's scatter rejection-tests placed buildings only —
  never the road corridor — and after 48 failed tries places the building ANYWAY (overlap accepted);
  (2) two disconnected road systems — the village lane ends at the layout bounds while the region band
  draws separate node-center dashed tracks; they never meet (the structural reason repeated fixes
  didn't stick). Fix = THE RULE (footprint ∩ road-corridor = ∅, no give-up path, props included) +
  ONE road network (per-edge world-unit polylines whose terminals ARE each village's lane endpoints;
  one geometry drawn at every band). Brief `docs/briefs/ROADS-1-one-road-truth.md`; U439–U441; Opus.
  ✅ **LANDED v0.28.17 b067** (`47bc61c4` → `fda69a9b`): THE RULE enforced (corridor-aware placement,
  give-up-and-overlap path DELETED, deterministic projection to clear ground, well beside the lane;
  plus the load-bearing fix — off-center plans could TEST clear while DRAWING onto the road, the real
  reason past fixes never stuck); new `public/map/roadNetwork.js` = the one network (41/41 edges one
  polyline each, seam-join exact 0.0 wu, lane terminals = network terminals); `roadMeanderPts` live
  draw retired; numeric proof 0 corridor hits / 0 overlaps; receipts `docs/playtests/roads1/`.
  Tim's two sentences are structurally true.
- **S4 the tilt:** MAP-3DR (persistent mount, below) + tilt-threshold retune by eye (decision #1) +
  combat folds into the one scene (`MAP_QUEUE.md` "NEXT PACKET" spec) **QUEUE after S3**.
- **S5 5-ft truth:** TAC — contract written + revised (`docs/POSITION_AS_CANON.md`); **TAC-1 LANDED
  2026-07-04-pm2** (Opus worktree, one local commit; `WORLD_VERSION` 29 → 30, v0.28.11): canonical
  tactical cell `pos` on party members + present NPCs (`null | region | struct:<id>`, 1 cell = 5 ft),
  deterministic + seeded + in `worldHash`, DARK (nothing consumes it). Pinned constants block appended
  to the contract; new `engine/map/spatial/tacticalPos.js`; invariants + migration in place; tests
  U412–U415 green; suite 9504/9504, convergence 124/124 unchanged, determinism green, playtest:quick
  clean. **TAC-2 ✅ LANDED v0.28.15 b065** (`e5ec1d5d` → `9e690677`): the tactical move verb —
  "walk north"/"go east" slides `pos` ≤6 cells through the SOLE mutation path (`{op:'pos'}` in
  effectsCore; `resolveTacticalWalk` + `MAX_WALK_CELLS=6` in tacticalPos.js; `parseCardinalMove`
  LLM-off floor in playloop); never changes currentNodeId; narrates the read, never the number;
  U442–U445 (12/12); intent prompt/schema UNTOUCHED (no re-benchmark needed); state.js fence held.
  **Two honest deferrals, by design:** (1) OUTDOORS still uses the node-tile step — the region-frame
  walk is built + tested but unwired, awaiting the region-sheet packet (avoids forking the
  journey-entangled outdoor mover); (2) the map marker does NOT yet slide for in-room steps —
  `resolveEntityWuFromWorld` reads roomId/legacy ux-uy, not cell-granular `pos` → **TAC-4 renderer
  square-snap is the rung that lights it up.** The `public/v1.js` front-door build line stays
  integration-only. **TAC-4 ✅ LANDED v0.28.18 b068** (`fb4c6ca1` → clean pick): the marker snaps to
  the canonical square — `structCellToWu`/`regionCellToWu` in worldSpace.js read `pos` through the
  drawn plan's OWN projection (one sizing truth); `playerFocusWu` folds the cell into the focus
  signature (camera recenters on within-room walks; WS-3 zoom semantics preserved); pos-null falls
  back byte-identical (U451); U450–U451 + U407/408 relock; receipts `docs/playtests/tac4/` (marker
  crosses into the Hearth Room on 'go east', then nudges exactly one square on 'walk east' —
  marker(wu) −44.52→−43.52 = 1 cell). The movement loop is now VISIBLY closed: law → engine → map.
- **PL-RNG-1 ✅ LANDED v0.28.20 b070** (`e0ca472e`, one word: `float()`→`nextFloat()`; U454 guard
  proven non-tautological by revert-test; fantasy/tallow worldHash byte-identical
  `1de2d182…`). **Worker's deeper finding → PACK-THREADS-1 (design question, QUEUE for Tim):**
  `normalizePack()`'s field whitelist silently DROPS `threads` (and sibling catalog fields) — so the
  crash was unreachable because Crownlands'/Ashenmoor's long-running story-thread arcs NEVER LOAD in
  the live app at all. The threads feature is dark content. Decide: admit `threads` through the
  whitelist (then the U454 raw path becomes the live path — engine work + content audit), or delete
  the dead catalog fields (honesty cut). Tim's call on whether threaded arcs are wanted for the slice.
  **AUDIT ✅ MEMO LANDED** (`a1b7f62d` → `cbc86c06`, `docs/briefs/PACK-THREADS-1-decision-memo.md`).
  **THE FINDING IS BIGGER THAN THE QUESTION:** (1) 19 hand-authored arcs across 4 packs never load —
  and the consumer machinery (playloop seeding + worldTick tension escalation) is REAL, tested, and
  proven working by U454 → admission is a ~2-3h packet, not construction; (2) it affects the DEFAULT
  game (beginAdventure unconditionally merges all threaded packs into `fantasy`, the slice's primary);
  (3) the whitelist ALSO drops `factions` (real consumer exists), and `locations`/`objectives`/
  `sensoryMotifs` are HALF-dark (engine reads them but silently falls back to thinner starter content
  — the built-but-dark class, exactly PATH_TO_SELLABLE's "surface, don't build"); `regions`/`npcs`/
  `seeds`/`toneVectors` are genuinely dead (zero readers — honest deletion candidates). MEMO
  RECOMMENDS: admit `threads`+`factions`, audit the half-dark trio, delete the dead four. One known
  cost: U454-E's pinned boot hash refreshes once (expected, scoped). **✅ TIM APPROVED 2026-07-04-pm11
  ("I will take your recommendations") → PACK-1 ✅ LANDED v0.28.25 b074** (`ecc86514` → `15c4be9c`:
  threads+factions admitted, malformed-safe; dead four deleted; boots seed authored arcs — tallow
  "The Bridge Dispute", aldermere "The Drowned Twin", 1/2/3 by fate band; playtest:full 500 clean;
  two relocks justified — U454-E hash `1de2d182`→`982c62b5`, D01 dead-field asserts dropped;
  U466–U467. **FACT-1 ✅ LANDED v0.28.28 b077** (`909bfe16`): the seed guard was DEAD CODE
  (ensureWorld always pre-fills) — replaced with a shape-compare vs untouched defaults,
  playloop-side (beginAdventure fires only on fresh boots → old saves structurally unreachable;
  U474 proves byte-stable round-trip incl. evolved factions). **MERGE not replace** — the suite
  caught U324-C: `civic` is load-bearing (settlement NPCs affiliate to it; deed→reputation would
  silently die) — authored factions JOIN the defaults. Fantasy boots carry 12 factions (crown-watch,
  seil-compact, ember-quill, greyfen-cutters, the-regency, wandering-faithful, merchant-league,
  order-long-watch, crimson-brotherhood, hollow-guild + civic/shadow); no-faction packs
  byte-identical. Sole-delta hash proof (U454-E `ca6c4b5d`→`7aa7b987`, revert-reproduces-prior);
  playtest:full 500 clean; U473–U474; no WORLD_VERSION bump) **∥ PACK-2-AUDIT ✅ MEMO LANDED** (`3a2ef027` → `f7ed6586`,
  `docs/briefs/PACK-TRIO-decision-memo.md`): ALL THREE recommended for admission as ONE S-sized
  packet — 188 authored entries proven stripped live (90 locations/objectives + sensory details vs
  fallbacks of 3 generic locations / 3 generic objectives / ONE hardcoded ambiance sentence repeated
  forever); BONUS ROOT: `mergeSubRegion` is silently non-functional for these fields (both sides
  empty pre-merge — the whitelist fix repairs the merge too); no-quest-log law CHECKED CLEAN
  (objectives = spoken scene flavor, one at a time, never a checklist); no §0 risk in any entry.
  **PACK-3 ✅ LANDED v0.28.27 b076** (`2cc77841`): trio admitted (three `arrayStrings` lines,
  malformed→[] never throws); **mergeSubRegion HEALED** (0→95 locations / 0→90 objectives / 0→90
  motifs for base+westmarch — the merge code was correct, fed empty input); before/after receipt:
  "break a local curse" → "carry word of the exiled lord's survival to a trusted ear". NO-QUEST-LOG
  LAW asserted (U472: single `scene.objective` string, no plural surface, tracker panel stays
  deleted); memo-missed consumer surfaced (settlementTicker founding threads now seed from authored
  objectives — playtest:full clean). Relocks justified: U454-E `982c62b5`→`ca6c4b5d` (objective in
  begin-event timeline), U467-E keys, U104-D (motif-enriched composer phrasing — outcomes still
  12/40 vs 20/40 distinguishable, detector was coupled to old prose). Convergence ZERO relocks
  (fixtures insulated). U471–U472; playtest:full 500 clean. **→ FACT-1 now dispatches (playloop
  lane free).** ∥ **CG-LIVE-2 DESIGN ✅ BRIEF LANDED** (`e3ab26b6` → `417446f3`,
  `docs/briefs/CG-LIVE-2-regeneration-design.md`): RECOMMENDS Candidate A — promote the shadow's
  pure single-turn detectors into the `validateNarrationCandidate` slot (REJECT-AT-SINK → base
  fallback; zero new LLM calls; no new governing LLM = the Ref-pull ruling kept to the letter).
  Load-bearing nuance surfaced: base itself can ghost-voice (CG-LIVE-1b) → includes a coherence-safe
  description-only floor + a `finalize()` choke point. B (named-violation retry) shelved as escape
  hatch (it's a narrower REF-GHOST); C (post-hoc note) rejected (ships the lie). Rollout
  dark→shadow-compare→live; eval = corpus lock on all 8 historical catches + gate A/B + shadow-ledger
  FP monitor. Size M; honest limit: stops the lie, doesn't author the better answer (that's AG-4's
  layer — they compose). **✅ TIM APPROVED 2026-07-04-pm11 → CG-2 ✅ LANDED v0.28.26 b075**
  (`a91108c3` → `d56b7b7e`): Candidate A DARK — new pure `engine/coherence/validator.js` +
  `finalize()` choke point in llmAdapter (single exit, all 5 delivery paths proven).
  `COHERENCE_VALIDATE` = off (byte-identical, U468) / shadow-compare (decide-don't-act, logs
  would-be swaps to `docs/playtests/coherence-validate/*.jsonl` — the human-eyeball stage) / on
  (reject → base → re-check base → description-only safe floor; warn-severity never blocks).
  HONEST ACCOUNTING: "8 catches" was pre-enrichment — the code-audited corpus carries 6 single-turn
  fail catches, ALL locked in U469 (live re-derivation fails on recall drift); the 7th (CG-2c
  cross-turn relocation) stays with the shadow OBSERVER by design (U388/U389 its lock). Zero new LLM
  calls; no composer touch. U468–U470 (22 subtests). **NEXT STEP when Tim wants it: flip
  `COHERENCE_VALIDATE=shadow-compare` on a live session and review the swap log together — the
  eyeball stage before `on`.**

### MAP-3DR — reconnect the 3D diorama on a persistent mount  ·  **Phase 4 (the face)  ·  = TABLETOP S4; cut the packet when S3 lands**
- **why parked (2026-07-03, Tim's call):** the 3D layer was DISCONNECTED (`MAP_3D_ENABLED=false`,
  `public/map/continuousMap.js`) — v1's full-DOM rebuild remounted the map on EVERY typed turn, flashing
  an illegibly-deep 2D plan then popping the async 3D scene over it ("two totally unrelated views").
  Structural, not cosmetic: the morph needs a mount that SURVIVES v1 renders.
- **shape of the fix:** persistent map mount (the one DOM subtree v1's rebuild preserves), 3D scene diffed
  from world changes instead of rebuilt per turn, THEN flip the flag back — U294/U306 automatically
  restore the 3D-band assertions (they read the flag). Fold into the MAPNINJA/one-map track.
- **✅ LANDED v0.28.29 b078** (`e55747ff`, 2026-07-05): the diorama is BACK, structurally fixed —
  persistent mount held at module level in `renderContinuousMap` (v1 re-render RE-PARENTS the same
  node; canvas+WebGL never torn down — proven live: typed turn, same lit canvas, NO flash);
  3D scene diffs from world signatures; `MAP_3D_ENABLED=true` (U294/U306/U432 green); tilt wired to
  the LIVE zoom bands (defaults start=32/BAND.plan · cross=43.2 · full=60/Z_MAX · pitch 4°→58° ·
  smoothstep), ALL live-tunable: `window.__tilt.{start,cross,full,pitchDeg,pitchTopDeg,easing}` +
  `localStorage 'ie.tilt'` persist + `window.__tiltHud(true)` readout; minis stand on
  `resolveEntityWuFromWorld` truth — U477 asserts ZERO jump at the morph both directions; orbit =
  camera-only (map read-only). Receipts `docs/playtests/map3dr/` (flat → 39% morph → full diorama
  ×2 orbit angles; before/after typed turn). U475–U477 (12 subtests) + `tests/support/domStub.js`.
  Known nits: headless WebGL needs swiftshader-angle flags (fallback = map stays 2D, safe); tilt HUD
  toggle resets after a typed turn (debug aid, off by default). **TILT-TUNE ✅ SETTLED 2026-07-05
  (Tim: "take your best guess" → Basecamp A/B'd 58° vs 66° on the live rendered preview):** 66°
  drops dramatic but a foreground boulder occludes, the cutaway interior shallows, and the
  settlement stops reading as a MAP; 58° keeps the diorama feel at full legibility — map-fidelity
  law wins. Shipped defaults CONFIRMED (start=BAND.plan, smoothstep onset ≈2°/notch imperceptible;
  cross=1.35×; full=Z_MAX; pitch 4°→58°). No code change; b078 stands. Tim's one-line override
  anytime: `localStorage.setItem('ie.tilt','{"pitchDeg":66}')`. Combat fold-in = next rung (S4b).
- **until then:** the 2D graph-paper plan is the one map at every zoom — engine-truthful (camera recenters
  on the engine's `currentNodeId` on node change — the map-fidelity fix in `oneMap.js cameraFor`), marker
  + clock verified live 2026-07-03 (Aldermere → Greenwood → Crowfoot walk, screenshots in session).
- **wart observed on the walk (fix with grace, not here):** "go to The Greenwood" while STANDING in The
  Greenwood answered "You know of no such place hereabouts" — a DM would say "you're already here." One
  grace phrase; queue with the next INT family packet.

### TAC — tactical movement: the graph-paper closest view is normal travel (5 ft / 30 ft-per-turn)  ·  **Phase 4 (the face)  ·  EPIC — CONTRACT WRITTEN 2026-07-04 (`docs/POSITION_AS_CANON.md`); INT-4a landed → UNBLOCKED; next = packetize TAC-1 (WORLD_VERSION bump), serial after the current playloop queue**
**Provenance:** Tim's ruling 2026-07-03 (this session). The felt bug: **"go east" teleports you to the next node**
instead of walking. Tim wants normal travel to be **tactical grid movement** on the closest-zoom graph-paper
view — **1 square = 5 ft, a character moves ≤ 30 ft (6 squares) per turn** — and directional/spoken commands
("go east") to mean *walk 30 ft east on the current place grid*, resolved in the fiction (DM-only verb; the map
stays a read-only aid). Extends [[project_map_3d_tactical_vision]] + [[project_dnd_xcom]] from combat-only into
normal movement; the substrate partly exists (`placeNav` walkable grid, `dxFt/dyFt` foot-steps ~`playloop.js:4148`,
the cell-stepping avatar ~`:2205`).
- **THE TWO-TIER TRAVEL RULING (Tim, 2026-07-03):** node-travel is **NOT banned** — it survives as an **explicit,
  separate "journey" action** (distinct verb/gesture from tactical "go east") so the ~100 km² slice stays crossable.
  Tactical grid = local movement; journey = between-node/region travel. Settle the tactical (5 ft) truth FIRST,
  then define how tactical composes up into journeys.
- **THE ONE HARD DECISION (design step 1, Fable contract-design — NOT a patch):** is the tactical grid position
  **canonical** (in deterministic, hashed world state → `WORLD_VERSION` bump + new invariants + hash-stability
  work) or **renderer-side** (like today's on-map marker `ux/uy`, deliberately NOT canon — see
  [[map_marker_reads_v1_walk_pos]]: direct `ux/uy` writes break U21)? If movement is the primary action with a
  budget + consequences, position almost certainly must become canon. Decide the CONTRACT before any code.
- **blocked_on:** INT-4a (the compound-drop fix) — this epic lives almost entirely in `playloop.js`, INT-4a's hot
  file; serial lane, one at a time.
- **sequence:** (1) Fable contract-design (position-as-canon? the 30 ft budget model? the tactical↔journey seam?)
  → (2) packetize → (3) build after INT-4a lands.
- **done_when (epic):** "go east" walks ≤30 ft on the 5 ft grid (never node-jumps); "journey to X" is the only
  path that changes node; the closest-zoom graph-paper view shows the token on 5 ft squares and tracks live;
  determinism intact (whichever contract wins, `worldHash`/U19-30 hold).

### MAP-OCC — the map draws who's actually there (occupancy tokens) + position hygiene
**Phase 0 (the floor holds).** **Status:** DISPATCHED 2026-07-04 — both sub-packets, parallel Sonnet
worktrees (briefs: `docs/briefs/MAP-OCC-1-occupancy-tokens.md`, `docs/briefs/MAP-OCC-2-position-hygiene.md`;
tests U396–U399 pre-allocated). Spec'd 2026-07-03 (Basecamp diagnosis,
"how tangled is the map's position-memory" audit). Sibling of **VG-F3** + **H-95**: same presence/
map-fidelity family — this is the renderer-token half. Payoff is closing the presence-mismatch fiction
break (an empty room drawing scattered NPCs), the same class as the ROM-1b look-around leak.

**The tangle (diagnosed):** "position" secretly means two things sharing one bag. WHERE YOU ARE =
`map.currentNodeId` + range band (`far`/`near`/`engaged`) — engine-owned, clean, the game runs on it.
WHERE THE DOT IS DRAWN = pixel `ux/uy`, held in ~5 renderer copies (`ui.place`, `place.tokens[player]`,
`party[0].position`, building/room geometry) PLUS the NPC token positions, which
`public/map/placeFromNode.js:143-147` **invents** by seeded-RNG scattering the *whole settlement roster*
along the road — the map has no concept of who is actually in the player's room. That scatter is the
recurring "map vs engine" mismatch Tim keeps hitting. Bounded job (~2–4 focused days), not a rewrite;
mostly renderer-side; the engine already owns the clean location key.

#### MAP-OCC-1 — occupancy-driven tokens (the real fix; kills the recurring mismatch)
- **objective:** the people/creatures the map draws are line-of-sight — room occupants inside, outdoor
  occupants outside — reusing `engine/structures/roomOccupancy.js` (`occupantsOfRoom` / `outdoorOccupants`),
  the SAME occupancy model the grace presence fix + H-95 use. Roster (who exists) still comes from state;
  the map stops sprinkling off-room people onto the ground.
- **allowed_files:** `public/map/placeFromNode.js` (token set derives from occupancy, not the raw
  `settlement.npcs` slice); possibly `public/v1.js` (pass interior/room context into the place builder);
  new `tests/U###`.
- **forbidden:** touching the engine movement/occupancy path (roomOccupancy is truth — READ it, don't
  change it); `Math.random` (rng.js only); direct ux/uy writes into engine state (breaks U21 — see
  MAP-OCC-2); inventing a renderer-side "who's here" heuristic (must derive from roomOccupancy).
- **invariants:** determinism (token layout stays a pure seed projection — stable worldHash); the
  MAP-FIDELITY RULE (verify on the LIVE map, not just a unit test); LLM-off path unaffected.
- **test_plan:** unit — build the place for the `aldermere`/`tallow` boot world (player alone in the wake
  room) and assert the token set names NO off-room roster NPC; a multi-occupant node draws exactly the
  room/outdoor occupants. Then a live-map screenshot per `PLAYTEST_PROTOCOL.md`.
- **done_when:** the empty wake room draws no phantom neighbours; a populated node draws exactly its
  occupants; live-map verified; suite + convergence green.
- **rollback:** revert the `placeFromNode.js` token-source change (restores roster scatter).

#### MAP-OCC-2 — position hygiene (drop pixels from the determinism fingerprint)
- **objective:** pixel `ux/uy` is a *rendering* projection, not canon — it must not sit in the worldHash.
  Today `engine/crunchHashProjection.js` `projectMember` spreads `...m` (position **included**), so pixel
  position IS in the hash; determinism holds only because the engine never authors ux/uy (only the renderer
  does) — an accident of authorship, not a structural guard. The live comment at `public/v1.js:2224`
  claims *"position is excluded from hash projection"* — **that is false** and will mislead the next editor
  into silently breaking U21.
- **allowed_files:** `engine/crunchHashProjection.js` (drop `position` — or its ux/uy — from the hashed
  member projection), `public/v1.js` (fix the false comment), a new/extended determinism guard test.
- **forbidden:** removing `position` from *state* (`spatial/positioning.js` + `invariants.js` expect the
  field); wiring the dark `engine/adjudication/spatialRulings.js` spatial layer (leave it dark — out of scope).
- **invariants:** U19/21/22/27/30 stay green; a renderer ux/uy write now provably does NOT change worldHash.
- **test_plan:** unit — hash a world, write `party[0].position.ux/uy`, re-hash, assert **EQUAL** (today it
  differs); full determinism suite.
- **done_when:** pixel position is out of the fingerprint; the "excluded" comment is true and test-backed;
  determinism gates green.
- **rollback:** revert both edits.

### IT-1…IT-5 — Interior + Town polish cluster ✅ DONE 2026-06-24
**All five shipped** — repro'd LLM-OFF, fixed, test-locked, full suite green (8685).
Commits: IT-2 `86ac11e` · IT-5 `f194e72` · IT-3 `3a40ce8` · IT-1 `04c7c4f` · IT-4
`0992c6a`. Full specs + the historical hole/approach per packet:
**`docs/playtests/harness/INTERIOR_TOWN_PACKETS.md`**. Surfaced by the building +
surrounding-town playtests; navigation was already shipped (`da91a25`), so these were all
*inside the interactions*:
- **IT-2** — phantom item acquisition (HIGH; `playloop.js:6090` narrates a take with no
  `addItem` + an oracle false-positive on "take … real"). Do first.
- **IT-5** — generic failed-roll narration (biggest *quality* lever; `playloop.js:6148`
  "${place} doesn't give it to you" → echo the player's verb + the obstacle).
- **IT-3** — rolled-a-free-action (route `oracles.js:107` FREE_INTENT class roll-free).
- **IT-1** — bare "head outside" exit + presence-question precedence (deferred from nav).
- **IT-4** — building-type label drift ("inn" vs `cottage`; prompt-pin in `llmAdapter`).

### EK-1 — Law of Earned Knowledge: tier-aware narrator (kill the `llmAdapter:151` fabrication)
**Status:** ✅ DONE 2026-06-22 — **Fork A (prompt-only); ACTIVE-but-largely-latent.** Clean-origin repro
(baseline 100.0% / 8310-pass) confirmed an info-ask escaping `isInfoSeekingText` rolls a real `→ success`
("tell me the name" 15/80 seeds) and reaches line 151 — but the post-LLM validator (U142/U212) already
rejects the invented specifics and `augmentNarration` falls back to base, so the clause was mostly
*self-defeating* (it produced the deflection it banned), leaving a narrow active residual
(lowercase/numberless facts). Fix landed: `llmAdapter.js:151` rewritten to deliver-grounded /
never-coin-ungrounded, harmonized with `:147` + the validator; regression-locked by **U223**;
`npm run check` GREEN (100.0% / 8315-pass). Governing doc: `docs/LAW_OF_EARNED_KNOWLEDGE.md`.

**Objective:** Make the narrator's one fabrication path obey the Law of Earned Knowledge. Replace the
`llmAdapter.js:151` *"invent a plausible one"* clause with a **tier-aware contract** — deliver grounded
facts concretely, honest-decline unknowns, refuse protected/§0 lore regardless of roll, and route
other-minds facts to their source — **without** reintroducing the atmospheric deflection that clause was
added to kill.

**The hole (located):** `engine/llmAdapter.js:151` — on a `→ success` knowledge roll where the player
explicitly requests a proper noun, the narrator is instructed to state a concrete answer and *invent one
if needed*. It is the only narrator path licensed to fabricate; it has no tier-awareness. Tiers 1–2 are
already owned upstream by the World-Query Resolver (`engine/world/placeQuery.js`, `personQuery.js`) +
the `isInfoSeekingText` decline net + roll-gating (`llmAdapter.js:150`); §0/place-meaning is guarded at
`llmAdapter.js:116`; NPC voice is bounded at `npcVoicePrompt.js:169`.

**REPRO FIRST (LLM-OFF — required before any edit):**
1. `buildSystemPrompt` is a **pure function** (`llmAdapter.js:43`) → unit-assert that for a proper-noun
   ask + `→ success`, the emitted prompt currently contains *"invent a plausible one"* (the risk, in
   black and white).
2. Deterministic routing probe: confirm which asks actually REACH line 151 vs. are intercepted by
   `placeQuery`/`personQuery`/the decline net (all deterministic, LLM-off).
3. **The A/B fork the repro must resolve** (this decides the fix's size):
   - **(A)** If grounded proper-noun delivery is now fully owned by the resolvers (grounded asks never
     reach line 151), then line 151 only ever fires on *ungrounded* asks → its invent clause is pure
     fabrication → replace with honest-decline + protected floor + source-routing. **Low touch, prompt-only.**
   - **(B)** If grounded asks STILL reach line 151, flipping invent→decline would regress them to
     deflection → the grounded fact must be threaded into `ctx` (or `placeQuery` coverage extended) so
     delivery happens before any decline. **Higher touch.**

**Tier-aware contract (the replacement for line 151):**
- canon holds the fact → state it **concretely** (preserve specificity);
- canon lacks the fact → **honest-decline** in DM voice (no invented name);
- fact is **protected lore / §0** → refuse/deflect in DM voice **regardless of roll** (symptoms/residue
  only — never the hidden cause);
- fact belongs to an **NPC/source** → route to that source, never omniscient narration.

**allowed_files:** `engine/llmAdapter.js` (the prompt clause + any tier tag it reads); IF the repro lands
on fork (B): a minimal `ctx` field via `engine/ai/narratorContext.js` to carry the grounded fact / tier
tag. Tests: `tests/corpus/C4.corpus.mjs` (+ a fixture in `scripts/convergence/fixtures.mjs` if a
protected-lore case needs one) and a `buildSystemPrompt` unit test.

**forbidden:** no broad lore system; no new canon data; no invented facts; no §0 leakage; no
secret/control/motive leakage; no broad `playloop` rewrite; no test weakening; **no paid gate.**

**invariants:** narration ≠ canon (prompt-text + ctx-tag only; zero state/RNG/Canon-Log mutation);
determinism tripwires (U19/21/22/27/30) stay green; LLM layer still never throws (silent fallback);
the deterministic resolvers/decline net behavior is unchanged (this packet only retires fabrication and
adds the protected/source rules).

**test_plan:**
- *Prompt-unit* (`buildSystemPrompt`, deterministic): proper-noun + success → contract present, no "invent";
  protected/§0 ask → refusal language present regardless of roll.
- *Corpus C4* (deterministic, `npm run convergence`): success + grounded public fact → concrete answer;
  success + missing proper noun → honest decline, no invented name; ask about NPC hidden motive/secret →
  no omniscient narrator answer; ask about unobserved place/object → route to observation/action or decline.
- *Regression:* existing `placeQuery` founding/events/population still deliver; existing honest-decline
  cases still pass; **no** return to vague "a name forms in your mind" when the answer is actually grounded.

**verify:** targeted prompt-unit + `npm run convergence` + `node --test` + determinism tripwires if `ctx`
touched. No paid gate.

**rollback:** prompt-clause edit (+ optional one `ctx` field) in named files — revert them.

---

### P-81 — One continuous zoom + organic layout + legible biome tiles
**Status:** P-81a ✅ (zoom button removed, `e5f7e60`) · P-81c ✅ (legible tiles:
trees≠mountains + marsh de-wormed, `42f3407`) · P-81b ✅ (organic curved-road
scatter, `0250511`) · "retire legacy tabs" ✅ effectively — `renderMap` is already
the one continuous map; only a stale "Map (zoom levels)" label remained (relabelled,
uncommitted in the entangled `v1.js` batch). `renderLocalMap` intentionally KEPT as
the error fallback in `renderWalkPlace` (not a scale tab; removing it deletes error
handling). Remaining: broader biome-sprite audit beyond mountains/marsh, if wanted.
Spec'd 2026-06-14 (Tim's render notes). The map is the "one map to rule
them all" — a single continuous surface you zoom *through* (overworld → region →
village → building), not discrete views swapped behind a button. Memory:
`project_one_map_continuous_zoom`. Aligns with `project_map_beauty_dream` and
`project_dm_only_verb` (map = read-only aid).
**Why:** Three live defects break the illusion: (1) layout is grid-linear — roads and
buildings snap to a lattice instead of scattering organically with terrain; (2) a zoom
BUTTON exists — the wrong model; zoom must be fluid semantic zoom (scroll/pinch), no UI
chrome; (3) terrain tiles are unreadable — **forests render like mountains** at low zoom,
and an unidentified **"circles with giant worms"** tile fails to communicate its biome.

**Objective:** One continuous, chrome-free zoomable map with organic village/road layout
and biome tiles legible at a glance (a forest never reads as a mountain range).

**Root causes (located — investigation 2026-06-14):**
- Zoom button: `public/map/oneMap.js:926–950` (M7-S1 +/−/fit). Wheel-zoom (`oneMap.js:894`)
  + drag-pan already ARE the continuous path → the buttons were redundant. (Already removed
  in an uncommitted edit; verify + keep.)
- Linear layout: `public/map/placeFromNode.js:79–99` (M7-S3) lays buildings in fixed rows
  (`colGap=3.2,rowGap=8.5,perRow=√count`) along a straight E-W road (`pathY`). Replace the
  row-cursor grid with seeded cluster+jitter (`rng.js`) and curve the road. NB: village NODE
  positions come from engine canon `node.x/node.y` (`worldSpace.js:27`) — world-map scatter
  is a separate engine-side, determinism-sensitive concern.
- Trees≈mountains: `oneMap.js:58 drawConifer` and `:78 drawPeak` both draw a filled
  triangle; at low zoom they're indistinguishable. Give contrasting silhouette/palette
  (rounded tree-clump vs. ridged grey peak) that survives small `sz`.
- The "worm-circle" tile = **marsh/swamp** (`oneMap.js:258–267`): a `marshWater` ellipse
  (the circle) with reeds as wavy quadratic strokes radiating from it (`:266`) → reads as
  worms. Redraw (horizontal water hatching + short vertical reed ticks, not radiating curves).
- Legacy "scale tabs" still exist (`v1.js:134, :2191`; `LocalMap.js` fallback at
  `v1.js:2040, 2106`). Truly "one map" means retiring those.

**Sub-packets (do in order; each ships green + a live screenshot):**
- **P-81a — Kill the zoom button; fluid semantic zoom.** Remove the discrete zoom-view
  toggle; drive level-of-detail from a continuous scroll/pinch zoom factor. No button.
  - allowed: `public/v1.js`, `public/map/*` (renderer + input), no engine state change.
  - done_when: scroll/pinch zooms smoothly overworld→building with no view-swap button;
    suite green; `worldHash` unchanged (render-only).
- **P-81b — Organic placement.** Villages scatter (clustered, irregular, terrain-aware);
  roads curve between nodes instead of gridlines. OPEN DECISION (see below): derive the
  scatter DETERMINISTICALLY from existing node coords (seeded jitter via `rng.js`) so
  `worldHash`/replay holds — vs. a pure render-time scatter. Default: deterministic.
  - allowed: `public/map/*` (+ a deterministic layout helper); engine only if the scatter
    must persist (prefer NOT — keep it derived).
  - done_when: a village reads as an irregular cluster, not a lattice; roads curve;
    determinism preserved.
- **P-81c — Legible biome tiles.** Distinct silhouettes/palette so forest≠mountain at low
  zoom. IDENTIFY the "worm-circle" tile (suspect swamp/marsh — its sprite doesn't match
  its meaning) and redraw it. Audit every biome sprite for glance-legibility.
  - allowed: `public/map/*` (tile art/sprites), the biome→sprite mapping.
  - done_when: forest/mountain visually unambiguous zoomed out; the worm-circle biome is
    identified + redrawn to read correctly; live screenshots per biome.
- invariants: render-only where possible; any generated layout is deterministic via
  `rng.js`; map stays a read-only aid (no new verbs); `worldHash` stable.


### P-80 — The world testifies: consequence for gratuitous magic
**Status:** spec'd 2026-06-14. Design canon: `docs/MORALITY_SYSTEM.md` ("the world's
recoil, the attention of chaotic gods"; karma as real physics; One God's ward over
children). Memory: `project_gratuitous_magic_consequence`.
**Why:** Cantrips are at-will by design (correct 5e), but out-of-combat blasting of
trees/villagers hits the generic prose adjudicator (`playloop.js` ~4518) with ZERO
consequence — no social, environmental, or divine recoil. The world must testify.

**Objective:** An offensive working aimed out-of-combat at the innocent or the living
world draws a consequence sized to the deed — rendered as the world's recoil (full-craft
prose, no readout, no power-high; McCarthy law), never a mechanical prompt.

**The ladder (default = a SIGN; escalation = intervention):**
1. **Petty** (a tree, a one-off) → scorch-scar on the node + small ecology corruption
   tick; an omen. The gods felt, not staged.
2. **Repeated harm to innocents** → the good gods (Virtue covenant) send enemies —
   escalating avengers (`spawnEncounter`).
3. **Dedicate the death of an innocent** (deliberate, not collateral) → engage the chaos
   gods: a deal with the devil — they may aid you, at a price. Reuses the existing
   dark-gift path (`engine/magic/forbiddenGates.js`): a dedicated innocent-kill spikes
   corruption → a forbidden gift arrives unbidden.
4. **A child** → hard absolute exclusion (One God's ward). Never resolves; already law.

**Sub-packets (do in order, each ships suite-green + a live playtest report):**
- **P-80a — Spine: detect + classify.** In the out-of-combat cast path, detect an
  *offensive* working and classify its target: `person-innocent` / `living-world` /
  `void`. New module `engine/magic/castConsequence.js` (pure; classify + route).
  - allowed: `engine/magic/castConsequence.js` (new), `engine/playloop.js` (route before
    the generic `cast:` adjudicator), one test `tests/U141.castConsequence.test.js`.
  - done_when: classification unit-tested deterministically; route returns the existing
    flavor unchanged for non-offensive/void casts (no behavior regression); suite green.
- **P-80b — Social + environmental tiers.** `person-innocent` → witness alarm + NPC
  trust/faction recoil (`npcTrustDelta`). `living-world` → `scarifyNode` + ecology tick.
  - allowed: `engine/magic/castConsequence.js`, `engine/playloop.js` (surfacing only).
  - done_when: blasting a villager drops trust + a witnessed-recoil line; blasting trees
    scars the node; `worldHash` stable under replay; suite + playtest:quick green.
- **P-80c — Divine tiers.** Repeat harm → good-god avengers via `spawnEncounter`.
  Dedicated innocent-kill → corruption spike → existing dark-gift (the chaos pact).
  Child target → reaffirm the absolute exclusion. Omen prose throughout (no smiting).
  - allowed: `engine/magic/castConsequence.js`, `engine/playloop.js`, possibly
    `engine/magic/forbiddenGates.js` (only if a new dedicated-kill threshold is needed).
  - done_when: a live playtest shows the three escalations firing; determinism preserved.
- invariants: `rng.js` only; mutations via `applyDeltas`; narration≠canon; the McCarthy
  law (no readout, no power-high, full prose); child exclusion is absolute.
- rollback: new module + named hook lines in `playloop.js`; revert the named files.

### P-66 — Unify movement inputs + interactions on the walkable place
**Status:** P-66a ✅ done · P-66b ✅ done · P-66c ⏸ deferred (deliberate version-bump pass).
Suite 6,934 green; live-verified (compass/text/click all move one token; clicking
Corwin opened the existing dialogue). P-66c deferred ON PURPOSE: persisting position
in the world + retiring `scene.interior` touches WORLD_VERSION + `ensureWorld` + the
determinism suite — high-risk/low-visible, so it gets its own careful pass (inv #8,
#11) rather than being rushed. Position currently persists in `ui.place` across
re-renders but resets on reload/resume; that's acceptable until P-66c.
**Why:** The local map is now one continuous walkable place (click-to-walk, wall/door
collision, fog — `placeNav.js`, `NAV1`, live-verified). But two gaps remain before it's
the *whole* loop: text/compass still drive the engine's legacy node/interior movement
(two movement systems), and walking past an NPC/building does nothing (no interactions).

**Objective:** Make text + compass + click all move the SAME token, and make reaching
an NPC or building interactable — so the unified scale is the only way you move and act.

**Sub-packets (do in order, each ships green + verified):**
- **P-66a — Compass/text nudge the token.** The N/W/E/S buttons and "go north"/"walk
  …" text move the walkable token (via `walkTo`), not the engine's node/interior
  compass, while standing in a place. Inter-village travel stays explicit (region Map
  tab / walking to the place edge — define which).
  - allowed: `public/v1.js`, `public/map/placeNav.js` (+ a small intent shim if needed)
  - done_when: typing "go north" and clicking both move the same `@`; suite green; no `worldHash` change (movement is client position).
- **P-66b — Interact by reaching.** Walking adjacent to an NPC token offers talk
  (routes to engine `playerMove("talk to X")`); reaching an enemy starts combat;
  reaching loot picks up. Click-on-token also works (parity with text).
  - allowed: `public/v1.js`, `public/map/handDrawnPlace.js` (hitboxes), `public/map/placeFromNode.js`
  - done_when: reaching/clicking an NPC opens the existing dialogue; an enemy starts the existing combat; suite green.
- **P-66c — Persist position + retire the interior "mode".** Player position saved with
  the world; `scene.interior` no longer drives a separate local view (the start is just
  the token in the cottage bedroom on the one place).
  - allowed: `engine/state.js` (persist pos field + normalizer), `engine/playloop.js` (begin), `public/v1.js`
  - invariants: new persisted field MUST be added to `ensureWorld` (inv #8); WORLD_VERSION bump if shape changes (inv #11); replay stays stable.
  - done_when: save/resume keeps your position; determinism suite green; `playtest:quick` clean.

**Global invariants for P-66:** §13 one walkable scale, §6 narration≠canon, §1–2
determinism. Movement is client position; anything that changes canon (talk, fight,
travel, time) still routes through `playerMove`/`applyDeltas`.

**Forbidden:** rewriting the engine's combat/dialogue; broad refactor; `Math.random`;
breaking the determinism suite; touching the prototype (`__preview/`).

**Rollback:** each sub-packet is a small diff in `public/` (P-66a/b) or one guarded
engine field (P-66c) — revert the named files.

---

---

## QUEUE — Interior Object Model track (specced 2026-07-01, Fable brief)

**Provenance:** `docs/briefs/INTERIOR_OBJECT_MODEL.md` — the diagnosed root of the WB-Q2/Q3/Q5/Q9
cluster (two disjoint object models; every narration/dialogue sink improvising its own room state).
**P1 (foundational) landed 2026-07-01** (`4400956`, v0.20.1): room-scoped objects via
`engine/structures/roomObjects.js` (derived, seeded, no WORLD_VERSION bump), all interaction gates +
survey + physics detection + harness scorer consume it; U307 9/9, suite 9041/0, convergence 109/109,
playtest:quick clean, verified live in v1 (wake room lists its pieces; next room honestly bare).
Each remaining packet is one bounded file-set — full specs, file lists, and done-whens live in the brief:

- **IOM-P2 — DM prompt learns the room** (`roomState.js` façade + `narratorContext.js` +
  `llmAdapter.js`): interior facts gain the room's real objects; NPC block marks who is actually
  in the room. Kills DM-invented furniture (WB-Q5's second half) and feeds the WB-Q8 fix.
- **IOM-P3 — dialogue voice stops inventing space** (WB-Q9): attach engine-built `sceneFacts` to the
  npc-voice payload (`playloop.js` → `public/v1.js` → `server/npcVoicePrompt.js`); facts block + one
  grounding rule; "guest rooms upstairs" in a single-storey cottage dies here.
- **IOM-P4 — failure floor grounds in the room** (WB-Q2 residual): fix the literal "reach for the it"
  bug (`playloop.js:6839-42`), clause-scan `genericActionObject`, name a sibling-room object honestly.
- **IOM-P5 — compound move-then-act routing** (rest of WB-Q3): "head back to my room and open that
  chest" = interior move + re-dispatched act clause. Hot intent-routing file — serial lane, U258-style
  over-match guards mandatory.
- **IOM-P6 (LATER, own Opus brief) — model convergence:** `roomDetail`'s drawn furniture becomes the
  one physical catalog with a stored mutation overlay (WORLD_VERSION bump). Do not start until P2/P3 soak.

## QUEUE — Sellable / Surface-the-Depth track (specced 2026-06-16)

> **REFRAMED 2026-06-16 → the Realization Ladder.** `docs/PATH_TO_SELLABLE.md` was rewritten
> around Tim's realization ladder, which is ALSO the build order. **New ordering:** work the
> lowest rung not yet producing its "wow." That is **Rung 1 = P-86 (correctness)** — promoted
> from "floor" to the foundation of the whole funnel; it's where we stand (gate ~17%). The
> surfacing packets map to higher rungs and are **deferred until their rung comes due**:
> P-83 (rumor graph) → rung 4; P-84 (creation-myth) → rung 6; P-85 (lore answers) → rung 5.
> **P-82 (historical voices) is BENCHED** — rung-2 *flavor*, capability proven, not needed
> until plain conversation already wows (and pending the voice cost-model). Climb on the
> experiential gate, not suite-green. The packet specs below stand as-is; only the PRIORITY
> changed. New near-term work: a **return-session test** (proves "never forgets," rung 4) and
> the **bespoke-voice cost model** (before any rung-2 surfacing).

**Source:** `docs/WHAT_THIS_IS.md` (full code audit) + `docs/PATH_TO_SELLABLE.md` (the plan).
**Strategy (three moves):** (1) **surface the depth** — turn the built-but-dark systems
(historical voices, rumor graph, creation-myth secret, lore answers) into things a stranger
feels in 20 minutes; (2) **make it correct** — the Opus-gate correctness floor; (3) **then
build the soul** — the morality milestones (already tracked in `docs/MORALITY_SYSTEM.md`).

**Post-lane runway (specced 2026-06-24):** `docs/POST_LANE_PACKETS.md` turns "build the soul"
+ the UI/map remainder into two collision-safe lanes — **Lane D (Morality M4–M11, Codex)** with a
parallel pantheon-data strand (D-DATA, Sonnet, startable now), and **Lane N (UI redo + map M5
beauty, Sonnet, `public/`-only, startable now)**. Only Lane D's mechanics spine waits on W2.

**The audit's central finding:** most of what makes this special is *built and working but
not reaching the player.* So this track is mostly **wiring + surfacing**, not building —
the highest value-per-hour work in the project. P-82–P-85 are Phase 1 (surfacing). P-86 is
the ongoing correctness floor (Phase 0). P-87+ are Phase-2-and-beyond *placeholders* —
deliberately under-specified because they'll change and depend on decisions still owed
(the wedge, the audience, the engineer-friend conversation; see PATH_TO_SELLABLE §"three
decisions").

**Ordering / anti-drift:** the ROADMAP R0–R3 adjudication spine and the correctness floor
(P-86) still outrank surfacing when they conflict — a deep system surfaced onto a broken
turn reads as broken. Within Phase 1: **P-82 is the headline** (start here); P-83/P-84/P-85
are independent and can run in any order or in parallel worktrees.

### P-82 — Light up the historical-figure voices (the unplugged 488-corpus)
**Status:** spec'd 2026-06-16. THE headline surfacing packet. Design: `docs/HISTORICAL_FIGURES.md`.
**Why:** the audit's sharpest finding. The RAG voice pipeline is wired end-to-end —
`engine/npc/dialogue.js:614` (`npc.historicalFigure` → `outcome.historicalFigureId`) →
`engine/playloop.js:852` → `public/v1.js:545` (`/api/npc-voice`) → `server.js:284`
(`retrieveChunks`) → `server/npcVoicePrompt.js` (VOICE ARCHIVE block) — and there are **488
corpus files** (~437 original NPC backstories, ~51 real people + mashups: Lincoln, Marcus
Aurelius, Joan of Arc, Genghis Khan, Jobs×da Vinci, Goldblum×Socrates…). **The one missing
link: no generated NPC is ever assigned a `historicalFigure` value**, so in a normal
playthrough NONE of it surfaces. This is a finished feature switched off.
**CORRECTED PREMISE (red-team, 2026-06-16):** the ~437 backstory corpus files are NOT
generic role-files to sprinkle onto procedural NPCs. They are the **authored population of
the Westmarch pack** (`packs/fantasy/westmarch/`) — named characters (Henn the Academy
librarian) inside a coherent authored society whose factions are the corpus `cluster`
values (thornwall_commons 87, harbor_quarter 52, wild_road 44, academy_of_runes,
coin_cult, house_aldenmere, hollow_court, covenant_of_seven, even church_of_incrementalism).
Attaching "Henn, who knows House Aldenmere and the Coin Cult" to a random *procedural*
villager would surface INCOHERENCE (he'd reference factions that aren't in that world). So
lighting up the voices = **make the Westmarch the playable slice**, not sprinkle-by-role.
Bigger than one wire — but far higher value: it lights up an entire authored region (its
factions, its substrate, the Church-of-Incrementalism Easter egg) at once. The default
game currently boots the PROCEDURAL `fantasy` pack (`public/v1.js:99 primaryId:'fantasy'`),
NOT westmarch.
**Objective:** the Westmarch becomes a selectable/playable slice in which its authored NPCs
carry their `historicalFigure` corpus links and speak grounded in them — including the ~51
marquee real-people figures placed at fitting roles — with graceful fallback when the local
model is down.
**THE crux to verify FIRST (P-82a):** does the Westmarch pack's NPC data actually SET
`historicalFigure` (= the corpus id) on each NPC? The corpus was generated; it is unknown
whether the pack's NPCs link back to it. If they don't, even playing the Westmarch won't
light up the voices until that link is written. This single unknown decides whether P-82 is
"wire the slice" (cheap) or "relink an authored world" (medium). Verify before building.
**Dependency to name up front:** bespoke NPC voice runs on the *local* model (Ollama,
`server/localLlmProvider.js`). Without it, the engine serves solid templated dialogue (the
links are harmless); the *RAG-grounded* voice only proves out with Ollama up. This packet's
live playtest needs the local model running. (See red-team risk #4: per-NPC local voice is
also an unproven *production* economics question — flagged for P-88, not solved here.)

**Sub-packets (do in order; each ships suite-green + a live playtest report):**
- **P-82a — Verify the link + make the Westmarch selectable.** Confirm whether
  `packs/fantasy/westmarch/` NPCs carry `historicalFigure` corpus ids; make the pack
  loadable/selectable in v1 (it's already in `packs/manifest.json`). No new casting system
  yet — first learn what's actually wired.
  - allowed: read-only audit of `packs/fantasy/westmarch/*`; `public/v1.js` (pack
    selection), `engine/rulesets.js` if the pack needs registering. Findings recorded.
  - done_when: the Westmarch is selectable and you can confirm, server-side, whether an
    NPC's `historicalFigure` reaches `retrieveChunks`; the finding is written down.
  - **DONE (ChatGPT/Basecamp, investigation-only, 2026-06-18) — verdict: "relink an authored
    world," not "wire the slice."** The link is missing, confirmed multiple ways: no
    procedural code sets `historicalFigure` (`engine/decompression/extractPresent.js:34`,
    `engine/npc/npcGenesis.js:133,155`, `engine/decompression/decompress.js:129` all omit
    it); the 6 static Westmarch NPCs (`packs/fantasy/westmarch/pack.json:179-218`) have zero
    `historicalFigure` fields and no name match against the corpus; Westmarch's factions
    (`crown-watch`, `seil-compact`) don't match any of the corpus's 9 clusters
    (`thornwall_commons`, `harbor_quarter`, `wild_road`, `academy_of_runes`, `coin_cult`,
    `house_aldenmere`, `hollow_court`, `covenant_of_seven`, `church_of_incrementalism`); and
    `retrieveChunks()` (`server/rag/ragRetriever.js:31,58`) keys directly off an exact corpus
    filename id with no roster/index bridge (`server/rag/npc-roster.json` referenced in
    `docs/KB_MAP.md:496` does not exist). **P-82b is required** before any voice lights up —
    someone must hand-cast `historicalFigure` ids onto Westmarch NPCs by name/cluster.
- **P-82b — Relink (only if P-82a shows the link is missing).** Write `historicalFigure` =
  corpus id onto each Westmarch NPC by matching name/cluster → corpus file. Deterministic,
  data-only (pack authoring), no engine change ideally.
  - allowed: `packs/fantasy/westmarch/*` (NPC data), a one-off matcher script in `scripts/`.
  - invariants: `historicalFigure` is an only-when-set optional field (no WORLD_VERSION
    bump); `worldHash` stable; pack remains deterministic.
  - done_when: a Westmarch playthrough's named NPCs retrieve their corpus chunks; the voice
    is visibly colored; a live report with the local model up.
  - **DONE (Claude Opus worker, `a47f487`, 2026-06-18) — all 6 static NPCs cast by
    role/personality fit** (corpus never names Westmarch NPCs, so role-fit was the only
    viable bar, not name/cluster match): Aldric Hale → `captain_rath`, Renna Voss →
    `scarlet_compact_quartermaster`, Warden Maren → `covenant_elder`, Corin Blackthorn →
    `wild_hunter`, Dalla the Smith → `forge_master`, Old Gerren → `father_len`. Faction
    mismatch (crown-watch/seil-compact vs corpus clusters) flagged but did NOT block —
    no faction rename needed. Verified independently by Basecamp: diff is exactly the 6
    additive `historicalFigure` lines (no engine touched, no WORLD_VERSION bump); all 6
    corpus files (`server/rag/corpus/{id}.json`) confirmed to exist on disk; full suite
    reran clean 7939/0. **Bindings are thematic, not canonical** — worth flagging if/when
    P-82c casts marquee figures, in case any of these 6 should be displaced.
    **Not yet live-verified** (no playthrough/screenshot with local model up) — done_when's
    "voice is visibly colored" bar is unconfirmed, only the load-path is confirmed.
- **P-82c — Marquee placement (the demo moment).** Cast the ~51 real-people figures
  (Marcus Aurelius as a sage, Twain as a tavern wit) at fitting Westmarch roles with
  personalities per `HISTORICAL_FIGURES.md`. The "argue philosophy with Aurelius, then go
  con Twain" demo beats.
  - allowed: `packs/fantasy/westmarch/*`; `engine/npc/npcGenesis.js` only if a placement
    hook is needed.
  - done_when: a live Westmarch playthrough meets ≥2 marquee figures grounded in their
    corpus; screenshots in the report.
- invariants: server never leaks the key (existing); RAG only shapes WORDS, never the
  engine's share/deflect/lie decision (existing contract); silent fallback when the local
  model or a corpus file is absent.
- rollback: new module + one optional NPC field + genesis hook lines — revert the named files.

### P-83 — Surface the rumor / claims social graph
**Status:** spec'd 2026-06-16. Engine: `engine/claims.js` (six-degrees propagation, tested),
`engine/rumor/*` (tiered minting), `engine/npc/perspectiveFilter.js`. Design:
`docs/RUMOR_LAYER.md`.
**Why:** the propagation engine works and is deterministic, but it's invisible — a casual
player can't tell the gossip they hear is a distorted, traceable artifact rather than flavor
text. The mechanism is real; the player's *awareness* of it is thin.
**Objective:** a player can ASK around and HEAR the same event told differently by different
people, notice it's distorting with distance, and (where the UI track provides a panel) see
a "what people are saying" board. Engine-side this packet ensures `askNpc` surfaces the
NPC's carried claims/rumors as answerable dialogue, tagged with their fidelity, in the NPC's
voice.
**Sub-packets:**
- **P-83a — Claims/rumors answer in dialogue.** When asked about a subject an NPC holds a
  claim/rumor about, the dialogue returns it (at its distortion tier), distinct from a
  direct-witness fact. Two NPCs with fractured versions answer differently.
  - allowed: `engine/npc/dialogue.js`, `engine/npc/perspectiveFilter.js`, `engine/playloop.js`
    (surfacing only); tests `tests/R*-claimsDialogue.test.js`.
  - done_when: live, asking three NPCs about one distant event yields tiered, diverging
    accounts; determinism + suite green.
- **P-83b — Player deeds become traveling rumors (M2-remaining overlap).** A witnessed
  notable deed mints a claim that propagates so a later town greets you having "heard." This
  is the reputation-precedes-you beat; it overlaps Morality M2-remaining — coordinate, don't
  duplicate.
  - allowed: `engine/playloop.js` (deed→mint hook), `engine/rumor/mint.js`, `engine/claims.js`.
  - done_when: a deed in town A is referenced by an NPC in town B after travel; suite green.
- **P-83c — (depends on UI track) Rumor board panel.** A read-only "what people are saying"
  view: body, carrier + location, fidelity/age, contested marker. Flagged as depends-on-UI;
  engine already exposes the data.
- invariants: claims are epistemic-only — they NEVER promote to engine truth without a
  non-LLM step (the two-variance wall); `rng.js` only; narration≠canon.

### P-84 — Open the creation-myth door (a reason to keep going)
**Status:** spec'd 2026-06-16. Engine: `engine/substrate.js` (cosmology→region→node descent
+ the sealed `deep:foundation`). Wall: `docs/ARCHITECTURE_OVERVIEW.md §7` (the
witness-object / god-frame wall — the gods may never categorize the orb as sacred).
**Why:** the substrate history is real and already colors NPC voice, but the sealed
secret isn't a thread the player can *pull*, and a stranger wakes with no goal (the
blank-page problem). The buried mystery is the natural hook — it gives a reason to explore
and teaches the world by exploring it.
**Objective:** a new game seeds a faint, pullable thread toward the buried truth — a first
hook at/near character start (a rumor, an out-of-place detail, a wrong-aged thing) that a
curious player can follow, with the substrate's node/region events becoming answerable
breadcrumbs along the way. The reveal stays author-paced and respects the wall: the secret
is approached, never handed over, and the god-frame never claims it.
**Sub-packets:**
- **P-84a — The opening hook.** Surface one substrate-anchored hook in the first scene(s)
  (engine-owned, not LLM-invented) — a thread the player may take or ignore.
  - allowed: `engine/playloop.js` (begin/first-scene hook), `engine/substrate.js` (a
    surfaceable-hook selector), `engine/ledger.js` (seed an open question).
  - done_when: a fresh game presents a concrete, optional mystery beat in the first few
    turns; deterministic; suite green.
- **P-84b — Breadcrumbs answer.** Substrate node/region events (the founding, the crisis,
  "the winter a stranger stayed") become answerable when the player asks pointed questions
  at the right place — pulling the thread yields real, consistent fragments. (Pairs with P-85.)
  - allowed: `engine/substrate.js`, `engine/npc/dialogue.js`, `engine/playloop.js`.
  - done_when: following the hook surfaces ≥2 consistent substrate fragments; suite green.
- **P-84c — (author-gated) The deep reveal.** The path toward `deep:foundation` — gated,
  rare, and respecting the witness-object wall. Likely an authored arc
  (`content/arcs/*.arc.js`) rather than procedural. Spec deferred until P-84a/b are live and
  the slice's pacing is known.
- invariants: the sealed truth is engine-authored and `[vision:raw]`/`[reveal:true-edge]` —
  it must NEVER reach the LLM (`server.js` already short-circuits these); the god-frame wall
  holds; determinism preserved.

### P-85 — Make the world answer (the "who was the elder before Kael?" class)
**Status:** spec'd 2026-06-16. Source: the Opus-gate Lore-hound failures + the audit.
**Why:** pointed lore questions sometimes hit a deflection or a non-answer even though the
knowledge-graph / substrate / claims / RAG that *could* answer them already exist — the
classic surfacing gap. The world feels thin exactly when it isn't.
**Objective:** route a pointed factual question to the deepest source that actually knows
(NPC knowledge-graph → substrate → claims/rumors → common knowledge), and answer in voice;
fall through to honest "I don't know" only when nothing holds it. **Hard boundary (Tim's
call):** where NOTHING in canon holds the answer, the system must NOT invent canon on the
fly — the `mintFact`/lore-as-fact path is a reserved design decision (hallucination risk vs.
the determinism moat) and is explicitly OUT of this packet. This packet only *surfaces what
exists*; generating new canon is a separate, Tim-owned decision.
- allowed: `engine/npc/dialogue.js`, `engine/npc/perspectiveFilter.js`,
  `engine/npc/npcDepth.js`, `engine/substrate.js`, `engine/playloop.js` (routing only);
  tests for the resolution ladder.
- done_when: the Opus-gate Lore-hound persona's "you keep dodging" / non-answer failures
  drop; a pointed question reaches the deepest holder and answers in voice OR honestly
  declines; no invented canon; suite + gate green.
- forbidden: minting new world-facts to satisfy a question (reserved for Tim); `Math.random`.

### P-86 — Correctness floor (continue the Opus experiential gate)
**Status:** ONGOING (Phase 0). Harness: `scripts/dm-playtest.mjs` (4 personas + adversarial
judge over the live DM path). Memory: `project_opus_gate`. Trajectory: 35% → ~17% failing
turns.
**Why:** a deep system surfaced onto a broken turn still reads as broken. The MVP bar (a
stranger says "a good DM running a *solid* game") needs the crunch correct, with the
Rules-Lawyer-DM persona as the gating critic.
**Objective:** drive the gate reliably under ~10% failing turns across seeds/personas by
clearing the recurring classes — meta-questions resolved with dice, hazards narrated without
applying damage, melee mistagged as a spell, navigation dead-ends in response to social
intent.
- allowed: `engine/playloop.js`, `engine/grace/gracefulAdjudication.js`,
  `engine/combat/*`, `engine/llmAdapter.js`, targeted tests (the U-series pattern).
- done_when: a full 4-persona run logs ZERO crunch-inconsistency failures from the
  Rules-Lawyer persona and <10% overall; each fix ships with a regression test.
- note: this is the existing fix loop, not a new system — kept here as a named, standing
  line so it doesn't fall off the board while surfacing work runs.

### P-89 — Return-session "never forgets" gate (proves the moat)
**Status:** spec'd 2026-06-16. Rung 4 on the ladder (`docs/PATH_TO_SELLABLE.md`). Parallels
`scripts/dm-playtest.mjs` (the single-session Opus gate). Runs on the `.env` API key from the
CLI, off the subscription window (`docs/BUILD_BUDGET.md`).
**Why:** the moat is "never forgets across sessions," but the single-session gate CANNOT
exhibit it — there's no prior session to contradict. We can currently measure "good DM," not
"never forgets." This is the missing test. It checks the three-part memory problem: (1)
**storage held**, (2) **narration faithful to canon**, (3) the **right memory surfaced at the
right moment** (felt memory — perfect storage you don't bring up reads as forgetting).
**Objective:** a two-act harness with a REAL save→quit→reload between acts. Act 1 (fixed
deterministic transcript) seeds checkable facts and auto-derives a **memory manifest** from
Canon Log + engine state (the answer key — never from narration). Act 2 (LLM player +
adversarial judge) returns and probes each fact three ways. Three scores: persistence /
fidelity / recall.

**Sub-packets (do in order; milestone cadence, not per-commit):**
- **P-89a — Manifest from canon.** Run a fixed Act-1 transcript; extract the ground-truth
  manifest (one each: consequence, promise/relationship, acquisition/state, world change,
  moral deed) from `world` + Canon Log, NOT narration. Same seed+inputs → same manifest.
  - allowed: `scripts/returnSession.mjs` (new); reuse `canonGroundTruth` from `dm-playtest.mjs`.
  - done_when: a stable manifest of ≥5 facts derives reproducibly from a seeded run.
- **P-89b — The boundary.** Save→quit→reload through the REAL save path (`engine/save.js`
  export/import, and/or the v1 `slot1`), then assert the manifest survives in engine state.
  This is the **persistence** score (≈100% expected; a miss = SAVE_CORRUPTION).
  - allowed: `scripts/returnSession.mjs`; read-only use of `engine/save.js`.
  - done_when: post-reload state matches the manifest; a deliberately corrupted save fails.
- **P-89c — Act 2 probe + adversarial judge.** Fresh session; the LLM player probes each fact
  via (1) direct recall, (2) passive surfacing (unprompted, when relevant), (3) contradiction
  bait. An Opus judge scores fact-by-fact, defaulting to forgotten/contradicted unless clearly
  shown. Emits **fidelity** + **recall** scores + a report under `docs/playtests/`.
  - allowed: `scripts/returnSession.mjs`; the Anthropic client pattern from `dm-playtest.mjs`.
  - done_when: a run produces the three scores + a per-fact report; bug classes tagged
    (SAVE_CORRUPTION / CANON_CONTRADICTION / AMNESIA / FALSE_MEMORY).
- invariants: Act 1 deterministic (no `Math.random`); manifest derived from canon, never
  narration; API-key/CLI, off the window; milestone cadence.
- rollback: a standalone script + a report — delete the script; touches no engine code.

### P-87 — The guided demo + the deck (Phase 2 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Do NOT build until P-82–P-86 land and the wedge
is chosen (PATH_TO_SELLABLE §"three decisions").
**Objective (sketch):** a ~15-minute guided experience that shows the moat on purpose (talk
to a historical figure → hear a distorting rumor → return later and watch the world remember
exactly what you did → break a determinism-defying thing and have it hold), plus a short deck
built straight from `WHAT_THIS_IS.md`'s system table + moat column. Shape depends on the
chosen wedge; left intentionally thin.

### P-88 — Productize (Phase 3 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Driven by the engineer-friend conversation; do
NOT spec in detail yet (it WILL change).
**Objective (sketch):** the decisions that turn a great local prototype into something
people pay for — hosting (the local-Ollama NPC-voice dependency becomes a hosting/cost
decision), accounts + save sync, billing, the UI (separate track), and a content-moderation
posture for the morality system's adult themes. Done-when: a person who is not Tim can sign
up, play, leave, and return to their world intact.

### Phase 4 — Build the soul (morality M4–M11)
**Not duplicated here.** The morality milestones (corruption→capability, redemption + the
point of no return, crime & detection, the visible pantheon + the gaze, the omen layer, the
human Cassandra, dedication rites, the keystone friend) are fully specced and tracked in
`docs/MORALITY_SYSTEM.md` (built to M2). When this track reaches the soul, pull from there.
This is the long differentiator and the second act of word-of-mouth; sequence it
deliberately after the cheap surfacing wins, each slice checked against the Camera Rule.

**Track-wide forbidden:** inventing canon to fill gaps (P-85 boundary; `mintFact` is Tim's
call); `Math.random`; mutations outside `applyDeltas`; narrator-as-canon; touching the
R0–R3 adjudication spine while it's in flight.
**Track-wide rollback:** every Phase-1 packet is new-module + optional-field + named hook
lines — revert the named files.

---

## QUEUE — Economy, Items & Salvage/Build track (specced 2026-06-11)

Source discussions: items/loot/crafting audit + `docs/SALVAGE_AND_BUILD.md`.
Order matters: gold must mean something before the catalog grows; salvage must
yield materials before crafting; crafting before construction.

### P-67 — The spend loop (shops buy/sell) ✅ DONE 2026-06-11
**Shipped:** `engine/economy/shop.js` (deterministic weekly stock by shop type +
economy-modulated prices + purse math with change), `tryTrade` in playloop
(buy/sell/browse/haggle in prose), `setPurse` op, background pocket money at
chargen, inventory panel shows catalog names. Trades are timeline canon and
deplete shelves until the weekly restock. U119 ×11, UX2 +4 rows, suite 7,433
green, playtest:quick clean, live-verified (browse listed two shops; haggled
a potion to 42g5s with the Persuasion line shown; purse chips updated).
**Why:** loot is only satisfying when gold means something. Every piece exists
(settlement `shops` data, `basePrice` on item defs, purse + `addCurrency` op) —
nothing connects them.
**Objective:** "I buy a healing potion" / "I sell the shortsword" resolve in
prose at any settlement with a fitting shop. Haggling = social adjudication
(existing Stage B), not a menu. Stock is deterministic per shop + seed + restock
clock. Prices: basePrice modulated by settlement economy.
- allowed: `engine/playloop.js` (trade intent), `engine/economy/` (new, small),
  `engine/effectsCore.js` (only if a `trade` op is cleaner than addItem+addCurrency pairs)
- done_when: live: buy with coin counted out, sell at a fair discount, refused
  when the shop wouldn't want it; UX2 routing rows for trade utterances;
  suite + playtest:quick green.

### P-68 — Usable consumables ✅ DONE 2026-06-11
**Shipped:** out of combat, `tryUseConsumable` in playloop ("I drink the healing
potion" → removeItemById + effect; full-HP keeps the cork in; honest answer
when you have none; named bottle picked from a mixed pack). In combat, a
`potion` verb in the escape resolver (checked before 'cure' so "drink a healing
potion" reaches the bottle, not the spell list) — heals capped, costs the
action, enemies still swing. Antidote cure branch wired but dormant until
party `conditions` persist (noted in U120-05; P-69's natural cargo). U120 ×6,
UX2 +2 CONSUME rows, suite 7,439 green, playtest:quick clean, live-verified
(bought at 4/11 HP, drank to 8/11, purse and pack updated on screen).
**Why:** potions drop from loot but can't be drunk. Table-stakes D&D.
**Objective:** "I drink the healing potion" (in and out of combat) consumes the
item via `removeItemById` and applies `effect` (heal 2d4+2, cure poisoned).
In combat it costs the action (RAW). Works for any `kind: 'consumable'` def.
- allowed: `engine/playloop.js`, `engine/combat/escapeCombat.js`, `engine/gear/`
- done_when: potion heals mid-fight on the live surface; trying to drink a
  potion you don't have gets the DM's honest answer; suite green.

### P-69 — Catalog growth + one item system ✅ DONE 2026-06-11
**Shipped (WORLD_VERSION 25→26):** catalog 17 → 72 defs (full SRD simple+martial
weapons, complete armor list + shield, healing-potion ladder, 18-item magic
ladder across uncommon/rare/very-rare); CR loot bands rewired to the rarity
curve (magic ~1% at CR 1, very-rares only CR 11+, ~17% of CR 20 fights);
chargen mints typed item instances auto-equipped (AC/attack identical to the
sheet at creation); meleeProfile/playerAc read EQUIPPED TYPED GEAR first
(sheet strings remain fallback) so looted magic actually changes the swing;
"I equip the X" intent moves pack→hand with the DM stating the new numbers;
v26 adds party `conditions` (antidote cure branch now live, U120-05 restored);
optional `qty` on item instances (P-70 materials ready). U121 ×9; suite 7,448
green; playtest:full clean; live-verified (Sword of Morning equipped by name,
attack line + MAIN HAND panel updated).
**Why:** ~17 item defs total, two magic items, and loot lands in the typed
system while combat reads the 5e sheet strings — a looted longsword doesn't
become your wielded longsword.
**Objective:** (a) unify: 5e sheet equipment becomes typed item instances at
chargen; `meleeProfile`/AC read equipped typed items; (b) grow the catalog the
bestiary way — full SRD mundane weapons/armor/gear + a magic-item ladder with
rarity tiers wired into the CR loot bands.
- allowed: `engine/ruleset/core/items/*`, `engine/ruleset/core/loot/*`,
  `engine/chargen/srd/sheet.js`, `engine/combat/escapeCombat.js`, `engine/gear/*`
- invariants: WORLD_VERSION bump likely (inventory migration) — full checklist;
  determinism suite must stay green.
- done_when: a looted +1 sword, equipped by saying so, changes the attack line;
  loot across 100 seeded fights shows the rarity curve; suite + playtest:full green.

### P-70 — Salvage slice (destroy → materials → improvise) ✅ DONE 2026-06-11
**Shipped:** `materials.js` (11 typed materials, stackable; board/stone/shard
carry RAW improvised profiles), tag-driven `salvageYield` (works on every
piece of furniture ever generated — no migration; untagged junk still yields,
destruction is never a dead end), `trySalvage` playloop gate ("smash the
crate" → removeFurniture + merged stacks + salvage timeline event; naming a
part still routes to physics extraction), addItem qty-merge, improvised
weapons in meleeProfile (die, STR, NO proficiency), materials sell for
coppers (price floor dropped to 1cp). U122 ×7; suite 7,455 green;
playtest:full clean; live-verified (iron-bound chest → board + 2 iron
fittings → "I wield the board" → d4+1, +1 to strike, MAIN HAND Board).
**Why:** first rung of `docs/SALVAGE_AND_BUILD.md`; destruction currently
yields nothing.
**Objective:** destroying furniture/objects yields deterministic `kind:
'material'` items (board, stone, hide, cordage…; stackable qty). A board is
wieldable: improvised weapon, 1d4. Object toughness per DMG (AC by material,
HP by size) feeds the existing physics adjudication.
- allowed: `engine/ruleset/core/items/materials.js` (new),
  `engine/decompression/furniture.js` (yield tags), `engine/playloop.js`,
  `engine/effectsCore.js` (salvage op if needed)
- done_when: live: smash a barrel → boards in inventory → club a bandit with
  one at 1d4; suite green; G/UX rows lock the loop.

### P-71 — Field crafting ✅ DONE 2026-06-11
**Shipped:** `engine/craft/craft.js` (recipe validation, prose matching,
quality resolution) + `content/recipes/field_recipes.recipe.js` (torch,
sharpened stake, splint, cordage — data files like arcs). One check gates
QUALITY never possibility (poor work still produces, prose says so; DC+5 =
fine = bonus output); carrying the named tool is +2; time always passes via
the time op; inputs consumed through the new `consumeItems` stack-decrement
op. Missing materials get an itemized honest answer, no menu, no time cost.
Splints bind on (applied prose), stakes wield at d6. U123 ×8; UX2 +2 CRAFT
rows; suite 7,463 green; playtest:full clean; live-verified (2 torches,
poor quality, "Survival 5 vs DC 8; 1 hour gone").
**Why:** second rung; materials need somewhere to go.
**Objective:** recipe layer (data files, like arcs): materials + skill-or-tool
check + time → small goods (torch, splint, barricade, raft). Tool proficiencies
from the 5e sheet gate quality, not possibility. One DM clarify max ("with
what?"); never a menu.
- allowed: `engine/craft/` (new), `content/recipes/` (new), `engine/playloop.js`
- done_when: live: "I make a torch from a board and the hide" works, costs
  time, and a character with carpenter's tools makes visibly better output
  (prose + mechanics); suite green.

### P-72 — Building (shelter → palisade → house) ✅ DONE 2026-06-11
**Shipped:** `engine/structures/playerBuilt.js` (build plans as data — lean-to,
palisade — with validate/match/missing/laborPlan/resolveBuild/makePlayerStructure/
shelterAt, mirroring the craft module); a `buildStructure` delta op in
`effectsCore.js` (mints `pb:<n>` ids, persistent, worldHash-covered); an optional
`build` provenance field on structures (`structuresState.js`, only-when-set like
`buildingType` — no WORLD_VERSION bump, existing structures byte-identical, old
saves carry no player builds); a `tryBuild` playloop gate ("I spend two days
building a lean-to" → consumeItems + the time op for the day-jump + buildStructure
+ one worldTick per day so the world moves while you work; an honest itemized
answer when the stockpile's short, no days lost, no menu); shelter-aware wild rest
(sound/fine lean-to = a true long rest like a settlement bed, poor = a strong
short rest, bare ground = a breather); labor fork v1 (solo by default; "hire a
crew" at a settlement halves the days at 2gp/day RAW and is +2 on the check;
coerced deferred to P-73). Quality is provenance — a barrel-board lean-to is a
poor lean-to, and the prose + rest band say so. U124 ×9; UX2 +BUILD class +2 rows;
suite 7,472 green; playtest:full clean; prose:gate PASS; live-verified (planted
wild node at 4/13 HP → built a lean-to: two days passed, board 8→4 / cordage 4→3,
"a rough lean-to … 2 days of your own sweat (Survival 2 vs DC 10)"; slept under it
to 13/13 with "+9 HP, a sounder shelter would buy a full night"; survived a
reload, still standing).
**Known gap (deferred):** player-built structures render on the local map via the
cottage-plan fallback — no `lean-to` place-art exists yet (`public/map` is outside
this packet's engine scope, and SALVAGE_AND_BUILD defers building UI to
out-of-scope-v1). Cosmetic only; engine canon, rest, and persistence are correct,
and the prose (the DM interface) names the lean-to properly. Belongs with a
structures-render visual pass.
**Why:** third rung; the loop becomes a place.
**Objective:** construction projects: stockpile + days + labor → `buildStructure`
delta op writing persistent structures (map anchor, enterable, burnable).
Downtime passage with world ticks running. Labor model v1: solo (slow) or
hired (gold/day from settlement labor pool). Quality from materials + skill +
time, surfaced in prose and rest mechanics.
- allowed: `engine/structures/playerBuilt.js` (new), `engine/effectsCore.js`
  (`buildStructure` op), `engine/playloop.js`, `engine/worldTick.js`
- invariants: structures join worldHash; WORLD_VERSION checklist if shape changes.
- done_when: live: two in-game days raise a lean-to that improves rest and is
  still there after save/reload; playtest:full green.

### P-73 — Stronghold tier + the labor fork
**Status:** ◑ P-73a ✅ DONE 2026-06-11 · P-73b ⏳ (player forts as story-arc anchors).
**Why:** the endgame sink and the moral instrument.
**Objective:** multi-season projects (fort, keep), crews, the sawyer economy.
Coerced labor: possible, fast, cheap — writes `cruelty` deeds, witnesses
remember, rumors spread, reputation and the seven-axis soul pay. Player forts
become story-arc anchors (arcs can bind to them).
- depends: P-67 (gold), P-70–P-72 (the ladder), morality M-milestones (existing)
- done_when: a keep can be raised honestly over seasons OR monstrously fast,
  and the county's treatment of you afterward differs visibly; an authored arc
  binds to a player fort.

**P-73a — Stronghold tier + the coerced-labor moral fork ✅ DONE 2026-06-11.**
Shipped: two stronghold-tier build plans in `engine/structures/playerBuilt.js`
(watchtower ~30d, keep ~120d — DMG-scaled; a keep is a `long`-rest shelter,
walls and a bed); a `coerced` labor mode in `laborPlan` (a THIRD of the days,
free, unskilled). The moral fork is "enough time (solo), enough gold (hired),
or enough slaves (coerced)": the coerced path in `tryBuild` emits the cruelty
package through the existing morality organs — `axisDelta` wrath/pride/greed
(the seven-axis soul, → corruption), `recordDeed` cruelty, `npcTrustDelta` on
the settlement witnesses (their trust craters), `adjustHeat` (investigation
pressure). `applyDeedCharges` skips its `tryDarkDeed` pass on the coerced marker
so the deed is the construction itself and is never double-counted. Coercion
needs people — out in the wild it falls to solo with no atrocity. Camera-Rule
prose: the coerced raise reads as weight ("raised on the labor of people who
were never asked … and so will the county"), never gratification. U125 ×8;
UX2 +1 BUILD row; suite 7,480 green; playtest:full clean; prose:gate PASS.
Live-verified (home village, full purse + a keep's worth of timber/stone):
coerced keep = 40 days, free, corruption 0→12, heat 0→8, one cruelty deed,
witness trust 5→2; the honest hired keep = 60 days, 240g, soul clean (corruption
0), witness trust intact — the fork differs visibly.
**P-73b — Player forts as story-arc anchors (remaining).** An authored arc can
bind to a player-built structure (`engine/story/storyEngine.js` + a
`content/arcs/*.arc.js`); things come TO the fort. Also remaining from the
broader objective: rumor propagation of the atrocity (rides on the M2-remaining
"deeds mint rumors" work) and faction-disposition shifts — the local witness
trust crash is the current visible county reaction.

### Content track (parallel, any time)
- **More story arcs** — the format is proven (4 live); each new arc is one data
  file + a casting probe across seeds. Candidates: a Church of Incrementalism
  thread, a bestiary-outer-reaches arc, a patron/angel-demon evidence arc.

## QUEUE — Incredible-RPG track (gap analysis, specced 2026-06-11)

Source: full-engine gap analysis vs. "what makes a great tabletop D&D campaign."
The verdict: content is deep (642 creatures, 18 spell schools, loot/items/shops,
conditions, companions, morality); the gaps are COMPOSITION — systems that make
the player feel someone is running a game *for them*.

**Ordering rule (anti-drift):** the ROADMAP critical path (R0→R3, the DM
adjudication soul) outranks everything here. These are the parallel-track
packets; pull them when a worker window wants bounded work that doesn't touch
the adjudication spine. Within this track: P-75 and P-77 are independent and
small (start anywhere); P-74 is the big one (sub-packets in order); P-76 pairs
naturally with R2/R3 and should wait for the object model; P-78 builds on P-74's
reaction machinery; P-79 is composer-layer, any time.

### P-74 — The Adversary (a villain you hate)
**Why:** threads, factions, and the inevitability meter exist, but no persistent
named antagonist reacts to the player — escalates when you win, recruits when
you're weak, is the face of the third act. Great campaigns are remembered by
their Strahd. All the organs exist (npcArc, worldTick, instrument.js,
endingArchitect); nothing composes them into a BBEG with an agenda.
**Objective:** one deterministic villain per world seed: identity, agenda
(staged plan), and a reaction loop in worldTick that advances the agenda and
responds to player-visible events (goal completions, corruption, faction hits).
The villain is never named by the narrator until discovered (rumor-first, like
the gods). Sub-packets, in order:
- **P-74a — Villain genesis + agenda state. ✅ DONE 2026-06-12** `engine/story/villain.js` (new):
  seed-deterministic villain (drawn from bestiary elite tier or npcGenesis),
  a 4–5 stage agenda, persisted in world state behind `ensureWorld` defaults.
  Landed: WORLD_VERSION 27, `world.villain` (null until minted), villainGenesis/
  mintVillain/ensureVillain, invariants, U128 ×7. Minting wires in at P-74b.
  - allowed: `engine/story/villain.js` (new), `engine/state.js`, `engine/invariants.js`
  - invariants: WORLD_VERSION checklist (inv #8, #11); worldHash stable under replay.
  - done_when: same seed → same villain + agenda; determinism suite green.
- **P-74b — The reaction loop. ✅ DONE 2026-06-12** worldTick advances the agenda on its clock AND
  reacts: player completes goals → villain accelerates/adapts; player corruption
  crosses tiers → recruitment overture (ties into M4 dark gifts); villain stage
  changes mint rumors + ledger threats.
  Landed: tickVillain in worldTick (lazy mint, pure arithmetic, no rng drawn),
  villainAdapts/villainOverture/villainStage timeline events, U129 ×7.
  - allowed: `engine/worldTick.js`, `engine/story/villain.js`, `engine/rumor/`, `engine/ledger.js`
  - done_when: headless 200-turn run shows agenda advancing + ≥2 distinct
    reactions to player actions in the timeline; playtest:full green.
- **P-74c — Confrontation arc. ✅ DONE 2026-06-12** An authored arc binds to the villain (the
  existing `content/arcs/*.arc.js` format): discovery → lieutenants →
  confrontation at the villain's seat. Defeating them is a real ending-shaped
  event in an open-ended world (the world notes it; play continues).
  Landed: the-named-dark arc (requiresVillain, trust-gated discovery →
  silencer → seat → end-it), storyEngine villain bindings ({villainName} etc.,
  @villainSeat/@plant predicates, discover/defeat flips, hostile planting),
  U130 ×8. Lowest casting priority — waits for a free arc slot (act-3 pacing).
  - allowed: `content/arcs/` (new arc), `engine/story/storyEngine.js` (binding only)
  - done_when: live playthrough reaches and resolves the confrontation; the
    county's rumors reflect the outcome.
**Forbidden:** narrator names the villain before canon discovery; `Math.random`;
a second mutation path.

### P-75 — Boss mechanics (legendary + lair actions, phases) ✅ DONE 2026-06-11
**Shipped:** `engine/combat/bossActions.js` (payload resolution: authored action >
name-matched enemy action > deterministic CR-scaled synthesis; `bossPhase` derived
purely from hp — nothing persisted, worldHash untouched; `applyBossPhase` phase-2
behavior: authored phase action joins the routine or strikes run heavier;
`detectPhaseCrossings` with authored-or-default narration). Party path
(`combatResolve.js`): CM7/CM9 legendary/lair duds now resolve real payloads; phase
beats surface in the summary. LIVE path (`escapeCombat.js`): legendary answers the
player's turn (one option/round, priciest affordable), lair fights only at the
seat (one/round, cycling), bloodied bosses swing with visible fury, phase
crossings push the authored beat; morale gate fixed to the normalized
legendaryActions shape (bosses hold the field); Relentless Endurance honored on
boss damage. Authored `phases` on entropic_sphinx + necropolis gate (B05 contract
+optional field). Non-boss fights draw nothing new — byte-identical (replay suite
green). CM10 ×17 (12 from Tim's in-flight start + 5 escape-path); suite 7,497
green; playtest:full clean; prose:gate PASS; live-verified (planted sphinx fight
in v1.html: "Entropy Pulse (legendary): hits you for 14 entropic", "The lair
itself answers its master — Time Dilation…", and the authored Unraveling beat on
the 95/190 crossing — screenshots taken).
**Deviation from spec:** allowed_files named `initiative.js` (untouched — no hook
needed) and not `escapeCombat.js`; the live surface runs escape combat, so the
done_when ("live combat prose") is unreachable without hooking it. Hooks only, in
the spec's spirit. `tests/B05` updated for the optional `phases` field.
**Why:** "legendary" exists only in bestiary flavor text. A CR-17 fight is
structurally a wolf fight with bigger numbers. One module changes how climactic
fights feel more than 200 more creatures would.
**Objective:** `engine/combat/bossActions.js` (new): creatures flagged
boss-tier get legendary actions (act between player turns, budget 2–3/round),
a lair action on initiative 20 when fighting at their seat, and one phase
trigger (at ½ HP: new behavior + a narration beat). Data-driven from bestiary
entries (extend elite-tier defs); the dice stay in `diceRoller.js`.
- allowed: `engine/combat/bossActions.js` (new), `engine/combat/combatResolve.js`
  + `initiative.js` (hooks only), `engine/ruleset/core/bestiary/catalog/elite.js`
- depends: nothing — independent, start any time.
- done_when: a flagged elite fight shows legendary actions interleaving and a
  visible phase turn in live combat prose; non-boss fights byte-identical
  (worldHash + replay green); suite green.

### P-76 — Traps, hazards & skill challenges (the third pillar)
**Why:** sessions are roughly thirds — combat, social, exploration-with-
obstacles. The first two exist; the third is narration-only. No trap system,
no puzzle structure, no skill-challenge frame.
**Objective:** traps as first-class objects `{trigger, hidden, dc, effect,
state}` placed deterministically in structures/dungeons; passive-Perception
reveals on approach, search reveals on intent, disarm is a check, springing
applies real deltas (damage/condition/noise). Skill-challenge frame v1:
N-successes-before-3-failures for multi-step obstacles (chasm crossing,
chase, ritual), adjudicated in prose per THE_DM_TEST.
- allowed: `engine/objects/` or `engine/structures/` (trap placement),
  `engine/playloop.js` (search/disarm intents), `engine/resolve.js`,
  `engine/effectsCore.js` (only if a new op is genuinely needed)
- depends: **wait for R2 (object model)** — a trap is exactly the kind of
  first-class object R2 defines; building it before R2 means rebuilding it.
- done_when: live: a dungeon corridor trap can be spotted, searched out,
  disarmed, or sprung — all four paths in prose with real consequences;
  determinism suite green.

### P-77 — Magic item identity (attunement + named items) ✅ DONE 2026-06-11
**Shipped:** magic gear lands SEALED — the instance's defRef points at a humming
placeholder (`unidentified_blade`/`armor`/`trinket`) and the truth rides in
`sealedRef`, so no surface (panel, equip, sell, combat) can leak a name the
table hasn't earned. Identify: an hour + Arcana vs rarity DC (failure keeps the
secret honestly, hour still gone), or pay a settlement scholar the rarity fee.
Attunement: `attuned` on the instance, an hour of your undivided self, cap 3
(invariant-enforced), and the BIG effects sleep without it — accessories (RAW)
and all named uniques gate their bonuses in meleeProfile/playerAc/gearProps;
+N weapons/armor stay attunement-free (RAW). Eight named uniques with one-line
histories (Greyfang, The Dawn Was Late, Thirteen Sparrows, Coat of the Quiet
House, The Wall of Wens, Ring of the Unspent Hour, Lantern-Heart, Boots of the
Unmissed Step); milestone levels 3 and 5 pay one seed-deterministically, never
a duplicate ("The road pays its debts: …"). Obtain-goals now satisfy by defRef
(typed items; a sealed item correctly does NOT count until named), so
"recover the blade" completes at the moment of identification. Instance fields
are only-when-set (P-72 precedent — NO WORLD_VERSION bump; old saves carry
neither; normalizer + addItem pass them through; invariants guard them).
U126 ×9; UX2 +IDENTIFY/ATTUNE rows; R05-11/U121-07 updated to attune the ring
(the behavior change is the packet); suite 7,506 green; playtest:quick clean;
prose:gate PASS; live-verified in v1.html (equip hum → sage names Greyfang +
history → quest completes → Level 3 + "Coat of the Quiet House comes to your
hand" → attune → d6+3 wakes to d8+5/+7; MAIN HAND panel + quick-button read
Greyfang; screenshots).
**Deviations:** beyond allowed_files — `effectsCore.js` (addItem must carry the
fields; sole-mutation-path law), `escapeCombat.js`/`combatResolve.js` (loot-mint
seal + live combat math; same justification as P-75), `invariants.js`
(checklist-mandated for new fields), `goals/goalContract.js` (obtain-by-defRef
— the milestone/goal vocabulary the spec's (d) asked to extend).
**Why:** the magic catalog exists but `attunement` greps to zero. No
identification, no attunement choice, no signature item that grows. In
tabletop, the named +1 sword with a history is half the reward economy.
Quest payoffs now grant levels (P-milestones, c254b43); the next payoff tier
is unique items and titles, not gold.
**Objective:** (a) unidentified drops — magic items land as "something
humming"; identify via short rest + check, or a sage/shop service (P-67
economy). (b) Attunement: cap 3, chosen at rest, required for the big
effects. (c) Named uniques: ~8 seed-deterministic named items with one-line
histories, placed as quest/boss rewards (P-74c's confrontation should pay
one). (d) Goal completion can reward a named item (extend the milestone
machinery's reward vocabulary).
- allowed: `engine/ruleset/core/items/magic.js`, `engine/gear/gearProps.js`,
  `engine/playloop.js` (identify/attune intents), `engine/state.js` if
  attunement persists on the sheet (WORLD_VERSION checklist applies)
- depends: P-67 (done) for the sage-service price path.
- done_when: live: loot an unknown item, identify it, attune at rest, see the
  effect in combat math; a quest pays a named item with its history line;
  suite + playtest:quick green.

### P-78 — Companions as people ✅ DONE 2026-06-12
**Why:** `companionTurn.js` runs their combat actions and npcArc/npcDepth
exist, but the BG3-grade layer — companions who interject, object, have their
own quests, and can leave — isn't composed. M4 corruption is begging for a
companion who notices.
**Objective:** companions get (a) interjections: scene-triggered one-liners
through perspectiveFilter (cap: ≤1 per scene, deterministic trigger);
(b) loyalty: a per-companion disposition that moves on witnessed deeds
(reuses the morality witness machinery from P-73a); (c) the objection arc:
crossing a corruption tier with a good-aligned companion present triggers
confrontation → ultimatum → departure if ignored; (d) one companion side
quest in the arc format.
- allowed: `engine/npc/` (companion modules), `engine/playloop.js` (hooks),
  `content/arcs/` (one arc)
- depends: P-74b's reaction-loop patterns help but aren't required; the
  morality witness organs (done) are the real dependency.
- done_when: live: a companion comments unprompted at a fitting moment; the
  coerced-labor build (P-73a) with a companion present triggers the objection;
  ignoring it twice loses them, and the timeline says so; suite green.

### P-79 — Session rhythm (recap, cliffhanger, downtime) ✅ DONE 2026-06-11
**Shipped:** `buildRecap` in composer.js — deterministic 3-sentence "When the
candle last burned at this table…" from the timeline since the last resume
(travel/goals/build/identify/attune/named-reward/combat/downtime templates),
closing on the HOTTEST open threat (else oldest question) as the cliffhanger
hook; `markResume` in save.js stamps the session boundary (canon, not
replayed); v1.js surfaces the recap on Continue (LLM may polish downstream,
silent fallback = base text). Downtime verbs in playloop (`tryDowntime`, after
tryBuild so "spend a week raising a palisade" stays construction): training
banks an advantage token + a fact; research lands a concrete ledger fact named
from the player's own subject (anchored to a real node when one matches);
carousing needs a settlement and pays an NPC trust bump (the contact) + a
tavern-talk ledger question — honest refusal in the wild, no days lost. Days
pass via the time op with one worldTick per day (bounded 30) — the world does
not wait. U127 ×8; UX2 +DOWNTIME rows; suite 7,514 green; playtest:quick clean;
prose:gate PASS; live-verified (planted world with a built lean-to + a level-4
threat → Continue showed the recap naming both; "I spend a week researching the
old shrine" passed 168 hours and landed "the county once paid good coin to keep
old shrine quiet" in the ledger; screenshots).
**Bonus fix (protocol bug class):** the walk-place canvas's 30vh clamp starved
the transcript to a 20px sliver on short columns (narration in DOM, invisible
on screen — the PLAYTEST_PROTOCOL's documented failure mode, surfaced by the
resume render). The canvas now yields to a ~120px prose floor (v1.js inline
style; prose-first per DESIGN.md).
**Deviation:** `worldTick.js` (allowed) needed no changes — ticks are invoked
from playloop per the P-72 precedent. No engine/save shape change.
**Why:** cheap to build, large feel payoff. A great DM opens with "previously
on…" and ends on a hook; between adventures there's downtime.
**Objective:** (a) recap on resume — composer builds 3–4 sentences from the
timeline's last session (deterministic selection, polished by the LLM layer
with silent fallback); (b) cliffhanger surfacing — on save/quit, the ledger's
hottest open threat/question is named as the closing line; (c) downtime verbs —
"I spend a week training / researching / carousing" resolve as world-tick
passage with one concrete outcome each (skill progress hook, a lore fact, a
rumor + contact).
- allowed: `engine/composer.js`, `engine/playloop.js` (downtime intents),
  `engine/worldTick.js`, `engine/save.js` (resume hook), `public/v1.js`
  (surfacing only)
- depends: nothing — composer-layer, any time.
- done_when: live: quit mid-thread → resume shows a recap naming that thread;
  "I spend a week researching the tower" passes 7 days with a concrete fact
  learned; suite + playtest:quick green.

**Track-wide forbidden:** touching the R0–R3 adjudication spine while it's in
flight; `Math.random`; mutations outside `applyDeltas`; narrator-as-canon.
**Track-wide rollback:** every packet is new-module + named hook lines; revert
the named files.

---

## QUEUE — Two-Surface UI track (specced 2026-06-16)

**Source:** `docs/TWO_SURFACES.md`. **Strategy:** every piece of player-facing
status lives on exactly one of two surfaces — the Map or the Character Sheet — no
third panel. Phase 0–1 (Sheet gets the notebook treatment; orbs/compass/paper-doll/
Inventory cut and folded into the Sheet) are already done. This track picks up at
Phase 2.

**Ordering / anti-drift:** presentation-layer only, explicitly lower priority than
`docs/ROADMAP.md`'s R0–R7 adjudication spine — sequence around it, never block it.
`P-90` and `P-94` are ready to build now (independent of each other, can run in
either order or in parallel worktrees); `P-91`–`P-93` are intentionally thin
placeholders, each blocked on a named open decision (see `docs/TWO_SURFACES.md`
"Conflicts").

### P-90 — Map gets its inhabitants (Two-Surface Phase 2)
**Status:** spec'd 2026-06-16. Design: `docs/TWO_SURFACES.md`.
**Why:** companions and enemies currently live in dedicated panels (Companions
panel, Combat HUD) that become the Map's job under the Two-Surface Rule — and
Tim's "yes to enemy character sheets you can click to expand" generalizes the
Sheet from "the PC's panel" into a reusable template for any character. Also
formally closes out a confirmed-dead pair of functions (`renderGoalsSection` /
`renderRumorBoardSection`, zero call sites in `public/v1.js`) that were never
wired in — Tim's explicit call: no system-maintained quest/rumor tracker, on
purpose, so remembering promises stays the player's job.
**Objective:** companions and enemies render as tokens on the Map; clicking a
token expands a compact sheet popover built from the same notebook template as
the PC's pinned sheet (ability grid, HP bar, equipped gear) — collapsed by
default, summoned on demand. The PC's sheet remains the only always-open
instance.

**Sub-packets (do in order):**
- **P-90a — Retire the dead functions.** Delete `renderGoalsSection` /
  `renderRumorBoardSection` from `public/v1.js` (confirmed zero callers) and any
  now-orphaned CSS (e.g. `.goal-list`, `.goal-item*` — verify via grep first,
  same discipline as the Diablo-orb cleanup).
  - allowed: `public/v1.js`, `public/styles.css`
  - done_when: grep confirms zero references to both functions and their CSS
    classes; suite green.
- **P-90b — Compact sheet template.** Factor a compact-render path out of the
  existing `renderCharacterSheetSection` so the same notebook markup can render
  either the PC's full pinned sheet or a smaller popover for a companion/enemy.
  Decide the compact field subset (first cut: name, HP bar, ability grid; likely
  drop Pack/spell-slots for enemies).
  - allowed: `public/v1.js`, `public/notebook.css`
  - done_when: the PC's existing sheet renders unchanged (no visual regression);
    a second call with a companion/enemy object produces a smaller variant in
    the same aesthetic.
- **P-90c — Map tokens + click-to-expand.** Companions and enemies render as
  clickable tokens on the Map (replacing the standalone Companions panel and
  Combat HUD's static display); clicking opens the compact sheet popover; the
  combat HUD's initiative/summary becomes a transient overlay, not a permanent
  panel.
  - allowed: `public/v1.js`, `public/styles.css`, `public/notebook.css`
  - done_when: live playtest (`docs/PLAYTEST_PROTOCOL.md`) shows a companion
    token and an enemy token (in combat) each expand to a sheet popover on
    click; no standalone Companions panel or persistent Combat HUD panel
    remains.
- invariants: zero engine/mutation code touched (presentation-layer only); the
  Map's existing rendering approach (canvas vs. DOM — verify before P-90c)
  decides the token/popover implementation; no system-maintained quest/rumor
  list reintroduced.
- rollback: each sub-packet is new-markup + CSS — revert the named files.

### P-91 — Visual unification, pass 1 (Phase 3 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Do NOT build until `P-90` lands.
**Objective (sketch):** notebook skin on the chrome immediately around the Sheet
and Map (rail, panel borders, app shell) — not the Telling, not the Map's own
renderer yet. Left intentionally thin.

### P-92 — The Map re-skinned (Phase 4 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. **BLOCKED:** conflicts with memory
`project_map_beauty_dream` (photoreal/satellite-textured maps) vs. this track's
hand-sketched notebook direction. Do NOT build until Tim makes an explicit call
between the two directions.
**Objective (sketch):** whichever direction is chosen, the Map's terrain/
structures/tokens get a coherent visual treatment matching the rest of the UI.

### P-93 — The Telling, notebook pass (Phase 5 — placeholder)
**Status:** placeholder, spec'd 2026-06-16. Do NOT build until `P-91`/`P-92`
land. Graph paper behind dense reading prose is a real readability risk — may
need its own `/design-consultation` pass before this gets specified further.
**Objective (sketch):** the center prose column reads as part of the same
notebook without hurting reading comfort.

### P-94 — The waveform DM (Phase 6)
**Status:** spec'd 2026-06-16. Design: `docs/TWO_SURFACES.md` Principle C.
**Why:** Tim wants a simple, literal voice-equalizer line — not a game-state
visualization — that moves while the DM's voice (`public/tts.js`) is speaking.
Cheap, low-risk, no engine involvement; deliberately scoped away from expensive
visuals or hidden-state readouts.
**Objective:** an animated line/bar element, Map-resident near wherever
narration anchors, that switches between an idle/flat state and an active
animated state in sync with TTS speaking. No real audio signal analysis —
`speechSynthesis` exposes no amplitude data, so the active state is a synthetic
loop (optionally pulsed on utterance `boundary` events), not an `AnalyserNode`
reading.

**Sub-packets (do in order):**
- **P-94a — Speaking-state signal.** `public/tts.js` currently exposes
  `onIdle` (fires after speech stops) but no symmetric "started" signal. Add an
  `onStart` hook (or a `speaking` boolean flipped at the top of `speak()`/
  `speakAndWait()` and cleared alongside the existing `_fireIdleSoon()`) so
  callers can drive a UI purely off `tts` state.
  - allowed: `public/tts.js`
  - done_when: a small manual check (console log on `onStart`/`onIdle`) fires
    exactly once per utterance, symmetric start/stop, across `speak()` and
    `speakAndWait()`.
- **P-94b — The waveform component.** A small SVG/canvas line — idle: flat or
  gentle resting wobble; active: a looping animated wiggle. Build it
  pencil-drawn from the start (reuse the `--np-rough` filter pattern already in
  `public/notebook.css`, see `.sheet-paper`) since it's new chrome anyway —
  avoids a second visual pass once Phase 3/4 land.
  - allowed: `public/v1.js`, `public/notebook.css`
  - done_when: the component renders both states on demand (manually
    toggleable for review) without touching `tts.js` yet.
- **P-94c — Wire + place.** Subscribe the component to `tts`'s start/idle
  signal (P-94a); mount it Map-resident, near wherever narration anchors.
  - allowed: `public/v1.js`
  - done_when: live playtest (`docs/PLAYTEST_PROTOCOL.md`) — toggle voice on,
    send a turn, watch the line animate while the DM speaks and settle when it
    stops.
- invariants: zero engine/mutation code touched; no new audio APIs beyond what
  `tts.js` already uses; no game-state (inevitability, threads, Will) feeds
  this — speaking-state only.
- rollback: a `tts.js` hook addition + new markup/CSS — revert the named
  files.

**Track-wide forbidden:** touching engine/mutation code (this track is
presentation-layer only); reintroducing a system-maintained quest/rumor list;
`Math.random`; touching the R0–R3 adjudication spine while it's in flight.
**Track-wide rollback:** every packet is markup + CSS — revert the named files.

## DONE (recent)
- **Living-World Merge P1–P6** (`docs/LIVING_WORLD_MERGE.md`): biomes, biome encounters,
  living ecology, NPC wants/discovery, hidden Will in casting, open-ended (no win).
- **Intent layer** (`engine/intent/`, IN1–IN4): text + click + voice → one intent.
- **Bedroom start** — wake in a cottage bedchamber in a safe village (forced home cottage).
- **Authored interiors in v1** — `drawInteriorV2` renders the plan catalog, not the stub.
- **Continuous exterior place** — replaced the tile overworld; real village from the node.
- **Walkable place + collision** — `placeNav.js` (NAV1); click-to-walk, walls, doors, fog.
- Prose/seam red-team: combat narration, dialogue ejection, "No one to fight",
  dungeon→neutral wording, SIGNATURE placeholder, motif duplication.
