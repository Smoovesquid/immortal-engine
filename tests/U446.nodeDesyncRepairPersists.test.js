// U446–U447 — ND-1b: the NODE-DESYNC-1 legacy repair must PERSIST, not just heal
// in-memory (docs/PACKETS.md: "ND-1b — the legacy-desync repair doesn't PERSIST").
//
// Root cause: state.js's ensureWorld() derives scene.interior from
// party[0].position.interior UNLESS the derivation would manufacture a desync (the
// `derivedElsewhere` guard, ~line 154) — so on a legacy desynced world, scene.interior
// already reads null by the time the repair block ran. The OLD repair block only
// cleared party[0].position.interior as a side effect of `world.scene.interior` being
// truthy — so once scene.interior was already null (the common case, since the guard
// above fires first), the `if` never entered and position.interior — the very field
// scene.interior re-derives FROM on every future ensureWorld call (see
// engine/structures/interiors.js's setPartyInterior/clearPartyInterior comment) —
// was NEVER cleared. That stale pointer then round-tripped through loadSlot →
// ensureWorld → saveSlot forever: in-memory reads looked healed (scene.interior was
// null, narration was honest) but the STORED save carried the same landmine on every
// autosave, and interiors.js's own comment warns the next derivation to adopt it
// without the guard would snap the player back inside.
//
// Fix (engine/state.js): the repair block now checks the RAW party[0].position.interior
// pointer independently — not just the already-derived world.scene.interior — and
// clears it whenever ITS structure is at the wrong node. U446 proves the STORED save
// (not just the in-memory object) converges after one turn, and that a SECOND load
// performs no further repair. U447 proves a clean/healthy save is untouched — no
// spurious repair, byte-stable, hash-equal (SAVE_CORRUPTION bug-class safety net).
//
// Pure, LLM-off (deterministic). Boots the exact live slice via the pre-rolled hero,
// exactly like U403–U406, then drives the save/load path with an in-memory
// localStorage shim (no browser, no network).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { saveSlot, loadSlot } from '../engine/save.js';
import { worldHash } from '../engine/worldHash.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// The exact live boot: pre-rolled Bryn Holt into the Aldermere slice, indoors
// (scene.interior set at the boot cottage's node) — same fixture as U403–U406.
function bootIndoors() {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed: SLICE_SEED, fate: 0.2, campaignId: `campaign-${SLICE_SEED}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  const w1 = ensureWorld({ ...w0, party: [pc] });
  return beginAdventure(w1, PACKS).world;
}

// A minimal in-memory localStorage shim — the same Storage interface save.js
// expects (getItem/setItem), so the real saveSlot/loadSlot code runs unmodified.
class MemStorage {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}

function slotRaw(storage, slotId = 'slot1') {
  const raw = storage.getItem(`ai-dm-v2:slot:${slotId}`);
  return raw ? JSON.parse(raw) : null;
}

test('U446: legacy-desynced save → load → one turn → the STORED save converges (no re-repair on 2nd load)', () => {
  const w = bootIndoors();
  const cottageNode = String(w.map.currentNodeId);
  const otherNode = (w.map.nodes || []).map(n => String(n.id)).find(id => id !== cottageNode);
  assert.ok(otherNode, 'a second node exists in the slice');
  assert.ok(w.scene?.interior, 'boot precondition: indoors');
  assert.ok(w.party[0]?.position?.interior, 'boot precondition: party carries the position.interior mirror');

  // Hand-build the legacy desync exactly like U406: currentNodeId flipped away from
  // the cottage, scene.interior AND party[0].position.interior both still pointing
  // at the cottage — this is the raw shape a pre-fix (v0.28.9) autosave wrote to disk.
  const legacyRaw = { ...w, map: { ...w.map, currentNodeId: otherNode } };

  const storage = new MemStorage();
  storage.setItem('ai-dm-v2:slot:slot1', JSON.stringify(legacyRaw));
  storage.setItem('ai-dm-v2:lastSlot', 'slot1');

  // Precondition: the corrupted blob really is on "disk" pre-load.
  const onDiskBefore = slotRaw(storage);
  assert.ok(onDiskBefore.scene.interior, 'precondition: stored scene.interior is the stale cottage pointer');
  assert.ok(onDiskBefore.party[0].position.interior, 'precondition: stored party[0].position.interior is the stale mirror');

  // LOAD (as Continue does) — ensureWorld repairs in-memory.
  const loaded = loadSlot(storage, 'slot1');
  assert.equal(loaded.scene.interior, null, 'load repairs scene.interior in-memory');
  assert.equal(loaded.party[0]?.position?.interior ?? null, null, 'load ALSO clears the position.interior mirror in-memory (the ND-1b fix)');
  assert.doesNotThrow(() => ensureWorld(loaded), 'the repaired world is invariant-clean');

  // ONE TURN.
  const r = playerMove(loaded, PACKS, 'look around');
  assert.equal(r.world.scene.interior, null, 'still repaired after a turn');
  assert.equal(r.world.party[0]?.position?.interior ?? null, null, 'position.interior mirror still clear after a turn');
  assert.doesNotMatch(r.output.narration, /falls short here|left where you started/i, 'no stale node-travel narration leaks through');

  // AUTOSAVE (the exact call public/v1.js's persistAndRehash makes after a turn).
  saveSlot(storage, r.world, 'slot1');

  // THE DONE_WHEN: the STORED save (raw JSON on "disk"), not just the returned
  // in-memory object, must be clean.
  const onDiskAfter = slotRaw(storage);
  assert.equal(onDiskAfter.scene.interior, null, 'STORED save scene.interior is cleared after one turn');
  assert.equal(onDiskAfter.party[0].position.interior ?? null, null, 'STORED save party[0].position.interior is cleared after one turn (the ND-1b gap)');

  // SECOND LOAD — must perform NO further repair (converged): re-loading the now-
  // clean stored save is a no-op, proving the fix actually landed in storage and
  // isn't re-deriving the desync every time.
  const loaded2 = loadSlot(storage, 'slot1');
  assert.equal(loaded2.scene.interior, null, 'second load: still null, no re-repair needed');
  assert.equal(loaded2.party[0]?.position?.interior ?? null, null, 'second load: still null, no re-repair needed');
  assert.deepEqual(
    { scene: onDiskAfter.scene.interior, pos: onDiskAfter.party[0].position.interior ?? null },
    { scene: loaded2.scene.interior, pos: loaded2.party[0]?.position?.interior ?? null },
    'stored save and a fresh load of it agree byte-for-byte on the interior fields — converged'
  );
});

test('U447: a clean/healthy save round-trips unchanged — no spurious repair, hash-equal', () => {
  const w = bootIndoors();
  // Healthy precondition: interior really does belong to the current node.
  const st = w.structures?.byId?.[String(w.scene.interior.structureKey)];
  assert.equal(String(st?.nodeId || ''), String(w.map.currentNodeId), 'precondition: healthy save has interior AT the current node');

  const storage = new MemStorage();
  const hashBefore = worldHash(w);

  saveSlot(storage, w, 'slot1');
  const onDisk = slotRaw(storage);
  // No repair fired: the stored interior is untouched, still the live cottage.
  assert.deepEqual(onDisk.scene.interior, w.scene.interior, 'healthy save keeps its interior byte-identical in storage');
  assert.deepEqual(onDisk.party[0].position.interior, w.party[0].position.interior, 'healthy save keeps its position.interior mirror byte-identical');

  const loaded = loadSlot(storage, 'slot1');
  assert.ok(loaded.scene.interior, 'healthy save still indoors after a full save/load round-trip');
  assert.equal(String(loaded.scene.interior.structureKey), String(w.scene.interior.structureKey), 'same structure');
  assert.equal(String(loaded.scene.interior.roomId), String(w.scene.interior.roomId), 'same room');

  const hashAfter = worldHash(loaded);
  assert.equal(hashAfter, hashBefore, 'worldHash is stable across a clean save/load round-trip — no spurious repair perturbed determinism');

  // One turn on a healthy save should also never trigger the legacy repair path.
  const r = playerMove(loaded, PACKS, 'look around');
  assert.ok(r.world.scene.interior, 'healthy save stays indoors after a turn (no repair mistakenly clears a valid interior)');
});
