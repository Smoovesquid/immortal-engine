import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene, setPieceCooldownGate, carriesInteriorMovementIntent } from '../engine/playloop.js';
import { isMetaQuestion, handleMetaQuestion, looksMultiAction } from '../engine/grace/gracefulAdjudication.js';
// INT-2R — buildParseCtx is browser-safe (no server-only deps; already in
// this bundle's transitive graph via playloop.js -> assemblePacket.js). The
// key-bearing engine/intent/llmIntent.js stays server-only — v1.js reaches
// the LLM ONLY through the /api/intent-packet HTTP door (Purity Rule 9).
import { buildParseCtx } from '../engine/intent/assemblePacket.js';
import { exitsFrom, ensureMap, cleanPlaceName } from '../engine/map/mapState.js';
import { dayPhase, clockLabel } from '../engine/dayNight.js';
import { escapeOutcome } from '../engine/victory.js';
import { escapeKitView } from '../engine/combat/escapeCombat.js';
import { getItemDef } from '../engine/ruleset/core/items/index.js';
import { hasSlot, loadSlot, saveSlot, exportWorld, importWorld, markResume } from '../engine/save.js';
import { buildRecap } from '../engine/composer.js';
import { worldHash as worldHashAsync } from '../engine/worldHash.browser.js';
import { buildMythSpec, mythSpecJson } from '../engine/mythSpec.js';
import { generateTriadFrames, deriveInvocationFromFrame } from '../engine/triad.js';
import { deriveSequelInvocation } from '../engine/sequel.js';
import { renderContinuousMap, disposeContinuousMap3d, MAP_3D_ENABLED } from './map/continuousMap.js';
import { renderCombatBoard, disposeCombatBoard } from './map/combatView.js';
import { renderLocalMap } from './map/LocalMap.js';
import { createPlaceMap } from './map/handDrawnPlace.js';
import { placeFromWorldNode } from './map/placeFromNode.js';
import { buildPlaceGrid, walkTo, exteriorAnchor } from './map/placeNav.js';
import { renderSpellbookSection } from './panels/spellbook.js';
import { renderCombatHudSection } from './panels/combatHud.js';
import { renderInitiativeBar } from './panels/initiativeBar.js';
import { renderLootPopup } from './panels/lootPopup.js';
import { renderPaperDoll } from './panels/PaperDoll.js';
import { triggerFromMech } from './panels/DiceRoller.js';
import { createVoiceButton } from './panels/VoiceInput.js';
import tts from './tts.js';
import { rollDetailOptions } from '../engine/chargen/details.js';
import { PRE_ROLLED, buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { SLICE_SEED } from '../engine/world/sliceRegion.js';
import { seedFromString, makeRng } from '../engine/rng.js';
import {
  listSpecies, getSpecies, listClasses, getClass,
  listBackgrounds5e, getBackground5e, listAlignments,
  createCharacter5e, rollAbilityPools,
  ABILITY_KEYS, ABILITY_NAMES, STANDARD_ARRAY, abilityMod, SKILL_KEYS
} from '../engine/chargen/srd/index.js';

tts.init();

// ── Converse mode: the table loop (DM speaks → listens → you speak) ─────────
// The mic button is recreated on every render; this ref always points at the
// live one. tts.onIdle fires when the DM's voice actually goes quiet.
let voiceBtnRef = null;
let converseSilentRetries = 0;
tts.onIdle = () => {
  if (!ui.play?.converse || ui.screen !== 'play') return;
  if (ui.world?.ending?.locked) return;
  if (voiceBtnRef && typeof voiceBtnRef.startListening === 'function') {
    voiceBtnRef.startListening();
  }
};

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

  // 'aldermere' = THE SHIPPABLE SLICE (SLICE_SEED, engine/world/sliceRegion.js): one
  // authored ~100 km² region — Aldermere (town) · The Greenwood (woods, bandits) ·
  // Crowfoot Camp (the captain's stronghold) · The Hollowed Chapel (haunted dungeon).
  // The richer 8-town demo is still reachable by typing 'tallow' in the seed field
  // (DEMO_REGION.md); a raw seed drops you in an uncurated procgen world.
  invoke: { seed: 'aldermere', fate: 0.2, primaryId: 'fantasy', mixerId: '' },

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
    pendingLoot: null,
    // Converse mode: the DM speaks, then listens — narration end reopens the
    // mic, the transcript submits, the reply speaks, repeat. Presentation
    // only; the engine never knows the difference.
    converse: (() => { try { return localStorage.getItem('ie_converse') === '1'; } catch { return false; } })()
  },

  world: null,
  worldHash: '',
  status: '',
  ai: { online: null, text: '(not loaded)' },
  aiKey: localStorage.getItem('anthropic_key') || '',
  aiKeyAck: '',
  // Narration opt-in. Off by default so a fresh session never spends quietly;
  // when ON with no session key, the server's env key carries it.
  aiNarrationOn: localStorage.getItem('ai_narration_on') === '1',
  aiTest: { ok: null, text: '(not run)', ms: null },
  aiStatus: { ok: null, online: null, source: "(unknown)", mode: "(unknown)", envPresent: null, sessionPresent: null },
  devMode: false,
  gearOpen: false,
  map: { zoom: 'one' }, // ONE MAP (docs/ONE_MAP.md): one continuous semantic-zoom
  // surface — no discrete scale tabs, no 2D|3D toggle. Zoom alone drives the
  // representation: far = 2D plan, zoom in morphs to the 3D overworld diorama
  // (continuousMap.js). renderLocalMap survives ONLY as an error fallback in
  // renderWalkPlace (when placeFromWorldNode/createPlaceMap fail).
  // Continuous local-scale position: where your token stands on the one walkable
  // place (village + building interiors). Persists across re-renders; resets when
  // you move to a new node or interior state changes.
  // MR-1b — DEMOTED to presentation-only bookkeeping for renderWalkPlace's own
  // click-to-walk simulation (see that function's header comment). The live map's
  // marker (oneMap.js) never reads this — it resolves from engine pos/room truth
  // (docs/POSITION_AS_CANON.md §6). No game logic may treat ux/uy here as ground
  // truth; it is not hashed and is not the canonical tactical `pos`.
  place: { nodeId: '', ux: null, uy: null, interiorKey: '' },
  // Cached place object + PlaceMap instance keyed by nodeId:interiorKey.
  // Reusing the same place reference keeps EXPLORED (fog memory) alive across renders.
  placeCache: null,
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

// Set-piece cooldown (presentation pacing): keep the vivid paragraphs rare. We track
// turns since the last set-piece in `ui.setPieceGap` and let the engine's pure gate
// decide whether THIS beat fires. Reset to a large gap at game start so the opening
// arrival always lands.
const SETPIECE_COOLDOWN = 3;
function gatedBeat(rawBeat) {
  ui.setPieceGap = (Number(ui.setPieceGap) || 0) + 1;
  const beat = setPieceCooldownGate(rawBeat || '', ui.setPieceGap, SETPIECE_COOLDOWN);
  if (beat) ui.setPieceGap = 0;
  return beat;
}

async function tryAiNarration(world, baseNarration, outcome) {
  const anthropicKey = String(ui.aiKey || '').trim();
  // Narration runs when toggled on (server env key fallback) or when a
  // session key is set. Both off -> no call, no spend.
  if (!ui.aiNarrationOn && !anthropicKey) return null;
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

  // The opening scene is the player's arrival into the world — always a set-piece.
  ui.setPieceGap = 999;
  const aiText = await tryAiNarration(world, baseNarration, { beat: gatedBeat(output?.beat) });
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  render();
}

function beginNewWorld() {
  const seed = String(ui.invoke.seed || 'seed').trim() || 'seed';
  const fate = coerceFate01(ui.invoke.fate);
  const primaryId = String(ui.invoke.primaryId || 'fantasy');
  const mixerId = String(ui.invoke.mixerId || '').trim() || null;

  // Ritual options — must mirror the seed path inside createCharacter5e so the
  // options shown are the options the engine honors.
  const ritualOptions = rollDetailOptions('fantasy', `${seed}|srd`, makeRng(seedFromString(`${seed}|srd|ritual`)));

  ui.chargen = {
    step: 0,
    name: '',
    seed,
    fate,
    pack: { primaryId, mixerId },
    reroll: 0,
    pools: null, // rolled when the player reaches the dice step
    fateRevealed: false,
    ritualOptions,
    picks: {
      speciesId: null,
      speciesChoices: { ancestry: null, asiChoice: [], skills: [] },
      classId: null,
      classChoices: { skills: [], fightingStyle: null, favoredEnemy: null, terrain: null, expertise: [], equipment: {} },
      abilityMethod: '4d6',
      abilityAssignment: {},
      backgroundId: null,
      alignmentId: null,
      ritualPicks: { detail: null, keepsake: null, lineYouWontCross: null, rumor: null }
    }
  };
  ui.screen = 'chargen';
  render();
}

function chargenPicksToCharacter() {
  const cg = ui.chargen;
  return createCharacter5e({
    seed: cg.seed,
    name: cg.name || undefined,
    reroll: cg.reroll,
    ...cg.picks
  });
}

