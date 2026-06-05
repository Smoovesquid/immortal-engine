// ── GRACEFUL ADJUDICATION ──────────────────────────────────────────────────
//
// The grace layer: pacing, clarification, conversation state.
// Turns the engine from a system into a patient DM.

import { extractIntent, getClarificationPrompt } from '../voice/intentExtraction.js';
import { adjudicate } from '../adjudication/adjudicate.js';
import { exitsFrom } from '../map/mapState.js';

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

  // Compute health from wounds (game's actual model)
  const player = world.party?.[0];
  const wounds = player?.wounds ?? 0;
  const stress = player?.stress ?? 0;
  const level = player?.level ?? 1;

  // Rough max wounds calc: 6 + GRIT mod. Conservative estimate: 10 at level 1.
  // Health is inverse of wounds: 10 wounds = 0 hope. Wounds weighted more heavily than stress.
  const estimatedMaxWounds = 10;
  const woundRatio = Math.max(0, 1 - (wounds / estimatedMaxWounds));
  const stressRatio = Math.max(0, 1 - (stress / 6));
  const health = (woundRatio * 0.7) + (stressRatio * 0.3); // wounds 70%, stress 30%
  const hope = Math.max(0.2, Math.min(1, health)); // 0.2-1

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
    const wounds = party?.wounds ?? 0;
    const stress = party?.stress ?? 0;
    const maxWounds = 10; // conservative estimate

    const totalDamage = wounds + stress;
    const maxDamage = maxWounds + 6;
    const healthPercent = Math.max(0, (1 - (totalDamage / maxDamage)) * 100);

    if (wounds === 0 && stress === 0) {
      return `You're in perfect health. No wounds or strain.`;
    } else if (wounds === 0 && stress <= 2) {
      return `You're mostly fine. A bit stressed but no real injuries.`;
    } else if (wounds <= 3 && stress <= 3) {
      return `You've taken some bumps and bruises (${wounds} wounds, ${stress} stress). Still in decent shape.`;
    } else if (wounds <= 6 || stress <= 5) {
      return `You're hurt (${wounds} wounds, ${stress} stress). Be careful.`;
    } else {
      return `You're badly wounded (${wounds} wounds, ${stress} stress). You need to rest or heal soon.`;
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

  // Where am I — rich, grounded directional survey of surroundings
  if (/where.*i|what.*location|what.*place|look around|what.*see|survey/.test(lowerText)) {
    return buildLocationSurvey(world);
  }

  return null; // not a recognized meta-question
}

// ── Location Survey ─────────────────────────────────────────────────────────
//
// Answers "Where am I?" / "What do I see?" with a grounded survey of the
// player's actual surroundings: place name, who's present, notable structures,
// and exits by compass direction. Reads real world state — never invents
// places, NPCs, or exits that don't exist.

function titleCase(s) {
  const str = String(s || '').trim();
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

// Join a list with commas and a trailing "and": [a,b,c] -> "a, b, and c"
function joinList(items) {
  const arr = items.filter(Boolean);
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
}

function describeNpc(npc) {
  const name = String(npc?.name ?? '').trim();
  const role = String(npc?.role ?? '').trim();
  // If the name already embeds a title (e.g. "Brogan the Elder"), don't append
  // the role — "Brogan the Elder the representative" reads badly. Use the name.
  if (name && / the /i.test(name)) return name;
  if (name && role) return `${name} the ${role}`;
  if (name) return name;
  if (role) return `a ${role}`;
  return 'a stranger';
}

export function buildLocationSurvey(world) {
  const w = world || {};
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const currentNode = nodes.find(n => String(n.id) === nodeId) ?? null;
  const placeName = String(currentNode?.name ?? w.scene?.location ?? '').trim() || 'an unfamiliar place';
  const nodeType = String(currentNode?.nodeType ?? 'wilderness');

  const parts = [];

  // Opening line — interior vs. exterior
  const interior = w.scene?.interior;
  const insideStructure = interior && typeof interior === 'object' && interior.structureKey;
  if (insideStructure) {
    parts.push(`You're inside ${placeName}.`);
  } else {
    const article = /^[aeiou]/i.test(nodeType) ? 'an' : 'a';
    parts.push(`You're in ${placeName}, ${article} ${nodeType}.`);
  }

  // Who's present
  const npcs = Array.isArray(currentNode?.settlement?.npcs) ? currentNode.settlement.npcs : [];
  if (npcs.length) {
    const named = npcs.slice(0, 4).map(describeNpc);
    const remainder = npcs.length - named.length;
    if (remainder > 0) {
      named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
    }
    parts.push(`You see ${joinList(named)} here.`);
  }

  // Notable structures / landmarks at this node
  const structures = Object.values(w.structures?.byId ?? {})
    .filter(s => String(s?.nodeId ?? s?.anchors?.nodeId ?? '') === nodeId)
    .map(s => String(s?.kind ?? 'structure'))
    .filter(Boolean);
  if (structures.length && !insideStructure) {
    const uniq = [...new Set(structures)].slice(0, 4);
    parts.push(`Nearby stand ${joinList(uniq.map(k => `a ${k}`))}.`);
  }

  // Exits by compass direction (grounded in real map geometry)
  if (!insideStructure) {
    const exits = exitsFrom(w.map, nodeId);
    const dirLines = [];
    for (const dir of ['north', 'east', 'south', 'west']) {
      const targetId = exits?.[dir];
      if (!targetId) continue;
      const target = nodes.find(n => String(n.id) === String(targetId));
      const tName = String(target?.name ?? '').trim();
      dirLines.push(tName ? `to the ${dir} lies ${tName}` : `a path leads ${dir}`);
    }
    if (dirLines.length) {
      parts.push(titleCase(joinList(dirLines)) + '.');
    } else {
      parts.push('The way onward is open in every direction, yet uncharted.');
    }
  } else {
    parts.push('The way out leads back to the open air.');
  }

  return parts.join(' ');
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
