
// ONE MAP (docs/ONE_MAP.md) — M4: the scale tabs are retired. There is no
// "World (30k) / Region (10k) / Local" any more; there is one continuous map,
// scroll to zoom, drag to pan. The old fixed-scale renderers stay on disk
// (WorldMap/RegionMap/FogMap/LocalMap) — v1 still uses renderLocalMap as the
// in-play walkable-map fallback — but the Map TAB now shows only the one map.

import { renderOneMap } from './oneMap.js';

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

// renderMapView(world, opts) — opts.playerPos = { nodeId, ux, uy } (the live
// walk position, so the marker sits where you stand).
export function renderMapView(world, opts = {}) {
  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Map'),
          el('div', { class: 'small' }, 'Scroll to zoom · drag to pan')
        ),
        // opts.headerExtra: the 2D⇄3D toggle, rendered on the right of the header.
        opts.headerExtra || null
      ),
      renderOneMap(world, { playerPos: opts.playerPos })
    )
  );
}
