// NPC Dialogue loop — pure, deterministic. Client of npcDepth + perspectiveFilter.
//
// Exposes beginDialogue / askNpc / endDialogue / availableTopics.
// Mutates only world (as returned value). No side effects.

import { ensureWorld } from '../state.js';
import { addFact } from '../ledger.js';
import { applyDeltas } from '../effectsCore.js';
import { filterRumors } from './perspectiveFilter.js';
import { appendCanonEvent } from '../csl/canonLog.js';
import { buildNpcContext, fallbackRules, findCachedDecision } from './npcBrain.js';
import { extractMemory } from './npcMemory.js';
import { exitsFrom } from '../map/mapState.js';
import { classifyPlaceQuery, resolvePlaceFact } from '../world/placeQuery.js';
import { classifyPersonQuery, resolvePersonFact } from '../world/personQuery.js';
import { notorietyReaching } from './reputation.js';
import { npcVoiceCorpusId } from './npcVoiceResolve.js';

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

// H-9 — continuity-challenge markers. The player quotes the NPC back to
// themselves and demands the contradiction be settled ("first you said X, now
// Y — which is it?"). Ordinary topic scoring only matches known fact tokens, so
// these fall to deflection — atmospheric avoidance that reads as the NPC dodging
// an accusation. We require explicit quote-back / which-is-it phrasing so plain
// skeptical questions ("are you sure?", "really?") do NOT misfire into this path.
const CONTINUITY_CHALLENGE_RE = /\b(?:you (?:said|told me|claimed)|first you said|now you(?:'re| are)?\s+say(?:ing)?|which is it|contradict|that'?s not what you said|you just said)\b/i;

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
// Common knowledge — what any villager answers without a check.
//
// THE DM TEST: a DM playing an innkeeper answers "what's your name?" with a
// name, "any news?" with a rumor, "which way to town?" with directions. The
// knowledge graph holds the PERSONAL facts (it outranks this tier and keeps
// its trust/secret gates); this tier answers from world data the NPC plainly
// has: themselves, their village, the roads, the rumors they carry. Floor
// stays deflection — for things they genuinely wouldn't know. Deterministic:
// fixed templates over world state, no rng.

// ── Voice: how THIS person talks ─────────────────────────────────────────────
// Derived purely from the personality floats every NPC already carries (no new
// state, no version bump): trustOfOutsiders → warmth, selfPreservation →
// nerve, honesty → candor. Banded so a guarded skittish clerk and a blunt open
// farmhand answer the same question in different words. Deterministic: same
// NPC, same voice, forever.

export function npcVoice(npc) {
  const p = npc?.personality || {};
  const band = (v) => (v < 0.4 ? 0 : v > 0.6 ? 2 : 1);
  return {
    warmth: band(Number(p.trustOfOutsiders ?? 0.5)),   // 0 guarded · 1 even · 2 open
    nerve: band(1 - Number(p.selfPreservation ?? 0.5)), // 0 skittish · 1 steady · 2 blunt
    candor: band(Number(p.honesty ?? 0.5)),             // 0 sly · 1 plain · 2 forthright
    // Leanings from center — voiceManner picks the dominant one.
    dWarm: Number(p.trustOfOutsiders ?? 0.5) - 0.5,
    dNerve: (1 - Number(p.selfPreservation ?? 0.5)) - 0.5,
    role: String(npc?.role || '')
  };
}

/**
 * The dominant manner for prose-pool selection: one word, never a matrix.
 * Genesis floats cluster near 0.5, so hard bands would make most of a village
 * sound the same — instead the LARGEST leaning decides (with a small dead
 * zone for the genuinely middling). Whoever is relatively most guarded
 * speaks guarded; truly even people stay even.
 */
export function voiceManner(voice) {
  const v = voice || {};
  const dWarm = Number(v.dWarm ?? 0);
  const dNerve = Number(v.dNerve ?? 0);
  if (Math.max(Math.abs(dWarm), Math.abs(dNerve)) < 0.05) return 'even';
  if (Math.abs(dWarm) >= Math.abs(dNerve)) return dWarm > 0 ? 'open' : 'guarded';
  return dNerve > 0 ? 'blunt' : 'skittish';
}

const ROLE_LINES = {
  smith: 'I keep the forge here',
  blacksmith: 'I keep the forge here',
  innkeeper: 'I keep the inn — beds, beer, and other people\'s business',
  representative: 'I speak for the caravans that come through',
  farmer: 'I work the fields, same as my father did',
  healer: 'I patch up what the road sends me',
  trader: 'I buy what travels and sell what doesn\'t',
  merchant: 'I buy what travels and sell what doesn\'t',
  priest: 'I keep the shrine and the prayers',
  elder: 'I remember things for people, mostly',
  hunter: 'I keep the woods honest',
  guard: 'I watch the road so others don\'t have to'
};

function bearingBetween(from, to) {
  const dx = (Number(to?.x) || 0) - (Number(from?.x) || 0);
  const dy = (Number(to?.y) || 0) - (Number(from?.y) || 0);
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north');
}

function distanceWord(from, to) {
  const d = Math.abs((Number(to?.x) || 0) - (Number(from?.x) || 0)) + Math.abs((Number(to?.y) || 0) - (Number(from?.y) || 0));
  if (d <= 6) return 'a day\'s walk, maybe less';
  if (d <= 12) return 'two or three days on the road';
  return 'a long road — provision for it';
}

function playerCtx(world) {
  const homeNodeId = String(world?.meta?.homeNodeId || '');
  const curNodeId = String(world?.map?.currentNodeId || '');
  const atHome = Boolean(homeNodeId) && homeNodeId === curNodeId;
  const alignId = String(world?.party?.[0]?.sheet?.alignment?.id || '');
  const corruption = Number(world?.meta?.soul?.corruption ?? 0);
  const isEvil = ['le', 'ne', 'ce'].includes(alignId) || corruption >= 2;
  return { atHome, isEvil };
}

export function commonKnowledgeAnswer(world, npc, text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim() || !npc) return null;
  const w = world || {};
  const ctx = playerCtx(w);
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const here = nodes.find(n => n && n.id === w.map?.currentNodeId) || null;
  const trust = Number(npc.conversationState?.trustLevel ?? 5);

  // ── self: they know their own name and trade ──
  if (/\b(?:who are you|what(?:'s| is) your name|your name\b|what are you called|what do you do(?:\s+here)?\??$|your trade)\b/.test(t)) {
    const role = String(npc.role || '').toLowerCase();
    const roleLine = ROLE_LINES[role] || (role ? `I'm the ${role} here, such as it is` : 'I get by');
    return { mode: 'self', body: `${npc.name}. ${roleLine}.` };
  }

  // ── origin/tenure (NBIO-1): "were you born here / are you a local / how long
  // have you been here" — the NPC's OWN founding-vs-later-arrival tenure, sourced
  // from npc.originTick (the same fact personQuery.describeTenure renders in
  // third person). Fires BEFORE residence and the place-blurb catch-all so
  // "have you been here long?" lands on the NPC's tenure, not the place blurb
  // (the REF-003 miss). Narrow to second-person self-address; third-person tenure
  // ("is Kael a founding resident?") and generic place asks are untouched.
  if (/\bwere you born (?:here|in this (?:town|village|place|settlement))\b|\bare you (?:a )?(?:local|native)\b|\bare you from (?:here|around here|this (?:town|village|place))\b|\bdid you grow up (?:here|in this (?:town|village|place|settlement))\b|\bhave you (?:always )?(?:been here|lived here)(?:\s+(?:long|a long time|for a while|all your life|always))?\b|\bhow long have you (?:lived|been) here\b/i.test(t)) {
    const tick = Number(npc.originTick ?? 0);
    const manner = voiceManner(npcVoice(npc));
    const bornLines = {
      guarded: 'Born here, yes. Same as my kin before me.',
      skittish: 'I was, born and raised. Never left, if that\'s what you\'re asking.',
      blunt: 'Born here. One of the first families.',
      open: 'Born and raised, through and through! My people helped found this place.',
      even: 'Born here — one of the founding families, if that means anything to you.'
    };
    const laterLines = {
      guarded: 'No. I came later. That\'s all you need to know.',
      skittish: 'No, no — I\'m not from here originally. I settled later, is all.',
      blunt: 'No. Came later, same as most.',
      open: 'Not born here, no! I settled here later, but it\'s home now.',
      even: 'No — I came later. Not a native, but I\'ve made my place here.'
    };
    const lines = tick === 0 ? bornLines : laterLines;
    return { mode: 'origin', body: lines[manner] || lines.even };
  }

  // ── residence: "do you live/work here?" ──
  if (/\bdo you (?:live|work|stay|dwell) here\b|\bhave you (?:always )?lived here\b|\byou (?:from|based) here\b/i.test(t)) {
    const role = String(npc.role || '').toLowerCase();
    const roleLine = ROLE_LINES[role] || (role ? `I work here as the ${role}` : 'I live here');
    const manner = voiceManner(npcVoice(npc));
    const resLines = {
      guarded: `${roleLine} — and that's all you need to know.`,
      skittish: `I do, yes. Has something happened?`,
      blunt: `${roleLine}.`,
      open: `I do! ${roleLine}.`,
      even: `${roleLine}, yes.`
    };
    return { mode: 'residence', body: resLines[manner] || resLines.even };
  }

  // ── news: the rumors they actually carry ──
  if (/\b(?:any news|the news|news\?|heard anything|anything strange|strange (?:lately|going on)|been happening|goings.?on|rumou?rs?|gossip|tell me a story|tell me something)\b/.test(t)) {
    const { surfacedRumors } = filterRumors(npc, Array.isArray(w.rumors) ? w.rumors : [], { trust });
    const freshest = [...surfacedRumors].sort((a, b) => (Number(a.age) || 0) - (Number(b.age) || 0))[0];
    const manner = voiceManner(npcVoice(npc));
    if (freshest?.body) {
      // The wraps carry their own attribution — strip the rumor's, and
      // re-lowercase the orphaned head ONLY when it's a safe sentence-starter
      // (never a name: "Orla sat with him" keeps her O).
      const stripped = String(freshest.body).replace(/[.?!]\s*$/, '').replace(/^(?:they say|folk say|word is|people say|i hear(?:d)?|rumor has it)[,:]?\s+/i, '');
      const rumorBody = /^(?:The|A|An|Some(?:one|thing|body)?|There|It|That|Last|Every)\b/.test(stripped)
        ? stripped.charAt(0).toLowerCase() + stripped.slice(1)
        : stripped;
      const wrap = {
        guarded: `I'll say it once and you never heard it: ${rumorBody}.`,
        skittish: `Keep your voice down. ${rumorBody} — that's all I know, and I wish I knew less.`,
        blunt: `${rumorBody}. That's the talk. Believe what you like.`,
        open: `Oh, there's talk all right — ${rumorBody}! Everyone's chewing on it.`,
        even: `You didn't hear it from me — ${rumorBody}. Make of that what you will.`
      };
      return { mode: 'news', body: wrap[manner] || wrap.even };
    }
    const quiet = {
      guarded: 'If there were news, I wouldn\'t be the one spreading it.',
      skittish: 'Quiet. Too quiet, if you ask me — and I\'d rather you didn\'t.',
      blunt: 'No news. When there is, you\'ll hear it same as everyone.',
      open: 'Quiet as a held breath, friend — first interesting thing today is you.',
      even: 'Quiet, lately. The kind of quiet folk don\'t quite trust, but quiet.'
    };
    return { mode: 'news', body: quiet[manner] || quiet.even };
  }

  // ── directions: the roads they walk (also lore-of-known-places: "what do
  // you know about <somewhere real>" earns a bearing; unknown names fall
  // through to place/deflection) ──
  const wantsDirections = /\b(?:way to|road to|how do i get to|where is|which way|next town|nearest (?:town|village|settlement)|know about|tell me about)\b/.test(t);
  if (wantsDirections && here) {
    // A named place they know of?
    const named = nodes
      .filter(n => n && n.id !== here.id && n.name && t.includes(String(n.name).toLowerCase()))
      .sort((a, b) => String(b.name).length - String(a.name).length)[0] || null;
    const generic = /\b(?:next town|nearest (?:town|village|settlement))\b/.test(t);
    let dest = named;
    if (!dest && generic) {
      dest = nodes
        .filter(n => n && n.id !== here.id && n.nodeType === 'settlement')
        .sort((a, b) => (Math.abs((a.x || 0) - (here.x || 0)) + Math.abs((a.y || 0) - (here.y || 0))) - (Math.abs((b.x || 0) - (here.x || 0)) + Math.abs((b.y || 0) - (here.y || 0))))[0] || null;
    }
    if (dest) {
      const exits = exitsFrom(w.map, String(here.id));
      const adjacentDir = Object.keys(exits || {}).find(dir => String(exits[dir] || '') === String(dest.id));
      const dir = adjacentDir || bearingBetween(here, dest);
      const span = adjacentDir ? 'the next road over' : distanceWord(here, dest);
      return { mode: 'directions', body: `${dest.name}? ${capitalize(dir)} of here — ${span}. The road knows the way better than I can tell it.` };
    }
    if (named === null && !generic && /\b(?:way to|road to|how do i get to)\b/.test(t)) {
      return { mode: 'directions', body: 'Can\'t say I know the place. Roads out of here run the four winds — someone in the next town might know it.' };
    }
  }

  // ── services: who sells what, where the work is ──
  if (/\b(?:selling|for sale|wares|what do you sell|buy (?:something|supplies|gear)|where can i buy|supplies|provisions|equipment)\b/.test(t) && here?.settlement) {
    const shops = Array.isArray(here.settlement.shops) ? here.settlement.shops.map(s => String(s?.type || '')).filter(Boolean) : [];
    if (shops.length === 1) {
      return { mode: 'services', body: `No counter of mine. The ${shops[0]} keeps stock here — coin talks.` };
    }
    if (shops.length > 1) {
      return { mode: 'services', body: `No counter of mine. The ${shops.slice(0, 3).join(' and the ')} keep stock here — coin talks at any of them.` };
    }
    return { mode: 'services', body: 'Nothing changes hands here but favors. For shopping you want a bigger town.' };
  }
  if (/\b(?:looking for work|need (?:any )?(?:help|a hand)|any work|hiring)\b/.test(t) && here?.settlement) {
    return { mode: 'services', body: 'Work follows need. Ask where the counters are, or whoever looks busiest — someone always wants a back that bends.' };
  }

  // ── place-knowledge (W-6): the resolver owns the fact; the NPC is a VOICE ──
  // founding / events / population are NODE-clarity (vivid) = common knowledge AT this
  // node. Purity #8 puts the speaking NPC at the player's node, so a co-located local
  // plausibly knows them — the substrate clarity ladder IS the "speaker-knows" policy.
  // We RENDER the same resolved fact the DM-narrator renders (one fact, two voices); we do
  // NOT classify or look up here (no second source of truth). Population passes the speaker
  // as excludeId so the NPC doesn't list itself. Resolver null (this node has no such fact)
  // → FALL THROUGH to the honest-decline backstop below (NOT_PLACE_DESCRIPTION_RE keeps the
  // generic blurb off unknown place questions). Guarded/secret never reach here: control
  // isn't a slot (W-5), and secrets flow through the trust-gated knowledgeGraph path.
  if (here) {
    const pq = classifyPlaceQuery(t);
    if (pq) {
      const fact = resolvePlaceFact(w, { ...pq, excludeId: npc.id });
      const voiced = fact ? renderPlaceFactNpc(npc, fact) : null;
      if (voiced) return { mode: 'place', body: voiced };
    }
  }

  // ── person-identity (P-2): the NPC identifies a present OTHER ──
  // Closes the W-6 gap where dialogue could only do "who are YOU" (self): "who is that? /
  // who is Pell?" now names a co-present non-hostile NPC, rendering the SAME identity fact the
  // narrator does (one fact, two voices). excludeId = the SPEAKER so they never identify
  // themselves (self mode already owns "who are you"); a demonstrative resolves the sole present
  // other. Unknown/secret/motive → not classified or no match → fall through (deflect). §0-safe:
  // name + role only — never allegiance, faction, or motive.
  if (here) {
    const pqp = classifyPersonQuery(t);
    if (pqp) {
      const fact = resolvePersonFact(w, { ...pqp, excludeId: npc.id });
      // A present NPC's whereabouts — never deny someone standing right here.
      if (fact?.type === 'location') return { mode: 'identity', body: renderPersonLocationNpc(npc, fact) };
      if (fact) return { mode: 'identity', body: renderPersonIdentityNpc(npc, fact) };
    }
  }

  // ── place: the ground under their feet ──
  // Guard against "this village/town" used as a mere locative inside a
  // question about events/history/danger — that's not a place-description
  // ask, and should fall through to the honest decline instead of a
  // non-sequitur place blurb.
  // Control/secret-authority terms are excluded too (W-6): control is a DEFERRED slot (W-5,
  // no grounded leadership source), so "who secretly controls/runs this town?" must DECLINE,
  // not fall to a generic place blurb. Mirrors placeQuery's PLACE_POPULATION_EXCLUDE_RE so
  // both sinks agree — the resolver never classifies control, and the blurb never poaches it.
  const NOT_PLACE_DESCRIPTION_RE = /\b(?:worst|trouble|danger|threat|happened|founded|built|first\s+stone|before|history|who\s+(?:runs|leads|founded|built|controls?|owns|rules)|controls?|controlling|secretly|in\s+(?:charge|control|power)|pulls?\s+the\s+strings|the\s+(?:cult|boss)|how\s+long|how\s+many|years|winters|elder|stranger|attack(?:ed|s)?|raid)\b/i;
  if (/\b(?:this place|this village|this town|about (?:the )?(?:village|town|place)|what is this place|around here|liv(?:e|ed|es) here|been here long)\b/.test(t) && !NOT_PLACE_DESCRIPTION_RE.test(t) && here) {
    const st = here.settlement;
    if (st) {
      const buildings = (Array.isArray(st.buildings) ? st.buildings : []).map(b => String(b?.name || '')).filter(Boolean).slice(0, 3);
      const folk = (Array.isArray(st.npcs) ? st.npcs : []).filter(n => n && n.name && !n.hostile && n.id !== npc.id).map(n => String(n.name)).slice(0, 3);
      const bits = [];
      if (buildings.length) bits.push(`You'll find ${buildings.join(', ').toLowerCase()}`);
      if (folk.length) bits.push(`folk worth knowing: ${folk.join(', ')}`);
      return { mode: 'place', body: `This is ${here.name}. Small, but it holds. ${bits.join('; ')}${bits.length ? '.' : ''}`.trim() };
    }
    return { mode: 'place', body: `Not much to tell — ${here.name || 'this stretch'} is what you see. The road brought you; it'll take you on, too.` };
  }

  // ── small talk: a greeting gets a greeting, a courtesy gets one back ──
  // Manner sets the base; earned trust warms or cools it one step.
  if (/\b(?:take care|safe travels|mind yourself|good luck|be well)\b/.test(t)) {
    const courtesy = {
      guarded: 'Mm.',
      skittish: 'And you. Careful who you say that to.',
      blunt: 'Aye. Don\'t die stupid.',
      open: 'And you, friend! Roads be kind.',
      even: 'And you. Mind the road after dark.'
    };
    return { mode: 'smalltalk', body: courtesy[voiceManner(npcVoice(npc))] || courtesy.even };
  }
  if (/^(?:hello|hi|hey|greetings|good (?:morning|day|evening)|well met)\b/.test(t) || /\b(?:how are you|how('s| is) (?:it going|life|business)|nice weather|fine (?:day|morning)|can i ask you something|what brings you)\b/.test(t)) {
    // (W2·3) Reputation precedes you. If a notable atrocity of yours has reached this
    // place (rumorsReaching → notorietyReaching), the greeting turns wary and knowing —
    // wherever you are, home or away. DISCOVERED in the fiction, never a meter. Clean
    // players never reach this branch (heard:false), so every existing greeting is
    // byte-identical — this is purely additive.
    const notor = notorietyReaching(w, here?.id);
    if (notor.heard) {
      const what = String(notor.worst?.body || 'what you did')
        .replace(/[.?!]+\s*$/, '')
        .replace(/^([A-Z])/, (m, c) => c.toLowerCase());
      const pool = {
        guarded: `Spare me the pleasantries. I know who you are — word came ahead of you: ${what}. State your business and go.`,
        skittish: `Oh — it's you. We heard. ${capitalize(what)}, they said. I don't want any trouble, please.`,
        blunt: `I know your name and how you earned it — ${what}. Say what you came to say.`,
        open: `Ah. So you're the one. The talk reached us before you did — ${what}. I'll hear you out, but folk are watching.`,
        even: `Word travels faster than feet. We heard about you — ${what}. Speak your piece, and mind yourself here.`,
      };
      return { mode: 'smalltalk', body: pool[voiceManner(npcVoice(npc))] || pool.even };
    }
    // Home village: the player is a known face — no "stranger" language, but
    // manner still colours the delivery (guarded stays curt, open stays warm).
    if (ctx.atHome) {
      const manner = voiceManner(npcVoice(npc));
      if (ctx.isEvil) {
        const wary = {
          guarded: ["What do you want.", "State it and be done.", "Out with it."],
          skittish: ["Oh — it's you. What now.", "Don't start anything. What is it.", "Keep it short. What do you need."],
          blunt: ["What.", "Talk.", "Quickly."],
          open: ["And here's trouble. What can I do for you.", "Morning. Try not to cause a scene. What is it.", "Oh, it's you. What now."],
          even: ["What do you want this time.", "Here you are. What now.", "Watch yourself today. What do you need."]
        };
        const pool = wary[manner] || wary.even;
        const step = Math.max(0, Math.min(pool.length - 1, 1 + (trust >= 7 ? 1 : trust < 4 ? -1 : 0)));
        return { mode: 'smalltalk', body: pool[step] };
      }
      const homeGreet = {
        guarded: ["What is it.", "Morning. Something you need.", "Mm. Out with it."],
        skittish: ["Oh — it's you. What is it?", "Morning, morning. Nothing wrong, I hope?", "Good of you to find me. What is it."],
        blunt: ["Talk.", "Morning. What do you need.", "What."],
        open: ["There you are! What can I do for you?", "Morning! Ask away.", "Good to see you up. What is it?"],
        even: ["Morning. What is it?", "You're about early. Ask away.", "Mm. What can I do for you."]
      };
      const pool = homeGreet[manner] || homeGreet.even;
      const step = Math.max(0, Math.min(pool.length - 1, 1 + (trust >= 7 ? 1 : trust < 4 ? -1 : 0)));
      return { mode: 'smalltalk', body: pool[step] };
    }
    const greet = {
      guarded: ['State your business.', 'Mm. Day\'s a day. Something you want?', 'You again. Well — out with it, then.'],
      skittish: ['Oh — hello. You startled me. What is it?', 'Hello, hello. Nothing\'s wrong, I hope?', 'Good of you to come to ME with it, whatever it is.'],
      blunt: ['Talk if you\'re talking.', 'Well met. Skip the weather — what do you need?', 'You found me. Go on.'],
      open: ['Well met! Don\'t get many travelers — what can I do for you?', 'Ha — good day to you! Ask away.', 'There\'s a friendly face. What\'s on your mind?'],
      even: ['Mm. Day\'s a day. Something you want?', 'Well met. Quiet day, as they go. Ask what you came to ask.', 'Good to see you. What can I do for you?']
    };
    const manner = voiceManner(npcVoice(npc));
    const pool = greet[manner] || greet.even;
    const step = Math.max(0, Math.min(pool.length - 1, 1 + (trust >= 7 ? 1 : trust < 4 ? -1 : 0)));
    return { mode: 'smalltalk', body: pool[step] };
  }

  return null;
}

function capitalize(s) { const x = String(s || ''); return x.charAt(0).toUpperCase() + x.slice(1); }

// (W-6) Render a resolved place-fact in NPC VOICE — a RENDERER only, adds ZERO facts.
// `fact.body` is the substrate truth the DM-narrator also renders; here it is framed as the
// local speaking, with manner colouring DELIVERY, never content. §0-safe: the body is
// authored never to allude to the cosmology, and these frames assert no world fact (only
// attitude). New place TYPES inherit a plain frame until given a voiced one.
function renderPlaceFactNpc(npc, fact) {
  const raw = String(fact?.body || '').trim();
  if (!raw) return null;
  const S = capitalize(raw);
  const manner = voiceManner(npcVoice(npc));
  if (fact.type === 'founding') {
    const f = {
      guarded: `${S}. Old story. That's the whole of it.`,
      skittish: `${S} — or so it's told. I don't dwell on it.`,
      blunt: `${S}. There's your history.`,
      open: `Ah, you want the old tale! ${S}. That's how this place came to be.`,
      even: `${S}. That's the long and short of how it began.`
    };
    return f[manner] || f.even;
  }
  if (fact.type === 'events') {
    const f = {
      guarded: `${S}. Best left where it lies.`,
      skittish: `${S}. I'd as soon not chew on it.`,
      blunt: `${S}. That's what happened.`,
      open: `Oh, there's a tale. ${S}. That's the talk of it.`,
      even: `${S}. That's what's stirred here of late.`
    };
    return f[manner] || f.even;
  }
  if (fact.type === 'population') {
    const f = {
      guarded: `${S}. Mind your own and they'll mind theirs.`,
      skittish: `${S}. Quiet sorts, mostly.`,
      blunt: `${S}. That's the lot.`,
      open: `${S} — that's who you'll meet about!`,
      even: `${S}. That's who you'll find here.`
    };
    return f[manner] || f.even;
  }
  return `${S}.`;
}

// (P-2) Render a resolved person-IDENTITY fact in NPC VOICE — a RENDERER only, adds ZERO facts.
// `fact.body` is "<name>, a <role>" (the same the narrator renders). Manner colours delivery, never
// content — these frames assert nothing about the person beyond their public identity + presence.
// §0-safe: never allegiance, faction, or motive.
function renderPersonIdentityNpc(npc, fact) {
  const raw = String(fact?.body || '').trim();
  if (!raw) return null;
  const S = capitalize(raw);
  const manner = voiceManner(npcVoice(npc));
  const f = {
    guarded: `${S}. That's all I'll say of them.`,
    skittish: `${S}, or so I've gathered. I keep to my own.`,
    blunt: `${S}. That's who.`,
    open: `Oh, that's ${raw} — you'll have seen them about, surely!`,
    even: `${S} — you'll have seen them about.`
  };
  return f[manner] || f.even;
}

// The asked-after person is PRESENT — the speaking NPC points them out rather
// than deflecting. Never denies someone standing right here (D-B4 residual c).
function renderPersonLocationNpc(npc, fact) {
  const who = String(fact?.name || fact?.body || '').trim();
  if (!who) return null;
  const manner = voiceManner(npcVoice(npc));
  const f = {
    guarded: `${who}? Right here, same as you. Eyes open.`,
    skittish: `${who}'s here — right here, about the place. See for yourself.`,
    blunt: `${who}? Standing right here. Look around.`,
    open: `Oh, ${who}? Right here with us — you'll not have to go far!`,
    even: `${who}? Right here — about the place, same as the rest of us.`
  };
  return f[manner] || f.even;
}

// ─────────────────────────────────────────────────────────────────────────────
// askNpc

export function askNpc(world, text) {
  let w = ensureWorld(world);
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
  const manner = voiceManner(npcVoice(npc));
  const knownIds = new Set((npc.knowledgeGraph || []).map(f => String(f.factId || '')));
  const secrets = new Set(Array.isArray(npc.secrets) ? npc.secrets.map(String) : []);

  // Pass O2 — NPC Brain decision. Check Canon Log cache first, then use
  // deterministic fallback. The decision enriches the outcome for narration.
  const curTurnBrain = Number(w.time?.turn ?? 0);
  let brainDecision = null;
  if (w.canonLog) {
    brainDecision = findCachedDecision(w.canonLog, d.npcId, curTurnBrain);
  }
  if (!brainDecision) {
    const brainContext = buildNpcContext(npc, w, text);
    brainDecision = fallbackRules(brainContext);
    // Canonize the decision for replay fidelity.
    if (w.canonLog) {
      const nextCanonLog = appendCanonEvent(w.canonLog, {
        id: `npcDecision:${d.npcId}:${curTurnBrain}`,
        type: 'npcDecision',
        targetId: d.npcId,
        decision: brainDecision
      });
      w = { ...w, canonLog: nextCanonLog };
    }
  }

  // Pass C1 — recruit branch. The literal "invite to travel" intercepts the
  // normal topic-extraction path. Outcome by trust band: ≥6 recruits and
  // emits a recruit beat (caller wires the beat — askNpc returns the
  // mode and the post-recruit world); 4-5 refuses soft (-1 trust); ≤3
  // refuses hard (-1 trust). Refusal paths consume a dialogue turn but
  // produce no recruit and no beat.
  if (INVITE_TEXT_RE.test(String(text || ''))) {
    return handleInviteToTravel(w, d, npc, trust);
  }

  // Pass H-9 — continuity challenge. Intercept BEFORE ordinary topic extraction:
  // resolve from the last thing this NPC actually said, or admit uncertainty.
  // Never deflect a contradiction back into atmospheric avoidance.
  if (CONTINUITY_CHALLENGE_RE.test(String(text || ''))) {
    return handleContinuityChallenge(w, d, npc, trust, manner, text);
  }

  const topic = extractTopic(text, npc);

  // Pass W1 — brain-driven mode override.
  // The brain decision can shift the default trust-threshold behavior:
  // - If brain.share includes the topic, upgrade from deflect to share (trust >= 3 guard)
  // - If brain.approach is 'deflect', downgrade share to deflect (trust < 7 guard)
  // - If brain.approach is 'lie', shift to lied if honesty allows
  // - Brain cannot override secret protection below trust 7
  let brainOverride = null;
  if (brainDecision && topic && knownIds.has(topic)) {
    const brainWantsToShare = Array.isArray(brainDecision.share) && brainDecision.share.includes(topic);
    const isSecret = secrets.has(topic);

    if (brainWantsToShare && !isSecret && trust >= 3) {
      // Brain volunteers a public fact — lower the threshold from 4 to 3
      brainOverride = 'shared';
    } else if (brainDecision.approach === 'deflect' && !isSecret && trust < 7) {
      // Brain deflects — override share to deflect unless high trust
      brainOverride = 'deflected';
    } else if (brainDecision.approach === 'lie' && !isSecret && honesty < 0.5) {
      // Brain lies — only if personality supports it
      brainOverride = 'lied';
    }
  }

  // Claim channel: parallel to the knowledge graph. Claims arrive via social
  // propagation (world.claims), not assignment at decompression. We check here,
  // before the knowledge-graph path, so a witnessed/heard event can surface even
  // when it was never formally added to the NPC's knowledgeGraph.
  //
  // Two-variance wall: we surface the NPC's distorted belief, never the engine's
  // truth. resolveClaimContext packs distortion + the raw event description so the
  // voice layer can render the NPC's MAP, not the territory.
  const heldClaim = findClaimForText(String(text || ''), w, npc.id);

  let mode;
  let factId = null;
  let commonBody = '';
  let claimData = null;

  if (!topic || !knownIds.has(topic)) {
    // Vision recognition — heretic NPC gate. Fires before trust check: if this
    // NPC is flagged heretic AND the player carries the vision mark AND the NPC
    // holds a claim about the subject, switch to recognition mode. The heretic
    // speaks to shared witness, not to the claim's epistemic content.
    if (heldClaim && npc.heretic && playerCarriesMark(w, 'vision:root')) {
      mode      = 'vision_recognition';
      factId    = heldClaim.subject;
      claimData = resolveClaimContext(w, heldClaim);
    } else if (heldClaim && trust >= TRUST_REVEAL_PUBLIC) {
      // Claim channel takes priority over common-knowledge / deflection when the
      // NPC holds a belief about the subject and trust is high enough.
      mode    = 'claim_recall';
      factId  = heldClaim.subject;
      claimData = resolveClaimContext(w, heldClaim);
    } else {
      // Common knowledge before deflection: name, village, roads, news.
      const common = commonKnowledgeAnswer(w, npc, text);
      if (common) { mode = common.mode; commonBody = common.body; }
      else { mode = 'deflected'; }
      factId = null;
    }
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
      mode = brainOverride || 'shared';
      factId = topic;
    } else if (brainOverride === 'shared') {
      // Brain override: share at trust 3+ for public facts
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

  // ── Pass O3 — NPC persistent memory ────────────────────────────────────
  // Record what happened from the NPC's perspective.
  // Pass D2 — pass currentTurn for memory timestamping.
  // Common-knowledge pleasantries don't mint memories — an NPC remembers what
  // you traded in trust, not that you asked their name or about the weather.
  const CLASSIC_MODES = new Set(['shared', 'lied', 'withheld', 'deflected', 'recruited', 'claim_recall']);
  const memoryEntry = CLASSIC_MODES.has(mode) ? extractMemory(npc, text, brainDecision, {
    mode,
    topic: factId || '',
    trustLevel: nextTrust,
    trustDelta
  }, curTurn) : null;
  let w3 = w2;
  if (memoryEntry) {
    w3 = applyDeltas(w2, [{ op: 'npcMemoryAdd', npcId: d.npcId, entry: memoryEntry }]);
  }

  // ── Pass R2 — rumor surfacing ──────────────────────────────────────────
  // After fact-based response, check if the NPC has rumors matching the topic.
  // Surface existing rumor bodies; signal lazy-mint opportunity if seeds match.
  const rumorSurface = surfaceRumorsForTopic(w3, npc, text);

  return {
    world: w3,
    outcome: {
      kind: 'dialogueAsk',
      ok: true,
      npcId: d.npcId,
      npcName: String(npc.name || ''),
      npcRole: String(npc.role || ''),
      topic: factId || '',
      mode,
      factId: factId || '',
      // Authored facts (story arcs) carry verbatim testimony — the words ARE
      // the content, so the narration layer speaks them instead of a template.
      factBody: String((npc.knowledgeGraph || []).find(f => f.factId === factId)?.body || ''),
      commonBody,
      manner,
      trustLevel: nextTrust,
      trustDelta,
      text: String(text || ''),
      brainDecision: brainDecision || null,
      brainMood: brainDecision?.mood || null,
      rumorBodies: rumorSurface.bodies,
      rumorMintHint: rumorSurface.mintHint,
      historicalFigureId: String(npc.historicalFigure || ''),
      // D-C1: corpus basename to ground this NPC's Opus voice (or '' if none
      // maps). PURE derivation — no fs, no state write; the SERVER does the
      // existence-gated retrieval, so a stale id degrades to templates silently.
      voiceCorpusId: String(npcVoiceCorpusId(npc) || ''),
      // Claim context — present only when mode === 'claim_recall'.
      // Contains the NPC's distorted belief about the subject; the voice layer
      // uses this to render their MAP of the event, not the engine's truth.
      claim: claimData
    }
  };
}

// ── Claim helpers ─────────────────────────────────────────────────────────────

// Token-score claim subjects against player text, same approach as extractTopic.
// Returns the strongest-matching claim this NPC holds, or null.
function findClaimForText(text, world, npcId) {
  const claims = Array.isArray(world.claims)
    ? world.claims.filter(c => c.holderNpcId === npcId)
    : [];
  if (!claims.length) return null;
  const t = text.toLowerCase();
  let best = null, bestScore = 0;
  for (const c of claims) {
    const tokens = String(c.subject || '').toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(tok => tok.length >= 3 && !STOP_TOKENS.has(tok));
    let score = 0;
    for (const tok of tokens) { if (t.includes(tok)) score++; }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore > 0 ? best : null;
}

// True iff party[0] carries the experiential mark (set by setPartyMark delta).
// Defined locally to avoid a circular import with playloop.js.
function playerCarriesMark(w, mark) {
  const marks = Array.isArray(w.party?.[0]?.marks) ? w.party[0].marks : [];
  return marks.includes(mark);
}

// Resolve the claim into voice-layer context. Pulls the raw event description
// from the timeline so the voice prompt has something to distort — but the
// LLM is instructed to render the NPC's map of it, not the truth itself.
function resolveClaimContext(world, claim) {
  const event = claim.eventRef
    ? (world.timeline ?? []).find(e => e.id === claim.eventRef)
    : null;
  return {
    subject:          claim.subject,
    distortion:       claim.distortion ?? 0,
    weight:           claim.weight     ?? 1,
    eventRef:         claim.eventRef   ?? null,
    provenance:       claim.provenance ?? [],
    eventDescription: event?.data?.description ?? event?.data?.text ?? null,
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

// H-9 — settle a continuity challenge. Resolve from the last answer this NPC
// gave in THIS dialogue: if there's a concrete prior fact, the NPC stands by it
// (reaffirm); if not, they own the slip and admit uncertainty. Either branch is
// an honest reckoning — mode='continuity', never 'deflected'. No trust change:
// being held to your word is neither a betrayal nor a gift.
function handleContinuityChallenge(w, d, npc, trust, manner, text) {
  const npcId = String(d.npcId);
  const prior = d.lastAnswer || null;
  const priorFactId = prior && prior.factId ? String(prior.factId) : '';
  const priorBody = priorFactId
    ? String((npc.knowledgeGraph || []).find(f => String(f.factId) === priorFactId)?.body || '')
    : '';
  const resolved = Boolean(priorFactId);

  const nextDialogue = {
    ...d,
    turnsInDialogue: Number(d.turnsInDialogue || 0) + 1,
    lastAnswer: { factId: priorFactId || null, mode: 'continuity', trustAtTime: trust }
  };
  const w2 = { ...w, scene: { ...w.scene, dialogue: nextDialogue } };

  return {
    world: w2,
    outcome: {
      kind: 'dialogueAsk',
      ok: true,
      npcId,
      npcName: String(npc.name || ''),
      npcRole: String(npc.role || ''),
      topic: priorFactId,
      mode: 'continuity',
      factId: priorFactId,
      factBody: priorBody,
      continuityResolved: resolved,
      manner,
      trustLevel: trust,
      trustDelta: 0,
      text: String(text || '')
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
// Pass R2 — rumor surfacing helper

function surfaceRumorsForTopic(world, npc, text) {
  const empty = { bodies: [], mintHint: null };
  if (!npc || !text) return empty;

  const rumorIds = Array.isArray(npc.rumorIds) ? npc.rumorIds : [];
  const rumors = Array.isArray(world.rumors) ? world.rumors : [];
  if (!rumors.length && !rumorIds.length) return empty;

  const trust = Number(npc.conversationState?.trustLevel ?? 5);
  const { surfacedRumors } = filterRumors(npc, rumors, { trust });

  // Match surfaced rumors to the topic text via tag overlap
  const t = String(text || '').toLowerCase();
  const bodies = [];
  for (const rumor of surfacedRumors) {
    const tags = Array.isArray(rumor.tags) ? rumor.tags : [];
    const bodyLower = String(rumor.body || '').toLowerCase();
    const tagMatch = tags.some(tag => t.includes(String(tag).toLowerCase()));
    const bodyMatch = bodyLower.split(/\s+/).some(w => w.length >= 4 && t.includes(w));
    if (tagMatch || bodyMatch) {
      bodies.push(String(rumor.body || ''));
    }
  }

  // If no existing rumors matched, signal that lazy minting could apply.
  // The caller (playloop) can then trigger async mintRumorForNpc.
  const mintHint = bodies.length === 0 && rumorIds.length === 0
    ? { npcId: String(npc.id || ''), topic: t }
    : null;

  return { bodies, mintHint };
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
