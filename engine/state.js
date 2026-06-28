import { assertWorldInvariants } from './invariants.js';
import { ensureLedger } from './ledger.js';
import { ensureEnding } from './ending.js';
import { ensureInstrumentLayer } from './instrument.js';
import { ensureMap } from './map/mapState.js';
import { ensureEnv } from './env/envCore.js';
import { createCanonLog } from './csl/canonLog.js';
import { generateRegions } from './world/regions.js';
import { generateInitialMap } from './map/generateMap.js';
import { ensureStructures } from './structures/structuresState.js';
import { statMod, maxWounds } from './ruleset/core/stats.js';
import { normalizeResistances, isValidDamageType } from './combat/damageTypes.js';
import { normalizeCondition } from './combat/conditions.js';
import { normalizeTactical, defaultTactical } from './combat/tacticalMods.js';
import { ensureVillain } from './story/villain.js';

// Pass R1 — bumped from 16 → 17. Adds rumor layer: world.rumors[],
// npc.rumorIds[], npc.sophistication. See docs/RUMOR_LAYER.md.
// Overworld geometry — bumped 18 → 19. Every map node gains an integer grid
// position (node.x, node.y) via the deterministic embedding (engine/map/embedding.js).
// The compass now reads direction from coordinates instead of a hashed label, and
// old saves backfill positions on load (ensureMap). See engine/map/mapState.js.
// Free-roam overworld — bumped 19 → 20. The player gains a free tile position
// (map.pos = {x, y}) decoupled from currentNodeId: a cardinal move steps the
// avatar one cell across the grid, landing on a node's cell "arrives" there, and
// stepping into open tiles leaves currentNodeId empty (the wild). Old saves
// backfill pos to the current node's cell (ensureMap). See engine/map/mapState.js.
// Walk position persistence — bumped 20 → 21. Player position on the walkable
// place now persists in party[0].position.{nodeId, ux, uy}. Interior state
// (structureId, roomId) is stored in position.interior. Saves restore the
// player's exact location (no reset on resume). scene.interior is derived
// from position.interior, not stored separately.
// v24 — SRD character sheets. party members may carry a `dnd` block: the
// canonical 5e sheet (six abilities, class/species, AC/HP/saves/skills).
// Legacy five-stat block is DERIVED from it at chargen (see
// engine/chargen/srd/abilities.js toLegacyStats). Old saves get dnd: null.
// v27 — the Adversary (P-74a). world.villain: one deterministic villain per
// seed — identity, seat, staged agenda — minted at beginAdventure, advanced
// by worldTick (P-74b). Old saves get villain: null (minted on next begin —
// i.e., existing campaigns simply have no adversary; new ones do).
// v28 — DX-2a tactical position (D&D × XCOM). Each combat enemy carries a
// `tactical` block { cover, flanked, highGround }; the combat object carries a
// `playerTactical` block of the same shape. Cover raises effective AC (+2/+5),
// flank/high-ground confer attack advantage. Old saves backfill all-default
// (none/false/false) — no positional advantage until a fight sources it.
export const WORLD_VERSION = 28;

// Crunch caps (T1). Kept here so they're colocated with ensureEntity.
const FOCI_CAP = 6;
const SPELLS_KNOWN_CAP = 20;
const SPELL_SLOT_LEVELS = [1, 2, 3, 4, 5];

const GOAL_KINDS = new Set(['reach', 'obtain', 'talkTo', 'learn', 'defeat']);
const GOAL_STATUSES = new Set(['active', 'completed', 'failed']);
const GOALS_CAP = 12;

const RECENT_BEATS_CAP = 6;
const BEAT_INPUT_CAP = 140;
const BEAT_MECHANICS_CAP = 200;
const BEAT_OUTCOMES = new Set(['success', 'mixed', 'failure']);

