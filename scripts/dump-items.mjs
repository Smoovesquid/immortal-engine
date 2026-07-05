// dump-items.mjs — export the full in-game item catalogue to a static JSON the
// browser dev-tools (house-builder "Secrets" stash menu) can fetch. Re-run when
// the item catalogue changes:  node scripts/dump-items.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ITEM_CATALOG } from '../engine/ruleset/core/items/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const items = Object.values(ITEM_CATALOG)
  .map(d => ({ defRef: d.defRef, name: d.name || d.defRef, kind: d.kind || d.type || 'misc' }))
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

const outDir = path.join(ROOT, 'public', 'map');   // committed dir (a data/ .gitignore rule excludes public/data)
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'items.json'), JSON.stringify(items));
console.log(`wrote ${items.length} items → public/map/items.json`);
