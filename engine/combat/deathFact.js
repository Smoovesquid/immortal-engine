/**
 * DEATH-1 — the DEATH FACT atom + the DYING/DOWNED capability gate.
 *
 * THE DEATH CONTRACT (docs/DEATH_CONTRACT.md), invariant I: "The death fact
 * precedes the death prose." Every death — player or NPC — first assembles a
 * deterministic DEATH FACT; the prose (DEATH-3/4) is voiced FROM it and may not
 * contradict it. This module is that atom, plus the capability gate that decides
 * which foes enter DOWNED (dying, can still plead) versus die outright.
 *
 * PURE. No rng, no Date.now, no LLM. The fact is f(world, combat log) drawn from
 * already-committed state + this fight's accumulated wounds — it draws NO fresh
 * randomness, so a replayed fight yields a byte-identical fact (the determinism
 * floor, §6). Invariant III: the engine owns every magnitude; NO numeric value
 * ever appears in a player-facing string built from this fact.
 *
 * Storage (see docs/briefs/DEATH-1-audit.md — the honest lazy-additive path):
 * the fact is recorded as a TIMELINE EVENT ({ kind:'death-fact', data:<fact> }),
 * the existing append-only canon store. No new ensureWorld field, no boot-hash
 * movement, no WORLD_VERSION bump. DEATH-2 (moral wiring), DEATH-3 (enemy prose),
 * DEATH-4 (player elegy) all read the fact off the timeline.
 */

// ── The DYING clock (engine-owned magnitude — invariant III) ─────────────────
// A DOWNED communicator lingers this many rounds before the clock finishes it,
// if nothing intervenes. DEATH-1 establishes the STATE and this constant; the
// clock's per-round tick, the beg it fires, and the four verbs are DEATH-2.
// Kept here (engine-owned) so no number is ever set by the LLM or leaks to prose.
export const DYING_CLOCK_ROUNDS = 3;

import { deriveArchetype } from './creatureArchetype.js';
import { boardCellToWorldPos } from './grid.js';

// The vocabulary the fact commits to (kept as named constants so tests and the
// prose layer share one source of truth; never surfaced as raw strings in-world).
export const VICTIM_STANCES = Object.freeze(['fighting', 'fleeing', 'begging', 'helpless', 'defiant']);
export const KILLER_INTENTS = Object.freeze(['clean', 'brutal', 'mercy', 'worse']);

// ── canCommunicate — the capability gate for DOWNED (contract §3) ────────────
// "A communicator at 0 HP does not evaporate: it enters DOWNED. Beasts and the
// mindless die outright (capability-gated by the bestiary record)."
//
// The audit established that `canParley` is the WRONG signal — it means
// "negotiation can end this fight" and is set FALSE for explicit hostiles, yet a
// hostile bandit can absolutely beg. So capability is derived independently:
//   1. an explicit enemy.canCommunicate wins (bestiary/profile may set it),
//   2. else a bestiary/creature-type read: mindless kinds (beast/ooze/plant/
//      undead-mindless/construct-mindless/vermin) cannot plead → die outright,
//   3. else default TRUE for the humanoid/named foes v1 actually fights
//      (bandits, cultists, guards — the beings the beg is for).
// Pure, deterministic, no rng. Defaults chosen so today's foes (bandit/goblin/
// cultist = communicators; wolf/owlbear = speechless) fall out correctly.
const SPEECHLESS_TYPES = new Set([
  'beast', 'animal', 'ooze', 'plant', 'vermin', 'swarm', 'construct', 'undead-mindless'
]);
// Name fragments for the mindless when no structured type is present (the v1
// bestiary records carry no `type`, so this heuristic is the working gate; a
// later bestiary pass can set canCommunicate/type explicitly and this yields).
const SPEECHLESS_NAME_RE = /\b(wolf|owlbear|bear|boar|spider|rat|swarm|ooze|slime|zombie|skeleton|wraith|wisp|beetle|snake|serpent|hound|wolfpack|dire\s+\w+|giant\s+(?:rat|spider|beetle|snake))\b/i;

