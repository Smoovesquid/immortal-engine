// UI1 — Victory loot popup overlay.
// Shows loot obtained when combat ends in victory.

/**
 * Build the loot popup overlay.
 * @param {object} lootData - { reason, loot: { items, currency } }
 * @param {function} el - DOM builder from v1.js
 * @param {function} onDismiss - callback to close the popup
 * @returns {HTMLElement}
 */
export function renderLootPopup(lootData, el, onDismiss) {
  const loot = lootData?.loot || {};
  const items = Array.isArray(loot.items) ? loot.items : [];
  const currency = loot.currency || {};

  const dismiss = () => { if (typeof onDismiss === 'function') onDismiss(); };

  // Item rows
  const itemRows = items.length > 0
    ? items.map(item => {
        const name = String(item.defRef || item.name || item.id || 'Unknown item');
        const rarity = String(item.rarity || 'common').toLowerCase();
        return el('div', { class: `loot-item loot-rarity-${rarity}` }, name);
      })
    : [el('div', { class: 'empty-muted' }, 'No items found.')];

  // Currency row
  const coins = [];
  const copper = Number(currency.copper) || 0;
  const silver = Number(currency.silver) || 0;
  const gold = Number(currency.gold) || 0;
  if (gold > 0) coins.push(el('span', { class: 'loot-coin coin-gold' }, `${gold} gold`));
  if (silver > 0) coins.push(el('span', { class: 'loot-coin coin-silver' }, `${silver} silver`));
  if (copper > 0) coins.push(el('span', { class: 'loot-coin coin-copper' }, `${copper} copper`));

  const panel = el('div', { class: 'loot-panel' },
    el('div', { class: 'loot-header' }, 'VICTORY'),
    el('div', { class: 'loot-subheader' }, 'Loot obtained:'),
    el('div', { class: 'loot-items' }, ...itemRows),
    coins.length > 0
      ? el('div', { class: 'loot-currency' }, ...coins)
      : null,
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
