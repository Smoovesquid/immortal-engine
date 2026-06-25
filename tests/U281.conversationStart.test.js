// U281 — conversation begins only by ADDRESSING someone, never by proximity, a bare
// mention, or by resuming a save. Classic DM-ing: you start in a room by yourself; a
// conversation opens when you talk to / approach / greet someone, and Continue lands you
// back in the SCENE (not frozen mid-dialogue). Hermetic — no network, no API key.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { markResume } from '../engine/save.js';
import { beginDialogue } from '../engine/npc/dialogue.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const dlg = (w) => w?.scene?.dialogue?.npcId ?? null;

test('U281: a NEW game starts you alone — not in conversation', () => {
  assert.equal(dlg(boot()), null);
});

test('U281: Continue lands you in the SCENE — a saved conversation is cleared on resume', () => {
  // Enter a REAL conversation (the valid entry path), as if the save were made mid-talk.
  const w = playerMove(boot(), PACKS, 'I step outside').world;
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const npc = (node?.settlement?.npcs || []).find(n => n && !n.hostile);
  assert.ok(npc, 'precondition: a present NPC to have been talking to');
  const begun = beginDialogue(w, String(npc.name || npc.id));
  assert.ok(begun.outcome.ok && begun.world.scene?.dialogue?.npcId, 'precondition: saved mid-conversation');
  assert.equal(markResume(begun.world).scene.dialogue, null, 'resume must not drop you back into the conversation');
});

test('U281: resume is a safe no-op when you were not in conversation', () => {
  const w = boot();
  assert.doesNotThrow(() => markResume(w));
  assert.equal(dlg(markResume(w)), null);
});

test('U281: a mention / a look does NOT start a conversation — only addressing does', () => {
  // Step out to the settlement so its people are reachable, then find one.
  const w = playerMove(boot(), PACKS, 'I step outside').world;
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
  const npc = (node?.settlement?.npcs || []).find(n => n && !n.hostile);
  if (!npc) return; // no reachable neighbor on this seed/state — address assertions don't apply
  const name = String(npc.name || '').split(/\s+/)[0];

  // Mentioning or observing them is NOT addressing them.
  assert.equal(dlg(playerMove(w, PACKS, `I look at ${name} across the way`).world), null, 'a look is not a conversation');
  assert.equal(dlg(playerMove(w, PACKS, `${name} is standing over there`).world), null, 'a mention is not a conversation');

  // Explicitly addressing them DOES open a conversation.
  assert.ok(dlg(playerMove(w, PACKS, `talk to ${name}`).world), 'talk to X opens the conversation');
});
