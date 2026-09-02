// Pins the FAIL-CLOSED read of `/api/tags`'s `capabilities` (OPEN-QUESTIONS.md #13). The absent-field
// case is the one that matters most: it is what a daemon older than 0.9.1 sends for every model, and
// what the pinned `ollama` package's type says nothing about — so this is the only place the repo
// decides that "we cannot tell" means "no".

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readCapabilities } from '../read-capabilities.js';

test('a real /api/tags row yields its capability list, in order', () => {
  const row = {
    name: 'qwen2.5-coder:14b',
    size: 8_988_112_040,
    digest: '9ec8897f747e246e970',
    capabilities: ['completion', 'tools', 'insert'],
  };
  assert.deepEqual(readCapabilities(row), ['completion', 'tools', 'insert']);
});

test('an ABSENT capabilities field fails closed to an empty list', () => {
  // Exactly the shape ollama 0.5.18's ModelResponse declares, and exactly what a pre-0.9.1 daemon sends.
  const row = { name: 'deepseek-coder-v2:16b', size: 8_905_126_121, digest: '63fb193b3a9b4322a18' };
  assert.deepEqual(readCapabilities(row), []);
});

test('a capabilities field of the wrong shape fails closed too', () => {
  assert.deepEqual(readCapabilities({ capabilities: null }), []);
  assert.deepEqual(readCapabilities({ capabilities: 'tools' }), [], 'a bare string is not a list');
  assert.deepEqual(readCapabilities({ capabilities: 42 }), []);
  assert.deepEqual(readCapabilities({ capabilities: {} }), []);
});

test('a row that is not an object at all fails closed', () => {
  for (const row of [undefined, null, 'tools', 7, true, ['tools']]) {
    assert.deepEqual(readCapabilities(row), [], String(row));
  }
});

test('an empty capability list stays empty rather than becoming unknown', () => {
  assert.deepEqual(readCapabilities({ capabilities: [] }), []);
});

test('non-string members are DROPPED, not coerced', () => {
  // A capability we cannot read is one we cannot honour: String(null) would have produced 'null', and
  // a numeric 0 would have been kept as '0' — both of which are capabilities that do not exist.
  assert.deepEqual(readCapabilities({ capabilities: ['tools', null, 0, { tools: true }, 'insert'] }), [
    'tools',
    'insert',
  ]);
});

test('the field is read from the row itself, never inherited from a prototype chain we do not own', () => {
  // Object.create puts `capabilities` on the prototype; `in`/property access finds it, which is the
  // behaviour being pinned rather than a preference — a daemon row is plain JSON, so this can only be
  // reached by a caller constructing something odd, and the read is deliberately not hasOwnProperty-gated.
  const row: unknown = Object.create({ capabilities: ['tools'] });
  assert.deepEqual(readCapabilities(row), ['tools']);
});
