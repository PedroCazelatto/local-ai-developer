// Pins the cut that removes recovered call spans from the content the user sees. Its one non-obvious
// contract is that OVERLAP IS TOLERATED rather than prevented: expandOverFence can widen one span
// into the previous one's territory, and this clamps instead of producing garbage or negative slices.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Span } from '../expand-over-fence.js';
import { stripSpans } from '../strip-spans.js';

const span = (start: number, end: number): Span => [start, end];

test('no spans leaves the text untouched', () => {
  assert.equal(stripSpans('hello', []), 'hello');
});

test('one span in the middle is cut out', () => {
  assert.equal(stripSpans('abcdef', [span(2, 4)]), 'abef');
});

test('a span at the very start is cut', () => {
  assert.equal(stripSpans('abcdef', [span(0, 3)]), 'def');
});

test('a span running to the end is cut', () => {
  assert.equal(stripSpans('abcdef', [span(3, 6)]), 'abc');
});

test('a span covering everything leaves the empty string', () => {
  assert.equal(stripSpans('abcdef', [span(0, 6)]), '');
});

test('two disjoint spans are both cut and the gap between them survives', () => {
  assert.equal(stripSpans('abcdefghij', [span(1, 3), span(6, 8)]), 'adefij');
});

test('an empty span removes nothing', () => {
  assert.equal(stripSpans('abcdef', [span(3, 3)]), 'abcdef');
});

test('OVERLAPPING spans are tolerated — the cursor clamps forward', () => {
  // expandOverFence widening a fence backwards is exactly how this arises.
  assert.equal(stripSpans('abcdefghij', [span(2, 6), span(4, 8)]), 'abij');
});

test('a span entirely inside the previous one contributes nothing extra', () => {
  assert.equal(stripSpans('abcdefghij', [span(2, 8), span(4, 6)]), 'abij');
});

test('a span ending before the cursor cannot resurrect already-cut text', () => {
  assert.equal(stripSpans('abcdefghij', [span(2, 8), span(0, 1)]), 'abij');
});

test('a span past the end of the text is harmless', () => {
  assert.equal(stripSpans('abc', [span(1, 99)]), 'a');
});

test('the empty text survives any span', () => {
  assert.equal(stripSpans('', [span(0, 5)]), '');
});
