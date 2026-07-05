// U467 — PACK-1: `factions` is admitted + shape-normalized through the pack
// whitelist, malformed pack fields degrade safely (no throw), and the four
// genuinely-dead top-level fields (`regions`, `npcs`, `seeds`, `toneVectors`)
// are gone from every pack JSON — while normalizePack's output shape is
// unchanged for packs that never carried the newly-admitted fields.
//
// Context: normalizePack() used to be a strict 7-field whitelist. PACK-1 adds
// `threads` and `factions` (both have live engine consumers) and deletes four
// fields that NO engine code read. This test locks both halves: the two new
// fields are present + normalized, and the four dead ones are excised at the
// source (the JSON), not just at the whitelist.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');

const DEAD_FIELDS = ['regions', 'npcs', 'seeds', 'toneVectors'];
// The stable output shape normalizePack has always guaranteed, plus the two
// PACK-1 additions. Every normalized pack must expose exactly these keys.
const EXPECTED_KEYS = [
  'id', 'name', 'toneWords', 'starterLocations', 'starterObjectives',
  'starterGoals', 'skills', 'threads', 'factions'
].sort();

function loadRawPacks() {
  const m = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packs', 'manifest.json'), 'utf8'))
  );
  const out = [];
  for (const p of m.packs) {
    out.push({
      id: p.id,
      path: p.path,
      raw: JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path.replace(/^\//, '')), 'utf8'))
    });
  }
  return out;
}

test('U467-A: `factions` is admitted and normalized through normalizePack', () => {
  const raw = {
    id: 'x', name: 'X',
    factions: [
      { id: 'the-regency', name: 'The Regency', description: 'court', pressure: 65, hostility: 30, agenda: 'hold power' }
    ]
  };
  const out = normalizePack(raw);
  assert.ok(Array.isArray(out.factions), 'factions must be an array on the normalized pack');
  assert.equal(out.factions.length, 1);
  const f = out.factions[0];
  assert.equal(f.id, 'the-regency', 'faction id (the load-bearing key for ensureFactions) must survive');
  assert.equal(f.name, 'The Regency');
  assert.equal(f.pressure, 65);
  assert.equal(f.hostility, 30);
  assert.equal(typeof f.agenda, 'string');
});

test('U467-B: malformed `factions` degrades to a safe empty array (never throws)', () => {
  for (const bad of [undefined, null, 'not-an-array', 42, {}, [null, 3, 'x', {}]]) {
    let out;
    assert.doesNotThrow(() => { out = normalizePack({ id: 'x', name: 'X', factions: bad }); },
      `normalizePack must not throw on malformed factions: ${JSON.stringify(bad)}`);
    assert.ok(Array.isArray(out.factions), 'factions must always normalize to an array');
    // Entries lacking an id are dropped (garbage can't reach ensureFactions).
    assert.ok(out.factions.every(f => f && typeof f.id === 'string' && f.id.length > 0),
      'every surviving faction must have a non-empty string id');
  }
});

test('U467-C: malformed `threads` degrades to a safe empty array (never throws)', () => {
  for (const bad of [undefined, null, 'nope', 7, {}, [null, 1, {}, { id: 'x' }]]) {
    let out;
    assert.doesNotThrow(() => { out = normalizePack({ id: 'x', name: 'X', threads: bad }); },
      `normalizePack must not throw on malformed threads: ${JSON.stringify(bad)}`);
    assert.ok(Array.isArray(out.threads), 'threads must always normalize to an array');
    // A thread only counts if it carries a usable name (introduceThread's input).
    assert.ok(out.threads.every(t => t && typeof t.name === 'string' && t.name.length > 0),
      'every surviving thread must have a non-empty name');
  }
});

test('U467-D: the four dead fields are GONE from every pack JSON', () => {
  const packs = loadRawPacks();
  assert.ok(packs.length >= 9, 'sanity: manifest should list all packs');
  for (const { id, raw } of packs) {
    for (const dead of DEAD_FIELDS) {
      assert.ok(!(dead in raw), `pack "${id}" JSON must not carry the dead field "${dead}"`);
    }
  }
});

test('U467-E: normalizePack output shape is exactly the admitted key set (unchanged for packs that never had threads/factions)', () => {
  const packs = loadRawPacks();
  for (const { id, raw } of packs) {
    const out = normalizePack(raw);
    assert.deepEqual(Object.keys(out).sort(), EXPECTED_KEYS,
      `normalized pack "${id}" must expose exactly the admitted keys`);
    // A base pack with no authored threads/factions still gets empty arrays
    // (shape stable) rather than undefined.
    assert.ok(Array.isArray(out.threads), `normalized "${id}".threads must be an array`);
    assert.ok(Array.isArray(out.factions), `normalized "${id}".factions must be an array`);
  }
});

test('U467-F: base packs (fantasy et al.) carry empty threads/factions; sub-regions carry real ones', () => {
  const byId = {};
  for (const { id, raw } of loadRawPacks()) byId[id] = normalizePack(raw);
  // Base fantasy authored none directly.
  assert.equal(byId.fantasy.threads.length, 0, 'fantasy base pack has no directly-authored threads');
  assert.equal(byId.fantasy.factions.length, 0, 'fantasy base pack has no directly-authored factions');
  // Sub-regions carry the arcs that beginAdventure merges in.
  assert.ok(byId.crownlands.threads.length >= 2, 'crownlands carries story threads');
  assert.ok(byId.crownlands.factions.length >= 1, 'crownlands carries factions');
  assert.ok(byId.hallowed_reaches.threads.length >= 2, 'hallowed_reaches carries story threads');
});
