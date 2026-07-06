/**
 * Text → Intent. The "say what you do" parser.
 *
 * Deterministic and rule-based on purpose. It resolves the common, mechanical
 * sentences locally (no latency, no nondeterminism, fully testable), and hands
 * anything it can't classify to the AI DM as an 'ask'. Later, an LLM can sit in
 * front of this to handle messier phrasing — but it emits this same Intent shape,
 * so the engine downstream never knows or cares which parser spoke.
 *
 * ctx = {
 *   entities: [{ id, name, ref?, faction? }],  // who/what is present (for targets)
 *   abilities: ['sword','shortbow','fireball'], // what the actor can wield
 *   spells: ['fire_bolt', ...],                 // known spells (for 'cast')
 *   items: ['torch','rope', ...]                // carried items (for 'use'/'take')
 * }
 *
 * PURE + DETERMINISTIC.
 */

import { makeIntent, defaultApproachForVerb } from './intentSchema.js';

// DECL-STAT-1 — D&D ability name (or engine-stat name) → the engine's five-stat
// vocabulary. Identical mapping to engine/grace/gracefulAdjudication.js
// STAT_SYNONYMS (one contract enum, not a parallel table): str→MIGHT,
// dexterity→AGILITY, intelligence/wisdom→WITS, constitution→GRIT, charisma→CHARM.
// The engine stat names map to themselves so "I'll roll WITS" resolves directly.
const STAT_SYNONYMS = {
  str: 'MIGHT', strength: 'MIGHT', might: 'MIGHT',
  dex: 'AGILITY', dexterity: 'AGILITY', agility: 'AGILITY',
  int: 'WITS', intelligence: 'WITS', wis: 'WITS', wisdom: 'WITS', wits: 'WITS',
  con: 'GRIT', constitution: 'GRIT', grit: 'GRIT',
  cha: 'CHARM', charisma: 'CHARM', charm: 'CHARM'
};
const STAT_WORD = '(str|strength|might|dex|dexterity|agility|int|intelligence|wis|wisdom|wits|con|constitution|grit|cha|charisma|charm)';

// The shapes a player uses to DECLARE which ability the die keys off — the ones
// that slip past grace's META_EXPLICIT_CHECK_* patterns and reach the generic
// resolver. Grace intercepts the DC-PROMPT case ("what do I roll?"); this reads
// the STAT out of a committed action ("Set the DC and I'll roll Strength",
// "using my WITS", "a Dexterity check", "roll against GRIT", "with my Might").
// Each anchors the stat word to a roll/check/save/ability cue so a bare mention
// of "strength" as flavor ("I strain with all my strength to…") never fires —
// only an explicit CHECK declaration does.
const DECL_STAT_PATTERNS = [
  // "roll Strength", "I'll roll STR", "rolling my Dexterity"
  new RegExp(`\\broll(?:ing)?\\s+(?:a\\s+|my\\s+|with\\s+|using\\s+)?${STAT_WORD}\\b`, 'i'),
  // "roll against/vs/for/on GRIT", "d20 against WITS"
  new RegExp(`\\b(?:vs\\.?|versus|against|for|on)\\s+(?:a\\s+|my\\s+)?${STAT_WORD}\\b`, 'i'),
  // "a WITS check", "Strength save", "GRIT test"
  new RegExp(`\\b${STAT_WORD}\\s+(?:check|save|test)\\b`, 'i'),
  // "using my Might", "with my Strength", "use my WITS" — the ability declared as
  // the instrument of the action; the "my <stat>" possessive is the anchor.
  new RegExp(`\\b(?:using|use|with)\\s+my\\s+${STAT_WORD}\\b`, 'i')
];

/**
 * declaredStat(text) -> engine stat name | null
 *
 * Reads an EXPLICITLY declared ability out of a player's utterance. Returns the
 * canonical engine stat (MIGHT/AGILITY/GRIT/CHARM/WITS) when the text declares a
 * check on a named ability, else null. PURE + DETERMINISTIC. First matching
 * pattern wins; ambiguity (two different stats named) resolves to the FIRST so
 * the reading is stable. This is the STRUCTURED-intent detector house law INT-1..4
 * asks for — the LLM translator (llmIntent.js) proposes the same `stat` field on
 * the typed path; this is the LLM-off floor that guarantees a declaration is
 * honored even with no model in the loop.
 */
export function declaredStat(text) {
  const t = norm(text);
  if (!t) return null;
  for (const re of DECL_STAT_PATTERNS) {
    const m = t.match(re);
    if (m && m[1]) {
      const key = STAT_SYNONYMS[m[1].toLowerCase()];
      if (key) return key;
    }
  }
  return null;
}

