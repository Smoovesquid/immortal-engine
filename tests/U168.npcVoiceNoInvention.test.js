import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';

// Opus gate follow-up (2026-06-16, Lore-hound): under lore pressure NPCs
// invented unsupported specifics — a council seat count, the outpost's founding
// history and its "first elder" — instead of deflecting to hearsay/uncertainty
// when canon has no answer. The deflect decision and the final-line guard only
// forbade NAMES, leaving invented numbers/counts/dates/history allowed. Fix:
// the deflect instruction and the closing guard now forbid inventing ANY
// specific (numbers, counts, dates, names, titles, history) and steer toward
// pleading ignorance.

test('U168: the DEFLECT prompt forbids inventing numbers/counts/dates/history', () => {
  const p = buildNpcVoicePrompt({
    npcName: 'Senna', role: 'elder', mood: 'wary', manner: 'guarded', mode: 'deflected',
    playerLine: 'You said elders hold council — how many seats does it have, and who founded this outpost?'
  });
  assert.ok(p, 'deflect prompt is built');
  assert.match(p, /do not invent/i);
  assert.match(p, /numbers, counts, dates/i);
  // Steers the model toward uncertainty rather than fabrication.
  assert.match(p, /hearsay|plead ignorance|do not know|don't know|couldn't tell you/i);
});

test('U168: the closing one-line guard also bars invented specifics, not just names', () => {
  const p = buildNpcVoicePrompt({ npcName: 'Senna', mode: 'deflected', manner: 'even', playerLine: 'name the first elder' });
  assert.match(p, /Invent NO specifics|no numbers, counts, dates/i);
});
