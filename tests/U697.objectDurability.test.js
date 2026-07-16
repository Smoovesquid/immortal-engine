// U697 — OBJ-DURABILITY-1 / DM-GATE-1b: a declared furniture attack resolves against
// the target's PERSISTENT AC / HP / damageThreshold (world.objects[id].durability),
// carrying the ONE canonical objectId end-to-end. HP 0 mirrors the Model A piece to the
// terminal 'wrecked' state (never deleted, never rubble — a later packet). Bare
// smash/break/kick keeps the LEGACY force resolver, unchanged.
//
// The material-profile seam is proven DATA-DERIVED: the coverage section enumerates the
// three real catalog sources (FURN, procgen templates, Builder KIND_PHYSICS) and forces
// every live identity through durabilityProfile, requiring source==='explicit' — so a
// newly-added catalog material fails closed until someone chooses its profile.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { applyDeltas } from '../engine/effectsCore.js';
import { normalizeManifest } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { meleeProfile } from '../engine/combat/escapeCombat.js';
import { makeRng, seedFromString } from '../engine/rng.js';
import { durabilityProfile, initialDurability, hasDurabilityProfile } from '../engine/objects/index.js';
import { authoredObjectId } from '../engine/objects/identity.js';
import { FURN } from '../engine/structures/roomDetail.js';
import { TEMPLATE_MATERIALS } from '../engine/decompression/generateFurniture.js';
import { AUTHORED_KIND_MATERIALS, isFurnitureDestroyed } from '../engine/structures/authoredFurniture.js';

const PACKS = normalizeManifest(JSON.parse(fs.readFileSync(new URL('../packs/manifest.json', import.meta.url))));

// ── Fixtures ────────────────────────────────────────────────────────────────
function boot(seed = 'objdur') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
}

// Replace the current node's furniture with controlled pieces; optionally set MIGHT.
// Clears dialogue/combat AND the player's interior pointer (scene.interior is DERIVED
// from party[0].position.interior on every ensureWorld, so both must go) — then
// objectsHere returns the whole node list and the injected pieces are unambiguously "here".
function withFurniture(base, pieces, { might } = {}) {
  const nodeId = base.map.currentNodeId;
  const nodes = base.map.nodes.map(n => (n.id === nodeId ? { ...n, furniture: pieces } : n));
  const party = base.party.map((p, i) => {
    if (i !== 0) return p;
    const pos = { ...(p.position || {}) };
    delete pos.interior;
    const np = { ...p, position: pos };
    if (might != null) np.stats = { ...(p.stats || {}), MIGHT: might };
    return np;
  });
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: nodeId, nodes },
    party,
    scene: { ...(base.scene || {}), dialogue: null, interior: null },
    combat: null,
  });
}

const piece = (over) => ({ name: 'oaken crate', kind: 'crate', material: 'wood', cell: { x: 5, y: 5 }, ...over });

const STRIKE_RE = /\[object-strike:([^ |]+) \| atk:(-?\d+) vs AC:(\d+) → (hit|miss)(?: \| dmg:(\d+) vs thr:(\d+))? \| hp:(\d+)\/(\d+) \| (\w+)/;
function strike(world, text) {
  const { world: w2, output } = playerMove(world, PACKS, text);
  const mech = String(output?.mechanics || '');
  const m = mech.match(STRIKE_RE);
  const parsed = m
    ? { objectId: m[1], atk: +m[2], ac: +m[3], hit: m[4] === 'hit', dmg: m[5] != null ? +m[5] : 0, thr: m[6] != null ? +m[6] : null, hp: +m[7], maxHp: +m[8], material: m[9] }
    : null;
  return { world: w2, narration: String(output?.narration || ''), mech, parsed };
}
const durabilityOf = (w, oid) => (w.objects && w.objects[oid] && w.objects[oid].durability) || null;
const furnitureOf = (w, oid) => {
  for (const n of w.map.nodes) for (const f of (n.furniture || [])) if (String(f.objectId || '') === oid) return f;
  return null;
};
const canonEvents = (w) => Array.isArray(w.canonLog?.events) ? w.canonLog.events : [];
function predictedStrike(world, objectId, text) {
  const actorId = String(world.party?.[0]?.id || 'party');
  const weapon = meleeProfile(world.party?.[0] || {});
  const seed = seedFromString(`${world.meta.seed}|objstrike|${(world.timeline || []).length}|${actorId}|${objectId}|${text}`);
  const rng = makeRng(seed);
  return {
    rawDie: rng.int(1, 20),
    rawDmg: Math.max(1, rng.int(1, Number(weapon.die) || 6) + (Number(weapon.dmgMod) || 0)),
    weapon,
  };
}
function actionFor(world, objectId, prefix, predicate) {
  for (let i = 0; i < 500; i++) {
    const text = `${prefix} (${i}).`;
    if (predicate(predictedStrike(world, objectId, text))) return text;
  }
  assert.fail(`could not find deterministic strike fixture for: ${prefix}`);
}

// ── A. targeting / never combat ──────────────────────────────────────────────
test('U697-A1: a declared furniture attack resolves out of combat as an object-strike', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w = withFurniture(boot(), [piece({ objectId: oid })], { might: 24 });
  const r = strike(w, 'I attack the oaken crate with my blade.');
  assert.ok(r.parsed, `expected an object-strike mechanics line, got: ${r.mech}`);
  assert.equal(r.parsed.objectId, oid, 'the strike carries the exact canonical objectId');
  assert.equal(r.world.combat?.active ?? false, false, 'an object strike never starts combat');
});

