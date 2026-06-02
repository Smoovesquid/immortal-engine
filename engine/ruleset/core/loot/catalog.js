// Bestiary type-tier loot tables — referenced by creature catalog entries.

// ── Aberration ──────────────────────────────────────────────────────────────

export const aberration_trivial = {
  id: 'aberration_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'copper', amount: '1d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const aberration_minor = {
  id: 'aberration_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d4' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 3, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } }
  ]
};

export const aberration_standard = {
  id: 'aberration_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};

export const aberration_elite = {
  id: 'aberration_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 12, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'currency', currency: 'platinum', amount: '2d6' } }
  ]
};

// ── Beast ───────────────────────────────────────────────────────────────────

export const beast_trivial = {
  id: 'beast_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '1d4' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const beast_minor = {
  id: 'beast_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const beast_standard = {
  id: 'beast_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'currency', currency: 'gold', amount: '1d4' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const beast_elite = {
  id: 'beast_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '4d6' } },
    { weight: 18, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 7, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};

// ── Construct ───────────────────────────────────────────────────────────────

export const construct_trivial = {
  id: 'construct_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const construct_minor = {
  id: 'construct_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '3d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'leather_armor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'chain_shirt', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const construct_standard = {
  id: 'construct_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'chain_shirt', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'chain_mail', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'gold', amount: '2d6' } }
  ]
};

export const construct_elite = {
  id: 'construct_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 15, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 12, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'chain_mail', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } }
  ]
};

// ── Dragon ──────────────────────────────────────────────────────────────────

export const dragon_minor = {
  id: 'dragon_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } }
  ]
};

export const dragon_standard = {
  id: 'dragon_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } },
    { weight: 12, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const dragon_elite = {
  id: 'dragon_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '6d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '2d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 12, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

// ── Elemental ───────────────────────────────────────────────────────────────

export const elemental_trivial = {
  id: 'elemental_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } }
  ]
};

export const elemental_minor = {
  id: 'elemental_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const elemental_standard = {
  id: 'elemental_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 12, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 10, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};

export const elemental_elite = {
  id: 'elemental_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 15, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 12, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '2d6' } }
  ]
};

// ── Fey ─────────────────────────────────────────────────────────────────────

export const fey_trivial = {
  id: 'fey_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 12, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const fey_minor = {
  id: 'fey_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d4' } },
    { weight: 12, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const fey_standard = {
  id: 'fey_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 12, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 10, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } }
  ]
};

// ── Fiend ───────────────────────────────────────────────────────────────────

export const fiend_trivial = {
  id: 'fiend_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const fiend_minor = {
  id: 'fiend_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } }
  ]
};

export const fiend_standard = {
  id: 'fiend_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } },
    { weight: 12, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const fiend_elite = {
  id: 'fiend_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '5d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 12, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

// ── Fungal ──────────────────────────────────────────────────────────────────

export const fungal_minor = {
  id: 'fungal_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

// ── Giant ───────────────────────────────────────────────────────────────────

export const giant_minor = {
  id: 'giant_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'chain_mail', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } }
  ]
};

export const giant_standard = {
  id: 'giant_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '4d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};

export const giant_elite = {
  id: 'giant_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'gold', amount: '5d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 12, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '2d6' } }
  ]
};

// ── Humanoid ────────────────────────────────────────────────────────────────

export const humanoid_minor = {
  id: 'humanoid_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '3d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'shortsword', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'leather_armor', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'longbow', rarity: 'common' } }
  ]
};

export const humanoid_standard = {
  id: 'humanoid_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'chain_shirt', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'studded_leather', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'longbow', rarity: 'common' } }
  ]
};

export const humanoid_elite = {
  id: 'humanoid_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '4d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } },
    { weight: 12, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'half_plate', rarity: 'uncommon' } },
    { weight: 8, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 7, result: { kind: 'item', defRef: 'chain_mail', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } }
  ]
};

// ── Monstrosity ─────────────────────────────────────────────────────────────