async function beginFromChargen() {
  const { seed, fate, pack } = ui.chargen;
  let pc, w0, w1, world, output;
  try {
    pc = chargenPicksToCharacter();

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

  ui.setPieceGap = 999;
  const aiText = await tryAiNarration(world, baseNarration, { beat: gatedBeat(output?.beat) });
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  render();
}

// One-click pre-rolled hero → straight into the slice, no chargen wizard. Mirrors
// beginFromChargen but injects a ready-made roster character and the slice seed.
async function beginFromPreRolled(entry) {
  let pc, w0, w1, world, output;
  try {
    pc = buildPreRolledCharacter(entry);
    if (!pc) return setStatus('Unknown pre-rolled hero.');
    w0 = newWorld({
      seed: SLICE_SEED,
      fate: 0.2,
      campaignId: `campaign-${SLICE_SEED}`,
      pack: { primaryId: 'fantasy', mixerId: null },
      mode: 'escape'
    });
    // beginAdventure skips creation when party.length > 0.
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

  ui.setPieceGap = 999;
  const aiText = await tryAiNarration(world, baseNarration, { beat: gatedBeat(output?.beat) });
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  render();
}

function continueSlot1() {
  const w = loadSlot(localStorage, 'slot1');
  if (!w) return setStatus('No slot found.');
  // P-79 — open like a DM: "previously, at this table…", closing on the
  // hottest unfinished business. Deterministic base text (LLM may polish
  // downstream); the resume stamp makes the NEXT recap start where this
  // session begins.
  let recap = null; try { recap = buildRecap(w, { getItemDef }); } catch { recap = null; }
  const w2 = markResume(w);
  ui.play.lines = [{ who: 'wizard', text: recap ? `${recap}\n\nWhat do you do?` : 'Welcome back. What do you do?', mech: recap ? '[recap]' : '' }];
  ui.play.input = '';
  ui.play.lastResolutionKind = 'turn';
  startFromWorld(w2, { keepTranscript: true });
}

function persistAndRehash(world) {
  // R0 — carry walk position from ui.place into the world before saving,
  // so a playerMove doesn't clobber where the player physically stood.
  // MR-1b — this writes the LEGACY `player.position.{nodeId,ux,uy}` field only
  // (renderWalkPlace's own presentation cache, not hashed — see engine/state.js's
  // "place now persists in party[0].position" note). It never touches the
  // canonical tactical `pos` (engine/map/spatial/tacticalPos.js), which is
  // engine-owned and hashed; nothing here is truth for the live map's marker.
  if (ui.place.ux != null && ui.place.nodeId && Array.isArray(world?.party) && world.party[0]) {
    const prev = world.party[0].position || {};
    if (String(prev.nodeId ?? '') === ui.place.nodeId || !prev.nodeId) {
      world.party[0].position = { ...prev, nodeId: ui.place.nodeId, ux: ui.place.ux, uy: ui.place.uy };
    }
  }
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

// ── Conversational Tier B: the intent arbiter ───────────────────────────────
// Multi-action sentences ("I dive behind the bar and shoot the big one") are
// split into atomic steps by ONE cheap LLM call, then each step runs through
// the same deterministic playerMove path as typed input. Gated hard: only
// fires on a conjunction-of-two-actions shape, and any failure (no key, no
// server, bad JSON) falls back to submitting the original text untouched.

async function tryIntentSplit(w, text) {
  try {
    const inCombat = Boolean(w.combat?.active);
    let verbs = [];
    try {
      const kit = w.party?.[0] ? escapeKitView(w.party[0]) : null;
      verbs = kit ? [...kit.weapons, ...kit.spells].map(x => x.verb) : [];
    } catch {}
    let npcs = [];
    try {
      const here = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId);
      npcs = (here?.settlement?.npcs || []).map(p => String(p?.name || '')).filter(Boolean);
    } catch {}
    const res = await fetch('/api/intent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        context: {
          inCombat,
          enemies: inCombat ? (w.combat.enemies || []).filter(e => e && !e.defeated).map(e => e.name) : [],
          verbs,
          npcs
        }
      })
    });
    const data = await res.json();
    // Tier C: on genuinely ambiguous input the DM asks rather than guesses.
    if (data.ok && data.clarify) {
      return { clarify: String(data.clarify) };
    }
    if (data.ok && Array.isArray(data.steps) && data.steps.length >= 2) {
      return { steps: data.steps.map(s => String(s)).slice(0, 3) };
    }
  } catch {
    // silent fallback — the original text goes through unchanged
  }
  return null;
}

// INT-2R — the LLM is the PRIMARY reader of every typed free-text turn (no
// confidence gate: the deterministic parser used to go first and the LLM
// only got a swing at what it couldn't classify — Tim's 2026-07-03 course
// correction inverted that). Every turn asks /api/intent-packet FIRST,
// budgeted so a slow/offline server can never stall play; on ok+packet the
// grounded IntentPacket rides into playerMove's 4th argument, which derives
// the shared question-verdict FROM it (playloop.js playerMove). On ANY
// failure/timeout/offline, `llmPacket` stays null and playerMove runs
// exactly as it does today — the deterministic path is always the floor.
// Hearing budget (Tim's Haiku-primary ruling, 2026-07-03 evening): the ears
// run claude-haiku-4-5 first (~1-2s round trip), local Ollama as the offline
// fallback. Keep this ABOVE the server route's 4000ms total budget (server.js
// /api/intent-packet) so the client never gives up on an answer the server
// was still allowed to produce — and the echo-first + "The DM listens…" UX in
// doSubmitMove means even a full-budget wait is visible, never dead air.
const INTENT_PACKET_TIMEOUT_MS = 4500;
async function tryLlmIntentPacket(w, text) {
  try {
    const bundle = buildParseCtx(w);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INTENT_PACKET_TIMEOUT_MS);
    let data;
    try {
      const res = await fetch('/api/intent-packet', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, bundle }),
        signal: controller.signal
      });
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }
    if (data && data.ok && data.packet && data.packet.source === 'llm') return data.packet;
  } catch {
    // offline / timeout / bad JSON — silent fallback, playerMove runs without a packet
  }
  return null;
}

// P6 — local NPC voice (Ollama/Gemma). Presentation-only: the engine already
// decided share/deflect/lie; the local model only phrases the spoken line.
// Silent fallback to the deterministic voice templates. One failed call
// marks the channel down for the session (no latency tax when Ollama's off).
let localVoiceDown = false;
async function tryLocalNpcVoice(dialogue) {
  if (localVoiceDown || !dialogue || !dialogue.npcName) return null;
  try {
    const res = await fetch('/api/npc-voice', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        npcName: dialogue.npcName,
        role: dialogue.npcRole || '',
        mood: dialogue.mood || '',
        manner: dialogue.manner || '',
        trust: (dialogue.trustLevel ?? dialogue.trust ?? null),
        mode: dialogue.mode,
        factPhrase: dialogue.factPhrase || '',
        playerLine: dialogue.playerLine || '',
        historicalFigureId: dialogue.historicalFigureId || '',
        // D-C1: ordinary-NPC voice corpus (archetype/role → corpus basename).
        // Grounds the Opus voice line for NPCs who aren't named historical figures.
        voiceCorpusId: dialogue.voiceCorpusId || '',
        claim: dialogue.claim || null,
        substrateContext: dialogue.substrateContext || [],
        // P3 (WB-Q9) — real room layout facts, so the voice layer stops
        // inventing rooms/floors the current building doesn't have.
        sceneFacts: dialogue.sceneFacts || null
      })
    });
    const data = await res.json();
    if (data.ok && data.line) {
      const mood = dialogue.mood ? `, ${dialogue.mood}` : '';
      return `Wizard: "${data.line}" ${dialogue.npcName} says${mood}.`;
    }
    if (data.reason === 'local_llm_unavailable' || data.reason === 'unavailable') localVoiceDown = true;
  } catch {
    localVoiceDown = true;
  }
  return null;
}

