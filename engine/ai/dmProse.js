/**
 * DM prose — the offline-safe narrator voice.
 *
 * Assembles a line of narration from structured facts, honouring the perception
 * firewall: it NAMES only what the player can see (from the tactical context),
 * turns sensed-but-unseen things into dread without identifying them, and may weave
 * in a rumor or ecology beat. Works with no API key (deterministic composition);
 * the LLM layer (llmAdapter) only polishes this, never replaces the facts.
 *
 * PURE + DETERMINISTIC.
 */

const TONE_OPEN = {
  grim: ['The air hangs heavy here.', 'Nothing moves but the wind.', 'A cold quiet holds the place.'],
  blood: ['Something has bled here, and recently.', 'The ground remembers violence.', 'A coppery tang rides the air.'],
  cooperative: ['The place feels almost welcoming.', 'There is warmth here, of a kind.', 'A lived-in calm settles over it.']
};
const pick = (arr, k) => arr[Math.abs(hash(k)) % arr.length];
const hash = s => { let h = 0; const x = String(s); for (let i = 0; i < x.length; i++) h = (h * 31 + x.charCodeAt(i)) | 0; return h; };

function settingSentence(place, tone, seedKey) {
  const where = place ? `You stand in ${place}.` : '';
  return `${where} ${pick(TONE_OPEN[tone] || TONE_OPEN.grim, seedKey)}`.trim();
}
function seenSentence(seen) {
  if (!seen.length) return '';
  const names = seen.map(s => s.cover && s.cover !== 'none' ? `${s.name} (behind cover)` : s.name);
  if (names.length === 1) return `${names[0]} is here, plain to see.`;
  return `You see ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`;
}
function sensedSentence(sensed) {
  if (!sensed.length) return '';
  const s = sensed[0];
  return `Something you cannot place stirs to the ${s.dir} — ${s.hint}.`;
}
function rumorSentence(r) {
  if (!r) return '';
  const body = (r.truthBody || r.body || r.primaryName || '').trim();
  return body ? `You recall the talk: ${body}` : '';
}

// composeDMLine({ place, tone, tactical, rumors, lastAction, seedKey }) -> string
export function composeDMLine({ place = '', tone = 'grim', tactical = null, rumors = [], lastAction = null, seedKey = '' } = {}) {
  const parts = [];
  if (lastAction) parts.push(String(lastAction).trim());
  parts.push(settingSentence(place, tone, seedKey || place));
  if (tactical) { const s = seenSentence(tactical.seen || []); if (s) parts.push(s); const h = sensedSentence(tactical.sensed || []); if (h) parts.push(h); }
  if (rumors && rumors.length) { const r = rumorSentence(rumors[0]); if (r) parts.push(r); }
  return parts.filter(Boolean).join(' ');
}
