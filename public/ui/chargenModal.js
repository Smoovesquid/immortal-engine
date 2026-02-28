import { el, button } from './dom.js';
import { showModal } from './modal.js';

export function openChargenModal(state) {
  return showModal(() => render(state), { title: 'Character Genesis', onClose: () => state.onCancel?.() });
}

function render(state) {
  const step = state.step;
  const d = state.draft;

  const header = el('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
    el('div', { class: 'title' }, `Character Genesis — ${stepLabel(step)}`),
    button('×', { className: 'btn ghost', onClick: () => state.onCancel?.() })
  );

  const body = el('div', { class: 'stack' },
    step === 1 ? stepName(state) : null,
    step === 2 ? stepArchetype(state) : null,
    step === 3 ? stepStats(state) : null,
    step === 4 ? stepKit(state) : null,
    step === 5 ? stepRitual(state) : null,
    step === 6 ? stepDarkFate(state) : null,
    step === 7 ? stepConfirm(state) : null,
    el('div', { class: 'row' },
      button('Back', { className: 'btn ghost', disabled: step === 1, onClick: () => state.onBack?.() }),
      el('div', { style: { flex: '1' } }),
      button(step === 7 ? 'Add to Party' : 'Next', { className: 'btn primary', onClick: () => state.onNext?.() })
    )
  );

  return el('div', { class: 'stack', style: { minWidth: 'min(720px, 92vw)' } }, header, body);
}

function stepLabel(step) {
  return [
    'Name',
    'Archetype',
    'Roll Stats',
    'Starting Kit',
    'Ritual Details',
    'Dark Fate',
    'Confirm'
  ][step - 1] || '…';
}

function stepName(state) {
  const input = el('input', { class: 'input', value: state.draft.name || '', placeholder: 'Name (optional)' });
  input.addEventListener('input', () => state.onSetName?.(input.value));
  return el('div', { class: 'stack' },
    el('div', { class: 'sub' }, 'Give them a name, or let the world assign one.'),
    input,
    button('Random Name', { className: 'btn', onClick: () => state.onRandomName?.() })
  );
}

function stepArchetype(state) {
  const opts = state.options || [];
  return el('div', { class: 'stack' },
    el('div', { class: 'sub' }, 'Pick one background; it will steer your kit.'),
    el('div', { class: 'grid2' },
      ...opts.map(o => el('div', { class: 'panel card stack' },
        el('div', { class: 'title' }, o.name),
        el('div', { class: 'small' }, o.hook || ''),
        button(state.draft.background?.name === o.name ? 'Selected' : 'Choose', {
          className: state.draft.background?.name === o.name ? 'btn primary' : 'btn',
          onClick: () => state.onChooseBackground?.(o)
        })
      ))
    )
  );
}

function stepStats(state) {
  const method = state.draft.statMethod || '2d6+2';
  const details = state.draft.rollDetails;

  const methods = el('div', { class: 'row' },
    button(method === '2d6+2' ? 'Method: 2d6+2 (selected)' : 'Method: 2d6+2', { className: method === '2d6+2' ? 'btn primary' : 'btn', onClick: () => state.onSetStatMethod?.('2d6+2') }),
    button(method === '3d6' ? 'Method: 3d6 (selected)' : 'Method: 3d6', { className: method === '3d6' ? 'btn primary' : 'btn', onClick: () => state.onSetStatMethod?.('3d6') })
  );

  const rollBox = details ? el('div', { class: 'panel card stack' },
    el('div', { class: 'small' }, 'Visible rolls'),
    ...Object.entries(details.dice || {}).map(([k, d]) => el('div', { class: 'row' },
      el('span', { class: 'tag' }, k),
      el('span', {}, Array.isArray(d) ? d.join(' ') : String(d))
    ))
  ) : el('div', { class: 'small' }, 'Roll to reveal dice.');

  return el('div', { class: 'stack' },
    el('div', { class: 'sub' }, 'Pick a roll method, then roll your five stats.'),
    methods,
    button('Roll Stats', { className: 'btn', onClick: () => state.onRollStats?.() }),
    rollBox
  );
}

