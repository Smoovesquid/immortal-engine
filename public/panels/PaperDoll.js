// Visual gear slot layout for the status panel.
// Three active slots arranged as a paper-doll rack: main hand, armor, off hand.
// Empty slots show muted placeholders; equipped items glow gold.

const SLOTS = [
  { key: 'main_hand', label: 'Main Hand' },
  { key: 'armor',     label: 'Armor' },
  { key: 'off_hand',  label: 'Off Hand' },
];

function getItemDef(defRef) {
  if (!defRef) return null;
  try { return (typeof window !== 'undefined' && window.__itemCatalog)
    ? window.__itemCatalog[String(defRef)] : null; }
  catch { return null; }
}

function itemName(item) {
  if (!item) return null;
  if (item.name) return String(item.name);
  const def = getItemDef(item.defRef);
  return def?.name ? String(def.name) : (item.defRef ? String(item.defRef).replace(/_/g, ' ') : null);
}

export function renderPaperDoll(world) {
  const pc = world?.party?.[0];
  if (!pc) return null;

  const items = Array.isArray(pc.inventory?.items) ? pc.inventory.items : [];
  const bySlot = {};
  for (const it of items) {
    if (it.equipped) bySlot[it.equipped] = it;
  }

  const section = document.createElement('section');
  section.className = 'status-section paper-doll-section';
  section.setAttribute('aria-label', 'Equipped gear');

  const heading = document.createElement('h3');
  heading.className = 'status-heading';
  heading.textContent = 'Equipped';
  section.appendChild(heading);

  const rack = document.createElement('div');
  rack.className = 'paper-doll-rack';

  for (const slot of SLOTS) {
    const it = bySlot[slot.key] || null;
    const name = itemName(it);
    const isMagical = it && (Boolean(it.magical) || Boolean(getItemDef(it.defRef)?.bonus) || Boolean(getItemDef(it.defRef)?.acBonus));

    const card = document.createElement('div');
    card.className = 'doll-slot' + (it ? ' doll-slot-filled' : '');

    const lbl = document.createElement('div');
    lbl.className = 'doll-slot-label';
    lbl.textContent = slot.label;

    const val = document.createElement('div');
    val.className = 'doll-slot-value' + (isMagical ? ' magical' : '');
    val.textContent = name || '—';
    if (name) val.title = name;

    card.appendChild(lbl);
    card.appendChild(val);
    rack.appendChild(card);
  }

  section.appendChild(rack);

  // Unequipped notable items (weapons, armor not in a slot) as a compact list.
  const unequipped = items.filter(it => !it.equipped);
  if (unequipped.length > 0) {
    const ul = document.createElement('div');
    ul.className = 'doll-pack';
    for (const it of unequipped.slice(0, 8)) {
      const n = itemName(it);
      if (!n) continue;
      const li = document.createElement('div');
      li.className = 'doll-pack-item';
      const qty = it.qty && it.qty > 1 ? ` x${it.qty}` : '';
      li.textContent = n + qty;
      ul.appendChild(li);
    }
    if (ul.childNodes.length > 0) {
      const packLbl = document.createElement('div');
      packLbl.className = 'doll-pack-heading';
      packLbl.textContent = 'Pack';
      section.appendChild(packLbl);
      section.appendChild(ul);
    }
  }

  return section;
}
