import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { hasSlot, loadSlot, saveSlot, exportWorld, importWorld } from '../engine/save.js';
import { worldHash as worldHashAsync } from '../engine/worldHash.browser.js';
import { buildMythSpec, mythSpecJson } from '../engine/mythSpec.js';
import { generateTriadFrames, deriveInvocationFromFrame } from '../engine/triad.js';
import { deriveSequelInvocation } from '../engine/sequel.js';

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

  gate4: {
    mythInput: '',
    frames: [],
    frameIndex: null
  },

  play: {
    input: '',
    lines: [],
    lastResolutionKind: 'turn'
  },

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

async function computeHashAsync(w) {
  try { return await worldHashAsync(w); } catch { return ''; }
}

function startFromWorld(w, { keepTranscript = false } = {}) {
  const safe = ensureWorld(w);
  ui.world = safe;

  if (!keepTranscript) {
    ui.play.lines = [];
    ui.play.input = '';
    ui.play.lastResolutionKind = 'turn';
    ui.play.lines.push({ who: 'wizard', text: 'Wizard: The world steadies. What do you do?', mech: '' });
  }

  ui.worldHash = '(computing...)';
  ui.screen = 'play';
  render();

  computeHashAsync(safe).then((h) => {
    ui.worldHash = h || '';
    render();
  });
}

function beginFromInvocation(inv) {
  const seed = String(inv?.seed || 'seed').trim() || 'seed';
  const fate = coerceFate01(inv?.fate);
  const primaryId = String(inv?.pack?.primaryId || 'fantasy');
  const mixerId = (inv?.pack?.mixerId === null || inv?.pack?.mixerId === undefined) ? null : String(inv.pack.mixerId);

  const w0 = newWorld({
    seed,
    fate,
    campaignId: String(inv?.campaignId || `campaign-${seed}`),
    pack: { primaryId, mixerId }
  });

  const { world, output } = beginAdventure(w0, ui.packs.byId);
  saveSlot(localStorage, world, 'slot1');

  ui.play.lines = [{ who: 'wizard', text: output?.narration || 'Wizard: The world begins.', mech: output?.mechanics || '' }];
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';

  startFromWorld(world, { keepTranscript: true });
}

function beginNewWorld() {
  const seed = String(ui.invoke.seed || 'seed').trim() || 'seed';
  const fate = coerceFate01(ui.invoke.fate);
  const primaryId = String(ui.invoke.primaryId || 'fantasy');
  const mixerId = String(ui.invoke.mixerId || '').trim() || null;

  beginFromInvocation({
    seed,
    fate,
    campaignId: `campaign-${seed}`,
    pack: { primaryId, mixerId }
  });
}

function continueSlot1() {
  const w = loadSlot(localStorage, 'slot1');
  if (!w) return setStatus('No slot found.');
  ui.play.lines = [{ who: 'wizard', text: 'Wizard: Welcome back. What do you do?', mech: '' }];
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';
  startFromWorld(w, { keepTranscript: true });
}

function persistAndRehash(world) {
  saveSlot(localStorage, world, 'slot1');
  ui.world = ensureWorld(world);
  ui.worldHash = '(computing...)';
  render();
  computeHashAsync(ui.world).then((h) => {
    ui.worldHash = h || '';
    render();
  });
}

function doSubmitMove() {
  setStatus('Submitting move…');
  const w = ui.world ? ensureWorld(ui.world) : null;
  if (!w) return setStatus('No world loaded.');
  if (Boolean(w.ending?.locked)) return setStatus('Session ended (ending locked).');

  const text = String(ui.play.input || '').trim();
  if (!text) return;

  const { world, output } = playerMove(w, ui.packs.byId, text);

  ui.play.lines.push({ who: 'you', text, mech: '' });
  ui.play.lines.push({ who: 'wizard', text: output?.narration || 'Wizard: ...', mech: output?.mechanics || '' });
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';

  persistAndRehash(world);
  setStatus('Move resolved.');
}

