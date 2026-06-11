// Diablo-style health and stress globe orbs for the play HUD.
// Returns a row element meant to flank the text input at the bottom of play.
// Left orb = health (red), right orb = stress (indigo).
// Canvas-based so the liquid fill looks like a globe, not a progress bar.

const ORB_SIZE = 52; // canvas px, scales via CSS

function maxWoundsFor(pc) {
  const level = Math.max(1, Math.trunc(Number(pc.level) || 1));
  const grit = Math.max(1, Math.min(20, Number(pc.stats?.GRIT) || 10));
  const gritMod = Math.floor((grit - 10) / 2);
  return Math.max(1, 3 + Math.floor(level / 4) + gritMod);
}

function drawOrb(canvas, fillFraction, midColor, darkColor) {
  const S = ORB_SIZE;
  const ctx = canvas.getContext('2d');
  const cx = S / 2, cy = S / 2, r = S / 2 - 1.5;

  ctx.clearRect(0, 0, S, S);

  // Dark glass base
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#090806';
  ctx.fill();

  // Liquid fill — clip to circle, fill from bottom
  const fill = Math.max(0, Math.min(1, fillFraction));
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const top = S * (1 - fill);
    const grad = ctx.createLinearGradient(0, top, 0, S);
    grad.addColorStop(0, midColor);
    grad.addColorStop(1, darkColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, S, S - top);

    // Ripple shimmer at the liquid surface
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(cx - r * 0.6, top - 1, r * 1.2, 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Radial glass highlight (top-left glint)
  const hi = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.4, 0, cx, cy, r);
  hi.addColorStop(0, 'rgba(255,255,255,0.20)');
  hi.addColorStop(0.45, 'rgba(255,255,255,0.04)');
  hi.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = hi;
  ctx.fill();

  // Gold border ring
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(200,168,78,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function makeOrb(fillFraction, midColor, darkColor, labelTop, labelBot) {
  const wrap = document.createElement('div');
  wrap.className = 'diablo-orb';

  const canvas = document.createElement('canvas');
  canvas.width = ORB_SIZE;
  canvas.height = ORB_SIZE;
  canvas.style.cssText = `width:${ORB_SIZE}px;height:${ORB_SIZE}px;display:block;`;
  drawOrb(canvas, fillFraction, midColor, darkColor);
  wrap.appendChild(canvas);

  const lbl = document.createElement('div');
  lbl.className = 'diablo-orb-label';
  lbl.textContent = labelTop;
  wrap.appendChild(lbl);

  if (labelBot) {
    const sub = document.createElement('div');
    sub.className = 'diablo-orb-sub';
    sub.textContent = labelBot;
    wrap.appendChild(sub);
  }

  return wrap;
}

export function renderDiabloOrbs(world) {
  const pc = world?.party?.[0];
  if (!pc) return null;

  const isEscape = world?.meta?.mode === 'escape';

  let healthFill, healthTop, healthSub;
  if (isEscape) {
    const cur = Math.max(0, Number(world.meta.escapeHp) || 0);
    const max = Math.max(1, Number(world.meta.escapeMaxHp) || 1);
    healthFill = cur / max;
    healthTop = 'HP';
    healthSub = `${cur}/${max}`;
  } else {
    const woundCap = maxWoundsFor(pc);
    const wounds = Math.max(0, Math.min(woundCap, Number(pc.wounds) || 0));
    healthFill = (woundCap - wounds) / woundCap;
    healthTop = 'HLTH';
    healthSub = `${woundCap - wounds}/${woundCap}`;
  }

  const stress = Math.max(0, Math.min(6, Number(pc.stress) || 0));
  const stressFill = stress / 6;

  const row = document.createElement('div');
  row.className = 'diablo-orbs-row';

  row.appendChild(makeOrb(healthFill, '#c03020', '#7a1408', healthTop, healthSub));
  row.appendChild(makeOrb(stressFill, '#7030a0', '#3a0a60', 'STR', `${stress}/6`));

  return row;
}
