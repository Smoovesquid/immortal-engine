// AG-1 — answerability classifier.
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

// Mirrors isQuestionShaped in gracefulAdjudication.js — kept in sync by design.
const QUESTION_SHAPE = /^\s*(?:what|who|whose|where|when|why|how|which|can|could|should|would|will|do|does|did|am|is|are|was|were|help)\b|\?\s*$/i;

// Action verbs — mirrors INFO_SEEKING_EXCLUDE_RE in gracefulAdjudication.js.
// A question containing one of these is an ACTION dressed as a question, not a fact demand.
const ACTION_VERB_RE = /\b(?:attack|strike|hit|stab|slash|shoot|kill|fight|charge|intimidate|charm|deceive|persuade|climb|jump|leap|vault|pick|force|break|try|attempt|sneak|steal|track|forage|decipher|calm)\b/i;

// First-person permission / feasibility questions ("can I climb?", "should I try?",
// "do I need to roll?") — these are action-attempts, not info demands. They still
// need to go through the action resolver (possibly rolling dice). NOTE: second-person
// questions like "were you born here?" do NOT match ("were I/we" ≠ "were you").
const ACTION_PERM_RE = /\b(?:can|could|should|shall|may|do|did|does|would|will|must)\s+(?:i|we)\b/i;

// Imperative info-demand forms: "tell me about", "name me one", "show me".
const IMPERATIVE_INFO_RE = /\b(?:name|tell|show|walk|explain|list)\s+me\b/i;

// Sensory-survey phrasings that produce a look-around, NOT a fact answer.
// These belong to the explore-intent path and should not be intercepted here.
const SENSORY_SURVEY_RE = /\bwhat\s+(?:do\s+)?(?:i\s+)?see\b|\bwhat'?s\s+(?:around\b|in\s+here\b)|\bdescribe\s+(?:the\s+)?(?:room|area|surroundings|scene)\b/i;

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

  // First-person permission / feasibility — these still need to roll.
  if (ACTION_PERM_RE.test(t)) return null;

  // Must be question-shaped (WH opener or trailing "?") or an imperative info form.
  const hasQuestion = QUESTION_SHAPE.test(t);
  const isImperativeInfo = IMPERATIVE_INFO_RE.test(t);
  if (!hasQuestion && !isImperativeInfo) return null;

  // Sensory survey phrasings → explore-intent, not a fact demand.
  if (SENSORY_SURVEY_RE.test(t)) return null;

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
