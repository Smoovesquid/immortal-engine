// U579 — MP-5a: DETERMINISM + FALLBACK (docs/briefs/MP-5a-tier-to-omen-line.md,
// docs/MORAL_PHYSICS.md §1-I "worldHash equality under replay holds after every moral
// mutation").
//
//   (I)   DEFAULT-BOOT U454-E ANCHOR UNCHANGED. MP-5a is a prompt-side surfacing built
//         entirely from a READ-ONLY re-derivation (engine/ai/narratorContext.js's
//         moralOmen() reads world.party[0].morality + world.deeds; it stores nothing new,
//         adds no field to any entity, and touches no delta path). The default fantasy/
//         tallow boot's worldHash — pinned at U454-E to 56d52255… (the MP-3+CONSEQ-1
//         anchor) — must therefore be byte-identical after this packet.
//   (II)  SILENT-FALLBACK PATH BYTE-IDENTICAL. playerMove's own narration (the path every
//         node --test run exercises; server.js is the ONLY caller of augmentNarration/
//         callLLM, and neither compose() nor playloop.js was touched by this packet) must
//         narrate identically to itself run-to-run for a scripted moral turn.
//   (III) THE LINE SURVIVES A SAVE/LOAD ROUND-TRIP (DERIVED, NOT STORED). Because the omen
//         is computed fresh from world.party[0].morality + world.deeds every time
//         buildNarratorContext runs, a structural clone of the world (the same faithful
//         roundtrip idiom U560-02 uses: JSON.parse(JSON.stringify(w))) must reproduce the
//         EXACT same omen — proving it is derived, not a stored field that could silently
//         diverge from a save file.
//
// Hermetic: no network, no API key, LLM off.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';
import { buildSystemPrompt } from '../engine/llmAdapter.js';
import { worldHash } from '../engine/worldHash.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { HUNT_HEAT, DEED_SEV } from '../engine/morality/escalation.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadNormalizedPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadNormalizedPacks();

// INTEGRATION REWRITE (Basecamp, 2026-07-06): the worker's original U579-01 duplicated
// U454-E's boot-anchor LITERAL (its base's value, 56d52255…) — and MP-4's legitimate
// same-day re-pin moved the anchor (db503a11…), making the duplicate stale on the
// integrated tree. One truth, one home: the boot anchor belongs to U454-E ALONE.
// What MP-5a actually owns — and what this test now asserts directly — is that its
// surfacing is PURE: deriving the omen context and rendering the prompt mutate nothing,
// so the world's fingerprint is byte-identical before and after, on any tree.

test('U579-01: SURFACING IS PURE — deriving the omen context + prompt moves no state (hash before == after)', () => {
  const w0 = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  const result = beginAdventure(w0, PACKS);
  const before = worldHash(result.world);

  // Derive the narrator context (the omen read) and render the full system prompt.
  const ctx = buildNarratorContext(result.world, {});
  buildSystemPrompt(ctx);
  assert.equal(worldHash(result.world), before,
    'MP-5a is read-only prompt-surfacing — deriving the omen and rendering the prompt must not move the world fingerprint');

  // Same seed => identical world, twice (the boot remains deterministic, derivation included).
  const w2 = newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } });
  const r2 = beginAdventure(w2, PACKS);
  buildNarratorContext(r2.world, {});
  assert.equal(worldHash(r2.world), before, 'default tallow boot must be deterministic ×2 after MP-5a');

  // And the default boot's own moral omen is correctly silent (a fresh no-deed world sits
  // at Tier 0 — "unremarked means unremarked").
  assert.equal(ctx.moralOmen, null, 'the default no-deed boot has no moral standing to surface');
});

test('U579-02: SILENT-FALLBACK PATH BYTE-IDENTICAL — a scripted moral turn narrates identically run-to-run', () => {
  const SCRIPT = ['go outside', 'I torture the bound prisoner for information', 'look around', 'rest'];
  function scriptedNarration(seed) {
    let w = beginAdventure(newWorld({
      seed, fate: 0.2, campaignId: `u579-fallback-${seed}`,
      pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
    }), PACKS).world;
    const turns = [];
    for (const line of SCRIPT) {
      const res = playerMove(w, PACKS, line);
      w = res.world;
      turns.push({ narration: String(res.output?.narration || ''), mechanics: String(res.output?.mechanics || '') });
    }
    return { turns, finalWorld: w };
  }
  const a = scriptedNarration('u579-fb');
  const b = scriptedNarration('u579-fb');
  assert.deepEqual(a.turns, b.turns, 'the silent-fallback (base composer) narration path must be byte-identical run-to-run');
  assert.equal(worldHash(a.finalWorld), worldHash(b.finalWorld), 'the underlying world state must also replay byte-identical');
  assertWorldInvariants(a.finalWorld);
});

test('U579-03: THE LINE SURVIVES A SAVE/LOAD ROUND-TRIP — derived fresh from cloned state, not a stored field', () => {
  // Build a world with a real, tier-graded moral standing.
  let w = beginAdventure(newWorld({
    seed: 'u579-roundtrip', fate: 0.2, campaignId: 'u579-roundtrip',
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), PACKS).world;
  w = playerMove(w, PACKS, 'go outside').world;
  w = playerMove(w, PACKS, 'I execute the kneeling captive who begs for mercy').world;

  const ctxBefore = buildNarratorContext(w, {});
  assert.ok(ctxBefore.moralOmen, 'precondition: the scripted world has a real omen before the round-trip');

  // The cheapest faithful roundtrip of canonical state (same idiom as U560-02's
  // "export/import roundtrip preserves the hash" — a structural clone stands in for an
  // actual save/load, since worldHash-equality is what save.js's own round-trip proves).
  const clone = ensureWorld(JSON.parse(JSON.stringify(w)));
  assert.equal(worldHash(clone), worldHash(w), 'precondition: the clone is a faithful roundtrip (hash-identical)');

  const ctxAfter = buildNarratorContext(clone, {});
  assert.deepEqual(ctxAfter.moralOmen, ctxBefore.moralOmen,
    'the SAME omen must be re-derived fresh from the cloned world — proving it is computed, not stored (a stored-but-forgotten field would silently diverge here)');

  // And no field named for the omen was added to the SAVED world shape itself — the
  // derivation lives entirely off morality/deeds, which already existed before MP-5a.
  assert.equal(clone.moralOmen, undefined, 'the world object itself must never carry a moralOmen field — it is a ctx-only derived read');
  assert.equal(w.moralOmen, undefined, 'same check on the pre-clone world — never stored anywhere in canonical state');
});

test('U579-04: a fresh, unrelated world at Tier 0 stays silent across the same round-trip (no false positive omen)', () => {
  let w = beginAdventure(newWorld({
    seed: 'u579-clean', fate: 0.2, campaignId: 'u579-clean',
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), PACKS).world;
  w = playerMove(w, PACKS, 'go outside').world;
  w = playerMove(w, PACKS, 'look around').world;
  const clone = ensureWorld(JSON.parse(JSON.stringify(w)));
  const ctxBefore = buildNarratorContext(w, {});
  const ctxAfter = buildNarratorContext(clone, {});
  assert.equal(ctxBefore.moralOmen, null, 'precondition: a clean run stays at Tier 0');
  assert.equal(ctxAfter.moralOmen, null, 'the round-tripped clean world must ALSO stay silent — no spurious omen invented by the clone');
});
