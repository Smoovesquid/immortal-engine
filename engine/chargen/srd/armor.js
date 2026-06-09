// SRD 5.1 — armor and AC rules.

export const ARMOR = {
  // Light — AC = base + DEX mod
  'padded': { category: 'light', base: 11, dexCap: null, stealthDisadvantage: true },
  'leather armor': { category: 'light', base: 11, dexCap: null },
  'studded leather': { category: 'light', base: 12, dexCap: null },
  // Medium — AC = base + DEX mod (max 2)
  'hide armor': { category: 'medium', base: 12, dexCap: 2 },
  'chain shirt': { category: 'medium', base: 13, dexCap: 2 },
  'scale mail': { category: 'medium', base: 14, dexCap: 2, stealthDisadvantage: true },
  'breastplate': { category: 'medium', base: 14, dexCap: 2 },
  'half plate': { category: 'medium', base: 15, dexCap: 2, stealthDisadvantage: true },
  // Heavy — flat AC, STR requirement
  'ring mail': { category: 'heavy', base: 14, dexCap: 0, stealthDisadvantage: true },
  'chain mail': { category: 'heavy', base: 16, dexCap: 0, strReq: 13, stealthDisadvantage: true },
  'splint': { category: 'heavy', base: 17, dexCap: 0, strReq: 15, stealthDisadvantage: true },
  'plate': { category: 'heavy', base: 18, dexCap: 0, strReq: 15, stealthDisadvantage: true }
};

export function findArmor(name) {
  const n = String(name || '').toLowerCase();
  if (ARMOR[n]) return { name: n, ...ARMOR[n] };
  for (const key of Object.keys(ARMOR)) {
    if (n.includes(key)) return { name: key, ...ARMOR[key] };
  }
  return null;
}

// Compute AC from worn armor + shield + ability mods + class features.
// `unarmoredDefense` is the class effect ({formula: '10+DEX+CON'|'10+DEX+WIS'})
// or a draconic-resilience style base ({baseAC: 13}).
export function computeAC({ armorName = null, shield = false, mods = {}, unarmoredDefense = null, draconicBase = 0, acBonus = 0 } = {}) {
  const dex = Math.trunc(Number(mods.DEX ?? 0)) || 0;
  const armor = armorName ? findArmor(armorName) : null;
  let ac;
  if (armor) {
    const dexPart = armor.dexCap === null ? dex : Math.min(dex, armor.dexCap);
    ac = armor.base + dexPart;
  } else if (unarmoredDefense) {
    const parts = String(unarmoredDefense.formula || '10+DEX').split('+').slice(1);
    ac = 10;
    for (const p of parts) ac += Math.trunc(Number(mods[p] ?? 0)) || 0;
  } else if (draconicBase) {
    ac = draconicBase + dex;
  } else {
    ac = 10 + dex;
  }
  if (shield) ac += 2;
  ac += Math.trunc(Number(acBonus)) || 0;
  return ac;
}
