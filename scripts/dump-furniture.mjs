// dump-furniture.mjs — export the engine's furniture catalogue (roomDetail.js's
// module-local FURN map, so parsed from source, not imported) to a static JSON the
// house-builder's furniture picker fetches. Re-run when the catalogue changes:
//   node scripts/dump-furniture.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'engine', 'structures', 'roomDetail.js'), 'utf8');

// isolate the `const FURN = { … };` block, then pull each `key: { label: '…'` entry
const block = src.slice(src.indexOf('const FURN'));
const end = block.indexOf('\n};');
const furnBlock = block.slice(0, end);
const out = [];
const re = /^\s{2}(\w+):\s*\{\s*label:\s*'([^']+)'/gm;
let m;
while ((m = re.exec(furnBlock))) out.push({ type: m[1], name: m[2] });
out.sort((a, b) => a.name.localeCompare(b.name));

fs.mkdirSync(path.join(ROOT, 'public', 'map'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public', 'map', 'furniture.json'), JSON.stringify(out));
console.log(`wrote ${out.length} furniture types → public/map/furniture.json`);
