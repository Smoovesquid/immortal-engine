# Playtest — The Pre-Session Punchlist Pass (2026-06-10)

**Build:** v2-polish · **Spec:** docs/PRE_SESSION_PUNCHLIST.md, worked in order.

## Verdict: P1, P2 (both halves), P3, P5, P6 slice 1 — DONE. P4 remains.

| Item | Status | Proof |
|---|---|---|
| **P1 map access** | ✅ | "Map (zoom levels)" in the in-play gear menu → World/Region/Local screen reachable mid-game |
| **P2 greetings** | ✅ | "Hello Aldric" / "Aldric, good morning!" enter dialogue (zero dice); bare "hello"/"hey there" clarify who; reproduced-failing case now impossible |
| **P2 dice audit** | ✅ | 18-utterance corpus: thinking, musing, smiling, gear-fussing, coin-counting all FREE (the physics parser had read "I think about my next move" as forcing a door — "the it" template bug fixed too); climb/sneak/pick-lock/force still roll; "search for hidden tracks" now correctly ROLLS (was a free survey). UX2-13 locks the principle. |
| **P3 sight-scoping** | ✅ | Indoors: "No one else is under this roof." Outdoors: only the social roster — the same people the map draws (now with initial-letter tokens); hostiles become "a stranger keeping to the edges, watching" with a '?' token, and are filtered from social lists |
| **P5 NPCs speak** | ✅ | Direct quoted speech with deterministic variation for share/deflect/withhold/lie/recruit; factIds humanized ("the talk around the well"); UX2-14 locks quoted speech |
| **P6 local voice, slice 1** | ✅ LIVE | `/api/npc-voice` → Ollama (llama3.1:8b present on this machine; `LOCAL_LLM_MODEL=gemma3:12b` to swap). Engine decides share/deflect/lie; model phrases the line; template fallback on any failure, one-strike session cache when Ollama's down. **Live in the UI:** *"There's been talk about water coming out cloudy lately… but I've seen nothing wrong myself," Aldric says, wary.* ~4s/line on 8b (a 4b model would halve it). |
| **P4 morale/last-seen** | ⏳ next | Needs the morale mechanic (foes that break and run) before "last known location" means anything |

## Architecture note (P6)

The fence held as designed: the model is told the DECISION and forbidden
names/places; the engine's trust/fact mechanics are what's canon (the
mechanics line still reads `[dialogue ask | shared | local_house_gossip |
trust:6]`). queryLocal's JSON-schema mode + a one-line/length post-check keep
output bounded. Cost: $0 (local).

## Verification

Suite 7,408 green (UX2 now 15 tests); playtest:quick clean; live UI checks for
P1 (menu), P2 (greeting), P6 (spoken line). Probe corpus runs preserved in
this doc's history and scripts/probes/.
