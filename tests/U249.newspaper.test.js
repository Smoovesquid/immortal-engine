// U249 — "The Lasting Word" generator (NP-1, IG-14). A pure, deterministic, §0-safe surface
// over world state: deeds → news (reputation), the §3 fade, and Kasual Korner ads whose kind
// (tryst / contract / trap / both) is HIDDEN — the page is indistinguishable; you learn an
// ad's truth only by acting on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNewspaper, renderNewspaperText, AD_KINDS, playerReputation, isNewspaperRead, isKasualKornerAnswer, resolveKasualKornerEncounter } from '../engine/newspaper/lastingWord.js';
import { playerMove } from '../engine/playloop.js';
import { villageBakerWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { ensureWorld } from '../engine/state.js';

function world() {
  return {
    meta: { seed: 'tallow' },
    time: { turn: 12 },
    timeline: [
      { kind: 'goalCreated', data: {} },
      { kind: 'resolution', data: { targetDefeated: 'npc_bandit' } },
    ],
    map: {
      currentNodeId: 'n1',
      nodes: [
        { id: 'n1', name: 'Wayfarers Outpost', settlement: { npcs: [
          { id: 'npc_rep', name: 'Elske Nightherd', role: 'representative', hostile: false },
          { id: 'npc_smith', name: 'Brae Copperforge', role: 'smith', hostile: false },
          { id: 'npc_bandit', name: 'Ashblade', role: 'bandit', hostile: true },
        ] } },
        { id: 'n2', name: 'Pilgrims Rest', settlement: { npcs: [
          { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'representative', hostile: false },
        ] } },
      ],
    },
  };
}

test('U249 newspaper — deterministic: same world + seed → identical paper (replay-safe projection)', () => {
  assert.deepEqual(generateNewspaper(world()), generateNewspaper(world()));
});

test('U249 newspaper — structure: masthead + three sections; every KK ad carries a HIDDEN kind', () => {
  const np = generateNewspaper(world(), { kkCount: 4 });
  assert.equal(np.masthead.title, 'The Lasting Word');
  assert.ok(np.masthead.edition >= 300 && np.masthead.edition < 390);
  assert.match(np.masthead.dateline, /Long Forgetting/);
  assert.ok(np.fromTheRoads.length >= 1);
  assert.equal(np.theForgotten.length, 2);
  assert.equal(np.kasualKorner.length, 4);
  for (const ad of np.kasualKorner) {
    assert.equal(typeof ad.text, 'string');
    assert.ok(AD_KINDS.includes(ad._kind), `hidden kind valid: ${ad._kind}`);
    if (ad._kind === 'contract' || ad._kind === 'both') assert.ok(ad._target, 'a contract names a hidden target');
  }
});

test('U249 newspaper — reputation: a defeated foe becomes news in From the Roads', () => {
  const np = generateNewspaper(world());
  assert.ok(np.fromTheRoads.some(it => /Ashblade/.test(it)), 'the defeated bandit appears in the news');
});

test('U249 newspaper — §0 + indistinguishability: no cosmology, and no kind/murder tell ever reaches the page', () => {
  const text = renderNewspaperText(generateNewspaper(world(), { kkCount: 8 }));
  assert.doesNotMatch(text, /cataclysm|the scar|undoing|under-?collapse|universe.?mind|deep:?foundation/i);  // §0
  assert.doesNotMatch(text, /\b(contract|tryst|trap|bounty|assassinat\w*)\b/i);   // hidden kind never prints
  assert.doesNotMatch(text, /\b(kill|killed|murder|corpse|stab|slay|dead body)\b/i); // a hit reads as a hookup
});

test('U249 newspaper — playerReputation: the most notable recent deed becomes a recognition clause', () => {
  assert.match(playerReputation(world())?.clause || '', /put Ashblade beyond mischief/);  // a defeat in the timeline
  assert.equal(playerReputation({ timeline: [] }), null);                                  // no deeds → null
});

test('U249 newspaper — NP-2: a STRANGER greets you by your deed; no deed and a known face stay silent', () => {
  const withDeed = () => {
    let w = villageBakerWorld();
    w.map.nodes.find(n => n.id === w.map.currentNodeId).settlement.npcs.push({ id: 'npc_bandit', name: 'Brokefang', role: 'bandit', hostile: true });
    w = ensureWorld(w);
    return ensureWorld({ ...w, timeline: [...w.timeline, { id: 'r:x', t: w.timeline.length, kind: 'resolution', data: { targetDefeated: 'npc_bandit' } }] });
  };
  const fresh = playerMove(withDeed(), PACKS, "I'll go talk to Mira").output.narration;
  assert.match(fresh, /Word wrote of — the one who put Brokefang beyond mischief/);  // a stranger who read the Word
  assert.doesNotMatch(playerMove(villageBakerWorld(), PACKS, "I'll go talk to Mira").output.narration, /Word wrote of/);  // no deed
  let w = playerMove(withDeed(), PACKS, "I'll go talk to Mira").world;  // meet her
  w = playerMove(w, PACKS, 'goodbye').world;
  assert.doesNotMatch(playerMove(w, PACKS, "I'll go talk to Mira").output.narration, /Word wrote of/);  // does not repeat
});

test('U249 newspaper — NP-4: "read the broadsheet" surfaces the paper; an ordinary "read the sign" does not', () => {
  assert.ok(isNewspaperRead('is there a newspaper? I want to read it'));
  assert.ok(isNewspaperRead('find the lasting word'));
  assert.ok(!isNewspaperRead('I read the sign on the wall'));
  assert.ok(!isNewspaperRead("what's the word on the street"));
  const o = playerMove(villageBakerWorld(), PACKS, 'Is there a newspaper around? I read it.').output;
  assert.match(o.mechanics, /newspaper:read/);
  assert.match(o.narration, /The Lasting Word/);
  assert.match(o.narration, /Kasual Korner/i);
  assert.doesNotMatch(o.narration, /\b(contract|tryst|trap|kill|murder)\b/i);  // the page keeps its secrets
});

test('U249 newspaper — NP-3: answering an ad flips its hidden card; a contract names its target', () => {
  assert.ok(isKasualKornerAnswer("I'll answer the blacksmith's ad"));
  assert.ok(isKasualKornerAnswer('respond to the personal in the paper'));
  assert.ok(!isKasualKornerAnswer('go meet the blacksmith'));   // no ad reference → not the Korner
  assert.ok(!isKasualKornerAnswer("what's the news"));
  const np = generateNewspaper(world(), { kkCount: 8 });
  for (const ad of np.kasualKorner) {
    assert.ok(ad.persona, 'every ad has a matchable persona');
    if (ad._kind === 'contract' || ad._kind === 'both') assert.ok(ad._target, 'a contract carries a hidden target');
  }
  const contractAd = np.kasualKorner.find(a => a._kind === 'contract');
  if (contractAd) {
    const enc = resolveKasualKornerEncounter(world(), contractAd);
    assert.match(enc.mechanics, /korner:contract \| target:/);
  }
});

test('U249 newspaper — NP-3 wiring: "answer the <persona> ad" resolves an encounter; an unnamed answer asks which', () => {
  const persona = generateNewspaper(villageBakerWorld(), { kkCount: 8 }).kasualKorner[0].persona;
  const o = playerMove(villageBakerWorld(), PACKS, `I'll answer the ${persona}'s ad`).output;
  assert.match(o.mechanics, /\[korner:(tryst|contract|trap|both)/);
  assert.match(playerMove(villageBakerWorld(), PACKS, "I'll answer a personal ad").output.mechanics, /korner:which/);
});
