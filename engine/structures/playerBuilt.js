// Player construction — P-72, rung three of docs/SALVAGE_AND_BUILD.md.
// Build plans are data (like recipes/arcs). This module validates them, matches
// a player's prose to a plan, checks the stockpile, and resolves the build:
// one skill-or-tool check that gates QUALITY (never possibility), DAYS that
// always pass (the world ticks while you work), materials always consumed, and
// a persistent structure written to world.structures. Quality is provenance —
// a barrel-board lean-to is a poor lean-to, and the rest it gives says so.

import { getItemDef } from '../ruleset/core/items/index.js';
import { carriedQty, missingInputs } from '../craft/craft.js';

// ── Build plans (data) ───────────────────────────────────────────────────────
// type    → structure buildingType (and, later, place art).
// inputs  → materials consumed (defRef + stackable qty), same shape as recipes.
// days    → SOLO construction time; hired labor halves it (and costs gold).
// check   → skill + dc gating QUALITY; the named tool is worth +2.
// shelter → rest band by quality (the mechanical payoff). null = not a shelter.
const BUILD_PLANS = [
  {
    id: 'lean-to',
    name: 'Lean-To',
    type: 'lean-to',
    aliases: ['lean to', 'leanto', 'shelter', 'hovel', 'shack'],
    inputs: [{ defRef: 'board', qty: 4 }, { defRef: 'cordage', qty: 1 }],
    days: 2,
    check: { skill: 'Survival', dc: 10, tool: "carpenter's tools" },
    shelter: { poor: 'good', sound: 'long', fine: 'long' }
  },
  {
    id: 'palisade',
    name: 'Palisade',
    type: 'palisade',
    aliases: ['stockade', 'palisade wall', 'wooden wall', 'fortification'],
    inputs: [{ defRef: 'timber', qty: 6 }, { defRef: 'cordage', qty: 2 }],
    days: 5,
    check: { skill: 'Survival', dc: 12, tool: "carpenter's tools" },
    shelter: null // defense, not rest (siege deferred; burnable from day one)
  },
  // ── Stronghold tier — the endgame sink. Seasons of labor or a season of
  // cruelty (P-73). DMG anchor: a keep is ≈400 days; scaled to playable here.
  {
    id: 'watchtower',
    name: 'Watchtower',
    type: 'watchtower',
    aliases: ['watch tower', 'guard tower', 'lookout tower', 'tower'],
    inputs: [{ defRef: 'timber', qty: 12 }, { defRef: 'stone_chunk', qty: 16 }, { defRef: 'nails', qty: 4 }],
    days: 30,
    tier: 'stronghold',
    check: { skill: 'Survival', dc: 13, tool: "mason's tools" },
    shelter: { poor: 'good', sound: 'long', fine: 'long' }
  },
  {
    id: 'keep',
    name: 'Keep',
    type: 'keep',
    aliases: ['fort', 'fortress', 'stronghold', 'castle', 'hold'],
    inputs: [{ defRef: 'timber', qty: 30 }, { defRef: 'stone_chunk', qty: 50 }, { defRef: 'iron_fitting', qty: 10 }, { defRef: 'nails', qty: 12 }],
    days: 120,
    tier: 'stronghold',
    check: { skill: 'Survival', dc: 15, tool: "mason's tools" },
    shelter: { poor: 'long', sound: 'long', fine: 'long' } // any keep is walls and a bed
  }
];

const QUALITIES = ['poor', 'sound', 'fine'];
const BANDS = ['short', 'good', 'long'];

export function validateBuildPlan(p) {
  const errs = [];
  if (!p || typeof p !== 'object') return ['plan is not an object'];
  if (!/^[a-z0-9-]+$/.test(String(p.id ?? ''))) errs.push(`${p.id}: id must be kebab-case`);
  if (!p.name) errs.push(`${p.id}: name required`);
  if (!p.type) errs.push(`${p.id}: type required`);
  if (!Array.isArray(p.inputs) || !p.inputs.length) errs.push(`${p.id}: inputs required`);
  for (const inp of (p.inputs || [])) {
    if (!getItemDef(inp.defRef)) errs.push(`${p.id}: input ${inp.defRef} unknown`);
    if (!(Number(inp.qty) >= 1)) errs.push(`${p.id}: input qty >= 1`);
  }
  if (!(Number(p.days) >= 1)) errs.push(`${p.id}: days >= 1`);
  if (!p.check?.skill || !(Number(p.check?.dc) >= 1)) errs.push(`${p.id}: check.skill + dc required`);
  if (p.shelter && !QUALITIES.every(q => BANDS.includes(p.shelter[q]))) {
    errs.push(`${p.id}: shelter bands must be short|good|long for poor/sound/fine`);
  }
  return errs;
}

export function getBuildPlans() {
  return BUILD_PLANS.filter(p => validateBuildPlan(p).length === 0);
}

