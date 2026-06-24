// NPC → voice-corpus resolver (Packet D-C1 / W1·1).
//
// Maps an ordinary settlement NPC to a corpus basename under
// `server/rag/corpus/<id>.json`, so the voice layer can ground that person's
// spoken line in real primary-source excerpts (retrieveChunks). PURE + fs-FREE
// by design: `engine/` runs in the browser and must stay deterministic, so this
// module NEVER touches the filesystem — it only returns a candidate id. The
// SERVER does the existence-gated retrieval (`retrieveChunks` already returns an
// empty result for a missing file), so a stale mapping degrades silently to the
// deterministic templates and never throws.
//
// Resolution order (Road A — naming/grounding only, no behavior):
//   1. npc.voiceCorpusId — explicit override (reserved for the named figures:
//      Joan / Jesus / the Kant-Knight / Goldblum-Socrates / Theodore Augustus /
//      the Goat). Honor it now so they resolve the instant a downstream packet
//      places them; D-C1 does not place them.
//   2. npc.archetype / npc.role — normalized to a basename and looked up in the
//      static ROLE_CORPUS allowlist (only basenames verified to exist today).
//   3. null — no corpus; caller keeps the deterministic template body.

// Normalize a role/archetype string to a ROLE_CORPUS lookup key:
// lowercase, spaces/hyphens → underscore, strip anything else, collapse repeats.
// (The allowlist keys use underscores, so role matching folds hyphens in.)
export function normalizeCorpusKey(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

// Sanitize an EXPLICIT voiceCorpusId override to a safe corpus basename.
// Unlike normalizeCorpusKey this PRESERVES hyphens — the named-figure corpora
// use them (joan-of-arc.json, alexander-the-great.json). We only lowercase and
// strip anything that isn't [a-z0-9_-], so the id can't escape the corpus dir.
export function sanitizeCorpusId(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '');
}

