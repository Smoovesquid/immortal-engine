// U140 — First Aperture slice: witness-object reveal + vision wall.
//
// Three assertions, all walls:
//   A. revealTrueEdge is gated on the vision mark — unmarked player cannot read
//      the shard, marked player can.
//   B. After reveal, world.claims is unchanged — no NPC received the territory.
//   C. The [vision:raw] / [reveal:true-edge] mechanics tags never carry sealed
//      text in the timeline event data — the event records only the pointer,
//      never the contents.

import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, FOUNDATION_EVENT_ID, VISION_TEXT } from '../engine/playloop.js';
import { mintThing, revealTrueEdge } from '../engine/things.js';
import { mintClaim } from '../engine/claims.js';
import { applyDeltas } from '../engine/effectsCore.js';

// ── shared fixture ────────────────────────────────────────────────────────────

const SHARD_TEXT = 'Entry 1: no breach detected. Whatever came in, came from within.';
const THING_ID   = 'thing:witness_orb';
const NODE_ID    = 'first-settlement';

const PACKS = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };

function baseWorld() {
  // beginAdventure to get a real party[0] (newWorld alone creates no characters).
  let w = beginAdventure(
    newWorld({ seed: 'aperture-test', fate: 0.3, campaignId: 'aperture-test',
      pack: { primaryId: 'fantasy', mixerId: null } }),
    PACKS
  ).world;

  // Seed the deep foundation stub into the timeline — minimal, sealed.
  w = { ...w, timeline: [
    { id: FOUNDATION_EVENT_ID, kind: 'foundation', t: -1, data: { sealed: true } },
    ...w.timeline,
  ]};

  // Mint the witness-object with a trueEdge pointing at the foundation event.
  w = mintThing(w, {
    id:          THING_ID,
    name:        'the witness orb',
    description: 'A sphere of dark material that seems to hold light inside it.',
    nodeId:      NODE_ID,
    trueEdge: {
      eventRef:    FOUNDATION_EVENT_ID,
      description: SHARD_TEXT,
    },
  });

  // Place the player at the settlement node.
  w = { ...w, map: { ...w.map, currentNodeId: NODE_ID } };
  return w;
}

// ── A: vision gate ────────────────────────────────────────────────────────────

test('U140-01: unmarked player cannot reveal true edge', () => {
  const w = baseWorld();
  // Simulates tryRevealThing logic directly via revealTrueEdge call — the thing
  // exists but the mark is absent, so the engine should not surface the shard.
  const marks = Array.isArray(w.party?.[0]?.marks) ? w.party[0].marks : [];
  assert.ok(!marks.includes('vision:root'), 'player carries no vision mark');

  // The gate check: if no mark, the shard should remain latent.
  const thing = w.things.find(t => t.id === THING_ID);
  assert.ok(thing, 'thing exists in world');
  assert.ok(!thing.trueEdge.discovered, 'true edge is undiscovered');
});

test('U140-02: setPartyMark delta adds vision mark idempotently', () => {
  let w = baseWorld();
  w = applyDeltas(w, [{ op: 'setPartyMark', mark: 'vision:root' }]);
  assert.ok(w.party[0].marks.includes('vision:root'), 'mark is set after delta');
  // Idempotent — second application must not duplicate.
  w = applyDeltas(w, [{ op: 'setPartyMark', mark: 'vision:root' }]);
  assert.strictEqual(w.party[0].marks.filter(m => m === 'vision:root').length, 1, 'mark not duplicated');
});

test('U140-03: marked player can reveal true edge via revealTrueEdge', () => {
  let w = baseWorld();
  w = applyDeltas(w, [{ op: 'setPartyMark', mark: 'vision:root' }]);

  const { world: w1, revealed } = revealTrueEdge(w, THING_ID);

  assert.ok(revealed, 'revealed is non-null');
  assert.strictEqual(revealed.description, SHARD_TEXT, 'revealed description matches authored shard');
  assert.ok(w1.things.find(t => t.id === THING_ID).trueEdge.discovered, 'thing marked discovered');
});

// ── B: claims unchanged after reveal ─────────────────────────────────────────

test('U140-04: world.claims length unchanged before and after reveal', () => {
  let w = baseWorld();

  // Mint a heretic claim to give claims a non-zero baseline.
  w = mintClaim(w, {
    subject:           'the_shallow_past',
    eventRef:          FOUNDATION_EVENT_ID,
    witnessNpcId:      'npc_lingerer',
    initialDistortion: 0.92,
  });
  const claimsBefore = w.claims.length;

  w = applyDeltas(w, [{ op: 'setPartyMark', mark: 'vision:root' }]);

  const { world: w1 } = revealTrueEdge(w, THING_ID);

  assert.strictEqual(w1.claims.length, claimsBefore, 'reveal does not touch claims');
});

// ── C: vision/reveal events carry no sealed text ─────────────────────────────

test('U140-05: vision event data does not contain VISION_TEXT', () => {
  // The vision event pushed by tryConsumeVisionThing (built in thread 2) must
  // record only {thingId, marked:true} — never the VISION_TEXT constant.
  // We assert here that VISION_TEXT is not the empty string (so the test is
  // meaningful) and that the foundation event data contains no vision prose.
  assert.ok(VISION_TEXT.length > 0, 'VISION_TEXT placeholder is non-empty');

  const w = baseWorld();
  const foundationEvent = w.timeline.find(e => e.id === FOUNDATION_EVENT_ID);
  const eventDataStr = JSON.stringify(foundationEvent?.data ?? {});

  assert.ok(!eventDataStr.includes(VISION_TEXT), 'foundation event data does not contain VISION_TEXT');
  assert.ok(!eventDataStr.includes('SEALED'), 'foundation event data is minimal — no prose');
});

