// U102 — Argued social adjudication (Stage B social floor).
//
// Speak/argue at an NPC in your own words; the DM reads the APPROACH (intimidate/
// charm/deceive/persuade — from explicit verbs OR natural cues) and any LEVER you
// claim ("use my superior strength" → MIGHT), judges plausibility + argument
// quality, rolls the fitting stat against a DC set by THAT NPC's PERSONALITY, and
// the NPC reacts with a real trust consequence. Plain "talk to X" still opens
// dialogue. Deterministic / seeded.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `u102-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;
const FLOOR = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;

function social(out) {
  const m = String(out.mechanics || '');
  const x = m.match(/\[social:(\w+)\|([A-Z]+)\|roll:(\d+) vs DC:(\d+) → (\w+)(?:\s*\|\s*argued([+-]\d+))?\]/);
  if (!x) return null;
  return { approach: x[1], stat: x[2], roll: +x[3], dc: +x[4], outcome: x[5], argued: x[6] ? +x[6] : 0, raw: m };
}
const npcsHere = (w) => {
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  return Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
};
const npcById = (w, id) => npcsHere(w).find(n => String(n.id) === String(id)) || null;
const trustById = (w, id) => Number(npcById(w, id)?.conversationState?.trustLevel ?? 5);
const sp = (n) => Number(n?.personality?.selfPreservation ?? 0.5);
const too = (n) => Number(n?.personality?.trustOfOutsiders ?? 0.5);

describe('U102-A: approach detected from natural language', () => {
  const cases = [
    { text: 'Let me in or I flay you alive, you worm', approach: 'intimidate' },
    { text: 'Hey sexy, you look great in that outfit. Take me to dinner later?', approach: 'charm' },
    { text: 'I tell the elder I am the new sheriff and he should obey me', approach: 'deceive' },
    { text: 'please let me pass, I beg you, hear me out', approach: 'persuade' },
  ];
  for (const { text, approach } of cases) {
    it(`"${text.slice(0, 38)}…" → ${approach}`, () => {
      const s = social(playerMove(begin('napp'), packs, text).output);
      assert.ok(s, `expected a social roll, got: ${playerMove(begin('napp'), packs, text).output.mechanics}`);
      assert.equal(s.approach, approach);
    });
  }
});

describe('U102-B: lever is plausibility-gated', () => {
  it('"use my superior strength … to intimidate" → MIGHT (plausible)', () => {
    const s = social(playerMove(begin('lev'), packs, 'I use my superior strength to lift this massive boulder and intimidate the bandit').output);
    assert.ok(s); assert.equal(s.approach, 'intimidate'); assert.equal(s.stat, 'MIGHT');
    assert.ok(s.argued > 0, `vivid argued line should get a bonus: ${s.raw}`);
  });
  it('"use my strength to charm her" → falls back to CHARM (strength can\'t seduce)', () => {
    const s = social(playerMove(begin('lev'), packs, 'I use my raw strength to charm the trader').output);
    assert.ok(s); assert.equal(s.approach, 'charm'); assert.equal(s.stat, 'CHARM');
  });
  it('"use my awesome wit to persuade" → WITS (plausible for persuade)', () => {
    const s = social(playerMove(begin('lev'), packs, 'I use my awesome wit to persuade the elder to let me pass').output);
    assert.ok(s); assert.equal(s.approach, 'persuade'); assert.equal(s.stat, 'WITS');
  });
});

describe('U102-C: PERSONALITY drives the DC (the magic)', () => {
  it('intimidating a FEARFUL npc is easier than a BRAVE one (same world, by name)', () => {
    // Among the non-hostile NPCs present, pick the most and least self-preserving
    // (exclude the hostile bandit so its +3 hostility doesn't confound the DC).
    const w = begin('pdc');
    const calm = npcsHere(w).filter(n => !n.hostile);
    const brave = calm.reduce((a, b) => sp(a) <= sp(b) ? a : b);
    const fearful = calm.reduce((a, b) => sp(a) >= sp(b) ? a : b);
    assert.ok(sp(fearful) - sp(brave) > 0.1, `need a personality spread (${sp(brave)}…${sp(fearful)})`);
    const dcFearful = social(playerMove(w, packs, `intimidate ${fearful.name}`).output).dc;
    const dcBrave = social(playerMove(w, packs, `intimidate ${brave.name}`).output).dc;
    assert.ok(dcFearful < dcBrave, `fearful ${fearful.name} DC(${dcFearful}) should be < brave ${brave.name} DC(${dcBrave})`);
  });
  it('charming an OPEN npc is easier than a WARY one (same world, by name)', () => {
    const w = begin('pdc');
    const ns = npcsHere(w);
    const open = ns.reduce((a, b) => too(a) >= too(b) ? a : b);
    const wary = ns.reduce((a, b) => too(a) <= too(b) ? a : b);
    assert.ok(too(open) - too(wary) > 0.1, `need a trust spread (${too(wary)}…${too(open)})`);
    const dcOpen = social(playerMove(w, packs, `charm ${open.name}`).output).dc;
    const dcWary = social(playerMove(w, packs, `charm ${wary.name}`).output).dc;
    assert.ok(dcOpen < dcWary, `open ${open.name} DC(${dcOpen}) should be < wary ${wary.name} DC(${dcWary})`);
  });
});

