// U238 — gate-17 (newbie t8): "go talk to that stranger" from inside a building bounced
// "That way is blocked from here" instead of resolving the intent (THE_DM_TEST violation).
//
// ROOT CAUSE (deterministic, two parts):
//   (1) The interior-move gate classified "go talk to X" as a cardinal move (the leading
//       "go") and bounced; its skip-guard (approachPresentNpcRef) excludes HOSTILE NPCs,
//       so a wary lurker ("that stranger watching from the edges") wasn't recognized as a
//       talk target. Fix: talkOrApproachResolvesPresentNpc (hostile-inclusive, via the
//       same resolveNpcAtCurrentNode the talk path uses) also skips the interior-move gate.
//   (2) The long descriptor "that stranger watching from the edges" didn't resolve to the
//       lurker. Fix: stripRefDescriptors collapses a PERSON reference's demonstrative +
//       trailing descriptor clause to its head noun ("stranger"), PERSON-gated so place
//       names ("The Standing Stones") are left intact (U99 multi-hop travel must not break).
//
// Pure assertion on end-to-end playerMove — no LLM, deterministic. See gate-17 ledger.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { playerMove } from '../engine/playloop.js';
import { PACKS, interiorNpcWorld, villageBakerWorld } from '../scripts/convergence/fixtures.mjs';

// Player INSIDE a building at the node; a hostile lurker ("Lingerer", role stranger) present.
function interiorWithLurker() {
  const w = interiorNpcWorld();
  const node = w.map.nodes.find(n => n.id === w.map.currentNodeId);
  node.settlement.npcs.push({ id: 'npc_lurk', name: 'Lingerer', role: 'stranger', hostile: true, conversationState: { trustLevel: 0 } });
  return ensureWorld(w);
}

const out = (world, text) => {
  const r = playerMove(world, PACKS, text);
  return { nar: String(r.output?.narration || ''), mech: String(r.output?.mechanics || ''), world: r.world };
};
const BLOCKED_RE = /that way is blocked|path you'?d need|is blocked from/i;
const DIALOGUE_RE = /\[dialogue enter|approach .* the stranger|wary eyes/i;

// ── 1. The gate-17 input — approach a wary lurker from inside, no logistics wall ──

test('U238-01: "go talk to that stranger watching from the edges" (from inside) engages, not "blocked"', () => {
  const { nar } = out(interiorWithLurker(), 'Okay, forget them — I want to go talk to that stranger watching from the edges.');
  assert.doesNotMatch(nar, BLOCKED_RE, `must not bounce a logistics wall: ${nar}`);
  assert.match(nar, DIALOGUE_RE, `must engage the stranger: ${nar}`);
});

test('U238-02: "I approach the stranger lurking by the door" engages too', () => {
  const { nar } = out(interiorWithLurker(), 'I approach the stranger lurking by the door.');
  assert.doesNotMatch(nar, BLOCKED_RE);
  assert.match(nar, DIALOGUE_RE);
});

test('U238-03: a non-hostile approach with "go" still works from inside', () => {
  const { nar } = out(interiorWithLurker(), 'I go talk to Mira.');
  assert.doesNotMatch(nar, BLOCKED_RE);
  assert.match(nar, /\[dialogue enter|approach Mira|Mira/i, `must reach Mira: ${nar}`);
});

// ── 2. Diverge — real interior moves and place travel must be unaffected ─────────

test('U238-10: a real cardinal interior move still moves (not hijacked into dialogue)', () => {
  const { nar, mech } = out(interiorWithLurker(), 'go north');
  assert.doesNotMatch(nar + ' ' + mech, /\[dialogue enter/i, `cardinal move must not enter dialogue: ${nar}`);
});

test('U238-11: an interior place-move is not read as an NPC approach', () => {
  // "the back room" / "the next room" carry no person head-noun → stripRefDescriptors
  // leaves them intact and they do not resolve to an NPC.
  for (const t of ['enter the next room', 'go to the back room']) {
    const { nar, mech } = out(interiorWithLurker(), t);
    assert.doesNotMatch(nar + ' ' + mech, /\[dialogue enter \| Lingerer/i, `"${t}" must not enter dialogue with the lurker: ${nar}`);
  }
});

test('U238-12: a place name with a participle word ("go to the standing stones") is NOT mangled into an NPC', () => {
  // PERSON-gated stripRefDescriptors leaves "the standing stones" intact (no person noun),
  // so it never resolves to a present NPC and is never hijacked into dialogue.
  const { mech } = out(villageBakerWorld(), 'go to the standing stones');
  assert.doesNotMatch(mech, /\[dialogue enter/i, `a place name must not be hijacked into dialogue: ${mech}`);
});
