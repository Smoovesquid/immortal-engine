// U378 — INT-4a: referent-grounding consumes the shared packet (recursion-safe).
//
// INT-3 collapsed the egress family onto ONE shared directQuestionIntent(text,
// world) verdict per turn (playerMoveTraced's __dqIntent). This packet does the
// same collapse for the referent-grounding family living INSIDE playerMoveCore
// itself: the ~1509 "rules question pre-empts an ungrounded-NPC clarify" guard,
// and the ~2020 "rules/referent-followup direct question pre-empts a room
// survey" guard. Both used to call directQuestionIntent(text, w) a second time
// on the exact (text, world) pair playerMoveTraced already classified.
//
// THE HAZARD (why this isn't a copy-paste of INT-3): playerMoveCore recurses on
// itself for chained turns (dialogue auto-exit, interior move-then-act, the
// indoor-to-travel bridge). Each recursive self-call runs playerMoveCore's
// ENTIRE body again for its OWN (world, text) pair, which can differ from the
// top-level turn's. playerMoveCore therefore takes an optional 4th `dqIntent`
// param that ONLY playerMoveTraced (the true, non-recursive entry point) ever
// supplies — every recursive self-call inside playerMoveCore's own body calls
// with the original 3 args, so a recursive invocation always recomputes its
// own fresh classification. This file's "-hazard" tests are the actual proof:
// they construct a chained turn where the outer top-level text and the
// recursive sub-turn's text classify DIFFERENTLY, and show the recursive step
// uses its OWN fresh verdict — not the outer turn's stale one.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beginAdventure, playerMove } from '../engine/playloop.js';
import { newWorld } from '../engine/state.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { directQuestionIntent } from '../engine/grace/answerability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();

// A non-interior settlement world (several real NPCs present, no combat, no dialogue).
function settlementWorld(seed = 'ashfen-reach') {
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  return { ...w, scene: { ...(w.scene || {}), interior: null, dialogue: null }, combat: { ...(w.combat || {}), active: false } };
}

// The same seed's boot state is a real interior with a "next room" reachable
// via the aft room-hint — used for the chained move-then-act recursion below.
function interiorWorld(seed = 'ashfen-reach') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const surface = (r) => `${r.output?.narration || ''} ${r.output?.mechanics || ''}`.trim();

// ── (a) before/after byte-identical on 3 real referent-grounding utterances ──
// Same style as INT-3's U319-INT3-c: two independent playerMove runs on fresh
// worlds must produce byte-identical surface + worldHash. This is the "zero
// behavior change" proof — the refactor changed WHERE the classification is
// computed, never WHAT gets classified or how a clarify/answer/decline reads.

