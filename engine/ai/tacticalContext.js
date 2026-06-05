/**
 * Fog-aware tactical context for the AI DM.
 *
 * The narrator may only NAME what the player can actually see. Everything else
 * the player merely senses becomes a vague, unnamed, directional hint ("movement
 * in the trees to the north"), and anything far and unseen is omitted entirely.
 * This is the perception firewall applied to narration: the DM can build dread
 * about the unseen without leaking what's hidden in the fog.
 *
 * PURE + DETERMINISTIC.
 */

function dirWord(dx, dy) {
  const ang = Math.atan2(dy, dx); // screen coords: +y is south
  const dirs = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
  const i = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return dirs[i];
}

const VAGUE = {
  enemy: ['movement', 'a shape', 'something', 'a presence'],
  ally: ['a figure', 'someone'],
  neutral: ['something', 'a figure']
};

// buildTacticalContext({ player, actors, visible, awareness, lastAction }) ->
//   { seen:[{id,name,faction,kind,cell,cover}], sensed:[{dir,hint}], lastAction }
export function buildTacticalContext({ player, actors = [], visible = new Set(), awareness = 12, lastAction = null, coverFn = null } = {}) {
  const px = player ? player.x : 0, py = player ? player.y : 0;
  const key = a => Math.round(a.x) + ',' + Math.round(a.y);
  const seen = [], sensed = [];
  const sorted = actors.slice().filter(a => a && a.id !== (player && player.id)).sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);

  for (const a of sorted) {
    if (visible.has(key(a))) {
      seen.push({ id: String(a.id), name: String(a.name || a.id), faction: a.faction || 'enemy', kind: a.kind || null, cell: { x: a.x, y: a.y }, cover: coverFn ? coverFn(a) : null });
    } else {
      const d = Math.hypot(a.x - px, a.y - py);
      if (d <= awareness) {
        const pool = VAGUE[a.faction] || VAGUE.neutral;
        // deterministic pick by id hash
        let h = 0; const s = String(a.id); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        sensed.push({ dir: dirWord(a.x - px, a.y - py), hint: pool[h % pool.length] });
      }
      // else: too far and unseen -> omitted entirely
    }
  }
  // de-dupe identical sensed hints (don't over-tease), keep deterministic order
  const seenHints = new Set(); const sensedOut = [];
  for (const s of sensed) { const k = s.dir + '|' + s.hint; if (!seenHints.has(k)) { seenHints.add(k); sensedOut.push(s); } }

  return { seen, sensed: sensedOut, lastAction: lastAction || null, you: player ? { cell: { x: px, y: py } } : null };
}

// Render the context into a compact prompt block for the DM.
export function renderTacticalBlock(ctx) {
  const lines = ['TACTICAL VIEW (name only what is SEEN; the SENSED are hints — never name them):'];
  if (ctx.seen.length) for (const s of ctx.seen) lines.push(`- SEEN: ${s.name}${s.cover && s.cover !== 'none' ? ` (in ${s.cover} cover)` : ''}`);
  else lines.push('- SEEN: nothing but the ground you stand on');
  for (const s of ctx.sensed) lines.push(`- SENSED to the ${s.dir}: ${s.hint} (do not identify it)`);
  if (ctx.lastAction) lines.push(`- LAST: ${ctx.lastAction}`);
  return lines.join('\n');
}