function stepKit(state) {
  const inv = state.draft.inventory || {};
  const sig = state.draft.signature || {};
  const cats = ['weapons','armor','tools','clothes','spells','tech','oddities','consumables','junk'];

  const rows = cats.map(c => {
    const list = Array.isArray(inv[c]) ? inv[c] : [];
    const label = list.map(it => it?.name || String(it)).join(', ') || '—';
    return el('div', { class: 'row' },
      el('span', { class: 'tag' }, c),
      el('span', { style: { flex: '1' } }, label),
      button('Swap', { className: 'btn ghost', disabled: !state.canSwap || list.length === 0, onClick: () => state.onSwap?.(c) })
    );
  });

  return el('div', { class: 'stack' },
    el('div', { class: 'sub' }, 'Starting kit is auto-picked; you may swap once per category.'),
    el('div', { class: 'panel card stack' }, ...rows),
    el('div', { class: 'small' }, `Signature: ${sig.itemName || '—'} (${sig.meaning || ''})`)
  );
}

function stepDarkFate(state) {
  const df = state.draft.background?.darkFate;
  return el('div', { class: 'stack' },
    el('div', { class: 'sub' }, 'Optional: add a Dark Fate. It’s deterministic either way.'),
    el('div', { class: 'row' },
      button(state.draft.darkFateEnabled ? 'Dark Fate: ON' : 'Dark Fate: OFF', { className: 'btn', onClick: () => state.onToggleDarkFate?.() }),
      button('Roll/Refresh', { className: 'btn ghost', disabled: !state.draft.darkFateEnabled, onClick: () => state.onRollDarkFate?.() })
    ),
    df ? el('div', { class: 'panel card stack' },
      el('div', { class: 'title' }, df.name),
      el('div', { class: 'sub' }, df.text)
    ) : el('div', { class: 'small' }, 'No dark fate selected.')
  );
}

function stepRitual(state) {
  const opts = state.ritualOptions || {};
  const picks = state.ritualPicks || {};

  const categories = [
    { key: 'detail', label: 'Tell (a small detail)' },
    { key: 'keepsake', label: 'Keepsake' },
    { key: 'lineYouWontCross', label: 'Line you won’t cross' },
    { key: 'rumor', label: 'Rumor' }
  ];

  const pickRow = (key, label) => {
    const list = Array.isArray(opts[key]) ? opts[key] : [];
    if (!list.length) return el('div', { class: 'small' }, `${label}: —`);

    const chosen = String(picks[key] || list[0] || '');

    return el('div', { class: 'panel card stack' },
      el('div', { class: 'title' }, label),
      ...list.slice(0, 3).map((t) => {
        const isSel = String(t) === chosen;
        return el('div', { class: 'row', style: { alignItems: 'center' } },
          button(isSel ? 'Selected' : 'Choose', {
            className: isSel ? 'btn primary' : 'btn',
            onClick: () => state.onPickRitual?.(key, t)
          }),
          el('div', { class: 'small' }, String(t))
        );
      })
    );
  };

  return el('div', { class: 'stack' },
    el('div', { class: 'sub' }, 'Roll three omens for each category; choose one to lock it into the sheet.'),
    el('div', { class: 'stack' },
      ...categories.map(c => pickRow(c.key, c.label))
    )
  );
}

function stepConfirm(state) {
  const d = state.draft;
  const stats = d.stats || {};
  return el('div', { class: 'stack' },
    el('div', { class: 'title' }, d.name || 'Unnamed'),
    el('div', { class: 'sub' }, `${d.background?.name || d.archetype || 'Unknown'} • ${d.traits?.vibe || d.vibe || ''}`),
    el('div', { class: 'row' },
      ...Object.entries(stats).map(([k,v]) => el('span', { class: 'tag' }, `${k}:${v}`))
    ),
    el('div', { class: 'small' }, d.background?.hook || '')
  );
}
