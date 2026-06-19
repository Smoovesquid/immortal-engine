// ── GRACEFUL ADJUDICATION ──────────────────────────────────────────────────
//
// The grace layer: pacing, clarification, conversation state.
// Turns the engine from a system into a patient DM.

import { extractIntent, getClarificationPrompt } from '../voice/intentExtraction.js';
import { adjudicate } from '../adjudication/adjudicate.js';
import { exitsFrom, cleanPlaceName } from '../map/mapState.js';
import { statMod } from '../ruleset/core/stats.js';
import { profBonusFor } from '../ruleset/core/levelTable.js';
import { playerAc } from '../combat/escapeCombat.js';
import { purseTotalCopper, formatPrice } from '../economy/shop.js';

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

// H-25 (Opus gate 06-18): a player asking for their OWN number — a D&D SKILL
// modifier ("what's my Insight modifier? I need a number"), their attack
// modifier, or a bare DC — must get the number, never an atmosphere deflection.
// Skill → governing game-stat, mirroring resolve.js (FOCUS_APPROACH→statForApproach)
// so the reported modifier matches what the engine actually rolls.
const SKILL_STAT = {
  athletics: 'MIGHT', intimidation: 'MIGHT',
  stealth: 'AGILITY', acrobatics: 'AGILITY', sleight_of_hand: 'AGILITY',
  insight: 'CHARM', persuasion: 'CHARM', deception: 'CHARM', performance: 'CHARM',
  survival: 'GRIT', medicine: 'GRIT', nature: 'GRIT',
  arcana: 'WITS', investigation: 'WITS', perception: 'WITS', history: 'WITS', religion: 'WITS'
};
// Match "what's my <skill> modifier/mod/bonus/number/check" / "give me my <skill>".
// "sleight of hand" is normalized to the focus key sleight_of_hand below.
const META_SKILL_MOD = /\b(?:what(?:'?s| is)\s+my\s+|my\s+|give\s+me\s+(?:my\s+)?)(athletics|intimidation|stealth|acrobatics|sleight\s+of\s+hand|insight|persuasion|deception|performance|survival|medicine|nature|arcana|investigation|perception|history|religion)(?:\s+(?:modifier|mod|bonus|number|score|check|skill))?\b/i;
// Attack/to-hit modifier — "what's my attack modifier", "my to-hit bonus".
const META_ATTACK_MOD = /\b(?:what(?:'?s| is)\s+my\s+|my\s+|give\s+me\s+(?:my\s+)?)(?:attack|to[-\s]?hit)\s+(?:modifier|mod|bonus|number|roll)\b/i;
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
const META_HEALTH = /\bam i (?:hurt|wounded|damaged|injured|alive|ok|okay|alright|all right|fine|bleeding|dying)\b|\bhow am i (?:doing|holding up|feeling)\b|how(?:'?s| is) my (?:health|hp|status|condition|shape)\b|what(?:'?s| is) my (?:health|hp|status|condition|wounds|shape)\b|how much (?:health|hp|life)\b|\bhow (?:hurt|wounded|injured|bad(?:ly)? (?:hurt|off))\b|how many (?:hit ?points|hp)\b|\b(?:max|maximum)\s+(?:hp|hit\s?points?|health)\b|\bhp\s+(?:total|number|max|cap|count)\b|\bhit\s?points?\b|\bmy\s+(?:current\s+)?hp\b/;
export const META_RECAP = /what happened|what did i (?:just )?do\b/;
const META_OUTCOME = /did i (?:succeed|fail|win|lose|make it)\b/;
// v24 conversation hardening — the questions players actually ask. The
// inventory patterns are question/command-anchored so "put it in my pocket"
// (an action) never reads as an inventory check.
const META_INVENTORY = /\bwhat (?:do i have|am i carrying|have i got)\b|\bwhat'?s in my (?:pack|bag|inventory|pockets?)\b|\b(?:check|show|open|look in(?:to)?) (?:my )?(?:pack|bag|inventory|gear|equipment)\b|^\s*inventory\s*\??\s*$/;
// Equipment / "what am I wielding/wearing" / sheet queries — an information
// request, never a dice roll. Answered in-voice from real canon (an empty
// loadout is reported honestly, never invented as "a short sword").
const META_EQUIPMENT = /\bwhat(?:'?s| is)\s+my\s+(?:weapon|blade|sword|armou?r|gear|equipment|loadout)\b|\bname\s+my\s+(?:weapon|blade|sword|armou?r)\b|\bwhat\s+am\s+i\s+(?:wielding|wearing|armed\s+with)\b|\bwhat(?:'?s| is)\s+on\s+my\s+(?:character\s+)?sheet\b|\bwhat\s+(?:weapon|armou?r)\s+(?:do|am)\s+i\b/;
// "What's actually in my hands right now?" / "what am I holding?" — a real DM
// answers from the loadout, never a WITS check (Opus gate 2026-06-19, Rules
// Lawyer DM: this fell through to a contested check and "the details blur").
// Routed into the same handler as META_EQUIPMENT below. (H-31 R2)
const META_HELD_ITEMS = /\bwhat(?:'?s| is)\s+(?:actually\s+)?in\s+my\s+hands?\b|\bwhat\s+(?:do\s+i|am\s+i)\s+(?:actually\s+)?holding\b/i;
// Numeric Armor value/AC — "what's my Armor value?", "give me my AC". Your
// own defense number off the sheet; a table DM just tells you, never a dodge
// roll. Distinct from META_EQUIPMENT (which names the armor PIECE, not its
// number). (Opus gate 2026-06-19, Rules Lawyer DM; H-31 R2)
const META_ARMOR_VALUE = /\b(?:armor|armour)\s+(?:value|class|rating|number|score)\b|\bmy\s+ac\b|\bwhat(?:'?s| is)\s+(?:my\s+)?ac\b|\bgive\s+me\s+(?:my\s+)?ac\b/i;
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
// Item queries: "what does the Tonic of grit do?", "is the rope in my pack?",
// "do I have a healing potion?". Broad shape — the handler only answers if it
// resolves to a REAL inventory item (else it returns null and falls through, so
// "what does the elder do" isn't mistaken for an item).
const META_ITEM = /\bwhat(?:'?s| does| do| is| are)\s+(?:the|my|a|an|this|that)\s+.+?\s+(?:do|for|good\s+for|used\s+for|used\s+to)\b|\b(?:do i have|have i got|am i carrying|is\s+(?:the|a|an|my)\s+.+?\s+in\s+my\s+(?:pack|bag|inventory|kit|belongings))\b/i;
// Coins/purse — a number the DM owns (read from party.purse). Also catches
// "do I even have any money on me?" and a re-asserted "pouch of coin" claim
// (the latter shares ground with POSSESSION_CHALLENGE below — H-35 R1/R2).
const META_PURSE = /\bhow many coins\b|\bhow much (?:money|coin|gold|silver|copper|cash)\b|\bwhat(?:'?s| is)\s+in\s+my\s+(?:purse|pouch|coin\s?purse|wallet)\b|\bhow\s+(?:much\s+)?(?:money|coin|gold|silver)\s+(?:do i have|have i got|am i carrying)\b|\bmy (?:purse|coin\s?purse|pouch)\b|\bdo\s+i\s+(?:even\s+)?have\s+(?:any\s+)?(?:money|coin)\b|\bmoney\s+on\s+me\b|\bpouch\s+of\s+coin\b/i;
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
const META_WEAPON_DAMAGE = /\b(?:damage|dmg)\s+(?:die|dice|roll)\b|\bwhat\s+(?:damage\s+)?die\b|\b(?:damage|dmg)\s+(?:on|of|for)\s+(?:the|my|a|an|this|that)\b|\bhow much damage\b|\bwhat(?:'?s| is)\s+(?:the\s+)?(?:damage|dmg)\s+(?:on|of|for|number|value)\b/i;
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
// Modifier-formula questions — "how are modifiers calculated?", "the formula",
// "ability modifier", "what do I add to hit?". Report the (score−10)÷2 rule
// plus the PC's current scores. Never a dice roll. (Rung-1 gate 2026-06-18.)
const META_MODIFIER_FORMULA = /\bstat[-\s]to[-\s]modifier\b|\bmodifier\s+formula\b|\bability\s+modifier\b|\bwhat\s+(?:do\s+i|would\s+i)\s+add\b|\bthe\s+formula\b|\bthe\s+modifier\b|\bto[-\s]hit\s+(?:bonus|modifier|formula)\b|\bmodifier\s+math\b/i;
// Sheet-confirmation queries — "my sheet", "the sheet", "confirm my stats".
// Reports the full stat block from canon; explicitly refuses to mutate scores.
const META_SHEET_CONFIRM = /\b(?:my|the)\s+sheet\b|\bconfirm\s+(?:the\s+)?(?:stats?|scores?|sheet|modifiers?)\b/i;
// NPC-observer queries — "Who's that stranger watching me?", "Who is that figure?"
// Identity questions about a visibly present NPC. Never a location survey.
// (H-14, Rung-1 gate 2026-06-18.)
const META_NPC_OBSERVER = /\bwho(?:'s| is| was| are)?\s+(?:that|this|the)\s+(?:stranger|figure|person|man|woman|one|fellow|guard|merchant|trader|elder|individual|character|someone|anyone)\b/i;
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
// Roll-recall — player cites a specific past roll number to dispute or follow up.
// "I rolled a 16", "16 vs DC 11", "you told me I got a 16", "my roll was 16". (H-12/13.)
const META_ROLL_RECALL = /\b(?:i (?:rolled|got|said|had)(?:\s+a)?|my roll was(?:\s+a)?|you (?:said|told me)(?:\s+i (?:rolled?|got))?(?:\s+a)?)\s*\d+\b|\b\d+\s+(?:vs\.?|versus|against)\s+dc\s*\d+\b/i;

// Detect meta-questions (questions about state, not actions)
export function isMetaQuestion(text) {
  const t = String(text || '').toLowerCase();
  return META_LOCATION.test(t) || META_HEALTH.test(t) || META_RECAP.test(t) || META_OUTCOME.test(t)
    || META_INVENTORY.test(t) || META_EQUIPMENT.test(t) || META_CHARACTER.test(t) || META_STAT.test(t)
    || META_STAT_SYNONYM.test(t) || META_ITEM.test(t) || META_PURSE.test(t) || META_TIME.test(t)
    || META_OBJECTIVE.test(t) || META_MECHANICS.test(t) || META_ADVICE.test(t)
    || META_WEAPON_DAMAGE.test(t) || META_NAME.test(t)
    || META_MODIFIER_FORMULA.test(t) || META_SHEET_CONFIRM.test(t)
    || META_NPC_OBSERVER.test(t) || META_NPC_PRESENCE.test(t) || META_NPC_ROSTER.test(t)  // H-34 R2a
    || META_EXPLICIT_CHECK_A.test(t) || META_EXPLICIT_CHECK_B.test(t)  // H-19
    || META_EXPLICIT_CHECK_C.test(t) || META_EXPLICIT_CHECK_D.test(t)  // H-26c
    || META_SKILL_MOD.test(t) || META_ATTACK_MOD.test(t) || META_BARE_DC.test(t)  // H-25
    || META_ROLL_RECALL.test(t)  // H-12/13
    || META_HELD_ITEMS.test(t) || META_ARMOR_VALUE.test(t)  // H-31 R2
    || META_POSSESSION_CHALLENGE.test(t);  // H-31 R3
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
const INFO_SEEKING_RE = /\b(?:who|what|when|where|whose)\b[\s\S]{0,60}?\b(?:name|named|year|date|deed|owner|own(?:s|ed)?|held|sold|gave|kin|relat\w*|tenure|found(?:ed|ing))\b|\bgive me a name\b|\bby name\b|\bwhat year (?:is it|are we)\b|\bis\s+[a-z][\w'-]*(?:\s+[a-z][\w'-]*){0,2}\s+(?:dead|alive)\b|\bhow long\b[\s\S]{0,30}?\b(?:run|ran|owned|been here|been)\b|\bhow many generations\b/i;
const INFO_SEEKING_EXCLUDE_RE = /\b(?:attack|strike|hit|stab|slash|shoot|kill|fight|charge|intimidate|charm|deceive|persuade)\b/i;

// Observe-object-detail: a player demands the literal text/marking on a held
// or examined object ("what's stamped on the coin", "look at it and tell me
// what's on it", "read the inscription") — a request for a concrete fact,
// same as a name/date ask, not open conversation. (H-36a R1)
const INFO_SEEKING_OBSERVE_RE = /\b(?:what'?s|what is)\b[\s\S]{0,20}?\b(?:printed|stamped|etched|engraved|written|marked|inscribed)\b[\s\S]{0,15}?\bon\b|\btell me what'?s\b[\s\S]{0,20}?\b(?:on it|on the|stamped|printed|written|etched|marked|inscribed)\b|\bread\b[\s\S]{0,15}?\b(?:the|this|that|my)\b[\s\S]{0,15}?\b(?:inscription|engraving|writing|stamp|marking)\b/i;

export function isInfoSeekingText(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;
  if (INFO_SEEKING_EXCLUDE_RE.test(t)) return false;
  return INFO_SEEKING_RE.test(t) || INFO_SEEKING_OBSERVE_RE.test(t);
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

// Answer a weapon damage-die query from the real loadout. Inventory weapons
// carry either a `damage` string ("1d6") or, for the kit weapon, a numeric
// `dmgDie`. If specific weapons are named in the question, report those; else
// report the whole loadout. Never returns null for a started PC (there is
// always at least one weapon to report).
function answerWeaponDamage(lowerText, world) {
  const inv = world.party?.[0]?.inventory || {};
  const dieOf = (w) => {
    const dmg = String(w?.damage || '').trim();
    if (/^\d+d\d+$/i.test(dmg)) return dmg;
    const n = Number(w?.dmgDie) || 0;
    return n > 0 ? `1d${n}` : '';
  };
  const weapons = (Array.isArray(inv.weapons) ? inv.weapons : [])
    .map(w => ({ name: String(w?.name || w).trim(), dice: dieOf(w) }))
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
  const parts = [];
  parts.push(weapons.length
    ? `You're armed with ${joinList(weapons)}.`
    : `You bear no weapon worth the name — just your hands and whatever you can lay them on.`);
  if (armor.length) parts.push(`You're wearing ${joinList(armor)}.`);
  else parts.push(`Nothing but your own clothes stand between you and a blade.`);
  if (sigName) parts.push(`And you carry ${sigName}, which means something to you.`);
  return parts.join(' ');
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
  const bogus = claimed.filter(c => !realNames.some(n => n.includes(c)));
  return bogus.length ? bogus : null;
}

// Handle meta-questions (status checks, location surveys, recaps, outcomes).
// Returns null when the text isn't a recognized meta-question.
export function handleMetaQuestion(text, world) {
  const lowerText = String(text || '').toLowerCase();

  // Location / survey — checked first (most specific phrasings).
  if (META_LOCATION.test(lowerText)) {
    return buildLocationSurvey(world);
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
      if (META_ARMOR_VALUE.test(lowerText)) {
        const ac = playerAc(world.party?.[0] || {});
        extras.push(`Your Armor is ${ac} — that's the number an attack has to beat to land on you.`);
      }
      if (META_PURSE.test(lowerText)) extras.push(answerPurse(world));
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
    // A name ask in the same breath as HP or class must answer all of it, not
    // just the name (H-36a R2 — same compound-fold shape as H-35's gear+coin).
    const extras = [];
    if (META_CLASS_FOLD_RE.test(lowerText)) {
      const classLine = answerClassLine(world);
      if (classLine) extras.push(classLine);
    }
    if (META_HEALTH.test(lowerText)) extras.push(answerHealth(world));
    return extras.length ? `${ans} ${extras.join(' ')}` : ans;
  }

  // Skill modifier — "what's my Insight modifier? I need a number." Answer with
  // the real number from the sheet: governing game-stat modifier + proficiency
  // when the focus is owned. Never deflect a player's own-number ask. (H-25)
  {
    const sm = lowerText.match(META_SKILL_MOD);
    if (sm) {
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
  }

  // Attack / to-hit modifier — "what's my attack modifier?" Report the real
  // numbers the engine adds, melee vs. finesse. (H-25)
  if (META_ATTACK_MOD.test(lowerText)) {
    const p = world.party?.[0] || {};
    const might = statMod(Number(p.stats?.MIGHT) || 10);
    const agi = statMod(Number(p.stats?.AGILITY) || 10);
    return `To hit you add your MIGHT modifier (${fmtMod(might)}) for a melee strike, or your AGILITY (${fmtMod(agi)}) for a finesse or ranged attack — plus your proficiency on a weapon you're trained with.`;
  }

  // Armor value/AC — "what's my Armor value?", "give me my AC". Your own
  // defense number off the sheet — a table DM just tells you, never a dodge
  // roll. Checked before META_EQUIPMENT so it isn't swallowed by the
  // armor-PIECE-name handler. (A compound damage+armor ask is already folded
  // into the META_WEAPON_DAMAGE branch above.) (H-31 R2)
  if (META_ARMOR_VALUE.test(lowerText)) {
    const ac = playerAc(world.party?.[0] || {});
    return `Your Armor is ${ac} — that's the number an attack has to beat to land on you.`;
  }

  // Bare DC ask with no declared check — "give me the DC". There's no standing
  // DC; report the last roll's DC if one's on record, else explain. (H-25)
  // Defers to the explicit-check handler when the player declared a check in the
  // same breath ("let me make a WITS check… what's the DC?") — that path sets a
  // real DC for the named stat.
  if (META_BARE_DC.test(lowerText) && !META_EXPLICIT_CHECK_A.test(lowerText) && !META_EXPLICIT_CHECK_B.test(lowerText)) {
    const stored = world.conversation?.lastRoll;
    if (stored && Number.isFinite(Number(stored.dc))) {
      return `The last DC I set was ${stored.dc} (your roll: ${stored.roll}, ${stored.outcome}). There's no standing DC otherwise — I set one when you commit to a specific action.`;
    }
    return `There's no standing DC — I set the difficulty when you commit to a specific action, against how hard that moment is. Tell me what you're attempting and I'll give you the number to beat.`;
  }

  // Modifier formula — "how are modifiers calculated?", "what's the ability
  // modifier I add?", "the formula". Report examples + current scores.
  // No formula prose — just breakpoints; the formula itself is a system artifact.
  // (H-18 fix: formula text removed; HP included when also requested.)
  // Checked before META_MECHANICS so formula questions get the specific answer.
  if (META_MODIFIER_FORMULA.test(lowerText)) {
    let ans = 'Modifier breakpoints: 9 → −1, 10–11 → +0, 12–13 → +1, 14–15 → +2.';
    const sm = lowerText.match(META_STAT) || lowerText.match(META_STAT_SYNONYM);
    if (sm) {
      const key = resolveStatKey(sm[1]);
      const stats = world.party?.[0]?.stats || {};
      if (key in stats) {
        const score = Number(stats[key]) || 10;
        ans += ` Your ${key} is ${score}, a ${fmtMod(statMod(score))} modifier.`;
      }
    } else {
      const p = world.party?.[0] || {};
      const stats = p.stats || {};
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
  if (META_NPC_ROSTER.test(lowerText)) {
    const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
    const allNpcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
    const sociable = allNpcs.filter(n => n && !n.hostile);
    const lurkers = allNpcs.filter(n => n && n.hostile).length;
    const parts = [];
    if (sociable.length) {
      const named = sociable.slice(0, 4).map(describeNpc);
      const remainder = sociable.length - Math.min(4, sociable.length);
      if (remainder > 0) named.push(`${remainder} other${remainder === 1 ? '' : 's'}`);
      parts.push(`${joinList(named)} ${sociable.length === 1 ? 'is' : 'are'} right here.`);
    }
    if (lurkers > 0) {
      parts.push(lurkers === 1
        ? `Someone else keeps to the edges, watching — not close enough yet to put a face to.`
        : `${lurkers} others keep to the edges, watching.`);
    }
    if (!parts.length) parts.push(`No one's close enough to name right now.`);
    return parts.join(' ');
  }

  // Advice — "should I talk to them, or is that a bad idea?" The DM answers
  // in character, naming who's actually present rather than bouncing the
  // question back as a navigation prompt.
  if (META_ADVICE.test(lowerText)) {
    const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
    const npcs = (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
    if (/\btalk|speak|approach|ask\b/.test(lowerText) && npcs.length) {
      return `Worth a try — ${joinList(npcs.slice(0, 3).map(describeNpc))} ${npcs.length === 1 ? 'is' : 'are'} right here, and nothing's stopping you from walking over.`;
    }
    return `That one's yours to call — nothing here forces your hand either way. Go with your gut.`;
  }

  // Sheet confirmation — "my sheet", "the sheet", "confirm my stats". Report
  // the full stat block from canon. Explicitly refuse to mutate (report-only).
  if (META_SHEET_CONFIRM.test(lowerText)) {
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
    return parts.join(' ');
  }

  // NPC-observer query — "Who's that stranger watching me?". Describe the present
  // NPC rather than routing to a location survey. (H-14, Rung-1 2026-06-18.)
  if (META_NPC_OBSERVER.test(lowerText)) {
    const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
    const sociable = (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
    if (sociable.length) {
      const npc = sociable[0];
      const name = String(npc.name || '').trim();
      const role = String(npc.role || '').trim();
      const desc = String(npc.description || npc.notes || '').trim();
      const who = (name && role && !/\bthe\b/i.test(name)) ? `${name}, a ${role}` : (name || (role ? `a ${role}` : 'a stranger'));
      return desc
        ? `${who} — ${desc.charAt(0).toLowerCase() + desc.slice(1)}.`
        : `${who} — one of the folk here, watching from nearby.`;
    }
    return `No one's watching you — the place looks empty from here.`;
  }

  // NPC-presence query — "Is that stranger gone for good?" / "Could I look for them?"
  // Report whether the NPC is still present rather than listing a roster. (H-16.)
  if (META_NPC_PRESENCE.test(lowerText)) {
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
      const key = resolveStatKey(m[1]);
      const stats = world.party?.[0]?.stats || {};
      if (key in stats) {
        const score = Number(stats[key]) || 10;
        return `Your ${key} is ${score}, a ${fmtMod(statMod(score))} modifier.`;
      }
    }
  }

  // Item query — "what does <item> do?", "is <item> in my pack?". Answered from
  // the REAL pack; returns null (falls through) if no carried item matches.
  if (META_ITEM.test(lowerText)) {
    const ans = answerItemQuery(lowerText, world);
    if (ans) return ans;
  }

  // Purse / coins — a real number the DM owns; report it (even if empty).
  if (META_PURSE.test(lowerText)) {
    return answerPurse(world);
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
    const ans = lines.length
      ? `You go through your pack. ${lines.join('. ')}.`
      : 'Your pack is light — nothing but lint and resolve.';
    // A gear ask in the same breath as HP must answer both (H-36a R2).
    return META_HEALTH.test(lowerText) ? `${ans} ${answerHealth(world)}` : ans;
  }

  // Equipment / sheet — name what's actually equipped, in-voice, no roll. An
  // empty loadout is reported honestly (the DM never invents a weapon you lack).
  // META_HELD_ITEMS ("what's in my hands") shares this answer — it's the same
  // question about the same loadout. (H-31 R2)
  if (META_EQUIPMENT.test(lowerText) || META_HELD_ITEMS.test(lowerText)) {
    const ans = describeLoadout(world);
    // A gear ask in the same breath as HP must answer both (H-36a R2).
    return META_HEALTH.test(lowerText) ? `${ans} ${answerHealth(world)}` : ans;
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
      const line = order.filter(k => k in p.stats).map(k => `${k} ${p.stats[k]} (${fmtMod(statMod(Number(p.stats[k]) || 10))})`).join(', ');
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
    return answerHealth(world);
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
