import { factStrings } from './ledger.js';

// Shared reality guard.
// Deterministic, conservative contradiction detector:
// - Looks for direct "I am/was" claims and "the location is" claims.
// - If claim contradicts an existing fact (by negation), block.

export function guardPlayerText(world, playerText) {
  const text = String(playerText ?? '').trim();
  if (!text) return { ok: false, reason: 'Empty move.', alternatives: [] };

  const canonFacts = factStrings(world).map(normalize);
  const scene = world.scene || {};
  const sceneTruths = [
    scene.location ? `location:${String(scene.location)}` : '',
    scene.objective ? `objective:${String(scene.objective)}` : ''
  ].filter(Boolean).map(normalize);

  const extracted = extractClaims(text).map(normalize);
  // Basic: if player explicitly negates a known fact, block.
  for (const c of extracted) {
    // if claim is "not X" and we have X.
    if (c.startsWith('not ')) {
      const pos = c.slice(4);
      if (canonFacts.includes(pos) || sceneTruths.includes(pos)) {
        return block(`canon says "${denormalize(pos)}"`);
      }
    }
    // if claim is X and we have "not X".
    const neg = `not ${c}`;
    if (canonFacts.includes(neg) || sceneTruths.includes(neg)) {
      return block(`canon says "${denormalize(neg)}"`);
    }
  }

  // Direct scene overwrite attempt: "we are in <somewhere>" that differs from scene.location.
  const locClaim = extractLocationOverwrite(text);
  if (locClaim && scene.location) {
    const a = normalize(locClaim);
    const b = normalize(String(scene.location));
    if (a && b && a !== b) {
      return {
        ok: false,
        reason: `No — that conflicts with the current location (${scene.location}).`,
        alternatives: [
          `Move toward ${locClaim} (travel / approach / sneak).`,
          `Search ${scene.location} for a way to reach ${locClaim}.`,
          `Ask for a roll to see if you can get to ${locClaim} quickly.`
        ]
      };
    }
  }

  // Unknown assertions: mark as rumor trigger heuristic.
  const unknown = extractUnknownAssertions(text);
  if (unknown.length) {
    return {
      ok: true,
      markRumor: unknown.slice(0, 2)
    };
  }

  return { ok: true };
}

function block(conflict) {
  return {
    ok: false,
    reason: `No — that conflicts with ${conflict}.`,
    alternatives: [
      'Try an action that changes the situation (move, search, negotiate).',
      'Ask for a roll to attempt something risky.',
      'Describe your approach without asserting a new fact.'
    ]
  };
}

function normalize(s) {
  let x = String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Normalize leading negation + articles so "not the king" == "not king".
  if (x.startsWith('not ')) {
    x = 'not ' + x.slice(4).replace(/^(a |an |the )/i, '').trim();
  } else {
    x = x.replace(/^(a |an |the )/i, '').trim();
  }
  return x;
}
function denormalize(s){
  return String(s ?? '').replace(/^not\s+/i,'not ');
}

function extractClaims(text) {
  const t = String(text);
  const out = [];
  // very small patterns, deterministic
  const patterns = [
    /\b(i am not|i'm not|i am|i'm)\s+([^\.!\?\n]+)/ig,
    /\b(we are not|we're not|we are|we're)\s+([^\.!\?\n]+)/ig,
    /\b(the location is not|the location is)\s+([^\.!\?\n]+)/ig,
    // Conservative "The X is (not) Y" claims.
    /\b(the|a|an)\s+([a-z][\w\s'\-]{1,48}?)\s+is\s+(not\s+)?([a-z][\w\s'\-]{1,48}?)(?=[\.!\?\n]|$)/ig
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(t)) !== null) {
      // Handle 2-group patterns (I am..., We are..., location is...)
      if (m.length <= 3) {
        const head = m[1].toLowerCase();
        const body = m[2].trim();
        if (!body) continue;
        const phrase = body.replace(/^(a|an|the)\s+/i,'');
        if (head.includes('not')) out.push(`not ${phrase}`);
        else out.push(phrase);
        continue;
      }

      // Handle "The X is (not) Y" pattern.
      const subj = String(m[2] ?? '').trim();
      const neg = Boolean(m[3]);
      const pred = String(m[4] ?? '').trim();
      if (!subj || !pred) continue;
      const phrase = `${subj} is ${pred}`;
      if (neg) out.push(`not ${phrase}`);
      else out.push(phrase);
    }
  }
  return out;
}

function extractLocationOverwrite(text) {
  const t = String(text);
  const m = t.match(/\b(we are in|we're in|i am in|i'm in|we are at|we're at)\s+([^\.!\?\n]+)/i);
  if (!m) return null;
  const loc = m[2].trim();
  return loc ? loc.replace(/^(a|an|the)\s+/i,'') : null;
}

function extractUnknownAssertions(text) {
  const t = String(text);
  // Heuristic: "I know that X" / "it's true that X" => potential rumor unless already canon.
  const out = [];
  const re = /\b(i know that|it('s| is) true that|everyone knows)\s+([^\.!\?\n]+)/ig;
  let m;
  while ((m = re.exec(t)) !== null) {
    const body = m[3]?.trim();
    if (body) out.push(body);
  }
  return out;
}
