import { el, clear, button } from './dom.js';
import { wizardStickFigure } from './wizardArt.js';

export function renderTitleScreen(app, state) {
  clear(app);
  const canContinue = state?.hasContinue;

  if (state.advanced) app.append(debugBadge(state));

  app.append(
    el('div', { class: 'container stack' },
      state.bannerText ? el('div', { class: 'banner' }, state.bannerText) : null,
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'AI Dungeon Master (V2)'),
            el('div', { class: 'sub' }, 'A narrative-first Game Wizard. Offline. Deterministic. No nonsense.')
          ),
          el('div', { class: 'row' },
            button(state.release ? 'Release: ON' : 'Release', { className: 'btn ghost', onClick: () => state.onToggleRelease?.() }),
            button(state.advanced ? 'Advanced: ON' : 'Advanced', { className: 'btn ghost', disabled: state.release, onClick: () => state.onToggleAdvanced?.() })
          )
        ),
        el('div', { class: 'card stack' },
          el('div', { class: 'wizard-art' },
            wizardStickFigure(),
            el('div', { class: 'stack' },
              el('div', {}, 'Enter the dungeon. Keep it tight: one line of story, one line of mechanics.'),
              el('div', { class: 'small' }, 'Canon is guarded. Your words can’t rewrite facts.'),
              el('div', { class: 'row' },
                button('New Adventure', { className: 'btn primary', onClick: () => state.onNew?.() }),
                button('Continue', { className: 'btn', disabled: !canContinue, onClick: () => state.onContinue?.() })
              ),
              state.advanced ? devLogPane(state) : null
            )
          )
        )
      )
    )
  );
}

export function renderOnboarding(app, state) {
  clear(app);
  const step = state.step;

  if (state.advanced) app.append(debugBadge(state));

  app.append(
    el('div', { class: 'container stack' },
      state.bannerText ? el('div', { class: 'banner' }, state.bannerText) : null,
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, `New Adventure — Step ${step} of 4`),
            el('div', { class: 'sub' }, 'Wizard-guided setup. Fast and deterministic.')
          ),
          el('div', { class: 'row' },
            button('Back', { className: 'btn ghost', disabled: step === 1, onClick: () => state.onBack?.() }),
            button('Cancel', { className: 'btn ghost', onClick: () => state.onCancel?.() })
          )
        ),
        el('div', { class: 'card stack' },
          step === 1 ? stepFate(state) : null,
          step === 2 ? stepPacks(state) : null,
          step === 3 ? stepParty(state) : null,
          step === 4 ? stepBegin(state) : null,
          state.blocked ? blockedBox(state) : null,
          el('div', { class: 'row' },
            el('div', { class: 'small' }, state.hint || ''),
            el('div', { style: { flex: '1' } }),
            button(step === 4 ? 'Begin Adventure' : 'Next', { className: 'btn primary', disabled: state.nextDisabled, onClick: () => state.onNext?.() })
          ),
          state.advanced ? devLogPane(state) : null
        )
      )
    )
  );
}

export function renderPlay(app, state) {
  clear(app);
  const w = state.world;
  const lines = state.lines || [];

  if (state.advanced) app.append(debugBadge(state));

  const input = el('input', { class: 'input', value: state.inputValue || '', placeholder: 'Type your move…' });
  input.addEventListener('input', () => state.onInput?.(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      state.onSubmit?.();
    }
  });

  app.append(
    el('div', { class: 'container stack' },
      state.bannerText ? el('div', { class: 'banner' }, state.bannerText) : null,
      el('div', { class: 'panel' },
        el('div', { class: 'header' },
          el('div', {},
            el('div', { class: 'title' }, 'Play'),
            el('div', { class: 'sub' }, `location: ${w.scene.location || '—'} • objective: ${w.scene.objective || '—'}`)
          ),
          el('div', { class: 'row' },
            button('New Scene', { className: 'btn', onClick: () => state.onNewScene?.() }),
            button('Speak', { className: 'btn', disabled: !state.speechAvailable, onClick: () => state.onSpeak?.() }),
            button('Ask for a Roll', { className: 'btn', onClick: () => state.onAskRoll?.() }),
            button('Save', { className: 'btn ghost', onClick: () => state.onSave?.() })
          ),
          !state.speechAvailable ? el('div', { class: 'small' }, 'Speech not available.') : null
        ),
        el('div', { class: 'transcript' },
          ...lines.map(renderLine)
        ),
        el('div', { class: 'card stack' },
          el('div', { class: 'row' },
            el('div', { style: { flex: '1' } }, input),
            button('Submit', { className: 'btn primary', onClick: () => state.onSubmit?.() })
          ),
          state.error ? el('div', { class: 'small', style: { color: 'var(--danger)' } }, state.error) : null,
          state.advanced ? devLogPane(state) : null
        ),
        drawers(state)
      )
    )
  );
}

