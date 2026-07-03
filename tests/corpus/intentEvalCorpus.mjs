// tests/corpus/intentEvalCorpus.mjs — INT-2 frozen intent-translator benchmark corpus.
//
// A small (target 15-30), FROZEN utterance -> expected-packet-fields corpus,
// seeded from real gate-history failing turns (docs/RUNG1_QUEUE.md gate logs,
// docs/playtests/ transcripts, and the memo's own examples cited in
// docs/PACKETS.md INT-2 / docs/briefs/INT-2-llm-translator-sonnet.md §5):
// "who lit that lantern, Elske?", "what's my name and HP?", "I take him out",
// "I use the table", "I stab the goblin by the door", "I teleport through
// the wall".
//
// Each row carries a fixed `bundle` (the scene-candidate universe a real
// buildParseCtx call would produce for that turn) so scoring is reproducible
// independent of any future change to procedural NPC rosters. `expect` is
// intentionally loose (verb + a couple of load-bearing fields) — the point of
// this corpus is to catch INVENTED IDS and gross verb misclassification, not
// to pin every field of the packet.
//
// Consumed by scripts/intent-eval.mjs. Not part of `node --test` (no network
// calls belong in the fast loop) — run explicitly, and it spends real budget
// when an Anthropic key is present (see BUILD_BUDGET.md).

export const BUNDLE = {
  entities: [
    { id: 'elske', name: 'Elske', ref: 'innkeeper' },
    { id: 'goblin_1', name: 'goblin', ref: null },
    { id: 'brigand_1', name: 'brigand', ref: null }
  ],
  abilities: ['Worn Blade'],
  spells: [],
  items: ['torch', 'wooden table']
};

// expect fields:
//   verb        — the one correct verb (required match)
//   targetName  — if set, the correct target must (loosely) equal this name
//   noTarget    — if true, a correct answer names NO target (nothing in scene resolves)
//   wantsClarify— if true, this utterance is genuinely ambiguous — the ideal
//                 answer is a clarify signal (kind/ambiguity set), not a guess
//   impossible  — if true, this is a request the fiction cannot honor (no verb
//                 should attempt it as a legal action) — used only to check
//                 the model doesn't fabricate a resolving target/object for it
export const CORPUS = [
  {
    id: 'C-01',
    text: 'who lit that lantern, Elske?',
    expect: { verb: 'talk', targetName: 'Elske' }
  },
  {
    id: 'C-02',
    text: "what's my name and HP?",
    expect: { verb: 'ask', noTarget: true }
  },
  {
    id: 'C-03',
    text: 'I take him out',
    expect: { verb: 'attack', wantsClarify: true } // "him" is a genuine referent ambiguity
  },
  {
    id: 'C-04',
    text: 'I use the table',
    expect: { verb: 'use', targetName: 'wooden table' }
  },
  {
    id: 'C-05',
    text: 'I stab the goblin by the door',
    expect: { verb: 'attack', targetName: 'goblin' }
  },
  {
    id: 'C-06',
    text: 'I teleport through the wall',
    expect: { verb: 'ask', impossible: true } // no legal verb resolves this; must not invent a target
  },
  {
    id: 'C-07',
    text: 'I light the torch',
    expect: { verb: 'use', targetName: 'torch' }
  },
  {
    id: 'C-08',
    text: 'I greet Elske warmly',
    expect: { verb: 'talk', targetName: 'Elske' }
  },
  {
    id: 'C-09',
    text: 'I swing my worn blade at the brigand',
    expect: { verb: 'attack', targetName: 'brigand' }
  },
  {
    id: 'C-10',
    text: 'I search the room for anything useful',
    expect: { verb: 'search', noTarget: true }
  },
  {
    id: 'C-11',
    text: 'I ask Elske what happened here last winter',
    expect: { verb: 'talk', targetName: 'Elske' }
  },
  {
    id: 'C-12',
    text: 'I flee from the goblin',
    expect: { verb: 'flee' }
  },
  {
    id: 'C-13',
    text: 'I attack the dragon with my bare hands',
    expect: { verb: 'attack', noTarget: true } // "dragon" does not exist in this scene — must not invent it
  },
  {
    id: 'C-14',
    text: 'I wait and watch the door',
    expect: { verb: 'wait' }
  },
  {
    id: 'C-15',
    text: 'I pick up the torch',
    expect: { verb: 'take', targetName: 'torch' }
  },
  {
    id: 'C-16',
    text: 'kill it',
    expect: { verb: 'attack', wantsClarify: true } // "it" is unresolved without more context
  },
  {
    id: 'C-17',
    text: 'I ask the goblin to surrender',
    expect: { verb: 'talk', targetName: 'goblin' }
  },
  {
    id: 'C-18',
    text: 'I cast fireball at nothing in particular, just to see it burn',
    expect: { verb: 'cast', noTarget: true }
  }
];
