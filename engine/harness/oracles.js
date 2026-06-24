// ─────────────────────────────────────────────────────────────────────────────
// engine/harness/oracles.js — the deterministic oracle bank (Phase 1).
//
// "Coherent against WHAT?" → against the table (THE_TABLE_TEST). Each oracle reads
// COMMITTED state and the engine's narration and asks a yes/no question a real D&D
// table would answer. They are pure, free (ZERO API cost — the whole point), and
// deterministic: a finding replays exactly on the same seed + action log.
//
// Phase 1 ships the three the brief names — state-desync (the crown jewel),
// free-action, soft-lock/goal. Each is tuned for PRECISION over recall: a finder
// people will trust must not cry wolf, so a rule only fires on a high-confidence
// contradiction. Lower-recall extensions (spatial, consequence, §0) are left as
// labelled one-line registry slots for the "follow within the phase" work.
//
// HARD INVARIANT (narration ≠ canon): READ-ONLY over the world. No mutation, no
// RNG. The oracle reports; the engine remains the sole author of canon.
// ─────────────────────────────────────────────────────────────────────────────

import { buildCanonGroundTruth } from '../ref/rubric.js';
import { isInsideInterior, presentRoomObjects, headNoun } from './goals.js';

// The engine prefixes base narration with "Wizard:" (a speaker tag the UI renders
// via attribution, not literally). Strip it so the oracle judges what a player
// reads — otherwise the prefix itself looks like an artifact leak.
export function cleanNarration(s) {
  return String(s || '').replace(/^\s*Wizard:\s*/i, '').trim();
}

// A real check happened this turn iff the engine recorded a NEW roll
// (conversation.lastRoll changes — it carries an incrementing `turn`) OR the
// mechanics line shows the "[roll:N vs DC:M → …]" stamp. Both are deterministic.
export function rolledThisTurn(before, after, output) {
  const a = JSON.stringify(before?.conversation?.lastRoll ?? null);
  const b = JSON.stringify(after?.conversation?.lastRoll ?? null);
  if (a !== b) return true;
  return /\broll:\s*\d+\s*vs\s*DC\s*:?\s*\d+/i.test(String(output?.mechanics || ''));
}

function makeFinding(oracleId, severity, fields) {
  return { oracleId, severity, ...fields };
}

// ── Oracle: state-desync (the crown jewel) ────────────────────────────────────
// Diff what the narration CLAIMS happened against what the Canon Log COMMITTED,
// turn-over-turn. Phase 1 covers the highest-confidence claim→delta pairs:
//   • EXIT  — "you step outside" must clear the interior      (the flagship)
//   • ENTER — "you step inside the <building>" must set one
//   • DEATH — "<foe> falls dead/slain" must leave a defeated/removed enemy
// (Pouch/pickup inventory deltas need an item-level view buildCanonGroundTruth
//  doesn't yet expose without false-positives on "you take stock" — deferred.)

const EXIT_CLAIM = /\b(?:step(?:s|ped)?|head(?:s|ed)?|walk(?:s|ed)?|go|going|slip(?:s|ped)?|stride[sd]?|duck(?:s|ed)?|emerge[sd]?|exit(?:s|ed)?)\b[^.!?]{0,40}?\b(?:back\s+)?(?:outside|out\s+(?:the\s+door|into\s+the|of\s+(?:the|this)\s+\w+)|out\s+into)\b|\b(?:leave|leaving|left|exit)\b[^.!?]{0,24}?\b(?:building|house|cottage|hut|cabin|inn|tavern|hall|room|shop|store|lodge|temple|shrine)\b|\bback\s+outside\b/i;

const ENTER_CLAIM = /\b(?:step(?:s|ped)?|head(?:s|ed)?|walk(?:s|ed)?|go|going|duck(?:s|ed)?|slip(?:s|ped)?|enter(?:s|ed)?)\b[^.!?]{0,32}?\b(?:inside|indoors|in\s+through\s+the\s+door|into\s+the\s+(?:building|house|cottage|hut|cabin|inn|tavern|hall|shop|store|lodge|temple|shrine|keep|tower))\b/i;

const DEATH_CLAIM = /\b(?:falls?\s+(?:dead|lifeless)|drops?\s+dead|lies?\s+dead|is\s+(?:slain|killed|dead|cut\s+down|struck\s+down)|crumples?\s+(?:dead|lifeless)|you\s+(?:kill|slay|cut\s+down|strike\s+down|finish))\b/i;

