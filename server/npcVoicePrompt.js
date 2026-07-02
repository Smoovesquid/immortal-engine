// The npc-voice prompt, as a pure function — testable without a model.
// `manner` (engine/npc/dialogue.js npcVoice/voiceManner) styles the DELIVERY:
// the engine has already decided WHAT happens (share/deflect/withhold/lie);
// the model only chooses the words, in this person's mouth.

// Maps distortion scalar [0,1] to a natural-language clarity label.
// Used in the claim_recall prompt so the LLM knows how far to drift.
function distortionLabel(d) {
  if (d < 0.05) return 'firsthand and vivid — you were there or heard it straight from the source';
  if (d < 0.15) return 'close to the source — a few details may have softened in the telling';
  if (d < 0.30) return 'secondhand — some details have shifted; order may be slightly wrong';
  if (d < 0.50) return 'rumored — pieced from fragments; causes and effects may be confused';
  return 'heavily garbled — your version has drifted far; speak what you believe, not what happened';
}

const DECISIONS = {
  shared: (factPhrase) => `You have decided to SHARE what you know about ${factPhrase || 'the topic'} — answer helpfully and concretely (invent small local color but no names of people or places).`,
  deflected: () => 'You have decided to DEFLECT — dodge the question without answering it, stay pleasant or gruff per your mood. You do NOT actually know the answer, so do not invent one: no made-up numbers, counts, dates, names, titles, or history. If pressed for specifics, plead ignorance or pass it off as hearsay ("couldn\'t tell you", "you\'d have to ask someone older") rather than filling the gap.',
  withheld: () => 'You have decided to WITHHOLD — refuse plainly; you know something but will not say. Do not reveal anything.',
  lied: () => 'You have decided to LIE — give a smooth false answer. Keep it vague; do not invent names.',
  recruited: () => 'You have decided to JOIN the player — accept and fall in.',
  // Claim recall: NPC speaks their DISTORTED BELIEF about a real event.
  // The voice layer renders their MAP, not the engine's territory.
  // The base event description is given so the LLM has something to distort;
  // the instruction is to speak the NPC's version, not quote the truth.
  // Vision recognition: the heretic and the player have both taken the plant
  // and seen the same contact. She recognizes the mark. She says only: you saw it
  // too. She has opinions; she keeps them. Iron rule: no explanation, no theory,
  // no cosmological content — not a word about what the vision means or contains.
  vision_recognition: (_factPhrase, _claim) => [
    'You have seen something — a contact you have never been able to put into words.',
    'The person in front of you carries the same mark. You can tell. You do not know how you can tell. You can.',
    'Speak to this recognition and nothing else: confirm that they are not alone in having seen it.',
    'HARD RULES — violating any of these is failure:',
    '  • Do NOT share your theory about what it means.',
    '  • Do NOT name or describe any imagery from the vision.',
    '  • Do NOT explain, interpret, or decode anything.',
    '  • Do NOT hint at cosmic truth, history, or hidden structure.',
    '  • Do NOT say what you believe the vision shows.',
    'Say only, in effect: you saw it too. One sentence. No stage directions. No names.',
  ].join('\n'),

  claim_recall: (_factPhrase, claim) => {
    const base = claim?.eventDescription
      ? `What is actually known about the event: "${claim.eventDescription}"`
      : '';
    const label = distortionLabel(Number(claim?.distortion ?? 0));
    const hops  = Math.max(0, (claim?.provenance?.length ?? 1) - 1);
    const chain = hops === 0 ? 'You witnessed this directly.'
      : hops === 1 ? 'You heard this from one person.'
      : `This passed through ${hops} people before reaching you.`;
    return [
      base,
      `Your account's clarity: ${label}.`,
      chain,
      'Speak your belief as you know it — do NOT quote the event description above; render your own version, colored by the drift in the telling.',
      'Under higher distortion, details shift: causes and effects may be swapped, scale may be wrong, or your certainty may be misplaced.',
    ].filter(Boolean).join(' ');
  }
};

