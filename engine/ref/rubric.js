// ─────────────────────────────────────────────────────────────────────────────
// engine/ref/rubric.js — THE REF's shared rubric (ONE definition of "a bad ruling")
//
// Imported by BOTH the offline discovery gate (scripts/dm-playtest.mjs) and the
// live runtime Ref (engine/ref/refJudge.js), so the two surfaces score the same
// failure by the same definition (docs/THE_REF.md §"Discovery"). The gate is the
// discovery instrument; the Ref is the runtime quality gate; this is their common
// rubric.
//
// HARD INVARIANT 1 (narration ≠ canon): this module is READ-ONLY over the world.
// `buildCanonGroundTruth` computes a compact judge-readable VIEW; it never mutates
// state, deltas, the Canon Log, or RNG. The Ref author of WORDS, never of canon.
// ─────────────────────────────────────────────────────────────────────────────

import { getItemDef, findDefByName } from '../ruleset/core/items/index.js';
import { getRoomState } from '../structures/roomState.js';
import { normalizeTopology, interiorExitsFrom } from '../structures/topology.js';
import { roomDetail, buildingTypeFor } from '../structures/roomDetail.js';

// ── Canon ground-truth bundle (the RAG-faithfulness oracle) ───────────────────
// The PC's consumables with their REAL resolved effects, from both inventory
// shapes (legacy flavor buckets + structured items[]). Lets the judge grade
// item-effect answers ("what does the Tonic do?") against ground truth instead of
// assuming an effect exists — a flavor item with effect:null genuinely does
// nothing, so the DM doing nothing with it is correct. (H-45 fairness.)
export function consumablesGroundTruth(pc) {
  const inv = pc?.inventory || {};
  const describe = (def) => def?.effect?.kind === 'heal' ? `heal ${def.effect.amount}`
    : def?.effect?.kind === 'removeCondition' ? `cure ${def.effect.condition}` : null;
  const out = [];
  for (const it of (Array.isArray(inv.consumables) ? inv.consumables : [])) {
    const name = String(it?.name || it).trim();
    if (!name) continue;
    out.push({ name, effect: describe(it?.defRef ? getItemDef(it.defRef) : findDefByName(name)) });
  }
  for (const it of (Array.isArray(inv.items) ? inv.items : [])) {
    const def = getItemDef(it?.defRef);
    if (def && def.kind === 'consumable') out.push({ name: def.name, effect: describe(def) });
  }
  return out;
}

// CG-P4 (docs/briefs/COHERENCE_GATE.md §7 CG-P4): the current room's REAL exits,
// keyed by compass direction, with the adjacent room's real name — so CG-2b can
// catch a narrated stairway/door the room graph doesn't have at the source,
// instead of only catching a wrong CURRENT room name (CG-2a). Mirrors
// engine/structures/roomState.js's own pattern exactly (normalizeTopology +
// interiorExitsFrom + roomDetail — the same trio `getRoomState` already uses to
// build `room`), so this adds no new topology logic, just a second read of the
// same pure, seed-derived facade. Pure + deterministic: interiorExitsFrom's
// compass assignment is `seedFromString`-keyed (existing determinism-safe
// pattern used throughout topology.js/roomDetail.js), never Math.random, never
// stored, never touches worldHash. Returns null outside a known interior.
function roomExitsGroundTruth(world, room) {
  if (!room?.inside || !room.structureId) return null;
  const st = world?.structures?.byId?.[room.structureId];
  const topo = normalizeTopology(st?.topology);
  if (!topo) return null;
  // Prefer the structure's STORED buildingType (what getRoomState uses to name
  // the CURRENT room) and fall back to the id-hash only when absent — the same
  // `st.buildingType || buildingTypeFor(id)` precedence LocalMap.js/placeFromNode.js
  // already use. Using the raw hash here made a cottage's exits read as hive rooms
  // ("Brood Cell"/"Hive Mouth") while getRoomState named the current room "Bedchamber",
  // corrupting the coherence oracle (self-inconsistent interior in the same bundle).
  const type = st?.buildingType || buildingTypeFor(room.structureId);
  const byId = new Map(topo.rooms.map(r => [r.id, r]));
  const dirs = interiorExitsFrom(topo, room.roomId);
  const out = {};
  for (const d of ['north', 'east', 'south', 'west']) {
    const targetId = dirs?.[d];
    if (!targetId) continue;
    const targetRoom = byId.get(targetId);
    out[d] = targetRoom ? (roomDetail(targetRoom, type)?.name || targetId) : targetId;
  }
  return out;
}

