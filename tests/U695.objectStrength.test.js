// U695 — OBJ-STRENGTH-1: placed objects are physically real. Strength + size + weight
// + bulk + mobility decide whether an actor can lift/carry/drag an object, for players
// AND NPCs, via one pure resolver. The "take" gate is capacity, not a flat bulk cutoff,
// and its remove delta carries the OBJ-STATE-1 objectId.
//
// Sections:
//   A  — mobility classifier COVERAGE: enumerate the LIVE roomDetail.FURN keys+labels and
//        generateFurniture.TEMPLATES[].name; every one must be explicitly classified
//        (fail-closed: a new catalog item fails until its class is chosen).
//   A2 — the specific aliases Tim flagged + identity-beats-fallback precedence.
//   B  — actorObjectCapacity verdicts (pure): the exemplar matrix, authored AND procgen.
//   C  — bulk affects capacity today (rug vs chair; the lighter procgen table).
//   D  — findPhysicsActor lookup order + collision + absent-actor defaults; actorSize/Might.
//   E  — size canonical at the content source: real Cave Troll catalog → spawned hostile
//        with existing bestiaryRef → actorSize reads Large (no enemy.size field).
//   F  — integration take gate, all four outcomes: auto / roll→success / roll→failure /
//        impossible, with objectId on the remove delta.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { evaluatePhysicsSync } from '../engine/llmPhysics.js';
import { rollPhysicsCheck } from '../engine/resolve.js';
import { makeRng } from '../engine/rng.js';
import { FURN } from '../engine/structures/roomDetail.js';
import { TEMPLATE_NAMES } from '../engine/decompression/generateFurniture.js';
import { getMonsterDef } from '../engine/ruleset/core/bestiary/index.js';
import { spawnEncounter } from '../engine/combat/encounterSpawn.js';
import { mintEnemyFromNpc, beginCombat } from '../engine/combat/combatLifecycle.js';

import {
  mobilityForObject, objectPhysics, IDENTITY_MOBILITY, normalizeIdentity,
} from '../engine/objects/mobility.js';
import { actorObjectCapacity, baseCapacity } from '../engine/objects/capacity.js';
import { findPhysicsActor, actorSize, actorMight, actorFacts } from '../engine/objects/physicsActor.js';

const CLASSES = new Set(['fixed', 'heavy', 'portable']);
const base = () => newWorld({ seed: 'u695', fate: 0.4, pack: { primaryId: 'fantasy', mixerId: null } });
const currentNode = (w) => w.map.nodes.find(n => n.id === w.map.currentNodeId);

// ── A. Data-driven coverage — the fail-closed contract ──────────────────────
test('U695-A every live FURN key AND label is explicitly classified', () => {
  for (const [key, def] of Object.entries(FURN)) {
    const k = normalizeIdentity(key);
    assert.ok(CLASSES.has(IDENTITY_MOBILITY[k]), `FURN key "${key}" (→ ${k}) unmapped in IDENTITY_MOBILITY`);
    const l = normalizeIdentity(def.label);
    assert.ok(CLASSES.has(IDENTITY_MOBILITY[l]), `FURN label "${def.label}" (→ ${l}) unmapped in IDENTITY_MOBILITY`);
  }
});

test('U695-A every procgen TEMPLATE name is explicitly classified', () => {
  assert.ok(TEMPLATE_NAMES.length > 0, 'TEMPLATE_NAMES is populated');
  for (const name of TEMPLATE_NAMES) {
    const n = normalizeIdentity(name);
    assert.ok(CLASSES.has(IDENTITY_MOBILITY[n]), `TEMPLATE name "${name}" (→ ${n}) unmapped in IDENTITY_MOBILITY`);
  }
});

test('U695-A every IDENTITY_MOBILITY value is a valid class; the map + TEMPLATE_NAMES are frozen', () => {
  for (const v of Object.values(IDENTITY_MOBILITY)) assert.ok(CLASSES.has(v), `bad class ${v}`);
  assert.ok(Object.isFrozen(IDENTITY_MOBILITY), 'IDENTITY_MOBILITY is frozen');
  assert.ok(Object.isFrozen(TEMPLATE_NAMES), 'TEMPLATE_NAMES is frozen (read-only catalog view)');
});

