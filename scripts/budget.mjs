#!/usr/bin/env node
// budget — the gate-spend ledger (.budget.json, gitignored).
// Agents READ this before any paid run and RECORD after, instead of Tim reciting
// the balance from memory. Tim (or any session) updates it when a new key loads.
//
//   node scripts/budget.mjs                     → status (balance + last entries)
//   node scripts/budget.mjs set 12 "new key"    → key loaded with $12
//   node scripts/budget.mjs spend 2.80 "opus gate P11"
//
// Policy: if balance < the run's expected cost (full Opus gate ≈ $2.80), don't
// spend — flag it in the report instead. A missing ledger means UNKNOWN, not zero:
// ask Tim once to run `set`, then never guess again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.budget.json');
const load = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null);
const save = (b) => fs.writeFileSync(FILE, JSON.stringify(b, null, 2) + '\n');

const [, , cmd, amt, ...noteParts] = process.argv;
const note = noteParts.join(' ');
let b = load();

if (cmd === 'set') {
  b = b || { balance: 0, history: [] };
  b.balance = Number(amt);
  b.history.push({ t: new Date().toISOString(), set: b.balance, note });
  save(b);
} else if (cmd === 'spend') {
  if (!b) { console.log('no ledger yet — run: node scripts/budget.mjs set <amount>'); process.exit(1); }
  b.balance = Math.round((b.balance - Number(amt)) * 100) / 100;
  b.history.push({ t: new Date().toISOString(), spend: Number(amt), note });
  save(b);
} else if (cmd && cmd !== 'status') {
  console.log('usage: budget.mjs [set <amt> [note] | spend <amt> [note]]'); process.exit(1);
}

if (!b) {
  console.log('balance: UNKNOWN — no .budget.json yet. Ask Tim, then: node scripts/budget.mjs set <amount>');
  process.exit(0);
}
console.log(`balance: $${b.balance.toFixed(2)}`);
if (b.balance < 3) console.log('⚠️  low — a full Opus gate (~$2.80) may not fit. Prefer free signals or ask Tim.');
for (const h of b.history.slice(-5)) {
  console.log(`  ${h.t.slice(0, 16)}  ${h.set != null ? `set   $${h.set.toFixed(2)}` : `spend $${h.spend.toFixed(2)}`}  ${h.note || ''}`);
}