function doNewScene() {
  setStatus('Creating new scene…');
  const w = ui.world ? ensureWorld(ui.world) : null;
  if (!w) return setStatus('No world loaded.');
  if (Boolean(w.ending?.locked)) return setStatus('Session ended (ending locked).');

  const { world, output } = newScene(w, ui.packs.byId, { lastResolutionKind: ui.play.lastResolutionKind || 'turn' });

  ui.play.lines.push({ who: 'wizard', text: output?.narration || 'Wizard: The scene turns.', mech: output?.mechanics || '' });
  ui.play.lastResolutionKind = 'scene';

  persistAndRehash(world);
  setStatus('Scene advanced.');
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
    onClick: () => continueSlot1()
  }, 'Continue (slot1)');

  const beginBtn = el('button', { class: 'btn primary', onClick: () => beginNewWorld() }, 'Begin');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Immortal Engine — UI v1'),
          el('div', { class: 'sub' }, 'Gate 4: MythSpec + Deterministic Triad')
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
        el('div', { class: 'small' }, 'myth input'),
        el('input', {
          class: 'input',
          value: ui.gate4.mythInput,
          placeholder: 'e.g. a bell under ash',
          onInput: (e) => { ui.gate4.mythInput = String(e.target.value || ''); }
        }),

        el('div', { class: 'row' },
          el('button', {
            class: 'btn',
            onClick: () => {
              const seed = String(ui.invoke.seed || 'seed').trim() || 'seed';
              const fate = coerceFate01(ui.invoke.fate);
              const primaryId = String(ui.invoke.primaryId || 'fantasy');
              const mixerId = String(ui.invoke.mixerId || '').trim() || null;
              const myth = String(ui.gate4.mythInput || '').trim();

              const spec = buildMythSpec({ seed, fate, pack: { primaryId, mixerId }, mythInput: myth });
              ui.gate4.frames = generateTriadFrames(spec);
              ui.gate4.frameIndex = null;
              render();
            }
          }, 'Generate Triad'),

          el('button', {
            class: 'btn primary',
            disabled: ui.gate4.frameIndex === null || ui.gate4.frameIndex === undefined,
            onClick: () => {
              const seed = String(ui.invoke.seed || 'seed').trim() || 'seed';
              const fate = coerceFate01(ui.invoke.fate);
              const primaryId = String(ui.invoke.primaryId || 'fantasy');
              const mixerId = String(ui.invoke.mixerId || '').trim() || null;
              const myth = String(ui.gate4.mythInput || '').trim();

              const spec = buildMythSpec({ seed, fate, pack: { primaryId, mixerId }, mythInput: myth });
              const inv = deriveInvocationFromFrame({
                baseSeed: seed,
                pack: { primaryId, mixerId },
                fate,
                mythSpec: spec,
                frameIndex: ui.gate4.frameIndex
              });
              beginFromInvocation(inv);
            }
          }, 'Begin (frame)')
        ),

        (Array.isArray(ui.gate4.frames) && ui.gate4.frames.length === 3)
          ? el('div', { class: 'stack' },
              ui.gate4.frames.map((f, i) => {
                const selected = ui.gate4.frameIndex === i;
                const label = String(f?.blurb || f?.id || `frame ${i}`);
                return el('div', { class: 'card stack' },
                  el('div', {}, el('strong', {}, `Frame ${i+1}: `), label),
                  el('div', { class: 'row' },
                    el('button', {
                      class: selected ? 'btn primary' : 'btn',
                      onClick: () => { ui.gate4.frameIndex = i; render(); }
                    }, selected ? 'Selected' : 'Select')
                  )
                );
              })
            )
          : el('div', { class: 'small' }, 'Triad: generate to see 3 frames.'),
        el('div', { class: 'row' }, continueBtn, beginBtn)
      )
    )
  );
}

function renderTranscript(lines) {
  const items = (Array.isArray(lines) ? lines : []).map((ln) => {
    const who = String(ln?.who || 'wizard');
    const text = String(ln?.text || '');
    const mech = String(ln?.mech || '');
    const whoLabel = who === 'you' ? 'You' : 'Wizard';
    return el('div', { class: 'card stack' },
      el('div', {}, el('strong', {}, `${whoLabel}: `), text),
      mech ? el('div', { class: 'mono small' }, mech) : null
    );
  });
  return el('div', { class: 'stack' }, items);
}

