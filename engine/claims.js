// Epistemic claim system — deterministic, zero LLM calls.
//
// Two-variance wall:
//   Ontological variance  → collapses on engine observation (engine/resolve.js)
//   Epistemic variance    → lives here; accumulates in claims, NEVER collapses engine truth
//
// A claim = one NPC's belief about a subject. The engine owns what actually happened;
// claims are what people think happened. They are never promoted to engine fact without
// a non-LLM step. The body is always null — the LLM supplies distorted prose at speak-time.
//
// Claim schema:
//   id           "${subject}:${holderNpcId}"  — one record per (subject, holder) pair
//   subject      stable key: e.g. "gallows_watch_fall", "iron_key_founding"
//   eventRef     timeline event id (e.g. "scarFormed:7") or null
//   holderNpcId  NPC who holds this belief
//   originNpcId  NPC who first minted it
//   distortion   [0,1] cumulative drift from the raw observation; grows per hop
//   weight       [0,1] belief strength; starts 1.0, decays WEIGHT_DECAY per hop
//   provenance   ordered chain of npcIds this claim traveled (includes holderNpcId last)
//   born         world.time.turn when this copy was created

// ── mintClaim ─────────────────────────────────────────────────────────────────
//
// Stamps a seed claim on a direct witness. Call this when the engine observes an
// event that an NPC would form a belief about.
//
// mintClaim(world, {
//   subject        — stable key for what this is about ("gallows_watch_fall")
//   eventRef       — timeline event id (e.g. "scarFormed:7"), or null
//   witnessNpcId   — NPC who directly observed the event
//   initialDistortion — [0,1], default 0. Set > 0 if the witness only heard about
//                      it secondhand at mint time (e.g. rumor-mint vs. direct obs)
// }) → world
//
// Rules:
//   - If the witness already holds a STRONGER claim on the same subject, no-op.
//   - A direct observation (distortion 0, weight 1.0) always beats a propagated copy.
//   - Two-variance wall: this creates an epistemic record only. Engine truth is untouched.
//
export function mintClaim(world, { subject, eventRef = null, witnessNpcId, initialDistortion = 0 }) {
  if (!subject || !witnessNpcId) return world;

  const claims = Array.isArray(world.claims) ? world.claims : [];
  const turn   = world.time?.turn ?? 0;

  const id     = `${subject}:${witnessNpcId}`;
  const weight = 1.0;
  const dist   = Math.min(1, Math.max(0, Number(initialDistortion) || 0));

  // Don't overwrite a stronger existing claim (shouldn't happen for seed mints, but guard anyway).
  const existing = claims.find(c => c.id === id);
  if (existing && (existing.weight ?? 0) >= weight && (existing.distortion ?? 1) <= dist) {
    return world;
  }

  const seedClaim = {
    id,
    subject: String(subject),
    eventRef: eventRef ? String(eventRef) : null,
    holderNpcId: String(witnessNpcId),
    originNpcId: String(witnessNpcId),
    distortion: dist,
    weight,
    provenance: [String(witnessNpcId)],
    born: turn,
  };

  const nextClaims = existing
    ? claims.map(c => c.id === id ? seedClaim : c)
    : [...claims, seedClaim];

  return { ...world, claims: nextClaims };
}

const MIN_WEIGHT      = 0.05;  // claims below this floor are inert; won't propagate
const WEIGHT_DECAY    = 0.85;  // multiplied per hop
const ANCHOR_MULT     = 1.2;   // prior beliefs get this bonus when resisting displacement
const MAX_DIST_BUMP   = 0.15;  // max additional distortion per hop (rng-scaled [0, bump])

