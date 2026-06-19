// U202 — H-39 deliver-or-decline by recall, not enumeration.
//
// BASECAMP design-review verdict (docs/AGENT_CHANGELOG.md 2026-06-19, commit b5ca3d5):
// the recurring DM_TEST_DEADEND content-free filler ("it comes off cleanly" / "it
// lands, after a fashion" / "that one's yours to call") is a detector-RECALL defect,
// not a judge artifact. isInfoSeekingText (gracefulAdjudication.js) is a precision-
// tuned allowlist that keeps missing fresh phrasings (H-35→H-38a whack-a-mole); the
// deliver-or-decline machinery behind it is already correct once reached.
//
// Three changes, all deterministic:
//   (i)   isInfoSeekingText broadened with a generalizable knowledge-verb-phrase net
//         ("tell me about X", "what do you know about X", "what happened/became to/of
//         X") instead of another closed noun enumeration — plus the playloop.js
//         meta-question gate's npcAddressedRecap bypass extended to defer to this
//         net too (META_RECAP is unanchored "what happened" and was swallowing
//         third-party historical questions before they ever reached deliver-or-
//         decline). Action-feasibility verbs (climb/jump/etc.) stay excluded so
//         "can I climb this wall?" keeps rolling as an action, never a "no record"
//         decline.
//   (ii)  genericGroundedOutcome's last-resort resolver now declines in-fiction for
//         ANY info-seeking text that still reaches it, instead of the gen:s/gen:m/
//         gen:f atmosphere bank — belt-and-suspenders against a FUTURE detector miss.
//   (iii) META_ADVICE's content-free "that one's yours to call" hedge replaced with a
//         confident stance derived from real state (hostile NPCs / open ledger
//         threats / world tone) — never an invented fact.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, infoExtractionOutcome, genericGroundedOutcome } from '../engine/playloop.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { isInfoSeekingText, handleMetaQuestion } from '../engine/grace/gracefulAdjudication.js';

function loadPacks() {
  const man = normalizeManifest(JSON.parse(fs.readFileSync('packs/manifest.json', 'utf8')));
  const byId = {};
  for (const p of man.packs) byId[p.id] = normalizePack(JSON.parse(fs.readFileSync('.' + p.path, 'utf8')));
  return byId;
}
const packs = loadPacks();

function freshWorld(seed) {
  return beginAdventure(newWorld({
    seed, fate: 0.3, mode: 'escape', pack: { primaryId: 'fantasy', mixerId: null }
  }), packs).world;
}

// A real, present, named NPC so a grounded answer (commonKnowledgeAnswer's
// "place" branch) is actually reachable — mirrors U195's withCorwin fixture.
function withCorwin(seed) {
  const w = freshWorld(seed);
  const nodeId = String(w.map?.currentNodeId ?? '');
  const nodes = Array.isArray(w.map?.nodes) ? [...w.map.nodes] : [];
  const idx = nodes.findIndex(n => n && n.id === nodeId);
  assert.ok(idx >= 0, 'test world has a current node');
  const node = nodes[idx];
  nodes[idx] = {
    ...node,
    settlement: {
      ...(node.settlement || {}),
      decompressed: true,
      npcs: [{
        id: 'npc_corwin', name: 'Corwin', role: 'healer', hostile: false,
        combatProfile: { maxHp: 20, damage: 1, canParley: false },
        personality: {}, conversationState: { metPlayer: false, trustLevel: 5, topicsDiscussed: [] },
        knowledgeGraph: [], secrets: []
      }]
    }
  };
  return ensureWorld({ ...w, map: { ...w.map, nodes } });
}