export function ensureWorld(partial) {
  const w = partial && typeof partial === 'object' ? partial : {};
  const meta = w.meta && typeof w.meta === 'object' ? w.meta : {};
  const ui = w.ui && typeof w.ui === 'object' ? w.ui : {};

  const world = {
    meta: {
      campaignId: String(meta.campaignId ?? 'campaign'),
      version: WORLD_VERSION,
      seed: String(meta.seed ?? 'seed'),
      fate: clamp01(meta.fate ?? 0.2),
      motifs: ensureMotifs(meta.motifs),
      advantageTokens: ensureAdvantageTokens(meta.advantageTokens),
      aiMode: ensureAiMode(meta.aiMode),
      microClocks: ensureMicroClocks(meta.microClocks),
      // Pass H — canonical home marker. Empty string on new worlds and on
      // pre-Pass-H save loads (graceful degradation: those worlds simply
      // have no home concept). When non-empty, must reference an existing
      // settlement node — see assertWorldInvariants.
      homeNodeId: String(meta.homeNodeId ?? ''),
      // v1 game mode. '' = open sandbox (default; all engine tests). 'escape' =
      // the shippable "Escape" game: begin seeds a reach goal + objective and
      // reaching it locks a clean victory ending. Opt-in, set by the UI.
      mode: String(meta.mode ?? ''),
      // v1 Escape combat: classic-D&D hit points for the player, carried across
      // fights (attrition). 0 = uninitialized / not escape mode. Set at
      // beginAdventure when mode === 'escape'. Sandbox worlds keep these at 0,
      // so the open engine and its determinism hashes are untouched.
      escapeHp: clampIntMin(meta.escapeHp ?? 0, 0),
      escapeMaxHp: clampIntMin(meta.escapeMaxHp ?? 0, 0),
      // v1 Escape tactical cover: which piece of room cover the player is fighting
      // behind, scoped to the current fight via beganAt (so a new fight starts in
      // the open). null/absent = not in cover. Sandbox worlds never set it.
      escapeCover: ensureEscapeCover(meta.escapeCover),
      // v24 — class/species feature state for escape combat (rage, second wind,
      // breath weapon, lay on hands, relentless endurance). Per-fight fields
      // reset via beganAt scoping; layPool/relentlessUsed persist across fights
      // and replenish on shortRest. null = no feature state yet (sandbox worlds
      // and legacy characters never set it).
      escapeFeats: ensureEscapeFeats(meta.escapeFeats),
      // 1g — persisted enemy HP across combats, keyed by source NPC id, so a
      // fled/fallen foe stays wounded when re-engaged instead of re-minting at
      // full health. {} when none. Additive + defaulted (backward-compatible).
      npcCombatHp: (meta.npcCombatHp && typeof meta.npcCombatHp === 'object') ? meta.npcCombatHp : {}
    },
    ruleset: w.ruleset && typeof w.ruleset === 'object' ? w.ruleset : { id: 'core', version: 1 },
    pack: w.pack && typeof w.pack === 'object' ? w.pack : { primaryId: 'fantasy', mixerId: null },
    party: ensureParty(w.party),
    // v22 — deeds: a lightweight, capped index of moral acts for fast lookup.
    // The AUTHORITATIVE record is the canon log (added at M1); this mirror exists
    // so the rumor/NPC-memory systems and prose layer can read recent deeds cheaply.
    deeds: ensureDeeds(w.deeds),
    map: ensureMap(w.map),
    env: ensureEnv(w.env),
    scene: (() => {
      const s = w.scene && typeof w.scene === 'object' ? w.scene : {};
      let interior = ensureInteriorContext(s.interior);
      // v21 — derive interior from position if not explicitly set
      if (!interior && Array.isArray(w.party) && w.party[0]?.position?.interior) {
        const posInterior = w.party[0].position.interior;
        if (typeof posInterior === 'object' && posInterior.structureId && posInterior.roomId) {
          interior = { structureKey: posInterior.structureId, roomId: posInterior.roomId, visited: [posInterior.roomId] };
        }
      }
      return {
        location: String(s.location ?? ''),
        objective: String(s.objective ?? ''),
        time: String(s.time ?? 'start'),
        promptSeed: String(s.promptSeed ?? ''),
        tags: ensureTags(s.tags),
        thread: String(s.thread ?? ''),
        interior,
        dialogue: ensureDialogueContext(s.dialogue)
      };
    })(),
    time: ensureTime(w.time),
    ledger: ensureLedger(w.ledger),
    instrument: ensureInstrumentLayer(w.instrument),
    ending: ensureEnding(w.ending),
    clocks: w.clocks && typeof w.clocks === 'object' ? {
      dread: clampInt(w.clocks.dread ?? 0, 0, 12),
      pressure: clampInt(w.clocks.pressure ?? 0, 0, 12),
      revelation: clampInt(w.clocks.revelation ?? 0, 0, 12)
    } : { dread: 0, pressure: 0, revelation: 0 },
    combat: ensureCombat(w.combat),

    // Living system core
    factions: ensureFactions(w.factions),
    threads: ensureLivingThreads(w.threads, ensureMap(w.map)),
    scars: ensureScars(w.scars),
    ecology: ensureEcology(w.ecology),
    reputation: ensureReputation(w.reputation, ensureFactions(w.factions)),

    structures: ensureStructures(w.structures),


    regions: Array.isArray(w.regions) ? w.regions : generateRegions(String(meta.seed ?? 'seed')),

    canonLog: ensureCanonLog(w.canonLog),

    // Pass R1 — rumor layer. Capped at 64 entries.
    rumors: ensureRumors(w.rumors),

    goals: ensureGoals(w.goals),

    // v25 — story arcs (docs/STORYLINE_SPEC.md). Per-arc state only; arc
    // definitions live in content/arcs/ and load via engine/story/registry.js.
    story: ensureStory(w.story),

    // v27 — the Adversary (P-74a). null until minted; see engine/story/villain.js.
    villain: ensureVillain(w.villain),

    // Epistemic layer — claims NPCs hold about subjects (events, places, people).
    // Each entry is one NPC's belief; propagation is deterministic, zero LLM calls.
    // Old saves get [] on load; no version bump required (additive with safe default).
    claims: Array.isArray(w.claims) ? w.claims : [],

    // Things — objects with immutable true edges (territory-fragments).
    // thing.trueEdge is engine-owned and never rewritten by claims or the LLM.
    // Old saves get [] on load; no version bump required.
    things: Array.isArray(w.things) ? w.things : [],

    // The true-event substrate — the structural descent from the world seed.
    // Stored separately from world.timeline (timeline.length feeds RNG seeds in
    // resolve.js; substrate events must never enter world.timeline).
    // null until generated by generateSubstrate() in beginAdventure.
    // Old saves get null on load; generateSubstrate is idempotent so it fills in safely.
    substrate: (w.substrate && typeof w.substrate === 'object') ? w.substrate : null,

    recentBeats: ensureRecentBeats(w.recentBeats),

    timeline: Array.isArray(w.timeline) ? w.timeline : [],

    // Grace layer: conductor state for pacing and tone
    conductor: (() => {
      const c = w.conductor && typeof w.conductor === 'object' ? w.conductor : {};
      return {
        threat: {
          severity: clamp01(c.threat?.severity ?? 0.3)
        },
        discovery: {
          rate: clamp01(c.discovery?.rate ?? 0.2)
        }
      };
    })(),

    // Grace layer: conversation state for natural DM interaction
    conversation: (() => {
      const conv = w.conversation && typeof w.conversation === 'object' ? w.conversation : {};
      return {
        lastAction: conv.lastAction ? String(conv.lastAction) : null,
        lastOutcome: conv.lastOutcome ? String(conv.lastOutcome) : null,
        lastNarration: conv.lastNarration ? String(conv.lastNarration) : null,
        pendingClarification: conv.pendingClarification ? String(conv.pendingClarification) : null,
        clarificationAttempts: clampInt(conv.clarificationAttempts ?? 0, 0, 10),
        // Roll-recall: last resolved roll (H-12/13). Null on new worlds. Not
        // included in worldHash (conversation is excluded from projectForHash).
        lastRoll: (conv.lastRoll && typeof conv.lastRoll === 'object') ? {
          roll: clampInt(conv.lastRoll.roll ?? 0, 0, 100),
          dc: clampInt(conv.lastRoll.dc ?? 0, 0, 100),
          outcome: String(conv.lastRoll.outcome ?? ''),
          turn: clampInt(conv.lastRoll.turn ?? 0, 0, 999999)
        } : null
      };
    })(),

    // Travel state: a pending interactive road encounter (brigands/toll) that paused
    // a journey and is waiting for the player's choice (pay/talk/slip/fight). C.2d.
    travel: (() => {
      const t = w.travel && typeof w.travel === 'object' ? w.travel : {};
      const p = t.pending && typeof t.pending === 'object' ? t.pending : null;
      if (!p) return { pending: null };
      return {
        pending: {
          kind: String(p.kind || 'brigands'),
          foeName: String(p.foeName || 'Brigands'),
          destName: p.destName ? String(p.destName) : ''
        }
      };
    })(),

    ui: {
      advanced: Boolean(ui.advanced),
      lastError: ui.lastError ? String(ui.lastError) : ''
    }
  };

  assertWorldInvariants(world);
  return world;
}

