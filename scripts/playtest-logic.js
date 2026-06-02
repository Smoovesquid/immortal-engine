#!/usr/bin/env node

/**
 * Logic Rules Playtest — tests every D&D narration logic rule against
 * a real game world, not synthetic test data.
 *
 * Starts a real game, travels to a settlement, and checks:
 *   1. Violence triggers combat (not skill checks)
 *   2. Physical actions use physical stats
 *   3. Roll outcome matches narration direction
 *   4. NPC identity persists across turns
 *   5. Wounds/damage persist
 *   6. Impossible actions are handled correctly
 *
 * Usage:
 *   node scripts/playtest-logic.js
 *   node scripts/playtest-logic.js --verbose
 */

import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { assertWorldInvariants } from '../engine/invariants.js';
import { normalizeManifest, normalizePack } from '../engine/rulesets.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const VERBOSE = process.argv.includes('--verbose');

// ── Load real packs ─────────────────────────────────────────────────────
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const packsDir = path.join(__dirname, '..', 'packs');
const manifestRaw = JSON.parse(fs.readFileSync(path.join(packsDir, 'manifest.json'), 'utf8'));
const manifest = normalizeManifest(manifestRaw);
const packs = {};
for (const p of manifest.packs) {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', p.path), 'utf8'));
  packs[p.id] = normalizePack(raw);
}

// ── Helpers ─────────────────────────────────────────────────────────────

const bugs = [];
function bug(rule, detail, context) {
  bugs.push({ rule, detail, context });
  if (VERBOSE) console.error(`  ✗ [${rule}] ${detail}`);
}
function pass(rule, detail) {
  if (VERBOSE) console.log(`  ✓ [${rule}] ${detail}`);
}

function getMechanics(output) { return String(output?.mechanics || ''); }
function getNarration(output) { return String(output?.narration || ''); }

function getNpcsAtCurrentNode(w) {
  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = (w.map?.nodes || []).find(n => n && n.id === nodeId);
  return node?.settlement?.npcs || [];
}

function getCurrentNodeName(w) {
  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = (w.map?.nodes || []).find(n => n && n.id === nodeId);
  return String(node?.name || 'unknown');
}

// ── Build a real world and find a settlement ────────────────────────────

function buildWorldAtSettlement(seed) {
  let w = newWorld({ seed, fate: 0.3, campaignId: 'logic-test', pack: { primaryId: 'fantasy', mixerId: null } });
  const { world: w1 } = beginAdventure(w, packs);
  w = w1;

  // Travel until we find a node with NPCs (settlement)
  for (let i = 0; i < 20; i++) {
    const npcs = getNpcsAtCurrentNode(w);
    if (npcs.length > 0) return w;
    // Try to move to a new node
    const { world: after } = playerMove(w, packs, 'go north');
    if (after.map?.currentNodeId !== w.map?.currentNodeId) {
      w = after;
    } else {
      const { world: after2 } = newScene(w, packs);
      w = after2;
    }
  }
  return w; // might not have NPCs
}

// ═══════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════

let totalChecks = 0;
let passCount = 0;

function check(rule, condition, detail, context) {
  totalChecks++;
  if (condition) {
    passCount++;
    pass(rule, detail);
  } else {
    bug(rule, detail, context);
  }
}

// ── Rule 1: Violence triggers combat ────────────────────────────────────

function testViolenceTriggersCombat() {
  console.log('\n── Rule 2/9: Violence triggers combat ──');

  for (const seed of ['logic-v1', 'logic-v2', 'logic-v3']) {
    const w = buildWorldAtSettlement(seed);
    const npcs = getNpcsAtCurrentNode(w);
    if (!npcs.length) {
      if (VERBOSE) console.log(`  (skip ${seed}: no NPCs found)`);
      continue;
    }

    const npcName = npcs[0].name;
    const npcRole = npcs[0].role;
    const loc = getCurrentNodeName(w);

    // Test 1: Attack by exact name
    {
      const { world: after, output } = playerMove(w, packs, `attack ${npcName}`);
      const combatActive = Boolean(after.combat?.active);
      check('2.combat-by-name', combatActive,
        `"attack ${npcName}" at ${loc}: combat.active=${combatActive}`,
        getMechanics(output));
    }

    // Test 2: Stab by exact name
    {
      const { world: after, output } = playerMove(w, packs, `stab ${npcName}`);
      const combatActive = Boolean(after.combat?.active);
      check('2.combat-stab-name', combatActive,
        `"stab ${npcName}" at ${loc}: combat.active=${combatActive}`,
        getMechanics(output));
    }

    // Test 3: Punch by exact name
    {
      const { world: after, output } = playerMove(w, packs, `punch ${npcName}`);
      const combatActive = Boolean(after.combat?.active);
      check('2.combat-punch-name', combatActive,
        `"punch ${npcName}" at ${loc}: combat.active=${combatActive}`,
        getMechanics(output));
    }

    // Test 4: Attack by role
    {
      const roleName = npcRole.replace(/_/g, ' ');
      const { world: after, output } = playerMove(w, packs, `attack the ${roleName}`);
      const combatActive = Boolean(after.combat?.active);
      check('2.combat-by-role', combatActive,
        `"attack the ${roleName}" at ${loc}: combat.active=${combatActive}`,
        getMechanics(output));
    }

    // Test 5: Attack "the woman" / "the man" / "the stranger" (generic descriptor)
    for (const desc of ['the woman', 'the man', 'the stranger', 'the person']) {
      const { world: after, output } = playerMove(w, packs, `stab ${desc}`);
      const combatActive = Boolean(after.combat?.active);
      check('2.combat-generic-desc', combatActive,
        `"stab ${desc}" at ${loc}: combat.active=${combatActive}`,
        getMechanics(output));
      if (combatActive) break; // one pass is enough for generic
    }
  }
}

