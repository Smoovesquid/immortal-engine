import test from 'node:test';
import assert from 'node:assert/strict';

import { newWorld } from '../engine/state.js';
import { exportWorld, importWorld } from '../engine/save.js';
import { appendCanonEvent } from '../engine/csl/canonLog.js';

test('U12: canonLog persists across export/import (canonical history durability)', () => {
  let w0 = newWorld({ seed: 'seed', fate: 0.2, campaignId: 'c', pack: { primaryId: 'fantasy', mixerId: null } });

  w0 = {
    ...w0,
    canonLog: appendCanonEvent(w0.canonLog, { id: 'e1', type: 'CANON_CREATE', targetId: 's1' })
  };
  w0 = {
    ...w0,
    canonLog: appendCanonEvent(w0.canonLog, { id: 'e2', type: 'CANON_CREATE', targetId: 's2' })
  };

  const text = exportWorld(w0);
  const w1 = importWorld(text);

  assert.ok(w1.canonLog && Array.isArray(w1.canonLog.events));
  assert.deepEqual(w1.canonLog.events, w0.canonLog.events);
});
