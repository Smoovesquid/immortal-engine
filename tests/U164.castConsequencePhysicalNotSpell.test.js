import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { classifyOffensiveCast } from '../engine/magic/castConsequence.js';

// Opus gate (2026-06-16, Chaos-griefer): "I crawl up, grab a loose roof beam,
// and swing it through the Outpost's front window" got tagged
// `[cast-consequence: person-innocent | ... | recoil]` with fabricated fire
// narration. Root cause: HOSTILE_CAST_RE matched the bare verb "loose" (the
// adjective in "a loose roof beam"), so any present NPC made it read as an
// offensive spell. Fixed by narrowing HOSTILE_CAST_RE to unambiguous casting
// verbs (cast/invoke/channel/conjure) — OFFENSIVE_RE already covers the
// magical case of hurl/throw explicitly ("hurl flame/fire/lightning").

const PACKS = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };

function worldWith(npcs = []) {
  let w = beginAdventure(newWorld({ seed: 'p80b', fate: 0.3, campaignId: 'p80b', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
  const node = { id: 'n1', nodeType: 'settlement', settlement: { npcs: npcs.map(n => ({ conversationState: { trustLevel: 5 }, ...n })) } };
  return ensureWorld({ ...w, map: { ...w.map, currentNodeId: 'n1', nodes: [...(w.map.nodes || []), node] } });
}
const villager = (id, name, extra = {}) => ({ id, name, hostile: false, ...extra });

test('U164: a loose roof beam swung at a window is not a cast, even with an NPC present', () => {
  const w = worldWith([villager('npc:ling', 'the Lingerer')]);
  const c = classifyOffensiveCast(w, "I grab a loose roof beam and swing it through the Outpost's front window.");
  assert.equal(c.offensive, false);
});

test('U164: bare hurl/throw/sling/loose with no magical payload is not offensive', () => {
  const w = worldWith();
  for (const s of ['I throw a rock at the door', 'I sling the beam at it', 'loose roof beam in hand', 'I hurl the chair across the room']) {
    assert.equal(classifyOffensiveCast(w, s).offensive, false, `"${s}" must not be offensive`);
  }
});

test('U164: an actual magical hurl is still caught (no regression)', () => {
  const w = worldWith([villager('npc:ald', 'Aldrich')]);
  const c = classifyOffensiveCast(w, 'I hurl fire at Aldrich');
  assert.equal(c.offensive, true);
  assert.equal(c.target, 'person-innocent');
});