// ── Rule 4: Stat-action alignment ──────────────────────────────────────

function testStatActionAlignment() {
  console.log('\n── Rule 4: Stat-action alignment ──');

  const w = buildWorldAtSettlement('logic-stats');

  // Force actions should use MIGHT
  for (const action of ['I punch the wall', 'I kick the door', 'I smash the crate', 'I bash the gate']) {
    const { output } = playerMove(w, packs, action);
    const mech = getMechanics(output);
    if (mech.includes('approach:')) {
      check('4.force-MIGHT', mech.includes('approach:force'),
        `"${action}": ${mech.match(/approach:\w+/)?.[0] || '?'}`,
        mech);
      if (mech.includes('stat:')) {
        check('4.force-stat', mech.includes('stat:MIGHT'),
          `"${action}": ${mech.match(/stat:\w+/)?.[0] || '?'}`,
          mech);
      }
    }
  }

  // Finesse actions should use AGILITY
  for (const action of ['I sneak past the guard', 'I hide behind the crate']) {
    const { output } = playerMove(w, packs, action);
    const mech = getMechanics(output);
    if (mech.includes('approach:')) {
      check('4.finesse-AGILITY', mech.includes('approach:finesse'),
        `"${action}": ${mech.match(/approach:\w+/)?.[0] || '?'}`,
        mech);
    }
  }

  // Social actions should use CHARM
  for (const action of ['I try to convince the guard', 'I try to lie to them']) {
    const { output } = playerMove(w, packs, action);
    const mech = getMechanics(output);
    if (mech.includes('approach:')) {
      check('4.charm-CHARM', mech.includes('approach:charm'),
        `"${action}": ${mech.match(/approach:\w+/)?.[0] || '?'}`,
        mech);
    }
  }
}

// ── Rule 3: Roll-narration coherence ───────────────────────────────────

function testRollNarrationCoherence() {
  console.log('\n── Rule 3: Roll-narration coherence ──');

  let successChecked = 0;
  let failureChecked = 0;

  for (let i = 0; i < 40; i++) {
    const w = buildWorldAtSettlement(`logic-coherence-${i}`);
    const { output } = playerMove(w, packs, 'I force the locked door open');
    const mech = getMechanics(output);
    const narr = getNarration(output).toLowerCase();
    const outcomeMatch = mech.match(/→ (\w+)/);
    if (!outcomeMatch) continue;
    const outcome = outcomeMatch[1];

    if (outcome === 'success') {
      successChecked++;
      check('3.success-no-fail-words',
        !narr.includes('fails') && !narr.includes('misses') && !narr.includes('unable to'),
        `success narration doesn't claim failure (seed ${i})`,
        `narration: "${getNarration(output)}" | ${mech}`);
    }
    if (outcome === 'failure') {
      failureChecked++;
      check('3.failure-no-success-words',
        !narr.includes('succeeds') && !narr.includes('masterfully'),
        `failure narration doesn't claim success (seed ${i})`,
        `narration: "${getNarration(output)}" | ${mech}`);
    }

    // Outcome must be one of the three valid values
    check('3.valid-outcome', ['success', 'mixed', 'failure'].includes(outcome),
      `outcome="${outcome}" is valid`, mech);
  }

  check('3.saw-successes', successChecked > 0,
    `checked ${successChecked} success outcomes`, '');
  check('3.saw-failures', failureChecked > 0,
    `checked ${failureChecked} failure outcomes`, '');
}

// ── Rule 5: Stake escalation ───────────────────────────────────────────

function testStakeEscalation() {
  console.log('\n── Rule 5: Stake escalation ──');

  // Violence should have harm stakes
  for (let i = 0; i < 10; i++) {
    const w = buildWorldAtSettlement(`logic-stakes-${i}`);
    const npcs = getNpcsAtCurrentNode(w);
    if (!npcs.length) continue;

    const { output } = playerMove(w, packs, `attack ${npcs[0].name}`);
    const mech = getMechanics(output);
    if (mech.includes('stake:')) {
      check('5.violence-harm-stake', mech.includes('stake:harm'),
        `"attack ${npcs[0].name}": ${mech.match(/stake:\w+/)?.[0] || '?'}`,
        mech);
      break;
    }
  }
}

// ── Rule 6: World state persistence ────────────────────────────────────

