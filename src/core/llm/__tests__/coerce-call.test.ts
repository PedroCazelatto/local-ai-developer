// Pins the tolerance layer over what qwen2.5-coder actually emits when it writes a tool call as
// text. It is the ONLY gate: everything downstream assumes a { name, arguments } shape and re-checks
// nothing, so both halves matter equally — every variant the model really produces is accepted, and
// everything that is not a call is rejected rather than coerced into a plausible-looking one.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { coerceCall } from '../coerce-call.js';

// ==================================================================================== accepted

test('the plain shape is accepted', () => {
  assert.deepEqual(coerceCall({ name: 'read_file', arguments: { path: 'a.ts' } }), {
    function: { name: 'read_file', arguments: { path: 'a.ts' } },
  });
});

test('all three name keys are accepted', () => {
  for (const key of ['name', 'function_name', 'tool']) {
    assert.deepEqual(coerceCall({ [key]: 'x' }), { function: { name: 'x', arguments: {} } });
  }
});

test('the name keys are tried in priority order', () => {
  const call = coerceCall({ name: 'first', function_name: 'second', tool: 'third' });
  assert.equal(call?.function.name, 'first');
  assert.equal(coerceCall({ function_name: 'second', tool: 'third' })?.function.name, 'second');
});

test('both argument keys are accepted, arguments winning', () => {
  assert.deepEqual(coerceCall({ name: 'x', arguments: { a: 1 } })?.function.arguments, { a: 1 });
  assert.deepEqual(coerceCall({ name: 'x', parameters: { b: 2 } })?.function.arguments, { b: 2 });
  assert.deepEqual(
    coerceCall({ name: 'x', arguments: { a: 1 }, parameters: { b: 2 } })?.function.arguments,
    { a: 1 },
  );
});

test('absent arguments become an empty object, never undefined', () => {
  assert.deepEqual(coerceCall({ name: 'x' })?.function.arguments, {});
});

test('arguments delivered as a JSON string are decoded', () => {
  assert.deepEqual(coerceCall({ name: 'x', arguments: '{"path":"a.ts"}' })?.function.arguments, {
    path: 'a.ts',
  });
});

test('an empty or whitespace-only argument string becomes an empty object', () => {
  assert.deepEqual(coerceCall({ name: 'x', arguments: '' })?.function.arguments, {});
  assert.deepEqual(coerceCall({ name: 'x', arguments: '   ' })?.function.arguments, {});
});

test('an argument string with surrounding whitespace is trimmed before parsing', () => {
  assert.deepEqual(coerceCall({ name: 'x', arguments: '  {"a":1}  ' })?.function.arguments, { a: 1 });
});

test('extra keys on the object are ignored, not a reason to reject', () => {
  assert.deepEqual(coerceCall({ name: 'x', id: 7, type: 'function' }), {
    function: { name: 'x', arguments: {} },
  });
});

// ==================================================================================== rejected

test('a non-object is rejected', () => {
  for (const value of [null, undefined, 42, 'string', true]) {
    assert.equal(coerceCall(value), null, String(value));
  }
});

test('an array is rejected — index probing must not pass for key probing', () => {
  assert.equal(coerceCall([{ name: 'x' }]), null);
  assert.equal(coerceCall([]), null);
});

test('an array CARRYING a name property is still rejected', () => {
  // The case above is also caught by the later "name must be a string" check, so on its own it
  // cannot prove the Array.isArray guard does anything. This one can: it is the only input shape
  // that reaches the name lookup successfully and must still be refused. Not producible from
  // JSON.parse — but coerceCall takes `unknown`, so the guard is what makes that irrelevant.
  const arrayWithName: unknown = Object.assign(['x'], { name: 'read_file' });
  assert.equal(coerceCall(arrayWithName), null);
});

test('an object with no name key at all is rejected', () => {
  assert.equal(coerceCall({ arguments: { a: 1 } }), null);
  assert.equal(coerceCall({}), null);
});

test('a non-string name is rejected rather than stringified', () => {
  assert.equal(coerceCall({ name: 42 }), null);
  assert.equal(coerceCall({ name: null }), null);
  assert.equal(coerceCall({ name: { nested: 'x' } }), null);
});

test('an argument string that is not JSON is rejected', () => {
  assert.equal(coerceCall({ name: 'x', arguments: 'not json' }), null);
});

test('arguments that decode to a non-object are rejected', () => {
  assert.equal(coerceCall({ name: 'x', arguments: '[1,2]' }), null);
  assert.equal(coerceCall({ name: 'x', arguments: '42' }), null);
  assert.equal(coerceCall({ name: 'x', arguments: 'null' }), null);
});

test('arguments given as a non-string non-object are rejected', () => {
  assert.equal(coerceCall({ name: 'x', arguments: 42 }), null);
  assert.equal(coerceCall({ name: 'x', arguments: [1, 2] }), null);
});

test('an empty-string name is accepted, since only the TYPE is checked', () => {
  // CURRENT BEHAVIOUR. Dispatch rejects an unknown tool name by its own allowlist, so this is not a
  // hole — but it is worth pinning that the emptiness check applied to arguments is not applied here.
  assert.deepEqual(coerceCall({ name: '' }), { function: { name: '', arguments: {} } });
});
