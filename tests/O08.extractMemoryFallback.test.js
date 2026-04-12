// O08: extractMemory deterministic fallback — same inputs produce same template output.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractMemory } from '../engine/npc/npcMemory.js';

function makeNpc(name = 'Marta') {
  return {
    name,
    conversationState: { trustLevel: 5 }
  };
}

// Helper: extract text from memory entry (string or D2 object)
function memText(entry) {
  if (!entry) return '';
  return typeof entry === 'string' ? entry : String(entry.text || '');
}

describe('O08: extractMemory deterministic fallback templates', () => {
  it('same inputs produce same output (deterministic)', () => {
    const npc = makeNpc();
    const decision = { share: ['fact_1'], mood: 'warm', approach: 'volunteer', why: 'test' };
    const outcome = { mode: 'shared', topic: 'trade_routes', trustLevel: 6, trustDelta: 1 };

    const a = extractMemory(npc, 'tell me about trade', decision, outcome);
    const b = extractMemory(npc, 'tell me about trade', decision, outcome);
    assert.deepStrictEqual(a, b, 'deterministic: same inputs produce same output');
    const text = memText(a);
    assert.ok(text.length > 0);
  });

  it('shared mode produces "discussed {topic}" template', () => {
    const npc = makeNpc();
    const mem = extractMemory(npc, 'trade?', null, {
      mode: 'shared', topic: 'trade_routes', trustLevel: 6
    });
    const text = memText(mem);
    assert.ok(text.includes('discussed'), 'shared mode includes "discussed"');
    assert.ok(text.includes('trade_routes'), 'shared mode includes topic');
  });

  it('withheld mode produces "withheld" template', () => {
    const npc = makeNpc();
    const mem = extractMemory(npc, 'secrets?', null, {
      mode: 'withheld', topic: 'dark_secret', trustLevel: 3
    });
    const text = memText(mem);
    assert.ok(text.includes('withheld'), 'withheld mode includes "withheld"');
    assert.ok(text.includes('dark_secret'), 'withheld mode includes topic');
  });

  it('lied mode produces "misled" template', () => {
    const npc = makeNpc();
    const mem = extractMemory(npc, 'what happened?', null, {
      mode: 'lied', topic: 'the_incident', trustLevel: 4
    });
    assert.ok(memText(mem).includes('misled'), 'lied mode includes "misled"');
  });

  it('deflected with no topic returns null', () => {
    const npc = makeNpc();
    const mem = extractMemory(npc, 'hello', null, {
      mode: 'deflected', topic: ''
    });
    assert.equal(mem, null, 'deflected with no topic returns null');
  });

  it('deflected with a topic returns a memory', () => {
    const npc = makeNpc();
    const mem = extractMemory(npc, 'hello', null, {
      mode: 'deflected', topic: 'weather'
    });
    assert.ok(mem, 'deflected with topic returns a memory');
    assert.ok(memText(mem).includes('weather'));
  });

  it('recruited mode produces travel template', () => {
    const npc = makeNpc('Aldric');
    const mem = extractMemory(npc, 'invite to travel', null, {
      mode: 'recruited', topic: '', trustLevel: 7
    });
    assert.ok(memText(mem).includes('agreed to travel'), 'recruited mode includes "agreed to travel"');
    assert.ok(memText(mem).includes('Aldric'), 'recruited mode includes NPC name');
  });

  it('refused-soft mode produces refusal template', () => {
    const npc = makeNpc();
    const mem = extractMemory(npc, 'invite to travel', null, {
      mode: 'refused-soft', topic: '', trustLevel: 4
    });
    assert.ok(memText(mem).includes('refused'), 'refused-soft includes "refused"');
  });
});

describe('O08: extractMemory returns null for null/undefined outcome', () => {
  it('null outcome returns null', () => {
    assert.equal(extractMemory(makeNpc(), 'hi', null, null), null);
  });

  it('undefined outcome returns null', () => {
    assert.equal(extractMemory(makeNpc(), 'hi', null, undefined), null);
  });
});
