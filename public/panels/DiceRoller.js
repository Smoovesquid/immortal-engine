// Animated d20 roll overlay — fires when the engine resolves a check.
// Shows a tumbling die, cycles through faces, lands on the result.
// Procedural Web Audio dice clatter — no audio files needed.
//
// Usage: triggerDiceRoll(roll, dc, outcome, rawDie?)
// outcome: 'success' | 'failure' | 'partial'

const ANIM_MS   = 1800; // total animation duration
const SETTLE_MS = 900;  // when cycling stops and result lands
const HOLD_MS   = 600;  // how long the result is held before fade

// ── Sound ────────────────────────────────────────────────────────────────────

let _audioCtx = null;

function getAudioCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { _audioCtx = null; }
  }
  return _audioCtx;
}

function playClatter() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  // 5 taps at decreasing intervals — like a die bouncing to a stop.
  const taps = [0, 0.06, 0.11, 0.15, 0.18];
  taps.forEach((t, i) => {
    try {
      const dur = 0.025;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        // Decaying white noise — wood-on-hard-surface character.
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.006));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 900 + i * 120;
      bandpass.Q.value = 0.7;

      const gain = ctx.createGain();
      // First tap loudest; each subsequent bounce quieter.
      gain.gain.value = 0.55 * Math.pow(0.72, i);

      src.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime + t);
    } catch { /* AudioContext unavailable in test env */ }
  });
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

const SZ = 128; // canvas size

