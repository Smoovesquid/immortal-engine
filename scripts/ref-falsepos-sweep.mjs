// ─────────────────────────────────────────────────────────────────────────────
// scripts/ref-falsepos-sweep.mjs — THE REF judge false-positive sweep.
//
// The real bar for turning the Ref ON by default is NOT "does it catch dodges"
// (proven 5/5) — it's "does it leave GOOD lines alone?" A judge that flags honest
// declines / grounded deliveries / in-voice attitude would quietly gut play (the
// exact failure Rung-1 was built to kill). This runs a panel of lines a competent
// DM would actually say through the LIVE judge and measures how many it wrongly
// sends back (REGENERATE). PASS-rate near 100% = safe to default-on.
//
// Paid (Haiku judge calls, ~$0.02). Re-run when the judge model changes.
//   node scripts/ref-falsepos-sweep.mjs
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { buildRefAdapter } from '../server/refJudge.js';

const { judge } = buildRefAdapter({ world: null });

// Canon bundles the good lines are grounded against.
const BARE = { location: { name: 'Pilgrim\'s Rest', kind: 'settlement' }, npcsPresent: [{ name: 'Mira Hearth', role: 'baker' }], ledgerFacts: [] };
// Internally CONSISTENT canon (location name matches the fact) so a grounded delivery
// is genuinely grounded — an inconsistent bundle is a test bug, not a judge error.
const FOUNDED = { location: { name: 'Tallow Cross', kind: 'settlement' }, npcsPresent: [{ name: 'Bram Cask', role: 'tavern-keeper' }], ledgerFacts: ['Tallow Cross was founded by salt-panners three generations ago'] };

// GOOD lines — every one is something a real DM/NPC would rightly say. The judge
// should PASS all of them. Each is paired with an input + mechanics that make it
// the correct move (so a flag would be a genuine false positive, not a real catch).
const GOOD = [
  { tag: 'honest-decline (tenure)', input: 'how long have you been here?', mechanics: '[dialogue ask | deflected | trust:5]', canon: BARE,
    candidate: "Couldn't say, honestly — you'd have to ask someone older than me." },
  { tag: 'honest-decline (lore)', input: "what's the history of this temple?", mechanics: '[dialogue ask | deflected | trust:4]', canon: BARE,
    candidate: "That's lost to me, truth be told — I only know the bread and the ovens." },
  { tag: 'grounded identity', input: 'who are you?', mechanics: '[dialogue ask | self | trust:5]', canon: BARE,
    candidate: "Mira Hearth. I'm the baker here, such as it is." },
  { tag: 'in-voice attitude', input: 'are you friendly?', mechanics: '[dialogue ask | shared | trust:5]', canon: BARE,
    candidate: 'I keep to my ovens and my own business, but I wish you no trouble.' },
  { tag: 'grounded delivery (founding)', input: 'when was this town founded?', mechanics: '[dialogue ask | shared | trust:6]', canon: FOUNDED,
    candidate: 'Salt-panners raised it, three generations back — or so the old folk tell it.' },
  { tag: 'curt honest-decline (low trust)', input: 'tell me everything you know about the road north.', mechanics: '[dialogue ask | deflected | trust:2]', canon: BARE,
    candidate: "Wouldn't know — I keep close to my ovens. The road's not my business." },
  { tag: 'generic action success', input: 'I shove the heavy cart out of my way', mechanics: '[roll:15 vs DC:12 → success | approach:force | stat:MIGHT+1]', canon: BARE,
    candidate: 'You set your shoulder to it and the cart grinds aside.' },
  { tag: 'generic action failure', input: 'I try to force the rusted gate', mechanics: '[roll:6 vs DC:13 → failure | approach:force | stat:MIGHT+1]', canon: BARE,
    candidate: "The gate doesn't give; it holds against everything you've got." },
  { tag: 'hyperbole/atmosphere (not a claim)', input: 'is it dangerous out there?', mechanics: '[dialogue ask | shared | trust:5]', canon: BARE,
    candidate: "Out past the wall? Nothing kind, that's certain — stay wary." },
  { tag: 'honest decline + route to source', input: 'who runs this place?', mechanics: '[dialogue ask | deflected | trust:4]', canon: BARE,
    candidate: "Not my business to say — ask at the council house if you want names." },
  { tag: 'grounded present-NPC', input: 'is anyone else here?', mechanics: '[dialogue ask | shared | trust:5]', canon: BARE,
    candidate: "Just me and my ovens at this hour." },
  { tag: 'plain refusal (withheld-ish but honest)', input: 'what are you hiding?', mechanics: '[dialogue ask | shared | trust:3]', canon: BARE,
    candidate: "Everyone's got things they keep. I'll not air mine to a stranger." },
];

const rows = [];
for (const c of GOOD) {
  let v;
  try { v = await judge({ input: c.input, mechanics: c.mechanics, candidate: c.candidate, canon: c.canon }); }
  catch (e) { v = { verdict: 'ERROR', err: String(e?.message || e) }; }
  const ok = v.verdict === 'PASS';
  rows.push({ ...c, verdict: v.verdict, failure_class: v.failure_class, atoms: v.atoms, ok });
  console.log(`${ok ? '✓ PASS ' : '✗ FLAG '} ${c.tag}  (${v.verdict}${v.failure_class && v.failure_class !== 'NONE' ? '/' + v.failure_class : ''})`);
  if (!ok) {
    console.log(`        input:     ${c.input}`);
    console.log(`        candidate: ${c.candidate}`);
    if (v.atoms) console.log(`        atoms:     ${JSON.stringify(v.atoms)}`);
  }
}

const pass = rows.filter(r => r.ok).length;
const total = rows.length;
const rate = ((pass / total) * 100).toFixed(1);
console.log(`\n════ false-positive sweep: ${pass}/${total} PASS (${rate}% — flags on good lines = ${total - pass}) ════`);
console.log(pass === total
  ? 'CLEAN — the judge leaves good lines alone. Safe to default-on.'
  : 'OVER-FLAGGING — review the flagged lines before default-on (consider a stronger/cross-family judge).');
