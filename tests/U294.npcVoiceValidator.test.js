// U294 — validateNpcVoiceCandidate: deterministic fabrication guard for NPC voice output.
// ML-1: the /api/npc-voice route had only a length fence; Opus now ships fabricated names,
// years, or withheld secrets. This guard runs after every LLM return (Opus + Ollama) and
// rejects invented proper nouns, ungrounded 4-digit years, and withheld-mode secret leaks.
// claim_recall distortion is INTENTIONAL — we do NOT flag drift vs eventDescription.

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNpcVoiceCandidate } from '../engine/llmAdapter.js';

const BASE = {
  npcName: 'Kael', role: 'elder', factPhrase: 'the stored grain',
  playerLine: 'what do you know about the grain?',
  ragChunks: [], substrateContext: [], claim: null,
};

// ── proper-noun guard ──────────────────────────────────────────────────────────

test('U294: rejects invented proper noun in shared mode', () => {
  // "Aldren" is not in the grounding set (npcName=Kael, role=elder, factPhrase/playerLine have no Aldren)
  assert.equal(
    validateNpcVoiceCandidate('Ask Aldren the miller about it.', { ...BASE, mode: 'shared' }),
    false,
    'Invented mid-sentence proper noun must be rejected'
  );
});

test('U294: passes line with only grounded nouns and ordinary local color', () => {
  // "Kael" is grounded (npcName). "grain" is grounded. No mid-sentence invented caps.
  assert.equal(
    validateNpcVoiceCandidate('The grain troubles me greatly, traveler.', { ...BASE, mode: 'shared' }),
    true,
    'Grounded nouns + lowercase local color must pass'
  );
});

test('U294: passes grounded NPC name used mid-sentence', () => {
  const ctx = { ...BASE, mode: 'shared', npcName: 'Mira', role: 'merchant' };
  assert.equal(
    validateNpcVoiceCandidate('Ask Mira — she handles the accounts.', ctx),
    true,
    'NPC name from npcName field must be in ground set'
  );
});

// ── year guard ─────────────────────────────────────────────────────────────────

test('U294: rejects invented 4-digit year absent from all grounded sources', () => {
  assert.equal(
    validateNpcVoiceCandidate('In 1847 we had great troubles.', { ...BASE, mode: 'shared' }),
    false,
    'Ungrounded CE year must be rejected'
  );
});

test('U294: passes vague quantity ("a few")', () => {
  assert.equal(
    validateNpcVoiceCandidate('A few baskets, no more than that.', { ...BASE, mode: 'shared' }),
    true,
    'Vague non-year quantities must not be flagged'
  );
});

test('U294: passes year that appears in a grounded source (ragChunks)', () => {
  const ctx = {
    ...BASE, mode: 'shared',
    ragChunks: [{ text: 'The famine of 1203 left the valley barren.' }]
  };
  assert.equal(
    validateNpcVoiceCandidate('The famine of 1203 — yes, I remember.', ctx),
    true,
    'Year grounded in ragChunks must be allowed'
  );
});

// ── withheld-mode secret-leak guard ───────────────────────────────────────────

test('U294: withheld line leaking factPhrase is rejected', () => {
  const ctx = { ...BASE, mode: 'withheld', factPhrase: 'the grain is poisoned' };
  assert.equal(
    validateNpcVoiceCandidate('The grain is poisoned, but I will not say more.', ctx),
    false,
    'withheld mode: line containing the factPhrase must be rejected'
  );
});

test('U294: withheld line that does NOT reveal factPhrase passes', () => {
  const ctx = { ...BASE, mode: 'withheld', factPhrase: 'the grain is poisoned' };
  assert.equal(
    validateNpcVoiceCandidate("That's not something I can speak to.", ctx),
    true,
    'withheld mode: line that avoids the secret must pass'
  );
});

// ── claim_recall — distortion is intentional ──────────────────────────────────

test('U294: claim_recall distortion is NOT flagged (no invented proper nouns)', () => {
  // The NPC exaggerates a small scuffle into a burning — this is distortion, not fabrication.
  // No invented proper nouns, no ungrounded years → must pass.
  const ctx = {
    ...BASE, mode: 'claim_recall',
    factPhrase: 'the old trouble',
    claim: { eventDescription: 'a small scuffle near the gate', distortion: 3, provenance: [] }
  };
  assert.equal(
    validateNpcVoiceCandidate('They burned half the town and took everything.', ctx),
    true,
    'claim_recall distortion (magnitude/detail drift) must NOT be flagged'
  );
});

// ── edge cases ─────────────────────────────────────────────────────────────────

test('U294: empty line returns false', () => {
  assert.equal(validateNpcVoiceCandidate('', BASE), false);
});

test('U294: nouns from playerLine are in the ground set', () => {
  // "valley" appears in playerLine → grounded
  const ctx = { ...BASE, mode: 'shared', playerLine: 'tell me about the Westmarch valley' };
  assert.equal(
    validateNpcVoiceCandidate('The Westmarch has been cold this season.', ctx),
    true,
    'Proper noun from playerLine must be in ground set'
  );
});

test('U294: nouns from ragChunks text are grounded', () => {
  const ctx = {
    ...BASE, mode: 'shared',
    ragChunks: [{ text: 'The Thornwood spans three days east of the river.' }]
  };
  assert.equal(
    validateNpcVoiceCandidate('The Thornwood is no place for the unprepared.', ctx),
    true,
    'Proper noun from ragChunks must be in ground set'
  );
});

test('U294: nouns from substrateContext labels are grounded', () => {
  const ctx = {
    ...BASE, mode: 'shared',
    substrateContext: [{ layer: 'node', clarity: 'vivid', label: 'The founding of Ashenmoor', kind: 'settlement' }]
  };
  assert.equal(
    validateNpcVoiceCandidate('Ashenmoor was built by desperate hands.', ctx),
    true,
    'Proper noun from substrateContext label must be in ground set'
  );
});
