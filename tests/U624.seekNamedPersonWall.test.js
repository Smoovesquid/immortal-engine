import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { DEMO_SEED } from '../engine/world/demoRegion.js';
import { worldHash } from '../engine/worldHash.js';

// SEEK-3 regression wall. The named-person seek fix (extractSeekNameRef + the seek-name
// precedence over a vague pronoun talkRef) must NOT loosen the guards the sibling paths
// depend on, and must be deterministic. Self-equality only — the boot-worldHash anchor is
// U454-E's alone and is NOT re-pinned here.

function boot(seed = DEMO_SEED) {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

test('U624: an OBJECT/place "find" is untouched by the name-seek path (no dialogue overreach)', () => {
  // A determiner/possessive or an object noun after "find" means it is NOT a bare name —
  // these must NOT enter dialogue and must NOT be swept to a person-clarify.
  for (const t of ['find my hatchet', 'find my sword', 'find the exit', 'find the way out', 'find the treasure', 'search for the key']) {
    const { w, byId } = boot();
    const r = playerMove(w, byId, t);
    assert.doesNotMatch(String(r.output?.mechanics || ''), /dialogue enter/i, `object seek does not enter dialogue: ${t}`);
    assert.doesNotMatch(String(r.output?.narration || ''), /there's no one named/i, `object seek is not a person-clarify: ${t}`);
  }
});

test('U624: a CONTESTED named seek still rolls (no free greet)', () => {
  // "find Carl and rob him" carries a hostile purpose — it must NOT free-pass into a
  // friendly greeting via the name-seek path (the contested guard holds).
  for (const t of ['find Carl and rob him', 'go find Asha and fight her', 'look for Dalla to mug her']) {
    const { w, byId } = boot();
    const r = playerMove(w, byId, t);
    assert.doesNotMatch(String(r.output?.mechanics || ''), /dialogue enter/i, `contested named seek does not greet: ${t}`);
  }
});

test('U624: the GENERIC seek-person path is unchanged (steps out, delivers a person)', () => {
  // The name-seek path must not have stolen the generic family — "find someone …" still
  // bridges outdoors and delivers a roster person (U485-U487 behavior intact).
  const { w, byId } = boot();
  const r = playerMove(w, byId, 'go find someone who can tell me who founded this outpost');
  assert.match(String(r.output?.narration || ''), /step out into the open air/i, 'generic seek still bridges outdoors');
  assert.match(String(r.output?.mechanics || ''), /dialogue enter/i, 'generic seek still delivers a person');
});

test('U624: a plain "greet Asha" (no find verb) keeps its own resolution', () => {
  // The seek-name precedence only fires when a find-verb seek is present; a bare greeting
  // by name is unaffected.
  const { w, byId } = boot();
  const r = playerMove(w, byId, 'greet Asha');
  assert.match(String(r.output?.mechanics || ''), /dialogue enter \| Asha/i, 'plain greet Asha still enters dialogue with Asha');
});

test('U624: DETERMINISM — the named-person seek resolves byte-identically on replay (×2)', () => {
  // Present-name greet.
  {
    const a = boot(); const rA = playerMove(a.w, a.byId, 'I go find Asha and greet her');
    const b = boot(); const rB = playerMove(b.w, b.byId, 'I go find Asha and greet her');
    assert.equal(worldHash(rA.world), worldHash(rB.world), 'present-name seek: worldHash stable on replay');
    assert.equal(String(rA.output?.narration || ''), String(rB.output?.narration || ''), 'present-name seek: narration stable');
  }
  // Absent-name honest miss.
  {
    const a = boot(); const rA = playerMove(a.w, a.byId, 'I go find Carl and greet him');
    const b = boot(); const rB = playerMove(b.w, b.byId, 'I go find Carl and greet him');
    assert.equal(worldHash(rA.world), worldHash(rB.world), 'absent-name seek: worldHash stable on replay');
    assert.equal(String(rA.output?.narration || ''), String(rB.output?.narration || ''), 'absent-name seek: narration stable');
  }
});

test('U624: NODE-DESYNC — the named-person seek never silently travels a node', () => {
  for (const t of ['I go find Asha and greet her', 'I go find Carl and greet him', 'look for Dalla']) {
    const { w, byId } = boot();
    const nodeBefore = w.map?.currentNodeId;
    const r = playerMove(w, byId, t);
    assert.equal(r.world?.map?.currentNodeId, nodeBefore, `node unchanged (no silent node travel): ${t}`);
  }
});