// Covers all 9 genericGroundedOutcome gen:s/gen:m/gen:f variants verbatim
// (playloop.js ~L4978-4981), not just the two or three quoted in the packet —
// a regex that only catches the example phrasings would itself be enumeration.
const ATMOSPHERE_BANK_RE = /it goes your way|it comes off cleanly|way ahead opens a little|it half-works|though not what you hoped|after a fashion|doesn't come off the way you meant|falls short here in|doesn't give it to you|put the question to those nearby|something real to go on|\bask around\b|low hum threads/i;
const DECLINE_RE = /no record|can't say|can't rightly say|wouldn't know|couldn't tell you|lost to me|nobody's ever told|no answer|won't be drawn|done with that question|done talking about it|won't say another word|subject is closed|no one here would know|not written anywhere|matter stays unsettled|question's closed|matter's done|same answer|i don't have it|i told you/i;
const OLD_ADVICE_HEDGE_RE = /yours to call|go with your gut/i;

// ── (i) isInfoSeekingText — MUST-MATCH list ──────────────────────────────────

test('U202-01: MUST-MATCH — already-passing kinship/name asks stay green', () => {
  assert.equal(isInfoSeekingText('who was her husband?'), true);
  assert.equal(isInfoSeekingText("who was Torva's husband?"), true);
  assert.equal(isInfoSeekingText('give me one name'), true);
});

test('U202-02: MUST-MATCH — "what happened to the people who used to live here?" routes to recall, not enumeration', () => {
  assert.equal(isInfoSeekingText('what happened to the people who used to live here?'), true);
});

test('U202-03: MUST-MATCH — "tell me about the war" routes to recall', () => {
  assert.equal(isInfoSeekingText('tell me about the war'), true);
});

test('U202-04: MUST-MATCH — "what do you know about this place?" routes to recall', () => {
  assert.equal(isInfoSeekingText('what do you know about this place?'), true);
});

// ── (i) isInfoSeekingText — MUST-NOT-MATCH list (stay actionable) ───────────

test('U202-10: MUST-NOT-MATCH — action-feasibility asks never get a "no record" decline', () => {
  assert.equal(isInfoSeekingText('can I climb this wall?'), false);
  assert.equal(isInfoSeekingText('could I jump that gap?'), false);
});

test('U202-11: MUST-NOT-MATCH — combat/social action verbs stay excluded', () => {
  assert.equal(isInfoSeekingText('should I attack him?'), false);
});

test('U202-12: MUST-NOT-MATCH — bare imperatives are not question-shaped at all', () => {
  assert.equal(isInfoSeekingText('I search the room'), false);
  assert.equal(isInfoSeekingText('I climb the wall'), false);
});

test('U202-13: MUST-NOT-MATCH — direction prompts stay actionable, not fact-seeking', () => {
  assert.equal(isInfoSeekingText('what do I do now?'), false);
  assert.equal(isInfoSeekingText('what now?'), false);
});

test('U202-14: MUST-NOT-MATCH — a genuine environment survey is untouched (isExploreIntent owns this)', () => {
  assert.equal(isInfoSeekingText('what do I see around me?'), false);
  assert.equal(isInfoSeekingText('is there a window?'), false);
});

// ── (i) integration — the three real dead-ends, resolved live through playerMove ──

test('U202-20: integration — "what happened to the people who used to live here?" no longer dead-ends on the bare recap', () => {
  const w = freshWorld('u202-20');
  const out = playerMove(w, packs, 'What happened to the people who used to live here?').output;
  assert.doesNotMatch(String(out.narration), /Nothing's happened yet/i,
    `must not be swallowed by the unanchored META_RECAP dead-end: ${out.narration}`);
  assert.doesNotMatch(String(out.narration), ATMOSPHERE_BANK_RE,
    `must not fall to the atmosphere bank either: ${out.narration}`);
});

test('U202-21: integration — "tell me about the war" no longer falls to the gen:s atmosphere floor', () => {
  const w = freshWorld('u202-21');
  const out = playerMove(w, packs, 'tell me about the war').output;
  assert.doesNotMatch(String(out.narration), ATMOSPHERE_BANK_RE,
    `must not fall to the atmosphere bank: ${out.narration}`);
});

