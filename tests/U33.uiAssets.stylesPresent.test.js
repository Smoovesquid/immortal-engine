import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '..', 'public');

const MIN_STYLE_BYTES = 500;

test('U33: v1 UI loads shared styles.css asset', async () => {
  const cssPath = path.join(publicDir, 'styles.css');
  const cssStat = await stat(cssPath);
  assert.ok(cssStat.isFile(), 'public/styles.css must exist');
  assert.ok(cssStat.size > MIN_STYLE_BYTES, `public/styles.css too small (${cssStat.size} bytes)`);

  const v1Html = await readFile(path.join(publicDir, 'v1.html'), 'utf8');
  assert.match(v1Html, /href="\/styles\.css"/, 'public/v1.html must reference /styles.css');
});