// ── A2. The flagged aliases + precedence ─────────────────────────────────────
test('U695-A2 alias pairs that differ by spacing/truncation both resolve to the same class', () => {
  assert.equal(mobilityForObject({ name: 'firepit' }), 'fixed');
  assert.equal(mobilityForObject({ name: 'fire pit' }), 'fixed');
  assert.equal(mobilityForObject({ name: 'sarcoph' }), 'fixed');
  assert.equal(mobilityForObject({ name: 'sarcophagus' }), 'fixed');
  assert.equal(mobilityForObject({ name: 'basin' }), 'fixed');
  assert.equal(mobilityForObject({ name: 'stone basin' }), 'fixed');
});

test('U695-A2 the previously-missing FURN labels all carry a chosen class', () => {
  const expect = {
    'long table': 'heavy', 'market stall': 'heavy', loom: 'heavy',
    'straw bedding': 'portable', 'cooking pot': 'portable', shelves: 'heavy',
    'weapon rack': 'heavy', 'bone pile': 'portable', rubble: 'heavy',
    'web mass': 'portable', 'egg sac': 'portable', 'aisle runner': 'portable',
  };
  for (const [label, cls] of Object.entries(expect)) {
    assert.equal(mobilityForObject({ name: label }), cls, `${label} should be ${cls}`);
  }
});

test('U695-A2 identity beats the weight/bulk fallback; kind wins over name; unknowns fall back', () => {
  // A bulk-5 cast-iron pot named 'cookpot' is still portable by IDENTITY, not heavy by bulk.
  assert.equal(mobilityForObject({ name: 'cookpot', weight: 5, bulk: 5 }), 'portable');
  // An unknown identity falls back to weight/bulk.
  assert.equal(mobilityForObject({ name: 'gizmo-xyzzy', weight: 5, bulk: 5 }), 'heavy');
  assert.equal(mobilityForObject({ name: 'gizmo-xyzzy', weight: 1, bulk: 1 }), 'portable');
  // kind is consulted before name.
  assert.equal(mobilityForObject({ kind: 'hearth', name: 'chair' }), 'fixed');
  // The two racks are distinct identities with distinct classes.
  assert.equal(mobilityForObject({ name: 'weapon rack' }), 'heavy');
  assert.equal(mobilityForObject({ name: 'tool rack' }), 'portable');
});

// ── B. Capacity verdicts (pure) — authored AND procgen objects ───────────────
const chairAuthored = objectPhysics({ kind: 'chair', name: 'chair', weight: 2, bulk: 2, material: 'wood' });
const cookpot = objectPhysics({ kind: 'cookpot', name: 'cooking pot', weight: 3, bulk: 2, material: 'iron' });
const tableAuthored = objectPhysics({ kind: 'table', name: 'table', weight: 4, bulk: 4, material: 'wood' });
const woodenTableProc = objectPhysics({ name: 'wooden table', weight: 3, bulk: 4, material: 'wood' });
const stoneBasinProc = objectPhysics({ name: 'stone basin', weight: 5, bulk: 5, material: 'stone' });
const hearth = objectPhysics({ kind: 'hearth', name: 'hearth', weight: 5, bulk: 5, material: 'stone' });

const WEAK_SMALL = { might: 6, size: 'Small' };   // baseCapacity 3, cap 2
const MEDIUM = { might: 10, size: 'Medium' };      // cap 4
const TROLL = { might: 20, size: 'Large' };        // cap 8

test('U695-B weak Small: chair is a roll, cast-iron cookpot is impossible', () => {
  assert.equal(actorObjectCapacity(WEAK_SMALL, chairAuthored, 'carry').verdict, 'roll');
  assert.equal(actorObjectCapacity(WEAK_SMALL, cookpot, 'carry').verdict, 'impossible');
});

test('U695-B Medium: authored table AND lighter procgen table are both borderline rolls; cookpot auto', () => {
  assert.equal(actorObjectCapacity(MEDIUM, tableAuthored, 'carry').verdict, 'roll');
  assert.equal(actorObjectCapacity(MEDIUM, woodenTableProc, 'carry').verdict, 'roll');
  assert.equal(actorObjectCapacity(MEDIUM, cookpot, 'carry').verdict, 'auto');
});

