# VOICE_INPUT_R6 — Speech-to-Text Adjudication Pipeline

**Goal:** Player speaks their intent. STT converts to text. Adjudicate processes it. DM narrates back.

**Done when:** STT integration working, intent extraction reliable, 5 voice scenarios tested end-to-end.

---

## The Problem (Why Voice Matters)

Text-based games feel like typing:
- "I try to hide behind the barrel" → click or type
- Still feels like a CRPG, not a tabletop conversation

Voice-first games feel like playing at a table:
- Player speaks: "I want to hide behind that barrel"
- DM (engine) listens and responds with narration
- Feels like a real conversation

R6 bridges that gap: **voice intent → deterministic adjudication → spoken/text response**

---

## Architecture

```
┌─ Player speaks
│  └─ "I want to smash the barrel"
│
├─ Speech Recognition (browser Web Speech API or Whisper API)
│  └─ Transcription: "I want to smash the barrel"
│
├─ Intent Extraction
│  ├─ Remove filler words ("I want to", "I try to")
│  ├─ Extract action verbs (smash, hide, run, etc.)
│  ├─ Extract targets (barrel, door, goblin, etc.)
│  └─ Normalized intent: "smash the barrel"
│
├─ Adjudicate (existing pipeline)
│  └─ Apply rules, roll dice, generate outcome
│
├─ Narration Generation
│  └─ Template-based or LLM-enhanced text
│
├─ Speech Synthesis (browser TTS or API)
│  └─ Speak narration back to player
│
└─ World State Update
   └─ Save position, deltas, timeline entry
```

---

## Intent Extraction

### Filler Words to Remove

```
I want to, I try to, I attempt to, can I, may I,
I would like to, please, let me, I'm going to,
I should, I will, I'll, do I, can you help me,
I think, I guess, maybe, perhaps, let's
```

### Common Action Patterns

```
// Force actions
"smash/break/destroy/crush/kick/punch" + noun
  → extract noun as target

// Finesse actions  
"hide/crouch/dodge/slip/sneak" + noun
  → extract noun as target

// Movement
"run/charge/move/go to" + location
  → extract location

// Interaction
"take/grab/pick up/examine/look at" + noun
  → extract noun as target

// Social
"talk to/ask/tell" + NPC + optional details
  → extract NPC and context
```

### Intent Normalization

```
Input: "I want to smash the wooden barrel"
1. Remove filler: "smash the wooden barrel"
2. Extract action: "smash"
3. Extract target: "barrel" (ignore "wooden")
4. Normalize: "smash the barrel"
5. Feed to adjudicate()
```

---

## STT Implementation (Browser-Based)

### Web Speech API (No Backend)

```javascript
// Modern browsers support native STT
const recognition = new webkitSpeechRecognition();
recognition.lang = 'en-US';
recognition.start();

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  // Process transcript
};
```

**Pros:**
- No backend required
- Works offline
- Low latency (instant recognition)
- Privacy-friendly (stays local)

**Cons:**
- Limited accuracy (no domain-specific training)
- Browser support varies
- No confidence scores

### Anthropic Whisper API (Backend)

```javascript
// For higher accuracy, send audio to Whisper
const formData = new FormData();
formData.append('file', audioBlob);
formData.append('model', 'whisper-1');

const response = await fetch('/api/transcribe', {
  method: 'POST',
  body: formData
});
const { text } = await response.json();
// Process text
```

**Pros:**
- High accuracy (trained on 680K hours of audio)
- Confidence scores available
- Handles accents, background noise better

**Cons:**
- Requires backend + API call
- Higher latency
- API costs

**Recommendation for R6:** Start with Web Speech API for instant prototyping, fallback to Whisper for production quality.

---

## Intent Extraction Algorithm