async function doSubmitMove() {
  setStatus('Submitting move…');
  const w = ui.world ? ensureWorld(ui.world) : null;
  if (!w) return setStatus('No world loaded.');
  if (Boolean(w.ending?.locked)) return setStatus('Session ended (ending locked).');

  let text = String(ui.play.input || '').trim(); // may be rewritten (e.g. "head south" → "go to <place>")
  if (!text) return setStatus('');

  // Movement: a typed direction WITH a verb ("head south", "go west", "travel north")
  // is an intent to set off toward the place that way — it runs the engine's
  // DM-resolved journey (time/distance/encounters/surprise/multi-hop). A BARE
  // direction ("south", "s") and the compass buttons keep local place-walk (fine
  // positioning). This honors "to the south lies X" instead of just nudging the avatar.
  // Mid-DIALOGUE, directions skip the local-walk shim entirely: walking off is
  // a conversation-breaking intent the engine must adjudicate ("You step away
  // from X…"), not a silent token nudge behind the NPC's back.
  if (!w.combat?.active && !w.scene?.dialogue && placeCtl) {
    const mv = text.toLowerCase().match(/^(go|walk|move|head|step|travel|make\s+for)?\s*(north|south|east|west|n|e|s|w)\.?$/);
    if (mv) {
      const dir = { n: 'north', s: 'south', e: 'east', w: 'west', north: 'north', south: 'south', east: 'east', west: 'west' }[mv[2]];
      const hasVerb = Boolean(mv[1]);
      // With a verb, if a known place lies that way, journey to it (named travel).
      if (hasVerb) {
        let target = null;
        try {
          const m = ensureMap(w.map);
          const id = exitsFrom(m, String(m.currentNodeId || ''))[dir];
          const node = id ? (w.map?.nodes || []).find(n => n && String(n.id) === String(id)) : null;
          target = node ? cleanPlaceName(node.name) : null;
        } catch {}
        if (target) { text = `go to ${target}`; }     // fall through to playerMove (journey)
        else { ui.play.input = ''; setStatus(''); placeWalk(dir); return; } // nothing that way → local nudge
      } else {
        ui.play.input = ''; setStatus(''); placeWalk(dir); return; // bare direction → local walk
      }
    }
  }

  // Grace layer: meta-questions ("where am I?", "am I hurt?", "what happened?")
  // are answered directly from world state. They do NOT consume a turn or mutate
  // the world — asking the DM a question shouldn't advance time. Combat is the
  // exception: mid-fight we let everything flow to playerMove so initiative holds.
  // Dialogue is the other exception: everything you type is said to THEM —
  // "What happened with the cold well?" is a question for the NPC, not the DM
  // ("what happened" was shadowing dialogue asks as a recap request).
  const inDialogue = Boolean(w.scene?.dialogue?.npcId);
  if (!w.combat?.active && !inDialogue && isMetaQuestion(text) && !carriesInteriorMovementIntent(w, text)) {
    const answer = handleMetaQuestion(text, w);
    if (answer) {
      ui.play.lines.push({ who: 'you', text, mech: '' });
      ui.play.lines.push({ who: 'wizard', text: answer, mech: '' });
      ui.play.input = '';
      tts.speak(answer);
      setStatus('');
      render();
      return;
    }
  }

  // INT-2R-u — the table never goes silent: the player's words echo and the
  // DM is visibly listening BEFORE the ear/turn work. The echo used to happen
  // only after the LLM await + playerMove, so a slow ear read as "the game
  // did nothing" (2026-07-03). Meta-questions and local walks return above
  // with their own handling; everything from here on is a real turn.
  const displayText = text.replace(/\s*::\S+\s*$/, '').trim();
  ui.play.lines.push({ who: 'you', text: displayText, mech: '' });
  ui.play.input = '';
  setStatus('The DM listens…');
  render();

  // Capture node before move for auto scene transition
  const prevNodeId = String(w.map?.currentNodeId ?? '');
  // Capture timeline length so we only react to events this move appended —
  // otherwise the loot scan below would re-fire a long-dismissed loot popup on
  // every subsequent turn (the combat-end event stays in the timeline forever).
  const prevTimelineLen = Array.isArray(w.timeline) ? w.timeline.length : 0;

  let world, output;
  try {
    // Tier B: split a multi-action sentence into atomic steps and play them
    // in order. The DM hears "duck behind the bar and shoot the big one" as
    // two beats of the same turn — so does the engine now.
    let split = null;
    if (looksMultiAction(text)) {
      setStatus('Reading your intent…');
      split = await tryIntentSplit(w, text);
    }
    // Tier C: the DM's clarifying question costs nothing — answer and retry.
    if (split && split.clarify) {
      // (player line + input clear already handled by the echo-first block)
      ui.play.lines.push({ who: 'wizard', text: split.clarify, mech: '[clarify:intent]' });
      tts.speak(split.clarify);
      setStatus('');
      render();
      return;
    }
    const steps = split && Array.isArray(split.steps) ? split.steps : null;
    if (steps && steps.length >= 2) {
      let cw = w;
      const narrParts = [];
      let lastOut = null;
      for (let i = 0; i < steps.length; i++) {
        const r = playerMove(cw, ui.packs.byId, steps[i]);
        cw = r.world;
        lastOut = r.output;
        if (r.output?.narration) narrParts.push(String(r.output.narration).replace(/^Wizard:\s*/, ''));
        // The world can interrupt the plan: an ambush mid-step or a locked
        // ending stops the remaining steps — the DM narrates what happened.
        if (cw.ending?.locked) break;
        if (!w.combat?.active && cw.combat?.active && i < steps.length - 1) {
          narrParts.push('(The rest of your plan will have to wait.)');
          break;
        }
      }
      world = cw;
      output = { ...(lastOut || {}), narration: `Wizard: ${narrParts.join(' ')}` };
    } else {
      // INT-2R — the LLM is the primary ears for a single free-text turn: ask
      // /api/intent-packet before playerMove, budgeted (tryLlmIntentPacket's
      // own AbortController) so an offline/slow server never stalls the turn.
      // On ANY miss `llmPacket` is null and playerMove runs exactly as it
      // does with no 4th argument — the deterministic parser is the floor.
      const llmPacket = await tryLlmIntentPacket(w, text);
      ({ world, output } = playerMove(w, ui.packs.byId, text, { llmPacket }));
    }
  } catch (e) {
    return setStatus(`Move failed: ${e?.message || e}`);
  }
  let baseNarration = output?.narration || '...';
  // P6 — a dialogue reply gets the local NPC voice when available.
  // EXCEPTIONS spoken verbatim, never paraphrased by a model: authored
  // testimony (the writer's words ARE the content) and common-knowledge
  // answers (real names/bearings/rumors the model would replace with
  // invention — and a doomed round-trip besides: the server has no
  // decision text for those modes).
  if (output?.dialogue && !output.dialogue.factBody && !output.dialogue.commonBody) {
    const spoken = await tryLocalNpcVoice(output.dialogue);
    if (spoken) baseNarration = spoken;
  }

  ui.play.lastResolutionKind = 'turn';
  ui.play.lastCombatSummary = output?.combatSummary || '';

  // Detect combat-end with loot among events appended THIS move only.
  const timeline = Array.isArray(world.timeline) ? world.timeline : [];
  for (let i = timeline.length - 1; i >= prevTimelineLen; i--) {
    const evt = timeline[i];
    if (evt?.kind === 'combat-end' && Array.isArray(evt.data?.loot) && evt.data.loot.length > 0) {
      ui.play.pendingLoot = evt.data;
      break;
    }
  }

  persistAndRehash(world);

  // ── Paced combat reveal ────────────────────────────────────────────────
  // Escape combat returns a `beats` array — one short line per exchange. We
  // reveal them one at a time instead of dumping the whole round, so a fight
  // reads at an audiobook cadence rather than flashing past. With voice on, each
  // beat is spoken and the next waits for it to finish; with voice off, a short
  // fixed delay gives reading room. This is the fix for "combat is too fast."
  const beats = Array.isArray(output?.beats) ? output.beats.filter(b => String(b || '').trim()) : [];
  if (beats.length) {
    setStatus('…');
    for (let i = 0; i < beats.length; i++) {
      const line = { who: 'wizard', text: String(beats[i]), mech: i === 0 ? (output?.mechanics || '') : '' };
      ui.play.lines.push(line);
      if (i === 0) triggerFromMech(line.mech);
      render();
      const spoke = await tts.speakAndWait(line.text);
      if (!spoke) await new Promise(r => setTimeout(r, 1100));
      else await new Promise(r => setTimeout(r, 250));
    }
    setStatus('Move resolved.');
    render();
    return;
  }

  // A dialogue reply is the NPC's line — attribute the speaker, not the DM.
  const wizardLine = output?.dialogue?.npcName
    ? { who: 'npc', name: output.dialogue.npcName, text: '', mech: output?.mechanics || '' }
    : { who: 'wizard', text: '', mech: output?.mechanics || '' };
  ui.play.lines.push(wizardLine);
  triggerFromMech(output?.mechanics || '');
  setStatus('Narrating…');
  render();

  // Wait for AI narration; fall back to base if unavailable. EXCEPTIONS: sarcastic
  // comebacks must not be earnestly rewritten; dialogue exits must not have their
  // NPC attribution confused by the LLM seeing other NPCs in context.
  const skipPolish = /the DM is unmoved|nice try/i.test(String(output?.mechanics || ''))
    || /\[dialogue exit/.test(String(output?.mechanics || ''));
  // Pass mechanics through so THE REF can classify the narrationSource (the
  // dialogue-ask mode lives in the mechanics tag) and gate its judge to soft
  // turns only. (docs/THE_REF.md)
  const aiText = skipPolish ? null : await tryAiNarration(world, baseNarration, { input: text, mechanics: output?.mechanics || '', narrationSource: output?.narrationSource, beat: gatedBeat(output?.beat) });
  wizardLine.text = aiText || baseNarration;
  tts.speak(wizardLine.text);
  setStatus('Move resolved.');

  // Record the turn so meta-questions ("what happened?", "did I succeed?") can
  // recall it. The grace layer reads world.conversation.{lastNarration,lastAction,
  // lastOutcome}; nothing else in the live path writes them, so do it here.
  if (world.conversation && typeof world.conversation === 'object') {
    world.conversation.lastAction = displayText;
    world.conversation.lastNarration = wizardLine.text;
    world.conversation.lastOutcome = String(output?.mechanics || '');
    persistAndRehash(world);
  }
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

  const aiText = await tryAiNarration(world, baseNarration, { beat: gatedBeat(output?.beat) });
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

// Front door + Play Again — load THE SHIPPABLE SLICE by default so a player who
// clicks Play lands in the authored ~100 km² region (Aldermere, the bandit woods,
// Crowfoot Camp, the Hollowed Chapel), not a raw procgen world. The seed feeds
// character creation too, so the demo is repeatable. Type 'tallow' to play the
// richer 8-town demo, or any other seed for a random adventure.
// (SLICE_SEED = 'aldermere', engine/world/sliceRegion.js.)
// Starting a new character overwrites the single save slot. Guard it so a reflexive
// click never destroys a saved character + their progress (the playtest pain point:
// "I have to roll a new character every time"). Continue is the prominent action when
// a save exists; New asks first.
function savedCharacterName() {
  try { return hasSlot(localStorage, 'slot1') ? (loadSlot(localStorage, 'slot1')?.party?.[0]?.name || '') : ''; }
  catch { return ''; }
}
function confirmNewOverSave(startFn) {
  const nm = savedCharacterName();
  if (nm && !window.confirm(`Start a NEW character? This replaces your saved character "${nm}" and all their progress. Use Continue to keep playing them instead.`)) return;
  startFn();
}

function playAgain() {
  ui.invoke.seed = 'aldermere';
  beginNewWorld();
}

function renderInvoke() {
  const packs = ui.packs.manifest?.packs || [];
  const has = hasSlot(localStorage, 'slot1');
  const savedName = has ? savedCharacterName() : '';

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
    class: has ? 'btn primary' : 'btn',
    disabled: !has,
    onClick: () => continueSlot1()
  }, has && savedName ? `Continue — ${savedName}` : 'Continue (slot1)');

  const beginBtn = el('button', { class: has ? 'btn' : 'btn primary', onClick: () => confirmNewOverSave(beginNewWorld) }, has ? 'New character' : 'Begin');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Immortal Engine — v0.30.7'),
          el('div', { class: 'sub' }, 'build 105 · 2026-07-06 · one building, one geometry')
        )
      ),
      // ── One-click front door: start (or resume) the Escape game ──────
      el('div', { class: 'card stack front-door' },
        el('div', { class: 'front-door-title' }, 'An Ordinary Morning'),
        el('div', { class: 'front-door-sub' }, 'You wake in your own bed, your own life. It will not stay ordinary.'),
        el('div', { class: 'row' },
          has
            ? el('button', { class: 'btn primary front-door-btn', onClick: () => { ui.screen = 'play'; continueSlot1(); } }, savedName ? `Continue as ${savedName}` : 'Continue')
            : el('button', { class: 'btn primary front-door-btn', onClick: () => playAgain() }, 'Begin'),
          has
            ? el('button', { class: 'btn front-door-btn', onClick: () => confirmNewOverSave(playAgain) }, 'New character')
            : null
        ),
        // ── Pre-rolled heroes: one click drops you into the slice, no chargen wizard ──
        el('div', { class: 'front-door-sub', style: { marginTop: '14px' } }, 'Or jump straight in as a ready-made hero:'),
        el('div', { class: 'row', style: { flexWrap: 'wrap' } },
          PRE_ROLLED.map(entry => el('button', {
            class: 'btn front-door-btn',
            title: entry.blurb,
            onClick: () => confirmNewOverSave(() => beginFromPreRolled(entry))
          }, `${entry.name} · ${entry.archetype}`))
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

// ---- Chargen wizard — rolling up a 5e character, PHB order ----

const CHARGEN_STEPS = ['Species', 'Class', 'Abilities', 'Origin', 'Ritual', 'Name & Sheet'];

function cgSelectableCard(label, sub, selected, onClick, body = null) {
  return el('div', {
    class: 'card',
    style: {
      cursor: 'pointer',
      padding: '8px 10px',
      border: selected ? '2px solid #c9a227' : '2px solid transparent'
    },
    onClick
  },
    el('div', { style: { fontWeight: 'bold' } }, label),
    sub ? el('div', { class: 'small' }, sub) : null,
    body
  );
}

function cgFmtMod(n) { return (n >= 0 ? '+' : '') + String(n); }

function cgAsiText(sp) {
  const parts = Object.entries(sp.asi).map(([k, v]) => `${k} +${v}`);
  if (sp.asiChoice) parts.push(`+${sp.asiChoice.amount} to ${sp.asiChoice.count} others`);
  return parts.join(', ');
}

function renderChargenSpecies(cg) {
  const cards = listSpecies().map(sp => {
    const selected = cg.picks.speciesId === sp.id;
    return cgSelectableCard(
      sp.subrace ? `${sp.name} (${sp.subrace})` : sp.name,
      `${cgAsiText(sp)} · speed ${sp.speed} ft.`,
      selected,
      () => { cg.picks.speciesId = sp.id; render(); },
      selected ? el('div', { class: 'stack', style: { marginTop: '6px' } },
        ...sp.traits.map(t => el('div', { class: 'small' }, `• ${t.name} — ${t.text}`))
      ) : null
    );
  });

  const extra = [];
  const sp = getSpecies(cg.picks.speciesId);
  if (sp?.id === 'dragonborn') {
    const choice = sp.choices.find(c => c.id === 'ancestry');
    extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, 'Draconic Ancestry'));
    extra.push(el('select', {
      class: 'input',
      onChange: (e) => { cg.picks.speciesChoices.ancestry = e.target.value; }
    }, ...choice.options.map(o =>
      el('option', { value: o.id, selected: cg.picks.speciesChoices.ancestry === o.id || undefined }, `${o.name} — ${o.breath}`)
    )));
  }
  if (sp?.id === 'half-elf') {
    extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, 'Ability Versatility: +1 to two abilities (not CHA)'));
    const opts = ABILITY_KEYS.filter(k => k !== 'CHA');
    for (let slot = 0; slot < 2; slot++) {
      extra.push(el('select', {
        class: 'input',
        onChange: (e) => {
          const arr = cg.picks.speciesChoices.asiChoice;
          arr[slot] = e.target.value;
          cg.picks.speciesChoices.asiChoice = [...new Set(arr.filter(Boolean))];
          render();
        }
      },
        el('option', { value: '' }, `— choose ability ${slot + 1} —`),
        ...opts.map(k => el('option', {
          value: k,
          selected: cg.picks.speciesChoices.asiChoice[slot] === k || undefined
        }, ABILITY_NAMES[k]))
      ));
    }
    extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, 'Skill Versatility: any two skills'));
    for (let slot = 0; slot < 2; slot++) {
      extra.push(el('select', {
        class: 'input',
        onChange: (e) => {
          const arr = cg.picks.speciesChoices.skills;
          arr[slot] = e.target.value;
          cg.picks.speciesChoices.skills = [...new Set(arr.filter(Boolean))];
          render();
        }
      },
        el('option', { value: '' }, `— choose skill ${slot + 1} —`),
        ...SKILL_KEYS.map(s => el('option', {
          value: s,
          selected: cg.picks.speciesChoices.skills[slot] === s || undefined
        }, s))
      ));
    }
  }

  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'Every adventurer starts somewhere. Choose your species.'),
    ...cards,
    ...extra
  );
}

