// U323 — PW-1: acquiring a revealed container item COMMITS canon (the prose-to-world
// materialization contract's foundational verb — docs/briefs/PROSE_TO_WORLD_CONTRACT.md).
//
// Closes WB-Q4/T-Q2 (phantom acquisition, HIGH): "I pocket the letter" used to narrate
// acquisition via the free-action floor while the engine added nothing to the pack.
// Now: the take mints a real inventory item (value = the seed-derived containerContents
// string; the letter's authored body — containerItemText, pure — is committed to
// item.notes) and lays a takenItems overlay on the piece so the derived view stops
// re-offering it. Collapsed canon is never overwritten: re-takes acknowledge without
// mutating; the read body is byte-identical before the take, after it, and across a
// save/load. All triggers are player text → replay re-executes identically (worldHash
// equality). Hermetic — no network/API.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { containerContents, containerItemText } from '../engine/decompression/generateFurniture.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

function chest(w) {
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  return { node, piece: (node.furniture || []).find(f => /chest/i.test(f.name || '')) };
}
function chestLetter(w) {
  const { node, piece } = chest(w);
  if (!piece) return null;
  return containerContents(w.meta.seed, node.id, piece.name, piece.category).find(it => /letter/i.test(it)) || null;
}
function packNames(w) {
  const inv = w.party?.[0]?.inventory || {};
  const out = [];
  for (const bucket of Object.keys(inv)) {
    for (const it of (Array.isArray(inv[bucket]) ? inv[bucket] : [])) {
      if (it && typeof it === 'object' && it.name) out.push(String(it.name));
    }
  }
  return out;
}

test('U323: precondition — the tallow chest deterministically holds the folded letter', () => {
  assert.ok(/letter/i.test(String(chestLetter(boot()))), 'fixture: chest must hold the letter');
});

test('U323: pocket-the-letter after the reveal COMMITS — real item in the pack, [take:revealed-item] mechanics', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  assert.equal(packNames(opened).some(n => /letter/i.test(n)), false, 'no letter in the pack before the take');
  const { world: took, output } = playerMove(opened, PACKS, 'I pocket the letter');
  assert.match(output.mechanics, /\[take:revealed-item/, `take must route through the acquire gate: ${output.mechanics} / ${output.narration}`);
  assert.match(output.narration, /letter/i, `take narration names the letter: ${output.narration}`);
  assert.ok(packNames(took).some(n => /letter/i.test(n)), `the pack must now hold the letter: ${packNames(took).join(', ')}`);
});

test('U323: the derived view subtracts the taken item — the open chest no longer offers the letter', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const took = playerMove(opened, PACKS, 'I pocket the letter').world;
  const { output } = playerMove(took, PACKS, 'look inside the chest');
  assert.doesNotMatch(output.narration, /folded letter/i, `the reveal clause must not re-offer the taken letter: ${output.narration}`);
});

test('U323: the authored body survives acquisition — read before-take, after-take, and after save/load are string-equal', () => {
  const w0 = boot();
  const { node, piece } = chest(w0);
  const letter = chestLetter(w0);
  const authored = containerItemText(w0.meta.seed, node.id, piece.name, letter);
  assert.ok(authored && authored.length > 0, 'fixture: the letter has an authored body');

  const opened = playerMove(w0, PACKS, 'open the iron-bound chest').world;
  const before = playerMove(opened, PACKS, 'read the letter').output;
  assert.ok(before.narration.includes(authored), `read-before-take delivers the authored body: ${before.narration}`);

  const took = playerMove(opened, PACKS, 'I pocket the letter').world;
  const after = playerMove(took, PACKS, 'read the letter');
  assert.match(after.output.mechanics, /\[read:carried-item/, `after the take, the read comes from the pack: ${after.output.mechanics}`);
  assert.ok(after.output.narration.includes(authored), `read-after-take delivers the SAME body: ${after.output.narration}`);

  const roundtrip = importWorld(exportWorld(took));
  const again = playerMove(roundtrip, PACKS, 'read the letter').output;
  assert.ok(again.narration.includes(authored), `read after save/load delivers the SAME body: ${again.narration}`);
});

test('U323: re-take is inert — acknowledge, no mutation, worldHash unchanged (never overwrite collapsed canon)', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const took = playerMove(opened, PACKS, 'I pocket the letter').world;
  const h1 = worldHash(took);
  const { world: retook, output } = playerMove(took, PACKS, 'I pocket the letter');
  assert.match(output.mechanics, /\[take:already-held/, `second take acknowledges possession: ${output.mechanics} / ${output.narration}`);
  assert.equal(worldHash(retook), h1, 'the second take must not mutate the world');
  assert.equal(packNames(retook).filter(n => /letter/i.test(n)).length, 1, 'no duplicate letter in the pack');
});

test('U323: observation precedes acquisition — take before opening does NOT route through the acquire gate', () => {
  const { output } = playerMove(boot(), PACKS, 'I pocket the letter');
  assert.doesNotMatch(output.mechanics, /\[take:revealed-item/, `an unrevealed item cannot be acquired from the chest: ${output.mechanics}`);
});

test('U323: the pack tells the truth — the carried letter shows in the inventory answer', () => {
  const opened = playerMove(boot(), PACKS, 'open the iron-bound chest').world;
  const took = playerMove(opened, PACKS, 'I pocket the letter').world;
  const { output } = playerMove(took, PACKS, 'what am I carrying?');
  assert.match(output.narration, /letter/i, `the inventory answer must name the letter: ${output.narration}`);
});

test('U323: determinism — two fresh worlds driven with the identical transcript hash equal', () => {
  const drive = () => {
    let w = boot();
    for (const t of ['open the iron-bound chest', 'I pocket the letter', 'read the letter', 'look inside the chest']) {
      w = playerMove(w, PACKS, t).world;
    }
    return w;
  };
  assert.equal(worldHash(drive()), worldHash(drive()), 'replaying the take transcript must be hash-stable');
});
