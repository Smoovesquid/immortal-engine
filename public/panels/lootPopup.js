// UI1 — Victory loot popup overlay.
// Shows loot obtained when combat ends in victory.

// Turn a defRef like "healing_potion_minor" into "Healing Potion Minor".
function prettyItemName(ref) {
  const s = String(ref || '').trim();
  if (!s) return 'Unknown item';
  return s.split(/[_\s]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Normalize loot into { items: [...], currency: {copper,silver,gold,platinum} }.
// The engine emits loot as a flat array of results
//   { kind:'item', defRef, rarity, source } | { kind:'currency', currency, amount, source }
// (see combatResolve.js + escapeCombat.js). We also tolerate the older object
// shape { items, currency } so nothing regresses if a caller still uses it.
function normalizeLoot(loot) {
  const currency = { copper: 0, silver: 0, gold: 0, platinum: 0 };
  const items = [];

  if (Array.isArray(loot)) {
    for (const x of loot) {
      if (!x || typeof x !== 'object') continue;
      if (x.kind === 'currency' && x.currency && currency.hasOwnProperty(x.currency)) {
        currency[x.currency] += Number(x.amount) || 0;
      } else if (x.kind === 'item' && x.defRef) {
        items.push({ name: prettyItemName(x.defRef), rarity: String(x.rarity || 'common').toLowerCase() });
      }
    }
    return { items, currency };
  }

  // Legacy object shape.
  const obj = loot && typeof loot === 'object' ? loot : {};
  const objItems = Array.isArray(obj.items) ? obj.items : [];
  for (const it of objItems) {
    items.push({ name: prettyItemName(it.defRef || it.name || it.id), rarity: String(it.rarity || 'common').toLowerCase() });
  }
  const c = obj.currency && typeof obj.currency === 'object' ? obj.currency : {};
  for (const k of Object.keys(currency)) currency[k] = Number(c[k]) || 0;
  return { items, currency };
}

/**
 * Build the loot popup overlay.
 * @param {object} lootData - { reason, loot } where loot is the engine's flat array
 * @param {function} el - DOM builder from v1.js
 * @param {function} onDismiss - callback to close the popup
 * @returns {HTMLElement}
 */
export function renderLootPopup(lootData, el, onDismiss) {
  const { items, currency } = normalizeLoot(lootData?.loot);

  const dismiss = () => { if (typeof onDismiss === 'function') onDismiss(); };

  // Item rows
  const itemRows = items.length > 0
    ? items.map(item => el('div', { class: `loot-item loot-rarity-${item.rarity}` }, item.name))
    : null;

  // Currency row (highest denomination first)
  const coins = [];
  const platinum = Number(currency.platinum) || 0;
  const gold = Number(currency.gold) || 0;
  const silver = Number(currency.silver) || 0;
  const copper = Number(currency.copper) || 0;
  if (platinum > 0) coins.push(el('span', { class: 'loot-coin coin-platinum' }, `${platinum} platinum`));
  if (gold > 0) coins.push(el('span', { class: 'loot-coin coin-gold' }, `${gold} gold`));
  if (silver > 0) coins.push(el('span', { class: 'loot-coin coin-silver' }, `${silver} silver`));
  if (copper > 0) coins.push(el('span', { class: 'loot-coin coin-copper' }, `${copper} copper`));

  const gotNothing = itemRows === null && coins.length === 0;

  const panel = el('div', { class: 'loot-panel' },
    el('div', { class: 'loot-header' }, 'VICTORY'),
    el('div', { class: 'loot-subheader' }, gotNothing ? 'The fallen carried nothing.' : 'Loot obtained:'),
    itemRows ? el('div', { class: 'loot-items' }, ...itemRows) : null,
    coins.length > 0 ? el('div', { class: 'loot-currency' }, ...coins) : null,
    el('button', { class: 'btn primary loot-dismiss', onClick: dismiss }, 'Continue')
  );

  const backdrop = el('div', {
    class: 'loot-backdrop',
    onClick: (e) => { if (e.target === backdrop) dismiss(); }
  }, panel);

  // Escape key handler — attach to document, clean up on dismiss
  const onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      dismiss();
    }
  };
  document.addEventListener('keydown', onKey);

  return backdrop;
}
