export const LEDGER_CAPS = {
  facts: 8,
  threats: 8,
  questions: 8
};

export function ensureLedger(ledger) {
  const safe = ledger && typeof ledger === 'object' ? ledger : {};
  return {
    facts: Array.isArray(safe.facts) ? safe.facts.slice(0, LEDGER_CAPS.facts) : [],
    threats: Array.isArray(safe.threats) ? safe.threats.slice(0, LEDGER_CAPS.threats) : [],
    questions: Array.isArray(safe.questions) ? safe.questions.slice(0, LEDGER_CAPS.questions) : []
  };
}

function normText(s) {
  return String(s ?? '').trim();
}

function pushCapped(list, item, cap) {
  // Newest-first; drop oldest when over cap.
  const next = list.slice();
  next.unshift(item);
  if (next.length > cap) next.length = cap;
  return next;
}

function findByText(list, text) {
  const t = normText(text);
  if (!t) return -1;
  return list.findIndex(x => normText(x?.text) === t);
}

function escalateQuestionText(text, level) {
  const t = normText(text);
  if (!t) return t;
  const stems = [
    (x) => x,
    (x) => x.replace(/^what\b/i, 'What truly'),
    (x) => x.replace(/^how\b/i, 'How, exactly,'),
    (x) => x.replace(/^why\b/i, 'Why, really,'),
    (x) => `What are you missing — ${x}`
  ];
  const fn = stems[Math.min(level, stems.length - 1)] || stems[0];
  const out = fn(t);
  // Ensure it still ends with ? if it used to.
  if (/\?$/.test(t) && !/\?$/.test(out)) return out + '?';
  return out;
}

export function addFact(world, text, source = 'system') {
  const ledger = ensureLedger(world.ledger);
  const t = normText(text);
  if (!t) return world;
  if (findByText(ledger.facts, t) !== -1) return world;
  const fact = { text: t, source, t: world.timeline?.length ?? 0 };
  return { ...world, ledger: { ...ledger, facts: pushCapped(ledger.facts, fact, LEDGER_CAPS.facts) } };
}

export function addThreat(world, text, level = 1) {
  const ledger = ensureLedger(world.ledger);
  const t = normText(text);
  if (!t) return world;
  if (findByText(ledger.threats, t) !== -1) return world;
  const threat = { text: t, level: clampInt(level, 1, 5), t: world.timeline?.length ?? 0 };
  return { ...world, ledger: { ...ledger, threats: pushCapped(ledger.threats, threat, LEDGER_CAPS.threats) } };
}

export function addQuestion(world, text) {
  const ledger = ensureLedger(world.ledger);
  const t = normText(text);
  if (!t) return world;

  const idx = findByText(ledger.questions, t);
  if (idx !== -1) {
    // Evolve phrasing instead of duplicating.
    const evolved = escalateQuestionText(t, 1);
    if (evolved && evolved !== t && findByText(ledger.questions, evolved) === -1) {
      const q = { text: evolved, t: world.timeline?.length ?? 0 };
      return { ...world, ledger: { ...ledger, questions: pushCapped(ledger.questions, q, LEDGER_CAPS.questions) } };
    }
    return world;
  }

  // If a prior evolved version exists, evolve further.
  const stem = t.replace(/\?+$/, '').toLowerCase();
  const priorLevel = ledger.questions.reduce((n, q) => {
    const qt = normText(q?.text).toLowerCase();
    return qt.includes(stem) ? n + 1 : n;
  }, 0);
  const evolved = priorLevel > 0 ? escalateQuestionText(t, Math.min(4, priorLevel)) : t;

  const q = { text: evolved, t: world.timeline?.length ?? 0 };
  return { ...world, ledger: { ...ledger, questions: pushCapped(ledger.questions, q, LEDGER_CAPS.questions) } };
}

export function factStrings(world) {
  const ledger = ensureLedger(world.ledger);
  return ledger.facts.map(f => String(f.text));
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}