// ── B. AC hit/miss rule is honoured (self-consistent with the roll) ───────────
test('U697-B1: hit iff nat20 or (not nat1 and atk >= AC)', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w0 = withFurniture(boot(), [piece({ objectId: oid })], { might: 18 });
  const bonus = meleeProfile(w0.party[0]).atkBonus;
  let w = w0, seen = 0;
  for (let i = 0; i < 30; i++) {
    const r = strike(w, `I attack the oaken crate (${i}).`);
    if (!r.parsed) { w = r.world; continue; }
    seen++;
    const rawDie = r.parsed.atk - bonus;
    const expectHit = rawDie === 20 || (rawDie !== 1 && r.parsed.atk >= r.parsed.ac);
    assert.equal(r.parsed.hit, expectHit, `roll ${rawDie} vs AC ${r.parsed.ac}: hit should be ${expectHit} (${r.mech})`);
    w = r.world;
    if (isFurnitureDestroyed(furnitureOf(w, oid))) break;
  }
  assert.ok(seen >= 3, `expected several parsed object-strikes, saw ${seen}`);
});

test('U697-B3: natural 20 auto-hits even when the total is below object AC', () => {
  const oid = authoredObjectId('t', 'iron1');
  const w = withFurniture(boot('objdur-nat20'), [piece({ name: 'iron cookpot', kind: 'cookpot', material: 'iron', objectId: oid })], { might: 3 });
  const text = actionFor(w, oid, 'I attack the iron cookpot', p => p.rawDie === 20);
  const r = strike(w, text);
  assert.ok(r.parsed?.hit, `natural 20 must hit: ${r.mech}`);
  assert.ok(r.parsed.atk < r.parsed.ac, 'fixture proves the ordinary total was below AC');
});

test('U697-B4: natural 1 auto-misses even when the total meets object AC', () => {
  const oid = authoredObjectId('t', 'wax1');
  const w = withFurniture(boot('objdur-nat1'), [piece({ name: 'wax candles', kind: 'candles', material: 'wax', objectId: oid })], { might: 24 });
  const text = actionFor(w, oid, 'I attack the wax candles', p => p.rawDie === 1);
  const r = strike(w, text);
  assert.equal(r.parsed?.hit, false, `natural 1 must miss: ${r.mech}`);
  assert.ok(r.parsed.atk >= r.parsed.ac, 'fixture proves the ordinary total met AC');
});

