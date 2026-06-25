// U279 — earned knowledge for PEOPLE (the other half of line-of-sight look-around).
// You can SEE someone and read their ROLE from dress and bearing, but you don't know
// their NAME until you've met them — unless this is home, where you know your neighbors.
//   • home settlement        → NPCs named;
//   • foreign, not yet met    → NPCs by role ("a barkeep"), no name;
//   • foreign, met (metPlayer)→ that NPC named, the rest still by role.
// The prompt roster (narratorContext → SETTLEMENT DATA) redacts unmet names the same way,
// so the DM can't narrate "Dalla" at a town you just walked into. Hermetic — pure functions.

import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureWorld } from '../engine/state.js';
import { buildLocationSurvey } from '../engine/grace/gracefulAdjudication.js';
import { buildNarratorContext } from '../engine/ai/narratorContext.js';

// A settlement ('town') with two residents; `homeNodeId` and Mary's metPlayer are the knobs.
function makeWorld({ homeNodeId, metMary = false }) {
  return ensureWorld({
    meta: { version: 27, seed: 'u279', fate: 0.2, homeNodeId },
    party: [{ id: 'party', name: 'Sera', level: 1,
      stats: { MIGHT: 10, AGILITY: 10, WITS: 10, GRIT: 10, CHARM: 10 },
      position: { ux: 50, uy: 50, nodeId: 'town' } }],
    map: {
      currentNodeId: 'town',
      nodes: [
        { id: 'town', name: 'Buttnoid Village', nodeType: 'settlement', x: 5, y: 5,
          settlement: { npcs: [
            { id: 'mary', name: 'Mary Rottencrotch', role: 'barkeep', conversationState: { metPlayer: !!metMary } },
            { id: 'gus', name: 'Gus', role: 'smith', conversationState: { metPlayer: false } }
          ] } },
        // A real elsewhere-home, so the homeNodeId invariant holds while you stand in 'town'.
        { id: 'home_village', name: 'Hearthford', nodeType: 'settlement', x: 9, y: 9, settlement: { npcs: [] } }
      ],
      edges: []
    },
    timeline: [],
    scene: { location: 'Buttnoid Village' }
  });
}

test('U279: AT HOME — you know your neighbors, named', () => {
  const survey = buildLocationSurvey(makeWorld({ homeNodeId: 'town' }));
  assert.match(survey, /Mary Rottencrotch/, survey);
  assert.match(survey, /Gus/, survey);
});

test('U279: a FOREIGN settlement — people by ROLE, never by name (until met)', () => {
  const survey = buildLocationSurvey(makeWorld({ homeNodeId: 'home_village' }));
  assert.doesNotMatch(survey, /Mary|Rottencrotch|Gus/, survey);
  assert.match(survey, /a barkeep/, survey);
  assert.match(survey, /a smith/, survey);
});

test('U279: once MET, that NPC is named even abroad — the rest stay by role', () => {
  const survey = buildLocationSurvey(makeWorld({ homeNodeId: 'home_village', metMary: true }));
  assert.match(survey, /Mary Rottencrotch/, survey);   // met → named
  assert.doesNotMatch(survey, /\bGus\b/, survey);        // unmet → still a role
  assert.match(survey, /a smith/, survey);
});

test('U279: the prompt roster redacts unmet names away from home (no "Dalla" leak)', () => {
  const ctx = buildNarratorContext(makeWorld({ homeNodeId: 'home_village', metMary: true }), {});
  const byId = Object.fromEntries((ctx.settlement?.npcs || []).map(n => [n.id, n]));
  assert.equal(byId.mary?.name, 'Mary Rottencrotch', 'a met NPC keeps their name in the prompt');
  assert.equal(byId.gus?.name, '', 'an unmet NPC name is redacted from the prompt roster');
});
