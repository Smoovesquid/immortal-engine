# TABLETOP_FEEL_R7 — Pacing, Grace, Conversation

**Goal:** The game feels like playing at a table with a real DM. Not a computer game. Not canned text. A **conversation between player and engine**.

**Done when:** Pacing implemented, grace working, conversation tested, player feels heard.

---

## The Problem (Why Tabletop Feel Matters)

A mechanically perfect game feels cold:
- "You roll 14 vs DC 10. Success. [Template narration]."
- Everything instant, no breathing room
- Engine responds too fast (feels inhuman)
- No recovery from transcription errors
- No sense that the DM cares about your intent

A game with tabletop feel:
- "Hmm, let me see... [pause] You manage to slip behind the barrel..."
- Delays feel natural
- Engine asks clarifying questions
- Graceful handling of edge cases
- Feels like a real person listening and responding

R7 is the difference between a **system** and a **conversation**.

---

## Four Pillars of Tabletop Feel

### 1. Pacing — Delays Create Space

Real DMs think before responding. The engine should too.

```javascript
// Bad: instant response
roll(world, action); // milliseconds
return narration;

// Good: human-like pacing
await sleep(300); // "thinking" delay
const outcome = computeOutcome(roll, dc);
await sleep(500); // "narrating" delay
return narration;
```

**Timing Guide:**
- Short action (examine, take): 200-400ms
- Decision action (hide, attack): 400-800ms
- Significant action (charge, disengage): 800-1200ms
- Failure needing explanation: 600-1000ms

**Why:** Players perceive delays < 500ms as "instant" (DM processing). Delays 500-1200ms feel "natural" (DM thinking + narrating). Delays > 1500ms feel "slow" (lose momentum).

### 2. Grace — Recover from Edge Cases

Real DMs say "let me re-clarify what you meant" instead of failing silently.

```javascript
const extracted = extractIntent(transcription);

if (extracted.confidence < 0.6) {
  // Low confidence: ask, don't guess
  const clarification = getClarificationPrompt(extracted);
  return {
    type: 'clarification',
    message: clarification,
    suggesting: extracted.intent,
    confidence: extracted.confidence
  };
}

if (!extracted.action && !extracted.target) {
  // Truly incomprehensible: be helpful
  return {
    type: 'confused',
    message: "I didn't catch that. Did you mean something like 'smash the barrel' or 'hide behind the door'?"
  };
}

// Otherwise: proceed with adjudication
return adjudicate(world, extracted.intent);
```

**Grace Rules:**
- Confidence 0.8+: proceed confidently
- Confidence 0.6-0.8: proceed but note uncertainty
- Confidence < 0.6: ask for clarification
- Empty/incomprehensible: offer suggestions

### 3. Conversation — Turn-Taking & Continuity

Real games are back-and-forth. Engine should maintain continuity.

```javascript
// Track conversation state
world.conversation = {
  lastAction: 'smash the barrel',
  lastOutcome: 'success',
  lastNarration: '...',
  pendingClarification: null,
  clarificationAttempts: 0
};

// If player repeats action without speaking new intent
if (transcription === '') {
  // Assume continuation of previous action
  // e.g., "what happened next?" → replay narration
  return world.conversation.lastNarration;
}

// If player clarifies ambiguous action
if (world.conversation.pendingClarification) {
  // Use the clarified intent
  // e.g., "yes, the barrel" → refine last intent
  const refined = refineIntent(world.conversation.pendingClarification, transcription);
  return adjudicate(world, refined);
}

// New action: proceed normally
```

**Conversation Features:**
- Repeat narration on request ("what happened?")
- Clarify previous action ("the barrel, not the chair")
- Question results ("why did I fail?")
- Check status ("am I hurt?")

### 4. Narrative Tone — Voice & Personality

Real DMs have a voice. Narration should reflect mood & world tone.

```javascript
// Tone adjustment based on world state
const tone = computeTone(world);
  // tone.tension = 0-1 (is conflict happening?)
  // tone.wonder = 0-1 (is discovery happening?)
  // tone.dread = 0-1 (is threat present?)
  // tone.hope = 0-1 (is success possible?)

// Apply tone to narration template
const narration = renderTemplate(template, {
  target: obj.name,
  tone: tone
});

// Example:
// tone.dread = 0.9 → slow, careful narration
//   "You carefully, *carefully* slide behind the barrel..."
//
// tone.hope = 0.9 → quick, energetic narration
//   "You dash behind the barrel!"
//
// tone.wonder = 0.9 → reverent, detailed narration
//   "You find yourself behind a peculiar barrel, seeming to shimmer with ancient magic..."
```