// ── B2. damage is a SEEDED ROLL — it varies across hits, deterministic per seed+action ──
test('U697-B2: object damage is roll(die)+mod (varies across hits), deterministic for the same seed+action', () => {
  // A fresh, identical world each iteration; only the action text differs → the seeded damage
  // die differs. If damage were the max-die bug (die+mod, constant), every value would be equal.
  const oid = authoredObjectId('t', 'crate1');
  const series = (seed) => {
    const dmgs = [];
    for (let i = 0; i < 40; i++) {
      const w = withFurniture(boot(seed), [piece({ objectId: oid })], { might: 10 }); // d6 blade vs wood thr 3
      const r = strike(w, `I attack the oaken crate (${i}).`);
      if (r.parsed && r.parsed.hit && r.parsed.dmg > 0) dmgs.push(r.parsed.dmg);
    }
    return dmgs;
  };
  const a = series('objdur-vary');
  assert.ok(a.length >= 3, `expected several damaging hits, got ${a.length}`);
  assert.ok(new Set(a).size >= 2, `damage must vary across hits, not be a constant max-die value: [${a.join(',')}]`);
  // Same seed + identical action sequence reproduces the identical damage series (determinism).
  assert.deepEqual(series('objdur-vary'), a, 'same seed + actions → identical damage series');
});

// ── C. sub-threshold damage is absorbed (0 HP lost) ──────────────────────────
test('U697-C1: a hit whose damage is below threshold is absorbed and costs the object no HP', () => {
  // Stone (threshold 10); a weak MIGHT-10 blade rolls 1–6+0, always below 10.
  const oid = authoredObjectId('t', 'hearth1');
  const w0 = withFurniture(boot(), [piece({ name: 'stone hearth', kind: 'hearth', material: 'stone', objectId: oid })], { might: 10 });
  let w = w0, sawAbsorb = false;
  for (let i = 0; i < 40 && !sawAbsorb; i++) {
    const r = strike(w, `I attack the stone hearth (${i}).`);
    w = r.world;
    if (r.parsed && r.parsed.hit) {
      assert.ok(r.parsed.dmg < r.parsed.thr, 'weak blow must be sub-threshold vs stone');
      assert.equal(r.parsed.hp, r.parsed.maxHp, 'an absorbed hit costs no HP');
      assert.match(r.narration, /barely marked|isn't enough/i, 'absorbed prose reads as no meaningful damage');
      sawAbsorb = true;
    }
  }
  assert.ok(sawAbsorb, 'expected at least one hit to land and be absorbed');
  const d = durabilityOf(w, oid);
  assert.ok(d && d.hp === d.maxHp, 'stone hearth remains at full HP after absorbed blows');
});

test('U697-C2: damage exactly equal to the threshold applies in full', () => {
  const oid = authoredObjectId('t', 'crate-threshold');
  const w = withFurniture(boot('objdur-threshold-equality'), [piece({ objectId: oid })], { might: 10 });
  const profile = initialDurability('crate', 'wood');
  const bonus = meleeProfile(w.party[0]).atkBonus;
  const text = actionFor(w, oid, 'I attack the oaken crate', p => p.rawDmg === profile.threshold && (p.rawDie === 20 || (p.rawDie !== 1 && p.rawDie + bonus >= profile.ac)));
  const r = strike(w, text);
  assert.equal(r.parsed?.dmg, profile.threshold, `threshold-equal damage must not be absorbed: ${r.mech}`);
  assert.equal(r.parsed?.hp, profile.maxHp - profile.threshold, 'threshold-equal damage subtracts in full');
});

test('U697-C3: a clean miss writes no durability or canon ruling, including after prior damage', () => {
  const oid = authoredObjectId('t', 'crate-miss');
  const fresh = withFurniture(boot('objdur-clean-miss'), [piece({ objectId: oid })], { might: 10 });
  const missText = actionFor(fresh, oid, 'I attack the oaken crate', p => p.rawDie === 1);
  const missed = strike(fresh, missText);
  assert.equal(durabilityOf(missed.world, oid), null, 'a pristine miss does not mint durability');
  assert.equal(canonEvents(missed.world).length, canonEvents(fresh).length, 'a pristine miss adds no canon ruling');

  const damaged = applyDeltas(fresh, [{ op: 'damageObject', objectId: oid, damage: 4 }]);
  const before = structuredClone(durabilityOf(damaged, oid));
  const damagedMissText = actionFor(damaged, oid, 'I attack the oaken crate again', p => p.rawDie === 1);
  const missedAgain = strike(damaged, damagedMissText);
  assert.deepEqual(durabilityOf(missedAgain.world, oid), before, 'a later miss leaves existing HP untouched');
  assert.equal(canonEvents(missedAgain.world).length, canonEvents(damaged).length, 'a later miss adds no canon ruling');
});

// ── D. damage persists across strikes and survives export/import ─────────────
test('U697-D1: damaging hits lower persistent HP, and it survives export/import', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w0 = withFurniture(boot(), [piece({ objectId: oid })], { might: 10 }); // rolled d6+mod vs wood thr 3 → some hits damage
  let w = w0, prevHp = null, sawDamage = false;
  for (let i = 0; i < 40; i++) {
    const r = strike(w, `I attack the oaken crate (${i}).`);
    w = r.world;
    if (r.parsed && r.parsed.hit && r.parsed.dmg > 0) {
      if (r.parsed.hp > 0) {
        if (prevHp != null) assert.ok(r.parsed.hp < prevHp, 'each damaging hit strictly lowers HP');
        prevHp = r.parsed.hp;
        sawDamage = true;
      }
    }
    if (isFurnitureDestroyed(furnitureOf(w, oid))) break;
  }
  assert.ok(sawDamage, 'expected at least one damaging (non-absorbed, non-lethal) hit');
  const before = durabilityOf(w, oid);
  const round = importWorld(exportWorld(w));
  const after = durabilityOf(round.world ?? round, oid);
  assert.deepEqual(after, before, 'durability record is byte-stable across export/import');
});

