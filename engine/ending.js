import { seedFromString, makeRng } from './rng.js';
import { stableStringify } from './log.js';
import { shouldTriggerEnding as shouldTriggerEndingV2, generateEnding } from './endingArchitect.js';

export const ENDING_TYPES = [
  'Pyrrhic Victory',
  'Horrible Truth',
  'Narrow Escape',
  'The Cost Paid'
];

function coerceBool(x) {
  // Guard against legacy/stringified booleans: "false" should not become truthy.
  if (x === true || x === 'true' || x === 1) return true;
  if (x === false || x === 'false' || x === 0) return false;
  return false;
}

export function ensureEnding(e) {
  const x = e && typeof e === 'object' ? e : {};
  return {
    triggered: coerceBool(x.triggered),
    type: String(x.type ?? ''),
    epilogueLine: String(x.epilogueLine ?? ''),
    locked: coerceBool(x.locked),
    reason: String(x.reason ?? '')
  };
}

export function shouldTriggerEnding(world) {
  // V2 ending logic (inevitability + threads + clocks) OR legacy clock-based triggers.
  const w = world;

  const legacy = (() => {
    const dread = w.clocks?.dread ?? 0;
    const pressure = w.clocks?.pressure ?? 0;
    const revelation = w.clocks?.revelation ?? 0;
    const threats = Array.isArray(w.ledger?.threats) ? w.ledger.threats : [];
    const unresolvedThreats = threats.length;
    const fateHigh = Number(w.meta?.fate ?? 0) >= 0.67;

    return (dread >= 8 || pressure >= 10 || revelation >= 8 || (fateHigh && unresolvedThreats >= 3));
  })();

  return Boolean(legacy || shouldTriggerEndingV2(w));
}

export function triggerEnding(world) {
  if (world.ending?.triggered) return world;
  if (!shouldTriggerEnding(world)) return world;

  // V2 authored ending summary (deterministic).
  const v2 = generateEnding(world);
  const type = v2.endingType || chooseEndingType(world);
  // Keep legacy requirement: epilogue must include Promise: or Taboo: (tests + UX expectation).
  const legacyRef = makeEpilogueLine(world, type);
  const epilogueLine = v2.summaryLine ? `${v2.summaryLine} ${legacyRef}` : legacyRef;

  const ending = {
    triggered: true,
    type,
    epilogueLine,
    locked: true
  };

  return { ...world, ending };
}

export function chooseEndingType(world) {
  const s = seedFromString(`${world.meta.seed}|ending|d${world.clocks.dread}|p${world.clocks.pressure}|r${world.clocks.revelation}|t${world.ledger.threats.length}`);
  const rng = makeRng(s);
  return rng.pick(ENDING_TYPES) || ENDING_TYPES[0];
}

export function makeEpilogueLine(world, type) {
  // Must reference instrument.promise OR instrument.taboo.
  const inst = world.instrument || {};
  const ref = inst.promise ? `Promise: ${inst.promise}.` : inst.taboo ? `Taboo: ${inst.taboo}.` : 'Taboo: no easy rescues.';

  const base = {
    'Pyrrhic Victory': `Wizard: You win—barely—and the world remembers the debt. ${ref}`,
    'Horrible Truth': `Wizard: The truth surfaces like rot in clean water. ${ref}`,
    'Narrow Escape': `Wizard: You get out. Not unscarred—just out. ${ref}`,
    'The Cost Paid': `Wizard: The door opens, and the price is exactly what you feared. ${ref}`
  };
  return base[type] || `Wizard: The session ends with consequence. ${ref}`;
}

export function canonOutcomeBullets(world) {
  // 3 bullets, stable ordering: oldest -> newest by t, then text.
  const facts = Array.isArray(world.ledger?.facts) ? world.ledger.facts : [];
  const threats = Array.isArray(world.ledger?.threats) ? world.ledger.threats : [];

  const items = [];
  for (const f of facts) items.push({ kind: 'fact', t: f.t ?? 0, text: String(f.text ?? '') });
  for (const th of threats) items.push({ kind: 'threat', t: th.t ?? 0, text: String(th.text ?? '') });

  items.sort((a, b) => (a.t - b.t) || a.kind.localeCompare(b.kind) || a.text.localeCompare(b.text));

  const picked = pickLastDistinct(items, 3);
  return picked.map(x => (x.kind === 'threat' ? `Threat: ${x.text}` : `Fact: ${x.text}`));
}

export function sequelHookQuestion(world) {
  const qs = Array.isArray(world.ledger?.questions) ? world.ledger.questions : [];
  // Stable: oldest unanswered question (by t asc).
  const sorted = qs
    .map(q => ({ t: q.t ?? 0, text: String(q.text ?? '') }))
    .sort((a, b) => (a.t - b.t) || a.text.localeCompare(b.text));
  return sorted[0]?.text || 'What will you do with what you learned?';
}

export function exportChronicle(world) {
  const chronicle = {
    kind: 'ai-dm-v2-chronicle',
    meta: world.meta,
    pack: world.pack,
    instrument: world.instrument,
    ending: world.ending,
    clocks: world.clocks,
    party: world.party,
    outcomes: canonOutcomeBullets(world),
    hook: sequelHookQuestion(world)
  };

  const json = stableStringify(chronicle);
  const text = chronicleText(world);
  return { json, text };
}

export function chronicleText(world) {
  const outcomes = canonOutcomeBullets(world);
  const hook = sequelHookQuestion(world);
  const lines = [
    `AI Dungeon Master (V2) — Chronicle`,
    `campaignId: ${world.meta.campaignId}`,
    `seed: ${world.meta.seed}`,
    `ending: ${world.ending?.type || '—'}`,
    `epilogue: ${world.ending?.epilogueLine || '—'}`,
    ``,
    `Canon outcomes:`,
    ...outcomes.map(x => `- ${x}`),
    ``,
    `Sequel hook:`,
    `- ${hook}`
  ];
  return lines.join('\n');
}

function pickLastDistinct(items, n) {
  const out = [];
  const seen = new Set();
  for (let i = items.length - 1; i >= 0; i--) {
    const key = `${items[i].kind}|${items[i].text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(items[i]);
    if (out.length >= n) break;
  }
  return out.reverse();
}