// Verb synonyms → canonical verb. First match wins; order matters (specific first).
// Exported (INT-2R) so engine/intent/groundPacket.js can normalize an
// LLM-proposed verb token ("stab") to the canonical schema verb ("attack")
// through this SAME table — no parallel vocabulary (Purity Rule: one contract
// enum). Word-boundary matching only, applied to a single verb token (not a
// full sentence) at the grounding call-site.
export const VERB_SYNONYMS = [
  ['flee', /\b(flee|run away|run for it|retreat|withdraw|disengage|escape|back off|get out|leg it|bolt for|make a run)\b/],
  ['cast', /\b(cast|conjure|evoke|invoke|channel|incant)\b/],
  ['attack', /\b(attack|strike|hit|swing|slash|stab|smash|shoot|fire|loose|charge|kill|slay|fight|cut down|cleave|bash|punch)\b/],
  ['talk', /\b(talk|speak|ask|tell|say|greet|hail|persuade|convince|intimidate|threaten|charm|parley|chat|question|interrogate)\b/],
  ['search', /\b(search|look|examine|inspect|investigate|study|read|scan|observe|survey|check|peek)\b/],
  ['take', /\b(take|grab|pick up|loot|steal|pocket|collect|snatch|seize)\b/],
  ['use', /\b(use|drink|eat|apply|open|pull|push|activate|light|ignite|throw)\b/],
  ['wait', /\b(wait|hold|ready|defend|pass|end turn|brace|stand fast)\b/],
  ['move', /\b(move|go|walk|run|step|advance|approach|head|cross|climb|enter|come)\b/]
];

// Approach overrides the parser can read straight from the sentence.
const APPROACH_HINTS = [
  ['force', /\b(force|smash|break|barge|charge|intimidate|threaten|overpower|wrench)\b/],
  ['finesse', /\b(sneak\w*|quiet\w*|careful\w*|nimbl\w*|slip|stealth\w*|deft\w*|pick the lock|tiptoe)\b/],
  ['heart', /\b(persuade|charm|plead|comfort|befriend|reassure|flatter|soothe)\b/],
  ['endure', /\b(endure|hold on|brace|resist|push through|tough it out)\b/],
  ['focus', /\b(study|examine|recall|analyze|read|concentrate|investigate)\b/]
];

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); }

function matchVerb(t) {
  for (const [verb, re] of VERB_SYNONYMS) if (re.test(t)) return verb;
  return null;
}

function matchApproach(t) {
  for (const [appr, re] of APPROACH_HINTS) if (re.test(t)) return appr;
  return null;
}

// Find the best entity the sentence is aimed at: longest name token that appears
// in the text. Deterministic tie-break by entity order, then id.
function matchTarget(t, entities) {
  if (!Array.isArray(entities)) return null;
  let best = null, bestLen = 0;
  for (const e of entities) {
    const candidates = [e.name, e.ref, e.id].filter(Boolean).map(norm);
    for (const c of candidates) {
      if (!c) continue;
      // match whole words of the candidate (e.g. "wolf" inside "dire wolf alpha")
      const words = c.split(' ').filter(w => w.length > 2);
      const hit = words.some(w => new RegExp(`\\b${w}\\b`).test(t));
      if (hit) {
        const len = c.length;
        if (len > bestLen) { best = e; bestLen = len; }
      }
    }
  }
  return best ? (best.id || best.ref || best.name) : null;
}

// Find an instrument named in the sentence (a known ability/spell/item).
// Fuzzy on purpose: players say "fire" for "fireball", "bow" for "shortbow".
// A candidate word matches a spoken token on exact match, or a shared stem
// (prefix/suffix, ≥3 chars) — so the common short-hands resolve without a
// hand-maintained alias table.
function matchInstrument(t, ctx) {
  const toks = t.split(' ').filter(Boolean);
  const wordHit = w => toks.some(tok => tok === w || (w.length >= 3 && tok.length >= 3 && (w.startsWith(tok) || tok.startsWith(w) || w.endsWith(tok) || tok.endsWith(w))));
  const pool = [...(ctx.abilities || []), ...(ctx.spells || []), ...(ctx.items || [])];
  let best = null, bestLen = 0;
  for (const raw of pool) {
    const name = norm(String(raw).replace(/_/g, ' '));
    const words = name.split(' ').filter(w => w.length > 2);
    if (words.length && words.every(wordHit) && name.length > bestLen) { best = raw; bestLen = name.length; }
  }
  return best;
}

/**
 * parseIntent(text, ctx) -> Intent
 */
export function parseIntent(text, ctx = {}) {
  const raw = String(text ?? '');
  const t = norm(raw);
  if (!t) return makeIntent({ verb: 'ask', text: raw, source: 'text', confidence: 0.2 });

  const verb = matchVerb(t);
  const instrument = matchInstrument(t, ctx);
  const target = matchTarget(t, ctx.entities);
  const hintedApproach = matchApproach(t);
  // DECL-STAT-1: a player-declared ability rides on the intent regardless of
  // whether a mechanical verb was recognized ("Set the DC and I'll roll
  // Strength" resolves no verb but MUST carry stat:MIGHT to the resolver).
  const stat = declaredStat(raw);

  // No recognized verb → free narration for the AI DM.
  if (!verb) {
    return makeIntent({ verb: 'ask', target, with: instrument, stat, text: raw, source: 'text', confidence: 0.4 });
  }

  // If they said "cast" but named no spell, leave `with` null — the resolver/UI
  // can prompt for which spell (or a click finishes it).
  const withTool = (verb === 'cast' || verb === 'attack' || verb === 'use') ? instrument : null;
  const approach = hintedApproach || defaultApproachForVerb(verb, withTool);

  // Confidence: a clean verb + a resolved target/instrument is high; a lone verb
  // ("attack" with nothing present) is lower so the UI knows it may need a click.
  let confidence = 0.6;
  if (target) confidence += 0.2;
  if (withTool) confidence += 0.1;
  if (hintedApproach) confidence += 0.1;
  confidence = Math.min(1, confidence);

  return makeIntent({ verb, target, with: withTool, approach, stat, text: raw, source: 'text', confidence });
}
