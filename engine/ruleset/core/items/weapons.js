// Weapon definitions — full SRD 5.1 simple + martial list (P-69).
// damage.dice is 'NdM'; properties use SRD names; stat overrides the default
// STR (ranged weapons are DEX; finesse picks the better of the two at use).

function w(defRef, name, dice, type, weight, properties, basePrice, extra = {}) {
  return {
    defRef, name, kind: 'weapon', slot: 'main_hand',
    damage: { dice, type }, weight, properties, rarity: 'common', basePrice,
    ...extra
  };
}

// ── Simple melee ─────────────────────────────────────────────────────────────
export const club = w('club', 'Club', '1d4', 'bludgeoning', 2, ['light'], 1);
export const dagger = w('dagger', 'Dagger', '1d4', 'piercing', 1, ['finesse', 'light', 'thrown'], 2);
export const greatclub = w('greatclub', 'Greatclub', '1d8', 'bludgeoning', 10, ['two-handed'], 1);
export const handaxe = w('handaxe', 'Handaxe', '1d6', 'slashing', 2, ['light', 'thrown'], 5);
export const javelin = w('javelin', 'Javelin', '1d6', 'piercing', 2, ['thrown'], 1);
export const light_hammer = w('light_hammer', 'Light Hammer', '1d4', 'bludgeoning', 2, ['light', 'thrown'], 2);
export const mace = w('mace', 'Mace', '1d6', 'bludgeoning', 4, [], 5);
export const quarterstaff = w('quarterstaff', 'Quarterstaff', '1d6', 'bludgeoning', 4, ['versatile'], 1);
export const sickle = w('sickle', 'Sickle', '1d4', 'slashing', 2, ['light'], 1);
export const spear = w('spear', 'Spear', '1d6', 'piercing', 3, ['thrown', 'versatile'], 1);

// ── Simple ranged ────────────────────────────────────────────────────────────
export const light_crossbow = w('light_crossbow', 'Light Crossbow', '1d8', 'piercing', 5, ['ranged', 'two-handed', 'loading'], 25, { stat: 'AGILITY' });
export const dart = w('dart', 'Dart', '1d4', 'piercing', 0.25, ['finesse', 'thrown', 'ranged'], 1, { stat: 'AGILITY' });
export const shortbow = w('shortbow', 'Shortbow', '1d6', 'piercing', 2, ['ranged', 'two-handed'], 25, { stat: 'AGILITY' });
export const sling = w('sling', 'Sling', '1d4', 'bludgeoning', 0, ['ranged'], 1, { stat: 'AGILITY' });

// ── Martial melee ────────────────────────────────────────────────────────────
export const battleaxe = w('battleaxe', 'Battleaxe', '1d8', 'slashing', 4, ['versatile'], 10);
export const flail = w('flail', 'Flail', '1d8', 'bludgeoning', 2, [], 10);
export const glaive = w('glaive', 'Glaive', '1d10', 'slashing', 6, ['heavy', 'reach', 'two-handed'], 20);
export const greataxe = w('greataxe', 'Greataxe', '1d12', 'slashing', 7, ['heavy', 'two-handed'], 30);
export const greatsword = w('greatsword', 'Greatsword', '2d6', 'slashing', 6, ['heavy', 'two-handed'], 50);
export const halberd = w('halberd', 'Halberd', '1d10', 'slashing', 6, ['heavy', 'reach', 'two-handed'], 20);
export const lance = w('lance', 'Lance', '1d12', 'piercing', 6, ['reach', 'special'], 10);
export const longsword = w('longsword', 'Longsword', '1d8', 'slashing', 3, ['versatile'], 15);
export const maul = w('maul', 'Maul', '2d6', 'bludgeoning', 10, ['heavy', 'two-handed'], 10);
export const morningstar = w('morningstar', 'Morningstar', '1d8', 'piercing', 4, [], 15);
export const pike = w('pike', 'Pike', '1d10', 'piercing', 18, ['heavy', 'reach', 'two-handed'], 5);
export const rapier = w('rapier', 'Rapier', '1d8', 'piercing', 2, ['finesse'], 25);
export const scimitar = w('scimitar', 'Scimitar', '1d6', 'slashing', 3, ['finesse', 'light'], 25);
export const shortsword = w('shortsword', 'Shortsword', '1d6', 'piercing', 2, ['finesse', 'light'], 10);
export const trident = w('trident', 'Trident', '1d6', 'piercing', 4, ['thrown', 'versatile'], 5);
export const war_pick = w('war_pick', 'War Pick', '1d8', 'piercing', 2, [], 5);
export const warhammer = w('warhammer', 'Warhammer', '1d8', 'bludgeoning', 2, ['versatile'], 15);
export const whip = w('whip', 'Whip', '1d4', 'slashing', 3, ['finesse', 'reach'], 2);

// ── Martial ranged ───────────────────────────────────────────────────────────
export const hand_crossbow = w('hand_crossbow', 'Hand Crossbow', '1d6', 'piercing', 3, ['ranged', 'light', 'loading'], 75, { stat: 'AGILITY' });
export const heavy_crossbow = w('heavy_crossbow', 'Heavy Crossbow', '1d10', 'piercing', 18, ['ranged', 'heavy', 'two-handed', 'loading'], 50, { stat: 'AGILITY' });
export const longbow = w('longbow', 'Longbow', '1d8', 'piercing', 2, ['ranged', 'heavy', 'two-handed'], 50, { stat: 'AGILITY' });