// ── E. HP 0 → wrecked + terminal (collision-clear contract) ──────────────────
test('U697-E1: zeroing HP mirrors the piece to wrecked and stops further strikes', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w0 = withFurniture(boot(), [piece({ objectId: oid })], { might: 20 });
  let w = w0, wrecked = false;
  for (let i = 0; i < 60 && !wrecked; i++) {
    const r = strike(w, `I attack the oaken crate (${i}).`);
    w = r.world;
    wrecked = isFurnitureDestroyed(furnitureOf(w, oid));
  }
  assert.ok(wrecked, 'sustained strikes eventually wreck the crate');
  const f = furnitureOf(w, oid);
  assert.equal(f.state, 'wrecked', 'the Model A piece is marked wrecked (destroyed-state contract clears its cell)');
  assert.equal(durabilityOf(w, oid).hp, 0, 'overlay HP is 0');
  // A further strike is a terminal no-op (no roll).
  const again = strike(w, 'I attack the oaken crate again.');
  assert.match(again.mech, /already wrecked/i, 'a wrecked piece takes no further strikes');
});

// ── F. procgen objects (pg: ids) work through the same path ──────────────────
test('U697-F1: a procgen furniture object (no authored provenance) gains durability', () => {
  // No structureId/pieceId → ensureWorld backfills a pg:<node>:<ordinal> id.
  const w0 = withFurniture(boot(), [piece({ name: 'plain barrel', kind: 'barrel', material: 'wood' })], { might: 20 });
  const oid = w0.map.nodes.find(n => n.id === w0.map.currentNodeId).furniture[0].objectId;
  assert.match(oid, /^pg:/, 'procgen piece got a pg: id from the backfill');
  let w = w0, changed = false;
  for (let i = 0; i < 20 && !changed; i++) {
    const r = strike(w, `I attack the plain barrel (${i}).`);
    w = r.world;
    changed = !!durabilityOf(w, oid);
  }
  assert.ok(changed, 'the procgen barrel accrued a durability record on being struck');
});

// ── G. legacy smash/break/kick is NOT resurrected as an object-strike ────────
test('U697-G1: bare smash keeps the legacy force resolver (no object-strike, no durability)', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w = withFurniture(boot(), [piece({ objectId: oid, parts: ['slat', 'lid'] })], { might: 14 });
  const r = playerMove(w, PACKS, 'I smash the oaken crate with my staff.');
  const mech = String(r.output?.mechanics || '');
  assert.doesNotMatch(mech, /object-strike/i, 'smash does not route to the new AC/HP resolver');
  assert.equal(durabilityOf(r.world, oid), null, 'the legacy path writes no durability overlay record');
  assert.equal(r.world.combat?.active ?? false, false);
});