// role/archetype token → existing corpus basename.
// Every value here is a file confirmed present under server/rag/corpus/.
// Keys cover: npcGenesis GENERIC_ROLES, BUILDING_ARCHETYPES, and common world
// role words a settlement NPC might carry (W1·1 full-population pass).
const ROLE_CORPUS = {
  // ── GENERIC_ROLES (npcGenesis) ────────────────────────────────────────────
  elder:           'covenant_elder',
  laborer:         'market_porter',
  veteran:         'caravan_guard',
  trader:          'comus_merchant',
  healer:          'covenant_old_healer',
  scavenger:       'gravedigger',
  mediator:        'covenant_elder',
  guard:           'caravan_guard',
  artisan:         'basket_weaver',
  representative:  'caravan_captain',

  // ── BUILDING_ARCHETYPES (npcGenesis) ──────────────────────────────────────
  tavern_keeper:   'brevis_tavern',
  innkeeper:       'boarding_house_keeper',
  smith:           'forge_master',
  priest:          'covenant_elder',
  merchant:        'comus_merchant',
  guard_captain:   'caravan_guard',
  stable_hand:     'market_porter',
  scholar:         'distant_scholar',
  hedge_witch:     'calla_witch',
  // 'artisan' (BUILDING_ARCHETYPES.workshop) already mapped above.

  // ── Common free-form occupation words (original D-C1 set) ─────────────────
  blacksmith:      'forge_master',
  forge:           'forge_master',
  farmer:          'basket_weaver',
  hunter:          'drass_hunter',
  fisher:          'fishmonger',
  fisherman:       'fishmonger',
  fishmonger:      'fishmonger',
  apothecary:      'apothecary',
  witch:           'calla_witch',
  bookbinder:      'bookbinder',
  scribe:          'covenant_scribe',
  librarian:       'academy_librarian',
  basket_weaver:   'basket_weaver',
  weaver:          'basket_weaver',
  tanner:          'tanner',
  locksmith:       'locksmith',
  gravedigger:     'gravedigger',
  undertaker:      'bram_undertaker',
  courier:         'compact_courier',
  caravan_guard:   'caravan_guard',
  caravan_captain: 'caravan_captain',
  watchman:        'night_watchman',
  watch:           'night_watchman',
  porter:          'market_porter',
  cook:            'inn_cook',
  keeper:          'boarding_house_keeper',

  // ── Maritime / harbor (W1·1) ──────────────────────────────────────────────
  sailor:          'hetch_sailor',
  ferryman:        'river_ferryman',
  ferrywoman:      'river_ferryman',
  ferry:           'river_ferryman',
  dockworker:      'harbor_dock_worker',
  dock_worker:     'harbor_dock_worker',
  dockhand:        'harbor_dock_worker',
  harbormaster:    'keris_harbormaster',
  harbor_master:   'keris_harbormaster',
  lighthouse_keeper: 'lighthouse_keeper',
  shipwright:      'shipwright',
  sailmaker:       'harbor_sailmaker',
  rope_maker:      'harbor_rope_maker',
  pilot:           'harbor_pilot',
  navigator:       'harbor_pilot',
  chandler:        'ship_chandler',
  ship_chandler:   'ship_chandler',
  smuggler:        'harbor_smuggler',

  // ── Pastoral / wilderness (W1·1) ─────────────────────────────────────────
  shepherd:        'wild_road_shepherd',
  miller:          'miller_goss',
  woodcutter:      'wild_woodcutter',
  charcoal_maker:  'charcoal_maker',
  herbalist:       'thornwall_herbalist',
  beekeeper:       'wild_beekeeper',
  goatherd:        'wild_goatherd',
  trapper:         'wild_trapper',
  forager:         'brotherhood_forager',
  mushroom_forager: 'wild_mushroom_forager',
  drover:          'cattle_drover',
  druid:           'foss_druid',
  shaman:          'wild_territory_shaman',
  ranger:          'theen_ranger',
  guide:           'wild_territory_guide',

  // ── Urban craft (W1·1) ───────────────────────────────────────────────────
  cobbler:         'cobbler',
  glassblower:     'gell_glassblower',
  cartwright:      'thornwall_cartwright',
  saddler:         'thornwall_saddler',
  laundress:       'thornwall_laundress',
  ratcatcher:      'thornwall_ratcatcher',
  chimney_sweep:   'thornwall_chimney_sweep',
  sweep:           'thornwall_chimney_sweep',
  printer:         'thornwall_printer',
  tailor:          'thornwall_tailor',
  potter:          'thornwall_potter',
  dyer:            'thornwall_dyer',
  soap_maker:      'thornwall_soap_maker',
  candle_maker:    'thornwall_candle_maker',
  lamplighter:     'thornwall_lamplighter',
  stone_carver:    'stone_carver',
  cartographer:    'cartographer',
  mapmaker:        'wild_road_mapmaker',
  glass_painter:   'glass_painter',
  dye_maker:       'dye_maker',
  falconer:        'falconer',
  farrier:         'farrier',
  well_digger:     'well_digger',
  water_carrier:   'water_carrier',
  butcher:         'thornwall_butcher',
  vintner:         'vintner',
  brewer:          'sostane_brewer',

  // ── Service / civic (W1·1) ───────────────────────────────────────────────
  magistrate:      'thornwall_magistrate',
  schoolmaster:    'thornwall_schoolmaster',
  schoolteacher:   'settlement_schoolteacher',
  teacher:         'settlement_schoolteacher',
  physician:       'settlement_physician',
  surgeon:         'harbor_ship_surgeon',
  midwife:         'covenant_midwife',
  moneylender:     'moneylender',
  pawn_broker:     'thornwall_pawn_broker',
  pawnbroker:      'thornwall_pawn_broker',
  money_changer:   'thornwall_money_changer',
  moneychanger:    'thornwall_money_changer',
  beggar:          'thornwall_beggar',
  town_crier:      'thornwall_town_crier',
  crier:           'thornwall_town_crier',
  acolyte:         'temple_acolyte',
  debt_tracker:    'thornwall_debt_tracker',
  soldier:         'retired_soldier',

  // ── Road / wilderness travelers (W1·1) ───────────────────────────────────
  messenger:       'wild_road_messenger',
  pilgrim:         'wild_road_pilgrim',
  toll_collector:  'toll_collector',
  toll_keeper:     'toll_keeper',

  // ── Criminal / underworld (W1·1) ─────────────────────────────────────────
  spy:             'compact_spy',
  thief:           'cess_thief',
  fence:           'orphan_fence',
  scout:           'brotherhood_scout',
  tracker:         'brotherhood_tracker',
};

/**
 * npcVoiceCorpusId(npc) -> string | null
 *
 * Returns the corpus basename to ground this NPC's voice, or null when no
 * corpus is known for them (caller falls back to the deterministic template).
 * PURE — no fs, no I/O, no rng. Same NPC, same answer, forever.
 */
export function npcVoiceCorpusId(npc) {
  if (!npc || typeof npc !== 'object') return null;

  // 1. Explicit override (named figures). Sanitize to a safe basename so it
  //    can't escape the corpus dir on the server — but keep hyphens, which the
  //    named-figure corpora use (joan-of-arc, alexander-the-great).
  const override = sanitizeCorpusId(npc.voiceCorpusId);
  if (override) return override;

  // 2. Map archetype first (more specific), then role.
  for (const raw of [npc.archetype, npc.role]) {
    const key = normalizeCorpusKey(raw);
    if (key && Object.prototype.hasOwnProperty.call(ROLE_CORPUS, key)) {
      return ROLE_CORPUS[key];
    }
  }

  // 3. Nothing mapped.
  return null;
}
