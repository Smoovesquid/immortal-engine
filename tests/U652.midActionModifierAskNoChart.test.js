import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// DM-GATE-1c (Opus gate 2026-07-07, Rules-Lawyer t9, seed tallow, DM_ARTIFACT_LEAK):
// mid-attack, "what modifier am I adding to the damage?" fell past META_DAMAGE_RULE's
// yes/no shapes into META_MODIFIER_FORMULA's last resort — the raw breakpoint chart.
// H-40's own rule ("the table survives only when no specific target was named") has
// a hole: damage/attack context IS a specific target. A real DM says the number.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'tallow') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs()).world;
}

const T9 = 'My +0 attack bonus means my ability modifier is 0 — so what modifier am I adding to the damage? It should be the same 0. Roll the 1d6 and tell me the result.';

test('U652-1: gate t9 verbatim — concrete damage-modifier answer, never the chart', () => {
  const w = world();
  const ans = handleMetaQuestion(T9, w);
  assert.ok(ans, 'must be handled as a meta answer');
  assert.doesNotMatch(ans, /Modifier breakpoints/i, 'the raw breakpoint chart is a DM artifact');
  assert.doesNotMatch(ans, /\b\d+\s*(?:–|-)\s*\d+\s*→/, 'no score-range→mod chart rows');
  assert.match(ans, /damage/i, 'must answer the damage half the player asked about');
  assert.match(ans, /[+−-]\d/, 'must state a concrete signed modifier');
});

test('U652-2: attack-context modifier asks get the number, not the chart', () => {
  const w = world();
  for (const q of [
    'What ability modifier am I adding to the damage roll?',
    'Which modifier goes into my attack — walk me through the ability modifier?',
  ]) {
    const ans = handleMetaQuestion(q, w);
    assert.ok(ans, `must answer: ${q}`);
    assert.doesNotMatch(ans, /Modifier breakpoints/i, `chart leaked for: ${q}`);
    assert.match(ans, /[+−-]\d/, `no concrete modifier for: ${q}`);
  }
});
