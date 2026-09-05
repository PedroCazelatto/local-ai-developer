// Pins the column count the renderer moves the cursor by. Two things make it differ from .length —
// ANSI escapes occupy zero columns and wide glyphs occupy two — and both are pinned here, along with
// the boundaries of what the escape stripper actually recognises.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { visibleWidth } from '../visible-width.js';

test('the empty string is zero columns', () => {
  assert.equal(visibleWidth(''), 0);
});

test('plain ASCII is one column per character', () => {
  assert.equal(visibleWidth('hello'), 5);
  assert.equal(visibleWidth('a b'), 3);
});

// ================================================================================ zero-width ANSI

test('an SGR colour sequence costs nothing', () => {
  assert.equal(visibleWidth('\x1b[31mred\x1b[0m'), 3);
});

test('a multi-parameter SGR sequence costs nothing', () => {
  assert.equal(visibleWidth('\x1b[1;38;5;214mwarn\x1b[0m'), 4);
});

test('a bare reset costs nothing', () => {
  assert.equal(visibleWidth('\x1b[m'), 0);
});

test('non-SGR CSI sequences are stripped too', () => {
  // The stripper matches any CSI ending in a letter, so a clear-line or cursor-move riding along in
  // a measured string does not inflate the count.
  assert.equal(visibleWidth('\x1b[2Kabc'), 3);
  assert.equal(visibleWidth('\x1b[10Aabc'), 3);
});

test('a lone ESC that starts no CSI is counted as one column', () => {
  // Pinned as the CURRENT behaviour: only well-formed CSI is recognised, and a stray ESC is treated
  // as an ordinary code point rather than silently swallowed.
  assert.equal(visibleWidth('\x1babc'), 4);
});

// ================================================================================== wide glyphs

test('CJK glyphs are two columns each', () => {
  assert.equal(visibleWidth('日本'), 4);
  assert.equal(visibleWidth('한글'), 4);
});

test('an emoji from the pictograph range is two columns despite being a surrogate pair', () => {
  assert.equal(visibleWidth('😀'), 2);
});

test('an astral code point outside the wide ranges is ONE column despite .length being 2', () => {
  const deseret = String.fromCodePoint(0x10400);
  assert.equal(deseret.length, 2);
  assert.equal(visibleWidth(deseret), 1);
});

test('narrow and wide mix additively', () => {
  assert.equal(visibleWidth('a日b'), 4);
  assert.equal(visibleWidth('\x1b[31m日\x1b[0mx'), 3);
});

test('a fullwidth digit is two columns while its ASCII twin is one', () => {
  assert.equal(visibleWidth('１'), 2);
  assert.equal(visibleWidth('1'), 1);
});

// ================================================= the two places the count is known to be a guess

test('a combining mark adds a column, so a decomposed accent measures two', () => {
  // Documented as out of scope in code-point-width.ts. Pinned so the day it changes is a decision.
  assert.equal(visibleWidth('é'), 2);
  assert.equal(visibleWidth('é'), 1, 'the precomposed form measures correctly');
});

test('a ZWJ emoji sequence is counted per code point, not per rendered glyph', () => {
  // Family emoji renders as ONE 2-column glyph in most terminals; here the three faces cost 2 each
  // and the two joiners cost 1 each, so it measures 8. Pinned as the CURRENT behaviour — grapheme
  // clustering is out of scope for this layer. See the report.
  assert.equal(visibleWidth('\u{1f468}‍\u{1f469}‍\u{1f466}'), 8);
});
