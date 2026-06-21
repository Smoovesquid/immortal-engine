# Playtest — Opus-4.8 experiential gate — 2026-06-21

**Harness:** `scripts/dm-playtest.mjs` · live DM path (engine in-process + /api/narrate + /api/npc-voice) · player & judge = claude-opus-4-8
**Run:** 4 sessions × 12 turns · personas: Rules Lawyer DM, Chaos-griefer, Lore-hound, Confused newbie · seeds: glass-harbor

## Score

| Persona | Seed | Turns | Vibe fails | Crunch fails | RAG fails |
|---|---|---|---|---|---|
| Rules Lawyer DM | glass-harbor | 12 | 2 | 2 | 1 |
| Chaos-griefer | glass-harbor | 12 | 0 | 0 | 0 |
| Lore-hound | glass-harbor | 12 | 1 | 0 | 0 |
| Confused newbie | glass-harbor | 12 | 2 | 0 | 1 |

**Total turns judged:** 48 · **failing turns:** 5 (10%)

## Failures by bug class

### DM_TEST_DEADEND (4)
- **[Rules Lawyer DM]** player: _"What's the Tonic of grit do exactly — and how many bandages do I have?"_
  - DM: You have one Tonic of grit. You have one Bandages.
  - mech: `(none)` — **med**: Tonic of grit heals 2d4 per canon; DM omitted the effect entirely despite being asked directly.
- **[Rules Lawyer DM]** player: _"That's a dodge, not an answer. Either give me the Tonic's mechanical effect or flag it as undefined — I need to know before I rely on it."_
  - DM: It lands, after a fashion — partial, imperfect.
  - mech: `[roll:12 vs DC:11 → mixed | margin:1 | approach:focus | stake:time | risk:0.47 | stat:WITS+1]` — **high**: Canon lists Tonic of grit as heal 2d4; DM failed to provide it, leaving a known mechanical fact unresolved.
- **[Lore-hound]** player: _"Corwin, leave us. Kael—who was headman the year you arrived?"_
  - DM: You step away from Corwin Boneknit. You step back outside.
  - mech: `(none)` — **high**: Player addressed Kael with a direct question; DM ignored the intent entirely, only narrating Corwin leaving and the player stepping outside—Kael never answers.
- **[Confused newbie]** player: _"Hm, that's not who I asked about. Can you point me to Kael the elder?"_
  - DM: Inside Pilgrim's Rest Village's building, your worn blade has carved a grievous wound into Kael the elder, leaving him barely standing at the edge of collapse as he strikes back at you with desperate, faltering strength.
  - mech: `[strike:Worn Blade | atk:16 vs AC:10 → hit | 7 dmg] [enemy:Kael | atk:21 vs AC:11 → hit | 2 dmg | pc` — **high**: Mechanics are self-consistent: hit lands 7 dmg, Kael at hp:1, counterattack drops PC 13->11 matching canon.

### CANON_HALLUCINATION (1)
- **[Confused newbie]** player: _"Okay, maybe I should go talk to someone friendly first. Who's the elder, Kael?"_
  - DM: Corwin Boneknit, a representative — one of the folk here, watching from nearby.
  - mech: `(none)` — **med**: Answered the wrong question — player asked who the elder is (or addressed Kael); DM gave Corwin the representative, not Kael the elder.

## Cost
96 Opus calls · 142,354 in + 8,733 out tokens · ~$2.79 (est. @ $15/$75 per M)

## Basecamp verdict (§7) — 2026-06-21 (gate 3, HARDENED judge)

**5/48 (10%) — down from run-1's 18/48 on the same seed/personas.** This run used the reference-guided judge
(commit `6e39d5c`: `world.conversation.lastRoll` + a ROLL-RECALL clause in `canonGroundTruth`/`JUDGE_SYSTEM`).
The pre-hardening run-1 report is preserved at `opus-gate-2026-06-21-pre-judge-hardening.md`.

### The hardening worked — ~13 of run-1's 18 were judge artifacts
- **The roll-recall false-positive is GONE:** no "fabricated 18 vs DC 12" / CANON_HALLUCINATION on a correct
  ledger citation anywhere in this run. The judge now sees the stored roll and passes canon-defense.
- The whole **Rules-Lawyer** persona dropped from 8 fails → 2 (both real C7 item-effect dodges); **Chaos-griefer
  went 12/12 clean** (all the gratuitous-violence / death-spiral turns handled — H-71 + combat work holding);
  the Lore-hound combat-table-talk cluster did not recur.
- Net: the engine's real live quality is ~90% on this gate, much better than run-1 implied. The gate is now a
  trustworthy instrument (Vol 10/14 reference-guided judging, validated).

### Discovery signal: 0 new capabilities (2nd consecutive zero-discovery gate)
All 5 real failures map to existing capabilities — the convergence thesis holds strongly; the loop is near-closed.

| Turn | Capability | What happened |
|---|---|---|
| RL t2 | **C7** (cross-item compound) | "Tonic effect + how many *bandages*" → answered both COUNTS (H-70/H-73 working) but omitted the Tonic's 2d4 effect (effect-of-X + count-of-Y is a cross-item compound the fold doesn't cover) |
| RL t4 | **C7** (live phrasing-tail) | "give me the Tonic's mechanical effect or flag it undefined" → `[roll:mixed]` instead of "heals 2d4" (the DM delivered 2d4 on *other* phrasings this run — specific phrasings miss the detector live) |
| Lore t5 | **C4** (compound dismiss+question) | "Corwin, leave us. Kael—who was headman…" → resolved the dismissal + a move, dropped the question to Kael |
| Newbie t4 | **C9 / RAG** | "Who's the elder, Kael?" → named Corwin the representative, not Kael the elder (role/identity grounding) |
| Newbie t5 | **C12 / intent (TOP bug)** | "Can you point me to Kael the elder?" → the engine resolved a real **attack** on Kael (`[strike:Worn Blade…7 dmg]`). A directions/navigation request became combat — the one genuinely concerning failure; high severity, intent-misread |

### Recommendation
- **Next real bug to chase: the C12 directions→attack misread** (Newbie t5) — a navigation/clarify request must
  never resolve as a strike. Likely the attack/target detection firing on "point me to <NPC>" in/near a combat
  context. Localize before scoping (it's the worst-feeling failure for a player).
- C7 live phrasing-tail (item-effect dodged/rolled on some phrasings; cross-item compound) — the corpus-green/
  live-broken gap persists; the live narrate path isn't reliably reaching the grace item answer.
- C4 compound dismiss+question and C9 elder-identity are lower-severity known tails.

### Cost / budget
~$2.79 this run (96 calls). Budget ~$5.17 → **~$2.38 remaining — below the ~$2.5 one-run floor.** This is the
**last gate until the API balance is topped up**; re-confirm the real balance with Tim before the next run.
