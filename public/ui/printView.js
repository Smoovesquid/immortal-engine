import { stableStringify } from '../../engine/log.js';

export function openPrintView(world) {
  const html = buildPrintHtml(world);
  const w = window.open('', '_blank');
  if (!w) return { ok: false, reason: 'Popup blocked' };
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // Never block gameplay.
  setTimeout(() => w.print(), 50);
  return { ok: true };
}

export function buildPrintHtml(world) {
  const instrument = world.instrument || {};
  const party = Array.isArray(world.party) ? world.party : [];
  const ledger = world.ledger || { facts: [], threats: [], questions: [] };
  const timeline = Array.isArray(world.timeline) ? world.timeline : [];

  const highlights = timeline.slice(-8).map(e => `${String(e.kind)}: ${stableStringify(e.data ?? {})}`);

  const css = `
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:24px;color:#111}
    h1{margin:0 0 8px 0}
    .muted{color:#555;font-size:12px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .box{border:1px solid #ddd;border-radius:10px;padding:12px}
    ul{margin:8px 0 0 18px}
    .mono{font-family: ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px}
    @media print{.noprint{display:none}}
  `;

  const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>AI DM V2 — Print</title><style>${css}</style></head>
<body>
  <div class="noprint muted">AI Dungeon Master (V2) — Print View</div>
  <h1>Chronicle + Party Sheets</h1>
  <div class="muted">campaignId: ${esc(world.meta.campaignId)} • seed: ${esc(world.meta.seed)} • ending: ${esc(world.ending?.type || '—')}</div>

  <div class="grid" style="margin-top:12px">
    <div class="box">
      <div class="muted">Instrument</div>
      <ul>
        <li><b>theme</b>: ${esc(instrument.theme)}</li>
        <li><b>motif</b>: ${esc(instrument.motif)}</li>
        <li><b>taboo</b>: ${esc(instrument.taboo)}</li>
        <li><b>promise</b>: ${esc(instrument.promise)}</li>
        <li><b>cost</b>: ${esc(instrument.cost)}</li>
        <li><b>omen</b>: ${esc(instrument.omen)}</li>
        <li><b>question</b>: ${esc(instrument.question)}</li>
      </ul>
    </div>
    <div class="box">
      <div class="muted">Clocks</div>
      <ul>
        <li>pressure: ${world.clocks.pressure}/12</li>
        <li>dread: ${world.clocks.dread}/12</li>
        <li>revelation: ${world.clocks.revelation}/12</li>
      </ul>
    </div>
  </div>

  <div class="box" style="margin-top:12px">
    <div class="muted">Party</div>
    <div class="grid" style="margin-top:8px">
      ${party.map(m => `
        <div class="box">
          <div><b>${esc(m.name)}</b></div>
          <div class="muted">${esc(m.archetype)} • ${esc(m.vibe)} • stress: ${esc(m.stress ?? 0)}</div>
          <div class="mono" style="margin-top:8px">skills: ${(m.skills||[]).map(esc).join(', ')}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="grid" style="margin-top:12px">
    <div class="box"><div class="muted">Facts</div><ul>${(ledger.facts||[]).slice(0,12).map(x=>`<li>${esc(x.text)}</li>`).join('') || '<li>—</li>'}</ul></div>
    <div class="box"><div class="muted">Threats</div><ul>${(ledger.threats||[]).slice(0,12).map(x=>`<li>${esc(x.text)}</li>`).join('') || '<li>—</li>'}</ul></div>
  </div>

  <div class="box" style="margin-top:12px">
    <div class="muted">Timeline highlights (last 8)</div>
    <ul>${highlights.map(h=>`<li class="mono">${esc(h)}</li>`).join('') || '<li>—</li>'}</ul>
  </div>
</body></html>`;
}
