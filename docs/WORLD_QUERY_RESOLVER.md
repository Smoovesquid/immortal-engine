# The World-Query Resolver — place-knowledge schema + the deliver-or-decline mechanism

**Status: design draft, 2026-06-22.** The **category-first** structure for the world-wiring (W-#) track. Write
this riverbed once; let individual questions be water. Pairs with `docs/DEMO_REGION.md` (the content
destination), `docs/CAPABILITY_LEDGER.md` (C4 = the deliver-or-decline capability this generalizes), and the
pivot memory.

---

## §0 — Why this doc exists (the Rung-1 lesson, applied forward)

Rung 1 was built **bottom-up**: a regex per phrasing, the *categories* discovered later, then a long graduation
slog to fold the regex pile into typed handlers. W-1 (place-founding) was, honestly, **one more scattered
detector** — a bespoke regex + lookup for a single question. It de-risked the seam (the world's hidden facts CAN
reach the screen) but it is not the end structure.

**The rule for W-#: settle the category and the mechanism first; let phrasings fall through it.** Adding a kind
of world-knowledge should mean *adding a typed slot to one resolver*, never *writing another handler*.

**Guardrail against the opposite over-correction (speculative architecture):** the schema is **demand-pulled** —
every type below is grounded in a question players *actually* ask (gate transcripts) or that `DEMO_REGION.md`
clearly implies. We do not build a slot until a real question needs it. Category-first, not stockpile-first.

---

## §1 — The key recognition: the resolver already exists in embryo

`commonKnowledgeAnswer(world, npc, text)` (`engine/npc/dialogue.js:199`) is **already a typed resolver.** It
returns `{ mode, body }` for a fixed set of types, each sourced from a real subsystem:

| existing `mode` | answers | data source (already wired) | roll? |
|---|---|---|---|
| `self` | an NPC's own name/trade | `npc.role` + `ROLE_LINES` | no |
| `news` | current rumors | `world.rumors` + `filterRumors` (trust-gated) | no |
| `directions` | where places are / neighbors | `map.nodes` + `exitsFrom` + bearings | no |
| `services` | who sells what / where the work is | `here.settlement.shops` | no |
| `place` | a generic "ground under your feet" blurb | `here.settlement` | no |

And the smoking gun: its `NOT_PLACE_DESCRIPTION_RE` (`dialogue.js:295`) **deliberately excludes**
`founded / built / history / before / who runs / how long / how many / years / elder / stranger / attack / raid`
— i.e. the *real* place-knowledge questions were carved out **because there was no data to answer them.** The
substrate (founding + local-events) and the settlement roster now supply exactly those. **The carved-out
exclusions are the backlog of types to fill.**

So this is not a green-field build. The category-first work is three moves:
1. **Name the full schema** (§2) — the complete set of typed slots + each one's data source + known/unknown boundary.
2. **Unify the entry points** (§3) — today three different code paths deliver grounded facts (the DM-narrator
   W-1 handler in `playloop`, `commonKnowledgeAnswer` in dialogue, and `lookupGroundedFact` behind the rolled
   info-contract). One resolver; both the narrator and an NPC call it.
3. **Fill the carved-out types from data that now exists** (§4 sequence) — founding (W-1, done, to be lifted in),
   then events, population, dangers, … each a slot, never a handler.

---

## §2 — The schema (typed slots of place-knowledge)

A location is **knowable along these axes.** Each is a `type`; the resolver maps any phrasing → a type, then
looks the answer up from that type's source, then delivers-or-declines. `clarity` (vivid/dim/myth) and the
known/unknown boundary come *from the data*, not from the phrasing.

| type | the question | data source | known/unknown boundary | §0 | status |
|---|---|---|---|---|---|
| `founding` | how/why was this place founded/settled | substrate NODE founding event | the label holds CIRCUMSTANCE, never an agent/count → "who founded" declines | safe (substrate labels never name the cosmology) | **W-1 done** (bespoke; lift in) |
| `events` | what happened here / its history | substrate NODE local-events | only events the substrate minted; relational history ("between X and Y") is NOT this type → must still deflect | safe | **W-3 done** |
| `population` | who lives here / who's in town | `settlement.npcs` roster (sociable named; hostiles never named) | only present sociable roster; founder/cause/control/services excluded; no sociable roster → decline | safe | **W-4 done** |
| `trade` | what's sold / what's it known for | `settlement.shops` (+ IG-13 later) | only listed shops; "no counter here" is an honest decline | safe | partly live (`services`) |
| `geography` | what's nearby / where do roads lead | `map.nodes` + `exitsFrom` | only discovered/adjacent nodes | safe | live (`directions`) |
| `rumor` | what's the talk / anything strange | `world.rumors` + `filterRumors` | trust-gated; quiet when none surfaced | **careful** — rumor bodies are folk takes, must stay symptom/ folk-level, never cosmology | live (`news`) |
| `reputation` | what's this place known for | claims/rumor graph (confirm at slice) | only claims on the graph | careful (same as rumor) | TBD (demand-pull) |
| `dangers` | what's dangerous here / recent trouble | threats ledger / `worldTick` (confirm at slice) | only recorded threats | careful (symptoms, never the why) | TBD (demand-pull) |

**Two structural axes the schema makes explicit (decide once, here):**

- **Common-knowledge vs guarded.** `founding / events / geography / trade / population` are **common knowledge** —
  anyone present answers, **no roll**. Pressing an NPC for a *secret/guarded* fact (trust-gated, contested) is a
  *different* category that keeps the existing rolled path (`lookupGroundedFact` → the press model). This is the
  roll/no-roll question W-1 answered implicitly for founding; here it is settled for the whole schema: **deliver
  common knowledge without a roll; reserve rolls for guarded/contested info.** A failed roll must never silently
  eat a common-knowledge answer (the swallow bug W-1 sidestepped).
- **Circumstance vs agent/count.** Many types hold a *circumstance/description* but not a *name or number*
  (founding has the "why," not the "who"; events have the "what," not the "who-with-whom"). The resolver delivers
  the circumstance and **declines the agent/count** — that boundary IS the non-invention rail (C9). It is a
  property of the **data**, uniform across types, not a per-regex special case.

---

## §3 — The resolver (one mechanism)

```
classifyPlaceQuery(text) → { scope: 'here'|namedPlace, type }   // phrasing → type (absorbs phrasings)
resolvePlaceFact(world, type, scope) → { type, body, clarity } | null   // typed lookup from §2 source
                                                                         // null = the data has no answer
```

Deliver-or-decline, uniform:
- `resolvePlaceFact` returns a fact → **deliver it, no roll** (common-knowledge types), at its `clarity`.
- returns `null` → **honest in-character decline** (the existing `declineInfoSeek`, with its polite→curt
  escalation). The data's *absence* is the known/unknown boundary — no invention, ever.

**Both entry points call the same resolver:**
- **DM-narrator** (out of dialogue): the place where W-1's handler sits, *before* the explore floor and *before*
  resolve. Replace the bespoke founding handler with `resolvePlaceFact`.
- **NPC dialogue** (in dialogue): `commonKnowledgeAnswer` *becomes* (or delegates to) `resolvePlaceFact` for the
  place types; the NPC voices the same fact in-character (the `npcSubstrateContext`/voice layer already exists).
  Drop the `NOT_PLACE_DESCRIPTION_RE` carve-outs as each type is filled — but keep deflecting **relational/secret**
  history (C9-002/003 must stay green).

Relationship to the existing info-contract: `lookupGroundedFact` keeps its NPC-knowledge-graph + ledger sources
for *guarded/pressed* facts (the rolled path). `resolvePlaceFact` is the **common-knowledge** sibling that runs
first and no-roll. One shared `declineInfoSeek` for both, so deliver/decline phrasing never diverges.

---

## §4 — §0 is a resolver-level invariant (not a per-type afterthought)

Every `body` the resolver emits passes the hidden-why law: symptoms, faith, rumor — **never the cosmology.** The
substrate-backed types (`founding`, `events`) are safe *by construction* (labels authored never to allude). The
folk-level types (`rumor`, `reputation`, `dangers`) are the watch-points — their bodies are mostly-wrong,
self-interested folk takes (`DEMO_REGION.md` §0/§5), never doctrine. A resolver `body` that names the disease is
a **defect**, like an invented fact. Enforce at the resolver's single output sink (one place, every type).

---

## §5 — How W-1 lifts in (the first behavior-locked refactor)

W-1 stays green the whole way (its corpus is the lock):
1. Add `classifyPlaceQuery` + `resolvePlaceFact` with **one** type registered: `founding` (move
   `PLACE_FOUNDING_QUERY_RE` → the classifier's founding rule; move `nodeFoundingFact` → the founding resolver).
2. Point the DM-narrator handler at `resolvePlaceFact` instead of the inline founding logic. Behavior identical →
   C4-012 / C9-008 stay locked, convergence 96/96, suite 8285/0.
3. *Then* every new type is `register(type, classifyRule, source)` — a slot, not a handler.

After this, "lifting founding into dialogue" (the old "W-2") is **free**: the dialogue path calls the same
`resolvePlaceFact`. The work was never "wire founding into dialogue" — it was "build the resolver; founding and
dialogue both fall out of it."

---

## §6 — Build sequence (demand-pulled)

1. ~~**W-2 = the resolver itself** + lift `founding` in (behavior-locked).~~ **DONE** (`8d63c79`).
2. ~~**W-3 = `events`** ("what happened here") through the resolver — the first *new* type, proving extension is a
   slot; place-anchor guard so relational history (C9-002/003) still deflects.~~ **DONE** (`9c75d3a`) — the diff
   was one slot + one renderer-detail line, thesis proven.
3. ~~**W-4 = `population`** ("who lives here") from the settlement roster.~~ **DONE** (`463538d`) — a
   category-BOUNDARY proof: the type is one slot, the work is the exclusions (founder/cause/control/services/
   leadership/hidden-watcher) + the hostile-never-named safety. `META_NPC_ROSTER` untouched (a future unify target).
4. **NPC-dialogue voicing** (make `commonKnowledgeAnswer` call `resolvePlaceFact`, dropping its
   `NOT_PLACE_DESCRIPTION_RE` carve-outs as types fill) — founding/events/population then voice in-character. **Next.**
5. Now that **3 types are live**, the natural point to **spend a gate** to measure the materialization lift +
   discover the next demand-pulled type.

---

## §7 — Open questions (for Tim)

1. **Resolver home/name.** A new `engine/world/placeQuery.js` (clean module, imported by both `playloop` and
   `dialogue`), vs. growing `commonKnowledgeAnswer` in place. Leaning new module (keeps the unify honest).
2. **How far to generalize now.** The same shape extends to `person`-queries and `object`-queries later. Build
   `place` only (tight, demand-pulled), or name a `WorldQuery` umbrella now and let person/object be future
   scopes? Leaning **place-only now**, umbrella named but not built.
3. **`rumor`/`dangers` §0 risk.** These folk-level types are where a careless body could leak the why. Worth a
   dedicated §0 assertion in the resolver test-set when those slots are filled.
