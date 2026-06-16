// ── GRACEFUL ADJUDICATION ──────────────────────────────────────────────────
//
// The grace layer: pacing, clarification, conversation state.
// Turns the engine from a system into a patient DM.

import { extractIntent, getClarificationPrompt } from '../voice/intentExtraction.js';
import { adjudicate } from '../adjudication/adjudicate.js';
import { exitsFrom, cleanPlaceName } from '../map/mapState.js';

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

// ── Meta-question taxonomy ──────────────────────────────────────────────────
// The gate (isMetaQuestion) and the answerer (handleMetaQuestion) share these
// regexes so they can never drift apart — every question the gate accepts has a
// matching answer branch below. Order of evaluation in the handler matters:
// LOCATION is checked before HEALTH so "what's around" can't be mistaken for a
// status check.
const META_LOCATION = /\bwhere am i\b|what (?:do|can) i see\b|\blook(?:ing)? around\b|\bsurvey\b|what'?s (?:around|here|nearby|out there)\b|who(?:'?s| is) (?:here|around|nearby)\b/;
const META_HEALTH = /\bam i (?:hurt|wounded|damaged|injured|alive|ok|okay|alright|all right|fine|bleeding|dying)\b|\bhow am i (?:doing|holding up|feeling)\b|how(?:'?s| is) my (?:health|hp|status|condition|shape)\b|what(?:'?s| is) my (?:health|hp|status|condition|wounds|shape)\b|how much (?:health|hp|life)\b|\bhow (?:hurt|wounded|injured|bad(?:ly)? (?:hurt|off))\b|how many (?:hit ?points|hp)\b|\b(?:max|maximum)\s+(?:hp|hit\s?points?|health)\b|\bhp\s+(?:total|number|max|cap|count)\b|\bhit\s?points?\b/;
const META_RECAP = /what happened|what did i (?:just )?do\b/;
const META_OUTCOME = /did i (?:succeed|fail|win|lose|make it)\b/;
// v24 conversation hardening — the questions players actually ask. The
// inventory patterns are question/command-anchored so "put it in my pocket"
// (an action) never reads as an inventory check.
const META_INVENTORY = /\bwhat (?:do i have|am i carrying|have i got)\b|\bwhat'?s in my (?:pack|bag|inventory|pockets?)\b|\b(?:check|show|open|look in(?:to)?) (?:my )?(?:pack|bag|inventory|gear|equipment)\b|^\s*inventory\s*\??\s*$/;
// Equipment / "what am I wielding/wearing" / sheet queries — an information
// request, never a dice roll. Answered in-voice from real canon (an empty
// loadout is reported honestly, never invented as "a short sword").
const META_EQUIPMENT = /\bwhat(?:'?s| is)\s+my\s+(?:weapon|blade|sword|armou?r|gear|equipment|loadout)\b|\bname\s+my\s+(?:weapon|blade|sword|armou?r)\b|\bwhat\s+am\s+i\s+(?:wielding|wearing|armed\s+with)\b|\bwhat(?:'?s| is)\s+on\s+my\s+(?:character\s+)?sheet\b|\bwhat\s+(?:weapon|armou?r)\s+(?:do|am)\s+i\b/;
// Character identity / build — "who am I", "what's my class/level", "what are my
// stats". A player learning their own character is an information request, not a
// fiction beat and never a dice roll. Identity is answered in-voice; an explicit
// stats/scores ask gets the actual numbers (it's your own sheet — a table DM tells you).
const META_CHARACTER = /\bwho\s+am\s+i\b|\bwhat(?:'?s| is)\s+my\s+(?:class|archetype|level|background|build|character)\b|\bwhat\s+(?:kind\s+of\s+)?(?:character|class)\s+am\s+i\b|\bwhat\s+am\s+i\b(?!\s+(?:wielding|wearing|carrying|holding|armed|doing|looking|supposed|meant|going|here))|\b(?:what\s+are|tell\s+me|give\s+me|list)\s+my\s+(?:stats|abilities|attributes|scores|ability\s+scores|hp|hit\s?points?|health|numbers)\b/i;
const META_STATS_REQ = /\b(?:stats|attributes|scores|ability\s+scores|hp|hit\s?points?|health|numbers)\b/i;
// Item queries: "what does the Tonic of grit do?", "is the rope in my pack?",
// "do I have a healing potion?". Broad shape — the handler only answers if it
// resolves to a REAL inventory item (else it returns null and falls through, so
// "what does the elder do" isn't mistaken for an item).
const META_ITEM = /\bwhat(?:'?s| does| do| is| are)\s+(?:the|my|a|an|this|that)\s+.+?\s+(?:do|for|good\s+for|used\s+for|used\s+to)\b|\b(?:do i have|have i got|am i carrying|is\s+(?:the|a|an|my)\s+.+?\s+in\s+my\s+(?:pack|bag|inventory|kit|belongings))\b/i;
// Coins/purse — a number the DM owns (read from party.purse).
const META_PURSE = /\bhow many coins\b|\bhow much (?:money|coin|gold|silver|copper|cash)\b|\bwhat(?:'?s| is)\s+in\s+my\s+(?:purse|pouch|coin\s?purse|wallet)\b|\bhow\s+(?:much\s+)?(?:money|coin|gold|silver)\s+(?:do i have|have i got|am i carrying)\b|\bmy (?:purse|coin\s?purse)\b/i;
const META_TIME = /\bwhat time\b|\btime of day\b|\bis it (?:day|night|morning|evening|dark|light)(?:time)?\b/;
const META_OBJECTIVE = /\b(?:what(?:'?s| is| was)? )?my (?:quest|objective|goal|mission|task)\b|\bwhat (?:am i|are we) (?:supposed to|meant to|trying to)\b|\bwhy am i here\b|\bwhat(?:'?s| is) the (?:quest|objective|goal|plan)\b|\bremind me\b/;

// Detect meta-questions (questions about state, not actions)
export function isMetaQuestion(text) {
  const t = String(text || '').toLowerCase();
  return META_LOCATION.test(t) || META_HEALTH.test(t) || META_RECAP.test(t) || META_OUTCOME.test(t)
    || META_INVENTORY.test(t) || META_EQUIPMENT.test(t) || META_CHARACTER.test(t) || META_ITEM.test(t) || META_PURSE.test(t) || META_TIME.test(t) || META_OBJECTIVE.test(t);
}

// A null-action: filler, acknowledgment, or an abort. A real DM lets the
// moment breathe — no roll, no time cost, no consequence. ("wait" and "hold
// on" count: the player is thinking, not acting.)
const NULL_ACTION = /^\s*(?:(?:and|so|well|actually|ok(?:ay)?|uh+|um+|hmm+)[,.\s]+)*(?:hmm+|huh|uh+|um+|ok(?:ay)?|right|cool|nice|yes|no|yeah|nah|wow|whoa|never\s*mind|nm|forget (?:it|that)|nothing|wait|hold on|one (?:sec(?:ond)?|moment|minute)|give me a (?:sec(?:ond)?|moment|minute)|let me think|thinking|\.+|\?+|!+)\s*[.!?…]*\s*$/i;

export function isNullAction(text) {
  return NULL_ACTION.test(String(text || ''));
}

// Question-shaped input that isn't a recognized meta-question. In combat this
// gates the strike-default: a player asking ANYTHING gets an answer, not a
// sword swing. Interrogative opener or a trailing question mark.
const QUESTION_SHAPE = /^\s*(?:what|who|whose|where|when|why|how|which|can|could|should|would|will|do|does|did|am|is|are|was|were|help)\b|\?\s*$/i;

export function isQuestionShaped(text) {
  return QUESTION_SHAPE.test(String(text || ''));
}

// Tier B trigger: a conjunction of two distinct actions ("dive behind the bar
// and shoot the big one"). Deliberately strict — this gates a paid LLM call,
// so single actions, questions, and flavor text must NOT match.
const INTENT_VERB = /(go|head|walk|run|dive|duck|hide|take cover|grab|pick|open|enter|leave|exit|ask|talk|speak|look|search|check|fire|shoot|cast|strike|attack|hit|swing|stab|smite|blast|burn|slay|kill|heal|cure|bless|charm|hold|mock|drink|eat|read|climb|sneak|rest|sleep|loot|pray|wait)/;

export function looksMultiAction(text) {
  const t = String(text || '').toLowerCase();
  if (t.length < 12) return false;
  if (isQuestionShaped(t) && !/\band\b/.test(t)) return false;
  if (/\b(and then|, then)\b/.test(t)) return true;
  const parts = t.split(/\b(?:and|then)\b/);
  if (parts.length < 2) return false;
  return INTENT_VERB.test(parts[0]) && INTENT_VERB.test(parts.slice(1).join(' '));
}

// Answer a question about a specific carried item ("what does X do?", "is X in
// my pack?") from the real inventory. Returns null if no carried item matches,
// so non-item "what does X do" queries fall through to normal resolution.
function answerItemQuery(lowerText, world) {
  const inv = world.party?.[0]?.inventory || {};
  const items = [].concat(
    inv.weapons || [], inv.armor || [], inv.tools || [], inv.clothes || [],
    inv.oddities || [], inv.consumables || [], inv.tech || [], inv.junk || [], inv.items || []
  ).filter(it => it && (it.name || typeof it === 'string'));
  if (!items.length) return null;
  const match = items.find(it => {
    const n = String(it.name || it).toLowerCase();
    if (!n) return false;
    if (lowerText.includes(n)) return true;
    return n.split(/\s+/).filter(x => x.length >= 4).some(tok => lowerText.includes(tok));
  });
  if (!match) return null;
  const name = String(match.name || match).trim();
  const note = String(match.notes || match.note || '').trim().replace(/[.?!]+$/, '');
  const presence = /\b(do i have|have i got|am i carrying|in\s+my\s+(?:pack|bag|inventory|kit|belongings))\b/.test(lowerText);
  if (presence) return `Yes — ${name} is in your pack${note ? `: ${note}.` : '.'}`;
  // effect query
  return note
    ? `${name}: ${note}. It's a real thing in your pack, not a game-piece — nothing special fires when you use it.`
    : `${name} is just what it looks like — no special effect I track.`;
}

// Handle meta-questions (status checks, location surveys, recaps, outcomes).
// Returns null when the text isn't a recognized meta-question.
export function handleMetaQuestion(text, world) {
  const lowerText = String(text || '').toLowerCase();

  // Location / survey — checked first (most specific phrasings).
  if (META_LOCATION.test(lowerText)) {
    return buildLocationSurvey(world);
  }

  // Item query — "what does <item> do?", "is <item> in my pack?". Answered from
  // the REAL pack; returns null (falls through) if no carried item matches.
  if (META_ITEM.test(lowerText)) {
    const ans = answerItemQuery(lowerText, world);
    if (ans) return ans;
  }

  // Purse / coins — a real number the DM owns; report it (even if empty).
  if (META_PURSE.test(lowerText)) {
    const purse = world.party?.[0]?.purse || {};
    const parts = [];
    for (const coin of ['platinum', 'gold', 'silver', 'copper']) {
      const v = Number(purse[coin]) || 0;
      if (v > 0) parts.push(`${v} ${coin}`);
    }
    return parts.length ? `Your purse holds ${joinList(parts)}.` : `Your purse is empty — not a coin to your name.`;
  }

  // Inventory — read the real pack, never invent contents.
  if (META_INVENTORY.test(lowerText)) {
    const inv = world.party?.[0]?.inventory || {};
    const lines = [];
    for (const [cat, items] of Object.entries(inv)) {
      if (!Array.isArray(items) || !items.length || cat === 'items') continue;
      const names = items.map(it => String(it?.name || it)).filter(Boolean);
      if (names.length) lines.push(`${cat}: ${names.join(', ')}`);
    }
    return lines.length
      ? `You go through your pack. ${lines.join('. ')}.`
      : 'Your pack is light — nothing but lint and resolve.';
  }

  // Equipment / sheet — name what's actually equipped, in-voice, no roll. An
  // empty loadout is reported honestly (the DM never invents a weapon you lack).
  if (META_EQUIPMENT.test(lowerText)) {
    const p = world.party?.[0] || {};
    const inv = p.inventory || {};
    const names = (arr) => (Array.isArray(arr) ? arr : []).map(it => String(it?.name || it).trim()).filter(Boolean);
    const weapons = names(inv.weapons);
    const armor = names(inv.armor);
    const sig = String(p.signature?.itemName || '').trim();
    const sigName = sig && !/^thing$/i.test(sig) ? sig : '';
    const parts = [];
    parts.push(weapons.length
      ? `You're armed with ${joinList(weapons)}.`
      : `You bear no weapon worth the name — just your hands and whatever you can lay them on.`);
    if (armor.length) parts.push(`You're wearing ${joinList(armor)}.`);
    else parts.push(`Nothing but your own clothes stand between you and a blade.`);
    if (sigName) parts.push(`And you carry ${sigName}, which means something to you.`);
    return parts.join(' ');
  }

  // Character identity / build — answer who you are from canon. Identity in-voice;
  // an explicit stats ask gets the real scores (your own sheet, no fiction to dodge).
  if (META_CHARACTER.test(lowerText)) {
    const p = world.party?.[0] || {};
    const name = String(p.name || '').trim();
    const arch = String(p.archetype || '').trim();
    const level = Number(p.level) || null;
    const hook = String(p.background?.hook || '').trim();
    const ideal = String(p.traits?.ideal || '').trim();
    const flaw = String(p.traits?.flaw || '').trim();
    const out = [];
    const who = [name && `You're ${name}`, arch && `a ${arch.toLowerCase()}`].filter(Boolean).join(', ');
    out.push((who || "You're yourself") + (level ? ` — and by the count, you're level ${level}` : '') + '.');
    if (hook) out.push(hook.replace(/[.?!]*$/, '.'));
    if (ideal || flaw) out.push(`You hold to ${ideal || 'your own code'}${flaw ? `, for all that you're ${flaw}` : ''}.`);
    if (META_STATS_REQ.test(lowerText) && p.stats && typeof p.stats === 'object') {
      const order = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
      const line = order.filter(k => k in p.stats).map(k => `${k} ${p.stats[k]}`).join(', ');
      if (line) out.push(`Your measures: ${line}.`);
      // Include HP — it's a real, trackable number in escape mode (the rules-
      // lawyer is right that the DM owns it). Don't dodge a stat-block request.
      const eMax = Number(world.meta?.escapeMaxHp) || 0;
      if (world.meta?.mode === 'escape' && eMax > 0) {
        out.push(`Hit points: ${Number(world.meta?.escapeHp) || 0} of ${eMax}.`);
      }
    } else {
      out.push(`The fine print — your scores and your kit — is yours to read on your sheet.`);
    }
    return out.join(' ');
  }

  // Time of day — read the world clock (hours of travel since dawn of day 1).
  if (META_TIME.test(lowerText)) {
    const hours = Number(world.time?.hours) || 0;
    const day = Math.floor(hours / 24) + 1;
    const hourOfDay = (6 + (hours % 24)) % 24; // journeys start at first light
    const seg = hourOfDay < 6 ? 'the small hours' : hourOfDay < 12 ? 'morning' : hourOfDay < 17 ? 'afternoon' : hourOfDay < 21 ? 'evening' : 'deep night';
    return hours > 0
      ? `It's ${seg} — day ${day} of your journey, ${world.time.leagues || 0} leagues behind you.`
      : `It's early — ${seg} of your first day.`;
  }

  // Quest / objective recap — read the scene objective and any active goals.
  if (META_OBJECTIVE.test(lowerText)) {
    const objective = String(world.scene?.objective || '').trim();
    const goals = (Array.isArray(world.goals) ? world.goals : [])
      .filter(g => g && g.status === 'active')
      .map(g => String(g.label || g.kind || '').trim())
      .filter(Boolean);
    const parts = [];
    if (objective) parts.push(`Your aim: ${objective}.`);
    if (goals.length) parts.push(`Open threads: ${goals.slice(0, 3).join('; ')}.`);
    return parts.length ? parts.join(' ') : 'No charge hangs over you yet — your life is your own. See where the road leads.';
  }

  // Health/status check
  if (META_HEALTH.test(lowerText)) {
    // Escape mode runs on classic hit points — answer with the real numbers.
    const escMax = Number(world.meta?.escapeMaxHp) || 0;
    if (world.meta?.mode === 'escape' && escMax > 0) {
      const hp = Number(world.meta?.escapeHp) || 0;
      const frac = hp / escMax;
      const word = frac >= 1 ? 'untouched' : frac > 0.75 ? 'lightly scuffed' : frac > 0.5 ? 'hurting but steady' : frac > 0.25 ? 'in real trouble' : 'one bad blow from the dark';
      return `You're at ${hp} of ${escMax} hit points — ${word}.`;
    }
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

  // What happened — recap the last thing the DM narrated.
  if (META_RECAP.test(lowerText)) {
    const last = world.conversation?.lastNarration;
    if (last) {
      return `Here's what just happened: ${last}`;
    }
    return `Nothing's happened yet. What do you want to do?`;
  }

  // Did I succeed/fail
  if (META_OUTCOME.test(lowerText)) {
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
  // If the name already contains "the" — an epithet ("Brogan the Elder") or a
  // bare title used as a name ("the laborer") — don't append the role, or we get
  // "Brogan the Elder the representative" / "the laborer the laborer".
  if (name && /\bthe\b/i.test(name)) return name;
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
  const placeName = cleanPlaceName(currentNode?.name ?? w.scene?.location ?? '') || 'an unfamiliar place';
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

  // Who's present — SIGHT-SCOPED. Indoors you cannot see the village roster
  // through the walls; you see whoever shares your roof (today: no one is
  // placed in interiors, so the honest answer is the quiet). Outdoors, the
  // social roster (non-hostile) is who's about — the same people the local
  // map draws. Hostiles aren't listed by name: a lurking bandit is not a
  // neighbor; if he's visible at all he reads as a wary stranger.
  const allNpcs = Array.isArray(currentNode?.settlement?.npcs) ? currentNode.settlement.npcs : [];
  // The settlement roster is who's present at this location. Name them whether
  // inside or out — the player can look at / talk to / fight them, so denying
  // they're here ("no one under this roof" with seven NPCs in canon) reads as a
  // hallucinated emptiness (Opus gate). Inside, frame them as in-and-around the
  // place rather than strictly under the roof; hostiles read as wary strangers.
  {
    const sociable = allNpcs.filter(n => n && !n.hostile);
    const lurkers = allNpcs.filter(n => n && n.hostile).length;
    if (sociable.length) {
      const named = sociable.slice(0, 4).map(describeNpc);
      const remainder = sociable.length - Math.min(4, sociable.length);
      if (remainder > 0) named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
      parts.push(insideStructure
        ? `You're not alone — ${joinList(named)} ${sociable.length === 1 ? 'is' : 'are'} about, in and around the place.`
        : `You see ${joinList(named)} here.`);
    } else if (insideStructure) {
      parts.push('No one else is under this roof.');
    }
    if (lurkers > 0) {
      parts.push(lurkers === 1
        ? 'And someone else — a stranger keeping to the edges, watching.'
        : `And ${lurkers} strangers keeping to the edges, watching.`);
    }
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
      const tName = cleanPlaceName(target?.name);
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