function stepFate(state) {
  const fate = state.fate;
  const band = state.fateBand;
  const label = band === 'cooperative' ? 'COOPERATIVE' : band === 'grim' ? 'GRIM' : 'BLOOD MERIDIAN';
  const expl = band === 'cooperative'
    ? 'Soft consequences; opportunity-heavy.'
    : band === 'grim'
    ? 'Pressure escalates; mixed outcomes.'
    : 'Severe consequences; brutality weighted.';

  const slider = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(fate * 100)) });
  slider.addEventListener('input', () => state.onSetFate?.(Number(slider.value) / 100));

  return el('div', { class: 'stack' },
    el('div', { class: 'title' }, 'Choose Fate / Tone'),
    el('div', { class: 'sub' }, expl),
    el('div', { class: 'row' },
      el('span', { class: 'tag' }, 'COOPERATIVE'),
      el('div', { style: { flex: '1' } }, slider),
      el('span', { class: 'tag' }, 'BLOOD MERIDIAN')
    ),
    el('div', { class: 'small' }, `Selected: ${label} (${Math.round(fate * 100)}%)`)
  );
}

function stepPacks(state) {
  const packs = state.packs || [];
  return el('div', { class: 'stack' },
    el('div', { class: 'title' }, 'Choose Genre Pack(s)'),
    el('div', { class: 'sub' }, 'Pick 1 primary pack. Optional 1 mixer adds flavor.'),
    el('div', { class: 'grid2' },
      el('div', { class: 'stack' },
        el('div', { class: 'small' }, 'Primary'),
        ...packs.map(p => button(p.name, {
          className: state.primaryId === p.id ? 'btn primary' : 'btn',
          onClick: () => state.onSetPrimary?.(p.id)
        }))
      ),
      el('div', { class: 'stack' },
        el('div', { class: 'small' }, 'Mixer (optional)'),
        button('None', { className: !state.mixerId ? 'btn primary' : 'btn', onClick: () => state.onSetMixer?.(null) }),
        ...packs.map(p => button(p.name, {
          className: state.mixerId === p.id ? 'btn primary' : 'btn',
          onClick: () => state.onSetMixer?.(p.id)
        }))
      )
    )
  );
}

function stepParty(state) {
  const party = state.party || [];
  return el('div', { class: 'stack' },
    el('div', { class: 'title' }, 'Party'),
    el('div', { class: 'sub' }, 'Character Genesis: crunchy, deterministic, and a little scary. (1–4 members total.)'),
    el('div', { class: 'row' },
      button('Roll One Character (guided)', { className: 'btn primary', onClick: () => state.onRollOneGuided?.() }),
      button('Roll Party (1–4)', { className: 'btn', onClick: () => state.onRollParty?.() }),
      button('Create One (simple)', { className: 'btn', onClick: () => state.onCreateOne?.() }),
      button('Clear', { className: 'btn ghost', disabled: party.length === 0, onClick: () => state.onClearParty?.() })
    ),
    el('div', { class: 'stack' },
      ...party.map((m, idx) => el('div', { class: 'panel card' },
        el('div', { class: 'row' },
          el('div', { style: { flex: '1' } },
            el('div', { class: 'title' }, `${m.name}`),
            el('div', { class: 'sub' }, `${m.archetype} • ${m.vibe}`)
          ),
          button('Remove', { className: 'btn ghost', onClick: () => state.onRemoveParty?.(idx) })
        )
      ))
    )
  );
}

function stepBegin(state) {
  return el('div', { class: 'stack' },
    el('div', { class: 'title' }, 'Begin Adventure'),
    el('div', { class: 'sub' }, 'This will generate the first scene and drop you into play.')
  );
}

