// A02: WorldStore — save/load/list/delete + path traversal rejection
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { saveWorld, loadWorld, listWorlds, deleteWorld, isSafeId } from '../server/worldStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORLDS_DIR = path.join(__dirname, '..', 'data', 'worlds');

function cleanupWorlds() {
  if (fs.existsSync(WORLDS_DIR)) {
    fs.rmSync(WORLDS_DIR, { recursive: true, force: true });
  }
}

describe('A02 — WorldStore', () => {
  beforeEach(() => cleanupWorlds());
  afterEach(() => cleanupWorlds());

  it('save and load round-trips correctly', () => {
    const state = { meta: { seed: 'test' }, timeline: [1, 2, 3] };
    saveWorld('user1', 'world1', state);
    const loaded = loadWorld('user1', 'world1');
    assert.deepStrictEqual(loaded, state);
  });

  it('list returns saved worlds', () => {
    saveWorld('user2', 'alpha', { a: 1 });
    saveWorld('user2', 'beta', { b: 2 });
    const worlds = listWorlds('user2');
    assert.equal(worlds.length, 2);
    const ids = worlds.map(w => w.id).sort();
    assert.deepStrictEqual(ids, ['alpha', 'beta']);
  });

  it('delete removes world', () => {
    saveWorld('user3', 'todelete', { x: 1 });
    assert.ok(loadWorld('user3', 'todelete'));
    const deleted = deleteWorld('user3', 'todelete');
    assert.ok(deleted);
    assert.equal(loadWorld('user3', 'todelete'), null);
  });

  it('delete nonexistent returns false', () => {
    assert.equal(deleteWorld('user3', 'nope'), false);
  });

  it('path traversal attempts are rejected', () => {
    assert.equal(isSafeId('../etc'), false);
    assert.equal(isSafeId('../../passwd'), false);
    assert.equal(isSafeId('.hidden'), false);
    assert.equal(isSafeId('foo/bar'), false);
    assert.equal(isSafeId(''), false);

    assert.throws(() => saveWorld('../hack', 'w1', {}), /invalid_user_id/);
    assert.throws(() => saveWorld('user', '../hack', {}), /invalid_world_id/);
    assert.throws(() => loadWorld('user', '../../etc/passwd'), /invalid_world_id/);
  });

  it('load nonexistent returns null', () => {
    assert.equal(loadWorld('nobody', 'nothing'), null);
  });
});
