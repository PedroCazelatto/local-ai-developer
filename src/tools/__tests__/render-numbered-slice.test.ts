// Pins read_file's bounded window where backlog item 7 moved it: the backstop cap is now a TOKEN budget
// the caller derives from OLLAMA_NUM_CTX, while `charOffset` stays a CHARACTER position. The invariants:
// the emitted rows never exceed what the cap admits; a line longer than the whole cap is cut and resumed
// at the character it stopped on, so paging always advances; and the slice carries the cap it was
// rendered under, which is what the notice quotes.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateTokens } from '../../core/llm/estimate-tokens.js';
import { renderNumberedSlice } from '../render-numbered-slice.js';

test('a file that fits stops at end-of-file and carries the cap it was rendered under', () => {
  const slice = renderNumberedSlice('a\nb\nc\n', 0, null, 0, 1_170);
  assert.equal(slice.ok, true);
  if (!slice.ok) return;
  assert.equal(slice.text, '1→a\n2→b\n3→c');
  assert.equal(slice.stoppedBy, 'end-of-file');
  assert.equal(slice.tokenCap, 1_170);
  assert.equal(slice.nextOffset, null);
});

test('the token cap stops a read between lines, and the rows fit the cap', () => {
  const text = Array.from({ length: 50 }, () => 'x'.repeat(30)).join('\n');
  const slice = renderNumberedSlice(text, 0, null, 0, 20); // 80 characters' worth
  assert.equal(slice.ok, true);
  if (!slice.ok) return;
  assert.equal(slice.stoppedBy, 'token-cap');
  assert.ok(estimateTokens(slice.text) <= 20, `${slice.text.length} chars fit 20 tokens`);
  assert.ok(slice.nextOffset !== null && slice.nextOffset > 0, 'the notice has somewhere to continue from');
});

test('a line longer than the whole cap is cut mid-line and resumed by character', () => {
  const line = 'y'.repeat(1_000);
  const first = renderNumberedSlice(line, 0, null, 0, 25); // 100 characters' worth
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.stoppedBy, 'token-cap');
  assert.equal(first.cutMidLine, true);
  assert.equal(first.text.length, 100);
  assert.equal(first.nextOffset, 0);
  assert.equal(first.nextCharOffset, 100 - '1→'.length, 'charOffset counts content characters, not the label');

  const second = renderNumberedSlice(line, first.nextOffset ?? 0, null, first.nextCharOffset, 25);
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.charOffset, first.nextCharOffset);
  assert.ok(second.nextCharOffset > first.nextCharOffset, 'paging a long line always advances');
});

test('the line cap still binds when the token cap does not', () => {
  const text = Array.from({ length: 300 }, (_, i) => String(i)).join('\n');
  const slice = renderNumberedSlice(text, 0, null, 0, 1_000_000);
  assert.equal(slice.ok, true);
  if (!slice.ok) return;
  assert.equal(slice.stoppedBy, 'line-cap');
  assert.equal(slice.lastLine, 250);
});