test('U202-22: integration — "what do you know about this place?" no longer gets swallowed by the generic room survey', () => {
  const w = freshWorld('u202-22');
  const out = playerMove(w, packs, 'What do you know about this place?').output;
  assert.notEqual(out.mechanics, 'observe only — no roll, state unchanged',
    `must not be swept into isExploreIntent's survey branch: ${out.mechanics}`);
  assert.doesNotMatch(String(out.narration), ATMOSPHERE_BANK_RE,
    `must not fall to the atmosphere bank: ${out.narration}`);
});

test('U202-23: integration false-positive guard — "can I climb this wall?" still rolls as an action, never pre-roll-suppressed', () => {
  const w = freshWorld('u202-23');
  const out = playerMove(w, packs, 'Can I climb this wall?').output;
  assert.doesNotMatch(String(out.mechanics || ''), /info-check/,
    `a feasibility action must not be intercepted by the info-check pre-roll gate: ${out.mechanics}`);
});

test('U202-24: integration false-positive guard — a real recap with no NPC named still recaps (H-34 R1 stays green)', () => {
  const w = freshWorld('u202-24');
  const out = playerMove(w, packs, 'What happened? What did I just do?').output;
  assert.match(String(out.narration), /Nothing's happened yet/i,
    `a genuine player's-own-last-turn recap must still recap: ${out.narration}`);
});

// ── (i) deliver-or-decline never wrongly declines a grounded ask ────────────

test('U202-30: a grounded "what do you know about this place?" DELIVERS the real place description, never declines', () => {
  const w = withCorwin('u202-30');
  const narr = infoExtractionOutcome(w, 'What do you know about this place?', 'success');
  assert.ok(narr, 'must produce non-null narration');
  assert.match(narr, /This is /i, `must deliver the real grounded place description: ${narr}`);
  assert.doesNotMatch(narr, DECLINE_RE, `a grounded ask must never be declined: ${narr}`);
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, `must never read as the atmosphere bank: ${narr}`);
});

test('U202-31: an ungrounded "tell me about the war" declines in-fiction, never invents', () => {
  // A bare minimal world (no map/settlement/ledger at all — mirrors U197's
  // baseWorld()) instead of freshWorld(): a real generated NPC can carry a
  // thematic knowledgeGraph riff on common nouns like "war" (a good sign for
  // the engine — see U202-30/U202-32's "live here" case), which would
  // legitimately DELIVER instead of decline. This case is specifically about
  // the no-grounding-at-all branch, so it must guarantee there is nothing to
  // find.
  const w = { party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }], meta: {} };
  const narr = infoExtractionOutcome(w, 'tell me about the war', 'success');
  assert.ok(narr, 'must produce non-null narration');
  assert.match(narr, DECLINE_RE, `must give an explicit in-fiction decline: ${narr}`);
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, `must never fall to the atmosphere bank: ${narr}`);
});

// ── (ii) genericGroundedOutcome fall-through safety net ─────────────────────

test('U202-40: safety net — an info-seeking question reaching the last-resort resolver declines, never gen:s', () => {
  const w = freshWorld('u202-40');
  const narr = genericGroundedOutcome(w, 'tell me about the war', 'success');
  assert.match(narr, DECLINE_RE, `must decline, not emit success atmosphere: ${narr}`);
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, `must never read as gen:s atmosphere: ${narr}`);
});

test('U202-41: safety net — same info-seeking question on a mixed outcome also declines, never gen:m', () => {
  const w = freshWorld('u202-41');
  const narr = genericGroundedOutcome(w, 'tell me about the war', 'mixed');
  assert.match(narr, DECLINE_RE, `must decline, not emit mixed atmosphere: ${narr}`);
  assert.doesNotMatch(narr, ATMOSPHERE_BANK_RE, `must never read as gen:m atmosphere: ${narr}`);
});

