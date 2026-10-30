// Pins addTokenCounts' one invariant: a null POISONS the sum (constitution, "token counts are always
// exact"). If either side of a field is null the sum for that field is null, never 0-coerced — so a
// metric Ollama did not report can never be displayed or budgeted against as if it were a real total.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addTokenCounts } from '../add-token-counts.js';

test('sums both fields when both readings are exact', () => {
  assert.deepEqual(
    addTokenCounts({ promptTokens: 120, evalTokens: 40 }, { promptTokens: 7, evalTokens: 3 }),
    { promptTokens: 127, evalTokens: 43 },
  );
});

test('a null on the left poisons only that field', () => {
  assert.deepEqual(
    addTokenCounts({ promptTokens: null, evalTokens: 40 }, { promptTokens: 7, evalTokens: 3 }),
    { promptTokens: null, evalTokens: 43 },
  );
});

test('a null on the right poisons only that field', () => {
  assert.deepEqual(
    addTokenCounts({ promptTokens: 120, evalTokens: 40 }, { promptTokens: 7, evalTokens: null }),
    { promptTokens: 127, evalTokens: null },
  );
});

test('null is never coerced to zero, even against a zero accumulator', () => {
  // The accumulator every fix-loop caller starts from. A null folded into it must not survive as 0.
  const zero = { promptTokens: 0, evalTokens: 0 };
  assert.deepEqual(addTokenCounts(zero, { promptTokens: null, evalTokens: null }), {
    promptTokens: null,
    evalTokens: null,
  });
});

test('once poisoned, a later exact reading cannot revive the total', () => {
  const poisoned = addTokenCounts({ promptTokens: 0, evalTokens: 0 }, { promptTokens: null, evalTokens: 5 });
  assert.deepEqual(addTokenCounts(poisoned, { promptTokens: 99, evalTokens: 1 }), {
    promptTokens: null,
    evalTokens: 6,
  });
});

test('zero is a real reading and stays zero', () => {
  assert.deepEqual(
    addTokenCounts({ promptTokens: 0, evalTokens: 0 }, { promptTokens: 0, evalTokens: 0 }),
    { promptTokens: 0, evalTokens: 0 },
  );
});
