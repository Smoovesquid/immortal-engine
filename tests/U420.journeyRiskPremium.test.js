// U420–U423 — JR-1: journey = fast travel with a RISK PREMIUM.
//
// Tim's parameter (2026-07-04): "If you say, I wanna go to Greenwood [a different
// node], the DM can move you there, but you're probably gonna get surprised by
// bandits — you're gonna increase the chance you run into a negative consequence
// and be surprised by it, because you're essentially fast traveling."
//
// The asymmetry is the point: the explicit journey verb (post NODE-DESYNC-1 the ONLY
// node mover) rolls the encounter table at an ELEVATED rate versus walking the same
// ground cell by cell, and a journey-triggered ambush opens with the player SURPRISED
// (the enemy takes a free opening strike before the player can act). Walking the same
// route manually accrues NO premium and NO surprise — slowness buys vigilance.
//
// U420 — the premium: a journey rolls the elevated table; a walked arrival on the SAME
//         world snapshot rolls the base table. The premium is a strict MONOTONE SUPERSET
//         (every float that bites a walker also bites a traveller, plus a premium band
//         that bites only the traveller). Proven per-seed across a deterministic sweep —
//         NOT statistically.
// U421 — the surprise: a journey-triggered combat opens with combat.surprised === true and
//         the enemy having already struck (HP down before the player's first turn); a
//         walked-into combat opens with combat.surprised === false and the player intact.
// U422 — interruption: an interrupted multi-hop journey commits an HONEST en-route position
//         (a real intermediate node, never the void, never a silent completion) and the
//         narration NAMES where.
// U423 — narration hygiene (THE LAW: narrate the read, never the number): journey PROSE
//         (arrival / travel / road framing) carries no encounter-chance number or mechanics
//         token; the mech line carries the trace.
//
// Pure, LLM-off (deterministic). Builds a minimal escape world and drives the real
// player gesture (playerMove) plus the exported encounter rolls.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { newWorld, ensureWorld } from '../engine/state.js';
import {
  playerMove,
  maybeTravelEncounter,
  maybeSpawnEscapeEncounter,
  JOURNEY_ENCOUNTER_CHANCE,
  ESCAPE_ENCOUNTER_CHANCE,
  JOURNEY_LEG_CHANCE,
  MULTIHOP_LEG_CHANCE
} from '../engine/playloop.js';
import { initEscapeHp } from '../engine/combat/escapeCombat.js';
import { buildPreRolledCharacter } from '../engine/chargen/preRolled.js';
import { biomeForNode } from '../engine/world/biome.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function loadPacks() {
  const packsDir = path.join(ROOT, 'packs');
  const manifest = normalizeManifest(JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf-8')));
  const out = {};
  for (const p of manifest.packs) out[p.id] = normalizePack(JSON.parse(fs.readFileSync(path.join(ROOT, p.path), 'utf-8')));
  return out;
}
const PACKS = loadPacks();

// Beast-country biomes: a wild node in one of these draws a BEAST ambush (immediate
// combat) rather than a brigand standoff (pending). Keeping the wild node in beast
// country lets the journey and the walked arrival agree on encounter KIND, so the
// only difference under test is the RATE / the surprise footing.
const BEAST = new Set(['forest', 'marsh', 'mountains', 'desert', 'arctic', 'wilderness']);
const isBeastCountry = (seed) => BEAST.has(biomeForNode(seed, { x: 1, y: 0, id: 'wild' }));

// A minimal escape world: a home settlement (0,0) with a single edge east to a wild
// wood at (1,0). Escape HP is initialized (as the live boot does) so a surprise round
// deals damage instead of instakilling a 0-HP placeholder.
function buildWorld(seed, extra = null) {
  const pc = buildPreRolledCharacter({ id: 'bryn' });
  const w0 = newWorld({ seed, fate: 0.2, campaignId: `campaign-${seed}`, pack: { primaryId: 'fantasy', mixerId: null }, mode: 'escape' });
  let w = ensureWorld({ ...w0, party: [pc] });
  const home = { id: 'home', name: 'Home Hollow', x: 0, y: 0, nodeType: 'settlement', tags: ['village'], discovered: true, settlement: { decompressed: true, region: null, npcs: [] } };
  const wild = { id: 'wild', name: 'Ashen Wood', x: 1, y: 0, nodeType: 'wilderness', tags: ['forest'], discovered: true };
  const nodes = extra ? [home, wild, ...extra.nodes] : [home, wild];
  const edges = extra ? [{ a: 'home', b: 'wild' }, ...extra.edges] : [{ a: 'home', b: 'wild' }];
  const discovered = extra ? ['home', 'wild', ...extra.discovered] : ['home', 'wild'];
  w = { ...w, map: { ...ensureWorld(w).map, nodes, edges, currentNodeId: 'home', pos: { x: 0, y: 0 }, discovered } };
  w = initEscapeHp(w);
  return ensureWorld(w);
}

