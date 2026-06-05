// ── GRACEFUL ADJUDICATION ──────────────────────────────────────────────────
//
// The grace layer: pacing, clarification, conversation state.
// Turns the engine from a system into a patient DM.

import { extractIntent, getClarificationPrompt } from '../voice/intentExtraction.js';
import { adjudicate } from '../adjudication/adjudicate.js';

// Compute pacing delay based on action type
export function computePacingDelay(action) {
  if (!action) return 400; // default

  const actionLower = action.toLowerCase();

  // Simple interactions (examine, take, drop)
  if (/examine|look|take|grab|drop|pick/.test(actionLower)) {
    return 300;
  }

  // Decision actions (hide, dodge, run, flee)
  if (/hide|dodge|flee|run|retreat|disengage/.test(actionLower)) {
    return 500;
  }

  // Significant actions (attack, charge, block, defend)
  if (/attack|charge|block|defend|fight|strike|hit/.test(actionLower)) {
    return 700;
  }

  // Social actions (talk, ask, persuade)
  if (/talk|ask|speak|persuade|convince/.test(actionLower)) {
    return 600;
  }

  // Destruction (break, smash, destroy)
  if (/break|smash|destroy|crush|kick|punch/.test(actionLower)) {
    return 600;
  }

  // Default
  return 400;
}

// Compute world tone for narrative voice
export function computeTone(world) {
  if (!world) {
    return {
      tension: 0.5,
      wonder: 0.5,
      dread: 0.2,
      hope: 0.7
    };
  }

  const threat = world.conductor?.threat?.severity ?? 0; // 0-1
  const discovery = world.conductor?.discovery?.rate ?? 0; // 0-1
  const scars = (world.scars?.length ?? 0) / 10; // cumulative damage
  const health = world.party?.[0]?.health?.current ?? 10;
  const maxHealth = world.party?.[0]?.health?.max ?? 10;
  const hope = Math.max(0.2, Math.min(1, health / maxHealth)); // 0.2-1

  return {
    tension: Math.min(1, threat * 0.7),
    wonder: Math.min(1, discovery * 0.8),
    dread: Math.min(1, scars * 0.6),
    hope: hope
  };
}

// Get tone-based narration modifier
export function getToneModifier(tone) {
  const dominantTone = Object.entries(tone).reduce((a, b) =>
    b[1] > a[1] ? b : a
  )[0];

  const modifiers = {
    dread: {
      adjectives: ['carefully', 'slowly', 'warily', 'grimly', 'with trepidation'],
      pace: 'slow',
      intensity: 'grave'
    },
    wonder: {
      adjectives: ['amazingly', 'with awe', 'mysteriously', 'fascinatingly', 'wondrously'],
      pace: 'normal',
      intensity: 'reverent'
    },
    hope: {
      adjectives: ['swiftly', 'boldly', 'confidently', 'eagerly', 'triumphantly'],
      pace: 'quick',
      intensity: 'exultant'
    },
    tension: {
      adjectives: ['tensely', 'sharply', 'urgently', 'frantically', 'desperately'],
      pace: 'quick',
      intensity: 'urgent'
    }
  };

  return modifiers[dominantTone] || modifiers.wonder;
}

// Detect meta-questions (questions about state, not actions)
export function isMetaQuestion(text) {
  const lowerText = text.toLowerCase();

  const metaPatterns = [
    /am i (hurt|wounded|damaged|alive)/,
    /what.*my (health|hp|status|condition)/,
    /how much.*(health|hp)/,
    /what happened/,
    /what did i (do|just do)/,
    /did i (succeed|fail)/,
    /what.*the rules/,
    /can i (do|try)/,
    /where.*i/
  ];

  return metaPatterns.some(p => p.test(lowerText));
}

