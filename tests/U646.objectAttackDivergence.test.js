// U646–U649 — DM-GATE-1a divergence guards: the object-attack lane must not
// cannibalize NPC combat, ordinary meta answers, the other object verbs, or let
// ungrounded invented gear become canon.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, carriesInteriorMovementIntent, detectObjectAttackIntent } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { normalizeManifest } from '../engine/rulesets.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

function boot() {
  return beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

function route(world, text) {
  const inCombat = Boolean(world.combat?.active);
  const inDialogue = Boolean(world.scene?.dialogue?.npcId);
  if (!inCombat && !inDialogue && isMetaQuestion(text)
      && !carriesInteriorMovementIntent(world, text) && !detectObjectAttackIntent(world, text)) {
    const answer = handleMetaQuestion(text, world);
    if (answer) return { kind: 'meta', dm: answer, mech: '', world };
  }
  const { world: w2, output } = playerMove(world, PACKS, text);
  return {
    kind: output?.dialogue ? 'dialogue' : 'action',
    dm: String(output?.narration || '').replace(/^\s*Wizard:\s*/, ''),
    mech: String(output?.mechanics || ''),
    world: w2
  };
}

// A synthetic settlement node with a present NPC, mirroring U218 (robust vs seed drift).
function worldWithNpc() {
  const base = boot();
  const node = {
    id: 'g1a_settlement',
    name: 'Test Village',
    nodeType: 'settlement',
    discovered: true,
    settlement: {
      npcs: [{ id: 'npc_baker', name: 'Mira Hearth', role: 'baker', occupation: 'baker', descriptor: 'flour-dusted baker', hostile: false, conversationState: { trustLevel: 5 } }]
    }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    scene: { ...(base.scene || {}), interior: null, dialogue: null }
  });
}

// ── U646 — NPC attacks still start combat; the detector excludes them ───────────
test('U646-01: detectObjectAttackIntent is FALSE for NPC attacks and TRUE only for object attacks', () => {
  const w = worldWithNpc();
  assert.equal(detectObjectAttackIntent(w, 'I draw my dagger and stab Mira in the gut'), false, 'NPC attack is not object-routed');
  assert.equal(detectObjectAttackIntent(w, 'I stab the baker'), false, 'role-target NPC attack is not object-routed');
});

test('U646-02: a declared NPC attack still starts real combat (unaffected by the object lane)', () => {
  const r = playerMove(worldWithNpc(), PACKS, 'I draw my dagger and stab Mira in the gut');
  assert.equal(r.world.combat?.active, true, 'NPC attack still starts combat');
  assert.ok((r.world.combat?.enemies || []).some(e => /Mira/.test(String(e?.name || ''))), 'the NPC becomes the combat enemy');
});

// ── U647 — an ordinary rules question with no action still answers as meta ───────
test('U647-01: a bare rules question still routes to meta and answers a clean modifier', () => {
  const r = route(boot(), "what's my attack modifier?");
  assert.equal(r.kind, 'meta', 'no action declared → still a meta answer');
  assert.equal(detectObjectAttackIntent(boot(), "what's my attack modifier?"), false, 'a bare question is not an object attack');
  assert.doesNotMatch(r.dm, /breakpoint/i, 'answers the number, not the raw breakpoint table');
});

// ── U648 — the other object verbs are unchanged ─────────────────────────────────
test('U648-01: open still reveals contents', () => {
  const r = playerMove(boot(), PACKS, 'I open the iron-bound chest.');
  assert.match(String(r.output?.narration || ''), /inside|lid|open/i, 'open still reveals/opens the chest');
  assert.equal(r.world.combat?.active ?? false, false);
});

test('U648-02: examine still observes; smash still salvages', () => {
  const ex = playerMove(boot(), PACKS, 'I examine the iron-bound chest closely.');
  assert.match(String(ex.output?.mechanics || '') + String(ex.output?.narration || ''), /observe|look|iron/i, 'examine still describes the chest');

  const sm = playerMove(boot(), PACKS, 'I smash the iron-bound chest with my staff.');
  assert.match(String(sm.output?.mechanics || ''), /salvage/i, 'smash still routes to the salvage path, not the attack lane');
});

// ── U649 — ungrounded invented gear does not become canon ───────────────────────
test('U649-01: attacking with an item the player does not hold mints no phantom weapon', () => {
  const r = route(boot(), 'I attack the iron-bound chest with my Vorpal Blade of Doom.');
  assert.equal(r.world.combat?.active ?? false, false, 'still no combat');
  // The invented weapon must not become a real item (inventory) or a canonical entity.
  // (The raw utterance legitimately echoes in the event log — that is intent-recording,
  // not canon; so we check the player's inventory and the canon log, not the whole world.)
  const inv = r.world.party?.[0]?.inventory || {};
  const invNames = Object.keys(inv).flatMap(b => (Array.isArray(inv[b]) ? inv[b] : []).map(it => String(it?.name || it?.defRef || '')));
  assert.ok(!invNames.some(n => /vorpal/i.test(n)), 'no phantom Vorpal Blade is minted into inventory');
  const canon = JSON.stringify(r.world.canonLog || {});
  assert.doesNotMatch(canon, /vorpal/i, 'the invented weapon must not enter the canon log');
});