test('U695-B Large troll: table and cookpot are auto; a fixed hearth is impossible for the troll too', () => {
  assert.equal(actorObjectCapacity(TROLL, tableAuthored, 'carry').verdict, 'auto');
  assert.equal(actorObjectCapacity(TROLL, cookpot, 'carry').verdict, 'auto');
  assert.equal(actorObjectCapacity(TROLL, hearth, 'carry').verdict, 'impossible');
  assert.equal(actorObjectCapacity(TROLL, hearth, 'carry').reason, 'fixed');
});

test('U695-B a fixed fixture (stone basin, procgen) is impossible for a Medium actor', () => {
  const cap = actorObjectCapacity(MEDIUM, stoneBasinProc, 'carry');
  assert.equal(cap.verdict, 'impossible');
  assert.equal(cap.reason, 'fixed');
});

test('U695-B baseCapacity landmarks (MIGHT 6→3, 10→4, 20→7)', () => {
  assert.equal(baseCapacity(6), 3);
  assert.equal(baseCapacity(10), 4);
  assert.equal(baseCapacity(20), 7);
});

// ── C. Bulk affects capacity today, and drag beats carry ─────────────────────
test('U695-C a bulky-but-light rug is harder to carry than a same-weight chair (bulk burden)', () => {
  const rug = objectPhysics({ kind: 'rug', name: 'rug', weight: 2, bulk: 3, material: 'cloth' });
  // chair (w2/bulk2) is a roll for the weak Small; rug (w2/bulk3) tips to impossible.
  assert.equal(actorObjectCapacity(WEAK_SMALL, chairAuthored, 'carry').verdict, 'roll');
  assert.equal(actorObjectCapacity(WEAK_SMALL, rug, 'carry').verdict, 'impossible');
});

test('U695-C you can drag what you cannot carry (push/drag permit heavier loads)', () => {
  // weak Small vs an authored table: carry impossible, drag a roll.
  assert.equal(actorObjectCapacity(WEAK_SMALL, tableAuthored, 'carry').verdict, 'impossible');
  assert.equal(actorObjectCapacity(WEAK_SMALL, tableAuthored, 'drag').verdict, 'roll');
});

test('U695-C player and NPC of equal MIGHT+size reach the identical verdict (pure resolver)', () => {
  const asParty = actorObjectCapacity({ might: 8, size: 'Small' }, cookpot, 'carry');
  const asNpc = actorObjectCapacity({ might: 8, size: 'Small' }, cookpot, 'carry');
  assert.deepEqual(asParty, asNpc);
});

// ── D. findPhysicsActor + actorSize + actorMight ─────────────────────────────
function worldWithActors() {
  const w = base();
  w.party = [{ id: 'pc', stats: { MIGHT: 12 }, dnd: { species: { size: 'Small' } } }];
  w.combat = { enemies: [{ id: 'e1', stats: { MIGHT: 16 } }] };
  currentNode(w).settlement = { npcs: [{ id: 'n1', bestiaryRef: 'cave_troll', stats: { MIGHT: 20 } }] };
  return w;
}

test('U695-D lookup order party → enemy → npc; empty id → lead party member', () => {
  const w = worldWithActors();
  assert.equal(findPhysicsActor(w, 'pc').kind, 'party');
  assert.equal(findPhysicsActor(w, 'e1').kind, 'enemy');
  assert.equal(findPhysicsActor(w, 'n1').kind, 'npc');
  assert.equal(findPhysicsActor(w, '').kind, 'party');
  assert.equal(findPhysicsActor(w, '').actor.id, 'pc');
});

test('U695-D collision rule — an id present in party AND enemies resolves to party (first wins)', () => {
  const w = base();
  w.party = [{ id: 'dup', stats: { MIGHT: 8 } }];
  w.combat = { enemies: [{ id: 'dup', stats: { MIGHT: 20 } }] };
  assert.equal(findPhysicsActor(w, 'dup').kind, 'party');
  assert.equal(actorMight(findPhysicsActor(w, 'dup').actor), 8);
});

