// Object Schema v1 — Unified first-class object model
// Every physical thing: { id, material, category, state, properties }
// Material + category drive behavior; properties are computed, not stored.

const MATERIALS = Object.freeze({
  WOOD: 'wood',
  STONE: 'stone',
  METAL: 'metal',
  GLASS: 'glass',
  CLOTH: 'cloth',
  CERAMIC: 'ceramic',
  ORGANIC: 'organic'
});

const CATEGORIES = Object.freeze({
  FURNITURE: 'furniture',
  TOOL: 'tool',
  LIGHT: 'light',
  CONTAINER: 'container',
  WEAPON: 'weapon',
  DECORATION: 'decoration',
  FOOD: 'food'
});

// Material inference: keywords → material
const MATERIAL_KEYWORDS = {
  [MATERIALS.WOOD]: [
    'plank', 'table', 'chair', 'door', 'beam', 'log', 'stick',
    'wooden', 'oak', 'pine', 'elm', 'ash', 'walnut'
  ],
  [MATERIALS.STONE]: [
    'rock', 'brick', 'wall', 'floor', 'stone', 'statue', 'basin',
    'tile', 'granite', 'slate', 'marble'
  ],
  [MATERIALS.METAL]: [
    'iron', 'steel', 'bronze', 'brass', 'copper', 'sword', 'nail',
    'chain', 'armor', 'plate', 'bolt', 'anvil', 'metal'
  ],
  [MATERIALS.GLASS]: [
    'glass', 'window', 'bottle', 'vial', 'lens', 'mirror', 'pane'
  ],
  [MATERIALS.CLOTH]: [
    'cloth', 'canvas', 'rope', 'curtain', 'banner', 'sail', 'fabric',
    'linen', 'wool', 'cotton', 'silk', 'lace'
  ],
  [MATERIALS.CERAMIC]: [
    'pot', 'jar', 'cup', 'tile', 'dish', 'pipe', 'ceramic', 'porcelain'
  ],
  [MATERIALS.ORGANIC]: [
    'food', 'bone', 'leather', 'cork', 'paper', 'bark', 'straw',
    'wood', 'hay', 'flesh', 'plant'
  ]
};

// Category inference: keywords → category
const CATEGORY_KEYWORDS = {
  [CATEGORIES.FURNITURE]: [
    'table', 'chair', 'bed', 'shelf', 'cabinet', 'bench', 'stool',
    'chest', 'crate', 'rack'
  ],
  [CATEGORIES.TOOL]: [
    'tool', 'hammer', 'axe', 'saw', 'pick', 'wrench', 'lever', 'pry',
    'key', 'lock'
  ],
  [CATEGORIES.LIGHT]: [
    'lantern', 'torch', 'lamp', 'candle', 'light', 'glow', 'luminous'
  ],
  [CATEGORIES.CONTAINER]: [
    'chest', 'box', 'crate', 'bag', 'pouch', 'bottle', 'jar', 'bucket',
    'barrel', 'chest'
  ],
  [CATEGORIES.WEAPON]: [
    'sword', 'axe', 'spear', 'bow', 'dagger', 'blade', 'mace', 'club',
    'halberd', 'pike'
  ],
  [CATEGORIES.DECORATION]: [
    'statue', 'painting', 'tapestry', 'banner', 'ornament', 'sculpture'
  ],
  [CATEGORIES.FOOD]: [
    'food', 'bread', 'cheese', 'meat', 'apple', 'grain', 'wine', 'beer'
  ]
};

