// C24 — INT-4-TRAVEL: "go to <a known map PLACE>" starts the JOURNEY; the referent-
// disambiguation sink must NEVER answer a known place as a PERSON.
//
// The live sighting (2026-07-04-pm5, v0.28.15 boot): the player typed "go to The
// Greenwood" — a neighbouring map NODE on the aldermere slice — from INSIDE a building,
// and the game answered "I haven't introduced anyone named The Greenwood… who do you
// actually mean?". THE_DM_TEST: a DM hears "go to the Greenwood" and starts the journey.
//
// fixture: slice_travel_indoors — the player is indoors at their node with a KNOWN
// neighbouring place named "The Greenwood" one edge away (undiscovered; a direct
// neighbour resolves discovery-independent). The indoor→travel bridge must step the
// player out the door and run the JR-1 journey, regardless of the travel verb (go/walk/
// travel/head) and the article/case of the place name.
//
// status: 'locked' — the routing lives entirely at the deterministic LLM-off floor
// (the indoor→travel bridge + the article/case-aware place resolver in playloop.js), so
// the journey-vs-person-clarify decision is judge-free and replay-stable. Verified
// deterministically with INTENT_LLM_MODEL=off (and mirrored by unit tests U452/U453).
export default [
  {
    id: 'C24-001',
    capability: 'C24',
    status: 'locked',
    fixture: 'slice_travel_indoors',
    intent: 'travel voiced to a KNOWN neighbouring PLACE ("go to The Greenwood") engages the journey path (step out + set off / a road encounter), and is never bounced back as a person-disambiguation',
    paraphrases: [
      'go to The Greenwood',
      'go to the greenwood',
      'go to Greenwood',
      'walk to The Greenwood',
      'travel to The Greenwood',
      'head to The Greenwood',
    ],
    assert: {
      // the JOURNEY signature — a signal only the travel path emits (arrival at the
      // named place, the [travel | journey-arrive] mech tag, or the JR-1 road-encounter
      // premium). Deliberately NOT the bare "step out into the open air" prefix, which
      // the honest "no such place" answer also emits (see the go-to-Rivendell diverge).
      surface_matches: [/you reach\b|\[travel \| journey-arrive\]|encounter:pending|\bambush\b|Highwaymen|toll/i],
      // NEVER the person-disambiguation shape for a known place.
      surface_excludes: [/haven'?t introduced anyone|who do you actually mean|no one by that name/i],
    },
    diverge: [
      { text: 'talk to Galen', reason: 'a genuine present-NPC reference stays DIALOGUE (enters conversation) — the grounding must not swallow real person references into travel' },
      { text: 'go to the hearth room', reason: 'a named INTERIOR-ROOM move resolves on the interior room graph (NODE-DESYNC-1) — it stays indoors and never routes to the node journey' },
      { text: 'go to Rivendell', reason: 'an UNKNOWN place gets the honest "you know of no such place hereabouts" answer, not a journey to nowhere (and not a person-clarify)' },
    ],
  },
];
