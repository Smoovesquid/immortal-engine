// U192 — H-31 ground-from-canon batch: info-roll suppression (R1), meta-query
// gaps (R2: Armor value / "what's in my hands"), canon-contradiction
// correction (R3), and age-invention guard (R4).
//
// Each rule's catch case is paired with a false-positive guard — the
// discipline this repo holds itself to for every grounding rule (mirrors
// tests/U190.deliverOrDecline.test.js).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure, playerMove, infoExtractionOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isMetaQuestion, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';
import { validateNarrationCandidate, findInventedFactClaim } from '../engine/llmAdapter.js';

function packs() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

function world(seed = 'glass-harbor') {
  return beginAdventure(
    newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }),
    packs()
  ).world;
}

// ── R1 — info-check roll suppression ──────────────────────────────────────

test('U192-01: an ungrounded info-ask never reports a gradeable success/mixed in mechanics', () => {
  const byId = packs();
  const w = world();
  const out = playerMove(w, byId, "Give me a name of someone who's DEAD.").output;
  assert.doesNotMatch(String(out.mechanics), /→\s*(success|mixed)\b/i,
    `decline must not carry a gradeable roll: ${out.mechanics}`);
  assert.match(String(out.narration), /\bnever\b|\bdon't know\b|\bno record\b|\blost\b|\bcan't say\b|\bwon't\b|\bclosed\b|\bunsettled\b|\bdrawn twice\b|\bdead end\b/i,
    `must read as an in-fiction decline: ${out.narration}`);
});