/** Match the player's prose to a build plan by name/alias token. */
export function matchBuildPlan(text) {
  const t = String(text || '').toLowerCase();
  for (const p of getBuildPlans()) {
    const names = [p.name.toLowerCase(), p.id, ...(p.aliases || []).map(a => String(a).toLowerCase())];
    if (names.some(n => t.includes(n))) return p;
  }
  return null;
}

// Stockpile math is identical to crafting (inputs are the same shape).
export { missingInputs as missingBuildInputs, carriedQty };

/**
 * laborPlan(plan, mode) -> { mode, days, costCopper, checkBonus }.
 * The moral fork (docs/SALVAGE_AND_BUILD.md): enough time, enough gold, or
 * enough slaves. Solo = the full days, no coin, your own hands. Hired = half the
 * days (skilled crew, min 1) at the RAW skilled-hireling rate (2gp per day of the
 * FULL job), worth +2 on the quality check. Coerced = a THIRD of the days, free,
 * unskilled (no bonus) — and an atrocity the soul pays for (priced by the caller
 * against the morality engine, not here).
 */
export function laborPlan(plan, mode) {
  const fullDays = Math.max(1, Math.floor(Number(plan.days) || 1));
  if (mode === 'hired') {
    return { mode: 'hired', days: Math.max(1, Math.ceil(fullDays / 2)), costCopper: 200 * fullDays, checkBonus: 2 };
  }
  if (mode === 'coerced') {
    return { mode: 'coerced', days: Math.max(1, Math.ceil(fullDays / 3)), costCopper: 0, checkBonus: 0 };
  }
  return { mode: 'solo', days: fullDays, costCopper: 0, checkBonus: 0 };
}

/** The build check bonus: sheet skill + 2 for the named tool + any labor bonus. */
export function buildCheckBonus(pc, plan, labor = { checkBonus: 0 }) {
  const skillName = plan.check.skill;
  const sheet = pc?.dnd;
  let bonus = sheet ? (Number(sheet.skills?.[skillName]) || 0)
    : Math.floor(((pc?.stats?.WITS ?? 10) - 10) / 2);
  let toolUsed = false;
  if (plan.check.tool) {
    const toolRe = new RegExp(plan.check.tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const toolStrings = [
      ...(pc?.inventory?.tools || []).map(String),
      ...((sheet?.equipment || []).map(String))
    ];
    if (toolStrings.some(s => toolRe.test(s))) { bonus += 2; toolUsed = true; }
  }
  bonus += Number(labor?.checkBonus) || 0;
  return { bonus, toolUsed };
}

/**
 * resolveBuild(pc, plan, roll, labor) -> { quality, restBand, total, dc, toolUsed }.
 * Poor work still raises the thing — the check gates quality, not possibility.
 */
export function resolveBuild(pc, plan, roll, labor = { checkBonus: 0 }) {
  const { bonus, toolUsed } = buildCheckBonus(pc, plan, labor);
  const total = roll + bonus;
  const dc = Number(plan.check.dc);
  const quality = total >= dc + 5 ? 'fine' : total >= dc ? 'sound' : 'poor';
  const restBand = plan.shelter ? plan.shelter[quality] : null;
  return { quality, restBand, total, dc, toolUsed };
}

/** Assemble the structure object for the buildStructure op (id minted by the op). */
export function makePlayerStructure({ plan, quality, restBand, labor, builtDay, materials, nodeId }) {
  const tags = ['player-built', ...(plan.shelter ? ['shelter'] : ['defense'])];
  return {
    kind: 'playerBuilt',
    nodeId: String(nodeId || ''),
    anchors: { kind: 'node', nodeId: String(nodeId || '') },
    topology: null,
    surfaces: {},
    tags,
    buildingType: plan.type,
    build: {
      plan: plan.id,
      quality,
      ...(restBand ? { restBand } : {}),
      labor: String(labor || 'solo'),
      builtDay: Math.max(0, Math.floor(Number(builtDay) || 0)),
      materials: (materials && typeof materials === 'object') ? materials : {}
    }
  };
}

// ── Shelter lookup (the rest gate's question: is there a roof here I raised?) ──

const BAND_RANK = { short: 1, good: 2, long: 3 };

/** The best player-built shelter standing at a node (highest rest band), or null. */
export function shelterAt(world, nodeId) {
  const id = String(nodeId || '');
  if (!id) return null;
  const byId = (world && world.structures && world.structures.byId) || {};
  let best = null;
  for (const s of Object.values(byId)) {
    if (!s || s.kind !== 'playerBuilt') continue;
    if (String(s.nodeId || '') !== id) continue;
    const band = s.build?.restBand;
    if (!band || !BAND_RANK[band]) continue;
    if (!best || BAND_RANK[band] > BAND_RANK[best.build.restBand]) best = s;
  }
  return best;
}
