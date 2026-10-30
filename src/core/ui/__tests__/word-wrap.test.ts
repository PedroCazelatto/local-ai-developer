// Pins wordWrap, the layout the user's message bars and the model's replies both go through. Four
// behaviours have to hold together and each is easy to break in isolation: break only at spaces,
// measure in display columns, re-apply the leading indent to every row, and close/reopen styling
// that straddles a break so a colour neither bleeds into padding nor drops on the continuation.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { visibleWidth } from '../visible-width.js';
import { wordWrap } from '../word-wrap.js';

/** Every returned row must fit the budget — the property the whole function exists to guarantee. */
function assertFits(lines: readonly string[], width: number): void {
  for (const line of lines) assert.ok(visibleWidth(line) <= width, `"${line}" is wider than ${width}`);
}

// ================================================================================== degenerate

test('a non-positive width hands the text back as a single line', () => {
  assert.deepEqual(wordWrap('a b c', 0), ['a b c']);
  assert.deepEqual(wordWrap('a b c', -5), ['a b c']);
});

test('the empty string is one empty line, never an empty array', () => {
  assert.deepEqual(wordWrap('', 10), ['']);
});

test('a string of only spaces collapses to its indent', () => {
  assert.deepEqual(wordWrap('   ', 10), ['   ']);
});

test('text that already fits is one line', () => {
  assert.deepEqual(wordWrap('hello world', 20), ['hello world']);
});

// ============================================================================ breaking at spaces

test('a break lands on a space and the space becomes the break', () => {
  assert.deepEqual(wordWrap('hello world', 5), ['hello', 'world']);
});

test('as many words as fit share a row', () => {
  assert.deepEqual(wordWrap('a b c', 3), ['a b', 'c']);
});

test('a run of spaces collapses to one — wrapping is lossy about whitespace', () => {
  assert.deepEqual(wordWrap('a    b', 10), ['a b']);
});

test('a trailing space produces no empty trailing word', () => {
  assert.deepEqual(wordWrap('a ', 10), ['a']);
});

test('a tab is not a word separator', () => {
  // Only literal spaces break. Pinned so the day tabs matter is a decision, not a surprise.
  assert.deepEqual(wordWrap('a\tb', 2), ['a\t', 'b']);
});

// ================================================================================ hanging indent

test('leading indentation is re-applied to every wrapped row', () => {
  assert.deepEqual(wordWrap('  hello world', 8), ['  hello', '  world']);
});

test('the indent is charged against the budget', () => {
  assert.deepEqual(wordWrap('  hello there', 9), ['  hello', '  there']);
});

test('an indent that eats the whole budget floors the usable width at one column', () => {
  // usable is max(1, width - indent). The rows then EXCEED `width` — deliberately, because the
  // alternative to a one-column floor is a loop that can never place a character.
  const lines = wordWrap('    ab cd', 3);
  assert.deepEqual(lines, ['    a', '    b', '    c', '    d']);
  assert.ok(visibleWidth(lines[0] ?? '') > 3);
});

// ============================================================================== over-long words

test('a word too long to ever fit is split as a last resort', () => {
  const lines = wordWrap('abcdefgh', 3);
  assert.deepEqual(lines, ['abc', 'def', 'gh']);
  assertFits(lines, 3);
});

test('an over-long word starts on its own row rather than crowding the one before it', () => {
  assert.deepEqual(wordWrap('x abcdefgh', 3), ['x', 'abc', 'def', 'gh']);
});

test('an over-long word inherits the hanging indent', () => {
  assert.deepEqual(wordWrap('  abcdefgh', 5), ['  abc', '  def', '  gh']);
});

// ================================================================================== wide glyphs

test('widths are display columns, so two CJK glyphs fill a four-column row', () => {
  const lines = wordWrap('日本 語', 4);
  assert.deepEqual(lines, ['日本', '語']);
  assertFits(lines, 4);
});

test('a wide glyph is never split down the middle by the last-resort break', () => {
  const lines = wordWrap('日本語', 3);
  assert.deepEqual(lines, ['日', '本', '語']);
  assertFits(lines, 3);
});

// =================================================================================== SGR styling

test('a colour span crossing a break is closed on the row and reopened on the next', () => {
  assert.deepEqual(wordWrap('\x1b[31mred blue\x1b[0m', 4), [
    '\x1b[31mred\x1b[0m',
    '\x1b[31mblue\x1b[0m',
  ]);
});

test('styling still open at the end of the text is closed on the final row', () => {
  // No row may leave styling open, or it bleeds into whatever the renderer writes next.
  assert.deepEqual(wordWrap('\x1b[1mbold text', 4), ['\x1b[1mbold\x1b[0m', '\x1b[1mtext\x1b[0m']);
});

test('a balanced span inside one row is left exactly as written', () => {
  assert.deepEqual(wordWrap('\x1b[31mred\x1b[0m ok', 20), ['\x1b[31mred\x1b[0m ok']);
});

test('escape sequences are zero-width, so styling never costs a column of budget', () => {
  const lines = wordWrap('\x1b[31mabcd\x1b[0m efgh', 4);
  assertFits(lines, 4);
  assert.equal(lines.length, 2);
});
