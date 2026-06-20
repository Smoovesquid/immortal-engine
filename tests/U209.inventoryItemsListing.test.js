// U209 — H-46: the generic "what's in my pack?" dump (META_INVENTORY in
// engine/grace/gracefulAdjudication.js) looped Object.entries(inventory) and
// explicitly skipped `cat === 'items'`, so a structured inventory.items[]
// entry (e.g. a bridged starting consumable from H-45 — Tonic of grit,
// Bandages, Holy water) silently dropped out of the generic pack listing,
// even though the dedicated "list my consumables" query already surfaced it.
// Every future structured item (weapons/armor bought from a shop, looted
// gear) would vanish from the generic dump the same way.
//
// Fix: resolve each inventory.items[] entry via getItemDef(defRef) and merge
// it into the dump under its kind's line, alongside the existing flavor
// buckets — never as an orphan line, and never listed twice if it somehow
// also has a flavor-bucket entry under the same name.

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
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u209-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
}

// Force-carry a known structured item by defRef (mirrors U208's withItem).
function withItem(w, defRef, id = 'forced1') {
  const items = [{ id, defRef, equipped: null }];
  return { ...w, party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, items } }, ...w.party.slice(1)] };
}

const LAMP_OIL = { name: 'Lamp oil', tags: ['consumable'], notes: 'Light in a bottle.', weight: 1, noise: 0, light: 0, bulk: 1 };

function withFlavorConsumableAndItem(w, flavorItem, defRef) {
  const items = [{ id: 'forced1', defRef, equipped: null }];
  return {
    ...w,
    party: [{ ...w.party[0], inventory: { ...w.party[0].inventory, consumables: [flavorItem], items } }, ...w.party.slice(1)]
  };
}

test('U209-01: "what\'s in my pack?" includes a bridged structured consumable (items[])', () => {
  const w = withItem(begin('u209a'), 'tonic_of_grit');
  const ans = handleMetaQuestion("what's in my pack?", w);
  assert.ok(ans, 'answered');
  assert.match(ans, /tonic of grit/i, 'structured item from items[] is included in the generic dump');
});

test('U209-02: a flavor-bucket item still appears in the same dump', () => {
  const w = withFlavorConsumableAndItem(begin('u209b'), LAMP_OIL, 'tonic_of_grit');
  const ans = handleMetaQuestion('what do i have?', w);
  assert.match(ans, /lamp oil/i, 'flavor-bucket item still appears');
  assert.match(ans, /tonic of grit/i, 'structured item appears alongside it');
});

test('U209-03: a non-consumable structured item (weapon) is included too, under its own kind', () => {
  const w = withItem(begin('u209c'), 'sharpened_stake');
  const ans = handleMetaQuestion('what am i carrying?', w);
  assert.match(ans, /sharpened stake/i, 'a structured weapon-kind item is surfaced, not silently dropped');
});

test('U209-04: no item is listed twice even if present in both a flavor bucket and items[] under the same name', () => {
  const w = withFlavorConsumableAndItem(begin('u209d'), { name: 'Tonic of grit', notes: 'dup' }, 'tonic_of_grit');
  const ans = handleMetaQuestion('check my inventory', w);
  const matches = ans.match(/tonic of grit/gi) || [];
  assert.equal(matches.length, 1, 'Tonic of grit appears exactly once, not duplicated');
});

test('U209-05: an items[] entry whose defRef does not resolve is skipped, not crashed on', () => {
  const w = withItem(begin('u209e'), 'not_a_real_defref');
  const ans = handleMetaQuestion('open my pack', w);
  assert.ok(ans, 'answered without throwing');
  assert.doesNotMatch(ans, /not_a_real_defref/i);
});

test('U209-06: an empty pack (no flavor items, no items[]) is still reported honestly', () => {
  const w = begin('u209f');
  const empty = {
    ...w,
    party: [{
      ...w.party[0],
      inventory: { weapons: [], armor: [], tools: [], clothes: [], spells: [], tech: [], oddities: [], consumables: [], junk: [], items: [] }
    }, ...w.party.slice(1)]
  };
  const ans = handleMetaQuestion('what do i have?', empty);
  assert.match(ans, /light|nothing/i);
});
