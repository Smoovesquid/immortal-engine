// CONTINUOUS MAP — one semantic-zoom surface, 2D ⟷ 3D, no toggle (ONE_MAP.md).
//
// The Map is a single continuous-zoom camera. Far out it is the 2D graph-paper
// regional plan (the real input surface + the no-WebGL fallback). As you zoom
// IN past a threshold the plane TILTS and the ink map cross-fades into the live
// 3D overworld diorama; zoom back out and it reverses — smoothly, no snap. Zoom
// level alone drives the representation; there is no 2D|3D button.
//
// HOW IT STAYS SEAMLESS (the trick): the 3D layer is a PASSIVE overlay stacked
// on the 2D canvas (pointer-events:none — all input still goes to the 2D map).
// On every 2D camera change we mirror it into the 3D camera, choosing the 3D
// DISTANCE that makes one node-tile cover the same screen pixels as the 2D map
// (render3d.setCamera's pxPerTile). So at the crossover both views share scale,
// center and north-up orientation — only the TILT diverges as you push deeper.
// The cross-fade then reads as the flat map coming to life, not two scenes cut
// together.
//
// PURE VIEW: sceneFromWorld is a read of engine-owned positions; nothing here
// writes world state or touches determinism. Three.js is lazy-loaded only when
// the zoom first crosses into 3D; if WebGL is unavailable the map simply stays
// 2D at every zoom level, fully usable.

import { renderOneMap } from './oneMap.js';
import { sceneFromWorld } from './sliceScene.js';
import { NODE_WU } from './worldSpace.js';

// Zoom thresholds (in the 2D camera's z = px per world-unit; NODE_WU wu ≈ 1 km).
// Tuned so the morph begins while a neighbouring place is still in frame (the
// reveal lifts the region's ink into 3D, not a single building) and the 2D plan
// keeps a comfortable zoom range (Z_MIN 0.008 → 0.22) for reading the map flat.
const Z_3D_START = 0.22;   // below this: pure 2D plan, 3D not even mounted.
const Z_3D_CROSS = 0.50;   // by this: 3D fully opaque (2D faded out beneath).
const Z_3D_TILT  = 2.5;    // tilt fully developed (top-down → oblique) by here.
const PHI_TOP = 0.06;      // near straight-down — matches the flat 2D plan.
const PHI_OBL = 1.0;       // oblique "diorama" tilt at deep zoom.
const COMBAT_ZOOM = 2.6;   // auto zoom-in level on combat-start (frames the tactical board at the node).

const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ── 3D DISCONNECT SWITCH ────────────────────────────────────────────────────
// 2026-07-03 (Tim's call): the 3D diorama is DISCONNECTED until it can be made
// truthful. v1 rebuilds the whole DOM on every typed turn and remounts this
// map each time: the 2D ink plan drew first — at a zoom far past its legible
// band — and the async 3D scene then popped in over it, so every sentence
// flashed two unrelated-looking pictures. Until the morph is rebuilt on a
// persistent mount, the map stays the 2D plan at every zoom (this file's own
// no-WebGL path — fully usable, marker and combat included). Flip to true to
// reconnect the morph; the map track in docs/PACKETS.md carries the
// reconnection packet.
export const MAP_3D_ENABLED = false;

// One live 3D layer at a time (module-level, mirroring v1's full-rebuild render
// model). disposeContinuousMap3d() is the teardown v1 calls when leaving the Map.
let _live = null;     // { ctrl } — the mounted 3D controller, or null.
let _token = 0;       // guards async mounts against staleness across re-renders.
let _failed = false;  // WebGL/import failed once → stay 2D for the session.

export function disposeContinuousMap3d() {
  if (_live && _live.ctrl) { try { _live.ctrl.dispose(); } catch {} }
  _live = null; _token++;
  try { delete window.__map3d; } catch {}
}

