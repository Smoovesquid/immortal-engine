import { rollOnTable } from './rngTables.js';

// Lightweight per-pack archetypes/backgrounds.
// Tags drive gear selection. Keep small + vibe-rich.

const BACKGROUNDS = {
  fantasy: [
    { name: 'Gravedigger', tags: ['occult', 'tools'], hook: 'You know what should stay buried—and what never does.' },
    { name: 'Sellsword', tags: ['martial', 'armor'], hook: 'You’ve been paid to win and paid to lose.' },
    { name: 'Hedge-Witch', tags: ['spell', 'oddity'], hook: 'Your bargains are older than the crown.' },
    { name: 'Runebroken Scholar', tags: ['wits', 'tools'], hook: 'You found a sentence that rewrote you.' },
    { name: 'Oathless Knight', tags: ['martial', 'armor'], hook: 'The oath snapped; the echo still pulls.' },
    { name: 'Wanderer', tags: ['wits', 'charm'], hook: 'You follow roads that don\'t appear on any map.' }
  ],
  haunted: [
    { name: 'Exorcist (unlicensed)', tags: ['occult', 'tools'], hook: 'You’ve seen the invoice that follows salvation.' },
    { name: 'Night Janitor', tags: ['tools', 'junk'], hook: 'You know which doors are warmer on the other side.' },
    { name: 'Medium', tags: ['occult', 'oddity'], hook: 'The dead keep leaving you voicemails.' },
    { name: 'Cursed Heir', tags: ['oddity', 'clothes'], hook: 'Your family tree has knots where people went missing.' },
    { name: 'Paranormal Podcaster', tags: ['tech', 'oddity'], hook: 'You brought a mic to a haunting; it brought a witness to you.' }
  ],
  zombie: [
    { name: 'Medic', tags: ['tools', 'consumable'], hook: 'You can stop bleeding; you can’t stop hunger.' },
    { name: 'Scavenger', tags: ['junk', 'tools'], hook: 'You know what’s valuable after the world ends.' },
    { name: 'Security Guard', tags: ['martial', 'armor'], hook: 'You were trained to keep people out; now you keep them alive.' },
    { name: 'Mechanic', tags: ['tools', 'tech'], hook: 'Engines still work; so does panic.' },
    { name: 'Shelter Boss', tags: ['charm', 'tools'], hook: 'You can negotiate with survivors—sometimes.' }
  ],
  modern: [
    { name: 'Union Contractor', tags: ['tools', 'armor'], hook: 'You can build anything, except trust.' },
    { name: 'Hacker-for-hire', tags: ['tech', 'wits'], hook: 'You sell solutions; the problem is always the same.' },
    { name: 'Street Medic', tags: ['consumable', 'tools'], hook: 'You’ve patched people up in alleys that remember.' },
    { name: 'Private Investigator', tags: ['tools', 'charm'], hook: 'The truth pays poorly and shows up anyway.' },
    { name: 'Arson Analyst', tags: ['tools', 'oddity'], hook: 'You read smoke like scripture.' }
  ],
  'space-rift': [
    { name: 'Dockhand', tags: ['tools', 'junk'], hook: 'You’ve hauled crates that hummed when nobody looked.' },
    { name: 'Corporate Escapee', tags: ['tech', 'clothes'], hook: 'Your ID is revoked; your debt still isn’t.' },
    { name: 'Void Chaplain', tags: ['occult', 'oddity'], hook: 'You perform rites for things that aren’t supposed to die.' },
    { name: 'Shipbreaker', tags: ['tools', 'martial'], hook: 'You’ve cut open hulls like ribs.' },
    { name: 'Xeno-Interpreter', tags: ['wits', 'tech'], hook: 'You can translate a scream into a contract.' }
  ]
};

export function listBackgrounds(packId) {
  return BACKGROUNDS[String(packId || 'fantasy')] || BACKGROUNDS.fantasy;
}

export function rollBackground(packId, rng) {
  const list = listBackgrounds(packId);
  return rollOnTable(list, rng) || list[0];
}

export function rollBackgroundOptions(packId, rng, n = 3) {
  const list = listBackgrounds(packId);
  const opts = [];
  const seen = new Set();
  while (opts.length < Math.min(n, list.length)) {
    const b = rollOnTable(list, rng);
    if (!b || seen.has(b.name)) continue;
    seen.add(b.name);
    opts.push(b);
  }
  return opts;
}
