import { renderTitleScreen, renderOnboarding, renderPlay } from './ui/screens.js';
import { renderErrorScreen } from './ui/errorScreen.js';
import { renderSessionEnd } from './ui/endScreen.js';
import { normalizeManifest, normalizePack, fateBand } from '../engine/rulesets.js';
import { newWorld, ensureWorld } from '../engine/state.js';
import { beginAdventure, playerMove, newScene } from '../engine/playloop.js';
import { saveSlot, loadLast, hasSlot, exportWorld, importWorld } from '../engine/save.js';
import { canonOutcomeBullets, sequelHookQuestion, exportChronicle } from '../engine/ending.js';
import { simulateTurns, reportSummaryString } from '../engine/simulate.js';
import { showModal } from './ui/modal.js';
import { addFact } from '../engine/ledger.js';
import { seedFromString } from '../engine/rng.js';
import { blockedInfoForOnboarding } from './ui/model.js';
import { makeDebugBadgeEl, makeDevLogPaneEl } from './ui/debugWidgets.js';
import { speechSupported, speakNarration } from './ui/speech.js';
import { openPrintView } from './ui/printView.js';
import { openPrintSheet } from './ui/printSheet.js';
import { createCharacter, rollGenesisOptions, rollDetailOptions } from '../engine/chargen/index.js';
import { openChargenModal } from './ui/chargenModal.js';
import { validatePolish } from '../engine/ai/polishValidation.js';
import { parseConductJson, applyConductDeltas } from '../engine/ai/conductContract.js';

const app = document.querySelector('#app');

const uiState = {
  screen: 'title',
  release: (localStorage.getItem('ai-dm-v2:release') === '1'),
  advanced: false,
  aiOnlineMode: (localStorage.getItem('ai-dm-v2:aiOnlineMode') || 'off'),
  aiOnline: false,
  aiLast: { mode: 'off', ok: null, reason: '' },
  devLog: [],
  bannerText: '',
  lastError: '',
  onboarding: {
    step: 1,
    fate: 0.2,
    primaryId: 'fantasy',
    mixerId: null,
    party: []
  },
  packs: { manifest: null, byId: {} },
  gearByPack: {},
  play: {
    world: null,
    lines: [],
    inputValue: '',
    error: ''
  }
};

await loadPacks();
await refreshAiStatus();
render();

