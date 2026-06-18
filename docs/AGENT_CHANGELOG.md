# AGENT_CHANGELOG

Compact append-only log of meaningful agent-made changes. Use this to preserve
cross-agent continuity: what changed, what proved it, and what remains.

## Template

- Date:
- Agent:
- Packet/seam:
- Commit:
- Files changed:
  - 
- Summary:
- Proof:
  - 
- Remaining:
  - 
- Rollback:

---

## 2026-06-18 — Codex

- Packet/seam: Rung 1 / H-1 scene-object action misrouted as strike
- Commit: `202ba1f`
- Files changed:
  - `engine/playloop.js`
  - `tests/U149.naturalAttackVerbs.test.js`
- Summary: Active escape-combat door/scene-object actions no longer default into enemy strike resolution.
- Proof:
  - `node --test tests/U149.naturalAttackVerbs.test.js`
  - `node --test tests/U149.naturalAttackVerbs.test.js tests/U151.grapple.test.js tests/U152.grappleIntegration.test.js tests/U170.combatStateNarration.test.js`
- Remaining Rung 1 seams:
  - H-2 narration inversion on grapple clinch
  - H-3/H-4/H-5 unarmed/natural attacks resolving as Worn Blade prose/profile
  - H-6 lethal grab/neck-snap intent routing to grapple clinch
- Rollback: revert commit `202ba1f`
