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

// The five engine stats the d20 can key off (engine/resolve.js). Distinct from
// APPROACHES: the approach is HOW you act (and normally implies the stat); the
// stat is which ability the DIE keys off. DECL-STAT-1: when a player EXPLICITLY
// declares an ability ("I'll roll Strength", "a WITS check"), that declaration
// carries here as `stat` and overrides the approach→stat inference downstream —
// see engine/resolve.js normalizeStatTag / statForApproach.
export const STATS = ['MIGHT', 'AGILITY', 'GRIT', 'CHARM', 'WITS'];

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
 *   stat     : one of STATS, or null — a player-DECLARED ability ("I'll roll
 *              Strength"); overrides the approach→stat inference in the resolver
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

  // DECL-STAT-1: an explicitly declared ability. null unless the player named a
  // stat to roll ("I'll roll Strength", "a Dexterity check"); a bare action
  // leaves it null and the resolver infers from the approach exactly as before.
  // Normalized to the engine stat name (upper-case) and validated against STATS.
  let stat = p.stat != null ? String(p.stat).trim().toUpperCase() : '';
  stat = STATS.includes(stat) ? stat : null;

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

  // RULING-DC-1 — the improvised-ruling judge's two fields. The model names a
  // coarse difficulty BAND for the attempted feat (never a number — V11 law;
  // the engine maps band → DC in resolve.js) and the ability that governs it.
  // Both validate to enums here, so a hallucinated value can never reach the
  // resolver. difficultyStat is separate from `stat` on purpose: `stat` is the
  // PLAYER's declared ability (DECL-STAT-1) and always outranks the judge.
  const difficultyBand = DIFFICULTY_BANDS.includes(p.difficultyBand) ? p.difficultyBand : null;
  let difficultyStat = p.difficultyStat != null ? String(p.difficultyStat).trim().toUpperCase() : '';
  difficultyStat = STATS.includes(difficultyStat) ? difficultyStat : null;

  return {
    verb,
    target: p.target != null && String(p.target).length ? String(p.target) : null,
    at,
    with: withTool,
    approach,
    stat,
    stake,
    text: String(p.text ?? '').trim(),
    source,
    confidence,
    targets,
    objects,
    compoundParts,
    ambiguity,
    kind,
    difficultyBand,
    difficultyStat
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
    // DECL-STAT-1: carry an explicitly declared ability into the resolver's move
    // shape. null when undeclared (the common case) → resolve.js falls back to
    // statForApproach, byte-identical to pre-DECL-STAT-1.
    statTag: i.stat || null,
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

// --- RULING-DC-1: the persisted ruling record --------------------------------
//
// The compact, versioned projection of a grounded IntentPacket that rides the
// turn-initiating resolution/blocked timeline event as `data.resolvedIntent`.
// Replay feeds this record straight back through playerMove's {llmPacket}
// seam, so a model-translated turn replays with ZERO model calls (tests/U720).
// The projection is a FIXED POINT: persistableIntent(persistableIntent(p)) is
// byte-identical — replay re-persists exactly what it was fed, keeping live
// and replayed timelines hash-equal (worldHash covers w.timeline).
//
// difficultyBand/difficultyStat are the improvised-ruling judge's two fields
// (V11 law: the model names a coarse BAND, never a number; the engine maps
// band → DC). difficultyStat is deliberately separate from `stat`: `stat` is
// the PLAYER's declared ability (DECL-STAT-1 authority) and the judge's
// suggestion must never impersonate it.

export const DIFFICULTY_BANDS = ['trivial', 'easy', 'medium', 'hard', 'very_hard', 'impossible'];

export function persistableIntent(packet) {
  const p = packet && typeof packet === 'object' ? packet : {};
  const str = v => (v != null && String(v).length ? String(v) : null);
  let confidence = Number(p.confidence);
  if (!Number.isFinite(confidence)) confidence = 1;
  confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
  return {
    v: 1,
    source: ['text', 'click', 'voice', 'llm'].includes(String(p.source)) ? String(p.source) : 'text',
    verb: VERBS.includes(String(p.verb)) ? String(p.verb) : 'ask',
    kind: str(p.kind),
    approach: APPROACHES.includes(String(p.approach)) ? String(p.approach) : null,
    stat: STATS.includes(p.stat) ? p.stat : null,
    stake: STAKES.includes(String(p.stake)) ? String(p.stake) : null,
    confidence,
    target: str(p.target),
    difficultyBand: DIFFICULTY_BANDS.includes(p.difficultyBand) ? p.difficultyBand : null,
    difficultyStat: STATS.includes(p.difficultyStat) ? p.difficultyStat : null
  };
}
