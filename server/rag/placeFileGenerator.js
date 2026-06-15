// Converts a dungeon's generated history struct to a place RAG file.
//
// Law: show, don't tell. Chunks contain observable physical facts only —
// material, position, wear, what's present, what's absent. No motive,
// no emotion-words, no "suggests / as if / you sense."
//
// Usage:
//   import { dungeonToPlaceFile, lintFile } from './placeFileGenerator.js';
//   const file = dungeonToPlaceFile(dungeon);
//   const errors = lintFile(file);
//   if (errors.length) throw new Error(...);
//   writeFileSync(`corpus/${file.id}.json`, JSON.stringify(file, null, 2));
//
// Naming: dungeon IDs are "dungeon:nodeId" at runtime. Replace colon with
// underscore for the corpus filename: "dungeon:n42" → "dungeon_n42.json".

// ── Lint ──────────────────────────────────────────────────────────────────────
// Catches interpretive drift in chunk text. Run on every generated file.
// An empty return means the chunk is clean.

const TELLS = [
  // Inference — the chunk drawing a conclusion the reader should draw
  [/\bsuggests?\b/i,     'suggests'],
  [/\bas if\b/i,         'as if'],
  [/\bimplies?\b/i,      'implies'],
  [/\bevokes?\b/i,       'evokes'],
  [/\bseems? to\b/i,     'seems to'],
  [/\bappears to\b/i,    'appears to'],
  [/\bmust have\b/i,     'must have'],
  [/\bmust be\b/i,       'must be'],
  [/\bspeaks? (?:of|to)\b/i, 'speaks of/to'],
  // Sensory direction — telling the player what they sense
  [/\byou sense\b/i,     'you sense'],
  [/\byou feel\b/i,      'you feel'],
  [/\byou can (?:feel|sense)\b/i, 'you can feel/sense'],
  // Atmospheric interpretation
  [/\bhaunting\b/i,      'haunting'],
  [/\bominous\b/i,       'ominous'],
  [/\bforeboding\b/i,    'foreboding'],
  [/\bsinister\b/i,      'sinister'],
  [/\beerie\b/i,         'eerie'],
  [/\batmosphere\b/i,    'atmosphere'],
  [/\bsense of\b/i,      'sense of'],
  [/\bair of\b/i,        'air of'],
  // Emotion nouns that have no place in physical residue
  [/\bdread\b/i,         'dread'],
  [/\bterror\b/i,        'terror'],
  [/\bdespair\b/i,       'despair'],
  [/\bhorror\b/i,        'horror'],
  [/\banguish\b/i,       'anguish'],
  // Authorial intrusion
  [/\bclearly\b/i,       'clearly'],
  [/\bobviously\b/i,     'obviously'],
];

export function lintChunk(text) {
  const hits = [];
  for (const [pattern, label] of TELLS) {
    if (pattern.test(String(text))) hits.push(label);
  }
  return hits;
}

export function lintFile(placeFile) {
  const errors = [];
  for (const chunk of (Array.isArray(placeFile?.chunks) ? placeFile.chunks : [])) {
    const hits = lintChunk(chunk.text ?? '');
    if (hits.length) errors.push({ chunkId: chunk.id, flagged: hits });
  }
  return errors;
}

// ── Keyword extractor ─────────────────────────────────────────────────────────

const STOP = new Set([
  'the','and','for','with','from','that','this','into','over','upon',
  'more','some','only','very','just','were','then','than','what','when',
  'where','they','been','have','its','not','are','but','was','had',
  'one','two','all','each','both','here','there','still','back','down'
]);

function kw(text) {
  return [...new Set(
    String(text).toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter(t => t.length >= 3 && !STOP.has(t))
  )].slice(0, 10);
}

// ── Physical description templates ───────────────────────────────────────────
// Engine-owned physical baselines per theme. These describe what the
// place looked like when it was in use — observable infrastructure, not history.
// Expand here as more themes are added. No interpretation allowed.

const FOUNDING_BODY = {
  mine: 'The main gallery follows the ore seam; the entry shaft is vertical, with cage-and-rope hardware at the surface. Timbering in the upper galleries is heavy — built for long operation. Ore-cart tracks run from the working faces to the shaft base. Side galleries branch off the main at intervals, cut to follow secondary veins.',
  crypt: 'Niches line the passage walls at regular intervals, each originally sealed with a flat stone set flush to the surface. The construction is stone-on-stone in the oldest sections, mortar only in later extensions. Small goods were placed in niches at the time of interment; some remain in undisturbed sections.',
  sewer: 'Stone channels run along the passage floors; iron grate-work is set at intervals to catch debris. Tallow niches are cut into the walls at eye level for lanterns. The brickwork nearest the original waterline uses a different composition than the upper courses, consistent with a repair after a flooding event.',
  hold: 'The walls are rubble-fill between ashlar faces; the gatehouse is the heaviest construction. Inside the perimeter: a muster yard, an armoury building, a hall with a long table, a well at the yard center. A wall-walk runs complete around the perimeter. Watch-positions are set at regular intervals.',
  lair: 'The hollow was not built — it was expanded over time. The walls show removal rather than cutting: material taken from a center outward. Passages branch irregularly, following the path of least resistance in the substrate. The deepest sections are the widest; the largest space is at the bottom rather than the entry.',
  shrine: 'A flat surface serves as an altar at the far end of the chamber; kneeling-marks are worn into the stone before it. Offering niches are cut at regular intervals in the walls. The construction is finished work — dressed stone, not rough. An inscription ran above the altar; the letters have been removed.',
  infernal: 'The floor of the central chamber is smooth stone finished to a flatness that ordinary stonework does not achieve, with no visible construction seams. A circle is burned into the center. Work surfaces and storage niches line the walls. A ledger-shelf is cut into the east wall at writing height.',
};

