/**
 * The Intent layer — one player-action vocabulary, many input faucets.
 *
 * A player can declare an action three ways: by typing ("I charge the wolf and
 * cut it down"), by clicking (tap the wolf with a sword selected), or by voice
 * (speech → text → here). All three compile to the SAME Intent. The deterministic
 * engine then resolves it — text/click/voice never roll dice, they only declare.
 *
 * This is the seam that keeps the game text-first (like real D&D) while letting
 * the map handle the fiddly bits (which of three wolves? that tile, there).
 *
 * PURE + DETERMINISTIC. No rng, no LLM. The LLM, when it lands, is just a fourth
 * source that emits this exact shape (source:'llm').
 */

// The verbs the game understands. Everything a player declares lands in one of
// these. 'ask' is the catch-all: free narration that wasn't a mechanical action,
// handed to the AI DM ("I admire the sunset", "what do I smell?").
export const VERBS = [
  'move',    // reposition: walk/go/approach/retreat (grid or narrative)
  'attack',  // strike a foe with a weapon: hit/swing/shoot/stab
  'cast',    // work a spell: conjure/evoke/invoke
  'talk',    // address someone: speak/ask/persuade/intimidate/greet
  'search',  // perceive/examine: look/inspect/investigate/study/read
  'take',    // acquire: grab/loot/steal/pick up
  'use',     // operate something: drink/open/pull/light/apply
  'flee',    // leave a fight: run/escape/disengage/withdraw
  'wait',    // hold/ready/defend/pass/end turn
  'ask'      // free narration → AI DM (default fallback)
];

// The five approaches the resolver already knows (engine/resolve.js statForApproach).
// force→MIGHT, finesse→AGILITY, endure→GRIT, heart→CHARM, focus→WITS.
export const APPROACHES = ['force', 'finesse', 'endure', 'heart', 'focus'];

// What's at stake — drives which clock advances (engine/resolve.js stakeToClockKey).
export const STAKES = ['time', 'harm', 'survival'];

// Verbs that resolve on the tactical grid (battle engine) rather than via the
// narrative d20 resolver. Movement/attack/cast/flee/wait are grid-native in a fight.
export const TACTICAL_VERBS = new Set(['move', 'attack', 'cast', 'flee', 'wait']);

export function isTacticalVerb(verb) {
  return TACTICAL_VERBS.has(String(verb || ''));
}

// Default approach for a verb, given an optional instrument tag. This is advisory:
// a parsed sentence or an explicit click can override it.
export function defaultApproachForVerb(verb, withTool) {
  const v = String(verb || '');
  const tool = String(withTool || '').toLowerCase();
  const ranged = /bow|sling|dart|crossbow|throw|javelin|shortbow|longbow/.test(tool);
  switch (v) {
    case 'attack': return ranged ? 'finesse' : 'force';
    case 'cast': return 'focus';
    case 'search': return 'focus';
    case 'talk': return 'heart';
    case 'move': return 'finesse';
    case 'flee': return 'finesse';
    case 'take': return 'finesse';
    case 'use': return 'focus';
    default: return 'focus';
  }
}

// Default stake for a verb — what you're spending if it goes wrong.
export function defaultStakeForVerb(verb) {
  const v = String(verb || '');
  if (v === 'attack' || v === 'cast') return 'harm';
  if (v === 'flee') return 'survival';
  return 'time';
}

// Ambiguity flavors a shadow packet may signal — which slot is underdetermined.
// Populated only by the INT-1 assembler; the base parsers never set this.
export const AMBIGUITY_KINDS = ['target', 'object', 'goal', 'referent'];

/**
 * makeIntent — normalize any partial into a full, well-formed Intent.
 *
 * Intent shape:
 *   verb     : one of VERBS
 *   target   : entity id/ref/name the action is aimed at, or null
 *   at       : {x,y} grid position when relevant, or null
 *   with     : instrument tag — weapon/spell/item ('sword','fireball'), or null
 *   approach : one of APPROACHES (how you do it)
 *   stake    : one of STAKES (what's at risk)
 *   text     : the raw utterance, always preserved (narration + audit)
 *   source   : 'text' | 'click' | 'voice' | 'llm'
 *   confidence: 0..1 — how sure the parser is (clicks are 1; fuzzy text lower)
 *
 * INT-1 additive fields (all default empty/null; only the shadow assembler in
 * engine/intent/assemblePacket.js populates them — every existing caller keeps
 * working unmodified):
 *   targets      : entity ids the utterance could plausibly aim at (array)
 *   objects      : scene-object names/ids the utterance mentions (array)
 *   compoundParts: sub-asks of a multi-part utterance (array)
 *   ambiguity    : null | 'target' | 'object' | 'goal' | 'referent'
 *   kind         : null | directQuestionIntent's kind (rules/self/npc-addressed/
 *                  place/object/referent-followup)
 */