function render() {
  const canContinue = hasSlot(localStorage, 'slot1');

  if (uiState.screen === 'title') {
    renderTitleScreen(app, {
      screenName: 'title',
      bannerText: uiState.bannerText,
      hasContinue: canContinue,
      release: uiState.release,
      advanced: uiState.release ? false : uiState.advanced,
      partyCount: uiState.onboarding.party.length,
      debugSeed: uiState.play.world?.meta?.seed || '(unset)',
      lastError: uiState.play.world?.ui?.lastError || uiState.lastError,
      devLogLines: uiState.devLog,
      onToggleRelease: safe(() => {
        uiState.release = !uiState.release;
        localStorage.setItem('ai-dm-v2:release', uiState.release ? '1' : '0');
        // Release mode force-hides advanced.
        uiState.bannerText = '';
        render();
      }),
      onToggleAdvanced: safe(() => { if (uiState.release) return; logUi('[UI] click:toggle_advanced'); uiState.advanced = !uiState.advanced; render(); }),
      onNew: safe(() => { logUi('[UI] click:new_adventure'); startOnboarding(); render(); }),
      onContinue: safe(() => { logUi('[UI] click:continue'); continueGame(); })
    });
    return;
  }

  if (uiState.screen === 'onboarding') {
    const ob = uiState.onboarding;
    const blocked = blockedInfoForOnboarding({ screen: 'onboarding', onboarding: ob });

    renderOnboarding(app, {
      screenName: 'onboarding',
      bannerText: uiState.bannerText,
      lastError: uiState.play.world?.ui?.lastError || uiState.lastError,
      devLogLines: uiState.devLog,
      advanced: uiState.release ? false : uiState.advanced,
      debugSeed: uiState.play.world?.meta?.seed || '(unset)',
      partyCount: ob.party.length,
      step: ob.step,
      fate: ob.fate,
      fateBand: fateBand(ob.fate),
      packs: uiState.packs.manifest.packs,
      primaryId: ob.primaryId,
      mixerId: ob.mixerId,
      party: ob.party,
      blocked: blocked ? {
        ...blocked,
        onFix: safe(async () => { logUi('[UI] click:fix_roll_party'); ob.party = await rollPartyGenesis(ob.primaryId, ob.fate, randPartySize()); uiState.bannerText = ''; render(); })
      } : null,
      hint: ob.step === 3 && ob.party.length === 0 ? 'Tip: roll one character (guided) for the full ceremony.' : '',
      nextDisabled: ob.step === 3 && (ob.party.length < 1 || ob.party.length > 4),
      onSetFate: safe((v) => { ob.fate = clamp01(v); render(); }),
      onSetPrimary: safe((id) => { ob.primaryId = id; if (ob.mixerId === id) ob.mixerId = null; render(); }),
      onSetMixer: safe((id) => { ob.mixerId = id === ob.primaryId ? null : id; render(); }),
      onRollOneGuided: safe(async () => { logUi('[UI] click:roll_one_guided'); await openChargenWizard({ mode: 'one' }); }),
      onRollParty: safe(async () => { logUi('[UI] click:roll_party'); ob.party = await rollPartyGenesis(ob.primaryId, ob.fate, randPartySize()); uiState.bannerText = ''; render(); }),
      onCreateOne: safe(async () => { logUi('[UI] click:create_one'); const one = await rollPartyGenesis(ob.primaryId, ob.fate, 1); ob.party = [...ob.party, one[0]]; render(); }),
      onRemoveParty: safe((idx) => { logUi('[UI] click:remove_party'); ob.party = ob.party.filter((_, i) => i !== idx); render(); }),
      onClearParty: safe(() => { logUi('[UI] click:clear_party'); ob.party = []; render(); }),
      onBack: safe(() => { logUi('[UI] click:back'); ob.step = Math.max(1, ob.step - 1); render(); }),
      onCancel: safe(() => { logUi('[UI] click:cancel'); uiState.screen = 'title'; uiState.bannerText = ''; render(); }),
      onNext: safe(() => {
        logUi(ob.step === 4 ? '[UI] click:begin_adventure' : '[UI] click:next');
        if (ob.step === 3 && (ob.party.length < 1 || ob.party.length > 4)) {
          uiState.bannerText = 'Wizard: Blocked — you need a party (1–4).';
          render();
          return;
        }
        if (ob.step < 4) ob.step += 1;
        else beginGameFromOnboarding();
        render();
      })
    });
    return;
  }

  if (uiState.screen === 'play') {
    const p = uiState.play;

    if (p.world?.ending?.triggered) {
      uiState.screen = 'end';
      return render();
    }

    renderPlay(app, {
      screenName: 'play',
      bannerText: uiState.bannerText,
      lastError: p.world?.ui?.lastError || uiState.lastError,
      devLogLines: uiState.devLog,
      advanced: uiState.release ? false : uiState.advanced,
      debugSeed: p.world?.meta?.seed || '(unset)',
      partyCount: p.world?.party?.length ?? 0,
      aiLast: uiState.aiLast,
      world: p.world,
      lines: p.lines,
      inputValue: p.inputValue,
      error: p.error,
      speechAvailable: speechSupported(),
      onSpeak: safe(() => {
        logUi('[UI] click:speak');
        // Speak ONLY the last wizard narration line.
        const lastWizard = [...p.lines].reverse().find(x => x.who === 'wizard');
        if (lastWizard?.text) speakNarration(lastWizard.text);
      }),
      onInput: safe((v) => { p.inputValue = v; }),
      onSubmit: safe(() => { logUi('[UI] click:submit'); submitMove(); }),
      onNewScene: safe(() => { logUi('[UI] click:new_scene'); doNewScene(); }),
      onAskRoll: safe(() => { logUi('[UI] click:ask_roll'); openAskRollModal(); }),
      onSave: safe(() => { logUi('[UI] click:save'); saveSlot(localStorage, p.world, 'slot1'); toast('Saved.'); }),
      onAddFact: safe(() => { logUi('[UI] click:add_fact'); openAddFactModal(); }),
      onExport: safe(() => { logUi('[UI] click:export'); openExportModal(); }),
      onImport: safe(() => { logUi('[UI] click:import'); openImportModal(); }),
      onSimulate: safe(() => { if (uiState.release) return; logUi('[UI] click:simulate_10'); runSimulate10(); }),
      aiOnline: uiState.aiOnline,
      aiOnlineMode: uiState.aiOnlineMode,
      onSetAiOnlineMode: safe(async (mode) => {
        if (uiState.release) return;
        const m = (mode === 'off' || mode === 'polish' || mode === 'conduct') ? mode : 'off';
        uiState.aiOnlineMode = m;
        localStorage.setItem('ai-dm-v2:aiOnlineMode', m);
        logUi(`[UI] set:ai_online_mode:${m}`);
        await refreshAiStatus();
        render();
      }),
      aiMode: p.world?.meta?.aiMode || 'off',
      onSetAiMode: safe((mode) => {
        if (uiState.release) return;
        const m = (mode === 'off' || mode === 'advisory' || mode === 'conductor') ? mode : 'off';
        p.world = { ...p.world, meta: { ...p.world.meta, aiMode: m } };
        saveSlot(localStorage, p.world, 'slot1');
        logUi(`[UI] set:ai_mode:${m}`);
        render();
      }),
      onPrint: safe(() => { if (uiState.release) return; logUi('[UI] click:print'); openPrintView(p.world); }),
      onPrintSheet: safe((idx) => { if (uiState.release) return; const ent = p.world?.party?.[idx]; if (ent) openPrintSheet(ent); })
    });
    return;
  }

  if (uiState.screen === 'error') {
    renderErrorScreen(app, {
      message: uiState.lastError,
      onBack: safe(() => { logUi('[UI] click:back_to_title'); uiState.screen = 'title'; uiState.bannerText = ''; render(); })
    });
    return;
  }

  if (uiState.screen === 'end') {
    const p = uiState.play;
    const w = p.world;
    const outcomes = canonOutcomeBullets(w);
    const hook = sequelHookQuestion(w);

    renderSessionEnd(app, {
      advanced: uiState.release ? false : uiState.advanced,
      bannerText: uiState.bannerText,
      endingType: w.ending.type,
      epilogueLine: w.ending.epilogueLine,
      outcomes,
      hook,
      debugBadgeEl: (uiState.release ? false : uiState.advanced) ? makeDebugBadgeEl({
        screenName: 'end',
        partyCount: w.party?.length ?? 0,
        debugSeed: w.meta.seed,
        lastError: w.ui?.lastError || uiState.lastError,
        aiLast: uiState.aiLast
      }) : null,
      devLogPaneEl: (uiState.release ? false : uiState.advanced) ? makeDevLogPaneEl(uiState.devLog) : null,
      onExportChronicle: safe(() => { logUi('[UI] click:export_chronicle'); openChronicleModal(w); }),
      onBackToTitle: safe(() => { logUi('[UI] click:back_to_title'); uiState.screen = 'title'; uiState.bannerText = ''; render(); })
    });
  }
}

