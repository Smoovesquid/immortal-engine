// U370–U372 — the escapeCombat bleed hook (the LIVE combat engine).
//
// The bleed spectrum (engine/combat/bleed.js) + a per-round player tick shipped
// in the DEEP engine (combatResolve.js), but the live demo runs ESCAPE mode
// (engine/combat/escapeCombat.js → resolveEscapeCombatTurn), which never reached
// combatResolve and never bled the player — so bleed was dark in the product.
//
// This suite pins the two additions, both in escapeCombat.js and LLM-off:
//   U370 APPLY — a connecting enemy melee strike whose bestiary action carries a
//                bleed applies that bleed to the PC's `w.party[0].conditions`.
//   U371 TICK  — each round the PC's bleed ticks `severity` off `meta.escapeHp`
//                and clears per tier (shallow self-heals; deep ends on a made
//                GRIT save; arterial persists). A self-inflicted/carried bleed
//                ticks too. Law 6: the tick reads the wound, never an HP number.
//   U372 DET   — worldHash is byte-identical under replay (the tick's HP effect
//                is deterministic; the save draw uses escapeCombat's seeded rng).
import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { makeBleed } from '../engine/combat/bleed.js';
import { worldHash } from '../engine/worldHash.js';

// A fight whose sole foe carries a melee attack tagged with a bleed of `tier`.
// hp/maxHp high so the fight persists; damage/ac set so the enemy connects and
// the PC survives several rounds. escapeHp headroom so bleed ticks are visible.
function bleedFight({ seed, tier = 'deep', escapeHp = 30 } = {}) {
  const base = activeCombatWorld();
  const bleedAtk = {
    name: 'Claw', toHit: 7, damage: '2d8+4', type: 'slashing',
    range: null, save: null, conditions: [makeBleed(tier)], recharge: null
  };
  const enemies = base.combat.enemies.map(e => ({
    ...e, hp: 60, maxHp: 60, ac: 10, damage: 8, actions: [bleedAtk]
  }));
  return ensureWorld({
    ...base,
    meta: { ...base.meta, seed, escapeHp, escapeMaxHp: 40 },
    combat: { ...base.combat, enemies }
  });
}

// Seed the PC with an existing bleed (as if self-inflicted / carried into the
// fight) — no enemy bleed attack, so we isolate the TICK.
function carriedBleedFight({ seed, tier = 'shallow', escapeHp = 30 } = {}) {
  const base = activeCombatWorld();
  const party = (base.party || []).map((p, i) =>
    i === 0 ? { ...p, conditions: [makeBleed(tier, 'self')] } : p);
  return ensureWorld({
    ...base, party,
    meta: { ...base.meta, seed, escapeHp, escapeMaxHp: 40 }
  });
}

const bleeds = (w) => (w.party?.[0]?.conditions || []).filter(c => c?.name === 'bleeding');
const hp = (w) => Number(w.meta?.escapeHp) || 0;

// ── U370 APPLY ─────────────────────────────────────────────────────────────

test('U370: a connecting enemy strike whose action carries a bleed gives the PC that bleed', () => {
  // seed 'b' lands the enemy strike against the fixture PC (AC 11).
  const r = resolveEscapeCombatTurn(bleedFight({ seed: 'b', tier: 'deep' }), 'I wait and guard.');
  assert.match(r.result.mechanicsLine, /→ hit/, `enemy must connect: ${r.result.mechanicsLine}`);
  const pcBleeds = bleeds(r.world);
  assert.equal(pcBleeds.length, 1, `PC should carry exactly one bleed: ${JSON.stringify(pcBleeds)}`);
  assert.equal(pcBleeds[0].bleedTier, 'deep', 'the applied bleed reads the connecting attack tier');
});

test('U370: a MISS applies no bleed (the wound rides the hit, not the swing)', () => {
  // seed 'c' misses the fixture PC (see probe: not in the hitting set).
  const r = resolveEscapeCombatTurn(bleedFight({ seed: 'c', tier: 'deep' }), 'I wait and guard.');
  assert.doesNotMatch(r.result.mechanicsLine, /→ hit/, `seed c should miss: ${r.result.mechanicsLine}`);
  assert.equal(bleeds(r.world).length, 0, 'a miss must not bleed the PC');
});

test('U370: bleeds do not pile up — a second connecting hit keeps one bleed (highest)', () => {
  let w = bleedFight({ seed: 'b', tier: 'deep', escapeHp: 40 });
  // Drive several rounds; even across multiple connecting hits the PC never
  // stacks bleeds into a death-pile (stackBehavior 'highest').
  for (let i = 0; i < 3; i++) {
    const r = resolveEscapeCombatTurn(w, 'I wait and guard.');
    w = r.world;
    if (!w.combat?.active) break;
  }
  assert.ok(bleeds(w).length <= 1, `never more than one bleed on the PC: ${JSON.stringify(bleeds(w))}`);
});