// A world already STANDING at the wild node (as if just arrived from home), so both
// encounter rolls see the identical (after-node, timeline) snapshot → the identical
// seeded float. before = 'home'.
function snapshotAtWild(seed) {
  const w = buildWorld(seed);
  return ensureWorld({ ...w, map: { ...w.map, currentNodeId: 'wild', pos: { x: 1, y: 0 } } });
}

test('U420: the risk premium is a strict monotone superset of the walking risk (deterministic, per-seed)', () => {
  // The premium exists and is positive at both the single-hop and per-leg thresholds.
  assert.ok(JOURNEY_ENCOUNTER_CHANCE > ESCAPE_ENCOUNTER_CHANCE, 'a journey rolls a HIGHER encounter chance than a walked arrival');
  assert.ok(JOURNEY_LEG_CHANCE > MULTIHOP_LEG_CHANCE, 'a journey leg rolls a HIGHER chance than a walked leg');

  // On the SAME world snapshot the journey roll and the walked-arrival roll draw the
  // IDENTICAL seeded float (same seed string `<seed>|escapeEncounter|<node>|<timeline>`);
  // only the threshold differs. So the traveller is bitten on a strict superset of the
  // floats that bite the walker. Prove it per-seed over a fixed, reproducible sweep.
  let onlyJourney = 0;   // premium band: journey bites, walk does not
  let onlyWalk = 0;      // MUST stay zero — that would break monotonicity
  let both = 0;
  let tested = 0;
  for (let i = 0; i < 400; i++) {
    const seed = `u420-${i}`;
    if (!isBeastCountry(seed)) continue; // keep encounter KIND aligned (beast both sides)
    tested++;
    const w = snapshotAtWild(seed);
    const journeyBites = (() => {
      const r = maybeTravelEncounter(w, 'home', JOURNEY_ENCOUNTER_CHANCE, 'Ashen Wood');
      return r.kind === 'combat' || r.kind === 'pending';
    })();
    const walkBites = Boolean(maybeSpawnEscapeEncounter(w, 'home', ESCAPE_ENCOUNTER_CHANCE).combat?.active);
    if (journeyBites && !walkBites) onlyJourney++;
    else if (!journeyBites && walkBites) onlyWalk++;
    else if (journeyBites && walkBites) both++;
  }
  assert.ok(tested >= 50, `enough beast-country seeds sampled (got ${tested})`);
  // The load-bearing determinism claim: NEVER does walking bite while journeying does not.
  assert.equal(onlyWalk, 0, `walking must never carry risk the journey lacks (monotone superset); got ${onlyWalk} counter-examples`);
  // And the premium is REAL: there exist seeds where the journey is bitten and the walk is not.
  assert.ok(onlyJourney > 0, `the premium must actually catch extra encounters (found ${onlyJourney} premium-band seeds)`);
  // Sanity: the aligned floats also share the "both bite" region.
  assert.ok(both > 0, 'the base risk still bites both paths in the low-float region');
});

test('U421: a journey ambush opens SURPRISED (enemy first); a walked-into ambush does not', () => {
  // Find one beast-country seed that yields combat on BOTH the journey and the walk into
  // the same wild node. Deterministic seed selection (fixed sweep, first hit wins).
  let seed = null;
  for (let i = 0; i < 600; i++) {
    const s = `u421-${i}`;
    if (!isBeastCountry(s)) continue;
    const journey = playerMove(buildWorld(s), PACKS, 'go to the Ashen Wood').world;
    if (!journey.combat?.active) continue;
    const walk = playerMove(buildWorld(s), PACKS, 'go east').world;
    if (!walk.combat?.active || walk.map.currentNodeId !== 'wild') continue;
    seed = s; break;
  }
  assert.ok(seed, 'found a seed where both the journey and the walk into the wild wood start combat');

  const base = buildWorld(seed);
  const maxHp = Number(base.meta.escapeMaxHp);
  assert.ok(maxHp > 1, 'the party has real HP (surprise deals damage, does not instakill)');

  // JOURNEY: surprised, and the enemy has already struck (HP is below max before the
  // player's first turn).
  const journey = playerMove(base, PACKS, 'go to the Ashen Wood');
  assert.ok(journey.world.combat?.active, 'the journey opened combat');
  assert.equal(journey.world.combat.surprised, true, 'a journey ambush sets the surprise flag');
  assert.ok(Number(journey.world.meta.escapeHp) < maxHp, 'the enemy struck FIRST — HP is below max before the player acts');
  assert.match(String(journey.output.mechanics || ''), /surprise/i, `the mech line marks the surprise: ${journey.output.mechanics}`);

  // WALK into the same wood: NOT surprised, and the player is intact (they act first).
  const walk = playerMove(base, PACKS, 'go east');
  assert.ok(walk.world.combat?.active, 'the walk opened combat at the same node');
  assert.equal(walk.world.map.currentNodeId, 'wild', 'the walk arrived at the same wild node');
  assert.equal(walk.world.combat.surprised, false, 'a walked-into ambush does NOT set the surprise flag');
  assert.equal(Number(walk.world.meta.escapeHp), maxHp, 'the walker took no free hit — full HP, they act first');
});

