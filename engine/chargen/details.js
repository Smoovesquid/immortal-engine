import { seedFromString, makeRng } from '../rng.js';

// Character Genesis v2 — ritual choices
// Roll 3 options per category; UI selects 1.

export function rollDetailOptions(packId, seed, rng) {
  const pack = String(packId || 'fantasy');
  const baseSeed = `${seed}|chargen|${pack}|details`;
  const r = rng || makeRng(seedFromString(baseSeed));

  return {
    detail: pickUniqueN(TABLES.detail[pack] || TABLES.detail.fantasy, r, 3),
    keepsake: pickUniqueN(TABLES.keepsake[pack] || TABLES.keepsake.fantasy, r, 3),
    lineYouWontCross: pickUniqueN(TABLES.lineYouWontCross[pack] || TABLES.lineYouWontCross.fantasy, r, 3),
    rumor: pickUniqueN(TABLES.rumor[pack] || TABLES.rumor.fantasy, r, 3)
  };
}

export function normalizeRitualPicks(opts, picks) {
  const p = picks && typeof picks === 'object' ? picks : {};
  return {
    detail: pickFromOptions(opts?.detail, p.detail),
    keepsake: pickFromOptions(opts?.keepsake, p.keepsake),
    lineYouWontCross: pickFromOptions(opts?.lineYouWontCross, p.lineYouWontCross),
    rumor: pickFromOptions(opts?.rumor, p.rumor)
  };
}

function pickFromOptions(options, pick) {
  const arr = Array.isArray(options) ? options : [];
  if (!arr.length) return '';
  const s = String(pick || '').trim();
  if (s && arr.includes(s)) return s;
  return String(arr[0] || '');
}

function pickUniqueN(list, rng, n) {
  const arr = Array.isArray(list) ? list.map(String).map(s => s.trim()).filter(Boolean) : [];
  if (!arr.length) return [];
  const out = [];
  const seen = new Set();
  while (out.length < Math.min(n, arr.length)) {
    const s = String(rng.pick(arr) || arr[0]);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

const TABLES = {
  detail: {
    fantasy: [
      'You always count exits twice.',
      'Your hands shake only when you are calm.',
      'You can’t sleep without a candle stub nearby.',
      'You apologize to doors before forcing them.',
      'You hum under your breath when danger is close.'
    ],
    haunted: [
      'You speak to empty rooms like they answer.',
      'You never step on cracked tile.',
      'You keep receipts from places you regret.',
      'You refuse to look into mirrors at night.',
      'You flinch at the sound of running water.'
    ],
    zombie: [
      'You inventory food before you inventory people.',
      'You don’t run unless you have to.',
      'You sleep with shoes on.',
      'You check bites like prayers.',
      'You laugh at the worst possible moments.'
    ],
    modern: [
      'You always know where your keys are.',
      'You talk too fast when you lie.',
      'You keep a list you won’t show anyone.',
      'You hate silence more than noise.',
      'You don’t answer unknown numbers.'
    ],
    'space-rift': [
      'You tap twice before touching any panel.',
      'You taste the air to gauge the ship.',
      'You keep your helmet within arm’s reach.',
      'You trust instruments more than voices.',
      'You don’t mention Earth unless someone else does.'
    ]
  },
  keepsake: {
    fantasy: ['a chipped signet ring', 'a saint’s token', 'a scrap of a lost banner', 'a nail from a burned home', 'a smooth river-stone'],
    haunted: ['a key that fits nothing', 'a lock of hair in wax', 'a film photo of a blank hallway', 'a child’s drawing', 'a prayer card stained brown'],
    zombie: ['a tin of mints (still sealed)', 'a dog tag you didn’t earn', 'a half-charged radio', 'a cracked lighter', 'a photo in plastic'],
    modern: ['a cheap watch that runs fast', 'a burner phone', 'a folded court notice', 'a coworker’s pen', 'a subway token'],
    'space-rift': ['a mission patch', 'a cracked data wafer', 'a calibration coin', 'a spool of copper wire', 'a vial labeled “DO NOT OPEN”']
  },
  lineYouWontCross: {
    fantasy: ['you won’t break a sworn oath', 'you won’t leave a captive to rot', 'you won’t burn sacred ground', 'you won’t betray a companion for gold', 'you won’t drink from a cursed source'],
    haunted: ['you won’t lie to a child', 'you won’t lock someone in alone', 'you won’t read names on gravestones', 'you won’t take souvenirs from the dead', 'you won’t stay after the third knock'],
    zombie: ['you won’t take the last ration', 'you won’t shoot first', 'you won’t abandon someone who can still walk', 'you won’t use a bite as leverage', 'you won’t leave a friend unburied'],
    modern: ['you won’t hit a civilian', 'you won’t frame an innocent', 'you won’t burn a bridge you might need', 'you won’t steal from the desperate', 'you won’t go back to that one address'],
    'space-rift': ['you won’t vent a compartment with people inside', 'you won’t falsify a log', 'you won’t cut the tether', 'you won’t leave salvage behind if it’s recoverable', 'you won’t power down life support']
  },
  rumor: {
    fantasy: ['the shrine answers at midnight', 'the courier didn’t vanish—he changed', 'the relic wants to be found', 'the curse is rented, not earned', 'the watchtower is older than the road'],
    haunted: ['the house remembers every lie', 'the basement door is newer than the walls', 'the owner never died—just moved rooms', 'the whispers are instructions', 'the attic is bigger on Tuesdays'],
    zombie: ['the safe zone is a trap', 'someone is tagging the dead', 'the river water keeps you quiet', 'the radio voice is real', 'the bitten dream of the living'],
    modern: ['the footage was edited at the source', 'the city inspectors are on payroll', 'the witness is protected by the wrong people', 'the building plans don’t match the basement', 'someone wants you to find this'],
    'space-rift': ['the rift has a schedule', 'the hull damage is deliberate', 'the beacon is bait', 'the captain’s voice isn’t the captain', 'gravity goes weird near the blue lights']
  }
};
