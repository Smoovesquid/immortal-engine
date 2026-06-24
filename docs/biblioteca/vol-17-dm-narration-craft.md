# Vol 17 — DM Narration Craft → the Quality Rubric (the voice / table-feel layer)

*Ingested 2026-06-24, DEMAND-PULLED: the Tier-2 quality judge (Vol 16 / `engine/harness/qualityJudge.js`)
was built with three generic criteria leaning on the model's blurry, averaged-internet idea of "a DM," and
the real DM (`augmentNarration`) was emitting stat-dumps and agency violations. Tim's question — "research how
DMs actually talk, would it help?" — is correct: real DM narration is a NAMED, teachable craft, and distilling
it does **double duty** — it sharpens the judge (named criteria are more reliable; Vol 16's Autorubric/RULERS)
AND it fixes the DM system prompt (`buildSystemPrompt`) that generates the prose. This volume is the craft → criterion mapping.*

**Biblioteca / Immortal frontier addendum.**
**Audience:** LLM reader.
**Goal:** distill the craft of DM **narration/voice** (how a DM *describes* outcomes) into named, binary rubric
criteria + DM-prompt guardrails — **scoped to narration only.** The engine owns adjudication (the dice decide,
deterministically); the LLM only voices what happened. So GM *ruling* craft does not transfer; GM *narration*
craft does. Everything is filtered through the invariants (narration ≠ canon, hide-the-math, §0 hidden).

---

## Decision-card — why this matters for Immortal

**Punchline: "how a good DM talks" is a documented system, not vibes** — and naming it is exactly what makes an
LLM judge reliable (Vol 16) *and* what the DM prompt was missing. Four canons converge:
- **PbtA MC agenda + principles** (Apocalypse World, D. Vincent Baker) — a *named* GM-craft system: *address the
  characters not the players · make your move but **never speak its name** · name everyone, make them human ·
  be a fan of the characters · ask provocative questions and build on the answers · barf forth apocalyptica
  (be evocative) · play to find out.*
- **The Angry GM** ("The Art of Narration") — narration is **clear, concise info-delivery + a call to action**:
  ≤~5 short sentences, ≤3 details, **no "filtering"** ("you see that…", "you notice…"), **speak naturally** (not
  Tolkien), and **never narrate the player character** — outcomes and the world only.
- **Keith Johnstone, *Impro*** — **yes-and / don't block the offer**; build with small offers; blocking is
  aggression. → the DM resolves and extends player intent, never flat-stonewalls it.
- **Sly Flourish (Lazy DM)** — the **strong start**; describe **through the characters' eyes**; evocative,
  specific locations.

**The craft → rubric mapping** (the 6 named criteria now in `qualityJudge.js`, each a real principle + the
failure mode it catches):

| Rubric criterion | Craft principle | Failure it catches |
|---|---|---|
| **resolves-the-intent** | Angry GM "a scene is a call to action"; improv "don't block" | the "it goes your way" non-resolution; dodging the player's action with atmosphere |
| **respects-agency** | Angry GM "never narrate the player" | "you turn from the Lingerer", "you decide/feel…" — moving or feeling for the player |
| **no-machine-voice** | PbtA "make your move but never speak its name"; hide-the-math invariant | "forty-four souls", "the economy hums", "State: intact. Parts: lid, hinge, lock" — stats/struct leaking into prose |
| **concise-no-filtering** | Angry GM brevity + filtering rule | purple/Tolkien prose; "you see that…/you notice…" narrative distance |
| **specific-and-grounded** | Sly Flourish "through the eyes"; PbtA "be evocative" | interchangeable filler that would fit any turn |
| **natural-DM-voice** | Angry GM "speak normally" | template / AI-artifact / system-message voice |

**The DM-prompt fixes** (`buildSystemPrompt`, grounded in the same craft, targeting observed failures):
- **HIDE THE MATH** — "any figures/labels given as context (population, economy, faction/tension labels, HP,
  struct phrasing) are background to color the scene, NEVER to recite." (PbtA "never speak its name.") The
  SETTLEMENT DATA block was *feeding* economy/population with no rule against reciting it — the literal source
  of the stat-dump. **Proven live:** the rule eliminated "forty-four souls / the economy hums" across A/B runs.
- **RESPECT AGENCY** — "narrate only the world and the outcome of what the player declared; never their
  decisions, feelings, or undeclared actions." (Angry GM.)

**Why it's invariant-safe:** only the *voice/description* half is imported; the engine still owns every ruling.
Generic DM dogma that contradicts narration ≠ canon / hide-the-math / §0 is discarded. DM advice is partly
contested taste, so the anchor is the authoritative canon **+ our own [[THE_TABLE_TEST]]**, never one school.