test('U695-D absent actor → unknown with conservative defaults (MIGHT 10, Medium)', () => {
  const w = worldWithActors();
  const miss = findPhysicsActor(w, 'ghost');
  assert.equal(miss.kind, 'unknown');
  assert.equal(miss.actor, null);
  assert.equal(actorMight(miss.actor), 10);
  assert.equal(actorSize(w, 'ghost'), 'Medium');
  assert.deepEqual(actorFacts(w, 'ghost'), { might: 10, size: 'Medium' });
});

test('U695-D actorSize: party species size; enemy with no bestiaryRef defaults Medium', () => {
  const w = worldWithActors();
  assert.equal(actorSize(w, 'pc'), 'Small');       // member.dnd.species.size
  assert.equal(actorMight(findPhysicsActor(w, 'pc').actor), 12);
  assert.equal(actorSize(w, 'e1'), 'Medium');      // combat enemy carries no bestiaryRef
});

// ── E. Size canonical at the content source (real Cave Troll spawn) ──────────
test('U695-E the real Cave Troll catalog record is Large (size at the content source)', () => {
  const def = getMonsterDef('cave_troll');
  assert.ok(def, 'cave_troll catalog record exists');
  assert.equal(def.size, 'Large');
  assert.equal(def.stats.MIGHT, 20, 'and its actual catalog MIGHT is 20');
});

test('U695-E a spawned hostile Cave Troll → actorSize reads Large via its existing bestiaryRef', () => {
  const w = base();
  const w2 = spawnEncounter(w, [getMonsterDef('cave_troll')], { ambush: false }, makeRng(4242));
  const npcs = currentNode(w2).settlement.npcs;
  const troll = npcs.find(n => n.bestiaryRef === 'cave_troll');
  assert.ok(troll, 'a hostile with bestiaryRef cave_troll was placed at the node');
  assert.ok(!('size' in troll), 'no size field was stored on the spawned actor');
  assert.equal(actorSize(w2, troll.id), 'Large', 'size resolves back through the catalog at read time');
});

// ── G. In-combat enemies carry bestiaryRef → real size in the fight ──────────
test('U695-G ambush spawn → ensureWorld → combat enemy actorSize is Large (bestiaryRef preserved)', () => {
  const w = base();
  const spawned = spawnEncounter(w, [getMonsterDef('cave_troll')], { ambush: true }, makeRng(7));
  const w2 = ensureWorld(spawned);
  const enemy = w2.combat.enemies[0];
  assert.ok(enemy, 'an ambush enemy exists');
  assert.equal(enemy.bestiaryRef, 'cave_troll', 'ensureCombat preserved the bestiaryRef');
  assert.ok(!('size' in enemy), 'no size field stored on the combat enemy');
  assert.equal(actorSize(w2, enemy.id), 'Large', 'combat foe resolves Large from the catalog');
});

test('U695-G a hostile Cave Troll NPC → begin combat → combat enemy actorSize is Large', () => {
  const npc = { id: 'npc_troll', name: 'Cave Troll', hostile: true, bestiaryRef: 'cave_troll' };
  const enemy = mintEnemyFromNpc(npc);
  assert.equal(enemy.bestiaryRef, 'cave_troll', 'mintEnemyFromNpc carries the NPC bestiaryRef');
  const w2 = beginCombat(base(), { enemies: [enemy], reason: 'test' });
  const e = w2.combat.enemies[0];
  assert.equal(e.bestiaryRef, 'cave_troll', 'bestiaryRef survives beginCombat + ensureCombat');
  assert.equal(actorSize(w2, e.id), 'Large');
});

test('U695-G an old combat enemy WITHOUT bestiaryRef normalizes cleanly and defaults Medium', () => {
  const w = base();
  w.combat = { active: true, enemies: [{ id: 'e_old', name: 'Bandit', hp: 8, maxHp: 8, stats: { MIGHT: 11 } }] };
  const w2 = ensureWorld(w);   // must not throw
  const e = w2.combat.enemies[0];
  assert.ok(!('bestiaryRef' in e), 'no bestiaryRef key is fabricated (byte-identical to before)');
  assert.equal(actorSize(w2, 'e_old'), 'Medium', 'refless enemy defaults Medium honestly');
});