async function loadPacks() {
  const manRaw = await fetch('/packs/manifest.json').then(r => r.json());
  const manifest = normalizeManifest(manRaw);
  const byId = {};
  for (const p of manifest.packs) {
    const raw = await fetch(p.path).then(r => r.json());
    byId[p.id] = normalizePack(raw);
  }
  uiState.packs = { manifest, byId };
}

async function refreshAiStatus() {
  try {
    const s = await fetch('/api/ai-status').then(r => r.json());
    uiState.aiOnline = Boolean(s?.online);
  } catch {
    uiState.aiOnline = false;
  }
}

async function callAi(payload) {
  try {
    const r = await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return await r.json();
  } catch {
    return { ok: false };
  }
}

async function applyOnlineAiAfterWizardLine({ world, lineIndex }) {
  if (!uiState.aiOnline) return;
  const mode = uiState.aiOnlineMode;
  if (mode === 'off') return;

  const p = uiState.play;
  const cur = p.lines[lineIndex];
  if (!cur || cur.who !== 'wizard') return;

  const composerLine = String(cur.text || '').trim();
  if (!composerLine) return;

  const snapshot = {
    nouns: [],
    tags: (world.scene?.tags || []).slice(0, 10),
    motifs: (world.meta?.motifs?.recent || []).slice(0, 10)
  };

  if (mode === 'polish') {
    const out = await callAi({ mode: 'POLISH', seed: world.timeline.length, composerLine, worldSnapshot: snapshot, styleProfile: { fate: world.meta.fate, voice: 'plain', verbosity: 0 } });
    uiState.aiLast = { mode: 'polish', ok: Boolean(out?.ok), reason: String(out?.reason || '') };
    if (!out?.ok || !out.text) return;
    const v = validatePolish({ world, composerLine, candidateText: out.text });
    if (!v.ok) return;

    const cur2 = p.lines[lineIndex];
    if (cur2?.who === 'wizard' && cur2.text === composerLine) {
      p.lines[lineIndex] = { ...cur2, displayOnly: v.text };
      render();
      scrollTranscriptToBottom();
    }
    return;
  }

  if (mode === 'conduct') {
    const out = await callAi({ mode: 'CONDUCT', seed: world.timeline.length, composerLine, worldSnapshot: snapshot, styleProfile: { fate: world.meta.fate, voice: 'plain', verbosity: 0 } });
    uiState.aiLast = { mode: 'conduct', ok: Boolean(out?.ok), reason: String(out?.reason || '') };
    if (!out?.ok || !out.text) return;
    const parsed = parseConductJson(out.text);
    if (!parsed.ok) return;

    const narr = String(parsed.value.narration || '').trim();
    if (narr) {
      const v = validatePolish({ world, composerLine, candidateText: narr });
      if (v.ok) {
        const cur2 = p.lines[lineIndex];
        if (cur2?.who === 'wizard' && cur2.text === composerLine) p.lines[lineIndex] = { ...cur2, displayOnly: v.text };
      }
    }

    p.world = applyConductDeltas(world, parsed.value);
    saveSlot(localStorage, p.world, 'slot1');
    render();
    scrollTranscriptToBottom();
  }
}

