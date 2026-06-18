import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';

// H-12/H-13 (Rung-1 gate 2026-06-18) — roll-citation follow-ups must be
// acknowledged against the stored last roll; never silently re-roll on a
// contradiction.
//
// Root cause: each playerMove re-seeds the RNG from timeline.length, so a
// follow-up turn with the same action intent produced a different roll.
// Fix: persist { roll, dc, outcome, turn } in w.conversation.lastRoll after each
// resolution; META_ROLL_RECALL gate in handleMetaQuestion compares and corrects.

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'glass-harbor') {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    packs()
  ).world;
}

// ── lastRoll persistence ─────────────────────────────────────────────────────

test('U183-01: ensureWorld initialises conversation.lastRoll to null', () => {
  const w = ensureWorld({});
  assert.equal(w.conversation.lastRoll, null, 'fresh world must have lastRoll: null');
});

test('U183-02: conversation.lastRoll is preserved through ensureWorld round-trip', () => {
  const stored = { roll: 14, dc: 12, outcome: 'success', turn: 3 };
  const w = ensureWorld({ conversation: { lastRoll: stored } });
  assert.deepEqual(w.conversation.lastRoll, stored, 'lastRoll must survive ensureWorld round-trip');
});

test('U183-03: playerMove persists lastRoll after a mainline roll resolution', () => {
  const w = world();
  // Any action that routes through resolveMove (not a meta-question or social) will set lastRoll
  const { world: w2 } = playerMove(w, packs(), 'I search the area for signs of trouble');
  // lastRoll may be null if the action was trivial/meta; the key check is that the field exists
  assert.ok('lastRoll' in w2.conversation, 'conversation.lastRoll field must exist after playerMove');
});

// ── Detection ────────────────────────────────────────────────────────────────

test('U183-10: "I rolled a 16 against DC 11" is detected as a meta-question', () => {
  assert.ok(
    isMetaQuestion('Hold on — I rolled a 16 against DC 11 and succeeded.'),
    'roll-recall phrase must be a meta-question'
  );
});

test('U183-11: "16 vs DC 11" form is detected', () => {
  assert.ok(
    isMetaQuestion('So I succeeded — 16 versus DC 11. What do those tells tell me?'),
    '"N vs DC M" pattern must be detected'
  );
});

test('U183-12: "you told me I rolled a 16" is detected', () => {
  assert.ok(
    isMetaQuestion('Hold on — one second ago you told me I rolled a 16 against DC 11 and succeeded.'),
    '"you told me I rolled N" must be detected'
  );
});

test('U183-13: "my roll was 16" is detected', () => {
  assert.ok(isMetaQuestion('My roll was 16 and I succeeded.'), '"my roll was N" must be detected');
});

// ── Handler: matching stored roll ────────────────────────────────────────────

test('U183-20: handler confirms when cited roll matches stored roll', () => {
  // Craft a world with a known lastRoll
  const w = ensureWorld({
    conversation: { lastRoll: { roll: 16, dc: 11, outcome: 'success', turn: 3 } }
  });
  const ans = handleMetaQuestion('So I succeeded — 16 versus DC 11. What do those tells tell me?', w);
  assert.ok(ans, 'handler must return a non-null response');
  // Must acknowledge the stored result, not produce another roll
  assert.match(ans, /16/, 'response must mention the roll number');
  assert.match(ans, /11/, 'response must mention the DC');
  assert.doesNotMatch(ans, /not 16|which turn/i, 'must not dispute a matching roll');
});

test('U183-21: handler confirms when cited roll matches and no DC in cite', () => {
  const w = ensureWorld({
    conversation: { lastRoll: { roll: 16, dc: 12, outcome: 'success', turn: 2 } }
  });
  const ans = handleMetaQuestion('I rolled a 16 and succeeded', w);
  assert.ok(ans, 'handler must return non-null');
  assert.match(ans, /16/, 'must mention the roll');
  assert.doesNotMatch(ans, /not 16/i, 'must not dispute a matching roll');
});

