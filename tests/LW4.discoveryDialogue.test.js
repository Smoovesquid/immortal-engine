import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { resolveArc } from '../engine/npc/npcArc.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { readFileSync } from 'fs';

const manifest = normalizeManifest(JSON.parse(readFileSync(new URL('../packs/manifest.json', import.meta.url))));
const byId = {};
for (const p of manifest.packs) { try { byId[p.id] = normalizePack(JSON.parse(readFileSync(new URL(`../packs/${p.id}.json`, import.meta.url)))); } catch (e) {} }

function freshWorld(seed) {
  return beginAdventure(newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
}

// convo-honesty FIX 3 (2026-06-25): saying hello can't HAND you an NPC's inner
// want — that's unearned mind-reading from a glance. The want is no longer surfaced
// on the enter narration. It still lives in the arc data (resolveArc is
// deterministic) for an EARNED reveal through conversation, so the feature is
// intact — it's just no longer spilled on the first greeting.
const npcByName = (w, name) =>
  ((w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId)?.settlement?.npcs || [])
    .find(n => String(n?.name || '') === String(name));

test('LW4: meeting an NPC does NOT surface the want, but it stays derivable', () => {
  const w = freshWorld('lw4a');
  const names = (w.timeline || []).find(e => e.kind === 'begin')?.data?.npcsPresent || [];
  assert.ok(names.length, 'expected NPCs present');
  const r = playerMove(w, byId, `talk to ${names[0]}`);
  // The greeting must NOT read their inner want.
  assert.doesNotMatch(r.output?.narration || '', /a want in them/i, `want leaked on hello: ${r.output?.narration}`);
  // ...but the want is still there for an earned reveal (NPC is now met).
  const npc = npcByName(r.world, names[0]);
  assert.ok(npc, 'the greeted NPC is resolvable');
  assert.ok(resolveArc(npc, r.world.meta?.seed).surfaceWant, 'the want remains derivable from arc data');
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

test('LW4: wants vary by role/person (not all identical) — read from arc data', () => {
  const w = freshWorld('lw4c');
  const names = (w.timeline || []).find(e => e.kind === 'begin')?.data?.npcsPresent || [];
  const wants = new Set();
  let cur = w;
  for (const name of names.slice(0, 4)) {
    const r = playerMove(cur, byId, `talk to ${name}`);
    // The want is no longer in the narration (FIX 3) — read it from the arc data,
    // which is where the EARNED reveal pulls from.
    const npc = npcByName(r.world, name);
    const want = npc ? resolveArc(npc, r.world.meta?.seed).surfaceWant : null;
    if (want) wants.add(String(want).trim());
    cur = playerMove(r.world, byId, 'leave').world;
  }
  assert.ok(wants.size >= 2, `wants should vary, got ${wants.size}`);
});
