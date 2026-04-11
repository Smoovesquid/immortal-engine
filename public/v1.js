import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { neighbors } from '../engine/map/mapState.js';
import { hasSlot, loadSlot, saveSlot, exportWorld, importWorld } from '../engine/save.js';
import { worldHash as worldHashAsync } from '../engine/worldHash.browser.js';
import { buildMythSpec, mythSpecJson } from '../engine/mythSpec.js';
import { generateTriadFrames, deriveInvocationFromFrame } from '../engine/triad.js';
import { deriveSequelInvocation } from '../engine/sequel.js';
import { renderMapView } from './map/MapView.js';

// ?reset — wipe all saved state and start fresh
if (new URLSearchParams(location.search).has('reset')) {
  Object.keys(localStorage)
    .filter(k => k.startsWith('ai-dm-v2:'))
    .forEach(k => localStorage.removeItem(k));
  location.replace(location.pathname);
}

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
  status: '',
  ai: { online: null, text: '(not loaded)' },
  aiKey: localStorage.getItem('anthropic_key') || '',
  aiKeyAck: '',
  aiTest: { ok: null, text: '(not run)', ms: null },
  aiStatus: { ok: null, online: null, source: "(unknown)", mode: "(unknown)", envPresent: null, sessionPresent: null },
  map: { zoom: 'region' }
};

async function refreshAiStatus() {
  try {
    const r = await fetch("/api/ai-status");
    const j = await r.json();
    if (!j || typeof j !== "object") {
      ui.aiStatus = { ok:false, online:false, source:"bad_json", mode:"?", envPresent:null, sessionPresent:null };
      return;
    }
    ui.aiStatus = {
      ok: Boolean(j.ok),
      online: Boolean(j.online),
      source: String(j.source || "none"),
      mode: String(j.mode || "(unknown)"),
      envPresent: (j.envPresent == null ? null : Boolean(j.envPresent)),
      sessionPresent: (j.sessionPresent == null ? null : Boolean(j.sessionPresent))
    };
  } catch (e) {
    ui.aiStatus = { ok:false, online:false, source:"error", mode:"?", envPresent:null, sessionPresent:null };
  }
}

function setStatus(msg) {
  ui.status = String(msg || "");
  render();
}

async function tryAiNarration(world, baseNarration, outcome) {
  const anthropicKey = String(ui.aiKey || '').trim();
  if (!anthropicKey) return null;
  try {
    const res = await fetch('/api/narrate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ world, baseNarration, outcome, anthropicKey })
    });
    const data = await res.json();
    if (data.ok && data.narration && data.narration !== baseNarration) {
      return data.narration;
    }
  } catch {
    // fall through
  }
  return null;
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

