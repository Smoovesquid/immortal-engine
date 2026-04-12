// Pass S2 — Spellbook panel.
// Renders known spells, slot usage, and concentration status from world.party[0].spells.
// Imports SPELL_REGISTRY to resolve defRef -> display info (name, level, school).

import { SPELL_REGISTRY } from '../../engine/ruleset/core/spells/index.js';

/**
 * Build the spellbook status-section element.
 * @param {object} world
 * @param {function} el - DOM builder from v1.js
 * @returns {HTMLElement}
 */
export function renderSpellbookSection(world, el) {
  const pc = Array.isArray(world?.party) && world.party[0] ? world.party[0] : null;
  const spells = pc?.spells;

  if (!spells || !Array.isArray(spells.known) || spells.known.length === 0) {
    return el('section', { class: 'status-section', 'aria-label': 'Spellbook' },
      el('h3', { class: 'status-heading' }, 'Spellbook'),
      el('div', { class: 'empty-muted' }, 'No spells known.')
    );
  }

  // Slot summary
  const slotEntries = [];
  const slots = spells.slots && typeof spells.slots === 'object' ? spells.slots : {};
  const maxSlots = spells.maxSlots && typeof spells.maxSlots === 'object' ? spells.maxSlots : {};
  for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const max = Number(maxSlots[lvl]) || 0;
    if (max <= 0) continue;
    const used = max - Math.max(0, Number(slots[lvl]) || 0);
    slotEntries.push(el('span', { class: 'spell-slot-pip' },
      `L${lvl}: ${Math.max(0, Number(slots[lvl]) || 0)}/${max}`
    ));
  }

  // Concentration status
  const conc = spells.concentration;
  const concEl = conc
    ? el('div', { class: 'spell-concentration active' },
        el('span', { class: 'spell-conc-icon' }, '(*)'),
        ` Concentrating: ${resolveSpellName(conc.spellRef)}`
      )
    : null;

  // Spell list
  const spellItems = spells.known.map(ref => {
    const def = SPELL_REGISTRY[ref] || null;
    const name = def?.name || ref;
    const level = def ? (def.level === 0 ? 'cantrip' : `L${def.level}`) : '?';
    const school = def?.school || '';
    const isConcentrating = conc && conc.spellRef === ref;

    return el('div', { class: `spell-entry${isConcentrating ? ' concentrating' : ''}` },
      el('div', { class: 'spell-entry-header' },
        el('span', { class: 'spell-name' }, name),
        el('span', { class: 'spell-level' }, level),
        school ? el('span', { class: 'spell-school' }, school) : null
      ),
      def?.duration && def.duration !== 'instant'
        ? el('div', { class: 'spell-detail' },
            def.concentration ? 'conc. ' : '',
            def.duration
          )
        : null
    );
  });

  return el('section', { class: 'status-section', 'aria-label': 'Spellbook' },
    el('h3', { class: 'status-heading' }, 'Spellbook'),
    slotEntries.length > 0
      ? el('div', { class: 'spell-slots-row' }, ...slotEntries)
      : null,
    concEl,
    el('div', { class: 'spell-list' }, ...spellItems)
  );
}

function resolveSpellName(ref) {
  const def = SPELL_REGISTRY[ref];
  return def?.name || ref || '(unknown)';
}
