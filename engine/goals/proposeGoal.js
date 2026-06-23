// engine/goals/proposeGoal.js
//
// D-B1 — the quest-birth bridge (rung 3). Maps a player's DECLARED intent in
// conversation to a goal SPEC for goalContract.createGoal — the seam that turns "talk"
// into "a quest the player CHOSE." PURE + deterministic: returns a {kind, targetRef,
// label} spec or null. The caller (playloop) mints it via createGoal + a `goalCreated`
// event and acknowledges it IN FICTION (no quest-board / "NEW QUEST" artifact); checkGoals
// (already wired) completes it on the deed. No rng / Date.now / mutation.
//
// H3 seam, two felt-origins:
//   H2 — the player names a concrete action + target ("I'll go to the mill", "I'll deal
//        with the bandits", "I'll talk to the elder", "I'll find the ledger"). Resolved
//        against world entities → a completable goal (reach/talkTo/defeat/obtain/learn).
//   H1 — a bare help-offer to a present NPC ("I'll help you") with no concrete target →
//        the NPC's OWN want (engine/npc/npcArc.npcWant) becomes the goal ("it was their
//        idea"), integrating D-A2b's surfaced concern.
//
// Bias HARD against false births: a musing ("maybe I'll…", "I'll think about it") or a
// question is NOT a commitment, and a target that doesn't resolve does NOT mint a goal
// (a miss beats polluting world.goals with a phantom quest).

import { npcWant } from '../npc/npcArc.js';

