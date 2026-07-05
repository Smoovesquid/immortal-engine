import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packPath = resolve(__dirname, '..', 'packs', 'fantasy', 'ashenmoor', 'pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf-8'));

// NOTE (PACK-1, 2026-07-04): the ashenmoor pack shed four never-consumed
// top-level fields — `regions`, `npcs`, `seeds`, `toneVectors`. No engine code
// read any of them (the whitelist in engine/rulesets.js dropped them before the
// engine ever saw a pack). The assertions that pinned those fields were removed
// with them. `threads` and `factions` are now the two authored fields with live
// consumers (admitted through normalizePack and seeded at boot), so those stay.

describe('D01: Ashenmoor pack', () => {
  it('loads and has required fields', () => {
    assert.ok(pack.id, 'pack must have an id');
    assert.equal(pack.id, 'ashenmoor');
    assert.ok(Array.isArray(pack.locations), 'pack must have locations');
    assert.ok(pack.locations.length >= 20, `expected >= 20 locations, got ${pack.locations.length}`);
    assert.ok(Array.isArray(pack.threads), 'pack must have threads');
    assert.ok(pack.threads.length >= 3, `expected >= 3 threads, got ${pack.threads.length}`);
    assert.ok(Array.isArray(pack.factions), 'pack must have factions');
    assert.ok(Array.isArray(pack.npcArchetypes), 'pack must have npcArchetypes');
  });

  it('thread names are non-empty strings', () => {
    for (const thread of pack.threads) {
      assert.ok(typeof thread.name === 'string', 'thread name must be a string');
      assert.ok(thread.name.length > 0, 'thread name must be non-empty');
      assert.ok(typeof thread.id === 'string' && thread.id.length > 0, 'thread id must be non-empty');
    }
  });

  it('faction count matches prose (2)', () => {
    assert.equal(pack.factions.length, 2, 'expected exactly 2 factions');
    const ids = pack.factions.map(f => f.id);
    assert.ok(ids.includes('ember-quill'), 'must include ember-quill faction');
    assert.ok(ids.includes('greyfen-cutters'), 'must include greyfen-cutters faction');
  });
});