// FUTURE intent, not a committed move: "ready yourself TO step out", "about to head
// in", "before you step outside". The DM describing the player getting READY to leave/
// enter is not a lie about where they are — skip the exit/enter desync when the motion
// sits inside a readiness clause. (Journey run t2: "as you ready yourself to step out
// into the settlement" while dressing — narration is fine, the oracle was over-firing.)
const FUTURE_MOTION = /\b(?:ready|readies|readied|readying|prepar\w+|about|set|bracing|steeling|getting\s+ready|going|meaning|hoping|intend\w*|ready\s+yourself)\s+(?:yourself\s+|himself\s+|herself\s+|themselves\s+)?to\s+(?:step|head|walk|go|move|slip|duck|stride|venture|leave|exit|enter|set\s+out|head\s+(?:out|in))\b|\bbefore\s+(?:you\s+)?(?:step|head|walk|go|leave|enter|venture|set)\b/i;

export function runStateDesync({ before, after, output }) {
  const text = cleanNarration(output?.narration);
  if (!text) return [];
  const findings = [];
  const futureOnly = FUTURE_MOTION.test(text); // readiness clause, not a committed move

  // EXIT — if the narration says you went outside but you are STILL inside.
  if (!futureOnly && EXIT_CLAIM.test(text) && isInsideInterior(before) && isInsideInterior(after)) {
    findings.push(makeFinding('state-desync', 'high', {
      claim: 'narration says the player stepped outside',
      expected: 'scene.interior cleared (now outdoors)',
      committed: `scene.interior still set (room ${after?.scene?.interior?.roomId})`,
      note: 'said-outside-still-inside — the DM lied about where you are (THE_TABLE_TEST: you go where you said)',
    }));
  }

  // ENTER — if the narration says you went inside but no interior was set.
  if (!futureOnly && ENTER_CLAIM.test(text) && !isInsideInterior(before) && !isInsideInterior(after)) {
    findings.push(makeFinding('state-desync', 'high', {
      claim: 'narration says the player stepped inside a structure',
      expected: 'scene.interior set (now indoors)',
      committed: 'scene.interior still null (still outdoors)',
      note: 'said-inside-still-outside — entered a building the engine never put you in',
    }));
  }

  // DEATH — if the narration kills a foe but no enemy went defeated/removed.
  if (DEATH_CLAIM.test(text)) {
    const enemiesBefore = buildCanonGroundTruth(before).enemies || [];
    const enemiesAfter = buildCanonGroundTruth(after).enemies || [];
    const someDefeated = enemiesAfter.some(e => e.defeated);
    const someRemoved = enemiesAfter.length < enemiesBefore.length;
    if (enemiesBefore.length > 0 && !someDefeated && !someRemoved) {
      findings.push(makeFinding('state-desync', 'high', {
        claim: 'narration says a foe was slain',
        expected: 'an enemy marked defeated or removed from combat',
        committed: `enemies still standing: ${enemiesAfter.map(e => `${e.name}(${e.hp}/${e.maxHp})`).join(', ') || '(none tracked)'}`,
        note: 'narrated-a-kill-no-corpse — death in prose with no mechanical death (combat-lethality seam)',
      }));
    }
  }

  return findings;
}

// ── Oracle: free-action ───────────────────────────────────────────────────────
// Some intents must resolve with NO roll — a real DM does not call for a check to
// walk out a door or look around (THE_TABLE_TEST). If a clearly-free action rolled
// the dice, that is the bug. Tuned to the highest-confidence free intents only
// (the `tallow` start state shows the engine resolves all of these roll-free).
const FREE_INTENT = [
  /\bstep(?:s|ped)?\s+(?:out(?:side)?|in(?:side)?)\b/i,
  /\bgo(?:es|ing)?\s+(?:out(?:side)?|in(?:side)?|back\s+(?:out|in)(?:side)?)\b/i,
  /\bhead(?:s|ed)?\s+(?:out(?:side)?|in(?:side)?)\b/i,
  /\bget(?:s|ting)?\s+(?:out\s+of\s+bed|up)\b/i,
  /\bstand(?:s|ing)?\s+up\b/i,
  /\blook(?:s|ing)?\s+(?:around|about)\b/i,
  /\btake(?:s|ing)?\s+stock\b/i,
  /\bsurvey(?:s|ing)?\b/i,
  /\b(?:talk|speak)\s+(?:to|with)\b/i,
  /\b(?:greet|approach)\b[^.!?]{0,24}\b(?:to\s+talk|and\s+(?:say|greet))\b/i,
];