async function beginFromInvocation(inv) {
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

  const baseNarration = output?.narration || 'The world begins.';
  const wizardLine = { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines = [wizardLine];
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';

  startFromWorld(world, { keepTranscript: true });

  // Try AI narration; fall back to base if unavailable
  const aiText = await tryAiNarration(world, baseNarration, {});
  wizardLine.text = aiText || baseNarration;
  render();
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

async function doSubmitMove() {
  setStatus('Submitting move…');
  const w = ui.world ? ensureWorld(ui.world) : null;
  if (!w) return setStatus('No world loaded.');
  if (Boolean(w.ending?.locked)) return setStatus('Session ended (ending locked).');

  const text = String(ui.play.input || '').trim();
  if (!text) return;

  const { world, output } = playerMove(w, ui.packs.byId, text);
  const baseNarration = output?.narration || 'Wizard: ...';

  ui.play.lines.push({ who: 'you', text, mech: '' });
  const wizardLine = { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines.push(wizardLine);
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';

  persistAndRehash(world);
  setStatus('Narrating…');
  render();

  // Wait for AI narration; fall back to base if unavailable
  const aiText = await tryAiNarration(world, baseNarration, { input: text });
  wizardLine.text = aiText || baseNarration;
  setStatus('Move resolved.');
  render();
}

async function doNewScene() {
  setStatus('Creating new scene…');
  const w = ui.world ? ensureWorld(ui.world) : null;
  if (!w) return setStatus('No world loaded.');
  if (Boolean(w.ending?.locked)) return setStatus('Session ended (ending locked).');

  const { world, output } = newScene(w, ui.packs.byId, { lastResolutionKind: ui.play.lastResolutionKind || 'turn' });
  const baseNarration = output?.narration || 'The scene turns.';

  const wizardLine = { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines.push(wizardLine);
  ui.play.lastResolutionKind = 'scene';

  persistAndRehash(world);
  setStatus('Narrating…');
  render();

  const aiText = await tryAiNarration(world, baseNarration, {});
  wizardLine.text = aiText || baseNarration;
  setStatus('Scene advanced.');
  render();
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
          el('div', { class: 'title' }, 'Immortal Engine — build 004'),
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
      el('div', {}, text),
      mech ? el('div', { class: 'mono small' }, mech) : null
    );
  });
  return el('div', { class: 'stack' }, items);
}

// ── Status panels: pure views over canonical world state ──────────────

const GOAL_KIND_VERBS = {
  reach: 'Reach',
  obtain: 'Obtain',
  talkTo: 'Talk to',
  learn: 'Learn',
  defeat: 'Defeat'
};

function goalDisplayLabel(goal) {
  if (goal.label && goal.label.trim()) return goal.label.trim();
  const verb = GOAL_KIND_VERBS[goal.kind] || goal.kind;
  return `${verb} ${goal.targetRef}`;
}

function dots(filled, total, ch = '●', empty = '○') {
  const n = Math.max(0, Math.min(total, filled | 0));
  return ch.repeat(n) + empty.repeat(total - n);
}

function truncate(text, cap) {
  const s = String(text || '');
  if (s.length <= cap) return s;
  return s.slice(0, cap - 1) + '…';
}

function renderGoalsSection(world) {
  const goals = Array.isArray(world?.goals) ? world.goals : [];
  const active = goals
    .filter(g => g.status === 'active')
    .slice()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const completed = goals
    .filter(g => g.status === 'completed')
    .slice()
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  // 12 total cap matches engine GOALS_CAP.
  const ordered = [...active, ...completed].slice(0, 12);

  const body = ordered.length === 0
    ? el('div', { class: 'empty-muted' }, 'No goals yet.')
    : el('ul', { class: 'goal-list' },
        ordered.map(g => {
          const isActive = g.status === 'active';
          return el('li', { class: `goal-item ${isActive ? 'active' : 'completed'}` },
            el('span', { class: 'goal-icon' }, isActive ? '▢' : '✓'),
            el('span', { class: 'goal-label' }, goalDisplayLabel(g)),
            isActive ? el('span', { class: 'goal-kind' }, String(g.kind)) : null
          );
        })
      );

  return el('section', { class: 'status-section', 'aria-label': 'Goal tracker' },
    el('h3', { class: 'status-heading' }, 'Goals'),
    body
  );
}

function renderPartySection(world) {
  const pc = Array.isArray(world?.party) && world.party[0] ? world.party[0] : null;

  if (!pc) {
    return el('section', { class: 'status-section', 'aria-label': 'Party status' },
      el('h3', { class: 'status-heading' }, 'Party'),
      el('div', { class: 'empty-muted' }, 'No character yet.')
    );
  }

  const wounds = Math.max(0, Math.min(6, Number(pc.wounds) || 0));
  const stress = Math.max(0, Math.min(6, Number(pc.stress) || 0));
  const adv = Math.max(0, Math.min(2, Number(world?.meta?.advantageTokens?.[pc.id]) || 0));

  // Pass C1 — companions: render party[1..n] as compact rows below the
  // player. Minimal fields (name, role, trust/10) — no wounds/stress/
  // advantage in C1. Empty array adds no extra DOM.
  const companions = (Array.isArray(world?.party) ? world.party.slice(1) : [])
    .filter(c => c && c.companion);
  const companionRows = companions.map(c => {
    const trust = Math.max(0, Math.min(10, Number(c.companion?.trustLevel) || 0));
    const role = String(c.companion?.role || c.archetype || '');
    return el('div', { class: 'party-strip companion' },
      el('div', { class: 'party-name' }, String(c.name || 'Companion')),
      el('div', { class: 'party-bar' },
        el('span', { class: 'party-bar-label' }, 'role'),
        el('span', { class: 'party-bar-dots' }, role || '—')
      ),
      el('div', { class: 'party-bar' },
        el('span', { class: 'party-bar-label' }, 'trust'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${trust} of 10 trust` }, `${trust}/10`)
      )
    );
  });

  return el('section', { class: 'status-section', 'aria-label': 'Party status' },
    el('h3', { class: 'status-heading' }, 'Party'),
    el('div', { class: 'party-strip' },
      el('div', { class: 'party-name' }, String(pc.name || 'Adventurer')),
      el('div', { class: 'party-bar wounds' },
        el('span', { class: 'party-bar-label' }, 'wounds'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${wounds} of 6 wounds` }, dots(wounds, 6))
      ),
      el('div', { class: 'party-bar stress' },
        el('span', { class: 'party-bar-label' }, 'stress'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${stress} of 6 stress` }, dots(stress, 6))
      ),
      el('div', { class: 'party-bar advantage' },
        el('span', { class: 'party-bar-label' }, 'advantage'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${adv} advantage tokens` },
          adv === 0 ? '—' : '◆'.repeat(adv))
      )
    ),
    ...companionRows
  );
}

