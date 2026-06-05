// ── INTENT EXTRACTION ──────────────────────────────────────────────────────
//
// Convert raw voice transcription to normalized action intent.
// Handles filler words, action verbs, targets, and confidence scoring.

// Filler words and phrases to remove
const FILLERS = [
  'i want to',
  'i try to',
  'i attempt to',
  'i would like to',
  'can i',
  'may i',
  'let me',
  "i'm going to",
  'i will',
  "i'll",
  'i should',
  'do i',
  'please',
  'i think',
  'i guess',
  'maybe',
  'perhaps',
  'well'
];

// Action verb mappings to normalized forms
const ACTION_VERBS = {
  // Break/destroy
  smash: 'break',
  break: 'break',
  destroy: 'break',
  crush: 'break',
  shatter: 'break',
  kick: 'break',
  punch: 'break',
  wreck: 'break',
  ruin: 'break',

  // Hide/dodge
  hide: 'hide',
  crouch: 'hide',
  dodge: 'hide',
  slip: 'hide',
  sneak: 'hide',
  creep: 'hide',
  skulk: 'hide',

  // Movement
  run: 'run',
  charge: 'charge',
  rush: 'charge',
  move: 'move',
  go: 'move',
  walk: 'move',
  step: 'move',
  sprint: 'charge',

  // Take/grab
  take: 'take',
  grab: 'take',
  pick: 'take', // "pick up"
  snatch: 'take',
  seize: 'take',
  carry: 'take',

  // Examine
  examine: 'examine',
  look: 'examine',
  inspect: 'examine',
  study: 'examine',
  observe: 'examine',
  check: 'examine',

  // Fire/burn
  fire: 'fire',
  ignite: 'fire',
  burn: 'fire',
  light: 'fire',
  torch: 'fire',

  // Talk/interact
  talk: 'talk',
  speak: 'talk',
  ask: 'talk',
  tell: 'talk',
  converse: 'talk',
  chat: 'talk',

  // Attack
  attack: 'attack',
  hit: 'attack',
  strike: 'attack',
  swing: 'attack',
  stab: 'attack',
  slash: 'attack',

  // Defend
  defend: 'defend',
  shield: 'defend',
  block: 'defend',
  parry: 'defend',

  // Retreat
  retreat: 'disengage',
  flee: 'disengage',
  withdraw: 'disengage',
  back: 'disengage',
  escape: 'disengage',
  disengage: 'disengage',

  // Flank
  flank: 'flank',
  surround: 'flank',
  circle: 'flank'
};

// Articles, demonstratives, and connecting words to remove when extracting targets
const ARTICLES = ['the', 'a', 'an', 'this', 'that', 'these', 'those'];

// Remove filler words from transcription
export function removeFillers(text) {
  if (!text) return '';

  let cleaned = text.toLowerCase().trim();

  // Remove filler phrases
  for (const filler of FILLERS) {
    const regex = new RegExp(`\\b${filler.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  }

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// Extract the primary action verb from text
export function extractAction(text) {
  if (!text) return null;

  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    // Remove punctuation
    const cleanWord = word.replace(/[.,!?;:'"]/g, '');
    if (ACTION_VERBS[cleanWord]) {
      return ACTION_VERBS[cleanWord];
    }
  }

  return null;
}

// Extract the target (noun) from text
export function extractTarget(text) {
  if (!text) return null;

  const cleaned = text.toLowerCase();

  // Common patterns for targets - try to get the last noun-like word
  const patterns = [
    // "break the [adj] barrel" -> barrel (last word after article)
    /(?:break|smash|destroy|crush|hit|attack|examine|take|grab)\s+(?:the\s+)?(?:[a-z]+\s+)?([a-z]+)/,
    // "hide behind the [adj] door" -> door (behind is preposition)
    /hide\s+(?:behind|near|by|in|under)\s+(?:the\s+)?(?:[a-z]+\s+)?([a-z]+)/,
    // "talk to the [adj] goblin" -> goblin
    /talk\s+to\s+(?:the\s+)?(?:[a-z]+\s+)?([a-z]+)/,
    // "run to the [adj] door" -> door
    /run\s+(?:to|toward|towards)\s+(?:the\s+)?(?:[a-z]+\s+)?([a-z]+)/,
    // "move toward the [adj] wall" -> wall
    /move\s+(?:to|toward|towards)\s+(?:the\s+)?(?:[a-z]+\s+)?([a-z]+)/,
    // "charge at the [adj] enemy" -> enemy
    /charge\s+at\s+(?:the\s+)?(?:[a-z]+\s+)?([a-z]+)/,
    // Last noun in sentence (fallback)
    /([a-z]+)\s*$/
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const target = match[1];
      // Filter out articles and common prepositions
      if (!ARTICLES.includes(target) && !['behind', 'near', 'by', 'in', 'under', 'to', 'at'].includes(target)) {
        return target;
      }
    }
  }

  return null;
}

// Calculate confidence of transcription (0-1)
export function scoreConfidence(transcription, cleaned, action, target) {
  let score = 1.0;

  // Reduce confidence if very short (ambiguous)
  if (cleaned.length < 3) score -= 0.4;

  // Reduce confidence if no clear action found
  if (!action) score -= 0.4;

  // Reduce confidence if no target found
  if (!target) score -= 0.3;

  // Reduce confidence if speech had unusual characters/numbers
  if (/[0-9]{2,}/.test(transcription)) score -= 0.1;

  // Clamp to 0-1
  return Math.max(0, Math.min(1, score));
}

// Main intent extraction function
export function extractIntent(transcription) {
  if (!transcription || typeof transcription !== 'string') {
    return {
      original: transcription,
      cleaned: '',
      action: null,
      target: null,
      intent: null,
      confidence: 0
    };
  }

  const cleaned = removeFillers(transcription);
  const action = extractAction(cleaned);
  const target = extractTarget(cleaned);
  const confidence = scoreConfidence(transcription, cleaned, action, target);

  // Build normalized intent
  let intent = null;
  if (action && target) {
    intent = `${action} the ${target}`;
  } else if (action) {
    intent = action;
  } else {
    // If no action found, return original cleaned text
    intent = cleaned;
  }

  return {
    original: transcription,
    cleaned,
    action,
    target,
    intent,
    confidence
  };
}

// Parse intent to determine if it's a movement action
export function isMovement(intent) {
  const movementActions = ['move', 'run', 'charge', 'retreat', 'disengage', 'go'];
  for (const action of movementActions) {
    if (intent?.includes(action)) return true;
  }
  return false;
}

// Parse intent to determine if it involves an object/target
export function hasTarget(intent) {
  return intent && intent.includes('the ');
}

// Parse intent to determine if it's a social action
export function isSocial(intent) {
  const socialActions = ['talk', 'speak', 'ask', 'tell', 'chat'];
  for (const action of socialActions) {
    if (intent?.includes(action)) return true;
  }
  return false;
}

// Parse intent to determine if it's an attack
export function isAttack(intent) {
  const attackActions = ['attack', 'hit', 'strike', 'swing', 'stab', 'slash'];
  for (const action of attackActions) {
    if (intent?.includes(action)) return true;
  }
  return false;
}

// Get clarification prompt if confidence is low
export function getClarificationPrompt(extracted) {
  if (extracted.confidence < 0.6) {
    if (!extracted.action) {
      return "I heard: \"" + extracted.original + "\". What do you want to do?";
    }
    if (!extracted.target) {
      return "You want to " + extracted.action + ", but what's the target?";
    }
    return "Did you mean to " + extracted.intent + "?";
  }
  return null;
}
