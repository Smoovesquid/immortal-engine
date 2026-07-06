# SEEK-3 — "I go find Carl and greet him" resolves in the fiction (named-person seek)

**Packet:** `docs/PACKETS.md` §SEEK-3. **Tests: U623–U624** (claimed; do NOT run the allocator).
**Governing docs:** `docs/THE_DM_TEST.md` (resolve intent in the fiction, never bounce as
mechanics) · `docs/POSITION_AS_CANON.md` §3 (movement law) · the SEEK-PERSON precedent
(`docs/briefs/SEEK-PERSON-egress.md`, U485–U487 — the generic-person sibling of this fix).

---

## The finding (live, b120 tree, default aldermere/tallow wake interior, LLM-on AND the LLM-off floor)

> "I go find Carl and greet him" → **"That way is blocked from here."**

A blocked-direction dead-end on a named-person seek. Same class as SEEK-PERSON (DM_TEST_DEADEND),
but a DIFFERENT phrasing family: a proper NAME as the seek object, with a compound greet verb.

## DIAGNOSIS — verdict: **pre-existing GAP (case a), not a regression**

### Reproduction (LLM-off, `INTENT_LLM_MODEL=off`, `beginAdventure` → `playerMove`, seed `tallow`)

Boot roster at the wake node `n3_1515674724`: Elske Nightherd, Dalla, Asha, (Ashblade — hostile),
the Lingerer. **Carl is NOT on the roster** — so this utterance is an *absent-name* seek. Observed:

| utterance | narration | correct? |
|---|---|---|
| `I go find Carl and greet him` | "That way is blocked from here." | ✗ (Carl absent → should be honest miss) |
| `I go find Carl` | "That way is blocked from here." | ✗ (compound verb not the trigger) |
| `I go find Asha and greet her` | "A few folk are about — … Who do you want to talk to?" (`[clarify:who]`) | ✗ (Asha NAMED and present → should greet her) |
| `I go find Elske` | "That way is blocked from here." | ✗ |
| `go and see Asha` | a spurious WITS action roll | ✗ |

The named-person seek path is broken **across the board** — present names, absent names, and role/see
phrasings all mis-route. None does what a DM would do: (indoors) step out, approach the named person,
greet them; or, if the name is unknown at the settlement, the honest in-fiction miss.

### Regression test — the utterance at the four playloop bases

`extractFindPersonRef` (the function `approachPresentNpcRef` / `talkOrApproachResolvesPresentNpc`
call to catch "find <person>") is present at all four bases and NONE has a name branch:

| base | commit | `extractFindPersonRef` defined | name branch (`SEEK_PERSON_NAME`) |
|---|---|---|---|
| `311f6847` | JR-HUNT-1 | yes | **no** |
| `64710489` | WIN-EGRESS-1 | yes | **no** |
| `b56a6f1b` | DECL-STAT-1 | yes | **no** |
| `f0897edd` | PW-2 | yes | **no** |

Live check at the EARLIEST base `f0897edd` (real worktree checkout, LLM-off) reproduces the exact
bounce: `"I go find Carl and greet him"` → **"That way is blocked from here."** ⇒ the dead-end
predates today's playloop stack. **Not a regression. Pre-existing gap.**

### The seam (root cause)

1. `extractFindPersonRef` (`engine/playloop.js` ~6052) matches only **generic** referents
   (`SEEK_PERSON_GENERIC_RE` — someone/anyone/local/…) and **roles** (`SEEK_PERSON_ROLE_RE` —
   man/woman/elder/baker/…). **It has no branch for a proper NAME.** So `find Carl` / `find Asha`
   extract nothing.
2. `isSeekPersonIntent` (~6083) likewise requires `SEEK_PERSON_TARGET_RE`, a generic referent — a
   NAME fails it. The SEEK-PERSON bridge (~2293) never fires for a named seek (by design — its
   comment at ~6076 says a NAMED person "falls to the existing approach/talk path").
3. But the "existing approach/talk path" is keyed on `talk to` / `approach` / `greet` / `go over to`
   verbs — NOT the verb **"find"**. So a `find <NAME>` phrasing resolves NEITHER as a seek-person
   NOR as an approach: `approachPresentNpcRef(w, text)` returns null (nothing extracted).
4. With all three guards on the interior-move gate (`playloop.js` ~2069-2070) false
   (`!isSeekPersonIntent && !approachPresentNpcRef && !talkOrApproachResolvesPresentNpc`), the
   `interiorAction.kind==='move'` block runs. `"find Carl"` is read as a room-move to a room named
   "Carl", finds no such adjacent room, and falls to the blocked bank
   (`'Wizard: That way is blocked from here.'`, ~2238).

So `find <NAME>` is the one seek verb that reaches neither the seek-person delivery nor the approach
delivery — it slips through the crack straight into the interior-move blocked bank.

## The fix (SEEK-PERSON's own pattern, extended to names)

Widen the person-seek recognition to a NAMED object: `find <NAME>` / `go find <NAME>` / `look for
<NAME>` / `search for <NAME>` (compound greet/talk verbs included) is a seek that must
1. resolve the NAME against present + node-roster NPCs;
2. if present/reachable: bridge OUT of the interior (egress-door law) → approach → enter the
   greeting in the same turn (honour "and greet him"). No `[clarify:who]`, no blocked-bank, no
   spurious roll;
3. if the name is unknown at the settlement (Carl): the honest in-fiction miss (SEEK-PERSON's
   C9-safe "no one here by that name — you'll have to find them elsewhere"), NEVER a navigation
   refusal, NEVER a "no record" claim, NEVER an invented Carl.

NODE-DESYNC law holds (no silent node move); object/place seeks and contested seeks stay on their
existing paths; determinism ×2.
