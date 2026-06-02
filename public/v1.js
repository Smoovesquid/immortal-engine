import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { escapeOutcome } from '../engine/victory.js';
import { hasSlot, loadSlot, saveSlot, exportWorld, importWorld } from '../engine/save.js';
import { worldHash as worldHashAsync } from '../engine/worldHash.browser.js';
import { buildMythSpec, mythSpecJson } from '../engine/mythSpec.js';
import { generateTriadFrames, deriveInvocationFromFrame } from '../engine/triad.js';
import { deriveSequelInvocation } from '../engine/sequel.js';
import { renderMapView } from './map/MapView.js';
import { renderLocalMap } from './map/LocalMap.js';
import { renderRegionMap } from './map/RegionMap.js';
import { renderSpellbookSection } from './panels/spellbook.js';
import { renderCombatHudSection } from './panels/combatHud.js';
import { renderInitiativeBar } from './panels/initiativeBar.js';
import { renderLootPopup } from './panels/lootPopup.js';
import tts from './tts.js';
import { createWanderer } from '../engine/chargen/wanderer.js';
import { rollDetailOptions } from '../engine/chargen/details.js';
import { rollStats, STAT_KEYS } from '../engine/chargen/stats.js';
import { seedFromString, makeRng } from '../engine/rng.js';

tts.init();

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

  chargen: null,

  play: {
    input: '',
    lines: [],
    lastResolutionKind: 'turn',
    lastCombatSummary: '',
    pendingLoot: null
  },

  world: null,
  worldHash: '',
  status: '',
  ai: { online: null, text: '(not loaded)' },
  aiKey: localStorage.getItem('anthropic_key') || '',
  aiKeyAck: '',
  aiTest: { ok: null, text: '(not run)', ms: null },
  aiStatus: { ok: null, online: null, source: "(unknown)", mode: "(unknown)", envPresent: null, sessionPresent: null },
  devMode: false,
  gearOpen: false,
  map: { zoom: 'region' },
  prevVitals: { wounds: 0, stress: 0 },
  auth: {
    token: localStorage.getItem('auth_token') || null,
    username: localStorage.getItem('auth_username') || null,
    loginError: '',
    registerError: '',
    formUser: '',
    formPass: '',
    formMode: 'login' // 'login' or 'register'
  }
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

// ── Auth helpers ──────────────────────────────────────────────────────

function isLoggedIn() {
  return Boolean(ui.auth.token && ui.auth.username);
}

function authHeaders() {
  if (!ui.auth.token) return {};
  return { 'Authorization': `Bearer ${ui.auth.token}` };
}

function setAuth(token, username) {
  ui.auth.token = token;
  ui.auth.username = username;
  if (token) {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_username', username);
  } else {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
  }
}

function logout() {
  setAuth(null, null);
  ui.auth.loginError = '';
  ui.auth.registerError = '';
  render();
}

async function doLogin() {
  const username = String(ui.auth.formUser || '').trim();
  const password = String(ui.auth.formPass || '');
  if (!username || !password) { ui.auth.loginError = 'Enter username and password.'; render(); return; }
  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (data.ok) {
      setAuth(data.token, data.username);
      ui.auth.loginError = '';
      ui.auth.formPass = '';
      render();
    } else {
      ui.auth.loginError = data.error === 'invalid_credentials' ? 'Wrong username or password.' : (data.error || 'Login failed.');
      render();
    }
  } catch {
    ui.auth.loginError = 'Could not reach server.';
    render();
  }
}

async function doRegister() {
  const username = String(ui.auth.formUser || '').trim();
  const password = String(ui.auth.formPass || '');
  if (!username || !password) { ui.auth.registerError = 'Enter username and password.'; render(); return; }
  try {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await r.json();
    if (data.ok) {
      setAuth(data.token, data.username);
      ui.auth.registerError = '';
      ui.auth.formPass = '';
      render();
    } else {
      ui.auth.registerError = data.error === 'user_exists' ? 'Username already taken.' : (data.error || 'Registration failed.');
      render();
    }
  } catch {
    ui.auth.registerError = 'Could not reach server.';
    render();
  }
}

/** Fire-and-forget: save world to server if logged in */
function syncWorldToServer(worldState, worldId) {
  if (!isLoggedIn()) return;
  const id = worldId || String(worldState?.meta?.seed || 'default');
  fetch('/api/worlds', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ worldId: id, state: worldState })
  }).catch(() => {}); // fire-and-forget
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
    ui.play.lines.push({ who: 'wizard', text: 'The world steadies. What do you do?', mech: '' });
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
    pack: { primaryId, mixerId },
    mode: 'escape'
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
  tts.speak(wizardLine.text);
  render();
}

function beginNewWorld() {
  const seed = String(ui.invoke.seed || 'seed').trim() || 'seed';
  const fate = coerceFate01(ui.invoke.fate);
  const primaryId = String(ui.invoke.primaryId || 'fantasy');
  const mixerId = String(ui.invoke.mixerId || '').trim() || null;

  // Preview stats for chargen display
  const baseSeed = `${seed}|chargen|${primaryId}|f${Math.round(fate * 100)}|m:2d6+2`;
  const statsRng = makeRng(seedFromString(`${baseSeed}|stats`));
  const statsPreview = rollStats({ method: '2d6+2', rng: statsRng });

  // Roll ritual options for player to pick from
  const ritualRng = makeRng(seedFromString(`${baseSeed}|ritual`));
  const ritualOptions = rollDetailOptions(primaryId, baseSeed, ritualRng);

  ui.chargen = {
    name: '',
    seed,
    fate,
    pack: { primaryId, mixerId },
    ritualOptions,
    ritualPicks: { detail: null, keepsake: null, lineYouWontCross: null, rumor: null },
    stats: statsPreview
  };
  ui.screen = 'chargen';
  render();
}