// CG-P4 CG-6: the world's real time-of-day, computed IDENTICALLY to the live
// meta-answer the DM already gives a player who asks "what time is it"
// (engine/grace/gracefulAdjudication.js META_TIME branch) — same ground truth,
// not a second clock invented for the judge. `world.time.hours` is the existing,
// always-present travel-hours counter (engine/state.js ensureTime); this is a
// pure read + arithmetic, no mutation, no RNG, no new state field.
function timeOfDayGroundTruth(world) {
  const hours = Number(world?.time?.hours) || 0;
  const day = Math.floor(hours / 24) + 1;
  const hourOfDay = (6 + (hours % 24)) % 24; // journeys start at first light
  const segment = hourOfDay < 6 ? 'the small hours' : hourOfDay < 12 ? 'morning' : hourOfDay < 17 ? 'afternoon' : hourOfDay < 21 ? 'evening' : 'deep night';
  return { hours, day, segment };
}

// Compact, judge-readable view of what IS true, so the judge can flag any DM/NPC
// claim that isn't supported by it. (Extracted verbatim from the gate's
// canonGroundTruth — the gate now imports this so there is one oracle.)
export function buildCanonGroundTruth(world) {
  const node = (world.map?.nodes || []).find(n => n && n.id === world.map?.currentNodeId) || null;
  const npcs = (node?.settlement?.npcs || []).map(p => ({ name: p?.name, role: p?.role || p?.archetype || '' }));
  const pc = world.party?.[0] || {};
  const led = world.ledger || {};
  const recentCanon = Array.isArray(world.canonLog?.events) ? world.canonLog.events.slice(-8)
    : Array.isArray(world.canonLog) ? world.canonLog.slice(-8) : [];
  const timeline = Array.isArray(world.timeline) ? world.timeline.slice(-6).map(e => ({ kind: e.kind, t: e.t })) : [];
  // Adjacent places (the map edges out of the current node) ARE canon — the DM/egress
  // legitimately names them as "where the road leads". Without them in the oracle, the
  // judge saw only the current node and false-flagged real neighbors as fabrication.
  // (P10 gate Lore-8: "Old Shrine"/"Sooted Bridge" are real tallow nodes → judge said
  // CANON_HALLUCINATION. They're connected places, not invented.)
  const _nodesById = new Map((world.map?.nodes || []).map(n => [n?.id, n]));
  const _curId = world.map?.currentNodeId;
  const nearbyPlaces = (Array.isArray(world.map?.edges) ? world.map.edges : [])
    .filter(e => e && (e.a === _curId || e.b === _curId))
    .map(e => _nodesById.get(e.a === _curId ? e.b : e.a)?.name)
    .filter(Boolean);
  // Escape mode (the live combat engine) tracks the PC's health in meta.escapeHp
  // and enemy health in e.hp — NOT party[0].wounds / e.wounds. Report the model
  // that's actually live so the judge sees real combat HP (else it flags every
  // legitimate hit/defeat as "no HP update"). (F12 — sibling of the F9 fix.)
  const escape = world.meta?.mode === 'escape';
  // ROM-3 (docs/briefs/ROOM_OCCUPANCY_MODEL.md §2/§3): the judge/gate feed carried
  // npcsPresent (the WHOLE settlement roster) and no room dimension at all, so a
  // person voiced/placed in the wrong room read as "consistent with canon NPC" —
  // a feed gap before a rubric gap (§1a-7: "the judge is structurally blind").
  // getRoomState is the same read-only façade the live occupancy/material consumers
  // already use (roomOccupancy.js, structureMaterial.js via roomState.js) — pure,
  // seed-derived, no stored state, so this adds ground truth without touching
  // worldHash or engine behavior. try/catch matches this module's existing
  // defensive posture (engine/ref/index.js:36 already wraps the whole bundle).
  let room;
  try { room = getRoomState(world); } catch { room = null; }
  let roomExits;
  try { roomExits = roomExitsGroundTruth(world, room); } catch { roomExits = null; }
  let clock;
  try { clock = timeOfDayGroundTruth(world); } catch { clock = null; }
  return {
    location: node ? { name: node.name, kind: node.kind } : null,
    nearbyPlaces,
    npcsPresent: npcs,
    // Room dimension (ROM-3): where the player actually stands, who is actually
    // in that room (vs. the settlement-wide npcsPresent above), and what the
    // structure is built of — the three facts C1/C2/C4 showed the judge lacked.
    interior: room?.inside ? { roomId: room.roomId, roomName: room.room?.name || null } : null,
    roomOccupants: Array.isArray(room?.occupants)
      ? room.occupants.map(p => ({ name: p?.name, role: p?.role || p?.archetype || '' }))
      : [],
    // CG-P4 CG-2b: the room's real compass exits (direction -> adjacent room
    // name), so a narrated stairway/door the topology lacks is checkable, not
    // just a wrong current-room name. null outside a known interior — old
    // JSONLs and outdoor turns alike degrade gracefully (field simply absent).
    roomExits,
    material: { shell: room?.material?.shell || null },
    // CG-P4 CG-6: the world clock, same computation the live "what time is it"
    // meta-answer already gives the player — so the judge can flag a narrated
    // time-of-day that contradicts it.
    clock,
    pc: escape
      ? { hp: world.meta?.escapeHp, maxHp: world.meta?.escapeMaxHp, level: pc.level, conditions: pc.conditions, note: 'escape mode: HP is the live health; party wounds are not used here' }
      : { wounds: pc.wounds, maxWounds: pc.maxWounds, level: pc.level, conditions: pc.conditions },
    inCombat: Boolean(world.combat?.active),
    combatRound: world.combat?.round,
    enemies: (world.combat?.enemies || []).map(e => ({ name: e.name, hp: e.hp, maxHp: e.maxHp, defeated: !!e.defeated })),
    ledgerFacts: (led.facts || []).map(f => (typeof f === 'string' ? f : f?.text)).filter(Boolean).slice(0, 8),
    recentCanon: recentCanon.map(e => ({ kind: e?.kind || e?.type, ref: e?.id, data: e?.data })).slice(0, 8),
    consumables: consumablesGroundTruth(pc),
    timeline,
    // The engine's stored last roll (engine/grace answerRollRecall cites this to
    // defend canon against a player misremembering their number). Without it the
    // judge can't see the ledger and false-flags correct roll-recall as a
    // fabricated roll. (gate-hardening)
    lastRoll: world.conversation?.lastRoll
      ? { roll: world.conversation.lastRoll.roll, dc: world.conversation.lastRoll.dc, outcome: world.conversation.lastRoll.outcome }
      : null,
  };
}