test('U192-02: a GROUNDED info-ask still rolls and delivers (false-positive guard)', () => {
  const byId = packs();
  let w = world();
  w = { ...w, ledger: { ...w.ledger, facts: [{ text: 'dead garrick thorne the founder lies in the old crypt' }, ...(w.ledger.facts || [])] } };
  const out = playerMove(w, byId, "Give me a name of someone who's dead.").output;
  assert.match(String(out.mechanics), /\[roll:\d+ vs DC:\d+ → (success|mixed|failure)/,
    `a grounded ask must still resolve a real roll: ${out.mechanics}`);
});

test('U192-03: infoExtractionOutcome accepts the no-info sentinel and declines in-fiction', () => {
  const w = world();
  const narr = infoExtractionOutcome(w, "Give me a name of someone who's DEAD.", 'no-info');
  assert.ok(narr, 'must produce non-null narration for the no-info sentinel');
  assert.doesNotMatch(narr, /you see it through|it comes off cleanly|put the question to those nearby/i,
    'must never fall to the bare atmosphere bank');
});

test('U192-04: infoExtractionOutcome still returns null for non-info text under the no-info sentinel (false-positive guard)', () => {
  const w = world();
  assert.equal(infoExtractionOutcome(w, 'I steady my breathing', 'no-info'), null,
    'a non-info-seeking action must not be intercepted regardless of outcome sentinel');
});

// ── R2 — meta-query gaps: Armor value, "what's in my hands" ───────────────

test('U192-10: an Armor-value ask returns the real AC, never a roll', () => {
  const w = world();
  assert.equal(isMetaQuestion("What's my Armor value?"), true);
  const ans = handleMetaQuestion("What's my Armor value?", w);
  assert.ok(ans, 'must answer');
  assert.match(ans, /\bArmor is \d+\b/, `must state a real numeric AC: ${ans}`);
});

test('U192-11: "what\'s in my hands" answers from real inventory, never a WITS check', () => {
  const w = world();
  assert.equal(isMetaQuestion("What's actually in my hands right now?"), true);
  const ans = handleMetaQuestion("What's actually in my hands right now?", w);
  assert.ok(ans, 'must answer');
  assert.match(ans, /armed with/i, `must describe the real loadout: ${ans}`);
});

test('U192-12: the original armor-PIECE ask still names the item, not a number (false-positive guard)', () => {
  const w = world();
  const ans = handleMetaQuestion("What's my armor?", w);
  assert.ok(ans, 'must answer');
  assert.match(ans, /wearing|clothes/i, `armor-piece phrasing must still name the gear: ${ans}`);
});

test('U192-13: an Armor-value ask costs no roll end-to-end', () => {
  const byId = packs();
  const w = world();
  const out = playerMove(w, byId, "What's my Armor value?").output;
  assert.equal(out.mechanics, '', `must not roll: ${out.mechanics}`);
});

// ── R3 — canon-contradiction correction ────────────────────────────────────

test('U192-20: asserting a possession not in canon gets corrected from canon in-fiction', () => {
  const w = world();
  const ans = handleMetaQuestion('You said I had a staff.', w);
  assert.ok(ans, 'must answer');
  assert.match(ans, /there's no staff/i, `must explicitly correct the false claim: ${ans}`);
  assert.match(ans, /armed with/i, `must restate the real loadout: ${ans}`);
});

test('U192-21: asserting a REAL possession is not flagged as a contradiction (false-positive guard)', () => {
  const w = world();
  const ans = handleMetaQuestion('I have a Worn Blade and a Padded coat.', w);
  assert.ok(!ans || !/there's no/i.test(ans), `a true restatement of real gear must never be corrected: ${ans}`);
});

test('U192-22: the full Opus-gate contradiction resolves in-fiction with no roll', () => {
  const byId = packs();
  const w = world();
  const out = playerMove(w, byId,
    "Hold on — you just listed a Kitchen cleaver and a Worn Blade, but a moment ago I had a staff and a robe. Which is it? What's actually in my hands right now?"
  ).output;
  assert.match(String(out.narration), /there's no staff or robe/i, `must correct in-fiction: ${out.narration}`);
  assert.equal(out.mechanics, '', `must not roll: ${out.mechanics}`);
});

// ── R4 — age-phrase invention guard ─────────────────────────────────────────

function makeWorld() {
  return {
    meta: { fate: 0.5 },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: "Pilgrim's Rest Village", nodeType: 'settlement' }], edges: [] },
    scene: { objective: '', interior: null, location: "Pilgrim's Rest Village" },
    combat: null,
    party: [],
    ledger: { facts: [], threats: [], questions: [] },
    structures: { byId: {} },
    factions: [],
    instrument: { threads: [], motifs: [] },
    time: { turn: 1 },
    pack: { primaryId: 'fantasy' }
  };
}
function makeCtx(overrides = {}) {
  return {
    placeName: "Pilgrim's Rest Village",
    nodeType: 'settlement',
    location: "Pilgrim's Rest Village",
    rollOutcome: null,
    infoSeeking: false,
    dialogueTurn: null,
    combat: null,
    ...overrides
  };
}

test('U192-30: findInventedFactClaim flags an ungrounded age phrase', () => {
  assert.equal(findInventedFactClaim('he is well past seventy', 'no age is on record'), 'well past seventy');
  assert.equal(findInventedFactClaim('she is in her seventies', 'no age is on record'), 'in her seventies');
});

test('U192-31: findInventedFactClaim ignores an age phrase that IS in the base (false-positive guard)', () => {
  const claim = findInventedFactClaim('he is well past seventy', 'the old man, well past seventy, leans on his cane');
  assert.equal(claim, null);
});

test('U192-32: REJECT — an invented age claim on a plain (non-info-seeking) turn, unconditional on ctx.infoSeeking', () => {
  const w = makeWorld();
  const base = `Kael, the elder of Pilgrim's Rest Village, sits not far from where you stand, at Pilgrim's Rest Village.`;
  const cand = `Kael, a grey-haired man whose lined face marks him as a man well past seventy, at Pilgrim's Rest Village.`;
  const ctx = makeCtx({ infoSeeking: false, rollOutcome: null });
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: base, ctx }), false,
    'an invented age must be rejected even when this isn\'t an info-seeking roll');
});

test('U192-33: PASS — a grounded age phrase that IS in the base (false-positive guard)', () => {
  const w = makeWorld();
  const base = `Kael, well past seventy and the oldest soul in Pilgrim's Rest Village, at Pilgrim's Rest Village.`;
  const cand = `Kael, a man well past seventy, nods at Pilgrim's Rest Village.`;
  const ctx = makeCtx({ infoSeeking: false, rollOutcome: null });
  assert.equal(validateNarrationCandidate(w, cand, { baseNarration: base, ctx }), true,
    'a grounded age that matches the base must pass');
});