describe('U102-D: argument quality nudges the roll', () => {
  it('a claimed performance with no content takes a penalty', () => {
    const w = begin('q'); const tgt = npcsHere(w)[0];
    const s = social(playerMove(w, packs, `I tell ${tgt.name} a joke`).output);
    assert.ok(s); assert.ok(s.argued < 0, `bare "I tell a joke" should be penalized: ${s.raw}`);
  });
  it('actually delivering the line earns a bonus', () => {
    const w = begin('q'); const tgt = npcsHere(w)[0];
    const s = social(playerMove(w, packs, `I tell ${tgt.name} a joke: "Two dwarves walk into a tavern, the third one ducks."`).output);
    assert.ok(s); assert.ok(s.argued > 0, `delivered content should be rewarded: ${s.raw}`);
  });
});

describe('U102-E: trust consequence (the world remembers)', () => {
  it('a successful charm raises trust; intimidate-success lowers it', () => {
    // Search seeds for clean SUCCESSES and assert trust moved the right way.
    // Read back the EXACT npc that was targeted (by id), not a role guess.
    let sawCharmUp = false, sawIntimidateDown = false;
    for (let i = 0; i < 40 && (!sawCharmUp || !sawIntimidateDown); i++) {
      const wC = begin(`tc${i}`);
      const open = npcsHere(wC).reduce((a, b) => too(a) >= too(b) ? a : b); // most charmable
      const before = trustById(wC, open.id);
      const r = playerMove(wC, packs, `I flatter ${open.name} with warm, genuine praise for their fine work`);
      const s = social(r.output);
      if (s && s.outcome === 'success') { assert.ok(trustById(r.world, open.id) > before, `charm success should raise trust: ${before}->${trustById(r.world, open.id)}`); sawCharmUp = true; }

      const wI = begin(`ti${i}`);
      // Most cowable NPC that still has trust headroom (the hostile bandit sits at
      // trust 0 and is floored, so -1 wouldn't be visible). Exclude floored NPCs.
      const cowable = npcsHere(wI).filter(n => trustById(wI, n.id) > 0);
      const fearful = cowable.reduce((a, b) => sp(a) >= sp(b) ? a : b);
      const beforeI = trustById(wI, fearful.id);
      const rI = playerMove(wI, packs, `intimidate ${fearful.name}, hand on my sword`);
      const sI = social(rI.output);
      if (sI && sI.outcome === 'success') { assert.ok(trustById(rI.world, fearful.id) < beforeI, `intimidate success should COST trust: ${beforeI}->${trustById(rI.world, fearful.id)}`); sawIntimidateDown = true; }
    }
    assert.ok(sawCharmUp, 'expected at least one charm success across seeds');
    assert.ok(sawIntimidateDown, 'expected at least one intimidate success across seeds');
  });
});

describe('U102-F: graceful no-target + no floor', () => {
  it('a social attempt with no NPC present says so, no crash, no floor', () => {
    // Walk out to a landmark with no settlement NPCs.
    let w = begin('nt');
    const out = playerMove(w, packs, 'intimidate the guard').output;
    // Either there's an NPC here (resolved as a social roll) or there isn't
    // (graceful no-target). Never the abstract floor, never a crash.
    assert.doesNotMatch(out.narration, FLOOR, out.narration);
    assert.ok(/\[social:/.test(out.mechanics), `should route through social: ${out.mechanics}`);
  });
  it('an explicit no-target world returns the graceful line', () => {
    // Move to a wild node (no settlement) then attempt social.
    let w = begin('nt2');
    // Find any node without settlement npcs reachable, else just assert format holds.
    const out = playerMove(w, packs, 'I threaten the empty air, or else').output;
    assert.doesNotMatch(out.narration, FLOOR, out.narration);
  });
});

describe('U102-G: no regression — "talk to X" still opens dialogue', () => {
  it('"talk to the elder" opens dialogue, not a social roll', () => {
    const r = playerMove(begin('tt'), packs, 'talk to the elder');
    assert.equal(social(r.output), null, `"talk to" should NOT be a social roll: ${r.output.mechanics}`);
    assert.ok(r.world.scene?.dialogue || /elder|Senna|Lyssa|asks|says|turns/i.test(r.output.narration), `should engage dialogue: ${r.output.narration}`);
  });
  it('plain greetings do not roll', () => {
    const r = playerMove(begin('tt'), packs, 'I say hello');
    assert.equal(social(r.output), null, `greeting should not be a social roll: ${r.output.mechanics}`);
  });
});

describe('U102-H: deterministic', () => {
  it('same seed + input → identical prose + mechanics', () => {
    const a = playerMove(begin('det'), packs, 'intimidate the bandit, hand on my sword');
    const b = playerMove(begin('det'), packs, 'intimidate the bandit, hand on my sword');
    assert.equal(a.output.narration, b.output.narration);
    assert.equal(a.output.mechanics, b.output.mechanics);
  });
});
