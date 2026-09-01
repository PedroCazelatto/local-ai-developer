// Pins the span widening that stops a recovered call from leaving its markdown fence behind. Getting
// this wrong does not lose the call — it leaves an empty ```json ``` block in the visible reply,
// which reads as a rendering bug rather than as a tool call that was lifted out.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { expandOverFence } from '../expand-over-fence.js';

/** The substring a span covers — far easier to read in a failure than a pair of indices. */
function covered(content: string, start: number, end: number): string {
  const [from, to] = expandOverFence(content, start, end);
  return content.slice(from, to);
}

// ================================================================================== widened

test('a fence wrapping the call is swallowed with it', () => {
  const content = '```json\n{"a":1}\n```';
  assert.equal(covered(content, 8, 15), content);
});

test('a fence with no language tag is swallowed too', () => {
  const content = '```\n{"a":1}\n```';
  assert.equal(covered(content, 4, 11), content);
});

test('surrounding prose is left outside the span', () => {
  const content = 'before\n```json\n{"a":1}\n```\nafter';
  assert.equal(covered(content, 15, 22), '```json\n{"a":1}\n```');
});

test('indentation between the opener and the call is inside the fence match', () => {
  const content = '```json\n  {"a":1}\n```';
  assert.equal(covered(content, 10, 17), content);
});

test('trailing spaces after the language tag are tolerated', () => {
  const content = '```json  \n{"a":1}\n```';
  assert.equal(covered(content, 10, 17), content);
});

test('CRLF around the call is tolerated', () => {
  const content = '```json\r\n{"a":1}\r\n```';
  assert.equal(covered(content, 9, 16), content);
});

test('an unclosed fence at end of stream is eaten anyway, opener included', () => {
  // Leaving a bare ``` opener behind would open a code block that never closes.
  const content = '```json\n{"a":1}';
  assert.equal(covered(content, 8, 15), content);
});

// ================================================================================ not widened

test('no fence at all leaves the span exactly as given', () => {
  assert.equal(covered('{"a":1}', 0, 7), '{"a":1}');
});

test('a fence separated from the call by prose is not the call fence', () => {
  const content = '```json\nnote\n{"a":1}\n```';
  assert.equal(covered(content, 13, 20), '{"a":1}');
});

test('an opener with NO closer and more content after is left alone', () => {
  // CURRENT BEHAVIOUR: widening is only safe when the fence is known to wrap the call, so an opener
  // followed by the call and then unrelated prose keeps its fence rather than eating into the prose.
  const content = '```json\n{"a":1} and then some prose';
  assert.equal(covered(content, 8, 15), '{"a":1}');
});

test('a lone brace not preceded by a fence is untouched', () => {
  const content = 'text {"a":1} text';
  assert.equal(covered(content, 5, 12), '{"a":1}');
});
