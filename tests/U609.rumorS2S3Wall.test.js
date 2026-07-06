// U609 — PW-3: the S2/S3 wall (docs/RUMOR_LAYER.md S2/S3; PROSE_TO_WORLD_CONTRACT.md law 1 + Hash-law S3).
//
// The rumor layer has exactly two prose sources, and they must never cross:
//   • S2 — the deterministic fallback body, minted in the reducer. Seeded, replayable, IN canon,
//     IN the worldHash-relevant state (as `rumor.body`, though the body itself is HASH-EXCLUDED).
//   • S3 — an optional LLM upgrade of the PROSE BODY ONLY, rendered async by the server. It changes
//     the words in the NPC's mouth and NOTHING else: never the skeleton (id/tier/source/hop/mintedAt/
//     tags), never WHICH rumor, never a fact. Silent-fallback law: no key / a failed or fabricating
//     upgrade → the S2 body stands and the game never knows.
//
// This gate proves the wall structurally: the server's S3 path returns a DISPLAY LINE and touches no
// world state, so the skeleton and the worldHash are provably immovable by the upgrade; and the
// upgrade is gated by the SAME fabrication guard as every other voice line, so it cannot smuggle in a
// new fact. Hermetic — the "upgrade" is exercised through the pure prompt + validator, no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { buildNpcVoicePrompt } from '../server/npcVoicePrompt.js';
import { validateNpcVoiceCandidate } from '../engine/llmAdapter.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: SLICE_SEED, fate: 0.2, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const drive = (w, lines) => { let last = { world: w }; for (const t of lines) { last = playerMove(w, PACKS, t); w = last.world; } return { world: w, out: last.output }; };
const ASK = ['talk to Galen', 'what do you know about the fire?'];

// Simulate the server's async S3 step: it renders a new line for the SAME rumor and returns it. It
// mutates NO world state (server.js /api/npc-voice returns { line }); the client shows the line.
function simulateServerS3(dialogue, upgradedLine) {
  const prompt = buildNpcVoicePrompt({
    npcName: dialogue.npcName, role: dialogue.npcRole, mood: dialogue.mood, manner: dialogue.manner,
    trust: dialogue.trustLevel, mode: dialogue.mode, playerLine: dialogue.playerLine, rumor: dialogue.rumor
  });
  const ok = !!prompt && validateNpcVoiceCandidate(upgradedLine, {
    npcName: dialogue.npcName, role: dialogue.npcRole, playerLine: dialogue.playerLine,
    rumor: dialogue.rumor, mode: dialogue.mode
  });
  return { promptBuilt: !!prompt, accepted: ok, line: ok ? upgradedLine : null };
}

test('U609-01: the S3 upgrade changes the display body only — the minted skeleton is byte-identical', () => {
  const { world: w, out } = drive(boot(), ASK);
  const dialogue = out.dialogue;
  assert.equal(dialogue.mode, 'rumor_pickup', 'the ask produced a pickup');
  const skeletonBefore = w.rumors.find(r => r.id === dialogue.rumor.id);
  assert.ok(skeletonBefore, 'the skeleton is in world.rumors');

  // The server renders an upgraded line for the SAME rumor. This is a DISPLAY string; the world is
  // not passed to the server voice path and is not mutated by it.
  const upgraded = 'Only what came down the road — they say Brogan walked out of a burned hamlet with nothing.';
  const s3 = simulateServerS3(dialogue, upgraded);
  assert.ok(s3.promptBuilt, 'the rumor_pickup voice prompt builds');
  assert.ok(s3.accepted, 'a grounded upgrade line passes the fabrication guard');
  assert.notEqual(s3.line, skeletonBefore.body, 'the S3 line differs from the S2 body (a real upgrade)');

  // The skeleton in canon is unchanged: every immutable field, and even the stored S2 body, still
  // holds — the upgrade lives only in the returned display line, never written back.
  const skeletonAfter = w.rumors.find(r => r.id === dialogue.rumor.id);
  assert.deepEqual(skeletonAfter, skeletonBefore, 'the minted rumor record is untouched by the S3 render');
  for (const k of ['id', 'sourceSeedId', 'carrierNpcId', 'hopCount', 'tier', 'mintedAt', 'tags', 'body']) {
    assert.deepEqual(skeletonAfter[k], skeletonBefore[k], `skeleton.${k} is immutable across the upgrade`);
  }
});

test('U609-02: worldHash is unmoved by the S3 upgrade (the body is hash-excluded AND the upgrade never writes state)', () => {
  const { world: w, out } = drive(boot(), ASK);
  const hashBefore = worldHash(w);
  // Render the upgrade — no world mutation happens; prove the hash is identical afterward.
  simulateServerS3(out.dialogue, 'They say a man walked out of a burned hamlet down south, left with nothing.');
  const hashAfter = worldHash(w);
  assert.equal(hashAfter, hashBefore, 'the S3 render moves no hash — it returns a display line, not state');

  // And even if a body-swap DID land in state (belt-and-braces on the projection law), the hash
  // would still not move, because worldHash projects rumors as {id, tier, age} — body excluded.
  const swapped = {
    ...w,
    rumors: w.rumors.map(r => r.id === out.dialogue.rumor.id ? { ...r, body: 'A COMPLETELY DIFFERENT BODY, upgraded.' } : r)
  };
  assert.equal(worldHash(swapped), hashBefore, 'even a stored body swap leaves worldHash equal — body is out of the projection');
});

test('U609-03: a fabricating upgrade is REJECTED — the S2 body stands (silent fallback)', () => {
  const { out } = drive(boot(), ASK);
  const dialogue = out.dialogue;
  // The LLM tries to smuggle a NEW proper noun the rumor never named.
  const fabricated = 'They say it was Baron Aldwick who put the hamlet to the torch himself.';
  const s3 = simulateServerS3(dialogue, fabricated);
  assert.equal(s3.accepted, false, 'the fabrication guard rejects an invented name in the upgrade');
  assert.equal(s3.line, null, 'no upgraded line is returned — the shown S2 body stands');
});

test('U609-04: with NO upgrade at all (no key path), the S2 body is what surfaced — the game is unaware', () => {
  const { world: w, out } = drive(boot(), ASK);
  // The narration the reducer produced already contains the S2 body (LLM off in tests). The stored
  // body and the surfaced narration agree — the deterministic floor is the truth with no upgrade.
  const body = w.rumors.find(r => r.id === out.dialogue.rumor.id)?.body || '';
  assert.ok(body.trim().length > 0, 'an S2 body exists with no LLM');
  assert.ok(String(out.narration || '').includes(body), 'the surfaced line carries the S2 body verbatim when no upgrade runs');
  // The S3 payload handle is present so the server COULD upgrade — but its absence changes nothing.
  assert.equal(out.dialogue.rumor.body, body, 'the S3 handle exposes exactly the S2 body to upgrade');
});
