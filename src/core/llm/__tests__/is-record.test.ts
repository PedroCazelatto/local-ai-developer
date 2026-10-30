// Pins the narrowing that guards every `in` probe over model-supplied JSON. Both exclusions are
// load-bearing: `typeof null === 'object'`, and `'0' in []` answers for an index — so without this,
// a bare array of anything would satisfy a "does it have a name key?" test on its first element.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isRecord } from '../is-record.js';

test('a plain object is a record', () => {
  assert.equal(isRecord({}), true);
  assert.equal(isRecord({ name: 'x' }), true);
});

test('null is NOT a record, despite typeof saying object', () => {
  assert.equal(typeof null, 'object', 'the trap this exists to close');
  assert.equal(isRecord(null), false);
});

test('an array is NOT a record, despite the in operator answering for indices', () => {
  assert.equal(0 in ['x'], true, 'the trap this exists to close');
  assert.equal(isRecord(['x']), false);
  assert.equal(isRecord([]), false);
});

test('primitives are not records', () => {
  for (const value of [undefined, 42, 'text', true, Symbol('s'), 10n]) {
    assert.equal(isRecord(value), false, String(value));
  }
});

test('an object from a class or a null prototype still counts', () => {
  assert.equal(isRecord(new Error('x')), true);
  assert.equal(isRecord(Object.create(null)), true);
});
