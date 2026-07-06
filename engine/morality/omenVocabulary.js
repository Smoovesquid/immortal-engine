// MP-5a — THE OMEN VOCABULARY (docs/MORAL_PHYSICS.md §5, docs/MORALITY_SYSTEM.md
// "Manifest karma: the legible world").
//
// A small NAMED DATA TABLE — never prose the LLM authors, never a number the LLM sees.
// Each vice axis has a trademark sign-vocabulary (the Greed-god's coins and hoarding
// crows; the Wrath-god's people who yield before you speak) at THREE loudness registers:
//   faint   — Tier 1, "the world recoils"    (an omen, felt not staged)
//   rumor   — Tier 2, "reputation travels"   (the sign a stranger might remark on)
//   hunted  — Tier 3, "the hunt"             (the sign sharpens — something is closing in)
// Tier 4 ("the gift unbidden") reuses the SAME hunted-register phrase pool — MP-5a's line
// only ever needs to say the sign is present and loud; a T4-specific "the gift arrives"
// beat is the Cassandra/pact-surfacing work of a LATER packet (MP-5b+), not this slice.
//
// PURITY (docs/IMMORTAL_INVARIANTS.md, MORAL_PHYSICS §1-I): this module holds DATA and one
// PURE selection function. No rng.js Math.random, no Date, no I/O, no LLM call, no mutation.
// Selection is deterministic — `pickOmenPhrase(axis, register, seedKey)` uses the engine's
// own seeded RNG discipline (engine/rng.js `seedFromString` + `makeRng`, the SAME pattern
// composer.js/resolve.js/instrument.js already use for a one-shot local pick) so the exact
// same (axis, register, seedKey) always yields the exact same phrase — never the LLM's
// choice, never Math.random. No digit character ever appears in any phrase (grep-checked
// by U577/U578) — the tier/heat/corruption NUMBER itself never reaches this table or its
// output; only the register (which BUCKET of phrases) is chosen upstream, in narratorContext.

import { seedFromString, makeRng } from '../rng.js';
import { VICE_AXES } from '../state.js';

// The three loudness registers MP-5a exposes. (Named separately from the escalation
// ladder's 0..4 tiers — narratorContext.js maps tier→register; see moralOmenLine there.)
export const OMEN_REGISTERS = Object.freeze(['faint', 'rumor', 'hunted']);

// Each vice axis, each register: 2-4 short sign-phrases in the manifest-karma voice
// (docs/MORALITY_SYSTEM.md "Manifest karma" + the M4 villain-overture line's register —
// felt, atmospheric, never a verdict on the player, never a number). Phrases are written
// to complete "There is a sign: ___" / "Word is starting to move: ___" / "The world is
// closing in: ___" (narratorContext.js supplies the framing per register — this table
// holds only the sign itself, so the DATA stays swappable without touching the framing).
// Double-quoted throughout — several phrases carry an apostrophe, and this file must
// parse cleanly (a single-quoted string with an unescaped apostrophe is a syntax error).
const OMEN_VOCABULARY = {
  // Greed — MORALITY_SYSTEM.md: "the Greed-god leaves coins in your path and hoarding crows".
  greed: {
    faint:  [
      "an old coin turns up somewhere it has no business being",
      "crows are gathering where nothing feeds them",
      "a purse feels heavier than it should",
    ],
    rumor:  [
      "a merchant counts you twice before naming a price",
      "word travels that you never leave a room empty-handed",
      "a stranger asks, careful, what you took and from whom",
    ],
    hunted: [
      "crows follow at a distance and will not be driven off",
      "every ledger in reach seems to know your name",
      "someone is tallying what you owe, and they are patient",
    ],
  },
  // Wrath — MORALITY_SYSTEM.md: "people who yield before you speak and weather that turns close".
  wrath: {
    faint:  [
      "the air goes still before you have said a word",
      "a dog backs away without being shouted at",
      "the sky presses low and does not break",
    ],
    rumor:  [
      "folk step wide of you on the road before they know your face",
      "a story is told of your temper by people who never met you",
      "someone flinches at a name they have not heard you use yet",
    ],
    hunted: [
      "strangers yield ground the moment your eyes find them",
      "storms seem to follow the road you took",
      "the quiet before you speak has become a thing people fear",
    ],
  },
  // Lust — MORALITY_SYSTEM.md: "the maiden who can't say why she finds you compelling and doors that open too easily".
  lust: {
    faint:  [
      "a stranger's gaze lingers a beat too long, and they do not know why",
      "a locked door gives before you have tried the latch",
      "someone offers more than the situation calls for",
    ],
    rumor:  [
      "it is said you need only ask and doors open that should not",
      "a name is whispered of someone who could not explain their own devotion",
      "people speak of you the way they speak of a fire they know will burn them",
    ],
    hunted: [
      "every door in your path stands open, and it unsettles you as much as them",
      "someone has given up everything for you and cannot say why",
      "the pull you cause has stopped feeling like your own doing",
    ],
  },
  // Pride — no cosmology text yet; authored in-register (the world mirrors you back
  // larger, the sign of the man who cannot be told anything).
  pride: {
    faint:  [
      "your reflection in still water holds a beat longer than it should",
      "a bard's line about you outgrows the deed that earned it",
      "people repeat your words back to you as if they were scripture",
    ],
    rumor:  [
      "strangers defer to you before you have given them cause",
      "a story about you has grown taller than what actually happened",
      "someone corrects their own memory to match your version of events",
    ],
    hunted: [
      "every room seems built to face you when you enter it",
      "no one dares correct you anymore, even when you are wrong",
      "your own name has started to sound like a title",
    ],
  },
  // Envy — authored in-register (the world starts noticing what you notice, and
  // begins to sour it for others too).
  envy: {
    faint:  [
      "something someone else prized turns up spoiled for no reason",
      "you catch yourself named in a comparison you did not ask for",
      "a rival's good luck curdles just after you hear of it",
    ],
    rumor:  [
      "it is said that what you want, others soon lose",
      "people have started hiding their good fortune around you",
      "a friend's success is quietly credited to luck now, never skill",
    ],
    hunted: [
      "everything anyone else earns nearby seems to sour on schedule",
      "people flinch from mentioning their happiness in your hearing",
      "the luck of everyone around you has started running thin",
    ],
  },
  // Gluttony — authored in-register (excess follows you and starts costing others).
  gluttony: {
    faint:  [
      "a full larder turns up half-empty with no thief to blame",
      "a feast leaves you sated and everyone else still hungry",
      "food spoils faster than it should, wherever you have been",
    ],
    rumor:  [
      "it is said a town's stores run thin whenever you have passed through",
      "folk mutter that you leave tables bare and do not notice",
      "a host counts their stores twice after you have eaten at them",
    ],
    hunted: [
      "whole larders empty themselves along your road and no one can say how",
      "hunger follows in your wake like weather",
      "people have started hiding food before you arrive",
    ],
  },
  // Sloth — authored in-register (the world begins to decay quietly around
  // someone who has stopped tending anything).
  sloth: {
    faint:  [
      "a task you left undone quietly gets harder to start",
      "dust settles somewhere you swept only yesterday",
      "a door you meant to fix creaks louder each time",
    ],
    rumor:  [
      "it is said things fall apart faster wherever you have stopped caring",
      "people notice you finish less than you used to",
      "a promise you made is starting to be spoken of as a debt",
    ],
    hunted: [
      "everything you have left undone seems to be rotting at once",
      "the work you owe has started arriving at your door on its own, and worse for the wait",
      "people have stopped expecting you to finish anything",
    ],
  },
};

