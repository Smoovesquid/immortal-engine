
import { renderWorldMap } from './WorldMap.js';
import { renderRegionMap } from './RegionMap.js';
import { renderLocalMap } from './LocalMap.js';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && v && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === false || v === null || v === undefined) continue;
    else node.setAttribute(k, String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

export function renderMapView(world, zoom, onZoom) {
  const z = zoom || 'region';

  const tabs = el('div', { class: 'row' },
    el('button', { class: z === 'world' ? 'btn primary' : 'btn', onClick: () => onZoom('world') }, 'World (30k)'),
    el('button', { class: z === 'region' ? 'btn primary' : 'btn', onClick: () => onZoom('region') }, 'Region (10k)'),
    el('button', { class: z === 'local' ? 'btn primary' : 'btn', onClick: () => onZoom('local') }, 'Local')
  );

  const body =
    z === 'world' ? renderWorldMap(world?.map) :
    z === 'local' ? renderLocalMap(world) :
    renderRegionMap(world?.map);

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Map')
        )
      ),
      el('div', { class: 'card stack' }, tabs),
      body
    )
  );
}
