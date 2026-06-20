#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Content lint — a static "wired vs dark" audit, per content system.
//
// WHY: every Opus gate keeps surfacing "built-but-dark" content — data that
// exists but isn't plugged into its mechanic, so the engine honestly does
// nothing (origin: H-45 — the consumables existed but carried no `effect`, so
// `tryUseConsumable` filtered them out). That class of snag is a STATIC question:
// you don't need a $2.40 Opus gate to find it. This catches it on a commit, for
// free, and (at the 700+-creature scale) is the only sane way to verify content
// completeness without gate-testing every monster.
//
// Each content system has a wiring CONTRACT — the field its mechanic requires:
//   weapon    → damage.dice          armor      → ac
//   consumable→ effect.kind          spell      → effects[]
//   creature  → maxHp & ac & actions[]   (else unplayable in combat)
//
// ERROR  = broken / unplayable (fails CI: exit 1).
// WARN   = flavor-or-gap (informational; a no-effect "Rations" is fine on purpose).
//
// Usage:  node scripts/contentLint.js   (or: npm run lint:content)
// Extend: add a system block below; push {name,total,wired} to `systems`.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ITEM_CATALOG, getItemDef, findDefByName } from '../engine/ruleset/core/items/index.js';
import { SPELL_REGISTRY, lookupSpell } from '../engine/ruleset/core/spells/index.js';
import { trivial } from '../engine/ruleset/core/bestiary/catalog/trivial.js';
import { minor } from '../engine/ruleset/core/bestiary/catalog/minor.js';
import { standard } from '../engine/ruleset/core/bestiary/catalog/standard.js';
import { elite } from '../engine/ruleset/core/bestiary/catalog/elite.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warns = [];
const systems = [];
const E = (sys, msg) => errors.push(`  ✗ [${sys}] ${msg}`);
const W = (sys, msg) => warns.push(`  · [${sys}] ${msg}`);

// ── Items (mechanical catalog) ───────────────────────────────────────────────
{
  let total = 0, wired = 0;
  for (const d of Object.values(ITEM_CATALOG)) {
    total++;
    if (d.kind === 'weapon') {
      if (d.damage && d.damage.dice) wired++; else E('items', `weapon '${d.defRef}' missing damage.dice`);
    } else if (d.kind === 'armor') {
      if (typeof d.ac === 'number') wired++; else E('items', `armor '${d.defRef}' missing ac`);
    } else if (d.kind === 'consumable') {
      if (d.effect && d.effect.kind) wired++; else W('items', `consumable '${d.defRef}' has no effect (flavor or gap)`);
    } else {
      wired++; // magic/quest/materials — not contract-checked in v1
    }
  }
  systems.push({ name: 'Items (catalog defs)', total, wired });
}

// ── Pack starting items (the H-45 class) ─────────────────────────────────────
// A pack flavor item is "wired" only if it resolves to a mechanical catalog def
// (by explicit defRef, else by name) AND that def carries its kind's field.
// Heuristic: authoritative runtime wiring is via defRef/instantiation, but a
// pack item whose NAME matches no catalog def cannot carry a mechanic — which is
// exactly how H-45 (Tonic of grit) hid.
{
  let total = 0, wired = 0;
  let gear;
  try { gear = JSON.parse(readFileSync(join(ROOT, 'packs/fantasy/gear.json'), 'utf8')); }
  catch { gear = {}; }
  const field = { weapons: 'damage', armor: 'ac', consumables: 'effect' };
  for (const section of ['weapons', 'armor', 'consumables']) {
    for (const it of (gear[section] || [])) {
      total++;
      const def = it.defRef ? getItemDef(it.defRef) : findDefByName(it.name);
      if (!def) { W('pack-items', `'${it.name}' (${section}) → no catalog def: unwired (flavor or gap)`); continue; }
      const ok = section === 'weapons' ? !!(def.damage && def.damage.dice)
        : section === 'armor' ? typeof def.ac === 'number'
        : !!(def.effect && def.effect.kind);
      if (ok) wired++; else W('pack-items', `'${it.name}' → '${def.defRef}' but missing ${field[section]}`);
    }
  }
  systems.push({ name: 'Pack starting items (fantasy)', total, wired });
}

// ── Spells ───────────────────────────────────────────────────────────────────
{
  const refs = Object.keys(SPELL_REGISTRY);
  let wired = 0;
  for (const ref of refs) {
    const s = lookupSpell(ref);
    if (s && Array.isArray(s.effects) && s.effects.length) wired++;
    else E('spells', `spell '${ref}' has no effects[]`);
  }
  systems.push({ name: 'Spells', total: refs.length, wired });
}

// ── Bestiary (creatures) ─────────────────────────────────────────────────────
{
  const seen = new Set(), all = [];
  for (const tier of [trivial, minor, standard, elite]) {
    for (const c of (tier || [])) {
      const ref = c && c.ref;
      if (ref && !seen.has(ref)) { seen.add(ref); all.push(c); }
    }
  }
  let wired = 0;
  const danglingSpells = new Map();
  for (const c of all) {
    const probs = [];
    if (!(Number(c.maxHp) > 0)) probs.push('maxHp');
    if (!(Number(c.ac) > 0)) probs.push('ac');
    if (!Array.isArray(c.actions) || !c.actions.length) probs.push('actions');
    if (probs.length) E('bestiary', `creature '${c.ref}' unplayable — missing ${probs.join(', ')}`);
    else wired++;
    const ks = c.spellcasting && Array.isArray(c.spellcasting.knownSpells) ? c.spellcasting.knownSpells : [];
    for (const sp of ks) if (!lookupSpell(sp)) danglingSpells.set(sp, (danglingSpells.get(sp) || 0) + 1);
  }
  systems.push({ name: 'Bestiary (creatures)', total: all.length, wired });
  if (danglingSpells.size) {
    const top = [...danglingSpells.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    W('bestiary', `${danglingSpells.size} spell refs on spellcasters don't resolve to the spell catalog (top: ${top.map(([k, n]) => `${k}×${n}`).join(', ')})`);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
console.log('\n━━━ CONTENT LINT — wired vs dark ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ${pad('SYSTEM', 32)} ${pad('WIRED', 14)} STATUS`);
console.log('  ' + '─'.repeat(64));
for (const s of systems) {
  const pct = s.total ? Math.round(100 * s.wired / s.total) : 100;
  const flag = s.wired === s.total ? '✓ all wired' : (pct >= 80 ? '~ mostly wired' : '⚠ DARK');
  console.log(`  ${pad(s.name, 32)} ${pad(`${s.wired}/${s.total} (${pct}%)`, 14)} ${flag}`);
}
if (errors.length) { console.log(`\n  ERRORS (broken / unplayable — ${errors.length}):`); console.log(errors.slice(0, 40).join('\n')); if (errors.length > 40) console.log(`  …and ${errors.length - 40} more.`); }
if (warns.length) { console.log(`\n  WARNINGS (flavor or gap — ${warns.length}):`); console.log(warns.slice(0, 40).join('\n')); if (warns.length > 40) console.log(`  …and ${warns.length - 40} more.`); }
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(errors.length ? `  RESULT: ${errors.length} error(s) — broken content. (exit 1)` : `  RESULT: no broken content. ${warns.length} warning(s) to review.`);
console.log('');
process.exit(errors.length ? 1 : 0);
