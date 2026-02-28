import { el } from './dom.js';

export function makeDebugBadgeEl({ screenName, partyCount, debugSeed, lastError, aiLast }) {
  const a = aiLast && typeof aiLast === 'object' ? aiLast : { mode: 'off', ok: null, reason: '' };
  const aiLine = (a.ok === null) ? '' : `${String(a.mode || 'off')}:${a.ok ? 'ok' : 'fail'}${a.reason ? ` (${a.reason})` : ''}`;

  return el('div', { class: 'debug-badge' },
    el('div', {}, el('span', { class: 'k' }, 'screen: '), String(screenName || '—')),
    el('div', {}, el('span', { class: 'k' }, 'party: '), String(partyCount ?? '—')),
    el('div', {}, el('span', { class: 'k' }, 'seed: '), String(debugSeed || '—')),
    aiLine ? el('div', {}, el('span', { class: 'k' }, 'ai: '), aiLine) : null,
    lastError ? el('div', {}, el('span', { class: 'k' }, 'lastError: '), String(lastError)) : null
  );
}

export function makeDevLogPaneEl(lines) {
  const l = Array.isArray(lines) ? lines : [];
  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'Dev Log'),
    el('div', { class: 'devlog' }, l.length ? l.slice(-60).join('\n') : '[UI] (no events yet)')
  );
}