function renderCombatSection(world) {
  const combat = world?.combat;
  const active = Boolean(combat?.active);

  const section = el('section', {
    class: 'status-section',
    'aria-label': 'Combat indicator',
    hidden: !active
  });

  if (!active) return section;

  const enemies = Array.isArray(combat.enemies) ? combat.enemies : [];
  const round = Number(combat.round) || 0;

  section.appendChild(el('div', { class: 'combat-header' }, `⚔ COMBAT — Round ${round}`));
  section.appendChild(
    el('ul', { class: 'enemy-list' },
      enemies.map(en => {
        const maxHp = Math.max(1, Number(en.maxHp) || 1);
        const hp = Math.max(0, Math.min(maxHp, Number(en.hp) || 0));
        const defeated = Boolean(en.defeated) || hp === 0;
        const tagClass = en.canParley ? 'parley' : 'hostile';
        const tagLabel = en.canParley ? '[parley]' : '[hostile]';
        return el('li', { class: `enemy-item${defeated ? ' defeated' : ''}` },
          el('div', { class: 'enemy-row' },
            el('span', { class: 'enemy-name' }, String(en.name || 'enemy')),
            el('span', { class: `enemy-tag ${tagClass}` }, tagLabel)
          ),
          el('div', { class: 'enemy-hp', 'aria-label': `${hp} of ${maxHp} hit points` },
            dots(hp, maxHp)
          )
        );
      })
    )
  );
  section.appendChild(
    el('div', { class: 'combat-hint' }, 'attack <name> | focus <name> | flee')
  );

  return section;
}

function renderBeatsSection(world) {
  const beats = Array.isArray(world?.recentBeats) ? world.recentBeats : [];

  const body = beats.length === 0
    ? el('div', { class: 'empty-muted' }, 'No history yet.')
    : el('div', { class: 'beats-scroll', 'data-beats-scroll': '1' },
        beats.map(b => {
          const outcome = String(b.outcome || 'mixed');
          const approach = String(b.approach || '');
          const stake = String(b.stake || '');
          const meta = [approach, stake].filter(Boolean).join(' / ');
          return el('div', { class: `beat-row ${outcome}` },
            el('div', { class: 'beat-head' },
              el('span', { class: 'beat-turn' }, `[t=${Number(b.t) || 0}]`),
              el('span', { class: 'beat-input' }, truncate(b.input, 60)),
              el('span', { class: 'beat-outcome' }, outcome)
            ),
            meta ? el('div', { class: 'beat-meta' }, meta) : null
          );
        })
      );

  return el('section', { class: 'status-section', 'aria-label': 'Recent beats' },
    el('h3', { class: 'status-heading' }, 'Recent beats'),
    body
  );
}

function renderStatusPanels(world) {
  return el('aside', { class: 'status-panels', 'aria-label': 'Status panels' },
    renderGoalsSection(world),
    renderPartySection(world),
    renderCombatSection(world),
    renderBeatsSection(world)
  );
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

  const mainPanel = el('div', { class: 'panel' },
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
  );

  return el('div', { class: 'container stack' },
    el('div', { class: 'play-layout' },
      el('div', { class: 'main-col' }, mainPanel),
      w ? renderStatusPanels(w) : null
    )
  );
}


function renderNav() {
  const btn = (label, screen, { disabled = false } = {}) => el('button', {
    class: ui.screen === screen ? 'btn primary' : 'btn',
    disabled,
    onClick: () => { ui.screen = screen; render(); }
  }, label);

  const hasWorld = Boolean(ui.world);

  return el('div', { class: 'panel' },
    el('div', { class: 'header' },
      el('div', { class: 'row' },
        btn('Invoke', 'invoke'),
        btn('Play', 'play', { disabled: !hasWorld }),
        btn('Map', 'map', { disabled: !hasWorld }),
        btn('AI', 'ai')
      )
    )
  );
}


