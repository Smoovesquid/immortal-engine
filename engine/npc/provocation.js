/**
 * provocation.js — social physics: insults carry risk, and the risk is personal.
 * Spec: docs/SOCIAL_PROVOCATION.md. [[IG-11]] social physics; the verbal sibling of
 * engine/magic/castConsequence.js (a deterministic consequence ladder, aimed at words).
 *
 * A real DM never lets you spit on someone for free — and never makes a saint snap
 * like a thug. Each NPC carries a TEMPERAMENT (a fuse length, seeded from who they
 * are): a few are volatile (one slight → a sucker punch), a few are stoic (they
 * suffer almost anything), most sit between. Insults ACCUMULATE as offense; when
 * offense crosses that individual's fuse, they act — shrug -> warn -> bristle ->
 * attack. The player discovers the threshold by misreading someone.
 *
 * PURE + DETERMINISTIC: rng.js is the only randomness. resolveProvocation is pure
 * numbers (trivially testable); a verdict of 'attack' is routed by the playloop wire
 * through the existing mintEnemyFromNpc/beginCombat seam. No LLM sets the number
 * (Biblioteca Vol 11). §0 untouched.
 */
import { seedFromString, makeRng } from '../rng.js';

// ── Temperament: the fuse length, innate to the person (seed + id), 6..100. ──
// Triangular distribution (mean of two rolls) → most people middling, with real
// tails: rare hair-triggers, rare stoics. Derived, never stored (no WORLD_VERSION).
export function npcTemperament(seed, npcId) {
  const r = makeRng(seedFromString(`${String(seed)}|${String(npcId)}|provocation-fuse`));
  const bell = (r.nextFloat() + r.nextFloat()) / 2;
  return Math.round(6 + bell * 94);
}

export function temperamentLabel(tolerance) {
  if (tolerance < 22) return 'volatile';
  if (tolerance > 76) return 'stoic';
  return 'even';
}

// ── Severity: how hard the words land (offense points + a tier for narration). ──
const GRIEVOUS = /\b(?:bastard|whoreson|son\s+of\s+a\s+(?:whore|bitch|dog|cur)|your\s+(?:dead|mother|father|kin|blood|whore)|i(?:'|’)?ll\s+(?:kill|gut|end|bury|skin|butcher)\s+you|piece\s+of\s+(?:shit|filth)|cunt)\b/i;
const SHARP = /\b(?:coward|craven|cowardly|fool|idiot|imbecile|moron|cretin|worm|maggot|filth|scum|swine|pathetic|worthless|spineless|disgrace|liar|thief|cheat|weakling|wretch|vermin|halfwit|simpleton|gutless)\b/i;
const MILD  = /\b(?:taunt|mock|mocks|mocking|insult|jeer|jibe|deride|ridicule|stupid|dolt|oaf|clumsy|ugly|buffoon|clown)\b/i;
const LOOK  = /\b(?:glare|glower|sneer|smirk|scoff|spit\s+at|spits\s+at|spat\s+at)\b/i;

export function insultSeverity(text) {
  const t = String(text || '').toLowerCase();
  if (GRIEVOUS.test(t)) return { points: 40, tier: 'grievous' };
  if (SHARP.test(t))    return { points: 25, tier: 'sharp' };
  if (MILD.test(t))     return { points: 12, tier: 'mild' };
  if (LOOK.test(t))     return { points: 6,  tier: 'look' };
  return { points: 0, tier: 'none' };
}

// ── The verdict: pure numbers → where on the ladder this lands. ──
export function resolveProvocation({ tolerance, priorOffense = 0, severity, disposition = 0, jitter = 0 }) {
  if (!(severity > 0)) return { verdict: 'none', offense: priorOffense, fuse: tolerance, grudge: 0 };
  const grudge = disposition < 0 ? Math.round(-disposition * 0.25) : 0; // already dislikes you → closer to the edge
  const offense = priorOffense + severity + grudge;
  const fuse = Math.max(6, tolerance + jitter);
  let verdict;
  if (offense >= fuse) verdict = 'attack';
  else if (offense >= fuse * 0.66) verdict = 'bristle';
  else if (offense >= fuse * 0.33) verdict = 'warn';
  else verdict = 'shrug';
  return { verdict, offense, fuse, grudge };
}

// ── Convenience for the playloop wire: temperament + a seeded mood jitter. ──
export function assessProvocation({ seed, npcId, text, priorOffense = 0, disposition = 0 }) {
  const { points: severity, tier } = insultSeverity(text);
  const tolerance = npcTemperament(seed, npcId);
  const r = makeRng(seedFromString(`${String(seed)}|${String(npcId)}|provocation-mood|${Math.round(priorOffense)}`));
  const jitter = r.int(-10, 10);
  const res = resolveProvocation({ tolerance, priorOffense, severity, disposition, jitter });
  return { ...res, severity, tier, tolerance, temperament: temperamentLabel(tolerance) };
}

// A grudge is REMEMBERED but cools: an offense burns at full only on the turn it
// lands; every prior offense is carried at HALF — never as hot as the moment it
// happened, but never fully gone (half is the floor). Walk off and come back and
// they're half-primed, not still mid-rage. (Tim, 2026-06-27.)
export const GRUDGE_RETENTION = 0.5;
export function carriedGrudge(priorOffense) {
  return Math.round(Number(priorOffense || 0) * GRUDGE_RETENTION);
}
