import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { readFileSync } from 'fs';

const manifest = normalizeManifest(JSON.parse(readFileSync(new URL('../packs/manifest.json', import.meta.url))));
const byId = {};
for (const p of manifest.packs) { try { byId[p.id] = normalizePack(JSON.parse(readFileSync(new URL(`../packs/${p.id}.json`, import.meta.url)))); } catch (e) {} }

function freshWorld(seed) {
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
}

test('LW4: meeting an NPC surfaces a want', () => {
  const w = freshWorld('lw4a');
  const names = (w.timeline || []).find(e => e.kind === 'begin')?.data?.npcsPresent || [];
  assert.ok(names.length, 'expected NPCs present');
  const r = playerMove(w, byId, `talk to ${names[0]}`);
  assert.match(r.output?.narration || '', /a want in them/i, `no want surfaced: ${r.output?.narration}`);
});

test('LW4: no double-"the" when the name already carries an epithet', () => {
  const w = freshWorld('lw4b');
  const names = (w.timeline || []).find(e => e.kind === 'begin')?.data?.npcsPresent || [];
  for (const name of names) {
    if (!/ the /i.test(name)) continue; // only epithet names
    const r = playerMove(w, byId, `talk to ${name}`);
    assert.ok(!/ the \w+ the /i.test(r.output?.narration || ''), `double-the leaked: ${r.output?.narration}`);
    playerMove(r.world, byId, 'leave');
  }
});

test('LW4: wants vary by role/person (not all identical)', () => {
  const w = freshWorld('lw4c');
  const names = (w.timeline || []).find(e => e.kind === 'begin')?.data?.npcsPresent || [];
  const wants = new Set();
  let cur = w;
  for (const name of names.slice(0, 4)) {
    const r = playerMove(cur, byId, `talk to ${name}`);
    const m = (r.output?.narration || '').match(/a want in them, plain enough: ([^.]+)\./i);
    if (m) wants.add(m[1].trim());
    cur = playerMove(r.world, byId, 'leave').world;
  }
  assert.ok(wants.size >= 2, `wants should vary, got ${wants.size}`);
});
