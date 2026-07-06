// CONTINUOUS MAP — one semantic-zoom surface, 2D ⟷ 3D, no toggle (ONE_MAP.md).
//
// The Map is a single continuous-zoom camera. Far out it is the 2D graph-paper
// regional plan (the real input surface + the no-WebGL fallback). As you zoom
// IN past a threshold the plane TILTS and the ink map cross-fades into the live
// 3D overworld diorama; zoom back out and it reverses — smoothly, no snap. Zoom
// level alone drives the representation; there is no 2D|3D button.
//
// HOW IT STAYS SEAMLESS (the trick): the 3D layer is a PASSIVE overlay stacked
// on the 2D canvas (pointer-events:none for zoom/pan — those still go to the 2D
// map; the 3D canvas only claims the pointer to ORBIT once the tilt is engaged).
// On every 2D camera change we mirror it into the 3D camera, choosing the 3D
// DISTANCE that makes one node-tile cover the same screen pixels as the 2D map
// (render3d.setCamera's pxPerTile). So at the crossover both views share scale,
// center and north-up orientation — only the TILT diverges as you push deeper.
// The cross-fade then reads as the flat map coming to life, not two scenes cut
// together.
//
// PERSISTENT MOUNT (MAP-3DR — the root fix): v1's render() wipes and rebuilds the
// whole play DOM on every typed turn. The 2D+3D map subtree is held at MODULE
// level and RE-ADOPTED into each fresh render (re-parenting a DOM node moves it,
// canvas + WebGL context intact) instead of being disposed and re-created. The 3D
// scene is DIFFED from a world-change signature (nodes/room/pos/combat) — tokens
// move + the camera eases; the scene is never reconstructed per turn. That is why
// a sentence no longer flashes "two unrelated pictures": the diorama that was on
// screen last turn is the SAME object this turn.
//
// PURE VIEW: sceneFromWorld is a read of engine-owned positions; nothing here
// writes world state or touches determinism. Three.js is lazy-loaded only when
// the zoom first crosses into 3D; if WebGL is unavailable the map simply stays
// 2D at every zoom level, fully usable.

import { renderOneMap, playerFocusWu } from './oneMap.js';
import { sceneFromWorld } from './sliceScene.js';
import { NODE_WU, BAND, Z_MAX } from './worldSpace.js';

// ── 3D DISCONNECT SWITCH ────────────────────────────────────────────────────
// Reconnected 2026-07-05 (MAP-3DR): the diorama rides a PERSISTENT mount now, so
// v1's per-turn rebuild no longer remounts it (the flash the 2026-07-03 park was
// about). Flip to false to fall back to the 2D-only plan at every zoom.
export const MAP_3D_ENABLED = true;

// ── THE TILT — live-tunable thresholds (Tim tunes by eye) ────────────────────
// Wired into the CURRENT one-map zoom (worldSpace: Z_MIN 0.008 → BAND.plan 32 →
// Z_MAX 60), NOT the retired Z_3D_START/CROSS constants (those predate the
// one-map zoom and their scale was wrong). Below `start` = today's flat 2D sheet,
// EXACTLY. Past it the paper tilts into the 3D diorama of the SAME place; `full`
// is where the tilt (and the cross-fade to the diorama) are fully developed.
//
// Defaults engage the tilt right at the plan band's full-room zoom (BAND.plan):
// indoors the camera snaps to BAND.plan on entry (WS-3), so the boot cottage
// opens right at the tilt threshold — the spot Tim tunes first. Outdoors you zoom
// in from the region sheet and the tilt comes on as a place fills the view.
//
// EVERY knob here is live-tunable without a rebuild:
//   • window.__tilt = { start, cross, full, pitchDeg, pitchTopDeg, easing }
//       — read each frame; set any subset (console: `window.__tilt.pitchDeg = 62`).
//   • localStorage 'ie.tilt' = JSON of the same — persists across reloads.
//   • window.__tiltHud(true|false) — a tiny on-map readout (live z + tilt %).
// See TILT_DEFAULTS below for the meaning + default of each.
const TILT_DEFAULTS = {
  start:       BAND.plan,        // z (px/wu) where the paper BEGINS to tilt (flat below).
  cross:       BAND.plan * 1.12, // z where the 3D diorama is fully opaque (2D faded out beneath).
                                 // MAP-BLEND-1 (Tim's double-vision report, 2026-07-06): was ×1.35 —
                                 // a band that wide let the camera SIT mid-crossfade showing two
                                 // projections at once. Narrow enough that one wheel notch crosses it;
                                 // the settle-snap below guarantees no REST inside it regardless.
  full:        Z_MAX,            // z where the tilt reaches its full oblique angle.
  pitchTopDeg: 4,                // camera pitch from straight-down at `start` (≈flat plan).
  pitchDeg:    58,               // camera pitch (deg from top-down) at `full` — the diorama vantage.
  easing:      'smoothstep',     // 'smoothstep' | 'linear' — how tilt/opacity ramp across the band.
};

