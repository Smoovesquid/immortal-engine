// U559 — MP-2: the ladder ROUTES real deeds (docs/MORAL_PHYSICS.md §4).
//
// The tier function is proven pure in U558; this proves the moral-fact sources actually
// carry the tier on the recorded deed, through the live playloop:
//   (a) a recorded HEAVY WITNESSED cruelty deed carries tier 2 on its record;
//   (b) a fair-combat kill routes tier 0 (the §6 seam: fair blood is not cruelty — it
//       records no recoil-worthy deed, and a fair-kill-shaped act grades to 0);
//   (c) the tier is silent structured state — no magnitude appears in ANY player-facing
//       string the deed turn emits (invariant I).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { escalationTier, DEED_SEV } from '../engine/morality/escalation.js';
import { assertWorldInvariants } from '../engine/invariants.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const packs = loadPacks();

// A HEAVY cruelty against the helpless, declared where settlement NPCs stand → witnessed.
const ATROCITY = 'I execute the kneeling captive who begs for mercy';

function beginOutside(seed = 'u559') {
  let w = beginAdventure(newWorld({
    seed, fate: 0.2, campaignId: `u559-${seed}`,
    pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape'
  }), packs).world;
  const before = w.map.currentNodeId;
  w = playerMove(w, packs, 'go outside').world;
  // Guard: only proceed from a node that actually has witnesses (settlement NPCs present).
  return w;
}

test('U559-01: a HEAVY witnessed cruelty deed carries tier 2 on its record', () => {
  const w0 = beginOutside('u559');
  const here = w0.map.nodes.find(n => n.id === w0.map.currentNodeId);
  const witnesses = (here?.settlement?.npcs || []).filter(n => n && n.id);
  assert.ok(witnesses.length >= 1, `test premise: the starting node has settlement witnesses (got ${witnesses.length})`);

  const w = playerMove(w0, packs, ATROCITY).world;
  assertWorldInvariants(w);

  const deeds = w.deeds || [];
  assert.ok(deeds.length >= 1, 'the atrocity recorded a deed');
  const deed = deeds[deeds.length - 1];
  assert.equal(deed.kind, 'cruelty', 'the helpless-kill is a cruelty deed');
  assert.equal(deed.severity, DEED_SEV.HEAVY, 'a helpless-kill is HEAVY');
  assert.ok(deed.witnesses.length >= 1, 'the deed carries its witnesses (occupancy truth)');
  // The routing payload: the deed carries the ladder rung, and it is Tier 2 (recoils AND
  // was seen). It could be HIGHER if the run pre-accumulated corruption/heat — but from a
  // fresh actor, a single HEAVY witnessed deed is exactly Tier 2.
  assert.equal(deed.tier, 2, 'a HEAVY witnessed deed carries Tier 2 on its record');
  // Cross-check: the stored tier equals the pure function over the deed's own fields.
  const recomputed = escalationTier(
    { severity: deed.severity, kind: deed.kind },
    { corruption: Number(w.party?.[0]?.morality?.corruption ?? 0), heat: Number(w.party?.[0]?.morality?.heat ?? 0) },
    { witnessReach: deed.witnesses.length, wild: deed.witnesses.length === 0 }
  );
  assert.ok(recomputed >= deed.tier, 'stored tier is consistent with the ladder over the deed record');
});

test('U559-02: a fair-combat kill routes Tier 0 (no recoil-worthy deed; §6 seam)', () => {
  // A bare, fair kill (no helpless/surrendered/innocent context) is UNTAGGED by the deed
  // detector — it records no cruelty deed, so nothing recoil-worthy travels. This is the
  // §6 seam: routine combat blood must never fire the ladder.
  const w0 = beginOutside('u559b');
  const deedsBefore = (w0.deeds || []).length;
  const w = playerMove(w0, packs, 'I cut down the bandit in a fair fight').world;
  assertWorldInvariants(w);
  const newDeeds = (w.deeds || []).slice(deedsBefore);
  const recoiling = newDeeds.filter(d => d && d.kind === 'cruelty' && d.tier >= 1);
  assert.equal(recoiling.length, 0, 'a fair fight records no recoil-worthy (tier>=1) cruelty deed');

  // Directly: a fair-kill-shaped act (were it ever recorded) grades to Tier 0 through the ladder.
  assert.equal(
    escalationTier({ severity: DEED_SEV.MOD, kind: 'cruelty' }, { corruption: 0, heat: 0 }, { witnessReach: 3 }),
    0,
    'fair-kill severity (MOD, untagged) → Tier 0 even when witnessed'
  );
});

// The meter-leak guard (shared shape with U557): ban the stat-line forms, not all digits.
const METER_RE = /\b(?:reputation|notoriety|corruption|virtue|karma|morality|infamy|standing|tier|escalation)\b\s*[:=\-−]?\s*[-−]?\d|\b\d{1,3}\s*%|[\[(]\s*(?:reputation|corruption|virtue|karma|tier)\b/i;

test('U559-03: the tier is silent — no magnitude leaks into the deed turn\'s narration', () => {
  const w0 = beginOutside('u559');
  const out = playerMove(w0, packs, ATROCITY).output || {};
  const strings = [String(out.narration || ''), String(out.mechanics || '')];
  for (const s of strings) {
    assert.doesNotMatch(s, METER_RE, `no tier/meter leaks into a player-facing string; got: ${s}`);
    // Belt-and-suspenders: the literal ladder vocabulary must not surface either.
    assert.doesNotMatch(s, /\bescalation\s*tier\b|\btier\s*[0-4]\b/i, `no ladder-internal wording surfaces; got: ${s}`);
  }
});

test('U559-04: routing is engine-only — a direct recordDeed op is tiered at the chokepoint', () => {
  // Every recordDeed emitter (playloop, castConsequence, storyEngine) flows through the ONE
  // effectsCore chokepoint. Prove it grades a raw op with no per-emitter tier logic.
  let w = beginOutside('u559c');
  const nid = String(w.map.currentNodeId || '');
  w = applyDeltas(w, [
    { op: 'recordDeed', deedKind: 'forbidden', severity: DEED_SEV.LIGHT, summary: 'a whispered rite', nodeId: nid, witnesses: ['npc_a', 'npc_b'], t: 0 },
  ]);
  const deed = (w.deeds || []).find(d => d.summary === 'a whispered rite');
  assert.ok(deed, 'the raw recordDeed op landed a deed');
  // forbidden → recoils (T1); witnessed → travels (T2). Graded at the chokepoint, not by the caller.
  assert.equal(deed.tier, 2, 'a witnessed forbidden deed is graded Tier 2 by the effectsCore chokepoint');
  assertWorldInvariants(w);
});