/**
 * pickOmenPhrase(axis, register, seedKey) → string | ''
 *
 * PURE, deterministic selection. Same (axis, register, seedKey) → same phrase, always —
 * no Math.random, no LLM authority (invariant I: the LLM receives the CHOSEN phrase as
 * fixed vocabulary, never a menu to pick from). `seedKey` should be a stable per-actor,
 * per-moment string (narratorContext.js composes it from world.meta.seed + the actor id +
 * the axis + the deed count, so the SAME world state always samples the SAME sign — the
 * sign only changes when the underlying moral state actually changes, never per-render).
 *
 * @param {string} axis      one of VICE_AXES.
 * @param {string} register  one of OMEN_REGISTERS ('faint'|'rumor'|'hunted').
 * @param {string} seedKey   a stable string to seed the pick (never derived from
 *   wall-clock time or a live rng stream — this is a throwaway local rng, the same
 *   pattern composer.js/resolve.js/instrument.js already use).
 * @returns {string} a sign-phrase, or '' if axis/register is unknown.
 */
export function pickOmenPhrase(axis, register, seedKey) {
  const table = OMEN_VOCABULARY[String(axis)];
  if (!table) return '';
  const pool = table[String(register)];
  if (!Array.isArray(pool) || !pool.length) return '';
  const rng = makeRng(seedFromString(`omen|${axis}|${register}|${String(seedKey ?? '')}`));
  return String(rng.pick(pool) ?? '');
}

// Exposed for tests only (U577's "no digit character" sweep needs the raw table; the
// module itself never leaks it to a caller other than pickOmenPhrase).
export const _OMEN_VOCABULARY_FOR_TESTS = OMEN_VOCABULARY;

// Defensive: every VICE_AXES key must have a table entry with all three registers non-empty
// (a silent gap here would make a real god axis mute at every tier, which is a worse bug
// than a duplicate phrase). This is a load-time assertion, not a runtime branch — if it
// ever fires, a future axis was added to VICE_AXES without vocabulary and CI will say so
// loudly instead of the line quietly going blank in play.
for (const axis of VICE_AXES) {
  const table = OMEN_VOCABULARY[axis];
  if (!table) throw new Error(`omenVocabulary.js: VICE_AXES axis "${axis}" has no vocabulary table`);
  for (const reg of OMEN_REGISTERS) {
    if (!Array.isArray(table[reg]) || !table[reg].length) {
      throw new Error(`omenVocabulary.js: axis "${axis}" register "${reg}" is empty`);
    }
  }
}
