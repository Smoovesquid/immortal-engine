import { ensureWorld, ensureCombat, defaultCombat, VICE_AXES, VIRTUE_AXES, deriveCorruption, deriveVirtue } from './state.js';
import { addFact, addThreat, addQuestion } from './ledger.js';
import { ensureEnv } from './env/envCore.js';
import { ensureInstrumentLayer } from './instrument.js';
import { statMod, maxWounds } from './ruleset/core/stats.js';
import { applyCondition as applyConditionPure } from './combat/conditions.js';
import { ensureStructures } from './structures/structuresState.js';
import { DOOR_STATES } from './structures/doors.js';
import { escalationTier, heatAccrual } from './morality/escalation.js';

// MR-2a — the valid target states for the `door` op (canon door-state enum).
const DOOR_STATE_ENUM = new Set(DOOR_STATES);

// Data-driven delta executor. Pure and deterministic.
// Applies a list of ops to the world safely (clamps, initializes missing fields).

export function applyDeltas(world, deltas = []) {
  let w = ensureWorld(world);
  const ops = Array.isArray(deltas) ? deltas : [];

  // ── MP-2: standing-corruption snapshot at BATCH ENTRY (docs/MORAL_PHYSICS.md §4) ──
  // The escalation ladder grades a deed against the actor's ACCUMULATED standing coming
  // IN — not against the corruption this very deed adds (that would collapse the ladder:
  // a single helpless-kill bumps a vice axis to the pact threshold, so reading post-delta
  // would make the first atrocity leap straight to Tier 4, skipping the escalation).
  // Deeds are recorded in the SAME batch as their axisDelta bumps (playerMove, coerced
  // build, cast consequence), so we freeze each party entity's morality here, before any
  // op mutates it, and recordDeed reads this frozen "prior standing." Deterministic under
  // replay (batch-entry state is deterministic).
  const moralityAtEntry = new Map(); // entity id -> { corruption, heat }
  for (const e of (Array.isArray(w.party) ? w.party : [])) {
    if (!e || !e.id) continue;
    const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
    moralityAtEntry.set(String(e.id), {
      corruption: Number(mo.corruption ?? 0),
      heat: Number(mo.heat ?? 0),
    });
  }

  // ── Batch-stable furniture resolution (splice-proof; ROM-4) ──────────────
  // modifyFurniture/removeFurniture carry `furnitureId` = the piece's index in
  // node.furniture as it stood BEFORE this batch (emitted from ONE objectsHere
  // read per turn — llmPhysics.js). removeFurniture SPLICES, so once one fires
  // every LATER furniture op in the same batch is off by the count of removed
  // lower-indexed pieces — silently editing/removing the WRONG piece. Resolve
  // each op's index to the stable piece NAME here, against a per-node pre-batch
  // snapshot; the handlers below locate the piece by that name in the LIVE array
  // (names are unique per node — roomObjects.js). Splice-proof, while the splice
  // contract (length shrinks per remove) is preserved. Non-batch ops resolve to
  // the same piece the raw index would have hit, so behavior is unchanged.
  const furnitureName = new Map(); // op object -> resolved piece name ('' = unresolved)
  {
    const snapshots = new Map(); // nodeId -> node.furniture as of batch start
    for (const op of ops) {
      if (!op || (op.op !== 'modifyFurniture' && op.op !== 'removeFurniture')) continue;
      const nid = String(op.nodeId || '');
      if (!snapshots.has(nid)) {
        const node = (w.map?.nodes || []).find(n => n && String(n.id) === nid);
        snapshots.set(nid, Array.isArray(node?.furniture) ? node.furniture.slice() : []);
      }
      const snap = snapshots.get(nid);
      const idx = toInt(op.furnitureId ?? -1);
      furnitureName.set(op, (idx >= 0 && idx < snap.length) ? String(snap[idx]?.name ?? '') : '');
    }
  }

  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    const kind = String(op.op || '');

    if (kind === 'clock') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const cur = w.clocks?.[key] ?? 0;
      const next = clampInt(cur + by, 0, 12);
      w = { ...w, clocks: { ...w.clocks, [key]: next } };
      continue;
    }

    if (kind === 'resource') {
      const entityId = String(op.entityId || '');
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !key || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const resources = (e.resources && typeof e.resources === 'object') ? e.resources : {};
        const cur = toInt(resources[key] ?? 0);
        const next = clampInt(cur + by, 0, 999);
        return { ...e, resources: { ...resources, [key]: next } };
      });
      continue;
    }

    if (kind === 'wound') {
      const entityId = String(op.entityId || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const grit = e.stats?.GRIT ?? 10;
        const lvl = e.level ?? 1;
        const cap = maxWounds(lvl, statMod(grit));
        const cur = clampInt(e.wounds ?? 0, 0, cap);
        const next = clampInt(cur + by, 0, cap);
        return { ...e, wounds: next };
      });
      continue;
    }

    if (kind === 'stress') {
      const entityId = String(op.entityId || '');
      const by = toInt(op.by ?? 0);
      if (!entityId || !Number.isFinite(by) || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const cur = clampInt(e.stress ?? 0, 0, 6);
        const next = clampInt(cur + by, 0, 6);
        return { ...e, stress: next };
      });
      continue;
    }

    // ── v22 — morality (the Dark Path) deltas ──────────────────────────────
    // Pure, deterministic mutations on party[i].morality and world.deeds. M0.5
    // plumbing: wired here so later milestones (deed detector, consequences,
    // patrons, crime) only emit deltas, never touch state directly. No RNG.
    // 'party' is the player SENTINEL used by events; the real entity id is pc_*,
    // so resolve it to party[0] (else mutateEntity silently no-ops). See M1.
    if (kind === 'corruptionDelta' || kind === 'virtueDelta') {
      const field = kind === 'corruptionDelta' ? 'corruption' : 'virtue';
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const by = toInt(op.by ?? 0);
      if (by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
        const next = clampInt((mo[field] ?? 0) + by, 0, 100);
        return { ...e, morality: { ...mo, [field]: next } };
      });
      continue;
    }

    if (kind === 'axisDelta') {
      // v23 — bump one of the fourteen sin/virtue accumulators, then recompute the
      // derived corruption/virtue summaries. The seven-axis soul is the source of truth.
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const axis = String(op.axis || '');
      const by = toInt(op.by ?? 0);
      if (!axis || by === 0) continue;
      if (!VICE_AXES.includes(axis) && !VIRTUE_AXES.includes(axis)) continue;
      w = mutateEntity(w, entityId, (e) => {
        const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
        const axes = { ...(mo.axes && typeof mo.axes === 'object' ? mo.axes : {}) };
        for (const k of [...VICE_AXES, ...VIRTUE_AXES]) axes[k] = clampInt(axes[k] ?? 0, 0, 100);
        axes[axis] = clampInt((axes[axis] ?? 0) + by, 0, 100);
        return { ...e, morality: { ...mo, axes, corruption: deriveCorruption(axes), virtue: deriveVirtue(axes) } };
      });
      continue;
    }

    if (kind === 'adjustHeat') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const by = toInt(op.by ?? 0);
      if (by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
        const next = Math.max(0, toInt(mo.heat ?? 0) + by);
        return { ...e, morality: { ...mo, heat: next } };
      });
      continue;
    }

    if (kind === 'setPatron') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const patronId = String(op.patronId || '');
      const by = toInt(op.by ?? 0);
      if (!patronId || by === 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
        const patrons = (mo.patrons && typeof mo.patrons === 'object') ? { ...mo.patrons } : {};
        patrons[patronId] = clampInt((toInt(patrons[patronId] ?? 0)) + by, -100, 100);
        return { ...e, morality: { ...mo, patrons } };
      });
      continue;
    }

    if (kind === 'lockMorality') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      w = mutateEntity(w, entityId, (e) => {
        const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
        return { ...e, morality: { ...mo, locked: true } };
      });
      continue;
    }

    if (kind === 'recordDeed') {
      const VALID = new Set(['cruelty', 'forbidden', 'mercy', 'aid', 'atonement']);
      const deedKind = VALID.has(String(op.deedKind)) ? String(op.deedKind) : '';
      if (!deedKind) continue;
      const t = toInt(op.t ?? (Array.isArray(w.timeline) ? w.timeline.length : 0));
      const severity = clampInt(toInt(op.severity ?? 1), 0, 100);
      const witnesses = Array.isArray(op.witnesses) ? op.witnesses.map(String) : [];
      // MP-2 — grade the act on the ONE escalation ladder and carry the tier on the
      // record (docs/MORAL_PHYSICS.md §4). recordDeed is the single chokepoint every
      // moral-fact source flows through (playerMove deed pass, coerced-build, cast
      // consequence, story arcs), so tagging here means every deed carries an
      // authoritative 0..4 loudness — no emitter can forget, and downstream packets
      // (MP-3 heat→hunt, MP-4 corruption→pact, MP-5 surfacing) read ONE number. Pure +
      // deterministic (reads the actor's live corruption/heat + this deed's witnesses);
      // T3/T4 are COMPUTED here but NOT ACTED ON (that is MP-3/MP-4). No player-facing
      // string is touched — the tier is silent structured state (invariant I). Standing
      // corruption/heat come from the BATCH-ENTRY snapshot (prior accumulation), not the
      // post-delta entity — see moralityAtEntry above.
      const actorId = resolvePlayerEntityId(w, op.actorId);
      const standing = moralityAtEntry.get(actorId)
        || (() => { const a = findPlayerEntity(w, op.actorId); return { corruption: Number(a?.morality?.corruption ?? 0), heat: Number(a?.morality?.heat ?? 0) }; })();
      // The wild = a deed with no settlement witnesses (§6): reach 0 AND the slow, no-claim
      // "getting away with it" accrual. Witnesses present ⇒ not wild.
      const wild = witnesses.length === 0;
      const tier = escalationTier(
        { severity, kind: deedKind },
        standing,
        { witnessReach: witnesses.length, wild }
      );
      const deed = {
        t: Math.max(0, t),
        actorId: String(op.actorId || 'party'),
        kind: deedKind,
        severity,
        witnesses,
        nodeId: String(op.nodeId || ''),
        summary: String(op.summary || '').slice(0, 200),
        tier
      };
      const deeds = Array.isArray(w.deeds) ? [...w.deeds, deed].slice(-64) : [deed];
      w = { ...w, deeds };
      // MP-3 (docs/MORAL_PHYSICS.md §4) — HEAT ACCRUAL, at the SAME chokepoint as the tier
      // so every emitter (playerMove deed pass, coerced build, cast consequence, story arcs)
      // accrues uniformly and none can forget. Cruelty/forbidden add heat scaled by severity
      // + witnesses, reduced by the actor's WITS (concealment); a wild deed accrues slowly and
      // mints no claim (the asymmetry). mercy/aid/atonement — and every FAIR kill (which never
      // records a cruelty deed, U556) — add ZERO. Heat is SILENT structured state, the
      // accumulator MP-3's world-tick reads to send the hunt at HUNT_HEAT; no player-facing
      // string is touched (invariant I). Pure + deterministic (batch-entry heat + this deed's
      // engine-set severity/witnesses + the actor's WITS); the hunt itself fires in worldTick,
      // NOT here (this is the accrual, not the effect).
      const actorEntity = findPlayerEntity(w, op.actorId);
      const gained = heatAccrual(
        { severity, kind: deedKind },
        actorEntity,
        { witnessReach: witnesses.length, wild }
      );
      // Base off the LIVE heat (reflects any earlier accruing deed in THIS batch), so two
      // atrocities in one turn COMPOUND rather than the second clobbering the first. (The
      // TIER above deliberately reads batch-entry `standing` — a first atrocity must not
      // self-boost its own tier — but the accumulator is additive and must not lose a deed.)
      const liveHeat = Number(actorEntity?.morality?.heat ?? standing.heat ?? 0);
      const nextHeat = Math.max(0, Math.round(liveHeat + gained));
      // Stamp heat + lastDeedT on the actor so the hunt has an accumulator and decay math has
      // an anchor (resolve the 'party' sentinel to the real player entity).
      w = mutateEntity(w, resolvePlayerEntityId(w, op.actorId), (e) => {
        const mo = (e.morality && typeof e.morality === 'object') ? e.morality : {};
        return { ...e, morality: { ...mo, heat: nextHeat, lastDeedT: deed.t } };
      });
      continue;
    }

    if (kind === 'condition') {
      const entityId = String(op.entityId || '');
      if (!entityId) continue;
      const fullCond = (op.cond && typeof op.cond === 'object') ? op.cond : null;
      const add = String(op.add || '').trim();
      if (!fullCond && !add) continue;
      w = mutateEntity(w, entityId, (e) => {
        const conditions = Array.isArray(e.conditions) ? e.conditions : [];
        if (fullCond) {
          const next = applyConditionPure(conditions, fullCond, e.conditionImmunities);
          if (next === conditions) return e;
          return { ...e, conditions: next };
        }
        if (conditions.some(c => String(c?.name) === add)) return e;
        const cond = { name: add, until: op.until ?? null };
        return { ...e, conditions: [cond, ...conditions].slice(0, 12) };
      });
      continue;
    }

    // partyConditions — the REPLACE counterpart of the additive `condition` op
    // above. The `condition` op can only add/stack; there was no delta that
    // could write a *decremented or expired* conditions array back onto the
    // player entity, so a bleed on the PLAYER could tick but never stop (see
    // the bleed note in combat/combatResolve.js). This mirrors the enemy-side
    // `combatState.enemyConditions` replace-op, but targets w.party — the
    // player lives there, NOT under w.combat, so it can't ride the combatState
    // op. Shape: { op:'partyConditions', set:[{ id, conditions }] } (array,
    // like enemyConditions) or the single-target { op:'partyConditions',
    // entityId, conditions }. The 'party' sentinel resolves to party[0]. The
    // array is written wholesale — that IS the point (expressing "these
    // expired / the save landed"). Deterministic: pure array replacement, no RNG.
    if (kind === 'partyConditions') {
      const rows = Array.isArray(op.set)
        ? op.set
        : (op.entityId !== undefined || op.conditions !== undefined)
          ? [{ id: op.entityId, conditions: op.conditions }]
          : [];
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const entityId = resolvePlayerEntityId(w, row.id ?? row.entityId);
        const conds = Array.isArray(row.conditions) ? row.conditions.slice(0, 8) : [];
        w = mutateEntity(w, entityId, (e) => ({ ...e, conditions: conds }));
      }
      continue;
    }

    if (kind === 'position') {
      const entityId = String(op.entityId || '');
      const set = op.set && typeof op.set === 'object' ? op.set : null;
      if (!entityId || !set) continue;
      w = mutateEntity(w, entityId, (e) => {
        const prev = (e.position && typeof e.position === 'object') ? e.position : {};
        const next = { ...prev, ...set };
        if (next.zone) next.zone = clampZone(next.zone);
        return { ...e, position: next };
      });
      continue;
    }

    // TAC-2 — the canonical tactical position (cells-in-canon, `pos`; distinct from
    // the renderer's pixel `position` above). The tactical move verb commits a walk
    // here: { op:'pos', id, to:{ frame, gx, gy } } (or a flat { frame, gx, gy }). The
    // resolver (engine/map/spatial/tacticalPos.js) already clamped to the ≤6-cell
    // budget and kept the cell in-frame (in-room / same-node), so this is a pure
    // write — the shape is normalised (integer cells) and ensureWorld's pos invariant
    // is the real guard on the frame/room/node projection. `id` 'party' → party[0].
    // Only party members carry a mutable pos through this path (mutateEntity no-ops
    // for a non-party id); a null `to` clears the actor's pos (a legal absent state).
    if (kind === 'pos') {
      const entityId = resolvePlayerEntityId(w, op.id ?? op.entityId);
      const raw = (op.to !== undefined) ? op.to : op.pos;
      let nextPos = null;
      if (raw && typeof raw === 'object' && !Array.isArray(raw)
          && Number.isFinite(Number(raw.gx)) && Number.isFinite(Number(raw.gy))
          && raw.frame != null && String(raw.frame) !== '') {
        nextPos = { frame: String(raw.frame), gx: Math.trunc(Number(raw.gx)), gy: Math.trunc(Number(raw.gy)) };
      } else if (raw !== null && raw !== undefined) {
        continue; // malformed pos — ignore rather than corrupt state
      }
      w = mutateEntity(w, entityId, (e) => ({ ...e, pos: nextPos }));
      continue;
    }

    // MR-2a — the canon DOOR-STATE op (docs/briefs/MR-2-FUNCTIONAL-INK.md §MR-2a).
    // The SOLE path that changes a door's state: { op:'door', structId, doorId,
    // to:'open'|'shut'|'barred'|'locked', how? }. Every door-state change (a shut
    // door opened as part of a move, a bar lifted, a lock picked/forced, a wary
    // householder bolting up) routes here — no direct writes. `to` must be a valid
    // enum state and `doorId` an existing door of the structure; anything malformed
    // is ignored rather than corrupting state. FORCED / PICKED entry mints a ledger
    // FACT (the moral-physics witness seam — consequence, not blocking): a broken or
    // picked door is a fact the world can later react to. `how` is 'forced' |
    // 'picked' | 'opened' | '' (only forced/picked mint the fact).
    if (kind === 'door') {
      const structId = String(op.structId ?? op.structureId ?? '');
      const doorId = String(op.doorId ?? '');
      const to = String(op.to ?? '');
      if (!structId || !doorId || !DOOR_STATE_ENUM.has(to)) continue;
      const st = w.structures?.byId?.[structId] || null;
      const doors = Array.isArray(st?.doors) ? st.doors : null;
      if (!st || !doors) continue;
      const idx = doors.findIndex(d => d && String(d.id) === doorId);
      if (idx < 0) continue;
      if (String(doors[idx].state) === to) continue; // no-op — already in that state
      const nextDoors = doors.map((d, i) => (i === idx ? { ...d, state: to } : d));
      const nextSt = { ...st, doors: nextDoors };
      w = { ...w, structures: { ...w.structures, byId: { ...w.structures.byId, [structId]: nextSt } } };
      // Witness fact on forced/picked entry (both open a secured door by force of
      // hand). A quiet open/shut/lock does not mint one.
      const how = String(op.how ?? '');
      if ((how === 'forced' || how === 'picked') && to === 'open') {
        const doorLabel = doors[idx].exterior ? 'the door' : 'an inner door';
        const verb = how === 'forced' ? 'forced open' : 'picked the lock on';
        w = addFact(w, `${verb === 'forced open' ? 'Forced open' : 'Picked the lock on'} ${doorLabel} of ${structId}`, 'action');
      }
      continue;
    }

    if (kind === 'time') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const cur = w.time?.[key] ?? 0;
      const next = clampInt(cur + by, 0, 999999);
      w = { ...w, time: { ...(w.time || { turn: 0, scene: 0 }), [key]: next } };
      continue;
    }

    if (kind === 'env') {
      const key = String(op.key || '');
      const by = toInt(op.by ?? 0);
      if (!key || !Number.isFinite(by) || by === 0) continue;
      const env = ensureEnv(w.env);
      if (!(key in env)) continue;
      const next = { ...env, [key]: clampInt(env[key] + by, 0, 6) };
      w = { ...w, env: next };
      continue;
    }

    if (kind === 'advantage') {
      const actorId = String(op.actorId || '');
      const by = toInt(op.by ?? 0);
      if (!actorId || !Number.isFinite(by) || by === 0) continue;
      const prior = (w.meta.advantageTokens && typeof w.meta.advantageTokens === 'object') ? w.meta.advantageTokens : {};
      const cur = clampInt(prior[actorId] ?? 0, 0, 2);
      const next = clampInt(cur + by, 0, 2);
      w = { ...w, meta: { ...w.meta, advantageTokens: { ...prior, [actorId]: next } } };
      continue;
    }

    if (kind === 'npcTrustDelta') {
      // Update NPC trust level in settlement data; mark NPC as having met the player.
      const npcId = String(op.npcId || '');
      const by = toInt(op.by ?? 0);
      if (!npcId || !by) continue;
      w = mutateNpc(w, npcId, npc => {
        const cs = npc.conversationState ?? { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null };
        return { ...npc, conversationState: { ...cs, metPlayer: true, trustLevel: clampInt(cs.trustLevel + by, 0, 10), lastInteraction: w.time?.turn ?? 0 } };
      });
      continue;
    }

    if (kind === 'factionRepDelta') {
      // SP-1 — player↔faction standing. A dumb clamped write to
      // w.reputation.factions[factionId] (−100..100). MAGNITUDE comes from the
      // deterministic reaction table (engine/social/reactionTable.js), never the LLM
      // (Biblioteca Vol 11). Unknown factions are a no-op: ensureReputation keeps only
      // keys for factions that exist, so writing a stray key would be normalized away
      // and desync the hash image — refuse it here instead.
      const factionId = String(op.factionId || '');
      const by = toInt(op.by ?? 0);
      if (!factionId || !by) continue;
      const exists = Array.isArray(w.factions) && w.factions.some(f => f && String(f.id) === factionId);
      if (!exists) continue;
      const rep = (w.reputation && typeof w.reputation === 'object') ? w.reputation : { factions: {} };
      const repFactions = (rep.factions && typeof rep.factions === 'object') ? rep.factions : {};
      const cur = clampInt(toInt(repFactions[factionId] ?? 0), -100, 100);
      w = { ...w, reputation: { ...rep, factions: { ...repFactions, [factionId]: clampInt(cur + by, -100, 100) } } };
      continue;
    }

    if (kind === 'npcSecretRevealed') {
      // Mark a secret as revealed
      const npcId = String(op.npcId || '');
      const secretFactId = String(op.secretFactId || '');
      if (!npcId || !secretFactId) continue;
      w = mutateNpc(w, npcId, npc => {
        const revealed = Array.isArray(npc.revealedSecrets) ? [...npc.revealedSecrets] : [];
        if (!revealed.includes(secretFactId)) revealed.push(secretFactId);
        return { ...npc, revealedSecrets: revealed };
      });
      // Also add to ledger as a canonical fact
      w = addFact(w, `secret:${secretFactId} revealed by ${npcId}`, 'npc');
      continue;
    }

    if (kind === 'npcKnowledgeShared') {
      // Add player-shared knowledge to NPC + track topic in conversationState (cap 20, FIFO).
      const npcId = String(op.npcId || '');
      const fact = String(op.fact || '');
      if (!npcId || !fact) continue;
      w = mutateNpc(w, npcId, npc => {
        const kg = Array.isArray(npc.knowledgeGraph) ? [...npc.knowledgeGraph] : [];
        kg.push({ factId: `player_shared:${fact}`, source: 'player', confidence: 1.0, event: null });
        const cs = npc.conversationState ?? { metPlayer: false, topicsDiscussed: [], trustLevel: 5, lastInteraction: null };
        let topics = Array.isArray(cs.topicsDiscussed) ? [...cs.topicsDiscussed] : [];
        topics.push(fact);
        if (topics.length > 20) topics = topics.slice(topics.length - 20);
        return { ...npc, knowledgeGraph: kg, conversationState: { ...cs, metPlayer: true, topicsDiscussed: topics, lastInteraction: w.time?.turn ?? 0 } };
      });
      continue;
    }

    if (kind === 'npcMemoryAdd') {
      const npcId = String(op.npcId || '');
      const entry = op.entry;
      // Support both string and object entries (Pass D2)
      const memEntry = (entry && typeof entry === 'object')
        ? { text: String(entry.text || '').trim(), turn: Math.max(0, Math.trunc(Number(entry.turn) || 0)), salience: clamp01f(entry.salience ?? 1.0) }
        : String(entry || '').trim();
      const memText = typeof memEntry === 'object' ? memEntry.text : memEntry;
      if (!npcId || !memText) continue;
      w = mutateNpc(w, npcId, npc => {
        const memory = Array.isArray(npc.memory) ? [...npc.memory] : [];
        // Deduplicate by text content
        const exists = memory.some(m => {
          const t = typeof m === 'object' ? String(m.text || '') : String(m);
          return t === memText;
        });
        if (exists) return npc;
        memory.push(memEntry);
        // FIFO eviction if over cap 12
        while (memory.length > 12) memory.shift();
        return { ...npc, memory };
      });
      continue;
    }

    if (kind === 'rollRequest') {
      // Roll requests are informational — stored in timeline for the playloop to process
      const action = String(op.action || '');
      if (action) {
        const t = w.timeline.length;
        w = { ...w, timeline: [...w.timeline, { t, kind: 'rollRequest', data: { action, dcSuggestion: op.dcSuggestion, stat: op.stat } }] };
      }
      continue;
    }

    if (kind === 'threadRelief') {
      // Relief valve: reduce tension on the most tense open thread.
      const by = toInt(op.by ?? -1);
      if (!Number.isFinite(by) || by === 0) continue;
      const inst = ensureInstrumentLayer(w.instrument);
      const open = inst.threads
        .filter(t => t.status !== 'resolved' && t.tension > 0)
        .sort((a, b) => (b.tension - a.tension) || a.id.localeCompare(b.id));
      if (open.length) {
        const target = open[0];
        const threads = inst.threads.map(t => {
          if (t.id !== target.id) return t;
          const tension = clampInt(t.tension + by, 0, 5);
          const status = tension < 3 && t.status === 'escalating' ? 'open' : t.status;
          return { ...t, tension, status };
        });
        w = { ...w, instrument: { ...inst, threads } };
      }
      continue;
    }

    if (kind === 'ledger') {
      if (op.addFact) w = addFact(w, op.addFact, op.source || 'resolution');
      if (op.addThreat) w = addThreat(w, op.addThreat, op.level ?? 1);
      if (op.addQuestion) w = addQuestion(w, op.addQuestion);
      continue;
    }

    if (kind === 'combatState') {
      // Pass 5: sole mutation path for world.combat. Accepts a partial merge
      // (top-level fields + enemies replacement) plus per-enemy hp deltas and
      // defeated markers. Re-normalized via ensureCombat after merging.
      const cur = w.combat ? { ...w.combat, enemies: Array.isArray(w.combat.enemies) ? w.combat.enemies.map(e => ({ ...e })) : [] } : defaultCombat();
      let enemies = cur.enemies;

      const set = op.set && typeof op.set === 'object' ? op.set : null;
      if (set && Array.isArray(set.enemies)) {
        enemies = set.enemies.map(e => ({ ...e }));
      }

      // enemyHpDelta: array of { id, by }
      if (Array.isArray(op.enemyHpDelta)) {
        for (const eh of op.enemyHpDelta) {
          if (!eh || typeof eh !== 'object') continue;
          const id = String(eh.id ?? '');
          const by = toInt(eh.by ?? 0);
          if (!id || !by) continue;
          enemies = enemies.map(e => {
            if (String(e.id) !== id) return e;
            const maxHp = Number.isInteger(e.maxHp) ? e.maxHp : 1;
            const cur0 = Number.isInteger(e.hp) ? e.hp : maxHp;
            const next = clampInt(cur0 + by, 0, maxHp);
            return { ...e, hp: next, defeated: next === 0 };
          });
        }
      }

      // enemyDefeated: array of enemy ids to flag defeated (and zero hp).
      if (Array.isArray(op.enemyDefeated)) {
        const ids = new Set(op.enemyDefeated.map(String));
        enemies = enemies.map(e => ids.has(String(e.id)) ? { ...e, hp: 0, defeated: true } : e);
      }

      // CM2: enemyConditions — array of { id, conditions } to set conditions on enemies.
      if (Array.isArray(op.enemyConditions)) {
        for (const ec of op.enemyConditions) {
          if (!ec || typeof ec !== 'object') continue;
          const id = String(ec.id ?? '');
          if (!id) continue;
          const conds = Array.isArray(ec.conditions) ? ec.conditions : [];
          enemies = enemies.map(e => String(e.id) === id ? { ...e, conditions: conds } : e);
        }
      }

      const merged = {
        active: set && 'active' in set ? Boolean(set.active) : cur.active,
        round: set && 'round' in set ? toInt(set.round) : cur.round,
        turnIndex: set && 'turnIndex' in set ? toInt(set.turnIndex) : cur.turnIndex,
        beganAt: set && 'beganAt' in set ? toInt(set.beganAt) : cur.beganAt,
        reason: set && 'reason' in set ? String(set.reason ?? '') : cur.reason,
        playerGuard: set && 'playerGuard' in set ? Boolean(set.playerGuard) : cur.playerGuard,
        companionGuard: set && 'companionGuard' in set ? Boolean(set.companionGuard) : cur.companionGuard,
        // JR-1: surprise flag (a journey/fast-travel ambush opened on the enemy's terms).
        surprised: set && 'surprised' in set ? Boolean(set.surprised) : cur.surprised,
        // CM6: initiativeOrder
        initiativeOrder: set && 'initiativeOrder' in set ? set.initiativeOrder : (cur.initiativeOrder || []),
        // MX-1: engine-owned tactical grid and player cell.
        grid: set && 'grid' in set ? set.grid : cur.grid,
        playerCell: set && 'playerCell' in set ? set.playerCell : cur.playerCell,
        // DX-2a: player tactical position (re-normalized by ensureCombat).
        playerTactical: set && 'playerTactical' in set ? set.playerTactical : cur.playerTactical,
        enemies
      };

      w = { ...w, combat: ensureCombat(merged) };
      continue;
    }

    if (kind === 'timeline') {
      const text = String(op.add || '').trim();
      if (!text) continue;
      const t = w.timeline.length;
      const e = { t, kind: 'note', data: { text } };
      w = { ...w, timeline: [...w.timeline, e] };
      continue;
    }

    // ── Physics ops ────────────────────────────────────────────────────────
    // Produced by llmPhysics.evaluatePhysics() (LLM or offline fallback) when
    // the player interacts with furniture or items.

    if (kind === 'createItem') {
      const entityId = String(op.entityId || '');
      const bucket = String(op.bucket || 'junk');
      const item = op.item && typeof op.item === 'object' ? op.item : null;
      if (!entityId || !item || !item.name) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = (e.inventory && typeof e.inventory === 'object') ? e.inventory : {};
        const arr = Array.isArray(inv[bucket]) ? [...inv[bucket]] : [];
        arr.push({
          name: String(item.name),
          tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 6) : [],
          weight: clampInt(item.weight ?? 1, 0, 5),
          noise: clampInt(item.noise ?? 0, 0, 5),
          light: clampInt(item.light ?? 0, 0, 5),
          bulk: clampInt(item.bulk ?? 1, 0, 5),
          notes: String(item.notes || '')
        });
        return { ...e, inventory: { ...inv, [bucket]: arr } };
      });
      continue;
    }

    if (kind === 'removeItem') {
      const entityId = String(op.entityId || '');
      const bucket = String(op.bucket || '');
      const itemName = String(op.itemName || '');
      if (!entityId || !bucket || !itemName) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = (e.inventory && typeof e.inventory === 'object') ? e.inventory : {};
        const arr = Array.isArray(inv[bucket]) ? inv[bucket] : [];
        const idx = arr.findIndex(i => String(i?.name) === itemName);
        if (idx === -1) return e;
        const next = arr.slice();
        next.splice(idx, 1);
        return { ...e, inventory: { ...inv, [bucket]: next } };
      });
      continue;
    }

    if (kind === 'modifyFurniture') {
      const nodeId = String(op.nodeId || '');
      const rawId = toInt(op.furnitureId ?? -1);
      const resolvedName = furnitureName.get(op) || '';
      const changes = op.changes && typeof op.changes === 'object' ? op.changes : null;
      if (!nodeId || !changes || (!resolvedName && rawId < 0)) continue;
      w = mutateNode(w, nodeId, (node) => {
        const furniture = Array.isArray(node.furniture) ? [...node.furniture] : [];
        // Splice-proof: locate the piece by its batch-resolved stable name; fall
        // back to the raw index only when the name couldn't be resolved (older or
        // hand-built deltas). See the batch-stable pre-pass at the top of applyDeltas.
        let fi = resolvedName ? furniture.findIndex(f => String(f?.name ?? '') === resolvedName) : -1;
        if (fi < 0) fi = rawId;
        if (fi < 0 || fi >= furniture.length) return node;
        const cur = furniture[fi] || {};
        const next = { ...cur };
        if (typeof changes.state === 'string') next.state = changes.state;
        if (Array.isArray(changes.parts)) next.parts = changes.parts.map(String);
        if (typeof changes.notes === 'string') next.notes = changes.notes;
        // PW-1 (prose-to-world contract): items taken OUT of a container piece.
        // View-subtraction overlay — the pure containerContents derivation is never
        // edited; readers subtract this list. Deduped, capped, deterministic order.
        if (Array.isArray(changes.takenItems)) {
          next.takenItems = [...new Set(changes.takenItems.map(String))].slice(0, 8);
        }
        furniture[fi] = next;
        return { ...node, furniture };
      });
      continue;
    }

    // ── Pass C1 — companions ───────────────────────────────────────────────
    // Recruit mints a party entity from a settlement NPC. Pure state mutation:
    // no randomness, no LLM. Source NPC is removed from the settlement so it
    // cannot be re-recruited or talked to again. Dismiss removes a companion
    // from the party without restoring them to a settlement.

    if (kind === 'recruitCompanion') {
      const sourceNpcId = String(op.sourceNpcId || '').trim();
      const nodeId = String(op.nodeId || w.map?.currentNodeId || '');
      if (!sourceNpcId || !nodeId) continue;

      const party = Array.isArray(w.party) ? w.party : [];
      if (party.length >= 3) continue;
      if (party.some(p => p?.companion?.sourceNpcId === sourceNpcId)) continue;

      const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
      const nodeIdx = nodes.findIndex(n => n && n.id === nodeId);
      if (nodeIdx === -1) continue;
      const node = nodes[nodeIdx];
      const npcs = Array.isArray(node?.settlement?.npcs) ? node.settlement.npcs : [];
      const npcIdx = npcs.findIndex(n => n && String(n.id) === sourceNpcId);
      if (npcIdx === -1) continue;
      const sourceNpc = npcs[npcIdx];

      // Remove NPC from settlement.
      const nextNpcs = npcs.slice();
      nextNpcs.splice(npcIdx, 1);
      const nextNodes = nodes.slice();
      nextNodes[nodeIdx] = { ...node, settlement: { ...node.settlement, npcs: nextNpcs } };

      const player = party[0] || {};
      const playerPos = (player.position && typeof player.position === 'object') ? player.position : { zone: 'far' };
      const minted = mintCompanionFromNpc(sourceNpc, playerPos, w.time?.turn ?? 0);
      const nextParty = [...party, minted];

      w = { ...w, party: nextParty, map: { ...w.map, nodes: nextNodes } };
      continue;
    }

    if (kind === 'dismissCompanion') {
      const entityId = String(op.entityId || '').trim();
      if (!entityId) continue;
      const party = Array.isArray(w.party) ? w.party : [];
      const idx = party.findIndex(e => String(e?.id) === entityId);
      if (idx <= 0) continue; // not found, or trying to dismiss player
      if (!party[idx]?.companion) continue;
      const nextParty = party.slice();
      nextParty.splice(idx, 1);
      w = { ...w, party: nextParty };
      continue;
    }

    // ── Pass T2 — structured item ops for inventory.items[] ────────────────
    // These operate on the new object-array items schema from T1.
    // The legacy createItem/removeItem (string-based, bucket-oriented) above
    // remain for backward compat.

    if (kind === 'addItem') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const item = op.item;
      if (!item || typeof item !== 'object') continue;
      const id = String(item.id ?? '').trim();
      const defRef = String(item.defRef ?? '').trim();
      if (!id || !defRef) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        if (items.some(it => it.id === id)) return e; // no dupes
        const qty = Math.max(1, Math.trunc(Number(item.qty)) || 1);
        // v26 — stackables: merge into an existing unequipped stack of the
        // same defRef instead of minting a parallel instance.
        if (op.merge) {
          const idx = items.findIndex(it => it.defRef === defRef && !it.equipped);
          if (idx !== -1) {
            const cur = items[idx];
            items[idx] = { ...cur, qty: Math.max(1, Number(cur.qty) || 1) + qty };
            return { ...e, inventory: { ...inv, items } };
          }
        }
        const minted = qty > 1 ? { id, defRef, equipped: item.equipped ?? null, qty } : { id, defRef, equipped: item.equipped ?? null };
        // P-77 — identity fields ride through the sole mutation path.
        const sealedRef = String(item.sealedRef ?? '').trim();
        if (sealedRef) minted.sealedRef = sealedRef;
        if (item.attuned === true) minted.attuned = true;
        items.push(minted);
        return { ...e, inventory: { ...inv, items } };
      });
      continue;
    }

    if (kind === 'removeItemById') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const itemId = String(op.itemId ?? '').trim();
      if (!itemId) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        return { ...e, inventory: { ...inv, items: items.filter(it => it.id !== itemId) } };
      });
      continue;
    }

    // P-71 — consume N of a defRef across unequipped stacks (crafting inputs).
    if (kind === 'consumeItems') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const defRef = String(op.defRef ?? '').trim();
      let need = Math.max(0, Math.trunc(Number(op.qty)) || 0);
      if (!defRef || need <= 0) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = [];
        for (const it of (Array.isArray(inv.items) ? inv.items : [])) {
          if (need <= 0 || it.defRef !== defRef || it.equipped) { items.push(it); continue; }
          const have = Math.max(1, Number(it.qty) || 1);
          const take = Math.min(have, need);
          need -= take;
          const left = have - take;
          if (left > 0) items.push(left > 1 ? { ...it, qty: left } : { id: it.id, defRef: it.defRef, equipped: it.equipped });
        }
        return { ...e, inventory: { ...inv, items } };
      });
      continue;
    }

    if (kind === 'equipItem') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const itemId = String(op.itemId ?? '').trim();
      const slot = String(op.slot ?? '').trim();
      if (!itemId || !slot) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        const updated = items.map(it => {
          if (it.equipped === slot && it.id !== itemId) return { ...it, equipped: null };
          if (it.id === itemId) return { ...it, equipped: slot };
          return it;
        });
        return { ...e, inventory: { ...inv, items: updated } };
      });
      continue;
    }

    if (kind === 'unequipItem') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const itemId = String(op.itemId ?? '').trim();
      if (!itemId) continue;
      w = mutateEntity(w, entityId, (e) => {
        const inv = e.inventory || {};
        const items = Array.isArray(inv.items) ? [...inv.items] : [];
        const updated = items.map(it => it.id === itemId ? { ...it, equipped: null } : it);
        return { ...e, inventory: { ...inv, items: updated } };
      });
      continue;
    }

    // ── Pass CM5 — currency ops ──────────────────────────────────────────────

    if (kind === 'addCurrency') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const currency = String(op.currency ?? '').trim();
      const amount = Math.max(0, Math.trunc(Number(op.amount ?? 0)));
      if (!currency || amount <= 0) continue;
      const VALID = ['copper', 'silver', 'gold', 'platinum'];
      if (!VALID.includes(currency)) continue;
      w = mutateEntity(w, entityId, (e) => {
        const purse = (e.purse && typeof e.purse === 'object') ? { ...e.purse } : { copper: 0, silver: 0, gold: 0, platinum: 0 };
        purse[currency] = (purse[currency] || 0) + amount;
        return { ...e, purse };
      });
      continue;
    }

    // P-67 — replace the whole purse (trade settlements: pay + change in one
    // atomic write; the playloop validates affordability BEFORE issuing this).
    if (kind === 'setPurse') {
      const entityId = resolvePlayerEntityId(w, op.entityId);
      const src = (op.purse && typeof op.purse === 'object') ? op.purse : null;
      if (!src) continue;
      const purse = {};
      for (const c of ['copper', 'silver', 'gold', 'platinum']) {
        purse[c] = Math.max(0, Math.trunc(Number(src[c] ?? 0)));
      }
      w = mutateEntity(w, entityId, (e) => ({ ...e, purse }));
      continue;
    }

    // ── Pass R1 — rumor ops ─────────────────────────────────────────────────

    if (kind === 'mintRumor') {
      const rumor = op.rumor;
      if (!rumor || typeof rumor !== 'object') continue;
      const id = String(rumor.id ?? '').trim();
      const sourceSeedId = String(rumor.sourceSeedId ?? '').trim();
      const carrierNpcId = String(rumor.carrierNpcId ?? '').trim();
      const body = String(rumor.body ?? '').trim();
      if (!id || !sourceSeedId || !body) continue;

      const existing = Array.isArray(w.rumors) ? w.rumors : [];
      if (existing.some(r => r.id === id)) continue;
      if (existing.length >= 64) continue;

      const shaped = {
        id,
        sourceSeedId,
        carrierNpcId,
        hopCount: clampInt(rumor.hopCount ?? 0, 0, 99),
        tier: clampInt(rumor.tier ?? 0, 0, 4),
        age: clampInt(rumor.age ?? 0, 0, 9999),
        mintedAt: clampInt(rumor.mintedAt ?? 0, 0, 999999),
        body,
        tags: Array.isArray(rumor.tags) ? rumor.tags.map(String).slice(0, 8) : []
      };

      w = { ...w, rumors: [...existing, shaped] };

      // Add rumorId to carrier NPC's rumorIds (current node only —
      // minting happens during dialogue at the player's node).
      if (carrierNpcId) {
        w = mutateNpc(w, carrierNpcId, npc => {
          const ids = Array.isArray(npc.rumorIds) ? [...npc.rumorIds] : [];
          if (!ids.includes(id)) ids.push(id);
          return { ...npc, rumorIds: ids };
        });
      }

      continue;
    }

    if (kind === 'forgetRumor') {
      const rumorId = String(op.rumorId ?? '').trim();
      if (!rumorId) continue;
      const rumors = Array.isArray(w.rumors) ? w.rumors : [];
      const idx = rumors.findIndex(r => r.id === rumorId);
      if (idx === -1) continue;
      const forgotten = rumors[idx];
      const nextRumors = rumors.slice();
      nextRumors.splice(idx, 1);
      w = { ...w, rumors: nextRumors };

      // Remove from carrier NPC's rumorIds (current node).
      if (forgotten.carrierNpcId) {
        w = mutateNpc(w, forgotten.carrierNpcId, npc => {
          const ids = Array.isArray(npc.rumorIds) ? [...npc.rumorIds] : [];
          return { ...npc, rumorIds: ids.filter(rid => rid !== rumorId) };
        });
      }

      continue;
    }

    // ── Pass T3 — spell slot & concentration ops ────────────────────────────

    // v24 — XP award. party[0] only (solo advancement; companions later).
    if (kind === 'gainXp') {
      const amount = toInt(op.amount ?? 0);
      if (amount <= 0) continue;
      const party = Array.isArray(w.party) ? w.party : [];
      if (!party[0]) continue;
      const nextParty = [...party];
      nextParty[0] = { ...party[0], xp: Math.max(0, toInt(party[0].xp ?? 0) + amount) };
      w = { ...w, party: nextParty };
      continue;
    }

    if (kind === 'learnSpell') {
      const spellRef = String(op.spellRef || '').trim();
      if (!spellRef) continue;
      const party = Array.isArray(w.party) ? w.party : [];
      if (!party[0]) continue;
      const spells = party[0].spells || { known: [], slots: {}, maxSlots: {}, concentration: null };
      if (spells.known.includes(spellRef)) continue;
      const nextSpells = { ...spells, known: [...spells.known, spellRef] };
      const nextParty = [...party];
      nextParty[0] = { ...party[0], spells: nextSpells };
      w = { ...w, party: nextParty };
      continue;
    }

    if (kind === 'consumeSpellSlot') {
      const level = toInt(op.level ?? 0);
      if (level < 1 || level > 5) continue;
      const party = Array.isArray(w.party) ? w.party : [];
      if (!party[0]) continue;
      const spells = party[0].spells || { known: [], slots: {}, maxSlots: {}, concentration: null };
      const cur = toInt(spells.slots?.[level] ?? 0);
      const next = Math.max(0, cur - 1);
      const nextSpells = { ...spells, slots: { ...spells.slots, [level]: next } };
      const nextParty = [...party];
      nextParty[0] = { ...party[0], spells: nextSpells };
      w = { ...w, party: nextParty };
      continue;
    }

    if (kind === 'setConcentration') {
      const party = Array.isArray(w.party) ? w.party : [];
      if (!party[0]) continue;
      const spells = party[0].spells || { known: [], slots: {}, maxSlots: {}, concentration: null };
      const spellRef = op.spellRef ? String(op.spellRef).trim() : '';
      const concentration = spellRef ? { spellRef, startedAt: toInt(op.startedAt ?? 0) } : null;
      const nextSpells = { ...spells, concentration };
      const nextParty = [...party];
      nextParty[0] = { ...party[0], spells: nextSpells };
      w = { ...w, party: nextParty };
      continue;
    }

    if (kind === 'restoreSpellSlots') {
      const party = Array.isArray(w.party) ? w.party : [];
      if (!party[0]) continue;
      const spells = party[0].spells || { known: [], slots: {}, maxSlots: {}, concentration: null };
      const maxSlots = spells.maxSlots || {};
      const restored = {};
      for (const lvl of [1, 2, 3, 4, 5]) {
        restored[lvl] = toInt(maxSlots[lvl] ?? 0);
      }
      const nextSpells = { ...spells, slots: restored };
      const nextParty = [...party];
      nextParty[0] = { ...party[0], spells: nextSpells };
      w = { ...w, party: nextParty };
      continue;
    }

    if (kind === 'removeFurniture') {
      const nodeId = String(op.nodeId || '');
      const rawId = toInt(op.furnitureId ?? -1);
      const resolvedName = furnitureName.get(op) || '';
      if (!nodeId || (!resolvedName && rawId < 0)) continue;
      w = mutateNode(w, nodeId, (node) => {
        const furniture = Array.isArray(node.furniture) ? [...node.furniture] : [];
        // Splice-proof: find by the batch-resolved stable name (index fallback for
        // hand-built deltas), then splice — so an earlier remove in this batch can't
        // shift this one onto the wrong piece. See the pre-pass at applyDeltas' top.
        let fi = resolvedName ? furniture.findIndex(f => String(f?.name ?? '') === resolvedName) : -1;
        if (fi < 0) fi = rawId;
        if (fi < 0 || fi >= furniture.length) return node;
        furniture.splice(fi, 1);
        return { ...node, furniture };
      });
      continue;
    }

    // P-72 — write a player-built structure (lean-to, palisade…) into the world.
    // id is minted from nextId; the structure persists, joins worldHash, and is
    // a real structure that can later shelter NPCs, be entered, or be burned.
    if (kind === 'buildStructure') {
      const src = (op.structure && typeof op.structure === 'object') ? op.structure : null;
      if (!src || !String(src.nodeId || '')) continue;
      const cur = ensureStructures(w.structures);
      const id = `pb:${cur.nextId}`;
      const byId = { ...cur.byId, [id]: { ...src, id } };
      w = { ...w, structures: { ...cur, byId, nextId: cur.nextId + 1 } };
      continue;
    }

    // D0 — reveal a deterministic structure (a dungeon level) under its OWN id.
    // Unlike buildStructure the id is supplied (seed-derived), and the op is
    // IDEMPOTENT: re-descending a dungeon you've already opened is a no-op, so
    // the lazy materialization stays replay-stable under worldHash.
    if (kind === 'addStructure') {
      const src = (op.structure && typeof op.structure === 'object') ? op.structure : null;
      const sid = src ? String(src.id || '') : '';
      if (!src || !sid || !String(src.nodeId || '')) continue;
      const cur = ensureStructures(w.structures);
      if (cur.byId[sid]) continue;                 // already revealed — idempotent
      const byId = { ...cur.byId, [sid]: { ...src, id: sid } };
      w = { ...w, structures: { ...cur, byId } };
      continue;
    }

    // D1b — tag a structure's room (e.g. 'cleared' once its denizen is roused,
    // 'looted' once its treasure is taken). Persisted in the topology (tags
    // survive normalizeTopology), so the crawl's progress is canon + replay-stable.
    // Idempotent: re-tagging is a no-op.
    if (kind === 'tagRoom') {
      const sid = String(op.structureId || ''), rid = String(op.roomId || ''), tag = String(op.tag || '');
      if (!sid || !rid || !tag) continue;
      const cur = ensureStructures(w.structures);
      const st = cur.byId[sid];
      if (!st || !st.topology || !Array.isArray(st.topology.rooms)) continue;
      let changed = false;
      const rooms = st.topology.rooms.map(r => {
        if (r.id !== rid || (r.tags || []).includes(tag)) return r;
        changed = true; return { ...r, tags: [...(r.tags || []), tag] };
      });
      if (!changed) continue;
      const byId = { ...cur.byId, [sid]: { ...st, topology: { ...st.topology, rooms } } };
      w = { ...w, structures: { ...cur, byId } };
      continue;
    }

    // setPartyMark — append a one-way experiential mark to party[0].marks[].
    // Used by the aperture slice: 'vision:root' is set when the player takes
    // the pale root, gating witness-object reveal and heretic recognition.
    // Idempotent — re-marking is a no-op.
    if (kind === 'setPartyMark') {
      const mark = String(op.mark || '').trim();
      if (!mark) continue;
      const party = Array.isArray(w.party) ? w.party : [];
      if (!party[0]) continue;
      const existing = Array.isArray(party[0].marks) ? party[0].marks : [];
      if (existing.includes(mark)) continue;
      const nextParty = [...party];
      nextParty[0] = { ...party[0], marks: [...existing, mark] };
      w = { ...w, party: nextParty };
      continue;
    }
  }

  return w;
}