export function renderContinuousMap(world, opts = {}) {
  // Fresh layers each render() (v1 rebuilds the DOM); drop any prior 3D context.
  disposeContinuousMap3d();

  // Combat is NOT a separate surface — it's this one map at its deepest, tactical zoom.
  // The fight is embedded IN the overworld 3D scene at the player's node (sliceScene
  // carries world.combat → mountSlice3D builds the 5-ft board there); on combat-start we
  // auto-zoom into that node so you drop straight into the fight, and zoom-out reveals it
  // in the overworld. One scene, continuous — no swap.
  const inCombat = !!(world && world.combat && world.combat.active);

  const token = _token;

  // Fill mode (opts.heightCss, e.g. '100%'): the map sizes to its container so the
  // in-play embed can take ~60% of the viewport. Otherwise it keeps its own height
  // (the standalone Map screen). The wrap must be height:100% in fill mode so the
  // 3D overlay (inset:0) covers the same box as the 2D plan.
  const fillMode = typeof opts.heightCss === 'string' && opts.heightCss;
  const wrap = document.createElement('div');
  wrap.style.cssText = fillMode
    ? 'position:relative;width:100%;height:100%;'
    : 'position:relative;width:100%;';

  // The 2D map: the single input surface and the fallback. Its onCamera hook
  // streams the live camera to the 3D overlay.
  let lastCam = null;
  let mounting = false;
  const twoD = renderOneMap(world, {
    playerPos: opts.playerPos,
    height: opts.height,
    heightCss: opts.heightCss,
    initialZoom: opts.initialZoom,
    onCamera: (cam) => onCamera(cam),
  });
  twoD.style.zIndex = '1';

  // The 3D overlay: empty + transparent until the zoom crosses into 3D.
  const layer3d = document.createElement('div');
  layer3d.className = 'map3d-overlay';
  layer3d.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;z-index:2;border-radius:6px;overflow:hidden;transition:opacity .12s linear;';

  wrap.appendChild(twoD);
  wrap.appendChild(layer3d);

  function ensureMounted() {
    if (_failed || _live || mounting) return;
    mounting = true;
    (async () => {
      try {
        const scene = sceneFromWorld(world); // PURE read of engine positions.
        const { mountSlice3D } = await import('./render3d.js');
        if (token !== _token || !document.contains(layer3d)) { mounting = false; return; }
        const ctrl = await mountSlice3D(layer3d, scene, { controls: false });
        if (token !== _token || !document.contains(layer3d)) { try { ctrl.dispose(); } catch {} mounting = false; return; }
        ctrl.canvas.style.pointerEvents = 'none'; // passive overlay
        _live = { ctrl };
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
    const tiltT = smoothstep(Z_3D_START, Z_3D_TILT, cam.z);
    const phi = PHI_TOP + (PHI_OBL - PHI_TOP) * tiltT;
    _live.ctrl.setCamera({
      phi, az: 0, // north-up, matching the 2D plan
      target: { tx: cam.cx / NODE_WU, ty: cam.cy / NODE_WU },
      pxPerTile: NODE_WU * cam.z, // lock 3D scale to the 2D map's scale
    });
  }

  function onCamera(cam) {
    if (token !== _token) return;
    lastCam = cam;
    // MAP_3D_ENABLED=false pins the blend at 0: the 3D layer is never even
    // lazy-mounted and the map is the 2D plan at every zoom.
    const b = MAP_3D_ENABLED ? smoothstep(Z_3D_START, Z_3D_CROSS, cam.z) : 0;
    if (b <= 0.001) {            // pure 2D — hide & idle the diorama
      layer3d.style.opacity = '0';
      if (_live) _live.ctrl.pause();
      return;
    }
    ensureMounted();
    if (!_live) { layer3d.style.opacity = '0'; return; } // still mounting / failed
    _live.ctrl.resume();
    applyFromCam(cam);
    layer3d.style.opacity = String(b);
  }

  // Verification / deep-link hook: drive the unified zoom to a world point.
  wrap.__continuousFocus = (cx, cy, z) => { if (twoD.__oneMapFocus) twoD.__oneMapFocus(cx, cy, z); };

  // On combat-start, auto zoom into the player's node so the embedded tactical board is
  // framed — you drop straight into the fight (zoom out still shows it in the overworld).
  if (inCombat && MAP_3D_ENABLED) {
    // The tactical auto zoom-in only makes sense when the 3D board can mount;
    // in 2D-only mode COMBAT_ZOOM (2.6) would push the ink plan far past its
    // legible band. The 2D plan keeps its normal framing during a fight.
    const sc = sceneFromWorld(world);
    const pcx = (Number(sc.player.x) || 0) * NODE_WU, pcy = (Number(sc.player.y) || 0) * NODE_WU;
    setTimeout(() => { if (token === _token && twoD.__oneMapFocus) twoD.__oneMapFocus(pcx, pcy, COMBAT_ZOOM); }, 80);
  }

  return wrap;
}