function renderChargenClass(cg) {
  const cards = listClasses().map(c => {
    const selected = cg.picks.classId === c.id;
    const featureNames = [...c.features, ...(c.subclass?.features || [])].map(f => f.name).join(', ');
    return cgSelectableCard(
      c.name + (c.subclass ? ` (${c.subclass.name})` : ''),
      `d${c.hitDie} hit die · saves ${c.saves.join('/')}${c.spellcasting ? ' · spellcaster (' + c.spellcasting.ability + ')' : ''}`,
      selected,
      () => {
        if (cg.picks.classId !== c.id) {
          cg.picks.classId = c.id;
          cg.picks.classChoices = { skills: [], fightingStyle: null, favoredEnemy: null, terrain: null, expertise: [], equipment: {} };
        }
        render();
      },
      selected && featureNames ? el('div', { class: 'small', style: { marginTop: '6px' } }, `Level 1: ${featureNames}`) : null
    );
  });

  const extra = [];
  const c = getClass(cg.picks.classId);
  if (c) {
    // Skill choices. Skills the species already grants (elf Perception,
    // half-orc Intimidation, half-elf versatility picks) are grayed out —
    // picking them twice would waste a slot.
    const speciesGranted = new Set();
    const spNow = getSpecies(cg.picks.speciesId);
    for (const t of spNow?.traits || []) {
      if (t.effect?.type === 'skillProficiency') speciesGranted.add(t.effect.skill);
    }
    for (const s of cg.picks.speciesChoices.skills || []) speciesGranted.add(s);

    const from = c.skillChoices.from === 'any' ? SKILL_KEYS : c.skillChoices.from;
    const chosen = cg.picks.classChoices.skills;
    extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, `Choose ${c.skillChoices.count} skills (${chosen.length}/${c.skillChoices.count})`));
    extra.push(el('div', { class: 'stack' }, ...from.map(s => {
      const isOn = chosen.includes(s);
      const granted = speciesGranted.has(s);
      return el('label', { class: 'card', style: { cursor: granted ? 'default' : 'pointer', display: 'block', padding: '2px 8px', opacity: granted ? '0.45' : '1' } },
        el('input', {
          type: 'checkbox',
          checked: (granted || isOn) || undefined,
          disabled: granted || undefined,
          onChange: () => {
            if (granted) return;
            if (isOn) cg.picks.classChoices.skills = chosen.filter(x => x !== s);
            else if (chosen.length < c.skillChoices.count) cg.picks.classChoices.skills = [...chosen, s];
            render();
          }
        }), ' ' + s + (granted ? ' (already yours)' : '')
      );
    })));

    // Special choices (fighting style, favored enemy, terrain)
    for (const choice of c.choices || []) {
      if (choice.pickSkills) {
        if (choice.id === 'expertise') {
          extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, 'Expertise: double proficiency on two skills you know'));
          for (let slot = 0; slot < choice.pickSkills; slot++) {
            extra.push(el('select', {
              class: 'input',
              onChange: (e) => {
                const arr = cg.picks.classChoices.expertise;
                arr[slot] = e.target.value;
                cg.picks.classChoices.expertise = [...new Set(arr.filter(Boolean))];
                render();
              }
            },
              el('option', { value: '' }, `— expertise ${slot + 1} —`),
              ...cg.picks.classChoices.skills.map(s => el('option', {
                value: s, selected: cg.picks.classChoices.expertise[slot] === s || undefined
              }, s))
            ));
          }
        }
        continue;
      }
      extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, choice.name));
      extra.push(el('select', {
        class: 'input',
        onChange: (e) => { cg.picks.classChoices[choice.id] = e.target.value; render(); }
      },
        ...choice.options.map(o => el('option', {
          value: o.id,
          selected: cg.picks.classChoices[choice.id] === o.id || undefined
        }, o.text ? `${o.name} — ${o.text}` : o.name))
      ));
    }

    // Equipment choices — the classic (a) or (b)
    const slotsWithChoice = (c.equipment || []).filter(s => s.options.length > 1);
    if (slotsWithChoice.length) {
      extra.push(el('div', { class: 'small', style: { marginTop: '8px' } }, 'Starting equipment'));
      for (const slot of slotsWithChoice) {
        extra.push(el('select', {
          class: 'input',
          onChange: (e) => { cg.picks.classChoices.equipment[slot.id] = Number(e.target.value); render(); }
        },
          ...slot.options.map((opt, i) => el('option', {
            value: String(i),
            selected: (cg.picks.classChoices.equipment[slot.id] ?? 0) === i || undefined
          }, `(${String.fromCharCode(97 + i)}) ${opt.join(', ')}`))
        ));
      }
    }
  }

  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'Your class is what you do when the torch gutters out.'),
    ...cards,
    ...extra
  );
}

function renderChargenAbilities(cg) {
  const method = cg.picks.abilityMethod;
  const sp = getSpecies(cg.picks.speciesId);

  const methodRow = el('div', { class: 'row' },
    el('button', {
      class: 'btn' + (method === '4d6' ? ' primary' : ''),
      onClick: () => { cg.picks.abilityMethod = '4d6'; cg.picks.abilityAssignment = {}; render(); }
    }, 'Roll 4d6, drop lowest'),
    el('button', {
      class: 'btn' + (method === 'standard' ? ' primary' : ''),
      onClick: () => { cg.picks.abilityMethod = 'standard'; cg.picks.abilityAssignment = {}; render(); }
    }, 'Standard array (15 14 13 12 10 8)')
  );

  let totals;
  const diceSection = [];
  if (method === '4d6') {
    if (!cg.pools) cg.pools = rollAbilityPools({ seed: cg.seed, reroll: cg.reroll });
    totals = cg.pools.totals;
    diceSection.push(el('div', { class: 'small', style: { marginTop: '8px' } }, 'Your rolls (lowest die dropped):'));
    cg.pools.pools.forEach((p, i) => {
      diceSection.push(el('div', { class: 'sheet-row' },
        el('span', { class: 'sheet-k' }, `Pool ${i + 1}`),
        el('span', { class: 'sheet-v' }, String(p.total)),
        el('span', { class: 'small' }, `  [${p.dice.join(' ')}] — dropped ${p.dropped}`)
      ));
    });
    if (cg.reroll === 0) {
      diceSection.push(el('button', {
        class: 'btn',
        onClick: () => {
          cg.reroll = 1;
          cg.pools = rollAbilityPools({ seed: cg.seed, reroll: 1 });
          cg.picks.abilityAssignment = {};
          cg.picks.reroll = 1;
          render();
        }
      }, 'Reroll all six (once — no take-backs)'));
    } else {
      diceSection.push(el('div', { class: 'small' }, 'You used your reroll. The dice are the dice.'));
    }
  } else {
    totals = [...STANDARD_ARRAY];
  }
  cg.picks.reroll = cg.reroll;

  // Assignment: each ability picks one of the totals; each total usable once.
  const assignment = cg.picks.abilityAssignment;
  const counts = {};
  for (const t of totals) counts[t] = (counts[t] || 0) + 1;
  const used = {};
  for (const k of ABILITY_KEYS) {
    const v = assignment[k];
    if (v != null) used[v] = (used[v] || 0) + 1;
  }

  const assignRows = ABILITY_KEYS.map(k => {
    const asiFixed = sp?.asi?.[k] || 0;
    const chosenAsi = (sp?.asiChoice && cg.picks.speciesChoices.asiChoice.includes(k)) ? sp.asiChoice.amount : 0;
    const bonus = asiFixed + chosenAsi;
    const v = assignment[k];
    const finalScore = v != null ? v + bonus : null;
    const options = Object.keys(counts).map(Number).sort((a, b) => b - a).filter(t =>
      (used[t] || 0) < counts[t] || v === t
    );
    return el('div', { class: 'sheet-row' },
      el('span', { class: 'sheet-k' }, `${ABILITY_NAMES[k]} (${k})`),
      el('select', {
        class: 'input', style: { width: '90px', display: 'inline-block' },
        onChange: (e) => {
          const val = e.target.value === '' ? null : Number(e.target.value);
          if (val === null) delete assignment[k];
          else assignment[k] = val;
          render();
        }
      },
        el('option', { value: '' }, '—'),
        ...options.map(t => el('option', { value: String(t), selected: v === t || undefined }, String(t)))
      ),
      el('span', { class: 'small' },
        bonus ? `  +${bonus} species` : '',
        finalScore != null ? `  → ${finalScore} (${cgFmtMod(abilityMod(finalScore))})` : ''
      )
    );
  });

  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'The dice decide what you have. You decide where it goes.'),
    methodRow,
    ...diceSection,
    el('div', { class: 'small', style: { marginTop: '8px' } }, 'Assign your scores:'),
    ...assignRows
  );
}

