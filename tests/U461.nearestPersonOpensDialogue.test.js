// U461 — ANS-2 (case 2): a DELEGATED "who's the nearest person — give me a name
// and let me talk to them" resolves — pick the nearest/most-salient present NPC
// deterministically, name them, and OPEN the interaction (the same dialogue state
// an explicit "talk to X" reaches). Clarify only when the ask is genuinely
// ambiguous AND nothing is resolvable (a bare "talk to someone", no delegation).
//
// Opus gate 2026-07-04-3, Rules-Lawyer: "Who's the nearest person out here — give
// me a name and let me talk to them." → listed four names + [clarify:who] instead
// of resolving the interaction the player explicitly delegated.
//
// Fix: the vague-talk branch (playloop) detects a delegation cue and resolves it
// to a deterministic pick (pickDelegatedTalkNpc), then runs the standard talk-open
// flow. The question-egress no longer overwrites a JUST-OPENED dialogue's greeting.
//
// Deterministic, LLM-off: ×2 identical boots resolve identically.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const runFull = (text) => playerMove(boot(), PACKS, text);

const CLARIFY_RE = /who do you want to talk to|\[clarify:who\]/i;

test('U461-01: the gate line "Who\'s the nearest person out here — give me a name and let me talk to them." OPENS a dialogue (no clarify punt)', () => {
  const res = runFull("Who's the nearest person out here — give me a name and let me talk to them.");
  assert.ok(res.world?.scene?.dialogue?.npcId, 'a dialogue is now active (the interaction opened)');
  assert.doesNotMatch(String(res.output.mechanics), /\[clarify:who\]/i, 'not a clarify punt');
  assert.match(String(res.output.mechanics), /dialogue enter/i, 'the same dialogue-enter resolution "talk to X" produces');
  assert.doesNotMatch(String(res.output.narration), /who do you want to talk to/i, 'the greeting is shown, not a name list');
});

test('U461-02: the picked NPC is named in the greeting (deterministic salient pick)', () => {
  const res = runFull("Who's the nearest person out here — give me a name and let me talk to them.");
  // Salience: the representative ranks first among present non-hostiles.
  assert.match(String(res.output.narration), /Elske Nightherd/i, 'names the most-salient present NPC');
});

test('U461-03: other delegation phrasings resolve the same way ("let me talk to the nearest person" / "talk to whoever is closest")', () => {
  for (const line of ['let me talk to the nearest person', 'talk to whoever is closest']) {
    const res = runFull(line);
    assert.ok(res.world?.scene?.dialogue?.npcId, `"${line}" opens a dialogue`);
    assert.doesNotMatch(String(res.output.mechanics), /\[clarify:who\]/i, `"${line}" is not a clarify punt`);
  }
});

test('U461-04: a genuinely ambiguous "talk to someone" (NO delegation cue) STILL clarifies', () => {
  const res = runFull('talk to someone');
  assert.match(String(res.output.mechanics) + String(res.output.narration), CLARIFY_RE, 'bare vague talk still clarifies (U219/UX2 preserved)');
  assert.ok(!res.world?.scene?.dialogue, 'no dialogue opened on the ambiguous ask');
});

test('U461-05: a NAMED talk ("talk to Dalla") is unaffected — opens dialogue with the named NPC', () => {
  const res = runFull('talk to Dalla');
  assert.ok(res.world?.scene?.dialogue?.npcId, 'named talk opens a dialogue');
  assert.match(String(res.output.narration), /Dalla/i, 'with the named NPC, not the delegated pick');
});

test('U461-06: deterministic ×2 — the delegated pick + greeting is byte-identical on repeat boots (LLM-off)', () => {
  const a = runFull("Who's the nearest person out here — give me a name and let me talk to them.");
  const b = runFull("Who's the nearest person out here — give me a name and let me talk to them.");
  assert.equal(String(a.output.narration), String(b.output.narration), 'identical narration on replay');
  assert.equal(String(a.world?.scene?.dialogue?.npcId), String(b.world?.scene?.dialogue?.npcId), 'same NPC picked on replay');
});
