/**
 * Role contracts — the packet's "last fall breakthrough" (Symbolically Scaffolded
 * Play, §1): constraint is attached to ROLES, not pasted globally. Each AI role
 * declares what it may read, which tools it may call, and whether it can touch
 * canon. The engine already enforces the canon firewall structurally; this makes
 * the role boundaries explicit and checkable so a narrator can never call
 * append_event and an NPC can never reveal hidden state.
 *
 * Authority rule (mirrors the architecture): exactly the resolution/mechanics
 * role holds canon authority. Every voice role (referee, narrator, npc, ...) is
 * propose-only — it can speak, never mutate.
 *
 * PURE: data + predicates, no I/O.
 */

export const ROLE_CONTRACTS = {
  // The only role that may mutate canon (pure-code resolution path).
  resolution: {
    constraint: 'absolute', canonAuthority: true, mayMutate: true,
    allowedTools: ['resolve_action', 'append_event', 'advance_clock', 'change_inventory', 'get_scene_state'],
    forbiddenTools: [],
    forbiddenKnowledge: [],
    outputSchema: 'resolution'
  },
  referee: {
    constraint: 'high', canonAuthority: false, mayMutate: false,
    allowedTools: ['get_legal_actions', 'get_scene_state', 'query_rules'],
    forbiddenTools: ['append_event', 'resolve_action', 'advance_clock', 'change_inventory', 'reveal_hidden_state'],
    forbiddenKnowledge: ['hidden_npc_secrets', 'unrevealed_facts'],
    outputSchema: 'referee'
  },
  narrator: {
    constraint: 'medium-low', canonAuthority: false, mayMutate: false,
    allowedTools: ['get_scene_state'],
    forbiddenTools: ['append_event', 'resolve_action', 'advance_clock', 'change_inventory', 'reveal_hidden_state'],
    forbiddenKnowledge: ['hidden_npc_secrets', 'unrevealed_facts'],
    outputSchema: 'narration'
  },
  npc: {
    constraint: 'medium', canonAuthority: false, mayMutate: false,
    allowedTools: ['get_npc_memory'],
    forbiddenTools: ['append_event', 'resolve_action', 'advance_clock', 'change_inventory', 'reveal_hidden_state'],
    forbiddenKnowledge: ['facts_outside_npc_knowledge', 'other_npc_secrets'],
    outputSchema: 'dialogue'
  },
  memory_summarizer: {
    constraint: 'high', canonAuthority: false, mayMutate: false,
    allowedTools: ['get_canon_log'],
    forbiddenTools: ['append_event', 'resolve_action', 'advance_clock', 'change_inventory'],
    forbiddenKnowledge: [],
    outputSchema: 'summary'
  },
  pressure_director: {
    constraint: 'medium', canonAuthority: false, mayMutate: false,
    allowedTools: ['get_scene_state', 'get_world_pressure'],
    forbiddenTools: ['append_event', 'resolve_action', 'advance_clock', 'change_inventory', 'reveal_hidden_state'],
    forbiddenKnowledge: ['hidden_npc_secrets'],
    outputSchema: 'pressure'
  }
};

export function getRoleContract(role) {
  return ROLE_CONTRACTS[String(role || '')] || null;
}

export function roleHasCanonAuthority(role) {
  const c = getRoleContract(role);
  return Boolean(c && c.canonAuthority);
}

// roleMayUseTool(role, tool) -> boolean. Unknown role or tool not on the allow
// list (or explicitly forbidden) => false. Deny-by-default.
export function roleMayUseTool(role, tool) {
  const c = getRoleContract(role);
  if (!c) return false;
  const t = String(tool || '');
  if (c.forbiddenTools.includes(t)) return false;
  return c.allowedTools.includes(t);
}

// checkRolePermission(role, tool) -> { ok, reason }
export function checkRolePermission(role, tool) {
  const c = getRoleContract(role);
  if (!c) return { ok: false, reason: `unknown_role:${role}` };
  const t = String(tool || '');
  if (c.forbiddenTools.includes(t)) return { ok: false, reason: `forbidden_tool:${role}:${t}` };
  if (!c.allowedTools.includes(t)) return { ok: false, reason: `tool_not_allowed:${role}:${t}` };
  return { ok: true, reason: null };
}

// Throwing variant for call sites that treat overreach as a hard error.
export function assertRolePermission(role, tool) {
  const r = checkRolePermission(role, tool);
  if (!r.ok) throw new Error(`role contract violation: ${r.reason}`);
  return true;
}