function renderChargenOrigin(cg) {
  const classSkills = new Set(cg.picks.classChoices.skills || []);
  const bgCards = listBackgrounds5e().map(b => {
    const selected = cg.picks.backgroundId === b.id;
    const overlap = (b.skills || []).filter(s => classSkills.has(s));
    const overlapNote = overlap.length
      ? ` · overlaps your ${overlap.join(' + ')} — a replacement class skill will be assigned`
      : '';
    return cgSelectableCard(
      b.name,
      `${(b.skills || []).join(', ')} · ${b.feature.name}${overlapNote}`,
      selected,
      () => { cg.picks.backgroundId = b.id; render(); },
      selected ? el('div', { class: 'small', style: { marginTop: '6px' } }, `${b.feature.text} — "${b.hook}"`) : null
    );
  });

  const grid = el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' } },
    ...listAlignments().map(a => cgSelectableCard(
      a.name, a.text,
      cg.picks.alignmentId === a.id,
      () => { cg.picks.alignmentId = a.id; render(); }
    ))
  );

  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'Who were you before the road? Choose a background.'),
    ...bgCards,
    el('div', { class: 'small', style: { marginTop: '10px' } }, 'And where your compass points — alignment.'),
    grid
  );
}

function renderChargenRitual(cg) {
  const ritualCategories = ['detail', 'keepsake', 'lineYouWontCross', 'rumor'];
  const ritualLabels = {
    detail: 'A telling detail',
    keepsake: 'A keepsake you carry',
    lineYouWontCross: 'A line you won\'t cross',
    rumor: 'A rumor you believe'
  };

  const sections = ritualCategories.map(cat => {
    const options = cg.ritualOptions?.[cat] || [];
    if (!options.length) return null;
    const radios = options.map(opt => {
      const isSelected = cg.picks.ritualPicks[cat] === opt;
      return el('label', { class: 'card', style: { cursor: 'pointer', display: 'block', padding: '4px 8px' } },
        el('input', {
          type: 'radio',
          name: `ritual-${cat}`,
          checked: isSelected || undefined,
          onChange: () => { cg.picks.ritualPicks[cat] = opt; render(); }
        }),
        ' ' + opt
      );
    });
    return el('div', { class: 'stack' },
      el('div', { class: 'small', style: { marginTop: '6px' } }, ritualLabels[cat]),
      ...radios
    );
  });

  // Dark fate — flipped face-up as the capstone.
  const preview = chargenPicksToCharacter();
  const df = preview.background?.darkFate;
  const fateCard = cg.fateRevealed
    ? el('div', { class: 'card', style: { marginTop: '10px', border: '2px solid #7a2d2d' } },
        el('div', { style: { fontWeight: 'bold' } }, `Dark Fate: ${df?.name || '?'}`),
        el('div', { class: 'small' }, df?.text || ''))
    : el('button', {
        class: 'btn', style: { marginTop: '10px' },
        onClick: () => { cg.fateRevealed = true; render(); }
      }, 'Turn over the last card…');

  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'The table quiets. Four small truths, then the card you don\'t get to choose.'),
    ...sections.filter(Boolean),
    fateCard
  );
}

function renderChargenSheet(cg) {
  const nameInput = el('input', {
    class: 'input',
    value: cg.name,
    placeholder: 'Name your character (or take the suggestion)',
    onInput: (e) => { cg.name = String(e.target.value || ''); },
    // Re-render on blur (not per keystroke — that would steal focus) so the
    // sheet title reflects the typed name.
    onBlur: () => render()
  });

  const pc = chargenPicksToCharacter();
  const d = pc.dnd;

  const abilityRows = ABILITY_KEYS.map(k => el('div', { class: 'sheet-row' },
    el('span', { class: 'sheet-k' }, k),
    el('span', { class: 'sheet-v' }, `${d.abilities[k]} (${cgFmtMod(d.mods[k])})`),
    el('span', { class: 'small' }, d.saveProfs.includes(k) ? `  save ${cgFmtMod(d.saves[k])} ●` : `  save ${cgFmtMod(d.saves[k])}`)
  ));

  const profSkills = d.skillProfs.map(s =>
    `${s} ${cgFmtMod(d.skills[s])}${d.expertise.includes(s) ? ' ★' : ''}`
  ).join(' · ');

  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'Last thing on the sheet, first thing they\'ll carve on the stone.'),
    nameInput,
    el('div', { class: 'small' }, `Suggested: ${pc.name}`),

    el('div', { class: 'card stack', style: { marginTop: '8px' } },
      el('div', { style: { fontWeight: 'bold' } }, `${cg.name || pc.name} — ${pc.archetype}`),
      el('div', { class: 'small' }, `${d.background.name} · ${d.alignment.name} · ${d.species.size}, ${d.speed} ft.`),
      el('div', { class: 'sheet-row' },
        el('span', { class: 'sheet-k' }, 'HP'), el('span', { class: 'sheet-v' }, String(d.maxHP)),
        el('span', { class: 'sheet-k', style: { marginLeft: '12px' } }, 'AC'), el('span', { class: 'sheet-v' }, String(d.ac)),
        el('span', { class: 'sheet-k', style: { marginLeft: '12px' } }, 'Init'), el('span', { class: 'sheet-v' }, cgFmtMod(d.initiative)),
        el('span', { class: 'sheet-k', style: { marginLeft: '12px' } }, 'Prof'), el('span', { class: 'sheet-v' }, cgFmtMod(d.profBonus))
      ),
      ...abilityRows,
      el('div', { class: 'small', style: { marginTop: '6px' } }, `Skills: ${profSkills}`),
      el('div', { class: 'small' }, `Passive Perception ${d.passivePerception}`),
      d.spellcasting ? el('div', { class: 'small' }, `Spellcasting (${d.spellcasting.ability}): DC ${d.spellcasting.saveDC}, attack ${cgFmtMod(d.spellcasting.attackBonus)}`) : null,
      el('div', { class: 'small', style: { marginTop: '6px' } }, `Features: ${d.features.map(f => f.name).join(', ')}`),
      el('div', { class: 'small', style: { marginTop: '6px' } }, `Gear: ${d.equipment.join(', ')}`)
    )
  );
}

function chargenStepComplete(cg) {
  const step = cg.step;
  if (step === 0) return Boolean(cg.picks.speciesId);
  if (step === 1) {
    const c = getClass(cg.picks.classId);
    return Boolean(c) && cg.picks.classChoices.skills.length === c.skillChoices.count;
  }
  if (step === 2) return ABILITY_KEYS.every(k => cg.picks.abilityAssignment[k] != null);
  if (step === 3) return Boolean(cg.picks.backgroundId) && Boolean(cg.picks.alignmentId);
  if (step === 4) return cg.fateRevealed;
  return true;
}

function renderChargen() {
  const cg = ui.chargen;
  if (!cg) return el('div', {}, 'No chargen state.');

  const stepBody = [
    renderChargenSpecies,
    renderChargenClass,
    renderChargenAbilities,
    renderChargenOrigin,
    renderChargenRitual,
    renderChargenSheet
  ][cg.step](cg);

  const crumbs = el('div', { class: 'small' },
    CHARGEN_STEPS.map((s, i) =>
      i === cg.step ? `[${i + 1}. ${s}]` : `${i + 1}. ${s}`
    ).join('  →  ')
  );

  const canAdvance = chargenStepComplete(cg);
  const isLast = cg.step === CHARGEN_STEPS.length - 1;

  const backBtn = el('button', {
    class: 'btn',
    onClick: () => {
      if (cg.step === 0) { ui.screen = 'invoke'; }
      else cg.step -= 1;
      render();
    }
  }, cg.step === 0 ? 'Back' : '← Back');

  const nextBtn = el('button', {
    class: 'btn primary',
    disabled: canAdvance ? undefined : true,
    onClick: () => {
      if (!chargenStepComplete(cg)) return;
      if (isLast) beginFromChargen();
      else { cg.step += 1; render(); }
    }
  }, isLast ? 'Begin Adventure' : 'Next →');

  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Roll Up Your Character'),
          el('div', { class: 'sub' }, crumbs)
        )
      ),
      el('div', { class: 'card stack' },
        stepBody,
        el('div', { class: 'row', style: { marginTop: '12px' } }, backBtn, nextBtn)
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

    // Hide dev-only content: canon log lines AND all mechanics lines, roll lines
    // included. THE LAW: narrate the read, never the number — the raw
    // "[roll:16 vs DC:12 …]" string must never reach the player (the narration
    // already conveys success/failure). Mechanics stay visible only in devMode.
    const mechIsDev = Boolean(mech);
    const textIsDev = isDevLine(text);

    // Strip "Wizard: " prefix from narration for clean player-facing text
    const displayText = (!isPlayer && text.startsWith('Wizard: '))
      ? text.slice(8)
      : text;

    const isNpc = who === 'npc';
    return el('div', {
      class: `line ${isPlayer ? 'line-player' : 'line-narration'}`,
      style: isNpc ? { borderLeft: '3px solid #c9a227', paddingLeft: '10px' } : undefined
    },
      isPlayer ? el('div', { class: 'who' }, 'You')
        : isNpc ? el('div', { class: 'who', style: { color: '#c9a227' } }, String(ln?.name || 'They')) : null,
      textIsDev
        ? el('div', { class: `text ${devClass}` }, displayText)
        : el('div', { class: 'text' }, displayText),
      mech ? el('div', { class: mechIsDev ? `mech ${devClass}` : 'mech' }, mech) : null
    );
  });
  return el('div', { class: 'transcript', 'data-transcript-scroll': '1' }, ...items);
}

