// U270: Voice corpus coverage (Packet W1·1).
//
// Asserts that:
//   1. Every role/archetype npcGenesis actually MINTS resolves to a non-null
//      corpus basename (GENERIC_ROLES + BUILDING_ARCHETYPES).
//   2. A representative sample of W1·1 new roles resolves correctly.
//   3. All values in ROLE_CORPUS point to corpus basenames that EXIST on disk.
//   4. Unmapped roles fall back to null cleanly (no throw).
//   5. Resolver is PURE — same input, same output across calls (determinism).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { npcVoiceCorpusId, normalizeCorpusKey } from '../engine/npc/npcVoiceResolve.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = resolve(__dirname, '../server/rag/corpus');

// ── 1. All npcGenesis GENERIC_ROLES resolve ───────────────────────────────────

const GENERIC_ROLES = [
  'elder', 'laborer', 'veteran', 'trader', 'healer',
  'scavenger', 'mediator', 'guard', 'artisan', 'representative'
];

test('U270: every GENERIC_ROLE resolves to a non-null corpus id', () => {
  for (const role of GENERIC_ROLES) {
    const id = npcVoiceCorpusId({ role });
    assert.ok(id, `GENERIC_ROLE '${role}' mapped to null — add it to ROLE_CORPUS`);
  }
});

// ── 2. All npcGenesis BUILDING_ARCHETYPES resolve ─────────────────────────────

const BUILDING_ARCHETYPES = [
  'tavern_keeper', 'innkeeper', 'smith', 'priest',
  'merchant', 'guard_captain', 'stable_hand', 'scholar',
  'hedge_witch', 'artisan'
];

test('U270: every BUILDING_ARCHETYPE resolves to a non-null corpus id', () => {
  for (const role of BUILDING_ARCHETYPES) {
    const id = npcVoiceCorpusId({ role });
    assert.ok(id, `BUILDING_ARCHETYPE '${role}' mapped to null — add it to ROLE_CORPUS`);
  }
});

// ── 3. W1·1 new roles resolve to the expected corpus basenames ────────────────

const W1_SPOT_CHECKS = [
  // Maritime
  ['sailor',        'hetch_sailor'],
  ['ferryman',      'river_ferryman'],
  ['ferrywoman',    'river_ferryman'],
  ['dockworker',    'harbor_dock_worker'],
  ['harbormaster',  'keris_harbormaster'],
  ['lighthouse_keeper', 'lighthouse_keeper'],
  ['shipwright',    'shipwright'],
  ['navigator',     'harbor_pilot'],
  ['smuggler',      'harbor_smuggler'],
  // Pastoral
  ['shepherd',      'wild_road_shepherd'],
  ['miller',        'miller_goss'],
  ['woodcutter',    'wild_woodcutter'],
  ['herbalist',     'thornwall_herbalist'],
  ['beekeeper',     'wild_beekeeper'],
  ['goatherd',      'wild_goatherd'],
  ['trapper',       'wild_trapper'],
  ['druid',         'foss_druid'],
  ['shaman',        'wild_territory_shaman'],
  ['ranger',        'theen_ranger'],
  // Urban craft
  ['cobbler',       'cobbler'],
  ['glassblower',   'gell_glassblower'],
  ['cartwright',    'thornwall_cartwright'],
  ['potter',        'thornwall_potter'],
  ['tailor',        'thornwall_tailor'],
  ['chimney_sweep', 'thornwall_chimney_sweep'],
  ['sweep',         'thornwall_chimney_sweep'],
  ['printer',       'thornwall_printer'],
  ['falconer',      'falconer'],
  ['farrier',       'farrier'],
  ['cartographer',  'cartographer'],
  ['mapmaker',      'wild_road_mapmaker'],
  ['vintner',       'vintner'],
  ['brewer',        'sostane_brewer'],
  ['butcher',       'thornwall_butcher'],
  // Service / civic
  ['magistrate',    'thornwall_magistrate'],
  ['teacher',       'settlement_schoolteacher'],
  ['schoolmaster',  'thornwall_schoolmaster'],
  ['physician',     'settlement_physician'],
  ['midwife',       'covenant_midwife'],
  ['moneylender',   'moneylender'],
  ['pawnbroker',    'thornwall_pawn_broker'],
  ['town_crier',    'thornwall_town_crier'],
  ['acolyte',       'temple_acolyte'],
  ['soldier',       'retired_soldier'],
  ['beggar',        'thornwall_beggar'],
  // Road travelers
  ['messenger',     'wild_road_messenger'],
  ['pilgrim',       'wild_road_pilgrim'],
  ['toll_keeper',   'toll_keeper'],
  // Criminal
  ['spy',           'compact_spy'],
  ['thief',         'cess_thief'],
  ['scout',         'brotherhood_scout'],
];