async function beginFromChargen() {
  const { seed, fate, pack, ritualPicks, name } = ui.chargen;
  let pc, w0, w1, world, output;
  try {
    pc = createWanderer({ seed, fate, name: name || undefined, ritualPicks });

    w0 = newWorld({
      seed,
      fate,
      campaignId: `campaign-${seed}`,
      pack,
      mode: 'escape'
    });

    // Inject pre-created character; beginAdventure skips creation when party.length > 0
    w1 = ensureWorld({ ...w0, party: [pc] });

    ({ world, output } = beginAdventure(w1, ui.packs.byId));
  } catch (e) {
    return setStatus(`Begin failed: ${e?.message || e}`);
  }
  saveSlot(localStorage, world, 'slot1');

  const baseNarration = output?.narration || 'The world begins.';
  const wizardLine = { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines = [wizardLine];
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';

  startFromWorld(world, { keepTranscript: true });

  const aiText = await tryAiNarration(world, baseNarration, {});
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  render();
}

function continueSlot1() {
  const w = loadSlot(localStorage, 'slot1');
  if (!w) return setStatus('No slot found.');
  ui.play.lines = [{ who: 'wizard', text: 'Welcome back. What do you do?', mech: '' }];
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';
  startFromWorld(w, { keepTranscript: true });
}

function persistAndRehash(world) {
  saveSlot(localStorage, world, 'slot1');
  ui.world = ensureWorld(world);
  ui.worldHash = '(computing...)';
  syncWorldToServer(world);
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
  if (!text) return setStatus('');

  // Capture node before move for auto scene transition
  const prevNodeId = String(w.map?.currentNodeId ?? '');

  let world, output;
  try {
    ({ world, output } = playerMove(w, ui.packs.byId, text));
  } catch (e) {
    return setStatus(`Move failed: ${e?.message || e}`);
  }
  const baseNarration = output?.narration || '...';

  // Strip the internal "::<nodeId>" travel marker from the echoed player line
  // (path buttons append it for unambiguous resolution; it must not be visible).
  const displayText = text.replace(/\s*::\S+\s*$/, '').trim();
  ui.play.lines.push({ who: 'you', text: displayText, mech: '' });
  const wizardLine = { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines.push(wizardLine);
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';
  ui.play.lastCombatSummary = output?.combatSummary || '';

  // Detect combat-end with loot in timeline
  const timeline = Array.isArray(world.timeline) ? world.timeline : [];
  for (let i = timeline.length - 1; i >= 0; i--) {
    const evt = timeline[i];
    if (evt?.kind === 'combat-end' && evt.data?.loot) {
      ui.play.pendingLoot = evt.data;
      break;
    }
  }

  persistAndRehash(world);
  setStatus('Narrating…');
  render();

  // Wait for AI narration; fall back to base if unavailable
  const aiText = await tryAiNarration(world, baseNarration, { input: text });
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  setStatus('Move resolved.');
  render();

  // Auto scene transition: if player moved to a new node, fire doNewScene()
  // Queued after narration so the move's text is visible before the scene shifts.
  // Escape mode disables this — newScene auto-travels to a random neighbor, which
  // would override the player's deliberate navigation toward the escape target.
  const newNodeId = String(world.map?.currentNodeId ?? '');
  if (world.meta?.mode !== 'escape' && prevNodeId && newNodeId && prevNodeId !== newNodeId) {
    await doNewScene();
  }
}

async function doNewScene() {
  setStatus('Creating new scene…');
  const w = ui.world ? ensureWorld(ui.world) : null;
  if (!w) return setStatus('No world loaded.');
  if (Boolean(w.ending?.locked)) return setStatus('Session ended (ending locked).');

  let world, output;
  try {
    ({ world, output } = newScene(w, ui.packs.byId, { lastResolutionKind: ui.play.lastResolutionKind || 'turn' }));
  } catch (e) {
    return setStatus(`New scene failed: ${e?.message || e}`);
  }
  const baseNarration = output?.narration || 'The scene turns.';

  const wizardLine = { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines.push(wizardLine);
  ui.play.lastResolutionKind = 'scene';

  persistAndRehash(world);
  setStatus('Narrating…');
  render();

  const aiText = await tryAiNarration(world, baseNarration, {});
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  setStatus('Scene advanced.');
  render();
}

// Submit a move programmatically (used by clickable path buttons).
function travelTo(text) {
  ui.play.input = String(text || '');
  doSubmitMove();
}

// Start a fresh Escape game with a new random seed (front door + Play Again).
function playAgain() {
  const seed = `escape-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  ui.screen = 'play';
  ui.play.lines = [];
  beginFromInvocation({ seed, fate: 0.2, pack: { primaryId: 'fantasy', mixerId: null } });
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
          el('div', { class: 'title' }, 'Immortal Engine — build 005'),
          el('div', { class: 'sub' }, 'Gate 4: MythSpec + Deterministic Triad')
        )
      ),
      // ── One-click front door: start (or resume) the Escape game ──────
      el('div', { class: 'card stack front-door' },
        el('div', { class: 'front-door-title' }, 'Escape the Dungeon'),
        el('div', { class: 'front-door-sub' }, 'You wake somewhere you must not stay. Find the way out.'),
        el('div', { class: 'row' },
          el('button', { class: 'btn primary front-door-btn', onClick: () => playAgain() }, 'Begin Escape'),
          has ? el('button', { class: 'btn front-door-btn', onClick: () => { ui.screen = 'play'; continueSlot1(); } }, 'Continue') : null
        )
      ),
      el('details', { class: 'card stack advanced-invoke' },
        el('summary', {}, 'Advanced (custom seed, packs, triad)'),
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

function renderChargen() {
  const cg = ui.chargen;
  if (!cg) return el('div', {}, 'No chargen state.');

  const stats = cg.stats;
  const statOrder = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];

  const nameInput = el('input', {
    class: 'input',
    value: cg.name,
    placeholder: 'Enter a name (or leave blank for a random one)',
    onInput: (e) => { cg.name = String(e.target.value || ''); }
  });

  const statRows = statOrder.map(k => {
    const val = stats?.stats?.[k] ?? '?';
    const mod = stats?.mods?.[k] ?? 0;
    const modStr = (mod >= 0 ? '+' : '') + String(mod);
    const dice = Array.isArray(stats?.dice?.[k]) ? stats.dice[k].join(', ') : '';
    return el('div', { class: 'sheet-row' },
      el('span', { class: 'sheet-k' }, k),
      el('span', { class: 'sheet-v' }, `${val} (${modStr})`),
      el('span', { class: 'small' }, ` [${dice}]`)
    );
  });

  const ritualCategories = ['detail', 'keepsake', 'lineYouWontCross', 'rumor'];
  const ritualLabels = {
    detail: 'A telling detail',
    keepsake: 'A keepsake you carry',
    lineYouWontCross: 'A line you won\'t cross',
    rumor: 'A rumor you believe'
  };

  const ritualSections = ritualCategories.map(cat => {
    const options = cg.ritualOptions?.[cat] || [];
    if (!options.length) return null;

    const radios = options.map((opt, i) => {
      const isSelected = cg.ritualPicks[cat] === opt;
      return el('label', { class: 'card', style: { cursor: 'pointer', display: 'block', padding: '4px 8px' } },
        el('input', {
          type: 'radio',
          name: `ritual-${cat}`,
          checked: isSelected || undefined,
          onChange: () => { cg.ritualPicks[cat] = opt; render(); }
        }),
        ' ' + opt
      );
    });

    return el('div', { class: 'stack' },
      el('div', { class: 'small' }, ritualLabels[cat] || cat),
      ...radios
    );
  });

  const beginBtn = el('button', {
    class: 'btn primary',
    onClick: () => beginFromChargen()
  }, 'Begin Adventure');

  const backBtn = el('button', {
    class: 'btn',
    onClick: () => { ui.screen = 'invoke'; render(); }
  }, 'Back');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Create Your Wanderer'),
          el('div', { class: 'sub' }, 'Immortal Engine — build 005')
        )
      ),
      el('div', { class: 'card stack' },
        el('div', { class: 'small' }, 'Name'),
        nameInput,

        el('div', { class: 'small', style: { marginTop: '8px' } }, 'Archetype'),
        el('div', {}, 'Wanderer'),

        el('div', { class: 'small', style: { marginTop: '8px' } }, 'Stats (2d6+2)'),
        ...statRows,

        el('div', { class: 'small', style: { marginTop: '12px' } }, 'Ritual Choices'),
        ...ritualSections.filter(Boolean),

        el('div', { class: 'row', style: { marginTop: '12px' } }, backBtn, beginBtn)
      )
    )
  );
}

/** Detect raw canon log / dev status lines that should be hidden from players. */
function isDevLine(text) {
  if (!text) return false;
  // Canon log raw format: [scene:..., [objective:..., [tags:..., [thread:...
  if (/^\[(?:scene|objective|tags|thread):/.test(text.trim())) return true;
  return false;
}

function renderTranscript(lines) {
  const devClass = ui.devMode ? 'dev-only dev-visible' : 'dev-only';

  const items = (Array.isArray(lines) ? lines : []).map((ln) => {
    const who = String(ln?.who || 'wizard');
    const text = String(ln?.text || '');
    const mech = String(ln?.mech || '');
    const isPlayer = who === 'you';

    // Hide dev-only content: canon log lines and mechanics lines (except roll lines)
    const mechIsDev = mech && !/\[roll:/.test(mech);
    const textIsDev = isDevLine(text);

    // Strip "Wizard: " prefix from narration for clean player-facing text
    const displayText = (!isPlayer && text.startsWith('Wizard: '))
      ? text.slice(8)
      : text;

    return el('div', { class: `line ${isPlayer ? 'line-player' : 'line-narration'}` },
      isPlayer ? el('div', { class: 'who' }, 'You') : null,
      textIsDev
        ? el('div', { class: `text ${devClass}` }, displayText)
        : el('div', { class: 'text' }, displayText),
      mech ? el('div', { class: mechIsDev ? `mech ${devClass}` : 'mech' }, mech) : null
    );
  });
  return el('div', { class: 'transcript', 'data-transcript-scroll': '1' }, ...items);
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

// Pass S1 — 5e-lite ability modifier. Used by the character sheet panel.
// Pre-T1 stats live as 1..20 ints; this helper is forward-compatible with
// CRUNCH_V1.md once T1 lands and full ruleset math comes online.
function statMod(score) {
  const s = Math.max(1, Math.min(20, Number(score) || 10));
  const m = Math.floor((s - 10) / 2);
  return (m >= 0 ? '+' : '') + String(m);
}

// Pass S1 — Character Sheet panel.
// Renders the canonical 5-stat block + identity from world.party[0]. Reads
// only existing schema (no T1 fields yet) so this panel works on the current
// engine and gracefully gains rows when T1 (level/xp/foci) lands.
function renderCharacterSheetSection(world) {
  const pc = Array.isArray(world?.party) && world.party[0] ? world.party[0] : null;
  if (!pc) {
    return el('section', { class: 'status-section', 'aria-label': 'Character sheet' },
      el('h3', { class: 'status-heading' }, 'Character'),
      el('div', { class: 'empty-muted' }, 'No character yet.')
    );
  }

  const stats = pc.stats && typeof pc.stats === 'object' ? pc.stats : {};
  const STAT_ORDER = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];

  const level = Number.isFinite(Number(pc.level)) ? Math.max(1, Math.trunc(Number(pc.level))) : 1;
  const xp = Number.isFinite(Number(pc.xp)) ? Math.max(0, Math.trunc(Number(pc.xp))) : 0;

  const identityRows = [];
  if (pc.archetype) identityRows.push(el('div', { class: 'sheet-row' },
    el('span', { class: 'sheet-k' }, 'archetype'),
    el('span', { class: 'sheet-v' }, String(pc.archetype))
  ));
  if (pc.background?.name) identityRows.push(el('div', { class: 'sheet-row' },
    el('span', { class: 'sheet-k' }, 'background'),
    el('span', { class: 'sheet-v' }, String(pc.background.name))
  ));
  if (pc.signature?.itemName) identityRows.push(el('div', { class: 'sheet-row' },
    el('span', { class: 'sheet-k' }, 'signature'),
    el('span', { class: 'sheet-v' }, String(pc.signature.itemName))
  ));

  // QA1 — XP row
  identityRows.push(el('div', { class: 'sheet-row' },
    el('span', { class: 'sheet-k' }, 'xp'),
    el('span', { class: 'sheet-v' }, String(xp))
  ));

  // QA1 — Foci
  const foci = Array.isArray(pc.foci) ? pc.foci.filter(Boolean) : [];
  if (foci.length) {
    identityRows.push(el('div', { class: 'sheet-row' },
      el('span', { class: 'sheet-k' }, 'foci'),
      el('span', { class: 'sheet-v' }, foci.join(', '))
    ));
  }

  // Pass S2 — equipped gear indicators
  const items = Array.isArray(pc.inventory?.items) ? pc.inventory.items : [];
  const equippedItems = items.filter(it => it.equipped);
  const equipRows = equippedItems.map(it => {
    const slotLabel = String(it.equipped).replace(/_/g, ' ');
    const isMagical = Boolean(it.magical);
    return el('div', { class: 'sheet-equip-item' },
      el('span', { class: 'sheet-equip-slot' }, slotLabel),
      el('span', { class: `sheet-equip-name${isMagical ? ' magical' : ''}` }, String(it.name || it.defRef || '?'))
    );
  });

  // Pass S2 — compact spell slot summary on character sheet
  const spells = pc.spells;
  let slotSummary = null;
  if (spells && spells.maxSlots && typeof spells.maxSlots === 'object') {
    const parts = [];
    for (const lvl of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      const max = Number(spells.maxSlots[lvl]) || 0;
      if (max <= 0) continue;
      const cur = Math.max(0, Number(spells.slots?.[lvl]) || 0);
      parts.push(`${cur}/${max} L${lvl}`);
    }
    if (parts.length > 0) {
      slotSummary = el('div', { class: 'sheet-spell-slots' }, `Slots: ${parts.join(', ')}`);
    }
  }

  return el('section', { class: 'status-section', 'aria-label': 'Character sheet' },
    el('h3', { class: 'status-heading' }, 'Character'),
    el('div', { class: 'character-name' },
      el('span', { class: 'character-name-text' }, String(pc.name || 'Adventurer')),
      el('span', { class: 'character-level' }, `lv ${level}`)
    ),
    el('div', { class: 'stat-grid' },
      STAT_ORDER.map(key => {
        const value = Math.max(1, Math.min(20, Number(stats[key]) || 10));
        return el('div', { class: 'stat-cell' },
          el('div', { class: 'stat-key' }, key),
          el('div', { class: 'stat-value' }, String(value)),
          el('div', { class: 'stat-mod' }, statMod(value))
        );
      })
    ),
    identityRows.length ? el('div', { class: 'sheet-rows' }, identityRows) : null,
    equipRows.length ? el('div', { class: 'sheet-equip' }, ...equipRows) : null,
    slotSummary
  );
}

// Pass S1 — Inventory panel.
// Reads world.party[0].inventory which is currently `{category: string[]}`.
// T2 will upgrade items to objects with defRefs; this panel falls back to
// stringifying whatever it gets, so it survives the schema change.
const INVENTORY_CATEGORIES = [
  { key: 'weapons', label: 'Weapons' },
  { key: 'armor', label: 'Armor' },
  { key: 'spells', label: 'Spells' },
  { key: 'consumables', label: 'Consumables' },
  { key: 'tools', label: 'Tools' },
  { key: 'tech', label: 'Tech' },
  { key: 'oddities', label: 'Oddities' },
  { key: 'clothes', label: 'Clothes' },
  { key: 'junk', label: 'Junk' }
];

function inventoryItemLabel(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if (raw.name) return String(raw.name);
    if (raw.defRef) return String(raw.defRef);
  }
  return String(raw);
}

function renderInventorySection(world) {
  const pc = Array.isArray(world?.party) && world.party[0] ? world.party[0] : null;
  const inv = pc && pc.inventory && typeof pc.inventory === 'object' ? pc.inventory : null;

  if (!inv) {
    return el('section', { class: 'status-section', 'aria-label': 'Inventory' },
      el('h3', { class: 'status-heading' }, 'Inventory'),
      el('div', { class: 'empty-muted' }, 'No inventory yet.')
    );
  }

  const populated = INVENTORY_CATEGORIES
    .map(cat => ({ cat, items: Array.isArray(inv[cat.key]) ? inv[cat.key] : [] }))
    .filter(({ items }) => items.length > 0);

  // Forward-compat: T1 will add `pc.purse`. Until then, render only when present.
  const purse = pc.purse && typeof pc.purse === 'object' ? pc.purse : null;
  const purseRow = purse ? el('div', { class: 'purse-row' },
    ['gold', 'silver', 'copper', 'platinum']
      .filter(k => Number(purse[k]) > 0)
      .map(k => el('span', { class: `coin coin-${k}` }, `${Number(purse[k]) || 0} ${k[0]}`))
  ) : null;

  // T1 unified items (objects with {id, defRef, equipped})
  const unifiedItems = Array.isArray(inv.items) ? inv.items.filter(it => it && it.defRef) : [];

  const body = (populated.length === 0 && unifiedItems.length === 0)
    ? el('div', { class: 'empty-muted' }, 'Pockets empty.')
    : el('div', { class: 'inventory-categories' },
        ...populated.map(({ cat, items }) => el('div', { class: 'inv-cat' },
          el('div', { class: 'inv-cat-head' },
            el('span', { class: 'inv-cat-label' }, cat.label),
            el('span', { class: 'inv-cat-count' }, `\u00d7${items.length}`)
          ),
          el('ul', { class: 'inv-list' },
            items.map(it => el('li', { class: 'inv-item' }, inventoryItemLabel(it)))
          )
        )),
        unifiedItems.length ? el('div', { class: 'inv-cat' },
          el('div', { class: 'inv-cat-head' },
            el('span', { class: 'inv-cat-label' }, 'Items'),
            el('span', { class: 'inv-cat-count' }, `\u00d7${unifiedItems.length}`)
          ),
          el('ul', { class: 'inv-list' },
            unifiedItems.map(it => {
              const label = String(it.defRef || it.id);
              const eqTag = it.equipped ? ` [${it.equipped}]` : '';
              return el('li', { class: 'inv-item' }, label + eqTag);
            })
          )
        ) : null
      );

  return el('section', { class: 'status-section', 'aria-label': 'Inventory' },
    el('h3', { class: 'status-heading' }, 'Inventory'),
    purseRow,
    body
  );
}

// Pass S1 — Rumor Board panel.
// Forward-compat stub. Reads `world.rumors || []`. The R-track passes (R1/R2/R3)
// will populate this. Until then, the panel renders a brief empty state. This is
// the spine for the load-bearing rumor layer; ship the panel now so the visual
// affordance exists when content lands.
function renderRumorBoardSection(world) {
  const rumors = Array.isArray(world?.rumors) ? world.rumors : [];

  if (rumors.length === 0) {
    return el('section', { class: 'status-section', 'aria-label': 'Rumor board' },
      el('h3', { class: 'status-heading' }, 'Rumors'),
      el('div', { class: 'empty-muted' },
        'You have heard nothing yet. Talk to people; the world is bigger than this room.')
    );
  }

  // Sort: most recently minted first.
  const ordered = rumors.slice().sort((a, b) => (Number(b.mintedAt) || 0) - (Number(a.mintedAt) || 0));

  return el('section', { class: 'status-section', 'aria-label': 'Rumor board' },
    el('h3', { class: 'status-heading' }, 'Rumors'),
    el('ul', { class: 'rumor-list' },
      ordered.slice(0, 8).map(r => {
        const tier = Math.max(0, Math.min(4, Number(r.tier) || 0));
        const verified = String(r.verified || '');
        // Pass S2 — verification badge: checkmark for verified true, ? for unverified
        const verifiedBadge = r.verified === true
          ? el('span', { class: 'rumor-verified-badge verified' }, 'V')
          : r.verified === false
            ? el('span', { class: 'rumor-verified-badge unverified' }, '?')
            : (verified ? el('span', { class: `rumor-verdict verdict-${verified}` }, verified) : null);
        return el('li', { class: `rumor-item tier-${tier}${verified ? ` verified-${verified}` : ''}` },
          el('div', { class: 'rumor-body' }, String(r.body || '...')),
          el('div', { class: 'rumor-meta' },
            el('span', { class: 'rumor-carrier' }, `via ${String(r.carrierNpcId || 'unknown')}`),
            el('span', { class: 'rumor-tier' }, `tier ${tier}`),
            verifiedBadge
          )
        );
      })
    )
  );
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
    const cWounds = Math.max(0, Math.min(6, Number(c.wounds) || 0));
    return el('div', { class: 'party-strip companion' },
      el('div', { class: 'party-name' }, String(c.name || 'Companion')),
      el('div', { class: 'party-bar' },
        el('span', { class: 'party-bar-label' }, 'role'),
        el('span', { class: 'party-bar-dots' }, role || '—')
      ),
      el('div', { class: 'party-bar' },
        el('span', { class: 'party-bar-label' }, 'trust'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${trust} of 10 trust` }, `${trust}/10`)
      ),
      el('div', { class: 'party-bar wounds' },
        el('span', { class: 'party-bar-label' }, 'wounds'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${cWounds} of 6 wounds` }, `${cWounds}/6`)
      )
    );
  });

  // Pass H — HOME badge: surface when the player is currently in their
  // home village. Silently omits when meta.homeNodeId is unset (pre-Pass-H
  // saves) or when the player has ventured out.
  const homeNodeId = String(world?.meta?.homeNodeId || '');
  const currentNodeId = String(world?.map?.currentNodeId || '');
  const atHome = Boolean(homeNodeId) && homeNodeId === currentNodeId;
  const heading = atHome
    ? el('h3', { class: 'status-heading' },
        'Party ',
        el('span', { class: 'home-badge', 'aria-label': 'At home' }, 'HOME'))
    : el('h3', { class: 'status-heading' }, 'Party');

  // v1 Escape: show classic-D&D hit points instead of the wound/stress pool.
  const isEscape = world?.meta?.mode === 'escape';
  const escMaxHp = Math.max(0, Number(world?.meta?.escapeHp) || 0);
  const escHpMax = Math.max(0, Number(world?.meta?.escapeMaxHp) || 0);
  const playerVitals = isEscape && escHpMax > 0
    ? el('div', { class: 'party-bar hp' },
        el('span', { class: 'party-bar-label' }, 'HP'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${escMaxHp} of ${escHpMax} hit points` }, `${escMaxHp}/${escHpMax}`)
      )
    : el('div', { class: 'party-bar wounds' },
        el('span', { class: 'party-bar-label' }, 'wounds'),
        el('span', { class: 'party-bar-dots', 'aria-label': `${wounds} of 6 wounds` }, dots(wounds, 6))
      );

  const secondaryVitals = isEscape && escHpMax > 0 ? null : [
    el('div', { class: 'party-bar stress' },
      el('span', { class: 'party-bar-label' }, 'stress'),
      el('span', { class: 'party-bar-dots', 'aria-label': `${stress} of 6 stress` }, dots(stress, 6))
    ),
    el('div', { class: 'party-bar advantage' },
      el('span', { class: 'party-bar-label' }, 'advantage'),
      el('span', { class: 'party-bar-dots', 'aria-label': `${adv} advantage tokens` },
        adv === 0 ? '—' : '◆'.repeat(adv))
    )
  ];

  return el('section', { class: 'status-section', 'aria-label': 'Party status' },
    heading,
    el('div', { class: 'party-strip' },
      el('div', { class: 'party-name' }, String(pc.name || 'Adventurer')),
      playerVitals,
      ...(secondaryVitals || [])
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
  // Stripped to D&D essentials: character sheet + combat (when active)
  return el('aside', { class: 'status-panels', 'aria-label': 'Character info', role: 'complementary' },
    renderCharacterSheetSection(world),
    renderPartySection(world),
    renderInventorySection(world),
    renderCombatHudSection(world, el, {
      combatSummary: ui.play.lastCombatSummary || '',
      initiativeBar: renderInitiativeBar(world, el)
    })
  );
}

function renderPlay() {
  const w = ui.world ? ensureWorld(ui.world) : null;
  const ended = Boolean(w?.ending?.locked);
  const inCombat = Boolean(w?.combat?.active);
  const combatClass = inCombat ? ' combat-active' : '';

  // ── Gear dropdown (top-right) ─────────────────────────────────────────
  const gearOpen = Boolean(ui.gearOpen);
  const devClass = ui.devMode ? 'dev-only dev-visible' : 'dev-only';
  const pack = w ? `${w.pack.primaryId}${w.pack.mixerId ? ` + ${w.pack.mixerId}` : ''}` : '';
  const seed = w ? String(w.meta.seed) : '';
  const fate = w ? String(w.meta.fate) : '';
  const hash = String(ui.worldHash || '');

  const gearDropdown = el('div', { class: 'gear-dropdown' + (gearOpen ? ' open' : '') },
    el('button', {
      class: 'gear-btn',
      title: 'Menu',
      onClick: () => { ui.gearOpen = !ui.gearOpen; render(); }
    }, '\u2699'),
    gearOpen ? el('div', { class: 'gear-menu' },
      el('button', { class: 'gear-item', onClick: () => {
        if (!w) return setStatus('No world loaded.');
        saveSlot(localStorage, w, 'slot1');
        setStatus('Saved.'); ui.gearOpen = false; render();
      }}, 'Save'),
      el('button', { class: 'gear-item', onClick: () => {
        const w2 = loadSlot(localStorage, 'slot1');
        if (!w2) return setStatus('No slot found.');
        startFromWorld(w2, { keepTranscript: true });
        ui.gearOpen = false;
      }}, 'Load'),
      el('button', { class: 'gear-item', onClick: () => {
        ui.devMode = !ui.devMode; ui.gearOpen = false; render();
      }}, ui.devMode ? 'Hide Dev Info' : 'Show Dev Info'),
      el('button', { class: 'gear-item', onClick: () => {
        ui.world = null; ui.worldHash = '';
        ui.screen = 'invoke'; ui.gearOpen = false; render();
      }}, 'Exit to Menu')
    ) : null
  );

  // ── Dev panel (hidden by default) ────────────────────────────────────
  const devPanel = el('div', { class: devClass + ' gear-dev-panel' },
    ui.status ? el('div', { class: 'small' }, ui.status) : null,
    el('div', {}, el('strong', {}, 'worldHash'), el('div', { class: 'mono small' }, hash || '(hash unavailable)')),
    el('div', { class: 'small' }, `seed: ${seed} | fate: ${fate} | pack: ${pack}`),
    el('div', { class: 'small' }, `tension: ${(w?.instrument?.inevitability ?? 0)}/12 | clocks: p${(w?.clocks?.pressure ?? 0)}/12 d${(w?.clocks?.dread ?? 0)}/12 r${(w?.clocks?.revelation ?? 0)}/12`),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onClick: () => {
        const w2 = loadSlot(localStorage, 'slot1');
        if (!w2) return setStatus('No slot found.');
        startFromWorld(w2, { keepTranscript: true });
      }}, 'Reload slot1'),
      el('button', { class: 'btn', onClick: async () => {
        if (!w) return; const txt = exportWorld(w);
        try { await navigator.clipboard.writeText(txt); setStatus('Copied export JSON.'); }
        catch { try { window.prompt('Copy export JSON:', txt); } catch {} setStatus('Export ready.'); }
      }}, 'Export JSON'),
      el('button', { class: 'btn', onClick: () => {
        let txt = '';
        try { txt = String(window.prompt('Paste export JSON:', '') || ''); } catch {}
        if (!txt.trim()) return;
        try {
          const w2 = importWorld(txt); persistAndRehash(w2);
          ui.play.lines.push({ who: 'wizard', text: 'Import accepted. What do you do?', mech: '' });
          ui.play.input = ''; ui.play.lastResolutionKind = 'turn'; setStatus('Imported into slot1.');
        } catch (e) { setStatus(String(e && e.message ? e.message : e)); }
      }}, 'Import JSON')
    )
  );

  // ── Input bar (fixed bottom) ──────────────────────────────────────────
  const input = el('input', {
    class: 'input play-input',
    value: ui.play.input,
    placeholder: 'What do you do?',
    role: 'search',
    onInput: (e) => { ui.play.input = String(e.target.value || ''); },
    onKeydown: (e) => { if (e.key === 'Enter') doSubmitMove(); }
  });

  // ── Compact map ───────────────────────────────────────────────────────
  // Outside: a compact region map that labels every location you've discovered
  // (names appear the moment you arrive). Inside a structure: the room layout,
  // since the overland map isn't what you're navigating in there.
  const playMap = w
    ? (w.scene?.interior
        ? renderLocalMap(w, { compact: true })
        : renderRegionMap(w.map, { compact: true }))
    : null;

  // ── Escape-mode chrome (objective banner + clickable paths) ───────────
  const isEscape = w?.meta?.mode === 'escape';
  const objective = String(w?.scene?.objective || '').trim();
  const objectiveBar = (isEscape && objective && !ended)
    ? el('div', { class: 'objective-bar' },
        el('span', { class: 'objective-icon' }, '⚑'),
        el('span', { class: 'objective-text' }, objective))
    : null;

  // ── Compass ───────────────────────────────────────────────────────────
  // Four cardinal buttons, always shown — no preview of where they lead. You
  // discover exits by trying them (a dead direction reports "no way"); the map
  // fills in a location's name only once you've been there. Typing "north" /
  // "go west" works identically. This keeps travel text-first and exploratory
  // rather than a list of click-to-teleport place names.
  const showCompass = w && isEscape && !ended && !inCombat;
  const inInterior = Boolean(w?.scene?.interior);
  const compassBar = showCompass
    ? el('div', { class: 'paths-bar compass-bar' },
        el('span', { class: 'paths-label' }, 'Go:'),
        el('div', { class: 'compass' },
          el('button', { class: 'btn compass-btn compass-n', onClick: () => travelTo('go north') }, 'N'),
          el('button', { class: 'btn compass-btn compass-w', onClick: () => travelTo('go west') }, 'W'),
          el('span', { class: 'compass-hub' }, '✶'),
          el('button', { class: 'btn compass-btn compass-e', onClick: () => travelTo('go east') }, 'E'),
          el('button', { class: 'btn compass-btn compass-s', onClick: () => travelTo('go south') }, 'S')),
        inInterior
          ? el('button', { class: 'btn path-btn compass-out', onClick: () => travelTo('leave') }, 'Out ⤴')
          : null)
    : null;

  // Escape combat: a single clickable Attack resolves one round (the resolver
  // ignores move text). Keeps the game playable by clicking, like travel.
  const combatBar = (isEscape && inCombat && !ended)
    ? el('div', { class: 'paths-bar combat-bar' },
        el('span', { class: 'paths-label' }, 'Fight:'),
        el('button', { class: 'btn path-btn attack-btn', onClick: () => travelTo('attack the creature') }, 'Attack'))
    : null;

  // ── Main panel (narration + map, no chrome) ───────────────────────────
  const mainPanel = el('div', { class: 'panel play-panel' },
    el('div', { class: 'play-header' },
      gearDropdown,
      ended ? el('div', { class: 'play-ended' }, 'Journey complete.') : null
    ),
    objectiveBar,
    devPanel,
    el('div', { class: 'play-body' },
      playMap,
      renderTranscript(ui.play.lines)
    ),
    compassBar,
    combatBar,
    el('div', { class: 'play-input-bar' },
      input,
      el('button', { class: 'btn primary', disabled: ended, onClick: () => doSubmitMove() }, 'Submit')
    )
  );

  const playRoot = el('div', { class: 'container stack play-container' + combatClass, role: 'main' },
    el('div', { class: 'play-layout' },
      el('div', { class: 'main-col' }, mainPanel),
      w ? renderStatusPanels(w) : null
    )
  );

  // Loot popup overlay
  if (ui.play.pendingLoot) {
    playRoot.appendChild(renderLootPopup(ui.play.pendingLoot, el, () => {
      ui.play.pendingLoot = null;
      render();
    }));
  }

  // Escape win/lose end screen (overlay)
  const outcome = (ended && isEscape) ? escapeOutcome(w) : null;
  if (outcome) playRoot.appendChild(renderEscapeEnd(w, outcome));

  return playRoot;
}

