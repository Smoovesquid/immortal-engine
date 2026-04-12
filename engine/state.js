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

// Pass R1 — bumped from 16 → 17. Adds rumor layer: world.rumors[],
// npc.rumorIds[], npc.sophistication. See docs/RUMOR_LAYER.md.
export const WORLD_VERSION = 17;

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
      homeNodeId: String(meta.homeNodeId ?? '')
    },
    ruleset: w.ruleset && typeof w.ruleset === 'object' ? w.ruleset : { id: 'core', version: 1 },
    pack: w.pack && typeof w.pack === 'object' ? w.pack : { primaryId: 'fantasy', mixerId: null },
    party: ensureParty(w.party),
    map: ensureMap(w.map),
    env: ensureEnv(w.env),
    scene: w.scene && typeof w.scene === 'object' ? {
      location: String(w.scene.location ?? ''),
      objective: String(w.scene.objective ?? ''),
      time: String(w.scene.time ?? 'start'),
      promptSeed: String(w.scene.promptSeed ?? ''),
      tags: ensureTags(w.scene.tags),
      thread: String(w.scene.thread ?? ''),
      interior: ensureInteriorContext(w.scene.interior),
      dialogue: ensureDialogueContext(w.scene.dialogue)
    } : { location: '', objective: '', time: 'start', promptSeed: '', tags: [], thread: '', interior: null, dialogue: null },
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

    recentBeats: ensureRecentBeats(w.recentBeats),

    timeline: Array.isArray(w.timeline) ? w.timeline : [],
    ui: {
      advanced: Boolean(ui.advanced),
      lastError: ui.lastError ? String(ui.lastError) : ''
    }
  };

  assertWorldInvariants(world);
  return world;
}

export function newWorld({ seed, fate, campaignId, pack }) {
  const packObj = (pack && typeof pack === 'object') ? pack : { primaryId: 'fantasy', mixerId: null };
  const map0 = generateInitialMap({ seed: String(seed), packId: String(packObj.primaryId || 'fantasy'), pack: {} });
  return ensureWorld({
    meta: { seed: String(seed), fate: clamp01(fate ?? 0.2), campaignId: String(campaignId ?? 'campaign'), motifs: ensureMotifs(null), advantageTokens: ensureAdvantageTokens(null), aiMode: ensureAiMode(null), microClocks: ensureMicroClocks(null) },
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
//     active, round, turnIndex, enemies, beganAt, reason, playerGuard
//   }
//
// Enemy: { id, name, hp, maxHp, damage, canParley, defeated, sourceNpcId }
//
// playerGuard is a one-shot flag set by an endure-success during combat;
// the next enemy counter consumes it (–1 to that counter's damage).
const COMBAT_ENEMY_CAP = 6;

export function defaultCombat() {
  return { active: false, round: 0, turnIndex: 0, enemies: [], beganAt: 0, reason: '', playerGuard: false, companionGuard: false };
}

export function ensureCombat(c) {
  if (!c || typeof c !== 'object') return defaultCombat();

  const enemiesIn = Array.isArray(c.enemies) ? c.enemies : [];
  const enemies = [];
  for (const eRaw of enemiesIn) {
    if (!eRaw || typeof eRaw !== 'object') continue;
    const id = String(eRaw.id ?? '').trim();
    const name = String(eRaw.name ?? '').trim();
    if (!id || !name) continue;
    const maxHp = clampInt(eRaw.maxHp ?? 1, 1, 20);
    const hpRaw = clampInt(eRaw.hp ?? maxHp, 0, 20);
    const hp = Math.min(maxHp, hpRaw);
    const damage = clampInt(eRaw.damage ?? 1, 1, 6);
    const canParley = Boolean(eRaw.canParley ?? true);
    const defeated = Boolean(eRaw.defeated ?? (hp === 0));
    const sourceNpcId = String(eRaw.sourceNpcId ?? '');
    enemies.push({ id, name, hp, maxHp, damage, canParley, defeated, sourceNpcId });
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

  return { active, round, turnIndex, enemies, beganAt, reason, playerGuard, companionGuard };
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

    position: x.position && typeof x.position === 'object' ? x.position : { zone: 'far' },

    // Pass C1 — companion marker. null for the player (party[0]) and for any
    // entity that has not been recruited as a traveling companion. A well-formed
    // marker carries enough provenance to render in the UI and the narrator
    // context without re-deriving from the source NPC (which may have been
    // removed from its settlement after recruit).
    companion: ensureCompanionMarker(x.companion)
  };
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
    out.push({ id, defRef, equipped });
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
    scene: clampInt(x.scene ?? 0, 0, 999999)
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
  return { structureKey, roomId };
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
