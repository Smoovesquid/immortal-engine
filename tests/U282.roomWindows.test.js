// U282 — Windows are a real, generated, interactable room feature. Above-ground
// building rooms have 1-2 windows; cellars / windowless / underground rooms have
// none. The room survey ("look around" / "are there windows?") lists them, and the
// verbs bind to the SAME deriver: look out (a line-of-sight outlook), climb/jump/
// crawl out (a real escape exit), break/smash (an opening + noise), and — in a
// fight — shoot out (a ranged line). Deterministic (seeded). Hermetic — no network.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { roomWindows, roomWindowFacings } from '../engine/structures/roomWindows.js';
import { roomDetail } from '../engine/structures/roomDetail.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;
const ROLL_RE = /\[roll:/i;

// Put the player into a specific interior room of the structure they start in.
function inRoom(w, roomId) {
  return { ...w, scene: { ...w.scene, interior: { ...w.scene.interior, roomId } } };
}
function structRooms(w) {
  const st = w.structures?.byId?.[String(w.scene?.interior?.structureKey || '')];
  return (st?.topology?.rooms || []).map(r => r.id);
}
function findRoomByDark(w, wantDark) {
  const st = w.structures?.byId?.[String(w.scene?.interior?.structureKey || '')];
  for (const r of (st?.topology?.rooms || [])) {
    if (Boolean(roomDetail(r, st?.buildingType || null).dark) === wantDark) return r.id;
  }
  return null;
}

// ── Generation ────────────────────────────────────────────────────────────────
test('U282: an above-ground building room HAS windows by type (lit → 1-2, dark → 0)', () => {
  const w = boot();
  const litId = findRoomByDark(w, false);
  const darkId = findRoomByDark(w, true);
  assert.ok(litId, 'precondition: the building has an above-ground room');
  const litWin = roomWindows(w, { structureKey: w.scene.interior.structureKey, roomId: litId });
  assert.ok(litWin.count >= 1 && litWin.count <= 2, `a lit room has 1-2 windows (got ${litWin.count})`);
  if (darkId) {
    assert.equal(roomWindows(w, { structureKey: w.scene.interior.structureKey, roomId: darkId }).count, 0, 'a dark room has no windows');
  }
});

test('U282: an above-ground building room has a window in look-around', () => {
  const w = boot();
  assert.equal(Boolean(w.scene?.interior?.structureKey), true, 'precondition: starts inside a building');
  assert.match(buildLocationSurvey(w), /window/i, 'a real room should have a window');
});

test('U282: a dungeon / underground interior has NO window', () => {
  const w = boot();
  const inDungeon = { ...w, scene: { ...w.scene, interior: { ...w.scene.interior, structureKey: 'dungeon:n1:0' } } };
  assert.doesNotMatch(buildLocationSurvey(inDungeon), /window/i, 'underground rooms have no window');
});

test('U282: windows are deterministic — same seed/turn → identical survey + deriver', () => {
  assert.equal(buildLocationSurvey(boot()), buildLocationSurvey(boot()));
  const a = boot();
  assert.deepEqual(roomWindows(a, a.scene.interior), roomWindows(boot(), boot().scene.interior));
});

// ── look out ────────────────────────────────────────────────────────────────
test('U282: "look out the window" gives a line-of-sight outlook, no roll', () => {
  // A room may START shuttered (derived), and you can't see out closed shutters (W-Q3) — so
  // open them first. Opening is a free, in-the-room action; then the outlook reads.
  const w = playerMove(boot(), PACKS, 'open the shutters').world;
  const r = playerMove(w, PACKS, 'look out the window');
  assert.match(r.output.narration, /Through the window/i, r.output.narration);
  assert.doesNotMatch(r.output.mechanics || '', ROLL_RE, 'a window outlook is perception, not a dice roll');
  // Still inside — looking out doesn't move you.
  assert.ok(r.world.scene?.interior, 'looking out keeps you in the room');
});

// ── climb / jump / crawl out a CHOSEN window → a real exit (no roll) ──────────
test('U282: climbing out a chosen window is a real exit (clears the interior), no roll', () => {
  const facing = roomWindowFacings(boot(), boot().scene.interior)[0];
  assert.ok(facing, 'precondition: the room has a window with a facing');
  for (const verb of [`climb out the ${facing} window`, `jump out the ${facing} window`, `crawl out the ${facing} window`]) {
    const r = playerMove(boot(), PACKS, verb);
    assert.equal(r.world.scene?.interior, null, `${verb} should put you outside`);
    assert.match(r.output.mechanics || '', /\[window:exit\|/, r.output.mechanics); // [window:exit|<facing>]
    assert.doesNotMatch(r.output.mechanics || '', ROLL_RE, 'climbing out an accessible window never rolls');
  }
});

// ── break / smash → an opening + noise ────────────────────────────────────────
test('U282: "smash the window" makes an opening + noise (still inside)', () => {
  const r = playerMove(boot(), PACKS, 'smash the window');
  assert.match(r.output.mechanics || '', /\[window:break\]/, r.output.mechanics);
  assert.match(r.output.narration, /glass|shatter|smash/i, r.output.narration);
  assert.ok(r.world.scene?.interior, 'breaking the glass does not move you');
});

// ── windowless room declines honestly ─────────────────────────────────────────
test('U282: a windowless (dark) room has no window to act on', () => {
  const w = boot();
  const darkId = findRoomByDark(w, true);
  if (!darkId) return; // structure happens to be all above-ground; nothing to assert
  const r = playerMove(inRoom(w, darkId), PACKS, 'jump out the window');
  assert.match(r.output.narration, /no window/i, r.output.narration);
  assert.ok(r.world.scene?.interior, 'no exit happened — there was no window');
});

// ── self-harm stays a fall (regression guard for U159) ────────────────────────
test('U282: "throw myself out the window" is still a fall, not a window action', () => {
  const r = playerMove(boot(), PACKS, 'I throw myself out the window');
  assert.match(r.output.mechanics || '', /hazard:fall/, r.output.mechanics);
});

// ── shoot out the window → a ranged combat line ───────────────────────────────
test('U282: "fire bolt out the window" in combat is a real ranged attack, not a bounce', () => {
  let w = boot();
  // Start a fight with a hostile present at the node.
  const node = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
  const foe = (node?.settlement?.npcs || []).find(n => n && n.hostile);
  if (!foe) { w = playerMove(w, PACKS, 'attack').world; }
  else { w = playerMove(w, PACKS, `attack ${foe.name}`).world; }
  if (!w.combat?.active || !w.scene?.interior) return; // could not stage a fight inside; skip
  const r = playerMove(w, PACKS, 'fire bolt out the window');
  assert.match(r.output.mechanics || '', /\[window:shoot\]/, r.output.mechanics);
  // It RESOLVED as a real combat turn (cantrip / strike / a foe breaking off), never
  // the "make a mess of the room" object-bounce or a table-talk non-action.
  assert.doesNotMatch(r.output.narration, /make a mess of the room/i, r.output.narration);
  assert.doesNotMatch(r.output.mechanics || '', /combat:table-talk/i, r.output.mechanics);
  assert.match(r.output.mechanics || '', /cantrip|strike|atk:|combat:/i, r.output.mechanics);
  // Framed as firing from the window.
  assert.match(r.output.narration, /window/i, r.output.narration);
});