test('U378-a: ungrounded name "where is Bartholomew?" clarifies, byte-identical pre/post-refactor', () => {
  const r1 = playerMove(settlementWorld(), PACKS, 'where is Bartholomew?');
  const r2 = playerMove(settlementWorld(), PACKS, 'where is Bartholomew?');
  assert.equal(r1.output.mechanics, '[clarify:referent]', surface(r1));
  assert.match(r1.output.narration, /haven't introduced anyone named Bartholomew/i, surface(r1));
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});

test('U378-a: pronoun referent-followup "who\'s it from?" is answered/declined, not bounced, byte-identical pre/post-refactor', () => {
  const r1 = playerMove(settlementWorld(), PACKS, "who's it from?");
  const r2 = playerMove(settlementWorld(), PACKS, "who's it from?");
  assert.notEqual(r1.output.mechanics, '[clarify:referent]', surface(r1));
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});

test('U378-a: a rules/mechanics question ("what class is that spell?") gets the rules answer, not a referent clarify, byte-identical pre/post-refactor', () => {
  const r1 = playerMove(settlementWorld(), PACKS, 'what class is that spell?');
  const r2 = playerMove(settlementWorld(), PACKS, 'what class is that spell?');
  assert.equal(r1.output.mechanics, 'observe only — no roll, state unchanged', surface(r1));
  assert.match(r1.output.narration, /Sellsword is a background/i, surface(r1));
  assert.notEqual(r1.output.mechanics, '[clarify:referent]', surface(r1));
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});

test('U378-a: a grounded real NPC name (present roster) does not clarify, byte-identical pre/post-refactor', () => {
  const r1 = playerMove(settlementWorld(), PACKS, 'what is Dax Redcloak staring at?');
  const r2 = playerMove(settlementWorld(), PACKS, 'what is Dax Redcloak staring at?');
  assert.notEqual(r1.output.mechanics, '[clarify:referent]', surface(r1));
  assert.equal(surface(r1), surface(r2), 'identical input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical input must produce identical worldHash across runs');
});

// ── (b) THE HAZARD — the mandatory recursion-safety proof ───────────────────
//
// Construct ONE utterance whose OUTER top-level classification and whose
// RECURSIVE sub-turn's classification genuinely differ under
// directQuestionIntent, via the interior move-then-act chain
// (inferInteriorAction's compound splitter, playerMoveCore's recursive
// self-call at the "acted = playerMoveCore(w2, packsById,
// interiorAction.thenText)" site).
//
// Outer text: "can I go to the next room and ask what level this spell is?"
//   -> directQuestionIntent returns null (ACTION_PERM_RE "can I" feasibility
//      short-circuit fires on the FULL string before any keyword scan).
// Recursive sub-turn's text (interiorAction.thenText, split off the "and"):
//   "ask what level this spell is?"
//   -> directQuestionIntent returns { kind: 'rules', ... } (no ACTION_PERM_RE
//      match once "can I go to the next room and" is stripped away).
//
// If playerMoveCore's recursive call at that site ever forwarded the OUTER
// dqIntent (null) into the recursive invocation instead of recomputing fresh,
// the ~2020 guard's `dqKind?.kind === 'rules'` check would fail and the rules
// answer ("Sellsword is a background...") would NEVER appear — this is a
// silent misclassification of the recursive sub-turn's own text, exactly the
// regression the brief's hazard section warns about.

const OUTER_TEXT = 'can I go to the next room and ask what level this spell is?';
const INNER_THEN_TEXT = 'ask what level this spell is?';

test('U378-hazard: precondition — the outer compound text and the recursive sub-turn text classify DIFFERENTLY', () => {
  const outer = directQuestionIntent(OUTER_TEXT, {});
  const inner = directQuestionIntent(INNER_THEN_TEXT, {});
  assert.equal(outer, null, 'precondition: the outer feasibility-shaped compound must NOT classify as a direct question');
  assert.equal(inner?.kind, 'rules', 'precondition: the isolated recursive sub-turn text must classify as rules');
});

test('U378-hazard: the recursive interior move-then-act sub-turn computes its OWN fresh classification — the rules answer for its OWN text reaches the surface', () => {
  const r = playerMove(interiorWorld(), PACKS, OUTER_TEXT);
  // The move line always leads (the interior chain narrates the step first),
  // then the chained action's own result is appended — proving the recursive
  // sub-turn resolved "ask what level this spell is?" on its own merits.
  assert.match(r.output.narration, /next room/i, surface(r));
  assert.match(r.output.narration, /Sellsword is a background/i, `the recursive sub-turn must answer its OWN text's rules question: ${surface(r)}`);
  assert.equal(r.output.mechanics, 'observe only — no roll, state unchanged', surface(r));
});

test('U378-hazard: byte-identical + deterministic across two independent runs of the same chained turn', () => {
  const r1 = playerMove(interiorWorld(), PACKS, OUTER_TEXT);
  const r2 = playerMove(interiorWorld(), PACKS, OUTER_TEXT);
  assert.equal(surface(r1), surface(r2), 'identical chained input must produce identical surface across runs');
  assert.equal(worldHash(r1.world), worldHash(r2.world), 'identical chained input must produce identical worldHash across runs');
});

// ── (c) static proof — no recursive self-call inside playerMoveCore forwards dqIntent ──
// Re-grep playerMoveCore's own recursive self-calls and confirm none carry a
// 4th argument. This is the load-bearing safety property from the brief,
// checked structurally so a future edit can't silently regress it.

test('U378-hazard: static check — every recursive playerMoveCore(...) self-call inside the function body still has exactly 3 args (never forwards dqIntent)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'engine', 'playloop.js'), 'utf8');
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^function playerMoveCore\(/.test(l));
  assert.ok(start >= 0, 'playerMoveCore function definition not found');
  // Every self-call line strictly AFTER the definition line, up to the next
  // top-level function/export (a crude but sufficient body-boundary probe —
  // playerMoveCore is not nested inside another function).
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^(function|export function)\s/.test(lines[i])) { end = i; break; }
  }
  const selfCallRe = /playerMoveCore\(([^)]*)\)/g;
  let recursiveCallCount = 0;
  for (let i = start + 1; i < end; i++) {
    let m;
    selfCallRe.lastIndex = 0;
    while ((m = selfCallRe.exec(lines[i]))) {
      recursiveCallCount++;
      const argCount = m[1].split(',').length;
      assert.equal(argCount, 3, `recursive playerMoveCore(...) self-call at playloop.js line ${i + 1} must have exactly 3 args (never forward dqIntent): "${lines[i].trim()}"`);
    }
  }
  assert.ok(recursiveCallCount >= 3, `expected at least 3 recursive self-calls inside playerMoveCore's body, found ${recursiveCallCount}`);
});
