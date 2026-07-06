# THE DEATH CONTRACT — the final delivery of consequence

*Tim's commission, 2026-07-06 (Fable's last day, verbatim intent): "a great prose description of death
that makes the player feel a real loss… as gory as possible and tailored to the way you're actually
killed. The game is about consequences so this is the final chance in a game experience to deliver
them. And I want the same for the bad guys… They may beg for mercy. You might deliver a merciful
killing blow or do something worse or even save them (possibly at your own peril) and man and the
gods witness. For bad guys, if they cannot flee, they can beg — for life or a quick death."*

*Standing law this contract composes with (nothing here overturns anything): PERMADEATH is locked
(`DND_XCOM.md` — "permadeath is the front door"); the Underworld death-run is the designed second act
(DX-3 + IG-17 — this contract builds its SEAM, not the run); IG-5 is the death-prose seed (the
pale-root glimpse; §0 cosmology NEVER named in-world); IG-3 rewind belongs to the Ref's appeals, never
to death. Moral physics (`MORAL_PHYSICS.md`, blessed, MP-1..5 live) supplies witnesses, rumor,
escalation, pacts, omens. `THE_DM_TEST` and hide-the-math govern every line the player reads.*

## 0. The Armory (live organs this rides — do not rebuild)
Witness→rumor bridge (`rumorsReaching`, MP-1) · escalation tiers (`engine/morality/escalation.js`,
MP-2, routed at `effectsCore.recordDeed`) · heat→hunt (MP-3) · pact-gift (MP-4) · omen surfacing
(MP-5a/b) · fair-combat-never-cruelty guard (F6, U556) · flee (escapeCombat — the LIVE combat engine;
every combat feature hooks IT or never runs) · occupancy/LOS witness truth · ledger threads/goals.
**Trap on record:** new combat-entity fields must join `ensureCombat`'s whitelist in `engine/state.js`
or they are silently stripped.

## 1. The four invariants
**I. The death fact precedes the death prose.** Every death — player or NPC — first assembles a
deterministic DEATH FACT; the prose is voiced FROM it and may not contradict it. Gore is not garnish;
it is the fact pattern rendered honestly.
**II. Death is a moral event, not just a combat event.** Every killing blow, mercy, cruelty, sparing,
and abandonment routes through `recordDeed`/claims with the witnesses present — man AND gods (the
divine channel = the same tier/pact/omen ladder). No special-case morality at the death seam.
**III. The engine owns every magnitude** (dying-clock lengths, beg thresholds, betrayal odds, deed
severities). The LLM voices pleas and elegies from tier labels and fact bundles; it never sets a
number (V11). No numeric value in any player-facing death string, ever.
**IV. Permadeath means the WORLD keeps the death, not that the death leaves the world.** A player
death mints canon — grave, rumor, grieving, threads aging on. Nothing rewinds. (Rewind = Ref appeals
only, IG-3.)

## 2. The DEATH FACT (the atom)
Assembled by the engine at the killing moment, pure f(world, combat log):
`{ victim, killer, means (weapon/spell/beast/fall), woundPath (this fight's accumulated wounds — the
blow that opened the thigh in round 2 is allowed to finish through it), locale + light + weather,
witnesses[] (occupancy truth), victimStance (fighting|fleeing|begging|helpless|defiant), killerIntent
(clean|brutal|mercy|worse), finalWords? }` — plus, for the PLAYER only, the **LOSS LEDGER** (§4).
Stored canonically; the prose layer consumes it; corpus + a CG death class assert prose⇄fact agreement.

## 3. The kill moment (enemy side) — flee, then beg, then the four verbs
- **The DYING state.** A communicator at 0 HP does not evaporate: it enters DOWNED (deterministic
  dying clock). Beasts and the mindless die outright (capability-gated by the bestiary record —
  `canCommunicate`). This state is what makes mercy POSSIBLE; it hooks escapeCombat and its fields
  join the ensureCombat whitelist.
- **The beg.** Cornered (flee unavailable or failed) + communicator + DOWNED (or hopeless — engine
  computes hopelessness from odds, not vibes) ⇒ the NPC MAY beg, personality-driven (self-preservation,
  faction, the seven axes): **for life** or **for a quick death** — two distinct pleas, chosen by the
  engine, VOICED by the LLM in-character (Scarvein begs differently than a conscripted farmhand; some
  proud ones never beg — defiance is also an answer). A creature that cannot communicate never begs
  (falsifier).
