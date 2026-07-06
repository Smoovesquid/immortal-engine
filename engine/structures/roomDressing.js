// Room dressing — the small, true texture that makes a room a PLACE and not a box.
//
// roomDetail decides what a room IS (its role, furniture, shape); roomObjects says
// which node furniture piece lives in which room. This adds the last layer: 1–2
// MICRO-DETAILS a real room accumulates — a cobwebbed corner, a water-stained beam,
// initials scratched into a sill, a draught under the door. Not furniture, not cover,
// nothing you act on: pure surface texture the DM can render so narrated atmosphere is
// PRE-AUTHORIZED DERIVED CANON — the same water stain is on the same beam next week —
// instead of per-turn improv the guard has to police (PROSE_TO_WORLD_CONTRACT law 6).
//
// PURE + DETERMINISTIC, keyed exactly like roomObjects/roomDetail: everything derives
// from (seed + structureId + roomId), so the same room dresses the same way FOREVER.
// Nothing is stored, nothing is hashed — worldHash and the boot anchor are untouched by
// construction (S1 in the contract). Three-arg pure: seed is passed IN, never a world
// object, so the deriver cannot read or mutate state.
//
// The bank is DATA and taste-neutral: plain physical texture only — no morality, no
// numbers, no proper nouns, no signs of anyone's virtue or guilt. Dressing is what time
// and weather do to a room, not what its owner deserves.

import { seedFromString, makeRng } from '../rng.js';

// ── The authored texture bank ──────────────────────────────────────────────
// Each entry is a short, lowercase common-noun phrase the DM can weave into a
// sentence. `tags` gate a phrase to rooms it can honestly appear in:
//   any    — fits any enclosed room (the default pool)
//   dark   — a shadowed, windowless room (cellar, crypt, den, vault …)
//   damp   — a room that plausibly holds water/rot (cellar, scullery, cave, den)
//   grand  — a large ceremonial room (nave, great hall, market floor, throne room)
//   humble — a lived-in domestic/work room (bedchamber, kitchen, quarters, hearth)
//   organic— a creature-dug or cave space (lair, hive, den, warren, brood cell)
// A phrase tagged only 'any' is always eligible; a gated phrase is eligible only when
// the room carries that trait. Keep every phrase MORALITY-free.
const BANK = [
  // — universally plausible wear —
  { text: 'a cobwebbed corner where the walls meet', tags: ['any'] },
  { text: 'a spider hunched in its web up in the rafters', tags: ['any'] },
  { text: 'a long crack running up one wall', tags: ['any'] },
  { text: 'a patch of the floor worn pale by years of footfalls', tags: ['any'] },
  { text: 'dust motes turning slowly in the still air', tags: ['any'] },
  { text: 'a draught sighing under the door', tags: ['any'] },
  { text: 'a faint smell of woodsmoke soaked into everything', tags: ['any'] },
  { text: 'initials someone scratched into a windowsill long ago', tags: ['any'] },
  { text: 'a bent nail jutting from a beam, hung with nothing', tags: ['any'] },
  { text: 'a knot in the floorboards that creaks under a careless step', tags: ['any'] },
  { text: 'the ghost of an old handprint smudged near the door', tags: ['any'] },
  { text: 'a cluster of dead flies collected along the sill', tags: ['any'] },
  { text: 'a chalk tally-mark faded on the wall, its count long forgotten', tags: ['any'] },
  { text: 'a swallow’s abandoned mud-nest tucked under the eaves', tags: ['any'] },

  // — damp / dark rooms —
  { text: 'a water stain spreading brown across a ceiling beam', tags: ['damp'] },
  { text: 'a slow drip finding its way down one wall', tags: ['damp'] },
  { text: 'a bloom of pale mildew furring a low corner', tags: ['damp', 'dark'] },
  { text: 'a shallow puddle that never quite dries', tags: ['damp'] },
  { text: 'salt-lines crusting where old damp rose and fell', tags: ['damp'] },
  { text: 'the deep dark past the reach of any light', tags: ['dark'] },
  { text: 'shadows pooling thick in the far corners', tags: ['dark'] },
  { text: 'a cold that seems to come up out of the stone itself', tags: ['dark'] },

  // — grand / ceremonial rooms —
  { text: 'a shaft of dusty light falling from somewhere high above', tags: ['grand'] },
  { text: 'worn hollows in the stone floor where countless feet have passed', tags: ['grand'] },
  { text: 'soot fanned dark up the wall above where flames once burned', tags: ['grand'] },
  { text: 'an echo that answers a moment after any sound', tags: ['grand'] },

  // — humble / lived-in rooms —
  { text: 'a rag rug worn thin down its middle', tags: ['humble'] },
  { text: 'a row of pegs by the door, most of them empty', tags: ['humble'] },
  { text: 'grease-shine on the wall beside where a lamp is set', tags: ['humble'] },
  { text: 'a child’s height marked in notches up a doorframe', tags: ['humble'] },
  { text: 'crumbs of dried herbs caught in the cracks of a bench', tags: ['humble'] },

  // — creature / cave spaces —
  { text: 'old bones half-buried in the packed-earth floor', tags: ['organic'] },
  { text: 'scratch-marks gouged deep into the rock', tags: ['organic'] },
  { text: 'a reek of animal musk hanging low', tags: ['organic'] },
  { text: 'strands of web trailing from the ceiling like torn curtains', tags: ['organic'] }
];