test('U422: an interrupted journey commits an HONEST en-route position and names it', () => {
  // A 3-node chain: home(0,0) -> mid(1,0, beast) -> far(2,0). A journey to far must pass
  // through mid; a beast ambush at mid interrupts and drops the traveller AT mid.
  const chain = {
    nodes: [{ id: 'far', name: 'Farhold', x: 2, y: 0, nodeType: 'settlement', tags: ['village'], discovered: true, settlement: { decompressed: true, region: null, npcs: [] } }],
    edges: [{ a: 'wild', b: 'far' }],
    discovered: ['far']
  };
  // Reuse the 'wild' node (1,0) as the intermediate 'mid' — it is already beast-ish per
  // seed; pick a seed where (1,0) is beast country AND the leg is interrupted before far.
  let hit = null;
  for (let i = 0; i < 800 && !hit; i++) {
    const seed = `u422-${i}`;
    if (!isBeastCountry(seed)) continue;
    const r = playerMove(buildWorld(seed, chain), PACKS, 'go to Farhold');
    const stopped = String(r.world.map.currentNodeId);
    const interrupted = stopped !== 'far' && (r.world.combat?.active || r.world.travel?.pending);
    if (interrupted) hit = { seed, stopped, world: r.world, out: r.output };
  }
  assert.ok(hit, 'found a seed where the journey to Farhold is interrupted en route');

  // Honest position: dropped at a REAL intermediate node (the wild wood), not 'far',
  // not the void ('').
  assert.equal(hit.stopped, 'wild', 'the interrupted journey lands at the real intermediate node');
  assert.notEqual(hit.stopped, 'far', 'the journey did NOT silently complete to the destination');
  assert.notEqual(hit.stopped, '', 'the traveller is at a real node, never the void');
  assert.ok(hit.world.scene?.location, 'the scene has a concrete location, not a blank');

  // The narration NAMES where honestly (the intermediate wood, still short of Farhold).
  assert.match(hit.out.narration, /Ashen Wood|still short of Farhold/i, `names the honest en-route position: ${hit.out.narration}`);
  // And it never falsely claims arrival at the destination.
  assert.doesNotMatch(hit.out.narration, /you reach Farhold\b/i, `must not claim false arrival: ${hit.out.narration}`);
});

test('U423: journey PROSE carries no encounter-chance number/mechanics token; the mech line carries the trace', () => {
  // THE LAW: the player hears "the road felt watched," never "+30% encounter chance."
  // The premium's numbers live on the mech line (instrument trace) only.
  //
  // We assert over the journey NARRATION BANK: the set-out / arrival / travel-beat /
  // road-framing prose the journey handler emits. (Combat damage beats — "strikes for 3"
  // — are combat prose, an established convention, and are excluded by only sampling
  // CLEAR journeys here.) The forbidden class is the risk-premium leak: a percent sign,
  // a "+N", or the words that would surface the mechanic (chance / premium / encounter %).
  const LEAK = /%|\+\s*\d|(?:\bencounter\s+chance\b)|\bpremium\b|\bmodifier\b|\bDC\b|d20|\bchance\s+of\b/i;
  // No bare standalone integers in clear-journey prose either (the arrival/time/premium
  // banks are word-based: "a short way", "good time" — never "+30%").
  const BARE_NUMBER = /\b\d+\b/;

  let clearSamples = 0;
  let anyPremiumFelt = 0;
  for (let i = 0; i < 120; i++) {
    const seed = `u423-${i}`;
    if (!isBeastCountry(seed)) continue;
    const r = playerMove(buildWorld(seed), PACKS, 'go to the Ashen Wood');
    // Only CLEAR journeys (no combat / no pending standoff) — that is the journey bank.
    if (r.world.combat?.active || r.world.travel?.pending) continue;
    if (String(r.world.map.currentNodeId) !== 'wild') continue;
    clearSamples++;
    const prose = String(r.output.narration || '');
    assert.doesNotMatch(prose, LEAK, `journey prose leaked a mechanic: ${prose}`);
    assert.doesNotMatch(prose, BARE_NUMBER, `journey prose leaked a bare number: ${prose}`);
    // The mech line still carries the instrument trace.
    assert.match(String(r.output.mechanics || ''), /travel|journey/i, `the mech line carries the journey trace: ${r.output.mechanics}`);
    if (/road was watching|covered it|marked the pace|were seen|good time/i.test(prose)) anyPremiumFelt++;
  }
  assert.ok(clearSamples >= 20, `sampled enough clear journeys (got ${clearSamples})`);
  // The felt premium reaches prose at least sometimes (the read, without the number).
  assert.ok(anyPremiumFelt > 0, 'the fast-travel premium is FELT in the prose on at least some clear journeys (the read, never the number)');
});
