// G10 — Story arcs (docs/STORYLINE_SPEC.md proving slice: The Cold Well).
//
// Arcs are data files that cast themselves onto generated NPCs, surface as
// rumors, plant knowledge, advance on goal-style predicates, and resolve into
// deeds + county talk. The player never sees the word "arc". Deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { worldHash } from '../engine/worldHash.js';
import { getArcs, getArc, validateArc } from '../engine/story/registry.js';
import { castArcs, tickArcs } from '../engine/story/storyEngine.js';
import coldWell from '../content/arcs/the_cold_well.arc.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();
const begin = (seed) => beginAdventure(newWorld({ seed, fate: 0.2, campaignId: `g10-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' }), packs).world;

const ARC = 'the-cold-well';
const stateOf = (w) => w.story?.arcs?.[ARC];
const witnessOf = (w) => {
  const ref = String(stateOf(w)?.castIds?.['the-witness'] || '');
  const [npcId, nodeId] = ref.split('@');
  const node = w.map.nodes.find(n => n.id === nodeId);
  return { npc: node?.settlement?.npcs?.find(n => String(n.id) === npcId) || null, nodeId };
};

// Walk the arc from fresh world to the door of resolution on one seed.
// (On 'arc0' the witness casts at the home settlement, so the whole arc is
// playable without travel — locked by G10-04.)
const SEED = 'arc0';

test('G10-01: the Cold Well arc file validates and loads', () => {
  assert.deepEqual(validateArc(coldWell), []);
  assert.ok(getArcs().some(a => a.arc === ARC));
  assert.equal(getArc(ARC)?.scale, 'village');
});

test('G10-02: validator rejects malformed arcs', () => {
  assert.ok(validateArc({}).length > 0);
  assert.ok(validateArc({ ...coldWell, arc: 'Bad Name!' }).some(e => /kebab-case/.test(e)));
  assert.ok(validateArc({ ...coldWell, abandonment: null }).some(e => /abandonment/.test(e)));
  // a learned done-when must reference a fact some cast member knows
  const orphan = { ...coldWell, stages: [{ id: 'x', doneWhen: { learned: 'nobody_knows_this' }, branches: { default: {} } }] };
  assert.ok(validateArc(orphan).some(e => /not in any cast/.test(e)));
});

test('G10-03: beginAdventure casts the arc — rumor in the air, fact planted, invariants hold', () => {
  const w = begin(SEED);
  assertWorldInvariants(w);
  const st = stateOf(w);
  assert.equal(st.status, 'cast');
  assert.equal(st.stage, 'hear-it');

  const { npc } = witnessOf(w);
  assert.ok(npc, 'witness must resolve to a real NPC');
  assert.ok(npc.knowledgeGraph.some(f => f.factId === 'cold_well_truth'), 'knows[] fact planted');

  const rumor = w.rumors.find(r => r.id === `rumor:arc:${ARC}:0`);
  assert.ok(rumor, 'hook rumor minted');
  assert.equal(rumor.carrierNpcId, String(npc.id));
  assert.ok((npc.rumorIds || []).includes(rumor.id), 'witness actually carries the rumor (dialogue voices only rumorIds)');
  assert.equal(rumor.tier, 2, 'tier 2 — volunteered at neutral trust');
  assert.ok(!/\{home\}|\{carrier\}/.test(rumor.body), 'template vars filled');
  assert.ok(rumor.body.includes(npc.name), 'rumor names the witness');
});

test('G10-04: casting is deterministic (same seed → same cast, same rumor)', () => {
  const a = begin(SEED), b = begin(SEED);
  assert.deepEqual(stateOf(a).castIds, stateOf(b).castIds);
  assert.equal(
    a.rumors.find(r => r.id === `rumor:arc:${ARC}:0`)?.body,
    b.rumors.find(r => r.id === `rumor:arc:${ARC}:0`)?.body
  );
  // the proving seed keeps the witness at home — the full arc is walkable in-place
  assert.equal(witnessOf(a).nodeId, a.map.currentNodeId);
});

test('G10-05: hearing the truth from the witness advances hear-it → see-it', () => {
  const w = begin(SEED);
  const { npc } = witnessOf(w);
  let r = playerMove(w, packs, `Hello ${npc.name}`);
  r = playerMove(r.world, packs, 'What happened with the cold well?');
  assert.match(String(r.output.mechanics), /shared \| cold_well_truth/);
  const st = stateOf(r.world);
  assert.equal(st.status, 'active');
  assert.equal(st.stage, 'see-it');
  assert.ok(st.heardAtHours >= 0, 'abandonment clock armed');
  assertWorldInvariants(r.world);
});

test('G10-06: resolution writes a deed and the county talks about it', () => {
  const w = begin(SEED);
  const { npc } = witnessOf(w);
  let r = playerMove(w, packs, `Hello ${npc.name}`);
  r = playerMove(r.world, packs, 'What happened with the cold well?');
  r = playerMove(r.world, packs, 'goodbye');
  r = playerMove(r.world, packs, 'I look around'); // already at the witness's node → reached fires
  const st = stateOf(r.world);
  assert.equal(st.status, 'resolved');
  assert.equal(st.branch, 'default');
  assert.ok(r.world.deeds.some(d => d.kind === 'aid' && /well/.test(d.summary)), 'branch deed recorded');
  const res = r.world.rumors.find(x => x.id === `rumor:arc:${ARC}:91`);
  assert.ok(res && !/\{home\}/.test(res.body), 'resolution rumor minted and filled');
  assert.ok(r.world.timeline.some(e => e.kind === 'arcResolved'), 'timeline event');
  assertWorldInvariants(r.world);
});

test('G10-07: an ignored arc abandons itself after the window — the story moves on', () => {
  const w = begin(SEED);
  const { npc } = witnessOf(w);
  let r = playerMove(w, packs, `Hello ${npc.name}`);
  r = playerMove(r.world, packs, 'What happened with the cold well?');
  assert.equal(stateOf(r.world).stage, 'see-it');

  // The player walks away for 12+ days. (Direct surgery — off the witness's
  // node, out of dialogue, clock past the window; tickArcs is the unit under
  // test here — the playloop calls it on every move.)
  const heard = stateOf(r.world).heardAtHours;
  let far = ensureWorld({
    ...r.world,
    scene: { ...r.world.scene, dialogue: null },
    map: { ...r.world.map, currentNodeId: 'nowhere-real' },
    time: { ...r.world.time, hours: heard + coldWell.abandonment.afterDays * 24 + 1 }
  });
  const ticked = tickArcs(far);
  const st = stateOf(ticked.world);
  assert.equal(st.status, 'abandoned');
  assert.ok(ticked.events.some(e => e.kind === 'arcAbandoned'));
  const ab = ticked.world.rumors.find(x => x.id === `rumor:arc:${ARC}:90`);
  assert.ok(ab && /froze over/.test(ab.body), 'abandonment rumor minted');
  assertWorldInvariants(ticked.world);
});

test('G10-08: castArcs is idempotent and story state survives ensureWorld + hash', () => {
  const w = begin(SEED);
  const again = castArcs(w);
  assert.deepEqual(stateOf(again), stateOf(w));
  const hookIds = w.rumors.filter(r => r.id.startsWith('rumor:arc:')).map(r => r.id);
  assert.equal(new Set(hookIds).size, hookIds.length, 'no duplicate hook rumors');
  const castCount = Object.values(w.story.arcs).filter(a => a.status === 'cast').length;
  assert.equal(hookIds.length, castCount, 'exactly one hook rumor per cast arc');

  const roundTrip = ensureWorld(JSON.parse(JSON.stringify(w)));
  assert.deepEqual(roundTrip.story, w.story);
  assert.equal(worldHash(roundTrip), worldHash(w), 'story is hash-covered and replay-stable');

  // garbage story state normalizes instead of crashing
  const dirty = ensureWorld({ ...w, story: { arcs: { junk: { status: 'nope' }, [ARC]: stateOf(w) } } });
  assert.equal(dirty.story.arcs.junk, undefined);
  assert.ok(dirty.story.arcs[ARC]);
});
