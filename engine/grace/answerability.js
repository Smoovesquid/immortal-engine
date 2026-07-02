// AG-1/AG-2R — answerability classifier.
// A direct player question can never terminate as a non-answer (roll-then-fog /
// atmosphere-bank / clarify-referent loop / nav-survey bounce). This module
// exports the typed classifier that the AG-1 postconditions in playloop.js
// use to intercept those sinks, and that DLG-1 (the dialogue-enter half) will
// consume to gate the dialogue sink.
//
// Design rule (recall-biased): a false positive → graceful in-voice decline;
// a false negative → a HARD dead-end. Bias toward inclusion.
//
// Over-match discipline (CRITICAL): must NOT swallow declared ACTIONS
// ("I search the chest", "I attack the guard") or bare exploration imperatives
// ("look around", "examine the table"). Proven by the diverge corpus in C17.
//
// AG-2R (second-order diagnosis, docs/briefs/SECOND_ORDER_DIAGNOSIS.md): the
// classifier shipped precision-biased despite this header — ACTION_PERM_RE ran
// unconditionally before any `kind` was assigned, so "what CAN I do with my
// class?" / "what DID I sense?" / "how many DO I see?" were indistinguishable
// from genuine feasibility asks ("can I climb it?") and always nulled. The fix
// is ORDERING, not another vocabulary exclusion: a WH-word governing the clause
// beats the auxiliary-leads exclusion (WH_GOVERNS_RE below).

import { isQuestionShaped } from './gracefulAdjudication.js';

// Action verbs — mirrors INFO_SEEKING_EXCLUDE_RE in gracefulAdjudication.js.
// A question containing one of these is an ACTION dressed as a question, not a fact demand.
const ACTION_VERB_RE = /\b(?:attack|strike|hit|stab|slash|shoot|kill|fight|charge|intimidate|charm|deceive|persuade|climb|jump|leap|vault|pick|force|break|try|attempt|sneak|steal|track|forage|decipher|calm)\b/i;

// First-person permission / feasibility questions ("can I climb?", "should I try?",
// "do I need to roll?") — these are action-attempts, not info demands. They still
// need to go through the action resolver (possibly rolling dice). NOTE: second-person
// questions like "were you born here?" do NOT match ("were I/we" ≠ "were you").
const ACTION_PERM_RE = /\b(?:can|could|should|shall|may|do|did|does|would|will|must)\s+(?:i|we)\b/i;

// AG-2R: a WH-word GOVERNING the same clause as the aux+I/we pattern means the
// aux does not LEAD the clause — it's an info demand ("what CAN I do with my
// class?", "what DID I sense?", "how many DO I see?"), not a feasibility ask
// ("CAN I climb it?", where the aux leads with no WH before it). Bounded lookback
// window keeps this from crossing an unrelated earlier clause.
const WH_GOVERNS_RE = /\b(?:what|who|whose|where|when|why|how|which)\b[^.?!]{0,40}?\b(?:can|could|should|shall|may|do|did|does|would|will|must)\s+(?:i|we)\b/i;

// Imperative info-demand forms: "tell me about", "name me one", "show me",
// "give me the raw d20" (RL-5 — a compound roll-report demand phrased as a
// command, not a WH-question). "give me" is scoped to sheet/ledger/roll nouns
// only — a bare "give me a name of someone who's dead" (a fact demand, not a
// roll-report demand) must stay OUT of this list: the pre-roll suppression at
// playloop.js:~3037 is unconditional for any classified kind, so widening
// "give" to match generic fact-demands would wrongly suppress dice on a
// GROUNDED info-ask (U192-02's false-positive guard).
const IMPERATIVE_INFO_RE = /\b(?:name|tell|show|walk|explain|list)\s+me\b|\bgive\s+me\s+(?:the\s+)?(?:raw\s+)?(?:d20|dc|roll|number|modifier|stat|damage)\b/i;

// Sensory-survey phrasings that produce a look-around, NOT a fact answer.
// These belong to the explore-intent path and should not be intercepted here —
// UNLESS the ask is compound ("what do I see — and who's standing in it?"),
// where a second question part rides past the sensory clause and must still
// classify (Part B routes it). Null only when the sensory phrase IS the whole ask.
const SENSORY_SURVEY_RE = /\bwhat\s+(?:do\s+)?(?:i\s+)?see\b|\bwhat'?s\s+(?:around\b|in\s+here\b)|\bdescribe\s+(?:the\s+)?(?:room|area|surroundings|scene)\b/i;
const SENSORY_COMPOUND_SECOND_PART_RE = /\band\s+(?:who|what|where|when|why|how|which|is|are|do|does|did|can|could)\b/i;

