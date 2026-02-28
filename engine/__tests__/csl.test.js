import test from 'node:test';
import assert from 'node:assert/strict';

import { validateSurface } from '../csl/validator.js';
import { serializeSurface, deserializeSurface } from '../csl/serializer.js';

test('Valid surface passes validation', () => {
  const validSurface = {
    id: 'node1-fx-0',
    type: 'table',
    tags: ['furniture']
  };
  assert.equal(validateSurface(validSurface), true);
});

test('Invalid surface fails validation', () => {
  const invalidSurface = {
    id: 1,
    type: 'table',
    tags: ['furniture']
  };
  assert.throws(() => {
    validateSurface(invalidSurface);
  }, /Invalid surface: id and type must be strings/);
});

test('Serialization/Deserialization roundtrip', () => {
  const surface = { id: 'node1-fx-0', type: 'table', tags: ['furniture'] };
  const serialized = serializeSurface(surface);
  const deserialized = deserializeSurface(serialized);
  assert.deepEqual(deserialized, surface);
});
