// C22 — AG-3b: the egress whitelist is INTENT-AWARE. A whitelisted provenance is
// answer-bearing only for the intents it actually serves; a read/observe/object-
// action tag answers read/OBJECT asks, never an addressed-PERSON question. The
// residual (Newbie-7, docs/playtests/opus-gate-2026-07-02-P10-AG3.md): "the letter
// says someone got married — do you know who?" keyed the letter-READ path (a thing-
// interaction, [read:revealed-item]) yet asked a person — so the person's question
// was answered by re-reading the letter. The egress now types that cross as a
// mismatch (npc-addressed × read/object provenance) and repairs it to an honest
// in-voice decline. The over-match guard is the twin lock: a genuine read/object
// question ("what does the letter say?" → place, "read the letter" → command) is
// STILL served by the read path, untouched. Repair is narration-only (determinism
// holds). fixture: revealed_letter (an open coffer that has revealed the marriage
// letter, which names no one).
export default [
  {
    id: 'C22-001',
    capability: 'C22',
    status: 'locked',
    fixture: 'revealed_letter',
    intent: 'a PERSON-question that keys the letter-read path (npc-addressed × [read:revealed-item]) is repaired at the egress to an honest in-voice decline — never answered by re-reading the letter (the object cannot answer the person)',
    paraphrases: [
      'Sorry, I mean the letter — it says someone got married. Do you know who?',
      'the letter says someone got married — do you know who?',
      'the letter says they were wed — do you know who married?',
      'the letter reads that a wedding was held — were you told who?',
    ],
    assert: {
      // the egress repaired the mismatch …
      surface_matches: [/\[egress:repair\]/],
      // … and the letter was NOT re-read at the person (no read tag, no letter body).
      surface_excludes: [/\[read:revealed-item/, /married at last/i],
    },
    diverge: [
      { text: 'read the letter', reason: 'a genuine read COMMAND (not a question) is served by the read path — never egress-repaired' },
      { text: 'what does the letter say?', reason: 'a genuine read QUESTION (kind:place) IS served by the read path — the mismatch fires only on npc-addressed, so this passes through untouched' },
      { text: 'is there a name on it?', reason: 'a referent-followup about the item declines via the info path, not the person-question egress repair — not the letter re-read' },
    ],
  },
  {
    id: 'C22-002',
    capability: 'C22',
    status: 'locked',
    fixture: 'revealed_letter',
    intent: 'the over-match guard: a genuine read/object question or command still delivers the revealed letter through the read path, untouched by the intent-aware whitelist',
    paraphrases: [
      'what does the letter say?',
      'read the letter',
      'read the folded letter',
    ],
    assert: {
      // the read path delivered the grounded letter …
      surface_matches: [/\[read:revealed-item/, /married at last/i],
      // … and the person-question egress repair never fired on it.
      surface_excludes: [/\[egress:repair\]/],
    },
    diverge: [
      { text: 'the letter says someone got married — do you know who?', reason: 'an addressed-person question behind the letter is the mismatch — repaired, so it does NOT hold the read-path signature' },
      { text: 'do you know who wrote it?', reason: 'a person-question about the writer is answered/declined by the person, not the read path' },
    ],
  },
];
