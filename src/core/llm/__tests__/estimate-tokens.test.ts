// Pins the pre-send estimate every model-facing budget is measured in. Two properties carry it: the
// estimate rounds UP, so a text is never reported as fitting a budget it overruns by a fraction of a
// token, and it is the length over one shared ratio — nothing reads the text's content, so it needs no
// vocabulary and works for every model the session can select.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CHARS_PER_TOKEN, estimateTokens } from '../estimate-tokens.js';

test('the ratio is four characters a token', () => {
  assert.equal(CHARS_PER_TOKEN, 4);
});

test('an empty text estimates to zero', () => {
  assert.equal(estimateTokens(''), 0);
});

test('a partial token rounds up, never down', () => {
  assert.equal(estimateTokens('a'), 1);
  assert.equal(estimateTokens('abcd'), 1);
  assert.equal(estimateTokens('abcde'), 2);
});

test('the estimate is the length alone — the content does not move it', () => {
  assert.equal(estimateTokens('{"a":[1,2,3]}'), estimateTokens('the quick brow'.slice(0, 13)));
  assert.equal(estimateTokens('x'.repeat(12_000)), 3_000);
});
