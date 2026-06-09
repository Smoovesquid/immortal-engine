// U111 — the 5e sheet drives escape combat: real HP/AC, the class's actual
// weapon, the class's own cantrip. Legacy (sheet-less) characters keep the
// original hedge-caster math bit-for-bit.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacter5e } from '../engine/chargen/srd/index.js';
import {
  playerMaxHp, playerAc, meleeProfile, cantripProfile,
  initEscapeKit, initEscapeHp, escapeKitView, parseEscapeAction, ESCAPE_KIT
} from '../engine/combat/escapeCombat.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { SPELL_REGISTRY } from '../engine/ruleset/core/spells/index.js';

function mkWorld(pc) {
  const w0 = newWorld({ seed: 'u111', campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  return ensureWorld({ ...w0, party: [pc] });
}

function pc5e(speciesId, classId, extra = {}) {
  return createCharacter5e({ seed: `u111|${speciesId}|${classId}`, speciesId, classId, abilityMethod: 'standard', ...extra });
}

test('U111-01: sheet HP and AC drive escape combat', () => {
  const wiz = pc5e('human', 'wizard');
  assert.equal(playerMaxHp(wiz), wiz.dnd.maxHP);
  assert.equal(playerAc(wiz), wiz.dnd.ac);

  const w = initEscapeHp(mkWorld(wiz));
  assert.equal(w.meta.escapeHp, wiz.dnd.maxHP, 'play-surface HP equals the sheet');
  assert.equal(w.meta.escapeMaxHp, wiz.dnd.maxHP);
});

test('U111-02: legacy characters keep the hedge-caster math', () => {
  const legacy = { stats: { MIGHT: 12, AGILITY: 14, WITS: 10, GRIT: 14, CHARM: 8 } };
  assert.equal(playerMaxHp(legacy), 14 + 2); // base 14 + GRIT mod
  assert.equal(playerAc(legacy), 12 + 2);    // base 12 + AGILITY mod
  assert.equal(meleeProfile(legacy).name, 'Worn Blade');
  assert.equal(cantripProfile(legacy).ref, 'fire_bolt');
});

test('U111-03: the class weapon is the combat weapon', () => {
  const barb = pc5e('half-orc', 'barbarian');
  const m = meleeProfile(barb);
  assert.equal(m.name, 'Greataxe');
  assert.equal(m.die, 12);
  assert.equal(m.atkBonus, barb.dnd.profBonus + barb.dnd.mods.STR);
  assert.equal(m.dmgMod, barb.dnd.mods.STR);

  // Finesse: rogue with a rapier attacks with DEX when DEX > STR.
  const rogue = pc5e('halfling', 'rogue');
  const r = meleeProfile(rogue);
  assert.equal(r.name, 'Rapier');
  assert.equal(r.dmgMod, Math.max(rogue.dnd.mods.STR, rogue.dnd.mods.DEX));
});

test('U111-04: every caster class gets its own cantrip with sheet spell attack', () => {
  const expected = {
    wizard: 'fire_bolt',
    sorcerer: 'fire_bolt',
    warlock: 'eldritch_blast',
    bard: 'vicious_mockery',
    cleric: 'sacred_flame',
    druid: 'produce_flame'
  };
  for (const [classId, ref] of Object.entries(expected)) {
    const pc = pc5e('human', classId);
    const c = cantripProfile(pc);
    assert.equal(c.ref, ref, `${classId} cantrip`);
    assert.equal(c.atkBonus, pc.dnd.spellcasting.attackBonus, `${classId} spell attack off the sheet`);
    assert.ok(SPELL_REGISTRY[ref], `${ref} exists in the spell catalog`);
  }
});

test('U111-05: martials get no cantrip; high elves keep their wizard cantrip', () => {
  assert.equal(cantripProfile(pc5e('human', 'fighter')), null);
  assert.equal(cantripProfile(pc5e('dwarf', 'barbarian')), null);

  const elfFighter = pc5e('elf', 'fighter');
  const c = cantripProfile(elfFighter);
  assert.equal(c.ref, 'fire_bolt', 'high elf knows a wizard cantrip');
  assert.equal(c.atkBonus, elfFighter.dnd.profBonus + elfFighter.dnd.mods.INT, 'INT-based per the SRD');
});

test('U111-06: initEscapeKit does not give 5e characters the hedge-caster kit', () => {
  const bard = pc5e('half-elf', 'bard');
  const w = initEscapeKit(mkWorld(bard));
  const pc = w.party[0];

  const weaponNames = pc.inventory.weapons.map(x => String(x?.name || x).toLowerCase());
  assert.ok(!weaponNames.some(n => n.includes('worn blade')), 'no Worn Blade');
  assert.ok(pc.spells.known.includes('vicious_mockery'), 'bard knows vicious mockery');
  assert.ok(!pc.spells.known.includes('fire_bolt'), 'bard does NOT know fire bolt');

  // Martial: no cantrips injected at all.
  const fighter = pc5e('human', 'fighter');
  const wf = initEscapeKit(mkWorld(fighter));
  assert.equal(wf.party[0].spells.known.length, 0, 'fighter has no cantrips');

  // Legacy character still gets the classic kit.
  const wl = initEscapeKit(mkWorld({ id: 'pc_legacy', name: 'Old Save', stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }));
  const legacyWeapons = wl.party[0].inventory.weapons.map(x => String(x?.name || x));
  assert.ok(legacyWeapons.some(n => n.includes('Worn Blade')), 'legacy keeps the Worn Blade');
  assert.ok(wl.party[0].spells.known.includes('fire_bolt'));
});

test('U111-07: kit view renders the sheet weapon and cantrip with real bonuses', () => {
  const cleric = pc5e('dwarf', 'cleric');
  const view = escapeKitView(cleric);
  assert.ok(view.weapons.length >= 1);
  assert.ok(view.spells.some(s => s.name === 'Sacred Flame'));
  assert.ok(view.spells.some(s => s.name === 'Ward'));

  const fighter = pc5e('human', 'fighter');
  const fview = escapeKitView(fighter);
  assert.equal(fview.spells.length, 0, 'martial spellbook is empty');
  assert.ok(fview.weapons.some(w => w.name === 'Guard'), 'martial gets the Guard action instead');
});

test('U111-08: new cantrip verbs parse to a cantrip attack', () => {
  assert.equal(parseEscapeAction('eldritch blast the cultist').verb, 'firebolt');
  assert.equal(parseEscapeAction('mock the goblin viciously').verb, 'firebolt');
  assert.equal(parseEscapeAction('cast sacred flame').verb, 'firebolt');
  assert.equal(parseEscapeAction('cast at the wolf').verb, 'firebolt');
  assert.equal(parseEscapeAction('strike').verb, 'strike');
  assert.equal(parseEscapeAction('take cover').verb, 'cover');
  assert.equal(parseEscapeAction('guard').verb, 'ward');
});

test('U111-09: determinism — same sheet world hashes the same kit', () => {
  const a = initEscapeKit(initEscapeHp(mkWorld(pc5e('tiefling', 'warlock'))));
  const b = initEscapeKit(initEscapeHp(mkWorld(pc5e('tiefling', 'warlock'))));
  assert.deepEqual(a.party[0], b.party[0]);
  assert.equal(a.meta.escapeHp, b.meta.escapeHp);
});
