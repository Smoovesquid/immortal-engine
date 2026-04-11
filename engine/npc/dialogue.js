// NPC Dialogue loop — pure, deterministic. Client of npcDepth + perspectiveFilter.
//
// Exposes beginDialogue / askNpc / endDialogue / availableTopics.
// Mutates only world (as returned value). No side effects.

import { ensureWorld } from '../state.js';
import { addFact } from '../ledger.js';
import { applyDeltas } from '../effectsCore.js';

const TRUST_REVEAL_PUBLIC = 4;
const TRUST_REVEAL_SECRET = 7;
const HONESTY_LIAR = 0.3;
const TOPICS_OFFERED_CAP = 20;
const TOPICS_DISCUSSED_CAP = 20;

// Pass C1 — companion recruit topic. Surfaces in availableTopics when the
// trust gate is met and the party has room. Recognized in askNpc text by
// the literal substring "invite to travel".
const INVITE_TOPIC_ID = 'invite_to_travel';
const INVITE_TRUST_THRESHOLD = 6;
const PARTY_CAP = 3;
const INVITE_TEXT_RE = /\binvite\s+to\s+travel\b/i;

// Exported so playloop.js can check recruit intent BEFORE its dialogue-breaking
// intent guard. The recruit phrase contains "travel", which would otherwise
// route through moveAdvancesScene and exit dialogue.
export function isRecruitIntent(text) {
  return INVITE_TEXT_RE.test(String(text || ''));
}

const STOP_TOKENS = new Set([
  'era', 'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'yours',
  'about', 'into', 'over', 'npc', 'secret'
]);

// ─────────────────────────────────────────────────────────────────────────────
// beginDialogue

