import { el, clear, button } from './dom.js';

export function showModal(renderBody, { title = 'Modal', onClose } = {}) {
  const root = document.body;
  const backdrop = el('div', { class: 'modal-backdrop' });
  const panel = el('div', { class: 'panel modal' });
  const header = el('div', { class: 'header' },
    el('div', {}, el('div', { class: 'title' }, title), el('div', { class: 'sub' }, '')), 
    button('Close', { className: 'btn ghost', onClick: close })
  );
  const body = el('div', { class: 'card stack' });
  panel.append(header, body);
  backdrop.append(panel);

  function close() {
    backdrop.remove();
    onClose?.();
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  clear(body);
  body.append(renderBody({ close }));

  root.append(backdrop);
  return { close };
}
