// U472 — PACK-3 guardrails: admitting `objectives` must NOT create a quest-log
// surface (Tim's hard law: goals/objectives are obscure and player-held, never
// enumerated to the player), packs WITHOUT the trio must still boot identically
// (the graceful fallback path is preserved), and the enrichment stays
// deterministic under replay.
//
// The no-quest-log law is structural: the pack's authored objectives pool is
// consumed AT BOOT into a single `scene.objective` string. There is no plural
// `objectives` collection on the runtime world or scene, and the live renderer
// (public/v1.js) reads exactly one objective string — the old renderGoalsSection
// "Goal tracker" panel was deleted. Admission enlarges the pool the single line
// is drawn from; it does not change how (or how many) objectives reach the player.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.join(__dirname, '..');

function loadNormalizedPacks() {
  const m = normalizeManifest(
    JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'packs', 'manifest.json'), 'utf8'))
  );
  const byId = {};
  for (const p of m.packs) {
    byId[p.id] = normalizePack(
      JSON.parse(fs.readFileSync(path.join(REPO_ROOT, p.path.replace(/^\//, '')), 'utf8'))
    );
  }
  return byId;
}

function boot(seed, { fate = 0.3, mode = 'escape', packs = null } = {}) {
  const P = packs || loadNormalizedPacks();
  const w = newWorld({ seed, fate, mode, pack: { primaryId: 'fantasy', mixerId: null } });
  return beginAdventure(w, P).world;
}

test('U472-A: the player-visible objective surface is a SINGLE string, never a list', () => {
  for (const mode of ['escape', '']) {
    for (const seed of ['tallow', 'w1', 'ridge', 'q7']) {
      const w = boot(seed, { mode });
      const obj = w.scene?.objective;
      assert.equal(typeof obj, 'string', `[${mode}/${seed}] scene.objective must be a string`);
      assert.ok(!Array.isArray(obj), `[${mode}/${seed}] scene.objective must never be an array`);
      // No plural objectives collection anywhere a renderer could enumerate.
      assert.ok(!('objectives' in (w.scene || {})), `[${mode}/${seed}] scene must not expose a plural objectives list`);
      assert.ok(!('objectives' in w), `[${mode}/${seed}] world must not expose a plural objectives list`);
    }
  }
});

test('U472-B: the live renderer never enumerates objectives (no quest-log panel)', () => {
  // public/v1.js is the live play surface. The old renderGoalsSection "Goal
  // tracker" was deleted; the renderer reads exactly one objective string.
  const v1 = fs.readFileSync(path.join(REPO_ROOT, 'public', 'v1.js'), 'utf8');
  // Strip line comments so the removal note ("// (Removed: renderGoalsSection…")
  // doesn't count as a live reference.
  const codeOnly = v1
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n');
  assert.ok(!/renderGoalsSection\s*\(/.test(codeOnly),
    'no live renderGoalsSection() call may exist (the goal-tracker panel is removed)');
  assert.ok(!/objectives\s*\.\s*(map|forEach|join)/.test(codeOnly),
    'the renderer must not map/forEach/join over an objectives collection');
  // It DOES read the single scene.objective string — that in-fiction line is
  // allowed. (Live access uses optional chaining: `w?.scene?.objective`.)
  assert.ok(/scene\??\.objective/.test(codeOnly),
    'sanity: the renderer reads the single scene.objective line');
});

test('U472-C: a pack WITHOUT the trio boots identically to the graceful fallback path', () => {
  // Simulate a pack whose authored trio never existed: strip the three fields to
  // empty, forcing the exact starterLocations/starterObjectives/hardcoded-motif
  // fallback that shipped before admission. The boot must not throw and must land
  // its objective in the 3-item starter pool (proving the fallback still works).
  const P = loadNormalizedPacks();
  const stripped = {};
  for (const [id, pack] of Object.entries(P)) {
    stripped[id] = { ...pack, locations: [], objectives: [], sensoryMotifs: [] };
  }
  const starter = new Set(P.fantasy.starterObjectives);
  for (const seed of ['tallow', 'abc']) {
    const w = boot(seed, { mode: '', packs: stripped });
    const obj = w.scene?.objective;
    assert.ok(typeof obj === 'string' && obj.length > 0, `[${seed}] fallback still yields an objective`);
    assert.ok(starter.has(obj), `[${seed}] with an empty authored pool, objective falls back to a starterObjective ("${obj}")`);
  }
  // Determinism of the fallback path is preserved too.
  assert.equal(
    worldHash(boot('tallow', { mode: '', packs: stripped })),
    worldHash(boot('tallow', { mode: '', packs: stripped })),
    'the fallback boot is deterministic ×2'
  );
});

test('U472-D: worldHash replay is deterministic ×2 for the enriched boot (both default seeds, both modes)', () => {
  for (const seed of ['tallow', 'aldermere']) {
    for (const mode of ['escape', '']) {
      assert.equal(
        worldHash(boot(seed, { mode })),
        worldHash(boot(seed, { mode })),
        `[${seed}/${mode}] enriched boot must hash identically ×2`
      );
    }
  }
});