test('U270: W1·1 spot-checks — new roles resolve to expected corpus ids', () => {
  for (const [role, expected] of W1_SPOT_CHECKS) {
    const actual = npcVoiceCorpusId({ role });
    assert.equal(actual, expected, `role '${role}': expected '${expected}', got '${actual}'`);
  }
});

// ── 4. All corpus values in the allowlist exist on disk ───────────────────────
//    Import the module source and extract the ROLE_CORPUS values via the resolver
//    using a synthetic NPC for each key. Then verify each resolved id has a file.

test('U270: every corpus id in the allowlist has a matching file on disk', () => {
  // Drive the resolver with every key we know about (GENERIC_ROLES +
  // BUILDING_ARCHETYPES + spot-check keys) to collect the resolved ids.
  const allKeys = [
    ...GENERIC_ROLES,
    ...BUILDING_ARCHETYPES,
    ...W1_SPOT_CHECKS.map(([k]) => k),
    // D-C1 original keys
    'blacksmith', 'forge', 'farmer', 'hunter', 'fisher', 'fisherman',
    'apothecary', 'witch', 'bookbinder', 'scribe', 'librarian',
    'basket_weaver', 'weaver', 'tanner', 'locksmith', 'gravedigger',
    'undertaker', 'courier', 'caravan_guard', 'caravan_captain',
    'watchman', 'watch', 'porter', 'cook', 'keeper', 'fishmonger',
  ];

  const missing = [];
  const seen = new Set();
  for (const key of allKeys) {
    const id = npcVoiceCorpusId({ role: key });
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const path = `${CORPUS_DIR}/${id}.json`;
    if (!existsSync(path)) missing.push(`${key} → ${id} (file missing)`);
  }
  assert.deepEqual(missing, [], `Stale corpus ids detected:\n${missing.join('\n')}`);
});

// ── 5. Unmapped roles fall back to null (no throw) ───────────────────────────

test('U270: unmapped roles return null cleanly', () => {
  assert.equal(npcVoiceCorpusId({ role: 'wandering_oracle_of_the_ninth_void' }), null);
  assert.equal(npcVoiceCorpusId({ role: '' }), null);
  assert.equal(npcVoiceCorpusId({}), null);
  assert.equal(npcVoiceCorpusId(null), null);
});

// ── 6. Purity / determinism — same npc → same answer, always ─────────────────

test('U270: resolver is pure — repeated calls return identical results', () => {
  const npc = { role: 'sailor', archetype: 'harbor_pilot' };
  const results = Array.from({ length: 10 }, () => npcVoiceCorpusId(npc));
  assert.ok(results.every(r => r === results[0]),
    'npcVoiceCorpusId is not deterministic — got varying results');
});

// ── 7. Archetype beats role when both map ────────────────────────────────────

test('U270: archetype takes precedence over role', () => {
  // hunter archetype should beat merchant role
  assert.equal(npcVoiceCorpusId({ archetype: 'hunter', role: 'merchant' }), 'drass_hunter');
  // shipwright archetype should beat elder role
  assert.equal(npcVoiceCorpusId({ archetype: 'shipwright', role: 'elder' }), 'shipwright');
});