function mutateNode(world, nodeId, fn) {
  const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  const idx = nodes.findIndex(n => n.id === nodeId);
  if (idx === -1) return world;
  const nextNodes = nodes.slice();
  nextNodes[idx] = fn(nextNodes[idx]);
  return { ...world, map: { ...world.map, nodes: nextNodes } };
}

function mutateNpc(world, npcId, fn) {
  const nodeId = String(world.map?.currentNodeId ?? '');
  const nodes = Array.isArray(world.map?.nodes) ? world.map.nodes : [];
  const nodeIdx = nodes.findIndex(n => n.id === nodeId);
  if (nodeIdx === -1) return world;
  const node = nodes[nodeIdx];
  if (!node.settlement?.npcs?.length) return world;

  const npcIdx = node.settlement.npcs.findIndex(n =>
    n.id === npcId || String(n.name).toLowerCase() === String(npcId).toLowerCase()
  );
  if (npcIdx === -1) return world;

  const nextNpcs = [...node.settlement.npcs];
  nextNpcs[npcIdx] = fn(nextNpcs[npcIdx]);
  const nextNodes = [...nodes];
  nextNodes[nodeIdx] = { ...node, settlement: { ...node.settlement, npcs: nextNpcs } };
  return { ...world, map: { ...world.map, nodes: nextNodes } };
}

