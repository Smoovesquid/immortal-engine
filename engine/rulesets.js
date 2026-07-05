// Packs/rulesets loader + normalization. Offline: uses fetch in browser, fs in node tests if needed.

export function normalizePack(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const toneWords = p.toneWords && typeof p.toneWords === 'object' ? p.toneWords : {};
  return {
    id: String(p.id ?? 'unknown'),
    name: String(p.name ?? 'Unknown'),
    toneWords: {
      cooperative: arrayStrings(toneWords.cooperative),
      grim: arrayStrings(toneWords.grim),
      blood: arrayStrings(toneWords.blood)
    },
    starterLocations: arrayStrings(p.starterLocations),
    starterObjectives: arrayStrings(p.starterObjectives),
    starterGoals: normalizeStarterGoals(p.starterGoals),
    skills: arrayStrings(p.skills),
    // PACK-1: admit the two authored fields that already have live engine
    // consumers (playloop.js seeds threads into w.instrument.threads and drops
    // factions into w.factions; worldTick escalates thread tension over time).
    // Normalize shape here so a malformed pack field can never crash the seam —
    // downstream (introduceThread + ensureFactions) remain the caps/guards they
    // already are; this is a defensive front door, not a second authority.
    threads: normalizePackThreads(p.threads),
    factions: normalizePackFactions(p.factions),
    // PACK-3: admit the authored content trio. All three already have live
    // engine consumers that fell back to thin defaults because the whitelist
    // dropped the fields before the engine ever saw them:
    //   - locations     -> playloop pickFrom('locations') (else 3 starterLocations)
    //                      and generateMap node names (else the fallback pool)
    //   - objectives    -> playloop pickFrom('objectives') (else 3 starterObjectives)
    //                      and settlementTicker founding-thread seeding
    //   - sensoryMotifs -> composer.pickMotifWithMemory / instrument.seedMotifs
    //                      (else the single hardcoded 'a low hum…' string)
    // Admitting them also heals mergeSubRegion: it appends base+subregion for
    // each field, but both sides arrived pre-stripped, so it silently produced
    // []. With the fields carried through, the four fantasy sub-regions
    // (westmarch/ashenmoor/crownlands/hallowed_reaches) finally merge their
    // authored pools onto the base pack. All three are plain string arrays, so
    // arrayStrings (same discipline as starterLocations) is the right, safe
    // normalizer — a malformed field degrades to [] and never throws.
    locations: arrayStrings(p.locations),
    objectives: arrayStrings(p.objectives),
    sensoryMotifs: arrayStrings(p.sensoryMotifs)
  };
}

// A pack thread only needs a `name` (the label introduceThread() carries into
// w.instrument.threads); the rest is preserved for future narration surfacing.
// Any non-object / nameless entry is dropped rather than crashing the boot.
function normalizePackThreads(x) {
  if (!Array.isArray(x)) return [];
  return x
    .filter(t => t && typeof t === 'object')
    .map(t => ({
      id: String(t.id ?? '').trim(),
      name: String(t.name ?? '').trim(),
      description: String(t.description ?? '').trim()
    }))
    .filter(t => t.name);
}

// A pack faction needs an `id` (ensureFactions() filters on it downstream);
// other fields are clamped/coerced so a malformed pack can't inject garbage.
function normalizePackFactions(x) {
  if (!Array.isArray(x)) return [];
  return x
    .filter(f => f && typeof f === 'object')
    .map(f => ({
      id: String(f.id ?? '').trim(),
      name: String(f.name ?? '').trim(),
      description: String(f.description ?? '').trim(),
      pressure: clampInt01to100(f.pressure),
      hostility: clampInt01to100(f.hostility),
      agenda: String(f.agenda ?? '').trim()
    }))
    .filter(f => f.id);
}

function clampInt01to100(v) {
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function normalizeStarterGoals(x) {
  if (!Array.isArray(x)) return [];
  return x
    .filter(g => g && typeof g === 'object')
    .map(g => ({
      kind: String(g.kind ?? '').trim(),
      targetRef: String(g.targetRef ?? '').trim(),
      label: String(g.label ?? '').trim()
    }))
    .filter(g => g.kind && g.targetRef);
}

export function normalizeManifest(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const packs = Array.isArray(m.packs) ? m.packs : [];
  return {
    version: Number(m.version ?? 1),
    packs: packs.map(p => ({
      id: String(p.id),
      name: String(p.name),
      path: String(p.path)
    }))
  };
}

export function fateBand(fate01) {
  const f = clamp01(fate01);
  if (f < 0.34) return 'cooperative';
  if (f < 0.67) return 'grim';
  return 'blood';
}

export function toneWordsFor(pack, fate01) {
  const band = fateBand(fate01);
  const words = pack?.toneWords?.[band];
  return Array.isArray(words) && words.length ? words : [];
}

function arrayStrings(x) {
  return (Array.isArray(x) ? x : []).map(String).filter(Boolean);
}
function clamp01(v){
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
