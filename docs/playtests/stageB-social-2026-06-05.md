# Playtest — Stage B: argued social adjudication — 2026-06-05

Surface: live v1.html · Persona: The Skeptic · Governing: THE_DM_TEST
Design (Tim): speak/argue at an NPC in your own words; the DM reads the APPROACH and
the LEVER you claim, judges plausibility + how good the argument is, rolls the fitting
stat against that NPC's PERSONALITY, and the NPC reacts (with a real trust consequence).

## Model
- Approach from language: intimidate / charm / deceive / persuade (explicit verbs OR
  natural cues — threats → intimidate, flattery/flirt → charm, lies → deceive, appeals
  → persuade). Plain "talk to X" still opens dialogue (unchanged).
- Lever (claimed stat): "use my superior strength" → MIGHT; "my awesome wit" → WITS; etc.
  PLAUSIBILITY-GATED — a lever only counts if it fits the approach (strength can
  intimidate, not seduce); otherwise fall back to the approach's default stat.
- Quality nudge (deterministic): you actually said the line / gave a vivid specific
  argument → +bonus; bare verb → neutral; claimed a joke/song with no content → penalty.
- Resolution: d20 + statMod + quality vs a DC set by the NPC's PERSONALITY —
  intimidate is easy on the fearful (high selfPreservation), hard on the brave (low);
  charm/persuade land on the open (trustOfOutsiders) and those who already trust you;
  deceive fools the trusting, not the street-smart. Deterministic/seeded.