// ── H. determinism: seed → identical worldHash; a strike moves the hash ──────
test('U697-H1: identical seed + strike sequence yields identical worldHash', () => {
  const mk = () => withFurniture(boot('objdur-det'), [piece({ objectId: authoredObjectId('t', 'crate1') })], { might: 16 });
  const run = (w) => {
    for (let i = 0; i < 8; i++) w = strike(w, `I attack the oaken crate (${i}).`).world;
    return w;
  };
  assert.equal(worldHash(run(mk())), worldHash(run(mk())), 'replay is hash-stable');
});

test('U697-H2: a landed strike changes the worldHash (object HP is in the fingerprint)', () => {
  const oid = authoredObjectId('t', 'crate1');
  let w = withFurniture(boot('objdur-hash'), [piece({ objectId: oid })], { might: 22 });
  const before = worldHash(w);
  for (let i = 0; i < 10; i++) { w = strike(w, `I attack the oaken crate (${i}).`).world; if (durabilityOf(w, oid)) break; }
  assert.notEqual(worldHash(w), before, 'a persisted strike shifts the fingerprint');
});

// ── I. v33 → v34 upgrade + invariant rejects malformed durability ────────────
test('U697-I1: WORLD_VERSION is 35 and a v33-shaped save upgrades cleanly', () => {
  assert.equal(WORLD_VERSION, 35);
  const legacy = { meta: { version: 33, seed: 'old' }, objects: {} };
  const up = ensureWorld(legacy);
  assert.equal(up.meta.version, 35, 'ensureWorld stamps the current version');
  assert.doesNotThrow(() => assertWorldInvariants(up), 'a v33 save with an empty overlay is valid at v35');
});

test('U697-I2: invariants reject a malformed durability record', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w = withFurniture(boot(), [piece({ objectId: oid })]);
  const bad = (dur) => ensureWorldNoValidate({ ...w, objects: { ...w.objects, [oid]: { durability: dur } } });
  // ac must be > 0
  assert.throws(() => assertWorldInvariants(bad({ material: 'wood', ac: 0, maxHp: 15, hp: 5, threshold: 3 })), /durability\.ac/);
  // hp must be within 0..maxHp
  assert.throws(() => assertWorldInvariants(bad({ material: 'wood', ac: 15, maxHp: 15, hp: 99, threshold: 3 })), /durability\.hp/);
  // threshold must be >= 0
  assert.throws(() => assertWorldInvariants(bad({ material: 'wood', ac: 15, maxHp: 15, hp: 5, threshold: -1 })), /durability\.threshold/);
});

test('U697-I3: invariants reject divergence between terminal furniture state and durability HP', () => {
  const oid = authoredObjectId('t', 'crate-terminal-invariant');
  const base = withFurniture(boot(), [piece({ objectId: oid })]);
  const aliveButWrecked = {
    ...base,
    map: { ...base.map, nodes: base.map.nodes.map(n => n.id === base.map.currentNodeId ? { ...n, furniture: n.furniture.map(f => ({ ...f, state: 'wrecked' })) } : n) },
    objects: { ...base.objects, [oid]: { durability: { material: 'wood', ac: 15, maxHp: 15, hp: 4, threshold: 3 } } },
  };
  assert.throws(() => assertWorldInvariants(aliveButWrecked), /terminal state disagrees/);

  const deadButIntact = {
    ...base,
    objects: { ...base.objects, [oid]: { durability: { material: 'wood', ac: 15, maxHp: 15, hp: 0, threshold: 3 } } },
  };
  assert.throws(() => assertWorldInvariants(deadButIntact), /terminal state disagrees/);
});