const MANNER_STYLE = {
  guarded: 'Your manner: GUARDED. Few words. Nothing offered free. No pleasantries, no apologies.',
  skittish: 'Your manner: SKITTISH. Nervous, hedging, aware of who might be listening; you trail off and double back.',
  blunt: 'Your manner: BLUNT. Short declaratives. No softening, no hedging, no flattery.',
  open: 'Your manner: OPEN. Warm, talkative, glad of the company — maybe one word more than needed.',
  even: ''
};

// WHO THEY ARE — the personality (from npcVoice's banded axes, collapsed to a
// manner) framed as character, not just delivery. Leads the prompt so the person,
// not the job title, governs the voice.
const MANNER_PERSONA = {
  guarded: 'By nature you are guarded and slow to warm to anyone — you give little away.',
  skittish: 'By nature you are nervous and watchful, forever aware of who else might be listening.',
  blunt: 'By nature you are blunt and unflinching — you say what you mean, plainly.',
  open: 'By nature you are warm and openhanded, glad of company and quick to talk.',
  even: 'By nature you are even-tempered, taking people as they come.'
};

// HOW THEY REGARD THE PLAYER — the relationship, which is what actually warms or
// cools a reply. trust is 0–10 (conversationState.trustLevel). Absent → omitted.
function trustTier(trust) {
  const t = Number(trust);
  if (!Number.isFinite(t)) return '';
  if (t >= 8) return 'You know and trust this person; you speak freely and warmly with them.';
  if (t >= 6) return 'You have warmed to this person; you would help them if they asked.';
  if (t >= 4) return 'This person is barely an acquaintance — you are civil, but you hold back.';
  if (t >= 2) return 'You are wary of this person; they have given you scant reason to open up.';
  return 'You distrust this person and would rather be done with them.';
}

// Formats cascade-weighted world knowledge for the NPC voice prompt.
// Each rung of the cascade gets different framing: the NPC's own town is vivid
// and opinionated; the region is vague common knowledge; the cosmological age
// is faint myth. Two NPCs from different towns diverge here.
function buildWorldKnowledgeBlock(npcName, substrateContext) {
  const entries = Array.isArray(substrateContext) ? substrateContext.filter(e => e?.label) : [];
  if (!entries.length) return null;

  const vivid  = entries.filter(e => e.clarity === 'vivid');
  const dim    = entries.filter(e => e.clarity === 'dim');
  const myth   = entries.filter(e => e.clarity === 'myth');

  const lines = [`WHAT ${(npcName || 'THIS PERSON').toUpperCase()} KNOWS (cascade rung — do NOT flatten these to the same weight):`];

  if (vivid.length) {
    lines.push(`[From this town — VIVID: these are ${npcName}'s events; specific, opinionated, possibly wrong in detail but felt strongly]`);
    for (const e of vivid) lines.push(`  • "${e.label}"`);
  }
  if (dim.length) {
    lines.push(`[From the wider region — DIM: common knowledge, rougher in the telling, second-hand]`);
    for (const e of dim) lines.push(`  • "${e.label}"`);
  }
  if (myth.length) {
    lines.push(`[From the age itself — MYTH: barely a whisper; use rarely or not at all; do not explain it]`);
    for (const e of myth) lines.push(`  • "${e.label}"`);
  }

  lines.push(`Ground your speech in this ladder: vivid events are YOURS (you lived them or heard them young — name them sharply); dim events are things everyone half-knows (vague, second-hand); myth is a rumor of a rumor. This is what makes you sound FROM somewhere.`);
  return lines.join('\n');
}

// P3 (WB-Q9) — WHERE-YOU-ARE facts, so the NPC voice stops inventing rooms,
// floors, and furnishings the current building doesn't have. `sceneFacts`
// comes from the engine's getRoomState (P2) — public room context (objects,
// doorways, layout), never a secret. Absent/outdoors → no block.
function buildSceneFactsBlock(sceneFacts) {
  if (!sceneFacts || !sceneFacts.inside) return null;
  const lines = ['WHERE YOU ARE (the only layout that exists — do not add to it):'];
  if (sceneFacts.buildingType) lines.push(`  • Building: ${sceneFacts.buildingType}`);
  if (Number.isFinite(sceneFacts.roomCount)) lines.push(`  • Rooms in this building: ${sceneFacts.roomCount}`);
  if (sceneFacts.singleStorey) lines.push('  • This building is SINGLE-STOREY: there is no upstairs, no second floor.');
  if (sceneFacts.roomName) lines.push(`  • You are in: ${sceneFacts.roomName}`);
  if (Array.isArray(sceneFacts.doorways) && sceneFacts.doorways.length) {
    lines.push(`  • Doorways/exits here: ${sceneFacts.doorways.join(', ')}`);
  }
  if (Array.isArray(sceneFacts.objects) && sceneFacts.objects.length) {
    lines.push(`  • Objects actually present: ${sceneFacts.objects.join(', ')}`);
  }
  lines.push('Speak only of rooms, floors, and furnishings listed here. A single-storey building has no upstairs; do not invent rooms, floors, or exits that aren\'t listed.');
  return lines.join('\n');
}