export function beginDialogue(world, npcRef) {
  const w = ensureWorld(world);
  const npc = resolveNpcAtCurrentNode(w, npcRef);
  if (!npc) {
    return {
      world: w,
      outcome: {
        kind: 'dialogueBegin',
        ok: false,
        reason: 'no-npc',
        ref: String(npcRef || '')
      }
    };
  }

  const nodeId = String(w.map?.currentNodeId || '');
  const nextNpcs = w.map.nodes
    .find(n => n.id === nodeId)
    .settlement.npcs
    .map(n => {
      if (n.id !== npc.id) return n;
      const cs = normalizeConversationState(n.conversationState);
      return { ...n, conversationState: { ...cs, metPlayer: true } };
    });

  const nodes = w.map.nodes.map(n =>
    n.id === nodeId ? { ...n, settlement: { ...n.settlement, npcs: nextNpcs } } : n
  );

  const flippedNpc = nextNpcs.find(n => n.id === npc.id) || npc;

  const w1 = {
    ...w,
    map: { ...w.map, nodes },
    scene: {
      ...w.scene,
      dialogue: {
        npcId: String(npc.id),
        startedAt: Array.isArray(w.timeline) ? w.timeline.length : 0,
        turnsInDialogue: 0,
        topicsOffered: [],
        lastAnswer: null
      }
    }
  };

  return {
    world: w1,
    outcome: {
      kind: 'dialogueBegin',
      ok: true,
      npcId: String(npc.id),
      npcName: String(flippedNpc.name || ''),
      npcRole: String(flippedNpc.role || ''),
      mood: moodFrom(flippedNpc),
      trustLevel: Number(flippedNpc.conversationState?.trustLevel ?? 5),
      factionId: flippedNpc.factionId || null
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// askNpc

export function askNpc(world, text) {
  const w = ensureWorld(world);
  const d = w.scene?.dialogue;
  if (!d) {
    return {
      world: w,
      outcome: { kind: 'dialogueAsk', ok: false, reason: 'not-in-dialogue' }
    };
  }

  const npc = findNpcInCurrentNode(w, d.npcId);
  if (!npc) {
    // Shouldn't happen under invariants but handle defensively.
    return {
      world: { ...w, scene: { ...w.scene, dialogue: null } },
      outcome: { kind: 'dialogueAsk', ok: false, reason: 'npc-missing' }
    };
  }

  const trust = Number(npc.conversationState?.trustLevel ?? 5);
  const honesty = Number(npc.personality?.honesty ?? 0.5);
  const knownIds = new Set((npc.knowledgeGraph || []).map(f => String(f.factId || '')));
  const secrets = new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : []);

  // Pass C1 — recruit branch. The literal "invite to travel" intercepts the
  // normal topic-extraction path. Outcome by trust band: ≥6 recruits and
  // emits a recruit beat (caller wires the beat — askNpc returns the
  // mode and the post-recruit world); 4-5 refuses soft (-1 trust); ≤3
  // refuses hard (-1 trust). Refusal paths consume a dialogue turn but
  // produce no recruit and no beat.
  if (INVITE_TEXT_RE.test(String(text || ''))) {
    return handleInviteToTravel(w, d, npc, trust);
  }

  const topic = extractTopic(text, npc);

  let mode;
  let factId = null;

  if (!topic || !knownIds.has(topic)) {
    mode = 'deflected';
    factId = null;
  } else if (secrets.has(topic)) {
    if (trust >= TRUST_REVEAL_SECRET) {
      mode = 'shared';
      factId = topic;
    } else if (honesty < HONESTY_LIAR) {
      mode = 'lied';
      factId = topic;
    } else {
      mode = 'withheld';
      factId = topic;
    }
  } else {
    if (trust >= TRUST_REVEAL_PUBLIC) {
      mode = 'shared';
      factId = topic;
    } else {
      // Cold public ask — NPC deflects, but mark the topic as offered.
      mode = 'deflected';
      factId = topic;
    }
  }

  // Ledger side-effects for canonical modes.
  let w1 = w;
  if (mode === 'shared' && factId) {
    w1 = addFact(w1, `npc:${d.npcId} shared:${factId}`, 'dialogue');
  } else if (mode === 'lied' && factId) {
    w1 = addFact(w1, `rumor:${factId} source:${d.npcId}`, 'dialogue:lie');
  }

  // Trust delta.
  const trustDelta =
    mode === 'shared'   ? +1 :
    mode === 'withheld' ? -1 :
    mode === 'lied'     ?  0 :
                           0; // deflected
  const nextTrust = Math.max(0, Math.min(10, trust + trustDelta));

  // Update NPC trustLevel + lastInteraction.
  const nodeId = String(w1.map?.currentNodeId || '');
  const curTurn = Number(w1.time?.turn ?? 0);
  const nextNpcs = w1.map.nodes
    .find(n => n.id === nodeId)
    .settlement.npcs
    .map(n => {
      if (n.id !== d.npcId) return n;
      const cs = normalizeConversationState(n.conversationState);
      return {
        ...n,
        conversationState: {
          ...cs,
          metPlayer: true,
          trustLevel: nextTrust,
          lastInteraction: curTurn
        }
      };
    });

  const nodes = w1.map.nodes.map(n =>
    n.id === nodeId ? { ...n, settlement: { ...n.settlement, npcs: nextNpcs } } : n
  );

  // topicsOffered update.
  let topicsOffered = Array.isArray(d.topicsOffered) ? d.topicsOffered.slice() : [];
  if (factId && !topicsOffered.includes(factId)) {
    topicsOffered.push(factId);
    if (topicsOffered.length > TOPICS_OFFERED_CAP) {
      topicsOffered = topicsOffered.slice(topicsOffered.length - TOPICS_OFFERED_CAP);
    }
  }

  const nextDialogue = {
    npcId: d.npcId,
    startedAt: d.startedAt,
    turnsInDialogue: Number(d.turnsInDialogue || 0) + 1,
    topicsOffered,
    lastAnswer: {
      factId: factId || null,
      mode,
      trustAtTime: trust
    }
  };

  const w2 = {
    ...w1,
    map: { ...w1.map, nodes },
    scene: { ...w1.scene, dialogue: nextDialogue }
  };

  return {
    world: w2,
    outcome: {
      kind: 'dialogueAsk',
      ok: true,
      npcId: d.npcId,
      npcName: String(npc.name || ''),
      topic: factId || '',
      mode,
      factId: factId || '',
      trustLevel: nextTrust,
      trustDelta,
      text: String(text || '')
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// endDialogue

export function endDialogue(world) {
  const w = ensureWorld(world);
  const d = w.scene?.dialogue;
  if (!d) {
    return {
      world: w,
      outcome: { kind: 'dialogueEnd', ok: false, reason: 'not-in-dialogue' }
    };
  }

  const nodeId = String(w.map?.currentNodeId || '');
  const node = (w.map?.nodes || []).find(n => n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  const npc = npcs.find(n => n.id === d.npcId) || null;

  let nextNodes = w.map.nodes;
  if (node && npc) {
    const nextNpcs = npcs.map(n => {
      if (n.id !== d.npcId) return n;
      const cs = normalizeConversationState(n.conversationState);
      let topics = Array.isArray(cs.topicsDiscussed) ? cs.topicsDiscussed.slice() : [];
      for (const t of d.topicsOffered) {
        if (!topics.includes(t)) topics.push(t);
      }
      while (topics.length > TOPICS_DISCUSSED_CAP) topics.shift();
      return {
        ...n,
        conversationState: { ...cs, topicsDiscussed: topics }
      };
    });
    nextNodes = w.map.nodes.map(n =>
      n.id === nodeId ? { ...n, settlement: { ...n.settlement, npcs: nextNpcs } } : n
    );
  }

  const w1 = {
    ...w,
    map: { ...w.map, nodes: nextNodes },
    scene: { ...w.scene, dialogue: null }
  };

  return {
    world: w1,
    outcome: {
      kind: 'dialogueEnd',
      ok: true,
      npcId: d.npcId,
      npcName: String(npc?.name || ''),
      turnsInDialogue: Number(d.turnsInDialogue || 0),
      topicsCount: Array.isArray(d.topicsOffered) ? d.topicsOffered.length : 0
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// availableTopics

export function availableTopics(world) {
  const w = ensureWorld(world);
  const d = w.scene?.dialogue;
  if (!d) return [];
  const npc = findNpcInCurrentNode(w, d.npcId);
  if (!npc) return [];
  const trust = Number(npc.conversationState?.trustLevel ?? 5);
  const secrets = new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : []);
  const kg = Array.isArray(npc.knowledgeGraph) ? npc.knowledgeGraph : [];
  const out = [];
  for (const f of kg) {
    const id = String(f.factId || '');
    if (!id) continue;
    if (secrets.has(id)) {
      if (trust >= TRUST_REVEAL_SECRET) out.push(id);
    } else {
      if (trust >= TRUST_REVEAL_PUBLIC) out.push(id);
    }
  }

  // Pass C1 — surface the invite_to_travel topic when (a) trust is high
  // enough, (b) the party has room, and (c) this NPC is not already a
  // companion (which can't happen in the current shape — companions are
  // removed from the settlement on recruit — but the check is cheap and
  // future-proofs against later passes that may keep the NPC around).
  const party = Array.isArray(w.party) ? w.party : [];
  const alreadyCompanion = party.some(p => p?.companion?.sourceNpcId === String(d.npcId));
  if (
    !alreadyCompanion &&
    party.length < PARTY_CAP &&
    trust >= INVITE_TRUST_THRESHOLD
  ) {
    out.push(INVITE_TOPIC_ID);
  }

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// invite_to_travel — Pass C1

function handleInviteToTravel(w, d, npc, trust) {
  const npcId = String(d.npcId);
  const nodeId = String(w.map?.currentNodeId || '');
  const party = Array.isArray(w.party) ? w.party : [];
  const alreadyCompanion = party.some(p => p?.companion?.sourceNpcId === npcId);

  // Trust gate: ≥6 recruits, otherwise refuse (soft 4-5, hard ≤3) and
  // apply a -1 trust nudge through npcTrustDelta.
  if (trust >= INVITE_TRUST_THRESHOLD && party.length < PARTY_CAP && !alreadyCompanion) {
    const w1 = applyDeltas(w, [
      { op: 'recruitCompanion', sourceNpcId: npcId, nodeId }
    ]);

    // Dialogue context survives but the NPC is now gone from the settlement,
    // which would trip the "npc at current node" invariant on the next
    // ensureWorld. Close the dialogue immediately as part of the recruit
    // outcome — the player has just gained a companion and there's nothing
    // more to ask. Mirrors how combat-begin auto-ends an open dialogue.
    const w2 = { ...w1, scene: { ...w1.scene, dialogue: null } };

    return {
      world: w2,
      outcome: {
        kind: 'dialogueAsk',
        ok: true,
        npcId,
        npcName: String(npc.name || ''),
        topic: INVITE_TOPIC_ID,
        mode: 'recruited',
        factId: '',
        trustLevel: trust,
        trustDelta: 0,
        text: 'invite to travel',
        recruitedSourceNpcId: npcId
      }
    };
  }

  // Refusal — apply -1 trust through the canonical mutation path.
  const refusedMode = trust >= 4 ? 'refused-soft' : 'refused-hard';
  const w1 = applyDeltas(w, [
    { op: 'npcTrustDelta', npcId, by: -1 }
  ]);
  const newTrust = Math.max(0, trust - 1);

  // Bump turnsInDialogue so the refusal still consumes a dialogue turn.
  const nextDialogue = {
    ...d,
    turnsInDialogue: Number(d.turnsInDialogue || 0) + 1,
    lastAnswer: { factId: null, mode: refusedMode, trustAtTime: trust }
  };
  const w2 = { ...w1, scene: { ...w1.scene, dialogue: nextDialogue } };

  return {
    world: w2,
    outcome: {
      kind: 'dialogueAsk',
      ok: true,
      npcId,
      npcName: String(npc.name || ''),
      topic: INVITE_TOPIC_ID,
      mode: refusedMode,
      factId: '',
      trustLevel: newTrust,
      trustDelta: -1,
      text: 'invite to travel'
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NPC reference resolver (used here and by goalContract)

export function resolveNpcAtCurrentNode(world, npcRef) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  return resolveNpcFromList(npcs, npcRef);
}

/**
 * resolveNpcFromList(npcs, npcRef) → npc | null
 * Shared resolver: exact id, exact name, name prefix, substring, first-token,
 * or role token. Deterministic — first match in list order wins.
 */
export function resolveNpcFromList(npcs, npcRef) {
  const ref = String(npcRef || '').trim();
  if (!ref || !Array.isArray(npcs) || npcs.length === 0) return null;

  const lref = ref.toLowerCase();
  const normRef = lref.replace(/^(the|a|an)\s+/, '').trim();

  // 1. Exact id
  const byId = npcs.find(n => String(n.id) === ref);
  if (byId) return byId;

  // 2. Exact name (case-insensitive)
  const byNameExact = npcs.find(n => String(n.name || '').toLowerCase() === lref);
  if (byNameExact) return byNameExact;

  // 3. Prefix
  const byNamePrefix = npcs.find(n => {
    const nm = String(n.name || '').toLowerCase();
    return nm && nm.startsWith(lref);
  });
  if (byNamePrefix) return byNamePrefix;

  // 4. Substring (require ref length >= 3)
  if (lref.length >= 3) {
    const byContains = npcs.find(n => {
      const nm = String(n.name || '').toLowerCase();
      return nm && nm.includes(lref);
    });
    if (byContains) return byContains;
  }

  // 5. First-token match ("marta" matches "Marta the Quiet")
  const firstToken = lref.split(/\s+/)[0] || '';
  if (firstToken && firstToken.length >= 3) {
    const byFirstTok = npcs.find(n => {
      const parts = String(n.name || '').toLowerCase().split(/\s+/).filter(Boolean);
      return parts.includes(firstToken);
    });
    if (byFirstTok) return byFirstTok;
  }

  // 6. Role match ("the smith" → first smith in list) — ambiguity resolver.
  if (normRef) {
    const byRole = npcs.find(n => String(n.role || '').toLowerCase() === normRef);
    if (byRole) return byRole;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// internals

function findNpcInCurrentNode(world, npcId) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const node = (world?.map?.nodes || []).find(n => n.id === nodeId) || null;
  const npcs = node?.settlement?.npcs || [];
  return npcs.find(n => String(n.id) === String(npcId)) || null;
}

function normalizeConversationState(cs) {
  const src = cs && typeof cs === 'object' ? cs : {};
  return {
    metPlayer: Boolean(src.metPlayer),
    topicsDiscussed: Array.isArray(src.topicsDiscussed) ? src.topicsDiscussed.slice() : [],
    trustLevel: Number.isFinite(Number(src.trustLevel)) ? Number(src.trustLevel) : 5,
    lastInteraction: src.lastInteraction ?? null
  };
}

function moodFrom(npc) {
  const h = Number(npc?.personality?.honesty ?? 0.5);
  const trust = Number(npc?.conversationState?.trustLevel ?? 5);
  if (trust >= 7) return 'warm';
  if (h > 0.7) return 'open';
  if (h < 0.3) return 'guarded';
  if (trust <= 2) return 'wary';
  return 'measured';
}

/**
 * extractTopic(text, npc) → factId | null
 *
 * Scores each fact in the NPC's knowledgeGraph by how many of its
 * significant id-tokens appear in the player text. Returns the highest-
 * scoring factId, or null if no tokens matched.
 *
 * Pure + deterministic: same text + same NPC → same result.
 */
export function extractTopic(text, npc) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  const kg = Array.isArray(npc?.knowledgeGraph) ? npc.knowledgeGraph : [];
  if (!kg.length) return null;

  let best = null;
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < kg.length; i++) {
    const f = kg[i];
    const id = String(f?.factId || '');
    if (!id) continue;
    const tokens = id
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(tok => tok && tok.length >= 3 && !STOP_TOKENS.has(tok) && !/^era\d*$/.test(tok));
    let score = 0;
    for (const tok of tokens) {
      if (t.includes(tok)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
      bestIndex = i;
    }
  }
  void bestIndex;

  return bestScore > 0 ? best : null;
}
