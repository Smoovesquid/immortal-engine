import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { beginDialogue } from '../engine/npc/dialogue.js';
import { worldHash } from '../engine/worldHash.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

// U335–U338 — the self-harm handler graduates onto the bleed spectrum
// (papercut → shallow → deep → severe → arterial). The tier is inferred
// DETERMINISTICALLY from the fiction (Biblioteca V11 — a keyword table sets the
// tier, never the LLM), so it adds no rng and worldHash stays stable under
// replay. Opus gate 2026-07-02: a self-cut phrased as a mechanical question
// ("I cut my palm — what's my HP after?") was shadowed by the HP-status /
// weapon-damage meta answer and the DM reported the player "untouched" — the cut
// resolved nothing. And a papercut and a slit throat both cost exactly 1 HP.

function freshWorld(seed = 'self-harm') {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  const w = beginAdventure(newWorld({ seed, fate: 0.3, pack: { primaryId: 'fantasy', mixerId: null } }), byId).world;
  return { w, byId };
}

const bleedCond = (world) => (world.party?.[0]?.conditions || []).find(c => c.name === 'bleeding');

// ── U335: the tier ladder — fiction → tier → HP + condition ─────────────────

test('U335: a plain "cut my palm" is a shallow bleed — ~1 HP, condition applied', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, 'I cut my palm');
  assert.match(output.mechanics, /self-harm — shallow bleed/, 'shallow tier');
  assert.doesNotMatch(output.mechanics, /vs DC/, 'no skill-check roll');
  assert.equal(world.party[0].wounds, before + 1, 'shallow = 1 HP off the live track');
  const cond = bleedCond(world);
  assert.ok(cond, 'a bleeding condition is applied');
  assert.equal(cond.severity, 1);
  // NOT the "untouched" non-resolution, NOT a weapon-damage dump.
  assert.doesNotMatch(output.narration, /untouched|roll for damage|1d\d/i);
});

test('U335: "slit my throat" is an arterial bleed — 5 HP, permanent condition', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, 'I slit my own throat');
  assert.match(output.mechanics, /self-harm — arterial bleed/);
  assert.equal(world.party[0].wounds, before + 5, 'arterial = 5 HP');
  const cond = bleedCond(world);
  assert.ok(cond);
  assert.equal(cond.severity, 5);
  assert.equal(cond.until, 'permanent', 'arterial bleed does not self-resolve');
});

test('U335: "just a papercut" is flavor — 0 HP, a harmless condition', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, 'just a papercut on my thumb');
  assert.match(output.mechanics, /self-harm — papercut bleed/);
  assert.match(output.mechanics, /0 HP/);
  assert.equal(world.party[0].wounds, before, 'a papercut costs no HP');
  const cond = bleedCond(world);
  assert.ok(cond, 'condition still applied (surfaces "you\'re bleeding")');
  assert.equal(cond.onTick, null, 'papercut deals no ongoing damage');
});

test('U335: the deep/severe rungs land between shallow and arterial', () => {
  const { w, byId } = freshWorld();
  const deep = playerMove(w, byId, 'I drive the blade deep into my thigh');
  assert.match(deep.output.mechanics, /self-harm — deep bleed/);
  assert.equal(deep.world.party[0].wounds, 2, 'deep = 2 HP');
  const severe = playerMove(w, byId, 'I carve a gash into my own arm');
  assert.match(severe.output.mechanics, /self-harm — severe bleed/);
  assert.equal(severe.world.party[0].wounds, 3, 'severe = 3 HP');
});

// ── U336: it FIRES past the meta shadow (the repro) ─────────────────────────

test('U336: a self-cut bundled with an HP question RESOLVES (not "untouched")', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  // The exact repro shape: a declared cut + a mechanical HP/damage question.
  const { world, output } = playerMove(w, byId, 'I cut my own palm — how much damage, and what is my HP after?');
  assert.match(output.mechanics, /self-harm/, 'the cut resolves, not the HP-status dodge');
  assert.equal(world.party[0].wounds, before + 1, 'the reported HP reflects the cut');
  assert.ok(bleedCond(world), 'bleed applied');
  // The old bug: a weapon-damage recital or an "untouched" HP status.
  assert.doesNotMatch(output.narration, /roll for damage|1d\d|untouched|13 of 13/i);
});

test('U336: a bare HP question with NO self-harm still answers as a meta query', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  const { world, output } = playerMove(w, byId, "what's my HP?");
  assert.doesNotMatch(output.mechanics || '', /self-harm/, 'no false self-harm trigger');
  assert.equal(world.party[0].wounds, before, 'a status query does no damage');
});

// ── U337: it FIRES inside an active dialogue ────────────────────────────────

test('U337: a self-cut mid-conversation resolves and ends the dialogue', () => {
  const { w, byId } = freshWorld('aldermere');
  const node = (w.map?.nodes || []).find(n => (n.settlement?.npcs || []).length > 0);
  assert.ok(node, 'found a node with an NPC to talk to');
  const npc = node.settlement.npcs[0];
  let w1 = { ...w, map: { ...w.map, currentNodeId: node.id }, party: [{ ...w.party[0], nodeId: node.id }] };
  w1 = beginDialogue(w1, npc.name || npc.id).world;
  assert.ok(w1.scene?.dialogue, 'dialogue is active');
  const before = w1.party[0].wounds ?? 0;
  const { world, output } = playerMove(w1, byId, 'I slit my own throat');
  assert.match(output.mechanics, /self-harm — arterial bleed/, 'the cut resolves in dialogue');
  assert.equal(world.party[0].wounds, before + 5);
  assert.ok(bleedCond(world), 'bleed applied in dialogue');
  assert.equal(!!world.scene?.dialogue, false, 'the conversation ends');
});

// ── U338: determinism + guards ──────────────────────────────────────────────

test('U338: same text → same tier → identical worldHash (no new rng draw)', () => {
  for (const text of ['I cut my palm', 'I slit my throat', 'just a papercut on my thumb', 'I drive the blade deep into my thigh']) {
    const a = playerMove(freshWorld().w, freshWorld().byId, text).world;
    const b = playerMove(freshWorld().w, freshWorld().byId, text).world;
    assert.equal(worldHash(a), worldHash(b), `deterministic for: ${text}`);
  }
});

test('U338: escape mode takes instant HP off escapeHp, not party.wounds', () => {
  const { w, byId } = freshWorld();
  const e = { ...w, meta: { ...w.meta, mode: 'escape', escapeHp: 13, escapeMaxHp: 13 } };
  const woundsBefore = e.party[0].wounds ?? 0;
  const { world, output } = playerMove(e, byId, 'I cut my forearm deep');
  assert.match(output.mechanics, /self-harm — deep bleed/);
  assert.equal(world.meta.escapeHp, 11, 'deep = 2 HP off escapeHp');
  assert.equal(world.party[0].wounds, woundsBefore, 'party.wounds untouched in escape mode');
  assert.ok(bleedCond(world), 'bleed still applied');
});

test('U338: external / hypothetical / negated targets do NOT self-harm', () => {
  const { w, byId } = freshWorld();
  const before = w.party[0].wounds ?? 0;
  for (const text of ['I cut the rope', 'I threaten to cut myself', 'I almost cut my hand on the glass', "I won't cut myself"]) {
    const { world, output } = playerMove(w, byId, text);
    assert.doesNotMatch(output.mechanics || '', /self-harm/, `not self-harm: ${text}`);
    assert.equal(world.party[0].wounds, before, `no wound: ${text}`);
  }
});