const CATASTROPHE_BODY = {
  mine: 'The lower gallery shows where the shaft wall failed at the working face. The cavity beyond the breach has not been surveyed; its extent is not visible from the mine side. The shift working the face at the time of the breach did not return to the surface. The upper galleries were abandoned without formal closure; the shaft was left open.',
  crypt: 'The burn damage in the upper crypt sections reaches the vaulted ceilings; smoke residue runs along the stone. Below the level of the fire, the crypt passages are intact. Sealing stones on the lower niches are displaced — some on the passage floor, some on the niche-side of the threshold. The disturbance is below the fire line, not in the burned sections.',
  sewer: 'The floodgate in the main channel is open. The gate mechanism is intact and functional; the gate was opened, not broken. Water-level marks on the walls indicate the passage flooded to near ceiling height at some point. The organic debris left by that event is above current water level, preserved as a thin layer on the upper walls.',
  hold: 'The keep shows no external breach: gates intact, walls unbroken, no siege damage on the outer face. Dark staining in the muster yard and hall is distributed rather than concentrated at any single entry point — inconsistent with a fight moving through from a breach. The armoury racks are empty. The armoury is unlocked; the keys are on a hook inside.',
  lair: 'The passages near the entry show drag-marks in the substrate — wide parallel grooves consistent with large objects being moved inward. The marks run deeper into the hollow, not toward the exit. The midden at the deepest point is large; whatever produced it used this space for a long time.',
  shrine: 'The altar surface is cracked: a single crack from the front edge to the back, consistent with a heavy impact from above rather than temperature change. The kneeling-marks before it are worn deep. The area immediately in front of the altar shows different wear from the rest of the passage floor.',
  infernal: 'The circle on the floor is burned deeper at the perimeter than at the center — hottest at the edge. Chalk diagrams on the walls are partially obliterated, some smeared as if a hand moved fast across wet chalk. The ledger on the east shelf is open; the last entry is unfinished, the writing stops mid-sentence without a correction.',
};

// Derive a readable source name from an echo string.
// "pickaxes dropped mid-swing, rusting where they fell"
// → "Physical evidence — pickaxes dropped mid-swing"
function echoSource(echo) {
  const short = String(echo).split(/[,;—]/)[0].trim().slice(0, 60);
  return `Physical evidence — ${short}`;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * dungeonToPlaceFile(dungeon) → placeFile object
 *
 * dungeon: the normalized dungeon object from schema.js, which has:
 *   { id, entranceNodeId, theme, history: { name, origin, catastrophe, denizen, echoes[] } }
 *
 * Returns a place file object ready to be JSON-serialized.
 * The caller MUST run lintFile() on the result before writing.
 *
 * Corpus filename convention: dungeon.id.replace(/:/g, '_') + '.json'
 * e.g. "dungeon:n42" → "dungeon_n42.json"
 */
export function dungeonToPlaceFile(dungeon) {
  const theme   = String(dungeon.theme   || 'shrine');
  const history = dungeon.history        || {};
  const name    = String(history.name    || dungeon.id || 'Unknown Dungeon');
  const origin  = String(history.origin  || '');
  const catastrophe = String(history.catastrophe || '');
  const echoes  = Array.isArray(history.echoes) ? history.echoes : [];

  const fileId = String(dungeon.id || '').replace(/:/g, '_').replace(/[^a-z0-9_-]/gi, '_');

  const foundingBody = FOUNDING_BODY[theme] || FOUNDING_BODY.shrine;
  const catastropheBody = CATASTROPHE_BODY[theme] || CATASTROPHE_BODY.shrine;

  // Capitalise and strip trailing punctuation from origin/catastrophe strings
  // so they read as clean opening sentences.
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/[.,;]+$/, '') + '.' : '';

  const chunks = [
    {
      id: 'founding_1',
      source: `${name} — establishment and original function`,
      text: `${cap(origin)} ${foundingBody}`,
      era: 'founding',
      keywords: kw(origin + ' ' + foundingBody),
      latent: false,
    },
    {
      id: 'catastrophe_1',
      source: `${name} — the event`,
      text: `${cap(catastrophe)} ${catastropheBody}`,
      era: 'event',
      keywords: kw(catastrophe + ' ' + catastropheBody),
      latent: false,
    },
    ...echoes.map((echo, i) => ({
      id: `echo_${i}`,
      source: echoSource(echo),
      text: cap(echo),
      era: 'post-event',
      keywords: kw(echo),
      latent: true,
    })),
  ];

  return {
    id: fileId,
    name,
    place_type: 'dungeon',
    theme,
    entrance_node_id: String(dungeon.entranceNodeId || ''),
    chunks,
  };
}
