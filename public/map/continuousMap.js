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

const smoothstep = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

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
  const token = _token;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:100%;';

  // The 2D map: the single input surface and the fallback. Its onCamera hook
  // streams the live camera to the 3D overlay.
  let lastCam = null;
  let mounting = false;
  const twoD = renderOneMap(world, {
    playerPos: opts.playerPos,
    height: opts.height,
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
    const b = smoothstep(Z_3D_START, Z_3D_CROSS, cam.z);
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

  return wrap;
}
