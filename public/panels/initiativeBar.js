// UI1 — Initiative tracker bar.
// Horizontal row of pills showing turn order during combat.

/**
 * Build the initiative tracker bar.
 * @param {object} world
 * @param {function} el - DOM builder from v1.js
 * @returns {HTMLElement|null}
 */
export function renderInitiativeBar(world, el) {
  const combat = world?.combat;
  if (!combat?.active) return null;

  const order = Array.isArray(combat.initiativeOrder) ? combat.initiativeOrder : [];
  if (order.length === 0) return null;

  const enemies = Array.isArray(combat.enemies) ? combat.enemies : [];
  const party = Array.isArray(world.party) ? world.party : [];
  const turnIndex = Number(combat.turnIndex) || 0;

  const pills = order.map((entry, i) => {
    const isCurrent = i === turnIndex;
    const name = resolveEntityName(entry, party, enemies);
    const defeated = isDefeated(entry, enemies);
    const colorClass = entry.type === 'party' && entry.id === 'party'
      ? 'init-player'
      : entry.type === 'party'
        ? 'init-companion'
        : 'init-enemy';

    const classes = [
      'init-pill',
      colorClass,
      isCurrent ? 'init-current' : '',
      defeated ? 'init-defeated' : ''
    ].filter(Boolean).join(' ');

    return el('div', { class: classes },
      el('span', { class: 'init-name' }, name),
      el('span', { class: 'init-total' }, String(entry.total))
    );
  });

  return el('div', { class: 'initiative-bar' }, ...pills);
}

function resolveEntityName(entry, party, enemies) {
  if (entry.type === 'party') {
    if (entry.id === 'party' && party[0]) return String(party[0].name || 'You');
    // Companion lookup
    for (let i = 1; i < party.length; i++) {
      if (party[i] && String(party[i].id || '') === entry.id) {
        return String(party[i].name || 'Companion');
      }
    }
    return party[0]?.name || 'You';
  }
  // Enemy lookup
  for (const en of enemies) {
    if (String(en.id || '') === entry.id) return String(en.name || 'Enemy');
  }
  return 'Unknown';
}

function isDefeated(entry, enemies) {
  if (entry.type === 'party') return false;
  for (const en of enemies) {
    if (String(en.id || '') === entry.id) {
      return Boolean(en.defeated) || (Number(en.hp) || 0) === 0;
    }
  }
  return false;
}