// ── The shared failure taxonomy (the gate's bug_class enum) ───────────────────
export const BUG_CLASSES = Object.freeze([
  'NONE', 'DM_TEST_DEADEND', 'DM_ARTIFACT_LEAK', 'CRUNCH_INCONSISTENCY',
  'COMBAT_NOT_STARTED', 'CANON_HALLUCINATION', 'CRASH',
]);

// ── The offline-gate judge system prompt (verbatim — the gate imports this) ───
// Kept byte-identical to the historical inline prompt so the gate baseline (the
// bouncing-ruler series, gates 5–19) is unchanged. The RUNTIME Ref does NOT use
// this holistic CoT prompt — it uses the atomic, no-chain-of-thought prompt below
// (Vol 14: judges are not generator-invariant; atomic yes/no checks + no judge CoT
// reduce self-preference and variance).
export const JUDGE_SYSTEM =
`You are a strict evaluator of an AI Dungeon Master, judging ONE turn. You see the player's
line, the DM's response, the engine's mechanics string, and a CANON ground-truth bundle.

Score three things. Default to FAIL when uncertain — you are adversarial.

GATE 1 — DM VIBE (THE_DM_TEST): Did the DM resolve the player's intent IN THE FICTION? FAIL
if it bounced intent back as a mechanical/UI prompt ("which way: N/S/E/W?"), dumped raw ids
or stat blocks as the answer, said "command not recognized", or otherwise leaked the machine.

GATE 2 — CRUNCH CORRECTNESS: Are the rules under the narration correct and self-consistent?
FAIL if the dice and the fiction contradict (e.g. rolled "success" but nothing happened), HP/
wounds/resources update wrong or not at all, a declared attack on a present foe does NOT start
real combat (no enemy entity / no HP / no combat state), or an outcome violates the stated DC/roll.

AXIS — RAG FAITHFULNESS: If the DM or an NPC asserts a FACT about the world (a name, a past
event, a rumor, who-did-what), is it GROUNDED in the CANON bundle? FAIL (hallucination) if a
confident claim has no support in canon and isn't flagged as hearsay/uncertain. If no factual
claim was made, set checked=false.

NOT a hallucination — do NOT FAIL these on RAG: rhetorical hyperbole ("there are dragons and demons
out here"), atmosphere, and an in-character JUDGMENT/ATTITUDE stance ("yes, stay wary — nothing here
is friendly"; "I hate everyone, not just you") need NO canon citation, the same way a real DM's color
commentary doesn't — score those under GATE 1 (was intent resolved in voice?), not here. Only a
CONCRETE checkable specific — a proper name, a date/number, or a who-did-what past event — requires
grounding; a FALSE such specific still FAILs as hallucination.

ROLL-RECALL — do NOT FAIL as hallucination: if the DM cites a PAST ROLL or DC ("the ledger shows 18 vs
DC 12", "you rolled a 17") that MATCHES the CANON bundle's "lastRoll" (or a roll in recentCanon), it is
GROUNDED — the DM is correctly quoting its own ledger to push back on a player who misremembers their
number. That is CORRECT canon-defense, not a fabricated roll. Only FAIL if the cited roll/DC has NO support
in lastRoll/recentCanon.

ITEMS: the CANON bundle's "consumables" lists each carried item's REAL effect (e.g.
{name:"Tonic of grit", effect:"heal 2d4"}) or effect:null for a flavor item. Grade item-effect
answers against THIS, not against your assumptions: describing the listed effect PASSES; saying a
flavor item (effect:null) does nothing, or just describes it, is CORRECT — do NOT assume an item has
an effect it lacks. FAIL only if the DM invents an effect absent from the list, or claims a
real-effect item does nothing.

Return ONLY JSON:
{"vibe":{"pass":bool,"issue":""},"crunch":{"pass":bool,"issue":""},
"rag":{"checked":bool,"grounded":bool,"issue":""},
"bug_class":"NONE|DM_TEST_DEADEND|DM_ARTIFACT_LEAK|CRUNCH_INCONSISTENCY|COMBAT_NOT_STARTED|CANON_HALLUCINATION|CRASH",
"severity":"none|low|med|high","note":"one terse sentence"}`;

