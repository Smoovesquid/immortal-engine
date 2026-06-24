// Dump a real serialized world for the ONE MAP visual harness (public/map/reference-onemap.html).
// Boots seed `tallow`, journeys bed → Old Shrine → Crossway Village so the fixture has:
//   multiple discovered (known) nodes + a rumor tier + ≥2 settlements with real layouts.
// Deterministic; NOT part of any test path — a dev tool for iterating on M5 beauty.

import fs from 'node:fs';
import path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const root = path.join(__dirname, '..');

function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(root, 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(root, p.path), 'utf8')));
  return byId;
}

const PACKS = loadPacks();
let w = beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const legs = [
  'I get out of bed and step outside.',
  'I travel west to Old Shrine.',
  'I take the road to Crossway Village.',
];
for (const leg of legs) w = playerMove(w, PACKS, leg).world;

const name = (id) => (w.map.nodes || []).find(n => n.id === id)?.name || id;
console.error(`at: ${name(w.map.currentNodeId)} | discovered: ${(w.map.discovered || []).map(name).join(', ')}`);

const out = path.join(root, 'public', 'map', 'onemap-fixture.json');
fs.writeFileSync(out, JSON.stringify(w));
console.error(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
