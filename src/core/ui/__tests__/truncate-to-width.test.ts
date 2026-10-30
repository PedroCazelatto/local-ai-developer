// Pins truncateToWidth, the cut that guarantees render-question-panel.ts emits exactly one terminal
// row per line — the panel redraws by moving the cursor up by its own line count, so a line that
// wraps smears the widget down the screen.
//
// IMPORTANT, and pinned deliberately: this function measures with `.length`, i.e. UTF-16 code units,
// NOT display columns — unlike every other function in this layer. Its own doc comment says
// "columns". The tests below pin what it does, and the two cases where that differs from what the
// comment promises are marked. See the report.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { truncateToWidth } from '../truncate-to-width.js';
import { visibleWidth } from '../visible-width.js';

// ==================================================================================== the budget

test('a string that already fits comes back untouched', () => {
  assert.equal(truncateToWidth('abc', 5), 'abc');
});

test('a string exactly at the budget comes back untouched', () => {
  assert.equal(truncateToWidth('abcde', 5), 'abcde');
});

test('an over-long string is cut with the ellipsis inside the budget', () => {
  assert.equal(truncateToWidth('abcdef', 4), 'abc…');
  assert.equal(visibleWidth(truncateToWidth('abcdef', 4)), 4);
});

test('a budget of one leaves room for the ellipsis alone', () => {
  assert.equal(truncateToWidth('abcdef', 1), '…');
});

test('a budget of one leaves a single-character string alone', () => {
  assert.equal(truncateToWidth('a', 1), 'a');
});

test('a budget below one yields the empty string', () => {
  assert.equal(truncateToWidth('abcdef', 0), '');
  assert.equal(truncateToWidth('abcdef', -3), '');
});

test('the empty string survives any budget', () => {
  assert.equal(truncateToWidth('', 5), '');
  assert.equal(truncateToWidth('', 0), '');
});

// ==================================================== where .length and display columns disagree

test('a wide-glyph string is measured by code units, so it can overflow its budget', () => {
  // CURRENT BEHAVIOUR, not the invariant the doc comment states: three CJK glyphs are three code
  // units and pass a budget of 3, but occupy six columns — enough to wrap the panel it protects.
  const cjk = '日本語';
  assert.equal(truncateToWidth(cjk, 3), cjk);
  assert.equal(visibleWidth(cjk), 6);
});

test('a cut can land inside a surrogate pair and emit a lone surrogate', () => {
  // CURRENT BEHAVIOUR. The file header warns about cutting inside an ANSI sequence; the same hazard
  // exists for an astral code point and is not guarded.
  const cut = truncateToWidth('😀ab', 2);
  assert.equal(cut, '\ud83d…');
  assert.equal(cut.codePointAt(0), 0xd83d, 'a lone high surrogate, not the emoji');
});

test('an emoji budget that happens to align survives intact', () => {
  assert.equal(truncateToWidth('😀😀', 3), '😀…');
});
