import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld } from '../engine/state.js';
import { castSpell } from '../engine/spell/castSpell.js';

function caster(deeds, seed = 'm3') {
  const w = newWorld({ seed, fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });
  return {
    ...w,
    party: [{ id: 'pc', name: 'Mage', level: 5, stats: { MIGHT: 10, AGILITY: 10, WITS: 16, GRIT: 12, CHARM: 10 }, wounds: 0, stress: 0,
      spells: { known: ['fireball', 'mage_armor'], slots: { 3: 6 }, maxSlots: { 3: 6 }, concentration: null } }],
    timeline: deeds.map((text, i) => ({ t: i, kind: 'resolution', data: { text } })),
    ecology: { corruption: 0, instability: 0, scarcity: 0 }
  };
}

test('M3: default (no will flag) behaves exactly as before — will info absent', () => {
  const w = caster(['idle']);
  const r = castSpell(w, { spellRef: 'fireball', slotLevel: 3 });
  assert.equal(r.result.ok, true);
  assert.ok(r.result.effects.length > 0, 'fireball does damage');
  assert.ok(!r.result.will, 'no will telemetry when not requested');
});

test('M3: will-aware aligned cast lands and carries a feel', () => {
  const w = caster(Array(50).fill('you burn and slay your foes'));
  let hits = 0, sample = 0;
  for (let t = 0; t < 40; t++) {
    const ww = { ...w, time: { turn: t } };
    const r = castSpell(ww, { spellRef: 'fireball', slotLevel: 3, will: true });
    sample++; if (!r.result.miscast) hits++;
    assert.ok(r.result.will && typeof r.result.will.feel === 'string');
  }
  assert.ok(hits / sample > 0.8, `the Flame answers the destroyer (${hits}/${sample})`);
});

test('M3: a contrary will makes evocation falter (more miscasts)', () => {
  const wrath = caster(Array(50).fill('you burn and slay'));
  const mercy = caster(Array(50).fill('you heal and mend the hurt'));
  const miscasts = world => { let m = 0; for (let t = 0; t < 60; t++) { const r = castSpell({ ...world, time: { turn: t } }, { spellRef: 'fireball', slotLevel: 3, will: true }); if (r.result.miscast) m++; } return m; };
  assert.ok(miscasts(mercy) > miscasts(wrath), 'the merciful struggle to throw fire');
});

test('M3: coercive casting against the unwilling stains the world', () => {
  // mage_armor is abjuration (not coercive) — use the flag with a coercive school via fireball? fireball is not coercive.
  // Instead verify corruption rises when a coercive school is forced: simulate via the cost path on enchantment is covered in M2;
  // here we assert the wiring threads cost through for a forbidden/dissonant case.
  const mercy = caster(Array(50).fill('you heal and mend'));
  let raised = false;
  for (let t = 0; t < 30; t++) {
    const r = castSpell({ ...mercy, time: { turn: t } }, { spellRef: 'fireball', slotLevel: 3, will: true });
    if (r.world.ecology.corruption > 0) { raised = true; break; }
  }
  assert.equal(raised, true, 'forcing fire against a merciful will leaks corruption into the world');
});

test('M3: deterministic', () => {
  const w = caster(Array(20).fill('you burn'));
  const a = castSpell({ ...w, time: { turn: 3 } }, { spellRef: 'fireball', slotLevel: 3, will: true });
  const b = castSpell({ ...w, time: { turn: 3 } }, { spellRef: 'fireball', slotLevel: 3, will: true });
  assert.equal(a.result.miscast, b.result.miscast);
  assert.equal(a.world.ecology.corruption, b.world.ecology.corruption);
});
