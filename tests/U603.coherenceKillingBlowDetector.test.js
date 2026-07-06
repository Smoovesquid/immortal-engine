// U603 — CG-DEATH: the killing-blow prose ⇄ death-fact detector (DEATH-3,
// docs/DEATH_CONTRACT.md §3 final bullet + §6 falsifiers). The DETECTOR-CATCHES-IT
// test, proven on FIXTURES before the live validator ever sees it (the brief: "prove
// the detector on fixtures FIRST"). Invariant I makes the DEATH FACT authoritative over
// the prose; §6 marks each contradiction RED. This comparator makes them measurable:
//   (A) MEANS contradiction — an arrow/piercing fact narrated as an axe/cutting kill.
//   (B) BEG FROM THE SPEECHLESS — a plea in the mouth of a canCommunicate:false foe.
//   (C) BEG FROM THE UN-BEGGED — the foe pleading while the fact's stance isn't begging.
//   (D) MERCY READ AS TORTURE — intent:mercy narrated as a drawn-out cruel end.
//   (E) WORSE READ AS GENTLE — intent:worse narrated as a painless/merciful end.
//
// Pure-function unit tests over synthetic turn fixtures, mirroring U507/U388's shape
// exactly: positive (must flag, STRUCTURAL) + guard (must NOT) per branch, PLUS the
// graceful-degradation guard (no deathFact -> DORMANT) and the tier + live-wiring proof
// (tierOf CG-DEATH = structural; coherenceRejects BLOCKS a contradiction and the swap
// gate picks a strictly-better fallback). No LLM, no server, no engine boot — $0 and
// deterministic.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectKillingBlowDesync, runDetectors, SINGLE_TURN_DETECTORS,
  tierOf, TIER, CLASS_LABELS,
} from '../engine/coherence/checks.js';
import { coherenceRejects, fallbackIsBetter } from '../engine/coherence/validator.js';

// Minimal turn fixture builder — only the fields the detector reads (mirrors U507's).
function turn(i, { player = '', dm = '', mechanics = '', canon = {} } = {}) {
  return {
    type: 'turn', seed: 's', persona: 'p', i, player, dm, mechanics, route: 'action',
    canon: { npcsPresent: [], ...canon }, judgeError: false, v1: null, v2: null,
  };
}

// A death-fact ground-truth bundle (the shape buildCanonGroundTruth projects).
function withFact(fact = {}) {
  return {
    deathFact: {
      victim: 'the brigand', isPlayer: false, canCommunicate: true,
      means: 'the arrow', meansType: 'piercing', woundRegion: 'the throat',
      stance: 'fighting', intent: 'clean',
      ...fact,
    },
  };
}

// ── (A) MEANS contradiction — arrow fact, axe prose ──────────────────────────
test('U603: CG-DEATH flags an arrow/piercing fact narrated as an axe/cutting kill', () => {
  const flags = detectKillingBlowDesync([turn(3, {
    dm: 'Your axe opens the brigand from shoulder to hip; he drops in a spray of blood.',
    canon: withFact({ means: 'the arrow', meansType: 'piercing' }),
  })]);
  assert.equal(flags.length, 1, 'the swapped weapon must be caught');
  assert.equal(flags[0].class, 'CG-DEATH');
  assert.equal(flags[0].canonField, 'deathFact.meansType');
  assert.equal(flags[0].severity, 'fail');
});

test('U603: CG-DEATH flags a fire fact narrated as a blade', () => {
  const flags = detectKillingBlowDesync([turn(3, {
    dm: 'A single sword-stroke severs the cultist where he kneels.',
    canon: withFact({ means: 'the flame', meansType: 'fire' }),
  })]);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].class, 'CG-DEATH');
});

test('U603 GUARD: a piercing fact narrated WITH piercing prose does NOT flag', () => {
  const flags = detectKillingBlowDesync([turn(3, {
    dm: 'The arrow punches through his throat and he folds, done.',
    canon: withFact({ means: 'the arrow', meansType: 'piercing' }),
  })]);
  assert.equal(flags.length, 0, 'the right family must never flag');
});