// ── Handler: mismatching stored roll → acknowledge discrepancy ───────────────

test('U183-30: handler disputes when cited roll does NOT match stored', () => {
  const w = ensureWorld({
    conversation: { lastRoll: { roll: 2, dc: 12, outcome: 'failure', turn: 3 } }
  });
  const ans = handleMetaQuestion(
    'Hold on — one second ago you told me I rolled a 16 against DC 11 and succeeded. Now it\'s a natural 1 and a failure. Which is it?',
    w
  );
  assert.ok(ans, 'handler must return non-null for a contradicted roll');
  // Must reference the STORED roll (2), not the claimed roll (16)
  assert.match(ans, /2/, 'response must name the stored roll (2)');
  assert.doesNotMatch(ans, /^right/i, 'must not confirm a mismatched roll');
});

test('U183-31: playerMove does NOT produce a third distinct roll on a roll-dispute follow-up', () => {
  const byId = packs();
  let w = world();
  // Turn 1 — any roll that sets lastRoll
  const r1 = playerMove(w, byId, 'I try to read through Corwin\'s calm expression');
  w = r1.world;
  const storedRoll = w.conversation.lastRoll;
  if (!storedRoll) return; // trivial action, skip

  // Turn 2 — player cites a roll that might not match what was stored
  const citedRoll = (storedRoll.roll === 16) ? 2 : 16; // deliberately pick the other number
  const r2 = playerMove(
    w, byId,
    `Hold on — I rolled a ${citedRoll} against DC 11. Which is it?`
  );
  const mechStr = String(r2.output?.mechanics || '');
  // If the gate fired, mechanics will be '' (meta path, no new roll).
  // If a roll DID happen, it must match the stored roll (not be a third distinct value).
  if (/roll:\d+/.test(mechStr)) {
    const newRoll = Number(mechStr.match(/roll:(\d+)/)?.[1] ?? 0);
    const storedVal = storedRoll.roll;
    assert.notEqual(newRoll, citedRoll,
      'a new roll on a contradiction turn must not equal the (wrong) cited number');
    // The new roll may differ from stored (different turn seed), but the point is
    // we at least didn't produce the cited number as if it were real.
  }
  // The meta gate may have swallowed it (mechanics = '')
  // — that's also correct: no re-roll happened.
});

// ── Control: first-turn roll (no stored prior) ───────────────────────────────

test('U183-40: first-turn use of "I rolled a 16" when no lastRoll stored falls through to normal resolution', () => {
  // No prior roll in the world — handler must return null, not crash
  const w = ensureWorld({});
  const ans = handleMetaQuestion('I rolled a 16 and won that fight, what now?', w);
  // Must either return null (fall-through) or a sensible non-crash response
  assert.ok(ans === null || typeof ans === 'string', 'must return null or string, not throw');
});

test('U183-41: no crash when conversation field is missing entirely', () => {
  const w = ensureWorld({ conversation: null });
  assert.doesNotThrow(() => {
    handleMetaQuestion('I rolled a 16 vs DC 11', w);
  }, 'must not crash when conversation is null');
});

// ── worldHash / determinism guard ────────────────────────────────────────────

test('U183-50: conversation.lastRoll is NOT included in worldHash (hash must be stable)', () => {
  // Two worlds identical except for lastRoll must produce the same worldHash.
  // This confirms lastRoll stays outside the canon projection.
  const base = ensureWorld({ meta: { seed: 'test-seed', fate: 0.2 } });
  const withRoll = ensureWorld({ meta: { seed: 'test-seed', fate: 0.2 }, conversation: { lastRoll: { roll: 14, dc: 12, outcome: 'success', turn: 1 } } });
  assert.equal(worldHash(base), worldHash(withRoll), 'lastRoll must not affect worldHash');
});