function isFreeIntent(action) {
  const t = String(action || '');
  return FREE_INTENT.some(re => re.test(t));
}

export function runFreeAction({ before, after, action, output }) {
  if (!isFreeIntent(action)) return [];
  if (!rolledThisTurn(before, after, output)) return [];
  return [makeFinding('free-action', 'med', {
    claim: `a free action resolved with a die roll: "${String(action).slice(0, 60)}"`,
    expected: 'no roll (a DM does not call a check to step out a door / look around / greet someone)',
    committed: `rolled — mech: ${String(output?.mechanics || '(none)').slice(0, 80)}`,
    note: 'rolled-a-free-action (intent-routing seam)',
  })];
}

// ── Oracle: object-interaction (look / search / take / examine) ───────────────
// Certifies the room-object PATH: the structured world is the ground truth, so a
// CLAIM about an object must match what the Canon Log committed (THE_TABLE_TEST —
// "you take the knife" means the knife is now yours; "examine the table" can't
// deny a table that's there). Reads committed state DIRECTLY (not the shared Ref
// view) so it never perturbs the gate's judge input and can count every inventory
// bucket. Precision over recall: each rule fires only on a structural contradiction
// the engine itself can't argue with — phantom inventory, a denied present object,
// loot conjured by a failed roll. (The looser "named a noun absent from furniture[]
// on a bare examine" stays a DEFERRED slot below: the fiction is richer than the
// furniture sockets — windows, walls, floors — so it can't clear the precision bar.)

// Total carried-item count across EVERY inventory bucket (weapons/tools/junk/items/
// spells/…). The live take path drops loot into `tools`, structured adds land in
// `items[]` — counting all buckets generically makes "inventory grew" reliable, which
// is the backbone of the acquisition check. (Mirrors playloop's allInventoryItems,
// generalized so a new bucket can never silently fool the oracle.)
function inventoryItemCount(world) {
  const inv = world?.party?.[0]?.inventory;
  if (!inv || typeof inv !== 'object') return 0;
  let n = 0;
  for (const k of Object.keys(inv)) if (Array.isArray(inv[k])) n += inv[k].length;
  return n;
}

// Verbs that ask to look closely AT a named thing (examine/look-at + the rolling
// search/check — a denial of a present object is a seam on either path).
const INSPECT_TARGET_RE = /\b(?:examine|inspect|study|scrutinize|appraise|look\s+(?:at|over|inside|into)|peer\s+at|read|search|check|rummage\s+through|rifle\s+through)\b/i;
// Generic "targets" that really mean the whole space (the engine defers these to a
// room overview, never a per-object denial) — no concrete object to certify.
const GENERIC_TARGET = new Set([
  'room', 'area', 'around', 'surroundings', 'place', 'here', 'everything', 'inventory',
  'pack', 'bag', 'belongings', 'self', 'myself', 'me', 'things', 'stuff', 'ground',
  'floor', 'walls', 'wall', 'ceiling', 'exits', 'exit', 'way', 'darkness', 'shadows',
  'nothing', 'surrounding', 'space', 'rest', 'door', 'doors',
]);

// The concrete object the player asked to inspect, or '' if none / generic.
function examineTarget(action) {
  const t = String(action || '').toLowerCase();
  const m = t.match(INSPECT_TARGET_RE);
  if (!m) return '';
  let rest = t.slice((m.index ?? 0) + m[0].length).trim();
  rest = rest.replace(/^(?:at|over|inside|in|into|the|a|an|my|this|that|these|those|some|your|for|through)\s+/i, '');
  rest = rest.replace(/^(?:the|a|an|my|this|that|these|those|some|your)\s+/i, '');
  rest = rest.replace(/\b(?:for\s+traps|for\s+danger|carefully|closely|over)\b.*$/i, '').trim();
  rest = rest.replace(/[.?!,;:]+$/g, '').trim();
  const head = rest.split(/\s+/).pop() || '';
  if (!rest || GENERIC_TARGET.has(rest) || GENERIC_TARGET.has(head)) return '';
  return rest;
}

