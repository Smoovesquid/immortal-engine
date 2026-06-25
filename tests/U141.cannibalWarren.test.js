// U141 — the authored cannibal warren (DEMO_REGION §7 / IG-14). The dungeon nearest the
// outlier where the Host stands — Gallows Hill (2) on the locked `tallow` seed — is the
// WARREN: the eaters' archive, "a library that smells of smoke", with its own theme,
// history, and echoes (the long table laid and named, the shelved ledgers, the pinned
// obituaries — the §7 inversion told in environmental storytelling). It rides the
// multi-level descent engine; other dungeons are untouched. Deterministic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDungeon } from '../engine/dungeon/generate.js';
import { validateDungeon } from '../engine/dungeon/schema.js';

const WARREN_NODE = 'n35_689537805';   // Gallows Hill (2), tallow — by the cannibal outlier

test('U141-01: the warren node generates a `warren`-themed multi-level dungeon', () => {
  const d = generateDungeon('tallow', WARREN_NODE);
  assert.equal(d.theme, 'warren');
  assert.equal(d.scale, 'site', 'a real multi-level descent');
  assert.deepEqual(validateDungeon(d), { ok: true, errors: [] });
});

test('U141-02: the warren reads as the eaters’ archive (authored echoes + the long table)', () => {
  const d = generateDungeon('tallow', WARREN_NODE);
  const echoesText = d.history.echoes.join(' | ');
  assert.match(echoesText, /ledger|obituar|long table|tally|kept/i, `archive echoes; got: ${echoesText}`);
  // the vault centerpiece is the long table (a place set and waiting for you).
  const vault = Object.values(d.levels[0].rooms).find(r => r.role === 'vault');
  const feat = vault.contents.find(c => c.kind === 'feature');
  assert.match(`${feat.name} ${feat.look}`, /long table/i);
});

test('U141-03: only the warren node is the warren — other tallow dungeons roll normally', () => {
  for (const id of ['n0_216732028', 'n13_363931979', 'n24_2146593250']) {
    assert.notEqual(generateDungeon('tallow', id).theme, 'warren', `${id} is not the warren`);
  }
});

test('U141-04: deterministic — the warren regenerates identically', () => {
  assert.equal(
    JSON.stringify(generateDungeon('tallow', WARREN_NODE)),
    JSON.stringify(generateDungeon('tallow', WARREN_NODE))
  );
});