**Caveats (binding):**
- **Single-call judging has a halo effect** — a turn the judge dislikes tends to fail on concise+grounded+voice
  together (Autorubric's named warning). The calibration follow-up is per-criterion calls (cost ↔ precision).
- **The judge is a discovery pointer** (Vols 10/14) — quality findings are `quality-*`, human-triage, never
  auto-fixed. It surfaced a real engine routing bug live ("talk to the innkeeper" → narrated the wrong NPC) —
  the kind of thing it's *for*, but the fix is a human/Codex packet, not the loop.

**Reach for it:** tuning the quality-judge rubric (`engine/harness/qualityJudge.js`), editing the DM system
prompt (`buildSystemPrompt` in `engine/llmAdapter.js`), or any narration-voice / table-feel work. Sibling to
Vol 15 (LLM-GM authoring) and Vol 16 (the harness that measures this).

---

## 1. The sources, and what transfers

### 1.1 PbtA — the MC's agenda + principles (the named GM-craft system)
*Citation:* Apocalypse World (D. Vincent Baker, 2010/2nd ed.); lumpley.games "Powered by the Apocalypse."
*Transfers:* the principles ARE a narration rulebook. "Address the characters not the players" → second-person,
in-fiction. "Never speak its name" → hide the mechanics (our invariant, now a prompt rule + the no-machine-voice
criterion). "Name everyone, make them human" → NPCs are people, not roster rows. "Be a fan" / "ask provocative
questions" → the DM serves player agency. *Does NOT transfer:* the MC *moves* that decide outcomes — the engine
owns that deterministically.

### 1.2 The Angry GM — the art of narration
*Citation:* theangrygm.com, "How to Talk to Players: The Art of Narration"; "Barking at Your Players."
*Transfers (verbatim craft):* narration = clear, concise info-delivery + **a call to action**; scene-setting ≤5
short sentences ending on the most pressing problem; ≤3 details (trust the player's imagination); **no
filtering** (give the perception directly); **speak normally, not Tolkien**; **never narrate the player
character**; combat narration snappy and blunt. → criteria: resolves-the-intent, concise-no-filtering,
respects-agency, natural-DM-voice.

### 1.3 Keith Johnstone — *Impro* (the improv backbone)
*Citation:* Johnstone, *Impro: Improvisation and the Theatre* (1979).
*Transfers:* **yes-and / don't block** — accept and extend the player's offer; "blocking is aggression"; build a
story from small offers. → the DM resolves + extends intent (resolves-the-intent), never flat-stonewalls. (The
engine's deliver-or-decline contract is the bounded form of "yes-and.")

### 1.4 Sly Flourish — the Lazy DM (scene craft)
*Citation:* slyflourish.com, *Return of the Lazy Dungeon Master.*
*Transfers:* the **strong start** (open evocatively, in motion); describe **through the characters' eyes**;
specific, evocative locations over generic ones. → specific-and-grounded; the opener-quality bar.

---

## 2. Recommended use in Immortal
1. **The rubric is live** (`qualityJudge.js`, 6 named criteria). Run it via the harness `--real-dm`.
2. **The two prompt guardrails are live** (`buildSystemPrompt`: HIDE THE MATH + RESPECT AGENCY). Measured: the
   stat-dump is gone. The agency rule only partially landed — a candidate for a sharper rephrase + more A/B.
3. **Next levers (demand-pulled, not now):** per-criterion judge calls (halo calibration); a "call to action /
   strong start" prompt nudge; the wrong-NPC routing bug the judge surfaced (engine packet).
4. **Discipline:** the judge measures; humans (or the gated loop on the *deterministic* findings only) fix.
   Taste stays human — a green quality judge means "no craft failures it can name," not "good."

## 3. References
- Apocalypse World — D. Vincent Baker (MC agenda + principles); lumpley.games "Powered by the Apocalypse, part 1"
- The Angry GM — "How to Talk to Players: The Art of Narration"; "Barking at Your Players: Advanced Combat Narration"
- Keith Johnstone — *Impro: Improvisation and the Theatre* (1979)
- Michael E. Shea (Sly Flourish) — *Return of the Lazy Dungeon Master*; "Starting Strong" (slyflourish.com)
- (eval grounding) Autorubric arXiv:2603.00077; RULERS arXiv:2601.08654 — named/atomic rubrics beat vague scores

## 4. Working summary
Real DM narration is a named craft (PbtA principles · Angry GM rules · Johnstone's yes-and · Sly Flourish's
strong start). Scoped to *voice only* (the engine owns rulings) and filtered through the invariants, it distills
into 6 named judge criteria + 2 DM-prompt guardrails. Double duty: it sharpens the test and fixes the DM. Proven
live — the hide-the-math rule killed the stat-dump; the named rubric caught an agency/routing bug the generic
one missed. The judge stays a discovery pointer; taste stays human.
