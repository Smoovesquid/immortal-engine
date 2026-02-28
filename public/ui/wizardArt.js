import { el } from './dom.js';

export function wizardStickFigure() {
  return el(
    'div',
    { class: 'wizard-stick' },
    el(
      'svg',
      { viewBox: '0 0 120 120', role: 'img', 'aria-label': 'Stick figure wizard' },
      [
        // hat
        el('path', {
          d: 'M60 12 L38 46 L82 46 Z',
          fill: 'none',
          stroke: '#67d4ff',
          'stroke-width': '3'
        }),
        // brim
        el('line', { x1: '34', y1: '48', x2: '86', y2: '48', stroke: '#67d4ff', 'stroke-width': '3' }),
        // head
        el('circle', { cx: '60', cy: '64', r: '10', fill: 'none', stroke: '#e7eefc', 'stroke-width': '3' }),
        // body
        el('line', { x1: '60', y1: '74', x2: '60', y2: '98', stroke: '#e7eefc', 'stroke-width': '3' }),
        // arms
        el('line', { x1: '46', y1: '82', x2: '74', y2: '82', stroke: '#e7eefc', 'stroke-width': '3' }),
        // staff
        el('line', { x1: '88', y1: '52', x2: '88', y2: '108', stroke: '#a9b4c8', 'stroke-width': '3' }),
        el('circle', { cx: '88', cy: '48', r: '5', fill: 'none', stroke: '#67d4ff', 'stroke-width': '3' })
      ]
    )
  );
}
