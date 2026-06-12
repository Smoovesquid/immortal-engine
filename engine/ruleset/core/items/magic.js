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
// P-77: accessories follow RAW — their protection answers only to an attuned
// bearer. (+N weapons/armor stay attunement-free, also RAW.)
export const ring_of_protection = {
  defRef: 'ring_of_protection', name: 'Ring of Protection', kind: 'accessory', slot: 'ring',
  acBonus: 1, weight: 0, rarity: 'uncommon', basePrice: 500, attunement: true
};
export const cloak_of_protection = {
  defRef: 'cloak_of_protection', name: 'Cloak of Protection', kind: 'accessory', slot: 'cloak',
  acBonus: 1, weight: 1, rarity: 'uncommon', basePrice: 500, attunement: true
};
export const bracers_of_defense = {
  defRef: 'bracers_of_defense', name: 'Bracers of Defense', kind: 'accessory', slot: 'wrists',
  acBonus: 2, weight: 1, rarity: 'rare', basePrice: 3000, attunement: true
};

// ── P-77: item identity — mysteries, attunement, named uniques ───────────────
// A magic drop lands SEALED: the instance's defRef points at a humming
// placeholder and the truth rides in `sealedRef` until someone identifies it.
// Every consumer (panel, equip, sell, combat math) naturally sees the mystery —
// no surface can leak a name the table hasn't earned.

export const unidentified_blade = {
  defRef: 'unidentified_blade', name: 'Humming Blade', kind: 'weapon', slot: 'main_hand',
  damage: { dice: '1d6', type: 'slashing' }, weight: 3,
  rarity: 'common', basePrice: 25, mystery: true,
  properties: []
};
export const unidentified_armor = {
  defRef: 'unidentified_armor', name: 'Humming Armor', kind: 'armor', slot: 'armor',
  ac: 11, maxDexBonus: null, weight: 12, rarity: 'common', basePrice: 25, mystery: true
};
export const unidentified_trinket = {
  defRef: 'unidentified_trinket', name: 'Humming Trinket', kind: 'accessory', slot: null,
  weight: 0, rarity: 'common', basePrice: 10, mystery: true
};

const MYSTERY_BY_KIND = { weapon: 'unidentified_blade', armor: 'unidentified_armor', accessory: 'unidentified_trinket' };

/** Should this def land sealed? Magic gear keeps its secret; potions don't. */
export function shouldSeal(def) {
  if (!def || def.mystery) return false;
  return Boolean(MYSTERY_BY_KIND[def.kind]) && def.rarity && def.rarity !== 'common';
}

/** sealLoot(instance, def) -> instance whose defRef hums and whose truth is sealed. */
export function sealLoot(instance, def) {
  if (!shouldSeal(def)) return instance;
  return { ...instance, defRef: MYSTERY_BY_KIND[def.kind], sealedRef: def.defRef };
}

/** Identify DC by rarity — knowing a thing is harder the rarer it is. */
export function identifyDc(def) {
  return { uncommon: 13, rare: 15, very_rare: 17, legendary: 19 }[def?.rarity] ?? 13;
}

/** What a settlement scholar charges to do it for you, in copper. */
export function sageFeeCopper(def) {
  return { uncommon: 2500, rare: 10000, very_rare: 40000, legendary: 100000 }[def?.rarity] ?? 2500;
}

// ── Named uniques: ~8 seed-deterministic rewards with one-line histories ─────
// Paid by milestones and (P-74c) the confrontation. All carry attunement —
// the big effects ask for an hour of your undivided self.

function named(defRef, name, base, history) {
  return { ...base, defRef, name, unique: true, attunement: true, history };
}

export const greyfang = named('greyfang', 'Greyfang',
  mw('x', '', 'longsword', '1d8', 'slashing', 2, 'rare', 5000, ['versatile']),
  'The river-wardens passed one blade down nine keepers. It buried all nine, and kept the edge.');
export const the_dawn_was_late = named('the_dawn_was_late', 'The Dawn Was Late',
  mw('x', '', 'mace', '1d6', 'bludgeoning', 2, 'rare', 5000, []),
  'Forged the morning after a massacre the sun should have stopped.');
export const thirteen_sparrows = named('thirteen_sparrows', 'Thirteen Sparrows',
  mw('x', '', 'dagger', '1d4', 'piercing', 2, 'rare', 4500, ['finesse', 'light', 'thrown']),
  "A spy's knife. Twelve sparrows on the hilt; the thirteenth is the blade.");
export const coat_of_the_quiet_house = named('coat_of_the_quiet_house', 'Coat of the Quiet House', {
  kind: 'armor', slot: 'armor', ac: 11, maxDexBonus: null, bonus: { ac: 2 },
  weight: 10, rarity: 'rare', basePrice: 5000
}, 'Worn by the last steward of a manor that no longer appears on any map.');
export const wall_of_wens = named('wall_of_wens', 'The Wall of Wens', {
  kind: 'armor', slot: 'off_hand', shield: true, ac: 3,
  weight: 6, rarity: 'rare', basePrice: 4000
}, "A village's whole militia sheltered behind it once. The village is gone; the shield is not.");
export const ring_of_the_unspent_hour = named('ring_of_the_unspent_hour', 'Ring of the Unspent Hour', {
  kind: 'accessory', slot: 'ring', acBonus: 1, weight: 0, rarity: 'rare', basePrice: 4000
}, 'Its first owner died old, in a war that killed the young.');
export const lantern_heart = named('lantern_heart', 'Lantern-Heart', {
  kind: 'accessory', slot: 'neck', acBonus: 1, weight: 1, rarity: 'rare', basePrice: 4000
}, 'Cut from the wreck of a lighthouse that burned a hundred years for nothing.');
export const boots_of_the_unmissed_step = named('boots_of_the_unmissed_step', 'Boots of the Unmissed Step', {
  kind: 'accessory', slot: 'feet', acBonus: 1, weight: 1, rarity: 'rare', basePrice: 4000
}, 'Stolen so many times that theft is now part of the fit.');

const NAMED_UNIQUES = [
  greyfang, the_dawn_was_late, thirteen_sparrows, coat_of_the_quiet_house,
  wall_of_wens, ring_of_the_unspent_hour, lantern_heart, boots_of_the_unmissed_step
];

export function getNamedUniques() { return [...NAMED_UNIQUES]; }

/**
 * pickNamedReward(world, salt) -> def | null.
 * Seed-deterministic choice among uniques the party does not already hold
 * (sealed or open). Returns null when the shelf is bare.
 */
export function pickNamedReward(world, salt, seedFromString) {
  const items = world?.party?.[0]?.inventory?.items || [];
  const owned = new Set(items.flatMap(it => [it.defRef, it.sealedRef].filter(Boolean)));
  const pool = NAMED_UNIQUES.filter(d => !owned.has(d.defRef));
  if (!pool.length) return null;
  const idx = seedFromString(`${world?.meta?.seed || ''}|namedReward|${String(salt)}`) % pool.length;
  return pool[idx];
}
