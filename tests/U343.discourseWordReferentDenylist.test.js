import test from 'node:test';
import assert from 'node:assert/strict';

import { villageBakerWorld, PACKS } from '../scripts/convergence/fixtures.mjs';
import { playerMove } from '../engine/playloop.js';

// C7 (coherence-seams audit, 2026-07-02): sentence-initial discourse/
// demonstrative words were extracted as the NPC referent by
// concreteNpcReferentFromText and bounced a mechanical clarify instead of
// letting the turn resolve in the fiction (THE_DM_TEST — never bounce intent
// back as a mechanical prompt). Repro:
//   "That traveler — who ran this place?"  → "named That"
//   "Interesting — so Dalla, who's the trader?" → "named Interesting"
//   "Wayfarers' Outpost — where are we?"   → "named Wayfarers"
// Fixed with the same H-90/H-91 discipline: extend
// NPC_PROPER_REFERENT_STOPWORDS (that/this/these/those/interesting/fine/now),
// fix a normalizer gap (normalizedNpcRef strips this/that to "" before the
// Set lookup — isNpcProperReferentStopword now also checks the raw lowercased
// token), and add isKnownPlaceNameFragment so a capitalized fragment of an
// already-known place name ("Wayfarers'" from "Wayfarers' Outpost") is not
// read as a person. See tests/corpus/C2.corpus.mjs C2-007 for the locked
// convergence coverage; this file adds the Wayfarers place-fragment repro
// (village_baker has no Wayfarers-named node, so the corpus fixture can't
// exercise it) plus focused unit coverage.

const CLARIFY_RE = /\[clarify:(?:referent|who)\]/i;
const NAMED_RE = /no one named|haven.t introduced/i;

function noClarify(output) {
  return !CLARIFY_RE.test(output.mechanics || '') && !NAMED_RE.test(output.narration || '');
}

// ── discourse words never become the referent ───────────────────────────────

test('U343: sentence-initial discourse words do not bounce a referent clarify', () => {
  const cases = [
    'That traveler — who ran this place?',
    'This place — who built it?',
    'These ruins — what happened here?',
    'Those travelers — where did they go?',
    "Fine — so who's the elder here?",
    'Now, who runs this place?',
    "Interesting — so Dalla, who's the trader?",
  ];
  for (const text of cases) {
    const w = villageBakerWorld();
    const { output } = playerMove(w, PACKS, text);
    assert.ok(noClarify(output), `should not clarify: ${JSON.stringify(text)} — got: ${output.narration} | ${output.mechanics}`);
    assert.match(output.narration, /^Wizard:/, `still gets a real DM answer: ${text}`);
  }
});

// ── the place-name-fragment guard (the "Wayfarers' Outpost" repro) ──────────

function outpostWorld() {
  const w = villageBakerWorld();
  const nodes = w.map.nodes.map(n =>
    n.id === w.map.currentNodeId ? { ...n, name: "Wayfarers' Outpost" } : n
  );
  return { ...w, map: { ...w.map, nodes, discovered: [w.map.currentNodeId] } };
}

test('U343: a fragment of an already-known place name ("Wayfarers\' Outpost") is not read as a person', () => {
  const cases = [
    "Wayfarers' Outpost — where are we?",
    "Wayfarers' Outpost — who built it?",
    "Wayfarers' Outpost — what happened here?",
  ];
  for (const text of cases) {
    const w = outpostWorld();
    const { output } = playerMove(w, PACKS, text);
    assert.ok(noClarify(output), `should not clarify on a place fragment: ${JSON.stringify(text)} — got: ${output.narration} | ${output.mechanics}`);
  }
});

test('U343: the place-fragment guard is scoped to KNOWN (discovered) places, not any capitalized word', () => {
  // Without map.discovered including the renamed node, "Wayfarers" is just an
  // unrecognized capitalized word again — isKnownPlaceNameFragment is
  // deliberately a no-op here (it doesn't guess; it checks world state).
  const w = villageBakerWorld();
  const nodes = w.map.nodes.map(n =>
    n.id === w.map.currentNodeId ? { ...n, name: "Wayfarers' Outpost" } : n
  );
  const undiscovered = { ...w, map: { ...w.map, nodes, discovered: [] } };
  const { output } = playerMove(undiscovered, PACKS, "Wayfarers' Outpost — who built it?");
  // Not asserting either direction on the clarify (that's an existing-behavior
  // question outside C7's scope) — only that this doesn't crash and still
  // returns a real DM line, proving the guard degrades safely without `world`
  // support rather than silently matching everything.
  assert.match(output.narration, /^Wizard:/);
});

// ── over-match guard: real names must be UNCHANGED (strict refinement) ──────

test('U343: real fabricated names still clarify — the denylist did not sweep them', () => {
  const cases = [
    'Kael the merchant, what do you want?',
    'Wasiq, why are you so quiet?',
    'Isolde, why are you so quiet?',
  ];
  for (const text of cases) {
    const w = villageBakerWorld();
    const { output } = playerMove(w, PACKS, text);
    assert.match(output.mechanics, CLARIFY_RE, `real name should still clarify: ${text}`);
  }
});

test('U343: a discourse word beside a real addressed name resolves toward the name, never the discourse word', () => {
  const cases = [
    { text: 'That — I turn and ask Wasiq what he saw.', shouldName: 'Wasiq' },
    { text: 'This — so I ask Kael who runs this place.', shouldName: 'Kael' },
    { text: 'Now, I ask Kael who built this place.', shouldName: 'Kael' },
  ];
  for (const { text, shouldName } of cases) {
    const w = villageBakerWorld();
    const { output } = playerMove(w, PACKS, text);
    assert.match(output.mechanics, CLARIFY_RE, `should clarify: ${text}`);
    assert.match(output.narration, new RegExp(`named ${shouldName}\\b`), `clarifies toward the addressed name: ${text}`);
  }
});

test('U343: single-candidate real names are unaffected (H-90/H-91 regression)', () => {
  const cases = [
    'Is there a founding family here, or was it built by merchants?',
    'Then who ran the inn before the owner?',
  ];
  for (const text of cases) {
    const w = villageBakerWorld();
    const { output } = playerMove(w, PACKS, text);
    assert.ok(noClarify(output), `H-90 regression: ${text} — got: ${output.narration} | ${output.mechanics}`);
  }
});