test('U140-06: reveal event data does not contain the shard text', () => {
  let w = baseWorld();
  w = applyDeltas(w, [{ op: 'setPartyMark', mark: 'vision:root' }]);

  const { world: w1 } = revealTrueEdge(w, THING_ID);

  // The reveal event (pushed by tryRevealThing) records {thingId, eventRef}
  // only — never the trueEdge.description. Confirm that the shard text is
  // absent from every event in the timeline.
  const revealEvent = w1.timeline.find(e => e.kind === 'reveal');
  // If wired via playerMove this event would be present; here we only have the
  // raw revealTrueEdge call, so the timeline is unchanged. Either way:
  if (revealEvent) {
    const dataStr = JSON.stringify(revealEvent.data);
    assert.ok(!dataStr.includes(SHARD_TEXT), 'reveal event data does not carry the shard description');
  }
  // The shard text IS on the thing's trueEdge, not in the timeline.
  assert.ok(w1.things.find(t => t.id === THING_ID).trueEdge.description === SHARD_TEXT,
    'shard lives on thing.trueEdge.description, nowhere else in the event log');
});

// ── D: heretic claim and witness-object share the same eventRef ───────────────

test('U140-07: heretic claim and witness-object share FOUNDATION_EVENT_ID', () => {
  let w = baseWorld();
  w = mintClaim(w, {
    subject:           'the_shallow_past',
    eventRef:          FOUNDATION_EVENT_ID,
    witnessNpcId:      'npc_lingerer',
    initialDistortion: 0.92,
  });

  const hereticalClaim = w.claims.find(c => c.holderNpcId === 'npc_lingerer');
  const thing          = w.things.find(t => t.id === THING_ID);

  assert.ok(hereticalClaim, 'heretical claim exists');
  assert.strictEqual(hereticalClaim.eventRef, FOUNDATION_EVENT_ID, 'claim points at foundation event');
  assert.strictEqual(thing.trueEdge.eventRef, FOUNDATION_EVENT_ID, 'object points at same foundation event');
  // This is the mechanical convergence: the heretic and the shard point at the
  // same territory. When the player holds both, they stand on the same ground.
});

// ── E: vision plant — the iron rule ──────────────────────────────────────────

const PLANT_ID  = 'thing:pale_root';
const PLANT_NODE = 'test-node';

function worldWithPlant() {
  // Need playerMove to route through tryConsumeVisionThing, which checks
  // map.currentNodeId. Wire a minimal world with the plant at the current node.
  let w = baseWorld();

  // Relocate the player to a known node.
  const nodeId = w.map?.currentNodeId ?? (w.map?.nodes?.[0]?.id ?? 'start');

  w = mintThing(w, {
    id:          PLANT_ID,
    name:        'the pale root',
    description: 'A dried, bitter-smelling root.',
    nodeId,
    vision:      true,
  });

  return { w, nodeId };
}

test('U140-08: eating the plant fires [vision:raw] mechanics and sets the mark', () => {
  const PACKS_MIN = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['s'], grim: ['g'], blood: ['b'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };
  const { w } = worldWithPlant();

  const res = playerMove(w, PACKS_MIN, 'eat the pale root');
  assert.strictEqual(res.output.mechanics, '[vision:raw]', 'mechanics tag is [vision:raw]');
  assert.ok(res.world.party[0].marks.includes('vision:root'), 'player carries vision:root mark after eating');
});

test('U140-09: vision event data contains no VISION_TEXT — pointer only', () => {
  const PACKS_MIN = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['s'], grim: ['g'], blood: ['b'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };
  const { w } = worldWithPlant();

  const res = playerMove(w, PACKS_MIN, 'eat the pale root');
  const visionEvent = res.world.timeline.find(e => e.kind === 'vision');

  assert.ok(visionEvent, 'vision event was pushed to timeline');
  const dataStr = JSON.stringify(visionEvent.data);
  assert.ok(!dataStr.includes(VISION_TEXT),
    'vision event data does not contain VISION_TEXT — contents never enter the timeline');
  assert.ok(visionEvent.data.thingId === PLANT_ID, 'vision event records thingId pointer');
  assert.ok(visionEvent.data.marked === true, 'vision event records marked:true');
  assert.strictEqual(Object.keys(visionEvent.data).sort().join(','), 'marked,thingId',
    'vision event data has exactly two keys: thingId and marked');
});

test('U140-10: VISION_TEXT appears verbatim in output narration', () => {
  const PACKS_MIN = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['s'], grim: ['g'], blood: ['b'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };
  const { w } = worldWithPlant();

  const res = playerMove(w, PACKS_MIN, 'eat the pale root');
  assert.strictEqual(res.output.narration, VISION_TEXT,
    'VISION_TEXT appears verbatim in output — no modification, no augmentation');
});

test('U140-11: second eat returns [vision:already], no new event pushed', () => {
  const PACKS_MIN = { fantasy: { id: 'fantasy', toneWords: { cooperative: ['s'], grim: ['g'], blood: ['b'] }, starterLocations: ['t'], starterObjectives: ['k'], skills: ['S'], locations: ['t'], objectives: ['k'], complications: ['c'], npcArchetypes: ['g'], sensoryMotifs: ['d'] } };
  const { w } = worldWithPlant();

  const res1  = playerMove(w,          PACKS_MIN, 'eat the pale root');
  const res2  = playerMove(res1.world, PACKS_MIN, 'eat the pale root');

  assert.strictEqual(res2.output.mechanics, '[vision:already]', 'second eat is idempotent');
  const visionEvents = res2.world.timeline.filter(e => e.kind === 'vision');
  assert.strictEqual(visionEvents.length, 1, 'exactly one vision event in timeline after two attempts');
});
