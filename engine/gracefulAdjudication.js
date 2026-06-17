// engine/gracefulAdjudication.js
//
// Rung 1 — Graceful Adjudication. A single structured "traffic cop" decision
// that runs at the FRONT of a player turn, BEFORE dice are rolled or prose is
// narrated. Its job is to understand what the player is trying to do.
//
// Doctrine (PLAN.md): "AI can only describe what the canonical surface says is
// true." Narration already works — the surface it is handed is sometimes false.
// We fix the surface, not the narrator. Three seams this closes:
//   1. META questions ("what's my AC?", "what's the DC?", "can I even do that?")
//      were falling through into resolveMove and rolling a d20 at a question.
//   2. HAZARDS in the fiction emitted no wound (only attack-keyword text set
//      stakeTag='harm'). withHazard() wires the seam for scene.hazards[].
//   3. MELEE was mistagged as a SPELL (greedy ^cast / 'ward'->'occult'). The
//      SPELL gate only routes to 'spell' for a real, resolvable, known spell.
//
// Contract: adjudicate() is PURE, DETERMINISTIC, and NEVER throws. On any
// internal error it abstains to a safe 'generic' decision.

import { lookupSpell } from './ruleset/core/spells/index.js';
import { computeAC } from './gear/gearProps.js';
import { statMod, maxWounds } from './ruleset/core/stats.js';

const CONFIDENCE_FLOOR = 0.45;

/**
 * @typedef {Object} AdjudicationMove
 * @property {string} actorId
 * @property {string} intentText
 * @property {string} approachTag
 * @property {string} stakeTag
 * @property {string|null} targetId
 * @property {string|null} toolTag
 *
 * @typedef {Object} AdjudicationDecision
 * @property {'meta'|'clarify'|'dialogue'|'recruit'|'spell'|'combat'|'physics'|'travel'|'generic'} route
 * @property {number} confidence            0..1
 * @property {'rule'|'llm'|'fallback'} tier
 * @property {AdjudicationMove|null} move
 * @property {{kind:'rules'|'sheet'|'state'|'capability', answer:string}|null} meta
 * @property {boolean} hazardApplied
 * @property {string|null} clarifyPrompt
 */

// ── Lexicon ─────────────────────────────────────────────────────────────────

const CAST_VERB_RE = /\b(cast|invoke|channel|conjure|incant)\b/i;
const COMBAT_VERB_RE = /\b(attack|strike|hit|punch|fight|kill|swing|slash|stab|charge|ward\s+off|fend\s+off|parry|lunge|cleave|slay|behead|gut|blade|sword|axe|spear|mace|dagger|halberd|hammer|weapon)\b/i;
const TRAVEL_VERB_RE = /\b(travel|leave|exit|head\s+to|go\s+to|move\s+to|journey|walk\s+to|go\s+north|go\s+south|go\s+east|go\s+west|north|south|east|west)\b/i;
const PHYSICS_VERB_RE = /\b(examine|inspect|search|look\s+at|check|rip|break|smash|tear|kick|punch|shatter|take|grab|pick\s+up|steal|open|push|pull|lift|move)\b/i;
const DIALOGUE_VERB_RE = /\b(talk\s+to|speak\s+to|speak\s+with|chat\s+with|approach|greet|ask\b)\b/i;
const RECRUIT_RE = /\b(join\s+me|come\s+with\s+me|travel\s+with\s+me|join\s+my|recruit)\b/i;