export function canCommunicate(enemy) {
  const e = enemy && typeof enemy === 'object' ? enemy : {};
  if (typeof e.canCommunicate === 'boolean') return e.canCommunicate;
  const type = String(e.creatureType ?? e.type ?? '').toLowerCase();
  if (type && SPEECHLESS_TYPES.has(type)) return false;
  // Intelligence signal, if the record carries stats: a truly mindless thing
  // (WITS ≤ 3, the 5e "animal intelligence" floor) cannot plead.
  const wits = Number(e.stats?.WITS ?? e.stats?.INT);
  if (Number.isFinite(wits) && wits <= 3) return false;
  const name = String(e.name ?? '');
  if (SPEECHLESS_NAME_RE.test(name)) return false;
  return true;
}

// ── woundPath helpers ────────────────────────────────────────────────────────
// The fight accumulates wounds; the killing blow "is allowed to finish through"
// an earlier wound (contract §2). We record each significant blow as a compact,
// NUMBER-FREE wound entry the prose layer can render honestly. Body region is
// derived deterministically from the fight index (no rng) so a replay matches.
const BODY_REGIONS = ['the shoulder', 'the flank', 'the thigh', 'the forearm', 'the ribs', 'the gut', 'the throat', 'the brow'];

/**
 * woundEntry — one accumulated wound, number-free.
 *   { means, type, region, round, killing }
 * `means` = the weapon/spell name; `type` = damage type (slashing/fire/…);
 * `region` = a deterministic body region; `round` = fight round; `killing` =
 * whether this blow dropped the victim (the blow that finishes through).
 */
export function woundEntry({ means, type, round, seedIndex = 0, killing = false }) {
  const region = BODY_REGIONS[Math.abs(Number(seedIndex) || 0) % BODY_REGIONS.length];
  return {
    means: String(means ?? 'a strike'),
    type: String(type ?? 'physical'),
    region,
    round: Math.max(1, Number(round) || 1),
    killing: Boolean(killing)
  };
}

// ── witnesses — occupancy truth (contract §2) ────────────────────────────────
// Man AND gods witness (invariant II). Man = settlement/room occupancy at the
// locale, the SAME idiom every recordDeed site uses (node.settlement.npcs / the
// interior room occupants). The divine channel is always-on (the gods witness
// every death); it rides as a sentinel so DEATH-2's tier/pact/omen ladder can
// read it without a separate lookup. Pure read of committed state.
export function witnessesForDeath(world, { victimIsPlayer = false } = {}) {
  const w = world && typeof world === 'object' ? world : {};
  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = Array.isArray(w.map?.nodes) ? w.map.nodes.find(n => n && n.id === nodeId) : null;
  const ids = new Set();
  // Interior room occupancy takes precedence when the scene is inside a structure.
  const interior = w.scene?.interior;
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  for (const n of npcs) {
    const id = String(n?.id ?? '').trim();
    if (id) ids.add(id);
  }
  // The victim never witnesses their own death from the man-side list.
  if (!victimIsPlayer) { /* NPC victim: its own id may be present; leave it — a crowd sees a foe fall */ }
  return {
    nodeId,
    who: Array.from(ids).slice(0, 8),   // occupancy truth, capped like the deed sites
    inInterior: Boolean(interior),
    gods: true                          // the divine channel is always present (invariant II)
  };
}

// ── locale / light / weather — the environment fields (pure reads) ───────────
function localeFor(world) {
  const w = world && typeof world === 'object' ? world : {};
  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = Array.isArray(w.map?.nodes) ? w.map.nodes.find(n => n && n.id === nodeId) : null;
  const label = String(node?.settlement?.name ?? node?.name ?? node?.label ?? nodeId ?? 'the wild');
  const interior = w.scene?.interior;
  return {
    nodeId,
    label,
    kind: interior ? 'interior' : (node?.settlement ? 'settlement' : 'wild')
  };
}