```javascript
function extractIntent(transcription) {
  let cleaned = transcription.toLowerCase();
  
  // Remove filler words
  const fillers = /\b(i want to|i try to|i attempt to|can i|may i|let me|i'm going to|i would like to|please|i think|maybe|perhaps)\b/g;
  cleaned = cleaned.replace(fillers, '').trim();
  
  // Extract action verb
  const actionRegex = /\b(smash|break|destroy|hide|dodge|run|charge|take|grab|examine|talk to|attack|defend)\b/;
  const actionMatch = cleaned.match(actionRegex);
  const action = actionMatch ? actionMatch[0] : null;
  
  // Extract target (noun after action)
  const targetRegex = /(?:smash|break|hide|take|examine|talk to|attack)\s+(?:the\s+)?(\w+)/;
  const targetMatch = cleaned.match(targetRegex);
  const target = targetMatch ? targetMatch[1] : null;
  
  // Build normalized intent
  const intent = action && target ? `${action} the ${target}` : cleaned;
  
  return {
    original: transcription,
    cleaned,
    action,
    target,
    intent,
    confidence: 0.8 // placeholder
  };
}
```

---

## Speech Synthesis (TTS)

### Web Speech API (Instant)

```javascript
const utterance = new SpeechSynthesisUtterance(narration);
utterance.lang = 'en-US';
utterance.rate = 0.9; // slightly slower for clarity
window.speechSynthesis.speak(utterance);
```

**Simple, low-latency, works in modern browsers.**

### Anthropic Text-to-Speech (Higher Quality)

```javascript
// For professional narration quality
const response = await fetch('/api/tts', {
  method: 'POST',
  body: JSON.stringify({ text: narration })
});
const audioUrl = await response.json();
// Play audioUrl
```

---

## Full Pipeline Example

**Player speaks:** "I want to hide behind that barrel"

```
Step 1: STT
  Input: audio stream
  Output: "I want to hide behind that barrel"

Step 2: Intent Extraction
  Input: "I want to hide behind that barrel"
  Clean: "hide behind that barrel"
  Output: { action: 'hide', target: 'barrel', intent: 'hide the barrel' }

Step 3: Adjudicate
  Input: world, "hide the barrel"
  Processing: 
    - Detect barrel in furniture
    - Find HIDE_BEHIND_POSITIONED ruling
    - Check spatial preconditions (adjacent, blocks LOS)
    - Roll d20 (seeded from world + transcript)
    - Compute outcome
    - Apply deltas (cover condition, AC bonus)
  Output: { world: updated, narration: "You slide behind the barrel, completely hidden.", mechanics: "..." }

Step 4: TTS (Optional)
  Input: "You slide behind the barrel, completely hidden."
  Output: spoken audio
  Player hears the DM's response

Step 5: World Save
  Save updated world state
  Timeline has ruling entry
  Position updated if applicable
```

---

## Intent Confidence & Fallback

When STT produces ambiguous results:

```javascript
if (confidence < 0.6) {
  // Low confidence - ask for clarification
  return {
    type: 'clarification',
    transcription: raw,
    extracted: intent,
    confidence,
    message: "I didn't quite catch that. Did you mean to hide behind the barrel?"
  };
}

if (!action || !target) {
  // Incomplete intent
  return {
    type: 'incomplete',
    message: "I heard you, but I'm not sure what you want to do. Try being more specific."
  };
}
```

**Graceful degradation:** If intent can't be extracted, ask clarifying question rather than guessing.

---

## Determinism Under Voice Input

**Critical constraint:** Voice input must be **deterministic for replay**.

Solution: Store the transcription in the world, not the original audio.

```javascript
// In timeline entry:
{
  kind: 'action',
  data: {
    playerVoiceInput: "I want to smash the barrel",
    transcription: "I want to smash the barrel",
    extractedIntent: "smash the barrel",
    timestamp: 1717641600000,
    // ... rest of ruling data
  }
}

// On replay:
// Use stored transcription, not new STT
const { intent } = extractIntent(timelineEntry.data.transcription);
const result = adjudicate(world, intent);
```

**Result:** Same voice input always produces same outcome, every time.

---

## Testing Strategy

### Unit Tests (Intent Extraction)
```javascript
// U91-01: Remove filler words
// U91-02: Extract action verbs
// U91-03: Extract targets
// U91-04: Handle missing components
// U91-05: Confidence scoring
```

### Integration Tests (Voice → Adjudicate)
```javascript
// U91-06: STT transcription → normalized intent
// U91-07: Intent → adjudicate → narration
// U91-08: Voice determinism (same transcript = same outcome)
// U91-09: Confidence fallback (low confidence → clarify)
// U91-10: Timeline stores voice input for replay
```

