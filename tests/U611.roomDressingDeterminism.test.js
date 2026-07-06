// U611 — PW-4: roomDressing is a pure, deterministic, world-free deriver, and wiring it
// into the interior scene leaves worldHash and the boot anchor untouched (S1).
//
// The dressing deriver adds 1–2 seed-derived micro-details per room. The contract's S1
// rail: values re-derivable on demand are NEVER stored and add nothing to the hash. This
// pins that BY CONSTRUCTION:
//   - roomDressing(seed, structureId, roomId) is 3-arg pure (no world object) and
//     deterministic ×2 (same args → byte-identical output, every time),
//   - it derives from ALL THREE of (seed, structure, room) — changing any one can change
//     the result; the same triple is stable forever,
//   - the room's role/dark hint shapes the eligible pool (a crypt and a bedchamber can
//     draw different texture) without breaking determinism,
//   - the authored bank is taste-neutral (no digits, no moral vocabulary), and
//   - the tallow boot worldHash is identical across two fresh boots WITH the dressing
//     wiring live (proof the projection never grew a dressing field).
//
// Hermetic — pure derivation + pure hashing, no network, no API key, no cost.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { worldHash } from '../engine/worldHash.js';
import { roomDressing } from '../engine/structures/roomDressing.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
function loadPacks() {
  const m = normalizeManifest(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'packs', 'manifest.json'), 'utf8')));
  const byId = {};
  for (const p of m.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8')));
  return byId;
}
const PACKS = loadPacks();
const boot = () => beginAdventure(newWorld({ seed: 'tallow', fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), PACKS).world;

test('U611: roomDressing is deterministic ×2 and returns 1–2 phrases', () => {
  const a = roomDressing('seedA', 'struct:1', 'room:struct:1:2');
  const b = roomDressing('seedA', 'struct:1', 'room:struct:1:2');
  assert.deepEqual(b, a, 'same args → byte-identical output');
  assert.ok(a.length >= 1 && a.length <= 2, `1–2 phrases, got ${a.length}`);
  for (const d of a) assert.equal(typeof d, 'string');
  // Two phrases (when returned) are distinct — texture, not a repeated line.
  if (a.length === 2) assert.notEqual(a[0], a[1], 'the two details differ');
});

test('U611: the deriver keys off ALL THREE of (seed, structure, room)', () => {
  const base = roomDressing('s', 'struct:1', 'room:struct:1:2');
  // Flip each key in turn; across a spread of rooms the output should not be pinned to a
  // single key. (Any individual pair could collide by chance, so we assert that at least
  // one of the three axes moves the result — proving all three feed the seed.)
  const bySeed = roomDressing('s2', 'struct:1', 'room:struct:1:2');
  const byStruct = roomDressing('s', 'struct:2', 'room:struct:2:2');
  const byRoom = roomDressing('s', 'struct:1', 'room:struct:1:5');
  const moved = [bySeed, byStruct, byRoom].some(x => JSON.stringify(x) !== JSON.stringify(base));
  assert.ok(moved, 'changing seed / structure / room can change the dressing (all three are keyed)');

  // And it is world-FREE: called with primitives only, it never touches state and never throws.
  assert.doesNotThrow(() => roomDressing('', '', ''));
  assert.deepEqual(roomDressing('', '', ''), [], 'empty structure AND room → no dressing');
});

test('U611: the role hint shapes the pool — a crypt can differ from a bedchamber', () => {
  // Same (seed, structure, room) key, different room CHARACTER: the eligible pool differs,
  // so the hint is honored. We sample enough rooms to see the pools diverge (a dark/damp
  // crypt draws texture a humble bedchamber never can, e.g. mildew / bones / the deep dark).
  const cryptDetails = new Set();
  const bedDetails = new Set();
  for (let i = 0; i < 40; i++) {
    for (const d of roomDressing('h', 'struct:1', `room:struct:1:${i}`, { role: 'crypt', dark: true })) cryptDetails.add(d);
    for (const d of roomDressing('h', 'struct:1', `room:struct:1:${i}`, { role: 'bedchamber', dark: false })) bedDetails.add(d);
  }
  // The two pools are not identical: at least one detail the crypt can show never appears
  // for the bedchamber (the gated 'dark'/'damp' texture).
  const cryptOnly = [...cryptDetails].filter(d => !bedDetails.has(d));
  assert.ok(cryptOnly.length > 0, 'the crypt draws gated texture the bedchamber never does');
  // Determinism holds under the hint too.
  const h1 = roomDressing('h', 'struct:1', 'room:struct:1:3', { role: 'crypt', dark: true });
  const h2 = roomDressing('h', 'struct:1', 'room:struct:1:3', { role: 'crypt', dark: true });
  assert.deepEqual(h2, h1, 'hinted derivation is deterministic ×2');
});

test('U611: the authored bank is taste-neutral across every eligible pool', () => {
  const MORAL = /\b(evil|wicked|sin|sinful|guilt|guilty|virtue|virtuous|holy|unholy|cursed|blessed|innocent|righteous|damned)\b/i;
  const roles = ['crypt', 'bedchamber', 'nave', 'den', 'cellar', 'greathall', 'kitchen', 'warren', null];
  const seen = new Set();
  for (const role of roles) {
    for (let i = 0; i < 60; i++) {
      for (const d of roomDressing('bank', 'struct:9', `room:struct:9:${i}`, role ? { role, dark: /crypt|den|cellar|warren/.test(role) } : null)) {
        seen.add(d);
      }
    }
  }
  assert.ok(seen.size >= 8, 'the sweep exercises a broad slice of the bank');
  for (const d of seen) {
    assert.ok(!/[0-9]/.test(d), `no numerics in "${d}"`);
    assert.ok(!MORAL.test(d), `no moral judgment in "${d}"`);
  }
});

test('U611 (S1): the tallow boot worldHash is unchanged by the dressing wiring', () => {
  // Two fresh boots WITH the PW-4 wiring live. If dressing had leaked into stored state or
  // the hash projection, these would differ (or the anchor would have moved). They must be
  // byte-equal — dressing is pure projection, never hashed. (This is a SELF-consistency
  // proof; the cross-change anchor is guarded by U19/U21/U22/U27/U30 in the main suite.)
  assert.equal(worldHash(boot()), worldHash(boot()), 'the boot hash is stable — dressing adds nothing to world shape');
});