test('U603 GUARD: a family-NEUTRAL kill line (no named weapon) does NOT flag', () => {
  const flags = detectKillingBlowDesync([turn(3, {
    dm: 'The killing blow lands true and the brigand drops where he stood, the wound mortal.',
    canon: withFact({ means: 'the arrow', meansType: 'piercing' }),
  })]);
  assert.equal(flags.length, 0, 'a family-neutral wound line is not a contradiction');
});

test('U603 GUARD: prose naming BOTH the real means and another word does NOT flag', () => {
  // The real means (arrow) IS named — the incidental "blade" of a drawn dagger elsewhere
  // must not trip the swap, because the fact-family word is present (it did not swap).
  const flags = detectKillingBlowDesync([turn(3, {
    dm: 'The arrow finds his throat even as his own blade falls from his hand; he drops.',
    canon: withFact({ means: 'the arrow', meansType: 'piercing' }),
  })]);
  assert.equal(flags.length, 0, 'the real means is named — no swap, no flag');
});

// ── (B) BEG FROM THE SPEECHLESS ──────────────────────────────────────────────
test('U603: CG-DEATH flags a plea from a foe the fact marks canCommunicate:false', () => {
  const flags = detectKillingBlowDesync([turn(4, {
    dm: 'The dire wolf whimpers and begs for its life before your spear finds its heart.',
    canon: withFact({ victim: 'the dire wolf', canCommunicate: false, means: 'the spear', meansType: 'piercing' }),
  })]);
  assert.equal(flags.length, 1, 'a beg from the speechless is red (§6)');
  assert.equal(flags[0].class, 'CG-DEATH');
  assert.equal(flags[0].canonField, 'deathFact.canCommunicate');
});

test('U603 GUARD: a speechless foe dying WITHOUT a plea does NOT flag', () => {
  const flags = detectKillingBlowDesync([turn(4, {
    dm: 'The dire wolf twists once as the spear goes through, then lies still.',
    canon: withFact({ victim: 'the dire wolf', canCommunicate: false, means: 'the spear', meansType: 'piercing' }),
  })]);
  assert.equal(flags.length, 0);
});

test('U603 GUARD: the narrator saying "mercy" (player showing it) is NOT a foe plea', () => {
  // "you show it mercy" is the player's act, not the foe begging — precision guard.
  const flags = detectKillingBlowDesync([turn(4, {
    dm: 'You show the wolf a clean mercy; the spear ends it before it can suffer.',
    canon: withFact({ victim: 'the wolf', canCommunicate: false, means: 'the spear', meansType: 'piercing', intent: 'mercy' }),
  })]);
  assert.equal(flags.length, 0, 'the player showing mercy is not the foe begging');
});

// ── (C) BEG FROM THE UN-BEGGED ───────────────────────────────────────────────
test('U603: CG-DEATH flags the foe begging while the fact stance is not begging', () => {
  const flags = detectKillingBlowDesync([turn(5, {
    dm: 'The brigand pleads for his life, hands raised, as the arrow takes him.',
    canon: withFact({ stance: 'fighting' }),
  })]);
  assert.equal(flags.length, 1, 'a plea the fact does not hold is red (§6)');
  assert.equal(flags[0].class, 'CG-DEATH');
  assert.equal(flags[0].canonField, 'deathFact.victimStance');
});

test('U603 GUARD: a foe begging WHEN the fact stance IS begging does NOT flag', () => {
  const flags = detectKillingBlowDesync([turn(5, {
    dm: 'The brigand begs for a quick end; you give it, the arrow clean through his throat.',
    canon: withFact({ stance: 'begging', intent: 'mercy' }),
  })]);
  assert.equal(flags.length, 0, 'an honored plea the fact holds is correct');
});

test('U603 GUARD: a defiant foe (no plea in prose) does NOT flag', () => {
  const flags = detectKillingBlowDesync([turn(5, {
    dm: 'He spits at your boots and will not look away; the arrow ends the defiance.',
    canon: withFact({ stance: 'defiant' }),
  })]);
  assert.equal(flags.length, 0);
});

// ── (D) MERCY READ AS TORTURE ────────────────────────────────────────────────
test('U603: CG-DEATH flags a mercy fact narrated as torture', () => {
  const flags = detectKillingBlowDesync([turn(6, {
    dm: 'You draw it out, mutilating him slowly, piece by piece, until he stops screaming.',
    canon: withFact({ intent: 'mercy', stance: 'begging' }),
  })]);
  assert.equal(flags.length, 1, 'a clean mercy read as torture is red (the brief)');
  assert.equal(flags[0].class, 'CG-DEATH');
  assert.equal(flags[0].canonField, 'deathFact.killerIntent');
});