### End-to-End Tests (Full Pipeline)
```javascript
// U91-11: Voice input → DM response (smash barrel)
// U91-12: Voice input → DM response (hide behind object)
// U91-13: Voice input → DM response (charge enemy)
// U91-14: Voice input → DM response (ambiguous input)
// U91-15: Voice input deterministic across sessions
```

---

## Integration Points

### In adjudicate.js

```javascript
export function adjudicateFromVoice(world, voiceTranscription) {
  // Extract intent from voice
  const { intent, confidence } = extractIntent(voiceTranscription);
  
  if (confidence < 0.6) {
    return {
      type: 'clarification',
      confidence,
      suggestedIntent: intent,
      message: `Did you mean to ${intent}?`
    };
  }
  
  // Run normal adjudication with extracted intent
  const result = adjudicate(world, intent);
  
  // Store original voice input in timeline
  const lastEntry = result.world.timeline[result.world.timeline.length - 1];
  if (lastEntry?.kind === 'ruling') {
    lastEntry.data.voiceInput = voiceTranscription;
  }
  
  return result;
}
```

### In playloop.js

```javascript
// Instead of text input:
// const action = getUserText();

// Use voice input:
// const transcription = await captureVoiceInput();
// const result = adjudicateFromVoice(world, transcription);
```

---

## Worked Example: Voice Scenario

**Setup:**
```
World: cellar, player near barrel
Player stats: MIGHT 12 (mod +1), AGILITY 11 (mod +0)
Barrel: wooden, adjacent, position (75, 50)
Threat: none currently
```

**Scenario: "I want to smash the barrel"**

```
1. Voice capture
   Raw: "I want to smash the barrel"
   Confidence: 0.95

2. Intent extraction
   Cleaned: "smash the barrel"
   Action: "smash"
   Target: "barrel"
   Normalized: "smash the barrel"

3. Adjudicate
   Detect: barrel found
   Ruling: BREAK (force/MIGHT)
   DC: 10 + 0 (breakability) = 10
   Roll: d20 = 15 (seeded from world + transcription)
   Total: 15 + 1 = 16 vs DC 10 → SUCCESS
   
4. Deltas applied
   - modifyFurniture: barrel damaged
   - createItem: barrel staves (loot)
   - env delta: noise +4

5. Narration
   Template: "You wrench the wooden barrel apart. Splinters spray everywhere."
   
6. Timeline entry
   {
     kind: 'ruling',
     data: {
       voiceInput: "I want to smash the barrel",
       transcription: "I want to smash the barrel",
       extractedIntent: "smash the barrel",
       action: 'smash',
       approach: 'force',
       roll: 15,
       modifier: 1,
       outcome: 'success',
       deltas: [...]
     }
   }

7. TTS (optional)
   Speak: "You wrench the wooden barrel apart. Splinters spray everywhere."
   
8. Player hears DM response
```

---

## Not in Scope (R7+)

- **NPC dialogue** — Interactive conversation with characters
- **Multi-turn conversation** — Follow-up questions, clarifications from engine
- **Emotion detection** — Tone/sentiment from voice
- **Accent training** — Domain-specific speech model

These are R7+ work once core voice input is locked.

---

## Success Criteria

- [ ] Intent extraction working for all common actions
- [ ] STT integration (at least Web Speech API)
- [ ] Voice → adjudicate pipeline end-to-end
- [ ] Determinism verified (same transcription = same outcome)
- [ ] Timeline stores voice input for replay
- [ ] TTS optional (speak narration back)
- [ ] All 15 U91 tests passing
- [ ] Full test suite green
- [ ] 5 voice scenarios tested (smash, hide, charge, take, examine)

---

## Timeline Estimate

- Intent extraction: 1–2 hours
- STT integration: 1 hour (Web Speech) + 2 hours (Whisper fallback)
- Pipeline wiring: 1 hour
- Testing & verification: 2–3 hours
- **Total: 7–9 hours for R6 complete**

---

## Success Metrics

After R6:
- Player can speak intent directly
- Engine understands and responds
- Determinism maintained for replay
- Voice feels like natural conversation
- Ready for R7 (tabletop feel + grace)

**The game is now voice-native.** Text is optional. Speech is the primary input.