// Draw a d20-style pentagonal face with number inside.
function drawD20(ctx, num, alpha, glowColor) {
  const cx = SZ / 2, cy = SZ / 2;
  const r = SZ * 0.42;

  ctx.clearRect(0, 0, SZ, SZ);
  ctx.globalAlpha = alpha;

  // Outer glow when settled.
  if (glowColor) {
    const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.1);
    g.addColorStop(0, glowColor.replace('1)', '0.35)'));
    g.addColorStop(1, glowColor.replace('1)', '0)'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pentagon face (5 sides, rotated so a point faces up — d20 look).
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();

  // Dark fill with slight gradient.
  const fill = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  fill.addColorStop(0, '#1a1610');
  fill.addColorStop(1, '#0d0b08');
  ctx.fillStyle = fill;
  ctx.fill();

  // Gold border.
  ctx.strokeStyle = 'rgba(200,168,78,0.85)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Interior facet lines (3 lines from centroid to alternate vertices —
  // gives the icosahedron face hint without complexity).
  ctx.globalAlpha = alpha * 0.25;
  ctx.strokeStyle = 'rgba(200,168,78,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 2) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;

  // Number.
  const numStr = String(num);
  const isNat = num === 20 || num === 1;
  ctx.fillStyle = glowColor
    ? (num === 1 ? '#ff5533' : '#f5e060')
    : (isNat ? '#c8a84e' : '#e8dcc8');
  ctx.font = `bold ${numStr.length > 1 ? 36 : 42}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Slight emboss shadow.
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText(numStr, cx, cy + 3);
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 1;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fire the dice roll overlay.
 * @param {number} roll  - final roll total (shown as the landed result)
 * @param {number} dc    - DC the roll was checked against
 * @param {string} outcome - 'success' | 'failure' | 'partial' | 'critical'
 * @param {number} [dieVal] - raw d20 value (1-20) if known; defaults to clamped roll
 */
export function triggerDiceRoll(roll, dc, outcome, dieVal) {
  // Don't stack multiple overlays.
  document.querySelectorAll('.dice-roller-overlay').forEach(el => el.remove());

  playClatter();

  const rawFace = dieVal != null
    ? Math.max(1, Math.min(20, dieVal))
    : Math.max(1, Math.min(20, roll));

  const isNat20 = rawFace === 20;
  const isNat1  = rawFace === 1;
  const glowColor = isNat20
    ? 'rgba(255,215,60,1)'
    : (outcome === 'success' || outcome === 'critical')
      ? 'rgba(80,200,120,1)'
      : outcome === 'partial'
        ? 'rgba(220,160,40,1)'
        : 'rgba(200,60,60,1)';

  const resultLabel = isNat20
    ? 'NATURAL 20!'
    : isNat1
      ? 'NAT 1'
      : outcome === 'success'   ? 'SUCCESS'
      : outcome === 'critical'  ? 'CRITICAL'
      : outcome === 'partial'   ? 'PARTIAL'
      : 'FAILURE';

  const resultColor = (isNat20 || outcome === 'success' || outcome === 'critical')
    ? '#7be895'
    : outcome === 'partial'
      ? '#d4a830'
      : '#e86050';

  // ── Build overlay DOM ───────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'dice-roller-overlay';

  const canvas = document.createElement('canvas');
  canvas.width = SZ; canvas.height = SZ;
  canvas.className = 'dice-roller-canvas';

  const resultDiv = document.createElement('div');
  resultDiv.className = 'dice-roller-result';
  resultDiv.style.cssText = `color:${resultColor};opacity:0;transition:opacity 0.2s;`;

  const vsSpan = document.createElement('span');
  vsSpan.className = 'dice-roller-vs';
  vsSpan.textContent = `${roll} vs DC ${dc}`;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'dice-roller-label';
  labelSpan.textContent = resultLabel;
  if (isNat20) labelSpan.style.cssText = 'color:#ffd83c;text-shadow:0 0 12px rgba(255,215,60,0.8)';

  resultDiv.appendChild(vsSpan);
  resultDiv.appendChild(labelSpan);
  overlay.appendChild(canvas);
  overlay.appendChild(resultDiv);

  // Append to .play-panel or body.
  const target = document.querySelector('.play-panel') || document.body;
  target.style.position = target.style.position || 'relative';
  target.appendChild(overlay);

  // ── Animate ─────────────────────────────────────────────────────────────────
  const ctx2d = canvas.getContext('2d');
  const start = performance.now();
  let settled = false;

  function frame(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / ANIM_MS, 1);

    if (elapsed < SETTLE_MS) {
      // Cycling phase: show random faces, bounce scale.
      const t = elapsed / SETTLE_MS;
      // Ease-in cycling speed: fast at first, slow near settle.
      const cycleInterval = 40 + t * t * 280; // 40ms → 320ms between face changes
      const face = (Math.floor(elapsed / cycleInterval) % 20) + 1;

      // Scale: starts small (fly in), overshoots slightly, settles at 1.
      const scale = t < 0.5
        ? t * 2.2             // grow fast
        : 1.1 - (t - 0.5) * 0.2; // slight overshoot back to ~1

      ctx2d.save();
      ctx2d.translate(SZ / 2, SZ / 2);
      ctx2d.scale(scale, scale);
      ctx2d.translate(-SZ / 2, -SZ / 2);
      drawD20(ctx2d, face, 0.85 + t * 0.15, null);
      ctx2d.restore();

    } else if (!settled) {
      // Land: draw final face with glow.
      settled = true;
      drawD20(ctx2d, rawFace, 1, glowColor);
      resultDiv.style.opacity = '1';

      // Nat 20: brief canvas flash.
      if (isNat20) {
        ctx2d.globalAlpha = 0.6;
        const burst = ctx2d.createRadialGradient(SZ/2, SZ/2, 0, SZ/2, SZ/2, SZ*0.7);
        burst.addColorStop(0, 'rgba(255,230,80,0.7)');
        burst.addColorStop(1, 'rgba(255,230,80,0)');
        ctx2d.fillStyle = burst;
        ctx2d.fillRect(0, 0, SZ, SZ);
        ctx2d.globalAlpha = 1;
      }

    } else if (elapsed > SETTLE_MS + HOLD_MS) {
      // Fade out.
      const fadeT = (elapsed - SETTLE_MS - HOLD_MS) / (ANIM_MS - SETTLE_MS - HOLD_MS);
      const alpha = Math.max(0, 1 - fadeT * 1.4);
      overlay.style.opacity = String(alpha);
      if (alpha <= 0) {
        overlay.remove();
        return; // stop the loop
      }
    }

    if (progress < 1 || elapsed < SETTLE_MS + HOLD_MS + 500) {
      requestAnimationFrame(frame);
    } else {
      overlay.remove();
    }
  }

  requestAnimationFrame(frame);
}

// ── Parse a mech string and fire ─────────────────────────────────────────────

const ROLL_RE  = /\[roll:(\d+)\s+vs\s+DC:(\d+)\s*→\s*(\w+)/i;
const NAT_RE   = /\bnat:(\d+)\b/i;

export function triggerFromMech(mechStr) {
  if (!mechStr) return;
  const m = ROLL_RE.exec(mechStr);
  if (!m) return;
  const roll    = Number(m[1]);
  const dc      = Number(m[2]);
  const outcome = m[3].toLowerCase(); // success / failure / partial / critical
  const natM    = NAT_RE.exec(mechStr);
  const dieVal  = natM ? Number(natM[1]) : null;
  triggerDiceRoll(roll, dc, outcome, dieVal);
}
