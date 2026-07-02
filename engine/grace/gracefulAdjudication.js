// ── GRACEFUL ADJUDICATION ──────────────────────────────────────────────────
//
// The grace layer: pacing, clarification, conversation state.
// Turns the engine from a system into a patient DM.

import { extractIntent, getClarificationPrompt } from '../voice/intentExtraction.js';
import { adjudicate } from '../adjudication/adjudicate.js';
import { exitsFrom, cleanPlaceName } from '../map/mapState.js';
import { statMod } from '../ruleset/core/stats.js';
import { profBonusFor } from '../ruleset/core/levelTable.js';
import { makeRng, seedFromString } from '../rng.js';
import { normalizeTopology, adjacentRooms } from '../structures/topology.js';
import { roomWindows, windowSurveyPhrase } from '../structures/roomWindows.js';
import { occupantsOfRoom, outdoorOccupants } from '../structures/roomOccupancy.js';
import { objectsHere } from '../structures/roomObjects.js';
import { reachableRooms } from '../movement/interiorMovement.js';
import { playerAc, meleeProfile } from '../combat/escapeCombat.js';
import { purseTotalCopper, formatPrice } from '../economy/shop.js';
import { fateBand } from '../rulesets.js';
import { getItemDef, findDefByName } from '../ruleset/core/items/index.js';

