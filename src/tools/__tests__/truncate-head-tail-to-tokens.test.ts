// Pins the token-budget head+tail cut every host-side git read and the Worker's test capture go through.
// The invariants: a text that fits passes through untouched; a text that does not keeps its head and
// its tail within the budget, with the marker ON TOP of it (as the character version does); and the
// marker says the count is an estimate, so the model is never handed an approximation as a fact.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateTokens } from '../../core/llm/estimate-tokens.js';
import { truncateHeadTailToTokens } from '../truncate-head-tail-to-tokens.js';

test('a text whose estimate fits the budget comes back unchanged', () => {
  const text = 'x'.repeat(400); // 100 tokens
  assert.equal(truncateHeadTailToTokens(text, 100), text);
  assert.equal(truncateHeadTailToTokens('', 0), '');
});

test('an over-budget text keeps its head and its tail, and drops the middle', () => {
  const text = `${'H'.repeat(1_000)}${'M'.repeat(1_000)}${'T'.repeat(1_000)}`;
  const out = truncateHeadTailToTokens(text, 100); // half = 50 tokens = 200 chars each side
  const [head, , tail] = out.split('\n');
  assert.equal(head, 'H'.repeat(200));
  assert.equal(tail, 'T'.repeat(200));
  assert.ok(!out.includes('M'), 'nothing of the middle survives');
});

test('head and tail together fit the budget; the marker is the only thing on top', () => {
  const text = 'abcdefghij'.repeat(1_000); // 2 500 tokens, so every budget below cuts
  for (const budget of [1, 2, 99, 100, 2_499]) {
    const lines = truncateHeadTailToTokens(text, budget).split('\n');
    assert.equal(lines.length, 3, 'head, marker, tail');
    assert.ok(estimateTokens(`${lines[0]}${lines[2]}`) <= budget, `head + tail fit ${budget}`);
  }
});

test('the marker names the estimated tokens dropped, marked as an estimate', () => {
  const text = `${'a'.repeat(200)}${'b'.repeat(400)}${'c'.repeat(200)}`;
  const out = truncateHeadTailToTokens(text, 100); // 200 chars kept each side, 400 dropped = ~100 tokens
  assert.equal(out, `${'a'.repeat(200)}\n...[truncated ~100 tokens]...\n${'c'.repeat(200)}`);
});
