import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure } from '../engine/playloop.js';
import { hasSlot, loadSlot, saveSlot } from '../engine/save.js';
import { worldHash as worldHashAsync } from '../engine/worldHash.browser.js';

const app = document.querySelector('#app');

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

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function loadPacks() {
  const manRaw = await fetch('/packs/manifest.json').then(r => r.json());
  const manifest = normalizeManifest(manRaw);
  const byId = {};
  for (const p of manifest.packs) {
    const raw = await fetch(p.path).then(r => r.json());
    byId[p.id] = normalizePack(raw);
  }
  return { manifest, byId };
}

const ui = {
  packs: { manifest: null, byId: {} },
  screen: 'invoke',
  invoke: { seed: 'seed', fate: 0.2, primaryId: 'fantasy', mixerId: '' },
  world: null,
  worldHash: '',
  status: ''
};

function setStatus(msg) {
  ui.status = String(msg || '');
  render();
}

function coerceFate01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.2;
  return Math.max(0, Math.min(1, n));
}

function computeHash(w) {
  try { return worldHash(w); } catch { return ''; }
}

function startFromWorld(w) {
  const safe = ensureWorld(w);
  ui.world = safe;
  ui.worldHash = computeHash(safe);
  ui.screen = 'world';
  render();
}

function beginNewWorld() {
  const seed = String(ui.invoke.seed || 'seed').trim() || 'seed';
  const fate = coerceFate01(ui.invoke.fate);
  const primaryId = String(ui.invoke.primaryId || 'fantasy');
  const mixerId = String(ui.invoke.mixerId || '').trim() || null;

  const w0 = newWorld({
    seed,
    fate,
    campaignId: `campaign-${seed}`,
    pack: { primaryId, mixerId }
  });

  const { world } = beginAdventure(w0, ui.packs.byId);
  saveSlot(localStorage, world, 'slot1');
  startFromWorld(world);
}

function renderInvoke() {
  const packs = ui.packs.manifest?.packs || [];
  const has = hasSlot(localStorage, 'slot1');

  const seedInput = el('input', {
    class: 'input',
    value: ui.invoke.seed,
    onInput: (e) => { ui.invoke.seed = String(e.target.value || ''); }
  });

  const fateInput = el('input', {
    class: 'input',
    type: 'number',
    step: '0.01',
    min: '0',
    max: '1',
    value: String(ui.invoke.fate),
    onInput: (e) => { ui.invoke.fate = coerceFate01(e.target.value); }
  });

  const primarySelect = el('select', {
    class: 'input',
    onChange: (e) => { ui.invoke.primaryId = String(e.target.value || 'fantasy'); }
  }, packs.map(p => el('option', { value: p.id, selected: p.id === ui.invoke.primaryId }, `${p.name} (${p.id})`)));

  const mixerSelect = el('select', {
    class: 'input',
    onChange: (e) => { ui.invoke.mixerId = String(e.target.value || ''); }
  }, [
    el('option', { value: '', selected: !ui.invoke.mixerId }, '(none)'),
    ...packs.map(p => el('option', { value: p.id, selected: p.id === ui.invoke.mixerId }, `${p.name} (${p.id})`))
  ]);

  const continueBtn = el('button', {
    class: 'btn',
    disabled: !has,
    onClick: () => {
      const w = loadSlot(localStorage, 'slot1');
      if (!w) return setStatus('No slot found.');
      startFromWorld(w);
    }
  }, 'Continue (slot1)');

  const beginBtn = el('button', { class: 'btn primary', onClick: () => beginNewWorld() }, 'Begin');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Immortal Engine — UI v1'),
          el('div', { class: 'sub' }, 'Gate 1: Deterministic Invocation')
        )
      ),
      el('div', { class: 'card stack' },
        ui.status ? el('div', { class: 'small' }, ui.status) : null,
        el('div', { class: 'small' }, 'seed'),
        seedInput,
        el('div', { class: 'small' }, 'fate (0..1)'),
        fateInput,
        el('div', { class: 'small' }, 'primary pack'),
        primarySelect,
        el('div', { class: 'small' }, 'mixer pack (optional)'),
        mixerSelect,
        el('div', { class: 'row' }, continueBtn, beginBtn)
      )
    )
  );
}

function renderWorld() {
  const w = ui.world ? ensureWorld(ui.world) : null;
  const pack = w ? `${w.pack.primaryId}${w.pack.mixerId ? ` + ${w.pack.mixerId}` : ''}` : '';
  const seed = w ? String(w.meta.seed) : '';
  const fate = w ? String(w.meta.fate) : '';
  const hash = ui.worldHash || (w ? computeHash(w) : '');

  const resetBtn = el('button', {
    class: 'btn ghost',
    onClick: () => {
      ui.world = null;
      ui.worldHash = '';
      ui.screen = 'invoke';
      render();
    }
  }, 'Back');

  const refreshBtn = el('button', {
    class: 'btn',
    onClick: () => {
      const w2 = loadSlot(localStorage, 'slot1');
      if (!w2) return setStatus('No slot found.');
      startFromWorld(w2);
    }
  }, 'Reload slot1');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'World Materialized'),
          el('div', { class: 'sub' }, 'Gate 1 acceptance: refresh restores identical worldHash.')
        )
      ),
      el('div', { class: 'card stack' },
        el('div', {}, el('strong', {}, 'worldHash'), el('div', { class: 'mono small' }, hash || '(hash unavailable)')),
        el('div', { class: 'small' }, `seed: ${seed}`),
        el('div', { class: 'small' }, `fate: ${fate}`),
        el('div', { class: 'small' }, `pack: ${pack}`),
        el('div', { class: 'row' }, resetBtn, refreshBtn)
      )
    )
  );
}

function render() {
  clear(app);
  if (!ui.packs.manifest) {
    app.append(el('div', { class: 'container stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Immortal Engine — UI v1'),
            el('div', { class: 'sub' }, 'Loading packs…')
          )
        )
      )
    ));
    return;
  }

  if (ui.screen === 'world') app.append(renderWorld());
  else app.append(renderInvoke());
}

window.addEventListener('error', (e) => {
  try {
    clear(app);
    app.append(
      el('div', { class: 'container stack' },
        el('div', { class: 'panel' },
          el('div', { class: 'header' },
            el('div', {},
              el('div', { class: 'title' }, 'UI v1 — Error'),
              el('div', { class: 'sub' }, 'Gate 1 must load without console errors.')
            )
          ),
          el('div', { class: 'card stack' },
            el('div', {}, String(e?.message || e)),
            el('div', { class: 'small' }, 'Check DevTools console for stack trace.')
          )
        )
      )
    );
  } catch {}
});

async function boot() {
  render();
  const packs = await loadPacks();
  ui.packs = packs;

  if (hasSlot(localStorage, 'slot1')) {
    const w = loadSlot(localStorage, 'slot1');
    if (w) {
      startFromWorld(w);
      return;
    }
  }
  ui.screen = 'invoke';
  render();
}

boot().catch((e) => setStatus(String(e?.message || e)));
