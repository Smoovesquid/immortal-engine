# Feature — Ridiculous statements get a sarcastic DM — 2026-06-06

Surface: live v1.html (AI on) · Governing: THE_DM_TEST · Voice (Tim's pick): "crotchety
DM aside" — the narrator clocks the absurdity, ribs you dryly, then resolves it in the
fiction. Net (Tim's pick): impossible feats + grandiose boasts + meta/4th-wall pokes.

## What it does
Builds on the impossible-feat gate. `tryRidiculous` (engine/playloop.js), gated before
physics/trivial/social, catches three families and answers with a dry comeback resolved
as a no-effect (no d20, no success/failure tag — so the dice can never contradict the
fiction). Variants per line (deterministic rotation) so repeats don't echo verbatim.

- **Impossible feats:** eat/pull the sun·moon·sky, become a god, reverse time, fly by
  flapping, breathe fire.
- **Grandiose boasts:** "sword of infinite power", "unlimited gold", "strongest in all
  the world", "king of everything".
- **Meta / 4th-wall:** "I'm the DM now", "give me a thousand gold and a legendary sword",
  "I win", "delete the world", "rewrite the rules".

Example comebacks (verbatim, the DM's own voice):
- eat the sun → *"Sure you do. And I'm the Queen of the Faeries. The sun stays its
  comfortable distance off, your arms stay your arms, and the day goes on without you."*
- sword of infinite power → *"A sword of infinite power. Of course. Check your belt — it's
  the same plain gear you walked in with, no more, no less."*
- give me gold + legendary sword → *"Ah, the wishlist approach. It doesn't work that way;
  your purse and your pack are precisely as you left them."*
- I'm the DM now → *"That's adorable. I'll keep this chair, thanks. You're still {name},
  still standing in {place}, still waiting on your next move."*

## Critical fix: sarcasm must survive the AI polish
First live pass: the *sword* comeback came through verbatim, but *"I'm the DM now"* got
silently rewritten by the AI polish layer into an earnest "Milo smiles knowingly…" — the
bite was gone. A sarcastic DM line is the DM's OWN voice; the polish layer must not
earnestly paraphrase it. Fix (public/v1.js): when the mechanics tag is the ridiculous
marker, skip `tryAiNarration` and render the base line verbatim. Re-verified live — both
the DM-claim and sun comebacks now land word-for-word.

## False-positive guards (legit play is NOT caught)
"I draw my sword", "examine the crate", "I want to buy a legendary sword from the
merchant" (buy-guard), "I'm the strongest man in the village" (needs cosmic scope), "I am
the new sheriff" (→ deceive), "I am a powerful mage", "I give the beggar 10 gold" — all
route to normal play. Boast-super fixed to accept "in all the world" (not just "in the
world"); meta-give widened to spelled-out amounts ("a thousand gold") and a wider window.

## Evidence
- Node: every ridiculous family → sarcastic no-effect (no roll); ~19 legit inputs → not
  caught (0 false positives); deterministic; varies on repeat (0 consecutive verbatim).
- Tests: U105 (17, feats) + U106 (24, boasts/meta/sarcasm/variation/no-FP). Suite
  **7261/7261** green; prose gate PASS.
- Live (ss_2249m6rpd): "give me a thousand gold and a legendary sword" and "swallow the
  sun whole" both rendered the sarcastic base VERBATIM, AI-on. ✅

## Verdict: GREEN. Ridiculous statements are identified across feats/boasts/meta and
answered with a realistically sarcastic DM voice that reaches the player intact.