function drawers(state) {
  const w = state.world;
  const ledger = w.ledger;

  const partyCards = (w.party || []).map((m, idx) => {
    const s = m.stats || {};
    const inv = m.inventory || {};
    const invSummary = ['weapons','armor','tools','oddities','tech','spells','consumables'].map(k => {
      const n = Array.isArray(inv[k]) ? inv[k].length : 0;
      return n ? `${k}:${n}` : '';
    }).filter(Boolean).join(' • ');

    return el('div', { class: 'panel card stack' },
      el('div', { class: 'row' },
        el('div', { style: { flex: '1' } },
          el('div', { class: 'title' }, m.name),
          el('div', { class: 'sub' }, `${m.archetype} • ${m.vibe}`)
        ),
        el('span', { class: 'tag' }, `stress:${m.stress ?? 0}`)
      ),
      el('div', { class: 'row' },
        ...Object.entries(s).map(([k,v]) => el('span', { class: 'tag' }, `${k}:${v}`))
      ),
      invSummary ? el('div', { class: 'small' }, invSummary) : null,
      state.onPrintSheet ? button('Print Sheet', { className: 'btn ghost', onClick: () => state.onPrintSheet?.(idx) }) : null
    );
  });

  const advancedDrawer = state.advanced ? el('details', { class: 'drawer' },
    el('summary', {}, 'Advanced'),
    el('div', { class: 'drawer-body stack' },
      el('div', { class: 'small' }, 'GM override: add canon Fact (be careful; this is authoritative).'),
      button('Add Fact…', { className: 'btn', onClick: () => state.onAddFact?.() }),
      button('Export Save…', { className: 'btn', onClick: () => state.onExport?.() }),
      button('Import Save…', { className: 'btn', onClick: () => state.onImport?.() }),
      button('Simulate 10 turns', { className: 'btn', onClick: () => state.onSimulate?.() }),
      el('div', { class: 'row' },
        el('span', { class: 'tag' }, state.aiOnline ? 'Online OK' : 'Offline only'),
        el('span', { class: 'small' }, 'AI (server-side)')
      ),
      el('select', { class: 'input', onChange: (e) => state.onSetAiOnlineMode?.(e.target.value) },
        el('option', { value: 'off', selected: state.aiOnlineMode === 'off' }, 'AI: OFF'),
        el('option', { value: 'polish', selected: state.aiOnlineMode === 'polish' }, 'AI: POLISH'),
        el('option', { value: 'conduct', selected: state.aiOnlineMode === 'conduct' }, 'AI: CONDUCTOR (ONLINE)')
      ),
      el('div', { class: 'small' }, 'AI Mode'),
      el('select', { class: 'input', onChange: (e) => state.onSetAiMode?.(e.target.value) },
        el('option', { value: 'off', selected: state.aiMode === 'off' }, 'OFF'),
        el('option', { value: 'advisory', selected: state.aiMode === 'advisory' }, 'ADVISORY'),
        el('option', { value: 'conductor', selected: state.aiMode === 'conductor' }, 'CONDUCTOR')
      ),
      button('Print Takeaway', { className: 'btn', onClick: () => state.onPrint?.() })
    )
  ) : null;

  return el('div', { class: 'drawer' },
    el('details', { class: 'drawer' },
      el('summary', {}, 'Party Sheets'),
      el('div', { class: 'drawer-body stack' }, ...partyCards)
    ),
    el('details', { class: 'drawer' },
      el('summary', {}, 'Ledger (facts / threats / questions)'),
      el('div', { class: 'drawer-body grid2' },
        listBox('Facts', ledger.facts.map(x => x.text)),
        listBox('Threats', ledger.threats.map(x => `${'!'.repeat(x.level)} ${x.text}`)),
        listBox('Questions', ledger.questions.map(x => x.text)),
        listBox('Clocks', [
          `pressure: ${w.clocks.pressure}/12`,
          `dread: ${w.clocks.dread}/12`,
          `revelation: ${w.clocks.revelation}/12`
        ])
      )
    ),
    advancedDrawer
  );
}

function listBox(title, items) {
  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, title),
    el('div', { class: 'panel card stack' },
      ...(items?.length ? items.map(x => el('div', { class: 'small' }, x)) : [el('div', { class: 'small' }, '—')])
    )
  );
}

function debugBadge(state) {
  const seed = state.debugSeed || '—';
  const lastError = state.lastError || '';
  const a = state.aiLast && typeof state.aiLast === 'object' ? state.aiLast : { mode: 'off', ok: null, reason: '' };
  const aiLine = (a.ok === null) ? '' : `${String(a.mode || 'off')}:${a.ok ? 'ok' : 'fail'}${a.reason ? ` (${a.reason})` : ''}`;

  return el('div', { class: 'debug-badge' },
    el('div', {}, el('span', { class: 'k' }, 'screen: '), String(state.screenName || '—')),
    el('div', {}, el('span', { class: 'k' }, 'party: '), String(state.partyCount ?? '—')),
    el('div', {}, el('span', { class: 'k' }, 'seed: '), String(seed)),
    aiLine ? el('div', {}, el('span', { class: 'k' }, 'ai: '), aiLine) : null,
    lastError ? el('div', {}, el('span', { class: 'k' }, 'lastError: '), String(lastError)) : null
  );
}

function devLogPane(state) {
  const lines = state.devLogLines || [];
  return el('div', { class: 'stack' },
    el('div', { class: 'small' }, 'Dev Log'),
    el('div', { class: 'devlog' }, lines.length ? lines.slice(-60).join('\n') : '[UI] (no events yet)')
  );
}

function blockedBox(state) {
  const b = state.blocked;
  return el('div', { class: 'banner stack' },
    el('div', {}, b.reason || 'Blocked.'),
    b.fixLabel ? el('div', { class: 'row' }, button(b.fixLabel, { className: 'btn', onClick: () => b.onFix?.() })) : null
  );
}

function renderLine(l) {
  const shown = (l && typeof l === 'object' && l.displayOnly) ? l.displayOnly : (l.text || '');
  return el('div', { class: 'line' },
    el('div', { class: 'who' }, l.who || 'wizard'),
    el('div', { class: 'text' }, shown),
    l.mech ? el('div', { class: 'mech' }, l.mech) : null
  );
}

// wizard art moved to ./wizardArt.js
