/**
 * The Governors — lesser gods of Will, one per mode (and per school).
 *
 * They do not grant power; they PATTERN it — a lens that focuses the caster's
 * will. Each owns a mode of will, exacts a price, forbids a thing, and gathers a
 * cult (a faction). One Governor is ASCENDANT in a given world (the Aeon), which
 * blesses its magic and makes its opposite the world's great taboo.
 *
 * Pure data + helpers. Prose-to-world may rename these per world; the structure
 * is the deterministic scaffold.
 */

export const GOVERNORS = [
  { school: 'evocation', epithet: 'The Unbound Flame', mode: 'the will to destroy', price: 'wrath turns on its wielder', taboo: 'mercy shown to a hated foe', sign: 'guttering fire', cult: 'the Ashen Choir', coercive: false, forbidden: false },
  { school: 'abjuration', epithet: 'The Warden at the Threshold', mode: 'the will to ward', price: 'what you guard, you cannot leave', taboo: 'a held line crossed willingly', sign: 'a barred door', cult: 'the Wardens', coercive: false, forbidden: false },
  { school: 'restoration', epithet: 'The Green Mother', mode: 'the will to mend', price: 'you feel every wound you close', taboo: 'letting the savable die', sign: 'green through stone', cult: 'the Verdant Hand', coercive: false, forbidden: false },
  { school: 'enchantment', epithet: 'The Crowned Tongue', mode: "the will to rule another's will", price: 'your own will frays', taboo: 'the sin itself — to override a True Will', sign: 'a silvered word', cult: 'the Diadem', coercive: true, forbidden: false },
  { school: 'illusion', epithet: 'The Masked One', mode: 'the will to unmake the seen', price: 'you forget which face is yours', taboo: 'believing your own veil', sign: 'a shadow cast wrong', cult: 'the Mummers', coercive: false, forbidden: false },
  { school: 'necromancy', epithet: 'The Keeper of the Unwilling', mode: 'the will over death', price: 'the dead remember you', taboo: 'dragging back the unwilling', sign: 'a cold that clings', cult: 'the Pale Wardens', coercive: true, forbidden: false },
  { school: 'divination', epithet: 'The Open Eye', mode: 'the will to know', price: 'you cannot un-see', taboo: 'looking away from a needed truth', sign: 'an eye that will not blink', cult: 'the Unveiled', coercive: false, forbidden: false },
  { school: 'conjuration', epithet: 'The Caller Beyond the Door', mode: 'the will to summon', price: 'everything called keeps a ledger', taboo: 'a debt left unpaid', sign: 'a door ajar on nothing', cult: 'the Doorwardens', coercive: false, forbidden: false },
  { school: 'transmutation', epithet: 'The Alembic', mode: 'the will to become', price: 'nothing you change stays changed for free', taboo: 'refusing your own change', sign: 'matter that will not settle', cult: 'the Alembic Order', coercive: false, forbidden: false },
  { school: 'chronomancy', epithet: 'The Hour That Turns', mode: 'the will over time', price: 'time taken is time owed', taboo: 'turning the hour at all', sign: 'a stopped clock', cult: 'the Forsworn Hour', coercive: true, forbidden: true }
];

const BY_SCHOOL = Object.fromEntries(GOVERNORS.map(g => [g.school, g]));
export function governorFor(school) { return BY_SCHOOL[String(school || '')] || null; }
export function isCoercive(school) { const g = governorFor(school); return !!(g && g.coercive); }
export function isForbidden(school) { const g = governorFor(school); return !!(g && g.forbidden); }

const OPP = { evocation: 'restoration', restoration: 'evocation', abjuration: 'illusion', illusion: 'abjuration', enchantment: 'divination', divination: 'enchantment', necromancy: 'conjuration', conjuration: 'necromancy', transmutation: 'chronomancy', chronomancy: 'transmutation' };

const h32 = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ascendantAeon(seed) -> { governor, blessed (school), forbidden (the opposite mode is the age's great taboo) }
export function ascendantAeon(seed = 'world') {
  const g = GOVERNORS[h32('aeon|' + seed) % GOVERNORS.length];
  return { governor: g, blessed: g.school, taboo: OPP[g.school] || null };
}
