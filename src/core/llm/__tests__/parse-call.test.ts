// Pins the decode of one <tool_call> payload. Its emphasis is deliberately the OPPOSITE of the bare
// JSON path's: a tagged block is already delimited, so the strict parse is tried first and the
// repair pass is only the fallback. Both branches must reach the same coercion gate.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseCall } from '../parse-call.js';

test('a well-formed payload decodes on the strict path', () => {
  assert.deepEqual(parseCall('{"name":"read_file","arguments":{"path":"a.ts"}}'), {
    function: { name: 'read_file', arguments: { path: 'a.ts' } },
  });
});

test('surrounding whitespace and newlines are trimmed first', () => {
  assert.deepEqual(parseCall('\n  {"name":"x"}\n  '), { function: { name: 'x', arguments: {} } });
});

test('a literal control character falls through to the repair path and still coerces', () => {
  assert.deepEqual(parseCall('{"name":"write_file","arguments":{"content":"a\nb"}}'), {
    function: { name: 'write_file', arguments: { content: 'a\nb' } },
  });
});

test('the key variants are honoured on both paths', () => {
  assert.equal(parseCall('{"tool":"x"}')?.function.name, 'x');
  assert.equal(parseCall('{"function_name":"x","parameters":{"a":"b\nc"}}')?.function.name, 'x');
});

test('a decodable object that is not a call shape is refused', () => {
  assert.equal(parseCall('{"note":"not a call"}'), null);
});

test('undecodable text is refused', () => {
  assert.equal(parseCall('{not json}'), null);
  assert.equal(parseCall('just prose'), null);
  assert.equal(parseCall(''), null);
});

test('a JSON array payload is refused', () => {
  assert.equal(parseCall('[{"name":"x"}]'), null);
});
