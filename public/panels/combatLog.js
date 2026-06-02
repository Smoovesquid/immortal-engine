// UI1 — Structured combat log.
// Parses the semicolon-delimited combatSummary into visual entries.

/**
 * Build the structured combat log.
 * @param {string} combatSummary - semicolon-delimited combat summary string
 * @param {function} el - DOM builder from v1.js
 * @returns {HTMLElement}
 */
export function renderCombatLog(combatSummary, el) {
  const raw = String(combatSummary || '');
  if (!raw.trim()) {
    return el('div', { class: 'combat-log empty-muted' }, 'No combat actions yet.');
  }

  const entries = raw.split(/;\s*/).filter(s => s.trim());

  const rows = entries.map(entry => {
    const trimmed = entry.trim();

    // Detect banner endings
    if (/last enemy falls/i.test(trimmed)) {
      return el('div', { class: 'clog-banner clog-victory' }, trimmed);
    }
    if (/you fall/i.test(trimmed)) {
      return el('div', { class: 'clog-banner clog-defeat' }, trimmed);
    }

    const { icon, typeClass } = classifyEntry(trimmed);
    const decorated = decorateEntry(trimmed, el);

    return el('div', { class: `clog-row ${typeClass}` },
      el('span', { class: 'clog-icon' }, icon),
      el('span', { class: 'clog-text' }, ...decorated)
    );
  });

  return el('div', { class: 'combat-log' }, ...rows);
}

function classifyEntry(text) {
  if (/^Lair:/i.test(text)) return { icon: '\uD83C\uDFD4', typeClass: 'clog-lair' };
  if (/legendary:/i.test(text)) return { icon: '\uD83D\uDC51', typeClass: 'clog-legendary' };
  if (/reacts|parried/i.test(text)) return { icon: '\uD83D\uDEE1', typeClass: 'clog-reaction' };
  if (/cast/i.test(text)) return { icon: '\u2728', typeClass: 'clog-spell' };
  if (/\u2192|→/.test(text)) return { icon: '\uD83D\uDC80', typeClass: 'clog-enemy' };
  if (/force|finesse|endure|heart|focus/i.test(text)) return { icon: '\u2694', typeClass: 'clog-player' };
  return { icon: '\u2694', typeClass: 'clog-player' };
}

const DAMAGE_TYPE_CLASSES = {
  slashing: 'dmg-physical', piercing: 'dmg-physical', bludgeoning: 'dmg-physical',
  fire: 'dmg-fire', cold: 'dmg-cold', lightning: 'dmg-lightning', acid: 'dmg-acid',
  necrotic: 'dmg-necrotic', radiant: 'dmg-radiant', psychic: 'dmg-psychic',
  poison: 'dmg-poison', force: 'dmg-force', temporal: 'dmg-temporal', entropic: 'dmg-entropic'
};

const DAMAGE_TYPES_RE = new RegExp(
  '\\b(' + Object.keys(DAMAGE_TYPE_CLASSES).join('|') + ')\\b', 'gi'
);

function decorateEntry(text, el) {
  // Split on patterns we want to highlight
  const fragments = [];
  let remaining = text;

  // Process the text linearly, highlighting special tokens
  const TOKEN_RE = /(\d+)\s+(slashing|piercing|bludgeoning|fire|cold|lightning|acid|necrotic|radiant|psychic|poison|force|temporal|entropic)|(\bmisses\b)|(\bCRITICAL\b)|(\bimmune\b)|(\bresistant\b)/gi;

  let lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(remaining)) !== null) {
    // Push preceding text
    if (match.index > lastIndex) {
      fragments.push(remaining.slice(lastIndex, match.index));
    }

    if (match[4]) {
      // CRITICAL
      fragments.push(el('span', { class: 'clog-crit' }, match[0]));
    } else if (match[3]) {
      // misses
      fragments.push(el('span', { class: 'clog-miss' }, match[0]));
    } else if (match[5]) {
      // immune
      fragments.push(el('span', { class: 'clog-immune' }, match[0]));
    } else if (match[6]) {
      // resistant
      fragments.push(el('span', { class: 'clog-resistant' }, match[0]));
    } else if (match[1] && match[2]) {
      // Damage number + type
      const dmgClass = DAMAGE_TYPE_CLASSES[match[2].toLowerCase()] || 'dmg-physical';
      fragments.push(
        el('span', { class: 'clog-dmg' }, match[1]),
        ' ',
        el('span', { class: `clog-dtype ${dmgClass}` }, match[2])
      );
    } else {
      fragments.push(match[0]);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < remaining.length) {
    fragments.push(remaining.slice(lastIndex));
  }

  return fragments;
}
