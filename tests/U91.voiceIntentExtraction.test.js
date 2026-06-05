import test from 'node:test';
import assert from 'node:assert/strict';

import {
  removeFillers,
  extractAction,
  extractTarget,
  scoreConfidence,
  extractIntent,
  isMovement,
  hasTarget,
  isSocial,
  isAttack,
  getClarificationPrompt
} from '../engine/voice/intentExtraction.js';

// ── U91 — Voice Intent Extraction (Speech → Action) ──────────────────

test('U91-01: removeFillers removes common filler words', () => {
  const input = "I want to smash the barrel";
  const cleaned = removeFillers(input);
  assert.ok(!cleaned.includes("want"));
  assert.ok(cleaned.includes("smash"));
  assert.ok(cleaned.includes("barrel"));
});

test('U91-02: removeFillers handles multiple fillers', () => {
  const input = "I would like to please try to hide behind the door";
  const cleaned = removeFillers(input);
  assert.ok(!cleaned.includes("would"));
  assert.ok(!cleaned.includes("like"));
  assert.ok(!cleaned.includes("please"));
  assert.ok(cleaned.includes("hide"));
});

test('U91-03: removeFillers cleans up extra spaces', () => {
  const input = "I    want    to    break   the    barrel";
  const cleaned = removeFillers(input);
  const spaces = cleaned.match(/\s+/g);
  assert.ok(!spaces || spaces.every(s => s.length === 1)); // single spaces only
});

test('U91-04: extractAction finds action verbs', () => {
  assert.equal(extractAction("smash the barrel"), 'break');
  assert.equal(extractAction("hide behind the door"), 'hide');
  assert.equal(extractAction("charge at the wolf"), 'charge');
  assert.equal(extractAction("talk to the goblin"), 'talk');
});

test('U91-05: extractAction normalizes synonyms', () => {
  assert.equal(extractAction("kick the barrel"), 'break');
  assert.equal(extractAction("destroy the chair"), 'break');
  assert.equal(extractAction("crouch behind the barrel"), 'hide');
  assert.equal(extractAction("run toward the door"), 'run');
});

test('U91-06: extractAction returns null for unknown verbs', () => {
  assert.equal(extractAction("wonder about the barrel"), null);
  assert.equal(extractAction("the barrel is wooden"), null);
});

test('U91-07: extractTarget extracts object of action', () => {
  assert.equal(extractTarget("smash the barrel"), 'barrel');
  assert.equal(extractTarget("hide behind the door"), 'door');
  assert.equal(extractTarget("attack the goblin"), 'goblin');
});

test('U91-08: extractTarget handles optional article', () => {
  assert.equal(extractTarget("break barrel"), 'barrel');
  assert.equal(extractTarget("take a torch"), 'torch');
  assert.equal(extractTarget("hit the wolf"), 'wolf');
});

test('U91-09: extractTarget ignores articles in result', () => {
  const target = extractTarget("the barrel is wooden");
  assert.notEqual(target, 'the');
  assert.notEqual(target, 'a');
});

test('U91-10: scoreConfidence gives high score for clear intent', () => {
  const score = scoreConfidence("break the barrel", "break the barrel", 'break', 'barrel');
  assert.ok(score >= 0.8);
});

test('U91-11: scoreConfidence reduces for missing action', () => {
  const score = scoreConfidence("the barrel", "the barrel", null, 'barrel');
  assert.ok(score < 0.7);
});

test('U91-12: scoreConfidence reduces for missing target', () => {
  const score = scoreConfidence("break", "break", 'break', null);
  assert.ok(score < 0.8);
});

test('U91-13: scoreConfidence clamps to 0-1 range', () => {
  const score1 = scoreConfidence("", "", null, null);
  assert.ok(score1 >= 0 && score1 <= 1);

  const score2 = scoreConfidence("break the barrel", "break the barrel", 'break', 'barrel');
  assert.ok(score2 >= 0 && score2 <= 1);
});

test('U91-14: extractIntent produces normalized intent', () => {
  const result = extractIntent("I want to smash the barrel");
  assert.equal(result.intent, 'break the barrel');
  assert.equal(result.action, 'break');
  assert.equal(result.target, 'barrel');
});

test('U91-15: extractIntent returns high confidence for clear input', () => {
  const result = extractIntent("smash the barrel");
  assert.ok(result.confidence >= 0.8);
});

test('U91-16: extractIntent returns low confidence for ambiguous input', () => {
  const result = extractIntent("the thing");
  assert.ok(result.confidence < 0.7);
});

