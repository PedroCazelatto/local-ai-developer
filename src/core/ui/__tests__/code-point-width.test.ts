// Pins the wcwidth table the whole width layer sits on. Every range is pinned at BOTH edges plus the
// code point just outside it, because an off-by-one at a range boundary is the failure mode: the
// pinned status rows and the input-box erase both compute how many rows a line occupies from this
// number, and undercounting a glyph strands the erase and leaks debris across messages.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { codePointWidth } from '../code-point-width.js';

/** Every wide range, as [first, last]. The code point either side of each is asserted narrow. */
const WIDE_RANGES: ReadonlyArray<readonly [number, number, string]> = [
  [0x1100, 0x115f, 'Hangul Jamo'],
  [0x2e80, 0x303e, 'CJK radicals and Kangxi'],
  [0x3041, 0x33ff, 'Hiragana, Katakana, CJK symbols'],
  [0x3400, 0x4dbf, 'CJK Extension A'],
  [0x4e00, 0x9fff, 'CJK Unified Ideographs'],
  [0xa000, 0xa4cf, 'Yi Syllables'],
  [0xac00, 0xd7a3, 'Hangul Syllables'],
  [0xf900, 0xfaff, 'CJK Compatibility Ideographs'],
  [0xfe30, 0xfe4f, 'CJK Compatibility Forms'],
  [0xff00, 0xff60, 'Fullwidth Forms'],
  [0xffe0, 0xffe6, 'Fullwidth signs'],
  [0x1f300, 0x1faff, 'emoji and pictographs'],
  [0x20000, 0x3fffd, 'CJK Extension B and beyond'],
];

/** True when `cp` falls inside any wide range — used only to skip a neighbour that is itself wide. */
function inSomeRange(cp: number): boolean {
  return WIDE_RANGES.some(([first, last]) => cp >= first && cp <= last);
}

test('both edges of every wide range are two columns', () => {
  for (const [first, last, name] of WIDE_RANGES) {
    assert.equal(codePointWidth(first), 2, `${name} first`);
    assert.equal(codePointWidth(last), 2, `${name} last`);
  }
});

test('the code point either side of every wide range is one column', () => {
  for (const [first, last, name] of WIDE_RANGES) {
    if (!inSomeRange(first - 1)) assert.equal(codePointWidth(first - 1), 1, `${name} before`);
    if (!inSomeRange(last + 1)) assert.equal(codePointWidth(last + 1), 1, `${name} after`);
  }
});

test('the two ranges that abut do so without a narrow gap between them', () => {
  // 0x33ff -> 0x3400 is a range boundary with no gap; a naive edge test would report a hole here.
  assert.equal(codePointWidth(0x33ff), 2);
  assert.equal(codePointWidth(0x3400), 2);
});

test('the gaps left deliberately between ranges are narrow', () => {
  assert.equal(codePointWidth(0x303f), 1, 'between Kangxi and Hiragana');
  assert.equal(codePointWidth(0x4dc0), 1, 'Yijing hexagrams, between Extension A and CJK');
  assert.equal(codePointWidth(0xff61), 1, 'halfwidth katakana, just past Fullwidth Forms');
});

test('ASCII is one column', () => {
  for (const ch of 'aZ0 ~!') assert.equal(codePointWidth(ch.codePointAt(0) ?? 0), 1, ch);
});

test('an astral code point outside the wide ranges is ONE column, not two', () => {
  // A surrogate pair has .length 2 but occupies one cell — counting it as two is the mirror-image
  // bug of undercounting CJK, and it is why the caller iterates code points rather than units.
  assert.equal(codePointWidth(0x10400), 1, 'Deseret capital long I');
  assert.equal(codePointWidth(0x1d400), 1, 'mathematical bold capital A');
});

test('a combining mark is left at one column, deliberately', () => {
  // Matching readline's zero-width handling is out of scope for this table; pinned so a later
  // change to it is a decision rather than an accident.
  assert.equal(codePointWidth(0x0301), 1, 'combining acute accent');
  assert.equal(codePointWidth(0x200d), 1, 'zero width joiner');
});

test('a control character and code point zero are one column', () => {
  assert.equal(codePointWidth(0), 1);
  assert.equal(codePointWidth(0x0a), 1);
  assert.equal(codePointWidth(0x1b), 1);
});
