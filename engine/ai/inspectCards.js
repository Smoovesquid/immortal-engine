/**
 * Inspect cards — perception-gated data for hover/click on a map token.
 *
 * The map IS the Monster Manual: hovering a creature shows what you'd notice by
 * looking; clicking opens its page. But knowledge is a reward, not a given —
 * stats and secrets stay hidden until you've identified the creature or met the
 * person. This builds the card DATA (the UI renders it), shaped to the real
 * bestiary entry and the NPC's knowledge split so it drops straight into both
 * the preview and the live map.
 *
 * PURE: no world mutation, no I/O.
 */

const STAT_KEYS = ['MIGHT', 'AGILITY', 'WITS', 'GRIT', 'CHARM'];

function groupHint(entry) {
  const s = String(entry?.socialStructure || '').toLowerCase();
  if (s.includes('swarm') || s.includes('pack')) return 'moves in a pack';
  if (s.includes('solitary')) return 'solitary';
  if (s.includes('pair')) return 'hunts in pairs';
  return 'unknown habits';
}

// creatureCard(entry, { identified }) -> { kind:'creature', glance, full }
export function creatureCard(entry, opts = {}) {
  const e = entry || {};
  const identified = Boolean(opts.identified);
  const apparentType = (Array.isArray(e.tags) && e.tags[0]) || 'creature';

  const glance = identified
    ? { title: String(e.name || 'Creature'), sub: `${e.tier || '?'} · ${apparentType}`, line: String(e.physicalDescription || '') }
    : { title: `Unknown ${apparentType}`, sub: groupHint(e), line: String(e.physicalDescription || '') };

  const full = identified
    ? {
        identified: true,
        name: String(e.name || 'Creature'),
        tier: e.tier ?? null,
        cr: e.cr ?? null,
        hp: e.maxHp ?? null,
        ac: e.ac ?? null,
        stats: e.stats || {},
        traits: Array.isArray(e.traits) ? e.traits : [],
        weakness: e.weakness || null,
        behavior: e.behavior || null,
        lore: e.loreHook || null
      }
    : {
        identified: false,
        apparentType,
        physicalDescription: e.physicalDescription || null,
        encounterSign: e.encounterSign || null,
        hp: '???',
        ac: '???',
        stats: Object.fromEntries(STAT_KEYS.map(k => [k, '?']))
      };

  return { kind: 'creature', glance, full };
}

// npcCard(npc, { met }) -> { kind:'npc', glance, full }
// known facts surface; secrets/unknowns render as "??? — not yet learned".
export function npcCard(npc, opts = {}) {
  const n = npc || {};
  const cs = n.conversationState || {};
  const met = opts.met != null ? Boolean(opts.met) : Boolean(cs.metPlayer);
  const role = String(n.role || n.archetype || 'figure');
  const species = String(n.species || '');
  const descriptor = species ? `${species} · ${role}` : role;
  const bearing = String(n.bearing || n.disposition || (cs.trustLevel != null ? (cs.trustLevel >= 6 ? 'at ease' : cs.trustLevel <= 3 ? 'wary' : 'guarded') : 'unreadable'));

  const knownFacts = Array.isArray(n.knowledgeGraph)
    ? n.knowledgeGraph.filter(f => f && f.source !== 'secret').map(f => String(f.factId || f.id || '')).filter(Boolean)
    : (Array.isArray(n.known) ? n.known.map(String) : []);
  const hiddenCount = Array.isArray(n.secrets) ? n.secrets.length : (Array.isArray(n.hidden) ? n.hidden.length : 0);

  const glance = met
    ? { title: String(n.name || 'Someone'), sub: `${descriptor} · ${bearing}` }
    : { title: 'Stranger', sub: `${descriptor} · ${bearing}` };

  const full = {
    met,
    name: met ? String(n.name || 'Someone') : 'Stranger',
    descriptor,
    bearing,
    known: knownFacts,
    hiddenCount
  };

  return { kind: 'npc', glance, full };
}