// ── Status panels: pure views over canonical world state ──────────────

// (Removed: GOAL_KIND_VERBS + goalDisplayLabel — they fed the goal-tracker panel.
//  Goals are obscure + player-held; the UI never shows a quest checklist.
//  See docs/DEMO_BUILD_PLAN.md D-B1 design law.)

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

  // 5e characters show their real six abilities; legacy characters keep the
  // five-stat block.
  const hasSheet = pc.dnd && typeof pc.dnd === 'object';
  const stats = hasSheet
    ? (pc.dnd.abilities || {})
    : (pc.stats && typeof pc.stats === 'object' ? pc.stats : {});
  const STAT_ORDER = hasSheet
    ? ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
    : ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];

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
  if (pc.signature?.itemName && pc.signature.itemName !== 'Thing') identityRows.push(el('div', { class: 'sheet-row' },
    el('span', { class: 'sheet-k' }, 'signature'),
    el('span', { class: 'sheet-v' }, String(pc.signature.itemName))
  ));

  // v24 — 5e sheet rows: AC and alignment come off the canonical sheet.
  if (hasSheet) {
    identityRows.push(el('div', { class: 'sheet-row' },
      el('span', { class: 'sheet-k' }, 'AC'),
      el('span', { class: 'sheet-v' }, String(pc.dnd.ac))
    ));
    if (pc.dnd.alignment?.name) identityRows.push(el('div', { class: 'sheet-row' },
      el('span', { class: 'sheet-k' }, 'alignment'),
      el('span', { class: 'sheet-v' }, String(pc.dnd.alignment.name))
    ));
  }

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
    const def = getItemDef(it.defRef);
    const isMagical = Boolean(it.magical) || Boolean(def?.bonus) || Boolean(def?.acBonus);
    return el('div', { class: 'sheet-equip-item' },
      el('span', { class: 'sheet-equip-slot' }, slotLabel),
      el('span', { class: `sheet-equip-name${isMagical ? ' magical' : ''}` }, String(it.name || def?.name || it.defRef || '?'))
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
    // typed items carry only a defRef — show the catalog name, not the slug
    if (raw.defRef) {
      const def = getItemDef(raw.defRef);
      return def?.name ? String(def.name) : String(raw.defRef);
    }
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
              const def = getItemDef(it.defRef);
              const label = def?.name ? String(def.name) : String(it.defRef || it.id);
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

// (Removed: renderGoalsSection — a "Goal tracker" panel that listed the player's goals.
//  Dead code (never mounted), and it's exactly the video-game quest-list mechanic we
//  reject: goals are obscure + player-held, never a UI checklist. The engine still
//  tracks goals internally for consequence/completion. See DEMO_BUILD_PLAN.md D-B1.)

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
  const dollSection = renderPaperDoll(world);
  return el('aside', { class: 'status-panels', 'aria-label': 'Character info', role: 'complementary' },
    renderCharacterSheetSection(world),
    renderPartySection(world),
    dollSection || null,
    renderInventorySection(world),
    renderCombatHudSection(world, el, {
      combatSummary: ui.play.lastCombatSummary || '',
      initiativeBar: renderInitiativeBar(world, el)
    })
  );
}

// The one walkable local map: a continuous hand-drawn place (village + building
// interiors embedded) you move a token across. Click to walk; walls stop you,
// doorways let you through, stepping through a door puts you inside — same scale,
// no enter/leave seam. Position persists in ui.place across re-renders.
//
// MR-1b — ui.place is PRESENTATION-ONLY bookkeeping for this simulation's own
// compact canvas (which is built here but never mounted — v1.js's live map is
// oneMap.js/renderContinuousMap, whose marker reads engine pos truth, never
// ui.place). Nothing outside this function's own click/compass handlers may
// treat ui.place.ux/uy as ground truth; it does not feed worldHash (R0 persists
// it to the legacy `player.position.ux/uy` field, a presentation-only walk-spot
// cache distinct from the canonical tactical `pos` — see engine/map/spatial/
// tacticalPos.js — that IS hashed).
function homeStartPos(place) {
  for (const b of (place.buildings || [])) {
    if (!b.structureKey) continue; // your real home structure
    const bed = (b.plan.rooms || []).find(r => /bed/i.test(String(r.role || r.name || '')));
    const r = bed || (b.plan.rooms || [])[0];
    if (r) return { ux: r.cx + b.ox, uy: r.cy + b.oy };
  }
  const pl = (place.tokens || []).find(t => t.type === 'player');
  return pl ? { ux: pl.ux, uy: pl.uy } : { ux: 2, uy: 12 };
}

function snapToBuildingRoom(bld, roomId) {
  const room = (bld.plan.rooms || []).find(r => String(r.id || '') === String(roomId || '')) || bld.plan.rooms?.[0];
  if (room) return { ux: room.cx + bld.ox, uy: room.cy + bld.oy };
  return { ux: bld.ox, uy: (bld.plan.rooms?.[0]?.cy ?? 0) + bld.oy };
}

// Live handle to the mounted walkable place so the compass and text input can move
// the SAME token the mouse does (one movement system). Rebuilt each render.
let placeCtl = null;

// The compass facing of the window you JUST climbed out of (the latest interior-exit event's
// windowFacing), so the place map can stand you on that side of the building. '' for a door exit.
function lastInteriorExitFacing(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  const last = tl[tl.length - 1];
  const d = last && last.data ? last.data : null;
  return (d && d.updateKind === 'interior-exit' && d.windowFacing) ? String(d.windowFacing) : '';
}
const STRIDE = 3; // units per cardinal nudge
const DIR_VEC = { north: [0, -STRIDE], south: [0, STRIDE], east: [STRIDE, 0], west: [-STRIDE, 0] };

function placeWalk(dir) {
  const v = DIR_VEC[dir];
  if (placeCtl && v) placeCtl.walkStep(v[0], v[1]);
  else travelTo('go ' + dir); // fallback: legacy node travel if no place mounted
}