async function loadGear(packId) {
  const id = String(packId || 'fantasy');
  if (uiState.gearByPack[id]) return uiState.gearByPack[id];
  const gear = await fetch(`/packs/${id}/gear.json`).then(r => r.json());
  uiState.gearByPack[id] = gear;
  return gear;
}

function randPartySize() {
  const ob = uiState.onboarding;
  const base = seedFromString(`${ob.primaryId}|${ob.fate}|partySize`);
  return 1 + (base % 4);
}

async function rollPartyGenesis(packId, fate, count) {
  const gear = await loadGear(packId);
  const n = clampInt(count ?? 1, 1, 4);
  const base = seedFromString(`${packId}|${fate}|partyGenesis`);
  const out = [];
  for (let i = 0; i < n; i++) {
    const cSeed = String((base + i * 997) >>> 0);
    out.push(createCharacter({ seed: cSeed, packId, fate, packGear: gear, statMethod: '2d6+2', darkFate: true }));
  }
  return out;
}

async function openChargenWizard({ mode = 'one' } = {}) {
  const ob = uiState.onboarding;
  const packId = ob.primaryId;
  const gear = await loadGear(packId);
  const baseSeed = String(seedFromString(`${ob.primaryId}|${ob.fate}|guidedChargen|${ob.party.length}`));

  const wizard = {
    step: 1,
    options: [],
    ritualOptions: null,
    canSwap: true,
    draft: {
      seed: baseSeed,
      packId,
      fate: ob.fate,
      statMethod: '2d6+2',
      darkFateEnabled: true,
      name: '',
      background: null,
      stats: null,
      rollDetails: null,
      inventory: null,
      signature: null,
      traits: null,
      ritualPicks: {}
    }
  };

  let modal = null;

  const ritualBaseSeed = () => `${wizard.draft.seed}|chargen|${packId}|f${Math.round(ob.fate*100)}|m:${wizard.draft.statMethod}`;
  const ensureRitualOptions = () => {
    wizard.ritualOptions = rollDetailOptions(packId, ritualBaseSeed());
  };

  const rebuildDraft = ({ seedOverride = null } = {}) => {
    const seedUse = seedOverride ? String(seedOverride) : wizard.draft.seed;
    ensureRitualOptions();
    const c = createCharacter({
      seed: seedUse,
      packId,
      fate: ob.fate,
      packGear: gear,
      name: wizard.draft.name,
      archetype: wizard.draft.background?.name || '',
      statMethod: wizard.draft.statMethod,
      darkFate: wizard.draft.darkFateEnabled,
      ritualPicks: wizard.draft.ritualPicks
    });

    // Preserve any swapped inventory/signature choices.
    const inventory = wizard.draft.inventory || c.inventory;
    const signature = wizard.draft.signature || c.signature;

    wizard.draft = { ...wizard.draft, ...c, inventory, signature };
  };

  const rerender = () => {
    // close/reopen to reflect state updates.
    if (modal) modal.close();
    modal = openChargenModal({
      step: wizard.step,
      options: wizard.options,
      ritualOptions: wizard.ritualOptions,
      ritualPicks: wizard.draft.ritualPicks,
      draft: wizard.draft,
      canSwap: wizard.canSwap,
      onCancel: () => { if (modal) modal.close(); render(); },
      onBack: () => { wizard.step = Math.max(1, wizard.step - 1); rerender(); },
      onNext: async () => {
        if (wizard.step === 2 && !wizard.draft.background) return;
        if (wizard.step === 3 && !wizard.draft.stats) return;
        if (wizard.step === 4 && !wizard.draft.inventory) return;
        if (wizard.step === 5 && !wizard.ritualOptions) return;
        if (wizard.step < 7) {
          wizard.step += 1;
          rerender();
          return;
        }
        // Confirm
        ob.party = [...ob.party, finalizeDraft(wizard.draft, gear)];
        uiState.bannerText = '';
        if (modal) modal.close();
        render();
      },
      onSetName: (name) => { wizard.draft.name = name; },
      onRandomName: () => {
        wizard.draft.name = '';
        rebuildDraft();
        rerender();
      },
      onChooseBackground: (bg) => {
        wizard.draft.background = bg;
        rebuildDraft();
        rerender();
      },
      onSetStatMethod: (m) => {
        wizard.draft.statMethod = m;
        rebuildDraft();
        rerender();
      },
      onRollStats: () => {
        rebuildDraft();
        wizard.draft.stats = wizard.draft.stats;
        rerender();
      },
      onSwap: (cat) => {
        // one-shot swap: reroll that category deterministically by cat
        const swapSeed = `${wizard.draft.seed}|swap|${cat}`;
        const c = createCharacter({
          seed: swapSeed,
          packId,
          fate: ob.fate,
          packGear: gear,
          name: wizard.draft.name,
          archetype: wizard.draft.background?.name || '',
          statMethod: wizard.draft.statMethod,
          darkFate: wizard.draft.darkFateEnabled,
          ritualPicks: wizard.draft.ritualPicks
        });
        wizard.draft.inventory = { ...(wizard.draft.inventory || {}), [cat]: c.inventory?.[cat] || [] };
        wizard.draft.signature = wizard.draft.signature || c.signature;
        wizard.canSwap = false;
        rerender();
      },
      onPickRitual: (key, value) => {
        wizard.draft.ritualPicks = { ...(wizard.draft.ritualPicks || {}), [String(key)]: String(value) };
        rebuildDraft();
        rerender();
      },
      onToggleDarkFate: () => {
        wizard.draft.darkFateEnabled = !wizard.draft.darkFateEnabled;
        rebuildDraft();
        rerender();
      },
      onRollDarkFate: () => {
        const seedOverride = `${wizard.draft.seed}|darkfate`;
        rebuildDraft({ seedOverride });
        rerender();
      }
    });
  };

  // initial options
  wizard.options = rollGenesisOptions({ seed: baseSeed, packId });
  rerender();
}

