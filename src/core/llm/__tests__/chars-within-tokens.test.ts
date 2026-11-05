// Pins charsWithinTokens as the exact inverse of estimateTokens — the property every cut relies on. A
// text of the returned length fits the budget, and one character more does not; if the two drifted onto
// different ratios, a cut would either waste budget or overrun it.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { charsWithinTokens } from '../chars-within-tokens.js';
import { estimateTokens } from '../estimate-tokens.js';

test('the returned length is the longest text that fits the budget', () => {
  for (const tokens of [0, 1, 7, 585, 1_170, 3_072]) {
    const chars = charsWithinTokens(tokens);
    assert.ok(estimateTokens('x'.repeat(chars)) <= tokens, `${chars} chars fit ${tokens} tokens`);
    assert.ok(estimateTokens('x'.repeat(chars + 1)) > tokens, `${chars + 1} chars overrun ${tokens} tokens`);
  }
});

test('a zero budget admits no text', () => {
  assert.equal(charsWithinTokens(0), 0);
});
