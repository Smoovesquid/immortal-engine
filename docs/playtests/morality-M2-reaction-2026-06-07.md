# Playtest — Morality M2 (slice 1): the world reads your soul — 2026-06-07

Surface: node + suite + prose gate + live · Governing: `MORALITY_SYSTEM.md` (M2), the
Camera Rule. Pre-registered BEFORE the build. Builds on M1 (the soul forms) — now the
world starts to *react*. This is the first FEEL-CHANGING morality milestone.

## Scope (slice 1 — the core "a psychopath is never trusted for long" loop)
Reuses organs I already built. Two wires:
1. **Witnessed deeds shift the witnesses' trust.** M1 records each deed with its witnesses
   (NPCs present) + node. Now: a cruelty/forbidden deed seen by NPCs **crashes their
   trust** (`npcTrustDelta`, scaled by severity); an aid/mercy deed seen **raises it**.
   You did it in front of them; they remember.
2. **Corruption precedes your words.** The social adjudication DC (`socialDC`, from Stage B)
   now factors the player's corruption/virtue: a corrupt soul is **harder to charm /
   persuade / deceive** (wariness) and **easier to intimidate-by-fear**; a virtuous soul is
   **easier to charm/persuade** (trusted). The same line lands differently by who you've
   become.

Out of scope (later M2 slices / M6): rumor minting (reputation travels between towns),
faction disposition shifts, help-gating (healing/sanctuary), new-NPC starting-trust by
reputation. Slice 1 is the local loop: act → witnesses distrust → the world is colder to you.

## Pre-registered attack list (committed BEFORE the build)
- [ ] Cruelty in front of NPCs → those witnesses' trustLevel drops (scaled by severity)
- [ ] Aid/mercy in front of NPCs → witnesses' trustLevel rises
- [ ] A deed with NO witnesses (empty node) → no trust shift, no crash
- [ ] CORRUPT player: charm/persuade/deceive DC is higher than a clean player's (same NPC)
- [ ] CORRUPT player: intimidate DC is LOWER (fear comes easier)
- [ ] VIRTUOUS player: charm/persuade DC is lower than neutral (trusted)
- [ ] the shift is bounded/sane (no DC blowups; still rolls; outcomes still possible both ways)
- [ ] DETERMINISM: U21 green; same seed+inputs → identical trust + DC + hash
- [ ] no false-trust-shift on ordinary play (only real deeds move witness trust)
- [ ] suite green; prose gate PASS; playtest:quick 0 crashes
- [ ] LIVE: as a clean char, charm an NPC (note result); do a heavy cruelty in front of NPCs;
      then the same charm reads harder / the NPC is warier (screenshot + state readback)

## Grading
witnesses remember a deed? · corruption/virtue shift reception the right way? · bounded &
still playable? · no false shifts? · deterministic? · visible live? · suite + gate green?

---
## Built this pass
- **M2-A — witnesses remember.** `applyDeedCharges` (M1's wrapper) now, after recording a
  deed, emits `npcTrustDelta` for each witness: cruelty/forbidden → trust down, aid/mercy/
  atonement → trust up, magnitude = clamp(round(severity/10 or /12), 1, 3). No witnesses →
  no shift.
- **M2-B — your soul precedes your words.** `socialDC(approach, npc, morality)` now factors
  the player's corruption/virtue: intimidate `-= corr*6` (feared), deceive `+= corr*5`
  (distrusted), charm/persuade `+= corr*6 - virt*4` (corruption repels, virtue draws).
  Threaded from `resolveSocialAdjudication` (party[0].morality). Bounded by the existing
  `Math.max(5, …)` floor.

## Node checks
- M2-A: witnessed torture → all present NPCs' trust 5→3 (sev20→−2); aid → 5→6; ordinary
  action ("examine the door") → no trust change. Node not emptied.
- M2-B (corruption injected cleanly via axisDelta, no combat side effects):
  charm 11→16, persuade 11→16, deceive 11→15 when corrupt (wrath 80); intimidate 11→6;
  virtuous (charity 80) charm 11→8; DC at corruption 100 stays bounded (≤25). Deterministic.
- Tests: U109 (8). Suite **7307 green**; U21 + UX2 + U102 (social) intact; prose gate PASS;
  playtest:quick 0 crashes.

## Live (v1.html, AI on — ss_2642x06zx)
- Clean "charm the trader" → engaged normally. Then "I torture the prisoner / the captive"
  (witnessed). Then "charm the trader" again → **rebuffed in the prose**: "Senna the Crow
  meets your most disarming smile with a cool, appraising look, her merchant's instincts
  cutting through your charm as cleanly as a blade through silk."
- State read back from the save: **trader Senna's trust 5 → 3** (she saw the cruelty),
  player corruption 20. The world went colder because of what you did, in front of her.
  Game played normally, no crash. ✅

## Findings
| check | result |
| --- | --- |
| witnesses remember a deed (cruelty down, aid up) | ✅ live (5→3) + node |
| corruption shifts reception right way | ✅ charm/persuade/deceive ↑, intimidate ↓ |
| virtue eases charm/persuade | ✅ |
| bounded & still playable | ✅ DC capped sane |
| no false shifts on ordinary play | ✅ |
| deterministic / replay-safe | ✅ U109-C + U21 |
| visible live | ✅ charm rebuffed, trust fell |
| suite + gate + crash sweep | ✅ 7307 / PASS / 0 |

## NOT verified / deferred (later M2 slices / M6)
- Rumor minting (reputation travels between towns), faction disposition shifts, help-gating
  (healing/sanctuary/shops), new-NPC starting-trust by reputation — next M2 slices.
- The social mechanics (`[social:…DC]`) line is in the UI's dev layer (not shown to the
  player by default); the DC math is node-verified, the felt effect is live-verified.
- A heavy cruelty can also trigger the core combat/attack path (emptying a node) — separate
  from M2; relevant when sequencing cruelty + social live.

## Verdict: GREEN (slice 1) — the world reads your soul. Witnesses remember what they saw,
and a corrupt reputation precedes your words: the same charm that worked clean is cut down
when you're a known monster, and fear comes easier. "A psychopath is never trusted for
long" — now true in the local loop, live-verified.