function finalizeDraft(draft, gear) {
  // Ensure kit exists.
  const c = createCharacter({
    seed: draft.seed,
    packId: draft.packId,
    fate: draft.fate,
    packGear: gear,
    name: draft.name,
    archetype: draft.background?.name || '',
    statMethod: draft.statMethod,
    darkFate: draft.darkFateEnabled,
    ritualPicks: draft.ritualPicks
  });
  // Preserve any swapped inventory.
  return { ...c, inventory: draft.inventory || c.inventory, signature: draft.signature || c.signature };
}

function clampInt(n, lo, hi) {
  const x = Math.trunc(Number(n));
  if (!Number.isFinite(x)) return lo;
  return Math.max(lo, Math.min(hi, x));
}

function startOnboarding() {
  uiState.bannerText = '';
  uiState.onboarding = {
    step: 1,
    fate: 0.2,
    primaryId: 'fantasy',
    mixerId: null,
    party: []
  };
  uiState.screen = 'onboarding';
}

function continueGame() {
  const { world } = loadLast(localStorage);
  if (!world) {
    uiState.screen = 'title';
    return render();
  }
  uiState.play.world = ensureWorld(world);
  uiState.play.lines = [{ who: 'wizard', text: 'Wizard: Welcome back. What do you do?', mech: '' }];
  uiState.play.inputValue = '';
  uiState.play.error = '';
  uiState.bannerText = '';
  uiState.screen = world.ending?.triggered ? 'end' : 'play';
  render();
}