function renderMap() {
  const w = ui.world ? ensureWorld(ui.world) : null;

  if (!w) {
    return el("div",{class:"container stack"},
      el("div",{class:"panel"},
        el("div",{class:"header"},
          el("div",{},
            el("div",{class:"title"},"Map"),
            el("div",{class:"sub"},"No world loaded.")
          )
        ),
        el("div",{class:"card stack"},
          el("div",{class:"small"},"Start a world first (Invoke → Begin).")
        )
      )
    );
  }

  return renderMapView(w, ui.map?.zoom || "region", (z) => {
    ui.map = { zoom: z };
    render();
  });
}

let _lpReqToken = 0;
function queueLocalProjectionDraw({ seed, nodeId }) {
  const token = ++_lpReqToken;
  setTimeout(async () => {
    try {
      const url = `/api/local-projection?seed=${encodeURIComponent(String(seed||""))}&nodeId=${encodeURIComponent(String(nodeId||""))}`;
      const r = await fetch(url);
      const j = await r.json();
      if (token !== _lpReqToken) return;
      if (j && j.ok && j.projection) drawLocalProjection(j.projection);
    } catch {}
  }, 0);
}

async function fetchAiStatus() {
  try {
    const r = await fetch('/api/ai-status');
    const j = await r.json();
    return { ok: true, status: j };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function runAiTest() {
  const t0 = Date.now();
  const apiKey = String(ui.aiKey || '').trim();
  if (!apiKey) return { ok: false, text: 'No key set — go to AI tab and paste your Anthropic key', ms: 0 };
  try {
    const r = await fetch('/api/anthropic-test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anthropicKey: apiKey })
    });
    const j = await r.json();
    const ms = Date.now() - t0;
    if (j.ok) return { ok: true, text: `Anthropic connection OK (${ms}ms)`, ms };
    return { ok: false, text: String(j.reason || 'fail'), ms };
  } catch (e) {
    const ms = Date.now() - t0;
    return { ok: false, text: String(e?.message || e), ms };
  }
}

function renderAi() {
  const statusText = ui.ai?.text || '(not loaded)';
  const online = ui.ai?.online;

  const keyInput = el('textarea', {
    class: 'input',
    rows: '3',
    placeholder: 'Paste Anthropic API key here (survives reloads, cleared when tab closes)',
    value: ui.aiKey || '',
    onInput: (e) => { ui.aiKey = String(e.target.value || ''); }
  });

  const setKeyBtn = el('button', {
    class: 'btn primary',
    onClick: async () => {
      const apiKey = String(ui.aiKey || '').trim();
      if (!apiKey) { ui.aiKeyAck = 'No key entered.'; return render(); }
      ui.aiKeyAck = 'Testing key with Anthropic…';
      render();
      try {
        const res = await fetch('/api/anthropic-test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ anthropicKey: apiKey })
        });
        const data = await res.json();
        if (data.ok) {
          localStorage.setItem('anthropic_key', apiKey);
          ui.aiKeyAck = '✓ Key works — AI narration enabled.';
          ui.ai = { online: true, text: 'Anthropic narration active.' };
        } else {
          ui.aiKeyAck = `✗ Key rejected: ${data.reason || 'unknown error'}`;
          ui.ai = { online: false, text: String(data.reason || 'Key failed.') };
        }
      } catch {
        ui.aiKeyAck = '✗ Could not reach the server. Is it running?';
      }
      render();
    }
  }, 'Set Key');

  const clearKeyBtn = el('button', {
    class: 'btn',
    onClick: () => {
      ui.aiKey = '';
      localStorage.removeItem('anthropic_key');
      ui.aiKeyAck = 'Key cleared — narration disabled.';
      ui.ai = { online: false, text: 'No key.' };
      render();
    }
  }, 'Clear');

  const refreshBtn = el('button', {
    class: 'btn',
    onClick: async () => {
      ui.ai = { online: null, text: '(loading...)' };
      render();
      const res = await fetchAiStatus();
      if (!res.ok) {
        ui.ai = { online: false, text: res.error || 'error' };
        return render();
      }
      const txt = JSON.stringify(res.status, null, 2);
      ui.ai = { online: Boolean(res.status?.online), text: txt };
      render();
    }
  }, 'Refresh');

  const runTestBtn = el('button', {
    class: 'btn',
    onClick: async () => {
      ui.aiTest = { ok: null, text: '(testing...)', ms: null };
      render();
      const t = await runAiTest();
      ui.aiTest = { ok: Boolean(t.ok), text: String(t.text || ''), ms: (t.ms == null ? null : Number(t.ms)) };
      render();
    }
  }, 'Run Test');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'AI Connection'),
          el('div', { class: 'sub' }, 'Server-side AI status (/api/ai-status).')
        )
      ),
      el('div', { class: 'card stack' },
        el('div', { class: 'row' }, refreshBtn, runTestBtn),
        el('div', { class: 'small' }, 'Anthropic API key (browser memory — not sent to server except during narration calls)'),
        keyInput,
        el('div', { class: 'row' }, setKeyBtn, clearKeyBtn),
        (ui.aiKeyAck ? el('div', { class: 'small' }, ui.aiKeyAck) : null),
        el('div', { class: 'small' }, 'key test: ' + (ui.aiTest?.ok === null || ui.aiTest?.ok === undefined ? '(unknown)' : (ui.aiTest.ok ? 'PASS' : 'FAIL')) + (ui.aiTest?.ms == null ? '' : (' ' + String(ui.aiTest.ms) + 'ms'))),
        el('pre', { class: 'mono small', style: { whiteSpace: 'pre-wrap' } }, String(ui.aiTest?.text || '')),
        el('div', { class: 'small' }, `online: ${online === null || online === undefined ? '(unknown)' : String(online)}`),
        el("div", { class: "small" }, "ai: " + (ui.aiStatus?.online ? ("ONLINE (" + String(ui.aiStatus.source||"none") + ") mode=" + String(ui.aiStatus.mode||"?") ) : ("OFFLINE mode=" + String(ui.aiStatus.mode||"?") ))),
        el('pre', { class: 'mono small', style: { whiteSpace: 'pre-wrap' } }, statusText)
      )
    )
  );
}

