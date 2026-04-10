# Immortal Engine — Manual Playtest Checklist

Run through this checklist in the browser at localhost:5179.
Each section has a setup, actions, and expected results.
Mark PASS/FAIL for each item. Any FAIL is a bug to fix.

---

## 1. GAME START

**Setup:** Invoke tab → seed "test1", fate 0.2, Fantasy pack → click Begin.

- [ ] Play tab opens automatically with a wizard narration line
- [ ] Narration is non-empty and references the starting location name
- [ ] If AI key is set: narration is AI-generated (not the flat engine template)
- [ ] Mechanics line visible in `[brackets]` with scene metadata
- [ ] Map tab shows nodes with the player at the starting node
- [ ] Starting node is highlighted or visually distinct

---

## 2. NPC PRESENCE AT SETTLEMENTS

**Setup:** Start a new game. Navigate to a settlement node (or start at one).

- [ ] Settlement node has been decompressed (check: NPCs exist in world state)
- [ ] At least 2 NPCs present at the settlement
- [ ] Each NPC has: name, role, faction, personality axes
- [ ] NPCs are mentioned or reachable in narration when at settlement
- [ ] NPC names are deterministic (same seed → same names)
- [ ] NPCs are visible/referenced on the Map tab when at their settlement
- [ ] Returning to a previously-visited settlement shows the same NPCs (idempotent)

---

## 3. NPC DIALOGUE & PERSPECTIVE

**Setup:** At a settlement with NPCs, interact with them.

- [ ] Talking to an honest NPC (honesty > 0.7) reveals more facts freely
- [ ] Talking to a dishonest NPC (honesty < 0.3) gets evasive/guarded responses
- [ ] NPC with secrets does NOT reveal them on first meeting (low trust)
- [ ] After multiple helpful interactions, NPC trust increases
- [ ] High-trust NPC eventually reveals secrets
- [ ] Two NPCs at the same settlement give different perspectives on the same event
- [ ] If NPC A reveals NPC B's secret, a contradiction is detected
- [ ] Emotional coloring (nervous, evasive, guarded) hints at hidden info
- [ ] NPC dialogue respects the speaker perspective filter (omitted facts stay omitted)

---

## 4. MOVEMENT & MAP

**Setup:** Start a game, then try various movement commands.

- [ ] "go north" / "head east" → moves to a neighboring node
- [ ] "go to [location name]" → moves to the named neighbor
- [ ] Cannot move to non-adjacent nodes (no teleporting)
- [ ] After moving, the Map tab shows the player at the new node
- [ ] Previously visited nodes remain on the discovered list
- [ ] Arriving at a new settlement triggers decompression (NPCs appear)
- [ ] Returning to the starting node works (backtracking)
- [ ] Movement narration references the destination location name
- [ ] Map edges (paths) are visible between connected nodes
- [ ] At least one exit is always available (no dead-end softlock)

---

## 5. DICE RESOLUTION & COMBAT

**Setup:** At any location, try actions that trigger dice rolls.

- [ ] "attack the guard" or similar → triggers a d20 roll
- [ ] Mechanics line shows: `[roll:X vs DC:Y → success/mixed/failure | margin:Z]`
- [ ] Roll is in range [1..30], DC in range [6..20]
- [ ] Success: narration reflects positive outcome, possible advantage token gained
- [ ] Mixed: narration shows partial success with a cost
- [ ] Failure: narration shows consequences (clock bump, wound, stress)
- [ ] Advantage tokens cap at 2 per actor
- [ ] Wounds cap at 6, stress caps at 6
- [ ] High fate (0.8+) produces harder DCs than low fate (0.2)

---

## 6. AI NARRATION

**Setup:** AI tab → paste valid Anthropic key → Set Key → confirm "Key works". Then play.

- [ ] AI key persists across page reload (localStorage)
- [ ] First narration on Begin is AI-generated (not engine template)
- [ ] Each move narration is AI-generated (wait for "Narrating..." to resolve)
- [ ] New Scene narration is AI-generated
- [ ] AI narration references the canonical location name (grounding)
- [ ] AI narration does NOT use banned words ("actually", "turns out")
- [ ] AI narration is exactly one sentence
- [ ] If AI key is removed/invalid, narration falls back to engine output (no crash)
- [ ] With no AI key, engine narration still appears (never blank)

---

## 7. WORLD TICK & LIVING SYSTEMS

**Setup:** Play 10+ turns at various locations. Use New Scene periodically.

- [ ] Clocks (pressure/dread/revelation) change over time (not stuck at 0)
- [ ] Clocks decrease sometimes (relief mechanism fires on success)
- [ ] Clocks never exceed 12
- [ ] Factions have increasing hostility/pressure over time
- [ ] Ecology values (corruption/scarcity/instability) drift upward under pressure
- [ ] Scars appear on nodes when thresholds are crossed (corruption ≥ 70, etc.)
- [ ] Environmental residue (noise/heat/scent/light) from actions decays each tick
- [ ] NPC gossip spreads: NPCs who met the player share facts with neighbors
- [ ] Timeline grows roughly proportional to turns played (not runaway)

