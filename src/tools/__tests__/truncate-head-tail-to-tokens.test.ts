// Pins the token-budget head+tail cut every host-side git read, the Worker's test capture and debate's
// `background` go through. The invariants: a text that fits passes through untouched; a text that does
// not keeps its head and its tail within the budget, with the marker ON TOP of it (as the character
// version does); the marker says its count is an estimate; and `omittedChars` is the EXACT number of
// characters dropped, since debate records it on the audit row.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateTokens } from '../../core/llm/estimate-tokens.js';
import { truncateHeadTailToTokens } from '../truncate-head-tail-to-tokens.js';

test('a text whose estimate fits the budget comes back unchanged, with nothing omitted', () => {
  const text = 'x'.repeat(400); // 100 tokens
  assert.deepEqual(truncateHeadTailToTokens(text, 100), { text, omittedChars: 0 });
  assert.deepEqual(truncateHeadTailToTokens('', 0), { text: '', omittedChars: 0 });
});

test('an over-budget text keeps its head and its tail, and drops the middle', () => {
  const text = `${'H'.repeat(1_000)}${'M'.repeat(1_000)}${'T'.repeat(1_000)}`;
  const out = truncateHeadTailToTokens(text, 100).text; // half = 50 tokens = 200 chars each side
  const [head, , tail] = out.split('\n');
  assert.equal(head, 'H'.repeat(200));
  assert.equal(tail, 'T'.repeat(200));
  assert.ok(!out.includes('M'), 'nothing of the middle survives');
});

test('head and tail together fit the budget; the marker is the only thing on top', () => {
  const text = 'abcdefghij'.repeat(1_000); // 2 500 tokens, so every budget below cuts
  for (const budget of [1, 2, 99, 100, 2_499]) {
    const lines = truncateHeadTailToTokens(text, budget).text.split('\n');
    assert.equal(lines.length, 3, 'head, marker, tail');
    assert.ok(estimateTokens(`${lines[0]}${lines[2]}`) <= budget, `head + tail fit ${budget}`);
  }
});

test('the marker names the estimated tokens dropped, marked as an estimate', () => {
  const text = `${'a'.repeat(200)}${'b'.repeat(400)}${'c'.repeat(200)}`;
  const out = truncateHeadTailToTokens(text, 100).text; // 200 chars kept each side, 400 dropped = ~100 tokens
  assert.equal(out, `${'a'.repeat(200)}\n...[truncated ~100 tokens]...\n${'c'.repeat(200)}`);
});

test('omittedChars is exactly the characters that did not survive', () => {
  for (const [length, budget] of [[801, 100], [10_000, 7], [5_000, 1]] as const) {
    const text = 'q'.repeat(length);
    const cut = truncateHeadTailToTokens(text, budget);
    const kept = cut.text.split('\n');
    assert.equal(cut.omittedChars, length - (kept[0] ?? '').length - (kept[2] ?? '').length, `${length} at ${budget}`);
  }
});
