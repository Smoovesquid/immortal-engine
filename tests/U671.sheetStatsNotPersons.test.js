// U671 — DM-GATE-1e R1: an attribute/stat ask answers from the REAL party sheet
// — Might/Agility/Wits/Charm/Grit are never person names (Opus re-gate
// 2026-07-09, rules-lawyer ×2: "Give me actual numbers for those five
// attributes" → "[clarify:referent] I haven't introduced anyone named Agility").
//
// The sheet is player-visible UI (the character panel shows the numbers), so an
// explicit ask gets the numbers — the same law DM-GATE-1c set for modifier asks.
// A genuinely unknown PERSON ref still clarifies (control).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

const GATE_T1 = "Give me actual numbers for those five attributes — Might, Agility, Wits, Charm, Grit. What's each score?";
const GATE_T2 = "Agility isn't a person — it's one of my five attributes you just listed. Give me the number for each: Might, Agility, Wits, Charm, Grit.";

test('U671: the verbatim stats ask answers the five real numbers — never a person clarify', () => {
  const w = boot();
  const stats = w.party[0].stats;
  const r = playerMove(w, PACKS, GATE_T1);
  const narr = String(r.output?.narration || '');

  assert.doesNotMatch(String(r.output?.mechanics || ''), /clarify:referent/,
    'attribute nouns are not people');
  assert.doesNotMatch(narr, /haven'?t introduced anyone|no one by that name/i);
  for (const [name, val] of Object.entries(stats)) {
    const re = new RegExp(`${name}[^.;,]{0,12}${val}`, 'i');
    assert.match(narr, re, `${name} ${val} is stated (got: ${narr.slice(0, 160)})`);
  }
});

test('U671: the pressed second phrasing lands the same', () => {
  const w = boot();
  const r = playerMove(w, PACKS, GATE_T2);
  assert.doesNotMatch(String(r.output?.mechanics || ''), /clarify:referent/);
  assert.match(String(r.output?.narration || ''), /might/i);
  assert.match(String(r.output?.narration || ''), /grit/i);
});

test('U671: control — a genuinely unknown person ref still clarifies/declines', () => {
  const w = boot();
  const r = playerMove(w, PACKS, 'What is Vexnar the Undying staring at?');
  assert.doesNotMatch(String(r.output?.narration || ''), /vexnar.*(?:might|agility|wits|charm|grit)/i,
    'no sheet answer for a person question');
  assert.match(String(r.output?.narration || '') + String(r.output?.mechanics || ''),
    /clarify|haven'?t introduced|no one by that name|who do you/i,
    'the unknown-person guard is intact');
});