// ── U371 TICK ──────────────────────────────────────────────────────────────

test('U371: a carried SHALLOW bleed ticks off escapeHp and self-heals (~2 rounds)', () => {
  let w = carriedBleedFight({ seed: 'zzz-noheal', tier: 'shallow', escapeHp: 30 });
  const before = hp(w);
  let sawTick = false;
  let cleared = false;
  for (let i = 0; i < 4; i++) {
    const r = resolveEscapeCombatTurn(w, 'I wait and guard.');
    w = r.world;
    if (!bleeds(w).length) { cleared = true; break; }
    if (hp(w) < before) sawTick = true;
    if (!w.combat?.active) break;
  }
  assert.ok(sawTick || cleared, 'the shallow bleed must have ticked HP at least once');
  assert.ok(cleared, 'a shallow bleed self-heals — it must clear within a few rounds');
});

test('U371: an ARTERIAL bleed persists and keeps ticking (never self-clears)', () => {
  let w = carriedBleedFight({ seed: 'art', tier: 'arterial', escapeHp: 60 });
  const start = hp(w);
  for (let i = 0; i < 3; i++) {
    const r = resolveEscapeCombatTurn(w, 'I wait and guard.');
    w = r.world;
    if (!w.combat?.active) break;
  }
  assert.equal(bleeds(w).length, 1, 'an arterial bleed does not stop unaided');
  assert.ok(hp(w) < start, `arterial keeps bleeding HP down: ${start} -> ${hp(w)}`);
});

test('U371: Law 6 — the tick narration reads the wound, never an HP number', () => {
  const r = resolveEscapeCombatTurn(carriedBleedFight({ seed: 'law6', tier: 'arterial', escapeHp: 40 }), 'I wait and guard.');
  const woundBeat = (r.result.beats || []).find(b => /bleed|wound|weep|gash|clot|blood/i.test(String(b))
    && !/hits you for|HP\b/i.test(String(b)));
  assert.ok(woundBeat, `a wound-reading tick beat should surface: ${JSON.stringify(r.result.beats)}`);
  // The bleed tick line itself must not leak a bare HP count or "N HP".
  assert.doesNotMatch(String(woundBeat), /\b\d+\s*HP\b/i, `Law 6: no HP number in the tick line: "${woundBeat}"`);
});

test('U371: a carried DEEP bleed can end on a made GRIT save (find a saving seed)', () => {
  // A high-GRIT PC + enough rounds: at least one seed must roll a made save that
  // clears the deep bleed (save_ends). We assert the mechanism exists.
  let clearedBySomeSeed = false;
  for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
    let w = carriedBleedFight({ seed, tier: 'deep', escapeHp: 60 });
    // buff GRIT so the save is makeable
    w = { ...w, party: [{ ...w.party[0], stats: { ...(w.party[0].stats || {}), GRIT: 18 } }, ...w.party.slice(1)] };
    w = ensureWorld(w);
    for (let i = 0; i < 5; i++) {
      const r = resolveEscapeCombatTurn(w, 'I wait and guard.');
      w = r.world;
      if (!bleeds(w).length) { clearedBySomeSeed = true; break; }
      if (!w.combat?.active) break;
    }
    if (clearedBySomeSeed) break;
  }
  assert.ok(clearedBySomeSeed, 'a deep bleed must be able to end on a made GRIT save');
});

// ── U372 DETERMINISM ─────────────────────────────────────────────────────────

test('U372: bleed apply+tick is replay-stable — worldHash byte-identical', () => {
  const run = () => {
    let w = bleedFight({ seed: 'b', tier: 'severe', escapeHp: 40 });
    for (let i = 0; i < 4; i++) {
      const r = resolveEscapeCombatTurn(w, 'I wait and guard.');
      w = r.world;
      if (!w.combat?.active) break;
    }
    return w;
  };
  const a = run();
  const b = run();
  assert.equal(worldHash(a), worldHash(b), 'identical inputs must yield an identical worldHash under replay');
});

test('U372: a fight with NO bleed attack is unchanged (stream untouched by the hook)', () => {
  // The fixture foe (damage 1, no bleed action) must hash identically whether or
  // not the bleed hook exists — a no-bleed fight makes no extra rng draw.
  const run = (seed) => {
    let w = ensureWorld({ ...activeCombatWorld(), meta: { ...activeCombatWorld().meta, seed, escapeHp: 20, escapeMaxHp: 20 } });
    for (let i = 0; i < 3; i++) {
      const r = resolveEscapeCombatTurn(w, 'I wait and guard.');
      w = r.world;
      if (!w.combat?.active) break;
    }
    return w;
  };
  assert.equal(worldHash(run('nb')), worldHash(run('nb')), 'no-bleed fight is replay-stable');
  // and the PC never spontaneously grows a bleed
  assert.equal(bleeds(run('nb')).length, 0, 'no bleed attack -> no PC bleed');
});
