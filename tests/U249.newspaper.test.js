// U249 — "The Lasting Word" generator (NP-1, IG-14). A pure, deterministic, §0-safe surface
// over world state: deeds → news (reputation), the §3 fade, and Kasual Korner ads whose kind
// (tryst / contract / trap / both) is HIDDEN — the page is indistinguishable; you learn an
// ad's truth only by acting on it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNewspaper, renderNewspaperText, AD_KINDS } from '../engine/newspaper/lastingWord.js';

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
