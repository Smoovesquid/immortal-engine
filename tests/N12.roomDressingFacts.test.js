// N12 — the DM prompt learns the room's derived DRESSING (PW-4), and the narration
// guard treats it as pre-authorized (PROSE_TO_WORLD_CONTRACT law 6).
//
// roomDetail says what a room IS; PW-4 adds 1–2 seed-derived micro-details (a cobwebbed
// corner, a water-stained beam …) so the DM renders STABLE atmosphere instead of per-turn
// improv the guard has to police. This pins:
//   - buildScene attaches interior.dressing (1–2 phrases) and the LIVE prompt states them,
//   - the dressing is the SAME on every re-visit (pure f(seed, structure, room)),
//   - the phrases are taste-neutral (no digits, no obvious moral words),
//   - collectGroundedNouns covers the dressing nouns, and validateNarrationCandidate
//     ACCEPTS a candidate that voices the dressing (law 6: never reject derived texture).
//
// Hermetic: buildNarratorContext / buildSystemPrompt / collectGroundedNouns are pure over
// the world. No network, no API key, no cost. Dressing is DERIVED (nothing stored), so it
// cannot affect the worldHash determinism gates (U19/21/22/27/30) — U611 proves that.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt, collectGroundedNouns, findInventedProperNoun } from '../engine/llmAdapter.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('N12: buildScene attaches 1–2 dressing phrases and the LIVE prompt states them', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  assert.ok(Array.isArray(ctx.interior?.dressing), 'buildScene interior carries a dressing array');
  const dressing = ctx.interior.dressing;
  assert.ok(dressing.length >= 1 && dressing.length <= 2, `1–2 details, got ${dressing.length}`);
  for (const d of dressing) {
    assert.equal(typeof d, 'string');
    assert.ok(d.length > 0, 'each detail is a non-empty phrase');
  }

  const sys = buildSystemPrompt(ctx);
  assert.match(sys, /Small true details of this room/, 'the prompt states a dressing fact line');
  assert.match(sys, /never as a thing the player must act on/i, 'dressing is framed as texture, not an actionable object');
  for (const d of dressing) {
    assert.ok(sys.includes(d), `the prompt names the derived detail "${d}"`);
  }
});

test('N12: dressing is STABLE across re-derivation (same seed → same details)', () => {
  const a = buildNarratorContext(boot(), {}).interior.dressing;
  const b = buildNarratorContext(boot(), {}).interior.dressing;
  assert.deepEqual(b, a, 'a fresh boot re-derives byte-identical dressing (the same water stain next week)');
});

test('N12: dressing is taste-neutral — no digits, no obvious moral vocabulary', () => {
  const dressing = buildNarratorContext(boot(), {}).interior.dressing;
  const MORAL = /\b(evil|wicked|sin|sinful|guilt|guilty|virtue|virtuous|holy|unholy|cursed|blessed|innocent|righteous|damned)\b/i;
  for (const d of dressing) {
    assert.ok(!/[0-9]/.test(d), `dressing carries no numerics: "${d}"`);
    assert.ok(!MORAL.test(d), `dressing carries no moral judgment: "${d}"`);
  }
});

test('N12: the dressing nouns are grounded — collectGroundedNouns covers them (law 6)', () => {
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  const dressing = ctx.interior.dressing;
  const grounded = collectGroundedNouns({ world: w, ctx, base: '' });
  // Every token of every dressing phrase (normalized the SAME way the grounded set is —
  // llmAdapter's normNoun strips all non-a-z, so "tally-mark" → "tallymark") is in the
  // set, so the narration guard can never reject the DM for rendering the texture the
  // engine itself put in the prompt.
  const normNoun = (t) => String(t).toLowerCase().replace(/[^a-z]/g, '');
  for (const phrase of dressing) {
    for (const tok of phrase.split(/[^A-Za-z'’-]+/)) {
      const n = normNoun(tok);
      if (n.length < 2) continue;
      assert.ok(grounded.has(n), `grounded noun set covers "${n}" from dressing phrase "${phrase}"`);
    }
  }
});

test('N12: the invented-proper-noun guard never fires on dressing (law 6, the reject path)', () => {
  // The ONE rejection path in validateNarrationCandidate that could ever fire on dressing
  // texture is findInventedProperNoun (llmAdapter.js) — everything else keys off the base
  // narration / mechanics, not the room's nouns. Law 6 forbids rejecting narration for a
  // fact the engine derived, so voicing ANY dressing phrase must leave that guard silent.
  const w = boot();
  const ctx = buildNarratorContext(w, {});
  const grounded = collectGroundedNouns({ world: w, ctx, base: `You are in the ${ctx.roomName}.` });
  for (const phrase of ctx.interior.dressing) {
    const candidate = `You take in the ${ctx.roomName}: ${phrase}.`;
    assert.equal(
      findInventedProperNoun(candidate, grounded), null,
      `the invented-proper-noun guard stays silent on dressing phrase "${phrase}"`
    );
  }
});