---

## Implementation: The Grace Layer

The grace layer sits between voice input and adjudication. It's responsible for turning edge cases into conversation.

```javascript
async function adjudicateWithGrace(world, transcription) {
  // Step 1: Extract intent
  const extracted = extractIntent(transcription);
  
  // Step 2: Check confidence
  if (extracted.confidence < 0.6) {
    // Graceful fallback: ask for clarification
    world.conversation.pendingClarification = extracted.intent;
    world.conversation.clarificationAttempts++;
    
    const clarification = getClarificationPrompt(extracted);
    
    // Pacing: thinking delay
    await sleep(300);
    
    return {
      type: 'clarification',
      message: clarification,
      suggesting: extracted.intent,
      allowRetry: world.conversation.clarificationAttempts < 3
    };
  }
  
  // Step 3: Normal adjudication with pacing
  const delayMs = computePacingDelay(extracted.action);
  await sleep(delayMs);
  
  const result = adjudicate(world, extracted.intent);
  
  // Step 4: Store in conversation state for continuity
  world.conversation.lastAction = extracted.intent;
  world.conversation.lastOutcome = result.mechanics;
  world.conversation.lastNarration = result.narration;
  world.conversation.pendingClarification = null;
  
  // Step 5: Return with pacing markers for client
  return {
    type: 'action',
    narration: result.narration,
    mechanics: result.mechanics,
    world: result.world,
    pacingMs: delayMs
  };
}
```

---

## Pacing Timing Table

```
Action Type          | Thinking Delay | Narration Display | Total
--------------------|----------------|-------------------|-------
Simple interaction   | 200ms          | 400ms             | 600ms
(examine, take)      |                |                   |

Decision action      | 500ms          | 600ms             | 1100ms
(hide, attack)       |                |                   |

Significant action   | 800ms          | 700ms             | 1500ms
(charge, fall)       |                |                   |

Failed action        | 400ms          | 500ms + note      | 900ms+
(requires explanation)|               |                   |

Clarification asked  | 300ms          | 600ms prompt      | 900ms
(low confidence)     |                |                   |
```

---

## Tone Computation

```javascript
function computeTone(world) {
  const threat = world.conductor?.threat?.severity ?? 0; // 0-1
  const discovery = world.conductor?.discovery?.rate ?? 0; // 0-1
  const scars = world.scars?.length ?? 0; // cumulative damage
  const hope = world.party[0]?.health?.current / world.party[0]?.health?.max ?? 1; // 0-1
  
  return {
    tension: threat * 0.7,
    wonder: discovery * 0.8,
    dread: Math.min(1, scars / 10 * 0.6),
    hope: Math.max(0.2, hope) // never fully hopeless
  };
}

// Narration modifiers based on tone
const toneModifiers = {
  'high-dread': {
    prefix: ['carefully', 'slowly', 'with dread'],
    pacing: { delay: 1200, display: 800 },
    voice: 'grave'
  },
  'high-wonder': {
    prefix: ['amazingly', 'with wonder', 'mysteriously'],
    pacing: { delay: 600, display: 700 },
    voice: 'reverent'
  },
  'high-hope': {
    prefix: ['swiftly', 'boldly', 'with confidence'],
    pacing: { delay: 300, display: 400 },
    voice: 'triumphant'
  }
};
```

---

## Conversation State Machine

The game maintains conversational state to enable natural turn-taking.

```
┌─ IDLE
│  (waiting for player input)
│
├─ PROCESSING
│  (extracting intent, rolling)
│  └─ if confidence < 0.6 → CLARIFYING
│
├─ CLARIFYING
│  (asking "did you mean...?")
│  ├─ player clarifies → PROCESSING
│  ├─ player repeats → PROCESSING
│  ├─ player new action → PROCESSING
│  └─ 3 attempts → CONFUSED
│
├─ NARRATING
│  (speaking/displaying result)
│  └─ narration complete → IDLE
│
└─ CONFUSED
   (can't understand)
   └─ after suggestion → IDLE
```

---

## Grace Examples

### Edge Case 1: Ambiguous Target

**Input:** "I want to hide"
**Confidence:** 0.5 (action found, no target)
**Grace Response:**
```
"You want to hide, but behind what? 
 The barrel? The door? Or something else?"
```
**Player can:** "The barrel", "behind the barrel", "there" (contextual)