export function newWorld({ seed, fate, campaignId, pack, mode }) {
  const packObj = (pack && typeof pack === 'object') ? pack : { primaryId: 'fantasy', mixerId: null };
  const map0 = generateInitialMap({ seed: String(seed), packId: String(packObj.primaryId || 'fantasy'), pack: {} });
  return ensureWorld({
    meta: { seed: String(seed), fate: clamp01(fate ?? 0.2), campaignId: String(campaignId ?? 'campaign'), mode: String(mode ?? ''), motifs: ensureMotifs(null), advantageTokens: ensureAdvantageTokens(null), aiMode: ensureAiMode(null), microClocks: ensureMicroClocks(null) },
    pack: packObj,
    map: map0,
    env: null,
    party: [],
    ledger: { facts: [], threats: [], questions: [] },
    instrument: ensureInstrumentLayer(null),
    ending: ensureEnding(null),
    clocks: { dread: 0, pressure: 0, revelation: 0 },
    time: ensureTime(null),

    factions: ensureFactions(null),
    threads: ensureLivingThreads(null, ensureMap(null)),
    scars: ensureScars(null),
    ecology: ensureEcology(null),
    reputation: ensureReputation(null, ensureFactions(null)),

    combat: defaultCombat(),
    rumors: [],
    goals: [],
    story: { arcs: {} },
    villain: null,
    recentBeats: [],
    timeline: [],
    ui: { advanced: false, lastError: '' }
  });
}

function ensureRecentBeats(beats) {
  const list = Array.isArray(beats) ? beats : [];
  const out = [];
  for (const b of list) {
    if (!b || typeof b !== 'object') continue;
    if (!BEAT_OUTCOMES.has(String(b.outcome))) continue;
    const tNum = Number(b.t);
    if (!Number.isFinite(tNum)) continue;
    const t = Math.max(0, Math.trunc(tNum));
    const inputRaw = String(b.input ?? '');
    const mechRaw = String(b.mechanics ?? '');
    out.push({
      t,
      input: inputRaw.length > BEAT_INPUT_CAP ? inputRaw.slice(0, BEAT_INPUT_CAP) : inputRaw,
      approach: String(b.approach ?? ''),
      stake: String(b.stake ?? ''),
      outcome: String(b.outcome),
      location: String(b.location ?? ''),
      mechanics: mechRaw.length > BEAT_MECHANICS_CAP ? mechRaw.slice(0, BEAT_MECHANICS_CAP) : mechRaw
    });
  }
  if (out.length > RECENT_BEATS_CAP) {
    return out.slice(out.length - RECENT_BEATS_CAP);
  }
  return out;
}

/**
 * appendRecentBeat(world, beat) → new world
 *
 * Pure helper. Pushes a new beat onto world.recentBeats, applies the
 * normalizer (which enforces shape, type coercion, and string caps), and
 * trims FIFO to the cap of 6. Returns a new world object — never mutates.
 *
 * Beat shape: { t, input, approach, stake, outcome, location, mechanics }
 * If the supplied beat is malformed (bad outcome, missing fields), the
 * normalizer drops it silently and the world is returned with prior beats
 * unchanged.
 */
export function appendRecentBeat(world, beat) {
  const prior = Array.isArray(world?.recentBeats) ? world.recentBeats : [];
  const next = ensureRecentBeats([...prior, beat]);
  return { ...world, recentBeats: next };
}

// ── Combat (Pass 5) ────────────────────────────────────────────────────────
// Combat encounter shape — see engine/combat/* for the resolver/lifecycle.
//
//   world.combat = {
//     active, round, turnIndex, enemies, beganAt, reason, playerGuard,
//     playerTactical: { cover, flanked, highGround }   // DX-2a
//   }
//
// Enemy: { id, name, hp, maxHp, damage, canParley, defeated, sourceNpcId,
//          tactical: { cover, flanked, highGround } }  // DX-2a
//
// playerGuard is a one-shot flag set by an endure-success during combat;
// the next enemy counter consumes it (–1 to that counter's damage).
//
// DX-2a: each enemy carries a `tactical` block { cover, flanked, highGround }
// and the combat object carries `playerTactical` of the same shape. Cover
// raises effective AC; flank/high-ground confer attack advantage. See
// engine/combat/tacticalMods.js for the engine-owned numbers.
const COMBAT_ENEMY_CAP = 6;

export function defaultCombat() {
  return { active: false, round: 0, turnIndex: 0, enemies: [], beganAt: 0, reason: '', playerGuard: false, companionGuard: false, initiativeOrder: [], playerTactical: defaultTactical() };
}

