# Playtest — The McCarthy arcs (2026-06-10)

**Build:** v2-polish · **Content:** three Blood Meridian-toned arcs joining The Cold Well.

## Verdict: live and cold.

Played on `v1.html` (seed `live0`): heard the hook rumor — *"A great pale man
has been at Howling Pass, bald as a stone and near seven foot, asking after
birds and old bones. Orla sat with him. Orla has not been right since."* —
greeted Orla, asked about the pale stranger, and got the authored testimony
verbatim, gold-accented, on screen:

> *Orla says, wary: "He sat with me two nights and was courteous the whole
> while. He drew a wren in his book, exact to the feather. Then he wrung the
> bird and burned it and said: whatever in creation exists without my
> knowledge exists without my consent."*

## The three arcs

| Arc | Shape | The McCarthy of it |
|---|---|---|
| **the-judge-passes** | hear of him → sit with him (two testimonies, no fight) | An encounter with a doctrine. No deed, no XP, no loot — you leave knowing what he said, and the county repeats that he will never die. |
| **the-wages-of-blood** | hear the price → meet the broker | The scalp economy. The arc resolves in the MEETING — hearing the terms is the content; taking bounty work afterward is the player's own act, judged by the deed system like any other violence. Ignored: riders sell hair that "never grew on any raider." |
| **what-the-fire-left** | hear the count → stand in the ashes | Witness as deed (`aid`, severity 1). The captain is a fact, not a boss. Ignored: the survivor stops telling it and the talk moves on to the weather. |

## Engine work this content forced (all tested)

- **Verbatim testimony** — arc `knows[].body` now plants on the NPC's
  knowledgeGraph, rides the share outcome as `factBody`, and is spoken
  word-for-word (template and local-LLM paraphrase both bypassed — the
  writer's words are the content). G11-03 locks the wren line.
- **Cross-arc cast exclusivity** — an NPC stars in one arc at a time; the
  cast loop reads live story state so arcs cast in the same tick can't share
  an NPC. Active cap raised 3 → 4 (invariant updated).
- **Bind breadth** — settlements carry 3–5 NPCs from a narrow role pool;
  binds were widened to every fictionally plausible role. On a materialized
  county (3 settlements) all four arcs cast on most seeds (G11-02); dormant
  arcs cast later as new settlements decompress — stories are FOUND by
  traveling, which is the right pacing anyway.

## Verification

Suite 7,422 green (G11 ×5 new); `playtest:full` 500 runs clean; live
screenshot `/tmp/judge-wren-live.png`. No version bump (state shape unchanged).
