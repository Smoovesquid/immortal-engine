import { assertWorldInvariants } from './invariants.js';
import { ensureLedger } from './ledger.js';
import { ensureEnding } from './ending.js';
import { ensureInstrumentLayer } from './instrument.js';
import { ensureMap } from './map/mapState.js';
import { ensureEnv } from './env/envCore.js';

export const WORLD_VERSION = 8;

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
      aiMode: ensureAiMode(meta.aiMode)
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
      thread: String(w.scene.thread ?? '')
    } : { location: '', objective: '', time: 'start', promptSeed: '', tags: [], thread: '' },
    time: ensureTime(w.time),
    ledger: ensureLedger(w.ledger),
    instrument: ensureInstrumentLayer(w.instrument),
    ending: ensureEnding(w.ending),
    clocks: w.clocks && typeof w.clocks === 'object' ? {
      dread: clampInt(w.clocks.dread ?? 0, 0, 12),
      pressure: clampInt(w.clocks.pressure ?? 0, 0, 12),
      revelation: clampInt(w.clocks.revelation ?? 0, 0, 12)
    } : { dread: 0, pressure: 0, revelation: 0 },
    combat: w.combat && typeof w.combat === 'object' ? {
      active: Boolean(w.combat.active),
      initiatives: w.combat.initiatives ?? {},
      turnOrder: Array.isArray(w.combat.turnOrder) ? w.combat.turnOrder : [],
      turnIndex: clampInt(w.combat.turnIndex ?? 0, 0, 999)
    } : { active: false, initiatives: {}, turnOrder: [], turnIndex: 0 },

    // Living system core
    factions: ensureFactions(w.factions),
    threads: ensureLivingThreads(w.threads, ensureMap(w.map)),
    scars: ensureScars(w.scars),
    ecology: ensureEcology(w.ecology),
    reputation: ensureReputation(w.reputation, ensureFactions(w.factions)),

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
  return ensureWorld({
    meta: { seed: String(seed), fate: clamp01(fate ?? 0.2), campaignId: String(campaignId ?? 'campaign'), motifs: ensureMotifs(null), advantageTokens: ensureAdvantageTokens(null), aiMode: ensureAiMode(null) },
    pack,
    map: null,
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

    combat: { active: false, initiatives: {}, turnOrder: [], turnIndex: 0 },
    timeline: [],
    ui: { advanced: false, lastError: '' }
  });
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

  return {
    id: String(x.id || 'party'),
    name: String(x.name || 'Adventurer'),
    archetype: String(x.archetype || x.background?.name || 'Unknown'),
    vibe: String(x.vibe || x.traits?.vibe || 'grim'),
    stress: clampInt(x.stress ?? 0, 0, 6),
    wounds: clampInt(x.wounds ?? 0, 0, 6),

    stats: {
      MIGHT: clampInt(stats.MIGHT ?? 10, 1, 20),
      AGILITY: clampInt(stats.AGILITY ?? 10, 1, 20),
      WITS: clampInt(stats.WITS ?? 10, 1, 20),
      GRIT: clampInt(stats.GRIT ?? 10, 1, 20),
      CHARM: clampInt(stats.CHARM ?? 10, 1, 20)
    },
    inventory: {
      weapons: Array.isArray(inv.weapons) ? inv.weapons : [],
      armor: Array.isArray(inv.armor) ? inv.armor : [],
      tools: Array.isArray(inv.tools) ? inv.tools : [],
      clothes: Array.isArray(inv.clothes) ? inv.clothes : [],
      spells: Array.isArray(inv.spells) ? inv.spells : [],
      tech: Array.isArray(inv.tech) ? inv.tech : [],
      oddities: Array.isArray(inv.oddities) ? inv.oddities : [],
      consumables: Array.isArray(inv.consumables) ? inv.consumables : [],
      junk: Array.isArray(inv.junk) ? inv.junk : []
    },
    traits: x.traits && typeof x.traits === 'object'
      ? x.traits
      : { vibe: '', fear: '', flaw: '', ideal: '', detail: '', keepsake: '', lineYouWontCross: '', rumor: '' },
    background: x.background && typeof x.background === 'object' ? x.background : { name: '', tags: [], hook: '' },
    signature: x.signature && typeof x.signature === 'object' ? x.signature : { itemName: '', meaning: '' },

    position: x.position && typeof x.position === 'object' ? x.position : { zone: 'far' }
  };
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