export const monstrosity_trivial = {
  id: 'monstrosity_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 22, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'silver', amount: '1d4' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const monstrosity_minor = {
  id: 'monstrosity_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 22, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '3d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'gold', amount: '1d4' } },
    { weight: 3, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } }
  ]
};

// ── Ooze ────────────────────────────────────────────────────────────────────

export const ooze_trivial = {
  id: 'ooze_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '1d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const ooze_minor = {
  id: 'ooze_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '3d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } }
  ]
};

export const ooze_standard = {
  id: 'ooze_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'gold', amount: '1d4' } }
  ]
};

// ── Parasite ────────────────────────────────────────────────────────────────

export const parasite_minor = {
  id: 'parasite_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '1d4' } },
    { weight: 12, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

// ── Plant ───────────────────────────────────────────────────────────────────

export const plant_trivial = {
  id: 'plant_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '1d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const plant_minor = {
  id: 'plant_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 18, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};

export const plant_standard = {
  id: 'plant_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '3d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'gold', amount: '1d4' } }
  ]
};

export const plant_elite = {
  id: 'plant_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 25, result: { kind: 'currency', currency: 'gold', amount: '2d6' } },
    { weight: 22, result: { kind: 'currency', currency: 'silver', amount: '4d6' } },
    { weight: 18, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 13, result: { kind: 'item', defRef: 'antidote', rarity: 'common' } },
    { weight: 7, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};

// ── Shadow ──────────────────────────────────────────────────────────────────

export const shadow_minor = {
  id: 'shadow_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 10, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 5, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 3, result: { kind: 'currency', currency: 'gold', amount: '1d4' } }
  ]
};

export const shadow_standard = {
  id: 'shadow_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } }
  ]
};

export const shadow_elite = {
  id: 'shadow_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 15, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 12, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 10, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'currency', currency: 'platinum', amount: '1d6' } }
  ]
};

// ── Spirit ──────────────────────────────────────────────────────────────────

export const spirit_trivial = {
  id: 'spirit_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 12, result: { kind: 'currency', currency: 'silver', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 3, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } }
  ]
};

// ── Undead ──────────────────────────────────────────────────────────────────

export const undead_trivial = {
  id: 'undead_trivial',
  rolls: 1,
  entries: [
    { weight: 50, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'copper', amount: '1d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '2d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'shortsword', rarity: 'common' } }
  ]
};

export const undead_minor = {
  id: 'undead_minor',
  rolls: 1,
  entries: [
    { weight: 35, result: null },
    { weight: 20, result: { kind: 'currency', currency: 'silver', amount: '1d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'copper', amount: '3d6' } },
    { weight: 10, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 8, result: { kind: 'item', defRef: 'shortsword', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'leather_armor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } }
  ]
};

export const undead_standard = {
  id: 'undead_standard',
  rolls: 1,
  entries: [
    { weight: 25, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'silver', amount: '2d6' } },
    { weight: 15, result: { kind: 'currency', currency: 'gold', amount: '1d6' } },
    { weight: 12, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 10, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'chain_mail', rarity: 'common' } },
    { weight: 7, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } },
    { weight: 5, result: { kind: 'item', defRef: 'longsword', rarity: 'common' } }
  ]
};

export const undead_elite = {
  id: 'undead_elite',
  rolls: 1,
  entries: [
    { weight: 10, result: null },
    { weight: 18, result: { kind: 'currency', currency: 'gold', amount: '3d6' } },
    { weight: 15, result: { kind: 'item', defRef: 'ring_of_protection', rarity: 'rare' } },
    { weight: 15, result: { kind: 'item', defRef: 'ancient_scroll', rarity: 'uncommon' } },
    { weight: 12, result: { kind: 'currency', currency: 'platinum', amount: '1d4' } },
    { weight: 10, result: { kind: 'item', defRef: 'longsword_magic_1', rarity: 'rare' } },
    { weight: 8, result: { kind: 'item', defRef: 'plate_armor', rarity: 'rare' } },
    { weight: 7, result: { kind: 'item', defRef: 'sigil_key', rarity: 'rare' } },
    { weight: 5, result: { kind: 'item', defRef: 'healing_potion_minor', rarity: 'common' } }
  ]
};
