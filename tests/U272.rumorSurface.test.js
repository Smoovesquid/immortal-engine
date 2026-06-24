// U272: Rumor surface (W1·3 / P-83).
//
// Asserts that rumorsReaching correctly:
//   1. Returns minted rumors already carried by local NPCs (from world.rumors).
//   2. Synthesizes deed rumors (notable player deeds → reputation travels).
//   3. Applies correct tier grading and garbling (local deed = tier 0; distant = tier 2).
//   4. Respects opts.subjectPrefix and opts.max.
//   5. Returns [] when nothing has reached this node (honest empty, never fabricates).
//   6. Is pure / deterministic: same (world, nodeId) → same output, always.

import test from 'node:test';
import assert from 'node:assert/strict';
import { rumorsReaching } from '../engine/rumor/rumorsReaching.js';

// ── Shape validator (mirrors U266) ───────────────────────────────────────────────

function assertRumorShape(r, label = '') {
  const tag = label ? ` (${label})` : '';
  assert.equal(typeof r.subject, 'string',  `subject:string${tag}`);
  assert.equal(typeof r.body, 'string',     `body:string${tag}`);
  assert.equal(typeof r.tier, 'number',     `tier:number${tag}`);
  assert.ok(r.tier >= 0 && r.tier <= 4,    `tier in [0,4]${tag}`);
  assert.equal(typeof r.distortion, 'number', `distortion:number${tag}`);
  assert.ok(r.distortion >= 0 && r.distortion <= 1, `distortion in [0,1]${tag}`);
  assert.ok(Array.isArray(r.provenance),   `provenance:array${tag}`);
  assert.ok(r.eventRef === null || typeof r.eventRef === 'string', `eventRef:string|null${tag}`);
  assert.ok(r.deedRef === null || typeof r.deedRef === 'string' || r.deedRef === undefined, `deedRef${tag}`);
}

// ── Fixtures ─────────────────────────────────────────────────────────────────────

function worldWithRumors() {
  return {
    meta: { seed: 'w272' },
    map: {
      currentNodeId: 'n1',
      nodes: [
        {
          id: 'n1',
          settlement: { npcs: [
            { id: 'npc_a', name: 'Bram', role: 'innkeeper', hostile: false },
            { id: 'npc_b', name: 'Lyssa', role: 'healer',   hostile: false },
          ]},
        },
        { id: 'n2', settlement: { npcs: [{ id: 'npc_c', name: 'Grik', role: 'guard', hostile: false }] } },
      ],
      edges: [{ a: 'n1', b: 'n2' }],
    },
    rumors: [
      // Carried by local NPC (npc_a) → should be returned.
      { id: 'r1', sourceSeedId: 'gallows_watch_fall', carrierNpcId: 'npc_a', tier: 1, age: 5, mintedAt: 0, body: 'They say the Gallows Watch fell — hard to believe.', tags: [] },
      // Also carried locally (npc_b) — second entry, higher tier.
      { id: 'r2', sourceSeedId: 'iron_key_founding',  carrierNpcId: 'npc_b', tier: 2, age: 8, mintedAt: 0, body: 'Something about the Iron Key founding, or so I was told.', tags: [] },
      // Carried by a remote NPC (npc_c at n2) → NOT returned for n1.
      { id: 'r3', sourceSeedId: 'distant_event',      carrierNpcId: 'npc_c', tier: 3, age: 2, mintedAt: 0, body: 'Whispers from afar.', tags: [] },
    ],
    deeds: [],
  };
}

