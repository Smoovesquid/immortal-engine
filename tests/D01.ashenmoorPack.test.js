import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packPath = resolve(__dirname, '..', 'packs', 'fantasy', 'ashenmoor', 'pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf-8'));

describe('D01: Ashenmoor pack', () => {
  it('loads and has required fields', () => {
    assert.ok(pack.id, 'pack must have an id');
    assert.equal(pack.id, 'ashenmoor');
    assert.ok(Array.isArray(pack.locations), 'pack must have locations');
    assert.ok(pack.locations.length >= 20, `expected >= 20 locations, got ${pack.locations.length}`);
    assert.ok(Array.isArray(pack.npcs), 'pack must have npcs');
    assert.ok(pack.npcs.length >= 6, `expected >= 6 npcs, got ${pack.npcs.length}`);
    assert.ok(Array.isArray(pack.threads), 'pack must have threads');
    assert.ok(pack.threads.length >= 3, `expected >= 3 threads, got ${pack.threads.length}`);
    assert.ok(Array.isArray(pack.factions), 'pack must have factions');
    assert.ok(Array.isArray(pack.seeds), 'pack must have seeds');
    assert.ok(pack.seeds.length >= 15, `expected >= 15 seeds, got ${pack.seeds.length}`);
    assert.ok(pack.toneVectors && typeof pack.toneVectors === 'object', 'pack must have toneVectors');
  });

  it('all NPC archetypes exist in the npcArchetypes list', () => {
    const archetypeSet = new Set(pack.npcArchetypes.map(a => {
      // Strip trailing " (N)" numbering
      return a.replace(/\s*\(\d+\)\s*$/, '');
    }));
    for (const npc of pack.npcs) {
      assert.ok(
        archetypeSet.has(npc.archetype),
        `NPC "${npc.name}" archetype "${npc.archetype}" not found in npcArchetypes`
      );
    }
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

  it('has 4 regions with adjacency', () => {
    assert.ok(Array.isArray(pack.regions), 'pack must have regions');
    assert.equal(pack.regions.length, 4, 'expected 4 regions');
    for (const region of pack.regions) {
      assert.ok(typeof region.id === 'string' && region.id.length > 0, 'region must have id');
      assert.ok(Array.isArray(region.adjacent), 'region must have adjacent array');
      assert.ok(region.adjacent.length > 0, `region "${region.id}" must have at least one adjacent region`);
    }
  });

  it('seeds have required shape', () => {
    for (const seed of pack.seeds) {
      assert.ok(typeof seed.id === 'string' && seed.id.length > 0, 'seed must have id');
      assert.ok(typeof seed.tag === 'string' && seed.tag.length > 0, 'seed must have tag');
      assert.ok(typeof seed.hint === 'string' && seed.hint.length > 0, 'seed must have hint');
    }
  });
});