// Live knob resolution: defaults ← localStorage('ie.tilt') ← window.__tilt.
// Called each frame (cheap object spread) so a console edit lands immediately.
function tiltKnobs() {
  let stored = null;
  try {
    const raw = (typeof localStorage !== 'undefined') && localStorage.getItem('ie.tilt');
    if (raw) stored = JSON.parse(raw);
  } catch { stored = null; }
  const live = (typeof window !== 'undefined' && window.__tilt && typeof window.__tilt === 'object') ? window.__tilt : null;
  const k = { ...TILT_DEFAULTS, ...(stored || {}), ...(live || {}) };
  // Guard the ordering so a bad edit can't invert the band (start < cross <= full).
  k.start = Number.isFinite(+k.start) ? +k.start : TILT_DEFAULTS.start;
  k.full = Math.max(k.start + 1e-6, Number.isFinite(+k.full) ? +k.full : TILT_DEFAULTS.full);
  k.cross = Math.min(k.full, Math.max(k.start, Number.isFinite(+k.cross) ? +k.cross : TILT_DEFAULTS.cross));
  return k;
}
// Expose a live handle so Tim can read/set knobs from the console without a reload.
try {
  if (typeof window !== 'undefined' && !window.__tilt) window.__tilt = { ...TILT_DEFAULTS };
} catch {}

const DEG = Math.PI / 180;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const linstep = (e0, e1, x) => clamp01((x - e0) / (e1 - e0));
const ramp = (k, e0, e1, x) => (k.easing === 'linear' ? linstep(e0, e1, x) : smoothstep(e0, e1, x));

// The pure tilt math, exported for U476/U477: given a zoom z and the resolved
// knobs, what the camera does. `tiltFrac` 0→1 across [start..full] (0 = flat plan,
// 1 = full oblique); `phi` the camera pitch (rad) it maps to; `blend` the 3D-layer
// opacity 0→1 across [start..cross]. DOM-free + deterministic — the single source
// of truth both the live driver (applyFromCam/onCamera) and the tests read.
export function tiltStateForZoom(z, knobs) {
  const k = knobs || TILT_DEFAULTS;
  const tiltFrac = ramp(k, k.start, k.full, z);
  const phiTop = (k.pitchTopDeg ?? TILT_DEFAULTS.pitchTopDeg) * DEG;
  const phiFull = (k.pitchDeg ?? TILT_DEFAULTS.pitchDeg) * DEG;
  const phi = phiTop + (phiFull - phiTop) * tiltFrac;
  const blend = MAP_3D_ENABLED ? ramp(k, k.start, k.cross, z) : 0;
  return { tiltFrac, phi, blend };
}
export { TILT_DEFAULTS };

// MAP-BLEND-1 — the camera must never REST mid-crossfade (Tim's double-vision
// report: two projections of the same place ghosted over each other). Pure math,
// exported for U630: given a settled zoom z, the z it should glide to — the
// nearer blend edge — or null when it's already cleanly 2D (blend ≤ 0.02) or
// cleanly 3D (≥ 0.98). Mid-band exactly (blend 0.5) resolves INTO the diorama:
// the gesture that parked you there was almost always an inward zoom. The live
// driver (scheduleBlendSettle in onCamera) debounces this so it only fires when
// the wheel/pinch goes idle — a transition may dissolve, a resting view may not.
export function settleZoomTarget(z, knobs) {
  if (!MAP_3D_ENABLED) return null;
  const k = knobs || TILT_DEFAULTS;
  const b = ramp(k, k.start, k.cross, z);
  if (b <= 0.02 || b >= 0.98) return null;
  return b < 0.5 ? k.start : k.cross;
}

