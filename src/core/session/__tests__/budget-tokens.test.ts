// Pins the fraction table against the values #99 confirmed, and the arithmetic that turns a fraction
// into tokens. The table is the point of backlog item 7 — every model-facing budget moves with
// OLLAMA_NUM_CTX — so the tests check both the numbers at the default ceiling and that they MOVE.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BUDGET_FRACTIONS } from '../budget-fractions.js';
import { budgetTokens } from '../budget-tokens.js';
import type { BudgetName } from '../budget-tokens.js';

// The "= tokens" column of OPEN-QUESTIONS.md #99, at the default 16 384.
const AT_DEFAULT: Readonly<Record<BudgetName, number>> = {
  boundedOneShotNumCtx: 8_192,
  reviewDiff: 3_072,
  titleTranscript: 1_365,
  readFile: 1_170,
  testRunCapture: 1_024,
  specSlice: 585,
};

test('every row lands on the value #99 confirmed at 16 384', () => {
  for (const [name, expected] of Object.entries(AT_DEFAULT)) {
    assert.equal(budgetTokens(name as BudgetName, 16_384), expected, name);
  }
});

test('the test above covers every row of the table, and no row it does not know', () => {
  assert.deepEqual(Object.keys(BUDGET_FRACTIONS).sort(), Object.keys(AT_DEFAULT).sort());
});

test('a budget moves with the ceiling — doubling the base doubles it, give or take the rounding', () => {
  for (const name of Object.keys(BUDGET_FRACTIONS) as BudgetName[]) {
    // floor(2x) is either 2·floor(x) or one more, depending on the fraction floor dropped.
    const once = budgetTokens(name, 16_384);
    const doubled = budgetTokens(name, 32_768);
    assert.ok(doubled === 2 * once || doubled === 2 * once + 1, `${name}: ${once} → ${doubled}`);
  }
});

test('a fraction with no exact float does not round one under on an exact multiple', () => {
  // 1/12, 1/14 and 1/28 are inexact as decimals; the integer arithmetic must still land on the multiple.
  assert.equal(budgetTokens('titleTranscript', 12), 1);
  assert.equal(budgetTokens('titleTranscript', 12 * 1_000_003), 1_000_003);
  assert.equal(budgetTokens('readFile', 14 * 999_983), 999_983);
  assert.equal(budgetTokens('specSlice', 28 * 777_777), 777_777);
});

test('a product that is not whole rounds down', () => {
  assert.equal(budgetTokens('boundedOneShotNumCtx', 8_191), 4_095);
  assert.equal(budgetTokens('reviewDiff', 100), 18); // 18.75
});
