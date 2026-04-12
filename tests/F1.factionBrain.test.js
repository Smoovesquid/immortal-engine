// F1: Faction reputation influences NPC brain decisions — context building,
// fallback rules, and prompt generation are all faction-aware.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildNpcContext, fallbackRules, compressPrompt } from '../engine/npc/npcBrain.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeNpc(trust, overrides = {}) {
  return {
    id: 'npc_faction_test',
    name: 'Kaelen',
    role: 'guard',
    archetype: 'guard',
    traits: ['stern'],
    personality: { honesty: 0.5, trustOfOutsiders: 0.5, selfPreservation: 0.5 },
    conversationState: { trustLevel: trust, metPlayer: true, topicsDiscussed: [], lastInteraction: null },
    knowledgeGraph: [
      { factId: 'public_fact_1', source: 'witnessed', confidence: 0.9 },
      { factId: 'public_fact_2', source: 'witnessed', confidence: 0.8 },
      { factId: 'secret_plan', source: 'secret', confidence: 1.0 }
    ],
    secrets: ['secret_plan'],
    relationships: {},
    rumorIds: ['rumor_x'],
    ...overrides
  };
}

function makeWorld(factionRep = {}) {
  return {
    time: { turn: 5 },
    rumors: [
      { id: 'rumor_x', body: 'Whispers of uprising', tier: 1, tags: ['politics'] }
    ],
    factions: [
      { id: 'civic', goal: 'maintain order', pressure: 10, assets: [], hostility: 10, lastMove: '' },
      { id: 'shadow', goal: 'undermine order', pressure: 20, assets: [], hostility: 80, lastMove: '' }
    ],
    reputation: { factions: { civic: 0, shadow: 0, ...factionRep } }
  };
}

// ── F1-01: faction data appears in context ──────────────────────────────────

describe('F1-01: faction data appears in context', () => {
  it('buildNpcContext includes factionStanding for faction NPC', () => {
    const npc = makeNpc(5, { factionId: 'civic' });
    const world = makeWorld({ civic: 30 });
    const ctx = buildNpcContext(npc, world, 'hello');

    assert.equal(ctx.factionId, 'civic');
    assert.ok(ctx.factionStanding, 'factionStanding should not be null');
    assert.equal(ctx.factionStanding.factionId, 'civic');
    assert.equal(ctx.factionStanding.playerReputation, 30);
    assert.equal(ctx.factionStanding.hostility, 10);
  });
});

// ── F1-02: hostile faction lowers sharing ───────────────────────────────────

describe('F1-02: hostile faction lowers sharing', () => {
  it('NPC with trust 5, shadow faction, player rep -60 → deflect', () => {
    const npc = makeNpc(5, { factionId: 'shadow' });
    const world = makeWorld({ shadow: -60 });
    const ctx = buildNpcContext(npc, world, 'Tell me your secrets');

    const d = fallbackRules(ctx);
    assert.deepEqual(d.share, [], 'hostile faction → share nothing');
    assert.equal(d.mood, 'hostile');
    assert.equal(d.approach, 'deflect');
  });

  it('hostile faction with high hostility + negative rep → deflect', () => {
    // hostility >= 70 && rep < 0 triggers hostile
    const npc = makeNpc(5, { factionId: 'shadow' });
    const world = makeWorld({ shadow: -10 }); // rep < 0, hostility 80
    const ctx = buildNpcContext(npc, world, 'hello');

    const d = fallbackRules(ctx);
    assert.deepEqual(d.share, [], 'hostile faction with negative rep → share nothing');
    assert.equal(d.mood, 'hostile');
    assert.equal(d.approach, 'deflect');
  });
});

// ── F1-03: allied faction warms mood ────────────────────────────────────────

describe('F1-03: allied faction warms mood', () => {
  it('NPC trust 4, civic faction, player rep +60 → boosted sharing', () => {
    const npc = makeNpc(4, { factionId: 'civic' });
    const world = makeWorld({ civic: 60 });
    const ctx = buildNpcContext(npc, world, 'What do you know?');

    const d = fallbackRules(ctx);
    // Trust 4 + faction warm boost → effective trust 5, still in cautious band
    assert.equal(d.share.length, 1, 'boosted trust still shares one fact');
    assert.equal(d.approach, 'wait_to_be_asked');
  });

  it('NPC trust 6, civic faction, player rep +60 → effective trust 7 (warm)', () => {
    const npc = makeNpc(6, { factionId: 'civic' });
    const world = makeWorld({ civic: 60 });
    const ctx = buildNpcContext(npc, world, 'What do you know?');

    const d = fallbackRules(ctx);
    // Trust 6 + faction warm boost → effective trust 7 → warm sharing
    assert.ok(d.share.includes('public_fact_1'), 'shares public facts at effective trust 7');
    assert.ok(d.share.includes('rumor_x'), 'shares rumors at effective trust 7');
    assert.equal(d.mood, 'warm');
    assert.equal(d.approach, 'volunteer');
  });
});

