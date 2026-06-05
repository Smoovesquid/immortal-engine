/**
 * Creature icons — top-down hand-drawn silhouettes for the map, one read for
 * every creature in the bestiary without drawing 750 by hand.
 *
 * iconKindFor(entry) classifies a bestiary entry into an archetype (quadruped,
 * serpent, arachnid, ooze, …) from its tags + name/ref keywords + traits, and
 * derives feature modifiers (winged, horned, large) and a tag-themed ink color.
 * drawCreatureIcon() renders the silhouette in the grubby graph-paper ink style.
 *
 * Combinatorial, not bespoke: archetype × features × seeded wobble gives each
 * creature a correct, distinct token. Signature creatures can be hand-tuned later.
 *
 * DETERMINISTIC: wobble from a keyed FNV hash of the seed (creature ref), never
 * Math.random. No engine imports — pure browser module.
 */

const TAG_COLOR = {
  beast: '#6b4a2b', humanoid: '#5a4a3a', undead: '#8a8a78', construct: '#5a5a66',
  elemental: '#b5662e', aberration: '#5a3a6e', plant: '#3a6b3a', fey: '#7a5a8e',
  monstrosity: '#5a3a2b', fiend: '#7a2b2b', giant: '#5a4a3a', ooze: '#4a7a5a',
  dragon: '#6b2b2b', spirit: '#6a7a8a', parasite: '#6b5a2b', swarm: '#5a4a2b'
};
const INK = 'rgba(20,26,44,0.9)';

const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function has(text, ...words) { const t = String(text || '').toLowerCase(); return words.some(w => t.includes(w)); }

// iconKindFor(entry) -> { kind, color, large, winged, horned }
export function iconKindFor(entry) {
  const e = entry || {};
  const tags = Array.isArray(e.tags) ? e.tags.map(t => String(t).toLowerCase()) : [];
  const tag0 = tags[0] || 'beast';
  const id = `${e.ref || ''} ${e.name || ''}`.toLowerCase();
  const traits = (Array.isArray(e.traits) ? e.traits.join(' ') : '').toLowerCase();
  const social = String(e.socialStructure || '').toLowerCase();

  let kind = null;
  // Keyword overrides win — a "giant spider" should read as a spider, not a beast.
  if (has(id, 'spider', 'arachnid', 'scorpion', 'web')) kind = 'arachnid';
  else if (has(id, 'serpent', 'snake', 'wyrm', 'viper', 'naga', 'eel', 'python', 'cobra', 'basilisk')) kind = 'serpent';
  else if (has(id, 'dragon', 'drake', 'wyvern')) kind = 'dragon';
  else if (has(id, 'worm', 'grub', 'centipede', 'leech', 'maggot', 'slug')) kind = 'parasite';
  else if (has(id, 'spider')) kind = 'arachnid';
  else if (has(id, 'bat', 'raven', 'crow', 'hawk', 'eagle', 'moth', 'bird', 'harpy', 'wisp', 'roc', 'griffon', 'gryphon', 'pegasus', 'phoenix') && !has(id, 'dire')) kind = 'flyer';
  else if (has(id, 'bear', 'owlbear', 'ursine')) kind = 'ursine';
  else if (has(id, 'wolf', 'hound', 'cat', 'lion', 'panther', 'tiger', 'jackal', 'fox', 'boar', 'stag', 'lizard', 'rat') && tags.includes('beast')) kind = 'predator';
  else if (has(id, 'golem', 'automaton', 'sentinel', 'guardian') && tags.includes('construct')) kind = 'construct';
  else if (has(id, 'eye', 'beholder', 'horror', 'thing', 'mind', 'tentacle')) kind = 'aberration';
  else if ((tags.includes('swarm') || has(social, 'swarm')) && !has(id, 'spider')) kind = 'swarm';

  // Fall back to the primary tag.
  if (!kind) {
    kind = ({
      beast: 'quadruped', humanoid: 'biped', undead: 'undead', construct: 'construct',
      elemental: 'elemental', aberration: 'aberration', plant: 'plant', fey: 'biped',
      monstrosity: 'quadruped', fiend: 'fiend', giant: 'brute', ooze: 'ooze',
      dragon: 'dragon', spirit: 'wraith', parasite: 'parasite', swarm: 'swarm'
    })[tag0] || 'quadruped';
  }

  const tier = String(e.tier || '').toLowerCase();
  const large = tier === 'elite' || tags.includes('giant') || tags.includes('dragon') || Number(e.cr || 0) >= 8 || has(id, 'giant', 'great', 'elder', 'ancient', 'colossal');
  const winged = has(id, 'wing', 'fly', 'bat', 'bird', 'moth', 'drake', 'dragon', 'harpy', 'wyvern') || has(traits, 'flyby', 'flight', 'winged') || kind === 'flyer' || kind === 'dragon';
  const horned = tags.includes('fiend') || has(id, 'horn', 'demon', 'minotaur', 'devil', 'imp', 'baphomet');
  const color = TAG_COLOR[tag0] || '#5a4a3a';

  return { kind, color, large, winged, horned };
}