// META — capability / sheet / rules / state questions.
const META_CAPABILITY_RE = /^\s*(can|could|may|am\s+i\s+(able|allowed)|is\s+it\s+possible)\b/i;
const META_SHEET_TRIGGER_RE = /\b(what'?s|what\s+is|how\s+(much|many)|do\s+i\s+have|show\s+me|tell\s+me)\b/i;
const META_SHEET_NOUN_RE = /\b(ac|armou?r\s*class|hp|health|hit\s*points|wounds?|stress|level|xp|spell\s*slots?|slots?|stats?|might|agility|wits|grit|charm|inventory|gear|equipment|spells?)\b/i;
const META_SHEET_PHRASE_RE = /\bcharacter\s+sheet\b|\bmy\s+(ac|armou?r\s*class|hp|health|wounds?|stress|level|stats?|inventory|gear|equipment|spells?|spell\s*slots?)\b/i;
const META_RULES_TRIGGER_RE = /\b(what'?s|what\s+is|how\s+does|how\s+do)\b/i;
const META_RULES_NOUN_RE = /\b(the\s+)?(dc|difficulty\s+class|difficulty|to[-\s]?hit|target\s+number|modifier|advantage|disadvantage|the\s+rules?)\b/i;
const META_STATE_RE = /\b(where\s+am\s+i|where\s+are\s+we|who'?s\s+here|who\s+is\s+here|who'?s\s+around|what\s+time\s+is\s+it)\b/i;

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Adjudicate a player turn into a structured, never-throwing decision.
 *
 * @param {object} world
 * @param {string} text
 * @param {object} [opts]
 * @param {object} [opts.pack]
 * @param {string} [opts.actorId]
 * @param {(world:object, pack:object, actorId:string, text:string)=>object} [opts.inferMove]
 *   The mainline move-math function (playloop.inferMoveFromText). When supplied
 *   the fallback tier delegates to it so approach/stake/risk MATH stays single-
 *   sourced. When absent (e.g. unit tests) a minimal internal classifier runs.
 * @param {(world:object, text:string, opts:object)=>(AdjudicationDecision|null)} [opts.llmClassifier]
 *   Optional Tier-2 classifier. Wrapped so it never throws; falls through on error.
 * @returns {AdjudicationDecision}
 */
export function adjudicate(world, text, opts = {}) {
  try {
    return adjudicateInner(world, text, opts || {});
  } catch (_err) {
    // Never throw — abstain to a safe generic decision.
    return {
      route: 'generic',
      confidence: CONFIDENCE_FLOOR,
      tier: 'fallback',
      move: null,
      meta: null,
      hazardApplied: false,
      clarifyPrompt: null
    };
  }
}

function adjudicateInner(world, text, opts) {
  const raw = String(text == null ? '' : text);
  const t = raw.toLowerCase().trim();
  const actorId = String(opts.actorId || world?.party?.[0]?.id || 'party');

  // Empty or gibberish → abstain → clarify (no move, no mutation downstream).
  if (!t || isGibberish(t)) {
    return clarifyDecision(raw);
  }

  // ── Tier 1: rule classifier ──────────────────────────────────────────────
  // META gate runs FIRST. Questions about capability/sheet/rules/state are
  // answered from world state with NO dice.
  const metaKind = classifyMeta(t);
  if (metaKind) {
    return {
      route: 'meta',
      confidence: 0.9,
      tier: 'rule',
      move: null,
      meta: { kind: metaKind, answer: composeMetaAnswer(world, metaKind, raw) },
      hazardApplied: false,
      clarifyPrompt: null
    };
  }

  // SPELL gate — only a real, resolvable spell. A cast verb is necessary but
  // not sufficient: the named spell must lookupSpell() to a real def, and, when
  // the caster has a known-list, it must be known. "cast a glance over the
  // room" never clears this — lookupSpell('a_glance') is null.
  const spellDecision = classifySpell(world, raw, actorId);
  if (spellDecision) return spellDecision;

  // RECRUIT / DIALOGUE (social intents).
  if (RECRUIT_RE.test(t)) {
    return ruleMove('recruit', 0.75, world, raw, actorId, opts, 'heart', 'rapport');
  }
  if (DIALOGUE_VERB_RE.test(t)) {
    return ruleMove('dialogue', 0.75, world, raw, actorId, opts, 'heart', 'rapport');
  }

  // COMBAT — active combat OR a combat verb. Combat moves are always 'harm'.
  const inCombat = Boolean(world?.combat?.active);
  if (inCombat || COMBAT_VERB_RE.test(t)) {
    const decision = ruleMove('combat', inCombat ? 0.85 : 0.8, world, raw, actorId, opts, combatApproach(t), 'harm');
    decision.move.targetId = firstLivingEnemyId(world);
    return withHazard(world, decision);
  }

  // TRAVEL — directional / named movement.
  if (TRAVEL_VERB_RE.test(t)) {
    return ruleMove('travel', 0.75, world, raw, actorId, opts, 'survival', 'time');
  }

  // PHYSICS — manipulate something in the scene.
  if (PHYSICS_VERB_RE.test(t)) {
    return withHazard(world, ruleMove('physics', 0.7, world, raw, actorId, opts, null, null));
  }

  // ── Tier 2: optional LLM classifier (wrapped, never throws) ───────────────
  // TODO(rung1-llm): when an LLM classifier is wired, cache its decision in the
  // Canon Log keyed by (turn, normalized-text) and re-read it on replay so the
  // decision is deterministic and worldHash stays stable. Do NOT call an LLM
  // from this synchronous, deterministic path.
  if (typeof opts.llmClassifier === 'function') {
    try {
      const llm = opts.llmClassifier(world, raw, opts);
      if (llm && typeof llm === 'object' && typeof llm.route === 'string') {
        return { tier: 'llm', meta: null, hazardApplied: false, clarifyPrompt: null, move: null, confidence: CONFIDENCE_FLOOR, ...llm };
      }
    } catch (_err) {
      // fall through to fallback tier
    }
  }

  // ── Tier 3: fallback keyword classifier ───────────────────────────────────
  // Recognizable-but-unclassified intent → generic, delegating the
  // approach/stake/risk MATH to inferMoveFromText (single source of truth).
  const generic = withHazard(world, ruleMove('generic', 0.5, world, raw, actorId, opts, null, null));
  generic.tier = 'fallback';
  if (generic.confidence < CONFIDENCE_FLOOR) return clarifyDecision(raw);
  return generic;
}

/**
 * Hazard seam. If world.scene.hazards has an active 'enter'/'act' hazard, force
 * the move's stakeTag to the hazard's stake and flag hazardApplied. scene.hazards
 * is [] until a later packet, so this is a no-op today — we wire the seam now.
 *
 * @param {object} world
 * @param {AdjudicationDecision} decision
 * @returns {AdjudicationDecision}
 */
export function withHazard(world, decision) {
  try {
    const hazards = world?.scene?.hazards;
    if (!Array.isArray(hazards) || !hazards.length || !decision || !decision.move) return decision;
    const active = hazards.find(h => h && h.active && (h.trigger === 'enter' || h.trigger === 'act'));
    if (!active) return decision;
    return {
      ...decision,
      move: { ...decision.move, stakeTag: String(active.stake || decision.move.stakeTag) },
      hazardApplied: true
    };
  } catch (_err) {
    return decision;
  }
}

// ── Tier-1 helpers ────────────────────────────────────────────────────────

function classifyMeta(t) {
  if (META_CAPABILITY_RE.test(t)) return 'capability';
  if (META_SHEET_PHRASE_RE.test(t)) return 'sheet';
  if (META_SHEET_TRIGGER_RE.test(t) && META_SHEET_NOUN_RE.test(t)) return 'sheet';
  if (META_RULES_TRIGGER_RE.test(t) && META_RULES_NOUN_RE.test(t)) return 'rules';
  if (META_STATE_RE.test(t)) return 'state';
  return null;
}

function classifySpell(world, raw, actorId) {
  const t = String(raw || '');
  if (!CAST_VERB_RE.test(t)) return null;
  // Parse the spell phrase after the cast verb (same shape as the playloop
  // branch this gate replaces): "cast <spell> [at|on|toward <target>]".
  const m = t.match(/\b(?:cast|invoke|channel|conjure|incant)\s+(.+?)(?:\s+(?:at|on|toward|against)\s+(.+))?$/i);
  if (!m) return null;
  const rawSpellName = String(m[1] || '').trim();
  if (!rawSpellName) return null;
  const spellRef = rawSpellName.toLowerCase().replace(/[.!?,;:]+$/, '').trim().replace(/\s+/g, '_');
  const def = lookupSpell(spellRef);
  if (!def) return null; // not a real spell — e.g. "cast a glance over the room"

  // If the caster has a known-list, the spell must be known.
  const known = world?.party?.[0]?.spells?.known;
  if (Array.isArray(known) && known.length && !known.includes(spellRef)) return null;

  return {
    route: 'spell',
    confidence: 0.9,
    tier: 'rule',
    move: {
      actorId,
      intentText: String(raw || '').trim(),
      // 'occult' approach ONLY when route==='spell'.
      approachTag: 'occult',
      stakeTag: 'harm',
      targetId: firstLivingEnemyId(world),
      toolTag: spellRef
    },
    meta: null,
    hazardApplied: false,
    clarifyPrompt: null
  };
}

function combatApproach(t) {
  if (/\b(parley|talk\s+down|soothe|calm|appeal|plead)\b/.test(t)) return 'heart';
  if (/\b(defend|guard|brace|block|hold\s+the\s+line|shield)\b/.test(t)) return 'endure';
  if (/\b(study|aim|read|observe|size\s+up|focus)\b/.test(t)) return 'focus';
  if (/\b(sneak|slip|feint|dodge|weave|finesse)\b/.test(t)) return 'finesse';
  // Default combat posture (attack/strike/blade/ward off/...) is force.
  return 'force';
}

/**
 * Build a concrete-route decision with a move. When opts.inferMove is supplied
 * the approach/stake/risk MATH is delegated to it (single source of truth);
 * `approachOverride`/`stakeOverride` then bias only what the route demands.
 */
function ruleMove(route, confidence, world, raw, actorId, opts, approachOverride, stakeOverride) {
  let approachTag = approachOverride || 'focus';
  let stakeTag = stakeOverride || 'time';
  let toolTag = null;

  if (typeof opts.inferMove === 'function') {
    try {
      const base = opts.inferMove(world, opts.pack, actorId, raw) || {};
      approachTag = approachOverride || base.approachTag || approachTag;
      stakeTag = stakeOverride || base.stakeTag || stakeTag;
      toolTag = base.toolTag ?? null;
    } catch (_err) {
      // fall through to internal defaults below
    }
  } else {
    const internal = internalInfer(raw);
    approachTag = approachOverride || internal.approachTag;
    stakeTag = stakeOverride || internal.stakeTag;
  }

  return {
    route,
    confidence,
    tier: 'rule',
    move: { actorId, intentText: String(raw || '').trim(), approachTag, stakeTag, targetId: null, toolTag },
    meta: null,
    hazardApplied: false,
    clarifyPrompt: null
  };
}

// Minimal approach/stake classifier used only when opts.inferMove is absent
// (e.g. unit tests calling adjudicate directly). Mirrors inferMoveFromText's
// keyword map MINUS 'occult' (occult is reserved for the spell route).
function internalInfer(raw) {
  const t = String(raw || '').toLowerCase();
  const approachTag =
    /\b(force|bash|break|kick|pry|smash)\b/.test(t) ? 'force' :
    /\b(sneak|quiet|hide|slip|crawl|shadow)\b/.test(t) ? 'finesse' :
    /\b(aim|shoot|throw|strike|attack)\b/.test(t) ? 'focus' :
    /\b(talk|convince|lie|threaten|charm)\b/.test(t) ? 'charm' :
    /\b(listen|watch|study|search|inspect)\b/.test(t) ? 'insight' :
    /\b(hack|wire|code|scan|calibrate|repair)\b/.test(t) ? 'tech' :
    /\b(track|forage|camp|survive)\b/.test(t) ? 'survival' :
    'focus';
  const stakeTag =
    /\b(attack|fight|kill|stab|shoot|harm)\b/.test(t) ? 'harm' :
    /\b(steal|take|loot|grab|spend|supplies)\b/.test(t) ? 'resource' :
    /\b(seen|noticed|alarm|expose|exposure)\b/.test(t) ? 'exposure' :
    /\b(reputation|trust|name)\b/.test(t) ? 'reputation' :
    /\b(dread|terror|fear)\b/.test(t) ? 'dread' :
    'time';
  return { approachTag, stakeTag };
}

function clarifyDecision(raw) {
  const snippet = String(raw || '').trim().slice(0, 80);
  const prompt = snippet
    ? `I want to get this right — I'm not sure what you mean by "${snippet}". What are you trying to do?`
    : `I'm not sure what you'd like to do. What are you trying to do?`;
  return {
    route: 'clarify',
    confidence: 0,
    tier: 'fallback',
    move: null,
    meta: null,
    hazardApplied: false,
    clarifyPrompt: prompt
  };
}

// ── META answer composer (read-only over world state) ───────────────────────

function composeMetaAnswer(world, kind, raw) {
  try {
    const p0 = world?.party?.[0] || {};
    if (kind === 'capability') {
      return `You can attempt that. Tell me how you go about it and I'll judge the difficulty — I won't roll until you commit to an action.`;
    }
    if (kind === 'rules') {
      return `Difficulty isn't fixed: I set a DC from how hard the action is and the approach you take, then a d20 plus your relevant edge has to meet it. Nothing's rolled until you act.`;
    }
    if (kind === 'state') {
      const node = currentNode(world);
      const loc = String(node?.name || world?.scene?.location || 'an unnamed place');
      const npcs = (node?.settlement?.npcs || [])
        .map(n => String(n?.name || '').trim())
        .filter(Boolean)
        .slice(0, 4);
      const npcLine = npcs.length ? ` Here with you: ${npcs.join(', ')}.` : ' No one else is here.';
      const facts = (world?.ledger?.facts || []).map(f => String(f?.text || '').trim()).filter(Boolean).slice(0, 2);
      const factLine = facts.length ? ` You know: ${facts.join('; ')}.` : '';
      return `You're at ${loc}.${npcLine}${factLine}`;
    }
    // sheet
    const name = String(p0.name || 'you');
    const level = clampInt(p0.level ?? 1, 1, 20);
    const gritMod = safeStatMod(p0.stats?.GRIT ?? 10);
    const woundCap = safeMaxWounds(level, gritMod);
    const wounds = clampInt(p0.wounds ?? 0, 0, woundCap);
    const stress = clampInt(p0.stress ?? 0, 0, 6);
    const ac = safeAC(p0);
    const slots = p0?.spells?.slots && typeof p0.spells.slots === 'object' ? p0.spells.slots : {};
    const slotParts = Object.keys(slots)
      .map(k => ({ lvl: Number(k), n: Number(slots[k] || 0) }))
      .filter(s => Number.isFinite(s.lvl) && s.n > 0)
      .sort((a, b) => a.lvl - b.lvl)
      .map(s => `L${s.lvl}×${s.n}`);
    const slotLine = slotParts.length ? ` Spell slots: ${slotParts.join(', ')}.` : '';
    const known = Array.isArray(p0?.spells?.known) ? p0.spells.known.filter(Boolean) : [];
    const spellLine = known.length ? ` Spells known: ${known.join(', ')}.` : '';
    return `You are ${name}, level ${level}. Wounds ${wounds}/${woundCap}, stress ${stress}/6, AC ${ac}.${slotLine}${spellLine}`;
  } catch (_err) {
    return `I can answer that, but your sheet isn't fully readable right now.`;
  }
}

// ── small utilities ─────────────────────────────────────────────────────────

function currentNode(world) {
  const id = String(world?.map?.currentNodeId ?? '');
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  return nodes.find(n => n && n.id === id) || null;
}

function firstLivingEnemyId(world) {
  const enemies = Array.isArray(world?.combat?.enemies) ? world.combat.enemies : [];
  const alive = enemies.find(e => e && e.hp > 0);
  return alive ? alive.id : null;
}

function safeAC(entity) {
  try { return computeAC(entity); } catch (_err) { return 10; }
}
function safeStatMod(score) {
  try { return statMod(score); } catch (_err) { return 0; }
}
function safeMaxWounds(level, gritMod) {
  try { return maxWounds(level, gritMod); } catch (_err) { return 6; }
}
function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

// Deterministic gibberish heuristic: a token is "wordlike" when it contains a
// vowel and has no run of 4+ consonants. Input is gibberish when it has at
// least one alphabetic token and NONE of them are wordlike.
function isGibberish(t) {
  const tokens = String(t || '').toLowerCase().match(/[a-z]+/g) || [];
  if (!tokens.length) return false; // pure punctuation/numbers — let later gates decide
  let alpha = 0;
  let wordlike = 0;
  for (const tok of tokens) {
    alpha++;
    if (isWordlike(tok)) wordlike++;
  }
  return alpha > 0 && wordlike === 0;
}

function isWordlike(tok) {
  if (tok.length <= 1) return true; // "a", "i" are words
  if (!/[aeiou]/.test(tok)) return false; // no vowel
  if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(tok)) return false; // 4+ consonant run
  return true;
}
