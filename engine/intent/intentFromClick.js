/**
 * Click → Intent. A click is just an unambiguous way to say "that one, there".
 *
 * The map exists precisely because some declarations are clumsy in words:
 * "move two north and one east of the rock" is a terrible sentence and a trivial
 * tap. So clicks emit the SAME Intent text/voice do — they're high-confidence by
 * definition (you pointed at the thing).
 *
 * click = {
 *   kind: 'enemy' | 'npc' | 'tile' | 'item' | 'self',
 *   x, y,                       // grid position of the click (for move / blind-fire)
 *   target,                     // entity id/ref when kind is enemy/npc/item
 *   ability                     // currently-selected ability/spell ('sword','fireball')
 * }
 *
 * PURE + DETERMINISTIC.
 */

import { makeIntent } from './intentSchema.js';

export function intentFromClick(click = {}, ctx = {}) {
  const c = click && typeof click === 'object' ? click : {};
  const kind = String(c.kind || 'tile');
  const ability = c.ability != null ? String(c.ability) : null;
  const at = (Number.isFinite(c.x) && Number.isFinite(c.y)) ? { x: c.x, y: c.y } : null;
  const isSpell = ability && (ctx.spells || []).map(String).includes(ability);

  switch (kind) {
    case 'enemy': {
      // Clicking a foe with a spell selected casts; otherwise it's a weapon attack.
      const verb = isSpell ? 'cast' : 'attack';
      return makeIntent({ verb, target: c.target, at, with: ability, source: 'click', confidence: 1 });
    }
    case 'npc':
      return makeIntent({ verb: 'talk', target: c.target, at, source: 'click', confidence: 1 });
    case 'item':
      return makeIntent({ verb: 'take', target: c.target, at, source: 'click', confidence: 1 });
    case 'self':
      return makeIntent({ verb: 'wait', source: 'click', confidence: 1 });
    case 'tile':
    default: {
      // Clicking empty ground: a blind-fire cast if a spell is armed, else a move.
      if (isSpell && at) return makeIntent({ verb: 'cast', at, with: ability, source: 'click', confidence: 1 });
      return makeIntent({ verb: 'move', at, source: 'click', confidence: 1 });
    }
  }
}