// Base properties by material (0..5 scales or boolean)
const MATERIAL_PROPERTIES = {
  [MATERIALS.WOOD]: {
    weight: 2, noise: 1, light: 0, bulk: 3, flammable: 3,
    sharp: 0, hollow: false, conductive: false, magnetic: false
  },
  [MATERIALS.STONE]: {
    weight: 4, noise: 0, light: 0, bulk: 5, flammable: 0,
    sharp: 1, hollow: false, conductive: false, magnetic: false
  },
  [MATERIALS.METAL]: {
    weight: 3, noise: 2, light: 0, bulk: 3, flammable: 0,
    sharp: 2, hollow: false, conductive: true, magnetic: true
  },
  [MATERIALS.GLASS]: {
    weight: 1, noise: 3, light: 0, bulk: 2, flammable: 0,
    sharp: 4, hollow: false, conductive: false, magnetic: false
  },
  [MATERIALS.CLOTH]: {
    weight: 1, noise: 0, light: 0, bulk: 1, flammable: 2,
    sharp: 0, hollow: false, conductive: false, magnetic: false
  },
  [MATERIALS.CERAMIC]: {
    weight: 2, noise: 2, light: 0, bulk: 2, flammable: 0,
    sharp: 2, hollow: true, conductive: false, magnetic: false
  },
  [MATERIALS.ORGANIC]: {
    weight: 2, noise: 0, light: 0, bulk: 2, flammable: 2,
    sharp: 0, hollow: false, conductive: false, magnetic: false
  }
};

// Valid state progressions by material
const STATE_PROGRESSIONS = {
  [MATERIALS.WOOD]: ['intact', 'damaged', 'destroyed', 'burned'],
  [MATERIALS.STONE]: ['intact', 'cracked', 'broken'],
  [MATERIALS.METAL]: ['intact', 'corroded', 'warped'],
  [MATERIALS.GLASS]: ['intact', 'cracked', 'shattered', 'dust'],
  [MATERIALS.CLOTH]: ['intact', 'torn', 'tattered', 'burned'],
  [MATERIALS.CERAMIC]: ['intact', 'cracked', 'broken'],
  [MATERIALS.ORGANIC]: ['fresh', 'stale', 'rotten', 'dust']
};

// Break outcomes by material
const BREAK_OUTCOMES = {
  [MATERIALS.WOOD]: { pieces: ['splinter', 'plank'], noise: 4, damage: 0 },
  [MATERIALS.STONE]: { pieces: ['rock', 'gravel'], noise: 3, damage: 1 },
  [MATERIALS.METAL]: { pieces: ['scrap'], noise: 5, damage: 0 },
  [MATERIALS.GLASS]: { pieces: ['shard', 'shatter'], noise: 5, damage: 1 },
  [MATERIALS.CLOTH]: { pieces: ['strip', 'rag'], noise: 0, damage: 0 },
  [MATERIALS.CERAMIC]: { pieces: ['sherd', 'shard'], noise: 3, damage: 0 },
  [MATERIALS.ORGANIC]: { pieces: [], noise: 0, damage: 0 }
};

export function inferMaterial(name, tags = []) {
  const text = (String(name) + ' ' + tags.join(' ')).toLowerCase();
  for (const [material, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return material;
    }
  }
  return MATERIALS.WOOD; // default
}

export function inferCategory(name, tags = []) {
  const text = (String(name) + ' ' + tags.join(' ')).toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (text.includes(kw)) return category;
    }
  }
  return CATEGORIES.FURNITURE; // default
}

export function computeProperties(material) {
  return { ...MATERIAL_PROPERTIES[material] || MATERIAL_PROPERTIES[MATERIALS.WOOD] };
}

export function getStateProgression(material) {
  return STATE_PROGRESSIONS[material] || ['intact', 'damaged', 'destroyed'];
}

export function getBreakOutcome(material) {
  return BREAK_OUTCOMES[material] || { pieces: [], noise: 2, damage: 0 };
}

export const schema = {
  MATERIALS,
  CATEGORIES,
  MATERIAL_KEYWORDS,
  CATEGORY_KEYWORDS,
  MATERIAL_PROPERTIES,
  STATE_PROGRESSIONS,
  BREAK_OUTCOMES,
  inferMaterial,
  inferCategory,
  computeProperties,
  getStateProgression,
  getBreakOutcome
};
