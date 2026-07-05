// Shared test helper — a MINIMAL DOM/canvas stub, enough to mount the continuous
// map (public/map/continuousMap.js → renderOneMap) in plain node with no jsdom and
// no WebGL. The repo has neither jsdom installed nor a bundled `three` (three is a
// CDN importmap dependency), so the 3D dynamic import inside renderContinuousMap
// fails gracefully — exactly the no-WebGL fallback the production code guards for.
// That lets a test assert the 2D subtree's DOM-node IDENTITY across a simulated
// v1-render cycle (the MAP-3DR persistent-mount contract) without a browser.
//
// This is a pure test fixture — it touches no engine/world state.

class ClassList {
  constructor() { this._s = new Set(); }
  add(...c) { c.forEach(x => this._s.add(x)); }
  remove(...c) { c.forEach(x => this._s.delete(x)); }
  contains(c) { return this._s.has(c); }
}

// A canvas 2D context that answers every draw call as a no-op and returns a valid
// object for the handful of factory calls renderOneMap makes (gradients, pattern,
// image data). A Proxy backstops any method we didn't name.
function makeCtx2d() {
  const grad = { addColorStop() {} };
  const base = {
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    createPattern: () => ({}),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)) }),
    putImageData: () => {},
    measureText: () => ({ width: 10 }),
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, font: '',
    textAlign: '', textBaseline: '', lineCap: '', lineJoin: '', miterLimit: 1,
  };
  return new Proxy(base, {
    get(t, p) { return (p in t) ? t[p] : () => {}; },
    set(t, p, v) { t[p] = v; return true; },
  });
}

let nodeSeq = 0;
class El {
  constructor(tag) {
    this.tag = String(tag || 'div');
    this.tagName = this.tag.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.classList = new ClassList();
    this._className = '';
    this._id = 'n' + (++nodeSeq);
    this.clientWidth = 700; this.clientHeight = 480;
    this.width = 700; this.height = 480;
    if (this.tag === 'canvas') this._ctx = makeCtx2d();
  }
  set className(v) { this._className = v; }
  get className() { return this._className; }
  get firstChild() { return this.children[0] || null; }
  appendChild(c) {
    if (c && c.parentNode) c.parentNode.removeChild(c);
    if (c) { c.parentNode = this; this.children.push(c); }
    return c;
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; }
    return c;
  }
  setAttribute(k, v) { this['_attr_' + k] = v; }
  getContext() { return this._ctx; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  addEventListener() {}
  removeEventListener() {}
  setPointerCapture() {}
  releasePointerCapture() {}
  contains(n) { return n === this || this.children.some(c => c.contains && c.contains(n)); }
  querySelector() { return null; }
}

// Find the first <canvas> anywhere in a subtree (the 2D map canvas).
export function findCanvas(node) {
  if (!node) return null;
  if (node.tag === 'canvas') return node;
  for (const c of (node.children || [])) { const r = findCanvas(c); if (r) return r; }
  return null;
}

// Install the stub onto globalThis. Returns { doc, root, El } and a teardown.
export function installDom() {
  const root = new El('body');
  const doc = {
    createElement: (t) => new El(t),
    createTextNode: (s) => ({ nodeType: 3, textContent: String(s) }),
    body: root,
    documentElement: new El('html'),
    contains: (n) => root.contains(n),
    querySelector: () => null,
  };
  const saved = {
    document: globalThis.document, window: globalThis.window,
    devicePixelRatio: globalThis.devicePixelRatio,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    ResizeObserver: globalThis.ResizeObserver,
    localStorage: globalThis.localStorage,
  };
  globalThis.document = doc;
  globalThis.window = globalThis;
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = () => 0;  // never actually loop in tests
  globalThis.cancelAnimationFrame = () => {};
  globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const teardown = () => {
    Object.assign(globalThis, saved);
    for (const k of Object.keys(saved)) if (saved[k] === undefined) { try { delete globalThis[k]; } catch {} }
  };
  return { doc, root, El, teardown };
}
