import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSystemPrompt } from '../engine/llmAdapter.js';

// Opus gate follow-up (2026-06-16, Lore-hound): a failed WITS check was
// narrated as a clean success — the canon names matched, but the prose
// revealed what the failed roll had not earned. The narration-polish system
// prompt's "mechanics are authoritative" rule only gave COMBAT examples (foe
// defeated / hit landed); nothing told the narrator that a failed
// recall/knowledge check means the information stays out of reach. The LLM
// receives the mechanics string (which carries "→ failure"), so the fix is a
// prompt rule that generalizes the authority of the outcome to failed checks.

function ctx(extra = {}) {
  return {
    placeName: "Wayfarers' Outpost",
    nodeType: 'settlement',
    tone: 'grim',
    interior: null,
    structuresHere: [],
    mechanicsText: '[focus:recall | roll:7 vs DC:12 → failure | stat:WITS-1]',
    actionText: 'name the elders of the council',
    ...extra
  };
}

test('U169: the narrate prompt forbids narrating a failed check as success', () => {
  const p = buildSystemPrompt(ctx());
  assert.match(p, /→ failure/);
  assert.match(p, /did NOT succeed/);
  assert.match(p, /recall\/knowledge\/perception/i);
});