// Does a present object answer to the player's target (full-name, substring, head
// noun, or a named part)? The same loose match the engine's detector uses.
function objectAnswersTo(obj, target) {
  const name = String(obj.name || '').toLowerCase();
  const tgt = String(target || '').toLowerCase();
  const tHead = tgt.split(/\s+/).pop() || '';
  if (!name || !tgt) return false;
  if (name === tgt || name.includes(tgt) || tgt.includes(name)) return true;
  if (tHead.length >= 3 && headNoun(name) === tHead) return true;
  return obj.parts.some(p => { const pl = String(p).toLowerCase(); return pl && (pl === tgt || pl === tHead); });
}

// The roll outcome stamped in the mechanics line ("… → failure | …"), or null.
function rollOutcome(output) {
  const m = /→\s*(failure|success|mixed)\b/i.exec(String(output?.mechanics || ''));
  return m ? m[1].toLowerCase() : null;
}

// ACQUISITION claim — the DM says a concrete object is now CARRIED. A determiner is
// required before the noun, which alone rejects the idioms with no article ("take
// cover/aim/stock/charge/refuge"); the stop-noun set rejects the rest ("take a
// look/seat/breath", "take the lead/stairs/plunge", "take your time/leave").
// "lift" was REMOVED — it false-fired on "you lift the chest's lid" (lifting a lid is
// not acquiring the object). The remaining verbs are unambiguous acquisitions.
const ACQUIRE_VERB = '(?:take|takes|took|pocket|pockets|pocketed|grab|grabs|grabbed|snatch|snatches|snatched|scoop|scoops|scooped|stuff|stuffs|stuffed|tuck|tucks|tucked|slip|slips|slipped|claim|claims|claimed|collect|collects|collected|gather|gathers|gathered|nab|nabs|nabbed|swipe|swipes|swiped|pick(?:s|ed)?\\s+up)';
// Adjectives the claim may carry before the HEAD noun. Skipping a run of these (then
// keying STOP_NOUNS on the head) is what tells "take a REAL bed" / "take a DEEP breath"
// (idioms — head bed/breath is a stop-noun) from "take the brass KEY" (a real object).
// Only KNOWN adjectives are skipped, so "take a breath AND relax" can't swallow "and".
const ACQUIRE_ADJ = '(?:real|deep|long|good|quick|brief|short|fresh|hard|firm|big|great|fine|proper|decent|little|last|first|next|final|sharp|slow|wide|close|whole|full|sheer|mere|very|same|other|nice|sweet|sound|careful|steady|gentle|tight|loose|heavy|light|small|large|old|new|strange|mysterious|shiny|rusty|brass|iron|steel|silver|gold|golden|wooden|stone|leather|bone)';
const ACQUIRE_CLAIM = new RegExp(`\\byou\\s+${ACQUIRE_VERB}\\s+(?:up\\s+)?(?:the|a|an|your|my|his|her|its|their|that|this|one|two|three|several|some|a\\s+few)\\s+(?:${ACQUIRE_ADJ}\\s+)*([a-z][a-z'’-]+)`, 'i');
// NOTE: a bare "into your pocket" was REMOVED — it false-fired on "you REACH into your
// pocket… and your fingers close on nothing" (retrieving, not acquiring; the player had
// no coin). A real acquisition is caught by "goes/slides/drops into your pocket" or by an
// ACQUIRE_VERB ("you slip the coin into your pocket"). (IT-2 follow-up.)
const ACQUIRE_PHRASE = /\b(?:is|are)\s+(?:now\s+)?yours\b|\bnow\s+(?:carry|hold|have)\s+the\b|\b(?:goes|slides|drops|tucked|slipped|dropped)\s+into\s+your\s+(?:pack|pocket|bag|satchel|pouch|hand)\b/i;
// A take that DIDN'T happen — too heavy, refused, or merely attempted.
const ACQUIRE_NEGATE = /\b(?:tr(?:y|ies|ied)\s+to|attempts?\s+to|attempt(?:ing)?\s+to|can'?t|cannot|could\s?n'?t|won'?t|unable\s+to|fail(?:s|ed)?\s+to)\b|\btoo\s+(?:heavy|big|bulky|large|much)\b|\bwon'?t\s+budge\b|\bnothing\s+(?:to\s+take|worth\s+(?:taking|the))\b|\bcan'?t\s+(?:carry|lift|move)\b|\b(?:close|closes|closed)\s+on\s+nothing\b|\bempty[\s-]?handed\b|\bnot\s+even\s+lint\b|\bpockets?\s+(?:are|is)\s+empty\b|\bhand\s+(?:outstretched\s+and\s+)?empty\b|\b(?:road|way|path|field|day|night|hour|moment|fight|victory|win|battle|ground|floor|stage|world|future|choice|call|throne|crown|win)\s+(?:is|are)\s+(?:now\s+|once\s+(?:more|again)\s+|again\s+)?yours\b/i;
const STOP_NOUNS = new Set([
  'stock', 'cover', 'aim', 'note', 'notes', 'seat', 'breath', 'breather', 'moment', 'step',
  'steps', 'look', 'peek', 'swing', 'shot', 'knee', 'turn', 'beat', 'sip', 'swig', 'gulp',
  'drink', 'bite', 'stab', 'dive', 'plunge', 'gamble', 'chance', 'risk', 'side', 'lead',
  'hint', 'bait', 'blame', 'hit', 'charge', 'rest', 'break', 'stand', 'path', 'paths',
  'road', 'route', 'stairs', 'reins', 'helm', 'stage', 'point', 'refuge', 'shelter',
  'position', 'watch', 'count', 'tally', 'measure', 'time', 'leave', 'heart', 'courage',
  'comfort', 'pride', 'pity', 'offense', 'umbrage', 'initiative', 'vantage', 'stance',
  'guard', 'cue', 'lead', 'flight', 'wing', 'pause', 'breather', 'liberty', 'toll',
  'lid', 'lids', 'flap', 'cover', 'hood', 'cap',
  // rest / dialogue idioms — "take a bed/night/nap" (sleep), "take her meaning".
  'bed', 'night', 'nap', 'sleep', 'meaning',
]);
// A concrete DISCOVERY claim from a search ("you find a brass key").
const FIND_CLAIM = new RegExp(`\\byou\\s+(?:find|finds|found|discover|discovers|discovered|uncover|uncovers|uncovered|turn\\s+up|turns\\s+up|come\\s+across|comes\\s+across|dig\\s+up|locate|locates|located|spot|spots|spotted)\\s+(?:the|a|an|some|one|two|several|a\\s+few)\\s+([a-z][a-z'’-]+)`, 'i');
const FIND_NEGATE = /\b(?:nothing|empty[\s-]?handed|come\s+up\s+empty|no\s+sign|not\s+(?:a|one|anything|much))\b/i;

export function runObjectInteraction({ before, after, action, output }) {
  const text = cleanNarration(output?.narration);
  const findings = [];
  if (!text) return findings;

  // Check A — ACQUISITION that didn't land. The narration says a concrete object is
  // now carried, but total inventory did not grow (counted across every bucket).
  // A phantom item is a high-severity desync — the same class as said-outside-still-
  // inside, only on the inventory axis. (Backbone: structured inventory can't lie.)
  // A REST resolution narrates "you take a real bed and a real night" — an idiom, not
  // an acquisition; the mechanics tag ([rest:…]) is the clean tell, so skip it.
  const isRest = /\[rest:/i.test(String(output?.mechanics || ''));
  if (!isRest && !ACQUIRE_NEGATE.test(text)) {
    const m = ACQUIRE_CLAIM.exec(text);
    const claimed = (m && !STOP_NOUNS.has(String(m[1]).toLowerCase())) || ACQUIRE_PHRASE.test(text);
    if (claimed && inventoryItemCount(after) <= inventoryItemCount(before)) {
      findings.push(makeFinding('object-interaction', 'high', {
        claim: `narration says you took an item${m ? ` ("${m[1]}")` : ''}`,
        expected: 'that item added to inventory (item count up by one)',
        committed: `inventory unchanged at ${inventoryItemCount(after)} item(s)`,
        note: 'acquired-nothing — the DM handed you an item the engine never put in your pack (phantom acquisition)',
      }));
    }
  }

  // Check B — a present object DENIED. The player inspected a concrete target that
  // canon HAS at this node, yet the narration says it isn't here. Canon presence is
  // structural, so any denial of it is a flat contradiction (THE_TABLE_TEST: the
  // table is on the table — you can't tell the player there's no table).
  const target = examineTarget(action);
  if (target) {
    const present = presentRoomObjects(before).find(o => objectAnswersTo(o, target));
    if (present) {
      const esc = headNoun(present.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const full = String(present.name).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const denyRe = new RegExp(
        `\\b(?:look(?:s|ed)?\\s+for)\\b[^.!?]*\\b(?:${full}|${esc})\\b[^.!?]*\\bbut\\s+what'?s\\s+here\\b` +
        `|\\b(?:there\\s+(?:is|are)\\s+no|you\\s+(?:see|find|spot)\\s+no|no\\s+such|don'?t\\s+see\\s+(?:a|an|any)?)\\s+(?:${full}|${esc})\\b` +
        `|\\b(?:${full}|${esc})\\b[^.!?]{0,16}\\b(?:is|are)?\\s*n'?o?t?\\s*(?:here|present|there|around)\\b`,
        'i',
      );
      if (denyRe.test(text)) {
        findings.push(makeFinding('object-interaction', 'high', {
          claim: `narration denies "${present.name}" is here`,
          expected: `the DM to engage a present object (canon has it at this node)`,
          committed: `furniture present: ${presentRoomObjects(before).map(o => o.name).join(', ')}`,
          note: 'denied-present-object — the DM said an object isn\'t here that canon has present',
        }));
      }
    }
  }

  // Check C — a FAILED search that still conjured loot. The roll failed, yet the
  // narration claims a concrete find. (Success-finds and info-finds — "you find
  // tracks" — are fine; the acquisition check covers a find you then "take".)
  if (rollOutcome(output) === 'failure' && /\b(?:search|searches|searched|rummage|rummages|rifle|rifles|comb|combs|scour|scours|forage|forages)\b/i.test(String(action || ''))) {
    const fm = FIND_CLAIM.exec(text);
    if (fm && !STOP_NOUNS.has(String(fm[1]).toLowerCase()) && !FIND_NEGATE.test(text)) {
      findings.push(makeFinding('object-interaction', 'high', {
        claim: `a FAILED search narrated finding "${fm[1]}"`,
        expected: 'a failed search to turn up nothing',
        committed: `roll outcome: failure — ${String(output?.mechanics || '').slice(0, 60)}`,
        note: 'failed-search-claimed-loot — a failed search still narrated finding an item (roll↔fiction contradiction)',
      }));
    }
  }

  return findings;
}

// ── The per-turn oracle registry ──────────────────────────────────────────────
// Add a deterministic oracle as one { id, run } slot. run({before, after, action,
// output}) -> finding[]. (Phase-1 "follow" slots — spatial-correctness,
// consequence, §0 token-scan — drop in here unchanged.)
export const PER_TURN_ORACLES = Object.freeze([
  { id: 'state-desync', run: runStateDesync },
  { id: 'free-action', run: runFreeAction },
  { id: 'object-interaction', run: runObjectInteraction },
]);

// Run the whole per-turn bank; tag every finding with its turn + the action.
export function runOracleBank({ before, after, action, output, turn }) {
  const out = [];
  for (const oracle of PER_TURN_ORACLES) {
    let findings = [];
    try { findings = oracle.run({ before, after, action, output }) || []; }
    catch (e) { findings = [makeFinding(oracle.id, 'low', { note: `oracle threw: ${e?.message || e}` })]; }
    for (const f of findings) out.push({ ...f, turn, action });
  }
  return out;
}

// ── Oracle: soft-lock / goal (stateful, across turns) ─────────────────────────
// Pure over the per-turn progress series. The goal's progressMetric should climb
// toward completion; if its RUNNING MAX has not improved for `window` turns, the
// player is stuck — a dead-progress finding. Fires exactly ONCE, when the streak
// first reaches `window`, so a stuck session yields one finding, not a flood.
export const SOFT_LOCK_WINDOW = 8;

export function checkSoftLock(progressHistory, { window = SOFT_LOCK_WINDOW, goal, turn } = {}) {
  const hist = Array.isArray(progressHistory) ? progressHistory : [];
  const n = hist.length;
  if (n <= window) return null;
  let runningMax = -Infinity;
  let lastImproveIdx = -1;
  for (let i = 0; i < n; i++) {
    if (hist[i] > runningMax) { runningMax = hist[i]; lastImproveIdx = i; }
  }
  const flat = (n - 1) - lastImproveIdx; // turns since the running max last rose
  if (flat !== window) return null;       // emit only at the crossing
  return makeFinding('soft-lock', 'med', {
    turn: turn ?? n,
    claim: `no progress toward the goal for ${window} turns`,
    expected: `progressMetric to climb toward ${goal?.description || 'the goal'}`,
    committed: `progressMetric stuck at ${runningMax} since turn ${lastImproveIdx + 1}`,
    note: 'dead-progress — the player cannot make headway (soft-lock / can\'t-finish class)',
  });
}