test('U91-17: extractIntent includes original transcription', () => {
  const original = "I want to break the wooden barrel";
  const result = extractIntent(original);
  assert.equal(result.original, original);
});

test('U91-18: extractIntent handles null input gracefully', () => {
  const result = extractIntent(null);
  assert.equal(result.action, null);
  assert.equal(result.target, null);
  assert.ok(result.confidence === 0);
});

test('U91-19: extractIntent handles empty string gracefully', () => {
  const result = extractIntent("");
  assert.equal(result.action, null);
  assert.ok(result.confidence < 0.5);
});

test('U91-20: extractIntent normalizes multiple synonyms', () => {
  assert.equal(extractIntent("destroy the door").intent, 'break the door');
  assert.equal(extractIntent("sneak behind the barrel").intent, 'hide the barrel');
  assert.equal(extractIntent("rush at the wolf").intent, 'charge the wolf');
});

test('U91-21: isMovement detects movement actions', () => {
  assert.ok(isMovement('run toward the door'));
  assert.ok(isMovement('charge at the wolf'));
  assert.ok(isMovement('move to the corner'));
  assert.ok(!isMovement('break the barrel'));
});

test('U91-22: hasTarget detects targets', () => {
  assert.ok(hasTarget('break the barrel'));
  assert.ok(hasTarget('hide the goblin'));
  assert.ok(!hasTarget('retreat'));
  assert.ok(!hasTarget('run'));
});

test('U91-23: isSocial detects social actions', () => {
  assert.ok(isSocial('talk to the goblin'));
  assert.ok(isSocial('ask the npc'));
  assert.ok(!isSocial('break the barrel'));
  assert.ok(!isSocial('attack the wolf'));
});

test('U91-24: isAttack detects attack actions', () => {
  assert.ok(isAttack('attack the goblin'));
  assert.ok(isAttack('hit the wolf'));
  assert.ok(isAttack('strike the enemy'));
  assert.ok(!isAttack('hide behind the barrel'));
});

test('U91-25: getClarificationPrompt returns null for high confidence', () => {
  const extracted = extractIntent('break the barrel');
  const prompt = getClarificationPrompt(extracted);
  assert.equal(prompt, null); // high confidence, no clarification needed
});

test('U91-26: getClarificationPrompt suggests action for missing target', () => {
  const extracted = {
    original: 'break',
    action: 'break',
    target: null,
    confidence: 0.5
  };
  const prompt = getClarificationPrompt(extracted);
  assert.ok(prompt && prompt.includes('break'));
});

test('U91-27: getClarificationPrompt asks for action if missing', () => {
  const extracted = {
    original: 'the thing',
    action: null,
    target: null,
    confidence: 0.3
  };
  const prompt = getClarificationPrompt(extracted);
  assert.ok(prompt && prompt.includes('What do you want to do'));
});

test('U91-28: extractIntent works with real voice examples', () => {
  const examples = [
    { input: 'I want to hide behind that barrel', expectedAction: 'hide', expectedTarget: 'barrel' },
    { input: 'can I examine the wooden door', expectedAction: 'examine', expectedTarget: 'door' },
    { input: 'I try to charge at the wolf', expectedAction: 'charge', expectedTarget: 'wolf' },
    { input: 'let me take the torch', expectedAction: 'take', expectedTarget: 'torch' },
    { input: 'please talk to the goblin', expectedAction: 'talk', expectedTarget: 'goblin' }
  ];

  for (const ex of examples) {
    const result = extractIntent(ex.input);
    assert.equal(result.action, ex.expectedAction, `Failed for: ${ex.input}`);
    assert.equal(result.target, ex.expectedTarget, `Failed for: ${ex.input}`);
  }
});

test('U91-29: extractIntent intent is injectable to adjudicate', () => {
  // The normalized intent should be suitable for passing to adjudicate()
  const result = extractIntent('I want to break the wooden barrel');
  assert.ok(result.intent.includes('break'));
  assert.ok(result.intent.includes('barrel'));
  assert.ok(!result.intent.includes('want'));
  assert.ok(!result.intent.includes('wooden')); // adjudicate handles material detection
});

test('U91-30: extractIntent deterministic (same input = same output)', () => {
  const input = 'I want to hide behind the barrel';
  const r1 = extractIntent(input);
  const r2 = extractIntent(input);

  assert.equal(r1.intent, r2.intent);
  assert.equal(r1.action, r2.action);
  assert.equal(r1.target, r2.target);
  assert.equal(r1.confidence, r2.confidence);
});
