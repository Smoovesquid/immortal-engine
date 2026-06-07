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
## Node checks
## Live (screenshots)
## Findings
## NOT verified / deferred
## Verdict: not yet