test('U697-I4: v33 placement fields survive upgrade, first strike, and save round-trip', () => {
  // OBJ-HOLD-6A (U698) made held⊥placed an invariant LAW, so the original fixture
  // (one record carrying BOTH placedAt and heldByActorId) is now an illegal state by
  // design. The passthrough coverage is unchanged — proven on the two legal shapes.
  const oid = authoredObjectId('t', 'crate-v33-overlay');
  const source = withFurniture(boot('objdur-v33-overlay'), [piece({ objectId: oid })], { might: 10 });
  // (a) PLACED record: placement + unknown fields survive upgrade, strike, round-trip.
  const placedAt = { node: source.map.currentNodeId, cell: { x: 6, y: 7 } };
  const legacy = {
    ...source,
    meta: { ...source.meta, version: 33 },
    objects: { ...source.objects, [oid]: { placedAt, keepMe: 11 } },
  };
  const upgraded = ensureWorld(legacy);
  const text = actionFor(upgraded, oid, 'I attack the oaken crate', p => p.rawDie === 20);
  const struck = strike(upgraded, text).world;
  const round = importWorld(exportWorld(struck));
  const restored = round.world ?? round;
  assert.deepEqual(restored.objects[oid].placedAt, placedAt);
  assert.equal(restored.objects[oid].keepMe, 11);
  assert.ok(restored.objects[oid].durability, 'first strike adds durability without replacing the v33 overlay');
  assert.doesNotThrow(() => assertWorldInvariants(restored));
  // (b) HELD record: heldByActorId + unknown fields survive upgrade and round-trip.
  // (No strike leg: a held object is off the floor list, so a declared attack on it
  // correctly no longer resolves — that behavior is U698-E1's.)
  const legacyHeld = {
    ...source,
    meta: { ...source.meta, version: 33 },
    objects: { ...source.objects, [oid]: { heldByActorId: 'porter', keepMe: 11 } },
  };
  const roundHeld = importWorld(exportWorld(ensureWorld(legacyHeld)));
  const restoredHeld = roundHeld.world ?? roundHeld;
  assert.equal(restoredHeld.objects[oid].heldByActorId, 'porter');
  assert.equal(restoredHeld.objects[oid].keepMe, 11);
  assert.doesNotThrow(() => assertWorldInvariants(restoredHeld));
});

// A shallow clone that skips ensureWorld's validation so we can hand a deliberately
// malformed record straight to assertWorldInvariants.
function ensureWorldNoValidate(w) { return w; }

// ── J. DATA-DERIVED COVERAGE: every live catalog identity resolves explicit ──
test('U697-J1: every FURN / template / KIND_PHYSICS identity resolves with source=explicit', () => {
  const rows = [];
  for (const [kind, def] of Object.entries(FURN)) rows.push(['FURN', kind, def.material]);
  for (const t of TEMPLATE_MATERIALS) rows.push(['template', t.name, t.material]);
  for (const { kind, material } of AUTHORED_KIND_MATERIALS) rows.push(['KIND_PHYSICS', kind, material]);

  for (const [src, kind, material] of rows) {
    const r = durabilityProfile(kind, material);
    assert.equal(r.source, 'explicit', `${src} '${kind}' (${material}) must have a deliberate profile, not fallback`);
    assert.ok(r.profile.ac > 0 && r.profile.maxHp > 0 && r.profile.threshold >= 0, `${src} '${kind}' profile must be well-formed`);
  }
});

test('U697-J2: fire-material light kinds resolve to their physical class, not "fire"', () => {
  assert.equal(durabilityProfile('hearth', 'fire').physicalMaterial, 'stone');
  assert.equal(durabilityProfile('firepit', 'fire').physicalMaterial, 'stone');
  assert.equal(durabilityProfile('brazier', 'fire').physicalMaterial, 'iron');
  assert.equal(durabilityProfile('lantern', 'fire').physicalMaterial, 'iron');
  assert.equal(durabilityProfile('candles', 'fire').physicalMaterial, 'wax');
  for (const k of ['hearth', 'firepit', 'brazier', 'lantern', 'candles']) {
    assert.equal(durabilityProfile(k, 'fire').source, 'explicit', `${k} resolves explicitly by kind precedence`);
  }
});

test('U697-J3: unknown identities fall back safely; no ceramic profile is fabricated', () => {
  const u = durabilityProfile('gizmo', 'plasteel');
  assert.equal(u.source, 'fallback');
  assert.equal(u.physicalMaterial, 'unknown');
  assert.ok(u.profile.ac > 0 && u.profile.maxHp > 0, 'fallback is still a valid, load-safe profile');
  // A leftover render 'fire' on a non-light kind never becomes a "fire" profile.
  assert.equal(durabilityProfile('', 'fire').source, 'fallback');
  // There is no ceramic catalog material — none is invented.
  assert.equal(hasDurabilityProfile('ceramic'), false);
  assert.equal(durabilityProfile('', 'ceramic').source, 'fallback');
});