---

## 8. THREADS & NARRATIVE ARC

**Setup:** Play 15+ turns, observe thread progression.

- [ ] At least one thread exists after turn 5
- [ ] Thread tension increases over time (visible in mechanics/state)
- [ ] Tension ≥ 3 escalates thread status
- [ ] Inevitability meter rises with unresolved thread tension
- [ ] Inevitability caps at 10 (death spiral prevention)
- [ ] Resolved threads reduce inevitability by 2
- [ ] Confrontation beat fires when highest thread tension ≥ 4
- [ ] No more than 12 threads exist simultaneously
- [ ] Thread labels are pack-appropriate (not generic/empty)
- [ ] At least some threads get resolved over a 30-turn game

---

## 9. SCENE TRANSITIONS

**Setup:** Use the "New Scene" button multiple times.

- [ ] Scene index increments each time
- [ ] New objective appears (from pack or thread)
- [ ] Beat type rotates (quiet → escalation → reveal → confrontation)
- [ ] No 3 identical beat types in a row
- [ ] Emotional tone shifts based on clocks/ecology state
- [ ] Scene tags reflect active threads and scars
- [ ] worldTick fires at scene boundary (factions/ecology update)
- [ ] Narration for new scene is non-empty and grounded

---

## 10. PHYSICAL INTERACTION

**Setup:** At a location with furniture, try physical actions.

- [ ] "examine the table" → describes the table's parts and state
- [ ] "break the table" / "smash the chair" → furniture damaged, part extracted
- [ ] Extracted part appears in inventory
- [ ] "take [small object]" (bulk ≤ 2) → item moves to inventory
- [ ] "take [large object]" (bulk > 2) → rejected with "too heavy"
- [ ] Furniture state persists after interaction (damaged stays damaged)
- [ ] No banned words in physics descriptions ("fortunately", "miraculously", etc.)

---

## 11. ENDINGS

**Setup:** Play 20+ turns or use a high-fate seed to accelerate.

- [ ] Ending triggers after: ≥ 15 turns AND ≥ 1 resolved thread AND inevitability threshold
- [ ] Ending summary includes: type, motif, thread reference, consequences, wounds
- [ ] Ending type matches game state (tragic for high harm, triumphant for low harm)
- [ ] After ending locked: Submit Move button disabled or returns frozen state
- [ ] After ending locked: no further state mutation (clocks, threads, ecology all frozen)
- [ ] New Scene button disabled after ending

---

## 12. SAVE / LOAD / EXPORT

**Setup:** Play several turns, then test persistence.

- [ ] Save works (slot1 in localStorage)
- [ ] "Continue (slot1)" on Invoke tab loads the saved game
- [ ] Loaded game has same world hash as before save
- [ ] Loaded game transcript shows "Welcome back" message
- [ ] Export produces valid JSON
- [ ] Import of exported JSON restores exact world state
- [ ] Old-version saves trigger a console.warn (version upgrade)
- [ ] Settlement NPC data survives save/load round-trip (personality, knowledge, secrets)

---

## 13. DETERMINISM

**Setup:** Start two games with the same seed/fate/pack.

- [ ] Both games produce identical opening narration (engine base)
- [ ] Both games produce identical map (same nodes, edges, names)
- [ ] Both games produce identical NPCs at settlements (same names, roles, personality)
- [ ] Submitting the same move text produces identical resolution
- [ ] World hash matches after identical move sequences
- [ ] No `Math.random()` or `Date.now()` in engine output (seeded RNG only)

---

## 14. EDGE CASES & ERROR HANDLING

- [ ] Empty input → Submit Move does nothing (no crash)
- [ ] Very long input (500+ chars) → processed without crash
- [ ] Rapid Submit Move clicks → no double-processing
- [ ] Refresh page mid-game → game recoverable from slot1
- [ ] AI key with extra whitespace → trimmed and works
- [ ] Invalid AI key → graceful fallback to engine narration
- [ ] Start game with no pack selected → uses fantasy default
- [ ] Map with only 1 node → no crash, movement disabled

---

## Quick Smoke Test (5 minutes)

1. Set AI key in AI tab
2. Begin new game (seed: "smoke", fate: 0.5, fantasy)
3. Verify: opening narration is AI-generated, non-empty
4. Submit: "look around" → verify narration + mechanics
5. Submit: "go north" → verify movement, new location in narration
6. Check Map tab → player position updated
7. Submit: "talk to someone" → verify NPC interaction (if at settlement)
8. Click New Scene → verify scene advances
9. Repeat 5 more moves → verify clocks/threads progressing
10. Save → Refresh → Continue → verify state restored