function beginGameFromOnboarding() {
  const ob = uiState.onboarding;
  if (ob.party.length < 1 || ob.party.length > 4) {
    uiState.bannerText = 'Wizard: Blocked — party must be 1–4 members.';
    return;
  }

  const seed = uiState.play.world?.meta?.seed || `v2-${seedFromString(`${Date.now()}|${Math.random()}`)}`;

  const w0 = newWorld({
    seed,
    fate: ob.fate,
    campaignId: `campaign-${seed}`,
    pack: { primaryId: ob.primaryId, mixerId: ob.mixerId }
  });
  const w1 = { ...w0, party: ob.party };

  const { world, output } = beginAdventure(w1, uiState.packs.byId);
  uiState.play.world = world;
  uiState.play.lines = [
    { who: 'wizard', text: output.narration, mech: output.mechanics }
  ];
  uiState.play.inputValue = '';
  uiState.play.error = '';
  uiState.bannerText = '';
  saveSlot(localStorage, world, 'slot1');
  uiState.screen = world.ending?.triggered ? 'end' : 'play';
}

function submitMove() {
  const p = uiState.play;
  if (p.world?.ending?.locked) {
    uiState.bannerText = 'Wizard: The session is ended. Export the chronicle for the record.';
    return render();
  }

  const text = String(p.inputValue || '').trim();
  if (!text) return;

  const { world, output } = playerMove(p.world, uiState.packs.byId, text);
  p.world = world;
  p.lines.push({ who: 'you', text, mech: '' });
  p.lines.push({ who: 'wizard', text: output.narration, mech: output.mechanics || '' });
  p.inputValue = '';
  p.error = '';
  saveSlot(localStorage, p.world, 'slot1');
  render();
  scrollTranscriptToBottom();

  // Optional online AI (server-side): displayOnly narration, optional structured deltas.
  applyOnlineAiAfterWizardLine({ world: p.world, lineIndex: p.lines.length - 1 }).catch(() => {});
}

function doNewScene() {
  const p = uiState.play;
  const { world, output } = newScene(p.world, uiState.packs.byId);
  p.world = world;
  p.lines.push({ who: 'wizard', text: output.narration, mech: output.mechanics || '' });
  saveSlot(localStorage, p.world, 'slot1');
  render();
  scrollTranscriptToBottom();

  applyOnlineAiAfterWizardLine({ world: p.world, lineIndex: p.lines.length - 1 }).catch(() => {});
}

function openAskRollModal() {
  showModal(({ close }) => {
    const skill = document.createElement('input');
    skill.className = 'input';
    skill.placeholder = 'What are you rolling? (e.g., Wits, Steel, Tech)';

    const note = document.createElement('div');
    note.className = 'small';
    note.textContent = 'This is a UI helper only; the engine roll is still deterministic per-turn.';

    const ok = document.createElement('button');
    ok.className = 'btn primary';
    ok.textContent = 'OK';
    ok.onclick = () => close();

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(skill, note, ok);
    return wrap;
  }, { title: 'Ask for a Roll' });
}