function renderWalkPlace(world) {
  const nodeId = String(world?.map?.currentNodeId || '');
  const interior = world?.scene?.interior;
  const curInteriorKey = interior ? `${interior.structureKey}:${interior.roomId}` : '';
  let place; try { place = placeFromWorldNode(world, nodeId); } catch { place = null; }
  if (!place) { placeCtl = null; ui.placeCache = null; return renderLocalMap(world, { compact: true }); }
  const grid = buildPlaceGrid(place);

  // Fog memory is keyed by nodeId only — the street and inn are on the same
  // physical map, so going inside/outside must not wipe what you've already seen.
  // Only reset when you actually travel to a different node.
  const nodeChanged = ui.place.nodeId !== nodeId || ui.place.ux == null;
  const interiorChanged = ui.place.interiorKey !== curInteriorKey;
  const locationChanged = nodeChanged || interiorChanged;
  if (nodeChanged || ui.placeCache?.key !== nodeId) {
    ui.placeCache = { key: nodeId, explored: new Set() };
  }
  const exploredSet = ui.placeCache.explored;

  if (locationChanged) {
    if (!nodeChanged && interiorChanged) {
      if (!interior) {
        // Place the player just outside the door of the building they exited.
        const prevKey = ui.place.interiorKey;
        const exitedBld = prevKey
          ? (place.buildings || []).find(b => b.structureKey && prevKey.startsWith(b.structureKey + ':'))
          : null;
        if (exitedBld) {
          const ox = exitedBld.ox || 0, oy = exitedBld.oy || 0, M = 1.3;
          const facing = lastInteriorExitFacing(world);
          if (facing) {
            // #4: climbed out a NAMED window → stand on THAT recorded side. Footprint extent in
            // building-local units, same (r.w||r.r*2) form as handDrawnPlace's ext()/roomPoly so
            // the anchor lines up with the DRAWN footprint.
            const rs = exitedBld.plan.rooms || [];
            let nx = Infinity, xx = -Infinity, ny = Infinity, xy = -Infinity;
            for (const r of rs) { const rw = (r.w || r.r * 2) / 2, rh = (r.h || r.r * 2) / 2; nx = Math.min(nx, r.cx - rw); xx = Math.max(xx, r.cx + rw); ny = Math.min(ny, r.cy - rh); xy = Math.max(xy, r.cy + rh); }
            let ux = ox + (nx + xx) / 2, uy = oy + (ny + xy) / 2;
            if (facing === 'east') ux = ox + xx + M;
            else if (facing === 'west') ux = ox + nx - M;
            else if (facing === 'north') uy = oy + ny - M;
            else if (facing === 'south') uy = oy + xy + M;
            ui.place = { nodeId, ux, uy, interiorKey: curInteriorKey };
          } else {
            // Plain door exit → stand just outside the building's ACTUAL exterior entrance
            // (plan.mouths), which can face N/E/W. da2b528 hardcoded the south edge, which only
            // looked right because tallow's cottage is south-facing; exteriorAnchor reads the mouth.
            const a = exteriorAnchor(exitedBld.plan, ox, oy, M);
            ui.place = { nodeId, ux: a.ux, uy: a.uy, interiorKey: curInteriorKey };
          }
        } else {
          const fw = place.footprintW || 8;
          ui.place = { nodeId, ux: fw / 2, uy: 12, interiorKey: curInteriorKey };
        }
      } else {
        const bld = (place.buildings || []).find(b => String(b.structureKey || '') === String(interior.structureKey || ''));
        const s = bld ? snapToBuildingRoom(bld, interior.roomId) : homeStartPos(place);
        ui.place = { nodeId, ux: s.ux, uy: s.uy, interiorKey: curInteriorKey };
      }
    } else {
      let restored = false;
      const party = Array.isArray(world?.party) ? world.party : [];
      const player = party[0];
      if (player && player.position && typeof player.position === 'object') {
        const pos = player.position;
        if (String(pos.nodeId) === nodeId && Number.isFinite(pos.ux) && Number.isFinite(pos.uy)) {
          ui.place = { nodeId, ux: pos.ux, uy: pos.uy, interiorKey: curInteriorKey };
          restored = true;
        }
      }
      if (!restored) {
        const bld = interior && (place.buildings || []).find(b => String(b.structureKey || '') === String(interior.structureKey || ''));
        const s = bld ? snapToBuildingRoom(bld, interior.roomId) : (!interior ? { ux: (place.footprintW || 8) / 2, uy: 12 } : homeStartPos(place));
        ui.place = { nodeId, ux: s.ux, uy: s.uy, interiorKey: curInteriorKey };
      }
    }
  }
  place.tokens = (place.tokens || []).filter(t => t.type !== 'player');
  place.tokens.unshift({ type: 'player', ux: ui.place.ux, uy: ui.place.uy });

  const W = 61 * 14;
  // P-79 — prose first (DESIGN.md): the map yields to the story. The canvas height
  // is a DEFINITE viewport-relative clamp (≤30vh) so it never balloons to its
  // intrinsic ~854px square and clips the narration transcript to a sliver. (An
  // earlier container-relative percentage term depended on the wrapper's height,
  // which in turn sizes to this canvas — a circular dependency that left the height
  // unresolved and the map oversized once the canvas was nested in a wrapper div.)
  const canvas = el('canvas', {
    width: String(W), height: String(W), class: 'local-map-canvas',
    style: 'height:clamp(160px, 30vh, 340px); min-height:120px'
  });
  let pm; try { pm = createPlaceMap(canvas, { seed: String(place.seed || 'place'), fog: true, sight: 8, explored: exploredSet }); }
  catch { placeCtl = null; ui.placeCache = null; return renderLocalMap(world, { compact: true }); }
  const redraw = () => { try { pm.draw(place); } catch {} };
  const applyMove = (np) => {
    // Walk off the edge → if there's a road exit that way, travel there instead
    // of silently moving into the void. Only fires outside (interior has no exits).
    if (!ui.world?.scene?.interior) {
      const B = grid.B;
      const EDGE = 1.5;
      let edgeDir = null;
      if (np.ux <= B.minX + EDGE) edgeDir = 'west';
      else if (np.ux >= B.maxX - EDGE) edgeDir = 'east';
      else if (np.uy <= B.minY + EDGE) edgeDir = 'north';
      else if (np.uy >= B.maxY - EDGE) edgeDir = 'south';
      if (edgeDir) {
        const wExits = exitsFrom(ensureMap(ui.world.map), String(ui.world.map?.currentNodeId || ''));
        if (wExits[edgeDir]) {
          travelTo('go ' + edgeDir);
          return;
        }
      }
    }
    ui.place.ux = np.ux; ui.place.uy = np.uy;
    place.tokens[0].ux = np.ux; place.tokens[0].uy = np.uy;
    // R0 — persist walk position so reload restores exactly where you stood.
    // Does NOT trigger render() or change worldHash (ux/uy are stripped from hash projection; see engine/crunchHashProjection.js).
    if (ui.world?.party?.[0]) {
      const prev = ui.world.party[0].position || {};
      ui.world.party[0].position = { ...prev, nodeId, ux: np.ux, uy: np.uy };
      try { saveSlot(localStorage, ui.world, 'slot1'); } catch {}
    }
    redraw();
  };
  redraw();
  placeCtl = {
    nodeId,
    walkToward: (ux, uy) => applyMove(walkTo(grid, ui.place.ux, ui.place.uy, ux, uy)),
    walkStep: (dx, dy) => applyMove(walkTo(grid, ui.place.ux, ui.place.uy, ui.place.ux + dx, ui.place.uy + dy))
  };
  canvas.addEventListener('click', (e) => {
    const t = pm.screenToUnit(e.clientX, e.clientY);
    // Click on/near a token = interact (walk up to it, then the existing engine
    // turn handles it): a person → talk, a creature → fight. Empty ground = walk.
    let hit = null, hd = 1.3;
    for (const tok of (place.tokens || [])) { if (tok.type === 'player') continue; const d = Math.hypot(tok.ux - t.ux, tok.uy - t.uy); if (d < hd) { hd = d; hit = tok; } }
    if (hit && hit.type === 'npc' && hit.npc && hit.npc.name) { placeCtl.walkToward(hit.ux, hit.uy); travelTo('talk to ' + hit.npc.name); return; }
    if (hit && hit.type === 'mon' && hit.info && hit.info.name) { placeCtl.walkToward(hit.ux, hit.uy); travelTo('attack ' + hit.info.name); return; }
    placeCtl.walkToward(t.ux, t.uy);
  });
  // ── time of day: a simple sun / moon (+ wall clock) in the corner of the map. Day vs night, no
  // dimming. The lock rules follow the same clock (engine/dayNight.js). ──
  const ph = dayPhase(world);
  const glyph = ph === 'night' ? '🌙' : (ph === 'dawn' || ph === 'dusk') ? '🌅' : '☀️';
  const tod = el('div', {
    style: 'position:absolute;top:4px;right:8px;line-height:1;pointer-events:none;font:600 12px ui-sans-serif,system-ui;color:#2c2418;text-shadow:0 1px 1px rgba(255,255,255,0.55);'
  }, `${glyph} ${clockLabel(world)}`);
  // class 'play-map' so the desktop layout bounds the map (.play-body .play-map{flex:0 0 auto})
  // and the narration transcript (its sibling, flex:1 1 auto) takes the remaining height. Without
  // the class the canvas was nested in an unclassed div, matching neither the bare-canvas nor the
  // .play-map selector, so the height bound never applied and the transcript was pushed off-screen
  // (the DM's spoken text "disappeared"). position:relative anchors the day/night glyph (tod).
  const wrap = el('div', { class: 'play-map', style: 'position:relative;display:block;' }, canvas, tod);
  return wrap;
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
      // The map is no longer reached through this menu — it's the always-present
      // primary play surface (the continuous map embedded in renderPlay). The
      // fullscreen Map screen survives only as the tap-to-expand affordance on
      // that embedded map (⤢), never the only path. (ONE MAP, v0.12.0.)
      el('button', { class: 'gear-item', onClick: () => {
        ui.devMode = !ui.devMode; ui.gearOpen = false; render();
      }}, ui.devMode ? 'Hide Dev Info' : 'Show Dev Info'),

      // ── AI narration controls, reachable mid-game. The toggle uses the
      // server's key when no session key is set; off by default so a fresh
      // session never spends quietly.
      el('div', { class: 'gear-item', style: { borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '6px', cursor: 'default' } },
        el('div', { class: 'small', style: { marginBottom: '4px' } }, 'AI Narration'),
        el('button', {
          class: 'btn' + (ui.aiNarrationOn ? ' primary' : ''),
          style: { width: '100%', marginBottom: '4px' },
          onClick: () => {
            ui.aiNarrationOn = !ui.aiNarrationOn;
            try { localStorage.setItem('ai_narration_on', ui.aiNarrationOn ? '1' : '0'); } catch {}
            ui.aiKeyAck = ui.aiNarrationOn ? 'Narration ON — using your key, or the server\'s.' : 'Narration off.';
            render();
          }
        }, ui.aiNarrationOn ? 'Narration: ON' : 'Narration: OFF'),
        el('input', {
          class: 'input',
          type: 'password',
          placeholder: 'Anthropic API key (optional)',
          value: ui.aiKey || '',
          style: { width: '100%', marginBottom: '4px' },
          onInput: (e) => { ui.aiKey = String(e.target.value || ''); }
        }),
        el('button', {
          class: 'btn',
          style: { width: '100%' },
          onClick: async () => {
            const apiKey = String(ui.aiKey || '').trim();
            if (!apiKey) { ui.aiKeyAck = 'No key entered (the toggle alone uses the server key).'; return render(); }
            ui.aiKeyAck = 'Testing key…';
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
                ui.aiNarrationOn = true;
                try { localStorage.setItem('ai_narration_on', '1'); } catch {}
                ui.aiKeyAck = '✓ Key works — narration enabled.';
              } else {
                ui.aiKeyAck = `✗ Key rejected: ${data.reason || 'unknown'}`;
              }
            } catch {
              ui.aiKeyAck = '✗ Could not reach the server.';
            }
            render();
          }
        }, 'Test & Save Key'),
        ui.aiKeyAck ? el('div', { class: 'small', style: { marginTop: '4px' } }, ui.aiKeyAck) : null
      ),

      tts.isSupported() ? el('button', { class: 'gear-item', onClick: () => {
        tts.toggle(); render();
      }}, tts.enabled ? 'Voice: ON (mute)' : 'Voice: OFF (enable)') : null,

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
  // ── Dialogue mode banner: you KNOW you're in a conversation. ─────────
  const dlg = w?.scene?.dialogue || null;
  let dlgNpc = null;
  if (dlg) {
    const hereNode = (w.map?.nodes || []).find(n => n && n.id === w.map?.currentNodeId) || null;
    dlgNpc = (hereNode?.settlement?.npcs || []).find(n => n && String(n.id) === String(dlg.npcId)) || null;
  }
  const dialogueBanner = dlg ? el('div', {
    style: {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', margin: '0 0 6px 0',
      background: 'rgba(201,162,39,0.10)', borderLeft: '3px solid #c9a227', borderRadius: '4px'
    }
  },
    el('div', {
      style: {
        width: '30px', height: '30px', borderRadius: '50%', background: '#c9a227',
        color: '#1a1408', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', flex: '0 0 auto'
      }
    }, String(dlgNpc?.name || '?').trim().charAt(0).toUpperCase()),
    el('div', { style: { flex: '1 1 auto' } },
      el('div', { style: { fontWeight: 'bold', color: '#c9a227' } },
        `In conversation with ${dlgNpc?.name || 'someone'}${dlgNpc?.role ? ` — ${dlgNpc.role}` : ''}`),
      el('div', { class: 'small' },
        'everything you type is said to them — "goodbye" to step away')
    ),
    el('button', {
      class: 'btn',
      onClick: () => { ui.play.input = 'goodbye'; doSubmitMove(); }
    }, 'Step away')
  ) : null;

  const input = el('input', {
    class: 'input play-input',
    value: ui.play.input,
    placeholder: dlg ? `Say something to ${dlgNpc?.name || 'them'}\u2026 ("goodbye" to step away)` : 'What do you do?',
    role: 'search',
    onInput: (e) => { ui.play.input = String(e.target.value || ''); },
    onKeydown: (e) => { if (e.key === 'Enter') doSubmitMove(); }
  });

  // ── The map — ONE MAP, always present ─────────────────────────────────
  // MAP-3DR (2026-07-05): the 3D diorama is RECONNECTED (MAP_3D_ENABLED=true in
  // continuousMap.js). The morph now rides a PERSISTENT mount: renderContinuousMap
  // holds its map subtree (2D canvas + 3D WebGL layer) at module level and returns
  // the SAME node across v1's per-turn re-render, so appending it here just
  // re-parents it — the canvas + WebGL context are never torn down and re-mounted
  // (that teardown was the "two unrelated views flash" the 2026-07-03 park was
  // about). The 3D scene is diffed from world changes, not rebuilt per turn. The
  // in-play map opens flat at the region band and TILTS into the diorama as you
  // zoom into a place (thresholds live-tunable via window.__tilt). Pure VIEW.
  //
  // MR-1b — ui.place is DEMOTED: it is presentation-only bookkeeping for
  // renderWalkPlace's own internal click-to-walk simulation (placeCtl's
  // walkToward/walkStep — the compass buttons + click-to-move on the discarded
  // compact canvas below), NOT a truth source. The stale claim this comment used
  // to make — "which the continuous map's player marker reads" — is no longer
  // true: oneMap.js's marker resolves from playerFocusWu (engine pos/room truth,
  // docs/POSITION_AS_CANON.md §6) and explicitly ignores opts.playerPos (see
  // oneMap.js's "retires the legacy opts.playerPos/ui.place-only placement").
  // ui.place is still passed through as `playerPos` below for back-compat (no
  // live reader left to break by removing it), but no game logic may treat it as
  // truth going forward — the engine-truthful projection is the one rail.
  // We still CALL renderWalkPlace for its side-effects (placeCtl, so the compass
  // buttons keep working) and discard its compact canvas.
  if (w) { try { renderWalkPlace(w); } catch {} }
  const INPLAY_MAP_ZOOM = MAP_3D_ENABLED
    ? 2.0    // opens flat at the region band; the tilt engages on zoom-in (window.__tilt.start, ≈BAND.plan).
    : 0.12;  // the 2D plan's readable band — current node centered, neighbors in frame (OUTDOORS only).
  let mapEl = null;
  if (w) {
    // WS-3 (docs/briefs/WS-3-one-surface.md) — the compact in-play map and the
    // fullscreen Map screen (renderMap(), below) now ALWAYS render the SAME
    // continuous sheet; the old inside-a-building ? [legacy interior renderer]
    // : renderContinuousMap(...) fork (the v0.28.8 stopgap — two renderers that
    // could draw a different building shape / different hand for the same room)
    // is retired. While scene.interior is set, WS-2's playerFocusWu + cameraFor
    // (oneMap.js) center the camera on the player's room at a plan-scale default
    // zoom (BAND.plan) — the room is just the closest zoom of the SAME sheet the
    // settlement and region live on. INPLAY_MAP_ZOOM only seeds the OUTDOOR band
    // (cameraFor overrides to BAND.plan indoors on the very next resolve) and
    // only matters on first mount / a genuine indoor<->outdoor crossing — never
    // fights a manual zoom. combat = the overworld map's deepest tactical zoom.
    const inner = renderContinuousMap(w, { playerPos: ui.place, initialZoom: INPLAY_MAP_ZOOM, heightCss: '100%' });
    // Tap-to-expand: the only surviving path to the fullscreen Map screen.
    const expand = el('button', {
      class: 'map-expand-btn',
      title: 'Expand the map',
      onClick: () => { ui.screen = 'map'; render(); }
    }, '⤢');
    mapEl = el('div', { class: 'play-map-3d' }, inner, expand);
  }
  const playMap = mapEl;

  // ── Escape-mode chrome (objective banner + clickable paths) ───────────
  const isEscape = w?.meta?.mode === 'escape';
  const objective = String(w?.scene?.objective || '').trim();
  const objectiveBar = (isEscape && objective && !ended)
    ? el('div', { class: 'objective-bar' },
        el('span', { class: 'objective-icon' }, '⚑'),
        el('span', { class: 'objective-text' }, objective))
    : null;

  // ── No compass / kit / orb chrome (the DM is the only verb) ───────────
  // The N/S/E/W buttons, the HP/STR orbs, and the "what you're wielding" chips
  // are gone: you act by TALKING. Movement is still text-first — typing "north"
  // / "go west" nudges you locally (see placeWalk, used by the move parser); the
  // map shows where you stand, and your vitals/kit live in the side panels and
  // the fiction, not as a control surface. This clears the column so the map can
  // be the dominant play surface.

  // ── Main panel (narration + map, no chrome) ───────────────────────────
  const mainPanel = el('div', { class: 'panel play-panel' },
    el('div', { class: 'play-header' },
      gearDropdown,
      ended ? el('div', { class: 'play-ended' }, 'Journey complete.') : null
    ),
    objectiveBar,
    devPanel,
    dialogueBanner,
    el('div', { class: 'play-body' },
      playMap,
      renderTranscript(ui.play.lines)
    ),
    el('div', { class: 'play-hud-row' },
      el('div', { class: 'play-input-bar' },
        input,
        (() => {
          const voiceBtn = createVoiceButton((transcript) => {
            converseSilentRetries = 0;
            ui.play.input = transcript;
            // Patch the live input element so it reflects the spoken text
            const liveInput = document.querySelector('.play-input');
            if (liveInput) liveInput.value = transcript;
            doSubmitMove();
          }, {
            // Converse: heard nothing — keep listening a couple of times (you
            // were thinking), then rest until the DM speaks again or you tap.
            onSilence: () => {
              if (!ui.play.converse || ui.screen !== 'play') return;
              if (converseSilentRetries >= 2) { converseSilentRetries = 0; return; }
              converseSilentRetries++;
              if (voiceBtnRef && typeof voiceBtnRef.startListening === 'function') voiceBtnRef.startListening();
            }
          });
          voiceBtnRef = voiceBtn;
          return voiceBtn;
        })(),
        (() => {
          // Converse toggle: hands(ish)-free play. Turning it on enables the
          // DM voice (a conversation needs one) and opens the mic now — this
          // click is the user gesture browsers want for mic permission.
          const on = Boolean(ui.play.converse);
          return el('button', {
            class: 'btn converse-toggle' + (on ? ' primary' : ''),
            title: on ? 'Converse mode on — the DM speaks, then listens. Click to stop.' : 'Converse mode: speak with the DM hands-free',
            onClick: () => {
              ui.play.converse = !on;
              try { localStorage.setItem('ie_converse', ui.play.converse ? '1' : '0'); } catch {}
              if (ui.play.converse) {
                if (!tts.enabled) tts.toggle();
                converseSilentRetries = 0;
                if (voiceBtnRef && typeof voiceBtnRef.startListening === 'function') voiceBtnRef.startListening();
              } else {
                if (voiceBtnRef && typeof voiceBtnRef.stopListening === 'function') voiceBtnRef.stopListening();
                tts.stop();
              }
              render();
            }
          }, '\u{1F5E3}\u{FE0F}');
        })(),
        el('button', { class: 'btn primary', disabled: ended, onClick: () => doSubmitMove() }, 'Submit')
      )
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


// ── Continuous-zoom Map (ONE_MAP): 2D ⟷ 3D driven by zoom alone, no toggle ──
// The Map is one semantic-zoom surface: far out = the 2D graph-paper plan; zoom
// in past a threshold and the plane tilts and morphs into the live 3D overworld
// diorama (render3d), then reverses on zoom-out. continuousMap.js owns the
// stacked layers + the morph; the 3D layer is a passive WebGL overlay that must
// not leak across v1's full-rebuild render() model, so we dispose it whenever we
// leave the Map screen (see render()).
function renderMap() {
  const w = ui.world ? ensureWorld(ui.world) : null;

  if (!w) {
    disposeContinuousMap3d(); disposeCombatBoard();
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

  // During a live fight the Map is the ONE map at its tactical zoom — renderContinuousMap
  // shows the board itself (no separate combat surface; same entry as the in-play embed).
  if (w.combat && w.combat.active) {
    return el('div', { class: 'container stack' },
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Battle'),
            el('div', { class: 'small' }, 'The tactical board — your mini and the foes on their cells · drag to orbit')
          )
        ),
        renderContinuousMap(w)
      )
    );
  }

  // Out of combat: one continuous map. Scroll to zoom drives 2D → tilt → 3D and
  // back. The marker sits where the ENGINE says you stand (playerFocusWu, MR-1b)
  // — ui.place is passed through as playerPos for back-compat only; it is not
  // read for marker placement (see the in-play mount's MR-1b comment above).
  disposeCombatBoard();
  return el('div', { class: 'container stack' },
    el('div', { class: 'panel' },
      el('div', { class: 'header' },
        el('div', {},
          el('div', { class: 'title' }, 'Map'),
          el('div', { class: 'small' }, 'Scroll to zoom — out for the plan, in for the 3D world · drag to pan')
        )
      ),
      renderContinuousMap(w, { playerPos: ui.place })
    )
  );
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

  // Tear down the 3D map overlay + combat board whenever we leave the surfaces
  // that mount them — the Map screen AND the play screen (where the continuous
  // map / battle board is now embedded) — so a live WebGL context never leaks
  // across v1's full-rebuild model. (renderContinuousMap / renderCombatBoard each
  // dispose + remount cleanly on every render of those screens.)
  if (ui.screen !== 'map' && ui.screen !== 'play') { disposeContinuousMap3d(); disposeCombatBoard(); }

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

