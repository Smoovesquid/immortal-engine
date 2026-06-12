// The npc-voice prompt, as a pure function — testable without a model.
// `manner` (engine/npc/dialogue.js npcVoice/voiceManner) styles the DELIVERY:
// the engine has already decided WHAT happens (share/deflect/withhold/lie);
// the model only chooses the words, in this person's mouth.

const DECISIONS = {
  shared: (factPhrase) => `You have decided to SHARE what you know about ${factPhrase || 'the topic'} — answer helpfully and concretely (invent small local color but no names of people or places).`,
  deflected: () => 'You have decided to DEFLECT — dodge the question without answering it, stay pleasant or gruff per your mood.',
  withheld: () => 'You have decided to WITHHOLD — refuse plainly; you know something but will not say. Do not reveal anything.',
  lied: () => 'You have decided to LIE — give a smooth false answer. Keep it vague; do not invent names.',
  recruited: () => 'You have decided to JOIN the player — accept and fall in.'
};

const MANNER_STYLE = {
  guarded: 'Your manner: GUARDED. Few words. Nothing offered free. No pleasantries, no apologies.',
  skittish: 'Your manner: SKITTISH. Nervous, hedging, aware of who might be listening; you trail off and double back.',
  blunt: 'Your manner: BLUNT. Short declaratives. No softening, no hedging, no flattery.',
  open: 'Your manner: OPEN. Warm, talkative, glad of the company — maybe one word more than needed.',
  even: ''
};

/**
 * buildNpcVoicePrompt({npcName, role, mood, manner, mode, factPhrase, playerLine})
 *   -> string | null  (null = mode the voice layer must not speak for)
 */
export function buildNpcVoicePrompt(p = {}) {
  const mode = String(p.mode || '');
  const decision = DECISIONS[mode];
  if (!decision || !p.npcName) return null;
  const style = MANNER_STYLE[String(p.manner || '')] || '';
  return [
    `You are ${p.npcName}, a ${p.role || 'villager'} in a low-fantasy village. Mood: ${p.mood || 'even'}.`,
    ...(style ? [style] : []),
    `The player said to you: "${p.playerLine || ''}"`,
    decision(String(p.factPhrase || '')),
    'Reply with EXACTLY ONE line of spoken dialogue (under 30 words), in plain speech, no stage directions, no names of specific people or places.'
  ].join('\n');
}
