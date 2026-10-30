// Pins the tolerant JSON decoder both parsing paths rest on. It has two jobs, and the second is the
// one that is easy to miss: it returns the decoded value AND how much text it consumed, because the
// bare-JSON recovery path has no closing delimiter to search for and locates the end of the object
// from this number alone. A wrong `consumed` does not fail loudly — it leaves JSON debris in the
// reply the user reads.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { repairDecode } from '../repair-decode.js';

/** The decode that must succeed, so a silent null cannot pass as a passing assertion. */
function decoded(text: string): { value: unknown; consumed: number } {
  const result = repairDecode(text);
  assert.notEqual(result, null, `expected ${JSON.stringify(text)} to decode`);
  assert.ok(result !== null);
  return result;
}

// ================================================================================ the strict path

test('a well-formed object decodes and reports its whole length', () => {
  const text = '{"a":1}';
  assert.deepEqual(decoded(text), { value: { a: 1 }, consumed: text.length });
});

test('nested objects are decoded whole', () => {
  assert.deepEqual(decoded('{"a":{"b":{"c":1}}}').value, { a: { b: { c: 1 } } });
});

test('text that does not start with a brace is refused outright', () => {
  assert.equal(repairDecode('not json'), null);
  assert.equal(repairDecode(' {"a":1}'), null, 'leading whitespace is not trimmed here');
  assert.equal(repairDecode('[1,2]'), null, 'an array is not an object');
  assert.equal(repairDecode(''), null);
});

// ============================================================================== the repair path

test('a literal newline inside a string value is escaped and parsed', () => {
  assert.deepEqual(decoded('{"a":"one\ntwo"}').value, { a: 'one\ntwo' });
});

test('literal tabs and carriage returns are repaired too', () => {
  assert.deepEqual(decoded('{"a":"one\ttwo"}').value, { a: 'one\ttwo' });
  assert.deepEqual(decoded('{"a":"one\rtwo"}').value, { a: 'one\rtwo' });
});

test('an already-escaped sequence is left alone rather than double-escaped', () => {
  assert.deepEqual(decoded('{"a":"one\\ntwo"}').value, { a: 'one\ntwo' });
});

test('an escaped quote does not end the string early', () => {
  assert.deepEqual(decoded('{"a":"say \\"hi\\""}').value, { a: 'say "hi"' });
});

test('a brace inside a string does not end the object early', () => {
  assert.deepEqual(decoded('{"a":"}"}').value, { a: '}' });
});

test('whitespace between tokens, outside strings, is ordinary JSON whitespace', () => {
  assert.deepEqual(decoded('{\n  "a": 1\n}').value, { a: 1 });
});

// =========================================================================== the consumed count

test('one object is parsed off the front and the rest ignored', () => {
  const result = decoded('{"a":1} trailing text');
  assert.deepEqual(result.value, { a: 1 });
  assert.equal(result.consumed, 7);
});

test('consumed locates the next object exactly', () => {
  // This is how the bare-JSON scan walks a reply holding two calls.
  const text = '{"a":1}{"b":2}';
  const first = decoded(text);
  assert.equal(first.consumed, 7);
  assert.deepEqual(decoded(text.slice(first.consumed)).value, { b: 2 });
});

test('consumed counts CODE POINTS while every caller slices by code units', () => {
  // CURRENT BEHAVIOUR, and a defect. `for (const ch of text)` iterates code points, so each astral
  // character undercounts `consumed` by one — and the callers use it as a String.slice index. The
  // JSDoc's "counts characters of the original text" is the ambiguity that hides it.
  // Consequence, measured: one emoji in a tool call's arguments leaves a stray `}` in the content
  // the user is shown. See the report.
  const text = '{"a":"\u{1f600}"}';
  assert.equal(text.length, 10, 'ten UTF-16 code units');
  assert.equal(decoded(text).consumed, 9, 'but nine code points');
});

test('a plain-BMP object is unaffected, which is why this has gone unnoticed', () => {
  const text = '{"a":"e"}';
  assert.equal(decoded(text).consumed, text.length);
});

// ================================================================================== refusals

test('an unbalanced object is refused rather than guessed at', () => {
  assert.equal(repairDecode('{"a":1'), null);
  assert.equal(repairDecode('{"a":{"b":1}'), null);
});

test('balanced braces that are still not JSON are refused', () => {
  assert.equal(repairDecode('{not json}'), null);
  assert.equal(repairDecode('{"a":}'), null);
});

test('an empty object is valid', () => {
  assert.deepEqual(decoded('{}'), { value: {}, consumed: 2 });
});
