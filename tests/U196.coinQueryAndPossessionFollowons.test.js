// U196 — H-35 coin/purse meta-query interceptor + R3 follow-ons from H-31.
//
// R1 (gracefulAdjudication.js) — no dedicated coin/purse handler for some
//                                  phrasings ("do I even have any money on
//                                  me?"), and a compound damage+coin ask
//                                  drops the coin half (same shape as the
//                                  existing Armor-value fold).
// R2 (gracefulAdjudication.js) — the bogus-possession-claim correction drops
//                                  a coin claim/ask in the same breath.
// R3 (gracefulAdjudication.js) — describeLoadout can list a signature item
//                                  twice when it's also an equipped weapon.
// R4 (playloop.js)             — isLongRestIntent's bare \bsleep\b swallows
//                                  a direct NPC-addressed question.
//
// Each rule's catch case is paired with a false-positive guard (mirrors
// U192/U194/U195's discipline).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}
const packs = loadPacks();

function baseWorld() {
  return {
    party: [{
      name: 'Nyx',
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      purse: { copper: 3, silver: 0, gold: 0, platinum: 0 },
      inventory: { weapons: [{ name: 'Worn Blade', damage: '1d6' }], armor: [{ name: 'Padded coat' }] },
      signature: { itemName: 'Worn Blade' }
    }]
  };
}

// ── R1 — coin/purse meta-query interceptor ──────────────────────────────────

test('U196-01: R1 catch — "do I even have any money on me?" is recognized and answered from the real purse', () => {
  const world = baseWorld();
  const text = 'Oh, do I even have any money on me? I have no idea what I\'m carrying.';
  assert.equal(isMetaQuestion(text), true, 'must be recognized as a meta-question');
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /3 copper/, `must answer from the real purse: ${ans}`);
});

test('U196-02: R1 catch — an empty purse is reported honestly, not invented', () => {
  const world = baseWorld();
  world.party[0].purse = { copper: 0, silver: 0, gold: 0, platinum: 0 };
  const ans = handleMetaQuestion('How much coin do I have?', world);
  assert.match(ans, /flat broke|empty/i, `empty purse must be honest: ${ans}`);
});

test('U196-03: R1 catch — a compound damage+coin ask answers both halves, not just the damage die', () => {
  const world = baseWorld();
  const text = 'How much coin is in the pouch, and what\'s the damage die on this short blade?';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /1d6/, `damage half must answer: ${ans}`);
  assert.match(ans, /3 copper/, `coin half must not be dropped: ${ans}`);
});

test('U196-04: R1 false-positive guard — a non-coin damage question is unaffected', () => {
  const world = baseWorld();
  const ans = handleMetaQuestion('What\'s the damage die on this short blade?', world);
  assert.match(ans, /1d6/);
  assert.doesNotMatch(ans, /purse|copper|broke/i, `no coin text must appear when none was asked: ${ans}`);
});

// ── R2 — possession-contradiction correction must not drop a coin claim ────

test('U196-10: R2 catch — a bogus gear claim + coin claim in the same breath answers both', () => {
  const world = baseWorld();
  const text = 'So I have the Worn Blade, the cloak, and three copper. Confirm the cloak — is it on me, yes or no?';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /no cloak/i, `gear correction must still fire: ${ans}`);
  assert.match(ans, /3 copper/, `coin half must not be silently eaten: ${ans}`);
});

test('U196-11: R2 catch — "you said I had a pouch of coin" gets the real purse answer appended to the correction', () => {
  const world = baseWorld();
  const text = 'Empty? You said I had a pouch of coin under my cloak two breaths ago. Which is it?';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /no cloak/i, `gear correction must still fire: ${ans}`);
  assert.match(ans, /3 copper/, `coin half must be answered: ${ans}`);
});

test('U196-12: R2 false-positive guard — a single-clause possession correction with no coin mention is unaffected', () => {
  const world = baseWorld();
  const text = 'You said I had a staff and a robe a moment ago.';
  const ans = handleMetaQuestion(text, world);
  assert.match(ans, /no staff|no robe/i, `gear correction must still fire: ${ans}`);
  assert.doesNotMatch(ans, /purse|copper|broke/i, `no coin text must appear when none was claimed: ${ans}`);
});

// ── R3 — describeLoadout must not list a signature item twice ──────────────

test('U196-20: R3 catch — a signature item that is also an equipped weapon is named once', () => {
  const world = baseWorld();
  world.party[0].inventory.weapons = [{ name: 'Kitchen cleaver', damage: '1d4' }, { name: 'Worn Blade', damage: '1d6' }];
  world.party[0].signature = { itemName: 'Kitchen cleaver' };
  const ans = handleMetaQuestion('What am I wielding?', world);
  const occurrences = (ans.match(/Kitchen cleaver/gi) || []).length;
  assert.equal(occurrences, 1, `signature item already in the weapons line must not repeat: ${ans}`);
});

test('U196-21: R3 false-positive guard — a non-duplicate signature item still gets its own line', () => {
  const world = baseWorld();
  world.party[0].signature = { itemName: 'a tarnished locket' };
  const ans = handleMetaQuestion('What am I wielding?', world);
  assert.match(ans, /tarnished locket/i, `a genuinely distinct signature item must still be named: ${ans}`);
});

// ── R4 — isLongRestIntent must not swallow a direct NPC-addressed question ─

function withKael(seed) {
  let w = beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}),
      decompressed: true,
      npcs: [{
        id: 'npc_kael', name: 'Kael', role: 'elder', hostile: false,
        combatProfile: { maxHp: 20, damage: 1, canParley: false },
        personality: {}, conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [], secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

test('U196-30: R4 catch — a direct NPC-addressed question containing "sleep" is not resolved as a long rest', () => {
  const w = withKael('glass-harbor-u196-30');
  assert.equal(w.combat?.active, false, 'sanity: out of combat');
  const before = w.meta?.escapeHp;
  const out = playerMove(w, packs, 'Kael, elder — you\'d know. Whose roof did I sleep under last night?');
  assert.notEqual(out.output.mechanics, '[rest:long]', `must not resolve as a long rest: ${out.output.mechanics}`);
  assert.equal(out.world.meta?.escapeHp, before, 'HP must be unchanged — no rest was actually taken');
});

test('U196-31: R4 false-positive guard — a genuine sleep request with no NPC addressed still long-rests', () => {
  const w = withKael('glass-harbor-u196-31');
  const hurt = { ...w, meta: { ...w.meta, escapeHp: 1 } };
  const out = playerMove(hurt, packs, 'I find a quiet corner and sleep.');
  assert.equal(out.output.mechanics, '[rest:long]', `a genuine sleep request must still long-rest: ${out.output.mechanics}`);
});
