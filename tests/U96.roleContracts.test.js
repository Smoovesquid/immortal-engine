import test from 'node:test';
import assert from 'node:assert/strict';

import { ROLE_CONTRACTS, roleHasCanonAuthority, roleMayUseTool, checkRolePermission, assertRolePermission } from '../engine/ai/roleContracts.js';

test('U96: only the resolution role holds canon authority', () => {
  assert.equal(roleHasCanonAuthority('resolution'), true);
  for (const role of ['referee', 'narrator', 'npc', 'memory_summarizer', 'pressure_director']) {
    assert.equal(roleHasCanonAuthority(role), false, `${role} must be propose-only`);
  }
});

test('U96: voice roles cannot append events or mutate (packet failure mode #7)', () => {
  for (const role of ['referee', 'narrator', 'npc', 'pressure_director']) {
    assert.equal(roleMayUseTool(role, 'append_event'), false);
    assert.equal(roleMayUseTool(role, 'resolve_action'), false);
    assert.equal(roleMayUseTool(role, 'advance_clock'), false);
  }
});

test('U96: NPC role cannot reveal hidden state', () => {
  assert.equal(roleMayUseTool('npc', 'reveal_hidden_state'), false);
  assert.equal(checkRolePermission('npc', 'reveal_hidden_state').ok, false);
});

test('U96: resolution role may resolve + append', () => {
  assert.equal(roleMayUseTool('resolution', 'resolve_action'), true);
  assert.equal(roleMayUseTool('resolution', 'append_event'), true);
});

test('U96: deny-by-default for unknown role/tool', () => {
  assert.equal(roleMayUseTool('wizard_of_oz', 'append_event'), false);
  assert.equal(roleMayUseTool('narrator', 'launch_missiles'), false);
  assert.equal(checkRolePermission('ghost', 'get_scene_state').reason, 'unknown_role:ghost');
});

test('U96: assertRolePermission throws on overreach, passes on allowed', () => {
  assert.throws(() => assertRolePermission('narrator', 'append_event'), /role contract violation/);
  assert.equal(assertRolePermission('referee', 'get_legal_actions'), true);
});

test('U96: every contract declares the required fields', () => {
  for (const [role, c] of Object.entries(ROLE_CONTRACTS)) {
    for (const f of ['constraint', 'canonAuthority', 'mayMutate', 'allowedTools', 'forbiddenTools', 'forbiddenKnowledge', 'outputSchema']) {
      assert.ok(f in c, `${role} missing ${f}`);
    }
    assert.equal(c.canonAuthority, c.mayMutate, `${role}: canon authority and mutate must agree`);
  }
});
