// U236 — gate-15 RL-t12: a threat/attack aimed at a present NPC must break the active
// dialogue, not surface the dialogue PARTNER's role-talk script.
//
// Gate-15 RL t12 (in dialogue with Corwin Boneknit, the Lingerer lurking):
//   "I keep the blade up and my eyes on the Lingerer. Corwin, I didn't ask you.
//    Lingerer — last chance to talk before I make you."
//   → DM: Corwin Boneknit talks about smiths' quenching/tempering  [dialogue ask | role_smith_trade_talk]
//
// ROOT CAUSE (deterministic): isDialogueBreakingIntent only broke on movement/physics,
// so a threat/attack at a DIFFERENT present NPC fell to the "ask the partner" branch —
// even a bare "I attack the Lingerer" was swallowed as a deflected ask to Corwin.
//
// FIX: isDialogueBreakingIntent now also breaks on (a) an explicit attack on any present
// NPC (detectAttackBeginIntent/AnyIntent), and (b) a threat/ultimatum aimed at a present
// NPC who is NOT the dialogue partner. The conversation ends out loud, then the action
// re-resolves against the named foe. detectApproach also recognizes the ultimatum shape
// ("last chance to talk before I make you") so the redirected threat resolves AS an
// intimidate against its target, never generic atmosphere. A threat at the PARTNER, or
// an advice/permission question ("should I threaten the Lingerer?"), stays in dialogue.
//
// Pure assertion on end-to-end playerMove — no LLM, deterministic. See
// docs/CAPABILITY_LEDGER.md gate-15.

import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove } from '../engine/playloop.js';

const PACKS = {
  fantasy: {
    id: 'fantasy',
    toneWords: { cooperative: ['warm'], grim: ['cold'], blood: ['black'] },
    starterLocations: ['village'], starterObjectives: ['survive'],
    skills: ['force'], locations: ['village'], objectives: ['survive'],
    complications: ['danger'], npcArchetypes: ['baker'], sensoryMotifs: ['flour']
  }
};

// In dialogue with Corwin Boneknit (smith, trust 7); the hostile Lingerer is present.
function dialogueLingererWorld() {
  const base = beginAdventure(newWorld({
    seed: 'u236', fate: 0.3, campaignId: 'u236', mode: 'escape',
    pack: { primaryId: 'fantasy', mixerId: null }
  }), PACKS).world;
  const node = {
    id: 'u236_node', name: "Pilgrim's Rest Test Village", nodeType: 'settlement', discovered: true,
    settlement: {
      decompressed: true,
      npcs: [
        { id: 'npc_corwin', name: 'Corwin Boneknit', role: 'smith', occupation: 'smith', hostile: false, conversationState: { trustLevel: 7, metPlayer: true } },
        { id: 'npc_lingerer', name: 'Lingerer', role: 'stranger', hostile: true, conversationState: { trustLevel: 0 } }
      ]
    }
  };
  return ensureWorld({
    ...base,
    map: { ...base.map, currentNodeId: node.id, nodes: [...(base.map?.nodes || []), node] },
    combat: { ...(base.combat || {}), active: false },
    scene: { ...(base.scene || {}), interior: null, dialogue: { npcId: 'npc_corwin', turnsInDialogue: 2, topicsCount: 1 } }
  });
}

const out = (text) => {
  const r = playerMove(dialogueLingererWorld(), PACKS, text);
  const o = r.output || r;
  return { nar: String(o.narration || ''), mech: String(o.mechanics || '') };
};

const DIALOGUE_ASK_RE = /\[dialogue ask/i;
const STEP_AWAY_RE = /step away from Corwin/i;
const INTIMIDATE_RE = /\[social:intimidate/i;
const COMBAT_RE = /\[strike:|\[enemy:|combat/i;

// ── 1. The gate-15 RL-t12 input — breaks toward the Lingerer, NOT Corwin's role-talk ──

test('U236-01: the RL-t12 ultimatum breaks dialogue and engages the Lingerer (not Corwin)', () => {
  const { nar, mech } = out("I keep the blade up and my eyes on the Lingerer. Corwin, I didn't ask you. Lingerer — last chance to talk before I make you.");
  assert.doesNotMatch(mech, DIALOGUE_ASK_RE, `must not surface Corwin's dialogue-ask: ${mech}`);
  assert.doesNotMatch(mech, /trade_talk|role_smith/i, `must not surface Corwin's role-talk script: ${mech}`);
  assert.match(nar, STEP_AWAY_RE, `must close the Corwin conversation out loud: ${nar}`);
  assert.match(nar + ' ' + mech, /Lingerer/, `must engage the Lingerer: ${nar} | ${mech}`);
  assert.match(mech, INTIMIDATE_RE, `the ultimatum resolves AS an intimidate against the Lingerer: ${mech}`);
});

test('U236-02: a bare attack on the Lingerer breaks dialogue into combat, not a deflected ask', () => {
  const { mech } = out('I attack the Lingerer.');
  assert.doesNotMatch(mech, DIALOGUE_ASK_RE, `attack must not be swallowed as an ask: ${mech}`);
  assert.match(mech, COMBAT_RE, `attack must engage combat: ${mech}`);
});

test('U236-03: "I draw my blade on the Lingerer" breaks dialogue, not a deflected ask', () => {
  const { nar, mech } = out('I draw my blade on the Lingerer.');
  assert.doesNotMatch(mech, DIALOGUE_ASK_RE, `weapon-draw must not be swallowed as an ask: ${mech}`);
  assert.match(nar, STEP_AWAY_RE, `must close the Corwin conversation: ${nar}`);
});

test('U236-04: bare "last chance to talk before I make you" → intimidate the Lingerer', () => {
  const { nar, mech } = out('Lingerer — last chance to talk before I make you.');
  assert.doesNotMatch(mech, DIALOGUE_ASK_RE);
  assert.match(mech, INTIMIDATE_RE, `the ultimatum resolves as an intimidate: ${mech}`);
  assert.match(nar, STEP_AWAY_RE);
});

// ── 2. Diverge negatives — stay in dialogue with the partner ─────────────────

test('U236-10: a normal ask to the partner stays in dialogue', () => {
  const { mech } = out('Corwin, tell me about the smiths and their quenching technique.');
  assert.match(mech, DIALOGUE_ASK_RE, `a plain ask must remain an in-dialogue ask: ${mech}`);
});

test('U236-11: a (non-hostile) question ABOUT the Lingerer stays an ask to Corwin', () => {
  const { mech } = out('Corwin, is the Lingerer dangerous?');
  assert.match(mech, DIALOGUE_ASK_RE, `a question about a third party must not break dialogue: ${mech}`);
});

test('U236-12: a threat aimed at the PARTNER (no other NPC named) stays an in-dialogue social move', () => {
  const { mech } = out('Corwin, last chance — tell me the truth about the deed.');
  assert.match(mech, DIALOGUE_ASK_RE, `a partner-directed threat stays in dialogue: ${mech}`);
});

test('U236-13: an advice/permission question ("should I threaten the Lingerer?") does not break dialogue', () => {
  const { mech } = out('Corwin, should I threaten the Lingerer?');
  assert.match(mech, DIALOGUE_ASK_RE, `an advice question must not trigger the threat-break: ${mech}`);
});