// Room traits are derived from the room's ROLE when the caller hands us a role/dark hint
// (buildScene has the role in hand via roomDetail); absent a hint, only the 'any' pool is
// eligible, which keeps standalone/test calls honest and world-free.
const ROLE_TRAITS = {
  // dark + damp cellars/crypts/caves
  cellar: ['dark', 'damp', 'humble'], pantry: ['dark', 'humble'], privy: ['damp', 'humble'],
  crypt: ['dark', 'damp', 'grand'], storeroom: ['dark', 'humble'], larder: ['dark', 'humble'],
  vault: ['dark'], dungeon: ['dark', 'damp'], scullery: ['damp', 'humble'],
  // grand ceremonial
  nave: ['grand'], crossing: ['grand'], apse: ['grand'], greathall: ['grand'],
  plaza: ['grand'], mead: ['grand'], royalchamber: ['grand', 'organic', 'dark'],
  // humble domestic / work
  hearthroom: ['humble'], bedchamber: ['humble'], quarters: ['humble'], kitchen: ['humble', 'damp'],
  taproom: ['humble'], solar: ['humble'], sleeping: ['humble'], loomroom: ['humble'],
  hearthrow: ['humble'], stallrow: ['humble'], barracks: ['humble'],
  // creature / cave
  maw: ['organic', 'dark', 'damp'], tunnel: ['organic', 'dark', 'damp'], den: ['organic', 'dark', 'damp'],
  hoard: ['organic', 'dark'], warren: ['organic', 'dark'], pit: ['organic', 'dark', 'damp'],
  nest: ['organic', 'dark'], mouth: ['organic', 'dark', 'damp'], gallery: ['organic', 'dark'],
  broodcell: ['organic', 'dark'], cocoonstore: ['organic', 'dark']
};

function traitsFor({ role, dark } = {}) {
  const set = new Set(['any']);
  const rt = role ? ROLE_TRAITS[String(role)] : null;
  if (rt) for (const t of rt) set.add(t);
  // A room flagged dark by the layout always earns the 'dark' pool even if its role
  // isn't in the table (an interior room with no daylight).
  if (dark) set.add('dark');
  return set;
}

/**
 * roomDressing(seed, structureId, roomId[, hint]) -> string[]  (1–2 phrases)
 *
 * Pure, deterministic, world-free. Returns 1 or 2 texture phrases for THIS room, stable
 * for the life of the seed. `hint` (optional) = { role, dark } from roomDetail so the
 * pool matches the room's real character; omit it and every 'any' phrase is eligible.
 * Never throws; returns [] only when structureId and roomId are both empty.
 */
export function roomDressing(seed, structureId, roomId, hint = null) {
  const sid = String(structureId ?? '');
  const rid = String(roomId ?? '');
  if (!sid && !rid) return [];

  const traits = traitsFor(hint || {});
  const eligible = BANK.filter(entry => entry.tags.some(t => traits.has(t)));
  const pool = eligible.length ? eligible : BANK.filter(e => e.tags.includes('any'));
  if (!pool.length) return [];

  // One RNG stream per room, seeded by the same (seed|structure|room) key idiom the
  // sibling derivers use — so the count and the picks are jointly deterministic.
  const rng = makeRng(seedFromString(`${seed}|${sid}|${rid}|dressing`));

  // Most rooms get 1 detail; some get 2 (never 0 for a real room, never 3+ — texture,
  // not clutter). Two only when the pool can honestly supply two distinct phrases.
  const want = pool.length >= 2 && rng.nextFloat() < 0.5 ? 2 : 1;

  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < want && guard++ < 24) {
    const pick = rng.pick(pool);
    if (!pick || used.has(pick.text)) continue;
    used.add(pick.text);
    out.push(pick.text);
  }
  return out;
}