function testWorldStatePersistence() {
  console.log('\n── Rule 6: World state persistence ──');

  let w = buildWorldAtSettlement('logic-persist');
  const npcs = getNpcsAtCurrentNode(w);
  if (!npcs.length) {
    if (VERBOSE) console.log('  (skip: no NPCs)');
    return;
  }

  // Apply wounds manually and check they persist
  const woundsBefore = w.party[0].wounds;
  w = ensureWorld({ ...w, party: [{ ...w.party[0], wounds: 3 }] });

  for (let i = 0; i < 5; i++) {
    const { world: after } = playerMove(w, packs, 'I look around');
    w = after;
  }

  check('6.wounds-persist', w.party[0].wounds >= 3,
    `wounds: started 3, now ${w.party[0].wounds}`, '');

  // Check NPC identity persists
  const nodeId = String(w.map?.currentNodeId ?? '');
  const node = (w.map?.nodes || []).find(n => n.id === nodeId);
  const npcAfter = node?.settlement?.npcs || [];

  if (npcs.length > 0 && npcAfter.length > 0) {
    const originalName = npcs[0].name;
    const found = npcAfter.find(n => n.name === originalName);
    check('6.npc-identity-persists', Boolean(found),
      `NPC "${originalName}" still exists after 5 turns`, '');

    if (found) {
      check('6.npc-role-persists', found.role === npcs[0].role,
        `NPC role: ${npcs[0].role} → ${found.role}`, '');
    }
  }
}

// ── Rule 10: Impossible action handling ────────────────────────────────

function testImpossibleActions() {
  console.log('\n── Rule 10: Impossible action handling ──');

  const w = buildWorldAtSettlement('logic-impossible');

  // Every turn should produce narration (never empty)
  for (const action of ['I fly', 'I teleport home', 'I summon a dragon', 'I eat the building']) {
    const { output } = playerMove(w, packs, action);
    check('10.always-narrates', getNarration(output).length > 0,
      `"${action}" produces narration`, getNarration(output));
  }

  // Invariants hold after weird inputs
  let w2 = w;
  for (const action of ['asdfasdf', '', '!@#$%', 'I do the thing', '    ']) {
    try {
      const { world: after } = playerMove(w2, packs, action);
      assertWorldInvariants(after);
      check('10.invariants-after-garbage', true,
        `"${action}" doesn't crash and invariants hold`, '');
      w2 = after;
    } catch (e) {
      check('10.invariants-after-garbage', false,
        `"${action}" crashed: ${e.message}`, e.stack);
    }
  }
}

// ── Multi-turn stress test ─────────────────────────────────────────────

function testMultiTurnStress() {
  console.log('\n── Multi-turn stress (50 turns) ──');

  let w = buildWorldAtSettlement('logic-stress');
  const actions = [
    'I look around', 'I try to pick the lock', 'I search for traps',
    'I force the stuck door', 'I sneak past', 'What do I see?',
    'I climb the wall', 'I rest', 'I draw my sword',
    'I take the torch', 'I hide', 'I listen carefully',
    'I eat rations', 'go north', 'go south',
    'I try to persuade them', 'I forage for food',
    'I search the area', 'I take a deep breath', 'I move forward',
  ];

  let rollCount = 0;
  let noRollCount = 0;

  for (let turn = 0; turn < 50; turn++) {
    if (w.ending?.locked) break;
    const action = actions[turn % actions.length];
    const { world: after, output } = playerMove(w, packs, action);

    try {
      assertWorldInvariants(after);
    } catch (e) {
      check('stress.invariant', false,
        `turn ${turn} "${action}" broke invariant: ${e.message}`, '');
    }

    check('stress.narration', getNarration(output).length > 0,
      `turn ${turn} produces narration`, '');

    const mech = getMechanics(output);
    if (mech.includes('roll:')) rollCount++;
    else noRollCount++;

    w = after;
  }

  check('stress.saw-rolls', rollCount > 0,
    `saw ${rollCount} rolled actions`, '');
  check('stress.saw-auto', noRollCount > 0,
    `saw ${noRollCount} auto-resolved actions`, '');
}

// ═══════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║        D&D LOGIC RULES PLAYTEST                        ║');
console.log('╚══════════════════════════════════════════════════════════╝');

testViolenceTriggersCombat();
testStatActionAlignment();
testRollNarrationCoherence();
testStakeEscalation();
testWorldStatePersistence();
testImpossibleActions();
testMultiTurnStress();

console.log('\n' + '═'.repeat(58));
console.log(`RESULTS: ${passCount}/${totalChecks} checks passed, ${bugs.length} failures`);
console.log('═'.repeat(58));

if (bugs.length > 0) {
  console.log('\nFAILURES:\n');
  for (const b of bugs) {
    console.log(`  [${b.rule}] ${b.detail}`);
    if (b.context) console.log(`    context: ${b.context}`);
  }
  console.log('');
  process.exit(1);
} else {
  console.log('\n  ✓ All D&D logic rules pass.\n');
  process.exit(0);
}