export function ensureCombat(c) {
  if (!c || typeof c !== 'object') return defaultCombat();

  const enemiesIn = Array.isArray(c.enemies) ? c.enemies : [];
  const enemies = [];
  for (const eRaw of enemiesIn) {
    if (!eRaw || typeof eRaw !== 'object') continue;
    const id = String(eRaw.id ?? '').trim();
    // Strip a leading article from combat enemy names: the escape-combat beats
    // all read "the ${name}", so a foe named "The Thorn" would double into "the
    // The Thorn". Normalizing here (the single chokepoint for every enemy) keeps
    // every "the ${name}" template correct.
    const name = String(eRaw.name ?? '').trim().replace(/^(?:the|a|an)\s+/i, '');
    if (!id || !name) continue;
    const maxHp = clampInt(eRaw.maxHp ?? 1, 1, 9999);
    const hpRaw = clampInt(eRaw.hp ?? maxHp, 0, 9999);
    const hp = Math.min(maxHp, hpRaw);
    const damage = clampInt(eRaw.damage ?? 1, 1, 9999);
    const ac = clampInt(eRaw.ac ?? 10, 0, 30);
    const cr = typeof eRaw.cr === 'number' ? Math.max(0, eRaw.cr) : 0;
    const canParley = Boolean(eRaw.canParley ?? true);
    const defeated = Boolean(eRaw.defeated ?? (hp === 0));
    const resistances = normalizeResistances(eRaw.resistances);
    const conditionImmunities = Array.isArray(eRaw.conditionImmunities)
      ? eRaw.conditionImmunities.filter(s => typeof s === 'string' && s)
      : [];
    const damageType = (typeof eRaw.damageType === 'string' && isValidDamageType(eRaw.damageType))
      ? eRaw.damageType : 'bludgeoning';
    const conditions = (Array.isArray(eRaw.conditions) ? eRaw.conditions : [])
      .map(normalizeCondition).filter(Boolean).slice(0, 12);
    // CM3: actions, multiattack, saveProficiencies
    const actions = Array.isArray(eRaw.actions) ? eRaw.actions.slice(0, 10) : [];
    const multiattack = Array.isArray(eRaw.multiattack)
      ? eRaw.multiattack.filter(s => typeof s === 'string').slice(0, 6)
      : null;
    const saveProficiencies = Array.isArray(eRaw.saveProficiencies)
      ? eRaw.saveProficiencies.filter(s => typeof s === 'string').slice(0, 5)
      : [];
    const sourceNpcId = String(eRaw.sourceNpcId ?? '');
    // CM5: lootTableRef for per-enemy loot table override.
    const lootTableRef = typeof eRaw.lootTableRef === 'string' ? eRaw.lootTableRef : null;
    // CM6: initMod — initiative modifier from bestiary or profile.
    const initMod = typeof eRaw.initMod === 'number' ? clampInt(eRaw.initMod, -10, 30) : 0;
    // CM7: legendaryActions and reactions.
    const legendaryActions = normalizeLegendaryActions(eRaw.legendaryActions);
    const reactions = normalizeReactions(eRaw.reactions);
    // CM9: lairActions and senses.
    const lairActions = normalizeLairActions(eRaw.lairActions);
    const senses = normalizeSenses(eRaw.senses);
    // DX-2a: per-enemy tactical position. Defaults to none/false/false.
    const tactical = normalizeTactical(eRaw.tactical);
    enemies.push({ id, name, hp, maxHp, damage, ac, cr, damageType, resistances, conditionImmunities, conditions, actions, multiattack, saveProficiencies, canParley, defeated, sourceNpcId, lootTableRef, initMod, legendaryActions, reactions, lairActions, senses, tactical });
    if (enemies.length >= COMBAT_ENEMY_CAP) break;
  }

  const active = Boolean(c.active);
  const round = clampInt(c.round ?? 0, 0, 99);
  const turnIndex = clampInt(c.turnIndex ?? 0, 0, COMBAT_ENEMY_CAP);
  const beganAt = clampInt(c.beganAt ?? 0, 0, 999999);
  const reasonRaw = String(c.reason ?? '');
  const reason = reasonRaw.length > 64 ? reasonRaw.slice(0, 64) : reasonRaw;
  const playerGuard = Boolean(c.playerGuard);
  const companionGuard = Boolean(c.companionGuard);
  // DX-2a: the player's tactical position (cover/flank/high-ground).
  const playerTactical = normalizeTactical(c.playerTactical);

  // CM6: initiativeOrder — array of { id, type, roll, modifier, total }.
  const initiativeOrder = (Array.isArray(c.initiativeOrder) ? c.initiativeOrder : [])
    .filter(e => e && typeof e === 'object')
    .map(e => ({
      id: String(e.id ?? ''),
      type: String(e.type ?? 'enemy'),
      roll: clampInt(e.roll ?? 0, 0, 20),
      modifier: clampInt(e.modifier ?? 0, -10, 30),
      total: clampInt(e.total ?? 0, -10, 50)
    }))
    .slice(0, 12); // cap at party + enemy cap

  return { active, round, turnIndex, enemies, beganAt, reason, playerGuard, companionGuard, initiativeOrder, playerTactical };
}

// ── CM7 — legendary actions & reactions normalizers ─────────────────────

const VALID_REACTION_TRIGGERS = new Set(['hit_by_melee', 'hit_by_ranged', 'ally_damaged']);

function normalizeLegendaryActions(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const perRound = clampInt(raw.perRound ?? 0, 0, 10);
  if (perRound === 0) return null;
  const remaining = clampInt(raw.remaining ?? perRound, 0, perRound);
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  const options = [];
  for (const o of optionsRaw) {
    if (!o || typeof o !== 'object') continue;
    const name = String(o.name ?? '').trim();
    if (!name) continue;
    const cost = clampInt(o.cost ?? 1, 1, 3);
    const action = o.action && typeof o.action === 'object' ? o.action : {};
    options.push({ name, cost, action });
    if (options.length >= 6) break;
  }
  if (options.length === 0) return null;
  return { perRound, remaining, options };
}

function normalizeReactions(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const name = String(r.name ?? '').trim();
    if (!name) continue;
    const trigger = String(r.trigger ?? '').trim();
    if (!VALID_REACTION_TRIGGERS.has(trigger)) continue;
    const effect = r.effect && typeof r.effect === 'object' ? r.effect : {};
    const uses = clampInt(r.uses ?? 1, 0, 3);
    const usesRemaining = clampInt(r.usesRemaining ?? uses, 0, uses);
    out.push({ name, trigger, effect, uses, usesRemaining });
    if (out.length >= 4) break;
  }
  return out.length > 0 ? out : null;
}

// ── CM9 — lair actions & senses normalizers ───────────────────────────────

function normalizeLairActions(raw) {
  if (!Array.isArray(raw)) return null;
  const out = [];
  for (const la of raw) {
    if (!la || typeof la !== 'object') continue;
    const name = String(la.name ?? '').trim();
    if (!name) continue;
    const action = la.action && typeof la.action === 'object' ? la.action : {};
    out.push({ name, action });
    if (out.length >= 4) break;
  }
  return out.length > 0 ? out : null;
}

function normalizeSenses(raw) {
  if (!raw || typeof raw !== 'object') return { darkvision: null, blindsight: null, tremorsense: null, truesight: null };
  return {
    darkvision: typeof raw.darkvision === 'number' ? clampInt(raw.darkvision, 0, 300) : null,
    blindsight: typeof raw.blindsight === 'number' ? clampInt(raw.blindsight, 0, 300) : null,
    tremorsense: typeof raw.tremorsense === 'number' ? clampInt(raw.tremorsense, 0, 300) : null,
    truesight: typeof raw.truesight === 'number' ? clampInt(raw.truesight, 0, 300) : null
  };
}

// ── Pass R1 — rumor normalizer ──────────────────────────────────────────
const RUMORS_CAP = 64;

