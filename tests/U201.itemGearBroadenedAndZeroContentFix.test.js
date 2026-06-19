// U201 — H-38a bundled pass off the post-H-37 Opus gate (16/48 fails).
// (Numbered U201, not U200, because the parallel H-38b combat-lane worker
// independently claimed tests/U200.combatEntityMechanics.test.js this same
// gate cycle — first-landed keeps the number; this file moved up to stay
// unique.)
//
//   R1 (gracefulAdjudication.js) — broaden the item/gear-stat answer-binding
//     fold beyond META_PURSE: H-37 only folded gear into the coin-ask branch,
//     so a class+gear compound with NO coin, and a bare gear yes/no ask with
//     no compound at all, both fell through to the raw MIGHT/AGILITY/...
//     stat-block fallback (META_SHEET_CONFIRM) or a "read your own sheet"
//     deflection (META_CHARACTER) instead of answering what was actually
//     asked. Also closes a gate/answerer drift: isMetaQuestion already
//     accepted the bare yes/no shape (via META_ITEM's loose "am i carrying"
//     clause) but handleMetaQuestion had no matching branch, so it silently
//     fell through to `return null`.
//   R2 (gracefulAdjudication.js) — traced the mixed-margin recurrence and a
//     new success-path sibling (zero fiction content despite a resolved
//     roll) to ONE shared root cause, not two: isInfoSeekingText's
//     INFO_SEEKING_RE had no anchor for birth/age asks ("when were you
//     born") or kinship-noun-only asks ("who was her husband") — a THIRD
//     detection gap, distinct from H-37 R2's "family"/"kin" fix, on the same
//     regex. Because narratorContext.js's ctx.infoSeeking and playloop.js's
//     infoExtractionOutcome both gate on this one function, the single
//     detection gap explained both the mixed-margin recurrence AND the new
//     success-path siblings — one fix, not two.
//   R3 (playloop.js) — traced the raw `location:Pilgrim's Rest Village`
//     artifact leak to lookupGroundedFact's loose ledger-fact substring
//     match: addFact(..., 'scene') stores internal scene-tracking facts as
//     "location:X" strings, factStrings() flattens away the `source` tag,
//     and a player's "village"-anchored question substring-matched the raw
//     internal fact and handed it to the player verbatim. NOT an LLM
//     structured-tag leak (buildSystemPrompt, used by the narration-polish
//     path that actually composes player-facing prose, never emits or
//     mentions <<ITEM_CREATED>> — that tag belongs to buildDMSystemPrompt's
//     separate full-conversation path).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { handleMetaQuestion, isMetaQuestion, isInfoSeekingText } from '../engine/grace/gracefulAdjudication.js';
import { infoExtractionOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}

const packs = loadPacks();

function world(seed = 'u200-fixture') {
  return beginAdventure(newWorld({ seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null } }), packs).world;
}

const GEAR_RE = /worn blade|leather jerkin|lockpick|armed with|no weapon worth the name/i;
const STAT_BLOCK_RE = /MIGHT \d+.*AGILITY \d+/is;

// ── R1 — broaden item/gear-stat answer-binding beyond META_PURSE ───────────