// Resolve the conventional player SENTINEL ('party', or empty) to the real player entity
// id (party[0].id, e.g. pc_*). A concrete id is returned unchanged. Without this, morality
// deltas aimed at 'party' silently no-op because no entity literally has id 'party'.
function resolvePlayerEntityId(world, entityId) {
  const id = String(entityId || 'party');
  if (id !== 'party') return id;
  return String(world?.party?.[0]?.id || 'party');
}

// Read-only lookup of the acting entity (resolves the 'party' sentinel to party[0]).
// Used by recordDeed's escalation-tier grading to read the actor's live morality
// without mutating. Returns the entity object or null.
function findPlayerEntity(world, entityId) {
  const id = resolvePlayerEntityId(world, entityId);
  const party = Array.isArray(world?.party) ? world.party : [];
  return party.find(e => e && String(e.id) === id) || party[0] || null;
}

function mutateEntity(world, entityId, fn) {
  const party = Array.isArray(world.party) ? world.party : [];
  const idx = party.findIndex(e => String(e?.id) === entityId);
  if (idx === -1) return world;
  const nextParty = party.slice();
  nextParty[idx] = fn(nextParty[idx]);
  return { ...world, party: nextParty };
}

function toInt(x) {
  const n = Math.trunc(Number(x));
  return Number.isFinite(n) ? n : 0;
}