// Handle meta-questions (status checks, rule questions, etc.)
export function handleMetaQuestion(text, world) {
  const lowerText = text.toLowerCase();

  // Health/status check
  if (/health|hurt|wounded|hp|alive/.test(lowerText)) {
    const party = world.party?.[0];
    const health = party?.health?.current ?? party?.stats?.MIGHT ?? 10;
    const maxHealth = party?.health?.max ?? 30;
    const percent = Math.round((health / maxHealth) * 100);

    if (health === maxHealth) {
      return `You're in perfect health. No injuries.`;
    } else if (health > maxHealth * 0.75) {
      return `You're mostly fine. Just a few scratches (${health}/${maxHealth} health).`;
    } else if (health > maxHealth * 0.5) {
      return `You've taken some damage (${health}/${maxHealth} health). Still in decent shape though.`;
    } else if (health > maxHealth * 0.25) {
      return `You're hurt (${health}/${maxHealth} health). Be careful.`;
    } else {
      return `You're badly wounded (${health}/${maxHealth} health). You need to rest or heal soon.`;
    }
  }

  // What happened
  if (/what happened|what did i do/.test(lowerText)) {
    const last = world.conversation?.lastNarration;
    if (last) {
      return `Here's what just happened: ${last}`;
    }
    return `Nothing's happened yet. What do you want to do?`;
  }

  // Did I succeed/fail
  if (/did i.*succeed|did i.*fail/.test(lowerText)) {
    const outcome = world.conversation?.lastOutcome;
    if (outcome) {
      if (outcome.includes('success')) {
        return `Yes, you succeeded! The action worked.`;
      } else if (outcome.includes('failure')) {
        return `No, you failed. It didn't work out the way you hoped.`;
      } else if (outcome.includes('mixed')) {
        return `Partially. It worked, but not as well as you'd hoped.`;
      }
    }
    return `I'm not sure. What action were you asking about?`;
  }

  // Where am I
  if (/where.*i|what.*location|what.*place/.test(lowerText)) {
    const location = world.scene?.location || 'unknown location';
    return `You're in ${location}.`;
  }

  return null; // not a recognized meta-question
}

// Main grace layer function
export async function adjudicateWithGrace(world, transcription) {
  // Ensure conversation state exists
  if (!world.conversation) {
    world.conversation = {
      lastAction: null,
      lastOutcome: null,
      lastNarration: null,
      pendingClarification: null,
      clarificationAttempts: 0
    };
  }

  // Check for meta-questions first
  if (isMetaQuestion(transcription)) {
    const metaResponse = handleMetaQuestion(transcription, world);
    if (metaResponse) {
      return {
        type: 'meta',
        message: metaResponse,
        world: world,
        isPacing: false
      };
    }
  }

  // Extract intent
  const extracted = extractIntent(transcription);

  // Check confidence
  if (extracted.confidence < 0.6) {
    // Low confidence: ask for clarification
    world.conversation.pendingClarification = extracted.intent;
    world.conversation.clarificationAttempts++;

    const clarification = getClarificationPrompt(extracted);

    return {
      type: 'clarification',
      message: clarification,
      suggesting: extracted.intent,
      confidence: extracted.confidence,
      allowRetry: world.conversation.clarificationAttempts < 3,
      world: world,
      isPacing: false
    };
  }

  // Compute pacing
  const pacingMs = computePacingDelay(extracted.action);

  // Run adjudication
  const result = adjudicate(world, extracted.intent);

  // Ensure conversation state exists in result
  if (!result.world.conversation) {
    result.world.conversation = {
      lastAction: null,
      lastOutcome: null,
      lastNarration: null,
      pendingClarification: null,
      clarificationAttempts: 0
    };
  }

  // Compute tone
  const tone = computeTone(result.world);
  const toneModifier = getToneModifier(tone);

  // Store in conversation state
  result.world.conversation.lastAction = extracted.intent;
  result.world.conversation.lastOutcome = result.mechanics;
  result.world.conversation.lastNarration = result.narration;
  result.world.conversation.pendingClarification = null;
  result.world.conversation.clarificationAttempts = 0;

  // Return with pacing and tone info
  return {
    type: 'action',
    narration: result.narration,
    mechanics: result.mechanics,
    world: result.world,
    tone: tone,
    toneModifier: toneModifier,
    pacingMs: pacingMs,
    isPacing: true,
    confidence: extracted.confidence
  };
}

// Utility: sleep with pacing
export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