- **The four verbs** (all resolved in fiction, all witnessed, all deeds):
  1. **The merciful blow** — quick, clean, on request or unprompted. Gory-honest prose, but the
     mercy reads. Deed: killing, mercy-flagged (NOT cruelty — extends F6's boundary: quick-kill of a
     begging foe on their plea ≠ butchery).
  2. **Something worse** — the example-making, the slow answer, the mutilation. HEAVY+ cruelty;
     pact-relevant; the gods lean in. The prose does not flinch; neither do the consequences.
  3. **The sparing — at your own peril.** Stabilize/bind/release: costs real actions while their
     allies still fight, costs supplies, and mints a LIVING WITNESS with memory — the spared may owe,
     may spread the tale ("he spared the bandit at the ford" — mercy travels the SAME rumor engine as
     atrocity; the moral physics gain their first strong POSITIVE claim source), or may betray
     (personality + seed, engine-owned odds; betrayal is the peril made real).
  4. **Walking away** — leaving the dying to the clock. Its own deed (abandonment ≠ mercy ≠ cruelty);
     witnesses read it exactly as what it is.
- **The killing-blow prose:** death fact → LLM, as gory as the fact pattern honestly supports,
  means-tailored (an axe death is not an arrow death is not a fire death), stance-aware (a beggar's
  death reads differently than a duelist's). TABLE TEST: what a great DM gives a kill.

## 4. Player death — the elegy and the loss
- **Terminal in state.** No rewind, no reload fiction. The death scene plays in beats:
  (1) **the blow** — same death-fact honesty, second person, the wound path completing;
  (2) **the body failing** — gory, specific, unhurried;
  (3) **the pale-root glimpse** (IG-5) — the afterlife SEEN but never explained; the True Edge;
      cosmology unnamed (§0 hard law);
  (4) **the elegy — the LOSS LEDGER voiced.** The engine hands the prose layer the player's OPEN
      world: unfinished threads (the bell never answered), promises unkept (the concern accepted in
      Aldermere), people who will wait (and how long before word reaches them — real rumor distance),
      the undelivered thing still in the pack. **The elegy MUST draw on ≥3 ledger facts** — loss is
      specificity, not violins (this is the testable heart of "make the player feel a real loss").
- **The world keeps your death (invariant IV):** grave/corpse site minted at the locale; your death
  propagates as a rumor with your killer named (the moral physics run on YOUR death too — if you were
  murdered, your killer accrues heat; the hunt can avenge YOU); your open threads age on without you.
- **Then the door:** the death screen offers what exists — v1: **the world holds** (a brief epilogue
  glimpse: one beat of Aldermere continuing, threads resolving or rotting) and **a new life in the
  SAME world**, where your predecessor's death is canon (their grave visitable, their killer still
  warm, their spared enemies still remembering). The **Underworld hook** (IG-17/DX-3) is a sealed
  door in v1: the seam ships (the death fact IS the case file the run will receive), the run does not.

## 5. Packets (farm-buildable; engine-brief each at dispatch; escapeCombat is the hook-point)
- **DEATH-1** — the death-fact atom + DOWNED/dying state (communicators) + killing-blow verb routing
  (audit current 0-HP handling FIRST; ensureCombat whitelist; schema touch likely → WORLD_VERSION
  protocol if stored).
- **DEATH-2** — the beg (capability + hopelessness gates, two plea types, personality voice) + the
  four verbs wired to moral physics (mercy-flag extends F6; sparing mints the living witness +
  positive claim; betrayal odds engine-owned).
- **DEATH-3** — enemy killing-blow prose: death fact → LLM, CG death class + corpus locks
  (prose⇄fact agreement; no numerics; no beg from the speechless).
- **DEATH-4** — player death: terminal state + loss ledger + the four-beat elegy (pale-root beat,
  §0-safe) + world-canon minting (grave, death rumor, killer heat, threads age).
- **DEATH-5** — the continuation: epilogue glimpse + new-life-same-world boot (predecessor canon) +
  the sealed Underworld seam (case-file handoff shape only).
- **Ship-gate note** (rides CARL-SHIP-1's review): gore is LAW per Tim; a content dial, if ever,
  is a ship-time product decision — not a design input, and never a reason to soften the facts.

## 6. Falsifiers (no law without them)
Death prose contradicting its death fact (wrong means/wound/killer/stance) = red · a beg from a
non-communicator = red · mercy-kill or fair kill tagging cruelty = red (F6 extension suite) · a
sparing that mints no witness/claim = red · a player death that mints no grave/rumor/heat = red ·
an elegy citing <3 loss-ledger facts = red · any numeric in a death string = red · same seed + same
transcript ⇒ byte-identical death fact and (LLM-off) prose = the determinism floor.

## Non-goals v1 (representable later, not owed now)
The Underworld run itself (seam only) · player capture/enslavement instead of death · resurrection
magic · companion deaths (no companions yet) · corpse looting economies · spectator/ghost mode.