// NPC comma-address detector — mirrors handleNpcAddressedQuestion logic in
// gracefulAdjudication.js. Returns the NPC if the text directly addresses it
// ("Q, Elske?" or "Elske, Q?"), else null.
function findAddressedNpc(t, npcs) {
  for (const npc of (npcs || [])) {
    const first = String(npc?.name || '').trim().split(/\s+/)[0];
    if (!first || first.length < 2) continue;
    const esc = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const trailing = new RegExp(`[,]\\s*${esc}\\b(?:\\s*[?!.]|\\s*$)`, 'i');
    const leading = new RegExp(`^\\s*${esc}\\s*[,—]`, 'i');
    if (trailing.test(t) || leading.test(t)) return npc;
  }
  return null;
}

// directQuestionIntent(text, world) → null | { kind, addressee, parts }
//
// null → NOT a direct question; let the existing routing handle it.
// non-null → this IS a direct question that must terminate in an answer or an
//   honest in-fiction decline, never a roll/clarify/nav-bounce/atmosphere-bank.
//
// Exported for DLG-1 to consume (the dialogue-enter sink guard).
export function directQuestionIntent(text, world) {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;

  // Declared action verbs — even in question form, these are actions.
  if (ACTION_VERB_RE.test(t)) return null;

  // First-person permission / feasibility — these still need to roll. BUT only
  // when the auxiliary LEADS the clause ("can I climb it?"). A WH-word governing
  // the same clause ("what CAN I do with my class?", "what DID I sense?", "how
  // many DO I see?") is an info demand, not a feasibility ask — WH_GOVERNS_RE
  // pre-empts the exclusion (AG-2R, the ordering fix — see the header note).
  if (ACTION_PERM_RE.test(t) && !WH_GOVERNS_RE.test(t)) return null;

  // Must be question-shaped (WH opener or trailing "?") or an imperative info form.
  const hasQuestion = isQuestionShaped(t);
  const isImperativeInfo = IMPERATIVE_INFO_RE.test(t);
  if (!hasQuestion && !isImperativeInfo) return null;

  // Sensory survey phrasings → explore-intent, not a fact demand — UNLESS the ask
  // is compound and a second question part rides past the sensory clause ("what
  // do I see — and who's standing in it?"), which must stay classified so Part B
  // can route it (AG-2R).
  if (SENSORY_SURVEY_RE.test(t) && !SENSORY_COMPOUND_SECOND_PART_RE.test(t)) return null;

  // ── Determine kind for downstream consumers ──────────────────────────────
  const node = world?.map?.nodes?.find(n => n && n.id === world?.map?.currentNodeId) ?? null;
  const npcs = node?.settlement?.npcs ?? [];

  // Named direct address: "were you born here, Elske?" / "Elske, do you live here?"
  const addressed = findAddressedNpc(t, npcs);
  if (addressed) return { kind: 'npc-addressed', addressee: String(addressed.name || ''), parts: [t] };

  // Second-person question implying an NPC: "were you born here?", "do you live here?"
  // Second-person "you" ≠ ACTION_PERM_RE's "I/we" check, so these survive above.
  if (/\b(?:were|do|did|have|are|is|was|will|would|can|could)\s+you\b/i.test(t)) {
    return { kind: 'npc-addressed', addressee: null, parts: [t] };
  }

  // Rules / mechanics question: "is Gravedigger a class?", "what level is that spell?"
  if (/\b(?:class|background|archetype|ability|feature|spell|cantrip|level)\b/i.test(t)) {
    return { kind: 'rules', addressee: null, parts: [t] };
  }

  // Referent-followup: "who's it from?", "is there a name on it?", "who sent this?"
  // "this/that" as determiners ("who runs this place?") are excluded — only standalone
  // pronouns ("this?" at end, "it" anywhere) count as referent-followups.
  const HAS_STANDALONE_REFERENT = /\bit\b|\bthey\b|\bthem\b|\bthis\s*[?!,.]|\bthat\s*[?!,.]|\bthis$|\bthat$/i;
  if (HAS_STANDALONE_REFERENT.test(t)) {
    return { kind: 'referent-followup', addressee: null, parts: [t] };
  }

  // Tag/confirmation questions — "The elder probably knows, right?" / "isn't it?"
  // These are speculation or social agreement-seeking, not direct info demands.
  const TAG_QUESTION_RE = /,\s*(?:right|correct|isn'?t\s+(?:it|that)|aren'?t\s+they|don'?t\s+you\s+think|true)\?\s*$/i;
  if (TAG_QUESTION_RE.test(t)) return null;

  // Generic info demand: "who founded this village?", "what happened to the mill?"
  return { kind: 'place', addressee: null, parts: [t] };
}