// ── PERSISTENT MOUNT STATE (module-level — survives v1's full-rebuild render) ──
// `_persist` is the ONE map subtree we re-adopt across renders. `_live` is the
// mounted 3D controller (or null). `_token` guards async mounts against staleness.
let _persist = null;  // { wrap, twoD, layer3d, fillMode, hud, world } — the reused DOM.
let _live = null;     // { ctrl } — the mounted 3D controller, or null.
let _token = 0;       // bumps on every dispose to strand in-flight async mounts.
let _failed = false;  // WebGL/import failed once → stay 2D for the session.
let _sceneSig = '';   // last-applied 3D-scene signature (diff, don't rebuild).
let _lastTiltFrac = 0; // 0 flat … 1 full oblique — gates orbit vs pass-through.

// disposeContinuousMap3d() — the teardown v1 calls when LEAVING the map surfaces
// (not between turns on the same surface). Drops the 3D WebGL context AND the
// persistent DOM so the next entry mounts fresh. Between turns we do NOT call this
// (that was the flash); we re-adopt _persist instead.
export function disposeContinuousMap3d() {
  if (_live && _live.ctrl) { try { _live.ctrl.dispose(); } catch {} }
  _live = null;
  if (_persist && _persist.twoD && _persist.twoD.__ro) { try { _persist.twoD.__ro.disconnect(); } catch {} }
  _persist = null;
  _sceneSig = '';
  _lastTiltFrac = 0;
  _token++;
  try { delete window.__map3d; } catch {}
  // TT-WORLD — drop the hidden 2-D sheet mount render3d.js holds for the tilt
  // view's world-sheet texture. Lazy dynamic import (render3d.js is only ever
  // loaded once 3D has actually been opted into; a no-op if it never was —
  // the import resolves to nothing worth tearing down, module just isn't cached
  // yet, and the .catch keeps this from ever throwing on a fast double-dispose).
  import('./render3d.js').then(m => { try { m.disposeSheetMount(); } catch {} }).catch(() => {});
}

// A world-change signature for the 3D scene: the set of things that require the
// scene's *contents* to change (nodes discovered, combat on/off, the player's
// node/room). Camera easing (zoom/pan/orbit) is NOT in here — it never rebuilds.
// Exported for U475's diff-not-rebuild proof.
export function sceneSignature(world) {
  const map = world?.map || {};
  const disc = Array.isArray(map.discovered) ? map.discovered.length : 0;
  const nodes = Array.isArray(map.nodes) ? map.nodes.length : 0;
  const here = String(map.currentNodeId || '');
  const room = String(world?.scene?.interior?.roomId || '');
  const struct = String(world?.scene?.interior?.structureKey || '');
  const combat = !!(world?.combat && world.combat.active);
  const enemies = combat ? (Array.isArray(world.combat.enemies) ? world.combat.enemies.length : 0) : 0;
  return `${nodes}|${disc}|${here}|${struct}|${room}|c${combat ? 1 : 0}:${enemies}`;
}

// The player's fine focus point in NODE-TILE units (what render3d's setCamera /
// setPlayerFocus consume: it multiplies by TILE_WU internally). Derived from the
// SAME playerFocusWu rail the 2D marker uses (wu ÷ NODE_WU = tiles), so the mini
// stands on the exact square the ink marker occupies — no jump at the morph.
// Exported for U477's no-jump proof.
export function playerTileFocus(world) {
  const f = playerFocusWu(world);
  if (!f) return null;
  return { tx: f.wx / NODE_WU, ty: f.wy / NODE_WU };
}

