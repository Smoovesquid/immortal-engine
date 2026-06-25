// U94 — Prose-system playtest regressions.
//
// Codifies the findings from scripts/prose-playtest.mjs:
//   • target-aware examination of real furniture / inventory (AI-off prose floor)
//   • "talk to X" mid-combat no longer crashes the invariant layer
//   • meta-question gate and answerer stay aligned (look around / what do I see /
//     how am I doing / what did I just do)
//   • NPC epithet de-duplication ("the laborer", not "the laborer the laborer")

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isMetaQuestion, handleMetaQuestion, buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const packsDir = path.join(__dirname, '..', 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of manifest.packs) {
    byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  }
  return byId;
}
const packs = loadPacks();

function begin(seed) {
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `u94-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  return beginAdventure(w0, packs).world;
}
function currentNode(w) {
  return (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
}
// Find a begun world whose current node has furniture (most settlement starts do).
function beginWithFurniture() {
  for (const seed of ['probe', 'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot']) {
    const w = begin(seed);
    const f = currentNode(w)?.furniture;
    if (Array.isArray(f) && f.length) return { w, furniture: f };
  }
  throw new Error('no begun world with furniture found');
}

describe('U94-A: target-aware examination', () => {
  it('examines a real piece of furniture by name, grounded in its data', () => {
    const { w, furniture } = beginWithFurniture();
    const target = String(furniture[0].name).split(/\s+/).pop(); // e.g. "table" from "wooden table"
    const { output, world } = playerMove(w, packs, `examine the ${target}`);
    const n = output.narration;
    assert.ok(/observe only/.test(output.mechanics), `should be observe-only, got: ${output.mechanics}`);
    assert.ok(n.includes(furniture[0].name), `should name the furniture: ${n}`);
    // observe-only must not advance the turn clock
    assert.equal(world.time?.turn ?? 0, w.time?.turn ?? 0);
  });

  it('examines a carried inventory item', () => {
    const w = begin('probe');
    const { output } = playerMove(w, packs, 'examine the worn blade');
    assert.ok(/worn blade/i.test(output.narration), output.narration);
    assert.ok(/observe only/.test(output.mechanics));
  });

  it('on a miss, pivots to what is actually present (no hallucinated object)', () => {
    const { w, furniture } = beginWithFurniture();
    const { output } = playerMove(w, packs, 'examine the obsidian throne of kings');
    // It may echo the searched-for term ("you look for a throne…") but must not
    // describe a throne as actually present.
    assert.ok(!/look the .*throne.* over/i.test(output.narration), `must not describe a throne as present: ${output.narration}`);
    assert.ok(/but what's here is/.test(output.narration), `should pivot: ${output.narration}`);
    // pivot mentions at least one real furniture name
    assert.ok(furniture.some(f => output.narration.includes(f.name)), output.narration);
  });

  it('bare "examine" (no target) does not hijack the room overview', () => {
    const { w } = beginWithFurniture();
    const { output } = playerMove(w, packs, 'examine my surroundings');
    // generic target -> falls through to explore/overview, still observe-only
    assert.ok(!/look the .* over/.test(output.narration), output.narration);
  });
});

describe('U94-B: "search" still rolls (not swallowed by examine)', () => {
  it('"I search for hidden traps" is not observe-only', () => {
    const w = begin('probe');
    const { output } = playerMove(w, packs, 'I search for hidden traps');
    assert.ok(!/observe only/.test(output.mechanics || ''), `search should roll, got: ${output.mechanics}`);
  });
});

describe('U94-C: talk-to-NPC mid-combat does not crash', () => {
  it('routes through combat instead of starting dialogue', () => {
    // Drive a fresh adventure into combat, then attempt to talk.
    let found = false;
    for (const seed of ['alpha', 'bravo', 'charlie', 'delta', 'echo']) {
      let w = begin(seed);
      for (let i = 0; i < 25 && !w.combat?.active; i++) {
        ({ world: w } = playerMove(w, packs, 'attack the nearest enemy'));
      }
      if (!w.combat?.active) continue;
      found = true;
      let result;
      assert.doesNotThrow(() => { result = playerMove(w, packs, 'talk to the innkeeper'); },
        'talk-to-NPC during combat must not throw');
      assert.ok(!result.world.scene?.dialogue, 'must not enter dialogue while combat is active');
      break;
    }
    assert.ok(found, 'expected at least one seed to enter combat');
  });
});

describe('U94-D: meta gate and answerer stay aligned', () => {
  const aligned = [
    'look around', 'what do I see?', 'survey the area', "what's around?", "who's here?",
    'am I hurt?', 'how am I doing?', "what's my health?", 'how much HP do I have?',
    'what happened?', 'what did I just do?', 'did I succeed?',
  ];
  for (const q of aligned) {
    it(`"${q}" is gated AND answered`, () => {
      const w = begin('probe');
      assert.ok(isMetaQuestion(q), `isMetaQuestion should accept "${q}"`);
      const a = handleMetaQuestion(q, w);
      assert.ok(a && a.trim().length > 0, `handleMetaQuestion should answer "${q}", got: ${a}`);
    });
  }

  it('action commands are NOT treated as meta', () => {
    for (const cmd of ['smash the barrel', 'attack the goblin', 'go north', 'open the chest']) {
      assert.ok(!isMetaQuestion(cmd), `"${cmd}" should not be meta`);
    }
  });
});

describe('U94-E: NPC epithet de-duplication', () => {
  it('a bare-title name ("the laborer") is not doubled in the survey', () => {
    const w = ensureWorld({
      // Home → you know your neighbors by name, so the name/epithet path runs (away from home
      // the survey shows roles, which never doubles — this test is specifically the name path).
      meta: { version: 21, seed: 'u94-dup', fate: 0.2, homeNodeId: 'n0' },
      party: [{ id: 'party', name: 'Hero', stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 }, position: { nodeId: 'n0' } }],
      map: {
        currentNodeId: 'n0',
        nodes: [{ id: 'n0', name: 'Camp', nodeType: 'settlement', x: 0, y: 0, settlement: { npcs: [
          { id: 'a', name: 'the laborer', role: 'laborer' },
          { id: 'b', name: 'Dax the Wary', role: 'elder' },
          { id: 'c', name: 'Milo', role: 'trader' },
        ] } }],
        edges: [],
      },
      timeline: [], scene: { location: 'Camp' },
    });
    const survey = buildLocationSurvey(w);
    assert.ok(!/the laborer the laborer/i.test(survey), survey);
    assert.ok(!/the wary the elder/i.test(survey), survey);
    assert.ok(/Milo the trader/.test(survey), survey);
  });
});