export function makeIntent(partial = {}) {
  const p = partial && typeof partial === 'object' ? partial : {};
  let verb = String(p.verb || '').toLowerCase();
  if (!VERBS.includes(verb)) verb = 'ask';

  const withTool = p.with != null ? String(p.with) : null;

  let approach = String(p.approach || '').toLowerCase();
  if (!APPROACHES.includes(approach)) approach = defaultApproachForVerb(verb, withTool);

  let stake = String(p.stake || '').toLowerCase();
  if (!STAKES.includes(stake)) stake = defaultStakeForVerb(verb);

  let at = null;
  if (p.at && Number.isFinite(p.at.x) && Number.isFinite(p.at.y)) {
    at = { x: Math.trunc(p.at.x), y: Math.trunc(p.at.y) };
  }

  let confidence = Number(p.confidence);
  if (!Number.isFinite(confidence)) confidence = 1;
  confidence = Math.max(0, Math.min(1, confidence));

  const source = ['text', 'click', 'voice', 'llm'].includes(String(p.source)) ? String(p.source) : 'text';

  const targets = Array.isArray(p.targets) ? p.targets.map(String).filter(Boolean) : [];
  const objects = Array.isArray(p.objects) ? p.objects.map(String).filter(Boolean) : [];
  const compoundParts = Array.isArray(p.compoundParts) ? p.compoundParts.map(String).filter(Boolean) : [];
  const ambiguity = AMBIGUITY_KINDS.includes(p.ambiguity) ? p.ambiguity : null;
  const kind = p.kind != null && String(p.kind).length ? String(p.kind) : null;

  return {
    verb,
    target: p.target != null && String(p.target).length ? String(p.target) : null,
    at,
    with: withTool,
    approach,
    stake,
    text: String(p.text ?? '').trim(),
    source,
    confidence,
    targets,
    objects,
    compoundParts,
    ambiguity,
    kind
  };
}

/**
 * validateIntent — structural check. Returns { ok, errors }.
 * The engine should never crash on a malformed intent; this lets callers degrade
 * gracefully (e.g. fall back to 'ask' / clarifying question).
 */
export function validateIntent(intent) {
  const errors = [];
  if (!intent || typeof intent !== 'object') return { ok: false, errors: ['intent is not an object'] };
  if (!VERBS.includes(intent.verb)) errors.push(`unknown verb: ${intent.verb}`);
  if (!APPROACHES.includes(intent.approach)) errors.push(`unknown approach: ${intent.approach}`);
  if (!STAKES.includes(intent.stake)) errors.push(`unknown stake: ${intent.stake}`);
  if (intent.at && !(Number.isFinite(intent.at.x) && Number.isFinite(intent.at.y))) errors.push('at is malformed');
  // attack/cast want a target OR a position (blind-fire AoE casts at a tile)
  if ((intent.verb === 'attack' || intent.verb === 'cast') && !intent.target && !intent.at) {
    errors.push(`${intent.verb} needs a target or a position`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * intentToMove — project an Intent into the resolver's move shape
 * (engine/resolve.js resolveMove). This is how a declared intent becomes a
 * narrative d20 resolution. Tactical verbs in a live fight bypass this and go to
 * the battle engine instead (see isTacticalVerb).
 */
export function intentToMove(intent, { actorId = 'party' } = {}) {
  const i = makeIntent(intent);
  return {
    actorId: String(actorId),
    intentText: i.text || verbPhrase(i),
    approachTag: i.approach,
    stakeTag: i.stake,
    targetId: i.target,
    toolTag: i.with || null
  };
}

// A readable fallback phrase when no raw text was supplied (e.g. pure click).
export function verbPhrase(intent) {
  const i = makeIntent(intent);
  const tgt = i.target ? ` the ${i.target.replace(/_/g, ' ')}` : '';
  const wth = i.with ? ` with ${i.with.replace(/_/g, ' ')}` : '';
  switch (i.verb) {
    case 'attack': return `attack${tgt}${wth}`;
    case 'cast': return `cast ${i.with || 'a spell'}${tgt}`;
    case 'talk': return `speak to${tgt || ' them'}`;
    case 'move': return i.at ? `move to ${i.at.x},${i.at.y}` : 'move';
    case 'search': return `search${tgt || ' the area'}`;
    case 'take': return `take${tgt}`;
    case 'use': return `use${tgt || wth}`;
    case 'flee': return 'flee the fight';
    case 'wait': return 'hold and ready';
    default: return i.text || 'look around';
  }
}
