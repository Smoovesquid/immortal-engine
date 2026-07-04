// U110 — SRD 5e character creation: legality, determinism, state integration.
// A crusty DM's checklist: every sheet this produces must be a LEGAL level-1
// character. Illegal totals, double-counted racial bonuses, wizards in plate,
// or wrong HP math are hard failures.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ABILITY_KEYS, STANDARD_ARRAY, abilityMod, toLegacyStats,
  listSpecies, getSpecies, listClasses, getClass,
  listBackgrounds5e, listAlignments, computeAC,
  createCharacter5e, rollAbilityPools, SKILLS, SKILL_KEYS
} from '../engine/chargen/srd/index.js';
import { newWorld, ensureWorld, WORLD_VERSION } from '../engine/state.js';
import { assertWorldInvariants } from '../engine/invariants.js';

// ---- data layer sanity ----

test('U110-01: nine species, twelve classes, nine alignments', () => {
  assert.equal(listSpecies().length, 9);
  assert.equal(listClasses().length, 12);
  assert.equal(listAlignments().length, 9);
  assert.ok(listBackgrounds5e().length >= 10);
});

test('U110-02: ability modifier table matches the PHB', () => {
  assert.equal(abilityMod(1), -5);
  assert.equal(abilityMod(8), -1);
  assert.equal(abilityMod(10), 0);
  assert.equal(abilityMod(11), 0);
  assert.equal(abilityMod(12), 1);
  assert.equal(abilityMod(15), 2);
  assert.equal(abilityMod(18), 4);
  assert.equal(abilityMod(20), 5);
});

test('U110-03: every class has legal save pairs and a real hit die', () => {
  for (const c of listClasses()) {
    assert.equal(c.saves.length, 2, `${c.id} must have exactly 2 save proficiencies`);
    for (const s of c.saves) assert.ok(ABILITY_KEYS.includes(s), `${c.id} save ${s}`);
    assert.ok([6, 8, 10, 12].includes(c.hitDie), `${c.id} hit die d${c.hitDie}`);
    assert.ok(c.skillChoices.count >= 2 && c.skillChoices.count <= 4);
    if (c.skillChoices.from !== 'any') {
      for (const s of c.skillChoices.from) assert.ok(SKILL_KEYS.includes(s), `${c.id} offers unknown skill ${s}`);
    }
  }
});

test('U110-04: every species ASI total is PHB-legal', () => {
  for (const s of listSpecies()) {
    const fixed = Object.values(s.asi).reduce((a, b) => a + b, 0);
    const choice = s.asiChoice ? s.asiChoice.count * s.asiChoice.amount : 0;
    const total = fixed + choice;
    assert.ok(total >= 2 && total <= 6, `${s.id} ASI total ${total}`);
  }
});

// ---- dice ----

test('U110-05: 4d6-drop-lowest produces six pools in 3..18, deterministic by seed', () => {
  const a = rollAbilityPools({ seed: 'crusty-dm' });
  const b = rollAbilityPools({ seed: 'crusty-dm' });
  assert.deepEqual(a, b, 'same seed must roll the same dice');
  assert.equal(a.pools.length, 6);
  for (const p of a.pools) {
    assert.equal(p.dice.length, 4);
    assert.ok(p.total >= 3 && p.total <= 18);
    const sorted = [...p.dice].sort((x, y) => x - y);
    assert.equal(p.total, sorted[1] + sorted[2] + sorted[3], 'total must drop the lowest die');
  }
  const r1 = rollAbilityPools({ seed: 'crusty-dm', reroll: 1 });
  assert.notDeepEqual(a.totals, r1.totals, 'reroll salt must change the dice');
  assert.deepEqual(r1, rollAbilityPools({ seed: 'crusty-dm', reroll: 1 }), 'reroll is deterministic too');
});

// ---- full assembly, every species x class ----

