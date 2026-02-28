// Tiny helpers to keep playloop logic clean.
import { ensureLedger } from './ledger.js';

export function hasFact(world, text) {
  const ledger = ensureLedger(world.ledger);
  const t = String(text ?? '').trim();
  if (!t) return false;
  return ledger.facts.some(f => String(f?.text ?? '').trim() === t);
}