test('U200-R1a: CATCH — 3-way compound (name+class+gear, NO coin) answers all three', () => {
  const w = world();
  const ans = handleMetaQuestion("what's my character's name, class, and what gear do I have on me?", w);
  assert.match(ans, /your name is/i, 'name answered');
  assert.match(ans, /you're a /i, 'class answered');
  assert.match(ans, GEAR_RE, 'gear answered');
});

test('U200-R1b: CATCH — class+gear routed through "give me the sheet" answers class+gear, not the raw stat block', () => {
  const w = world();
  const ans = handleMetaQuestion("You ducked my question — what's my class, and what gear is on me right now? Give me the sheet.", w);
  assert.doesNotMatch(ans, STAT_BLOCK_RE, 'must not dump MIGHT/AGILITY/... when class+gear was asked, not ability scores');
  assert.match(ans, /you're a /i, 'class answered');
  assert.match(ans, GEAR_RE, 'gear answered');
});

test('U200-R1c: CATCH — "what class am I, and list every item I\'m carrying" answers gear, not a "read your sheet" deflection', () => {
  const w = world();
  const ans = handleMetaQuestion("You skipped class and gear again. What class am I, and list every item I'm carrying.", w);
  assert.doesNotMatch(ans, /fine print/i, 'must not deflect to "read your own sheet" once gear was explicitly asked');
  assert.match(ans, GEAR_RE, 'gear answered');
});

test('U200-R1d: CATCH — "what weapons, armor, and gear are on my sheet" answers gear, not the raw stat block', () => {
  const w = world();
  const ans = handleMetaQuestion('Stop deflecting — read me the kit line by line. What weapons, armor, and gear are on my sheet right now?', w);
  assert.doesNotMatch(ans, STAT_BLOCK_RE);
  assert.match(ans, GEAR_RE);
});

test('U200-R1e: CATCH — bare gear yes/no ("am I carrying any weapon or armor, yes or no?") resolves the real loadout, not the stat block', () => {
  const w = world();
  const ans = handleMetaQuestion('The sheet has no equipment section at all, does it? Just tell me straight: am I carrying any weapon or armor, yes or no?', w);
  assert.doesNotMatch(ans, STAT_BLOCK_RE);
  assert.match(ans, GEAR_RE);
});

test('U200-R1f: CATCH — "what do my hands find when I pat myself down" resolves the real loadout, not the stat block', () => {
  const w = world();
  const ans = handleMetaQuestion('Fine, the sheet\'s blank on gear. I check my own belt and body — what do my hands actually find when I pat myself down?', w);
  assert.doesNotMatch(ans, STAT_BLOCK_RE);
  assert.match(ans, GEAR_RE);
});

test('U200-R1g: CATCH — a bare gear yes/no ask with NO "sheet" mention and no compound still resolves (gate/answerer parity)', () => {
  const w = world();
  const ans = handleMetaQuestion('Am I carrying any weapon or armor?', w);
  assert.ok(ans, 'must not silently fall through to null — isMetaQuestion already accepts this shape');
  assert.match(ans, GEAR_RE);
});

test('U200-R1h: gate/answerer parity — isMetaQuestion and handleMetaQuestion agree on the bare gear yes/no shape', () => {
  const text = 'Do I have any gear on me?';
  assert.equal(isMetaQuestion(text), true, 'the gate must accept this shape');
  assert.ok(handleMetaQuestion(text, world()), 'the answerer must have a matching branch, not return null');
});

test('U200-R1i: GUARD — a bare class-only ask is unaffected (no gear erroneously folded in)', () => {
  const w = world();
  const ans = handleMetaQuestion("What's my class?", w);
  assert.match(ans, /,\s+a\s+\w+/i, 'class still answered normally (name, a <archetype> — ...)');
  assert.doesNotMatch(ans, GEAR_RE, 'gear must not be folded in when it was never asked');
});

test('U200-R1j: GUARD — a legitimate raw-stat-block ask (no class/gear named) still returns the real ability scores', () => {
  const w = world();
  const ans = handleMetaQuestion('Give me my sheet.', w);
  assert.match(ans, STAT_BLOCK_RE, 'a plain "give me the sheet" with nothing else named must still report the real scores');
  assert.match(ans, /canonical scores/i);
});

test('U200-R1k: GUARD — "confirm the stats" (explicit stats ask) still returns the real ability scores', () => {
  const w = world();
  const ans = handleMetaQuestion('Confirm the stats.', w);
  assert.match(ans, STAT_BLOCK_RE);
});

test('U200-R1l: GUARD — "armor class" is the AC number, never folded as a character-class or gear-item answer', () => {
  const w = world();
  const ans = handleMetaQuestion("What's my name, and my armor class?", w);
  assert.match(ans, /your name is/i);
  assert.doesNotMatch(ans, /you're a /i, 'must not misread "armor class" as a character-class ask');
  assert.doesNotMatch(ans, GEAR_RE, 'must not misread "armor class" as a gear-item ask');
});

// ── R2 — info-seeking detection: birth/kinship anchors (one root cause) ────

test('U200-R2a: CATCH — the mixed-margin recurrence ("when were you born, and where?") is now detected', () => {
  assert.equal(
    isInfoSeekingText("Corwin, then — you've stopped counting your years, but Kael says you're the oldest in Pilgrim's Rest. So when were you born, and where, if not here?"),
    true,
    'a birth/origin ask with no name/year/date/kin/family token must still route through deliver-or-decline'
  );
});

test('U200-R2b: CATCH — the success-path sibling ("who was her husband?") is now detected', () => {
  assert.equal(
    isInfoSeekingText('Torva — daughter-in-law, you said. So who was her husband, Corwin\'s son, and is he still around?'),
    true,
    'a kinship-noun-only identity ask must route through deliver-or-decline, success or not'
  );
});

test('U200-R2c: CATCH — "give me one name" (not "a name") is now detected', () => {
  assert.equal(
    isInfoSeekingText('Then give me one name, Corwin — your son\'s, Torva\'s dead or living husband. You were born here, you know the village\'s whole memory; surely you remember your own child.'),
    true,
    '"give me ONE name" must match alongside the existing "give me A name"'
  );
});

test('U200-R2d: GUARD — ordinary non-info text stays unflagged', () => {
  assert.equal(isInfoSeekingText('I walk to the well and draw water.'), false);
});

test('U200-R2e: GUARD — the exclude-list still wins over the new kinship anchors', () => {
  assert.equal(isInfoSeekingText('I attack the guard who is her husband.'), false,
    'an attack action must never be reclassified as info-seeking, even with a kinship noun present');
});

test('U200-R2f: GUARD — a kinship noun with no leading question word does not false-positive', () => {
  assert.equal(isInfoSeekingText("I marry the miller's daughter at the village fair."), false,
    'the new anchor words only fire after a who/what/when/where/whose lead-in, never standalone');
});

// ── R3 — structured ledger-fact leak ────────────────────────────────────────

function r3World(facts) {
  return {
    meta: { fate: 0.5 },
    map: { currentNodeId: 'n1', nodes: [{ id: 'n1', name: "Pilgrim's Rest Village", nodeType: 'settlement', settlement: { npcs: [] } }], edges: [] },
    scene: { objective: '', location: "Pilgrim's Rest Village" }, combat: null, party: [],
    ledger: { facts, threats: [], questions: [] }, structures: { byId: {} }, factions: [], instrument: { threads: [], motifs: [] },
    time: { turn: 1 }, pack: { primaryId: 'fantasy' }
  };
}

test('U200-R3a: CATCH — a structured ledger fact ("location:X") never leaks verbatim as a delivered answer', () => {
  const w = r3World([{ text: "location:Pilgrim's Rest Village", source: 'scene', t: 0 }]);
  const ans = infoExtractionOutcome(w, 'What village or town were you born in, even just the name?', 'success');
  assert.ok(ans, 'must still produce a real answer (a grounded fact or an honest decline), never null');
  assert.doesNotMatch(ans, /location\s*:/i, 'must never echo the raw internal key:value fact verbatim');
});

test('U200-R3a-guard: PASS — a real (non-structured) ledger fact still surfaces via the loose match', () => {
  const w = r3World([{ text: 'The smithy was built by Old Hask after the last great fire, some forty years back.', source: 'resolution', t: 0 }]);
  const ans = infoExtractionOutcome(w, 'Who built the smithy, and what year did the fire start?', 'success');
  assert.match(ans, /smithy|old hask/i, 'a real grounded fact must still be delivered, not declined or dropped');
});

test('U200-R3b: GUARD — with no facts at all, an info-seeking ask still gets an honest in-fiction decline, never a crash', () => {
  const w = r3World([]);
  const ans = infoExtractionOutcome(w, 'What village or town were you born in, even just the name?', 'success');
  assert.ok(ans, 'must return a real decline string, not null/undefined');
  assert.doesNotMatch(ans, /location\s*:/i);
});
