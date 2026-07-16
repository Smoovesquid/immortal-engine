// deriveArchetype — the ONE creature-archetype read ('player'|'humanoid'|'beast'
// |'undead') + the elite/leader overlay, derived from a combat enemy's SURVIVING
// structured signals — traits, condition-immunities, cr, legendary/lair actions —
// with name only as a last-resort tiebreaker. (Heads-up: ensureCombat strips the
// bestiary `tags`/`type`/`ref` from combat enemies — see the project note on that
// trap — so creature-type lives in those proxies, not a clean `type` field.)
//
// CORPSE-TRUTH-1 finish (2026-07-16): moved VERBATIM from public/map/
// combatScene.js (which now imports it back) so the DEATH FACT can mint the
// victim's archetype at the killing moment — engine code must never import from
// public/, but public/ imports engine constantly. One authority: the figure the
// combat board picked for the living creature is the figure family its corpse
// projection falls back to.

const UNDEAD_NAME = /\b(skeleton|skeletal|zombie|ghoul|ghast|wight|wraith|spectre|specter|shade|ghost|ghostly|revenant|lich|undead|risen|corpse|cadaver|bone|barrow|draugr|mummy|haunt|phantom|wisp|husk|deathless)\b/;
const BEAST_NAME = /\b(wolf|wolves|bear|boar|rat|rats|spider|snake|serpent|hound|dog|mastiff|cat|lion|tiger|panther|stag|elk|deer|crow|raven|hawk|eagle|bat|bats|toad|frog|beast|drake|lizard|ape|hyena|jackal|vulture|scorpion|wasp|hornet|swarm|owl|moth|adder|viper|crocodile|shark|worm|leech|tick|centipede|mantis|roach)\b/;
const LEADER_NAME = /\b(captain|chief|chieftain|boss|warlord|champion|leader|lord|lady|tyrant|matron|priest|priestess|sergeant|knight|commander|queen|king|alpha|broodmother|elder|baron|warden|herald|overseer)\b/;
const UNDEAD_TRAIT = /undead|undeath|incorporeal|life sense|deathless|rejuven|necrotic (resilience|fortitude)|sunlight sensitivity|grave/i;
const BEAST_TRAIT = /pack tactics|keen (hearing|smell|sight)|pounce|trampl|blood frenzy|\bweb\b|beast/i;

export function deriveArchetype(e) {
  const name = String(e?.name || '').toLowerCase();
  const traits = (Array.isArray(e?.traits) ? e.traits : []).join(' ');
  const immun = (Array.isArray(e?.conditionImmunities) ? e.conditionImmunities : []).map(s => String(s).toLowerCase());
  const cr = Number(e?.cr) || 0;
  const hasLegendary = (Array.isArray(e?.legendaryActions) && e.legendaryActions.length > 0)
    || (Array.isArray(e?.lairActions) && e.lairActions.length > 0);

  // elite/leader overlay — the renderer upscales any base + adds a crown.
  const elite = hasLegendary || cr >= 2 || LEADER_NAME.test(name);

  // undead: immunity fingerprint (poisoned + a mind condition) OR an undead-ish
  // trait → name fallback. (canParley is NOT a signal — brigands have it false.)
  const undeadByImmun = immun.includes('poisoned')
    && (immun.includes('charmed') || immun.includes('frightened') || immun.includes('exhaustion'));
  if (undeadByImmun || UNDEAD_TRAIT.test(traits) || UNDEAD_NAME.test(name)) return { archetype: 'undead', elite };

  if (BEAST_NAME.test(name) || BEAST_TRAIT.test(traits)) return { archetype: 'beast', elite };

  return { archetype: 'humanoid', elite };
}