// ── F. Integration take gate — all four outcomes, objectId on remove ─────────
// A real booted protagonist is invariant-valid; we clone its shape onto plain
// newWorlds where objectsHere reads node.furniture and rollPhysicsCheck seeds are
// deterministic (timeline 0). MIGHT alone (size defaults Medium) selects each band.
const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const MEMBER_TEMPLATE = structuredClone(
  beginAdventure(newWorld({ seed: 'u695mem', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world.party[0]
);
function takeWorld({ seed, might, piece }) {
  const w = newWorld({ seed, fate: 0.4, pack: { primaryId: 'fantasy', mixerId: null } });
  const m = structuredClone(MEMBER_TEMPLATE);
  m.id = 'pc';
  m.stats = { ...(m.stats || {}), MIGHT: might };
  w.party = [m];
  currentNode(w).furniture = [piece];
  return w;
}
const removeDelta = (res) => res.deltas.find(d => d.op === 'removeFurniture');

test('U695-F auto — a strong actor takes a light chair; remove delta carries the objectId', () => {
  const piece = { name: 'chair', kind: 'chair', weight: 2, bulk: 2, material: 'wood', objectId: 'pg:tk:0' };
  const w = takeWorld({ seed: 'takeauto', might: 20, piece });
  const res = evaluatePhysicsSync(w, 'take the chair');
  assert.ok(res.deltas.length > 0, `expected a take, got: ${res.description}`);
  assert.equal(removeDelta(res).objectId, 'pg:tk:0', 'removeFurniture carries the resolved objectId');
  assert.equal(removeDelta(res).furnitureId, 0, 'legacy index bridge kept');
  assert.ok(res.deltas.some(d => d.op === 'createItem'), 'item created in inventory');
});

test('U695-F impossible — a very weak actor cannot take a cast-iron cookpot; nothing mutates', () => {
  const piece = { name: 'cooking pot', kind: 'cookpot', weight: 3, bulk: 2, material: 'iron', objectId: 'pg:tk:1' };
  const w = takeWorld({ seed: 'takeno', might: 3, piece });
  const res = evaluatePhysicsSync(w, 'take the cooking pot');
  assert.equal(res.deltas.length, 0, 'no deltas on an impossible take');
  assert.match(res.description, /too heavy to carry/);
});

test('U695-F roll→success — a borderline take that passes the seeded d20 carries it off (with objectId)', () => {
  const piece = { name: 'wooden table', weight: 3, bulk: 4, material: 'wood', objectId: 'pg:tk:2' };
  const w = takeWorld({ seed: 'rollA', might: 10, piece });
  // Confirm it is genuinely the roll band, and the seed yields a pass.
  const cap = actorObjectCapacity(actorFacts(w, 'pc'), objectPhysics(piece), 'carry');
  assert.equal(cap.verdict, 'roll');
  const chk = rollPhysicsCheck(w, { actorId: 'pc', hardness: cap.difficulty, intentText: 'take the table' });
  assert.notEqual(chk.outcome, 'failure', 'seed rollA is a passing roll');
  const res = evaluatePhysicsSync(w, 'take the table');
  assert.ok(res.deltas.length > 0, `passed roll should take it: ${res.description}`);
  assert.equal(removeDelta(res).objectId, 'pg:tk:2');
});

test('U695-F roll→failure — the same borderline take on a failing seed mutates nothing', () => {
  const piece = { name: 'wooden table', weight: 3, bulk: 4, material: 'wood', objectId: 'pg:tk:3' };
  const w = takeWorld({ seed: 'b', might: 10, piece });
  const cap = actorObjectCapacity(actorFacts(w, 'pc'), objectPhysics(piece), 'carry');
  assert.equal(cap.verdict, 'roll');
  const chk = rollPhysicsCheck(w, { actorId: 'pc', hardness: cap.difficulty, intentText: 'take the table' });
  assert.equal(chk.outcome, 'failure', 'seed b is a failing roll');
  const res = evaluatePhysicsSync(w, 'take the table');
  assert.equal(res.deltas.length, 0, 'a failed roll changes nothing');
  assert.match(res.description, /too heavy to carry/);
});
