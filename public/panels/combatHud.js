// Pass S2 — Combat HUD panel.
// Replaces the minimal S1 combat section with HP bars, player vitals,
// and round counter. Only visible when world.combat.active === true.

/**
 * Build the combat HUD status-section element.
 * @param {object} world
 * @param {function} el - DOM builder from v1.js
 * @returns {HTMLElement}
 */
export function renderCombatHudSection(world, el) {
  const combat = world?.combat;
  const active = Boolean(combat?.active);

  const section = el('section', {
    class: 'status-section',
    'aria-label': 'Combat HUD',
    hidden: !active
  });

  if (!active) return section;

  const pc = Array.isArray(world?.party) && world.party[0] ? world.party[0] : null;
  const enemies = Array.isArray(combat.enemies) ? combat.enemies : [];
  const round = Number(combat.round) || 0;

  // Header
  section.appendChild(
    el('div', { class: 'combat-hud-header' }, `COMBAT — Round ${round}`)
  );

  // Player vitals
  if (pc) {
    const maxWounds = Number(pc.maxWounds) || 6;
    const wounds = Math.max(0, Math.min(maxWounds, Number(pc.wounds) || 0));
    const playerHpCur = maxWounds - wounds;
    const playerHpMax = maxWounds;
    const stress = Math.max(0, Math.min(6, Number(pc.stress) || 0));

    section.appendChild(
      el('div', { class: 'combat-player-vitals' },
        el('div', { class: 'combat-vital-row' },
          el('span', { class: 'combat-vital-label' }, String(pc.name || 'You')),
          renderHpBar(el, playerHpCur, playerHpMax)
        ),
        stress > 0
          ? el('div', { class: 'combat-vital-row' },
              el('span', { class: 'combat-vital-label stress-label' }, 'Stress'),
              el('span', { class: 'combat-stress-val' }, `${stress}/6`)
            )
          : null
      )
    );
  }

  // Enemy list with HP bars
  if (enemies.length > 0) {
    section.appendChild(
      el('div', { class: 'combat-enemies-hud' },
        ...enemies.map(en => {
          const maxHp = Math.max(1, Number(en.maxHp) || 1);
          const hp = Math.max(0, Math.min(maxHp, Number(en.hp) || 0));
          const defeated = Boolean(en.defeated) || hp === 0;

          return el('div', { class: `combat-enemy-row${defeated ? ' defeated' : ''}` },
            el('div', { class: 'combat-enemy-info' },
              el('span', { class: 'combat-enemy-name' }, String(en.name || 'enemy')),
              en.canParley
                ? el('span', { class: 'combat-tag parley' }, 'parley')
                : null
            ),
            renderHpBar(el, hp, maxHp, defeated)
          );
        })
      )
    );
  }

  section.appendChild(
    el('div', { class: 'combat-hint' }, 'attack <name> | focus <name> | flee')
  );

  return section;
}

function renderHpBar(el, current, max, defeated) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const color = defeated ? 'var(--muted)'
    : pct > 50 ? 'var(--ok)'
    : pct > 25 ? 'var(--amber)'
    : 'var(--danger)';

  return el('div', { class: 'hp-bar-container' },
    el('div', { class: 'hp-bar-track' },
      el('div', { class: 'hp-bar-fill', style: { width: `${pct}%`, background: color } })
    ),
    el('span', { class: 'hp-bar-text' }, `${current}/${max}`)
  );
}
