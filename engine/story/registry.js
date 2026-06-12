// Story arc registry — the loaded, validated arc set.
//
// Arcs are data modules under content/arcs/*.arc.js (see docs/STORYLINE_SPEC.md).
// They're imported statically so the engine never touches the filesystem and
// the same set loads in node and the browser. Cap: 8 loaded arcs.

import theColdWell from '../../content/arcs/the_cold_well.arc.js';
import whatTheFireLeft from '../../content/arcs/what_the_fire_left.arc.js';
import theJudgePasses from '../../content/arcs/the_judge_passes.arc.js';
import theWagesOfBlood from '../../content/arcs/the_wages_of_blood.arc.js';
import theNamedDark from '../../content/arcs/the_named_dark.arc.js';
import theDebtThatWalks from '../../content/arcs/the_debt_that_walks.arc.js';

// Order is casting priority when active slots are scarce.
const BUILTIN_ARCS = [theColdWell, whatTheFireLeft, theJudgePasses, theWagesOfBlood, theNamedDark, theDebtThatWalks];

const MAX_ARCS = 8;
const VALID_SCALES = new Set(['village', 'county', 'realm']);
const VALID_GUARDS = new Set(['public', 'trust']);
const DONE_WHEN_KEYS = new Set(['learned', 'reached', 'obtained', 'defeated', 'talkedTo']);
const VALID_DEEDS = new Set(['cruelty', 'forbidden', 'mercy', 'aid', 'atonement']);

/**
 * validateArc(arc) -> string[] of problems (empty = valid).
 * Pure structural validation; binding feasibility is a playtest concern.
 */
export function validateArc(arc) {
  const errs = [];
  const at = (m) => errs.push(`${arc?.arc ?? '<unnamed>'}: ${m}`);

  if (!arc || typeof arc !== 'object') return ['arc is not an object'];
  if (!/^[a-z0-9-]+$/.test(String(arc.arc ?? ''))) at('arc id must be kebab-case');
  if (!VALID_SCALES.has(arc.scale)) at(`scale must be one of ${[...VALID_SCALES].join('/')}`);

  const cast = Array.isArray(arc.cast) ? arc.cast : [];
  if (!cast.length) at('cast must have at least one role');
  const roles = new Set();
  const knownFactIds = new Set();
  for (const c of cast) {
    if (!c?.role || roles.has(c.role)) at(`cast role missing or duplicate: ${c?.role}`);
    roles.add(c?.role);
    if (!Array.isArray(c?.bind?.roles) || !c.bind.roles.length) at(`cast ${c?.role}: bind.roles required`);
    for (const k of (Array.isArray(c?.knows) ? c.knows : [])) {
      if (!/^[a-z0-9_]+$/.test(String(k?.factId ?? ''))) at(`cast ${c?.role}: factId must be snake_case`);
      if (!VALID_GUARDS.has(k?.guard)) at(`cast ${c?.role}: guard must be public|trust`);
      knownFactIds.add(String(k?.factId ?? ''));
    }
  }

  for (const h of (Array.isArray(arc.hooks) ? arc.hooks : [])) {
    if (!h?.rumor) at('hook missing rumor text');
    if (!roles.has(h?.carrier)) at(`hook carrier not in cast: ${h?.carrier}`);
  }

  const stages = Array.isArray(arc.stages) ? arc.stages : [];
  if (!stages.length) at('stages must be non-empty');
  const stageIds = new Set(stages.map(s => s?.id));
  stages.forEach((s, i) => {
    const dw = s?.doneWhen && typeof s.doneWhen === 'object' ? Object.keys(s.doneWhen) : [];
    if (dw.length !== 1 || !DONE_WHEN_KEYS.has(dw[0])) at(`stage ${s?.id}: doneWhen needs exactly one of ${[...DONE_WHEN_KEYS].join('/')}`);
    if (dw[0] === 'learned' && !knownFactIds.has(String(s.doneWhen.learned))) {
      at(`stage ${s?.id}: learned fact '${s.doneWhen.learned}' not in any cast knows[]`);
    }
    const isLast = i === stages.length - 1;
    if (!isLast && !stageIds.has(s?.spawns?.nextStage)) at(`stage ${s?.id}: spawns.nextStage must name a stage`);
    if (isLast) {
      const branches = s?.branches && typeof s.branches === 'object' ? s.branches : {};
      if (!Object.keys(branches).length) at(`final stage ${s?.id}: branches required`);
      for (const [bk, b] of Object.entries(branches)) {
        for (const d of (Array.isArray(b?.deeds) ? b.deeds : [])) {
          if (!VALID_DEEDS.has(d?.deedKind)) at(`branch ${bk}: invalid deedKind ${d?.deedKind}`);
        }
      }
    }
  });

  const ab = arc.abandonment;
  if (!ab || !(Number(ab.afterDays) > 0) || !ab.rumor) at('abandonment with afterDays>0 and rumor is mandatory');

  return errs;
}

/** getArcs() -> validated arc list (invalid arcs are dropped, never loaded). */
export function getArcs() {
  const out = [];
  for (const a of BUILTIN_ARCS.slice(0, MAX_ARCS)) {
    if (validateArc(a).length === 0) out.push(a);
  }
  return out;
}

export function getArc(id) {
  return getArcs().find(a => a.arc === String(id)) || null;
}