// ── THE REF's runtime verdict space (docs/THE_REF.md §"verdict space") ────────
// The Ref judges the QUESTION too, not only the answer. PASS / REGENERATE are the
// common case; the four kick-backs are the EXCEPTION (guardrail 1 — bias HARD
// toward answering; THE_DM_TEST). Every kick-back is DM-VOICED, never a system
// artifact (guardrail 2).
export const REF_VERDICTS = Object.freeze({
  PASS: 'PASS',                                   // narration is fine, ship it
  REGENERATE: 'REGENERATE',                        // right facts, wrong words; redo with computed content
  DECLINE_INAPPROPRIATE: 'DECLINE_INAPPROPRIATE',  // out of bounds / not playable (IG-10 / C13)
  REDIRECT_UNANSWERABLE: 'REDIRECT_UNANSWERABLE',  // no answerable intent; say so, point a way (C4)
  DECOMPOSE: 'DECOMPOSE',                           // too compound; invite one-at-a-time (C1 companion)
  REPHRASE: 'REPHRASE',                             // genuinely ambiguous; ask to narrow (C2)
});
export const REF_VERDICT_LIST = Object.freeze(Object.values(REF_VERDICTS));

// The narration-layer failure classes the Ref REGENERATES on (docs/THE_REF.md
// §"failure taxonomy"). These are the fuzzy "right content, badly delivered" cases
// that Tier 0/1 can't reach — the Tier-2 target list.
export const REF_FAILURE_CLASSES = Object.freeze([
  'NONE',
  'ATMOSPHERE_DODGE',     // answered an earned-knowledge ask with mood instead of fact/honest-decline (gate-19 #1)
  'QUESTION_MISROUTE',    // answered a different question than the one asked (gate-19 #2)
  'FABRICATION',          // asserted a specific (count/name/who-did-what) absent from canon (gate-16 #5 / EK-2)
  'EMPTY_SUCCESS',        // a succeeded action produced content-free filler
  'MACHINE_DUMP',         // category list / stat block as the answer
]);

