// Story engine — casts arcs onto the generated world and ticks their stages.
// See docs/STORYLINE_SPEC.md. Everything here is deterministic and goes
// through existing systems: rumors (world.rumors), NPC knowledgeGraph facts,
// goal-contract-style predicates, applyDeltas (deeds), the ledger.
//
// The player never sees the word "arc": hooks are rumors, knowledge lives in
// NPCs, completions surface as narration + a debug mechanics tag only.

import { getArcs } from './registry.js';
import { applyDeltas } from '../effectsCore.js';
import { hasFact } from '../ledgerUtils.js';

const MAX_ACTIVE = 4;

// ── helpers ─────────────────────────────────────────────────────────────────

function sortedSettlementNodes(w) {
  return (Array.isArray(w.map?.nodes) ? w.map.nodes : [])
    .filter(n => n && Array.isArray(n?.settlement?.npcs) && n.settlement.npcs.length)
    .slice()
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function personalityOk(npc, pred) {
  if (!pred || typeof pred !== 'object') return true;
  for (const [axis, expr] of Object.entries(pred)) {
    const v = Number(npc?.personality?.[axis]);
    if (!Number.isFinite(v)) return false;
    const m = String(expr).match(/^(>=|<=|>|<)\s*([\d.]+)$/);
    if (!m) return false;
    const t = Number(m[2]);
    if (m[1] === '>' && !(v > t)) return false;
    if (m[1] === '<' && !(v < t)) return false;
    if (m[1] === '>=' && !(v >= t)) return false;
    if (m[1] === '<=' && !(v <= t)) return false;
  }
  return true;
}

function findCastMember(w, bind, taken) {
  for (const node of sortedSettlementNodes(w)) {
    for (const npc of node.settlement.npcs) {
      if (!npc?.id || !npc?.name) continue;
      if (npc.disposition === 'hostile') continue;
      const ref = `${npc.id}@${node.id}`;
      if (taken.has(ref)) continue;
      if (!bind.roles.includes(String(npc.role || ''))) continue;
      if (!personalityOk(npc, bind.personality)) continue;
      return { npc, node, ref };
    }
  }
  return null;
}

function resolveCast(w, castIds, role) {
  const ref = String(castIds?.[role] || '');
  const [npcId, nodeId] = ref.split('@');
  if (!npcId || !nodeId) return null;
  const node = (w.map?.nodes || []).find(n => n.id === nodeId);
  const npc = node?.settlement?.npcs?.find(n => String(n.id) === npcId) || null;
  return npc ? { npc, node } : null;
}

function fillTemplate(text, w, arc, castIds) {
  return String(text)
    .replace(/\{home\}/g, () => {
      const c = resolveCast(w, castIds, (arc.hooks?.[0]?.carrier) || arc.cast[0].role);
      return c?.node?.name || c?.node?.label || 'the village';
    })
    .replace(/\{carrier\}/g, () => {
      const c = resolveCast(w, castIds, (arc.hooks?.[0]?.carrier) || arc.cast[0].role);
      return c?.npc?.name || 'someone';
    })
    // P-74c — villain bindings. Arc data may name the adversary ONLY in
    // trust-guarded knowledge and post-defeat talk (rumor-first law lives in
    // the arc authoring, not here).
    .replace(/\{villainName\}/g, () => String(w.villain?.name || 'the adversary'))
    .replace(/\{villainEpithet\}/g, () => String(w.villain?.epithet || ''))
    .replace(/\{villainSeat\}/g, () => {
      const seat = (w.map?.nodes || []).find(n => n && String(n.id) === String(w.villain?.seatNodeId || ''));
      return seat?.name || seat?.label || 'the far place';
    })
    .replace(/\s{2,}/g, ' ');
}

// ── P-74c — villain bindings ────────────────────────────────────────────────

/** Deterministic id for an arc-planted hostile NPC. */
function plantedNpcId(arc, key) {
  return `npc_arc_${String(arc.arc).replace(/-/g, '_')}_${String(key)}`;
}

/** Resolve a plant's target node id ('@villainSeat' | '@castNode:<role>'). */
function plantNodeId(w, st, at) {
  const s = String(at || '');
  if (s === '@villainSeat') return String(w.villain?.seatNodeId || '');
  const m = s.match(/^@castNode:(.+)$/);
  if (m) return String(st.castIds?.[m[1]] || '').split('@')[1] || '';
  return s;
}

/**
 * Plant a stage's hostile NPC (lieutenant / villain incarnate) at its node.
 * Shape mirrors encounterSpawn's hostile-NPC mint so the attack intent and
 * mintEnemyFromNpc treat it like any other foe. Idempotent by id.
 */
function plantHostile(w, arc, st, stage) {
  const plan = stage?.plant;
  if (!plan || typeof plan !== 'object') return w;
  const nodeId = plantNodeId(w, st, plan.at);
  if (!nodeId) return w;
  const id = plantedNpcId(arc, plan.key);
  const nodes = Array.isArray(w.map?.nodes) ? w.map.nodes : [];
  const idx = nodes.findIndex(n => n && String(n.id) === nodeId);
  if (idx === -1) return w;
  const node = nodes[idx];
  const existing = node.settlement?.npcs || [];
  if (existing.some(n => String(n?.id) === id)) return w;

  const bestiaryRef = String(plan.bestiaryRef || '') === '@villainCreature'
    ? String(w.villain?.ref || '').replace(/^villain:/, '')
    : (plan.bestiaryRef || null);

  const npc = {
    id,
    name: fillTemplate(String(plan.name || 'a hostile figure'), w, arc, st.castIds),
    role: 'hostile',
    archetypeDesc: '',
    factionId: null,
    originTick: Number(w.time?.turn ?? 0),
    disposition: {},
    hostile: true,
    bestiaryRef,
    combatProfile: {
      maxHp: Math.max(1, Number(plan.maxHp) || 12),
      damage: Math.max(1, Number(plan.damage) || 4),
      canParley: false
    },
    knowledgeGraph: [],
    conversationState: { metPlayer: false, topicsDiscussed: [], trustLevel: 0, lastInteraction: null },
    personality: { honesty: 0.1, trustOfOutsiders: 0, selfPreservation: 0.2 },
    witnessedEvents: [],
    secrets: [],
    playerRelationship: { trust: 0, meetings: 0, sharedFacts: [] }
  };

  const updated = { ...node, settlement: { ...(node.settlement || {}), npcs: [...existing, npc] } };
  const nextNodes = [...nodes];
  nextNodes[idx] = updated;
  return { ...w, map: { ...w.map, nodes: nextNodes } };
}

/** Apply a stage/branch villainBind ('discover' | 'defeat') to world.villain. */
function applyVillainBind(w, bind) {
  if (!w.villain) return w;
  if (bind === 'discover' && !w.villain.discovered) {
    return { ...w, villain: { ...w.villain, discovered: true } };
  }
  if (bind === 'defeat' && !w.villain.defeated) {
    return { ...w, villain: { ...w.villain, discovered: true, defeated: true } };
  }
  return w;
}

function mintArcRumor(w, arc, castIds, body, n) {
  const rumors = Array.isArray(w.rumors) ? w.rumors : [];
  const id = `rumor:arc:${arc.arc}:${n}`;
  if (rumors.some(r => r.id === id)) return w;
  if (rumors.length >= 64) return w;
  const carrier = resolveCast(w, castIds, (arc.hooks?.[n]?.carrier) || arc.cast[0].role);
  const entry = {
    id,
    sourceSeedId: `arc:${arc.arc}:${n}`,
    carrierNpcId: String(carrier?.npc?.id || ''),
    hopCount: 0,
    // Tier 2 ("vague but real"): perspectiveFilter only volunteers tier 2+
    // at neutral trust — a tier-0 hook would sit silent until trust 7.
    tier: 2,
    age: 0,
    mintedAt: Math.max(0, Number(w.time?.hours ?? 0)),
    body: fillTemplate(body, w, arc, castIds),
    tags: ['arc', `arc:${arc.arc}`]
  };
  let next = { ...w, rumors: [...rumors, entry] };
  // The carrier must actually CARRY it — dialogue voices only npc.rumorIds.
  // From there propagateRumors spreads it through the county on world ticks.
  if (carrier) {
    const nodes = next.map.nodes.map(node => {
      if (node.id !== carrier.node.id) return node;
      const npcs = node.settlement.npcs.map(npc => {
        if (String(npc.id) !== String(carrier.npc.id)) return npc;
        const ids = Array.isArray(npc.rumorIds) ? npc.rumorIds : [];
        return ids.includes(id) ? npc : { ...npc, rumorIds: [...ids, id] };
      });
      return { ...node, settlement: { ...node.settlement, npcs } };
    });
    next = { ...next, map: { ...next.map, nodes } };
  }
  return next;
}

function plantKnows(w, arc, castIds) {
  let next = w;
  for (const c of arc.cast) {
    const resolved = resolveCast(next, castIds, c.role);
    if (!resolved) continue;
    const { node } = resolved;
    const nodes = next.map.nodes.map(n => {
      if (n.id !== node.id) return n;
      const npcs = n.settlement.npcs.map(npc => {
        if (String(npc.id) !== String(resolved.npc.id)) return npc;
        const kg = Array.isArray(npc.knowledgeGraph) ? npc.knowledgeGraph : [];
        const fresh = (c.knows || []).filter(k => !kg.some(f => f.factId === k.factId)).map(k => ({
          factId: k.factId,
          source: k.guard === 'trust' ? 'witnessed' : 'public',
          confidence: 0.95,
          // P-74c: knowledge bodies may carry villain/cast template vars.
          body: fillTemplate(String(k.body || ''), next, arc, castIds),
          event: { era: 0, eventId: k.factId, worldState: null }
        }));
        return fresh.length ? { ...npc, knowledgeGraph: [...kg, ...fresh] } : npc;
      });
      return { ...n, settlement: { ...n.settlement, npcs } };
    });
    next = { ...next, map: { ...next.map, nodes } };
  }
  return next;
}

// ── predicates ──────────────────────────────────────────────────────────────

function stageDone(w, arc, st, stage) {
  const dw = stage.doneWhen || {};
  if (dw.learned) {
    // dialogue records `npc:<id> shared:<factId>` in the ledger
    const facts = Array.isArray(w.ledger?.facts) ? w.ledger.facts : [];
    return facts.some(f => String(f?.text || '').includes(`shared:${dw.learned}`));
  }
  if (dw.reached) {
    let target = String(dw.reached);
    if (target === '@villainSeat') target = String(w.villain?.seatNodeId || '');
    const m = target.match(/^@castNode:(.+)$/);
    if (m) target = String(st.castIds?.[m[1]] || '').split('@')[1] || '';
    return target !== '' && String(w.map?.currentNodeId || '') === target;
  }
  if (dw.obtained) return hasFact(w, `obtained:${dw.obtained}`) || partyHasItem(w, dw.obtained);
  if (dw.talkedTo) {
    const c = resolveCast(w, st.castIds, dw.talkedTo);
    return c?.npc?.conversationState?.metPlayer === true;
  }
  if (dw.defeated) {
    const ref0 = String(dw.defeated);
    // P-74c: '@plant:<key>' resolves to the arc-planted hostile's npc id, and
    // checks world state instead of timeline kinds — after a victory the dead
    // enemy (sourceNpcId, hp 0) persists in world.combat.enemies until the
    // next fight begins, in both combat engines.
    const m = ref0.match(/^@plant:(.+)$/);
    if (m) {
      const ref = plantedNpcId(arc, m[1]);
      if (w.combat?.active) return false;
      return (w.combat?.enemies || []).some(e =>
        String(e?.sourceNpcId || '') === ref && (Number(e?.hp) || 0) <= 0
      );
    }
    const tl = Array.isArray(w.timeline) ? w.timeline : [];
    return tl.some(e => e?.kind === 'combatResolve' && JSON.stringify(e.data || {}).includes(ref0));
  }
  return false;
}

function partyHasItem(w, itemId) {
  const inv = w.party?.[0]?.inventory;
  if (!inv || typeof inv !== 'object') return false;
  for (const list of Object.values(inv)) {
    if (!Array.isArray(list)) continue;
    if (list.some(it => String(it?.id ?? it?.name ?? it ?? '') === String(itemId))) return true;
  }
  return false;
}

// ── public api ──────────────────────────────────────────────────────────────

/**
 * castArcs(world) -> world
 * Tries to fill every dormant arc's cast from materialized NPCs. On success:
 * plants knows[] facts, mints hook rumors, status → 'cast'. Idempotent; arcs
 * that can't cast yet stay dormant and retry on later calls.
 */
export function castArcs(world) {
  let w = world;
  for (const arc of getArcs()) {
    // Read story state from the LIVE world — earlier iterations of this loop
    // may have cast an arc, and we must see those castIds and counts.
    const arcs = (w.story && w.story.arcs) || {};
    const st = arcs[arc.arc];
    if (st && st.status !== 'dormant') continue;
    // P-74c: villain-bound arcs wait for the adversary to exist.
    if (arc.requiresVillain && !w.villain) continue;
    const activeCount = Object.values(arcs).filter(a => a.status === 'cast' || a.status === 'active').length;
    if (activeCount >= MAX_ACTIVE) break;

    // An NPC can star in only one arc at a time — seed `taken` with every
    // ref already cast by other arcs, then add this arc's picks as we go.
    const taken = new Set(
      Object.values(arcs).flatMap(a => Object.values(a.castIds || {}))
    );
    const castIds = {};
    let ok = true;
    for (const c of arc.cast) {
      const hit = findCastMember(w, c.bind, taken);
      if (!hit) { ok = false; break; }
      taken.add(hit.ref);
      castIds[c.role] = hit.ref;
    }
    if (!ok) {
      if (!st) w = writeArcState(w, arc.arc, { status: 'dormant', castIds: {}, stage: arc.stages[0].id, heardAtHours: -1, branch: '' });
      continue;
    }

    w = plantKnows(w, arc, castIds);
    arc.hooks.forEach((h, n) => { w = mintArcRumor(w, arc, castIds, h.rumor, n); });
    w = writeArcState(w, arc.arc, { status: 'cast', castIds, stage: arc.stages[0].id, heardAtHours: -1, branch: '' });
  }
  return w;
}

/**
 * tickArcs(world) -> { world, events }
 * Evaluates the current stage of every cast/active arc; advances stages,
 * resolves branches (deeds + rumors via applyDeltas), and fires abandonment
 * for arcs ignored past their afterDays window. events[] feed the timeline.
 */
export function tickArcs(world) {
  let w = world;
  const events = [];
  for (const arc of getArcs()) {
    const st = w.story?.arcs?.[arc.arc];
    if (!st || (st.status !== 'cast' && st.status !== 'active')) continue;

    // Abandonment: heard but ignored past the window.
    if (st.status === 'active' && st.heardAtHours >= 0) {
      const hours = Number(w.time?.hours ?? 0);
      if (hours - st.heardAtHours >= arc.abandonment.afterDays * 24) {
        w = applyDeltas(w, arc.abandonment.worldEffects || []);
        w = mintArcRumor(w, arc, st.castIds, arc.abandonment.rumor, 90);
        w = writeArcState(w, arc.arc, { ...st, status: 'abandoned' });
        events.push({ kind: 'arcAbandoned', data: { arc: arc.arc, stage: st.stage } });
        continue;
      }
    }

    const idx = arc.stages.findIndex(s => s.id === st.stage);
    if (idx === -1) continue;
    const stage = arc.stages[idx];
    if (!stageDone(w, arc, st, stage)) continue;

    w = applyDeltas(w, stage.worldEffects || []);
    // P-74c: a completing stage may bind to the villain (discovery is canon
    // the moment the name is learned).
    if (stage.villainBind) w = applyVillainBind(w, stage.villainBind);
    const isLast = idx === arc.stages.length - 1;
    if (!isLast) {
      const next = {
        ...st,
        status: 'active',
        stage: stage.spawns.nextStage,
        heardAtHours: idx === 0 ? Math.max(0, Number(w.time?.hours ?? 0)) : st.heardAtHours
      };
      w = writeArcState(w, arc.arc, next);
      // P-74c: the incoming stage may plant a hostile (the silencer, the
      // villain incarnate at its seat) — placed the moment the stage opens.
      const incoming = arc.stages.find(s => s.id === next.stage);
      if (incoming?.plant) w = plantHostile(w, arc, next, incoming);
      events.push({ kind: 'arcStage', data: { arc: arc.arc, done: stage.id, now: next.stage } });
    } else {
      const branchKey = 'default'; // v1: single-branch resolution; predicates later
      const branch = stage.branches[branchKey] || Object.values(stage.branches)[0];
      const deeds = (branch.deeds || []).map(d => ({
        op: 'recordDeed',
        deedKind: d.deedKind,
        severity: d.severity,
        actorId: 'party',
        nodeId: String(w.map?.currentNodeId || ''),
        summary: d.summary
      }));
      w = applyDeltas(w, [...deeds, ...(branch.worldEffects || [])]);
      // P-74c: resolving the confrontation marks the villain defeated — an
      // ending-shaped event the world notes while play continues.
      if (branch.villainBind) w = applyVillainBind(w, branch.villainBind);
      if (branch.rumorSeed) w = mintArcRumor(w, arc, st.castIds, branch.rumorSeed, 91);
      w = writeArcState(w, arc.arc, { ...st, status: 'resolved', branch: branchKey });
      events.push({ kind: 'arcResolved', data: { arc: arc.arc, branch: branchKey } });
    }
  }
  return { world: w, events };
}

function writeArcState(w, arcId, st) {
  const story = w.story && typeof w.story === 'object' ? w.story : { arcs: {} };
  return { ...w, story: { ...story, arcs: { ...story.arcs, [arcId]: st } } };
}
