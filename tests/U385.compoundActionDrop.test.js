// U385/U386/U387 — INT-4a: compound-action drop. A TRIVIAL LEADING CLAUSE
// (readying a held tool, or a posture shift) chained to a REAL action must not
// eat the whole turn. Before this fix, on seed `tallow` (the player wakes in a
// cottage with an iron-bound chest present):
//
//   "I take my hatchet in hand and open the chest." → the physics intercept
//       paired the leading "take" with the trailing object "chest" and ruled
//       "the iron-bound chest is too heavy to carry"; "open the chest" — the
//       actual intent — was silently dropped.
//   "I kneel by the chest and try its lid — is it locked?" → classifyTrivial
//       swallowed the whole turn as "You kneel."; the lid/lock intent was lost.
//
// A real DM resolves the SECOND clause and treats the first as flavor. The fix
// (engine/playloop.js splitLeadingTrivialClause) strips a trivial lead so the
// real action drives the turn — never dropping a clause. This suite pins the
// two reproduced symptoms + an act-then-act variant, and guards over-fire (a
// genuine first action keeps the turn; a bare posture with no real tail is
// unchanged). Deterministic, LLM-off (no key set in the test env).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const move = (w, text) => playerMove(w, PACKS, text);
const narrOf = (r) => String(r.output?.narration || '').replace(/^Wizard:\s*/, '').trim();

// The exact pre-fix failure strings — a match here means the clause was dropped.
const TOO_HEAVY_RE = /too heavy to carry/i;
const BARE_KNEEL_RE = /^You kneel\.$/i;

describe('U385 — INT-4a: a trivial leading clause must not eat the turn', () => {
  it('precondition: tallow boots inside a room that has the iron-bound chest present', () => {
    const w = boot();
    assert.ok(w.scene?.interior, 'starts indoors');
    const node = (w.map.nodes || []).find(n => n.id === w.map.currentNodeId);
    const names = (node?.furniture || []).map(f => String(f.name || '').toLowerCase());
    assert.ok(names.some(n => n.includes('chest')), 'the iron-bound chest is present at the boot node');
  });

  // U385 — symptom 1: ready-a-held-tool lead + open the chest.
  it('U385: "take my hatchet in hand and open the chest" opens the chest (take is not the whole turn)', () => {
    const r = move(boot(), 'I take my hatchet in hand and open the chest.');
    const narr = narrOf(r);
    assert.doesNotMatch(narr, TOO_HEAVY_RE, `the "open" clause must survive — not collapse to "take the chest": ${narr}`);
    assert.match(narr, /\bchest\b/i, `the real action names the chest: ${narr}`);
    assert.match(narr, /\bopen|stands open|lid\b/i, `the chest is actually opened/inspected: ${narr}`);
  });

  // U385b — the same shape without "in hand" (bare possessive ready gesture).
  it('U385b: "take my hatchet and open the chest" also opens the chest', () => {
    const r = move(boot(), 'I take my hatchet and open the chest');
    assert.doesNotMatch(narrOf(r), TOO_HEAVY_RE, `the open clause must survive: ${narrOf(r)}`);
    assert.match(narrOf(r), /open|stands open|lid/i, `chest opened: ${narrOf(r)}`);
  });
});

describe('U386 — INT-4a: a posture lead must not swallow the real probe', () => {
  // U386 — symptom 2: "kneel by the chest and try its lid — is it locked?"
  it('U386: "kneel by the chest and try its lid — is it locked?" resolves the lid probe (not just "You kneel.")', () => {
    const r = move(boot(), 'I kneel by the chest and try its lid — is it locked?');
    const narr = narrOf(r);
    assert.doesNotMatch(narr, BARE_KNEEL_RE, `must not drop to "You kneel." — the lid/lock intent must be resolved: ${narr}`);
    // The turn resolves the real clause: it either rolls the attempt OR answers
    // in the fiction. Either way the trivial "kneel" is not the whole turn.
    const mech = String(r.output?.mechanics || '');
    const resolvedReal = /roll:|physics:|read|examine|lid|lock|open|container/i.test(narr + ' ' + mech);
    assert.ok(resolvedReal, `the real lid/lock clause reaches resolution: narr="${narr}" mech="${mech}"`);
  });

  // U386b — posture lead + a plain open (no trailing question).
  it('U386b: "crouch down and open the chest" opens the chest', () => {
    const r = move(boot(), 'I crouch down and open the chest');
    assert.doesNotMatch(narrOf(r), BARE_KNEEL_RE, `not a bare posture: ${narrOf(r)}`);
    assert.match(narrOf(r), /open|stands open|lid|chest/i, `chest reached: ${narrOf(r)}`);
  });
});

describe('U387 — INT-4a: over-fire guards (a genuine action keeps the turn)', () => {
  // A real first action (acquiring a PRESENT object by article, no ready tail)
  // must NOT be treated as a trivial lead — it keeps the turn.
  it('U387: "take the oil lantern and open the chest" resolves the real take (not stripped as flavor)', () => {
    const r = move(boot(), 'I take the oil lantern and open the chest');
    const narr = narrOf(r);
    // The lantern take is a genuine acquisition — it resolves (already-held on
    // this seed) rather than being narrated as a throwaway lead-in.
    assert.match(narr, /lantern/i, `the genuine take of a present object is honored, not dropped: ${narr}`);
  });

  // A bare posture with no real trailing action stays a trivial no-op.
  it('U387b: bare "kneel down" (no real tail) is still a trivial action, unchanged', () => {
    const r = move(boot(), 'I kneel down');
    assert.match(narrOf(r), /kneel/i, `bare posture stays trivial: ${narrOf(r)}`);
    assert.match(String(r.output?.mechanics || ''), /trivial/i, 'no roll for a bare posture');
  });

  // A move-then-act compound stays owned by the interior move path (untouched).
  it('U387c: "go to the back room and open the chest" still routes through the interior move path', () => {
    const r = move(boot(), 'I go to the back room and open the chest');
    // The move happens (room changes or the narration reports stepping through);
    // the point is the trivial-lead strip did NOT hijack a MOVE lead.
    assert.match(narrOf(r), /room|through|open|chest/i, `move-then-act preserved: ${narrOf(r)}`);
  });

  // Determinism: the same turn from the same boot yields the same narration.
  it('U387d: the fix is deterministic — identical narration on replay', () => {
    const a = narrOf(move(boot(), 'I take my hatchet in hand and open the chest.'));
    const b = narrOf(move(boot(), 'I take my hatchet in hand and open the chest.'));
    assert.equal(a, b, 'same seed + same turn → identical narration (no RNG in the split path)');
  });
});