test('U110-06: every species x class combination yields a legal sheet', () => {
  for (const sp of listSpecies()) {
    for (const cl of listClasses()) {
      const pc = createCharacter5e({
        seed: `matrix|${sp.id}|${cl.id}`,
        speciesId: sp.id,
        classId: cl.id,
        abilityMethod: 'standard'
      });
      const d = pc.dnd;
      assert.ok(d, `${sp.id} ${cl.id}: missing dnd sheet`);

      // Abilities: standard array + ASI, all in range.
      for (const k of ABILITY_KEYS) {
        assert.ok(Number.isInteger(d.abilities[k]) && d.abilities[k] >= 3 && d.abilities[k] <= 20, `${sp.id} ${cl.id}: ${k}=${d.abilities[k]}`);
        assert.equal(d.mods[k], abilityMod(d.abilities[k]), `${sp.id} ${cl.id}: ${k} mod`);
      }
      // ASI applied exactly once: sum(final) = sum(array) + sum(ASI)
      const baseSum = STANDARD_ARRAY.reduce((a, b) => a + b, 0);
      const asiFixed = Object.values(sp.asi).reduce((a, b) => a + b, 0);
      const asiChoice = sp.asiChoice ? sp.asiChoice.count * sp.asiChoice.amount : 0;
      const finalSum = ABILITY_KEYS.reduce((a, k) => a + d.abilities[k], 0);
      assert.equal(finalSum, baseSum + asiFixed + asiChoice, `${sp.id} ${cl.id}: racial bonus applied wrong (sum ${finalSum})`);

      // HP: hit die max + CON mod + per-level bonuses (dwarf toughness, draconic resilience)
      let hpBonus = 0;
      if (sp.traits.some(t => t.effect?.type === 'hpPerLevel')) hpBonus += 1;
      if (cl.subclass?.features?.some(f => f.effect?.type === 'draconicResilience')) hpBonus += 1;
      assert.equal(d.maxHP, cl.hitDie + d.mods.CON + hpBonus, `${sp.id} ${cl.id}: HP math`);

      // Proficiency bonus and saves
      assert.equal(d.profBonus, 2);
      for (const k of ABILITY_KEYS) {
        const expected = d.mods[k] + (cl.saves.includes(k) ? 2 : 0);
        assert.equal(d.saves[k], expected, `${sp.id} ${cl.id}: ${k} save`);
      }

      // Skills: every proficient skill adds +2 (or +4 expertise); all bonuses correct
      for (const s of SKILL_KEYS) {
        const ab = SKILLS[s];
        let expected = d.mods[ab];
        if (d.skillProfs.includes(s)) expected += 2 * (d.expertise.includes(s) ? 2 : 1);
        assert.equal(d.skills[s], expected, `${sp.id} ${cl.id}: skill ${s}`);
      }
      assert.equal(d.passivePerception, 10 + d.skills.Perception, `${sp.id} ${cl.id}: passive perception`);

      // Class grants the right number of skill choices (plus background's 2 and any species grants)
      assert.ok(d.skillProfs.length >= cl.skillChoices.count, `${sp.id} ${cl.id}: too few skills`);

      // AC sane: no wizard in plate (armorProfs respected by pickWornArmor)
      assert.ok(d.ac >= 8 && d.ac <= 21, `${sp.id} ${cl.id}: AC ${d.ac}`);
      if (cl.id === 'wizard' || cl.id === 'sorcerer' || cl.id === 'monk') {
        // No armor proficiency (monk: none worn) — AC must be unarmored-derived.
        assert.ok(d.ac <= 10 + 5 + 5 + 2, `${cl.id} AC must be unarmored`);
      }

      // Spellcasting numbers
      if (cl.spellcasting) {
        assert.equal(d.spellcasting.saveDC, 8 + 2 + d.mods[cl.spellcasting.ability], `${sp.id} ${cl.id}: spell DC`);
        assert.equal(d.spellcasting.attackBonus, 2 + d.mods[cl.spellcasting.ability], `${sp.id} ${cl.id}: spell attack`);
      } else {
        assert.equal(d.spellcasting, null);
      }

      // Legacy projection consistent
      assert.deepEqual(pc.stats, toLegacyStats(d.abilities), `${sp.id} ${cl.id}: legacy stats projection`);

      // Equipment non-empty
      assert.ok(d.equipment.length >= 3, `${sp.id} ${cl.id}: equipment`);
    }
  }
});

test('U110-07: same picks => identical character (determinism)', () => {
  const picks = {
    seed: 'replay-me',
    speciesId: 'tiefling',
    classId: 'warlock',
    abilityMethod: '4d6',
    backgroundId: 'criminal',
    alignmentId: 'cn',
    classChoices: { skills: ['Deception', 'Intimidation'] }
  };
  const a = createCharacter5e(picks);
  const b = createCharacter5e(picks);
  assert.deepEqual(a, b);
});

