// Prose graders — the shared, importable heart of the standing prose gate (Stage F).
//
// Each grader is a pure function over (input, response) and returns issue strings.
// Both scripts/prose-playtest.mjs (the enforced gate) and tests/F1.proseGate.test.js
// import these, so the gate's judgment is itself unit-tested for precision.
//
// A "response" is { route, narration, mechanics?, error? } where route is one of
// 'empty' | 'cardinal' | 'meta' | 'action'. Only 'meta' and 'action' produce prose a
// player reads, so most graders only fire on those.
//
// Governing principle: THE_DM_TEST. The harshest grader here is DEAD_END — a DM never
// bounces the player's intent back as a mechanical prompt or a parser error.

// Strip the UI speaker prefix ("Wizard: ") before grammar/wording checks.
export function bare(s) { return String(s ?? '').replace(/^[A-Za-z][\w' ]*:\s*/, '').trim(); }

const PROSE_ROUTES = new Set(['meta', 'action']);

// ── Individual graders ───────────────────────────────────────────────────────

// CRASH — a handler threw. Always fatal.
export function gradeCrash(_input, res) {
  if (res?.error) return [`CRASH: ${String(res.error).split('\n')[0]}`];
  return [];
}

// INVISIBLE — a prose route produced nothing a player could read.
export function gradeInvisible(_input, res) {
  if (!PROSE_ROUTES.has(res?.route)) return [];
  const n = bare(res.narration);
  if (!n) return ['INVISIBLE: empty prose'];
  if (/^[.…!?\s]+$/.test(n)) return ['INVISIBLE: placeholder ("..."/punctuation only)'];
  return [];
}

// VALUE_LEAK — an unrendered value or template reached the player.
export function gradeValueLeak(_input, res) {
  if (!PROSE_ROUTES.has(res?.route)) return [];
  const n = bare(res.narration);
  const out = [];
  if (/\b(undefined|null|NaN)\b/.test(n)) out.push('VALUE_LEAK: undefined/null/NaN');
  if (/\[object Object\]/.test(n)) out.push('VALUE_LEAK: [object Object]');
  if (/\$\{[^}]*\}|\{\{[^}]*\}\}/.test(n)) out.push('VALUE_LEAK: unrendered template');
  // A node id ("n3_2068938136") or raw key leaking into prose.
  if (/\bn\d+_\d{4,}\b/.test(n)) out.push('VALUE_LEAK: raw node id');
  return out;
}

// FLOOR — the composer's abstract literary fallback. Legitimate as deep ambience, but a
// RESOLVED player action must read as what a DM would say (name the thing, say what
// happened) — never this filler. So we flag it only on the 'action' route.
const FLOOR_RE = /low hum threads|meaning slips|picture refuses|force bleeds out against stone|a thread of strain runs/i;
export function gradeFloor(_input, res) {
  if (res?.route !== 'action') return [];
  if (FLOOR_RE.test(bare(res.narration))) return ['FLOOR: abstract filler on a resolved action'];
  return [];
}

// DEAD_END — THE_DM_TEST violation: intent bounced back as a mechanical prompt, a
// parser error, or a system artifact instead of being resolved in the fiction.
const DEAD_END_PATTERNS = [
  [/which (?:way|direction)\b.*\?/i, 'asks "which way?"'],
  [/one (?:tile|step|square|space|hex)\s+at a time/i, 'one-tile-at-a-time'],
  [/\b(?:not|isn'?t)\s+a\s+(?:valid|recognized|known)\s+(?:command|move|action|direction|input)/i, 'parser "not a valid command"'],
  [/\bi (?:don'?t|do not|didn'?t)\s+understand\b/i, 'parser "I don\'t understand"'],
  [/\bplease\s+(?:specify|choose|select|pick|enter|type)\b/i, 'asks player to specify/choose'],
  [/\b(?:type|enter|use|press|click)\s+(?:a\s+)?(?:command|the\s+\w+\s+button|one of)/i, 'tells player to type a command/use a button'],
  [/^(?:north|south|east|west)\??(?:\s*[,/]\s*(?:north|south|east|west)\??)+\.?$/i, 'bare direction menu'],
  [/\b(?:invalid|unknown)\s+(?:command|input|move)\b/i, 'parser "invalid command"'],
  [/\btravel\s+one\s+\w+\s+at a time\b/i, 'travel-one-at-a-time'],
];
export function gradeDeadEnd(_input, res) {
  if (!PROSE_ROUTES.has(res?.route)) return [];
  const n = bare(res.narration);
  const out = [];
  for (const [re, label] of DEAD_END_PATTERNS) if (re.test(n)) out.push(`DEAD_END: ${label}`);
  return out;
}

// FORMATTING — small glitches that read as broken to a player.
export function gradeFormatting(_input, res) {
  if (!PROSE_ROUTES.has(res?.route)) return [];
  const n = bare(res.narration);
  if (!n) return []; // INVISIBLE owns the empty case
  const out = [];
  if (/\bthe the\b/i.test(n)) out.push('FORMAT: "the the"');
  if (/\b(\w+) the \1\b/i.test(n)) out.push('FORMAT: "X the X" doubling');
  if (/  +/.test(n)) out.push('FORMAT: double space');
  if (/\s[,;.!?]/.test(n)) out.push('FORMAT: space before punctuation');
  if (/\b1 others\b/.test(n)) out.push('FORMAT: plural "1 others"');
  if (!/[.!?")…]$/.test(n)) out.push('FORMAT: no end punctuation');
  if (/^[a-z]/.test(n)) out.push('FORMAT: lowercase start');
  return out;
}

// The full battery, in severity order.
export const GRADERS = [gradeCrash, gradeInvisible, gradeValueLeak, gradeFloor, gradeDeadEnd, gradeFormatting];

// Run every grader; return a flat list of issue strings (empty = clean).
export function gradeAll(input, res) {
  const issues = [];
  for (const g of GRADERS) issues.push(...g(input, res));
  return issues;
}

// Convenience for tests: grade a bare narration string as if it were an action.
export function gradeNarration(narration, route = 'action') {
  return gradeAll('(test)', { route, narration });
}
