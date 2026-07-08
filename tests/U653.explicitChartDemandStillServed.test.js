import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// DM-GATE-1c DIVERGE guard — H-40 preserved: a rules-lawyer who explicitly
// demands the chart ITSELF still gets the generated breakpoint table (it can
// never drift from the engine's real statMod). Only mid-action modifier asks
// (U652) stop falling into it.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'tallow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

test('U653-1: explicit chart demand still serves the table (H-40)', () => {
  const w = world();
  for (const q of [
    'Show me the full breakpoint chart down to 6.',
    'Give me the modifier table.',
  ]) {
    const ans = handleMetaQuestion(q, w);
    assert.ok(ans, `must answer: ${q}`);
    assert.match(ans, /Modifier breakpoints/i, `chart must be served for: ${q}`);
  }
});

test('U653-2: vague formula ask unchanged (U172-23 sibling)', () => {
  const w = world();
  const ans = handleMetaQuestion("What's the formula for modifiers?", w);
  assert.ok(ans);
  assert.match(ans, /10/);
  assert.match(ans, /2/);
  assert.doesNotMatch(ans, /roll/i);
});