function ensureRumors(rumors) {
  const list = Array.isArray(rumors) ? rumors : [];
  const out = [];
  const seenIds = new Set();
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    const id = String(r.id ?? '').trim();
    if (!id) continue;
    if (seenIds.has(id)) continue;
    const sourceSeedId = String(r.sourceSeedId ?? '').trim();
    if (!sourceSeedId) continue;
    const body = String(r.body ?? '').trim();
    if (!body) continue;
    seenIds.add(id);
    out.push({
      id,
      sourceSeedId,
      carrierNpcId: String(r.carrierNpcId ?? '').trim(),
      hopCount: clampInt(r.hopCount ?? 0, 0, 99),
      tier: clampInt(r.tier ?? 0, 0, 4),
      age: clampInt(r.age ?? 0, 0, 9999),
      mintedAt: clampInt(r.mintedAt ?? 0, 0, 999999),
      body,
      tags: Array.isArray(r.tags) ? r.tags.map(String).slice(0, 8) : []
    });
    if (out.length >= RUMORS_CAP) break;
  }
  return out;
}

// v25 — story arc state normalizer. Each entry:
// { status, castIds: {role: 'npcId@nodeId'}, stage, heardAtHours, branch }
const STORY_STATUSES = new Set(['dormant', 'cast', 'active', 'resolved', 'abandoned']);
function ensureStory(story) {
  const s = story && typeof story === 'object' ? story : {};
  const arcsIn = s.arcs && typeof s.arcs === 'object' ? s.arcs : {};
  const arcs = {};
  for (const [id, a] of Object.entries(arcsIn)) {
    if (!a || typeof a !== 'object') continue;
    if (!STORY_STATUSES.has(a.status)) continue;
    const castIds = {};
    for (const [role, ref] of Object.entries(a.castIds && typeof a.castIds === 'object' ? a.castIds : {})) {
      if (/^.+@.+$/.test(String(ref))) castIds[role] = String(ref);
    }
    arcs[id] = {
      status: a.status,
      castIds,
      stage: String(a.stage ?? ''),
      heardAtHours: clampInt(a.heardAtHours ?? -1, -1, 9999999),
      branch: String(a.branch ?? '')
    };
  }
  return { arcs };
}

function ensureGoals(goals) {
  const list = Array.isArray(goals) ? goals : [];
  const out = [];
  const seenIds = new Set();
  for (const g of list) {
    if (!g || typeof g !== 'object') continue;
    const id = String(g.id ?? '').trim();
    const kind = String(g.kind ?? '').trim();
    const targetRef = String(g.targetRef ?? '').trim();
    if (!id || !kind || !targetRef) continue;
    if (!GOAL_KINDS.has(kind)) continue;
    if (seenIds.has(id)) continue;
    const status = GOAL_STATUSES.has(String(g.status ?? '')) ? String(g.status) : 'active';
    const createdAt = Number.isFinite(Number(g.createdAt)) ? Math.max(0, Math.trunc(Number(g.createdAt))) : 0;
    const completedAtRaw = g.completedAt;
    const completedAt = (completedAtRaw == null)
      ? null
      : (Number.isFinite(Number(completedAtRaw)) ? Math.max(0, Math.trunc(Number(completedAtRaw))) : null);
    seenIds.add(id);
    out.push({
      id,
      kind,
      targetRef,
      label: String(g.label ?? ''),
      status,
      createdAt,
      completedAt
    });
    if (out.length >= GOALS_CAP) break;
  }
  return out;
}

function ensureMicroClocks(x) {
  const obj = x && typeof x === 'object' ? x : {};
  return {
    pressure: clampInt(obj.pressure ?? 0, 0, 99),
    dread: clampInt(obj.dread ?? 0, 0, 99),
    revelation: clampInt(obj.revelation ?? 0, 0, 99)
  };
}

function ensureAdvantageTokens(x) {
  const obj = x && typeof x === 'object' ? x : {};
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = String(k);
    out[key] = clampInt(v, 0, 2);
  }
  return out;
}

function ensureParty(p) {
  const arr = Array.isArray(p) ? p : [];
  return arr.map(ensureEntity).filter(Boolean);
}

function ensureEntity(e) {
  const x = e && typeof e === 'object' ? e : {};
  const stats = x.stats && typeof x.stats === 'object' ? x.stats : {};
  const inv = x.inventory && typeof x.inventory === 'object' ? x.inventory : {};

  // Pass T1 — normalize the five-stat block BEFORE wounds clamp so we can
  // derive GRIT mod → dynamic maxWounds. Old saves with no level field
  // default to level 1; with default GRIT 10, statMod(10) = 0, so
  // maxWounds(1, 0) = 6 — identical to the pre-T1 static cap.
  const statBlock = {
    MIGHT: clampInt(stats.MIGHT ?? 10, 1, 20),
    AGILITY: clampInt(stats.AGILITY ?? 10, 1, 20),
    WITS: clampInt(stats.WITS ?? 10, 1, 20),
    GRIT: clampInt(stats.GRIT ?? 10, 1, 20),
    CHARM: clampInt(stats.CHARM ?? 10, 1, 20)
  };
  const level = clampInt(x.level ?? 1, 1, 20);
  const xpVal = clampIntMin(x.xp ?? 0, 0);
  const woundCap = maxWounds(level, statMod(statBlock.GRIT));

  return {
    id: String(x.id || 'party'),
    name: String(x.name || 'Adventurer'),
    archetype: String(x.archetype || x.background?.name || 'Unknown'),
    vibe: String(x.vibe || x.traits?.vibe || 'grim'),
    stress: clampInt(x.stress ?? 0, 0, 6),
    wounds: clampInt(x.wounds ?? 0, 0, woundCap),

    // Pass T1 — crunch progression fields.
    level,
    xp: xpVal,
    foci: ensureFoci(x.foci),
    purse: ensurePurse(x.purse),

    stats: statBlock,
    inventory: {
      weapons: Array.isArray(inv.weapons) ? inv.weapons : [],
      armor: Array.isArray(inv.armor) ? inv.armor : [],
      tools: Array.isArray(inv.tools) ? inv.tools : [],
      clothes: Array.isArray(inv.clothes) ? inv.clothes : [],
      spells: Array.isArray(inv.spells) ? inv.spells : [],
      tech: Array.isArray(inv.tech) ? inv.tech : [],
      oddities: Array.isArray(inv.oddities) ? inv.oddities : [],
      consumables: Array.isArray(inv.consumables) ? inv.consumables : [],
      junk: Array.isArray(inv.junk) ? inv.junk : [],
      // Pass T1 — new unified item array. Existing string-array categories
      // stay in place untouched; T2 will migrate them into `items`.
      items: ensureInventoryItems(inv.items)
    },
    spells: ensureSpells(x.spells),
    traits: x.traits && typeof x.traits === 'object'
      ? x.traits
      : { vibe: '', fear: '', flaw: '', ideal: '', detail: '', keepsake: '', lineYouWontCross: '', rumor: '' },
    background: x.background && typeof x.background === 'object' ? x.background : { name: '', tags: [], hook: '' },
    signature: x.signature && typeof x.signature === 'object' ? x.signature : { itemName: '', meaning: '' },

    position: ensurePosition(x.position),

    // Pass C1 — companion marker. null for the player (party[0]) and for any
    // entity that has not been recruited as a traveling companion. A well-formed
    // marker carries enough provenance to render in the UI and the narrator
    // context without re-deriving from the source NPC (which may have been
    // removed from its settlement after recruit).
    companion: ensureCompanionMarker(x.companion),

    // v22 — morality (the Dark Path). First-class, replayable state. See
    // docs/MORALITY_SYSTEM.md. corruption/virtue are two independent axes (not a
    // slider): you can be feared and respected, or neither. heat is hidden
    // investigation pressure (crime & detection). patrons maps a divine-patron id
    // to standing. locked = the final line crossed (light path closed). All
    // mutated only through effectsCore deltas; detection/consequences land in later
    // milestones — M0 is just the safe, defaulted shape.
    morality: ensureMorality(x.morality),

    // v26 — conditions on party members (poisoned, restrained…), same shape
    // as enemy conditions. Lets consumables/antidotes and enemy poison apply
    // to the player. Old saves default to none.
    conditions: (Array.isArray(x.conditions) ? x.conditions : [])
      .map(c => normalizeCondition(c))
      .filter(Boolean)
      .slice(0, 8),

    // v24 — canonical SRD 5e sheet (or null for pre-v24 characters). Preserved
    // verbatim: it is produced fully-formed by createCharacter5e and never
    // partially mutated, so no per-field normalization here.
    dnd: x.dnd && typeof x.dnd === 'object' ? x.dnd : null,

    // Experiential marks — one-way flags set by engine events (vision:root, etc.).
    // Append-only via setPartyMark delta; never cleared. Old saves default to [].
    marks: Array.isArray(x.marks) ? x.marks.filter(m => typeof m === 'string') : [],
  };
}