function lightFor(world) {
  const w = world && typeof world === 'object' ? world : {};
  // world.env.light is 0..6 (engine/env/envCore.js). Map to a coarse, number-free
  // band for the prose layer (the fact stores the raw value AND the band; the raw
  // value never reaches a player string — DEATH-3 reads the band).
  const raw = Number(w.env?.light);
  const light = Number.isFinite(raw) ? Math.max(0, Math.min(6, raw)) : 0;
  const band = light <= 1 ? 'dark' : light <= 3 ? 'dim' : 'lit';
  return { light, band };
}

function weatherFor(world) {
  // v1 has no rich weather model (audit finding). Record honestly what exists:
  // a labelled gap rather than an invented sky. A later env packet can fill this;
  // the fact shape is ready for it.
  const w = world && typeof world === 'object' ? world : {};
  const wx = w.env?.weather ?? w.weather ?? null;
  return typeof wx === 'string' && wx ? wx : 'unremarked';
}

// ── victimStance — computed from the moment, honestly (contract §2) ──────────
// fighting | fleeing | begging | helpless | defiant. DEATH-1 wires the states it
// can know for certain; begging/defiant get their real values when DEATH-2's beg
// lands (a DOWNED foe that has begged is 'begging'; a proud one is 'defiant').
export function victimStanceFor({ victim, fleeing = false, downed = false, begged = null }) {
  const v = victim && typeof victim === 'object' ? victim : {};
  if (begged === 'life' || begged === 'quick') return 'begging';    // DEATH-2 populates begged
  if (begged === 'defiant') return 'defiant';
  if (fleeing) return 'fleeing';
  // A DOWNED-then-finished foe, or a helpless (grappled/paralyzed) one, reads helpless.
  if (downed) return 'helpless';
  const conds = Array.isArray(v.conditions) ? v.conditions : [];
  if (conds.some(c => c && (c.name === 'paralyzed' || c.name === 'unconscious' || c.name === 'grappled' || c.name === 'restrained'))) {
    return 'helpless';
  }
  return 'fighting';
}

// ── killerIntent — routed from the player's verb/intent (contract §2/§3) ─────
// clean | brutal | mercy | worse. DEATH-1 lands the ROUTING seam + an honest
// default of 'clean'. The mercy/worse verbs (a merciful blow on a beg, the
// example-making) resolve in DEATH-2; here we read what the raw action text
// honestly signals and never over-claim. A plain strike is 'clean'.
const BRUTAL_RE = /\b(brutal|savage|butcher|hack|maim|mutilate|rip|tear|dismember|gut|behead|decapitate|slaughter|cruel|make\s+an?\s+example|slow(?:ly)?|torture|carve)\b/i;
const MERCY_RE = /\b(mercy|merciful|spare\s+(?:the|it|him|her|them)\s+the\s+pain|quick\s+(?:death|end|kill)|end\s+(?:its|his|her|their)\s+suffering|painless|clean\s+kill|quick\s+and\s+clean)\b/i;

export function routeKillerIntent(actionText, { onBeggingFoe = false } = {}) {
  const t = String(actionText ?? '').toLowerCase();
  if (MERCY_RE.test(t)) return 'mercy';
  if (BRUTAL_RE.test(t)) return onBeggingFoe ? 'worse' : 'brutal';
  // A brutal verb against a foe who has BEGGED is 'worse' (the example-making,
  // contract §3.2); against a fighting foe it's just 'brutal'. Both are honest
  // defaults DEATH-2 refines when the beg/verb system is live.
  return 'clean';
}

