import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonLog, appendCanonEvent, isCanonical } from '../engine/csl/canonLog.js';

test('appendCanonEvent logs event deterministically', () => {
  const log = createCanonLog();

  const event = {
    id: 'e1',
    type: 'CANON_CREATE',
    targetId: 'node-1'
  };

  const updated = appendCanonEvent(log, event);

  assert.equal(updated.events.length, 1);
  assert.equal(isCanonical(updated, 'node-1'), true);
});

test('duplicate event id does not double log', () => {
  const log = createCanonLog();

  const event = {
    id: 'e1',
    type: 'CANON_CREATE',
    targetId: 'node-1'
  };

  const once = appendCanonEvent(log, event);
  const twice = appendCanonEvent(once, event);

  assert.equal(twice.events.length, 1);
});


test('CanonLog: rejects unknown event type', () => {
    const log = createCanonLog();
    assert.throws(
        () => appendCanonEvent(log, { id: 'e_bad_type', type: 'NOPE', targetId: 't1' }),
        /CanonLog: invalid event type/
    );
});
test('CanonLog: rejects missing/invalid targetId', () => {
    const log = createCanonLog();
    assert.throws(
        () => appendCanonEvent(log, { id: 'e_bad_target', type: 'CANON_CREATE' }),
        /CanonLog: invalid targetId/
    );
});