function clampZone(z) {
  const s = String(z);
  return (s === 'far' || s === 'near' || s === 'engaged') ? s : 'near';
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function clamp01f(v) {
  const x = Number(v);
  return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
}

// Pass C1 — companion mint. Pure: deterministic stat synthesis from role,
// empty inventory, position copied from player, companion marker carrying
// provenance back to the source NPC. ensureWorld will re-normalize the
// shape and apply invariants on the next state read.
const COMPANION_ROLE_STAT_BUMP = {
  tavern_keeper: 'CHARM',
  innkeeper: 'CHARM',
  smith: 'MIGHT',
  priest: 'GRIT',
  merchant: 'CHARM',
  guard_captain: 'MIGHT',
  stable_hand: 'AGILITY',
  scholar: 'WITS',
  hedge_witch: 'WITS',
  artisan: 'AGILITY',
  elder: 'WITS',
  laborer: 'MIGHT',
  veteran: 'GRIT',
  trader: 'CHARM',
  healer: 'WITS',
  scavenger: 'AGILITY',
  mediator: 'CHARM',
  guard: 'MIGHT',
  representative: 'CHARM'
};

function mintCompanionFromNpc(npc, playerPosition, currentTurn) {
  const sourceId = String(npc?.id || '');
  const role = String(npc?.role || '');
  const trustRaw = Number(npc?.conversationState?.trustLevel ?? 5);
  const trustLevel = Number.isFinite(trustRaw)
    ? Math.max(0, Math.min(10, Math.trunc(trustRaw)))
    : 5;

  const stats = { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 };
  const bumpStat = COMPANION_ROLE_STAT_BUMP[role];
  if (bumpStat && stats[bumpStat] != null) {
    stats[bumpStat] = stats[bumpStat] + 2;
  }

  const position = playerPosition && typeof playerPosition === 'object'
    ? JSON.parse(JSON.stringify(playerPosition))
    : { zone: 'far' };

  return {
    id: `companion_${sourceId}`,
    name: String(npc?.name || sourceId || 'companion'),
    archetype: role || 'companion',
    vibe: 'companion',
    stress: 0,
    wounds: 0,
    stats,
    inventory: {
      weapons: [],
      armor: [],
      tools: [],
      clothes: [],
      spells: [],
      tech: [],
      oddities: [],
      consumables: [],
      junk: []
    },
    traits: {
      vibe: 'companion',
      fear: '',
      flaw: '',
      ideal: '',
      detail: '',
      keepsake: '',
      lineYouWontCross: '',
      rumor: ''
    },
    background: { name: role || '', tags: [], hook: '' },
    signature: { itemName: '', meaning: '' },
    position,
    companion: {
      sourceNpcId: sourceId,
      recruitedAtTurn: Math.max(0, Math.trunc(Number(currentTurn) || 0)),
      trustLevel,
      role
    }
  };
}