function worldWithDeeds() {
  return {
    meta: { seed: 'w272d' },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    rumors: [],
    deeds: [
      // Notable local deed (severity 50, same node) → tier 0, no garbling.
      { t: 10, actorId: 'party', kind: 'cruelty', severity: 50, witnesses: ['npc_a'], nodeId: 'n1', summary: 'The party struck down a helpless prisoner in the square.' },
      // Notable distant deed (severity 40, different node) → tier 2, garbled.
      { t: 5,  actorId: 'party', kind: 'mercy',   severity: 40, witnesses: [],        nodeId: 'n2', summary: 'A wounded soldier was healed and sent home without ransom.' },
      // Below threshold (severity 10) → should be filtered OUT.
      { t: 3,  actorId: 'party', kind: 'aid',     severity: 10, witnesses: [],        nodeId: 'n1', summary: 'Minor kindness; no one cared.' },
    ],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────────

test('U272: returns locally-carried minted rumors with correct shape', () => {
  const out = rumorsReaching(worldWithRumors(), 'n1');
  assert.ok(Array.isArray(out), 'returns array');
  // r1 and r2 are local; r3 is at n2.
  const subs = out.map(r => r.subject);
  assert.ok(subs.includes('gallows_watch_fall'), 'local rumor r1 returned');
  assert.ok(subs.includes('iron_key_founding'),  'local rumor r2 returned');
  assert.ok(!subs.includes('distant_event'),     'remote rumor r3 NOT returned for n1');
  out.forEach((r, i) => assertRumorShape(r, `result[${i}]`));
});

test('U272: minted rumors carry the stored body and correct tier', () => {
  const out = rumorsReaching(worldWithRumors(), 'n1');
  const r1 = out.find(r => r.subject === 'gallows_watch_fall');
  assert.ok(r1, 'gallows_watch_fall returned');
  assert.equal(r1.tier, 1);
  assert.equal(r1.distortion, 0.25);
  assert.match(r1.body, /Gallows Watch/);
  assert.equal(r1.deedRef, null);
});

test('U272: remote node returns only its own local rumors (n2 filter)', () => {
  const out = rumorsReaching(worldWithRumors(), 'n2');
  const subs = out.map(r => r.subject);
  assert.ok(subs.includes('distant_event'), 'r3 returned for n2');
  assert.ok(!subs.includes('gallows_watch_fall'), 'r1 NOT returned for n2');
});

test('U272: notable player deeds surface as deed rumors', () => {
  const out = rumorsReaching(worldWithDeeds(), 'n1');
  assert.ok(out.length >= 2, `expected ≥2 rumors, got ${out.length}`);
  const cruelty = out.find(r => r.deedRef && r.deedRef.includes('cruelty'));
  const mercy   = out.find(r => r.deedRef && r.deedRef.includes('mercy'));
  assert.ok(cruelty, 'cruelty deed surfaced');
  assert.ok(mercy,   'mercy deed surfaced');
  out.forEach((r, i) => assertRumorShape(r, `deed[${i}]`));
});

test('U272: local deed (same nodeId) gets tier 0 — firsthand, no garble', () => {
  const out = rumorsReaching(worldWithDeeds(), 'n1');
  const cruelty = out.find(r => r.deedRef && r.deedRef.includes('cruelty'));
  assert.ok(cruelty, 'cruelty deed found');
  assert.equal(cruelty.tier, 0, 'local deed = tier 0');
  assert.equal(cruelty.distortion, 0, 'tier 0 = distortion 0');
  // Tier 0 → no garbling — body should match the original summary.
  assert.match(cruelty.body, /struck down/);
});

test('U272: distant deed gets tier 2 — garbled body', () => {
  const out = rumorsReaching(worldWithDeeds(), 'n1');
  const mercy = out.find(r => r.deedRef && r.deedRef.includes('mercy'));
  assert.ok(mercy, 'mercy deed found');
  assert.equal(mercy.tier, 2, 'distant deed = tier 2');
  // Tier 2 garble: body should NOT be the raw summary ("A wounded soldier was healed...").
  assert.ok(!mercy.body.startsWith('A wounded soldier was healed'),
    'tier-2 body must be garbled, not the raw summary');
  // But it should be a non-empty string.
  assert.ok(mercy.body.length > 0, 'garbled body non-empty');
});

test('U272: below-threshold deeds (severity < 25) are not surfaced', () => {
  const out = rumorsReaching(worldWithDeeds(), 'n1');
  const lowSeverity = out.find(r => r.deedRef && r.body && r.body.includes('Minor kindness'));
  assert.equal(lowSeverity, undefined, 'low-severity deed must not appear');
});

test('U272: empty node (no local NPCs, no deeds) returns []', () => {
  const emptyWorld = {
    meta: { seed: 'empty' },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', settlement: { npcs: [] } }] },
    rumors: [],
    deeds: [],
  };
  const out = rumorsReaching(emptyWorld, 'n1');
  assert.deepEqual(out, []);
});

test('U272: opts.subjectPrefix filters to matching subjects only', () => {
  const world = {
    ...worldWithRumors(),
    deeds: worldWithDeeds().deeds,
  };
  const deedOnly = rumorsReaching(world, 'n1', { subjectPrefix: 'deed:' });
  assert.ok(deedOnly.every(r => r.subject.startsWith('deed:')),
    'subjectPrefix:deed: → only deed subjects');
  const rumorOnly = rumorsReaching(world, 'n1', { subjectPrefix: 'gallows' });
  assert.ok(rumorOnly.every(r => r.subject.startsWith('gallows')),
    'subjectPrefix:gallows → only gallows subjects');
});

test('U272: opts.max caps the returned count', () => {
  const world = worldWithRumors();
  // 2 local rumors, no deeds.
  const cappedAt1 = rumorsReaching(world, 'n1', { max: 1 });
  assert.ok(cappedAt1.length <= 1, `max:1 should cap at 1, got ${cappedAt1.length}`);
});

test('U272: pure / deterministic — same (world, nodeId) → same output', () => {
  const world = { ...worldWithRumors(), deeds: worldWithDeeds().deeds };
  const a = JSON.stringify(rumorsReaching(world, 'n1'));
  const b = JSON.stringify(rumorsReaching(world, 'n1'));
  assert.equal(a, b, 'rumorsReaching must be deterministic');
});

test('U272: unknown nodeId returns [] (never throws)', () => {
  const out = rumorsReaching(worldWithRumors(), 'no_such_node');
  assert.deepEqual(out, []);
});

test('U272: deed witnesses surface in provenance', () => {
  const out = rumorsReaching(worldWithDeeds(), 'n1');
  const cruelty = out.find(r => r.deedRef && r.deedRef.includes('cruelty'));
  assert.ok(cruelty, 'cruelty deed found');
  assert.deepEqual(cruelty.provenance, ['npc_a'], 'witnesses appear in provenance');
});
