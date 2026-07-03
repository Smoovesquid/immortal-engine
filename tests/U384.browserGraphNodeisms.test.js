// U384 — the browser-served module graph must be free of Node-only globals.
//
// The 07-03 root-cause of "everything I type does nothing": INT-1/INT-2 added
// bare `process.env` reads to engine/instrument.js and engine/playloop.js —
// modules public/v1.js imports and runs IN THE BROWSER, where `process` does
// not exist. Every typed turn threw ReferenceError inside playerMove; the UI
// caught it and showed nothing. Node-side tests can't catch this class
// (process always exists there), so this test walks the real static import
// graph from public/v1.js and asserts no reachable file touches a Node-only
// global outside a `typeof` guard.
//
// Bonus enforcement (Purity Rule 9): the key-bearing server modules must NOT
// be reachable from the browser graph at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

// Resolve a browser import specifier (relative to the importing file under
// the served roots). public/ serves the repo root statically for /engine,
// /map, /content, /panels etc. — mirror that mapping.
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null; // bare/CDN — not local
  let target;
  if (spec.startsWith('/')) {
    target = path.join(ROOT, spec); // served-absolute → repo root
  } else {
    target = path.resolve(path.dirname(fromFile), spec);
  }
  if (!fs.existsSync(target)) {
    // public/v1.js imports ../engine/... which resolves out of public/ into
    // the repo root — already handled by path.resolve. Anything missing is a
    // real breakage; surface it.
    return { missing: true, target };
  }
  return { missing: false, target };
}

function importsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const specs = [];
  const re = /(?:^|\n)\s*(?:import\s+(?:[\s\S]*?)\s+from\s+|import\s+|export\s+(?:[\s\S]*?)\s+from\s+)['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) specs.push(m[1]);
  // dynamic imports too — they still execute in the browser when reached
  const dyn = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dyn.exec(src)) !== null) specs.push(m[1]);
  return specs;
}

function buildGraph(entry) {
  const seen = new Set();
  const queue = [entry];
  const missing = [];
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    for (const spec of importsOf(f)) {
      const r = resolveSpec(f, spec);
      if (!r) continue;
      if (r.missing) { missing.push(`${path.relative(ROOT, f)} → ${spec}`); continue; }
      if (r.target.endsWith('.js')) queue.push(r.target);
    }
  }
  return { files: [...seen], missing };
}

// Node-only globals that throw as bare references in a browser. A line that
// carries a `typeof <global>` guard is safe by construction.
const NODE_GLOBALS = ['process', '__dirname', '__filename', 'require'];

// Strip string literals and comments from a line of code so prose like
// "spells that require a name" or "enjoys the process" can't false-positive.
function codeOnly(line) {
  return line
    .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''")
    .replace(/\/\*.*?\*\//g, '')
    .split('//')[0];
}

function offendingLines(file) {
  const out = [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const code = codeOnly(line);
    for (const g of NODE_GLOBALS) {
      const bare = new RegExp(`(?<![\\w$.'"\`])${g}(?![\\w$])`);
      if (bare.test(code) && !code.includes(`typeof ${g}`)) {
        out.push(`${path.relative(ROOT, file)}:${i + 1} — bare \`${g}\`: ${line.trim().slice(0, 90)}`);
      }
    }
  });
  return out;
}

const ENTRY = path.join(PUBLIC_DIR, 'v1.js');
const { files, missing } = buildGraph(ENTRY);

test('U384: the v1 browser import graph resolves completely', () => {
  assert.deepEqual(missing, [], `unresolvable browser imports:\n${missing.join('\n')}`);
  assert.ok(files.length > 50, `sanity: the graph should be large (got ${files.length} files)`);
});

test('U384: no Node-only global is referenced bare anywhere in the browser graph', () => {
  const offenders = files.flatMap(offendingLines);
  assert.deepEqual(
    offenders,
    [],
    `Node-only globals reachable from public/v1.js (each throws ReferenceError in the browser):\n${offenders.join('\n')}`
  );
});

test('U384: key-bearing server modules are NOT reachable from the browser (Purity Rule 9)', () => {
  const forbidden = files.filter(f =>
    f.includes(`${path.sep}server${path.sep}`) || f.endsWith(`intent${path.sep}llmIntent.js`)
  );
  assert.deepEqual(
    forbidden.map(f => path.relative(ROOT, f)),
    [],
    'server/llmProvider-adjacent modules must never enter the v1 import graph'
  );
});