// ── victimWorldPos — WHERE THE VICTIM DIED (DEATH-TRUTH-1 correction) ────────
// The b167 fact stored `world.party[0].pos` — the KILLER's position — under a
// comment claiming it was "the melee anchor the engine actually owns". It is not:
// reproduced 2026-07-16 on seed loaderDemo, player (-806,-390) vs Jorin
// (-800,-353), fact recorded (-806,-390). A death fact that stores the player's
// coordinates records where the player stood, not where the victim fell.
//
// The honest anchor, in order of authority — all pure reads of committed state:
//   1. an explicit victim-owned `worldPos` — an NPC-sourced foe's real roster pos,
//      inherited by mintEnemyFromNpc and carried through ensureCombat's enemy
//      whitelist. Canonical under POSITION_AS_CANON; the board never overrides it.
//   2. DEATH-TRUTH-1c — THE PROJECTION OF THE VICTIM'S BOARD CELL AT THE MOMENT OF
//      DEATH. This replaces the b167 `playerPos + rng.int(-3,3)` scatter, which
//      agreed with the board the player was looking at in 0 of 120 seeds (67% on
//      the wrong side, median 6 cells ≈ 30 m out, and on seed `scan48` it recorded
//      the killer's own square). The board now carries a real world origin
//      (grid.js boardOriginFrom, pinned at beginCombat so the player's cell
//      projects to the player's canonical pos), so a foe's position is a pure 1:1
//      projection of where it demonstrably stands. Read HERE, at assembly time,
//      rather than stamped at spawn: the fact then records the DEATH cell by
//      construction, and stays correct if a foe ever gains movement (today only
//      the player's token moves — grid.js moveCombatant is called for 'player'
//      only — so spawn and death cells coincide; this does not rely on that).
//   3. an NPC-sourced foe's roster `pos` looked up by sourceNpcId — the pre-b167
//      path, kept for a foe whose inherited worldPos was lost.
//   4. honest absence (null) — the fact degrades to node-level truth exactly as a
//      legacy fact does. NEVER the player's position: a deterministic substitution
//      is still a substitution, and a wrong position is worse than no position.
function normalizeWorldPos(p) {
  return (p && typeof p === 'object' && Number.isInteger(p.gx) && Number.isInteger(p.gy) && p.frame)
    ? { frame: String(p.frame), gx: p.gx, gy: p.gy } : null;
}

export function victimWorldPos(world, victim) {
  const v = victim && typeof victim === 'object' ? victim : {};
  const own = normalizeWorldPos(v.worldPos);
  if (own) return own;
  // The board projection — the ambush creature's honest first fact.
  const projected = normalizeWorldPos(boardCellToWorldPos(world?.combat?.origin, v));
  if (projected) return projected;
  const src = String(v.sourceNpcId ?? '');
  if (src) {
    const nodeId = String(world?.map?.currentNodeId ?? '');
    const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
    const node = nodes.find(n => n && String(n.id) === nodeId);
    const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
    const npc = npcs.find(n => n && String(n.id) === src);
    const p = normalizeWorldPos(npc?.pos);
    if (p) return p;
  }
  return null;
}

// ── The atom ─────────────────────────────────────────────────────────────────
/**
 * assembleDeathFact — pure f(world, combat log) → the DEATH FACT (contract §2).
 *
 * @param {object} args
 *   world        — the committed world at the killing moment
 *   victim       — the enemy record (or a player sentinel: { player:true, name })
 *   victimIsPlayer — true when the PLAYER is the victim (DEATH-4 path)
 *   killer       — { name, kind } (the PC, or the enemy that felled the player)
 *   means        — { name, type } the killing weapon/spell/means
 *   woundPath    — array of woundEntry() (this fight's accumulated wounds)
 *   round        — the fight round of the killing blow
 *   fleeing      — was the victim mid-flight (morale-broken)
 *   downed       — did the victim pass through DOWNED before the finish
 *   begged       — DEATH-2: 'life'|'quick'|'defiant'|null
 *   intent       — killerIntent (clean|brutal|mercy|worse)
 *   finalWords   — DEATH-2/3: optional last words (voiced by the LLM later)
 *
 * Returns a plain, JSON-serialisable object (rides the timeline). Number-free in
 * every field the prose layer reads; the raw light value is retained for the
 * engine but the prose reads `light.band`, never the number.
 */