// ── F1-04: high trust overrides faction hostility ───────────────────────────

describe('F1-04: high trust overrides faction hostility', () => {
  it('NPC trust 8, shadow faction, player rep -70 → trust wins', () => {
    const npc = makeNpc(8, { factionId: 'shadow' });
    const world = makeWorld({ shadow: -70 });
    const ctx = buildNpcContext(npc, world, 'Tell me everything');

    const d = fallbackRules(ctx);
    // Trust >= 7 overrides faction hostility
    assert.ok(d.share.length > 0, 'high trust still shares despite hostile faction');
    assert.ok(d.share.includes('public_fact_1'));
    assert.equal(d.mood, 'warm');
    assert.equal(d.approach, 'volunteer');
  });

  it('NPC trust 7, shadow faction, player rep -60 → trust wins', () => {
    const npc = makeNpc(7, { factionId: 'shadow' });
    const world = makeWorld({ shadow: -60 });
    const ctx = buildNpcContext(npc, world, 'hello');

    const d = fallbackRules(ctx);
    assert.ok(d.share.length > 0, 'trust 7 overrides faction hostility');
    assert.equal(d.mood, 'warm');
  });
});

// ── F1-05: neutral faction has no effect ────────────────────────────────────

describe('F1-05: neutral faction has no effect', () => {
  it('NPC trust 5, civic faction, player rep 0 → same as no faction', () => {
    const npcFaction = makeNpc(5, { factionId: 'civic' });
    const npcNoFaction = makeNpc(5);
    const world = makeWorld({ civic: 0 });

    const ctxFaction = buildNpcContext(npcFaction, world, 'What do you know?');
    const ctxNoFaction = buildNpcContext(npcNoFaction, world, 'What do you know?');

    const dFaction = fallbackRules(ctxFaction);
    const dNoFaction = fallbackRules(ctxNoFaction);

    assert.equal(dFaction.share.length, dNoFaction.share.length, 'same share count');
    assert.equal(dFaction.mood, dNoFaction.mood, 'same mood');
    assert.equal(dFaction.approach, dNoFaction.approach, 'same approach');
  });
});

// ── F1-06: no faction NPC unaffected ────────────────────────────────────────

describe('F1-06: no faction NPC unaffected', () => {
  it('NPC with no factionId → factionStanding is null', () => {
    const npc = makeNpc(5); // no factionId
    const world = makeWorld({ civic: 50 });
    const ctx = buildNpcContext(npc, world, 'hello');

    assert.equal(ctx.factionId, '');
    assert.equal(ctx.factionStanding, null);
  });

  it('NPC with factionId not in world.factions → factionStanding is null', () => {
    const npc = makeNpc(5, { factionId: 'nonexistent' });
    const world = makeWorld();
    const ctx = buildNpcContext(npc, world, 'hello');

    assert.equal(ctx.factionStanding, null);
  });
});

// ── F1-07: faction info in compressed prompt ────────────────────────────────

describe('F1-07: faction info in compressed prompt', () => {
  it('compressed prompt includes faction line when faction exists', () => {
    const npc = makeNpc(5, { factionId: 'civic' });
    const world = makeWorld({ civic: 25 });
    const ctx = buildNpcContext(npc, world, 'hello');

    const prompt = compressPrompt(ctx);
    assert.ok(prompt.includes('Fac:civic'), 'prompt contains faction id');
    assert.ok(prompt.includes('rep:25'), 'prompt contains reputation');
    assert.ok(prompt.includes('host:10'), 'prompt contains hostility');
  });

  it('compressed prompt omits faction line when no faction', () => {
    const npc = makeNpc(5); // no factionId
    const world = makeWorld();
    const ctx = buildNpcContext(npc, world, 'hello');

    const prompt = compressPrompt(ctx);
    assert.ok(!prompt.includes('Fac:'), 'prompt should not contain faction line');
  });
});

// ── F1-08: wary faction overrides warm/amused mood ──────────────────────────

describe('F1-08: wary faction caps warm mood', () => {
  it('NPC trust 7, faction rep -30 → mood becomes wary instead of warm', () => {
    // rep <= -25 triggers wary shift; trust 7 normally yields warm mood
    const npc = makeNpc(7, { factionId: 'civic' });
    const world = makeWorld({ civic: -30 });
    const ctx = buildNpcContext(npc, world, 'hello');

    const d = fallbackRules(ctx);
    // Trust 7 → shares openly, but faction wary overrides mood to wary
    assert.ok(d.share.length > 0, 'still shares at high trust');
    assert.equal(d.mood, 'wary', 'faction wary overrides warm mood');
  });
});