// ── K. IDENTITY CONTRACT: presence invariant + duplicate-name isolation ──────
test('U697-K1: a furniture piece missing its objectId is an invariant breach', () => {
  const oid = authoredObjectId('t', 'crate1');
  const w = withFurniture(boot(), [piece({ objectId: oid })]);
  const nodeId = w.map.currentNodeId;
  const broken = {
    ...w,
    map: { ...w.map, nodes: w.map.nodes.map(n => (n.id === nodeId ? { ...n, furniture: n.furniture.map(f => { const g = { ...f }; delete g.objectId; return g; }) } : n)) },
  };
  assert.throws(() => assertWorldInvariants(broken), /missing objectId/);
});

test('U697-K2: an ordinal resolves the attack to the SECOND same-named object; only that object changes', () => {
  // Two identically-named, id-LESS pieces. ensureWorld backfills distinct pg: ids FIRST.
  const mk = () => withFurniture(boot('objdur-dup'), [
    piece({ name: 'wooden barrel', kind: 'barrel', material: 'wood' }),
    piece({ name: 'wooden barrel', kind: 'barrel', material: 'wood' }),
  ], { might: 22 });
  const w0 = mk();
  const furn = w0.map.nodes.find(n => n.id === w0.map.currentNodeId).furniture;
  const [id0, id1] = [furn[0].objectId, furn[1].objectId];
  assert.ok(id0 && id1 && id0 !== id1, 'the two same-named barrels got distinct backfilled ids');

  // "the SECOND wooden barrel" must resolve to id1 (never id0). Strike it until it accrues a
  // durability record, then assert the FIRST barrel's overlay is still untouched.
  let w = w0, hit1 = false;
  for (let i = 0; i < 25 && !hit1; i++) {
    const r = strike(w, `I attack the second wooden barrel (${i}).`);
    if (r.parsed) assert.equal(r.parsed.objectId, id1, 'the ordinal strike resolves to the SECOND barrel');
    w = r.world;
    hit1 = !!durabilityOf(w, id1);
  }
  assert.ok(hit1, 'the second barrel accrued a durability record');
  assert.equal(durabilityOf(w, id0), null, 'the FIRST same-named barrel is untouched — second-object damage never bleeds to the first');

  // Symmetric guard: from a fresh identical world, the DEFAULT (no ordinal) resolves to the FIRST.
  let w2 = mk(), hit0 = false;
  for (let i = 0; i < 25 && !hit0; i++) {
    const r = strike(w2, `I attack the wooden barrel (${i}).`);
    if (r.parsed) assert.equal(r.parsed.objectId, id0, 'the default (no ordinal) resolves to the FIRST barrel');
    w2 = r.world;
    hit0 = !!durabilityOf(w2, id0);
  }
  assert.ok(hit0, 'the first barrel accrued a durability record under the default target');
  assert.equal(durabilityOf(w2, id1), null, 'the second barrel is untouched under a first-target attack');
});

test('U697-K3: ordinals apply only to the primary target and never clamp out of range', () => {
  const w = withFurniture(boot('objdur-ordinal-scope'), [
    piece({ name: 'wooden barrel', kind: 'barrel', material: 'wood' }),
    piece({ name: 'wooden chair', kind: 'chair', material: 'wood' }),
    piece({ name: 'wooden barrel', kind: 'barrel', material: 'wood' }),
  ], { might: 22 });
  const furn = w.map.nodes.find(n => n.id === w.map.currentNodeId).furniture;
  const [first, chair, second] = furn.map(f => f.objectId);

  const scoped = strike(w, 'I attack the second wooden barrel with the wooden chair.');
  assert.equal(scoped.parsed?.objectId, second, 'a named furniture weapon cannot contaminate the target match list');
  assert.equal(durabilityOf(scoped.world, first), null);
  assert.equal(durabilityOf(scoped.world, chair), null);

  const incidental = strike(w, 'I attack the wooden barrel after my second warning.');
  assert.equal(incidental.parsed?.objectId, first, 'an ordinal outside the primary target clause does not retarget the strike');

  for (const ordinal of ['zeroth', '0th', 'third', 'sixth', '99th']) {
    const out = strike(w, `I attack the ${ordinal} wooden barrel.`);
    assert.equal(out.parsed, null, `${ordinal} of two is not a resolvable target`);
    assert.match(out.mech, /no resolvable target|no-op/i);
    assert.deepEqual(out.world.objects, w.objects, `${ordinal} must not clamp to an existing barrel`);
  }
});