test('U603 GUARD: a mercy fact narrated GORILY but cleanly does NOT flag', () => {
  // Gore is LAW — a mercy kill is allowed to be bloody. Only deliberate-cruelty language
  // (torture/mutilation/drawn-out) is the contradiction, not a gory-but-quick wound.
  const flags = detectKillingBlowDesync([turn(6, {
    dm: 'One clean stroke; the arrow punches through his throat and the blood comes fast, and it is over quickly.',
    canon: withFact({ intent: 'mercy', stance: 'begging' }),
  })]);
  assert.equal(flags.length, 0, 'a gory-but-clean mercy is honest, not torture');
});

// ── (E) WORSE READ AS GENTLE ─────────────────────────────────────────────────
test('U603: CG-DEATH flags a worse fact narrated as a painless/merciful end', () => {
  const flags = detectKillingBlowDesync([turn(7, {
    dm: 'You give him a merciful, painless death, without cruelty, and he slips away peacefully.',
    canon: withFact({ intent: 'worse', stance: 'begging' }),
  })]);
  assert.equal(flags.length, 1, 'the example-making read as mercy is red');
  assert.equal(flags[0].class, 'CG-DEATH');
  assert.equal(flags[0].canonField, 'deathFact.killerIntent');
});

test('U603 GUARD: a worse fact narrated as cruel does NOT flag', () => {
  const flags = detectKillingBlowDesync([turn(7, {
    dm: 'You do not make it quick; what you do to him is meant to be seen, and it is.',
    canon: withFact({ intent: 'worse', stance: 'begging' }),
  })]);
  assert.equal(flags.length, 0);
});

// ── graceful degradation + tier + live wiring ────────────────────────────────
test('U603: DORMANT when the bundle carries no deathFact (no kill / pre-DEATH-3)', () => {
  const flags = detectKillingBlowDesync([turn(8, {
    dm: 'Your axe opens him from shoulder to hip; he pleads and is mutilated.',
    canon: { npcsPresent: [] }, // no deathFact field at all
  })]);
  assert.equal(flags.length, 0, 'no ground truth → the comparator stays silent');
});

test('U603: CG-DEATH is STRUCTURAL tier + labeled + fires under the single-turn bank', () => {
  assert.equal(tierOf('CG-DEATH'), TIER.STRUCTURAL, 'contradictions block');
  assert.ok(CLASS_LABELS['CG-DEATH'], 'the shadow-log label is threaded');
  // It must run inside the live single-turn bank (the shadow observer / coherenceRejects).
  const flags = runDetectors([turn(9, {
    dm: 'Your axe opens the brigand from shoulder to hip.',
    canon: withFact({ means: 'the arrow', meansType: 'piercing' }),
  })], SINGLE_TURN_DETECTORS);
  assert.ok(flags.some(f => f.class === 'CG-DEATH'), 'CG-DEATH runs in the single-turn bank');
});

test('U603: coherenceRejects BLOCKS a contradiction, and the fallback beats it (swap gate)', () => {
  const world = { meta: { seed: 's' } };
  const canon = withFact({ means: 'the arrow', meansType: 'piercing' });
  // The offending candidate: an axe reading of an arrow kill.
  const bad = 'Your axe opens the brigand from shoulder to hip; he drops.';
  const verdict = coherenceRejects({ world, candidate: bad, outcome: {}, _canonForTest: canon });
  assert.equal(verdict.blocks, true, 'a means contradiction blocks live');
  assert.ok(verdict.blockingFails.some(p => p.class === 'CG-DEATH'), 'CG-DEATH is the blocker');
  // The honest fallback (an arrow reading) must be strictly better (fewer blocking fails).
  const good = 'The arrow punches through his throat and he folds, done.';
  const goodVerdict = coherenceRejects({ world, candidate: good, outcome: {}, _canonForTest: canon });
  assert.equal(goodVerdict.blockingFails.length, 0, 'the honest kill line has no CG-DEATH block');
  assert.equal(fallbackIsBetter(verdict, goodVerdict), true, 'the cure beats the disease (CG-2b)');
});
