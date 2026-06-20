// U210 — H-47: item-effect answer breadth. Post-H-45/H-46 gate (Rules-Lawyer
// 7/12) found three real engine failures beyond U208's narrow "what does the
// Tonic do?" shape:
//   - answerItemQuery returned the FIRST inventory item whose name appeared
//     in the text, not the one actually asked about — a flavor item (Kitchen
//     cleaver) masked the Tonic of grit's real heal in a compound query.
//   - capability phrasings without the literal "what does X do" shape ("does
//     X heal HP, give temp HP, or buff a stat?") fell through to a generic
//     hedge instead of routing to the real effect answer.
//   - a player asserting an item is "inert"/"does nothing" got agreement
//     from the DM even when canon gives the item a real effect.
//
// U210 uses the gate's verbatim phrasings so it can't be satisfied by
// re-narrowing U208's pattern further.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

function begin(seed) {
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u210-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
}

// Force-carry the Tonic of grit (real heal effect) plus two flavor weapons
// (Worn Blade, Kitchen cleaver — no mechanical effect.kind) so a compound
// query exercises the asked-item fold against a realistic mixed loadout.
function withTonicAndWeapons(w) {
  const items = [{ id: 'forced1', defRef: 'tonic_of_grit', equipped: null }];
  const weapons = [
    { name: 'Worn Blade', damage: '1d8', notes: 'Nicked but true.' },
    { name: 'Kitchen cleaver', damage: '1d4', notes: 'Smells faintly of onions.' }
  ];
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items, weapons } }, ...w.party.slice(1)] };
}

function withTonicAtFullHp(w) {
  let world = withTonicAndWeapons(w);
  const max = Number(world.meta?.escapeMaxHp) || 13;
  world = { ...world, meta: { ...world.meta, escapeHp: max, escapeMaxHp: max } };
  return world;
}

const RATIONS = { name: 'Rations', tags: ['consumable'], notes: 'Hard bread, harder choices.', weight: 1, noise: 0, light: 0, bulk: 1 };
function withFlavorRations(w) {
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, consumables: [RATIONS] } }, ...w.party.slice(1)] };
}

test('U210-a: compound item+weapon query answers the Tonic\'s real heal AND both weapon damages, not just the first-found item', () => {
  const w = withTonicAndWeapons(begin('u210a'));
  const ans = handleMetaQuestion('What does the Tonic of grit do, and the numbers on my Worn Blade and Kitchen cleaver for damage?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i);
  assert.match(ans, /heal/i, 'states the Tonic heals');
  assert.doesNotMatch(ans, /nothing special fires when you use it.*tonic of grit/i, 'must not answer the Tonic as if it were the flavor cleaver');
  assert.match(ans, /worn blade/i);
  assert.match(ans, /1d8/);
  assert.match(ans, /kitchen cleaver/i);
  assert.match(ans, /1d4/);
});

test('U210-b: "does the Tonic heal HP, give temp HP, or buff a stat?" routes to the real effect answer, not a hedge', () => {
  const w = withTonicAndWeapons(begin('u210b'));
  const ans = handleMetaQuestion('Mechanically, does the Tonic of grit heal HP, give temp HP, or buff a stat?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i);
  assert.match(ans, /heal/i);
  assert.doesNotMatch(ans, /lands, after a fashion/i, 'must not fall through to the generic hedge');
});

test('U210-c: a false "the Tonic is inert, it does nothing" claim is corrected from the catalog, never endorsed', () => {
  const w = withTonicAndWeapons(begin('u210c'));
  const ans = handleMetaQuestion('the Tonic of grit is inert, it does nothing', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /heal/i, 'corrects with the real heal effect');
  assert.doesNotMatch(ans, /\byes\b.*inert|agree/i, 'must not endorse the false inert claim');
});

test('U210-d: the Tonic\'s heal capability is stated even at full HP — never implied effectless', () => {
  const w = withTonicAtFullHp(begin('u210d'));
  const ans = handleMetaQuestion('what does the Tonic of grit do?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /heal/i, 'capability stated regardless of current HP');
  assert.doesNotMatch(ans, /nothing special fires|no special effect|inert|useless/i);
});

test('U210-e (false-positive guard): a true flavor item (Rations) still reports honest no-effect', () => {
  const w = withFlavorRations(begin('u210e'));
  const ans = handleMetaQuestion('what does the Rations do?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /rations/i);
  assert.doesNotMatch(ans, /\bheals?\b|restorative|\bcures?\b/i, 'must not invent an effect Rations does not have');
});

test('U210-f (no-regression guard): a single "what does the Tonic of grit do?" still works (U208 shape)', () => {
  const w = withTonicAndWeapons(begin('u210f'));
  const ans = handleMetaQuestion('what does the Tonic of grit do?', w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i);
  assert.match(ans, /heal/i);
  assert.doesNotMatch(ans, /nothing special fires|no special effect/i);
});