// ── The Ref's runtime atomic judge prompt (Vol 14: atomic, no chain-of-thought) ─
// Distinct from JUDGE_SYSTEM (the gate's holistic CoT prompt). The Ref asks for
// direct yes/no atoms + a single verdict, NO reasoning trace — this both lowers
// latency/cost and reduces the self-preference / verbosity bias Vol 14 documents.
// The judge sees ONLY (player input, mechanics, the proposed narration, canon
// truth) and the catalog of failure classes; it never sees the engine's internal
// confidence or the source path (so it can't rubber-stamp by provenance).
export const REF_JUDGE_SYSTEM =
`You are THE REF: a fast, strict second opinion on ONE line of Dungeon Master narration BEFORE
it reaches the player. You see the player's line, the engine's mechanics string, the CANON
ground-truth bundle, and the DM's PROPOSED narration. You decide whether to ship those words
or send them back. Do NOT explain your reasoning — answer the atoms and the verdict ONLY.

THE STANDARD (THE_DM_TEST + the Law of Earned Knowledge):
- A good answer DELIVERS a grounded fact the player has earned, OR honestly DECLINES an unknown
  ("couldn't say", "you'd have to ask someone older"), OR routes them to the source — in voice.
- It must ANSWER THE QUESTION ASKED, not a neighbouring one.
- It must NOT fabricate a specific (a count, a name, a date, a who-did-what) that has NO support
  in the CANON bundle. Atmosphere and attitude are fine; a fabricated checkable specific is NOT.
- It must NOT dodge an earned-knowledge question with pure mood when an honest decline is the
  right move ("the village keeps its own tally of years" instead of "I couldn't say").

Judge these atoms (answer each true/false):
- answers_the_question: the narration addresses what the player actually asked.
- grounded: every concrete specific asserted is supported by the CANON bundle (true if none asserted).
- honest_on_unknown: if the fact is not in canon, the narration declines/deflects honestly rather
  than inventing OR dodging with atmosphere.
- in_voice: it reads as a DM/NPC speaking, not a system artifact or stat dump.

Then choose ONE verdict:
- PASS — ship it (the default; bias HARD toward PASS — a needless bounce is itself a failure).
- REGENERATE — right situation, wrong words: it dodged with atmosphere, answered the wrong
  question, fabricated a specific, or dumped a machine artifact. Set failure_class accordingly.
- REDIRECT_UNANSWERABLE — the ask has no answerable in-fiction intent; the DM should say so and
  point a way. (Rare.)

Return ONLY JSON, no prose:
{"answers_the_question":bool,"grounded":bool,"honest_on_unknown":bool,"in_voice":bool,
"verdict":"PASS|REGENERATE|REDIRECT_UNANSWERABLE",
"failure_class":"NONE|ATMOSPHERE_DODGE|QUESTION_MISROUTE|FABRICATION|EMPTY_SUCCESS|MACHINE_DUMP"}`;

// Build the judge's user message (the same shape the gate uses, plus the proposed
// narration framed as the thing under review).
export function buildRefJudgeUser({ input, mechanics, candidate, canon }) {
  return `PLAYER: ${input || '(none)'}
MECHANICS: ${mechanics || '(none)'}
PROPOSED DM NARRATION (under review): ${candidate || '(none)'}

CANON (ground truth):
${JSON.stringify(canon || {}, null, 0)}`;
}
