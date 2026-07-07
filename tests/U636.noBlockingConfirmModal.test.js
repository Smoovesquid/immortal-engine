// U636 — MAP-WEDGE-1: the front-door "new character over a save" confirmation
// must NOT use window.confirm (a synchronous, main-thread-blocking native modal).
//
// Root cause of the intermittent quickstart "hard wedge" (2026-07-07): clicking a
// pre-rolled hero with a saved character present routed through confirmNewOverSave,
// which called window.confirm(...). That native modal blocks the JS main thread
// until dismissed — freezing the whole page (map rAF loops and all) and wedging
// forever in any embedded/automated browser that can't surface or click it. The
// "intermittent" was deterministic on whether a save existed. Fix: a non-blocking
// in-app modal (ui.confirm + renderConfirmModal). This guards the regression at the
// source (the v1.js UI has no unit harness; a source contract is the honest guard,
// same idiom as U576's render-contract regexes).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const V1 = fs.readFileSync(path.join(__dirname, '..', 'public', 'v1.js'), 'utf8');

// Strip line comments so a prose mention of "window.confirm" in a code comment
// (there are two, explaining the fix) does not trip the call-site guard.
const CODE = V1.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

test('U636a no window.confirm CALL on the render/boot path (the wedge anti-pattern)', () => {
  assert.ok(!/window\.confirm\s*\(/.test(CODE),
    'public/v1.js must not call window.confirm — it blocks the main thread and hard-wedges the page');
  // Bare confirm(...) (implicit window) too.
  assert.ok(!/(^|[^.\w])confirm\s*\(/.test(CODE.replace(/confirmNewOverSave/g, '')),
    'no bare confirm(...) call either — same blocking-modal hazard');
});

test('U636b no window.alert CALL on the render/boot path (same main-thread block)', () => {
  assert.ok(!/window\.alert\s*\(/.test(CODE) && !/(^|[^.\w])alert\s*\(/.test(CODE),
    'public/v1.js must not call alert() — another synchronous page-freezing modal');
});

test('U636c the confirmation is an IN-APP modal (non-blocking) — the fix is present', () => {
  assert.ok(/ui\.confirm\s*=/.test(CODE), 'confirmNewOverSave must set ui.confirm (in-app modal state)');
  assert.ok(/function renderConfirmModal\s*\(/.test(CODE), 'renderConfirmModal must exist');
  // and it must actually be appended in render(), or it would never show.
  assert.ok(/renderConfirmModal\s*\(\s*\)/.test(CODE) && /app\.append\(\s*confirmModal\s*\)/.test(CODE),
    'renderConfirmModal() must be rendered (appended) so the confirm can surface');
});
