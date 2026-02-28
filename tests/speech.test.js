import test from 'node:test';
import assert from 'node:assert/strict';

import { filterSpeakText } from '../public/ui/speech.js';

test('filterSpeakText strips bracketed mechanics deterministically', () => {
  const input = 'Wizard: Hello there. [roll:12 vs DC:10 → success] What do you do?';
  const out = filterSpeakText(input);
  assert.equal(out, 'Wizard: Hello there. What do you do?');

  const input2 = '[UI] click:submit';
  assert.equal(filterSpeakText(input2), '');
});