function openCreatePartyModal() {
  showModal(({ close }) => {
    const name = document.createElement('input');
    name.className = 'input';
    name.placeholder = 'Name';

    const vibe = document.createElement('input');
    vibe.className = 'input';
    vibe.placeholder = 'Vibe (e.g., grim optimist, quiet menace)';

    const archetype = document.createElement('input');
    archetype.className = 'input';
    archetype.placeholder = 'Archetype (e.g., Knight, Hacker, Medic)';

    const err = document.createElement('div');
    err.className = 'small';
    err.style.color = 'var(--danger)';

    const add = document.createElement('button');
    add.className = 'btn primary';
    add.textContent = 'Add';
    add.onclick = () => {
      const m = {
        id: `p-${Date.now()}`,
        name: name.value.trim() || '',
        vibe: vibe.value.trim() || '',
        archetype: archetype.value.trim() || '',
        stress: 0
      };
      if (!m.name || !m.vibe || !m.archetype) {
        err.textContent = 'Fill in name + vibe + archetype.';
        return;
      }
      if (uiState.onboarding.party.length >= 4) {
        err.textContent = 'Party is capped at 4.';
        return;
      }
      uiState.onboarding.party = [...uiState.onboarding.party, m];
      close();
      render();
    };

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(name, vibe, archetype, err, add);
    return wrap;
  }, { title: 'Create Party Member' });
}

function openAddFactModal() {
  showModal(({ close }) => {
    const fact = document.createElement('input');
    fact.className = 'input';
    fact.placeholder = 'Canon Fact (authoritative)';

    const warn = document.createElement('div');
    warn.className = 'small';
    warn.style.color = 'var(--muted)';
    warn.textContent = 'This bypasses the guard. Use sparingly.';

    const add = document.createElement('button');
    add.className = 'btn primary';
    add.textContent = 'Add Fact';
    add.onclick = () => {
      const t = fact.value.trim();
      if (!t) return;
      uiState.play.world = addFact(uiState.play.world, t, 'gm');
      saveSlot(localStorage, uiState.play.world, 'slot1');
      uiState.play.lines.push({ who: 'wizard', text: `Wizard: (Canon set.)`, mech: `[fact added]` });
      close();
      render();
    };

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(fact, warn, add);
    return wrap;
  }, { title: 'Advanced — Add Fact' });
}

function openExportModal() {
  const text = exportWorld(uiState.play.world);
  showModal(({ close }) => {
    const ta = document.createElement('textarea');
    ta.className = 'input';
    ta.style.minHeight = '220px';
    ta.value = text;

    const copy = document.createElement('button');
    copy.className = 'btn primary';
    copy.textContent = 'Copy';
    copy.onclick = async () => {
      await navigator.clipboard.writeText(ta.value);
      toast('Copied.');
    };

    const ok = document.createElement('button');
    ok.className = 'btn';
    ok.textContent = 'Close';
    ok.onclick = () => close();

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(ta, copy, ok);
    return wrap;
  }, { title: 'Export Save' });
}

function openImportModal() {
  showModal(({ close }) => {
    const ta = document.createElement('textarea');
    ta.className = 'input';
    ta.style.minHeight = '220px';
    ta.placeholder = 'Paste export JSON here…';

    const err = document.createElement('div');
    err.className = 'small';
    err.style.color = 'var(--danger)';

    const imp = document.createElement('button');
    imp.className = 'btn primary';
    imp.textContent = 'Import';
    imp.onclick = () => {
      try {
        const w = importWorld(ta.value);
        uiState.play.world = w;
        saveSlot(localStorage, w, 'slot1');
        uiState.play.lines.push({ who: 'wizard', text: 'Wizard: Save imported. What do you do?', mech: '' });
        close();
        render();
      } catch (e) {
        err.textContent = String(e?.message || e);
      }
    };

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(ta, err, imp);
    return wrap;
  }, { title: 'Import Save' });
}