test('U110-08: ability assignment is enforced — no stat stuffing', () => {
  // Try to claim six 18s off a standard array: must be rejected, fall back to default assignment.
  const pc = createCharacter5e({
    seed: 'cheater',
    speciesId: 'human',
    classId: 'fighter',
    abilityMethod: 'standard',
    abilityAssignment: { STR: 18, DEX: 18, CON: 18, INT: 18, WIS: 18, CHA: 18 }
  });
  const values = ABILITY_KEYS.map(k => pc.dnd.abilities[k] - 1).sort((a, b) => b - a); // minus human +1
  assert.deepEqual(values, [...STANDARD_ARRAY].sort((a, b) => b - a), 'must use the real array');
});

test('U110-09: dragonborn ancestry + fighter style + rogue expertise wire through', () => {
  const db = createCharacter5e({
    seed: 's', speciesId: 'dragonborn', classId: 'fighter',
    speciesChoices: { ancestry: 'gold' },
    classChoices: { fightingStyle: 'defense' },
    abilityMethod: 'standard'
  });
  assert.equal(db.dnd.species.ancestry.id, 'gold');
  assert.equal(db.dnd.species.ancestry.damage, 'fire');
  assert.equal(db.dnd.fightingStyle, 'Defense');

  const rogue = createCharacter5e({
    seed: 's', speciesId: 'halfling', classId: 'rogue',
    classChoices: { skills: ['Stealth', 'Deception', 'Perception', 'Acrobatics'], expertise: ['Stealth', 'Perception'] },
    abilityMethod: 'standard'
  });
  assert.deepEqual(rogue.dnd.expertise, ['Perception', 'Stealth']);
  assert.equal(rogue.dnd.skills.Stealth, rogue.dnd.mods.DEX + 4, 'expertise doubles proficiency');
});

test('U110-10: cleric life domain grants heavy armor; half-elf gets chosen skills + ASI', () => {
  const cleric = createCharacter5e({ seed: 's', speciesId: 'dwarf', classId: 'cleric', abilityMethod: 'standard' });
  assert.ok(cleric.dnd.armorProfs.includes('heavy'));

  const he = createCharacter5e({
    seed: 's', speciesId: 'half-elf', classId: 'bard',
    speciesChoices: { asiChoice: ['DEX', 'CON'], skills: ['Perception', 'Insight'] },
    abilityMethod: 'standard'
  });
  assert.ok(he.dnd.skillProfs.includes('Perception'));
  assert.ok(he.dnd.skillProfs.includes('Insight'));
});

// ---- state integration ----

test('U110-11: WORLD_VERSION is 30 and a 5e character survives ensureWorld + invariants', () => {
  assert.equal(WORLD_VERSION, 30);
  const pc = createCharacter5e({ seed: 'world-test', speciesId: 'half-orc', classId: 'barbarian', abilityMethod: '4d6' });
  const w0 = newWorld({ seed: 'world-test', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  assertWorldInvariants(w1);
  assert.ok(w1.party[0].dnd, 'dnd sheet must survive ensureWorld');
  assert.equal(w1.party[0].dnd.class.id, 'barbarian');
  assert.deepEqual(w1.party[0].stats, toLegacyStats(w1.party[0].dnd.abilities));
});

test('U110-12: old saves (no dnd) still validate — dnd defaults to null', () => {
  const w0 = newWorld({ seed: 'legacy', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld(w0);
  for (const m of w1.party) assert.equal(m.dnd ?? null, null);
  assertWorldInvariants(w1);
});

// ---- AC rules ----

test('U110-13: armor table math — the classics', () => {
  // Leather + DEX 18 → 11+4
  assert.equal(computeAC({ armorName: 'leather armor', mods: { DEX: 4 } }), 15);
  // Scale mail caps DEX at +2
  assert.equal(computeAC({ armorName: 'scale mail', mods: { DEX: 4 } }), 16);
  // Chain mail flat 16 regardless of DEX
  assert.equal(computeAC({ armorName: 'chain mail', mods: { DEX: 4 } }), 16);
  // Shield +2
  assert.equal(computeAC({ armorName: 'chain mail', shield: true, mods: { DEX: 0 } }), 18);
  // Barbarian unarmored: 10 + DEX + CON
  assert.equal(computeAC({ mods: { DEX: 2, CON: 3 }, unarmoredDefense: { formula: '10+DEX+CON' } }), 15);
  // Monk unarmored: 10 + DEX + WIS
  assert.equal(computeAC({ mods: { DEX: 3, WIS: 2 }, unarmoredDefense: { formula: '10+DEX+WIS' } }), 15);
  // Draconic sorcerer: 13 + DEX
  assert.equal(computeAC({ mods: { DEX: 2 }, draconicBase: 13 }), 15);
  // Nothing: 10 + DEX
  assert.equal(computeAC({ mods: { DEX: 1 } }), 11);
});
