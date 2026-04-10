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
    skills: arrayStrings(p.skills)
  };
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