// Canonical stat names (bare "my X" is unambiguous for game-native names).
const META_STAT = /\b(?:what(?:'?s| is)\s+my\s+|my\s+)(might|agility|wits|grit|charm)(?:\s+(?:modifier|mod|score|stat|number|bonus))?\b/i;
// D&D synonym names — require explicit query prefix to avoid catching physical-
// action text ("I swing with all my strength"). "give me strength" also fires.
// Also includes abbreviations: STR/DEX/CON/INT/WIS/CHA (H-17, Rung-1 2026-06-18).
const META_STAT_SYNONYM = /\b(?:what(?:'?s| is)\s+my\s+|give\s+me\s+(?:my\s+)?)(str|strength|dexterity|dex|intelligence|int|wisdom|wis|constitution|con|charisma|cha)(?:\s+(?:modifier|mod|score|stat|number|bonus))?\b/i;
// Map D&D synonym → this game's stat key. str added (H-17).
const STAT_SYNONYMS = { str: 'MIGHT', strength: 'MIGHT', dexterity: 'AGILITY', dex: 'AGILITY', intelligence: 'WITS', int: 'WITS', wisdom: 'WITS', wis: 'WITS', constitution: 'GRIT', con: 'GRIT', charisma: 'CHARM', cha: 'CHARM' };
function resolveStatKey(raw) { return STAT_SYNONYMS[raw.toLowerCase()] || raw.toUpperCase(); }
function fmtMod(m) { return m >= 0 ? `+${m}` : `${m}`; }

// The displayed ability-score→modifier breakpoint table, GENERATED from the
// real `statMod` function so the printed chart can never drift from the engine's
// actual math. Consecutive scores sharing a modifier collapse into a range,
// across the realistic ability band (3–18, the 4d6-drop-lowest span). Replaces
// a hand-written string that started at 9 and omitted the low scores — which
// read self-contradictory next to a character whose scores were 6 and 8 (the
// "9 → −1" chart had no entry for 6 or 8, yet the measures line correctly showed
// 6 → −2 and 8 → −1). A Rules-Lawyer who demands "the full breakpoint chart down
// to 6" now gets a complete, internally-consistent table. (D-B4 gate residual a.)
function modifierBreakpointTable(lo = 3, hi = 18) {
  const groups = [];
  for (let s = lo; s <= hi; s++) {
    const m = statMod(s);
    const last = groups[groups.length - 1];
    if (last && last.mod === m) last.hi = s;
    else groups.push({ lo: s, hi: s, mod: m });
  }
  return groups
    .map(g => `${g.lo === g.hi ? g.lo : `${g.lo}–${g.hi}`} → ${fmtMod(g.mod)}`)
    .join(', ');
}

// H-25 (Opus gate 06-18): a player asking for their OWN number — a D&D SKILL
// modifier ("what's my Insight modifier? I need a number"), their attack
// modifier, or a bare DC — must get the number, never an atmosphere deflection.
// Skill → governing game-stat, mirroring resolve.js (FOCUS_APPROACH→statForApproach)
// so the reported modifier matches what the engine actually rolls.
// "tracking" added (H-40): a real skill word missing from this list fell
// through to the generic modifier-formula handler and leaked the raw
// breakpoint table instead of a clean number — see answerSkillModifier below.
const SKILL_STAT = {
  athletics: 'MIGHT', intimidation: 'MIGHT',
  stealth: 'AGILITY', acrobatics: 'AGILITY', sleight_of_hand: 'AGILITY',
  insight: 'CHARM', persuasion: 'CHARM', deception: 'CHARM', performance: 'CHARM',
  survival: 'GRIT', medicine: 'GRIT', nature: 'GRIT',
  arcana: 'WITS', investigation: 'WITS', perception: 'WITS', tracking: 'WITS', history: 'WITS', religion: 'WITS'
};
// Match "what's my <skill> modifier/mod/bonus/number/check" / "give me my <skill>".
// "sleight of hand" is normalized to the focus key sleight_of_hand below.
const META_SKILL_MOD = /\b(?:what(?:'?s| is)\s+my\s+|my\s+|give\s+me\s+(?:my\s+)?)(athletics|intimidation|stealth|acrobatics|sleight\s+of\s+hand|insight|persuasion|deception|performance|survival|medicine|nature|arcana|investigation|perception|tracking|history|religion)(?:\s+(?:modifier|mod|bonus|number|score|check|skill))?\b/i;
// Attack/to-hit modifier — "what's my attack modifier", "my to-hit bonus", "what's my
// total attack bonus", "what goes into an attack roll", "attack roll formula". (H-61:
// widened beyond the strict "my attack <noun>" possessive to catch the same intent
// phrased as a bare "how does this work" rules question.)
const META_ATTACK_MOD = /\b(?:what(?:'?s| is)\s+(?:my\s+|the\s+)?(?:total\s+)?|my\s+(?:total\s+)?|give\s+me\s+(?:my\s+|the\s+)?)(?:attack|to[-\s]?hit)\s+(?:modifier|mod|bonus|number|roll)\b|\bwhat\s+goes\s+into\s+(?:an?\s+)?attack\s+roll\b|\battack\s+roll\s+formula\b/i;

// (gate-18, Rules-Lawyer) "what's my proficiency bonus / give me my proficiency bonus
// as a flat number / is the Worn Blade one I'm trained with" — the PROFICIENCY value is
// modeled (levelTable.profBonus; +2 at L1) but had no META pattern, so it fell to a gen
// roll / observe / decline. Answered straight from the sheet, never rolled.
const META_PROFICIENCY = /\b(?:proficiency|prof)\s+(?:bonus|modifier|mod)\b|\bwhat(?:'?s| is)\s+my\s+proficiency\b|\bmy\s+proficiency\s+bonus\b|\bproficiency\s+bonus\b/i;

// ── H-61: typed rules-question classifier (C5 graduation) ──────────────────
// Second typed-packet graduation (mirrors H-59's compound-decomposition
// approach). A rules/mechanic question must be answered straight from
// ground truth, never resolved as a die roll. Rather than chase every
// surface phrasing with its own detector, classify WHICH rule is being
// asked about (governing-stat-for-skill here; damage-modifier and
// attack-formula already lived as META_DAMAGE_RULE/META_ATTACK_MOD above)
// and answer from the same sources resolve.js/escapeCombat.js actually use.

// "which stat governs tracking" — the SKILL half. Reuses the same skill
// vocabulary as SKILL_STAT/META_SKILL_MOD so a skill missing from one is
// never silently missing from the other. "track"/"tracking" both fire (a
// verb-form ask — "if I want to track someone which stat is it" — names no
// noun-form skill word).
const SKILL_TOKEN_RE = /\b(?:track(?:ing)?|athletics|intimidation|stealth|acrobatics|sleight\s+of\s+hand|insight|persuasion|deception|performance|survival|medicine|nature|arcana|investigation|perception|history|religion)\b/i;
// The CUE half — a question genuinely asking WHICH stat governs a skill,
// not a player naming a skill in passing ("are you tracking damage?",
// "tell me the village's history"). Checked as a separate, independent
// regex (not anchored adjacent to the skill word) so phrasing order never
// matters — "what stat for tracking" and "tracking — what's the stat"
// both fire. Never matches a bare skill mention alone.
const STAT_QUESTION_CUE_RE = /\bwhat\s+stat\b|\bwhich\s+stat\b|\bwhich\s+ability\b|\bwhat\s+ability\b|\bgovern(?:s|ing)?\b|\bconfirm\s+the\s+stat\b|\bdo\s+i\s+roll\s+(?:might|agility|wits|grit|charm)\b|\bis\s+(?:it\s+)?(?:a\s+)?(?:might|agility|wits|grit|charm)\s+check\b|'s\s+(?:might|agility|wits|grit|charm)\b/i;

function isGoverningStatQuestion(lowerText) {
  return SKILL_TOKEN_RE.test(lowerText) && STAT_QUESTION_CUE_RE.test(lowerText);
}

// Resolve the skill word actually present to its SKILL_STAT key — "track"
// normalizes to "tracking" (the SKILL_STAT entry), every other token is
// already a key. Returns null when no recognized skill is present (should
// never happen when isGoverningStatQuestion already passed).
function resolveSkillKeyFromText(lowerText) {
  const m = lowerText.match(SKILL_TOKEN_RE);
  if (!m) return null;
  const raw = m[0].toLowerCase().replace(/\s+/g, '_');
  const key = raw === 'track' ? 'tracking' : raw;
  return key in SKILL_STAT ? key : null;
}
// Bare DC ask with no declared check — "give me the DC", "what's the DC", "what DC".
// (Explicit "make a WITS check" DCs are handled by META_EXPLICIT_CHECK below.)
const META_BARE_DC = /\b(?:give\s+me|what(?:'?s| is)|tell\s+me)\s+(?:the\s+)?dc\b|\bwhat\s+dc\b/i;

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
export const META_LOCATION = /\bwhere am i\b|what (?:do|can) i see\b|\blook(?:ing)? around\b|\bsurvey\b|what'?s (?:around|here|nearby|out there)\b|who(?:'?s| is) (?:here|around|nearby)\b/;
// A clear MOVEMENT-to-a-place intent (motion verb + spatial preposition) is an ACTION,
// not a location survey — even when it trails a perception clause ("head toward the
// front doorway TO SEE what's out there", "head back through the doorway and look for
// the passage"). Without this, META_LOCATION's "what's out there"/"who's here" swallowed
// the move and answered with a static bearings recap, so the player never moved (a
// soft-lock in the whole-building playthrough). Narrow by design: a bare survey ("look
// around", "where am I", "who's here") has no motion-verb+preposition, so it stays meta.
export const META_MOVE_TO_PLACE = /\b(?:go|goes|going|head|heads|heading|walk|walks|walking|move|moves|moving|step|steps|stepping|push|pushes|pushing|stride|strides|creep|creeps|slip|slips|duck|ducks|cross|crosses)\b[\s\S]{0,40}?\b(?:through|toward|towards|into|out\s+to|over\s+to|back\s+(?:through|toward|towards|into))\b/;
// INTERIOR-LAYOUT QUESTION — "are there other rooms?", "is there another doorway?",
// "what other exits are there?", "check if there are doorways I missed". The engine KNOWS
// the answer (the topology is finite and known), so a real DM answers from the map — never
// a d20 roll ("the outpost doesn't give it to you"), a wrong object-presence reply ("no
// rooms here, what's here is a pallet"), or an accidental MOVE. Routed to the location
// survey (which lists the real doorways). Requires an INTERROGATIVE/SEEKING lead, so the
// imperative "go to the other room" (a move) is NOT caught.
export const META_INTERIOR_LAYOUT =
  /\b(?:are there|is there|are any|is any|any other|any more|what other|how many|did i miss|have i (?:missed|seen)|do i see|where (?:are|do))\b[\s\S]{0,30}\b(?:rooms?|doorways?|doors?|exits?|passages?|chambers?|ways? (?:out|on|in))\b/i;
const META_INTERIOR_LAYOUT_SEEK =
  /\b(?:check|look|search|find)\b[\s\S]{0,25}\b(?:other|more|another|hidden|any|missed|remaining)\b[\s\S]{0,15}\b(?:rooms?|doorways?|doors?|exits?|passages?|chambers?)\b/i;
const META_HEALTH = /\bam i (?:hurt|wounded|damaged|injured|alive|ok|okay|alright|all right|fine|bleeding|dying)\b|\bhow am i (?:doing|holding up|feeling)\b|how(?:'?s| is) my (?:health|hp|status|condition|shape)\b|what(?:'?s| is) my (?:health|hp|status|condition|wounds|shape)\b|how much (?:health|hp|life)\b|\bhow (?:hurt|wounded|injured|bad(?:ly)? (?:hurt|off))\b|how many (?:hit ?points|hp)\b|\b(?:max|maximum)\s+(?:hp|hit\s?points?|health)\b|\bhp\s+(?:total|number|max|cap|count)\b|\bhit\s?points?\b|\bmy\s+(?:current\s+)?hp\b/;
export const META_RECAP = /what happened|what did i (?:just )?do\b/;
const META_OUTCOME = /did i (?:succeed|fail|win|lose|make it)\b/;
// v24 conversation hardening — the questions players actually ask. The
// inventory patterns are question/command-anchored so "put it in my pocket"
// (an action) never reads as an inventory check.
// The "what ... am I carrying" form allows up to 4 intervening words so a
// named-noun ask ("what GEAR AND WEAPONS am I carrying") still matches, not
// just the bare contiguous form. (H-37 R1)
// "am i (even/really/just…) carrying" — a filler adverb between "i" and
// "carrying" used to break the trigger, mis-routing "what am I even carrying?"
// to META_CHARACTER's identity answer (gate-5 deflect-to-sheet). (N-1)
const META_INVENTORY = /\bwhat (?:do i have|am i (?:even |really |actually |just |still |currently )?carrying|have i got)\b|\bwhat\s+(?:\w+\s+){1,4}(?:do i have|am i (?:even |really |actually |just |still |currently )?carrying|have i got)\b|\bwhat'?s in my (?:pack|bag|inventory|pockets?)\b|\b(?:check|show|open|look in(?:to)?) (?:my )?(?:pack|bag|inventory|gear|equipment)\b|^\s*inventory\s*\??\s*$|\blist\s+(?:every|all|my|each)\s+(?:item|thing|piece|bit)s?\b/;
// Equipment / "what am I wielding/wearing" / sheet queries — an information
// request, never a dice roll. Answered in-voice from real canon (an empty
// loadout is reported honestly, never invented as "a short sword").
const META_EQUIPMENT = /\bwhat(?:'?s| is)\s+my\s+(?:weapon|blade|sword|armou?r|gear|equipment|loadout)\b|\bname\s+my\s+(?:weapon|blade|sword|armou?r)\b|\bwhat\s+am\s+i\s+(?:wielding|wearing|armed\s+with)\b|\bwhat(?:'?s| is)\s+on\s+my\s+(?:character\s+)?sheet\b|\bwhat\s+(?:weapon|armou?r)\s+(?:do|am)\s+i\b/;
// "What's actually in my hands right now?" / "what am I holding?" — a real DM
// answers from the loadout, never a WITS check (Opus gate 2026-06-19, Rules
// Lawyer DM: this fell through to a contested check and "the details blur").
// Routed into the same handler as META_EQUIPMENT below. (H-31 R2)
const META_HELD_ITEMS = /\bwhat(?:'?s| is)\s+(?:actually\s+)?in\s+my\s+hands?\b|\bwhat\s+(?:do\s+i|am\s+i)\s+(?:actually\s+)?holding\b/i;
// Bare gear yes/no — "am I carrying any weapon or armor, yes or no?", "do I
// have any gear on me?". The yes/no framing doesn't match META_INVENTORY/
// META_EQUIPMENT's wh-/declarative forms, so without this the gate and the
// answerer drift out of sync (META_ITEM's loose "am i carrying" alternative
// accepts it into isMetaQuestion, but no answer branch claims it, and
// handleMetaQuestion falls all the way through to `return null`). (H-38a R1)
const META_GEAR_YESNO = /\b(?:am\s+i|do\s+i)\s+(?:even\s+)?(?:carrying|wearing|wielding|have)\s+(?:any\s+)?(?:weapon|armou?r|gear|equipment)\b/i;
// Numeric Armor value/AC — "what's my Armor value?", "give me my AC". Your
// own defense number off the sheet; a table DM just tells you, never a dodge
// roll. Distinct from META_EQUIPMENT (which names the armor PIECE, not its
// number). (Opus gate 2026-06-19, Rules Lawyer DM; H-31 R2)
// Also catches a named-armor-piece defense ask ("what does my Padded coat
// give me for defense?", "what's its AC or defense bonus?") — narrowly
// scoped to the literal "give me for defense" / "its ac" / "defense bonus"
// phrasings the gate-failure transcripts actually used, so a stray "plan
// for defense of the village" doesn't false-positive. (H-37 R1)
const META_ARMOR_VALUE = /\b(?:armor|armour)\s+(?:value|class|rating|number|score)\b|\bmy\s+ac\b|\bwhat(?:'?s| is)\s+(?:my\s+)?ac\b|\bgive\s+me\s+(?:my\s+)?ac\b|\bits\s+ac\b|\bdefen[cs]e\s+bonus\b|\bgive\s+me\s+for\s+defen[cs]e\b|\bdefen[cs]e\s+(?:value|rating|number|score)\b|\bwhat\s+ac\b|\bac\s+(?:does|do|for|from)\b/i;
// Possession contradiction — "you said I had a staff and a robe" / "a moment
// ago I had X" / "I'm holding X" — the player re-asserts owning an item that
// isn't in their real inventory. A real DM corrects the record in-fiction
// rather than re-listing the truth evasively (or worse, inventing the
// claimed item into existence). Gate test only checks a trigger phrase plus
// SOME possession noun anywhere in the message; findBogusPossessionClaim
// below does the real per-noun grounding check, so a TRUE restatement of
// real gear never trips a correction. (Opus gate 2026-06-19, Rules Lawyer
// DM; H-31 R3)
const POSSESSION_CLAIM_TRIGGER = /\b(?:you (?:said|told me|just (?:said|listed))|a moment ago|i (?:had|have|was holding|'m holding|am holding|was carrying|'m carrying))\b/i;
const POSSESSION_NOUN_RE = /\b(?:staff|wand|robe|cloak|sword|greatsword|longsword|shortsword|dagger|bow|crossbow|shield|armou?r|helm|helmet|gauntlets?|boots?|ring|amulet|potion|scroll|mace|axe|spear|hammer|club|quarterstaff|blade)\b/gi;
const META_POSSESSION_CHALLENGE = new RegExp(`${POSSESSION_CLAIM_TRIGGER.source}[\\s\\S]*?${POSSESSION_NOUN_RE.source}`, 'i');
// A coin amount re-asserted inside a possession claim ("three copper", "a
// pouch of coin") — distinct from META_PURSE (which gates an explicit coin
// QUESTION). Only used inside the bogus-possession correction fold below, so
// a gear correction doesn't silently eat the coin half of the same claim
// too. (H-35 R2)
const COIN_CLAIM_RE = /\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:copper|silver|gold|platinum)\b|\bpouch\s+of\s+coin\b/i;
// Character identity / build — "who am I", "what's my class/level", "what are my
// stats". A player learning their own character is an information request, not a
// fiction beat and never a dice roll. Identity is answered in-voice; an explicit
// stats/scores ask gets the actual numbers (it's your own sheet — a table DM tells you).
const META_CHARACTER = /\bwho\s+am\s+i\b|\bwhat(?:'?s| is)\s+my\s+(?:class|archetype|level|background|build|character)\b|\bwhat\s+(?:kind\s+of\s+)?(?:character|class)\s+am\s+i\b|\bwhat\s+am\s+i\b(?!\s+(?:wielding|wearing|carrying|holding|armed|doing|looking|supposed|meant|going|here))|\b(?:what\s+are|tell\s+me|give\s+me|list)\s+my\s+(?:stats|abilities|attributes|scores|ability\s+scores|hp|hit\s?points?|health|numbers)\b/i;
const META_STATS_REQ = /\b(?:stats|attributes|scores|ability\s+scores|hp|hit\s?points?|health|numbers)\b/i;
// Rules/capability questions — "Gravedigger — is that a class with abilities,
// or just a background? What can I actually do in a fight?" These are
// information requests about the ruleset or archetype, not action declarations.
// A real DM answers from the ruleset: name the archetype, explain it's a
// background descriptor, list the basic actions available. Never rolls.
// Over-match guard: "what can I do in a fight" is gated to fight/combat/battle,
// not a bare "what can I do" (which would swallow real action intents). (DTD-A Fix 1)
const META_CAPABILITY = /\bis\s+(?:that|this|a\s+\w+)\s+(?:a|an)\s+(?:class|background|archetype)\b|\bwhat\s+can\s+i\s+(?:actually\s+|really\s+|even\s+)?do\s+in\s+(?:a\s+)?(?:fight|combat|battle)\b|\bwhat\s+can\s+i\s+(?:actually\s+|really\s+)?bring\s+to\s+(?:a\s+)?(?:fight|combat)\b/i;
// Item queries: "what does the Tonic of grit do?", "is the rope in my pack?",
// "do I have a healing potion?". Broad shape — the handler only answers if it
// resolves to a REAL inventory item (else it returns null and falls through, so
// "what does the elder do" isn't mistaken for an item).
const META_ITEM = /\bwhat(?:'?s| does| do| is| are)\s+(?:the|my|a|an|this|that)\s+.+?\s+(?:do|for|good\s+for|used\s+for|used\s+to)\b|\b(?:do i have|have i got|am i carrying|is\s+(?:the|a|an|my)\s+.+?\s+in\s+my\s+(?:pack|bag|inventory|kit|belongings))\b/i;
// Item-effect capability phrasings that don't fit META_ITEM's "what does X
// do" shape — "does the Tonic heal HP, give temp HP, or buff a stat?", "is
// the Tonic useful?". The gate's realistic phrasings showed these falling
// through to the generic hedge ("it lands, after a fashion") instead of
// routing to the real catalog effect answer. (H-47)
const META_ITEM_CAPABILITY = /\bdoes\s+(?:the|my|a|an|this|that)\s+.+?\s+(?:heal|restore|cure|buff|do\s+anything|help|give\s+(?:me\s+)?(?:temp(?:orary)?\s+hp|temporary\s+hit\s+points))\b|\bis\s+(?:the|my|a|an|this|that)\s+.+?\s+(?:any\s+)?(?:good|useful)\b/i;
// Item-effect query phrasings that miss META_ITEM's strict "what does THE/MY X
// do" shape (the asked-about pronoun is bare "it", or the cue is "tell me
// about"/"examine ... what does the label say"/"what's its mechanical effect").
// Query-SHAPED by construction (a "what ... do/say/effect" or "examine ... what"
// cue), so a bare USE action ("I drink the Tonic") never matches — that stays an
// action for tryUseConsumable. answerItemQuery still validates against the real
// pack and returns null for a non-item, so "what does it do when I open the
// door" falls through. These used to fire [clarify:referent] (the item name
// captured as a fabricated NPC upstream), trivial auto-success, or observe-only.
// Firing here in the meta path PREEMPTS the referent guard. (H-65)
const META_ITEM_QUERY = /\bwhat\b[\s\S]{0,40}?\bdo(?:es)?\b[\s\S]{0,40}?\b(?:drink|use|quaff|swallow|down|apply|take)\s+(?:it|this|that|them)\b|\b(?:examine|inspect|study|read|check)\s+(?:the|my|this)\s+\S+[\s\S]{0,50}?\bwhat\b[\s\S]{0,30}?\b(?:label|inscription|say|says|do|does|effect)\b|\bwhat(?:'?s| is)\b[\s\S]{0,50}?\b(?:mechanical\s+effect|do(?:es)?\s+(?:it|this|that)\s+do\s+mechanically)\b/i;
// Item-presence / "did I use it up" queries that miss META_ITEM's narrow
// "is X in my pack" alternative ("do I still have X", "is X still in my
// consumables", "gone or still there", "did it get used up"). answerItemQuery's
// presence branch reads the real pack; returns null for a non-item. (H-65)
const META_ITEM_PRESENCE = /\bdo i still have\b|\bhave i still got\b|\bstill\s+in\s+my\s+(?:pack|bag|inventory|kit|consumables|belongings)\b|\bgone\s+or\s+still\s+(?:there|here|in)\b|\bget\s+used\s+up\b/i;
// Effect-demand phrasings that open "give/tell me ..." instead of "what
// does X do" — "give me the Tonic's mechanical effect or flag it as
// undefined", "tell me exactly what the Tonic does or say it's undefined".
// Miss META_ITEM/META_ITEM_QUERY's "what does/is" shapes entirely since the
// cue verb is "give"/"tell", not "what". Second alternative requires the
// "...undefined" tail (not just bare "what does X do") so a plain open
// query like "Tell me what the Tonic does." keeps its existing path rather
// than being swept into this demand branch (C7-003's diverge). Same safety
// net as the rest of the META_ITEM family: answerItemQuery returns null
// (falls through) unless a REAL carried item is named in the text. (H-77)
const ITEM_EFFECT_DEMAND_RE = /\b(?:give|tell)\s+me\b[\s\S]{0,40}?\b(?:mechanical\s+)?effect\b|\bwhat\b[\s\S]{0,60}?\bdo(?:es)?\b[\s\S]{0,60}?\bundefined\b/i;
// Verb-FINAL item-effect query — "tell me what the Tonic does", "what the Tonic
// of grit does", "what my rope does". META_ITEM only matches the verb-INITIAL
// shape ("what does the X do"); when the verb trails the noun ("what the X
// does") it missed entirely and the turn rolled/observed instead of stating the
// effect (H-77 residual). Deliberately broad — it routes through answerItemQuery,
// which returns null for a non-item ("what the elder does"), so the turn falls
// through cleanly; the regex doesn't decide item-vs-not, the pack does.
const META_ITEM_VERB_FINAL = /\bwhat\s+(?:the|my|this|that)\s+[\w' -]+?\s+do(?:es)?\b/i;
// A player asserting a carried item is inert/useless/does-nothing — "the
// Tonic is inert, it does nothing". A real DM corrects a false claim about
// an item that canon gives a real effect, rather than agreeing with it.
// (H-47, post-H-45/H-46 gate — DM agreed "the useless tonic" at full HP.)
const META_ITEM_INERT_CLAIM = /\b(?:the|my|this|that)\s+.+?\s+(?:is\s+inert|does(?:n'?t)?\s+(?:do\s+)?anything|does\s+nothing|is\s+useless|has\s+no\s+effect)\b/i;
// "List/read back my consumables" — distinct from META_INVENTORY (which
// deliberately skips the structured items[] bucket entirely, so a bridged
// consumable like the Tonic of grit would otherwise silently vanish from a
// list query once H-45 moves it out of the flavor bucket). Checked before
// META_INVENTORY in the handler below so this dedicated, items-aware answer
// wins over the generic (items-blind) pack dump for this specific ask. (H-45)
const META_CONSUMABLES_LIST = /\b(?:list|read\s+back|name|show)\s+(?:all\s+)?(?:my\s+)?consumables\b|\bwhat\s+consumables\s+(?:do\s+i\s+have|am\s+i\s+carrying|have\s+i\s+got)\b|\bwhat(?:'?s| are| is)\s+(?:all\s+)?(?:my\s+)?consumables\b|\bconsumables\s+list\b|\bmy\s+consumables\b/i;
// Coins/purse — a number the DM owns (read from party.purse). Also catches
// "do I even have any money on me?" and a re-asserted "pouch of coin" claim
// (the latter shares ground with POSSESSION_CHALLENGE below — H-35 R1/R2).
const META_PURSE = /\bhow many coins\b|\bhow much (?:money|coin|gold|silver|copper|cash)\b|\bwhat(?:'?s| is)\s+in\s+my\s+(?:purse|pouch|coin\s?purse|wallet)\b|\bhow\s+(?:much\s+)?(?:money|coin|gold|silver)\s+(?:do i have|have i got|am i carrying)\b|\bmy (?:purse|coin\s?purse|pouch)\b|\bdo\s+i\s+(?:even\s+)?have\s+(?:any\s+)?(?:money|coin)\b|\bmoney\s+on\s+me\b|\bpouch\s+of\s+coin\b|\bopen\s+(?:the|my|this|a)\s+(?:purse|pouch|coin\s?purse|wallet)\b|\blook\s+inside\s+(?:the|my|this|a)\s+(?:purse|pouch|coin\s?purse|wallet)\b|\bcount\s+(?:the\s+|my\s+)?coins?\b|\b(?:anything|something)\s+(?:valuable\s+)?in\s+(?:the|my|this|a)\s+(?:coin\s?purse|purse|pouch|wallet)\b/i;
const META_TIME = /\bwhat time\b|\btime of day\b|\bis it (?:day|night|morning|evening|dark|light)(?:time)?\b/;
const META_OBJECTIVE = /\b(?:what(?:'?s| is| was)? )?my (?:quest|objective|goal|mission|task)\b|\bwhat (?:am i|are we) (?:supposed to|meant to|trying to)\b|\bwhy am i here\b|\bwhat(?:'?s| is) the (?:quest|objective|goal|plan)\b|\bremind me\b/;
// "How do you resolve a sword swing — pure narration, or a dice mechanic?" /
// "Is that a d20?" — a question about the RULES, not an in-fiction action.
// Never a roll target. (Opus gate 2026-06-16, Rules Lawyer DM.)
const META_MECHANICS = /\bdice mechanic\b|\bhow (?:do|does|would) (?:you|the game|this) resolve\b|\bis there a dice\b|\bwhat (?:kind of )?dice\b|\bis (?:that|this) a d ?20\b|\bhow does combat work\b|\bhow do(?:es)? (?:rolls?|dice) work\b|\bpure narration\b|\bwhat'?s? the (?:mechanic|system) (?:here|for this)\b/i;
// Weapon damage-die / numeric combat-stat queries — "what's the damage on the
// Hatchet?", "what die does the damage roll use?", "Hatchet vs Worn Blade
// damage". A real number off the loadout, never an in-fiction dodge. Distinct
// from META_STAT (ability-score modifiers). (Opus gate follow-up 2026-06-16,
// Rules Lawyer DM.)
// Also catches the "what damage does each/they deal" compound phrasing —
// answerWeaponDamage already folds every named weapon in the question, this
// just widens the gate that routes to it. (H-54 R2)
const META_WEAPON_DAMAGE = /\b(?:damage|dmg)\s+(?:die|dice|roll)\b|\bwhat\s+(?:damage\s+)?die\b|\b(?:damage|dmg)\s+(?:on|of|for)\s+(?:the|my|a|an|this|that)\b|\bhow much damage\b|\bwhat(?:'?s| is)\s+(?:the\s+)?(?:damage|dmg)\s+(?:on|of|for|number|value)\b|\bdamage\s+(?:does|do)\s+(?:each|they|both)\s+deal\b/i;
// A weapon's AC/defense value asked about directly — weapons don't carry an
// AC; that's the wearer's own defense number. Distinct from META_ARMOR_VALUE
// (which gates the player's-own-AC ask) — this fires only when the ask is
// framed as "AC ... on my <weapon>" so the answer corrects the conflation
// instead of staying silent on it (and never invents a weapon AC). (H-54 R2)
const WEAPON_AC_MISCONCEPTION_RE = /\b(?:ac|defen[cs]e\s+(?:value|bonus))\b[\s\S]{0,40}\bon\s+(?:my|the)\s+[a-z]/i;
// "What's my name?" / "you called me X" — a player asking the DM what their own
// character is called. Answered straight from canon (the LLM narrator must
// never invent or swap the PC's name). (Opus gate follow-up 2026-06-16.)
const META_NAME = /\bwhat(?:'?s| is)\s+my\s+(?:name|character'?s name)\b|\bwhat\s+am\s+i\s+called\b|\bwho\s+(?:do\s+you\s+think\s+)?am\s+i\s+again\b|\byou\s+called\s+me\b|\bmy\s+name\s+is(?:n'?t)?\b|\bis\s+my\s+name\b/i;
// Folds a class/archetype ask into a compound name+class question — narrow
// (requires "class"/"archetype" right after "and") so a bare mention of
// "class" elsewhere in the sentence doesn't get swept in. (H-36a R2)
const META_CLASS_FOLD_RE = /\band\s+(?:my\s+|what'?s\s+my\s+)?(?:class|archetype)\b/i;
// "Should I go talk to them, or is that a bad idea?" — asking for the DM's
// read on a course of action, not declaring one. A real DM answers in
// character, never bounces it back as a navigation prompt. (Opus gate
// 2026-06-16, Confused newbie.)
const META_ADVICE = /\bshould i\b[^?]*\?|\bis (?:that|this|it) a (?:bad|good|smart|wise|dumb) idea\b|\bwould (?:that|it) be (?:smart|wise|safe|dangerous)\b/i;
// First-person "what do I know about this place?" — the player asking the game to be their
// memory. Too vague to answer, and we keep NO auto-recall: the DM points you back at your own
// notes (write-it-down). Scoped TIGHT — bare ("what do I know?") or an explicit VAGUE place
// ("...about this area / this town / here"). It must NOT catch "what do I know about <a person /
// a specific thing>" ("...about Bram?" → identify Bram), nor "what do YOU know about X" (asks an
// NPC for lore — "do i" vs "do you").
const META_SELF_KNOWLEDGE = /\bwhat\s+do\s+i\s+(?:know|remember|recall)\s*\??$|\bwhat\s+do\s+i\s+(?:know|remember|recall)\s+(?:about\s+)?(?:this\s+(?:area|place|spot|town|village|city|region|land|valley|settlement|locale|hamlet)|here|around\s+here)\b/i;
// Modifier-formula questions — "how are modifiers calculated?", "the formula",
// "ability modifier", "what do I add to hit?". Report the (score−10)÷2 rule
// plus the PC's current scores. Never a dice roll. (Rung-1 gate 2026-06-18.)
// PAIRED rules-lawyer terms for this same table ("breakpoint chart", "modifier
// breakpoints", "modifier table") — recognize them so "show me the full breakpoint
// chart down to 6" returns the (now complete) chart instead of dead-ending on a
// d20 bounce. Kept PAIRED on purpose: a bare "breakpoint" or "table" must NOT match
// (a physical "breakpoint of the rope" / a literal table is not a stats query).
const META_MODIFIER_FORMULA = /\bstat[-\s]to[-\s]modifier\b|\bmodifier\s+formula\b|\bability\s+modifier\b|\bwhat\s+(?:do\s+i|would\s+i)\s+add\b|\bthe\s+formula\b|\bthe\s+modifier\b|\bto[-\s]hit\s+(?:bonus|modifier|formula)\b|\bmodifier\s+math\b|\b(?:modifier|score|stat)\s+breakpoints?\b|\bbreakpoint\s+(?:chart|table)\b|\bmodifier\s+(?:chart|table)\b/i;
// Sheet-confirmation queries — "my sheet", "the sheet", "confirm my stats".
// Reports the full stat block from canon; explicitly refuses to mutate scores.
const META_SHEET_CONFIRM = /\b(?:my|the)\s+sheet\b|\bconfirm\s+(?:the\s+)?(?:stats?|scores?|sheet|modifiers?)\b/i;
// NPC-observer queries — "Who's that stranger watching me?", "Who is that figure?"
// Identity questions about a visibly present NPC. Never a location survey.
// (H-14, Rung-1 gate 2026-06-18.)
const META_NPC_OBSERVER = /\bwho(?:'s| is| was| are)?\s+(?:that|this|the)\s+(stranger|figure|person|man|woman|one|fellow|guard|merchant|trader|elder|individual|character|someone|anyone)\b/i;
// (U231) The subset of META_NPC_OBSERVER's noun list that names an actual NPC
// ROLE field (vs. a generic descriptor like "stranger"/"figure"/"someone").
// "Who is the elder?" must identify the PRESENT NPC whose role matches —
// not whichever NPC happens to be first in the settlement roster. Distinct
// from a leadership/authority ask ("who's in charge", "who leads this
// place?") — those never reach this branch (no "the <role>" shape; "leader"/
// "chief"/"charge" aren't in META_NPC_OBSERVER's noun list) and stay
// deferred per W-5. personQuery.js already resolves the other role nouns
// here (guard/merchant/trader) correctly by role; "elder" is the one
// personQuery.js deliberately defers (PERSON_DEFER_RE, W-4/W-5 leadership
// ambiguity), so it falls through to this branch — where the bug lived.
const NPC_OBSERVER_ROLE_WORDS = new Set(['guard', 'merchant', 'trader', 'elder']);
// "Lurking"/"edges"/"shadows" framing — the player is pointing at the HOSTILE
// observer specifically, not whichever sociable NPC happens to be first in the
// roster. (H-44, post-H-42 baseline gate, Rules Lawyer t5: "I asked who the
// stranger lurking at the edges is — not about Corwin" still got Corwin, the
// sociable NPC, re-served; canon's real lurker had its own name on record and
// was never even checked.)
// "won't name"/"don't want to name"/"keep going quiet (about)" evasion framing
// — same semantic shape as "lurking"/"edges": the player is pointing at a
// DIFFERENT, deliberately-unnamed party, not whichever sociable NPC happens to
// be first in the roster (and, distinctly, not the addressee they're asking).
// (H-51, post-H-49 gate, Confused newbie: "Corwin, who is this person you
// don't want to name?" self-answered as Corwin, the addressee.)
const NPC_OBSERVER_LURK_RE = /\blurk(?:ing|er)?\b|\bwatching\s+(?:from|at)\s+(?:the\s+)?(?:edges?|shadows?|a\s+distance|afar)\b|\b(?:at|on|from)\s+the\s+edges?\b|\b(?:don'?t|doesn'?t|won'?t|wouldn'?t|refus(?:e|es|ed)\s+to)\s+(?:want\s+to\s+)?name\b|\bkeep(?:s|ing)?\s+going\s+quiet\b/i;
// NPC-presence queries — "Is that stranger gone?", "Could I look for them around town?"
// Absence/presence questions about a specific NPC, not a general location survey.
// (H-16, Rung-1 gate 2026-06-18.)
const META_NPC_PRESENCE = /\bis\s+(?:that|this|the)\s+\w+\s+(?:gone|left|still\s+(?:here|around|there)|around(?:\s+(?:here|town|anywhere))?|nearby)\b|\bcould\s+i\s+(?:find|look\s+for|spot|search\s+for)\s+them\b|\bwhere\s+(?:did|do)\s+(?:they|them|the\s+\w+)\s+(?:go|end\s+up|head)\b/i;
// General "who's here" roster query — "who are all these people?", "who's
// everyone here?" — and the sibling "is there a watcher" shape — "is there a
// stranger watching?", "can I look at the stranger watching from the edges?".
// Broader than META_NPC_OBSERVER (a SPECIFIC vague-descriptor identity ask,
// answered as exactly one NPC) and META_NPC_PRESENCE (an absence/return
// question about an NPC already seen) — this is the general roster/presence
// ask, answered from the real settlement NPC list instead of a generic
// "yours to call" non-answer or an outright denial of a real lurking NPC.
// (H-34 R2a, Opus gate 2026-06-19, Confused newbie.)
const META_NPC_ROSTER = /\bwho(?:'s|\s+are)\s+(?:all\s+)?(?:these|those)\s+people\b|\bwho(?:'s| is| are)\s+(?:everyone|everybody)\b|\b(?:is\s+(?:there|anyone|anybody|someone)|can\s+i\s+(?:just\s+)?(?:look\s+at|see|spot|check\s+out))\b[^.?!]*\bwatch(?:ing)?\b/i;
// Bare "is anyone here with me?" presence ask — "is anyone in the room?", "who's
// in the room with me?", "is anybody nearby?", "is someone else here?". A DM just
// TELLS you who's visibly present; this must NOT fall through to a WITS perception
// roll. Routes to the same answer as META_NPC_ROSTER (list who's here, name/role
// gated). Distinct from META_NPC_PRESENCE (an absence/return question about a
// SPECIFIC NPC: "is that stranger gone?"). (convo-honesty FIX 2)
// Tight adjacency on purpose: the presence word must follow the pronoun directly
// (optionally "else"), so this fires on "is anyone here / nearby / in the room /
// with me" but NOT on richer questions that merely contain those words — "is anyone
// AROUND?" (place-history handler) or "is anyone IN TROUBLE here?" (a danger read).
const META_NPC_PRESENCE_HERE = /\b(?:is|are)\s+(?:there\s+)?(?:any\s*(?:one|body)|some\s*(?:one|body))\s+(?:else\s+)?(?:here|nearby|with\s+me|present|in\s+(?:the|this)\s+room)\b|\bwho(?:'s|\s+is|\s+are)\s+(?:here\s+with\s+me|in\s+(?:the|this)\s+room|present(?:\s+here)?|nearby)\b/i;
// Explicit skill-check request — player declares they want to roll, asks for DC.
// Pattern A: "let me make a WITS check", "I want to do a GRIT test", "can I attempt a MIGHT save"
// Requires the action verb (make/do/attempt/try) so bare "I want to fight" doesn't fire.
// (H-19, Rung-1 gate 2026-06-18.)
const META_EXPLICIT_CHECK_A = /\b(?:let me|i want to|i(?:'d)?\s+like to|can i|i(?:'m going to| need to| should))\s+(?:make|do|attempt|try)\s+(?:a(?:n)?\s+)?(?:(might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+)?(?:check|roll|test|save)\b/i;
// Pattern B: "I want to roll MIGHT against him", "let me roll WITS on this"
// Requires a stat name after "roll" so "I want to roll him" (a barrel) doesn't fire.
const META_EXPLICIT_CHECK_B = /\b(?:let me|i want to|i(?:'d)?\s+like to|can i|i(?:'m going to| need to| should))\s+roll\s+(?:a\s+)?(might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i;
// Pattern C: imperative "Roll the d20 against WITS", "roll against GRIT". The stat
// follows a check preposition so bare "roll might" (a modal) doesn't fire. (H-26c)
const META_EXPLICIT_CHECK_C = /\broll\b[^.?!]*?\b(?:vs\.?|versus|against|for|on)\s+(might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i;
// Pattern D: a named check with no action verb — "a WITS check", "I asked for a
// GRIT save". The stat must immediately precede check/save/test. (H-26c)
const META_EXPLICIT_CHECK_D = /\b(might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+(?:check|save|test)\b/i;
// Declared check with no "let me"/"I want to" lead-in — a bare commit to a
// concrete stat+action, "I sheathe the blade and roll WITS to read his face"
// or "I make a WITS check to pry it open". Distinct from Patterns A–D (which
// all require either an opener phrase or a vs./against preposition) — this
// catches the plain "roll <stat> to <verb>" / "make a <stat> check to <verb>"
// shape so the bare-DC guard below can defer to it. NOT folded into
// isMetaQuestion or the canned check-answer branch — its only job is to stop
// META_BARE_DC from swallowing a declared check; the real action-resolution
// path (outside grace) handles the actual roll once grace doesn't intercept.
// (H-54 R4)
const META_EXPLICIT_CHECK_DECLARED = /\b(?:roll|rolling)\s+(?:a\s+)?(?:might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+to\s+[a-z]|\bmake\s+a\s+(?:might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\s+check\s+to\s+[a-z]/i;
// Roll-ON-DEMAND — the player COMMANDS the DM to roll a check NOW and SHOW the
// result ("roll it and show me the math", "roll the GRIT save: show me d20
// result, plus the total. Numbers only."). Distinct from the COLLABORATIVE
// explicit-check ("let me make a WITS check" — player rolls, DM sets the DC):
// here the player has no physical die and wants the engine to produce the
// number. Anchored on the imperative "roll it" and on an explicit "show me the
// d20/result/total/math/numbers" demand, so a collaborative "what do I roll?"
// stays on the DC-prompt path. (D-B4 gate residual a — roll-on-demand / C3.)
const META_ROLL_NOW = /\broll it\b|\broll\s+(?:it\s+)?(?:for me|now|right now)\b|\bshow me\s+(?:the\s+)?(?:d20|result|total|the math|numbers?)\b|\bnumbers only\b|\byou roll\b/i;
// Roll-recall — player cites a specific past roll number to dispute or follow up.
// "I rolled a 16", "16 vs DC 11", "you told me I got a 16", "my roll was 16". (H-12/13.)
const META_ROLL_RECALL = /\b(?:i (?:rolled|got|said|had)(?:\s+a)?|my roll was(?:\s+a)?|you (?:said|told me)(?:\s+i (?:rolled?|got))?(?:\s+a)?)\s*\d+\b|\b\d+\s+(?:vs\.?|versus|against)\s+dc\s*\d+\b/i;
// Roll-result QUERY — player ASKS what they last rolled / the die number + DC, with
// NO number cited (so META_ROLL_RECALL above doesn't fire). "what did I roll?", "what
// was my last roll?", "give me the die number and the DC I beat", "what number came
// up on the die?", "remind me what I just rolled". Answered from
// world.conversation.lastRoll — must report the recorded roll, never re-roll or deny
// a check that happened. (Gate-10 RL t11 — engine answered "no roll to report" while
// the ledger held 4 vs DC 12.)
// Widened (CT-1) to catch "the raw d20", "the d20 result", "the actual
// d20/attack roll" — the RESOLVED number the player is asking to be told,
// not a predictive ask (odds/hit-chance stay tier-3, untouched here).
const META_ROLL_QUERY = /\bwhat\s+did\s+i\s+roll\b|\bwhat\s+(?:was|were)\s+(?:my|the)\s+(?:last\s+)?rolls?\b|\bremind\s+me\s+(?:what\s+i\s+(?:just\s+)?rolled|of\s+(?:my|the)\s+(?:last\s+)?roll)\b|\b(?:actual\s+)?number\s+on\s+the\s+(?:die|dice)\b|\b(?:die|dice)\s+number\b|\bwhat\s+number\s+(?:came\s+up|did\s+i\s+(?:roll|get)|landed)\b|\bwhat\s+did\s+the\s+(?:die|dice)\s+(?:say|show|come\s+up)\b|\b(?:the\s+)?raw\s+d20\b|\b(?:the\s+)?d20\s+result\b|\b(?:the\s+)?actual\s+(?:d20|attack\s+roll)\b/i;
// Fourth-wall system check-in — a repetition/system callout paired with a
// check-in, not an in-fiction action or health question. "You're just
// repeating yourself now, are you okay?" must never roll: it's the player
// flagging the DM, not asking an NPC how they're doing. Anchored on the
// REPETITION/system-callout phrase, never the bare "are you okay?" alone —
// that must keep resolving as normal in-fiction dialogue/action. (H-51,
// post-H-49 gate, Confused newbie: this exact line rolled a real mixed-margin
// check and got a content-free "it half-works" hedge instead of a non-rolling
// acknowledgment.)
const META_SYSTEM_CHECKIN = /\b(?:you'?re\s+(?:just\s+)?repeating\s+yourself|you\s+keep\s+saying\s+the\s+same\s+thing|that'?s\s+the\s+same\s+answer\s+as\s+before|you\s+said\s+that\s+already|same\s+(?:line|answer|outcome|result|response)[\s\S]{0,20}?(?:twice|three\s+times|\d+\s+times)|you'?re\s+stuck\s+in\s+a\s+loop)\b[\s\S]{0,40}?\b(?:okay|ok|there|broken|stuck|glitch(?:ing)?|everything\s+(?:working|ok(?:ay)?|alright|functioning))\b/i;
// Rules-confirmation — a question about the DAMAGE RULE itself ("do I add my
// MIGHT to melee damage?", "is a hit 1d6+1?", "confirm that's the right
// mod"), never an in-fiction action and never rolled. Distinct from
// META_WEAPON_DAMAGE (which asks for a weapon's raw die) and META_ATTACK_MOD
// (the to-hit bonus) — this is specifically the "does my ability mod apply to
// damage" rule check. (H-54 R3, post-H-52/H-53 gate, Rules-Lawyer: this fell
// through every META_* gate and got rolled as a real action — "Yes or no: do
// I add my MIGHT +1 to melee damage with these blades?" fired a d20 vs DC13.)
// H-61: widened with two more phrasings of the same rule question —
// "does <stat> add to ... damage" (third-person framing, not "do I add")
// and "add <stat> modifier? is that the rule" (the modifier named, then a
// bare confirmation request instead of a yes/no "do I add" template).
const META_DAMAGE_RULE = /\bdo\s+i\s+add\s+my\s+\w+\s*(?:\+\s*\d+)?\s+to\s+(?:melee\s+)?damage\b|\bdoes\s+\w+\s+add\s+to\s+(?:melee\s+)?damage\b|\bconfirm\s+(?:that'?s\s+)?the\s+right\s+mod\b|\bis\s+(?:a\s+)?hit\s+\d*d\d+\s*\+\s*\d+\b|\byes\s+or\s+no:?\s+do\s+i\s+add\s+my\s+\w+\s*(?:\+\s*\d+)?\s+to\s+(?:melee\s+)?damage\b|\badd\s+\w+\s+modifier\b[?\s]*is\s+that\s+the\s+rule\b|\bgo(?:es)?\s+on\s+my\s+damage\s+rolls?\b/i;

// ── H-59: typed compound-query decomposition (C1 graduation) ───────────────
// First typed-packet graduation (Biblioteca Vol 7 §18 heuristic 3 — "prefer
// typed packets over many disconnected detectors"). The cues below detect
// the PRESENCE of a requested sub-field (name/class/level/HP, weapon-damage,
// item-effect, enemy-name/HP) independent of phrasing/order; handleMetaQuestion
// then answers every present field from canon in one response, never rolling.

// "who am I fighting", "name of the foe", "this enemy" — a query SCOPED to
// the combat enemy, not the player. Only meaningful with combat active.
const META_ENEMY_STATUS = /\bwho\s+am\s+i\s+fighting\b|\bwho\s+(?:exactly\s+)?is\s+(?:this|that|it)\s+(?:enemy|foe|thing)\b|\bwho\s+is\s+it\s+i'?m\s+fighting\b|\bname\s+of\s+the\s+(?:foe|enemy)\b|\benemy\s+name\b|\bthis\s+(?:enemy|foe)\b/i;
const ENEMY_HP_CUE_RE = /\bhp\b|\bhit\s?points?\b|\bhurt\b|\bhealth\b/i;

// Weapon-damage half of a "damage + item-effect" compound — "blade damage",
// "Worn Blade dmg", "what do my weapons deal". Item-effect half — "Tonic of
// grit effect", "what does it do", "does it heal". Both must be present (and
// the matched gear/effect items found in canon) for the new compound branch
// to fire; a single-purpose ask is left to the existing META_WEAPON_DAMAGE/
// META_ITEM branches below, and a narrated action (no cue at all) never
// matches either half, so it falls straight through untouched.
const DAMAGE_CUE_RE = /\bdamage\b|\bdmg\b|\bdeal(?:s|t)?\b/i;
const EFFECT_CUE_RE = /\beffect\b|\bdoes\b|\bdo\b|\bheal(?:s|ing)?\b|\bcures?\b|\btell\s+me\b/i;

// Detect meta-questions (questions about state, not actions)
// "Which stat/modifier governs a melee (or ranged) ATTACK — MIGHT or AGILITY?"
// A rules question, not an attack declaration: anchored on a (which|what) +
// stat-word + melee/ranged + attack-sense shape (or "do I use MIGHT/AGILITY …
// melee/hit"). Distinct from META_ATTACK_MOD (which asks for the NUMBER) and
// from "which stat for my armor class" (AGILITY/AC — deliberately excluded by
// requiring an attack-sense word). (H-80, gate-4 RL t8)
const META_ATTACK_GOVERNING_STAT = /\b(?:which|what)\b[\s\S]{0,55}?\b(?:stat|ability|modifier|mod|bonus)\b[\s\S]{0,55}?\b(?:melee|ranged|unarmed)\b[\s\S]{0,25}?\b(?:attack|strike|hit|swing|blow|damage)\b|\b(?:which|what)\b[\s\S]{0,55}?\b(?:stat|ability|modifier|mod|bonus)\b[\s\S]{0,40}?\b(?:hit|attack|strike|swing)\b[\s\S]{0,20}?\b(?:melee|ranged)\b|\bdo i use\b[\s\S]{0,25}?\b(?:might|agility|strength|dexterity|str|dex)\b[\s\S]{0,45}?\b(?:melee|ranged|to[-\s]?hit|attack|strike|swing|hit)\b/i;

export function isMetaQuestion(text) {
  const t = String(text || '').toLowerCase();
  return (META_LOCATION.test(t) && !META_MOVE_TO_PLACE.test(t)) || META_INTERIOR_LAYOUT.test(t) || META_INTERIOR_LAYOUT_SEEK.test(t)
    || META_HEALTH.test(t) || META_RECAP.test(t) || META_OUTCOME.test(t)
    || META_INVENTORY.test(t) || META_EQUIPMENT.test(t) || META_CHARACTER.test(t) || META_CAPABILITY.test(t) || META_STAT.test(t)
    || META_STAT_SYNONYM.test(t) || META_ITEM.test(t) || META_PURSE.test(t) || META_TIME.test(t)
    || META_OBJECTIVE.test(t) || META_MECHANICS.test(t) || META_ADVICE.test(t) || META_SELF_KNOWLEDGE.test(t)
    || META_WEAPON_DAMAGE.test(t) || META_NAME.test(t)
    || META_MODIFIER_FORMULA.test(t) || META_SHEET_CONFIRM.test(t)
    || META_NPC_OBSERVER.test(t) || META_NPC_PRESENCE.test(t) || META_NPC_ROSTER.test(t)  // H-34 R2a
    || META_NPC_PRESENCE_HERE.test(t)  // convo-honesty FIX 2 — "is anyone here?" answers free, no roll
    || META_EXPLICIT_CHECK_A.test(t) || META_EXPLICIT_CHECK_B.test(t)  // H-19
    || META_EXPLICIT_CHECK_C.test(t) || META_EXPLICIT_CHECK_D.test(t)  // H-26c
    || META_SKILL_MOD.test(t) || META_ATTACK_MOD.test(t) || META_PROFICIENCY.test(t) || META_BARE_DC.test(t)  // H-25 / gate-18
    || META_ATTACK_GOVERNING_STAT.test(t)  // H-80 — governing stat for melee/ranged attack
    || META_ROLL_RECALL.test(t)  // H-12/13
    || META_ROLL_QUERY.test(t)  // gate-10 RL t11 — asking for the last roll's number/DC
    || META_SYSTEM_CHECKIN.test(t)  // H-51
    || META_DAMAGE_RULE.test(t)  // H-54 R3
    || META_HELD_ITEMS.test(t) || META_ARMOR_VALUE.test(t)  // H-31 R2
    || META_POSSESSION_CHALLENGE.test(t)  // H-31 R3
    || META_GEAR_YESNO.test(t)  // H-38a R1
    || META_CONSUMABLES_LIST.test(t)  // H-45
    || META_ITEM_CAPABILITY.test(t) || META_ITEM_INERT_CLAIM.test(t)  // H-47
    || META_ITEM_QUERY.test(t) || META_ITEM_PRESENCE.test(t)  // H-65
    || META_ITEM_VERB_FINAL.test(t)  // H-88 — "what the Tonic does" (verb trails the noun)
    || ITEM_EFFECT_DEMAND_RE.test(t)  // H-77
    || (META_ENEMY_STATUS.test(t) && ENEMY_HP_CUE_RE.test(t))  // H-59 — enemy name+HP compound
    || (DAMAGE_CUE_RE.test(t) && /\beffect\b/i.test(t))  // H-59 — "X dmg, Y effect" list compound
    || hasIdentitySlotCompound(t)  // H-59 — terse name/class/level/HP slot listing
    || isGoverningStatQuestion(t);  // H-61 — "which stat governs <skill>"
}

// Exported guard for playloop.js — detects NPC identity/presence queries so
// isExploreIntent can return false before routing to cardinal-exit text.
export function isNpcObserverQuery(text) {
  const t = String(text || '').toLowerCase();
  return META_NPC_OBSERVER.test(t) || META_NPC_PRESENCE.test(t);
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

// Info-seeking: the player demands a specific fact — a name, a date/year, who
// held/sold/gave something, a kinship/life-status check — rather than open
// conversation. Gates the deliver-or-decline contract (H-29): a resolved
// success/mixed info-seeking action must state a real grounded fact or give an
// explicit in-fiction non-answer, never fall to atmosphere or invent one.
// Shared by playloop.js (base narration) and narratorContext.js (ctx.infoSeeking
// for the validator backstop) so the two layers never drift out of sync.
// "family" added alongside "kin" — H-37 R2 trace: "who in his family was the
// first Boneknit, and how'd they earn it?" was falling through undetected
// (no "founded"/"kin" token), so the deliver-or-decline contract never even
// ran and the action fell to the generic atmosphere floor on a mixed roll.
// H-38a R2 trace: that fix didn't reach every genealogy phrasing — a THIRD
// gap, not a recurrence of the same one. "So when were you born, and where,
// if not here?" has no name/year/date/kin/family token within range of
// when/where at all (added "born"); "who was her husband, Corwin's son?" and
// "give me one name" likewise had no anchor (added the kinship nouns below,
// and widened "give me a name" to accept "one"/"the" too). Same detector,
// same downstream effect either way it fails: isInfoSeekingText returns
// false, infoExtractionOutcome is skipped entirely (on BOTH the mixed-margin
// path AND, newly observed, the success path), and the turn falls to
// genericGroundedOutcome's atmosphere-only pool ("It comes off cleanly...")
// despite a resolved roll with real information on the table.
const INFO_SEEKING_RE = /\b(?:who|what|when|where|whose)\b[\s\S]{0,60}?\b(?:name|named|year|date|deed|owner|own(?:s|ed)?|held|sold|gave|kin|family|relat\w*|tenure|found(?:ers?|ed|ing)|born|husband|wife|spouse|son|daughter|father|mother|married|built|settl\w+|arrived|establish\w*|started|created)\b|\bgive me (?:a|one|the)\s+name\b|\bby name\b|\bwhat year (?:is it|are we)\b|\bis\s+[a-z][\w'-]*(?:\s+[a-z][\w'-]*){0,2}\s+(?:dead|alive)\b|\bhow long\b[\s\S]{0,30}?\b(?:run|ran|owned|been here|been)\b|\bhow many generations\b/i;
// Action-feasibility/skill verbs — mirrors isExploreIntent's own exclusion
// vocabulary (playloop.js ~L4349/4351), reused here for the same reason: a
// question opener ("can/could/should I ...") followed by one of these is an
// ACTION dressed as a question, never a fact demand. Paired with the
// recall-bias net below so "can I climb this wall?"/"could I jump that gap?"
// keep rolling as actions instead of dead-ending on a "no record" decline.
// (H-39)
// Exported (gate-15) so the playloop's last-resort question handler can reuse the
// SAME action-verb list: a question that contains an action verb ("I attack — what
// happens?") is an action-attempt, not an info query, and must keep the action floor.
export const INFO_SEEKING_EXCLUDE_RE = /\b(?:attack|strike|hit|stab|slash|shoot|kill|fight|charge|intimidate|charm|deceive|persuade|climb|jump|leap|vault|pick|force|break|try|attempt|sneak|steal|track|forage|decipher|calm)\b/i;
// Recall-bias net (H-39, BASECAMP design-review verdict 2026-06-19): the curated
// anchor-noun list above (name/year/date/owner/kin/family/...) is precision-
// tuned and keeps missing fresh phrasings of the same intent — a genuine
// fact/lore/history demand framed as a knowledge-VERB-phrase rather than a
// specific noun ("what happened to the people who used to live here?", "tell
// me about the war", "what do you know about this place?"). Anchored to the
// verb phrase itself (not a noun list), so it generalizes to ANY topic that
// follows — recall, not enumeration. Deliberately narrower than a bare
// isQuestionShaped fallback: a blanket "any question is info-seeking" net
// would swallow isExploreIntent's own "what do I see"/"is there a window"
// survey questions (playloop.js isExploreIntent already defers to
// isInfoSeekingText, so over-broadening here would silently break the
// generic room-survey path — see U197-06).
const INFO_SEEKING_TOPIC_RE = /\btell me\s+(?:about|more about|everything(?:\s+about|\s+you know about)?)\b|\bwhat\s+do\s+you\s+know\s+about\b|\bwhat\s+(?:happened|became)\s+(?:to|of)\b|\bwhat'?s\s+the\s+story\s+(?:behind|of|with)\b|\bwhat\s+do\s+(?:people|folk|they|anyone|everyone|locals?)\s+(?:say|know|think|hear)\s+(?:about|of)\b|\bwhat\s+(?:happened|occurred|went\s+on)\b[\s\S]{0,60}?\bago\b/i;

// Observe-object-detail: a player demands the literal text/marking on a held
// or examined object ("what's stamped on the coin", "look at it and tell me
// what's on it", "read the inscription") — a request for a concrete fact,
// same as a name/date ask, not open conversation. (H-36a R1)
const INFO_SEEKING_OBSERVE_RE = /\b(?:what'?s|what is)\b[\s\S]{0,20}?\b(?:printed|stamped|etched|engraved|written|marked|inscribed)\b[\s\S]{0,15}?\bon\b|\btell me what'?s\b[\s\S]{0,20}?\b(?:on it|on the|stamped|printed|written|etched|marked|inscribed)\b|\bread\b[\s\S]{0,15}?\b(?:the|this|that|my)\b[\s\S]{0,15}?\b(?:inscription|engraving|writing|stamp|marking)\b/i;

// Noun-less suspicion/info question — "is something going on you're not telling
// me?", "what aren't you telling me?", "are you hiding something?", "is there
// something you're not saying?" — seeks CONCEALED information from a person but
// has no who/what+noun anchor (INFO_SEEKING_RE) and no knowledge-verb topic phrase
// (INFO_SEEKING_TOPIC_RE), so it fell through undetected to a content-free
// success atmosphere instead of the deliver-or-decline contract (H-44, post-H-42
// baseline gate, confused-newbie t8: "That sideways glance — is something going
// on you're not telling me?" rolled a success but narrated generic filler).
// Anchored on an explicit concealment/withholding marker ("not telling/saying",
// "hiding something") so a neutral statement or a plain action never trips it —
// declarative word order ("something IS going on") and third-person framing
// ("he's hiding something") both fall outside these patterns by construction.
const INFO_SEEKING_CONCEALMENT_RE = /\bis\s+(?:there\s+)?something\s+(?:going\s+on\s+)?you'?re\s+not\s+(?:telling|saying)\b|\bwhat\s+(?:aren'?t\s+you|are\s+you\s+not)\s+(?:telling|saying)\s+me\b|\bare\s+you\s+hiding\s+something\b/i;

// "Was there anyone here before?", "has anyone been through recently?" —
// existence/presence questions about the past or recent past. No who/what anchor
// noun but clearly a fact demand, not an action. (H-63)
const INFO_SEEKING_EXISTENTIAL_RE = /\b(?:was|were)\s+there\s+(?:anyone|someone|people|folk|others?)\b[\s\S]{0,60}?\b(?:before|earlier|first|previously|lately|recently)\b|\bhas\s+(?:anyone|someone)\s+(?:been|come|pass(?:ed|ing)?|gone|travel(?:l?ed|ing)?|lived?|settle[ds]?)\b/i;
// "Why did you come here?", "why'd you settle here?", "what brought you?" —
// origin/motive questions aimed at an NPC. Share the deliver-or-decline contract. (H-63)
const INFO_SEEKING_ORIGIN_RE = /\bwhy\s+(?:did\s+)?(?:you|they|he|she)\s+(?:come|came|settle[ds]?|move[ds]?|go|went|land(?:ed)?|arrive[ds]?)\b|\bwhy'?d\s+(?:you|they|he|she)\s+(?:come|came|settle[ds]?|move[ds]?|go|went|land(?:ed)?|arrive[ds]?)\b|\bwhat\s+brought\s+(?:you|them|him|her|everyone)\b/i;

// (H-84) The SETTLEMENT's founding history — "how many founders were there?",
// "is there a founding family, or was it built by merchants?". INFO_SEEKING_ORIGIN_RE
// above only covers an NPC's MOTIVE ("why did you settle here"), so these founding
// forms fell through to a generic resolve that ROLLED or observe-deadended on a fact
// canon doesn't hold (C9-004). The downstream grounding gate still DELIVERS a grounded
// answer where canon has one; only the ungrounded case honest-declines. Tight by
// design — an interrogative founding shape — so the search ACTION "I look for a
// founding stone" and the speculation "the elder probably knows the founders' names"
// (the C9-004 diverges) stay on their normal paths. ("who founded/built X" already
// matched the generic INFO_SEEKING_RE.)
const INFO_SEEKING_FOUNDING_RE = /\b(?:how\s+many|which|what)\s+founders?\b|\bfounders?\s+were\s+there\b|\bfounding\s+famil(?:y|ies)\b|\bwas\s+(?:it|this\s+(?:place|village|town|settlement|hamlet))\s+(?:built|founded|settled|raised)\s+by\b/i;

// (H-85) An ungrounded leader's TENURE — "how long has the elder been in charge?",
// "how many winters has the headman led?". Sibling to INFO_SEEKING_FOUNDING_RE: a
// duration-fact about the settlement's leadership that canon doesn't hold, so a
// success could only invent a number (the C9 rail). Anchored how-long/many → a
// leadership ROLE → a tenure verb/noun, so the leadership ACTION "I challenge the
// elder for leadership" (no duration question), the speculation "the elder has
// probably led for ages" (no how-long), and an arrival-time ask "how long until
// the elder arrives" (no tenure verb) all stay on their normal paths. Grounding
// gate still delivers where canon has a tenure; only the ungrounded case declines.
const INFO_SEEKING_TENURE_RE = /\bhow\s+(?:long|many\s+(?:years?|winters?|seasons?|moons?))\b[\s\S]{0,50}?\b(?:elder|leader|headman|chief(?:tain)?|mayor|reeve|warden|steward|matriarch|patriarch)\b[\s\S]{0,30}?\b(?:in\s+charge|led|lead(?:ing)?|ruled?|run|reign\w*|held|govern\w*|been\s+the|at\s+the\s+head|the\s+post)\b/i;
// Prior-holder history — "who ran/owned/kept/had this <place> before <X>?", "who used
// to run this stall before?", "who remembers who ran the inn before her?". An
// ungrounded past-proprietor question: canon rarely holds it, so a generic resolve
// rolls a contentless success or observe-deadends (gate-10 Lore t11 — "who DOES
// remember who ran this inn before Corwin?" → "[roll:18] you manage it, the way
// opens"). Anchored on who + a holding/keeping verb + "before" so it routes to
// deliver-or-decline; the grounding gate still delivers where canon HAS a prior
// holder. Sibling to FOUNDING/TENURE (H-84/85). (H-89, C9.)
const INFO_SEEKING_PRIOR_HOLDER_RE = /\bwho\b[\s\S]{0,40}?\b(?:ran|run|owned?|kept|keep|held|hold|managed?|manage|had|use[ds]?\s+to\s+(?:run|own|keep|hold|manage))\b[\s\S]{0,40}?\bbefore\b/i;

// The PC's OWN provenance — "who carried me in last night", "where did they find
// me", "who brought me here", "was I found by anyone". Distinct from
// INFO_SEEKING_ORIGIN_RE (an NPC's motive, "why did you come"). These are
// fact-DEMANDS about a past event involving the PC; without this the bare AND
// NPC-addressed forms missed every sub-RE and fell through to a generic WITS
// resolve that "succeeded" with contentless flavor (gate-4 Lore-hound t2/t9/t10/
// t11 — C4 empty-success in the resolve path). Anchored on a question-word + a
// PAST-tense transport/discovery verb + a me/us object, so present-tense escort
// ("take me to X", "point me to <NPC>" — C12) stays movement, not info-decline. (H-78)
const INFO_SEEKING_PROVENANCE_RE = /\b(?:who|where|when|how)\b[\s\S]{0,40}?\b(?:carried|brought|took|dragged|hauled|found|find|deliver(?:ed)?|left|drop(?:ped)?|put|placed|wheel(?:ed)?|dumped)\b[\s\S]{0,20}?\b(?:me|us)\b|\b(?:was|were)\s+(?:i|we)\s+(?:found|brought|carried|taken|left|dropped|put|placed|deliver(?:ed)?|discover(?:ed)?|dumped)\b/i;

// A QUERY about who has been watching/spying on the PC — an unmodeled surveillance
// fact about the player character. Gate-6 Newbie ("ask if either of them is the one
// who was watching me") missed every sub-RE, rolled a d20, and any post-roll
// narrator delivered a content-free "success" (the empty-success-on-a-SUCCEEDED-
// action shape). The engine holds no canon for "who was watching you", so a success
// could only INVENT it (the C9 rail) — it must honest-decline pre-roll, no roll,
// exactly like INFO_SEEKING_PROVENANCE_RE. Narrow by design: a query cue (who /
// whether / if / "the one who") AND a surveillance verb (watch/spy/tail/stalk/
// shadow/surveil — deliberately NOT "follow", which collides with accompany-"follow
// me") AND a me/us object. Imperatives ("watch me work") lack the query cue;
// player-as-subject ("I follow the stranger") lacks the me/us object — both stay on
// their normal paths. (N-2)
const INFO_SEEKING_SURVEILLANCE_RE = /\b(?:who|which|whether|if|the\s+one\s+(?:who|that))\b[\s\S]{0,50}?\b(?:watch(?:ing|ed|es)?|spy(?:ing)?|spied|spies|tail(?:ing|ed|s)?|stalk(?:ing|ed|s)?|shadow(?:ing|ed|s)?|surveil\w*)\b[\s\S]{0,20}?\b(?:me|us)\b/i;

// (N-4) "what happened here / last night / years ago / to <someone>" — a question
// about FICTION BACKSTORY, not a game-session recap. Without this it matched
// META_RECAP → "Nothing's happened yet" (gate-8 RL t4). The backstory qualifier
// (locative/temporal/person) separates it from the bare recap "what happened?".
// gate-16 (newbie t5): added "(the) old days / olden days / back then / in the past /
// bygone / days gone by / years past" — "what happened in the old days?" had no
// in-range time-ref so it fell to the META_RECAP "Nothing's happened yet" bounce.
const INFO_SEEKING_BACKSTORY_RE = /\bwhat\s+happened\b[\s\S]{0,40}?\b(?:here|last\s+night|last\s+\w+|years?\s+ago|long\s+ago|a\s+while\s+ago|before|earlier|that\s+(?:night|day|time)|(?:the\s+)?old\s+days|olden\s+days|back\s+then|in\s+the\s+past|bygone|days?\s+gone\s+by|years?\s+past|to\s+(?:the|them|him|her|this|that|everyone|you|us|me|the\s+\w+))\b/i;

// (N-4) "who was it / who was the one / who were they" — the identity of an
// ungrounded past person ("who was it that ceased to matter?", gate-8 Lore). The
// grounding check still gates the decline: a grounded answer is delivered; only an
// ungrounded one declines.
const INFO_SEEKING_IDENTITY_RE = /\bwho\s+(?:was|were)\s+(?:it|the\s+one|that(?:\s+person)?|they|the\s+\w+)\b/i;

// THE_REF-3 (gate-13 rerun turn-4): a "why does X have no/a <name/attribute>" question
// asks for the REASON behind an absent attribute ("why does Kael have no surname?") —
// almost always ungrounded (the world rarely authors WHY someone lacks a surname).
// Routes to the deliver-or-decline path (delivers if canon holds it, honestly declines
// if not) instead of a gen:s "you manage it, the way opens" empty success. The grounding
// check still gates: a grounded why is delivered, never blanket-declined.
const INFO_SEEKING_WHY_ABSENT_RE = /\bwhy\b[^?]{0,60}\b(?:no|any|a|an)\s+(?:[a-z]+\s+){0,2}(?:surname|last\s+name|family\s+name|second\s+name|name|title)\b|\bwhy\b[^?]{0,40}\b(?:has|have|had|got|gets?)\s+no\s+[a-z]+/i;

// (U232, gate-14 full-panel, lore-hound t4): "name me one other old family besides the
// Boneknits" / "name me another founding family" — a "name me <X>" REQUEST for a
// specific fact, sibling to the existing "give me (a/one/the) name" anchor in
// INFO_SEEKING_RE. Without this it fell through every sub-RE (no who/what/when/where
// opener, no "give me ... name" shape) to a generic WITS roll, whose success then hit
// genericGroundedOutcome's atmosphere-only pool — a gen:s empty success ("the way ahead
// opens a little") on a turn that demanded a concrete fact. Anchored on "name me" +
// a determiner (one/another/a/an/the) so it routes to the deliver-or-decline contract
// (delivers a grounded name if canon holds one, honestly declines if not — never
// inventing a family name, EK-1). "Name your price"/"name the time" have no "me" after
// "name" and stay unaffected.
const INFO_SEEKING_NAME_ME_RE = /\bname\s+me\s+(?:one|another|a|an|the)\b/i;

// (gate-16, lore-hound) "name one person old enough to remember the Boneknits" — the
// IMPERATIVE sibling of INFO_SEEKING_NAME_ME_RE: "name (one|a|the|some) <person/family
// noun>" with NO "me" and no "?" (so neither the name-me anchor nor isQuestionShaped
// caught it) → fell to a generic roll → gen:s empty-success. Requires a determiner AND a
// person/entity noun, so naming ACTIONS ("name my sword", "name your price", "name the
// time/village") don't trip it. Routes to deliver-or-decline (a grounded name is delivered;
// an ungrounded one honestly declines — never invents a name, EK-1).
const INFO_SEEKING_NAME_ONE_RE = /\bname\s+(?:me\s+)?(?:one|another|a|an|the|some)\s+(?:[a-z']+\s+){0,3}(?:person|someone|somebody|soul|man|woman|girl|boy|elder|elders|family|families|villager|local|resident|witness|survivor|name)\b/i;

export function isInfoSeekingText(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;
  if (INFO_SEEKING_EXCLUDE_RE.test(t)) return false;
  return INFO_SEEKING_RE.test(t) || INFO_SEEKING_OBSERVE_RE.test(t) || INFO_SEEKING_TOPIC_RE.test(t)
    || INFO_SEEKING_CONCEALMENT_RE.test(t) || INFO_SEEKING_EXISTENTIAL_RE.test(t)
    || INFO_SEEKING_ORIGIN_RE.test(t) || INFO_SEEKING_FOUNDING_RE.test(t)
    || INFO_SEEKING_TENURE_RE.test(t)
    || INFO_SEEKING_PRIOR_HOLDER_RE.test(t)  // H-89 — "who ran this place before X?"
    || INFO_SEEKING_PROVENANCE_RE.test(t)
    || INFO_SEEKING_SURVEILLANCE_RE.test(t)
    || INFO_SEEKING_BACKSTORY_RE.test(t) || INFO_SEEKING_IDENTITY_RE.test(t)
    || INFO_SEEKING_WHY_ABSENT_RE.test(t)
    || INFO_SEEKING_NAME_ME_RE.test(t)   // U232 — "name me one other old family"
    || INFO_SEEKING_NAME_ONE_RE.test(t); // gate-16 — "name one person old enough to remember…"
}

// Confrontation / contradiction challenge (H-42, IG-11 social physics): "You
// said Kael was here before any of you. He says he came later. One of you is
// lying — which one?" — the player accuses a present person of lying or
// contradicting themselves, rather than asking what happened. Distinct from
// isInfoSeekingText above (a fact-DEMAND): this is an accusation aimed at a
// person, and a real DM has that person react — deflect, bristle, hold firm —
// never answer with scene-narration filler (Opus gate, Lore-hound t12,
// DM_TEST_DEADEND: the insight roll failed and the DM fell to the generic
// place-filler "...doesn't give it to you" instead of an NPC reaction).
// Recall-biased net of independent accusatory markers (same philosophy as
// INFO_SEEKING_TOPIC_RE's verb-phrase generalization over a noun list) — each
// requires an unambiguous accusation/contradiction signal so a neutral
// statement or a plain info-ask (isInfoSeekingText's job) never trips this.
const CONFRONTATION_SAID_BUT_RE = /\byou\s+(?:said|told\s+me|claimed)\b[\s\S]{0,80}?\b(?:but|yet|however|and\s+now|now\s+you)\b/i;
// "lying" alone is ambiguous (cf. "lying" = reclining) — guarded with a
// negative lookahead against the common spatial-preposition reading ("she's
// lying in the grass") so an examine/status action on a prone NPC never
// misreads as an accusation.
const CONFRONTATION_LYING_RE = /\b(?:you'?re|(?:one|which)\s+of\s+you\s+is|he'?s|she'?s|they'?re)\s+lying\b(?!\s+(?:in|on|down|there|here|beside|near|under|within|across|by)\b)|\bstop\s+lying\b(?!\s+(?:in|on|down|there|here)\b)/i;
const CONFRONTATION_ADMIT_RE = /\badmit\s+it\b/i;
const CONFRONTATION_CLAIMED_RE = /\byou\s+claimed\b/i;
const CONFRONTATION_CONTRADICTS_RE = /\bcontradicts\s+what\s+you\s+said\b/i;
const CONFRONTATION_SWORE_BUT_RE = /\byou\s+swore\b[\s\S]{0,80}?\bbut\b/i;
// THE_REF-1 (gate-13 turn-5): the accusation-BY-QUESTION shape — "are you telling me
// he lied about that?", "so you're saying she lied", "are you lying to me?". The
// LYING_RE above only caught present-tense "you're/he's lying"; this catches the
// "are you telling/saying/claiming … lie(d)/lying" frame and bare "are you lying".
// Tight: requires the telling/saying frame OR a direct "are you lying" — so "are you
// telling me the truth?" / "are you saying it's over?" (no lie token) do not match.
const CONFRONTATION_TELLING_LIED_RE = /\bare\s+you\s+(?:telling|saying|claiming|suggesting)\b[^?]{0,80}?\b(?:lie[ds]?|lying)\b|\bare\s+you\s+lying\b/i;
// THE_REF-3 (gate-13 rerun turn-10): a contradiction between two claims — "one of
// them's wrong", "one of those is wrong", "that contradicts what Corwin said" — is a
// confrontation sibling (the player asserts someone's account is false). Routes to the
// outcome-aware confrontationReaction (THE_REF-1) instead of a gen:s success; the
// contested fact is never invented. Tight: requires "one of {them/those/you/these/the
// two} (is/are/'s) wrong/mistaken/lying/false" OR "contradicts what <X> said/claimed" —
// so "what is wrong?", "wrong turn", and "wrong road" do NOT match.
const CONFRONTATION_ONE_OF_WRONG_RE = /\bone\s+of\s+(?:them|those|you|these|the\s+two)\b[^.?!]{0,24}?\b(?:is|are|'?s)\s+(?:wrong|mistaken|lying|false|not\s+(?:right|true))\b/i;
const CONFRONTATION_CONTRADICTS_WHO_RE = /\bcontradicts\s+what\s+\w+\s+(?:said|told|claimed|swore|says)\b/i;

export function isConfrontationChallenge(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;
  return CONFRONTATION_SAID_BUT_RE.test(t) || CONFRONTATION_LYING_RE.test(t)
    || CONFRONTATION_ADMIT_RE.test(t) || CONFRONTATION_CLAIMED_RE.test(t)
    || CONFRONTATION_CONTRADICTS_RE.test(t) || CONFRONTATION_SWORE_BUT_RE.test(t)
    || CONFRONTATION_TELLING_LIED_RE.test(t)
    || CONFRONTATION_ONE_OF_WRONG_RE.test(t) || CONFRONTATION_CONTRADICTS_WHO_RE.test(t);
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

// Extract the game-stat the player named in an explicit check request.
// Defaults to WITS (perception/insight) when no stat is specified. Prefers the
// stat named as the roll TARGET ("roll … against WITS") or the named check
// ("a WITS check") over the first stat mentioned — so "not a CHARM attempt …
// roll against WITS" resolves to WITS, not the earlier CHARM. (H-26c)
function extractRequestedStat(text) {
  const t = String(text || '').toLowerCase();
  const target = t.match(META_EXPLICIT_CHECK_C);
  if (target) return resolveStatKey(target[1]);
  const named = t.match(META_EXPLICIT_CHECK_D);
  if (named) return resolveStatKey(named[1]);
  const m = t.match(/\b(might|agility|wits|grit|charm|strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\b/i);
  return m ? resolveStatKey(m[1]) : 'WITS';
}

// Extract the roll number (and optionally the DC) cited by the player.
// Returns { roll, dc } or null if no number is found.
function extractCitedRoll(text) {
  const t = String(text || '');
  // "N vs DC M" form — captures both roll and DC
  const vsDC = t.match(/\b(\d+)\s+(?:vs\.?|versus|against)\s+dc\s*(\d+)\b/i);
  if (vsDC) return { roll: Number(vsDC[1]), dc: Number(vsDC[2]) };
  // "rolled/got/said/had [a] N" or "you told me [I rolled] [a] N"
  const rolledN = t.match(/\b(?:(?:i|you)(?:\s+told me i)?\s+(?:rolled?|got|said|had)|my roll was)\s+(?:a\s+)?(\d+)\b/i);
  if (rolledN) return { roll: Number(rolledN[1]), dc: null };
  return null;
}

// Describes a catalog def's real mechanical effect in plain language, or
// null when the def has none (a real DM never invents what an item does, and
// never claims "no effect" for one that has a real effect — H-45). Includes
// the real amount/condition off the catalog (not just "it's restorative") so
// the capability is stated precisely regardless of current HP — H-47.
function describeItemEffect(def) {
  if (!def || !def.effect) return null;
  if (def.effect.kind === 'heal') {
    const amt = def.effect.amount ? ` ${def.effect.amount}` : '';
    return `it heals${amt}`;
  }
  if (def.effect.kind === 'removeCondition') return `it cures ${def.effect.condition}`;
  return null;
}

// A carried item's damage die as a "NdM" string, or '' if untracked. Shared
// by answerWeaponDamage and answerItemQuery's fold (H-47) so the two never
// drift on how a weapon's die is read off the loadout.
function weaponDieString(w) {
  const dmg = String(w?.damage || '').trim();
  if (/^\d+d\d+$/i.test(dmg)) return dmg;
  const n = Number(w?.dmgDie) || 0;
  return n > 0 ? `1d${n}` : '';
}

// Gathers every carried item (both inventory shapes) as {name, note, def}.
// Two inventory shapes coexist (Pass T1/T2): the legacy flavor buckets
// (weapons/armor/.../consumables/junk — name+notes, no mechanical link) and
// the structured `items[]` array (id+defRef, resolved against the real
// catalog). A flavor entry CAN also carry a defRef (H-45 — Bandages/Tonic of
// grit/Holy water in the fantasy pack) once it's been bridged into items[] at
// chargen, so both shapes are checked against the catalog here.
function gatherCarriedItems(world) {
  const inv = world.party?.[0]?.inventory || {};
  const flavor = [].concat(
    inv.weapons || [], inv.armor || [], inv.tools || [], inv.clothes || [],
    inv.oddities || [], inv.consumables || [], inv.tech || [], inv.junk || []
  ).filter(it => it && (it.name || typeof it === 'string'))
   .map(it => ({ name: String(it.name || it).trim(), note: String(it.notes || it.note || '').trim(), def: findDefByName(it.name || it) }));
  const structured = (Array.isArray(inv.items) ? inv.items : [])
    .map(it => getItemDef(it.defRef))
    .filter(Boolean)
    .map(def => ({ name: def.name, note: '', def }));
  return [...flavor, ...structured];
}

// Common words that happen to be ≥4 chars and so would otherwise pass as a
// "distinctive" item-name token below — "Cloak of MANY patches" must not
// false-match a question like "how MANY doses do I have" just because the
// generic query word overlaps one word of the item's name. (H-70)
const ITEM_TOKEN_STOPWORDS = new Set([
  'many', 'much', 'have', 'does', 'what', 'your', 'this', 'that', 'with',
  'from', 'into', 'only', 'also', 'some', 'more', 'most', 'then', 'than',
  'when', 'were', 'will', 'just', 'very',
]);

// True if `n` (lowercased item name) is referenced in the player's text —
// either verbatim or by a distinctive (≥4-char, non-stopword) token of it.
function itemNameInText(lowerText, n) {
  if (!n) return false;
  if (lowerText.includes(n)) return true;
  return n.split(/\s+/).filter(x => x.length >= 4 && !ITEM_TOKEN_STOPWORDS.has(x)).some(tok => lowerText.includes(tok));
}

// True if the player asked a quantity/count question ("how many doses do I
// have", "how many Tonics of grit do I have?"). Checked before the presence
// branch in answerItemQuery — "how many X do I have" also contains "do i
// have", which would otherwise be swallowed by the presence regex and
// answer "Yes — X is in your pack" with no number. (H-70)
const ITEM_COUNT_RE = /\bhow many\b/i;

// A bare consumable-count cue ("how many doses/consumables/potions do I
// have") — names no specific item, so answerItemQuery's per-item fold
// (H-70) finds nothing and returns null. Checked only after that fold comes
// up empty, so a NAMED count ("how many doses of Tonic of grit") still goes
// through the single-item branch above, not this list. (H-73)
const GENERIC_CONSUMABLE_CUE = /\b(doses?|consumables?|potions?|drinks?|vials?|things to (?:drink|use))\b/i;

// True if the same message also asks what the item DOES (a compound ask —
// "what does the Tonic of grit do, and how many doses do I have?"). Reuses
// the same broad "what does/is/are" cue the query branch below answers from,
// so a count-only ask doesn't pick up an unrequested effect line. Second
// alternative catches the "what's X do" contraction ("what's the Tonic of
// grit do exactly, and how many bandages do I have?") — "what's" doesn't
// match the first alternative's "what does/do/is/are" shape since there's
// no space between "what" and the contracted verb. (H-77)
const ITEM_EFFECT_CUE_RE = /\bwhat\s+(?:does|do|is|are)\b|\bwhat'?s\b[\s\S]{0,40}?\bdo(?:es)?\b/i;

// Answer a question about carried item(s) ("what does X do?", "is X in my
// pack?", "does X heal HP?"). Returns null if no carried item matches, so
// non-item queries fall through to normal resolution.
//
// Folds EVERY item named in the query (H-47) — not just the first inventory
// entry whose name happens to appear in the text. A compound ask ("what does
// the Tonic of grit do, and the Worn Blade/Kitchen cleaver damage?") used to
// answer only about whichever flavor item came first in the bucket order,
// silently masking the Tonic's real heal.
function answerItemQuery(lowerText, world) {
  const inv = world.party?.[0]?.inventory || {};
  const weaponDieByName = new Map(
    (Array.isArray(inv.weapons) ? inv.weapons : [])
      .map(w => [String(w?.name || w).trim().toLowerCase(), weaponDieString(w)])
  );
  const items = gatherCarriedItems(world);
  if (!items.length) return null;

  const seen = new Set();
  const matches = items.filter(it => {
    const n = it.name.toLowerCase();
    if (!itemNameInText(lowerText, n) || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
  if (!matches.length) return null;

  // Quantity/count query ("how many doses do I have", compound "what does it
  // do AND how many doses") — checked before the presence branch below,
  // which would otherwise swallow this via its own "do i have" alternative
  // and answer presence-only with no number. Reports the REAL count off the
  // pack (counting every matching entry across both inventory shapes), never
  // an invented dose number the data doesn't carry. (H-70)
  if (ITEM_COUNT_RE.test(lowerText)) {
    const wantsEffect = ITEM_EFFECT_CUE_RE.test(lowerText);
    const parts = matches.map(m => {
      const n = items.filter(it => it.name.toLowerCase() === m.name.toLowerCase()).length;
      const countLine = n === 1 ? `You have one ${m.name}.`
        : n > 1 ? `You have ${n} ${m.name}.`
        : `You don't have any ${m.name} left.`;
      const effectLine = wantsEffect ? describeItemEffect(m.def) : null;
      return effectLine ? `${m.name} — ${effectLine}. ${countLine}` : countLine;
    });
    return parts.join(' ');
  }

  const presence = /\b(do i (?:still )?have|have i (?:still )?got|am i carrying|(?:still\s+)?in\s+my\s+(?:pack|bag|inventory|kit|consumables|belongings)|gone\s+or\s+still|get\s+used\s+up)\b/.test(lowerText);
  if (presence) {
    const names = matches.map(m => m.name);
    return `Yes — ${joinList(names)} ${names.length > 1 ? 'are' : 'is'} in your pack.`;
  }

  // effect query — describe each asked-about item's real effect when there is
  // one; weapon damage when asked and the item is a weapon; otherwise the
  // honest, unembellished "just what it looks like" line. Never invented,
  // never an auto-success, never masked by another matched item.
  const damageAsked = /\b(?:damage|dmg)\b/i.test(lowerText);
  const parts = matches.map(m => {
    const { name, def } = m;
    const note = m.note.replace(/[.?!]+$/, '');
    const effectLine = describeItemEffect(def);
    if (effectLine) return `${name}${note ? ` (${note})` : ''} — ${effectLine}.`;
    const die = weaponDieByName.get(name.toLowerCase());
    if (damageAsked && die) return `the ${name} rolls ${die} for damage.`;
    return note
      ? `${name}: ${note}. It's a real thing in your pack, not a game-piece — nothing special fires when you use it.`
      : `${name} is just what it looks like — no special effect I track.`;
  });
  return parts.join(' ');
}

// Corrects a player's false claim that a carried item is inert/useless/does
// nothing, when canon actually gives it a real effect — a real DM doesn't
// agree with a wrong statement about the world. Returns null when no carried
// item is named, or when the named item genuinely has no effect (a true
// claim needs no correction). (H-47)
function correctInertClaim(lowerText, world) {
  const items = gatherCarriedItems(world);
  const match = items.find(it => itemNameInText(lowerText, it.name.toLowerCase()));
  if (!match) return null;
  const effectLine = describeItemEffect(match.def);
  if (!effectLine) return null;
  return `Not quite — ${match.name} ${effectLine}.`;
}

// "List my consumables" — the real consumables from BOTH inventory shapes
// (the legacy flavor bucket for Rations/Lamp oil, and the structured items[]
// for anything bridged to a real catalog def — H-45), never invented. An
// empty pack is reported honestly. (H-45)
function listConsumables(world) {
  const inv = world.party?.[0]?.inventory || {};
  const flavorNames = (Array.isArray(inv.consumables) ? inv.consumables : [])
    .map(it => String(it?.name || it).trim()).filter(Boolean);
  const structuredNames = (Array.isArray(inv.items) ? inv.items : [])
    .map(it => getItemDef(it.defRef))
    .filter(def => def && def.kind === 'consumable')
    .map(def => def.name);
  const names = [...flavorNames, ...structuredNames];
  return names.length
    ? `Your consumables: ${names.join(', ')}.`
    : `You're not carrying anything you could drink, eat, or use up — no consumables in the pack.`;
}

// Bare consumable-count answer ("how many doses do I have") — same real
// per-item source as listConsumables, but with a count per name rather than
// a flat list, since the player asked "how many" not "what". (H-73)
function listConsumableCounts(world) {
  const inv = world.party?.[0]?.inventory || {};
  const flavorNames = (Array.isArray(inv.consumables) ? inv.consumables : [])
    .map(it => String(it?.name || it).trim()).filter(Boolean);
  const structuredNames = (Array.isArray(inv.items) ? inv.items : [])
    .map(it => getItemDef(it.defRef))
    .filter(def => def && def.kind === 'consumable')
    .map(def => def.name);
  const names = [...flavorNames, ...structuredNames];
  if (!names.length) {
    return `You're not carrying anything you could drink, eat, or use up — no consumables in the pack.`;
  }
  const counts = new Map();
  for (const n of names) counts.set(n, (counts.get(n) || 0) + 1);
  const parts = [...counts.entries()].map(([n, c]) => `${n} ×${c}`);
  return `You're carrying: ${parts.join(', ')}.`;
}

// Answer a weapon damage-die query from the real loadout. Inventory weapons
// carry either a `damage` string ("1d6") or, for the kit weapon, a numeric
// `dmgDie`. If specific weapons are named in the question, report those; else
// report the whole loadout. Never returns null for a started PC (there is
// always at least one weapon to report).
function answerWeaponDamage(lowerText, world) {
  const inv = world.party?.[0]?.inventory || {};
  const weapons = (Array.isArray(inv.weapons) ? inv.weapons : [])
    .map(w => ({ name: String(w?.name || w).trim(), dice: weaponDieString(w) }))
    .filter(w => w.name);
  if (!weapons.length) return null;

  const named = weapons.filter(w => {
    const n = w.name.toLowerCase();
    if (lowerText.includes(n)) return true;
    return n.split(/\s+/).filter(tok => tok.length >= 4).some(tok => lowerText.includes(tok));
  });
  const describe = w => w.dice ? `the ${w.name} rolls ${w.dice}` : `the ${w.name} has no fixed damage die I track`;

  const list = (named.length ? named : weapons).filter(w => w.dice);
  if (!list.length) return null;
  return named.length
    ? `For damage: ${joinList(named.map(describe))}. You add your relevant ability modifier on a hit.`
    : `Your weapons roll for damage as follows — ${joinList(list.map(describe))}, plus your ability modifier on a hit.`;
}

// Report the last recorded roll (number + DC + outcome) straight from the
// ledger, or null when nothing's on record (no over-claim). Shared by the
// standalone META_ROLL_QUERY branch and the weapon-damage compound fold
// below, so "give me the raw d20 and the damage die" answers both halves
// instead of the damage half winning alone. (CT-1)
function lastRollReportLine(world) {
  const stored = world.conversation?.lastRoll;
  if (!stored || !Number.isFinite(Number(stored.roll))) return null;
  return `The ledger shows ${stored.roll} vs DC ${stored.dc}${stored.outcome ? ` — ${stored.outcome}` : ''}. That's your last roll.`;
}

// Answer a coin/purse query from the real purse — a table DM just states the
// number, no roll. An empty purse is reported honestly, never invented.
// Reuses the shop layer's own copper-total/format helpers so the DM's count
// and the shop's count can never drift apart. Shared by the META_PURSE
// branch, the weapon-damage compound fold, and the possession-correction
// fold below (H-35 R1/R2).
function answerPurse(world) {
  const purse = world.party?.[0]?.purse || {};
  const total = purseTotalCopper(purse);
  return total > 0
    ? `Your purse holds ${formatPrice(total)}.`
    : `Your purse is empty — you're flat broke.`;
}

// Real current-HP/status line, in-voice, no roll. Shared by the standalone
// META_HEALTH branch and the compound folds below (a gear-or-name ask that
// also names hit points in the same breath must not drop the HP half).
// (H-36a R2)
function answerHealth(world) {
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

// Player's class/archetype, one line, for folding into a compound name+class
// ask — distinct from the full identity speech in the META_CHARACTER branch.
// (H-36a R2)
function answerClassLine(world) {
  const arch = String(world.party?.[0]?.archetype || '').trim();
  return arch ? `You're a ${arch.toLowerCase()}.` : '';
}

// Rules/capability question answer — "is Gravedigger a class?" / "what can I
// do in a fight?". Answered from the ruleset and archetype, never rolled.
// (DTD-A Fix 1)
export function answerCapability(world) {
  const arch = String(world.party?.[0]?.archetype || '').trim();
  const parts = [];
  if (arch) {
    parts.push(`${arch} is a background — it marks who you are and shapes your starting kit, not a formal class with named powers.`);
  }
  parts.push(`In a fight you can: attack (name a target, describe your approach), use any item you're carrying, attempt to restrain, trip, disarm, or shove a foe, try something creative, or cut and run.`);
  parts.push(`Your stats set the odds — Might for melee, Agility for ranged and evasion, Grit for endurance.`);
  return parts.join(' ');
}

// Name what's actually equipped, in-voice, no roll. An empty loadout is
// reported honestly — the DM never invents a weapon the player lacks.
// Shared by the META_EQUIPMENT/META_HELD_ITEMS answer and the possession-
// contradiction correction below (H-31 R3), so both read from one place.
function describeLoadout(world) {
  const p = world.party?.[0] || {};
  const inv = p.inventory || {};
  const names = (arr) => (Array.isArray(arr) ? arr : []).map(it => String(it?.name || it).trim()).filter(Boolean);
  const weapons = names(inv.weapons);
  const armor = names(inv.armor);
  const sig = String(p.signature?.itemName || '').trim();
  // Skip the signature-item line when that item is ALREADY named in the
  // weapons/armor line above — a signature weapon ("Kitchen cleaver" both
  // equipped AND the signature item) was listed twice. (H-35 R3)
  const sigLower = sig.toLowerCase();
  const alreadyListed = sigLower && [...weapons, ...armor].some(n => n.toLowerCase().includes(sigLower) || sigLower.includes(n.toLowerCase()));
  const sigName = sig && !/^thing$/i.test(sig) && !alreadyListed ? sig : '';
  // Structured consumables live in items[] (defRef-keyed) after H-45 moved
  // them out of the legacy consumables[] bucket. Include them so "what gear
  // do I have on me?" names the real items (e.g. Holy water) and the DM
  // never falls silent on canon kit the player is carrying. (DTD-A Fix 3)
  const consumableNames = (Array.isArray(inv.items) ? inv.items : [])
    .map(it => { const def = getItemDef(it?.defRef); return def?.name ? String(def.name) : ''; })
    .filter(n => Boolean(n)
      && !weapons.some(w => w.toLowerCase() === n.toLowerCase())
      && (!sigName || n.toLowerCase() !== sigLower));
  const parts = [];
  parts.push(weapons.length
    ? `You're armed with ${joinList(weapons)}.`
    : `You bear no weapon worth the name — just your hands and whatever you can lay them on.`);
  if (armor.length) parts.push(`You're wearing ${joinList(armor)}.`);
  else parts.push(`Nothing but your own clothes stand between you and a blade.`);
  if (sigName) parts.push(`And you carry ${sigName}, which means something to you.`);
  if (consumableNames.length) parts.push(`In your pack: ${joinList(consumableNames)}.`);
  return parts.join(' ');
}

// Real pack contents as PROSE — never the internal "weapons:/armor:" category
// dump (which reads like a UI/stat leak; gate-5 DM_ARTIFACT_LEAK), never
// invented. Lists every real item by name (weapons, armor, tools, consumables,
// …) via joinList. Shared by the inventory readout AND the identity answer, so
// "what am I carrying?" names the actual kit (incl. consumables) instead of
// deflecting to "read your sheet" (gate-5 deflect-to-sheet). Dedup/merge logic
// is the former META_INVENTORY body (H-45/H-46). (N-1)
function describePack(world) {
  const inv = world.party?.[0]?.inventory || {};
  const byCat = {};
  const seen = new Set();
  for (const [cat, items] of Object.entries(inv)) {
    if (!Array.isArray(items) || !items.length || cat === 'items') continue;
    const names = items.map(it => String(it?.name || it)).filter(Boolean);
    if (names.length) {
      byCat[cat] = names;
      for (const n of names) seen.add(n.toLowerCase());
    }
  }
  // Merge the structured items[] array (defRef-keyed) so a bridged consumable
  // (Tonic of grit) lands alongside the rest rather than vanishing. Unresolved
  // defRefs are dropped, not invented; already-listed names aren't repeated.
  for (const it of (Array.isArray(inv.items) ? inv.items : [])) {
    const def = getItemDef(it?.defRef);
    if (!def || !def.name) continue;
    if (seen.has(def.name.toLowerCase())) continue;
    seen.add(def.name.toLowerCase());
    byCat.items || (byCat.items = []);
    byCat.items.push(def.name);
  }
  const allNames = Object.values(byCat).flat();
  return allNames.length
    ? `You go through your pack — ${joinList(allNames)}.`
    : 'Your pack is light — nothing but lint and resolve.';
}

// Skill→stat→modifier, the real number off the sheet. Shared by the
// standalone META_SKILL_MOD ask and the modifier-formula fallback below, so a
// skill name reaching either path gets the same clean answer instead of one
// of them leaking the abstract breakpoint table. Returns null when no
// recognized skill name is present in the text. (H-25; extracted H-40)
function answerSkillModifier(lowerText, world) {
  const sm = lowerText.match(META_SKILL_MOD);
  if (!sm) return null;
  const raw = sm[1].toLowerCase().replace(/\s+/g, '_'); // "sleight of hand" → sleight_of_hand
  const statKey = SKILL_STAT[raw] || 'WITS';
  const p = world.party?.[0] || {};
  const score = Number(p.stats?.[statKey]) || 10;
  const base = statMod(score);
  const foci = Array.isArray(p.foci) ? p.foci.map(f => String(f).toLowerCase()) : [];
  const proficient = foci.includes(raw);
  const prof = proficient ? profBonusFor(Number(p.level) || 1) : 0;
  const skillName = raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const clause = proficient
    ? ` — ${statKey} ${fmtMod(base)} plus proficiency +${prof}`
    : ` — off your ${statKey}, ${fmtMod(base)} (you're not trained in it)`;
  return `Your ${skillName} modifier is ${fmtMod(base + prof)}${clause}.`;
}

// Governing stat for a melee/ranged ATTACK ("which modifier applies to a melee
// strike — MIGHT or AGILITY?"). Melee runs off MIGHT (escapeCombat.js: d20+MIGHT
// to hit, d6+MIGHT damage); ranged off AGILITY. Answer straight with the real
// modifier — never the raw breakpoint table or a generic skill roll. Returns
// null when the text isn't this governing-stat question. (H-80)
function answerAttackGoverningStat(lowerText, world) {
  if (!META_ATTACK_GOVERNING_STAT.test(lowerText)) return null;
  const ranged = /\b(?:ranged|range|bow|thrown|missile|arrow|sling|crossbow)\b/i.test(lowerText);
  const statKey = ranged ? 'AGILITY' : 'MIGHT';
  const score = Number(world.party?.[0]?.stats?.[statKey]) || 10;
  const mod = fmtMod(statMod(score));
  return ranged
    ? `Ranged attacks run off AGILITY — yours is ${score} (${mod}), so it's d20 ${mod} to hit. (Melee uses MIGHT.)`
    : `Melee attacks run off MIGHT — yours is ${score} (${mod}), so it's d20 ${mod} to hit and d6 ${mod} for damage. (Ranged uses AGILITY.)`;
}

// Full ability-score block ("MIGHT 12 (+1), AGILITY 9 (-1), ..." plus escape-
// mode HP when applicable) — the same "give me my numbers" content every
// stats-request fold needs. Shared by the compound INVENTORY/EQUIPMENT/
// ATTACK_MOD folds below so "what are my actual stats and X?" never drops
// the stats half again (H-40). Returns '' when the sheet has no stats yet.
function answerFullStats(world) {
  const stats = world.party?.[0]?.stats || {};
  const order = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
  const line = order.filter(k => k in stats).map(k => `${k} ${stats[k]} (${fmtMod(statMod(Number(stats[k]) || 10))})`).join(', ');
  if (!line) return '';
  let ans = `Your measures: ${line}.`;
  const eMax = Number(world.meta?.escapeMaxHp) || 0;
  if (world.meta?.mode === 'escape' && eMax > 0) {
    ans += ` Hit points: ${Number(world.meta?.escapeHp) || 0} of ${eMax}.`;
  }
  return ans;
}

// Returns the claimed possession nouns ("staff", "robe"...) that have no
// match anywhere in real inventory, or null when there's no claim to check
// (or every claimed noun IS real gear, by substring — so "I'm holding a
// blade" against a real "Worn Blade" is never flagged). Pure; never throws.
function findBogusPossessionClaim(lowerText, world) {
  if (!POSSESSION_CLAIM_TRIGGER.test(lowerText)) return null;
  const claimed = [...new Set((lowerText.match(POSSESSION_NOUN_RE) || []).map(w => w.toLowerCase()))];
  if (!claimed.length) return null;
  const inv = world.party?.[0]?.inventory || {};
  const realNames = [].concat(
    inv.weapons || [], inv.armor || [], inv.tools || [], inv.clothes || [],
    inv.oddities || [], inv.consumables || [], inv.tech || [], inv.junk || [], inv.items || []
  ).map(it => String(it?.name || it || '').toLowerCase());
  // "armor"/"armour" is a CATEGORY word, not a specific item name: a player who
  // references "my armor" while wearing a category-armor item is NOT making a
  // bogus claim, even when that item's NAME lacks the word "armor" (e.g. a
  // "Padded coat" sits in inv.armor). Grounding it by name-substring alone made
  // an AC-math question ("does my armor class account for my AGILITY -1?")
  // self-contradict — "There's no armor — you're wearing Padded coat" — and ate
  // the real question. Ground the bare category word against the armor SLOT.
  // (gate-9 RL t2; C6/C8)
  const hasArmorEquipped = Array.isArray(inv.armor) && inv.armor.length > 0;
  const bogus = claimed.filter(c => {
    if (/^armou?r$/.test(c) && hasArmorEquipped) return false;
    return !realNames.some(n => n.includes(c));
  });
  return bogus.length ? bogus : null;
}

// Strip the "armor/armour value/class/rating/number/score" phrase (the AC
// NUMBER, not a gear item or a character class) before testing for a class
// or gear mention below — "what's my name and my armor class?" must stay
// clear of the character-class/gear-item fold; that's META_ARMOR_VALUE's
// own ask. (H-38a R1)
function stripArmorClassPhrase(lowerText) {
  return lowerText.replace(/\b(?:armor|armour)\s+(?:value|class|rating|number|score)\b/gi, '');
}

// Broad CLASS mention — folds a class answer into a compound name/sheet/
// identity ask. Broader than META_CLASS_FOLD_RE (which requires "and class"
// immediately) so "name, class, and gear" (class BEFORE the "and", not
// after) still folds. (H-38a R1)
function mentionsCharacterClass(lowerText) {
  return META_CLASS_FOLD_RE.test(lowerText) || /\bclass\b/i.test(stripArmorClassPhrase(lowerText));
}

// Broad GEAR mention — folds a gear/equipment answer into a compound name/
// sheet/identity ask. Broader than META_EQUIPMENT/META_HELD_ITEMS/
// META_INVENTORY/META_GEAR_YESNO (which gate the PRIMARY route and stay
// narrow on purpose) — catches phrasings that only show up FOLDED alongside
// another ask: "what gear is on me right now", "what weapons, armor, and
// gear are on my sheet", "every item I'm carrying", "what do my hands find
// when I pat myself down". (H-38a R1)
// "see/show/check my inventory" ("see" is not an inventory VERB in META_INVENTORY,
// which stays narrow for the primary route) and "what is my CHARACTER carrying"
// (META_INVENTORY anchors on "what am I carrying", not "my character carrying") are
// fold-only phrasings — they only appear alongside another ask ("…and my current HP?").
// Adding them here (not to META_INVENTORY) folds the loadout without widening the
// primary route. (P10 gate RL-1: "what's my character carrying — inventory and HP?"
// answered stats+HP but dropped the item list.)
const GEAR_ASK_FOLD_RE = /\b(?:gear|weapons?|armou?r|equipment|loadout)\b[\s\S]{0,25}\b(?:on\s+me|on\s+my\s+(?:person|sheet|body)|right\s+now)\b|\bi'?m\s+carrying\b|\bmy\s+character\s+(?:is\s+)?carrying\b|\b(?:see|show\s+me|check)\s+my\s+(?:inventory|pack|bag|gear|equipment|loadout|kit)\b|\bpat\s+(?:myself|him|her)\s+down\b|\bwhat\s+do\s+my\s+hands\s+(?:actually\s+)?find\b/i;

function mentionsGearAsk(lowerText) {
  const stripped = stripArmorClassPhrase(lowerText);
  return META_EQUIPMENT.test(stripped) || META_HELD_ITEMS.test(stripped)
    || META_INVENTORY.test(stripped) || META_GEAR_YESNO.test(stripped)
    || GEAR_ASK_FOLD_RE.test(stripped);
}

// Broad HP mention — folds an HP answer into a compound name/identity ask.
// Broader than META_HEALTH (which is anchored on standalone status-check
// phrasings like "am I hurt"/"how's my health" and deliberately does NOT
// match a bare "current HP"/"HP" appearing inside a multi-part list, e.g.
// "name, class, and current HP?"). Fold-only — never widen META_HEALTH
// itself, or the standalone "am I hurt?" path picks up unwanted matches.
// (H-54 R1)
function mentionsHpAsk(lowerText) {
  return /\b(?:current\s+)?hp\b|\bhit\s?points?\b/i.test(lowerText);
}

// Broad LEVEL mention — folds a level answer into a compound name/class/HP
// ask. Bare word match; safe because every caller already gates on a wider
// compound-detection condition (a QUERY_CUE or a co-occurring sibling field),
// so a stray "level" in unrelated narration never reaches this alone. (H-59)
function mentionsLevelAsk(lowerText) {
  return /\blevel\b/i.test(lowerText);
}

// Terse identity-slot compound — "name / class / current HP?", "class,
// level, and HP — what are they?". Requires 2+ of {name, class, level, HP}
// AND an explicit query cue, so plain narration that happens to use one of
// these common words is never swept in. (H-59 Fix A — last-resort, only
// reached when no more specific META_* branch already claimed the text.)
const IDENTITY_QUERY_CUE_RE = /\?|status\s+check|quick|please|all\s+three|give\s+me|confirm|what\s+are\s+they/i;
function hasIdentitySlotCompound(lowerText) {
  if (!IDENTITY_QUERY_CUE_RE.test(lowerText)) return false;
  const hasName = /\bname\b/i.test(lowerText);
  const hasClass = mentionsCharacterClass(lowerText);
  const hasLevel = mentionsLevelAsk(lowerText);
  const hasHp = mentionsHpAsk(lowerText) || META_HEALTH.test(lowerText);
  return [hasName, hasClass, hasLevel, hasHp].filter(Boolean).length >= 2;
}

// Weapon damage for explicitly-named weapons, or — if the text asks about
// "weapons" generically with no specific name ("what do my weapons deal") —
// every carried weapon's die. Distinct from answerWeaponDamage (which never
// falls back to "all weapons" on a bare generic ask, by design, for its own
// standalone branch); this fallback exists only for the H-59 compound path.
function answerNamedOrAllWeaponDamage(lowerText, world) {
  const inv = world.party?.[0]?.inventory || {};
  const weapons = (Array.isArray(inv.weapons) ? inv.weapons : [])
    .map(w => ({ name: String(w?.name || w).trim(), dice: weaponDieString(w) }))
    .filter(w => w.name && w.dice);
  if (!weapons.length) return '';
  const named = weapons.filter(w => itemNameInText(lowerText, w.name.toLowerCase()));
  const describe = w => `the ${w.name} rolls ${w.dice} for damage`;
  if (named.length) return `${joinList(named.map(describe))}.`;
  if (/\bweapons?\b/i.test(lowerText)) return `Your weapons roll for damage as follows — ${joinList(weapons.map(describe))}.`;
  return '';
}

// Real mechanical effect for every carried item NAMED in the text that has
// one — the item-effect half of the H-59 weapon-damage + item-effect
// compound (C1-002). Returns '' when no named item has a real effect.
function answerNamedItemEffects(lowerText, world) {
  const items = gatherCarriedItems(world);
  const seen = new Set();
  const parts = [];
  for (const it of items) {
    const n = it.name.toLowerCase();
    if (!n || seen.has(n) || !itemNameInText(lowerText, n)) continue;
    const effectLine = describeItemEffect(it.def);
    if (!effectLine) continue;
    seen.add(n);
    parts.push(`${it.name} — ${effectLine}.`);
  }
  return parts.join(' ');
}

// The combat enemy's name + real HP, read straight off world.combat — the
// same source resolveEscapeCombatTurn/combatStatusAnswer read, so this can
// never drift from what the table actually fights. Returns null with no
// live enemy (caller falls through to normal resolution). (H-59 C1-004)
function answerEnemyCompound(world) {
  const enemies = Array.isArray(world.combat?.enemies) ? world.combat.enemies : [];
  const enemy = enemies.find(e => e && !e.defeated) || enemies[0];
  if (!enemy) return null;
  const name = String(enemy.name || 'the enemy').trim();
  const hp = Number(enemy.hp) || 0;
  const maxHp = Number(enemy.maxHp) || hp || 1;
  const status = hp >= maxHp ? 'unhurt' : hp <= 0 ? 'down' : 'hurting';
  return `You're fighting ${name} — they're at ${hp} of ${maxHp} HP (${status}).`;
}

// Handle meta-questions (status checks, location surveys, recaps, outcomes).
// Returns null when the text isn't a recognized meta-question.
export function handleMetaQuestion(text, world) {
  const lowerText = String(text || '').toLowerCase();

  // Governing stat for a melee/ranged ATTACK — "which modifier applies to a
  // melee strike, MIGHT or AGILITY?". Checked FIRST so it never falls to the
  // raw breakpoint table (META_MODIFIER_FORMULA) or a generic skill roll. (H-80)
  const attackStatAns = answerAttackGoverningStat(lowerText, world);
  if (attackStatAns) return attackStatAns;

  // Roll-on-demand — the player explicitly commands the DM to roll a NAMED
  // check/save now and SHOW the result. A real DM (and a digital one, where the
  // player has no die in hand) just rolls it. Checked FIRST so "roll the GRIT
  // save: show me the d20, plus the modifier" ROLLS instead of reciting the
  // breakpoint table (the gate's loudest dead-end after the table itself).
  // Determinism: the d20 is drawn from a seed built off world state + the
  // request text via the SAME makeRng/seedFromString path resolveMove uses —
  // so it's a pure function of state (replay-stable) and consumes no global RNG
  // cursor. The roll is DEMONSTRATIVE: it mutates nothing (narration != canon;
  // a save with no stated trigger has no canonical consequence). Gated on a
  // genuinely NAMED stat-check so a bare "show me the math" can't fabricate a
  // WITS roll out of nothing. (D-B4 residual a — roll-on-demand / C3.)
  if (META_ROLL_NOW.test(lowerText)
      && (META_EXPLICIT_CHECK_C.test(lowerText) || META_EXPLICIT_CHECK_D.test(lowerText))) {
    const stat = extractRequestedStat(text);
    const score = Number(world.party?.[0]?.stats?.[stat] ?? 10);
    const mod = statMod(score);
    // DC: base 12, nudged by a present NPC's openness — identical to the
    // collaborative explicit-check handler so the number is consistent whoever
    // rolls it.
    const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
    const npc = (node?.settlement?.npcs || []).find(n => n && !n.hostile) || null;
    let dc = 12;
    if (npc) {
      const P = npc.personality || {};
      dc = Math.max(8, Math.round(12 - (Number(P.trustOfOutsiders ?? 0.5) - 0.5) * 6));
    }
    const seed = seedFromString(`${world.meta?.seed || ''}|rollnow|${world.scene?.promptSeed || ''}|${world.timeline?.length || 0}|${stat}|${lowerText}`);
    const d20 = makeRng(seed).int(1, 20);
    const total = d20 + mod;
    const pass = total >= dc;
    return `Rolling ${stat}: d20 ${d20} ${fmtMod(mod)} = ${total} vs DC ${dc} — ${pass ? 'success' : 'failure'}.`;
  }

  // Location / survey — checked first (most specific phrasings).
  if (META_LOCATION.test(lowerText) || META_INTERIOR_LAYOUT.test(lowerText) || META_INTERIOR_LAYOUT_SEEK.test(lowerText)) {
    return buildLocationSurvey(world, { queryText: lowerText });
  }

  // Enemy name+HP compound during active combat — "who am I fighting and how
  // much HP does this thing have left?", "name of the foe and their
  // remaining HP". Checked BEFORE META_CHARACTER/META_HEALTH below because
  // those branches were actively misrouting this enemy-scoped language to
  // the PLAYER's own identity/HP ("how hurt are they" tripped META_HEALTH's
  // "how hurt" trigger and answered about the player). (H-59 C1-004)
  if (world.combat?.active && META_ENEMY_STATUS.test(lowerText) && ENEMY_HP_CUE_RE.test(lowerText)) {
    const ans = answerEnemyCompound(world);
    if (ans) return ans;
  }

  // Weapon-damage + item-effect compound — "what does the Tonic of grit do,
  // and what's the damage on my Worn Blade?". Fires only when BOTH a
  // damage-cued weapon AND an effect-cued carried item with a real
  // mechanical effect are present in the same breath; a single-purpose ask
  // is left to META_WEAPON_DAMAGE/META_ITEM below, and a narrated action
  // (no cue) never satisfies either half, so it falls straight through.
  // (H-59 C1-002)
  if (DAMAGE_CUE_RE.test(lowerText) && EFFECT_CUE_RE.test(lowerText)) {
    const weaponPart = answerNamedOrAllWeaponDamage(lowerText, world);
    const itemPart = answerNamedItemEffects(lowerText, world);
    if (weaponPart && itemPart) {
      return `${weaponPart} ${itemPart}`;
    }
  }

  // Possession contradiction — "you said I had a staff and a robe" when
  // canon shows none. Checked before every other branch so a false claim
  // gets named and corrected, not silently re-listed (or, worse, answered
  // by a different branch that drops the contradiction entirely). (H-31 R3)
  {
    const bogus = findBogusPossessionClaim(lowerText, world);
    if (bogus) {
      const loadout = describeLoadout(world);
      let correction = `There's no ${joinOr(bogus)} — ${loadout.charAt(0).toLowerCase()}${loadout.slice(1)}`;
      // The gear correction must not eat the rest of a compound question — a
      // coin claim/ask in the same breath gets answered too, not dropped.
      // (H-35 R2)
      if (META_PURSE.test(lowerText) || COIN_CLAIM_RE.test(lowerText)) correction += ` ${answerPurse(world)}`;
      return correction;
    }
  }

  // Weapon damage — "what's the damage on the Hatchet?", "what die does the
  // damage roll use?". Checked before MECHANICS so a weapon-specific ask gets
  // the real die rather than the generic d20-system explainer. Folds in the
  // Armor value too when both are asked in the same breath — this branch
  // fires before META_ARMOR_VALUE's own (later) check, so a compound ask
  // ("damage die... and my Armor value?") would otherwise drop the AC half.
  // (H-31 R2) Also folds in the purse when asked in the same breath ("how
  // much coin... and what's the damage die") so the coin half isn't dropped
  // the same way the AC half used to be. (H-35 R1)
  if (META_WEAPON_DAMAGE.test(lowerText)) {
    const ans = answerWeaponDamage(lowerText, world);
    if (ans) {
      const extras = [];
      if (WEAPON_AC_MISCONCEPTION_RE.test(lowerText)) {
        extras.push(`Weapons don't carry an AC — that's your own defense number, not theirs.`);
      } else if (META_ARMOR_VALUE.test(lowerText)) {
        const ac = playerAc(world.party?.[0] || {});
        extras.push(`Your Armor is ${ac} — that's the number an attack has to beat to land on you.`);
      }
      if (META_PURSE.test(lowerText)) extras.push(answerPurse(world));
      // Damage×roll compound — "give me the raw d20 and the damage die"
      // answers both halves via the same ledger machinery META_ROLL_QUERY
      // uses standalone, mirroring the stats/purse folds above. (CT-1)
      if (META_ROLL_QUERY.test(lowerText) && !META_ROLL_RECALL.test(lowerText)) {
        const rollLine = lastRollReportLine(world);
        if (rollLine) extras.push(rollLine);
      }
      return extras.length ? `${ans} ${extras.join(' ')}` : ans;
    }
  }

  // Player's own name — "what's my name?", "you called me Garrick". Answer from
  // canon so a name the narrator may have slipped never goes unaddressed.
  if (META_NAME.test(lowerText)) {
    const name = String(world.party?.[0]?.name || '').trim();
    const ans = name
      ? `Your name is ${name}. If I've called you anything else, that was my slip — you're ${name}.`
      : `You haven't given your name yet — what should I call you?`;
    // A name ask in the same breath as HP, class, or gear must answer all of
    // it, not just the name (H-36a R2 gear+coin shape; H-38a R1 broadens the
    // class/gear fold beyond the narrow "and class" form — Rules Lawyer's
    // "what's my character's name, class, and what gear do I have on me?"
    // got only the name back, class and gear silently dropped).
    const extras = [];
    if (mentionsCharacterClass(lowerText)) {
      const classLine = answerClassLine(world);
      if (classLine) extras.push(classLine);
    }
    if (mentionsGearAsk(lowerText)) extras.push(describeLoadout(world));
    if (mentionsHpAsk(lowerText)) extras.push(answerHealth(world));
    return extras.length ? `${ans} ${extras.join(' ')}` : ans;
  }

  // Skill modifier — "what's my Insight modifier? I need a number." Answer with
  // the real number from the sheet: governing game-stat modifier + proficiency
  // when the focus is owned. Never deflect a player's own-number ask. (H-25)
  {
    const skillAns = answerSkillModifier(lowerText, world);
    if (skillAns) return skillAns;
  }

  // Governing-stat rule — "which stat governs a tracking check?" States the
  // rule (the stat) from SKILL_STAT, the same map answerSkillModifier and
  // resolve.js's stat-for-approach use, so the named stat can never drift
  // from what the engine actually rolls. Distinct from answerSkillModifier
  // above (which answers a NUMBER for the player's own skill); this answers
  // WHICH stat applies, with or without the player's own score in play.
  // (H-61)
  if (isGoverningStatQuestion(lowerText)) {
    const skillKey = resolveSkillKeyFromText(lowerText);
    if (skillKey) {
      const statKey = SKILL_STAT[skillKey];
      const skillName = skillKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `${skillName} is governed by ${statKey} — roll ${statKey} when you make that check.`;
    }
  }

  // Attack / to-hit modifier — "what's my attack modifier?" When no specific
  // weapon is named, which ability applies is genuinely ambiguous (melee vs.
  // finesse) — keep the existing explanation (H-25; locked in by U189/U190).
  // But when a REAL weapon from the loadout IS named ("...attack bonus with
  // the Worn Blade"), give the actual FINAL bonus instead — meleeProfile is
  // the same source resolveEscapeCombatTurn reads at the table, so this
  // number can never drift from what combat actually rolls. A compound
  // "give me my numbers... and my attack bonus" ask also gets the full
  // ability scores — a half-answer with no scores and no final bonus is the
  // H-40 DM_TEST_DEADEND this replaces. (H-40)
  // (gate-18) Proficiency bonus — straight from the sheet (levelTable), never rolled.
  // Also resolves the to-hit with the equipped weapon (meleeProfile.atkBonus already
  // folds ability mod + proficiency), so a compound "proficiency bonus … to-hit number"
  // is fully answered. Checked before META_ATTACK_MOD so the proficiency phrasing wins.
  if (META_PROFICIENCY.test(lowerText)) {
    const p = world.party?.[0] || {};
    const lvl = Number(p.level) || 1;
    const pb = profBonusFor(lvl);
    const prof = meleeProfile(p);
    const ans = `Your proficiency bonus is ${fmtMod(pb)} (level ${lvl}). On a weapon you're trained with, your to-hit is your ability modifier plus that — with the ${prof.name}, ${fmtMod(prof.atkBonus)}.`;
    return META_STATS_REQ.test(lowerText) ? `${answerFullStats(world)} ${ans}` : ans;
  }
  if (META_ATTACK_MOD.test(lowerText)) {
    const p = world.party?.[0] || {};
    const weapons = (Array.isArray(p.inventory?.weapons) ? p.inventory.weapons : [])
      .map(w => String(w?.name || w || '').trim()).filter(Boolean);
    const namedWeapon = weapons.some(n => {
      const low = n.toLowerCase();
      if (lowerText.includes(low)) return true;
      return low.split(/\s+/).filter(tok => tok.length >= 4).some(tok => lowerText.includes(tok));
    });
    let ans;
    if (namedWeapon) {
      const prof = meleeProfile(p);
      // Name the components (ability modifier + proficiency), not just the
      // final number — "how is it calculated"/"formula" phrasings are
      // asking for the breakdown, not only the total. (H-61)
      ans = `With the ${prof.name}, your attack bonus is ${fmtMod(prof.atkBonus)} — that's your ability modifier plus proficiency. Roll d20 and add that.`;
    } else {
      const might = statMod(Number(p.stats?.MIGHT) || 10);
      const agi = statMod(Number(p.stats?.AGILITY) || 10);
      ans = `To hit you add your MIGHT modifier (${fmtMod(might)}) for a melee strike, or your AGILITY (${fmtMod(agi)}) for a finesse or ranged attack — plus your proficiency on a weapon you're trained with.`;
    }
    return META_STATS_REQ.test(lowerText) ? `${answerFullStats(world)} ${ans}` : ans;
  }

  // Rules-confirmation — "do I add my MIGHT to melee damage?", "confirm
  // that's the right mod". A rule question about the damage formula, answered
  // straight from the sheet, never rolled. Reads the real modifier off the
  // named stat in the text (defaulting to MIGHT, the melee default elsewhere
  // in this file) so the number can't drift from what combat actually rolls.
  // (H-54 R3)
  if (META_DAMAGE_RULE.test(lowerText)) {
    const p = world.party?.[0] || {};
    const statMatch = lowerText.match(/\b(might|agility|wits|grit|charm)\b/i);
    const statKey = statMatch ? statMatch[1].toUpperCase() : 'MIGHT';
    if (statKey !== 'MIGHT' && statKey !== 'AGILITY') {
      const might = statMod(Number(p.stats?.MIGHT) || 10);
      return `No — melee damage uses your MIGHT modifier (${fmtMod(might)}), or AGILITY for a finesse weapon, not ${statKey}.`;
    }
    const mod = statMod(Number(p.stats?.[statKey]) || 10);
    return `Yes — your ability modifier adds to a hit's damage: the weapon's die plus your ability modifier. With your current ${statKey} modifier (${fmtMod(mod)}), that's the right mod.`;
  }

  // Armor value/AC — "what's my Armor value?", "give me my AC". Your own
  // defense number off the sheet — a table DM just tells you, never a dodge
  // roll. Checked before META_EQUIPMENT so it isn't swallowed by the
  // armor-PIECE-name handler. (A compound damage+armor ask is already folded
  // into the META_WEAPON_DAMAGE branch above.) (H-31 R2)
  if (META_ARMOR_VALUE.test(lowerText)) {
    const ac = playerAc(world.party?.[0] || {});
    const ans = `Your Armor is ${ac} — that's the number an attack has to beat to land on you.`;
    // A compound "my stats AND my armor class?" must answer BOTH halves — the
    // AC branch fires first and otherwise drops the stats half. Fold the full
    // stat block in when the same breath asks for it, mirroring the other
    // compound folds (e.g. answerSkillModifier, META_WEAPON_DAMAGE). (gate-9
    // RL t1; C1/C6)
    return META_STATS_REQ.test(lowerText) ? `${answerFullStats(world)} ${ans}` : ans;
  }

  // Roll-result QUERY — the player asks what they last rolled (the die number +
  // DC) without citing a number, so META_ROLL_RECALL (which needs a cited number)
  // doesn't apply. Report it straight from the ledger; never re-roll or deny a
  // recorded check. Checked BEFORE the bare-DC bounce so "give me the die number
  // and the DC I beat" reports the roll instead of bouncing "no standing DC".
  // When nothing's on record, fall through to normal resolution (no over-claim).
  // (Gate-10 RL t11; C5 roll-recall lineage, H-12/13.)
  if (META_ROLL_QUERY.test(lowerText) && !META_ROLL_RECALL.test(lowerText)) {
    const rollLine = lastRollReportLine(world);
    if (rollLine) return rollLine;
    // no roll on record yet — fall through to normal resolution
  }

  // Bare DC ask with no declared check — "give me the DC". There's no standing
  // DC; report the last roll's DC if one's on record, else explain. (H-25)
  // Defers to the explicit-check handler when the player declared a check in the
  // same breath ("let me make a WITS check… what's the DC?") — that path sets a
  // real DC for the named stat. Also defers to a bare "roll <stat> to <verb>"
  // commit with no opener lead-in ("I sheathe the blade and roll WITS to read
  // his face") — META_EXPLICIT_CHECK_DECLARED, checked ONLY here (not folded
  // into isMetaQuestion/the canned check-answer branch below), so a declared
  // check falls all the way through to real action resolution instead of
  // grace intercepting it with either the bare-DC deflection or its own
  // "tell me what you get" canned reply. (H-54 R4)
  // C3 (declared-check graduation): also defer when the player named an explicit
  // stat-check IN the DC ask itself ("WITS check to read his face — what's the
  // DC?", "shove him with a MIGHT check. What's the DC?") — C and D match but the
  // bounce guard used to omit them, so the turn deflected ("no standing DC…")
  // instead of falling through to the explicit-check handler that sets the real
  // DC + formula. A bare "what's the DC?" (no stat-check named) still bounces.
  if (META_BARE_DC.test(lowerText) && !META_EXPLICIT_CHECK_A.test(lowerText) && !META_EXPLICIT_CHECK_B.test(lowerText)
      && !META_EXPLICIT_CHECK_C.test(lowerText) && !META_EXPLICIT_CHECK_D.test(lowerText)
      && !META_EXPLICIT_CHECK_DECLARED.test(lowerText)) {
    const stored = world.conversation?.lastRoll;
    if (stored && Number.isFinite(Number(stored.dc))) {
      return `The last DC I set was ${stored.dc} (your roll: ${stored.roll}, ${stored.outcome}). There's no standing DC otherwise — I set one when you commit to a specific action.`;
    }
    return `There's no standing DC — I set the difficulty when you commit to a specific action, against how hard that moment is. Tell me what you're attempting and I'll give you the number to beat.`;
  }

  // Modifier formula — "how are modifiers calculated?", "what's the ability
  // modifier I add?", "the formula". Report examples + current scores.
  // No formula prose — the formula itself is a system artifact. (H-18 fix:
  // formula text removed; HP included when also requested. H-40: the raw
  // breakpoint table is now last-resort only — see below.)
  // Checked before META_MECHANICS so formula questions get the specific answer.
  if (META_MODIFIER_FORMULA.test(lowerText)) {
    // H-40: a player naming THEIR OWN skill or stat alongside a "the
    // modifier"/"the formula" trigger ("...tell me what the modifier even
    // is") gets that real number, plainly — never the abstract breakpoint
    // table (a system artifact a real DM would never recite). The table
    // survives only as the last resort, when no specific target was named
    // at all ("what's the formula for modifiers?" — U172-23).
    const skillAns = answerSkillModifier(lowerText, world);
    if (skillAns) return skillAns;
    const sm = lowerText.match(META_STAT) || lowerText.match(META_STAT_SYNONYM);
    const stats = world.party?.[0]?.stats || {};
    const statKey = sm ? resolveStatKey(sm[1]) : null;
    let ans;
    if (statKey && statKey in stats) {
      const score = Number(stats[statKey]) || 10;
      ans = `Your ${statKey} is ${score}, a ${fmtMod(statMod(score))} modifier.`;
    } else {
      ans = `Modifier breakpoints: ${modifierBreakpointTable()}.`;
      const order = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
      const line = order.filter(k => k in stats).map(k => `${k} ${stats[k]} (${fmtMod(statMod(Number(stats[k]) || 10))})`).join(', ');
      if (line) ans += ` Your measures: ${line}.`;
    }
    // Include HP when the player also asked for it (H-18).
    if (META_HEALTH.test(lowerText)) {
      const escMax = Number(world.meta?.escapeMaxHp) || 0;
      if (escMax > 0) {
        ans += ` Hit points: ${Number(world.meta?.escapeHp) || 0} of ${escMax}.`;
      }
    }
    return ans;
  }

  // How the rules work — "is there a dice mechanic?", "is that a d20?". A
  // question about the SYSTEM, answered straight; if the same line also asks
  // for a specific stat (e.g. "what's my Might modifier right now?"),
  // answer that too instead of dropping half the question.
  if (META_MECHANICS.test(lowerText)) {
    let ans = `Every contested action gets one roll — a d20 plus your relevant ability modifier — against a difficulty number set by how hard the moment is. Beat it and it goes your way; fall short and it doesn't, or costs you something to manage.`;
    const sm = lowerText.match(META_STAT) || lowerText.match(META_STAT_SYNONYM);
    if (sm) {
      const key = resolveStatKey(sm[1]);
      const stats = world.party?.[0]?.stats || {};
      if (key in stats) {
        const score = Number(stats[key]) || 10;
        ans += ` Right now your ${key} is ${score}, a ${fmtMod(statMod(score))} modifier.`;
      }
    }
    return ans;
  }

  // Roster / present-watcher query — list the real NPCs at this node by name
  // (sociable) and acknowledge a watching-but-unnamed hostile (lurker) rather
  // than denying them outright. Hostiles are deliberately described vague,
  // never by name (same restraint buildLocationSurvey already uses for
  // "lurkers"), but a real one in canon must never be flatly denied. Checked
  // before META_ADVICE so a trailing "...should I know them?" doesn't steal
  // the turn into a generic "your call" non-answer. (H-34 R2a)
  // General roster ("who's everyone here?") AND the bare presence ask ("is anyone
  // in the room with me?") — both answered the same way: list who's visibly present,
  // name/role gated, and NEVER roll a WITS check (convo-honesty FIX 2 — the presence
  // phrasing was falling through to a perception roll). No one present → an honest no.
  if (META_NPC_ROSTER.test(lowerText) || META_NPC_PRESENCE_HERE.test(lowerText)) {
    // LINE OF SIGHT — a presence query ("who's in the room with me / who's here") lists only who is
    // ACTUALLY present, never the whole settlement roster. Inside a structure → the people in your
    // room; outdoors → the people out in the open near you. The rest of the roster is elsewhere /
    // out of sight. Reuses the same deterministic occupancy model the look-around survey uses
    // (engine/structures/roomOccupancy.js) rather than dumping node.settlement.npcs.
    const interior = world.scene?.interior;
    const insideStructure = interior && typeof interior === 'object' && interior.structureKey;
    const allNpcs = insideStructure
      ? occupantsOfRoom(world, String(interior.structureKey || ''), String(interior.roomId || ''))
      : outdoorOccupants(world);
    const sociable = allNpcs.filter(n => n && !n.hostile);
    const lurkers = allNpcs.filter(n => n && n.hostile).length;
    const parts = [];
    if (sociable.length) {
      const named = sociable.slice(0, 4).map(n => describeNpc(n, knowsNpcName(world, n)));
      const remainder = sociable.length - Math.min(4, sociable.length);
      if (remainder > 0) named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
      parts.push(`${joinList(named)} ${sociable.length === 1 ? 'is' : 'are'} right here.`);
    }
    if (lurkers > 0) {
      parts.push(lurkers === 1
        ? `Someone else keeps to the edges, watching — not close enough yet to put a face to.`
        : `${lurkers} others keep to the edges, watching.`);
    }
    if (!parts.length) parts.push(`No one else is here — you're alone.`);
    return parts.join(' ');
  }

  // Advice — "should I talk to them, or is that a bad idea?" The DM answers
  // in character, naming who's actually present rather than bouncing the
  // question back as a navigation prompt.
  if (META_ADVICE.test(lowerText)) {
    const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
    const allNpcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
    const npcs = allNpcs.filter(n => n && !n.hostile);
    if (/\btalk|speak|approach|ask\b/.test(lowerText) && npcs.length) {
      return `Worth a try — ${joinList(npcs.slice(0, 3).map(n => describeNpc(n, knowsNpcName(world, n))))} ${npcs.length === 1 ? 'is' : 'are'} right here, and nothing's stopping you from walking over.`;
    }
    // H-39 — "should I be worried?" used to get the content-free "that one's
    // yours to call" hedge, never resolving the actual question. A real DM
    // gives a read on the danger, drawn from REAL state — hostile NPCs
    // present, open ledger threats, or a grim/blood world tone — never an
    // invented fact (narration!=canon: this reads state, it doesn't mint any).
    const hostileCount = allNpcs.filter(n => n && n.hostile).length;
    const activeThreats = Array.isArray(world.ledger?.threats) ? world.ledger.threats.length : 0;
    const tone = fateBand(Number(world.meta?.fate ?? 0.5));
    const danger = hostileCount > 0 || activeThreats > 0 || tone === 'grim' || tone === 'blood';
    return danger
      ? `Yes — keep your eyes open; nothing out here is friendly by default.`
      : `You're alright for the moment — nothing here's looking to move on you.`;
  }

  // Sheet confirmation — "my sheet", "the sheet", "confirm my stats". Reports
  // the full stat block from canon by default. But "the sheet" is also how
  // players reach for class/gear ("give me the sheet" / "what's on my
  // sheet?") — when the question actually names class and/or gear and never
  // asks for the ability scores themselves, answer THAT instead of dumping
  // MIGHT/AGILITY/WITS/GRIT/CHARM at a question that never asked for them.
  // (H-38a R1 — Rules Lawyer hammered this exact shape 4 of its first 6
  // turns: "what's my class, and what gear is on me? Give me the sheet.",
  // "What weapons, armor, and gear are on my sheet?", "am I carrying any
  // weapon or armor, yes or no?", "what do my hands find when I pat myself
  // down?" — all four got the raw stat block, none got class or gear.)
  // Explicitly refuse to mutate (report-only).
  // H-76 — a consume action carrying a "what changes on my sheet" rider
  // ("I'll uncork the Tonic of grit and drink it right now — tell me exactly
  // what changes on my sheet") used to be caught by META_SHEET_CONFIRM and
  // answered with the static stat-block readout BEFORE the consume ever
  // resolved. The downstream consume path (playloop.js CONSUME_RE) already
  // matches these phrasings — this guard just steps out of its way. Mirrors
  // CONSUME_RE's verb+noun shape locally rather than importing it, to keep
  // grace/playloop layering clean.
  const SHEET_CONSUME_CUE_RE = /\b(?:drink|quaff|swig|down|swallow|drain|uncork|tilt)\b.*\b(?:potion|draught|elixir|antidote|tonic|remedy)s?\b|\b(?:potion|draught|elixir|antidote|tonic|remedy)s?\b.*\b(?:drink|quaff|swig|swallow|drain)\b/i;
  if (META_SHEET_CONFIRM.test(lowerText) && SHEET_CONSUME_CUE_RE.test(lowerText)) {
    return null;
  }
  if (META_SHEET_CONFIRM.test(lowerText)) {
    const wantsClass = mentionsCharacterClass(lowerText);
    const wantsGear = mentionsGearAsk(lowerText);
    const wantsStats = META_STATS_REQ.test(lowerText);
    const idParts = [];
    if (wantsClass) {
      const classLine = answerClassLine(world);
      if (classLine) idParts.push(classLine);
    }
    if (wantsGear) idParts.push(describeLoadout(world));
    if (idParts.length && !wantsStats) return idParts.join(' ');

    const p = world.party?.[0] || {};
    const stats = p.stats || {};
    const order = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
    const line = order.filter(k => k in stats).map(k => `${k} ${stats[k]} (${fmtMod(statMod(Number(stats[k]) || 10))})`).join(', ');
    const parts = line ? [`Your sheet: ${line}.`] : ['Your sheet is blank — character not yet built.'];
    const eMax = Number(world.meta?.escapeMaxHp) || 0;
    if (world.meta?.mode === 'escape' && eMax > 0) {
      parts.push(`Hit points: ${Number(world.meta?.escapeHp) || 0} of ${eMax}.`);
    }
    parts.push('These are your canonical scores — I report what the sheet reads; I cannot edit them.');
    return [...idParts, ...parts].join(' ');
  }

  // NPC-observer query — "Who's that stranger watching me?". Describe the present
  // NPC rather than routing to a location survey. (H-14, Rung-1 2026-06-18.)
  // A "lurking"/"edges"/"shadows" framing names the hostile observer
  // specifically — the player flagged THAT one, not whichever sociable NPC
  // happens to be first in the roster. (H-44)
  if (META_NPC_OBSERVER.test(lowerText)) {
    const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
    const allNpcs = node?.settlement?.npcs || [];
    const sociable = allNpcs.filter(n => n && !n.hostile);
    const lurkers = allNpcs.filter(n => n && n.hostile);

    // (U231) A query naming an actual ROLE ("who is the elder/guard/merchant/
    // trader") identifies the present role-holder by role, never the first
    // NPC in the roster. No present role-holder → an honest decline, never a
    // wrong-NPC guess.
    const askedNoun = (lowerText.match(META_NPC_OBSERVER) || [])[1];
    if (askedNoun && NPC_OBSERVER_ROLE_WORDS.has(askedNoun)) {
      const holder = allNpcs.find(n => n && String(n.role || '').trim().toLowerCase() === askedNoun);
      if (holder) {
        const name = String(holder.name || '').trim();
        const desc = String(holder.description || holder.notes || '').trim();
        const who = name ? `${name}, the ${askedNoun}` : `the ${askedNoun}`;
        if (desc) return `${who} — ${desc.charAt(0).toLowerCase() + desc.slice(1)}.`;
        return holder.hostile
          ? `${who} — keeping to the edges, watching.`
          : `${who} — one of the folk here, watching from nearby.`;
      }
      return `No ${askedNoun} here that you can see.`;
    }

    const wantsLurker = NPC_OBSERVER_LURK_RE.test(lowerText);
    // An evasion-framed ask ("you don't want to name", "keep going quiet")
    // names the ADDRESSEE in the same breath ("Corwin, ...") while asking
    // about a DIFFERENT party. Exclude the addressee from the sociable
    // candidate pool so they never get re-served as the answer to a question
    // about someone else. (H-51)
    const addressedNpc = wantsLurker
      ? sociable.find(n => {
        const first = String(n?.name || '').trim().split(/\s+/)[0];
        if (!first) return false;
        return new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lowerText);
      })
      : null;
    const sociablePool = addressedNpc ? sociable.filter(n => n !== addressedNpc) : sociable;
    const npc = (wantsLurker && lurkers.length) ? lurkers[0] : (sociablePool.length ? sociablePool[0] : (lurkers.length ? lurkers[0] : null));
    if (npc) {
      const name = String(npc.name || '').trim();
      const role = String(npc.role || '').trim();
      const desc = String(npc.description || npc.notes || '').trim();
      const who = (name && role && !/\bthe\b/i.test(name)) ? `${name}, a ${role}` : (name || (role ? `a ${role}` : 'a stranger'));
      if (desc) return `${who} — ${desc.charAt(0).toLowerCase() + desc.slice(1)}.`;
      return npc.hostile
        ? `${who} — keeping to the edges, watching.`
        : `${who} — one of the folk here, watching from nearby.`;
    }
    if (addressedNpc) {
      return `Can't put a face to them yet — whoever you mean, ${addressedNpc.name || 'they'} isn't saying.`;
    }
    return `No one's watching you — the place looks empty from here.`;
  }

  // NPC-presence query — "Is that stranger gone for good?" / "Could I look for them?"
  // Report whether the NPC is still present rather than listing a roster. (H-16.)
  // Defer when the same "is X gone/still there" shape actually names a carried
  // item ("is the tonic gone or still there") — that's an inventory-state query
  // the item branch below owns, not an NPC-presence one. (H-65)
  if (META_NPC_PRESENCE.test(lowerText)
      && !(META_ITEM_PRESENCE.test(lowerText)
           && gatherCarriedItems(world).some(it => itemNameInText(lowerText, it.name.toLowerCase())))) {
    const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
    const sociable = (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
    if (sociable.length) {
      const names = sociable.slice(0, 2).map(n => String(n.name || n.role || 'a stranger').trim()).join(' and ');
      return `Still here — ${names} ${sociable.length === 1 ? 'hasn\'t' : 'haven\'t'} gone anywhere. If you want to speak, now's the moment.`;
    }
    return `Whoever you saw has moved on — the place is empty now. They could be anywhere in town if you want to search.`;
  }

  // Multi-stat D&D synonym request — "What's my STR, DEX, CON, INT, WIS, CHA?" or
  // "Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma" (H-17).
  // Detected when ≥ 3 synonym names appear: the player wants the full stat block + HP.
  // Placed before the single-stat handler so it fires before an early single return.
  {
    const allSynKeys = Object.keys(STAT_SYNONYMS);
    const synCount = allSynKeys.filter(k => new RegExp(`\\b${k}\\b`, 'i').test(lowerText)).length;
    if (synCount >= 3) {
      const p = world.party?.[0] || {};
      const stats = p.stats || {};
      const order = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
      const line = order.filter(k => k in stats).map(k => `${k} ${stats[k]} (${fmtMod(statMod(Number(stats[k]) || 10))})`).join(', ');
      const parts = line ? [`Your measures: ${line}.`] : ['Your measures are blank — character not yet built.'];
      const eMax = Number(world.meta?.escapeMaxHp) || 0;
      if (eMax > 0) {
        parts.push(`Hit points: ${Number(world.meta?.escapeHp) || 0} of ${eMax}.`);
      }
      return parts.join(' ');
    }
  }

  // Single ability score — "what's my MIGHT modifier?", "what's my Strength?"
  // Answer from canon (score + modifier). Synonyms (Strength→MIGHT etc.) resolve
  // via resolveStatKey so the DM never invents a wrong number.
  {
    const m = lowerText.match(META_STAT) || lowerText.match(META_STAT_SYNONYM);
    if (m) {
      // (N-3) A stat name inside an ITEM-effect question ("what's the Tonic of
      // grit do — does it boost my GRIT?") must not hijack to the bare stat
      // readout — the item-effect answer wins. Gated on a REAL carried item
      // actually being named (answerItemQuery falls back loosely to a consumable,
      // which would wrongly answer "what does my GRIT do?" about the Tonic), so
      // standalone stat queries still get the stat.
      const itemEffectAsk = META_ITEM.test(lowerText) || META_ITEM_CAPABILITY.test(lowerText)
        || META_ITEM_QUERY.test(lowerText) || ITEM_EFFECT_DEMAND_RE.test(lowerText);
      if (itemEffectAsk) {
        const inv = world.party?.[0]?.inventory || {};
        const carried = [];
        for (const [cat, arr] of Object.entries(inv)) {
          if (cat === 'items' || !Array.isArray(arr)) continue;
          for (const it of arr) { const n = String(it?.name || it).toLowerCase().trim(); if (n) carried.push(n); }
        }
        for (const it of (Array.isArray(inv.items) ? inv.items : [])) {
          const def = getItemDef(it?.defRef); if (def?.name) carried.push(String(def.name).toLowerCase());
        }
        if (carried.some(n => n.length > 2 && lowerText.includes(n))) {
          const itemAns = answerItemQuery(lowerText, world);
          if (itemAns) return itemAns;
        }
      }
      const key = resolveStatKey(m[1]);
      const stats = world.party?.[0]?.stats || {};
      if (key in stats) {
        const score = Number(stats[key]) || 10;
        return `Your ${key} is ${score}, a ${fmtMod(statMod(score))} modifier.`;
      }
    }
  }

  // Item query — "what does <item> do?", "is <item> in my pack?", and (H-47)
  // capability phrasings without the "what does X do" shape ("does the Tonic
  // heal HP, give temp HP, or buff a stat?", "is the Tonic useful?").
  // Answered from the REAL pack; returns null (falls through) if no carried
  // item matches. Defers to a declared check ("I roll WITS to read his face
  // — what's the DC and what do I get?") — META_ITEM's lazy "what ... do"
  // shape incidentally spans "what's the DC and what do I get", and the
  // weapon named earlier in the same sentence ("the blade") then false-
  // matches as the asked-about item. Without this guard the bare-DC fix
  // (H-54 R4) just trades one wrong interceptor for another. (H-54 R4)
  if ((META_ITEM.test(lowerText) || META_ITEM_CAPABILITY.test(lowerText)
       || META_ITEM_QUERY.test(lowerText) || META_ITEM_PRESENCE.test(lowerText)  // H-65
       || ITEM_EFFECT_DEMAND_RE.test(lowerText)  // H-77
       || META_ITEM_VERB_FINAL.test(lowerText))  // H-88 — verb-final "what the X does"
      && !META_EXPLICIT_CHECK_DECLARED.test(lowerText)) {
    const ans = answerItemQuery(lowerText, world);
    if (ans) return ans;
    // Bare count, no item named ("how many doses do I have") — H-70's fold
    // above found nothing to match against; list real per-item counts
    // instead of falling through to observe-only. (H-73)
    if (ITEM_COUNT_RE.test(lowerText) && GENERIC_CONSUMABLE_CUE.test(lowerText)) {
      return listConsumableCounts(world);
    }
  }

  // A player asserts a carried item is inert/useless/does-nothing — correct
  // it from the catalog rather than agreeing with a false claim about an
  // item that has a real mechanical effect. (H-47, post-H-45/H-46 gate.)
  if (META_ITEM_INERT_CLAIM.test(lowerText)) {
    const ans = correctInertClaim(lowerText, world);
    if (ans) return ans;
  }

  // "List/read back my consumables" — checked before META_INVENTORY (whose
  // generic pack-dump loop skips the structured items[] bucket entirely) so a
  // bridged consumable (H-45) is actually included in the answer. (H-45)
  if (META_CONSUMABLES_LIST.test(lowerText)) {
    return listConsumables(world);
  }

  // Purse / coins — a real number the DM owns; report it (even if empty). A
  // gear/loadout ask in the same breath must answer both, not drop the gear
  // half — META_PURSE is checked before META_INVENTORY/META_EQUIPMENT below,
  // so without this fold a compound "what gear... and do I have any coin?"
  // returned only the coin half. (H-37 R1)
  if (META_PURSE.test(lowerText)) {
    const ans = answerPurse(world);
    if (META_INVENTORY.test(lowerText) || META_EQUIPMENT.test(lowerText) || META_HELD_ITEMS.test(lowerText)) {
      return `${describeLoadout(world)} ${ans}`;
    }
    return ans;
  }

  // Inventory — read the real pack as prose, never invent contents. (N-1: the
  // category-key dump moved into describePack, which renders names in-fiction.)
  if (META_INVENTORY.test(lowerText)) {
    const ans = describePack(world);
    // A stats or HP ask in the same breath must answer both, not just gear —
    // "what are my actual stats and what weapons am I carrying?" was
    // dropping HP/level/abilities entirely and answering inventory only.
    // (H-36a R2 HP fold; H-40 broadens it to the full ability-score block.)
    const extras = [];
    if (META_STATS_REQ.test(lowerText)) extras.push(answerFullStats(world));
    if (META_HEALTH.test(lowerText)) extras.push(answerHealth(world));
    const extraText = extras.filter(Boolean).join(' ');
    return extraText ? `${ans} ${extraText}` : ans;
  }

  // Equipment / sheet — name what's actually equipped, in-voice, no roll. An
  // empty loadout is reported honestly (the DM never invents a weapon you lack).
  // META_HELD_ITEMS ("what's in my hands") shares this answer — it's the same
  // question about the same loadout. META_GEAR_YESNO ("am I carrying any
  // weapon or armor, yes or no?") is the bare yes/no framing of the same ask,
  // never matched by the wh-/declarative forms above. (H-31 R2; H-38a R1)
  if (META_EQUIPMENT.test(lowerText) || META_HELD_ITEMS.test(lowerText) || META_GEAR_YESNO.test(lowerText)) {
    const ans = describeLoadout(world);
    // A stats or HP ask in the same breath must answer both, not just gear
    // (H-36a R2 HP fold; H-40 broadens it to the full ability-score block —
    // same drop as the META_INVENTORY branch above).
    const extras = [];
    if (META_STATS_REQ.test(lowerText)) extras.push(answerFullStats(world));
    if (META_HEALTH.test(lowerText)) extras.push(answerHealth(world));
    // A class or level ask in the same breath must answer too — neither was
    // folded here before, so "what's on my character sheet? class, level,
    // and current HP" got the gear/stats/HP but silently dropped class and
    // level. (H-59 C1-003)
    if (mentionsCharacterClass(lowerText)) {
      const classLine = answerClassLine(world);
      if (classLine) extras.push(classLine);
    }
    if (mentionsLevelAsk(lowerText)) {
      const level = Number(world.party?.[0]?.level) || null;
      if (level) extras.push(`You're level ${level}.`);
    }
    const extraText = extras.filter(Boolean).join(' ');
    return extraText ? `${ans} ${extraText}` : ans;
  }

  // Rules/capability question — "is Gravedigger a class or a background?",
  // "what can I actually do in a fight?". Answered from the ruleset/archetype,
  // never rolled. Checked before META_CHARACTER so a phrasing like "is that a
  // class" doesn't fall through to the d20 resolver. (DTD-A Fix 1)
  if (META_CAPABILITY.test(lowerText)) {
    return answerCapability(world);
  }

  // Character identity / build — answer who you are from canon. Identity in-voice;
  // an explicit stats ask gets the real scores (your own sheet, no fiction to dodge);
  // a gear ask in the same breath gets the real loadout, not the "read your own
  // sheet" deflection (H-38a R1 — "What class am I, and list every item I'm
  // carrying." got the class but the deflection line instead of the kit).
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
    const wantsGear = mentionsGearAsk(lowerText);
    if (wantsGear) out.push(describeLoadout(world));
    if (META_STATS_REQ.test(lowerText) && p.stats && typeof p.stats === 'object') {
      const order = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];
      const line = order.filter(k => k in p.stats).map(k => `${k} ${p.stats[k]} (${fmtMod(statMod(Number(p.stats[k]) || 10))})`).join(', ');
      if (line) out.push(`Your measures: ${line}.`);
      // Include HP — it's a real, trackable number in escape mode (the rules-
      // lawyer is right that the DM owns it). Don't dodge a stat-block request.
      const eMax = Number(world.meta?.escapeMaxHp) || 0;
      if (world.meta?.mode === 'escape' && eMax > 0) {
        out.push(`Hit points: ${Number(world.meta?.escapeHp) || 0} of ${eMax}.`);
      }
    }
    // (N-1) Killed the "read your sheet" deflect (gate-5 deflect-to-sheet): a
    // pure identity question is fully answered by the lines above; an explicit
    // kit/stats/HP ask routes to the inventory/equipment/stats branches before
    // here, and "what am I (even) carrying?" now matches META_INVENTORY.
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

  // Health/status check. A class or level ask in the same breath ("How much
  // HP do I have? What class?") must answer too — this branch used to be a
  // bare unconditional return with zero fold logic. (H-59 C1-003)
  if (META_HEALTH.test(lowerText)) {
    const ans = answerHealth(world);
    const extras = [];
    if (mentionsCharacterClass(lowerText)) {
      const classLine = answerClassLine(world);
      if (classLine) extras.push(classLine);
    }
    if (mentionsLevelAsk(lowerText)) {
      const level = Number(world.party?.[0]?.level) || null;
      if (level) extras.push(`You're level ${level}.`);
    }
    return extras.length ? `${ans} ${extras.join(' ')}` : ans;
  }

  // What happened — recap the last thing the DM narrated. (N-4) A fiction-backstory
  // "what happened here last night / to them" is info-seeking, not a session recap —
  // let it fall through to the honest info-decline instead of "Nothing's happened yet".
  if (META_RECAP.test(lowerText) && !isInfoSeekingText(lowerText)) {
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

  // Explicit skill-check request — "let me make a WITS check", "I want to roll MIGHT
  // against him". A real DM names the stat, DC, and asks for the roll. This gate fires
  // BEFORE the examine/explore intercept so "read him" doesn't become an observe-only. (H-19)
  if (META_EXPLICIT_CHECK_A.test(lowerText) || META_EXPLICIT_CHECK_B.test(lowerText)
      || META_EXPLICIT_CHECK_C.test(lowerText) || META_EXPLICIT_CHECK_D.test(lowerText)) {
    const stat = extractRequestedStat(text);
    const score = Number(world.party?.[0]?.stats?.[stat] ?? 10);
    const mod = statMod(score);
    const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
    const npcs = (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
    const npc = npcs[0] || null;
    // DC: 12 base, nudged by NPC openness when one is present
    let dc = 12;
    if (npc) {
      const P = npc.personality || {};
      dc = Math.max(8, Math.round(12 - (Number(P.trustOfOutsiders ?? 0.5) - 0.5) * 6));
    }
    const modStr = fmtMod(mod);
    const npcClause = npc ? ` to read ${String(npc.name || `the ${npc.role || 'stranger'}`)}` : '';
    return `Roll ${stat} — d20 ${modStr} against DC ${dc}${npcClause}. Tell me what you get.`;
  }

  // Roll-recall — player cites a specific past roll ("I rolled 16 vs DC 11", "you told me
  // I got a 16"). Compare against the stored last roll and acknowledge; never silently
  // re-roll on a contradiction. (H-12/13)
  if (META_ROLL_RECALL.test(lowerText)) {
    const cited = extractCitedRoll(text);
    if (cited) {
      const stored = world.conversation?.lastRoll;
      if (!stored) return null; // no prior roll on record — fall through to normal resolution
      const rollMatches = stored.roll === cited.roll;
      const dcMatches = !cited.dc || stored.dc === cited.dc;
      if (rollMatches && dcMatches) {
        return `Right — the ledger shows ${stored.roll} vs DC ${stored.dc} (${stored.outcome}). That's what I have.`;
      }
      return `The ledger shows ${stored.roll} vs DC ${stored.dc}${stored.outcome ? ` — ${stored.outcome}` : ''}, not ${cited.roll}. Which turn are you citing?`;
    }
    return null; // couldn't parse a number — fall through
  }

  // Fourth-wall system check-in — "You're just repeating yourself now, are
  // you okay?". A real DM acknowledges the callout in-voice and steers back
  // to the fiction; this never rolls and costs no time, same treatment as
  // isNullAction. (H-51)
  if (META_SYSTEM_CHECKIN.test(lowerText)) {
    return `Still here — let's push past the repeat. What do you want to do?`;
  }

  // Last-resort typed identity-slot decomposition — terse/ambiguous compound
  // phrasings ("name / class / current HP?", "class, level, and HP — what
  // are they?") name 2+ of {name, class, level, HP} but match no specific
  // META_* gate above. Decompose into the SET of requested fields and answer
  // every one present from canon, in one response, never a roll. Only
  // reached when no earlier (more specific) branch already claimed the text.
  // (H-59 C1-001/C1-003 — first typed-packet graduation, Biblioteca Vol 7.)
  if (hasIdentitySlotCompound(lowerText)) {
    const p = world.party?.[0] || {};
    const parts = [];
    if (/\bname\b/i.test(lowerText) && p.name) parts.push(`Name: ${p.name}.`);
    if (mentionsCharacterClass(lowerText) && p.archetype) parts.push(`Class: ${p.archetype}.`);
    if (mentionsLevelAsk(lowerText) && p.level) parts.push(`Level: ${p.level}.`);
    if (mentionsHpAsk(lowerText) || META_HEALTH.test(lowerText)) {
      // "Hit points: N of M." (number-first phrasing) rather than
      // answerHealth's "you're at N of M hit points" — a bare slot-list ask
      // ("name / class / current HP?") expects the field labeled, not narrated.
      const eMax = Number(world.meta?.escapeMaxHp) || 0;
      parts.push(world.meta?.mode === 'escape' && eMax > 0
        ? `Hit points: ${Number(world.meta?.escapeHp) || 0} of ${eMax}.`
        : answerHealth(world));
    }
    if (parts.length) return parts.join(' ');
  }

  // "What do I know about this place?" — a vague self-knowledge question: the player asking the
  // game to be their memory. Checked LAST, so any SPECIFIC query (weapon, stat, a named person)
  // is answered first and only the genuinely-vague form lands here. We keep no auto-recall — a
  // real DM points you back at your own notes (the world is the DM's to track; the record is yours).
  if (META_SELF_KNOWLEDGE.test(lowerText)) {
    const rng = makeRng(seedFromString(`${world?.meta?.seed || ''}|notes|${world?.timeline?.length || 0}|${lowerText}`));
    return rng.pick([
      `That's what your notes are for — I keep the world, you keep the record of it.`,
      `Check your notes. I don't hold your memories for you; a careful traveler writes things down.`,
      `Whatever you've set down — your notes have it, I don't.`,
      `Check your notes. What you didn't write down is gone, same as at any table.`
    ]);
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

// Same shape as joinList, but for negation ("there's no X or Y") where "and"
// would misread as a conjunction of two true things. (H-31 R3)
function joinOr(items) {
  const arr = items.filter(Boolean);
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} or ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, or ${arr[arr.length - 1]}`;
}

// Do you know this NPC's name? At HOME you know your neighbors; elsewhere you learn a name
// only by meeting them (conversationState.metPlayer, set when you speak to them). NOT a memory
// store — metPlayer is the in-fiction "we've been introduced", and home is character knowledge —
// so this honors the no-auto-recall rule (names you've learned live with you; everything else
// you write down).
export function knowsNpcName(world, npc) {
  const home = String(world?.meta?.homeNodeId || '');
  const here = String(world?.map?.currentNodeId || '');
  return (Boolean(home) && home === here) || Boolean(npc?.conversationState?.metPlayer);
}

export function describeNpc(npc, nameKnown = true) {
  const name = String(npc?.name ?? '').trim();
  const role = String(npc?.role ?? '').trim();
  const aRole = role ? `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}` : 'a stranger';
  // Earned knowledge for PEOPLE: you can SEE someone and read their role from dress and
  // bearing, but you don't know their NAME until you've met them — or unless this is home,
  // where you know your neighbors. Unknown → by role ("a guard"); known → by name.
  if (!nameKnown) return aRole;
  // If the name already contains "the" — an epithet ("Brogan the Elder") or a
  // bare title used as a name ("the laborer") — don't append the role, or we get
  // "Brogan the Elder the representative" / "the laborer the laborer".
  if (name && /\bthe\b/i.test(name)) return name;
  if (name && role) return `${name} the ${role}`;
  if (name) return name;
  return aRole;
}

// opts.presence — the caller is answering an explicit who's-here / is-there-a-X
// PRESENCE question. Inside an interior that still names the settlement roster
// (the people are reachable in the settlement); a bare "look around" does not
// (see the interior branch below). Default (no opts) = the general survey.
// Line-of-sight silhouettes: a landmark you can SEE but whose name you don't yet know is
// read by its shape (a tower, a bridge, a ruin) — never named until you've been there.
const SILHOUETTE_NOUNS = ['watchtower', 'lighthouse', 'tower', 'spire', 'obelisk', 'monument', 'shrine', 'chapel', 'temple', 'abbey', 'monastery', 'bridge', 'ruin', 'arch', 'gate', 'cairn', 'well', 'altar', 'standing stone'];
function landmarkSilhouette(name) {
  const n = String(name || '').toLowerCase();
  const hit = SILHOUETTE_NOUNS.find(k => n.includes(k));
  return hit ? `a ${hit}` : 'a distant structure';
}

export function buildLocationSurvey(world, opts = {}) {
  const w = world || {};
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const currentNode = nodes.find(n => String(n.id) === nodeId) ?? null;
  const placeName = cleanPlaceName(currentNode?.name ?? w.scene?.location ?? '') || 'an unfamiliar place';
  const nodeType = String(currentNode?.nodeType ?? 'wilderness');
  // Name-vs-role for the people roster below: home + metPlayer (see knowsNpcName), OR a name
  // the player used in their own query — typing "where's Corwin?" proves they know Corwin, so
  // the answer must honor it (you can't redact a name the asker just said).
  const queryToks = new Set(String(opts.queryText || '').toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean));
  const namedInQuery = (npc) => {
    const nm = String(npc?.name || '').toLowerCase().trim();
    if (!nm) return false;
    const first = nm.split(/\s+/)[0] || '';
    return queryToks.has(nm) || (first.length >= 3 && queryToks.has(first));
  };
  const knowsName = (npc) => knowsNpcName(w, npc) || namedInQuery(npc);

  const parts = [];

  const interior = w.scene?.interior;
  const insideStructure = interior && typeof interior === 'object' && interior.structureKey;

  // ── INSIDE a private interior room — general look-around ────────────────
  // "Look around" your room describes the ROOM — its furniture and features —
  // not the settlement's people (THE_TABLE_TEST). You can't see the village
  // roster through the walls; dumping Elske/Dalla/the guard here was the
  // meta-roster leak (FIRST_ROOM #4 — the same canned overview returned 3×
  // verbatim). An explicit PRESENCE question (opts.presence) still gets the
  // roster below — the people are reachable in the settlement; only the bare
  // "what do I see" survey is scoped to the room.
  if (insideStructure && !opts.presence) {
    // Vary the lead by turn so a repeated "look around" is never byte-identical
    // (the second half of FIRST_ROOM #4). Furniture is room-scoped (roomObjects) —
    // the same present set the object-presence answers and presentRoomObjects use,
    // so the same chest no longer shows in every room of the building (WB-Q5).
    const lookRng = makeRng(seedFromString(`${w.meta?.seed ?? ''}|survey|${(w.timeline?.length) ?? 0}`));
    const lead = lookRng.pick([
      `You're inside ${placeName}.`,
      `You take the measure of the room here in ${placeName}.`,
      `Your eyes move slow across the room.`
    ]);
    parts.push(lead);

    const furniture = objectsHere(w)
      .map(({ piece }) => String(piece?.name ?? '').trim())
      .filter(Boolean);
    // Windows are a real, generated room feature (engine/structures/roomWindows.js):
    // above-ground rooms get 1-2, cellars/windowless rooms get none. Derived (seeded,
    // no stored state) so "look around" lists one to act on — and the window verbs
    // (look/climb/shoot out) bind to the SAME deriver. Listed alongside the furniture.
    const win = roomWindows(w, interior);
    const winPhrase = windowSurveyPhrase(win);
    const art = (s) => `${/^[aeiou]/i.test(s) ? 'an' : 'a'} ${s}`;
    const features = furniture.slice(0, 5).map(art);
    if (winPhrase) features.push(winPhrase);
    if (features.length) {
      parts.push(`Here: ${joinList(features)}.`);
    } else {
      parts.push('The room holds little of note.');
    }
    // People in the room with you. A bare "look around" that omits someone standing
    // right there is the INVERSE failure of the old roster-dump (FIRST_ROOM #4) — a
    // real DM names who's visibly present. Gate NAMES by earned knowledge exactly as
    // the exterior survey does (home/met → name, else by role). None present → no
    // people line at all (the room is genuinely empty). Hostiles never join the
    // social roster — a lurker reads as a wary stranger, not a neighbor.
    // Only the people in THIS room (occupancy), not the whole settlement — so waking in a private
    // back room no longer dumps the entire roster. Folk gather in the common room; back rooms are
    // usually empty. A structure with no interior topology falls back to "everyone here".
    // (engine/structures/roomOccupancy.js — derived, deterministic, no schema bump.)
    const roomNpcs = occupantsOfRoom(w, String(interior.structureKey || ''), String(interior.roomId || ''));
    const roomSociable = roomNpcs.filter(n => n && !n.hostile);
    const roomLurkers = roomNpcs.filter(n => n && n.hostile).length;
    if (roomSociable.length) {
      const named = roomSociable.slice(0, 4).map(n => describeNpc(n, knowsName(n)));
      const remainder = roomSociable.length - Math.min(4, roomSociable.length);
      if (remainder > 0) named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
      parts.push(`${titleCase(joinList(named))} ${roomSociable.length === 1 ? 'is' : 'are'} here.`);
    }
    if (roomLurkers > 0) {
      parts.push(roomLurkers === 1
        ? 'And someone else — a stranger keeping to the edges, watching.'
        : `And ${roomLurkers} strangers keeping to the edges, watching.`);
    }
    // You can see OUT through an unshuttered window — the open air, and whoever is out there (line
    // of sight passes through the glass). A shuttered window shows nothing; an empty street adds no
    // line (the window itself is already noted among the room's features above).
    if (win.count && !win.shuttered) {
      const outside = outdoorOccupants(w).filter(n => n && !n.hostile);
      if (outside.length) {
        const seen = outside.slice(0, 3).map(n => describeNpc(n, knowsName(n)));
        const more = outside.length - Math.min(3, outside.length);
        if (more > 0) seen.push(`${more} other${more === 1 ? '' : 's'}`);
        parts.push(`Through the window you can see ${joinList(seen)} out in the open.`);
      }
    }
    // The WAYS OUT of this room. A multi-room building has interior doorways — a flat
    // "the way out leads back to the open air" hid every other room, so a player could
    // never discover them from looking around (FIRST_ROOM follow-up: whole-building
    // playthrough). Describe the actual doorways (toward the front / deeper in) and,
    // from the entry room, the way outside. Topology-driven; degrades to the open-air
    // line for a single-room structure.
    const st = w.structures?.byId?.[String(interior.structureKey || '')];
    const topo = normalizeTopology(st?.topology);
    let waysOut = 'The way out leads back to the open air.';
    if (topo) {
      const roomId = String(interior.roomId || '');
      const adj = adjacentRooms(topo, roomId);
      const entryRoom = topo.rooms.find(r => (Array.isArray(r.tags) ? r.tags : []).some(tag => String(tag).toLowerCase() === 'entry'));
      const entryId = String(entryRoom?.id || topo.rooms[0]?.id || '');
      const { dist } = reachableRooms(topo, entryId);
      const here = dist.get(roomId);
      const toward = adj.filter(id => (dist.get(id) ?? Infinity) < (here ?? Infinity)).length;
      const deeper = adj.filter(id => (dist.get(id) ?? -Infinity) > (here ?? -Infinity)).length;
      if (here === 0) {
        // The entry room: the door out is here; interior doorways lead further in.
        waysOut = deeper > 0
          ? `${deeper === 1 ? 'A doorway leads' : 'Doorways lead'} further in, and the way out to the open air is here.`
          : 'The way out leads back to the open air.';
      } else if (adj.length) {
        const bits = [];
        if (toward) bits.push('back toward the front');
        if (deeper) bits.push('deeper in');
        if (bits.length) waysOut = `${adj.length === 1 ? 'A doorway leads' : 'Doorways lead'} ${joinList(bits)}.`;
      }
    }
    parts.push(waysOut);
    return parts.join(' ');
  }

  // Opening line — interior vs. exterior
  if (insideStructure) {
    parts.push(`You're inside ${placeName}.`);
  } else {
    const article = /^[aeiou]/i.test(nodeType) ? 'an' : 'a';
    parts.push(`You're in ${placeName}, ${article} ${nodeType}.`);
  }

  // Who's present — LINE OF SIGHT, never the whole settlement roster. Outside, you see the people
  // out in the open near you (the rest are indoors, out of sight); a presence-query inside sees the
  // people in your room. Hostiles aren't listed by name — a lurking bandit reads as a wary stranger.
  const interiorHere = w.scene?.interior;
  {
    // A presence / "who's here / where's X" query (opts.presence) consults the WHOLE roster — you
    // are asking after specific people. A plain "look around" is LINE OF SIGHT: outdoors you see
    // the people in the open, a presence-less interior survey sees your room. Never the full roster
    // for a look-around.
    const allNpcs = Array.isArray(currentNode?.settlement?.npcs) ? currentNode.settlement.npcs : [];
    // Line of sight: outdoors → people in the open; an interior survey → people in your room.
    const losVisible = insideStructure
      ? occupantsOfRoom(w, String(interiorHere?.structureKey || ''), String(interiorHere?.roomId || ''))
      : outdoorOccupants(w);
    // A DIRECTED locate — "where is Corwin?" names a specific person — may reach beyond line of
    // sight to report where that named person is (you asked after them by name). A BARE presence
    // ask ("who's here / who's in the room with me") is line of sight, exactly like a look-around;
    // it must NEVER answer from the whole town roster. (opts.presence alone is not enough.)
    const namedTargets = allNpcs.filter(namedInQuery);
    const visible = (opts.presence && namedTargets.length) ? allNpcs : losVisible;
    const sociable = visible.filter(n => n && !n.hostile);
    const lurkers = visible.filter(n => n && n.hostile).length;
    if (sociable.length) {
      const named = sociable.slice(0, 4).map(n => describeNpc(n, knowsName(n)));
      const remainder = sociable.length - Math.min(4, sociable.length);
      if (remainder > 0) named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
      parts.push(insideStructure
        ? `You're not alone — ${joinList(named)} ${sociable.length === 1 ? 'is' : 'are'} here with you.`
        : `Out in the open you see ${joinList(named)}.`);
    } else if (insideStructure) {
      parts.push('No one else is in the room with you.');
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
    // LINE OF SIGHT (THE TABLE TEST): "look around" reports only what you can SEE from where
    // you stand. A LANDMARK (tower, shrine, bridge, ruin) pokes above the treeline, so it's in
    // view — name it if you know its name (discovered), else read its silhouette ("you can see
    // a bridge"). A settlement or open country down a road is over the horizon / behind trees:
    // you see the ROAD leaving, never the place. Its name lives on the MAP, not in your eyes.
    const discovered = new Set((Array.isArray(w.map?.discovered) ? w.map.discovered : []).map(String));
    const dirLines = [];
    for (const dir of ['north', 'east', 'south', 'west']) {
      const targetId = exits?.[dir];
      if (!targetId) continue;
      const target = nodes.find(n => String(n.id) === String(targetId));
      const isLandmark = String(target?.nodeType || '') === 'landmark';
      if (isLandmark && discovered.has(String(targetId))) {
        const tName = cleanPlaceName(target?.name);
        dirLines.push(tName ? `to the ${dir} lies ${tName}` : `a landmark stands to the ${dir}`);
      } else if (isLandmark) {
        dirLines.push(`to the ${dir} you can see ${landmarkSilhouette(target?.name)}`);
      } else {
        dirLines.push(`a path leads ${dir}`);
      }
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

// windowView(world) — what is visibly OUTSIDE through a window, obeying the same
// LINE OF SIGHT / fog rules as the exterior "look around": the immediate exterior
// (the node's terrain), landmarks that poke above the treeline (NAMED only if
// discovered, else read by silhouette), and the ROADS leaving by direction. An
// over-the-horizon settlement down a road is never named — you see the road, not
// the place. Reused by the playloop's "look out the window" verb.
export function windowView(world) {
  const w = world || {};
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const currentNode = nodes.find(n => String(n.id) === nodeId) ?? null;
  const nodeType = String(currentNode?.nodeType ?? 'wilderness');
  const article = /^[aeiou]/i.test(nodeType) ? 'an' : 'a';
  const lead = `Through the window: ${article} ${nodeType} outside`;

  const exits = exitsFrom(w.map, nodeId);
  const discovered = new Set((Array.isArray(w.map?.discovered) ? w.map.discovered : []).map(String));
  const dirLines = [];
  for (const dir of ['north', 'east', 'south', 'west']) {
    const targetId = exits?.[dir];
    if (!targetId) continue;
    const target = nodes.find(n => String(n.id) === String(targetId));
    const isLandmark = String(target?.nodeType || '') === 'landmark';
    if (isLandmark && discovered.has(String(targetId))) {
      const tName = cleanPlaceName(target?.name);
      dirLines.push(tName ? `to the ${dir} lies ${tName}` : `a landmark stands to the ${dir}`);
    } else if (isLandmark) {
      dirLines.push(`to the ${dir} you can make out ${landmarkSilhouette(target?.name)}`);
    } else {
      dirLines.push(`a path leads ${dir}`);
    }
  }
  return dirLines.length ? `${lead}; ${joinList(dirLines)}.` : `${lead}.`;
}

// Detect in-fiction questions addressed to a named NPC by name — "Who lit
// that lantern, Elske?" patterns where the NPC name appears as the recipient
// (comma-address at end, or name at start before comma). Without this,
// these fall through adjudicate as "observe" actions and return
// buildLocationSurvey, which is a navigation recap, not an NPC answer.
// Returns an honest in-character deflection; never a location survey.
// Exported so tests can call it directly. (DTD-A Fix 2)
export function handleNpcAddressedQuestion(text, world) {
  const t = String(text || '');
  const hasWH = /\b(?:who|what|why|where|which|when|can|did|does|do|have|has|is|are|was|were)\b/i.test(t);
  if (!hasWH) return null;
  if (!(/\?/.test(t) || QUESTION_SHAPE.test(t))) return null;
  const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  const addressed = npcs.find(npc => {
    const first = String(npc?.name || '').trim().split(/\s+/)[0];
    if (!first || first.length < 2) return false;
    const esc = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Comma-address at end: "Q, NpcName?" or "Q, NpcName."
    const trailingAddr = new RegExp(`[,]\\s*${esc}\\b(?:\\s*[?!.]|\\s*$)`, 'i');
    // Name-first address: "NpcName, Q?"
    const leadingAddr = new RegExp(`^\\s*${esc}\\s*[,—]`, 'i');
    return trailingAddr.test(t) || leadingAddr.test(t);
  });
  if (!addressed) return null;
  const name = String(addressed.name || '').trim().split(/\s+/)[0];
  return `${name} doesn't have an answer for that — or won't give one right now. What do you do?`;
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

  // NPC-addressed in-fiction questions — "Who lit that lantern, Elske?" must
  // not fall through to buildLocationSurvey (DTD-A Fix 2)
  const npcAddressedResponse = handleNpcAddressedQuestion(transcription, world);
  if (npcAddressedResponse) {
    return {
      type: 'meta',
      message: npcAddressedResponse,
      world: world,
      isPacing: false
    };
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