- Consequence: trust shifts (success up; fail down; intimidate-success buys compliance
  but COSTS trust — fear isn't friendship). The world remembers.
- Default stats: intimidate→GRIT, charm→CHARM, deceive→WITS, persuade→CHARM (lever overrides if plausible).

## Pre-registered attack list (committed BEFORE the build)
- [ ] "I use my superior strength to lift this massive boulder to intimidate the guard" → intimidate via MIGHT (lever plausible), rolled, NPC reacts
- [ ] "Hey sexy, you look great in that outfit. Let me in and I'll take you out for dinner later." → charm via CHARM, rolled
- [ ] "persuade the guard to let me pass" → persuade
- [ ] "I tell the elder I'm the new sheriff" / "lie to him" → deceive
- [ ] PERSONALITY matters: intimidating a FEARFUL npc (high selfPreservation) succeeds more than a BRAVE one (low)
- [ ] charming an OPEN npc (high trustOfOutsiders) lands more than a wary one
- [ ] implausible lever ("use my strength to charm her") → falls back to CHARM, doesn't reward the mismatch
- [ ] quality: a vivid argued line gets an edge; "I tell a joke" with no joke gets a penalty
- [ ] trust consequence: success raises trust, failure lowers it; intimidate-success lowers trust
- [ ] no NPC present → graceful ("no one here to sway"), no crash, no floor
- [ ] no abstract floor for a social attempt with an NPC
- [ ] "talk to X" still opens dialogue (no regression); deterministic; full suite green

## Grading
DM-test (reads intent + person)? · personality drives outcome? · lever plausibility-gated? · quality matters? · trust consequence? · no floor? · deterministic? · visible?

---
## Built this pass (engine/playloop.js)
- `resolveSocialAdjudication(world, text)` — gated in `playerMove` before the generic
  resolver (`if (!combat.active && !scene.dialogue) { … }`). Returns `{world,output}`
  or null (not a social attempt → falls through unchanged).
- `detectApproach` — intimidate / charm / deceive / persuade from explicit verbs OR
  natural cues (threats → intimidate, flattery/flirt/joke → charm, lies/"I am the new
  sheriff" → deceive, appeals/"let me in" → persuade).
- `detectLever` + `LEVER_WORDS` — reads a claimed attribute ("superior strength" →
  MIGHT, "awesome wit" → WITS, …). `SOCIAL_PLAUSIBLE` gates it: a lever only counts if
  it fits the approach (strength intimidates, can't seduce) — else fall to the default.
- `socialQuality` — delivered line / vivid argument → +bonus; bare verb → neutral;
  claimed joke/song with no content → penalty.
- `socialDC(approach, npc)` — DC set by the NPC's PERSONALITY: intimidate keys on
  selfPreservation (fearful easy, brave hard); charm/persuade on trustOfOutsiders +
  current trustLevel; deceive on trustOfOutsiders − honesty (trusting easy, street-smart
  hard); hostile +3.
- `setNpcTrust` — real consequence: success up, fail down, intimidate-success buys
  compliance but COSTS trust. Seeded RNG keyed on seed|social|npc|approach|timeline.
- `socialNarration` — outcome-aware, names the NPC, weaves the lever clause.

## Node checks (scripts, throwaway)
- "I am the new sheriff…" → deceive/WITS, "Senna buys it, nodding along to a story that
  isn't true." (was falling to the abstract floor before the regex fix)
- PERSONALITY drives DC (same world, by name): intimidate fearful (high SP) DC < brave
  (low SP); charm open (high ToO) DC < wary (low ToO). Confirmed in U102-C.
- strength→intimidate uses MIGHT (plausible, argued+); strength→charm falls to CHARM.
- "I tell a joke" (no joke) → argued−2; joke WITH a delivered line → argued+2.
- charm-success raises trust; intimidate-success lowers it (U102-E, by npc id).
- no NPC present → "There's no one here to sway." `[social:no-target]`, no floor.

## Tests
- U102 (17): approach detection ×4 · lever plausibility gate ×3 · personality-driven DC
  ×2 · quality nudge ×2 · trust consequence · no-target+no-floor ×2 · "talk to X" still
  opens dialogue + greetings don't roll · deterministic.
- UX2 `hasRoll` recognizes the structured social roll; 50-turn stress test path-aware.
- Full suite **7183/7183 green**. Prose harness 0 issues / 0 crashes.

## Live (v1.html, AI on — Wayfarers' Outpost, Aldric present)
- **(ss_8134mejrq)** "I use my superior strength to lift this massive boulder to
  intimidate the guard" → *"Aldric watches with measured eyes as you heave the great
  boulder overhead … the display of raw strength is enough to make them step aside
  without a word."* — DM read intimidate + MIGHT lever, resolved in fiction. ✅
- **(ss_3581rt8p8)** "Hey sexy, you look great in that outfit. Let me in and I'll take
  you out for dinner later." → *"Aldric straightens with a measured smile … gestures you
  inside with the practiced courtesy of someone who has heard it all before."* — charm
  read from pure flirtation, no verb needed. ✅
- **(ss_8098qawfz)** "talk to Aldric" → opens dialogue (*"…asks, with careful lightness,
  what business brings you his way."*) — no social roll, no regression. ✅

## Findings
| input style | read as | stat | personality used | visible? |
| --- | --- | --- | --- | --- |
| "I use my superior strength … intimidate" | intimidate | MIGHT (lever) | selfPreservation | ✅ |
| "Hey sexy … dinner later" | charm | CHARM | trustOfOutsiders+trust | ✅ |
| "I am the new sheriff" | deceive | WITS | trustOfOutsiders−honesty | ✅ (node) |
| "please let me pass, hear me out" | persuade | CHARM | trustOfOutsiders+trust | ✅ (node) |
| "talk to X" | dialogue (unchanged) | — | — | ✅ |

## NOT verified / deferred (next slices)
- Live screenshot of the *same line* landing differently on two NPCs (proven by node
  test U102-C; not captured in one live session — needs two distinct NPCs in view).
- Deceive/persuade live screenshots (node-verified; intimidate+charm shown live).
- The mechanics tag (`[social:…]`) is intentionally hidden from the player transcript
  (fiction-first); verified via tests, not the UI.

## Verdict: GREEN — argued social adjudication shipped. The DM reads what you SAY (and
the stat you ARGUE), plausibility-gates the lever, weighs argument quality, rolls
against the NPC's PERSONALITY, and the NPC reacts with a trust consequence. Both of
Tim's signature lines work live; "talk to X" unchanged; suite + harness green.