### Edge Case 2: Garbled Transcription

**Input:** "I want to bloofle the goblmek"
**Confidence:** 0.0 (no action/target found)
**Grace Response:**
```
"I didn't catch that. Did you mean something like:
 - 'smash the goblin'
 - 'hide from the goblin'
 - 'talk to the goblin'?"
```

### Edge Case 3: Contextual Abbreviation

**Input:** "yes" (after being asked "did you mean hide behind the barrel?")
**Confidence:** 0.95 (context + yes = confirmation)
**Proceeding with:** "hide the barrel"
**No clarification needed.**

### Edge Case 4: Status Check

**Input:** "am I hurt?" (during conversation)
**Type:** Meta-question, not action
**Grace Response:**
```
"You're at 23/30 health. A few scrapes but nothing serious."
```
(No dice rolled, just state report)

---

## Testing Strategy

### Unit Tests (Pacing & Grace)
```javascript
// U92-01: computePacingDelay for different actions
// U92-02: computeTone from world state
// U92-03: getClarificationPrompt for low confidence
// U92-04: Conversation state transitions
// U92-05: Meta-question detection
```

### Integration Tests (Grace → Adjudication)
```javascript
// U92-06: Low confidence → clarification asked
// U92-07: Clarification answered → proceeds
// U92-08: Confidence boundary (0.59 vs 0.61)
// U92-09: Repeated action within same turn
// U92-10: Context-aware abbreviation (yes/no)
```

### End-to-End Tests (Full Flow)
```javascript
// U92-11: Voice → clarification → action → narration (paced)
// U92-12: Ambiguous target → clarify → succeed
// U92-13: Garbled input → suggest → player chooses
// U92-14: Tone affects narration style
// U92-15: Conversation state maintained across turns
```

---

## Not in Scope (Polish+)

- **NPC emotion detection** — reading tone from voice
- **Procedural prose variation** — infinite unique narrations
- **Environmental storytelling** — world reacts narratively
- **Character memory** — recalls previous events
- **Narrative branching** — story responds to choices

These are "nice to have" polish. Core R7 is pacing + grace + conversation.

---

## Success Criteria

- [ ] Pacing delays implemented and tuned
- [ ] Grace layer intercepts low-confidence inputs
- [ ] Clarification prompts generated & tested
- [ ] Conversation state maintained
- [ ] Tone computed from world state
- [ ] Narration varies by tone
- [ ] Meta-questions handled (status, rules, etc.)
- [ ] All 15 U92 tests passing
- [ ] Full test suite green
- [ ] Player feels heard, not dismissed

---

## Timeline Estimate

- Pacing implementation: 1 hour
- Grace layer: 1–2 hours
- Conversation state: 1 hour
- Tone computation: 1 hour
- Testing & verification: 2–3 hours
- **Total: 6–8 hours for R7 complete**

---

## What "Tabletop Feel" Means

After R7, the game will have:

✅ **Natural pacing** — Not instant, not slow. Breathing room.  
✅ **Graceful recovery** — Misheard? No problem. We'll clarify.  
✅ **Conversational tone** — Feels like turn-taking with a DM.  
✅ **Adaptive narration** — Voice changes with mood.  
✅ **Context awareness** — Remembers what you just did.  

The player will feel **listened to, not lectured at**. Like the engine cares.

---

## The Goal

> The game should feel like texting with a DM who:
> - Thinks before responding
> - Asks clarifying questions if confused
> - Narrates with feeling appropriate to the moment
> - Remembers what just happened
> - Responds naturally, not formulaically

---

## Git Commit (When Done)

```
feat(feel): R7 tabletop feel — pacing, grace, conversation

- Pacing: Natural delays (200-1200ms) based on action type
- Grace: Low-confidence inputs → clarification instead of failure
- Conversation: State tracking for turn continuity
- Tone: Narration voice adapts to world mood

Turns the engine from a "system" into a "DM".
Player feels heard, not dismissed. Game has rhythm.

U92 tests: 15/15 passing (pacing, grace, conversation)
Full suite: 7056+ tests passing
```

---

## After R7

The game is **mechanically complete and feels human-like**.

- R0–R6: The engine (deterministic, replayable, tactical, voice-native)
- R7: The DM (patient, graceful, conversational, thoughtful)

**Ready to ship.**