/**
 * buildNpcVoicePrompt({npcName, role, mood, manner, mode, factPhrase, playerLine, ragChunks, claim, substrateContext, sceneFacts})
 *   -> string | null  (null = mode the voice layer must not speak for)
 *
 * ragChunks: [{text, source}, ...] — primary source excerpts from this person's actual words.
 * claim: { distortion, weight, eventRef, eventDescription, provenance } — present only when
 *   mode === 'claim_recall'. The voice layer renders the NPC's distorted belief, not the truth.
 * substrateContext: [{layer, clarity, label, kind}, ...] — cascade-weighted world history.
 *   clarity 'vivid' = NPC's own town; 'dim' = their region; 'myth' = cosmological age.
 * sceneFacts: {inside, buildingType, roomCount, singleStorey, roomName, doorways, objects} — the
 *   room's real layout (engine's getRoomState). PUBLIC context only, never a secret.
 */
export function buildNpcVoicePrompt(p = {}) {
  const mode = String(p.mode || '');
  const decision = DECISIONS[mode];
  if (!decision || !p.npcName) return null;
  const style = MANNER_STYLE[String(p.manner || '')] || '';
  const chunks = Array.isArray(p.ragChunks) ? p.ragChunks.filter(c => c?.text) : [];
  const archiveHeader = p.ragReconstructed
    ? 'VOICE ARCHIVE — historically grounded speech, reconstructed to match this person\'s known character and values:'
    : 'VOICE ARCHIVE — authentic words written or spoken by this person:';
  const archiveFooter = p.ragReconstructed
    ? 'Speak as this person would have spoken: capture their known temperament and worldview. Do not reference modern concepts.'
    : 'Let the vocabulary, rhythm, and cadence of these excerpts shape your word choices. Do not quote them directly.';
  const archive = chunks.length > 0
    ? [archiveHeader, ...chunks.map(c => `[${c.source}] "${c.text}"`), archiveFooter].join('\n')
    : null;
  const worldKnowledge = buildWorldKnowledgeBlock(p.npcName, p.substrateContext);
  const sceneFactsBlock = buildSceneFactsBlock(p.sceneFacts);
  // claim_recall passes two args; all other modes ignore the second.
  const decisionText = decision(String(p.factPhrase || ''), p.claim ?? null);
  const persona = MANNER_PERSONA[String(p.manner || '')] || '';
  const relation = trustTier(p.trust);
  const roleWord = p.role || 'villager';
  const an = /^[aeiou]/i.test(roleWord) ? 'an' : 'a';
  // Lead with WHO they are and HOW they regard the player; the trade is context,
  // not the headline. This is what stops "role" from governing the voice.
  return [
    `You are ${p.npcName}.`,
    ...(persona ? [persona] : []),
    ...(relation ? [relation] : []),
    `You work as ${an} ${roleWord} in a low-fantasy village — that's your trade, not the whole of you.`,
    `Your mood right now: ${p.mood || 'even'}.`,
    ...(archive ? [archive] : []),
    ...(worldKnowledge ? [worldKnowledge] : []),
    ...(sceneFactsBlock ? [sceneFactsBlock] : []),
    ...(style ? [style] : []),
    `The player said to you: "${p.playerLine || ''}"`,
    decisionText,
    'Reply with EXACTLY ONE line of spoken dialogue (under 30 words), in plain speech, no stage directions. Invent NO specifics you were not given — no names of people or places, and no numbers, counts, dates, titles, or history. If you do not know, it is better to say so than to make something up.'
  ].join('\n');
}