function renderPlay() {
  const w = ui.world ? ensureWorld(ui.world) : null;
  const pack = w ? `${w.pack.primaryId}${w.pack.mixerId ? ` + ${w.pack.mixerId}` : ''}` : '';
  const seed = w ? String(w.meta.seed) : '';
  const fate = w ? String(w.meta.fate) : '';
  const hash = String(ui.worldHash || '');

  const backBtn = el('button', {
    class: 'btn ghost',
    onClick: () => {
      ui.world = null;
      ui.worldHash = '';
      ui.screen = 'invoke';
      render();
    }
  }, 'Back');

  const reloadBtn = el('button', {
    class: 'btn',
    onClick: () => {
      const w2 = loadSlot(localStorage, 'slot1');
      if (!w2) return setStatus('No slot found.');
      startFromWorld(w2, { keepTranscript: true });
    }
  }, 'Reload slot1');

  const saveBtn = el('button', {
    class: 'btn',
    onClick: () => {
      if (!w) return setStatus('No world loaded.');
      saveSlot(localStorage, w, 'slot1');
      setStatus('Saved slot1.');
    }
  }, 'Save');

  const exportBtn = el('button', {
    class: 'btn',
    onClick: async () => {
      if (!w) return setStatus('No world loaded.');
      const txt = exportWorld(w);
      try {
        await navigator.clipboard.writeText(txt);
        setStatus('Copied export JSON.');
      } catch {
        try { window.prompt('Copy export JSON:', txt); } catch {}
        setStatus('Export ready.');
      }
    }
  }, 'Export JSON');

  const importBtn = el('button', {
    class: 'btn',
    onClick: () => {
      let txt = '';
      try { txt = String(window.prompt('Paste export JSON:', '') || ''); } catch {}
      if (!txt.trim()) return;
      try {
        const w2 = importWorld(txt);
        persistAndRehash(w2);
        ui.play.lines.push({ who: 'wizard', text: 'Wizard: Import accepted. What do you do?', mech: '' });
        ui.play.input = '';
        ui.play.lastResolutionKind = 'turn';
        setStatus('Imported into slot1.');
      } catch (e) {
        setStatus(String(e && e.message ? e.message : e));
      }
    }
  }, 'Import JSON');

  const moveBtn = el('button', { class: 'btn primary', onClick: () => doSubmitMove() }, 'Submit Move');
  const sceneBtn = el('button', { class: 'btn', onClick: () => doNewScene() }, 'New Scene');

  const input = el('input', {
    class: 'input',
    value: ui.play.input,
    placeholder: 'Type your move…',
    onInput: (e) => { ui.play.input = String(e.target.value || ''); },
    onKeydown: (e) => {
      if (e.key === 'Enter') doSubmitMove();
    }
  });

  const ended = Boolean(w?.ending?.locked);

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Play Loop'),
          el('div', { class: 'sub' }, ended ? 'Ending locked: no further state mutation.' : 'Gate 2 acceptance: moves + scenes mutate deterministically; hash updates.')
        )
      ),
      el('div', { class: 'card stack' },
        ui.status ? el('div', { class: 'small' }, ui.status) : null,
        el('div', {}, el('strong', {}, 'worldHash'), el('div', { class: 'mono small' }, hash || '(hash unavailable)')),
        el('div', { class: 'small' }, `seed: ${seed}`),
        el('div', { class: 'small' }, `fate: ${fate}`),
        el('div', { class: 'small' }, `pack: ${pack}`),
        el('div', { class: 'small' }, `tension: ${(w?.instrument?.inevitability ?? 0)}/12 | clocks: p${(w?.clocks?.pressure ?? 0)}/12 d${(w?.clocks?.dread ?? 0)}/12 r${(w?.clocks?.revelation ?? 0)}/12`),
        el('div', { class: 'row' }, backBtn, reloadBtn, saveBtn, exportBtn, importBtn)
      ),
      renderTranscript(ui.play.lines),
      el('div', { class: 'card stack' },
        input,
        el('div', { class: 'row' },
          el('button', { class: 'btn', disabled: ended, onClick: () => doNewScene() }, 'New Scene'),
          el('button', { class: 'btn primary', disabled: ended, onClick: () => doSubmitMove() }, 'Submit Move')
        )
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

  if (ui.screen === 'play') app.append(renderPlay());
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
              el('div', { class: 'sub' }, 'Gate 2 must load without console errors.')
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
      ui.play.lines = [{ who: 'wizard', text: 'Wizard: Welcome back. What do you do?', mech: '' }];
      ui.play.input = '';
      ui.play.lastResolutionKind = 'turn';
      startFromWorld(w, { keepTranscript: true });
      return;
    }
  }

  ui.screen = 'invoke';
  render();
}

boot().catch((e) => setStatus(String(e?.message || e)));
