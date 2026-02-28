// Pure UI model for deterministic click-through tests.
// No DOM here.

import { fateBand } from '../../engine/rulesets.js';
import { newWorld, ensureWorld } from '../../engine/state.js';
import { beginAdventure } from '../../engine/playloop.js';
import { seedFromString } from '../../engine/rng.js';

export function createUiModel({ packsManifest, packsById, advanced = false } = {}) {
  return {
    screen: 'title',
    advanced: Boolean(advanced),
    bannerText: '',
    devLog: [],
    lastError: '',
    packs: { manifest: packsManifest, byId: packsById },
    onboarding: {
      step: 1,
      fate: 0.2,
      primaryId: 'fantasy',
      mixerId: null,
      party: []
    },
    play: {
      world: null,
      lines: [],
      inputValue: '',
      error: ''
    }
  };
}

export function uiView(state) {
  const s = state;
  const w = s.play.world;
  return {
    screenName: s.screen,
    advanced: s.advanced,
    bannerText: s.bannerText || '',
    devLogLines: s.devLog,
    partyCount: s.screen === 'play' ? (w?.party?.length ?? 0) : (s.onboarding.party.length),
    debugSeed: w?.meta?.seed || '(unset)',
    lastError: w?.ui?.lastError || s.lastError || ''
  };
}

export function safeTransition(state, fn) {
  try {
    const next = fn(state);
    return { state: next, error: null };
  } catch (e) {
    const msg = String(e?.message || e);
    const s2 = { ...state, lastError: msg, bannerText: `Wizard: Something went wrong, but your save is safe. (${msg})` };
    if (s2.play?.world) {
      const w = ensureWorld(s2.play.world);
      s2.play = { ...s2.play, world: { ...w, ui: { ...w.ui, lastError: msg } } };
    }
    return { state: s2, error: msg };
  }
}

export function logUi(state, line) {
  if (!state.advanced) return state;
  const l = String(line);
  return { ...state, devLog: [...state.devLog, l] };
}

export function clickNewAdventure(state) {
  let s = logUi(state, '[UI] click:new_adventure');
  s = { ...s, bannerText: '', screen: 'onboarding', onboarding: { ...s.onboarding, step: 1 } };
  return s;
}

export function setFate(state, fate) {
  const ob = state.onboarding;
  return { ...state, onboarding: { ...ob, fate: clamp01(fate) } };
}

export function setPrimary(state, id) {
  const ob = state.onboarding;
  const mixerId = ob.mixerId === id ? null : ob.mixerId;
  return { ...state, onboarding: { ...ob, primaryId: id, mixerId } };
}

export function setMixer(state, idOrNull) {
  const ob = state.onboarding;
  const mixerId = idOrNull === ob.primaryId ? null : idOrNull;
  return { ...state, onboarding: { ...ob, mixerId } };
}

export function rollPartyDeterministic(state) {
  let s = logUi(state, '[UI] click:roll_party');
  const ob = s.onboarding;
  const primary = s.packs.byId?.[ob.primaryId];
  const mixer = ob.mixerId ? s.packs.byId?.[ob.mixerId] : null;
  const skills = [...(primary?.skills || []), ...(mixer?.skills || [])];
  const seed = seedFromString(`${ob.primaryId}|${ob.mixerId||''}|${ob.fate}|party`);
  const names = ['Ash', 'Mara', 'Hale', 'Nico', 'Iris', 'Rook', 'Tess', 'Bram'];
  const vibes = ['steady hand', 'reckless genius', 'quiet menace', 'tired hero', 'bright liar', 'grim optimist'];
  const arche = ['Scout', 'Blade', 'Sage', 'Breaker', 'Medic', 'Fixer'];
  const n = 1 + (seed % 4);
  const party = [];
  for (let i = 0; i < n; i++) {
    const ix = (seed + i * 101) >>> 0;
    party.push({
      id: `m-${ix}`,
      name: names[ix % names.length],
      vibe: vibes[(ix >>> 3) % vibes.length],
      archetype: arche[(ix >>> 5) % arche.length],
      stress: 0,
      skills: skills.slice(0, 4)
    });
  }
  s = { ...s, onboarding: { ...ob, party } };
  return s;
}

export function clickNext(state) {
  let s = logUi(state, '[UI] click:next');
  const ob = s.onboarding;
  if (ob.step === 3 && (ob.party.length < 1 || ob.party.length > 4)) {
    return { ...s, bannerText: 'Wizard: You need a party (1–4) before we can begin.' };
  }
  if (ob.step < 4) {
    return { ...s, onboarding: { ...ob, step: ob.step + 1 } };
  }
  return beginFromOnboarding(s);
}

export function beginFromOnboarding(state) {
  let s = logUi(state, '[UI] click:begin_adventure');
  const ob = s.onboarding;
  if (ob.party.length < 1 || ob.party.length > 4) {
    return { ...s, bannerText: 'Wizard: Blocked — party must be 1–4 members.' };
  }

  // Deterministic for tests: seed derived from onboarding.
  const seed = `v2-${seedFromString(`${ob.primaryId}|${ob.mixerId||''}|${Math.round(ob.fate*100)}|seed`)}`;
  const w0 = newWorld({
    seed,
    fate: ob.fate,
    campaignId: `campaign-${seed}`,
    pack: { primaryId: ob.primaryId, mixerId: ob.mixerId }
  });
  const w1 = { ...w0, party: ob.party };
  const { world, output } = beginAdventure(w1, s.packs.byId);

  s = {
    ...s,
    screen: 'play',
    play: {
      ...s.play,
      world,
      lines: [{ who: 'wizard', text: output.narration, mech: output.mechanics }],
      inputValue: '',
      error: ''
    }
  };
  return s;
}

export function blockedInfoForOnboarding(state) {
  const ob = state.onboarding;
  if (state.screen !== 'onboarding') return null;
  if (ob.step === 3 && ob.party.length === 0) {
    return {
      reason: 'Blocked: party is empty. You need 1–4 members to begin.',
      fixLabel: 'Roll Party (1–4)'
    };
  }
  if (ob.step === 3 && ob.party.length > 4) {
    return {
      reason: 'Blocked: party is capped at 4.',
      fixLabel: 'Roll Party (1–4)'
    };
  }
  if (ob.step === 4 && (ob.party.length < 1 || ob.party.length > 4)) {
    return {
      reason: 'Blocked: party must be 1–4 members before beginning.',
      fixLabel: 'Roll Party (1–4)'
    };
  }
  return null;
}

export function fateLabel(fate01) {
  const b = fateBand(fate01);
  return b === 'cooperative' ? 'COOPERATIVE' : b === 'grim' ? 'GRIM' : 'BLOOD MERIDIAN';
}

function clamp01(v){
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