// propagateClaims(world, rng, opts?)
//
// opts.onEvent(event) — optional trace callback. Called synchronously for each
// decision point. Zero cost when omitted. Event shapes:
//   { type: 'attenuated',    from, weight }
//   { type: 'cycle_blocked', from, to }
//   { type: 'weight_floor',  from, weight }
//   { type: 'fracture',      subject, keeper, keeperWeight, keeperDistortion,
//                             rejectedFrom, rejectedWeight, selfPres,
//                             priorStr, incomingStr, srcCred }
//   { type: 'spread',        subject, from, to, hops, distortion, weight, provenance }
//
export function propagateClaims(world, rng, { onEvent } = {}) {
  const emit = typeof onEvent === 'function' ? onEvent : null;

  const claims = Array.isArray(world.claims) ? world.claims : [];
  if (!claims.length) return world;

  // Index all settlement NPCs by id for O(1) lookup.
  const npcIndex = new Map();
  const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  for (const node of nodes) {
    const npcs = Array.isArray(node.settlement?.npcs) ? node.settlement.npcs : [];
    for (const npc of npcs) {
      if (npc.id) npcIndex.set(npc.id, npc);
    }
  }

  const turn = world.time?.turn ?? 0;
  const incoming = [];

  for (const claim of claims) {
    if ((claim.weight ?? 0) < MIN_WEIGHT) continue;

    const holder = npcIndex.get(claim.holderNpcId);
    if (!holder) continue;

    // Step 1 — Attenuation gate: probability = claim.weight.
    // Weaker claims propagate less often.
    if (rng.nextFloat() > (claim.weight ?? 0)) {
      emit?.({ type: 'attenuated', from: claim.holderNpcId, weight: claim.weight });
      continue;
    }

    // Step 2 — Pick one social neighbor (bond > 0).
    const rels = holder.relationships ?? {};
    const friends = Object.keys(rels).filter(id => (rels[id]?.bond ?? 0) > 0);
    if (!friends.length) continue;
    const targetId = rng.pick(friends);

    // Step 3 — Cycle guard: don't re-propagate to anyone already in provenance.
    // Terminates: provenance grows by 1/hop, so no infinite loops.
    const provenance = Array.isArray(claim.provenance) ? claim.provenance : [claim.originNpcId];
    if (provenance.includes(targetId)) {
      emit?.({ type: 'cycle_blocked', from: claim.holderNpcId, to: targetId });
      continue;
    }

    const target = npcIndex.get(targetId);
    if (!target) continue;

    // Step 4 — Weight decay + distortion bump.
    const newWeight = (claim.weight ?? 1) * WEIGHT_DECAY;
    if (newWeight < MIN_WEIGHT) {
      emit?.({ type: 'weight_floor', from: claim.holderNpcId, weight: newWeight });
      continue;
    }
    const newDistortion = Math.min(1, (claim.distortion ?? 0) + rng.nextFloat() * MAX_DIST_BUMP);

    // Step 5 — Resistance gate: fractures population rather than correcting it.
    // A self-preserving NPC anchors to their prior; an honest source carries more weight.
    const priorIdx = claims.findIndex(c => c.holderNpcId === targetId && c.subject === claim.subject);
    if (priorIdx !== -1) {
      const prior = claims[priorIdx];
      const selfPres          = target.personality?.selfPreservation ?? 0.5;
      const priorStrength     = (prior.weight ?? 0) * ANCHOR_MULT * selfPres;
      const sourceCredibility = holder.personality?.honesty ?? 0.5;
      const incomingStrength  = newWeight * sourceCredibility;
      // Prior survives → population fractures; both versions exist in different NPCs.
      if (incomingStrength <= priorStrength) {
        emit?.({
          type: 'fracture',
          subject: claim.subject,
          keeper: targetId,
          keeperWeight: prior.weight,
          keeperDistortion: prior.distortion,
          rejectedFrom: claim.holderNpcId,
          rejectedWeight: newWeight,
          selfPres,
          priorStr: priorStrength,
          incomingStr: incomingStrength,
          srcCred: sourceCredibility,
        });
        continue;
      }
    }

    const newClaim = {
      id: `${claim.subject}:${targetId}`,
      subject: claim.subject,
      eventRef: claim.eventRef ?? null,
      holderNpcId: targetId,
      originNpcId: claim.originNpcId,
      distortion: newDistortion,
      weight: newWeight,
      provenance: [...provenance, targetId],
      born: turn,
    };

    emit?.({
      type: 'spread',
      subject: claim.subject,
      from: claim.holderNpcId,
      to: targetId,
      hops: provenance.length,
      distortion: newDistortion,
      weight: newWeight,
      provenance: newClaim.provenance,
    });

    incoming.push(newClaim);
  }

  if (!incoming.length) return world;

  // Merge: keep strongest version per (subject, holder). Use the ORIGINAL claims
  // array as the base — one tick advances each claim at most one hop.
  let nextClaims = [...claims];
  for (const nc of incoming) {
    const idx = nextClaims.findIndex(c => c.holderNpcId === nc.holderNpcId && c.subject === nc.subject);
    if (idx === -1) {
      nextClaims.push(nc);
    } else if (nc.weight > (nextClaims[idx].weight ?? 0)) {
      nextClaims[idx] = nc;
    }
  }

  return { ...world, claims: nextClaims };
}
