# Playtest — Conversational Tier B: The Intent Arbiter (2026-06-10)

**Build:** v2-polish · **Spec:** docs/CONVERSATION_PUNCHLIST.md (Tier B)
**Persona:** crusty DM. "A player says one sentence with two beats in it. You run both beats. That's the whole job."
**Surface:** live API probes + live `v1.html` end-to-end multi-action turn. Real key (user-funded, $20 budget — calls gated hard).

## Verdict: GREEN

## What ships

- **`POST /api/intent`** (server-side, env key only — browser never sees it):
  splits ONE multi-action player input into 1–3 atomic commands via Claude
  Sonnet 4.6 with `temperature: 0`, `max_tokens: 150`, a compact system prompt
  carrying real context (combat verbs, foe names, NPCs present). Returns
  `{ok, steps}`; ANY failure returns `ok:false` — never throws to the caller.
- **Client trigger, gated hard** (`looksMultiAction` in gracefulAdjudication,
  unit-tested): a conjunction of two recognized action verbs, ≥12 chars, not a
  bare question. Single actions, questions, and noise never spend a call.
- **Sequential execution:** each step runs through the same deterministic
  `playerMove` path as typed input — the LLM chooses WORDS, the engine rules
  them. The world can interrupt the plan (ambush mid-step, locked ending) and
  the remaining steps are dropped with a beat: "(The rest of your plan will
  have to wait.)"
- **Silent fallback intact:** no key / no server / bad JSON → the original
  text submits exactly as before. Purity rule 4 holds.

## Probe results (real API)

| Input | Steps returned |
|---|---|
| "I dive behind the bar and put a bolt through the big one" (combat; foes bandit, ogre) | `["take cover behind the bar", "fire bolt at the ogre"]` — resolved "the big one" → ogre |
| "go to the tavern and ask the barkeep about rumors" | `["go to the tavern", "ask the barkeep about rumors"]` |
| "dont attack them — take cover and try to talk them down" | `["take cover", "parley with the bandit"]` — **negation respected: no strike step** |

## Live end-to-end (the punchlist's marquee failure)

Typed into the real UI mid-combat: *"I duck behind something and hit the wolf
with sacred flame."* Result: step 1 took cover (player ends the turn "behind
wardrobe"), step 2's sacred flame seared **the wolf** — named targeting
carried through the split — and the round advanced once per step. One
sentence, two beats, both run. No console errors. (/tmp/tierb2.png)

Caught live and fixed during the pass: the trigger verb list lacked
"hit"/"heal"/"smite"-class verbs, so the sentence initially fell back to the
old single-action path (correct fallback behavior, wrong trigger coverage).

## Cost discipline ($20, no auto-reload)

- The arbiter only fires on the multi-action shape — normal play costs $0.
- Each call ≈ 600 input + ≤150 output tokens on Sonnet ≈ $0.004. The whole
  build-and-verify session used well under $0.10.
- **The per-turn narration polish gate was deliberately left key-gated in the
  UI** (`ui.aiKey`) so ordinary play doesn't stream the budget away; enable it
  by entering the key in the AI panel when narration testing is wanted.
- N6 server tests now strip the env key before booting (a dev .env must never
  make the test suite place paid calls — found because two N6 tests started
  "failing" by SUCCEEDING at real narration).

## Still open (Tier C and beyond)

- Clarifying questions on low-confidence splits (Tier C — currently the
  fallback is the deterministic path, which is safe but mute).
- Improvised actions inside steps ("throw my mace") still resolve as standard
  attacks — the deep adjudication engine handles improvisation out of escape
  mode; bridging it in is engine work, not conversation work.
- The arbiter is per-input; conversational MEMORY ("do that again", "the same
  but the other one") needs the transcript in context — a later slice.