export function renderContinuousMap(world, opts = {}) {
  const fillMode = typeof opts.heightCss === 'string' && opts.heightCss;

  // ── PERSISTENT REUSE: same surface, a new turn → re-point, don't rebuild ────
  // If we already hold a compatible mount, re-adopt it: refresh the 2D map for the
  // new world (its own camera/context stay put) and DIFF the 3D scene. Returning
  // the SAME wrap node means v1's `el(...appendChild)` just re-parents it — the
  // canvas + WebGL context ride along untouched. This is the anti-flash core.
  if (_persist && _persist.fillMode === Boolean(fillMode)) {
    const p = _persist;
    p.world = world;
    // Re-point the 2D map at the new world (persistent canvas; keeps its camera).
    try { p.twoD.__rebind(world, { onCamera: p.onCamera, playerPos: opts.playerPos, initialZoom: opts.initialZoom }); } catch {}
    // Re-evaluate the 3D scene: rebuild ONLY when contents changed (node/room/combat);
    // otherwise just move the player mini + ease the camera (done in onCamera on the
    // __rebind redraw). No content change → same live controller, no flash.
    maybeRefreshScene(world);
    autoZoomForCombat(world, p.twoD);
    return p.wrap;
  }

  // ── FRESH MOUNT (first entry to the surface, or after dispose) ──────────────
  // A brand-new persistent subtree. Drop any stale 3D context first.
  disposeContinuousMap3d();
  const token = _token;

  const wrap = document.createElement('div');
  wrap.style.cssText = fillMode
    ? 'position:relative;width:100%;height:100%;'
    : 'position:relative;width:100%;';

  // The 2D map: the single input surface (zoom/pan) and the fallback. Its onCamera
  // hook streams the live camera to the 3D overlay every frame.
  let lastCam = null;
  let mounting = false;

  // onCamera is defined below; the 2D map + __rebind both call THIS same closure.
  const twoD = renderOneMap(world, {
    playerPos: opts.playerPos,
    height: opts.height,
    heightCss: opts.heightCss,
    initialZoom: opts.initialZoom,
    onCamera: (cam) => onCamera(cam),
  });
  twoD.style.zIndex = '1';
  // MAP-BLEND-1: the plan is one HALF of a true crossfade — it fades OUT as the
  // diorama fades in (onCamera drives both). Same easing as layer3d's own.
  twoD.style.transition = 'opacity .12s linear';

  // The 3D overlay: empty + transparent until the zoom crosses into the tilt band.
  const layer3d = document.createElement('div');
  layer3d.className = 'map3d-overlay';
  layer3d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:2;border-radius:6px;overflow:hidden;transition:opacity .12s linear;';

  wrap.appendChild(twoD);
  wrap.appendChild(layer3d);

  // Tiny debug HUD (z + tilt %), toggled by window.__tiltHud(true). Off by default.
  const hud = document.createElement('div');
  hud.className = 'map3d-tilt-hud';
  hud.style.cssText = 'position:absolute;right:10px;top:10px;z-index:5;pointer-events:none;display:none;'
    + 'font:11px ui-monospace,Menlo,monospace;color:#d9a441;background:rgba(18,18,20,0.72);'
    + 'padding:3px 7px;border:1px solid rgba(217,164,65,0.4);border-radius:4px;letter-spacing:.04em;';
  wrap.appendChild(hud);

  // ── ORBIT at full tilt: drag the 3D overlay to orbit the focus (XCOM vantage) ──
  // The 3D layer is pointer-transparent by default so zoom/pan reach the 2D map.
  // We claim the drag ONLY when the tilt is engaged (_lastTiltFrac past a small
  // threshold), then orbit via the controller. Zoom-out eases the orbit back to
  // north-up (render3d does this in its own loop), so the 2D⟷3D morph re-aligns.
  // The map stays READ-ONLY — orbit/zoom/pan only, never a move.
  let orbiting = false, oLastX = 0, oLastY = 0;
  layer3d.addEventListener('pointerdown', (e) => {
    if (!_live || _lastTiltFrac < 0.05) return; // flat → let the 2D map own the drag
    orbiting = true; oLastX = e.clientX; oLastY = e.clientY;
    if (_live.ctrl.setOrbiting) _live.ctrl.setOrbiting(true);
    try { layer3d.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  layer3d.addEventListener('pointermove', (e) => {
    if (!orbiting || !_live) return;
    const daz = -(e.clientX - oLastX) * 0.006;
    const dphi = -(e.clientY - oLastY) * 0.005;
    oLastX = e.clientX; oLastY = e.clientY;
    if (_live.ctrl.orbitBy) _live.ctrl.orbitBy(daz, dphi);
  });
  const endOrbit = () => { orbiting = false; if (_live && _live.ctrl.setOrbiting) _live.ctrl.setOrbiting(false); };
  layer3d.addEventListener('pointerup', endOrbit);
  layer3d.addEventListener('pointercancel', endOrbit);

  function ensureMounted() {
    if (_failed || _live || mounting) return;
    mounting = true;
    (async () => {
      try {
        const w = _persist ? _persist.world : world;
        const scene = sceneFromWorld(w); // PURE read of engine positions.
        const { mountSlice3D } = await import('./render3d.js');
        if (token !== _token || !document.contains(layer3d)) { mounting = false; return; }
        // controls:false — the 2D map drives the camera; we add orbit ourselves.
        // opts.world (TT-WORLD) — lets the tilt view mount the world sheet (the
        // hidden 2-D drawing captured as ground-plane ink) and resolve the same
        // playerFocusWu point the ink marker anchors to.
        const ctrl = await mountSlice3D(layer3d, scene, { controls: false, world: w });
        if (token !== _token || !document.contains(layer3d)) { try { ctrl.dispose(); } catch {} mounting = false; return; }
        ctrl.canvas.style.pointerEvents = 'none'; // the overlay div gates orbit, not the canvas
        _live = { ctrl };
        _sceneSig = sceneSignature(_persist ? _persist.world : world);
        try { window.__map3d = ctrl; } catch {} // debug / verification hook
        mounting = false;
        if (lastCam) onCamera(lastCam); // snap to the current zoom immediately
      } catch {
        _failed = true; mounting = false; // graceful: the map stays 2D
      }
    })();
  }

  function applyFromCam(cam) {
    if (!_live || !cam) return;
    const { tiltFrac, phi } = tiltStateForZoom(cam.z, tiltKnobs());
    _lastTiltFrac = tiltFrac;
    _live.ctrl.setCamera({
      phi, az: 0, // north-up base, matching the 2D plan (orbit adds an offset on top)
      target: { tx: cam.cx / NODE_WU, ty: cam.cy / NODE_WU },
      pxPerTile: NODE_WU * cam.z, // lock 3D scale to the 2D map's scale
    });
    // Keep the player mini pinned to the 2D marker's exact point (no morph jump).
    const pf = playerTileFocus(_persist ? _persist.world : world);
    if (pf && _live.ctrl.setPlayerFocus) _live.ctrl.setPlayerFocus(pf.tx, pf.ty);
  }

  function updateHud(cam, blend) {
    if (!_persist || _persist.hud.style.display === 'none') return;
    const pct = Math.round((_lastTiltFrac || 0) * 100);
    _persist.hud.textContent = `z ${cam.z.toFixed(2)} · tilt ${pct}% · fade ${Math.round(blend * 100)}%`;
  }

  // MAP-BLEND-1 — debounced rest-settle: while the wheel/pinch is moving, the
  // crossfade is free to dissolve; the moment the camera goes idle INSIDE the
  // band, glide z to the nearer edge so the resting view is always ONE
  // projection (flat plan or diorama), never both ghosted. Recomputed from live
  // knobs at fire time; the glide itself re-enters onCamera and converges to a
  // no-op at the edge (settleZoomTarget returns null there).
  let settleTimer = 0;
  function scheduleBlendSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (token !== _token || !lastCam || !_live) return;
      const zt = settleZoomTarget(lastCam.z, tiltKnobs());
      if (zt == null || typeof twoD.__oneMapFocus !== 'function') return;
      twoD.__oneMapFocus(lastCam.cx, lastCam.cy, zt);
    }, 250);
  }

  function onCamera(cam) {
    if (token !== _token) return;
    lastCam = cam;
    // MAP_3D_ENABLED=false pins the blend at 0: the 3D layer is never even
    // lazy-mounted and the map is the 2D plan at every zoom.
    const b = tiltStateForZoom(cam.z, tiltKnobs()).blend;
    if (b <= 0.001) {            // pure 2D — hide & idle the diorama, pass pointer through
      layer3d.style.opacity = '0';
      twoD.style.opacity = '1';  // MAP-BLEND-1: the plan fully back
      layer3d.style.pointerEvents = 'none';
      _lastTiltFrac = 0;
      if (_live) _live.ctrl.pause();
      updateHud(cam, 0);
      return;
    }
    ensureMounted();
    if (!_live) { layer3d.style.opacity = '0'; twoD.style.opacity = '1'; updateHud(cam, 0); return; } // still mounting / failed
    _live.ctrl.resume();
    applyFromCam(cam);
    layer3d.style.opacity = String(b);
    // MAP-BLEND-1: TRUE crossfade — the plan fades out exactly as the diorama
    // fades in (was: plan pinned at 1 beneath a translucent diorama = Tim's
    // double-vision photo, both projections at once).
    twoD.style.opacity = String(1 - b);
    // Once the diorama is substantially visible, let the overlay claim drags to
    // orbit; below that keep it transparent so zoom/pan reach the 2D map.
    layer3d.style.pointerEvents = (_lastTiltFrac > 0.15) ? 'auto' : 'none';
    updateHud(cam, b);
    scheduleBlendSettle();
  }

  _persist = { wrap, twoD, layer3d, fillMode: Boolean(fillMode), hud, world, onCamera };

  // Verification / deep-link hook: drive the unified zoom to a world point.
  wrap.__continuousFocus = (cx, cy, z) => { if (twoD.__oneMapFocus) twoD.__oneMapFocus(cx, cy, z); };

  // Tiny debug readout toggle — Tim: `window.__tiltHud(true)` to watch z + tilt%.
  try {
    window.__tiltHud = (on) => { if (_persist) _persist.hud.style.display = on ? 'block' : 'none'; };
  } catch {}

  autoZoomForCombat(world, twoD);

  return wrap;
}

