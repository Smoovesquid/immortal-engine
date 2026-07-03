// U373 — CMB-LEGAL-1: escape-cast legality (the LIVE combat engine).
//
// The live demo runs ESCAPE mode (engine/combat/escapeCombat.js →
// resolveEscapeCombatTurn), where the deep castSpell legality gate is parked and
// the escapee is a fixed level-1 hedge-caster: a blade + two cantrips (fire bolt,
// ward). Its parseEscapeAction cantrip catch-all fired on the bare tokens
// bolt|blast|cast, so an explicit "cast <spell the hedge-caster does NOT have>"
// (lightning bolt / counterspell / chromatic orb / polymorph / wish) fell through
// to a FREE Fire Bolt instead of an honest decline — a silent competence leak and
// a DM-Test smell ("I cast polymorph" → "your fire bolt sputters wide").
//
// This suite pins the fix, all LLM-off through the real resolver:
//   • an explicit cast of an unavailable leveled/utility spell DECLINES
//     ("that spell is not yours") and NEVER leaks a Fire Bolt cantrip;
//   • the owned cantrips (fire bolt, ward) and the "cast" verb still resolve;
//   • the enumerated spell declines (fireball/magic missile/bless) are unchanged;
//   • a non-magical "cast ..." idiom is NOT falsely declined;
//   • the decline turn is deterministic under replay (worldHash byte-identical).
import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { activeCombatWorld } from '../scripts/convergence/fixtures.mjs';
import { resolveEscapeCombatTurn } from '../engine/combat/escapeCombat.js';
import { worldHash } from '../engine/worldHash.js';

// A seeded escape-combat world (hedge-caster PC: fire bolt + ward, no slots).
function combat(seed = 'legal') {
  const base = activeCombatWorld();
  return ensureWorld({ ...base, meta: { ...base.meta, seed } });
}
const res = (text, seed) => resolveEscapeCombatTurn(combat(seed), text).result;
const declined = (r) => /that spell is not yours/i.test(r.combatSummary || '');
const leakedFireBolt = (r) => /cantrip:Fire Bolt/i.test(r.mechanicsLine || '');

// ── the closed leaks ─────────────────────────────────────────────────────────

// Every one of these produced [cantrip:Fire Bolt | ...] before CMB-LEGAL-1.
const UNOWNED = [
  'cast lightning bolt at the enemy',
  'cast counterspell',
  'cast chromatic orb at it',
  'cast polymorph on the bandit',
  'cast wish',
  'cast time stop',
  'cast power word kill',
];

for (const text of UNOWNED) {
  test(`U373: "${text}" declines — no free Fire Bolt`, () => {
    const r = res(text);
    assert.ok(!leakedFireBolt(r), `must NOT grant a Fire Bolt cantrip: ${r.mechanicsLine}`);
    assert.ok(declined(r), `must decline in the fiction: ${r.combatSummary}`);
  });
}

// ── owned cantrips + the generic "cast" still resolve ────────────────────────

test('U373: the hedge-caster\'s owned cantrips still fire', () => {
  const fb = res('fire bolt');
  assert.match(fb.mechanicsLine, /cantrip:Fire Bolt/, `"fire bolt" resolves: ${fb.mechanicsLine}`);
  assert.ok(!declined(fb), 'an owned cantrip is never a "not yours" decline');

  const castFb = res('cast fire bolt');
  assert.match(castFb.mechanicsLine, /cantrip:Fire Bolt/, `"cast fire bolt" resolves: ${castFb.mechanicsLine}`);

  const ward = res('ward');
  assert.match(ward.mechanicsLine, /\[ward/, `"ward" resolves: ${ward.mechanicsLine}`);
  assert.ok(!declined(ward), 'ward is not a spell decline');
});

// ── enumerated declines are unchanged (they route to their own resolvers) ────

test('U373: enumerated spell declines still do not leak a cantrip', () => {
  // These route to their OWN resolvers with varied thematic declines ("no god is
  // listening", "get smoke", …), so we assert the invariant, not the wording: no
  // Fire Bolt leak, and a no-effect wasted turn (neutral round tag, no attack).
  for (const text of ['cast fireball at the bandit', 'cast magic missile', 'cast bless']) {
    const r = res(text);
    assert.ok(!leakedFireBolt(r), `${text} must not leak a Fire Bolt: ${r.mechanicsLine}`);
    assert.match(r.mechanicsLine, /\[combat:r\d+\]/, `${text} advances the round with no effect: ${r.mechanicsLine}`);
    assert.doesNotMatch(r.mechanicsLine, /cantrip:|strike:|\[ward/, `${text} lands no spell/attack effect: ${r.mechanicsLine}`);
  }
});

// ── the guard is gated on a spell NAME, not the bare word "cast" ─────────────

test('U373: a non-magical "cast ..." idiom is not falsely declined', () => {
  // "cast about for another exit" is looking around, not a spell — it must not
  // trip the "that spell is not yours" decline (a false-decline would itself be
  // a DM-Test bug). It keeps its prior fall-through behavior.
  const r = res('cast about for another exit');
  assert.ok(!declined(r), `must not falsely decline an idiom: ${r.combatSummary}`);
});

// ── determinism ──────────────────────────────────────────────────────────────

test('U373: a decline turn is deterministic under replay', () => {
  const a = resolveEscapeCombatTurn(combat('det'), 'cast polymorph on the bandit');
  const b = resolveEscapeCombatTurn(combat('det'), 'cast polymorph on the bandit');
  assert.equal(worldHash(a.world), worldHash(b.world), 'same seed + input → identical worldHash');
});