export function assembleDeathFact(args = {}) {
  const {
    world,
    victim,
    victimIsPlayer = false,
    killer = null,
    means = null,
    woundPath = [],
    round = 1,
    fleeing = false,
    downed = false,
    begged = null,
    intent = 'clean',
    finalWords = null,
    t = null
  } = args;

  const v = victim && typeof victim === 'object' ? victim : {};
  const wounds = Array.isArray(woundPath)
    ? woundPath.filter(x => x && typeof x === 'object').slice(0, 12)
    : [];
  const stance = victimStanceFor({ victim: v, fleeing, downed, begged });
  const killerIntent = KILLER_INTENTS.includes(intent) ? intent : 'clean';

  return {
    victim: {
      name: String(v.name ?? (victimIsPlayer ? 'you' : 'the foe')),
      isPlayer: Boolean(victimIsPlayer),
      sourceNpcId: victimIsPlayer ? null : String(v.sourceNpcId ?? '') || null,
      // CORPSE-TRUTH-1 — WHAT KIND of creature died. The corpse-mini seam and the
      // remains fiction key on this; a fallen wolf must never become an anonymous
      // marker. Minted from the enemy's own structured signals (deriveArchetype —
      // the SAME derivation the combat board's living figure used) when the
      // record carries no explicit archetype. Additive: old facts simply lack it.
      archetype: victimIsPlayer ? null
        : (String(v.archetype ?? '') || deriveArchetype(v).archetype || null),
      // CORPSE-TRUTH-1 finish — the STABLE corpse/mini selection key: the exact
      // key the combat board hashed for this foe's corpse GLB (buildCorpseMini's
      // e.id || e.name), persisted so the revisit projection shows the SAME body
      // the fight ended on. Additive: old facts lack it (name is the fallback key).
      corpseKey: victimIsPlayer ? null : String(v.id ?? v.name ?? '') || null,
      canCommunicate: victimIsPlayer ? true : canCommunicate(v)
    },
    killer: killer && typeof killer === 'object'
      ? { name: String(killer.name ?? 'unknown'), kind: String(killer.kind ?? 'unknown') }
      : { name: 'unknown', kind: 'unknown' },
    means: means && typeof means === 'object'
      ? { name: String(means.name ?? 'a blow'), type: String(means.type ?? 'physical') }
      : { name: 'a blow', type: 'physical' },
    woundPath: wounds,
    // CORPSE-TRUTH-1 — WHERE it died. Kills resolve at the player's current node;
    // remainsAtNode derives locatable corpses from exactly this field. Additive:
    // pre-feature facts lack it and stay honestly unlocatable (never guessed).
    nodeId: String(world?.map?.currentNodeId ?? '') || null,
    // CORPSE-TRUTH-1 finish (2026-07-16) — the MOST SPECIFIC location the engine
    // owns at the killing moment, captured whole and never guessed later:
    //   structureId/roomId — the interior scene, when the fight was inside;
    //   pos — the VICTIM's own canonical world position (victimWorldPos above).
    //         The combat grid is an abstract board that dissolves at endCombat —
    //         its cells are NOT world positions, so they are deliberately NOT
    //         recorded; but that is no licence to substitute the killer's pos.
    //         A victim with no honest anchor records pos:null and degrades to
    //         node-level truth (DEATH-TRUTH-1 correction).
    // The presence of the `loc` key is the post-feature discriminator: legacy
    // facts lack it entirely and degrade to node-level truth (never assigned a
    // guessed room or cell).
    loc: (() => {
      const interior = world?.scene?.interior;
      return {
        structureId: interior ? String(interior.structureKey ?? '') || null : null,
        roomId: interior ? String(interior.roomId ?? '') || null : null,
        pos: victimWorldPos(world, v),
      };
    })(),
    locale: localeFor(world),
    light: lightFor(world),
    weather: weatherFor(world),
    witnesses: witnessesForDeath(world, { victimIsPlayer }),
    victimStance: stance,
    killerIntent,
    finalWords: typeof finalWords === 'string' && finalWords ? finalWords : null,
    round: Math.max(1, Number(round) || 1),
    // timeline index of the killing moment, for ordering/attribution (DEATH-2/4).
    t: t == null ? null : Math.max(0, Number(t) || 0)
  };
}

/**
 * recordDeathFactEvent — append the fact to the timeline (the canon store).
 * Pure: returns a new world with one appended event. The event kind is
 * 'death-fact'; the fact rides in `data`. This is the honest lazy-additive
 * storage path (no new ensureWorld field). DEATH-2/3/4 read it back with
 * `findDeathFacts`.
 */
