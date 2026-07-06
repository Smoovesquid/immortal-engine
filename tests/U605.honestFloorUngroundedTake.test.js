// U605 — PW-2: the honest floor for ungrounded takes (the suppression-side pair of PW-1's mint —
// docs/briefs/PROSE_TO_WORLD_CONTRACT.md §1e, PW-2 row).
//
// The bug (twice-confirmed by the harness, WB-Q4 / T-Q2, HIGH): "I pocket the letter" when no such
// letter exists in canon flowed to the trivial free-action floor (isTrivialIntent) and narrated
// acquisition — "You do so without difficulty." — while the engine added NOTHING to the pack. The
// player later "shows the letter" to an NPC the engine holds no record of. Narration != canon, the
// exact invariant this contract exists to close.
//
// The fix (PW-2): a take/pocket naming a noun that is NOT grounded in any of the four legitimate
// sources — a revealed remaining container item (PW-1's mint), a present furniture piece, an
// inventory item, or a combat-loot target — STOPS narrating acquisition. It gets an honest in-voice
// line ("nothing like that here to take" — DM-Test clean, never "invalid target"), OR, where the
// intent reads as searching a present container ("grab a letter from the chest"), it pivots to the
// existing container-reveal path (V7: interpret richly, commit narrowly). The grounding check is
// ENGINE-side at commit time — the intent translator stays LLM-primary (INT law), never a regex
// pre-filter. Hermetic — no network/API.

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

// The DM-Test voice check: the decline is an in-fiction line, never a mechanical/parser bounce.
const MECHANICAL_BOUNCE_RE = /invalid|not (?:a )?(?:valid|recognized)|unrecognized|no such (?:target|object|item)|command|error|cannot parse|unknown target|\bnull\b|undefined/i;

test('U605: precondition — no "letter" is a present piece and none is in the pack at boot', () => {
  const w = boot();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  const furnHasLetter = (node.furniture || []).some(f => /letter/i.test(String(f.name || '')));
  assert.equal(furnHasLetter, false, 'fixture: no furniture piece named "letter" at boot');
  assert.equal(packNames(w).some(n => /letter/i.test(n)), false, 'fixture: no letter in the pack at boot');
});

test('U605: "I pocket the letter" (unrevealed) mints NOTHING — narration and canon agree', () => {
  const before = packNames(boot());
  const { world, output } = playerMove(boot(), PACKS, 'I pocket the letter');
  // No phantom acquisition line: never the trivial floor's auto-success, never the take bank's "you pocket it".
  assert.doesNotMatch(output.narration, /you do so without difficulty/i,
    `the ungrounded take must not hit the phantom trivial floor: ${output.narration}`);
  assert.doesNotMatch(output.narration, /pocket the letter and move on|the letter is yours now|take the letter and stow/i,
    `the ungrounded take must not narrate acquisition: ${output.narration}`);
  // Canon is unchanged: the pack holds exactly what it held before.
  assert.deepEqual(packNames(world), before, `no item may be minted for an ungrounded take: ${packNames(world).join(', ')}`);
});

test('U605: the honest line is in-voice — a DM redirect, never a mechanical bounce', () => {
  const { output } = playerMove(boot(), PACKS, 'I pocket the letter');
  assert.doesNotMatch(output.narration, MECHANICAL_BOUNCE_RE,
    `the decline must read as fiction, not a parser bounce: ${output.narration}`);
  // It names the honest fact: there is no such thing here to take.
  assert.match(output.narration, /\bno\b|\bnothing\b|\bno such\b|isn'?t\b|there'?s no/i,
    `the decline must honestly say nothing like that is here: ${output.narration}`);
});

test('U605: the desync is closed end-to-end — pocket then "show the letter" finds nothing to show', () => {
  const took = playerMove(boot(), PACKS, 'I pocket the letter').world;
  assert.equal(packNames(took).some(n => /letter/i.test(n)), false,
    'the pack must not hold a letter after an ungrounded pocket');
  const { output } = playerMove(took, PACKS, 'I show the letter to the guard');
  // The engine must not pretend to manipulate a letter it never gave the player. It may honestly
  // report there's no letter, or route the show as a social beat — but never a physical "you can't
  // get the letter to budge" fake-failure that implies the letter is real.
  assert.doesNotMatch(output.narration, /the letter (?:won'?t|doesn'?t|won not)\s+(?:budge|come|move)/i,
    `showing a never-held letter must not fake-fail a physical grip on it: ${output.narration}`);
});

test('U605: other ungrounded nouns decline the same way — "crown jewels", "the sword"', () => {
  for (const line of ['I pocket the crown jewels', 'I grab the sword']) {
    const before = packNames(boot());
    const { world, output } = playerMove(boot(), PACKS, line);
    assert.doesNotMatch(output.narration, /you do so without difficulty/i, `${line}: not the phantom floor — ${output.narration}`);
    assert.doesNotMatch(output.narration, MECHANICAL_BOUNCE_RE, `${line}: in-voice, not a bounce — ${output.narration}`);
    assert.deepEqual(packNames(world), before, `${line}: nothing minted — ${packNames(world).join(', ')}`);
  }
});

test('U605: the search pivot — "grab a letter from the chest" reveals the container instead of declining', () => {
  const { world, output } = playerMove(boot(), PACKS, 'I grab a letter from the chest');
  // Intent reads as searching the present chest → route to the existing reveal path. It must speak of
  // the chest and its actual contents (the tallow chest holds the folded letter), NOT the mistaken
  // "you take the straw pallet" that the physics detector produced before, and NOT a flat decline.
  assert.match(output.narration, /chest/i, `the pivot must engage the named container: ${output.narration}`);
  assert.doesNotMatch(output.narration, /you take the straw pallet/i,
    `the pivot must not mis-grab an unrelated piece: ${output.narration}`);
});
