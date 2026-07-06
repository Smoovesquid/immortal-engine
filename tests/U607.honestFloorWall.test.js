// U607 — PW-2's wall: determinism, voice, and canon-agreement for the honest-floor gate
// (docs/briefs/PROSE_TO_WORLD_CONTRACT.md — PW-2). Three guarantees:
//   (a) DETERMINISM x2, both branches — replaying the ungrounded-take transcript AND the search-pivot
//       transcript on two fresh worlds yields equal worldHash (the gate reads only (world, playerText)
//       and mutates nothing on the decline / re-derives the reveal — contract laws 2 + 4),
//   (b) VOICE — the decline is a DM redirect in the fiction, never a mechanical/parser bounce
//       (THE_DM_TEST); the same input phrased three seeds apart still never leaks system language,
//   (c) CANON AGREEMENT — the decline mutates nothing: worldHash before == after, pack unchanged.
// Hermetic — no network/API.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = (seed = 'tallow') => beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

function packNames(w) {
  const inv = w.party?.[0]?.inventory || {};
  const out = [];
  for (const bucket of Object.keys(inv)) for (const it of (Array.isArray(inv[bucket]) ? inv[bucket] : [])) if (it?.name) out.push(String(it.name));
  return out;
}

// System leakage: anything that reads like a parser/engine talking rather than a DM narrating.
const MECHANICAL_BOUNCE_RE = /invalid|not (?:a )?(?:valid|recognized)|unrecognized|no such (?:target|object|item)|\bcommand\b|\berror\b|cannot parse|unknown|\bnull\b|undefined|\[object|target not found/i;

test('U607 (a) determinism — the ungrounded-take transcript is hash-stable across two fresh worlds', () => {
  const drive = () => {
    let w = boot();
    for (const t of ['I pocket the letter', 'I grab the sword', 'I take the gold', 'I pocket the crown jewels']) {
      w = playerMove(w, PACKS, t).world;
    }
    return w;
  };
  assert.equal(worldHash(drive()), worldHash(drive()), 'replaying ungrounded takes must be hash-stable');
});

test('U607 (a) determinism — the search-pivot transcript is hash-stable across two fresh worlds', () => {
  const drive = () => {
    let w = boot();
    for (const t of ['I grab a letter from the chest', 'look inside the chest', 'I take a coin from the chest']) {
      w = playerMove(w, PACKS, t).world;
    }
    return w;
  };
  assert.equal(worldHash(drive()), worldHash(drive()), 'replaying the search pivot must be hash-stable');
});

test('U607 (b) voice — the decline never leaks parser/engine language (three seeds)', () => {
  for (const seed of ['tallow', 'aldermere', 'greenwood']) {
    for (const line of ['I pocket the letter', 'I grab the sword', 'I take the gold']) {
      const { output } = playerMove(boot(seed), PACKS, line);
      // If this seed grounds the noun (some world genuinely has a sword here) the take routes
      // elsewhere and that's fine; we only police the DECLINE path for voice.
      if (/\[take:nothing-here/.test(output.mechanics)) {
        assert.doesNotMatch(output.narration, MECHANICAL_BOUNCE_RE, `${seed}/${line}: decline must read as fiction — ${output.narration}`);
        assert.match(output.narration, /there'?s no|nothing like that|no .* within reach/i, `${seed}/${line}: decline names the honest fact — ${output.narration}`);
      }
    }
  }
});

test('U607 (c) canon agreement — the decline mutates nothing (worldHash and pack unchanged)', () => {
  const w = boot();
  const h0 = worldHash(w);
  const before = packNames(w);
  const { world, output } = playerMove(w, PACKS, 'I pocket the letter');
  assert.match(output.mechanics, /\[take:nothing-here/, `precondition: this take is declined — ${output.mechanics}`);
  assert.equal(worldHash(world), h0, 'an honest-floor decline must not change the world hash');
  assert.deepEqual(packNames(world), before, 'an honest-floor decline must not touch the pack');
});

test('U607 (c) canon agreement — repeated declines stay inert (no drift over turns)', () => {
  let w = boot();
  const h0 = worldHash(w);
  for (let i = 0; i < 3; i++) w = playerMove(w, PACKS, 'I pocket the letter').world;
  assert.equal(worldHash(w), h0, 'three declines in a row must leave the world untouched');
});
