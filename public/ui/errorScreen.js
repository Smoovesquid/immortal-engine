import { el, clear, button } from './dom.js';

export function renderErrorScreen(app, state) {
  clear(app);
  app.append(
    el('div', { class: 'container stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Something went wrong'),
            el('div', { class: 'sub' }, 'No stack traces. No drama. Your save should be intact.')
          ),
          el('div', { class: 'row' },
            button('Back to Title', { className: 'btn primary', onClick: () => state.onBack?.() })
          )
        ),
        el('div', { class: 'card stack' },
          el('div', { class: 'banner' }, `Wizard: ${state.message || 'Unknown error.'}`),
          el('div', { class: 'small' }, 'Tip: try Refresh. If it keeps happening, export your save from Advanced when not in Release mode.')
        )
      )
    )
  );
}