// ── L. writer trust boundary + lifecycle reconciliation ─────────────────
test('U697-L1: damageObject derives the profile from the live piece and preserves unrelated overlay fields', () => {
  const oid = authoredObjectId('t', 'crate-writer');
  const base = withFurniture(boot('objdur-writer'), [piece({ objectId: oid })]);
  const nodeId = base.map.currentNodeId;
  const placedAt = { node: nodeId, cell: { x: 7, y: 8 } };
  const w = { ...base, objects: { ...base.objects, [oid]: { placedAt, keepMe: 7 } } };
  const forged = { material: 'wax', ac: 1, maxHp: 999, hp: 999, threshold: 999 };
  const next = applyDeltas(w, [{ op: 'damageObject', objectId: oid, snapshot: forged, damage: 2 }]);
  assert.deepEqual(next.objects[oid].placedAt, placedAt, 'placement survives the durability write');
  assert.equal(next.objects[oid].keepMe, 7, 'unrelated overlay fields survive');
  assert.deepEqual(next.objects[oid].durability, { material: 'wood', ac: 15, maxHp: 15, hp: 13, threshold: 3 }, 'caller-supplied profile data is ignored');

  const before = worldHash(next);
  const stale = applyDeltas(next, [{ op: 'damageObject', objectId: 'pg:missing:99', damage: 100 }]);
  assert.equal(worldHash(stale), before, 'a stale damageObject id is a total no-op');
  const empty = applyDeltas(next, [{ op: 'damageObject', objectId: '', damage: 100 }]);
  assert.equal(worldHash(empty), before, 'an empty damageObject id is a total no-op');

  const nodeId2 = next.map.currentNodeId;
  const terminal = {
    ...next,
    map: { ...next.map, nodes: next.map.nodes.map(n => n.id === nodeId2 ? { ...n, furniture: n.furniture.map(f => f.objectId === oid ? { ...f, state: 'wrecked' } : f) } : n) },
    objects: {},
  };
  const noResurrection = applyDeltas(terminal, [{ op: 'damageObject', objectId: oid, damage: 1 }]);
  assert.equal(noResurrection.objects[oid], undefined, 'direct damage cannot mint live HP for an already terminal piece');
});

test('U697-L2: taking a previously damaged portable object removes its overlay atomically', () => {
  const oid = authoredObjectId('t', 'chair-take');
  let w = withFurniture(boot('objdur-take'), [piece({ name: 'wooden chair', kind: 'chair', material: 'wood', weight: 2, bulk: 2, objectId: oid })], { might: 24 });
  for (let i = 0; i < 40 && !durabilityOf(w, oid); i++) w = strike(w, `I attack the wooden chair (${i}).`).world;
  assert.ok(durabilityOf(w, oid)?.hp > 0, 'precondition: chair is damaged but still portable');
  const taken = playerMove(w, PACKS, 'I take the wooden chair.');
  assert.equal(furnitureOf(taken.world, oid), null, 'the chair leaves node furniture');
  assert.equal(taken.world.objects[oid], undefined, 'its now-orphaned overlay is removed in the same delta batch');
  assert.doesNotThrow(() => assertWorldInvariants(taken.world), 'the resulting world is immediately invariant-clean');
});

test('U697-L3: legacy terminal furniture mutation reconciles existing durability to zero HP', () => {
  const oid = authoredObjectId('t', 'crate-legacy-break');
  const base = withFurniture(boot('objdur-legacy-break'), [piece({ objectId: oid })]);
  const damaged = applyDeltas(base, [{ op: 'damageObject', objectId: oid, damage: 2 }]);
  assert.ok(durabilityOf(damaged, oid)?.hp > 0);
  const wrecked = applyDeltas(damaged, [{ op: 'modifyFurniture', nodeId: damaged.map.currentNodeId, objectId: oid, changes: { state: 'wrecked' } }]);
  assert.equal(furnitureOf(wrecked, oid)?.state, 'wrecked');
  assert.equal(durabilityOf(wrecked, oid)?.hp, 0, 'terminal Model A state and overlay HP cannot diverge');
});