test('U202-42: safety net — a FAILED info-seeking question declines too, never the gen:f atmosphere', () => {
  const w = freshWorld('u202-42');
  const narr = genericGroundedOutcome(w, 'tell me about the war', 'failure');
  assert.match(narr, DECLINE_RE, `must decline, not emit failure atmosphere: ${narr}`);
  assert.doesNotMatch(narr, /doesn't come off the way you meant|falls short here|doesn't give it to you/i,
    `must never read as the gen:f atmosphere bank: ${narr}`);
});

test('U202-43: safety net false-positive guard — a non-info-seeking action is unaffected (still gets real gen:s atmosphere)', () => {
  const w = freshWorld('u202-43');
  const narr = genericGroundedOutcome(w, 'I steady my breathing', 'success');
  assert.doesNotMatch(narr, DECLINE_RE, `a non-info action must not be declined: ${narr}`);
});

// ── (iii) META_ADVICE confident stance ───────────────────────────────────────

function adviceWorld({ hostile = false, threats = [], fate = 0.5 } = {}) {
  return {
    map: {
      currentNodeId: 'n1',
      nodes: [{
        id: 'n1', name: 'Pilgrim\'s Rest Village', nodeType: 'settlement',
        settlement: { npcs: hostile ? [{ id: 'lurker', name: 'the Lingerer', role: 'stranger', hostile: true }] : [] }
      }]
    },
    party: [{ stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 } }],
    ledger: { facts: [], threats, questions: [] },
    meta: { fate }
  };
}

test('U202-50: a hostile/lurker present yields a confident "yes, stay alert" stance, never "yours to call"', () => {
  const w = adviceWorld({ hostile: true, fate: 0.3 });
  const ans = handleMetaQuestion('Should I be worried, going further in?', w);
  assert.match(ans, /keep your eyes open/i, `must give a committed danger stance: ${ans}`);
  assert.doesNotMatch(ans, OLD_ADVICE_HEDGE_RE, `must not be the old non-committal hedge: ${ans}`);
});

test('U202-51: an open ledger threat yields the same confident danger stance', () => {
  const w = adviceWorld({ threats: [{ text: 'bandits on the north road', level: 2, t: 0 }], fate: 0.2 });
  const ans = handleMetaQuestion('Should I be worried, going further in?', w);
  assert.match(ans, /keep your eyes open/i, `an active ledger threat must read as danger: ${ans}`);
  assert.doesNotMatch(ans, OLD_ADVICE_HEDGE_RE, `must not be the old non-committal hedge: ${ans}`);
});

test('U202-52: a grim/blood world tone alone (no hostiles, no threats) still yields the danger stance', () => {
  const w = adviceWorld({ fate: 0.8 }); // blood band
  const ans = handleMetaQuestion('Should I be worried, going further in?', w);
  assert.match(ans, /keep your eyes open/i, `blood-tone world must read as danger: ${ans}`);
  assert.doesNotMatch(ans, OLD_ADVICE_HEDGE_RE);
});

test('U202-53: genuinely calm — no hostiles, no threats, cooperative tone — yields a confident calm stance, never the hedge', () => {
  const w = adviceWorld({ fate: 0.1 }); // cooperative band
  const ans = handleMetaQuestion('Should I be worried, going further in?', w);
  assert.match(ans, /nothing here's looking to move on you|you're alright for the moment/i,
    `must give a committed calm stance: ${ans}`);
  assert.doesNotMatch(ans, OLD_ADVICE_HEDGE_RE, `must not be the old non-committal hedge: ${ans}`);
});

test('U202-54: regression guard — "should I talk to them" still names the present NPC (unchanged branch)', () => {
  const w = adviceWorld({ fate: 0.5 });
  w.map.nodes[0].settlement.npcs = [{ id: 'corwin', name: 'Corwin', role: 'representative', hostile: false }];
  const ans = handleMetaQuestion('Should I talk to them, or is that a bad idea?', w);
  assert.match(ans, /worth a try/i, `the talk-to-NPC branch must be untouched: ${ans}`);
  assert.match(ans, /Corwin/, `must still name the real present NPC: ${ans}`);
});