// Rebuild the 3D scene ONLY when its contents changed (a new node discovered, a
// room/structure change, combat starting/ending). Camera/orbit/zoom never trigger
// this. A pure-view re-read; the OLD controller is disposed and a new one mounted
// on the SAME persistent layer3d div (its identity preserved), then the current
// camera is re-applied so there is no visible pop. When nothing changed this is a
// no-op — the diorama on screen last turn is the same object this turn (anti-flash).
function maybeRefreshScene(world) {
  if (!MAP_3D_ENABLED || _failed || !_persist) return;
  if (!_live) return; // not mounted yet (zoomed out / flat) — ensureMounted handles first mount
  const sig = sceneSignature(world);
  if (sig === _sceneSig) return; // contents unchanged → keep the live scene as-is
  _sceneSig = sig;
  const layer3d = _persist.layer3d;
  const token = _token;
  const prev = _live;
  (async () => {
    try {
      const scene = sceneFromWorld(world);
      const { mountSlice3D } = await import('./render3d.js');
      if (token !== _token || !document.contains(layer3d)) return;
      const ctrl = await mountSlice3D(layer3d, scene, { controls: false, world });
      if (token !== _token || !document.contains(layer3d)) { try { ctrl.dispose(); } catch {} return; }
      ctrl.canvas.style.pointerEvents = 'none';
      // Swap in the new controller, THEN drop the old one (mountSlice3D clears the
      // container first, so this is a clean handover on the same persistent div).
      _live = { ctrl };
      try { window.__map3d = ctrl; } catch {}
      if (prev && prev.ctrl && prev.ctrl !== ctrl) { try { prev.ctrl.dispose(); } catch {} }
    } catch {
      if (prev) _live = prev; // refresh failed → keep the last-good scene, still lit
    }
  })();
}

// On combat-start, auto zoom into the player's node so the embedded tactical board
// is framed — you drop straight into the fight (zoom out still shows it in the
// overworld). Fires once per fight (guarded by _combatFramed) so it never fights a
// manual zoom on subsequent turns of the same fight.
let _combatFramed = false;
function autoZoomForCombat(world, twoD) {
  const inCombat = !!(world && world.combat && world.combat.active);
  if (!inCombat) { _combatFramed = false; return; }
  if (_combatFramed || !MAP_3D_ENABLED) return;
  _combatFramed = true;
  const sc = sceneFromWorld(world);
  const pcx = (Number(sc.player.x) || 0) * NODE_WU, pcy = (Number(sc.player.y) || 0) * NODE_WU;
  // Frame the fight deep enough to be well past the tilt `full` — the board reads
  // as minis on the tilted table. COMBAT_ZOOM is in the plan band's own scale.
  const COMBAT_ZOOM = Math.max(TILT_DEFAULTS.full, BAND.plan * 1.6);
  setTimeout(() => { if (twoD && twoD.__oneMapFocus) twoD.__oneMapFocus(pcx, pcy, COMBAT_ZOOM); }, 80);
}