export function recordDeathFactEvent(world, fact) {
  const w = world && typeof world === 'object' ? world : {};
  const tl = Array.isArray(w.timeline) ? w.timeline : [];
  const t = tl.length;
  return { ...w, timeline: [...tl, { t, kind: 'death-fact', data: fact }] };
}

/** findDeathFacts — read all death facts off the timeline (for DEATH-2/3/4 + tests). */
export function findDeathFacts(world) {
  const tl = Array.isArray(world?.timeline) ? world.timeline : [];
  return tl.filter(e => e && e.kind === 'death-fact').map(e => e.data);
}

/**
 * remainsAtNode — CORPSE-TRUTH-1: the ONE canonical "what bodies lie here" read
 * (the heldObjectOf pattern: one derived truth, every consumer projects it).
 *
 * Sources, unified and deduped by victim identity:
 *   (a) death-fact canon with a matching nodeId — monster corpses (sourceNpcId
 *       null → kind 'monster') AND NPC kills (kind 'npc');
 *   (b) the pre-existing NPC corpse truth — a node-roster NPC whose persisted
 *       combat record says down (meta.npcCombatHp) — so pre-feature NPC corpses
 *       keep working with no fact to back them.
 * An NPC that appears in both (a kill mints the fact AND stamps npcCombatHp) is
 * ONE body, keyed by sourceNpcId. Distinct unnamed monster kills stay distinct
 * (keyed by fact t). Pure read: no RNG, no mutation, no new world shape —
 * the timeline IS the record (Canon Log wins).
 *
 * Returns [{ name, kind: 'npc'|'monster', sourceNpcId|null, archetype|null,
 *            corpseKey|null, loc|null, t|null }].
 * `loc` ({ structureId|null, roomId|null, pos|null }) is the fact's captured
 * killing-moment location (CORPSE-TRUTH-1 finish); null on legacy facts AND on
 * roster-derived entries — consumers must degrade those to node-level truth,
 * never assign a guessed room or cell.
 */
export function remainsAtNode(world, nodeId) {
  const nid = String(nodeId || '');
  const out = [];
  if (!nid) return out;
  const seenNpc = new Set();
  for (const fact of findDeathFacts(world)) {
    if (!fact || fact.victim?.isPlayer) continue;
    if (String(fact.nodeId || '') !== nid) continue;
    const src = fact.victim?.sourceNpcId ? String(fact.victim.sourceNpcId) : null;
    if (src) {
      if (seenNpc.has(src)) continue;
      seenNpc.add(src);
    }
    out.push({
      name: String(fact.victim?.name || 'something'),
      kind: src ? 'npc' : 'monster',
      sourceNpcId: src,
      archetype: fact.victim?.archetype ? String(fact.victim.archetype) : null,
      corpseKey: fact.victim?.corpseKey ? String(fact.victim.corpseKey) : null,
      loc: (fact.loc && typeof fact.loc === 'object') ? {
        structureId: fact.loc.structureId != null ? String(fact.loc.structureId) : null,
        roomId: fact.loc.roomId != null ? String(fact.loc.roomId) : null,
        pos: (fact.loc.pos && typeof fact.loc.pos === 'object') ? { ...fact.loc.pos } : null,
      } : null,
      t: fact.t == null ? null : Number(fact.t)
    });
  }
  const node = (Array.isArray(world?.map?.nodes) ? world.map.nodes : []).find(n => n && String(n.id) === nid);
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  for (const npc of npcs) {
    const id = String(npc?.id || '');
    if (!id || seenNpc.has(id)) continue;
    const saved = world?.meta?.npcCombatHp?.[id];
    if (!saved || !(saved.down || Number(saved.hp) <= 0)) continue;
    seenNpc.add(id);
    out.push({ name: String(npc.name || 'a body'), kind: 'npc', sourceNpcId: id, archetype: null, corpseKey: null, loc: null, t: null });
  }
  return out;
}
