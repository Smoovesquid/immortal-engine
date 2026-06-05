// Adjudicate — Main Loop (Iron Rule)
// Parse intent → Propose → Validate → Roll → Apply → Log → Narrate
// AI proposes; engine owns dice + state; log the ruling for replay

import { ensureWorld } from '../state.js';
import { applyDeltas } from '../effectsCore.js';
import { makeRng, seedFromString } from '../rng.js';
import { statMod } from '../ruleset/core/stats.js';
import { detectPhysicalInteraction, evaluatePhysicsSync } from '../llmPhysics.js';
import { query } from '../objects/query.js';
import { outcomes } from '../objects/outcomes.js';
import { proposeRuling, validateRuling, logRuling, computeOutcome } from './ruling.js';
import { getTemplate, renderTemplate } from './templates.js';
import { findRuling, applyRuling, getRulingNarration } from './rulings.js';

// Main adjudication loop
export function adjudicate(world, playerText) {
  const w = ensureWorld(world);

  // ── Step 1: Detect Interaction ───────────────────────────────────────
  const detection = detectPhysicalInteraction(w, playerText);
  if (!detection.detected) {
    return {
      world: w,
      narration: 'You interact with the environment.',
      mechanics: '[adjudicate | no-match]'
    };
  }

  // ── Step 1b: Check for Rulings Match ──────────────────────────────────
  // If a ruling applies to this action, use the ruling path instead
  const matchedObject = detection.matches[0];
  const ruling = findRuling(playerText, matchedObject);
  if (ruling) {
    return adjudicateWithRuling(w, playerText, detection, ruling);
  }

  // ── Step 2: Propose ───────────────────────────────────────────────────
  const proposal = proposeRuling(w, playerText);

  // ── Step 3: Validate ─────────────────────────────────────────────────
  // For now, use physics sync as fallback source of deltas
  const physicsResult = evaluatePhysicsSync(w, playerText);
  const deltas = physicsResult.deltas || [];

  const validation = validateRuling(w, proposal, deltas);
  if (!validation.ok) {
    // Fallback: generic interaction
    return {
      world: w,
      narration: 'You attempt that, but nothing happens.',
      mechanics: '[adjudicate | validation-failed]'
    };
  }

  // ── Step 4: Roll ─────────────────────────────────────────────────────
  const party = Array.isArray(w.party) ? w.party : [];
  const player = party[0] || {};
  const stats = player.stats || {};
  const statMap = {
    force: 'MIGHT',
    finesse: 'AGILITY',
    endure: 'GRIT',
    heart: 'CHARM',
    focus: 'WITS'
  };
  const statKey = statMap[proposal.approach] || 'MIGHT';
  const modifier = statMod(stats[statKey] ?? 10);

  // Roll d20
  const rngSeed = seedFromString(`${w.meta.seed}|adjudicate|${w.timeline.length}|${playerText}`);
  const rng = makeRng(rngSeed);
  const roll = rng.int(1, 20);

  const outcome = computeOutcome(roll, modifier, proposal.dcSuggestion);

  // ── Step 5: Apply Deltas ─────────────────────────────────────────────
  let w1 = applyDeltas(w, validation.deltas);

  // ── Step 6: Log Ruling ───────────────────────────────────────────────
  const rulingLog = {
    action: playerText,
    approach: proposal.approach,
    targetId: detection.matches[0]?.name || '',
    dcSuggestion: proposal.dcSuggestion,
    roll,
    modifier,
    outcome,
    deltas: validation.deltas
  };

  w1 = logRuling(w1, rulingLog);

  // ── Step 7: Narrate from Log & Templates ────────────────────────────
  // Find the object to get material for templating
  const match = detection.matches[0];
  const targetName = match?.name || 'something';

  // Infer action from text
  let action = 'examine';
  if (/\b(break|smash|rip|tear|kick|punch|shatter)\b/.test(playerText)) action = 'break';
  if (/\b(take|grab|pick|carry)\b/.test(playerText)) action = 'take';
  if (/\b(burn|ignite|fire|torch)\b/.test(playerText)) action = 'burn';

  // Get material from first match
  const materialTags = match?.tags || [];
  let material = 'wood';
  if (materialTags.some(t => t === 'metal')) material = 'metal';
  if (materialTags.some(t => t === 'stone')) material = 'stone';
  if (materialTags.some(t => t === 'glass')) material = 'glass';
  if (materialTags.some(t => t === 'cloth')) material = 'cloth';

  // Get template
  const template = getTemplate(material, action, outcome);
  const narration = renderTemplate(template, targetName, { detail: material });

  return {
    world: w1,
    narration,
    mechanics: `[adjudicate | ${outcome}]`
  };
}

// Adjudicate with a Ruling (codified DM adjudication)
function adjudicateWithRuling(world, playerText, detection, ruling) {
  const w = ensureWorld(world);

  // Get the target object
  const match = detection.matches[0];
  if (!match) {
    return {
      world: w,
      narration: 'You attempt that, but nothing happens.',
      mechanics: '[ruling | no-target]'
    };
  }

  // Get player stats for the ruling's stat
  const party = Array.isArray(w.party) ? w.party : [];
  const player = party[0] || {};
  const stats = player.stats || {};
  const modifier = statMod(stats[ruling.stat] ?? 10);

  // Compute DC
  const dcBase = ruling.dcBase || 10;
  const dcMod = ruling.dcModifier ? ruling.dcModifier(match) : 0;
  const dc = dcBase + dcMod;

  // Roll d20
  const rngSeed = seedFromString(`${w.meta.seed}|ruling|${w.timeline.length}|${playerText}`);
  const rng = makeRng(rngSeed);
  const roll = rng.int(1, 20);
  const total = roll + modifier;

  // Compute outcome
  const outcome = computeOutcome(roll, modifier, dc);

  // Get deltas from ruling
  const rulingDeltas = applyRuling(ruling, outcome, match, { action: ruling.ruleType });

  // Apply deltas to world
  let w1 = applyDeltas(w, rulingDeltas);

  // Log the ruling
  const logEntry = {
    action: playerText,
    approach: ruling.approach,
    targetId: match.name || '',
    dcSuggestion: dc,
    roll,
    modifier,
    outcome,
    deltas: rulingDeltas,
    rulingName: ruling.name
  };

  w1 = logRuling(w1, logEntry);

  // Get narration from ruling
  const narration = getRulingNarration(ruling, outcome, match, { action: ruling.ruleType });

  return {
    world: w1,
    narration,
    mechanics: `[ruling:${ruling.name} | ${outcome}]`
  };
}

export const adjudicator = {
  adjudicate
};