// ── drawing ──────────────────────────────────────────────────────────────────
export function drawCreatureIcon(ctx, cx, cy, r0, opts = {}) {
  const kind = opts.kind || 'quadruped';
  const color = opts.color || '#5a4a3a';
  const seed = String(opts.seed || kind);
  const r = r0 * (opts.large ? 1.12 : 1);
  const jit = (k, a) => (((h32(seed + '|' + k) % 1000) / 500) - 1) * a;
  const w = r * 0.16; // base stroke

  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = color; ctx.strokeStyle = INK;

  const blob = (x, y, rx, ry, k) => { ctx.beginPath(); const n = 14; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; const px = x + Math.cos(a) * rx + jit(k + i + 'x', rx * 0.12), py = y + Math.sin(a) * ry + jit(k + i + 'y', ry * 0.12); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); };
  const leg = (x1, y1, x2, y2) => { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 + jit(x2 + 'lx', r * 0.06), y2 + jit(y2 + 'ly', r * 0.06)); ctx.stroke(); };
  const dot = (x, y, rr) => { ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); };

  function wings() { ctx.fillStyle = color; ctx.globalAlpha = 0.7; [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(0, -r * 0.1); ctx.quadraticCurveTo(s * r * 1.05, -r * 0.7, s * r * 0.95, r * 0.15); ctx.quadraticCurveTo(s * r * 0.5, r * 0.05, 0, r * 0.1); ctx.closePath(); ctx.fill(); }); ctx.globalAlpha = 1; }
  function horns() { ctx.strokeStyle = INK; ctx.lineWidth = w * 0.9; [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(s * r * 0.18, -r * 0.5); ctx.quadraticCurveTo(s * r * 0.5, -r * 0.85, s * r * 0.34, -r * 0.95); ctx.stroke(); }); }

  switch (kind) {
    case 'quadruped': case 'predator': case 'ursine': case 'monstrosity': {
      const bulky = kind === 'ursine', lean = kind === 'predator';
      const bx = bulky ? r * 0.62 : lean ? r * 0.5 : r * 0.56, by = bulky ? r * 0.5 : r * 0.4;
      leg(-bx * 0.6, by * 0.7, -bx * 0.9, by * 1.25); leg(bx * 0.6, by * 0.7, bx * 0.9, by * 1.25);
      leg(-bx * 0.6, -by * 0.5, -bx * 0.9, -by * 1.05); leg(bx * 0.6, -by * 0.5, bx * 0.9, -by * 1.05);
      blob(0, 0, bx, by, 'body');
      blob(0, -by * 1.1, bx * 0.42, by * 0.5, 'head'); // head forward (north)
      if (lean) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(0, by * 0.9); ctx.lineTo(jit('tx', r * 0.2), by * 1.5); ctx.stroke(); }
      break;
    }
    case 'biped': case 'brute': case 'fiend': case 'undead': {
      const big = kind === 'brute';
      const sh = big ? r * 0.62 : r * 0.5;
      blob(0, r * 0.05, sh, r * 0.3, 'sh'); // shoulders
      leg(-sh * 0.7, r * 0.2, -sh * 1.05, r * 0.55); leg(sh * 0.7, r * 0.2, sh * 1.05, r * 0.55); // arms
      blob(0, -r * 0.45, r * 0.3, r * 0.32, 'head');
      if (kind === 'undead') { ctx.fillStyle = '#2a2a26'; dot(-r * 0.1, -r * 0.45, r * 0.06); dot(r * 0.1, -r * 0.45, r * 0.06); ctx.fillStyle = color; }
      if (kind === 'fiend' || opts.horned) horns();
      break;
    }
    case 'serpent': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.34; ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.6);
      ctx.quadraticCurveTo(r * 0.7, r * 0.3, -r * 0.4, -r * 0.2);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.6, r * 0.2, -r * 0.7);
      ctx.stroke();
      ctx.fillStyle = color; blob(r * 0.2, -r * 0.7, r * 0.24, r * 0.2, 'head');
      break;
    }
    case 'arachnid': {
      [-1, 1].forEach(s => { for (let i = 0; i < 4; i++) { const ay = -r * 0.5 + i * r * 0.33; const bend = (i % 2 ? 0.5 : 0.9); leg(s * r * 0.18, ay, s * r * (0.7 + bend * 0.4), ay - r * 0.1 + jit('al' + s + i, r * 0.12)); } });
      blob(0, r * 0.18, r * 0.32, r * 0.36, 'abd'); // abdomen
      blob(0, -r * 0.3, r * 0.22, r * 0.2, 'ceph');
      break;
    }
    case 'swarm': {
      const n = 7; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = r * (0.4 + (h32(seed + i) % 100) / 250); dot(Math.cos(a) * rr + jit('s' + i + 'x', r * 0.1), Math.sin(a) * rr + jit('s' + i + 'y', r * 0.1), r * 0.15); }
      dot(0, 0, r * 0.16);
      break;
    }
    case 'ooze': {
      blob(0, 0, r * 0.72, r * 0.66, 'ooze');
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; dot(-r * 0.18, -r * 0.18, r * 0.14);
      break;
    }
    case 'flyer': {
      wings();
      ctx.fillStyle = color; blob(0, 0, r * 0.22, r * 0.42, 'body');
      blob(0, -r * 0.4, r * 0.16, r * 0.16, 'head');
      break;
    }
    case 'dragon': {
      wings();
      ctx.fillStyle = color; blob(0, r * 0.05, r * 0.3, r * 0.5, 'body');
      blob(0, -r * 0.5, r * 0.22, r * 0.24, 'head');
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(0, r * 0.5); ctx.quadraticCurveTo(r * 0.4, r * 0.8, r * 0.2, r * 1.05); ctx.stroke();
      break;
    }
    case 'construct': {
      ctx.lineWidth = w; ctx.beginPath(); ctx.rect(-r * 0.42, -r * 0.32, r * 0.84, r * 0.7); ctx.fill(); ctx.stroke();
      ctx.fillRect(-r * 0.5, r * 0.36, r * 0.3, r * 0.4); ctx.fillRect(r * 0.2, r * 0.36, r * 0.3, r * 0.4);
      ctx.fillStyle = '#caa'; dot(-r * 0.12, -r * 0.05, r * 0.07); dot(r * 0.12, -r * 0.05, r * 0.07);
      break;
    }
    case 'elemental': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.16; for (let i = 0; i < 3; i++) { ctx.beginPath(); const a0 = i / 3 * Math.PI * 2; for (let t = 0; t <= 1; t += 0.12) { const ang = a0 + t * Math.PI * 1.4, rr = r * (0.2 + t * 0.6); const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr; t ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke(); }
      ctx.fillStyle = color; dot(0, 0, r * 0.2);
      break;
    }
    case 'aberration': {
      const n = 5; ctx.strokeStyle = color; ctx.lineWidth = r * 0.13; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + jit('t' + i, 0.3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, Math.cos(a) * r * 0.95 + jit('te' + i, r * 0.2), Math.sin(a) * r * 0.95 + jit('tf' + i, r * 0.2)); ctx.stroke(); }
      ctx.fillStyle = color; blob(0, 0, r * 0.34, r * 0.34, 'core');
      ctx.fillStyle = '#e8e2d0'; dot(0, 0, r * 0.16); ctx.fillStyle = '#2a2a26'; dot(jit('p', r * 0.05), jit('q', r * 0.05), r * 0.07);
      break;
    }
    case 'parasite': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.26; ctx.beginPath(); ctx.moveTo(-r * 0.5, r * 0.4); ctx.quadraticCurveTo(r * 0.3, r * 0.1, -r * 0.2, -r * 0.5); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = w * 0.7; for (let i = 0; i < 5; i++) { const t = i / 4; const x = -r * 0.5 + (r * 0.3 - (-r * 0.5)) * t, y = r * 0.4 + (-r * 0.5 - r * 0.4) * t; leg(x, y, x + (i % 2 ? r * 0.2 : -r * 0.2), y); }
      break;
    }
    case 'plant': {
      ctx.strokeStyle = color; ctx.lineWidth = r * 0.14; const n = 6; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - n / 2) * 0.4; ctx.beginPath(); ctx.moveTo(0, r * 0.5); ctx.quadraticCurveTo(Math.cos(a) * r * 0.3, r * 0.5 + Math.sin(a) * r * 0.4, Math.cos(a) * r * 0.7, r * 0.5 + Math.sin(a) * r * 0.8); ctx.stroke(); }
      ctx.fillStyle = color; blob(0, r * 0.5, r * 0.26, r * 0.2, 'bulb');
      break;
    }
    case 'wraith': {
      ctx.fillStyle = color; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.moveTo(0, -r * 0.6); ctx.quadraticCurveTo(r * 0.55, -r * 0.2, r * 0.35, r * 0.3); ctx.quadraticCurveTo(r * 0.15, r * 0.7, 0, r * 0.45); ctx.quadraticCurveTo(-r * 0.15, r * 0.7, -r * 0.35, r * 0.3); ctx.quadraticCurveTo(-r * 0.55, -r * 0.2, 0, -r * 0.6); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#1a1a18'; dot(-r * 0.12, -r * 0.2, r * 0.06); dot(r * 0.12, -r * 0.2, r * 0.06);
      break;
    }
    default: { blob(0, 0, r * 0.5, r * 0.5, 'b'); }
  }

  // outline pass for the body-ish kinds (keeps them crisp on the paper)
  ctx.restore();
}
