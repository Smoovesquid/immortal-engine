import { el, clear, button } from './dom.js';

export function openPrintSheet(entity) {
  const w = window.open('', 'print-sheet');
  if (!w) return;

  const doc = w.document;
  doc.title = `Sheet - ${entity?.name || 'Character'}`;
  doc.body.innerHTML = '';

  const app = doc.createElement('div');
  doc.body.appendChild(app);

  const e = entity || {};
  const stats = e.stats || {};
  const inv = e.inventory || {};

  const style = doc.createElement('style');
  style.textContent = `
    body{font-family: ui-sans-serif, system-ui; padding: 20px;}
    h1{margin:0 0 6px 0;}
    .row{display:flex; gap:12px; flex-wrap:wrap;}
    .tag{border:1px solid #333; padding:2px 6px; border-radius:999px; font-size:12px;}
    .box{border:1px solid #333; padding:10px; border-radius:8px; margin:10px 0;}
    .small{font-size:12px; color:#333;}
    @media print{ .no-print{display:none;} }
  `;
  doc.head.appendChild(style);

  const mk = (node) => {
    const div = doc.createElement('div');
    div.appendChild(node);
    return div;
  };

  const root = el('div', { class: 'stack' },
    el('div', { class: 'no-print row' },
      button('Print', { className: 'btn', onClick: () => w.print() }),
      button('Close', { className: 'btn ghost', onClick: () => w.close() })
    ),
    el('h1', {}, e.name || 'Unnamed'),
    el('div', { class: 'small' }, `${e.archetype || e.background?.name || 'Unknown'} • ${e.vibe || e.traits?.vibe || ''}`),

    el('div', { class: 'box' },
      el('div', { class: 'row' },
        ...Object.entries(stats).map(([k,v]) => el('span', { class: 'tag' }, `${k}:${v}`))
      )
    ),

    el('div', { class: 'box' },
      el('div', { class: 'small' }, `Signature: ${e.signature?.itemName || '—'} (${e.signature?.meaning || ''})`),
      e.background?.hook ? el('div', { class: 'small' }, `Hook: ${e.background.hook}`) : null,
      e.traits?.detail ? el('div', { class: 'small' }, `Detail: ${e.traits.detail}`) : null,
      e.traits?.keepsake ? el('div', { class: 'small' }, `Keepsake: ${e.traits.keepsake}`) : null,
      e.traits?.lineYouWontCross ? el('div', { class: 'small' }, `Line: ${e.traits.lineYouWontCross}`) : null,
      e.traits?.rumor ? el('div', { class: 'small' }, `Rumor: ${e.traits.rumor}`) : null,
      e.background?.darkFate ? el('div', { class: 'small' }, `Dark Fate: ${e.background.darkFate.name} — ${e.background.darkFate.text}`) : null
    ),

    el('div', { class: 'box' },
      el('div', { class: 'small' }, 'Inventory'),
      ...Object.entries(inv).map(([k, list]) => {
        const names = (Array.isArray(list) ? list : []).map(it => it?.name || String(it)).join(', ') || '—';
        return el('div', { class: 'small' }, `${k}: ${names}`);
      })
    )
  );

  // Render using our DOM helper into the new doc.
  app.appendChild(doc.importNode(root, true));
}
