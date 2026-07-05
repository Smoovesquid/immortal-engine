#!/usr/bin/env node
// One-command verification ladder (free + deterministic). See docs/PROMPT_ARCHITECTURE.md §5.
//   npm run check
// Runs the convergence corpus + full suite/determinism, then prints git sync state.
// Exit 0 only when convergence is 100% AND the suite has 0 failures.
import { execSync } from 'node:child_process';

function sh(cmd) {
  // maxBuffer 64MB — `node --test` prints thousands of lines, well past the 1MB default.
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 };
  try { return { ok: true, out: execSync(cmd, opts) }; }
  catch (e) { return { ok: false, out: `${e.stdout || ''}${e.stderr || ''}` }; }
}

console.log('— Immortal check —');

const conv = sh('npm run convergence');
const convLine = (conv.out.match(/Overall locked-pass: [\d.]+% \(\d+\/\d+\)/) || [])[0] || '(no convergence summary)';
const convGreen = /100\.0%/.test(convLine);
console.log(`${convGreen ? '✓' : '✗'} ${convLine}`);

const test = sh('node --test');
const pass = (test.out.match(/# pass (\d+)/) || [])[1] || '?';
const fail = (test.out.match(/# fail (\d+)/) || [])[1] || '?';
const testGreen = fail === '0';
console.log(`${testGreen ? '✓' : '✗'} suite: ${pass} pass / ${fail} fail (determinism U19/21/22/27/30 included)`);

// MR-1a — position-truth probe (docs/MAP_REAL.md stage 0). Runs the canonical
// boot→exit→walk→journey sequence headless (LLM off, one seed — sub-second) and
// fails the ladder on ANY position finding. Now that egress writes the doorstep,
// this must stay GREEN: it is the standing guard against a transition ever
// teleporting the body off the map. `positionProbe.mjs` exits non-zero on findings.
const posProbe = sh('npm run playtest:position');
const posFindings = (posProbe.out.match(/(\d+) finding\(s\)/) || [])[1];
const posGreen = posProbe.ok && posFindings === undefined; // exit 0 AND no findings line
console.log(`${posGreen ? '✓' : '✗'} position probe: ${posGreen ? 'no findings (doorstep egress honest)' : `${posFindings || '?'} finding(s) — the body desyncs on a transition`}`);

const branch = (sh('git rev-parse --abbrev-ref HEAD').out || '').trim() || '?';
const dirty = (sh('git status --porcelain').out || '').trim();
const dirtyN = dirty ? dirty.split('\n').length : 0;
const ahead = ((sh('git rev-list --count @{u}..HEAD').out || '0').trim()) || '0';
console.log(`• git: ${branch} · ${dirtyN ? `${dirtyN} uncommitted` : 'clean'} · ${ahead} unpushed`);

const green = convGreen && testGreen && posGreen;
console.log(green ? '\nGREEN — free ladder passes.' : '\n✗ NOT GREEN — fix before committing.');
process.exit(green ? 0 : 1);