// v22/v23 — morality state. Safe defaults so old saves upgrade to a neutral slate.
// v23 adds `axes`: the seven sin poles + seven contrary-virtue poles, each 0..100,
// that ACCUMULATE independently (a soldier is heavy on wrath AND patience — they never
// net). corruption/virtue are DERIVED summaries (v1 collapse = max of the poles;
// tunable) kept as cached fields so the existing gates and the M0 deltas keep working.
export const VICE_AXES = ['pride', 'greed', 'wrath', 'envy', 'lust', 'gluttony', 'sloth'];
export const VIRTUE_AXES = ['humility', 'charity', 'patience', 'kindness', 'chastity', 'temperance', 'diligence'];

function ensureAxes(a) {
  const x = a && typeof a === 'object' ? a : {};
  const out = {};
  for (const k of VICE_AXES) out[k] = clampInt(x[k] ?? 0, 0, 100);
  for (const k of VIRTUE_AXES) out[k] = clampInt(x[k] ?? 0, 0, 100);
  return out;
}

// v1 collapse of the fourteen accumulators into the two summary scalars: the dominant
// pole defines you (a man of one great sin is corrupt; a saint of one great virtue is
// good). Breadth-weighting is a future knob. Pure + deterministic.
export function deriveCorruption(axes) {
  const a = ensureAxes(axes);
  return clampInt(Math.max(0, ...VICE_AXES.map(k => a[k])), 0, 100);
}
export function deriveVirtue(axes) {
  const a = ensureAxes(axes);
  return clampInt(Math.max(0, ...VIRTUE_AXES.map(k => a[k])), 0, 100);
}

function ensureMorality(m) {
  const x = m && typeof m === 'object' ? m : {};
  const patrons = {};
  if (x.patrons && typeof x.patrons === 'object') {
    for (const [k, v] of Object.entries(x.patrons)) {
      const n = Number(v);
      if (Number.isFinite(n)) patrons[String(k)] = clampInt(n, -100, 100);
    }
  }
  const axes = ensureAxes(x.axes);
  // If axes carry any signal, the summaries derive from them (v23 source of truth).
  // If they're all zero (a fresh world, or a v22 save with stored scalars and no axes),
  // keep the stored corruption/virtue so no data is lost on upgrade.
  const axesActive = VICE_AXES.concat(VIRTUE_AXES).some(k => axes[k] > 0);
  return {
    corruption: axesActive ? deriveCorruption(axes) : clampInt(x.corruption ?? 0, 0, 100),
    virtue: axesActive ? deriveVirtue(axes) : clampInt(x.virtue ?? 0, 0, 100),
    heat: clampIntMin(x.heat ?? 0, 0),
    locked: Boolean(x.locked ?? false),
    patrons,
    axes,
    lastDeedT: clampIntMin(x.lastDeedT ?? 0, 0)
  };
}

// v22 — deeds index. Each entry: { t, actorId, kind, severity, witnesses[], nodeId,
// summary }. Capped (recency window); the canon log holds the full history. Kept
// minimal and defensively normalized so malformed/old saves can't violate invariants.
const DEEDS_CAP = 64;
const DEED_KINDS = new Set(['cruelty', 'forbidden', 'mercy', 'aid', 'atonement']);
function ensureDeeds(d) {
  const arr = Array.isArray(d) ? d : [];
  const out = [];
  for (const e of arr) {
    if (!e || typeof e !== 'object') continue;
    const kind = String(e.kind || '');
    if (!DEED_KINDS.has(kind)) continue;
    out.push({
      t: clampIntMin(e.t ?? 0, 0),
      actorId: String(e.actorId || 'party'),
      kind,
      severity: clampInt(e.severity ?? 1, 0, 100),
      witnesses: Array.isArray(e.witnesses) ? e.witnesses.map(String) : [],
      nodeId: String(e.nodeId || ''),
      summary: String(e.summary || '').slice(0, 200)
    });
  }
  return out.slice(-DEEDS_CAP);
}

// ── Position v21 — normalized with place coordinates + optional interior ───