function renderEscapeEnd(w, outcome) {
  const win = outcome === 'win';
  const title = win ? 'YOU ESCAPED' : 'YOU DIED';
  const epilogue = String(w?.ending?.epilogueLine || '').replace(/^Wizard:\s*/, '');
  return el('div', { class: 'escape-end-overlay' },
    el('div', { class: 'escape-end-card ' + (win ? 'win' : 'lose') },
      el('div', { class: 'escape-end-title' }, title),
      epilogue ? el('div', { class: 'escape-end-text' }, epilogue) : null,
      el('button', { class: 'btn primary escape-end-btn', onClick: () => playAgain() }, 'Play Again')
    )
  );
}


function renderAuthScreen() {
  const isLogin = ui.auth.formMode === 'login';
  const error = isLogin ? ui.auth.loginError : ui.auth.registerError;

  const userInput = el('input', {
    class: 'input',
    placeholder: 'Username',
    value: ui.auth.formUser || '',
    onInput: (e) => { ui.auth.formUser = String(e.target.value || ''); }
  });

  const passInput = el('input', {
    class: 'input',
    type: 'password',
    placeholder: 'Password (min 6 chars)',
    value: ui.auth.formPass || '',
    onInput: (e) => { ui.auth.formPass = String(e.target.value || ''); },
    onKeydown: (e) => { if (e.key === 'Enter') isLogin ? doLogin() : doRegister(); }
  });

  const toggleBtn = el('button', {
    class: 'btn',
    onClick: () => {
      ui.auth.formMode = isLogin ? 'register' : 'login';
      ui.auth.loginError = '';
      ui.auth.registerError = '';
      render();
    }
  }, isLogin ? 'Need an account? Register' : 'Have an account? Log in');

  const submitBtn = el('button', {
    class: 'btn primary',
    onClick: () => isLogin ? doLogin() : doRegister()
  }, isLogin ? 'Log in' : 'Register');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, isLogin ? 'Log In' : 'Register'),
          el('div', { class: 'sub' }, 'Optional — play without an account to stay offline.')
        )
      ),
      el('div', { class: 'card stack' },
        error ? el('div', { class: 'small', style: { color: '#c44' } }, error) : null,
        el('div', { class: 'small' }, 'username'),
        userInput,
        el('div', { class: 'small' }, 'password'),
        passInput,
        el('div', { class: 'row' }, submitBtn),
        toggleBtn
      )
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

  const ttsBtn = tts.isSupported() ? el('button', {
    class: 'btn tts-toggle' + (tts.enabled ? ' tts-on' : ''),
    title: tts.enabled ? 'TTS on — click to mute' : 'TTS off — click to enable',
    onClick: () => { tts.toggle(); render(); }
  }, tts.enabled ? '\u{1F50A}' : '\u{1F507}') : null;

  const devToggle = el('button', {
    class: ui.devMode ? 'btn dev-toggle dev-on' : 'btn dev-toggle',
    title: ui.devMode ? 'Dev info visible — click to hide' : 'Dev info hidden — click to show',
    onClick: () => { ui.devMode = !ui.devMode; render(); }
  }, 'Dev');

  const navButtons = [
    btn('Invoke', 'invoke'),
    btn('Play', 'play', { disabled: !hasWorld }),
    btn('Map', 'map', { disabled: !hasWorld }),
    btn('AI', 'ai'),
    ttsBtn,
    devToggle
  ];

  if (isLoggedIn()) {
    navButtons.push(
      el('span', { class: 'small', style: { alignSelf: 'center', marginLeft: 'auto' } }, ui.auth.username),
      el('button', { class: 'btn ghost', onClick: () => logout() }, 'Logout')
    );
  } else {
    navButtons.push(
      el('button', {
        class: ui.screen === 'auth' ? 'btn primary' : 'btn',
        style: { marginLeft: 'auto' },
        onClick: () => { ui.screen = 'auth'; render(); }
      }, 'Login')
    );
  }

  return el('div', { class: 'panel' },
    el('div', { class: 'header' },
      el('div', { class: 'row' }, ...navButtons)
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

  // Nav hidden during play — game feels like a game, not a dashboard
  if (ui.screen !== 'play') app.append(renderNav());

  if (!ui.packs.manifest) {
    app.append(el('div', { class: 'container stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Immortal Engine — build 005'),
            el('div', { class: 'sub' }, 'Loading packs…')
          )
        )
      )
    ));
    return;
  }

  if (ui.screen === 'play') app.append(renderPlay());
  else if (ui.screen === 'chargen') app.append(renderChargen());
  else if (ui.screen === 'map') app.append(renderMap());
  else if (ui.screen === 'ai') app.append(renderAi());
  else if (ui.screen === 'auth') app.append(renderAuthScreen());
  else app.append(renderInvoke());

  // Auto-scroll the recent-beats panel to bottom so newest beats are visible.
  const beatsScroll = document.querySelector('[data-beats-scroll]');
  if (beatsScroll) beatsScroll.scrollTop = beatsScroll.scrollHeight;

  // Auto-scroll transcript to bottom so the latest narration is visible.
  const transcriptScroll = document.querySelector('[data-transcript-scroll]');
  if (transcriptScroll) transcriptScroll.scrollTop = transcriptScroll.scrollHeight;

  // Auto-scroll the whole page so newest content is visible after moves/scenes.
  if (ui.screen === 'play') {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  // Flash party strip when wounds or stress change.
  if (ui.screen === 'play' && ui.world) {
    const pc = ui.world.party?.[0];
    const w0 = Number(pc?.wounds ?? 0);
    const s0 = Number(pc?.stress ?? 0);
    if (w0 !== ui.prevVitals.wounds || s0 !== ui.prevVitals.stress) {
      const strip = document.querySelector('.party-strip');
      if (strip) {
        strip.classList.remove('vitals-changed');
        void strip.offsetWidth; // force reflow to restart animation
        strip.classList.add('vitals-changed');
      }
      ui.prevVitals = { wounds: w0, stress: s0 };
    }
  }
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

