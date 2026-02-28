import { el, clear, button } from './dom.js';

export function renderSessionEnd(app, state) {
  clear(app);

  if (state.advanced && state.debugBadgeEl) app.append(state.debugBadgeEl);

  app.append(
    el('div', { class: 'container stack' },
      state.bannerText ? el('div', { class: 'banner' }, state.bannerText) : null,
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Session End'),
            el('div', { class: 'sub' }, state.endingType || '—')
          ),
          el('div', { class: 'row' },
            button('Export Chronicle', { className: 'btn primary', onClick: () => state.onExportChronicle?.() }),
            button('Back to Title', { className: 'btn ghost', onClick: () => state.onBackToTitle?.() })
          )
        ),
        el('div', { class: 'card stack' },
          el('div', {}, state.epilogueLine || ''),
          el('div', { class: 'hr' }),
          el('div', { class: 'small' }, 'Canon outcomes'),
          el('ul', {}, ...(state.outcomes || []).map(x => el('li', {}, x))),
          el('div', { class: 'hr' }),
          el('div', { class: 'small' }, 'Sequel hook'),
          el('ul', {}, el('li', {}, state.hook || '')),
          state.advanced && state.devLogPaneEl ? state.devLogPaneEl : null
        )
      )
    )
  );
}
