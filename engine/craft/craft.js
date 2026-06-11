// Field crafting — P-71, rung two of docs/SALVAGE_AND_BUILD.md.
// Recipes are data files (content/recipes/); this module validates them,
// matches a player's prose to a recipe, checks materials, and resolves the
// craft: one skill-or-tool check that gates QUALITY (never possibility),
// time that always passes, materials that are always consumed.

import fieldRecipes from '../../content/recipes/field_recipes.recipe.js';
import { getItemDef } from '../ruleset/core/items/index.js';

const BUILTIN = [...fieldRecipes];

export function validateRecipe(r) {
  const errs = [];
  if (!r || typeof r !== 'object') return ['recipe is not an object'];
  if (!/^[a-z0-9-]+$/.test(String(r.id ?? ''))) errs.push(`${r.id}: id must be kebab-case`);
  if (!r.name) errs.push(`${r.id}: name required`);
  if (!getItemDef(r.output?.defRef)) errs.push(`${r.id}: output defRef unknown`);
  if (!(Number(r.output?.qty) >= 1)) errs.push(`${r.id}: output qty >= 1`);
  if (!Array.isArray(r.inputs) || !r.inputs.length) errs.push(`${r.id}: inputs required`);
  for (const inp of (r.inputs || [])) {
    if (!getItemDef(inp.defRef)) errs.push(`${r.id}: input ${inp.defRef} unknown`);
    if (!(Number(inp.qty) >= 1)) errs.push(`${r.id}: input qty >= 1`);
  }
  if (!(Number(r.hours) >= 0)) errs.push(`${r.id}: hours >= 0`);
  if (!r.check?.skill || !(Number(r.check?.dc) >= 1)) errs.push(`${r.id}: check.skill + dc required`);
  return errs;
}

export function getRecipes() {
  return BUILTIN.filter(r => validateRecipe(r).length === 0);
}

/** Match the player's prose to a recipe by name/alias token. */
export function matchRecipe(text) {
  const t = String(text || '').toLowerCase();
  for (const r of getRecipes()) {
    const names = [r.name.toLowerCase(), ...(r.aliases || []).map(a => String(a).toLowerCase())];
    if (names.some(n => t.includes(n))) return r;
  }
  return null;
}

/** What the pack holds of a defRef across stacks. */
export function carriedQty(pc, defRef) {
  return (pc?.inventory?.items || [])
    .filter(it => it.defRef === defRef && !it.equipped)
    .reduce((s, it) => s + Math.max(1, Number(it.qty) || 1), 0);
}

/** Missing inputs for a recipe: [{defRef, name, need, have}] (empty = craftable). */
export function missingInputs(pc, recipe) {
  const out = [];
  for (const inp of recipe.inputs) {
    const have = carriedQty(pc, inp.defRef);
    if (have < inp.qty) {
      out.push({ defRef: inp.defRef, name: getItemDef(inp.defRef)?.name || inp.defRef, need: inp.qty, have });
    }
  }
  return out;
}

/** The craft check bonus: sheet skill + 2 for carrying the named tool. */
export function craftBonus(pc, recipe) {
  const skillName = recipe.check.skill;
  const sheet = pc?.dnd;
  let bonus = sheet ? (Number(sheet.skills?.[skillName]) || 0)
    : Math.floor(((pc?.stats?.WITS ?? 10) - 10) / 2);
  let toolUsed = false;
  if (recipe.check.tool) {
    const toolRe = new RegExp(recipe.check.tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const toolStrings = [
      ...(pc?.inventory?.tools || []).map(String),
      ...((sheet?.equipment || []).map(String))
    ];
    if (toolStrings.some(s => toolRe.test(s))) { bonus += 2; toolUsed = true; }
  }
  return { bonus, toolUsed };
}

/**
 * resolveCraft(pc, recipe, roll) -> { quality, qty, total }
 * quality: 'poor' (< dc) | 'sound' (>= dc) | 'fine' (>= dc+5).
 * Poor work still produces — the check gates quality, not possibility.
 */
export function resolveCraft(pc, recipe, roll) {
  const { bonus, toolUsed } = craftBonus(pc, recipe);
  const total = roll + bonus;
  const dc = Number(recipe.check.dc);
  const quality = total >= dc + 5 ? 'fine' : total >= dc ? 'sound' : 'poor';
  const qty = quality === 'fine' ? Number(recipe.output.fineQty ?? recipe.output.qty) : Number(recipe.output.qty);
  return { quality, qty, total, dc, toolUsed };
}
