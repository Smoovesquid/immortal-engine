// Magic item definitions — the rarity ladder (P-69).
// Weapons carry bonus.{attack,damage}; armor carries bonus.ac on top of its
// base; accessories carry acBonus. Names are world-flavored, mechanics SRD.

function mw(defRef, name, base, dice, type, bonus, rarity, basePrice, properties = []) {
  return {
    defRef, name, kind: 'weapon', slot: 'main_hand',
    damage: { dice, type }, weight: 3,
    bonus: { attack: bonus, damage: bonus },
    properties, rarity, basePrice, baseRef: base
  };
}

// ── +1 weapons (uncommon) ────────────────────────────────────────────────────
export const longsword_magic_1 = mw('longsword_magic_1', 'Sword of Morning', 'longsword', '1d8', 'slashing', 1, 'uncommon', 500, ['versatile', 'light (bright radius 10ft)']);
export const greataxe_magic_1 = mw('greataxe_magic_1', 'Hewer of Oaths', 'greataxe', '1d12', 'slashing', 1, 'uncommon', 500, ['heavy', 'two-handed']);
export const longbow_magic_1 = { ...mw('longbow_magic_1', 'Wind-Taker', 'longbow', '1d8', 'piercing', 1, 'uncommon', 500, ['ranged', 'heavy', 'two-handed']), stat: 'AGILITY' };
export const dagger_magic_1 = mw('dagger_magic_1', 'Whisper', 'dagger', '1d4', 'piercing', 1, 'uncommon', 400, ['finesse', 'light', 'thrown']);
export const mace_magic_1 = mw('mace_magic_1', 'Lawgiver', 'mace', '1d6', 'bludgeoning', 1, 'uncommon', 450, []);
export const rapier_magic_1 = mw('rapier_magic_1', 'The Gallant', 'rapier', '1d8', 'piercing', 1, 'uncommon', 500, ['finesse']);

// ── +2 weapons (rare) ────────────────────────────────────────────────────────
export const longsword_magic_2 = mw('longsword_magic_2', 'Sword of Noon', 'longsword', '1d8', 'slashing', 2, 'rare', 4000, ['versatile']);
export const warhammer_magic_2 = mw('warhammer_magic_2', 'Doorbreaker', 'warhammer', '1d8', 'bludgeoning', 2, 'rare', 4000, ['versatile']);
export const shortbow_magic_2 = { ...mw('shortbow_magic_2', 'The Quiet Argument', 'shortbow', '1d6', 'piercing', 2, 'rare', 3500, ['ranged', 'two-handed']), stat: 'AGILITY' };
export const greatsword_magic_2 = mw('greatsword_magic_2', 'Winterspine', 'greatsword', '2d6', 'slashing', 2, 'rare', 4500, ['heavy', 'two-handed']);

// ── +3 weapons (very rare) ───────────────────────────────────────────────────
export const longsword_magic_3 = mw('longsword_magic_3', 'Sword of the Last Hour', 'longsword', '1d8', 'slashing', 3, 'very_rare', 16000, ['versatile']);
export const greataxe_magic_3 = mw('greataxe_magic_3', 'The Unmaking', 'greataxe', '1d12', 'slashing', 3, 'very_rare', 18000, ['heavy', 'two-handed']);

// ── Magic armor ──────────────────────────────────────────────────────────────
export const leather_armor_magic_1 = {
  defRef: 'leather_armor_magic_1', name: 'Nightskin Leathers', kind: 'armor', slot: 'armor',
  ac: 11, maxDexBonus: null, bonus: { ac: 1 }, weight: 10, rarity: 'uncommon', basePrice: 600
};
export const chain_mail_magic_1 = {
  defRef: 'chain_mail_magic_1', name: 'Mail of the Quiet Vigil', kind: 'armor', slot: 'armor',
  ac: 16, maxDexBonus: 0, bonus: { ac: 1 }, weight: 55, rarity: 'rare', basePrice: 1800
};
export const plate_armor_magic_1 = {
  defRef: 'plate_armor_magic_1', name: 'Plate of the Standing Stone', kind: 'armor', slot: 'armor',
  ac: 18, maxDexBonus: 0, bonus: { ac: 1 }, weight: 65, rarity: 'very_rare', basePrice: 7000
};

// ── Accessories ──────────────────────────────────────────────────────────────
export const ring_of_protection = {
  defRef: 'ring_of_protection', name: 'Ring of Protection', kind: 'accessory', slot: 'ring',
  acBonus: 1, weight: 0, rarity: 'uncommon', basePrice: 500
};
export const cloak_of_protection = {
  defRef: 'cloak_of_protection', name: 'Cloak of Protection', kind: 'accessory', slot: 'cloak',
  acBonus: 1, weight: 1, rarity: 'uncommon', basePrice: 500
};
export const bracers_of_defense = {
  defRef: 'bracers_of_defense', name: 'Bracers of Defense', kind: 'accessory', slot: 'wrists',
  acBonus: 2, weight: 1, rarity: 'rare', basePrice: 3000
};
