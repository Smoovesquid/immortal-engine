// U685 — BUILDER-OBJ-1: the Builder palette and the prop-art registry obey the
// object-truth law.
//
// Tim's hard law (2026-07-11): "If it is placeable in the Builder, the game must
// believe in it. No decor-only minis." This file is the drift guard:
//   1. every kind the Builder palette offers is an engine FURN kind;
//   2. the palette carries the whole supported set (and sane footprints);
//   3. propArt.js only ever annotates REAL kinds with art — it can never mint a
//      placeable, and every GLB it names actually exists on disk;
//   4. audited multi-object sheets (miniLibrary `sheet: true`) are never claimed
//      as kind art (the multi-object rule: split first, then classify);
//   5. the Builder keeps its runtime refusal for contract-less placements.
//
// If a future packet WIRES a kind's GLB to placed pieces, flip that kind's
// `wired` flag in propArt.js and update the expectation in test 3 consciously.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FURN } from '../engine/structures/roomDetail.js';
import { PROP_ART } from '../public/map/propArt.js';
import { MINI_LIBRARY } from '../public/map/miniLibrary.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = fs.readFileSync(path.join(ROOT, 'public', 'house-builder.html'), 'utf8');

// Same 16 kinds U686 exercises end-to-end (kept literal here on purpose — if the
// palette and the contract test ever disagree, ONE of them is wrong and this
// failure is the conversation).
const SUPPORTED = [
  'barrel', 'bed', 'dresser', 'chest', 'cookpot', 'crate', 'shelf', 'table',
  'chair', 'nightstand', 'wardrobe', 'rug', 'runner', 'lantern', 'candles', 'hearth',
];

function parsePalette() {
  const start = HTML.indexOf('const PALETTE=[');
  assert.ok(start > 0, 'house-builder.html declares const PALETTE=[…]');
  const block = HTML.slice(start, HTML.indexOf('];', start));
  const entries = [];
  const re = /\{type:'(\w+)',label:'([^']+)',w:(\d+),h:(\d+)\}/g;
  let m;
  while ((m = re.exec(block))) entries.push({ type: m[1], label: m[2], w: +m[3], h: +m[4] });
  return entries;
}

test('U685: every Builder palette entry is an engine FURN kind — nothing placeable is decor', () => {
  const palette = parsePalette();
  assert.ok(palette.length >= 16, `palette parsed (${palette.length} entries)`);
  for (const p of palette) {
    assert.ok(FURN[p.type], `palette offers '${p.type}' but the engine catalog has no such object — the hard law is broken`);
    assert.ok(p.w >= 1 && p.h >= 1, `${p.type} has a real footprint`);
  }
});

test('U685: the palette carries the whole supported set', () => {
  const kinds = new Set(parsePalette().map(p => p.type));
  for (const k of SUPPORTED) assert.ok(kinds.has(k), `supported kind '${k}' is on the palette`);
});

// BUILDER-OBJ-2 (2026-07-11): the placed-piece GLB render path now exists
// (figures3d.js buildPropMini/glbPropMini) for every treeAssets-sourced kind;
// this expectation was updated CONSCIOUSLY, per this file's own header note,
// alongside that render-path change. 'rack' stays unwired — its art lives on
// the lazy miniLibrary loader, which buildPropMini does not consume.
const NOT_YET_WIRED = new Set(['rack']);

test('U685: propArt only annotates real kinds, every GLB exists, wired state matches the render path', () => {
  const kinds = Object.keys(PROP_ART);
  assert.ok(kinds.length >= 10, 'the registry is populated');
  for (const kind of kinds) {
    assert.ok(FURN[kind], `propArt annotates '${kind}' — must be an engine FURN kind (art never mints an object)`);
    const entry = PROP_ART[kind];
    assert.equal(entry.wired, !NOT_YET_WIRED.has(kind),
      `'${kind}' wired flag must match whether a placed-piece GLB render path actually consumes it`);
    assert.ok(Array.isArray(entry.minis) && entry.minis.length > 0, `'${kind}' names at least one GLB`);
    for (const m of entry.minis) {
      assert.match(m.url, /^\/map\/assets\/[\w.-]+\.glb$/, `${kind}: sane asset url (${m.url})`);
      assert.ok(fs.existsSync(path.join(ROOT, 'public', m.url)), `${kind}: ${m.url} exists on disk`);
      assert.ok(['treeAssets', 'miniLibrary'].includes(m.source), `${kind}: known source`);
    }
  }
});

test('U685: audited multi-object sheets are never claimed as kind art (split first)', () => {
  const claimedUrls = new Set(Object.values(PROP_ART).flatMap(a => a.minis.map(m => m.url)));
  const sheets = MINI_LIBRARY.filter(m => m.sheet === true);
  assert.ok(sheets.length >= 8, 'the 07-10 audit flags ride the registry as data');
  for (const s of sheets) {
    assert.ok(!claimedUrls.has(s.url),
      `${s.id} is an audited multi-object sheet but propArt claims it as kind art — the multi-object rule forbids this`);
  }
  // The armory trio (island-checked singles) IS claimed — for the rack kind.
  for (const id of ['armory_iron', 'wall_of_blades', 'armory_arcane']) {
    const mini = MINI_LIBRARY.find(m => m.id === id);
    assert.ok(mini && !mini.sheet, `${id} is a registered single-object mini`);
    assert.ok(PROP_ART.rack.minis.some(m => m.url === mini.url), `${id} is rack-kind art`);
  }
});

test('U685: the Builder keeps its runtime refusal for contract-less placement', () => {
  assert.ok(HTML.includes('not placeable — needs an engine object contract'),
    'the placement guard message is present — the UI refuses kinds the engine dump does not know');
  assert.ok(HTML.includes('needs split → object contract'),
    'the library panel names the sheet state honestly');
});
