// U628 — ENSURE-STATS-1: the ensureCombat WHITELIST TRAP amputates an enemy's
// stats + level (docs/PACKETS.md; diagnosed in docs/briefs/DEATH-1-audit.md §
// "The ensureCombat WHITELIST TRAP").
//
// THE BUG (proved RED first, then GREEN after the fix):
//   `mintEnemyFromNpc` (engine/combat/combatLifecycle.js:88) emits `stats`
//   (an object of ability scores) and `level` (a finite number) on the minted
//   enemy. But `ensureCombat` (engine/state.js) rebuilds every enemy from a
//   FIXED field literal — and `stats`/`level` were absent from it. So the
//   moment the world is re-normalized (which happens on EVERY ensureWorld call
//   — i.e. inside beginCombat's applyDeltas, between turns, and on save/load),
//   both fields are silently dropped. The enemy then fights with its identity
//   amputated: downstream reads see defaults instead —
//     • engine/combat/savingThrows.js:28,33 — enemy saving throws read
//       `e.stats?.[stat]` (→ 10 = all-average) and `profBonusFor(e.level)`
//       (→ level 1). A tough foe saves like a mook.
//     • engine/combat/deathFact.js:64 — the DEATH-1 `canCommunicate` gate reads
//       `e.stats?.WITS ?? e.stats?.INT`. Stripped stats break the DOWNED/mercy
//       capability derivation.
//   Same trap class as DX-2d-i (traits): a NEW combat-enemy field must join the
//   ensureCombat whitelist or it evaporates on the next ensureWorld.
//
// THE FIX: add `stats` (object of clamped ability scores) and `level` (finite,
// clamped 1..20) to the ensureCombat normalization AND its enemy literal, and
// shape-assert them in invariants.js's enemy loop. Combat-scoped, no
// WORLD_VERSION bump (the fields already exist at mint time — we are only
// stopping their DELETION between turns; absent → safe default so a boot world
// with no combat enemies is byte-identical → boot worldHash unmoved).
//
// LLM-off (deterministic path only). Fixture mints from an explicit
// combatProfile so stats/level are non-trivial and independent of any bestiary
// record — the trap is isolated to the whitelist, not a catalog quirk.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { mintEnemyFromNpc, beginCombat } from '../engine/combat/combatLifecycle.js';
import { worldHash } from '../engine/worldHash.js';

// A hostile NPC with an explicit combat profile carrying non-average stats and
// a level > 1, so a strip is unmistakable (stripped → stats:{} / level:1).
const BRIGAND_NPC = {
  id: 'npc_brigand',
  name: 'Brigand',
  hostile: true,
  combatProfile: {
    maxHp: 14,
    damage: 4,
    stats: { MIGHT: 15, AGILITY: 12, WITS: 8, GRIT: 13, CHARM: 9 },
    level: 4,
    saveProficiencies: ['MIGHT']
  }
};

function bootWorld() {
  return ensureWorld(newWorld({
    seed: 'ensure-stats-1',
    fate: 0.3,
    mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }));
}

// A world with the brigand minted into an ACTIVE fight. beginCombat routes the
// enemy through applyDeltas → ensureWorld → ensureCombat, so the enemy here has
// already survived (or failed) the whitelist once.
function worldInCombat() {
  const enemy = mintEnemyFromNpc(BRIGAND_NPC);
  return beginCombat(bootWorld(), { enemies: [enemy], reason: 'test-ambush' });
}

// ── the mint is honest: it DOES emit stats + level (so the strip below is a
//    normalization loss, not a mint gap) ──────────────────────────────────────

test('U628-mint: mintEnemyFromNpc emits stats + level from the combat profile', () => {
  const e = mintEnemyFromNpc(BRIGAND_NPC);
  assert.deepEqual(e.stats, { MIGHT: 15, AGILITY: 12, WITS: 8, GRIT: 13, CHARM: 9 }, 'mint must carry stats');
  assert.equal(e.level, 4, 'mint must carry level');
});

// ── the core trap: stats + level survive beginCombat's normalization ──────────
//    (RED on HEAD — ensureCombat drops them the instant the enemy enters combat) ─

test('U628-begin: an enemy retains stats + level after beginCombat (whitelist trap)', () => {
  const w = worldInCombat();
  const e = w.combat.enemies[0];
  assert.ok(e, 'precondition: the enemy is in combat');
  assert.equal(e.name, 'Brigand', 'precondition: it is our brigand');
  assert.deepEqual(e.stats, { MIGHT: 15, AGILITY: 12, WITS: 8, GRIT: 13, CHARM: 9 },
    'stats were stripped by ensureCombat inside beginCombat');
  assert.equal(e.level, 4, 'level was stripped by ensureCombat inside beginCombat');
});

// ── the between-turns trap: a SECOND ensureWorld (the per-turn re-normalize)
//    must not amputate what beginCombat preserved ──────────────────────────────

test('U628-ensure: stats + level survive a second ensureWorld (between turns)', () => {
  const w = ensureWorld(worldInCombat());
  const e = w.combat.enemies[0];
  assert.deepEqual(e.stats, { MIGHT: 15, AGILITY: 12, WITS: 8, GRIT: 13, CHARM: 9 },
    'stats stripped on the between-turns ensureWorld');
  assert.equal(e.level, 4, 'level stripped on the between-turns ensureWorld');
});

// ── downstream is real: with stats preserved, the enemy is not a level-1
//    all-average mook. Reads mirror savingThrows.js's own field access. ─────────

test('U628-downstream: preserved stats + level feed the enemy save path (not defaults)', () => {
  const e = worldInCombat().combat.enemies[0];
  // savingThrows.js:28 reads e.stats?.[stat]; :33 reads e.level for prof bonus.
  const might = e.stats?.MIGHT ?? 10;
  const lvl = e.level ?? 1;
  assert.equal(might, 15, 'a stripped enemy would read MIGHT as 10 (average) — the save is wrong');
  assert.equal(lvl, 4, 'a stripped enemy would read level 1 — the proficiency bonus is wrong');
  assert.ok(Array.isArray(e.saveProficiencies) && e.saveProficiencies.includes('MIGHT'),
    'the save proficiency (already whitelisted) must survive alongside stats');
});

// ── determinism: preserving fields that existed at mint time (same turn) must
//    NOT move any hash. Boot world (no combat enemies) stays byte-identical, and
//    a fought world replays identically. ──────────────────────────────────────

test('U628-det: the boot worldHash is byte-identical (no combat enemies → no field)', () => {
  const a = worldHash(bootWorld());
  const b = worldHash(bootWorld());
  assert.equal(a, b, 'boot world is not reproducible');
});

test('U628-det: a fought world replays to an identical worldHash', () => {
  const h1 = worldHash(worldInCombat());
  const h2 = worldHash(worldInCombat());
  assert.equal(h1, h2, 'the same seeded fight must produce an identical worldHash');
});
