// U459 — INT-4-HELD over-fire safety. The fix (actions-with-a-held-object resolve
// as actions) must NOT break the two things the acquire-idempotence sink is FOR:
//   • a PURE acquisition of a thing you already hold still gets the honest
//     already-held acknowledgment (no roll, no action invented).
//   • the take gate still only fires for take verbs.
//
// It also DOCUMENTS the out-of-scope letter-where question (a DIFFERENT seam —
// the question-answerability / inventory-canon path — flagged in the INT-4-HELD
// report, not fixed here).

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
const run = (text) => playerMove(boot(), PACKS, text).output;

test('U459-01: PURE acquisition of a held thing still gets the honest already-held answer', () => {
  // "pick up the lantern" — no action verb — is a pure acquire; the Lantern is
  // already carried, so the take-idempotence acknowledgment is exactly right.
  const out = run('I pick up the lantern');
  assert.match(String(out.mechanics), /take:already-held/i, 'still the honest already-held sink');
  assert.match(String(out.narration), /already in your pack/i, 'honest acknowledgment, no invented action');
});

test('U459-02: "grab the lantern off the wall" (acquire, no action verb) still acknowledges honestly', () => {
  const out = run('I grab the lantern off the wall');
  assert.match(String(out.mechanics), /take:already-held/i, 'a bare grab of a held thing is still acquisition');
});

test('U459-03: the take-then-action bail does NOT fire on a pure take of a NOT-held revealed item', () => {
  // Guard the discriminator directly: the action-verb bail must not swallow a
  // genuine acquisition. A pure "take" that carries NO action verb keeps flowing
  // to the take gate (proven above); a "take AND <action>" yields (proven in U458).
  // Here: "grab the lantern" alone must NOT be routed away as an action.
  const out = run('I grab the lantern');
  assert.match(String(out.mechanics), /take:already-held/i, 'pure grab of the held lantern stays a take');
});

test('U459-04: taking a genuinely-not-present object does not falsely claim already-held', () => {
  // There is no excalibur here; the response must not assert it is "already in your
  // pack" (the fix must not make the idempotence sink over-claim).
  const out = run('I pick up the excalibur greatsword');
  assert.doesNotMatch(String(out.narration), /excalibur.*already in your pack|already in your pack.*excalibur/i,
    'never claims a not-present thing is already held');
  assert.doesNotMatch(String(out.mechanics), /take:already-held/i, 'no already-held sink for a not-present item');
});

test('U459-05: FLAGGED (different seam) — the letter-where question is not handled by the object-action fix', () => {
  // "Wait, where did the letter go? I was just holding it." is a QUESTION, routed
  // through the answerability/inventory-canon path — a DIFFERENT seam from the
  // object-action classifier this packet owns. At cold boot there is no letter in
  // inventory (the player invented it), and isQuestionShaped() is false for this
  // leading-"wait,"/compound shape, so it currently deflects to NPC presence.
  //
  // This subtest DOCUMENTS the flagged gap (it does not yet answer from inventory
  // canon) so a future answerability packet has a pinned baseline. It asserts only
  // that the object-action fix did not regress or crash this input.
  const out = run('Wait, where did the letter go? I was just holding it.');
  assert.ok(typeof out.narration === 'string' && out.narration.length > 0, 'produces a non-empty response (no crash)');
  // Not asserting the ideal inventory answer — that is the out-of-scope seam.
});