// The commitment opener — the player binding themselves to an act.
const DECLARE_RE = /\b(?:i(?:['’]?ll| will| shall| intend to| vow to| mean to)|i['’]?m going to|let me|count on me to)\b/i;
// Hard negatives — an opener that is NOT a real commitment.
const NON_COMMIT_RE = /\b(?:think about it|thinking about it|consider it|considering|maybe|perhaps|might|probably|i guess|i'?ll see|we'?ll see|not sure|later|some ?day|some other time)\b/i;
// A question is a query, never a commitment ("will I find it?" / "should I help?").
const QUESTION_RE = /\?\s*$/;

// verb → goal kind. Order is significant: more specific intents first.
const VERB_PATTERNS = [
  // learn — find OUT / get to the bottom of <fact>
  { kind: 'learn',  re: /\b(?:find out|learn|discover|figure out|uncover|get to the bottom of|look into)\b\s+(.+)/i },
  // talkTo — talk/speak/see/meet/visit <ref>
  { kind: 'talkTo', re: /\b(?:talk to|speak (?:to|with)|see|meet with|meet|visit|go see|check on|call on)\b\s+(.+)/i },
  // defeat — deal with / kill / drive off <foe>
  { kind: 'defeat', re: /\b(?:deal with|kill|defeat|drive off|drive out|hunt down|hunt|stop|put down|slay|rout|clear out|run off)\b\s+(.+)/i },
  // reach — go/travel/head to <place>
  { kind: 'reach',  re: /\b(?:go|travel|head|journey|make|set out|press on|return)\s+(?:to|for|toward|back to)\s+(.+)/i },
  // obtain/ambiguous — find/bring/fetch/get/recover <thing> (resolved below: NPC→talkTo, node→reach, else obtain)
  { kind: 'obtain', re: /\b(?:find|bring|fetch|get|recover|retrieve|deliver|carry|collect)\b\s+(.+)/i },
];

// A bare help-offer (H1) — "I'll help (you / her / out / with that)". No concrete object.
const HELP_OFFER_RE = /\b(?:help|aid|assist|lend a hand|do (?:something|what i can)|see (?:you|her|him|them) right)\b/i;

// Vague objects that are not a real thing to fetch — a "find/get <X>" with one of these
// is an idiom ("find a way", "get going"), not a quest. Guards the obtain fallback.
const VAGUE_OBJECT_RE = /^(?:way|going|started|moving|ready|rest|sleep|it|that|this|them|out|here|there|something|anything|everything|nothing|more|going|on with it|to it|out of here|some (?:rest|sleep|air))$/i;

function clean(s) {
  return String(s || '')
    .trim()
    .replace(/[?.!,;:]+$/, '')
    .replace(/^(?:the|a|an|that|this|some|your|his|her|their)\s+/i, '')
    .replace(/\s+(?:for (?:you|her|him|them)|please|right now|today|first)\b.*$/i, '')
    .trim();
}

function presentSociable(world) {
  const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
  return (node?.settlement?.npcs || []).filter(n => n && !n.hostile);
}
function presentHostiles(world) {
  const node = (world?.map?.nodes || []).find(n => n && n.id === world?.map?.currentNodeId) || null;
  return (node?.settlement?.npcs || []).filter(n => n && n.hostile);
}

// Resolve a reference to a present NPC (sociable or hostile) by name (exact/prefix/first-word)
// or role/descriptor. Mirrors playloop resolvePresentNpcStrict + resolveNpcByRoleOrDescriptor.
function resolveNpc(world, ref, { includeHostile = false } = {}) {
  const r = clean(ref).toLowerCase();
  if (r.length < 3) return null;
  const pool = includeHostile ? [...presentSociable(world), ...presentHostiles(world)] : presentSociable(world);
  for (const n of pool) {
    const nm = String(n.name || '').toLowerCase();
    if (nm && (nm === r || nm.startsWith(r + ' ') || (nm.split(/\s+/)[0] || '') === r)) return n;
  }
  const norm = s => String(s || '').toLowerCase().replace(/_/g, ' ').trim();
  for (const n of pool) {
    const vals = [n.role, n.occupation, n.descriptor, n.archetype, n.title].map(norm).filter(Boolean);
    if (vals.some(v => v === r || v.includes(r) || r.includes(v))) return n;
  }
  return null;
}

// Resolve a reference to a map node by name (a real, known place → a reach target).
function resolveNode(world, ref) {
  const r = clean(ref).toLowerCase();
  if (r.length < 3) return null;
  const here = String(world?.map?.currentNodeId || '');
  const nodes = (world?.map?.nodes || []).filter(n => n && n.id !== here);
  // WHOLE-WORD name match (not a bare substring — "way" must not match "Crossway");
  // prefer a discovered node.
  const esc = r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp('\\b' + esc + '\\b');
  const byName = nodes.filter(n => rx.test(String(n.name || '').toLowerCase()));
  if (!byName.length) return null;
  return byName.find(n => n.discovered) || byName[0];
}

function titleCaseFirst(s) { const x = String(s || ''); return x.charAt(0).toUpperCase() + x.slice(1); }

/**
 * proposeGoalFromDialogue(world, text, npc?) -> { kind, targetRef, label } | null
 * npc = the addressed/present NPC (for the H1 want path + label colour); optional.
 */
export function proposeGoalFromDialogue(world, text, npc = null) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (QUESTION_RE.test(t)) return null;          // a question is never a commitment
  if (!DECLARE_RE.test(t)) return null;          // no "I'll …" commitment opener
  if (NON_COMMIT_RE.test(t)) return null;        // "maybe I'll …" / "I'll think about it"

  // H2 — a concrete action + object.
  for (const { kind, re } of VERB_PATTERNS) {
    const m = re.exec(t);
    if (!m) continue;
    const obj = clean(m[1]);
    if (!obj || obj.length < 2) continue;

    if (kind === 'talkTo') {
      const who = resolveNpc(world, obj);
      if (!who) return null;                      // unresolved person → no phantom quest
      return { kind: 'talkTo', targetRef: String(who.id), label: `Speak with ${who.name || obj}` };
    }
    if (kind === 'defeat') {
      const foe = resolveNpc(world, obj, { includeHostile: true });
      if (!foe) return null;
      return { kind: 'defeat', targetRef: String(foe.id), label: `Deal with ${foe.name || obj}` };
    }
    if (kind === 'reach') {
      const node = resolveNode(world, obj);
      if (!node) return null;                     // unknown place → no phantom journey
      return { kind: 'reach', targetRef: String(node.id), label: `Travel to ${node.name || obj}` };
    }
    if (kind === 'learn') {
      return { kind: 'learn', targetRef: `learn:${obj.toLowerCase()}`, label: `Find out ${obj}` };
    }
    if (kind === 'obtain') {
      // "find/bring/get <X>": a vague idiom ("find a way", "get going") is not a quest.
      if (obj.length < 4 || VAGUE_OBJECT_RE.test(obj)) return null;
      // if X is a present person it's a talkTo; a known place a reach; otherwise a thing to obtain.
      const who = resolveNpc(world, obj);
      if (who) return { kind: 'talkTo', targetRef: String(who.id), label: `Find ${who.name || obj}` };
      const node = resolveNode(world, obj);
      if (node) return { kind: 'reach', targetRef: String(node.id), label: `Reach ${node.name || obj}` };
      return { kind: 'obtain', targetRef: obj.toLowerCase(), label: `Recover ${titleCaseFirst(obj)}` };
    }
  }

  // H1 — a bare help-offer to a present NPC → the NPC's own want becomes the goal.
  if (HELP_OFFER_RE.test(t)) {
    const target = npc || presentSociable(world)[0] || null;
    if (!target) return null;                     // no one to help → no goal
    const want = npcWant(target, String(world?.meta?.seed || ''))?.surface;
    if (!want) return null;
    const nm = target.name || 'them';
    return { kind: 'learn', targetRef: `helped:${String(target.id)}`, label: `Help ${nm} — ${want}` };
  }

  return null;
}
