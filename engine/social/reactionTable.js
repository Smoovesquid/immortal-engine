// engine/social/reactionTable.js — SP-1: the deed→faction reaction table.
//
// [[IG-11]] social physics: institutions are rule-bound actors too. When the player
// commits a deed in front of witnesses, the factions those witnesses belong to LEARN
// of it, and the player's standing with that institution moves — direction from the
// deed kind, MAGNITUDE from this table, never from the LLM (Biblioteca Vol 11 §7.3:
// "Do not allow the model's uncalibrated magnitude estimates to directly mutate
// canonical social state"). This is the M2 "faction disposition" remainder
// (docs/MORALITY_SYSTEM.md — "Institutional rejection | faction disposition (−100..100)").
//
// PURE + DETERMINISTIC: no rng, no I/O, no mutation. Same (world, deed) → same deltas.
// The deltas are dumb `factionRepDelta` ops routed through effectsCore.applyDeltas —
// this module proposes, the executor commits. Consumed state already exists
// (w.reputation.factions, npc.factionId), so NO new fields and NO WORLD_VERSION bump.
//
// The conduit is WITNESSES: a faction reacts only if one of its affiliated people saw
// the deed (npc.factionId, engine/npc/npcGenesis.js). One shift per faction per deed —
// an institution is informed once, it does not multiply by headcount. No witnesses →
// no institutional shift (an unseen crime is a matter for heat/detection, M6, not here).

// Severity bands — aligned with the producers' shared scale
// (DEED_SEV / SEV = { LIGHT: 5, MOD: 12, HEAVY: 20 } in engine/playloop.js and
// engine/magic/castConsequence.js). Data-authored deeds (storyEngine) map by value.
function severityBand(sev) {
  const s = Number(sev) || 0;
  if (s >= 20) return 'grave';
  if (s >= 10) return 'moderate';
  return 'light';
}

// The magnitudes. Asymmetric on purpose: standing is easier to lose than to earn
// (mirrors the witness-trust asymmetry in applyDeedCharges, and the design law
// "the light path is slower and harder, but it compounds" — docs/MORALITY_SYSTEM.md).
// Calibration anchor: npcBrain Pass F1 thresholds are −25 (wary), −50 (hostile),
// +50 (warm). At these values: 3 witnessed grave atrocities → the faction's people
// turn wary; 5 → hostile; ~9 witnessed grave good deeds → warm.
export const FACTION_REP = {
  dark:   { light: -2, moderate: -5, grave: -10 }, // cruelty | forbidden
  bright: { light:  1, moderate:  3, grave:   6 }, // mercy | aid | atonement
};

const DARK_KINDS = new Set(['cruelty', 'forbidden']);
const BRIGHT_KINDS = new Set(['mercy', 'aid', 'atonement']);

/**
 * deedFactionDeltas(world, deed) → Array<{ op:'factionRepDelta', factionId, by }>
 *
 * deed: { kind, severity, witnesses[], nodeId } — the same proposal shape the
 * producers already build for `recordDeed` (playloop applyDeedCharges, the coerced
 * build, castConsequence). Call it alongside recordDeed; apply in the same batch.
 *
 * Deterministic output order: sorted by factionId.
 */
export function deedFactionDeltas(world, deed) {
  const kind = String(deed?.kind || '');
  const table = DARK_KINDS.has(kind) ? FACTION_REP.dark
    : BRIGHT_KINDS.has(kind) ? FACTION_REP.bright
    : null;
  if (!table) return [];

  const witnesses = Array.isArray(deed?.witnesses) ? deed.witnesses.map(String) : [];
  if (!witnesses.length) return [];

  const nodeId = String(deed?.nodeId || '');
  const nodes = Array.isArray(world?.map?.nodes) ? world.map.nodes : [];
  const node = nodes.find(n => n && String(n.id) === nodeId);
  const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
  if (!npcs.length) return [];

  const factionIds = new Set(
    (Array.isArray(world?.factions) ? world.factions : [])
      .map(f => String(f?.id || ''))
      .filter(Boolean)
  );

  const witnessSet = new Set(witnesses);
  const informed = new Set();
  for (const npc of npcs) {
    if (!npc || !witnessSet.has(String(npc.id))) continue;
    const fid = String(npc.factionId || '').trim();
    if (!fid || !factionIds.has(fid)) continue;
    informed.add(fid);
  }
  if (!informed.size) return [];

  const by = table[severityBand(deed?.severity)];
  return [...informed]
    .sort((a, b) => a.localeCompare(b))
    .map(factionId => ({ op: 'factionRepDelta', factionId, by }));
}