function ensurePosition(pos) {
  const p = pos && typeof pos === 'object' ? pos : {};
  const zone = String(p.zone ?? 'far');
  if (zone !== 'far' && zone !== 'near' && zone !== 'engaged') {
    return { zone: 'far' };
  }
  const result = { zone };
  if (typeof p.nodeId === 'string' && p.nodeId.trim()) {
    result.nodeId = String(p.nodeId).trim();
  }
  const ux = Number(p.ux);
  if (Number.isFinite(ux)) result.ux = ux;
  const uy = Number(p.uy);
  if (Number.isFinite(uy)) result.uy = uy;
  // v20 local foot movement coordinates (preserved for backward compat)
  const localFtX = Number(p.localFtX);
  if (Number.isFinite(localFtX)) result.localFtX = localFtX;
  const localFtY = Number(p.localFtY);
  if (Number.isFinite(localFtY)) result.localFtY = localFtY;
  if (p.interior && typeof p.interior === 'object') {
    const interior = {};
    if (typeof p.interior.structureId === 'string' && p.interior.structureId.trim()) {
      interior.structureId = String(p.interior.structureId).trim();
    }
    if (typeof p.interior.roomId === 'string' && p.interior.roomId.trim()) {
      interior.roomId = String(p.interior.roomId).trim();
    }
    if (Object.keys(interior).length > 0) {
      result.interior = interior;
    }
  }
  return result;
}

// ── Pass T1 crunch helpers ───────────────────────────────────────────────

function ensureFoci(foci) {
  const arr = Array.isArray(foci) ? foci : [];
  const out = [];
  const seen = new Set();
  for (const f of arr) {
    const s = String(f ?? '').trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= FOCI_CAP) break;
  }
  return out;
}

function ensurePurse(p) {
  const obj = p && typeof p === 'object' ? p : {};
  return {
    copper: clampIntMin(obj.copper ?? 0, 0),
    silver: clampIntMin(obj.silver ?? 0, 0),
    gold: clampIntMin(obj.gold ?? 0, 0),
    platinum: clampIntMin(obj.platinum ?? 0, 0)
  };
}

function ensureInventoryItems(items) {
  const arr = Array.isArray(items) ? items : [];
  const out = [];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const id = String(it.id ?? '').trim();
    const defRef = String(it.defRef ?? '').trim();
    if (!id || !defRef) continue;
    let equipped = null;
    if (it.equipped != null) {
      const s = String(it.equipped).trim();
      if (s) equipped = s;
    }
    // v26 — optional stack count (materials, ammo). Absent means 1.
    const qty = Math.trunc(Number(it.qty));
    const base = qty > 1 ? { id, defRef, equipped, qty } : { id, defRef, equipped };
    // P-77 — optional identity fields, kept only when set (old saves carry
    // neither, so existing worlds' shape and hash are untouched): `sealedRef`
    // is the true def of an unidentified drop; `attuned` marks the bond.
    const sealedRef = String(it.sealedRef ?? '').trim();
    if (sealedRef) base.sealedRef = sealedRef;
    if (it.attuned === true) base.attuned = true;
    out.push(base);
  }
  return out;
}

function ensureSpells(s) {
  const obj = s && typeof s === 'object' ? s : {};
  const knownRaw = Array.isArray(obj.known) ? obj.known : [];
  const known = [];
  const seen = new Set();
  for (const k of knownRaw) {
    const str = String(k ?? '').trim();
    if (!str) continue;
    if (seen.has(str)) continue;
    seen.add(str);
    known.push(str);
    if (known.length >= SPELLS_KNOWN_CAP) break;
  }
  const slotsIn = obj.slots && typeof obj.slots === 'object' ? obj.slots : {};
  const maxSlotsIn = obj.maxSlots && typeof obj.maxSlots === 'object' ? obj.maxSlots : {};
  const maxSlots = {};
  const slots = {};
  for (const lvl of SPELL_SLOT_LEVELS) {
    const max = clampIntMin(maxSlotsIn[lvl] ?? 0, 0);
    maxSlots[lvl] = max;
    const cur = clampIntMin(slotsIn[lvl] ?? 0, 0);
    slots[lvl] = Math.min(cur, max);
  }
  let concentration = null;
  if (obj.concentration && typeof obj.concentration === 'object') {
    const spellRef = String(obj.concentration.spellRef ?? '').trim();
    if (spellRef) {
      const startedAtRaw = Number(obj.concentration.startedAt);
      const startedAt = Number.isFinite(startedAtRaw) ? Math.max(0, Math.trunc(startedAtRaw)) : 0;
      concentration = { spellRef, startedAt };
    }
  }
  return { known, slots, maxSlots, concentration };
}

function ensureCompanionMarker(c) {
  if (!c || typeof c !== 'object') return null;
  const sourceNpcId = String(c.sourceNpcId ?? '').trim();
  if (!sourceNpcId) return null;
  const recruitedAtTurnRaw = Number(c.recruitedAtTurn);
  if (!Number.isFinite(recruitedAtTurnRaw)) return null;
  const recruitedAtTurn = Math.max(0, Math.trunc(recruitedAtTurnRaw));
  const trustLevelRaw = Number(c.trustLevel);
  const trustLevel = Number.isFinite(trustLevelRaw)
    ? Math.max(0, Math.min(10, Math.trunc(trustLevelRaw)))
    : 5;
  const role = String(c.role ?? '').trim();
  return { sourceNpcId, recruitedAtTurn, trustLevel, role };
}

function ensureAiMode(x) {
  const s = String(x ?? 'off');
  return (s === 'off' || s === 'advisory' || s === 'conductor') ? s : 'off';
}

function ensureFactions(factions) {
  const list = Array.isArray(factions) ? factions : [];
  if (list.length) {
    return list.map(f => ({
      id: String(f.id || ''),
      goal: String(f.goal || ''),
      pressure: clampInt(f.pressure ?? 0, 0, 100),
      assets: Array.isArray(f.assets) ? f.assets.map(String).slice(0, 8) : [],
      hostility: clampInt(f.hostility ?? 0, 0, 100),
      lastMove: String(f.lastMove || '')
    })).filter(f => f.id);
  }
  // Minimal defaults so worldTick has something to move.
  return [
    { id: 'civic', goal: 'Maintain order', pressure: 10, assets: ['permits', 'guards'], hostility: 10, lastMove: '' },
    { id: 'shadow', goal: 'Exploit instability', pressure: 10, assets: ['informants', 'bribes'], hostility: 15, lastMove: '' }
  ];
}

function ensureLivingThreads(threads, map) {
  const list = Array.isArray(threads) ? threads : [];
  const m = map && typeof map === 'object' ? map : null;
  const fallbackNodeId = m?.currentNodeId ? String(m.currentNodeId) : '';

  return list.map(t => ({
    id: String(t.id || ''),
    objective: String(t.objective || ''),
    tension: clampInt(t.tension ?? 0, 0, 6),
    trajectory: String(t.trajectory || 'static'),
    factionId: String(t.factionId || ''),
    nodeId: String(t.nodeId || fallbackNodeId || ''),
    active: Boolean(t.active ?? true),
    age: clampInt(t.age ?? 0, 0, 999)
  })).filter(t => t.id && t.objective);
}