function openChronicleModal(world) {
  const { json, text } = exportChronicle(world);
  showModal(({ close }) => {
    const ta = document.createElement('textarea');
    ta.className = 'input';
    ta.style.minHeight = '260px';
    ta.value = `${text}\n\n---\nJSON:\n${json}`;

    const copy = document.createElement('button');
    copy.className = 'btn primary';
    copy.textContent = 'Copy';
    copy.onclick = async () => {
      await navigator.clipboard.writeText(ta.value);
      toast('Copied.');
    };

    const ok = document.createElement('button');
    ok.className = 'btn';
    ok.textContent = 'Close';
    ok.onclick = () => close();

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(ta, copy, ok);
    return wrap;
  }, { title: 'Export Chronicle' });
}

function runSimulate10() {
  const p = uiState.play;
  if (!p.world) {
    uiState.bannerText = 'Wizard: No world loaded yet.';
    return render();
  }
  const { world, report } = simulateTurns(p.world, uiState.packs.byId, 10);
  p.world = world;
  saveSlot(localStorage, p.world, 'slot1');

  const summary = reportSummaryString(report);
  const details = [
    `Run Report`,
    summary,
    `facts added: ${report.factsAdded}`,
    `threats added: ${report.threatsAdded}`,
    `questions added: ${report.questionsAdded}`,
    `ending triggered: ${report.endingTriggered ? 'yes' : 'no'}`,
    `final clocks: pressure ${report.finalClocks.pressure}, dread ${report.finalClocks.dread}, revelation ${report.finalClocks.revelation}`
  ].join('\n');

  showModal(({ close }) => {
    const ta = document.createElement('textarea');
    ta.className = 'input';
    ta.style.minHeight = '220px';
    ta.value = details;

    const ok = document.createElement('button');
    ok.className = 'btn primary';
    ok.textContent = 'Close';
    ok.onclick = () => close();

    const wrap = document.createElement('div');
    wrap.className = 'stack';
    wrap.append(ta, ok);
    return wrap;
  }, { title: 'Simulate 10 turns' });
}

function rollParty(primaryId, mixerId, fate) {
  const primary = uiState.packs.byId[primaryId];
  const mixer = mixerId ? uiState.packs.byId[mixerId] : null;
  const skills = [...(primary?.skills || []), ...(mixer?.skills || [])];

  const seed = seedFromString(`${primaryId}|${mixerId||''}|${fate}|party`);
  // simple deterministic names
  const names = ['Ash', 'Mara', 'Hale', 'Nico', 'Iris', 'Rook', 'Tess', 'Bram'];
  const vibes = ['steady hand', 'reckless genius', 'quiet menace', 'tired hero', 'bright liar', 'grim optimist'];
  const arche = ['Scout', 'Blade', 'Sage', 'Breaker', 'Medic', 'Fixer'];
  const n = 1 + (seed % 4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const ix = (seed + i * 101) >>> 0;
    out.push({
      id: `m-${ix}`,
      name: names[ix % names.length],
      vibe: vibes[(ix >>> 3) % vibes.length],
      archetype: arche[(ix >>> 5) % arche.length],
      stress: 0,
      skills: skills.slice(0, 4)
    });
  }
  return out;
}

function toast(msg) {
  uiState.play.error = '';
  uiState.play.lines.push({ who: 'system', text: String(msg), mech: '' });
  render();
  scrollTranscriptToBottom();
}

function logUi(line) {
  if (uiState.release) return;
  if (!uiState.advanced) return;
  uiState.devLog.push(String(line));
}

function safe(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      const msg = String(e?.message || e);
      uiState.lastError = msg;
      uiState.bannerText = `Wizard: Something went wrong, but your save is safe. (${msg})`;
      if (uiState.play?.world) {
        const w = ensureWorld(uiState.play.world);
        uiState.play.world = { ...w, ui: { ...w.ui, lastError: msg } };
        saveSlot(localStorage, uiState.play.world, 'slot1');
      }
      if (uiState.release) {
        uiState.screen = 'error';
      }
      render();
    }
  };
}

function scrollTranscriptToBottom() {
  const t = document.querySelector('.transcript');
  if (!t) return;
  t.scrollTop = t.scrollHeight;
}

function clamp01(v){
  const x = Number(v);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