function render() {
  clear(app);

  // Nav always present
  app.append(renderNav());

  if (!ui.packs.manifest) {
    app.append(el('div', { class: 'container stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Immortal Engine — build 004'),
            el('div', { class: 'sub' }, 'Loading packs…')
          )
        )
      )
    ));
    return;
  }

  if (ui.screen === 'play') app.append(renderPlay());
  else if (ui.screen === 'map') app.append(renderMap());
  else if (ui.screen === 'ai') app.append(renderAi());
  else app.append(renderInvoke());

  // Auto-scroll the recent-beats panel to bottom so newest beats are visible.
  const beatsScroll = document.querySelector('[data-beats-scroll]');
  if (beatsScroll) beatsScroll.scrollTop = beatsScroll.scrollHeight;
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
  
  await refreshAiStatus();
render();
  const packs = await loadPacks();
  ui.packs = packs;
  await fetchAiStatus();

  ui.screen = 'invoke';
  render();
}

boot().catch((e) => setStatus(String(e?.message || e)));

function drawLocalProjection(projection) {
  const canvas = document.querySelector("canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (projection.terrain?.terrain) {
    ctx.fillStyle = "#2e8b57";
    projection.terrain.terrain.forEach(t => {
      ctx.beginPath();
      ctx.arc(t.x * w, t.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  if (projection.roads) {
    ctx.strokeStyle = "#c2b280";
    ctx.lineWidth = 2;
    projection.roads.forEach((r, i) => {
      const angle = (r.angle || 0);
      const x1 = w/2;
      const y1 = h/2;
      const x2 = x1 + Math.cos(angle) * 200;
      const y2 = y1 + Math.sin(angle) * 200;

      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    });
  }
  const bfr = (projection && projection.buildingsFromRoads) ? projection.buildingsFromRoads : null;
  const blist = (bfr && Array.isArray(bfr.buildings)) ? bfr.buildings : (Array.isArray(bfr) ? bfr : []);

  if (blist.length) {
    ctx.fillStyle = "#444";
    blist.forEach((b, idx) => {
      const off = (typeof b.offset01 === "number") ? b.offset01 : (((b.roadIndex || 0) * 97 + idx * 37) % 1000) / 1000;
      const x = off * w;
      const y = (((b.roadIndex || 0) % 10) / 10) * h;
      ctx.fillRect(x, y, 6, 6);
    });
  }
}