function ensureScars(scars) {
  const list = Array.isArray(scars) ? scars : [];
  return list.map(s => ({
    id: String(s.id || ''),
    description: String(s.description || ''),
    permanent: true
  })).filter(s => s.id && s.description);
}

function ensureEcology(e) {
  const x = e && typeof e === 'object' ? e : {};
  return {
    corruption: clampInt(x.corruption ?? 0, 0, 100),
    instability: clampInt(x.instability ?? 0, 0, 100),
    scarcity: clampInt(x.scarcity ?? 0, 0, 100)
  };
}

function ensureReputation(rep, factions) {
  const r = rep && typeof rep === 'object' ? rep : {};
  const f = r.factions && typeof r.factions === 'object' ? r.factions : {};
  const out = {};
  for (const fac of (Array.isArray(factions) ? factions : [])) {
    out[fac.id] = clampInt(f[fac.id] ?? 0, -100, 100);
  }
  return { factions: out };
}

function ensureTime(t) {
  const x = t && typeof t === 'object' ? t : {};
  return {
    turn: clampInt(x.turn ?? 0, 0, 999999),
    scene: clampInt(x.scene ?? 0, 0, 999999),
    // Travel accounting (Stage C.2): cumulative in-world hours elapsed and
    // distance covered in leagues. Advanced by journeys; surfaced in DM language.
    hours: clampInt(x.hours ?? 0, 0, 9999999),
    leagues: clampInt(x.leagues ?? 0, 0, 9999999)
  };
}

function ensureMotifs(m) {
  const x = m && typeof m === 'object' ? m : {};
  return {
    recent: ensureStringArray(x.recent, 8),
    pinned: ensureStringArray(x.pinned, 8)
  };
}

function ensureTags(tags) {
  return ensureStringArray(tags, 8);
}

function ensureStringArray(x, cap) {
  const arr = Array.isArray(x) ? x.map(String).map(s => s.trim()).filter(Boolean) : [];
  const out = [];
  const seen = new Set();
  for (const s of arr) {
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

function ensureCanonLog(log) {
  if (!log || typeof log !== 'object') {
    return createCanonLog();
  }
  if (!Array.isArray(log.events)) {
    return createCanonLog();
  }
  return { events: [...log.events] };
}

function ensureDialogueContext(x) {
  if (!x || typeof x !== 'object') return null;
  const npcId = String(x.npcId ?? '').trim();
  if (!npcId) return null;
  const startedAt = Number.isFinite(Number(x.startedAt)) ? Math.max(0, Math.trunc(Number(x.startedAt))) : 0;
  const turnsInDialogue = Number.isFinite(Number(x.turnsInDialogue)) ? Math.max(0, Math.trunc(Number(x.turnsInDialogue))) : 0;
  const rawTopics = Array.isArray(x.topicsOffered) ? x.topicsOffered.map(String) : [];
  const topicsOffered = [];
  const seen = new Set();
  for (const t of rawTopics) {
    const s = t.trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    topicsOffered.push(s);
    if (topicsOffered.length >= 20) break;
  }
  let lastAnswer = null;
  if (x.lastAnswer && typeof x.lastAnswer === 'object') {
    const mode = String(x.lastAnswer.mode ?? '');
    const validModes = new Set(['shared', 'withheld', 'lied', 'deflected']);
    if (validModes.has(mode)) {
      lastAnswer = {
        factId: x.lastAnswer.factId ? String(x.lastAnswer.factId) : null,
        mode,
        trustAtTime: Number.isFinite(Number(x.lastAnswer.trustAtTime))
          ? Math.trunc(Number(x.lastAnswer.trustAtTime))
          : 0
      };
    }
  }
  return { npcId, startedAt, turnsInDialogue, topicsOffered, lastAnswer };
}

function ensureInteriorContext(x) {
  if (!x || typeof x !== 'object') return null;
  const structureKey = String(x.structureKey ?? '').trim();
  const roomId = String(x.roomId ?? '').trim();
  if (!structureKey || !roomId) return null;
  // `visited` is the set of rooms the player has actually walked into, in
  // first-seen order. The map draws itself room-by-room from this — the floor
  // plan is revealed as you explore, the way a real dungeon map gets sketched.
  // Always dedup and guarantee the current room is in it.
  const seen = new Set();
  const visited = [];
  const push = (v) => { const s = String(v ?? '').trim(); if (s && !seen.has(s)) { seen.add(s); visited.push(s); } };
  if (Array.isArray(x.visited)) for (const v of x.visited) push(v);
  push(roomId);
  return { structureKey, roomId, visited };
}

function ensureEscapeCover(x) {
  if (!x || typeof x !== 'object') return null;
  if (!x.active) return null;
  return {
    active: true,
    bonus: clampIntMin(x.bonus ?? 0, 0),
    label: String(x.label ?? ''),
    tier: String(x.tier ?? ''),
    beganAt: clampIntMin(x.beganAt ?? 0, 0)
  };
}

// v24 — escape-combat feature state. layPool uses -1 as "uninitialized" so the
// paladin's pool can be seeded lazily (5 × level) on first use.
function ensureEscapeFeats(x) {
  if (!x || typeof x !== 'object') return null;
  return {
    beganAt: clampIntMin(x.beganAt ?? 0, 0),
    rageActive: Boolean(x.rageActive),
    secondWindUsed: Boolean(x.secondWindUsed),
    breathUsed: Boolean(x.breathUsed),
    actionSurgeUsed: Boolean(x.actionSurgeUsed),
    layPool: Number.isFinite(Number(x.layPool)) ? Math.max(-1, Math.trunc(Number(x.layPool))) : -1,
    relentlessUsed: Boolean(x.relentlessUsed),
    // Slot-spell battle state (per fight, beganAt-scoped like the rest):
    // bless adds +1d4 to the player's attack rolls; armor of agathys grants
    // temp HP and freezes melee attackers while it holds.
    blessActive: Boolean(x.blessActive),
    tempHp: clampIntMin(x.tempHp ?? 0, 0),
    agathysActive: Boolean(x.agathysActive)
  };
}

// ensureInstrument moved to engine/instrument.js (ensureInstrumentLayer)

function clamp01(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
function clampInt(v, lo, hi) {
  const x = Math.trunc(Number(v));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
function clampIntMin(v, lo) {
  const x = Math.trunc(Number(v));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, x);
}
