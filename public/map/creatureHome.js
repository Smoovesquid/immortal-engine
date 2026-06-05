/**
 * Creature -> home mapping. Gives (almost) every creature in the bestiary a
 * logical place to live: a spider gets a web-nest, a wolf a cave-den, a wraith a
 * ruined haunt, a fire elemental an ember vent. Combines the icon classifier
 * (what it is) with the lair catalog (where its kind dwells) and the creature's
 * tier (how dangerous/rewarding its home is).
 *
 * makesAHome(entry) -> boolean        (ephemeral motes/wisps drift, they don't den)
 * lairProfileFor(entry) -> {
 *   archetype,        // a lair archetype id (resolve via getLair)
 *   material, tier,   // tier 1..4 from the creature's bestiary tier/CR
 *   iconKind,         // matches iconKindFor — the token that populates the home
 *   theme             // primary tag, for the future dresser
 * } | null            (null when the creature makes no home)
 *
 * PURE + DETERMINISTIC. No engine imports.
 */

import { iconKindFor } from './creatureIcons.js';
import { getLair } from './plans/lairs.js';

const has = (text, ...words) => { const t = String(text || '').toLowerCase(); return words.some(w => t.includes(w)); };

function tierNum(entry) {
  const t = String(entry?.tier || '').toLowerCase();
  if (t === 'trivial') return 1;
  if (t === 'minor') return 2;
  if (t === 'standard') return 3;
  if (t === 'elite') return 4;
  const cr = Number(entry?.cr || 0);
  return cr >= 8 ? 4 : cr >= 3 ? 3 : cr >= 1 ? 2 : 1;
}

export function makesAHome(entry) {
  const e = entry || {};
  const id = `${e.ref || ''} ${e.name || ''}`.toLowerCase();
  // Ephemeral / wandering things don't keep a den.
  if (has(id, 'mote', 'wisp', 'spark', 'gust', 'zephyr', 'mist', 'vapor', 'cloud', 'breeze', 'flicker', 'wandering', 'drifting', 'roaming')) return false;
  return true;
}

export function lairProfileFor(entry) {
  if (!makesAHome(entry)) return null;
  const e = entry || {};
  const tags = Array.isArray(e.tags) ? e.tags.map(t => String(t).toLowerCase()) : [];
  const id = `${e.ref || ''} ${e.name || ''}`.toLowerCase();
  const ic = iconKindFor(e);
  const tier = tierNum(e);
  const aquatic = has(id, 'water', 'sea', 'lake', 'river', 'drowned', 'deep', 'fish', 'kraken', 'sahuagin', 'merrow', 'tide', 'reef');

  let archetype;
  if (aquatic) archetype = has(id, 'bog', 'marsh', 'swamp', 'mire') ? 'bog_lair' : 'lakebed';
  else switch (ic.kind) {
    case 'arachnid': archetype = 'web_nest'; break;
    case 'swarm': archetype = 'hive'; break;
    case 'parasite': archetype = tags.includes('aberration') ? 'spawning_pool' : 'hive'; break;
    case 'serpent': archetype = has(id, 'naga', 'lamia') ? 'ruin_haunt' : 'nest_cluster'; break;
    case 'flyer': case 'dragon': archetype = ic.kind === 'dragon' ? 'cave_den' : 'aerie'; break;
    case 'ooze': archetype = 'bog_lair'; break;
    case 'aberration': archetype = 'spawning_pool'; break;
    case 'plant': archetype = 'thicket_den'; break;
    case 'elemental': archetype = has(id, 'fire', 'flame', 'ember', 'magma', 'ash', 'cinder') ? 'ember_vent' : 'crystal_geode'; break;
    case 'construct': archetype = has(id, 'crystal', 'stone', 'iron', 'clay') ? 'crystal_geode' : 'ruin_haunt'; break;
    case 'wraith': archetype = 'ruin_haunt'; break;
    case 'undead':
      archetype = has(id, 'barrow', 'mummy', 'pharaoh', 'ancient', 'lich') ? 'barrow'
        : has(id, 'ghost', 'spectre', 'specter', 'phantom', 'haunt', 'shade', 'wraith', 'banshee', 'revenant', 'poltergeist') ? 'ruin_haunt'
          : 'bone_pit';
      break;
    case 'fiend': archetype = has(id, 'fire', 'flame', 'ash') ? 'ember_vent' : 'ruin_haunt'; break;
    case 'biped':
      archetype = has(id, 'goblin', 'kobold', 'ratfolk', 'rat', 'gnoll') ? 'warren'
        : tags.includes('fey') ? 'thicket_den' : 'ruin_haunt';
      break;
    case 'brute': archetype = 'cave_den'; break;
    case 'ursine': archetype = 'cave_den'; break;
    case 'predator': archetype = tier <= 1 ? 'burrow' : 'cave_den'; break;
    case 'quadruped': default:
      archetype = has(id, 'lizard', 'gecko', 'drake', 'croc', 'turtle') ? 'nest_cluster'
        : (tier <= 1 ? 'burrow' : 'cave_den');
      break;
  }

  const lair = getLair(archetype) || getLair('cave_den');
  return {
    archetype: lair.archetype,
    material: lair.material,
    tier,
    iconKind: ic.kind,
    theme: tags[0] || 'beast'
  };
}
