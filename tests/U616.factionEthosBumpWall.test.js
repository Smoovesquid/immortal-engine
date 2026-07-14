// U616 — SP-2: the WORLD_VERSION 31 → 32 bump wall.
//
// SP-2 is the Social Physics Contract's ONE named WORLD_VERSION-bump packet (w.factions[]
// gains `ethos`). This file is the migration wall: a pre-v32 save (no stored ethos) must
// WARN before upgrade and come out with an ethos DERIVED deterministically from each
// faction's id+goal; a save that already stores an ethos keeps it (idempotent); the
// invariant rejects a stray value; and the version-string bump is complete across the
// suite. The boot-hash re-pin lives in U454-E (this file must NOT duplicate that literal).

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadSlot } from '../engine/save.js';
import { WORLD_VERSION, ensureWorld, ensureFactions, deriveFactionEthos } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function mkStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem(k) { return data[k] ?? null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; },
  };
}

// A minimal-but-valid pre-v32 world: version 31, factions with NO ethos field, and the
// reputation keyed to them. ensureWorld fills every other field with safe defaults.
function legacyV31Save() {
  return {
    meta: { version: 31, seed: 'u616', fate: 0.2, campaignId: 'c' },
    party: [{ id: 'party', name: 'Old', archetype: 'Wanderer', stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    factions: [
      { id: 'civic', goal: 'Maintain order', pressure: 10, hostility: 10, lastMove: '' },       // → lawful
      { id: 'shadow', goal: 'Exploit instability', pressure: 10, hostility: 15, lastMove: '' },  // → outlaw
      { id: 'greyfen-cutters', goal: 'Secure the peat bogs, find a smuggling route', pressure: 20, hostility: 10, lastMove: '' }, // → outlaw
      { id: 'merchant-league', goal: 'A stable ruler who honors old trade agreements', pressure: 15, hostility: 5, lastMove: '' }, // → neutral
    ],
    reputation: { factions: { civic: 0, shadow: 0, 'greyfen-cutters': 0, 'merchant-league': 0 } },
  };
}

test('U616-01: WORLD_VERSION is 34', () => {
  assert.equal(WORLD_VERSION, 34);
});

test('U616-02: a pre-v32 save WARNS and upgrades, deriving ethos for every faction', () => {
  const storage = mkStorage();
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(legacyV31Save()));

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  let loaded;
  try { loaded = loadSlot(storage, 'slot1'); }
  finally { console.warn = origWarn; }

  assert.ok(loaded, 'the legacy save loads');
  assert.equal(loaded.meta.version, WORLD_VERSION, 'upgraded to the current version');
  assert.equal(loaded.meta.version, 34);

  // Old saves must WARN before upgrade (When-Bumping protocol step 4, d50c49f precedent).
  assert.ok(warnings.length > 0, 'a version-mismatch warning fired');
  assert.ok(warnings[0].includes('v31') && warnings[0].includes('v34'),
    `the warning names both versions: ${warnings[0]}`);

  // Every faction gained a DERIVED ethos, from its authored id+goal.
  const ethos = Object.fromEntries(loaded.factions.map(f => [f.id, f.ethos]));
  assert.deepEqual(ethos, {
    civic: 'lawful',
    shadow: 'outlaw',
    'greyfen-cutters': 'outlaw',
    'merchant-league': 'neutral',
  }, 'ethos derived deterministically from goal/id keywords');

  // The upgraded world is invariant-clean (the new ethos enum invariant passes).
  assert.doesNotThrow(() => assertWorldInvariants(loaded), 'the upgraded world is invariant-clean');

  // No data loss: the pre-existing faction fields survive intact.
  const civic = loaded.factions.find(f => f.id === 'civic');
  assert.equal(civic.goal, 'Maintain order');
  assert.equal(civic.pressure, 10);
  assert.equal(loaded.reputation.factions.civic, 0, 'reputation keys preserved');
});

test('U616-03: derivation is idempotent — a stored ethos is kept, never re-derived', () => {
  // An outlaw-classified goal but an AUTHORED lawful ethos: the stored value wins.
  const f = { id: 'reformed-thieves', goal: 'Exploit every smuggling route we can find', ethos: 'lawful' };
  assert.equal(deriveFactionEthos(f), 'lawful', 'stored ethos passes through unchanged');
  // And re-running ensureFactions on an already-upgraded set does not flip anything.
  const once = ensureFactions([{ id: 'shadow', goal: 'Exploit instability' }]);
  assert.equal(once[0].ethos, 'outlaw');
  const twice = ensureFactions(once);
  assert.deepEqual(twice, once, 'ensureFactions is a fixed point once ethos is set');
});

test('U616-04: the ethos invariant rejects a stray value', () => {
  const w = ensureWorld(legacyV31Save());
  // Tamper with a faction after normalization to simulate a mutation that bypassed the door.
  const bad = JSON.parse(JSON.stringify(w));
  bad.factions[0].ethos = 'chaotic';
  assert.throws(() => assertWorldInvariants(bad), /factions\[0\]\.ethos must be one of/,
    'a value outside [lawful, outlaw, neutral] is a hard invariant failure');
});

test('U616-05: the demo defaults derive civic=lawful / shadow=outlaw through the same classifier', () => {
  const defaults = ensureFactions(null);
  const byId = Object.fromEntries(defaults.map(f => [f.id, f.ethos]));
  assert.equal(byId.civic, 'lawful');
  assert.equal(byId.shadow, 'outlaw');
});

// The version bump must be COMPLETE: no stale `=== 31` / `, 31` version ASSERTION may
// remain in the suite (When-Bumping step 5 — "grep version-embedded strings and fix
// them"). This guards against a half-finished bump the way a static grep would, but inside
// the suite. NOTE: `includes('v31')` is deliberately NOT flagged — post-bump, v31 is a
// legitimate OLD version a migration test may assert a save upgraded FROM (like v12/v15/v16
// elsewhere); only the current-version assertions below would be stale at 31.
test('U616-06: no stale version-31 target assertions remain in the test suite', () => {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(n => n.endsWith('.test.js'));
  const offenders = [];
  const patterns = [
    /WORLD_VERSION,\s*31\b/,
    /\.version,\s*31\b/,
    /WORLD_VERSION\s*===\s*31\b/,
  ];
  for (const n of files) {
    const src = fs.readFileSync(path.join(dir, n), 'utf8');
    src.split('\n').forEach((line, i) => {
      if (patterns.some(p => p.test(line))) offenders.push(`${n}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(offenders, [], `stale v31 version assertions found:\n${offenders.join('\n')}`);
});
