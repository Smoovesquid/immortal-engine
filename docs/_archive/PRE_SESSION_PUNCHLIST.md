# Pre-Session Punchlist — 2026-06-10 (Tim's playtest findings)

Findings from Tim's first real session, investigated and reproduced. Ordered
by how much they'd hurt the next session.

---

## P1 — Map zoom is unreachable during play  ☠ confirmed

The zoom system EXISTS and works (`MapView.js`: World 30k / Region 10k /
Local tabs) — but it lives on the Map screen, reachable only from the topbar,
and **the play screen hides the topbar entirely**. Once you're playing there
is no path to it. Same class of bug as the AI panel (fixed via the gear menu).

**Fix:** add "Map" to the in-play gear menu (one line), and/or make the small
in-play place map clickable to open the full map. Return button comes back to
play with state intact (screen switching already preserves the world).
**Effort:** small.

## P2 — The dice pass: greetings must never roll  ☠ confirmed, reproduced

`"Hello Dalla"` → d20 vs DC 12 → can FAIL: *"It falls short… you're left
where you started."* A failed greeting. ("greet X" auto-succeeds as trivial
but doesn't enter dialogue either.)

**The ruling on when dice are right** (the principle for the whole pass):
a roll needs ALL THREE of — (1) **stakes** (something is lost on a miss),
(2) **uncertainty** (a reasonable DM can imagine both outcomes), (3) **the
fiction resists** (someone/something opposes). Persuading a guard to let you
into the keep: roll. Asking a farmer the way to the well: no roll. Saying
hello: NEVER a roll.

**Fix:** greeting forms ("hello X", "hi X", "hey X", "good morning X",
"X, hello") → enter dialogue with the named NPC, zero dice — same path as
"talk to X". Then a systematic audit: run the probe corpus and flag every
`[roll:]` whose input fails the three-part test (candidates already seen:
"I wonder what my dark fate means" rolls; "talk to <name>" when the parse
misses rolls charm).
**Effort:** greeting fix small; full audit medium (probe + UX2 rows exist).

## P3 — Surveys name people you can't see  ☠ confirmed by Tim

"Look around" lists every NPC in the settlement roster — including while
you're INDOORS, and including people nowhere near you. The map draws up to 8
NPC tokens on settlement place-maps (`placeFromNode.js`), but the survey and
the map don't agree, and indoors you "see" the whole village through walls.

**Fix (two halves):**
1. **Sight-scope the survey**: indoors → only people in the same room/structure
   (usually none — say so: "No one else under this roof"); outdoors → the
   people actually placed on the local map, by name, with a rough bearing
   ("Aldric is over by the well").
2. **Map agreement**: every surveyed person renders as a labeled token on the
   local map (initial + name on hover/tap), so the survey and the picture
   never disagree again.
**Effort:** medium — touches `buildLocationSurvey` + place-map token labels.

## P4 — Fog of war: nodes yes, creatures no

What exists: overworld fog works (nodes are unknown → **sighted** at a
distance → **visited**; commit `3f24d80`). What does NOT exist: creatures
have no map positions at all — combat is theater-of-mind (zones + cover), so
there is no mechanical "he ran behind the tree."

**Tim's ask** — *"Last known location was by that tree. He may be behind it"*
— needs two pieces:
1. **Foes that flee/hide at all** (today they fight to the death — morale is
   the missing mechanic: at low HP, cowardly types break and run).
2. **Last-seen memory**: when a foe breaks sight, the DM narrates last-known
   position against real cover features (the cover system already knows the
   furniture/terrain piece — that's the anchor to name).
**Fix:** a "morale + last-seen" packet: cowardly bestiary tags break at
≤25% HP → DM narrates flight toward a named cover feature → searching/waiting
resolves it (find him, he's gone, or ambush). Genuinely fun mechanic; not a
one-liner.
**Effort:** medium-large. Recommend after P1–P3.

## P5 — NPC dialogue is dull: reported speech instead of SPEECH

Today: *"Elske changes the subject." / "Aldric shares what he knows about
the well."* The trust/brain machinery underneath is good (wants, secrets,
deflection, knowledge graphs) — but it narrates ABOUT the person instead of
letting them talk. A table needs: *"Elske waves it off. 'Roads are roads.
You'll want Rook for that — I keep to my ledgers.'"*

**Fix path A (deterministic, today):** voice templates per role+personality —
deflection/share/greeting lines written as direct speech with slot-ins from
the knowledge graph. Bounded, ships immediately, no model needed.
**Fix path B (the real answer): P6.**

## P6 — Local LLM NPCs (Tim's Gemma idea) — architecture sketch

**The infrastructure already half-exists**: `server/localLlmProvider.js` is
an Ollama client (silent fallback, never throws, health-checked) already used
for NPC brain decisions, rumor garble, and physics detection. Pointing it at
a Gemma-class model is one env var: `LOCAL_LLM_MODEL=gemma3:12b` (or 4b for
speed) with Ollama running.

**Division of labor (the part that keeps it canon-safe):**
- **The engine stays the brain.** Trust math, share/deflect/lie decisions,
  secrets, knowledge-graph access — all deterministic, exactly as now.
- **Gemma is the LARYNX.** It receives a tight persona card (name, role,
  personality floats, mood, want, trust level) + the brain's DECISION
  (deflect / share fact #X / lie about Y) + the last 2-3 exchange lines, and
  returns ONE spoken line executing that decision in character.
- **Anti-hallucination fence:** the prompt includes ONLY whitelisted facts
  (the NPC's knowledge graph entries the brain approved); a post-check
  rejects lines containing place/person names outside the whitelist and
  falls back to the deterministic template. Narration ≠ canon holds: the
  spoken line is presentation; the fact-share event is what's recorded.
- **Fallback chain:** Gemma down → voice templates (path A) → current
  reported speech. Game never blocks on the model.
- **Latency/cost:** local = free and fast enough for dialogue turns
  (1-2s on a 4-12b model); zero spend from the cloud budget.
- **Slices:** (1) Gemma speaks the deflect/share/greet line, template
  fallback; (2) small-talk within whitelist; (3) the brain ITSELF optionally
  upgraded by local model (infrastructure already stubbed in npcBrain).

## Suggested order

P1 (minutes) → P2 greeting fix (minutes) → P3 sight-scoping → P5 path A
voice templates → P2 full dice audit → P6 Gemma slice 1 → P4 morale/last-seen.
